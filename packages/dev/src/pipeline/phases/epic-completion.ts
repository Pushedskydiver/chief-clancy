/**
 * Epic completion — scan progress for completed epics and
 * auto-create epic PRs.
 *
 * Best-effort: wrapped in try/catch. Never blocks the pipeline.
 * Returns structured results — no console output.
 */
import type { RunContext } from '../context.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Result of a single epic delivery attempt. */
type EpicDeliveryEntry = {
  readonly epicKey: string;
  readonly ok: boolean;
};

/** Structured result of the epic-completion phase. */
type EpicCompletionResult = {
  readonly results: readonly EpicDeliveryEntry[];
};

/** Pre-wired epic delivery function. I/O deps (exec, fetchFn, progressFs) are bound by the terminal layer. */
type DeliverEpicFn = (opts: {
  readonly projectRoot: string;
  readonly config: RunContext['config'];
  readonly epicKey: string;
  readonly epicTitle: string;
  readonly epicBranch: string;
  readonly baseBranch: string;
}) => Promise<{ readonly ok: boolean }>;

/** Injected dependencies for epic-completion. */
export type EpicCompletionDeps = {
  /** Find epics whose children are all complete. Returns Map<epicKey, epicBranch>. */
  readonly findCompletedEpics: (ctx: RunContext) => ReadonlyMap<string, string>;
  /** Deliver the epic PR to base branch. Pre-wired with exec/fetchFn/progressFs. */
  readonly deliverEpicToBase: DeliverEpicFn;
};

// ─── Phase ───────────────────────────────────────────────────────────────────

/**
 * Scan progress for completed epics and create epic PRs.
 *
 * Best-effort — errors are caught and an empty result is returned.
 * Never blocks the pipeline.
 *
 * @param ctx - Pipeline context (requires config + board from preflight).
 * @param deps - Injected dependencies.
 * @returns Structured result with per-epic delivery outcomes.
 */
export async function epicCompletion(
  ctx: RunContext,
  deps: EpicCompletionDeps,
): Promise<EpicCompletionResult> {
  try {
    return await deliverCompletedEpics(ctx, deps);
  } catch {
    return { results: [] };
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Find and deliver all completed epics. */
async function deliverCompletedEpics(
  ctx: RunContext,
  deps: EpicCompletionDeps,
): Promise<EpicCompletionResult> {
  // Safe: pipeline ordering guarantees preflight runs before epic-completion
  const config = ctx.config!;
  const baseBranch = config.env.CLANCY_BASE_BRANCH ?? 'main';
  const completedEpics = deps.findCompletedEpics(ctx);

  const deliver = async (
    epicKey: string,
    epicBranch: string,
  ): Promise<EpicDeliveryEntry> => {
    const delivery = await deps.deliverEpicToBase({
      projectRoot: ctx.projectRoot,
      config,
      epicKey,
      epicTitle: epicKey, // title not available from progress — key is the fallback
      epicBranch,
      baseBranch,
    });
    return { epicKey, ok: delivery.ok };
  };

  const entries = [...completedEpics.entries()];
  const results = await Promise.all(
    entries.map(([key, branch]) => deliver(key, branch)),
  );

  return { results };
}
