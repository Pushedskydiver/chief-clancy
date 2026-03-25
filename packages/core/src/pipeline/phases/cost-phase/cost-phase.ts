/**
 * Cost logging — record duration + estimated tokens.
 *
 * Reads lock file for `startedAt`, uses `CLANCY_TOKEN_RATE` from config.
 * Best-effort — cost logging failure never blocks completion.
 */
import type { RunContext } from '../../context.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Structured result of the cost phase. */
type CostPhaseResult = {
  readonly ok: boolean;
};

/** Options passed to the pre-wired cost entry writer. */
type CostEntryArgs = {
  readonly ticketKey: string;
  readonly startedAt: string;
  readonly tokenRate: number;
};

/** Injected dependencies for cost-phase. */
export type CostPhaseDeps = {
  /** Read the lock file. Pre-wired with lockFs + projectRoot. */
  readonly readLock: () => { readonly startedAt: string } | undefined;
  /** Append a cost entry. Pre-wired with costFs + projectRoot + `now`. */
  readonly appendCostEntry: (args: CostEntryArgs) => void;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_TOKEN_RATE = 6600;

// ─── Phase ───────────────────────────────────────────────────────────────────

/**
 * Log estimated token cost for the current run.
 *
 * Reads the lock file to get `startedAt`, computes token rate from
 * config, and appends a cost entry. Best-effort — always returns
 * `ok: true` regardless of errors.
 *
 * @param ctx - Pipeline context (requires config + ticket from prior phases).
 * @param deps - Injected dependencies.
 * @returns Structured result (always ok).
 */
export function costPhase(
  ctx: RunContext,
  deps: CostPhaseDeps,
): CostPhaseResult {
  try {
    // Safe: pipeline ordering guarantees config + ticket are populated
    const config = ctx.config!;
    const ticket = ctx.ticket!;

    const lock = deps.readLock();
    if (!lock) return { ok: true };

    const tokenRate = parseTokenRate(config.env.CLANCY_TOKEN_RATE);

    deps.appendCostEntry({
      ticketKey: ticket.key,
      startedAt: lock.startedAt,
      tokenRate,
    });
  } catch {
    // Best-effort — cost logging failure never blocks completion
  }

  return { ok: true };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse token rate from env, falling back to default. */
function parseTokenRate(raw: string | undefined): number {
  if (raw == null) return DEFAULT_TOKEN_RATE;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TOKEN_RATE;
}
