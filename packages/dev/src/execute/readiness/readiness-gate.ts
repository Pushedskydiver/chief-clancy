/**
 * Readiness gate — grade a ticket, retry on yellow, refuse on red.
 *
 * The gate runs up to `maxRounds` grading attempts. On green it passes
 * immediately. On red it fails immediately (no retry). On yellow it
 * retries until green or maxRounds exhausted.
 */
import type { CheckColour, ReadinessVerdict } from '../../agents/types.js';

import { aggregateVerdict } from '../../agents/aggregate.js';

type GradeResult =
  | { readonly ok: true; readonly verdict: ReadinessVerdict }
  | {
      readonly ok: false;
      readonly error: { readonly kind: 'unknown'; readonly message: string };
    };

type GatePassed = {
  readonly passed: true;
  readonly verdict: ReadinessVerdict;
};

type GateFailed = {
  readonly passed: false;
  readonly overall?: CheckColour;
  readonly verdict?: ReadinessVerdict;
  readonly error?: { readonly kind: 'unknown'; readonly message: string };
};

type GateResult = GatePassed | GateFailed;

type GateOpts = {
  /** Function that grades the ticket (wraps invokeReadinessGrade). */
  readonly grade: () => GradeResult;
  /** Maximum grading rounds including the initial grade. */
  readonly maxRounds: number;
};

export type { GateResult };

/**
 * Run the readiness gate loop.
 *
 * Passes on green, fails immediately on red, retries on yellow up to
 * `maxRounds` grading attempts. Overrides the subagent-reported overall
 * colour with the locally-aggregated one to defend against inconsistent
 * grading.
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
    return {
      passed: false,
      error: { kind: 'unknown', message: 'No grading rounds executed' },
    };
  }

  const result = grade();

  if (!result.ok) {
    return { passed: false, error: result.error };
  }

  const { verdict } = result;
  const computed = aggregateVerdict(verdict.checks);
  // Override subagent's overall with our recomputed value
  const correctedVerdict = { ...verdict, overall: computed };

  if (computed === 'green') {
    return { passed: true, verdict: correctedVerdict };
  }

  if (computed === 'red') {
    return { passed: false, overall: 'red', verdict: correctedVerdict };
  }

  // Yellow — retry if rounds remain, otherwise fail
  if (round + 1 >= maxRounds) {
    return { passed: false, overall: 'yellow', verdict: correctedVerdict };
  }

  return gradeRound(grade, round + 1, maxRounds);
}
