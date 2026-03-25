/**
 * Cleanup — completion result + notification.
 *
 * Returns structured completion data (ticket key, title, elapsed time)
 * for the terminal layer to display. Sends a webhook notification
 * (best-effort) when configured.
 */
import type { RunContext } from '../../context.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Structured result of the cleanup phase. */
type CleanupResult = {
  readonly ok: boolean;
  readonly ticketKey: string;
  readonly ticketTitle: string;
  readonly elapsedMs: number;
};

/** Injected dependencies for cleanup. */
export type CleanupDeps = {
  /** Send a webhook notification. Pre-wired by terminal layer. */
  readonly notify: (webhook: string, message: string) => Promise<void>;
};

// ─── Phase ───────────────────────────────────────────────────────────────────

/**
 * Finalise the pipeline run: compute elapsed time and send notification.
 *
 * Always returns `ok: true` — cleanup failure never blocks completion.
 *
 * @param ctx - Pipeline context (requires config + ticket from prior phases).
 * @param deps - Injected dependencies.
 * @returns Structured completion data for terminal display.
 */
export async function cleanupPhase(
  ctx: RunContext,
  deps: CleanupDeps,
): Promise<CleanupResult> {
  // Safe: pipeline ordering guarantees config + ticket are populated
  const config = ctx.config!;
  const ticket = ctx.ticket!;
  const elapsedMs = Date.now() - ctx.startTime;

  const webhook = config.env.CLANCY_NOTIFY_WEBHOOK;

  if (webhook) {
    try {
      await deps.notify(
        webhook,
        `✓ Clancy completed [${ticket.key}] ${ticket.title}`,
      );
    } catch {
      // Best-effort — notification failure never blocks completion
    }
  }

  return {
    ok: true,
    ticketKey: ticket.key,
    ticketTitle: ticket.title,
    elapsedMs,
  };
}
