/**
 * Phase 5: Dry-run gate — returns ticket info for display and signals
 * early exit when `--dry-run` is active.
 *
 * No dependencies — all data comes from context. No console output.
 */
import type { RunContext } from '../../context.js';
import type { BoardProvider } from '~/c/types/board.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Ticket details surfaced in a dry-run result. */
type DryRunTicketInfo = {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly parentInfo: string;
  readonly blockers: string;
  readonly ticketBranch: string;
  readonly targetBranch: string;
  readonly isRework: boolean;
  readonly provider: BoardProvider;
};

/** Structured result of the dry-run phase. */
type DryRunResult = {
  readonly isDryRun: boolean;
  readonly ticketInfo?: DryRunTicketInfo;
};

// ─── Phase ───────────────────────────────────────────────────────────────────

/**
 * Check the dry-run flag and return ticket info for display.
 *
 * When `ctx.dryRun` is `true`, returns ticket details so the terminal
 * layer can display them and exit. When `false`, returns a pass-through
 * result to continue the pipeline.
 *
 * @param ctx - Pipeline context (requires ticket + branches from prior phases).
 * @returns Structured result with ticket info if dry-run, or pass-through.
 */
export function dryRun(ctx: RunContext): DryRunResult {
  if (!ctx.dryRun) return { isDryRun: false };

  // Safe: pipeline ordering guarantees prior phases populate these fields
  const ticket = ctx.ticket!;
  const config = ctx.config!;

  return {
    isDryRun: true,
    ticketInfo: {
      key: ticket.key,
      title: ticket.title,
      description: ticket.description,
      parentInfo: ticket.parentInfo,
      blockers: ticket.blockers,
      ticketBranch: ctx.ticketBranch!,
      targetBranch: ctx.targetBranch!,
      isRework: ctx.isRework === true,
      provider: config.provider,
    },
  };
}
