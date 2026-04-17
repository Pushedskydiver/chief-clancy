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
  /** Lock check + resume detection. */
  readonly lockCheck: (
    ctx: RunContext,
  ) => Promise<{ readonly action: 'continue' | 'abort' | 'resumed' }>;
  // TODO(error-shape-sweep): migrate preflight/ticketFetch/feasibility/invoke/deliver
  // inline contracts below to the tagged `{ kind: 'unknown'; message }` house shape
  // per CONVENTIONS.md §Error Handling. Deferred from PR-I (#350) — branchSetup was
  // migrated because BranchSetupResult forced the cascade; the rest are independent
  // phase-result types and belong in a dedicated pipeline-phase sweep.
  /** Preflight — binary checks, env, board detection. */
  readonly preflight: (ctx: RunContext) => Promise<
    | { readonly ok: true }
    | {
        readonly ok: false;
        readonly error: { readonly kind: 'unknown'; readonly message: string };
      }
  >;
  /** Epic completion — check for completed epics. */
  readonly epicCompletion: (
    ctx: RunContext,
  ) => Promise<{ readonly results: readonly unknown[] }>;
  /** PR retry — retry PUSHED tickets. */
  readonly prRetry: (
    ctx: RunContext,
  ) => Promise<{ readonly results: readonly unknown[] }>;
  /** Rework detection — check for PR review feedback. */
  readonly reworkDetection: (
    ctx: RunContext,
  ) => Promise<{ readonly isDetected: boolean; readonly ticketKey?: string }>;
  /** Ticket fetch — fetch ticket + resolve branches. */
  readonly ticketFetch: (ctx: RunContext) => Promise<{
    readonly ok: boolean;
    readonly error?: string;
    readonly reason?: string;
  }>;
  // Dry-run (phase 5) is an inline ctx.dryRun check — no dependency needed.
  /** Feasibility — Claude feasibility check. */
  readonly feasibility: (ctx: RunContext) => Promise<{
    readonly ok: boolean;
    readonly error?: string;
    readonly reason?: string;
  }>;
  /** Branch setup — git branch operations + lock write. */
  readonly branchSetup: (ctx: RunContext) => Promise<
    | { readonly ok: true }
    | {
        readonly ok: false;
        readonly error: { readonly kind: 'unknown'; readonly message: string };
      }
  >;
  /** Transition — move ticket to In Progress. */
  readonly transition: (ctx: RunContext) => Promise<{ readonly ok: boolean }>;
  /** Invoke — run Claude session. */
  readonly invoke: (
    ctx: RunContext,
  ) => Promise<{ readonly ok: boolean; readonly error?: string }>;
  /** Deliver — push + PR creation. */
  readonly deliver: (
    ctx: RunContext,
  ) => Promise<{ readonly ok: boolean; readonly error?: string }>;
  /** Cost — log estimated token cost. */
  readonly cost: (ctx: RunContext) => { readonly ok: boolean };
  /** Cleanup — completion data + notification. */
  readonly cleanup: (ctx: RunContext) => Promise<{ readonly ok: boolean }>;
  /** Restore a git branch (best-effort, for error recovery). */
  readonly checkout: (branch: string) => void;
  /** Delete the lock file. Pre-wired with lockFs + projectRoot. */
  readonly deleteLock: () => void;
  /** Delete the verify-attempt file. Pre-wired with lockFs + projectRoot. */
  readonly deleteVerifyAttempt: () => void;
};

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
  // Lock check + resume
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

/** Run all phases after lock-check. Separated for clean error boundaries. */
async function runPhases(
  ctx: RunContext,
  deps: PipelineDeps,
): Promise<PipelineResult> {
  // Preflight
  const preflight = await deps.preflight(ctx);
  if (!preflight.ok)
    return {
      status: 'aborted',
      phase: 'preflight',
      error: preflight.error.message,
    };

  // Epic completion (informational — never aborts)
  await deps.epicCompletion(ctx);

  // PR retry (informational — never aborts)
  await deps.prRetry(ctx);

  // Rework detection (sets ctx.isRework — never aborts)
  await deps.reworkDetection(ctx);

  // Ticket fetch
  const ticket = await deps.ticketFetch(ctx);
  if (!ticket.ok)
    return {
      status: 'aborted',
      phase: 'ticket-fetch',
      error: ticket.error ?? ticket.reason,
    };

  // Dry-run gate
  if (ctx.dryRun) return { status: 'dry-run' };

  // Feasibility
  const feasibility = await deps.feasibility(ctx);
  if (!feasibility.ok)
    return {
      status: 'aborted',
      phase: 'feasibility',
      error: feasibility.error ?? feasibility.reason,
    };

  // Branch setup
  const branch = await deps.branchSetup(ctx);
  if (!branch.ok)
    return {
      status: 'aborted',
      phase: 'branch-setup',
      error: branch.error.message,
    };

  // Transition (best-effort — never aborts)
  await deps.transition(ctx);

  // Invoke Claude session
  const invoke = await deps.invoke(ctx);
  if (!invoke.ok)
    return { status: 'aborted', phase: 'invoke', error: invoke.error };

  // Deliver
  const deliver = await deps.deliver(ctx);
  if (!deliver.ok)
    return { status: 'aborted', phase: 'deliver', error: deliver.error };

  // Cost (best-effort — never aborts)
  deps.cost(ctx);

  // Cleanup (best-effort — never aborts)
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
