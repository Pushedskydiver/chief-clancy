/**
 * Platform-specific rework handler builders.
 *
 * Each builder wires a platform's PR API into the uniform
 * {@link PlatformReworkHandlers} interface. Called exclusively by
 * `resolvePlatformHandlers` in `rework-handlers.ts`.
 */
import type { Ctx, PlatformReworkHandlers } from './rework-handlers.js';
import type {
  AzdoRemote,
  BitbucketRemote,
  BitbucketServerRemote,
  GitHubRemote,
  GitLabRemote,
} from '~/c/types/remote.js';

import {
  checkPrReviewState as checkAzdoReviewState,
  fetchPrReviewComments as fetchAzdoComments,
  postPrComment as postAzdoComment,
} from '~/c/shared/pull-request/azdo/azdo.js';
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

const noopResolve = async (): Promise<number> => 0;
const noopReRequest = async (): Promise<boolean> => false;

/** Build rework handlers for GitHub. */
export function githubHandlers(
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

/** Build rework handlers for GitLab. */
export function gitlabHandlers(
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

/** Build rework handlers for Bitbucket Cloud. */
export function bbCloudHandlers(
  ctx: Ctx,
  remote: BitbucketRemote,
): PlatformReworkHandlers {
  const { fetchFn, token } = ctx;
  // Safe: resolveGitToken always sets username for Bitbucket Cloud
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

/** Build rework handlers for Bitbucket Server. */
export function bbServerHandlers(
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

/** Build rework handlers for Azure DevOps. */
export function azdoHandlers(
  ctx: Ctx,
  remote: AzdoRemote,
): PlatformReworkHandlers {
  const { fetchFn, token } = ctx;
  const { org, project, repo } = remote;
  return {
    checkReviewState: (branch, since) =>
      checkAzdoReviewState({
        fetchFn,
        org,
        project,
        repo,
        pat: token,
        branch,
        since,
      }),
    fetchComments: async (prNumber, since) => ({
      comments: await fetchAzdoComments({
        fetchFn,
        org,
        project,
        repo,
        pat: token,
        prId: prNumber,
        since,
      }),
    }),
    postComment: (prNumber, comment) =>
      postAzdoComment({
        fetchFn,
        org,
        project,
        repo,
        pat: token,
        prId: prNumber,
        body: comment,
      }),
    resolveThreads: noopResolve,
    reRequestReview: noopReRequest,
  };
}
