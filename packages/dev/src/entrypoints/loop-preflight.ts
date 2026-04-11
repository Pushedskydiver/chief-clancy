/**
 * Loop pre-flight helpers — batch grading + report writing for AFK mode.
 */
import type { ReadinessVerdict } from '../agents/types/index.js';
import type { AtomicFs } from '../artifacts/atomic-write/index.js';
import type { GradeOneFn } from '../artifacts/preflight-batch/index.js';
import type { ConsoleLike } from '../types/index.js';

import { join } from 'node:path';

import { readinessVerdictSchema } from '../agents/types/index.js';
import { runPreflightBatch } from '../artifacts/preflight-batch/index.js';
import { writeReadinessReport } from '../artifacts/readiness-report/index.js';

// ─── Types ─────────────────────────────────────────────────────────────────

type PreflightOpts = {
  readonly ticketIds: readonly string[];
  readonly grade: GradeOneFn;
  readonly fs: AtomicFs;
  readonly dir: string;
  readonly maxBatch: number;
  readonly resume: boolean;
  readonly timestamp: () => string;
  readonly console: ConsoleLike;
  /** Injected file reader for partial checkpoint loading. */
  readonly readFile: (path: string) => string;
};

type PreflightResult = {
  /** Whether all tickets are green and execution can proceed. */
  readonly canProceed: boolean;
  readonly verdicts: readonly ReadinessVerdict[];
};

// ─── Partial checkpoint ────────────────────────────────────────────────────

function loadPartialCheckpoint(
  readFile: (path: string) => string,
  dir: string,
): readonly ReadinessVerdict[] | undefined {
  try {
    const raw = readFile(join(dir, 'readiness-report.partial.json'));
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    // Validate each entry against the zod schema — discard malformed entries
    const valid = parsed.filter(
      (v): v is ReadinessVerdict => readinessVerdictSchema.safeParse(v).success,
    );
    return valid.length > 0 ? valid : undefined;
  } catch {
    return undefined;
  }
}

// ─── Run pre-flight ────────────────────────────────────────────────────────

/**
 * Run the pre-flight batch, write the report, and decide whether
 * execution can proceed.
 */
function runLoopPreflight(opts: PreflightOpts): PreflightResult {
  const partial = opts.resume
    ? loadPartialCheckpoint(opts.readFile, opts.dir)
    : undefined;

  const batchResult = runPreflightBatch({
    ticketIds: opts.ticketIds,
    grade: opts.grade,
    fs: opts.fs,
    dir: opts.dir,
    maxBatch: opts.maxBatch,
    timestamp: opts.timestamp,
    console: opts.console,
    partial: partial ?? undefined,
  });

  writeReadinessReport({
    fs: opts.fs,
    dir: opts.dir,
    verdicts: batchResult.verdicts,
    warnings: batchResult.warnings,
    timestamp: opts.timestamp,
  });

  const hasTickets = opts.ticketIds.length > 0;
  const hasVerdicts = batchResult.verdicts.length > 0;
  const allGreen = batchResult.verdicts.every((v) => v.overall === 'green');
  const canProceed = hasTickets ? hasVerdicts && allGreen : true;

  return { canProceed, verdicts: batchResult.verdicts };
}

// ─── Exports ───────────────────────────────────────────────────────────────

export { runLoopPreflight };
