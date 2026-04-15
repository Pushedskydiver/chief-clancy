/**
 * PR rework detection and post-rework actions.
 *
 * Detects when open PRs have reviewer feedback requesting changes, and
 * orchestrates rework comment posting, thread resolution, and review
 * re-requests. All operations are best-effort.
 */
import type { PlatformReworkHandlers } from './rework-types.js';
import type {
  BoardProvider,
  FetchedTicket,
} from '@chief-clancy/core/types/board.js';
import type { ProgressEntry, ProgressFs } from '~/d/lifecycle/progress.js';

import { computeTicketBranch } from '~/d/lifecycle/branch.js';
import { findEntriesWithStatus } from '~/d/lifecycle/progress.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Result of rework detection — the ticket, feedback, and PR context. */
type ReworkResult = {
  readonly ticket: FetchedTicket;
  readonly feedback: readonly string[];
  readonly prNumber: number;
  readonly discussionIds?: readonly string[];
  readonly reviewers: readonly string[];
};

/** Options for {@link fetchReworkFromPrReview}. */
type FetchReworkOpts = {
  readonly progressFs: ProgressFs;
  readonly projectRoot: string;
  readonly provider: BoardProvider;
  readonly handlers: PlatformReworkHandlers;
};

/** Options for {@link postReworkActions}. */
type PostReworkOpts = {
  readonly handlers: PlatformReworkHandlers;
  readonly prNumber: number;
  readonly feedback: readonly string[];
  readonly discussionIds?: readonly string[];
  readonly reviewers?: readonly string[];
};

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_CANDIDATES = 5;
const MAX_FEEDBACK_PREVIEW = 3;
const MAX_FEEDBACK_LENGTH = 80;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Build a rework comment to post on the PR after pushing fixes.
 *
 * Prefixed with `[clancy]` (not `Rework:`) so it does NOT trigger
 * rework detection on the next cycle.
 *
 * @param feedback - Review feedback items to include in the comment.
 * @returns The formatted comment body.
 */
export function buildReworkComment(feedback: readonly string[]): string {
  if (feedback.length === 0) {
    return '[clancy] Rework pushed addressing reviewer feedback.';
  }

  const count = feedback.length;
  const summary = feedback
    .slice(0, MAX_FEEDBACK_PREVIEW)
    .map((f) => `- ${f.slice(0, MAX_FEEDBACK_LENGTH)}`)
    .join('\n');
  const suffix = count > MAX_FEEDBACK_PREVIEW ? '\n- ...' : '';

  return `[clancy] Rework pushed addressing ${count} feedback item${count !== 1 ? 's' : ''}.\n\n${summary}${suffix}`;
}

/**
 * Check open PRs for review feedback requesting changes.
 *
 * Scans progress.txt for tickets with status PR_CREATED, REWORK, PUSHED,
 * or PUSH_FAILED, then checks the corresponding PR's review state on
 * the detected remote platform. Best-effort — errors are swallowed.
 *
 * @param opts - Rework detection options (progress filesystem, handlers, project root).
 * @returns The rework result, or `undefined` if no rework is needed.
 */
export async function fetchReworkFromPrReview(
  opts: FetchReworkOpts,
): Promise<ReworkResult | undefined> {
  const { progressFs, projectRoot, provider, handlers } = opts;

  const candidates = [
    ...findEntriesWithStatus(progressFs, projectRoot, 'PR_CREATED'),
    ...findEntriesWithStatus(progressFs, projectRoot, 'REWORK'),
    ...findEntriesWithStatus(progressFs, projectRoot, 'PUSHED'),
    ...findEntriesWithStatus(progressFs, projectRoot, 'PUSH_FAILED'),
  ];

  if (candidates.length === 0) return undefined;

  // Limit to first 5 to avoid rate limits
  const toCheck = candidates.slice(0, MAX_CANDIDATES);

  return checkCandidates(toCheck, provider, handlers);
}

/**
 * Perform post-rework actions: comment on PR, re-request review (GitHub),
 * resolve threads (GitLab). All best-effort — failures warn but don't block.
 *
 * @returns Nothing.
 */
export async function postReworkActions(opts: PostReworkOpts): Promise<void> {
  const { handlers, prNumber, feedback, discussionIds, reviewers } = opts;

  await tryPostComment(handlers, prNumber, feedback);
  await tryResolveThreads(handlers, prNumber, discussionIds);
  await tryReRequestReview(handlers, prNumber, reviewers);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Best-effort: post a rework comment on the PR. */
async function tryPostComment(
  handlers: PlatformReworkHandlers,
  prNumber: number,
  feedback: readonly string[],
): Promise<void> {
  try {
    const comment = buildReworkComment(feedback);
    const posted = await handlers.postComment(prNumber, comment);
    if (posted) console.log('  ✓ Posted rework comment');
  } catch {
    // Best-effort
  }
}

/** Best-effort: resolve addressed discussion threads (GitLab). */
async function tryResolveThreads(
  handlers: PlatformReworkHandlers,
  prNumber: number,
  discussionIds?: readonly string[],
): Promise<void> {
  if (!discussionIds || discussionIds.length === 0) return;
  try {
    const resolved = await handlers.resolveThreads(prNumber, discussionIds);
    if (resolved > 0) {
      console.log(
        `  ✓ Resolved ${resolved} discussion thread${resolved !== 1 ? 's' : ''}`,
      );
    }
  } catch {
    // Best-effort
  }
}

/** Best-effort: re-request review from reviewers (GitHub). */
async function tryReRequestReview(
  handlers: PlatformReworkHandlers,
  prNumber: number,
  reviewers?: readonly string[],
): Promise<void> {
  if (!reviewers || reviewers.length === 0) return;
  try {
    const ok = await handlers.reRequestReview(prNumber, reviewers);
    if (ok) console.log(`  ✓ Re-requested review from ${reviewers.join(', ')}`);
  } catch {
    // Best-effort
  }
}

/** Convert progress timestamp (YYYY-MM-DD HH:MM) to ISO 8601. */
function toIsoTimestamp(timestamp: string): string | undefined {
  const date = new Date(timestamp.replace(' ', 'T') + 'Z');
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * Recursively check candidates, returning the first with changes requested.
 *
 * Recursive — safe because candidate lists are capped at {@link MAX_CANDIDATES}.
 */
async function checkCandidates(
  candidates: readonly ProgressEntry[],
  provider: BoardProvider,
  handlers: PlatformReworkHandlers,
): Promise<ReworkResult | undefined> {
  if (candidates.length === 0) return undefined;

  const [entry, ...rest] = candidates;
  const branch = computeTicketBranch(provider, entry.key);
  const since = entry.timestamp ? toIsoTimestamp(entry.timestamp) : undefined;
  const reviewState = await handlers.checkReviewState(branch, since);

  if (reviewState?.changesRequested) {
    const { comments, discussionIds } = await handlers.fetchComments(
      reviewState.prNumber,
      since,
    );

    const ticket: FetchedTicket = {
      key: entry.key,
      title: entry.summary,
      description: entry.summary,
      parentInfo: entry.parent ?? 'none',
      blockers: 'None',
    };

    return {
      ticket,
      feedback: comments,
      prNumber: reviewState.prNumber,
      discussionIds,
      reviewers: reviewState.reviewers ?? [],
    };
  }

  return checkCandidates(rest, provider, handlers);
}
