/**
 * Readiness gate — grade a ticket, retry on yellow, refuse on red.
 *
 * The gate runs up to `maxRounds` grading attempts. On green it passes
 * immediately. On red it fails immediately (no retry). On yellow it
 * retries until green or maxRounds exhausted.
 */
import type {
  CheckColour,
  ReadinessVerdict,
} from '../../agents/types/index.js';

import { aggregateVerdict } from '../../agents/aggregate/index.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type GradeResult =
  | { readonly ok: true; readonly verdict: ReadinessVerdict }
  | { readonly ok: false; readonly error: string };

type GatePassed = {
  readonly passed: true;
  readonly verdict: ReadinessVerdict;
};

type GateFailed = {
  readonly passed: false;
  readonly overall?: CheckColour;
  readonly verdict?: ReadinessVerdict;
  readonly error?: string;
};

type GateResult = GatePassed | GateFailed;

type GateOpts = {
  /** Function that grades the ticket (wraps invokeReadinessGrade). */
  readonly grade: () => GradeResult;
  /** Maximum grading rounds including the initial grade. */
  readonly maxRounds: number;
};

// ─── Gate ────────────────────────────────────────────────────────────────────

/**
 * Run the readiness gate loop.
 *
 * @param opts - Grade function and max rounds.
 * @returns Whether the ticket passed the gate.
 */
export function runReadinessGate(opts: GateOpts): GateResult {
  return gradeRound(opts.grade, 0, opts.maxRounds);
}

function gradeRound(
  grade: GateOpts['grade'],
  round: number,
  maxRounds: number,
): GateResult {
  if (round >= maxRounds) {
    return { passed: false, error: 'No grading rounds executed' };
  }

  const result = grade();

  if (!result.ok) {
    return { passed: false, error: result.error };
  }

  const { verdict } = result;
  const computed = aggregateVerdict(verdict.checks);

  if (computed === 'green') {
    return { passed: true, verdict };
  }

  if (computed === 'red') {
    return { passed: false, overall: 'red', verdict };
  }

  // Yellow — retry if rounds remain, otherwise fail
  if (round + 1 >= maxRounds) {
    return { passed: false, overall: 'yellow', verdict };
  }

  return gradeRound(grade, round + 1, maxRounds);
}
