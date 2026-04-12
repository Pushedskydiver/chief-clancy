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

type PreflightDecision =
  | { readonly action: 'skip' }
  | { readonly action: 'halt'; readonly verdicts: readonly ReadinessVerdict[] }
  | {
      readonly action: 'proceed';
      readonly greenIds: readonly string[];
      readonly deferred: readonly ReadinessVerdict[];
      readonly allVerdicts: readonly ReadinessVerdict[];
    };

type PreflightIfNeededOpts = {
  readonly shouldRun: boolean;
  readonly isAfkStrict: boolean;
  readonly tickets: readonly { readonly key: string }[];
  readonly gradeOne: GradeOneFn;
  readonly fs: AtomicFs;
  readonly dir: string;
  readonly maxBatch: number;
  readonly resume: boolean;
  readonly timestamp: () => string;
  readonly console: ConsoleLike;
  readonly readFile: (path: string) => string;
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
    // Validate each entry against the zod schema — silently discard malformed
    // entries. Discarded entries will be re-graded, costing extra API calls
    // but producing correct results.
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
  // Note: Array.every() on [] returns true, so hasVerdicts guard is load-bearing.
  const allGreen = batchResult.verdicts.every((v) => v.overall === 'green');
  const canProceed = hasTickets ? hasVerdicts && allGreen : true;

  return { canProceed, verdicts: batchResult.verdicts };
}

// ─── Preflight decision (orchestration) ────────────────────────────────────

/**
 * Run preflight if needed and return a typed decision for the orchestrator.
 *
 * - `skip`: non-AFK or bypass — no preflight ran
 * - `halt`: reds found or no greens available
 * - `proceed`: execution can continue with green ticket ids
 */
function runPreflightIfNeeded(opts: PreflightIfNeededOpts): PreflightDecision {
  if (!opts.shouldRun) return { action: 'skip' };

  const preflight = runLoopPreflight({
    ticketIds: opts.tickets.map((t) => t.key),
    grade: opts.gradeOne,
    fs: opts.fs,
    dir: opts.dir,
    maxBatch: opts.maxBatch,
    resume: opts.resume,
    timestamp: opts.timestamp,
    console: opts.console,
    readFile: opts.readFile,
  });

  const { verdicts } = preflight;
  const hasReds = verdicts.some((v) => v.overall === 'red');
  const greens = verdicts.filter((v) => v.overall === 'green');
  const yellows = verdicts.filter((v) => v.overall === 'yellow');

  // --afk-strict: reds halt, yellows deferred, greens execute
  if (opts.isAfkStrict) {
    if (hasReds) {
      opts.console.log('Pre-flight found red verdicts. Halting.');
      opts.console.log(`Report: ${join(opts.dir, 'readiness-report.md')}`);
      return { action: 'halt', verdicts };
    }
    if (greens.length === 0) {
      opts.console.log('No green tickets to execute. Halting.');
      opts.console.log(`Report: ${join(opts.dir, 'readiness-report.md')}`);
      return { action: 'halt', verdicts };
    }
    return {
      action: 'proceed',
      greenIds: greens.map((v) => v.ticketId),
      deferred: yellows,
      allVerdicts: verdicts,
    };
  }

  // --afk (not strict): halt on any non-green
  if (!preflight.canProceed) {
    opts.console.log('Pre-flight did not produce all-green verdicts. Halting.');
    opts.console.log(`Report: ${join(opts.dir, 'readiness-report.md')}`);
    return { action: 'halt', verdicts };
  }

  return {
    action: 'proceed',
    greenIds: verdicts.map((v) => v.ticketId),
    deferred: [],
    allVerdicts: verdicts,
  };
}

// ─── Exports ───────────────────────────────────────────────────────────────

export { runPreflightIfNeeded };
export type { PreflightDecision };
