/**
 * Deliver — PR creation and delivery (rework and fresh paths).
 *
 * Reads ticket, branch, and rework state from context. Delegates push + PR
 * creation to pre-wired `deliverViaPullRequest`, then logs progress and
 * quality metrics. Returns structured results — no console output.
 */
import type { RunContext } from '../context.js';
import type { ProgressStatus } from '@chief-clancy/core/types/progress.js';

/** Structured result of the deliver phase. */
type DeliverPhaseResult = {
  readonly ok: boolean;
};

/** Minimal delivery result from the pre-wired deliver function. */
type DeliveryResult = {
  readonly isPushed: boolean;
};

/** Options passed to the pre-wired deliver function. */
type DeliverCallOpts = {
  readonly ticketBranch: string;
  readonly targetBranch: string;
  readonly shouldSkipLog?: boolean;
  readonly parent?: string;
  readonly singleChildParent?: string;
};

/** Options passed to the pre-wired progress writer. */
type ProgressCallOpts = {
  readonly key: string;
  readonly summary: string;
  readonly status: ProgressStatus;
  readonly prNumber?: number;
  readonly parent?: string;
};

/** Options passed to the pre-wired post-rework actions. */
type PostReworkCallOpts = {
  readonly prNumber: number;
  readonly feedback: readonly string[];
  readonly discussionIds?: readonly string[];
  readonly reviewers?: readonly string[];
};

/** Injected dependencies for deliver-phase. */
export type DeliverPhaseDeps = {
  /** Push branch + create PR. Pre-wired with exec, fetchFn, config, ticket, etc. */
  readonly deliverViaPullRequest: (
    opts: DeliverCallOpts,
  ) => Promise<DeliveryResult>;
  /** Append a progress entry. Pre-wired with progressFs + projectRoot. */
  readonly appendProgress: (opts: ProgressCallOpts) => void;
  /** Record delivery quality metric. Pre-wired with qualityFs + projectRoot. */
  readonly recordDelivery: () => void;
  /** Record rework quality metric. Pre-wired with qualityFs + projectRoot. */
  readonly recordRework: () => void;
  /** Post-rework PR comment + thread resolution + review re-request. Pre-wired with handlers. */
  readonly postReworkActions: (opts: PostReworkCallOpts) => Promise<void>;
  /** Remove build label from ticket after delivery. Best-effort — never blocks. */
  readonly removeBuildLabel: (ticketKey: string) => Promise<void>;
};

/**
 * Deliver the ticket via PR (rework or fresh path).
 *
 * Decomposed into {@link deliverRework} and {@link deliverFresh} based on
 * `ctx.isRework`. Parent key computation is shared via {@link parentKeys}.
 *
 * @param ctx - Pipeline context (requires ticket + branches + rework state).
 * @param deps - Injected dependencies.
 * @returns Structured result indicating delivery success.
 */
export async function deliverPhase(
  ctx: RunContext,
  deps: DeliverPhaseDeps,
): Promise<DeliverPhaseResult> {
  return ctx.isRework === true
    ? deliverRework(ctx, deps)
    : deliverFresh(ctx, deps);
}

/** Deliver a rework ticket: push, log REWORK, quality, post-rework actions. */
async function deliverRework(
  ctx: RunContext,
  deps: DeliverPhaseDeps,
): Promise<DeliverPhaseResult> {
  // Safe: pipeline ordering guarantees these fields are populated
  const ticket = ctx.ticket!;
  const ticketBranch = ctx.ticketBranch!;
  const effectiveTarget = ctx.effectiveTarget!;
  const { parentKey } = parentKeys(ctx);

  const result = await deps.deliverViaPullRequest({
    ticketBranch,
    targetBranch: effectiveTarget,
    shouldSkipLog: true,
    parent: parentKey,
  });

  if (!result.isPushed) {
    deps.appendProgress({
      key: ticket.key,
      summary: ticket.title,
      status: 'PUSH_FAILED',
      parent: parentKey,
    });
    return { ok: false };
  }

  deps.appendProgress({
    key: ticket.key,
    summary: ticket.title,
    status: 'REWORK',
    prNumber: ctx.reworkPrNumber,
    parent: parentKey,
  });

  deps.recordRework();
  await safeRemoveBuildLabel(ticket.key, deps);

  if (ctx.reworkPrNumber != null) {
    try {
      await deps.postReworkActions({
        prNumber: ctx.reworkPrNumber,
        feedback: ctx.prFeedback ?? [],
        discussionIds: ctx.reworkDiscussionIds,
        reviewers: ctx.reworkReviewers,
      });
    } catch {
      // Best-effort — post-rework actions failure never blocks delivery
    }
  }

  return { ok: true };
}

/** Deliver a fresh ticket: push + PR, quality tracking. */
async function deliverFresh(
  ctx: RunContext,
  deps: DeliverPhaseDeps,
): Promise<DeliverPhaseResult> {
  // Safe: pipeline ordering guarantees these fields are populated
  const ticket = ctx.ticket!;
  const ticketBranch = ctx.ticketBranch!;
  const effectiveTarget = ctx.effectiveTarget!;
  const { parentKey, singleChildParent } = parentKeys(ctx);

  const result = await deps.deliverViaPullRequest({
    ticketBranch,
    targetBranch: effectiveTarget,
    parent: parentKey,
    singleChildParent,
  });

  if (!result.isPushed) {
    deps.appendProgress({
      key: ticket.key,
      summary: ticket.title,
      status: 'PUSH_FAILED',
      parent: parentKey,
    });
    return { ok: false };
  }

  deps.recordDelivery();
  await safeRemoveBuildLabel(ticket.key, deps);

  return { ok: true };
}

/** Remove build label after delivery. Best-effort — never blocks. */
async function safeRemoveBuildLabel(
  ticketKey: string,
  deps: DeliverPhaseDeps,
): Promise<void> {
  try {
    await deps.removeBuildLabel(ticketKey);
  } catch {
    // Best-effort — label cleanup failure never blocks delivery
  }
}

/** Parent key and single-child parent from context. */
function parentKeys(ctx: RunContext): {
  readonly parentKey: string | undefined;
  readonly singleChildParent: string | undefined;
} {
  // Safe: pipeline ordering guarantees config + ticket are populated
  const ticket = ctx.ticket!;
  const hasParent = ctx.hasParent === true;
  const skipEpicBranch = ctx.skipEpicBranch === true;
  const provider = ctx.config!.provider;

  const parentKey =
    hasParent && !skipEpicBranch ? ticket.parentInfo : undefined;

  const rawParent = hasParent && skipEpicBranch ? ticket.parentInfo : undefined;
  const singleChildParent = resolveSingleChildParent(rawParent, provider);

  return { parentKey, singleChildParent };
}

/**
 * Resolve the single-child parent for PR body "Closes" lines.
 *
 * GitHub: only use if parentInfo is a valid issue ref (`#N`).
 * Milestone titles like "Sprint 3" would produce invalid "Closes Sprint 3".
 * Non-GitHub: use the raw parent directly.
 */
function resolveSingleChildParent(
  rawParent: string | undefined,
  provider: string,
): string | undefined {
  if (rawParent == null) return undefined;
  if (provider !== 'github') return rawParent;

  return /^#\d+$/.test(rawParent) ? rawParent : undefined;
}
