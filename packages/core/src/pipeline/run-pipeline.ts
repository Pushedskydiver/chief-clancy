/**
 * Pipeline orchestrator — runs all phases in sequence.
 *
 * Each phase receives the shared {@link RunContext} and returns a
 * structured result. The orchestrator checks each result to decide
 * whether to continue or exit early. Lock cleanup runs in a `finally`
 * block to guarantee release on all exit paths.
 *
 * No console output — returns a structured {@link PipelineResult}
 * for the terminal layer to display.
 */
import type { RunContext } from './context.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Structured result of a pipeline run. */
export type PipelineResult = {
  readonly status: 'completed' | 'aborted' | 'resumed' | 'dry-run' | 'error';
  readonly phase?: string;
  readonly error?: string;
};

/**
 * Injected dependencies for the pipeline orchestrator.
 *
 * Each field is a pre-wired phase function. The terminal layer
 * creates these by partially applying DI dependencies (exec, fs,
 * board, etc.) so the orchestrator only passes the context.
 */
export type PipelineDeps = {
  /** Phase 0: Lock check + resume detection. */
  readonly lockCheck: (
    ctx: RunContext,
  ) => Promise<{ readonly action: 'continue' | 'abort' | 'resumed' }>;
  /** Phase 1: Preflight — binary checks, env, board detection. */
  readonly preflight: (ctx: RunContext) => Promise<{ readonly ok: boolean }>;
  /** Phase 2: Epic completion — check for completed epics. */
  readonly epicCompletion: (
    ctx: RunContext,
  ) => Promise<{ readonly results: readonly unknown[] }>;
  /** Phase 2a: PR retry — retry PUSHED tickets. */
  readonly prRetry: (
    ctx: RunContext,
  ) => Promise<{ readonly results: readonly unknown[] }>;
  /** Phase 3: Rework detection — check for PR review feedback. */
  readonly reworkDetection: (
    ctx: RunContext,
  ) => Promise<{ readonly detected: boolean }>;
  /** Phase 4: Ticket fetch — fetch ticket + compute branches. */
  readonly ticketFetch: (ctx: RunContext) => Promise<{ readonly ok: boolean }>;
  /** Phase 6: Feasibility — Claude feasibility check. */
  readonly feasibility: (ctx: RunContext) => Promise<{ readonly ok: boolean }>;
  /** Phase 7: Branch setup — git branch operations + lock write. */
  readonly branchSetup: (ctx: RunContext) => Promise<{ readonly ok: boolean }>;
  /** Phase 8: Transition — move ticket to In Progress. */
  readonly transition: (ctx: RunContext) => Promise<{ readonly ok: boolean }>;
  /** Phase 9: Invoke — run Claude session. Returns true if successful. */
  readonly invoke: (ctx: RunContext) => Promise<boolean>;
  /** Phase 10: Deliver — push + PR creation. */
  readonly deliver: (ctx: RunContext) => Promise<{ readonly ok: boolean }>;
  /** Phase 11: Cost — log estimated token cost. */
  readonly cost: (ctx: RunContext) => { readonly ok: boolean };
  /** Phase 12: Cleanup — completion data + notification. */
  readonly cleanup: (ctx: RunContext) => Promise<{ readonly ok: boolean }>;
  /** Restore a git branch (best-effort, for error recovery). */
  readonly checkout: (branch: string) => void;
  /** Delete the lock file. Pre-wired with lockFs + projectRoot. */
  readonly deleteLock: () => void;
  /** Delete the verify-attempt file. Pre-wired with lockFs + projectRoot. */
  readonly deleteVerifyAttempt: () => void;
};

// ─── Orchestrator ────────────────────────────────────────────────────────────

/**
 * Run the full pipeline — all phases + invoke callback.
 *
 * Phases run sequentially. Abort-capable phases stop the pipeline on
 * failure. Informational phases (epic-completion, pr-retry, transition,
 * cost, cleanup) always continue. Lock cleanup runs in `finally`.
 *
 * @param ctx - Pipeline context (created by {@link createContext}).
 * @param deps - Pre-wired phase functions injected by the terminal layer.
 * @returns Structured result indicating how the pipeline exited.
 */
export async function runPipeline(
  ctx: RunContext,
  deps: PipelineDeps,
): Promise<PipelineResult> {
  // Phase 0: Lock check + resume
  const lockResult = await deps.lockCheck(ctx);

  if (lockResult.action === 'abort') {
    return { status: 'aborted', phase: 'lock-check' };
  }

  if (lockResult.action === 'resumed') {
    return { status: 'resumed' };
  }

  try {
    return await runPhases(ctx, deps);
  } catch (error) {
    restoreBranch(ctx, deps);
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'error', error: message };
  } finally {
    cleanupLock(ctx, deps);
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Run phases 1-12. Separated from lock-check for clean error boundaries. */
async function runPhases(
  ctx: RunContext,
  deps: PipelineDeps,
): Promise<PipelineResult> {
  // Phase 1: Preflight
  const preflight = await deps.preflight(ctx);
  if (!preflight.ok) return { status: 'aborted', phase: 'preflight' };

  // Phase 2: Epic completion (informational — never aborts)
  await deps.epicCompletion(ctx);

  // Phase 2a: PR retry (informational — never aborts)
  await deps.prRetry(ctx);

  // Phase 3: Rework detection (sets ctx.isRework — never aborts)
  await deps.reworkDetection(ctx);

  // Phase 4: Ticket fetch
  const ticket = await deps.ticketFetch(ctx);
  if (!ticket.ok) return { status: 'aborted', phase: 'ticket-fetch' };

  // Phase 5: Dry-run gate
  if (ctx.dryRun) return { status: 'dry-run' };

  // Phase 6: Feasibility
  const feasibility = await deps.feasibility(ctx);
  if (!feasibility.ok) return { status: 'aborted', phase: 'feasibility' };

  // Phase 7: Branch setup
  const branch = await deps.branchSetup(ctx);
  if (!branch.ok) return { status: 'aborted', phase: 'branch-setup' };

  // Phase 8: Transition (best-effort — never aborts)
  await deps.transition(ctx);

  // Phase 9: Invoke Claude session
  const invokeOk = await deps.invoke(ctx);
  if (!invokeOk) return { status: 'aborted', phase: 'invoke' };

  // Phase 10: Deliver
  const deliver = await deps.deliver(ctx);
  if (!deliver.ok) return { status: 'aborted', phase: 'deliver' };

  // Phase 11: Cost (best-effort — never aborts)
  deps.cost(ctx);

  // Phase 12: Cleanup (best-effort — never aborts)
  await deps.cleanup(ctx);

  return { status: 'completed' };
}

/** Best-effort: restore the branch the user was on before Clancy started. */
function restoreBranch(ctx: RunContext, deps: PipelineDeps): void {
  if (!ctx.originalBranch) return;

  try {
    deps.checkout(ctx.originalBranch);
  } catch {
    // Best-effort — branch restore failure is non-critical
  }
}

/** Clean up lock + verify-attempt if this run created them. */
function cleanupLock(ctx: RunContext, deps: PipelineDeps): void {
  if (ctx.lockOwner !== true) return;

  try {
    deps.deleteLock();
  } catch {
    // Best-effort
  }

  try {
    deps.deleteVerifyAttempt();
  } catch {
    // Best-effort
  }
}
