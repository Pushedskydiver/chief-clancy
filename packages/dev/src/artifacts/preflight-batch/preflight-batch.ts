/**
 * Pre-flight batch grader — grade all tickets in the queue before
 * execution, with full error matrix handling.
 *
 * Error matrix:
 * - Grading failure → synthetic red verdict with error reason
 * - Batch cap (--max-batch) → truncation with warning
 * - Duplicate ticket ids → dedupe with warning
 * - Partial checkpoint → written after every grade for --resume
 * - Cost estimate → logged before the loop starts
 */
import type {
  CheckResult,
  ReadinessVerdict,
} from '../../agents/types/index.js';
import type { ConsoleLike } from '../../types/index.js';
import type { AtomicFs } from '../atomic-write/index.js';

import { join } from 'node:path';

import { READINESS_CHECK_IDS } from '../../agents/types/index.js';
import { atomicWrite } from '../atomic-write/index.js';

// ─── Constants ─────────────────────────────────────────────────────────────
// Cosmetic cost estimates — logged to console, not gating.
// Update if the default grading model changes from Haiku.

const AVG_INPUT_TOKENS_PER_GRADE = 2000;
const AVG_OUTPUT_TOKENS_PER_GRADE = 500;
const HAIKU_INPUT_COST_PER_1K = 0.001;
const HAIKU_OUTPUT_COST_PER_1K = 0.005;

const PARTIAL_FILE = 'readiness-report.partial.json';

// ─── Types ─────────────────────────────────────────────────────────────────

type GradeResult =
  | { readonly ok: true; readonly verdict: ReadinessVerdict }
  | { readonly ok: false; readonly error: string };

type GradeOneFn = (ticketId: string) => GradeResult;

type BatchGradeOpts = {
  readonly ticketIds: readonly string[];
  readonly grade: GradeOneFn;
  readonly fs: AtomicFs;
  readonly dir: string;
  readonly maxBatch: number;
  readonly timestamp: () => string;
  readonly console: ConsoleLike;
  /** Previously graded verdicts to resume from (--resume). */
  readonly partial?: readonly ReadinessVerdict[];
};

type BatchGradeResult = {
  readonly verdicts: readonly ReadinessVerdict[];
  readonly warnings: readonly string[];
};

// ─── Synthetic verdict for failures ────────────────────────────────────────

function syntheticRedVerdict(
  ticketId: string,
  error: string,
  timestamp: string,
): ReadinessVerdict {
  const checks: readonly CheckResult[] = READINESS_CHECK_IDS.map((id) => ({
    id,
    verdict: 'red' as const,
    reason: `Grading failed: ${error}`,
  }));

  return {
    ticketId,
    overall: 'red',
    checks: [...checks],
    gradedAt: timestamp,
    rubricSha: 'N/A',
  };
}

// ─── Cost estimate ─────────────────────────────────────────────────────────

function logCostEstimate(con: ConsoleLike, count: number): void {
  const inputCost =
    (count * AVG_INPUT_TOKENS_PER_GRADE * HAIKU_INPUT_COST_PER_1K) / 1000;
  const outputCost =
    (count * AVG_OUTPUT_TOKENS_PER_GRADE * HAIKU_OUTPUT_COST_PER_1K) / 1000;
  const totalCost = inputCost + outputCost;
  const minutes = Math.ceil((count * 10) / 60); // ~10s per grade estimate

  con.log(
    `Will grade ${count} ticket${count === 1 ? '' : 's'} (~$${totalCost.toFixed(3)}, ~${minutes} min).`,
  );
}

// ─── Partial checkpoint ────────────────────────────────────────────────────

function writePartialCheckpoint(
  fs: AtomicFs,
  dir: string,
  verdicts: readonly ReadinessVerdict[],
): void {
  atomicWrite(
    fs,
    join(dir, PARTIAL_FILE),
    JSON.stringify(verdicts, null, 2) + '\n',
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

/**
 * Run the pre-flight batch grading.
 *
 * @param opts - Tickets, grader, filesystem, and config.
 * @returns Verdicts and any warnings generated.
 */
function dedupeTickets(ids: readonly string[]): {
  readonly deduped: readonly string[];
  readonly warnings: readonly string[];
} {
  type Acc = {
    readonly seen: ReadonlySet<string>;
    readonly deduped: readonly string[];
    readonly warnings: readonly string[];
  };
  const initial: Acc = { seen: new Set(), deduped: [], warnings: [] };

  const { deduped, warnings } = ids.reduce<Acc>((acc, id) => {
    if (acc.seen.has(id)) {
      return {
        ...acc,
        warnings: [
          ...acc.warnings,
          `Duplicate ticket ${id} removed (kept first occurrence)`,
        ],
      };
    }
    return {
      seen: new Set([...acc.seen, id]),
      deduped: [...acc.deduped, id],
      warnings: acc.warnings,
    };
  }, initial);

  return { deduped, warnings };
}

function runPreflightBatch(opts: BatchGradeOpts): BatchGradeResult {
  const { grade, fs, dir, maxBatch, timestamp, console: con } = opts;

  // 1. Dedupe
  const { deduped, warnings: dupeWarnings } = dedupeTickets(opts.ticketIds);

  // 2. Truncate to maxBatch
  const truncWarning =
    deduped.length > maxBatch
      ? [
          `Batch truncated from ${deduped.length} to ${maxBatch} — use --max-batch=N to override`,
        ]
      : [];
  const ticketIds =
    deduped.length > maxBatch ? deduped.slice(0, maxBatch) : deduped;
  const warnings = [...dupeWarnings, ...truncWarning];

  // 3. Empty queue
  if (ticketIds.length === 0) {
    return { verdicts: [], warnings };
  }

  // 4. Build set of already-graded ids from partial
  const partialMap = new Map(
    (opts.partial ?? []).map((v) => [v.ticketId, v] as const),
  );

  const toGrade = ticketIds.filter((id) => !partialMap.has(id));

  // 5. Cost estimate
  if (toGrade.length > 0) {
    logCostEstimate(con, toGrade.length);
  }

  // 6. Grade each ticket — accumulate via reduce
  const partialVerdicts = ticketIds
    .filter((id) => partialMap.has(id))
    .map((id) => partialMap.get(id)!);

  const graded = toGrade.reduce<readonly ReadinessVerdict[]>((acc, id) => {
    const result = grade(id);
    const verdict = result.ok
      ? result.verdict
      : syntheticRedVerdict(id, result.error, timestamp());
    const next = [...acc, verdict];
    writePartialCheckpoint(fs, dir, next);
    return next;
  }, partialVerdicts);

  // Reorder to match original ticketIds order
  const orderMap = new Map(ticketIds.map((id, i) => [id, i] as const));
  const sorted = graded
    .slice()
    .sort(
      (a, b) =>
        (orderMap.get(a.ticketId) ?? 0) - (orderMap.get(b.ticketId) ?? 0),
    );

  return { verdicts: sorted, warnings };
}

// ─── Exports ───────────────────────────────────────────────────────────────

export { runPreflightBatch };
export type { BatchGradeOpts, BatchGradeResult, GradeOneFn };
