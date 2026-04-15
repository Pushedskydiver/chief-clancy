/**
 * Platform-specific rework handler builders.
 *
 * Each builder wires a platform's PR API into the uniform
 * {@link PlatformReworkHandlers} interface. Called exclusively by
 * `resolvePlatformHandlers` in `rework-handlers.ts`.
 */
import type { PlatformReworkHandlers, ReworkCtx } from './rework-handlers.js';
import type {
  AzdoRemote,
  BitbucketRemote,
  BitbucketServerRemote,
  GitHubRemote,
  GitLabRemote,
} from '@chief-clancy/core/types/remote.js';

import {
  checkPrReviewState as checkAzdoReviewState,
  fetchPrReviewComments as fetchAzdoComments,
  postPrComment as postAzdoComment,
} from '~/d/lifecycle/pull-request/azdo.js';
import {
  checkPrReviewState as checkBbCloudReviewState,
  fetchPrReviewComments as fetchBbCloudComments,
  postCloudPrComment,
} from '~/d/lifecycle/pull-request/bitbucket/cloud.js';
import {
  checkServerPrReviewState,
  fetchServerPrReviewComments,
  postServerPrComment,
} from '~/d/lifecycle/pull-request/bitbucket/server.js';
import {
  checkPrReviewState as checkGitHubReviewState,
  fetchPrReviewComments as fetchGitHubComments,
  postPrComment as postGitHubComment,
  requestReview as requestGitHubReview,
} from '~/d/lifecycle/pull-request/github.js';
import {
  checkMrReviewState,
  fetchMrReviewComments,
  postMrNote,
  resolveDiscussions,
} from '~/d/lifecycle/pull-request/gitlab.js';

const noopResolve = (): Promise<number> => Promise.resolve(0);
const noopReRequest = (): Promise<boolean> => Promise.resolve(false);

/** Build rework handlers for GitHub. */
export function githubHandlers(
  ctx: ReworkCtx,
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
  ctx: ReworkCtx,
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
  ctx: ReworkCtx,
  remote: BitbucketRemote,
): PlatformReworkHandlers {
  const { fetchFn, token, username } = ctx;
  if (!username) throw new Error('Bitbucket Cloud requires a username');
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
  ctx: ReworkCtx,
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
  ctx: ReworkCtx,
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
