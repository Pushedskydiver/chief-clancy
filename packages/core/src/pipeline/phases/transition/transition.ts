/**
 * Transition — move ticket to "In Progress" status.
 *
 * Best-effort: never blocks the pipeline.
 * Returns structured results — no console output.
 */
import type { RunContext } from '../../context.js';
import type { FetchedTicket } from '~/c/types/board.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Structured result of the transition phase. */
type TransitionResult = {
  readonly ok: boolean;
};

/** Injected dependencies for transition. */
export type TransitionDeps = {
  /** Transition a ticket to a new status. Pre-wired with board. */
  readonly transitionTicket: (
    ticket: FetchedTicket,
    status: string,
  ) => Promise<boolean>;
};

// ─── Phase ───────────────────────────────────────────────────────────────────

/**
 * Transition the ticket to "In Progress" status.
 *
 * Best-effort — errors are caught and success is always returned.
 * Only transitions if `CLANCY_STATUS_IN_PROGRESS` is configured.
 *
 * @param ctx - Pipeline context (requires config + ticket from prior phases).
 * @param deps - Injected dependencies.
 * @returns Structured result (always ok: true).
 */
export async function transition(
  ctx: RunContext,
  deps: TransitionDeps,
): Promise<TransitionResult> {
  try {
    // Safe: pipeline ordering guarantees prior phases populate these fields
    const config = ctx.config!;
    const ticket = ctx.ticket!;

    const status = config.env.CLANCY_STATUS_IN_PROGRESS;
    if (status) {
      await deps.transitionTicket(ticket, status);
    }
  } catch {
    // Best-effort — never blocks the pipeline
  }

  return { ok: true };
}
