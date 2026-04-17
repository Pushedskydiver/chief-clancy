/**
 * Feasibility check — evaluate whether a ticket can be
 * implemented as pure code changes.
 *
 * Skipped for rework tickets and when `--skip-feasibility` flag is set.
 * Returns structured results — no console output.
 */
import type { RunContext } from '../context.js';
import type { ProgressStatus } from '@chief-clancy/core/types/progress.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Ticket metadata passed to the feasibility check. */
type FeasibilityTicket = {
  readonly key: string;
  readonly title: string;
  readonly description: string;
};

/** Result from the feasibility check function. */
type FeasibilityCheckResult = {
  readonly isFeasible: boolean;
  readonly reason?: string;
};

/** Structured result of the feasibility phase. */
type FeasibilityPhaseResult = {
  readonly ok: boolean;
  readonly skipped: boolean;
  readonly reason?: string;
};

/** Progress append function (pre-wired with fs + projectRoot by terminal). */
type AppendFn = (opts: {
  readonly key: string;
  readonly summary: string;
  readonly status: ProgressStatus;
}) => void;

/** Injected dependencies for feasibility. */
export type FeasibilityPhaseDeps = {
  /** Run the feasibility check. Pre-wired with Claude invocation. Async — spawns a subprocess. */
  readonly checkFeasibility: (
    ticket: FeasibilityTicket,
    model?: string,
  ) => Promise<FeasibilityCheckResult>;
  /** Append a progress entry. Pre-wired with progressFs + projectRoot. */
  readonly appendProgress: AppendFn;
};

// ─── Phase ───────────────────────────────────────────────────────────────────

/**
 * Evaluate whether a ticket is feasible as pure code changes.
 *
 * Skipped for rework tickets (already vetted) and when the
 * `--skip-feasibility` flag is set.
 *
 * @param ctx - Pipeline context (requires ticket from ticket-fetch).
 * @param deps - Injected dependencies.
 * @returns Structured result indicating feasibility or skip.
 */
export async function feasibilityPhase(
  ctx: RunContext,
  deps: FeasibilityPhaseDeps,
): Promise<FeasibilityPhaseResult> {
  if (ctx.isRework === true || ctx.skipFeasibility) {
    return { ok: true, skipped: true };
  }

  // Safe: pipeline ordering guarantees prior phases populate these fields
  const ticket = ctx.ticket!;
  const config = ctx.config!;

  const result = await deps.checkFeasibility(
    { key: ticket.key, title: ticket.title, description: ticket.description },
    config.env.CLANCY_MODEL,
  );

  if (!result.isFeasible) {
    deps.appendProgress({
      key: ticket.key,
      summary: ticket.title,
      status: 'SKIPPED',
    });
    return {
      ok: false,
      skipped: false,
      reason: result.reason ?? 'not implementable as code changes',
    };
  }

  return { ok: true, skipped: false };
}
