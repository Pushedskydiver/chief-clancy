/**
 * Verdict aggregation — compute overall colour from per-check results.
 *
 * Rules:
 * 1. Overall = worst colour across all checks (red > yellow > green).
 * 2. If the number of yellow checks meets or exceeds the threshold,
 *    the overall colour escalates to red.
 */
import type { CheckColour, CheckResult } from './types.js';

/** Default yellow-count threshold before escalation to red. */
const DEFAULT_YELLOW_THRESHOLD = 3;

const COLOUR_RANK: Record<CheckColour, number> = {
  green: 0,
  yellow: 1,
  red: 2,
};

const RANK_TO_COLOUR: readonly CheckColour[] = ['green', 'yellow', 'red'];

/**
 * Compute the overall verdict colour from individual check results.
 *
 * @param checks - Per-check results from the readiness subagent.
 * @param yellowThreshold - Number of yellows that escalates to red (default 3).
 * @returns The aggregated colour.
 */
export function aggregateVerdict(
  checks: readonly CheckResult[],
  yellowThreshold: number = DEFAULT_YELLOW_THRESHOLD,
): CheckColour {
  if (checks.length === 0) return 'red';

  const ranks = checks.map((c) => COLOUR_RANK[c.verdict]);
  const worst = Math.max(...ranks);

  const yellowCount = checks.filter((c) => c.verdict === 'yellow').length;

  if (yellowCount >= yellowThreshold) {
    return 'red';
  }

  return RANK_TO_COLOUR[worst] ?? 'green';
}
