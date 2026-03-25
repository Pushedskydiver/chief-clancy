/**
 * Rework detection — detect PR-based rework from reviewer feedback.
 *
 * Best-effort: wrapped in try/catch. Never blocks the pipeline.
 * Returns structured results — no console output.
 */
import type { RunContext } from '../../context.js';
import type { BoardConfig } from '~/c/schemas/env/env.js';
import type { FetchedTicket } from '~/c/types/board.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Data returned by the pre-wired rework detection function. */
type ReworkData = {
  readonly ticket: FetchedTicket;
  readonly feedback: readonly string[];
  readonly prNumber: number;
  readonly discussionIds?: readonly string[];
  readonly reviewers: readonly string[];
};

/** Structured result of the rework-detection phase. */
type ReworkDetectionResult = {
  readonly detected: boolean;
  readonly ticketKey?: string;
};

/** Injected dependencies for rework-detection. */
export type ReworkDetectionDeps = {
  /** Detect rework from PR reviews. Pre-wired with progressFs/handlers. */
  readonly fetchRework: (
    config: BoardConfig,
  ) => Promise<ReworkData | undefined>;
};

// ─── Phase ───────────────────────────────────────────────────────────────────

/**
 * Detect PR-based rework from reviewer feedback.
 *
 * Best-effort — errors are caught and a non-detected result is returned.
 * Never blocks the pipeline.
 *
 * @param ctx - Pipeline context (requires config from preflight).
 * @param deps - Injected dependencies.
 * @returns Structured result indicating whether rework was detected.
 */
export async function reworkDetection(
  ctx: RunContext,
  deps: ReworkDetectionDeps,
): Promise<ReworkDetectionResult> {
  try {
    return await detect(ctx, deps);
  } catch {
    return { detected: false };
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Run rework detection and populate context on match. */
async function detect(
  ctx: RunContext,
  deps: ReworkDetectionDeps,
): Promise<ReworkDetectionResult> {
  // Safe: pipeline ordering guarantees preflight runs before rework-detection
  const config = ctx.config!;
  const rework = await deps.fetchRework(config);

  if (!rework) return { detected: false };

  ctx.setRework({
    isRework: true,
    prFeedback: rework.feedback,
    reworkPrNumber: rework.prNumber,
    reworkDiscussionIds: rework.discussionIds,
    reworkReviewers: rework.reviewers,
  });
  ctx.setTicket(rework.ticket);

  return { detected: true, ticketKey: rework.ticket.key };
}
