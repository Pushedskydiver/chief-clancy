/**
 * Platform-specific rework handlers.
 *
 * Single factory function that resolves the platform once, returning a
 * handler object with uniform method signatures. Eliminates switch
 * duplication — callers use `handlers.checkReviewState(...)` instead
 * of switching on `remote.host`.
 */
import type { SharedEnv } from '@chief-clancy/core/schemas/env/env.js';
import type {
  PrReviewState,
  RemoteInfo,
} from '@chief-clancy/core/types/remote.js';
import type { FetchFn } from '~/d/lifecycle/pr-creation.js';

import { resolveGitToken } from '@chief-clancy/core/shared/git-token/index.js';
import { buildApiBaseUrl } from '@chief-clancy/core/shared/remote/index.js';

import {
  azdoHandlers,
  bbCloudHandlers,
  bbServerHandlers,
  githubHandlers,
  gitlabHandlers,
} from './rework-builders.js';

// ─── Types ───────────────────────────────────────────────────────────────────

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

/** Options for {@link resolvePlatformHandlers}. */
type ResolveHandlersOpts = {
  readonly fetchFn: FetchFn;
  readonly env: SharedEnv;
  readonly remote: RemoteInfo;
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve platform handlers for the given remote.
 *
 * @param opts - Resolution options (fetch function, shared env, remote info).
 * @returns A handler object, or `undefined` if the platform is unsupported
 *   or credentials/API base are missing.
 */
export function resolvePlatformHandlers(
  opts: ResolveHandlersOpts,
): PlatformReworkHandlers | undefined {
  const { fetchFn, env, remote } = opts;

  const creds = resolveGitToken(env, remote);
  if (!creds) return undefined;

  const apiBase = buildApiBaseUrl(remote, env.CLANCY_GIT_API_URL);
  if (!apiBase) return undefined;

  const ctx: ReworkCtx = {
    fetchFn,
    token: creds.token,
    apiBase,
    username: creds.username,
  };

  switch (remote.host) {
    case 'github':
      return githubHandlers(ctx, remote);
    case 'gitlab':
      return gitlabHandlers(ctx, remote);
    case 'bitbucket':
      return bbCloudHandlers(ctx, remote);
    case 'bitbucket-server':
      return bbServerHandlers(ctx, remote);
    case 'azure':
      return azdoHandlers(ctx, remote);
    default:
      return undefined;
  }
}
