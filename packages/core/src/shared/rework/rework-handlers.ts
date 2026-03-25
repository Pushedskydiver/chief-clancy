/**
 * Platform-specific rework handlers.
 *
 * Single factory function that resolves the platform once, returning a
 * handler object with uniform method signatures. Eliminates switch
 * duplication — callers use `handlers.checkReviewState(...)` instead
 * of switching on `remote.host`.
 */
import type { SharedEnv } from '~/c/schemas/env/env.js';
import type {
  BitbucketRemote,
  BitbucketServerRemote,
  GitHubRemote,
  GitLabRemote,
  PrReviewState,
  RemoteInfo,
} from '~/c/types/remote.js';

import { resolveGitToken } from '~/c/shared/git-token/git-token.js';
import {
  checkPrReviewState as checkBbCloudReviewState,
  fetchPrReviewComments as fetchBbCloudComments,
  postCloudPrComment,
} from '~/c/shared/pull-request/bitbucket/cloud.js';
import {
  checkServerPrReviewState,
  fetchServerPrReviewComments,
  postServerPrComment,
} from '~/c/shared/pull-request/bitbucket/server.js';
import {
  checkPrReviewState as checkGitHubReviewState,
  fetchPrReviewComments as fetchGitHubComments,
  postPrComment as postGitHubComment,
  requestReview as requestGitHubReview,
} from '~/c/shared/pull-request/github/github.js';
import {
  checkMrReviewState,
  fetchMrReviewComments,
  postMrNote,
  resolveDiscussions,
} from '~/c/shared/pull-request/gitlab/gitlab.js';
import { buildApiBaseUrl } from '~/c/shared/remote/remote.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Minimal fetch signature for platform API calls. */
type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

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

/** Options for {@link resolvePlatformHandlers}. */
type ResolveHandlersOpts = {
  readonly fetchFn: FetchFn;
  readonly env: SharedEnv;
  readonly remote: RemoteInfo;
};

// ─── Platform builders ──────────────────────────────────────────────────────

const noopResolve = async (): Promise<number> => 0;
const noopReRequest = async (): Promise<boolean> => false;

/** Shared context passed to every platform builder. */
type Ctx = {
  readonly fetchFn: FetchFn;
  readonly token: string;
  readonly apiBase: string;
  readonly username?: string;
};

function githubHandlers(
  ctx: Ctx,
  remote: GitHubRemote,
): PlatformReworkHandlers {
  const { fetchFn, token, apiBase } = ctx;
  const repo = `${remote.owner}/${remote.repo}`;
  return {
    checkReviewState: (branch, since) =>
      checkGitHubReviewState({
        fetchFn,
        token,
        repo,
        branch,
        owner: remote.owner,
        apiBase,
        since,
      }),
    fetchComments: async (prNumber, since) => ({
      comments: await fetchGitHubComments({
        fetchFn,
        token,
        repo,
        prNumber,
        apiBase,
        since,
      }),
    }),
    postComment: (prNumber, comment) =>
      postGitHubComment({
        fetchFn,
        token,
        repo,
        prNumber,
        body: comment,
        apiBase,
      }),
    resolveThreads: noopResolve,
    reRequestReview: (prNumber, reviewers) =>
      requestGitHubReview({
        fetchFn,
        token,
        repo,
        prNumber,
        reviewers,
        apiBase,
      }),
  };
}

function gitlabHandlers(
  ctx: Ctx,
  remote: GitLabRemote,
): PlatformReworkHandlers {
  const { fetchFn, token, apiBase } = ctx;
  return {
    checkReviewState: (branch, since) =>
      checkMrReviewState({
        fetchFn,
        token,
        apiBase,
        projectPath: remote.projectPath,
        branch,
        since,
      }),
    fetchComments: (prNumber, since) =>
      fetchMrReviewComments({
        fetchFn,
        token,
        apiBase,
        projectPath: remote.projectPath,
        mrIid: prNumber,
        since,
      }),
    postComment: (prNumber, comment) =>
      postMrNote({
        fetchFn,
        token,
        apiBase,
        projectPath: remote.projectPath,
        mrIid: prNumber,
        body: comment,
      }),
    resolveThreads: (prNumber, discussionIds) =>
      resolveDiscussions({
        fetchFn,
        token,
        apiBase,
        projectPath: remote.projectPath,
        mrIid: prNumber,
        discussionIds,
      }),
    reRequestReview: noopReRequest,
  };
}

function bbCloudHandlers(
  ctx: Ctx,
  remote: BitbucketRemote,
): PlatformReworkHandlers {
  const { fetchFn, token } = ctx;
  const username = ctx.username!;
  return {
    checkReviewState: (branch, since) =>
      checkBbCloudReviewState({
        fetchFn,
        username,
        token,
        workspace: remote.workspace,
        repoSlug: remote.repoSlug,
        branch,
        since,
      }),
    fetchComments: async (prNumber, since) => ({
      comments: await fetchBbCloudComments({
        fetchFn,
        username,
        token,
        workspace: remote.workspace,
        repoSlug: remote.repoSlug,
        prId: prNumber,
        since,
      }),
    }),
    postComment: (prNumber, comment) =>
      postCloudPrComment({
        fetchFn,
        username,
        token,
        workspace: remote.workspace,
        repoSlug: remote.repoSlug,
        prId: prNumber,
        body: comment,
      }),
    resolveThreads: noopResolve,
    reRequestReview: noopReRequest,
  };
}

function bbServerHandlers(
  ctx: Ctx,
  remote: BitbucketServerRemote,
): PlatformReworkHandlers {
  const { fetchFn, token, apiBase } = ctx;
  return {
    checkReviewState: (branch, since) =>
      checkServerPrReviewState({
        fetchFn,
        token,
        apiBase,
        projectKey: remote.projectKey,
        repoSlug: remote.repoSlug,
        branch,
        since,
      }),
    fetchComments: async (prNumber, since) => ({
      comments: await fetchServerPrReviewComments({
        fetchFn,
        token,
        apiBase,
        projectKey: remote.projectKey,
        repoSlug: remote.repoSlug,
        prId: prNumber,
        since,
      }),
    }),
    postComment: (prNumber, comment) =>
      postServerPrComment({
        fetchFn,
        token,
        apiBase,
        projectKey: remote.projectKey,
        repoSlug: remote.repoSlug,
        prId: prNumber,
        body: comment,
      }),
    resolveThreads: noopResolve,
    reRequestReview: noopReRequest,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve platform handlers for the given remote.
 *
 * @returns A handler object, or `undefined` if the platform is unsupported
 *   or credentials/API base are missing.
 */
export function resolvePlatformHandlers(
  opts: ResolveHandlersOpts,
): PlatformReworkHandlers | undefined {
  const { fetchFn, env, remote } = opts;

  if (
    remote.host === 'none' ||
    remote.host === 'unknown' ||
    remote.host === 'azure'
  ) {
    return undefined;
  }

  const creds = resolveGitToken(env, remote);
  if (!creds) return undefined;

  const apiBase = buildApiBaseUrl(remote, env.CLANCY_GIT_API_URL);
  if (!apiBase) return undefined;

  const ctx: Ctx = {
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
  }
}
