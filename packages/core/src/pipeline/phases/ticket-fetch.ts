/**
 * Phase 4: Ticket fetch — fresh ticket fetch (or use rework ticket),
 * max rework guard, and branch name computation.
 *
 * Sets `ctx.ticket` and computed branch names on the context.
 * Returns structured results — no console output.
 */
import type { RunContext } from '../context.js';
import type { BoardConfig } from '~/c/schemas/env/env.js';
import type { Board, BoardProvider, FetchedTicket } from '~/c/types/board.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Structured result of the ticket-fetch phase. */
type TicketFetchResult = {
  readonly ok: boolean;
  readonly reason?: 'no-tickets' | 'max-rework';
  readonly ticketKey?: string;
};

/** Progress append function (pre-wired with fs + projectRoot by terminal). */
type AppendFn = (opts: {
  readonly key: string;
  readonly summary: string;
  readonly status: string;
}) => void;

/** Injected dependencies for ticket-fetch. */
export type TicketFetchDeps = {
  /** Fetch the next available ticket from the board. */
  readonly fetchTicket: (board: Board) => Promise<FetchedTicket | undefined>;
  /** Count rework cycles for a ticket key. Pre-wired with progressFs + projectRoot. */
  readonly countReworkCycles: (key: string) => number;
  /** Append a progress entry. Pre-wired with progressFs + projectRoot. */
  readonly appendProgress: AppendFn;
  /** Compute feature branch name from provider + key. */
  readonly computeTicketBranch: (
    provider: BoardProvider,
    key: string,
  ) => string;
  /** Compute target branch from provider + baseBranch + optional parent. */
  readonly computeTargetBranch: (
    provider: BoardProvider,
    baseBranch: string,
    parent?: string,
  ) => string;
};

// ─── Phase ───────────────────────────────────────────────────────────────────

/**
 * Fetch a ticket (or use existing rework ticket), guard max rework,
 * and compute branch names.
 *
 * @param ctx - Pipeline context (requires config + board from preflight).
 * @param deps - Injected dependencies.
 * @returns Structured result indicating success or reason for early exit.
 */
export async function ticketFetch(
  ctx: RunContext,
  deps: TicketFetchDeps,
): Promise<TicketFetchResult> {
  // Safe: pipeline ordering guarantees preflight runs before ticket-fetch
  const config = ctx.config!;

  // Use existing ticket (from rework) or fetch fresh
  if (!ctx.ticket) {
    const fetched = await deps.fetchTicket(ctx.board!);
    if (!fetched) return { ok: false, reason: 'no-tickets' };
    ctx.setTicket(fetched);
  }

  const ticket = ctx.ticket!;

  // Max rework guard
  if (ctx.isRework === true) {
    const guardResult = applyMaxReworkGuard(config, ticket, deps);
    if (guardResult) return guardResult;
  }

  // Compute and store branch names
  const branches = computeBranches(ctx, deps);
  ctx.setTicketBranches(branches);

  return { ok: true, ticketKey: ticket.key };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Check if a rework ticket has exceeded the max rework cycle limit. */
function applyMaxReworkGuard(
  config: BoardConfig,
  ticket: FetchedTicket,
  deps: TicketFetchDeps,
): TicketFetchResult | undefined {
  const maxRework = parseMaxRework(config.env.CLANCY_MAX_REWORK);
  const cycles = deps.countReworkCycles(ticket.key);

  if (cycles >= maxRework) {
    deps.appendProgress({
      key: ticket.key,
      summary: ticket.title,
      status: 'SKIPPED',
    });
    return { ok: false, reason: 'max-rework', ticketKey: ticket.key };
  }

  return undefined;
}

/** Parse CLANCY_MAX_REWORK env var, defaulting to 3. Zero means no rework allowed. */
function parseMaxRework(value: string | undefined): number {
  const parsed = parseInt(value ?? '3', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 3;
}

/** Compute ticket and target branch names from ticket metadata. */
function computeBranches(
  ctx: RunContext,
  deps: TicketFetchDeps,
): {
  readonly ticketBranch: string;
  readonly targetBranch: string;
  readonly baseBranch: string;
  readonly hasParent: boolean;
} {
  // Safe: pipeline ordering guarantees prior phases populate these fields
  const config = ctx.config!;
  const ticket = ctx.ticket!;
  const baseBranch = config.env.CLANCY_BASE_BRANCH ?? 'main';
  const hasParent = ticket.parentInfo !== 'none';
  const parent = hasParent ? ticket.parentInfo : undefined;
  const ticketBranch = deps.computeTicketBranch(config.provider, ticket.key);
  const targetBranch = deps.computeTargetBranch(
    config.provider,
    baseBranch,
    parent,
  );

  return { ticketBranch, targetBranch, baseBranch, hasParent };
}
