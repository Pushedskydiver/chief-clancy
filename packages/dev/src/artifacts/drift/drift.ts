/**
 * Drift detection — best-effort comparison of predicted vs actual changed files.
 *
 * Extracts file paths from readiness verdict evidence (typed `expectedFiles`
 * array if present) or regex-matches from reason strings. The drift report
 * is informational only — logged, not gating.
 */
import type { ReadinessVerdict } from '../../agents/types/index.js';
import type { AtomicFs } from '../atomic-write/index.js';

import { join } from 'node:path';

import { atomicWrite } from '../atomic-write/index.js';

// ─── Types ─────────────────────────────────────────────────────────────────

type DriftResult = {
  readonly predicted: readonly string[];
  readonly actual: readonly string[];
  readonly unpredicted: readonly string[];
  readonly missed: readonly string[];
};

type WriteDriftOpts = {
  readonly fs: AtomicFs;
  readonly dir: string;
  readonly drift: DriftResult;
};

// ─── Path extraction ──────────────────────────────────────────────────────

/**
 * Match file paths like `src/foo/bar.ts` or `packages/dev/src/index.ts`.
 * Best-effort: may match false positives in URLs or version strings.
 * Drift data is informational only, so false positives are acceptable.
 */
const FILE_PATH_RE = /(?:[\w@.-]+\/)+[\w.-]+\.\w+/g;

function extractFromEvidence(
  evidence: Record<string, unknown> | undefined,
): readonly string[] {
  if (!evidence) return [];
  const files = evidence.expectedFiles;
  if (Array.isArray(files) && files.every((f) => typeof f === 'string')) {
    return files;
  }
  return [];
}

function extractFromReason(reason: string): readonly string[] {
  return [...reason.matchAll(FILE_PATH_RE)].map((m) => m[0]);
}

function extractPredictedPaths(
  verdicts: readonly ReadinessVerdict[],
): readonly string[] {
  const touchBoundedChecks = verdicts
    .map((v) => v.checks.find((c) => c.id === 'touch-bounded'))
    .filter((c): c is NonNullable<typeof c> => c !== undefined);

  return [
    ...new Set(
      touchBoundedChecks.flatMap((check) => {
        const fromEvidence = extractFromEvidence(check.evidence);
        return fromEvidence.length > 0
          ? fromEvidence
          : extractFromReason(check.reason);
      }),
    ),
  ];
}

// ─── Compute drift ────────────────────────────────────────────────────────

function computeDrift(
  verdicts: readonly ReadinessVerdict[],
  changedFiles: readonly string[],
): DriftResult {
  const predicted = extractPredictedPaths(verdicts);
  const predictedSet = new Set(predicted);
  const actualSet = new Set(changedFiles);

  return {
    predicted: [...predicted],
    actual: [...changedFiles],
    unpredicted: changedFiles.filter((f) => !predictedSet.has(f)),
    missed: predicted.filter((f) => !actualSet.has(f)),
  };
}

// ─── Writer ───────────────────────────────────────────────────────────────

function writeDrift(opts: WriteDriftOpts): void {
  const filePath = join(opts.dir, 'drift.json');
  atomicWrite(opts.fs, filePath, JSON.stringify(opts.drift, null, 2) + '\n');
}

// ─── High-level helper ────────────────────────────────────────────────────

type WriteDriftIfPossibleOpts = {
  readonly verdicts: readonly ReadinessVerdict[];
  readonly exec: (args: readonly string[]) => string;
  readonly fs: AtomicFs;
  readonly dir: string;
  /** SHA captured before execution started — diff baseline. */
  readonly baseSha: string;
  readonly console: { readonly log: (message: string) => void };
};

/** Run git diff from pre-execution baseline, compute drift, write drift.json. No-op on git failure. */
function writeDriftIfPossible(opts: WriteDriftIfPossibleOpts): void {
  try {
    const stdout = opts.exec(['diff', '--name-only', `${opts.baseSha}...HEAD`]);
    const changedFiles = stdout
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const drift = computeDrift(opts.verdicts, changedFiles);
    writeDrift({ fs: opts.fs, dir: opts.dir, drift });
  } catch {
    opts.console.log('Drift detection skipped (git diff failed).');
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────

export { computeDrift, writeDrift, writeDriftIfPossible };
