/**
 * Preflight — env checks, board detection, validation, and ping.
 *
 * Sets `ctx.config` and `ctx.board` on success. Returns structured results
 * — no console output. The terminal layer handles display.
 */
import type { RunContext } from '../context.js';
import type { BoardConfig } from '@chief-clancy/core/schemas/env.js';
import type { Board } from '@chief-clancy/core/types/board.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Structured result of the preflight phase. */
type PreflightPhaseResult = {
  readonly ok: boolean;
  readonly error?: string;
  readonly warning?: string;
};

/** Preflight check result (subset of full PreflightResult). */
type PreflightCheckResult = {
  readonly ok: boolean;
  readonly error?: string;
  readonly warning?: string;
  readonly env?: Record<string, string>;
};

/** Injected dependencies for the preflight phase. */
export type PreflightPhaseDeps = {
  /** Run preflight checks (binaries, env, git state). Pre-wired with exec/envFs. */
  readonly runPreflight: (projectRoot: string) => PreflightCheckResult;
  readonly detectBoard: (env: Record<string, string>) => BoardConfig | string;
  readonly createBoard: (config: BoardConfig) => Board;
};

// ─── Phase ───────────────────────────────────────────────────────────────────

/**
 * Run preflight checks, detect board, validate, and ping.
 *
 * On success, sets `ctx.config` and `ctx.board`. On failure, returns
 * structured error without mutating context.
 *
 * @param ctx - Pipeline context.
 * @param deps - Injected dependencies (preflight, board detection, factory).
 * @returns Structured result with `ok`, optional `error`/`warning`.
 */
export async function preflightPhase(
  ctx: RunContext,
  deps: PreflightPhaseDeps,
): Promise<PreflightPhaseResult> {
  // 1. Preflight checks (binaries, env, git)
  const preflight = deps.runPreflight(ctx.projectRoot);

  if (!preflight.ok) {
    return { ok: false, error: preflight.error };
  }

  // 2. Detect board from env
  if (!preflight.env) {
    return { ok: false, error: 'Preflight passed but env is missing' };
  }

  const boardResult = deps.detectBoard(preflight.env);

  if (typeof boardResult === 'string') {
    return { ok: false, error: boardResult };
  }

  // 3. Create board and validate
  const board = deps.createBoard(boardResult);
  const validationError = board.validateInputs();

  if (validationError) {
    return { ok: false, error: validationError };
  }

  // 4. Ping board
  const ping = await board.ping();

  if (!ping.ok) {
    return { ok: false, error: ping.error };
  }

  // Success — populate context
  ctx.setPreflight(boardResult, board);

  return { ok: true, warning: preflight.warning };
}
