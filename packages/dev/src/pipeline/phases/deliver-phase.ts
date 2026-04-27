/**
 * Deliver — PR creation and delivery (rework and fresh paths).
 *
 * Reads ticket, branch, and rework state from context. Delegates push + PR
 * creation to pre-wired `deliverViaPullRequest`, then logs progress and
 * quality metrics. Returns structured results — no console output.
 */
import type { RunContext } from '../context.js';
import type { ProgressStatus } from '@chief-clancy/core/types/progress.js';
import type { PrCreationResult } from '@chief-clancy/core/types/remote.js';

/** Structured result of the deliver phase. */
type DeliverPhaseResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'push-failed' | 'pr-creation-failed';
        readonly message: string;
      };
    };

/** Minimal delivery result from the pre-wired deliver function. */
type DeliveryResult = {
  readonly isPushed: boolean;
  readonly prResult?: PrCreationResult;
};

const PUSH_FAILED_MESSAGE = 'git push to remote failed (no stderr captured)';

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

  const failure = detectDeliveryFailure({ result, ticket, parentKey, deps });
  if (failure) return failure;

  deps.appendProgress({
    key: ticket.key,
    summary: ticket.title,
    status: 'REWORK',
    prNumber: ctx.reworkPrNumber,
    parent: parentKey,
  });

  deps.recordRework();
  await safeRemoveBuildLabel(ticket.key, deps);
  await safePostReworkActions(ctx, deps);

  return { ok: true };
}

/** Run post-rework actions when a rework PR number is known. Best-effort. */
async function safePostReworkActions(
  ctx: RunContext,
  deps: DeliverPhaseDeps,
): Promise<void> {
  if (ctx.reworkPrNumber == null) return;
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

  const failure = detectDeliveryFailure({ result, ticket, parentKey, deps });
  if (failure) return failure;

  deps.recordDelivery();
  await safeRemoveBuildLabel(ticket.key, deps);

  return { ok: true };
}

/** Options bag for {@link detectDeliveryFailure}. */
type DetectFailureOpts = {
  readonly result: DeliveryResult;
  readonly ticket: { readonly key: string; readonly title: string };
  readonly parentKey: string | undefined;
  readonly deps: DeliverPhaseDeps;
};

/**
 * Detect a delivery failure (push or PR-creation) and write the
 * corresponding progress entry. Returns the tagged failure result, or
 * `undefined` when delivery succeeded and the caller should continue.
 */
function detectDeliveryFailure(
  opts: DetectFailureOpts,
): DeliverPhaseResult | undefined {
  const { result, ticket, parentKey, deps } = opts;

  if (!result.isPushed) {
    deps.appendProgress({
      key: ticket.key,
      summary: ticket.title,
      status: 'PUSH_FAILED',
      parent: parentKey,
    });
    return {
      ok: false,
      error: { kind: 'push-failed', message: PUSH_FAILED_MESSAGE },
    };
  }

  const prFailure = prCreationFailure(result);
  if (prFailure) {
    deps.appendProgress({
      key: ticket.key,
      summary: ticket.title,
      status: 'PR_CREATION_FAILED',
      parent: parentKey,
    });
    return {
      ok: false,
      error: { kind: 'pr-creation-failed', message: prFailure.message },
    };
  }

  return undefined;
}

/**
 * Detect a real PR-creation failure (excludes already-exists case).
 *
 * @returns The underlying failure when the PR API call returned a tagged
 *   error and the PR did not already exist; `undefined` otherwise.
 */
function prCreationFailure(
  result: DeliveryResult,
): { readonly message: string } | undefined {
  const pr = result.prResult;
  if (!pr || pr.ok || pr.alreadyExists === true) return undefined;
  return { message: pr.error.message };
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
