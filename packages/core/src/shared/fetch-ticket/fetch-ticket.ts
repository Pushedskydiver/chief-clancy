/**
 * Ticket fetching orchestrator.
 *
 * Fetches the next available unblocked ticket from a board, filtering
 * by pipeline labels and blocker status. All board interaction goes
 * through the injected {@link Board} abstraction.
 */
import type { Board, FetchedTicket } from '~/c/types/board.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Options for ticket fetching behaviour. */
type FetchTicketOpts = {
  /** If `true`, excludes tickets with the `clancy:hitl` label. */
  readonly isAfk?: boolean;
};

// ─── Label resolvers ─────────────────────────────────────────────────────────

/**
 * Resolve the implementation queue label.
 *
 * Uses `CLANCY_LABEL_BUILD` if set, falls back to `CLANCY_LABEL` for
 * backward compatibility.
 *
 * @returns The resolved label, or `undefined` if neither env var is set.
 */
export function resolveBuildLabel(
  env: Record<string, string | undefined>,
): string | undefined {
  return env.CLANCY_LABEL_BUILD || env.CLANCY_LABEL || undefined;
}

/**
 * Resolve the plan queue label.
 *
 * Used as an exclusion filter — tickets with this label are still in the
 * planning queue and should not be picked up for implementation.
 *
 * @returns The resolved label, or `undefined` if neither env var is set.
 */
export function resolvePlanLabel(
  env: Record<string, string | undefined>,
): string | undefined {
  return env.CLANCY_LABEL_PLAN || env.CLANCY_PLAN_LABEL || undefined;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Whether the current run is in AFK mode (exclude hitl tickets). */
function isAfkMode(
  env: Record<string, string | undefined>,
  opts?: FetchTicketOpts,
): boolean {
  return opts?.isAfk ?? env.CLANCY_AFK_MODE === '1';
}

/** Format a selection log line. */
function selectedMsg(ticket: FetchedTicket): string {
  const status = ticket.status ? ` (status: ${ticket.status})` : '';
  return `Selected ${ticket.key}${status}`;
}

/**
 * Walk candidates sequentially, returning the first unblocked ticket
 * that does not have the plan label.
 */
async function firstUnblocked(
  board: Board,
  candidates: readonly FetchedTicket[],
  planLabel: string | undefined,
): Promise<FetchedTicket | undefined> {
  if (candidates.length === 0) return undefined;

  const [candidate, ...rest] = candidates;

  if (planLabel && candidate.labels?.includes(planLabel)) {
    console.log(`Skipping ${candidate.key} — still has plan label`);
    return firstUnblocked(board, rest, planLabel);
  }

  const blocked = await board.fetchBlockerStatus(candidate);

  if (!blocked) {
    console.log(selectedMsg(candidate));
    return candidate;
  }

  console.log(`Skipping ${candidate.key} — blocked`);
  return firstUnblocked(board, rest, planLabel);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch the next available unblocked ticket from the board.
 *
 * Fetches candidate tickets via the Board abstraction and returns the first
 * one that is not blocked and not still in the planning queue.
 *
 * In AFK mode (`CLANCY_AFK_MODE=1` or `opts.isAfk`), tickets with the
 * `clancy:hitl` label are excluded from the candidate pool.
 *
 * @returns The first unblocked ticket, or `undefined` if none available.
 */
export async function fetchTicket(
  board: Board,
  opts?: FetchTicketOpts,
): Promise<FetchedTicket | undefined> {
  const env = board.sharedEnv();
  const excludeHitl = isAfkMode(env, opts);
  const buildLabel = resolveBuildLabel(env);
  const planLabel = resolvePlanLabel(env);
  const candidates = await board.fetchTickets({ excludeHitl, buildLabel });

  return firstUnblocked(board, candidates, planLabel);
}
