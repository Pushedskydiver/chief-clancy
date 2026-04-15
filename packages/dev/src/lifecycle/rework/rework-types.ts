/**
 * Shared types for rework handler resolution and platform builders.
 *
 * Extracted to break the rework-handlers ↔ rework-builders cycle —
 * builders consume these types; handlers own `resolvePlatformHandlers`
 * which wires builder outputs into the uniform interface.
 */
import type { PrReviewState } from '@chief-clancy/core/types/remote.js';
import type { FetchFn } from '~/d/lifecycle/pr-creation.js';

/** Uniform interface for platform-specific rework operations. */
export type PlatformReworkHandlers = {
  /** Check the review state of a PR on the given branch. */
  readonly checkReviewState: (
    branch: string,
    since?: string,
  ) => Promise<PrReviewState | undefined>;

  /** Fetch review comments from a PR. */
  readonly fetchComments: (
    prNumber: number,
    since?: string,
  ) => Promise<{
    readonly comments: readonly string[];
    readonly discussionIds?: readonly string[];
  }>;

  /** Post a comment on a PR. */
  readonly postComment: (prNumber: number, comment: string) => Promise<boolean>;

  /** Resolve discussion threads (GitLab-only, no-op on other platforms). */
  readonly resolveThreads: (
    prNumber: number,
    discussionIds: readonly string[],
  ) => Promise<number>;

  /** Re-request review (GitHub-only, no-op on other platforms). */
  readonly reRequestReview: (
    prNumber: number,
    reviewers: readonly string[],
  ) => Promise<boolean>;
};

/** Shared context passed to every platform builder. */
export type ReworkCtx = {
  readonly fetchFn: FetchFn;
  readonly token: string;
  readonly apiBase: string;
  readonly username?: string;
};
