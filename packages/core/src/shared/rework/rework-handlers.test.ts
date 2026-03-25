import type {
  AzdoRemote,
  BitbucketRemote,
  BitbucketServerRemote,
  GenericRemote,
  GitHubRemote,
  GitLabRemote,
  NoRemote,
} from '~/c/types/remote.js';

import { describe, expect, it, vi } from 'vitest';

import { resolvePlatformHandlers } from './rework-handlers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockFetchFn = vi.fn(() =>
  Promise.resolve(new Response('{}', { status: 200 })),
);

function githubEnv() {
  return {
    GITHUB_TOKEN: 'ghp_test123',
    CLANCY_GIT_API_URL: undefined,
  } as Parameters<typeof resolvePlatformHandlers>[0]['env'];
}

function gitlabEnv() {
  return {
    GITLAB_TOKEN: 'glpat_test123',
    CLANCY_GIT_API_URL: undefined,
  } as Parameters<typeof resolvePlatformHandlers>[0]['env'];
}

function bitbucketEnv() {
  return {
    BITBUCKET_USER: 'bbuser',
    BITBUCKET_TOKEN: 'bbtoken',
    CLANCY_GIT_API_URL: undefined,
  } as Parameters<typeof resolvePlatformHandlers>[0]['env'];
}

function azdoEnv() {
  return {
    AZDO_PAT: 'azdo_pat_test123',
    CLANCY_GIT_API_URL: undefined,
  } as Parameters<typeof resolvePlatformHandlers>[0]['env'];
}

const githubRemote: GitHubRemote = {
  host: 'github',
  owner: 'acme',
  repo: 'app',
  hostname: 'github.com',
};

const gitlabRemote: GitLabRemote = {
  host: 'gitlab',
  projectPath: 'acme/app',
  hostname: 'gitlab.com',
};

const bbCloudRemote: BitbucketRemote = {
  host: 'bitbucket',
  workspace: 'acme',
  repoSlug: 'app',
  hostname: 'bitbucket.org',
};

const bbServerRemote: BitbucketServerRemote = {
  host: 'bitbucket-server',
  projectKey: 'ACME',
  repoSlug: 'app',
  hostname: 'bitbucket.internal.com',
};

const azdoRemote: AzdoRemote = {
  host: 'azure',
  org: 'acme',
  project: 'platform',
  repo: 'app',
  hostname: 'dev.azure.com',
};

// ─── resolvePlatformHandlers ────────────────────────────────────────────────

describe('resolvePlatformHandlers', () => {
  it('returns handlers for GitHub remote', () => {
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env: githubEnv(),
      remote: githubRemote,
    });

    expect(handlers).toBeDefined();
    expect(typeof handlers!.checkReviewState).toBe('function');
    expect(typeof handlers!.fetchComments).toBe('function');
    expect(typeof handlers!.postComment).toBe('function');
    expect(typeof handlers!.resolveThreads).toBe('function');
    expect(typeof handlers!.reRequestReview).toBe('function');
  });

  it('returns handlers for GitLab remote', () => {
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env: gitlabEnv(),
      remote: gitlabRemote,
    });

    expect(handlers).toBeDefined();
  });

  it('returns handlers for Bitbucket Cloud remote', () => {
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env: bitbucketEnv(),
      remote: bbCloudRemote,
    });

    expect(handlers).toBeDefined();
  });

  it('returns handlers for Bitbucket Server remote', () => {
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env: bitbucketEnv(),
      remote: bbServerRemote,
    });

    expect(handlers).toBeDefined();
  });

  it('returns undefined for "none" remote', () => {
    const remote: NoRemote = { host: 'none' };
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env: githubEnv(),
      remote,
    });

    expect(handlers).toBeUndefined();
  });

  it('returns undefined for "unknown" remote', () => {
    const remote: GenericRemote = {
      host: 'unknown',
      url: 'git@unknown.com:x.git',
    };
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env: githubEnv(),
      remote,
    });

    expect(handlers).toBeUndefined();
  });

  it('returns handlers for Azure DevOps remote', () => {
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env: azdoEnv(),
      remote: azdoRemote,
    });

    expect(handlers).toBeDefined();
    expect(typeof handlers!.checkReviewState).toBe('function');
    expect(typeof handlers!.fetchComments).toBe('function');
    expect(typeof handlers!.postComment).toBe('function');
    expect(typeof handlers!.resolveThreads).toBe('function');
    expect(typeof handlers!.reRequestReview).toBe('function');
  });

  it('resolveThreads is no-op on Azure DevOps', async () => {
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env: azdoEnv(),
      remote: azdoRemote,
    });

    const result = await handlers!.resolveThreads(1, ['thread-1']);

    expect(result).toBe(0);
  });

  it('reRequestReview is no-op on Azure DevOps', async () => {
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env: azdoEnv(),
      remote: azdoRemote,
    });

    const result = await handlers!.reRequestReview(1, ['reviewer']);

    expect(result).toBe(false);
  });

  it('returns undefined when credentials are missing', () => {
    const env = { CLANCY_GIT_API_URL: undefined } as Parameters<
      typeof resolvePlatformHandlers
    >[0]['env'];
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env,
      remote: githubRemote,
    });

    expect(handlers).toBeUndefined();
  });

  it('resolveThreads is no-op on GitHub', async () => {
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env: githubEnv(),
      remote: githubRemote,
    });

    const result = await handlers!.resolveThreads(1, ['disc-1']);

    expect(result).toBe(0);
  });

  it('reRequestReview is no-op on GitLab', async () => {
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env: gitlabEnv(),
      remote: gitlabRemote,
    });

    const result = await handlers!.reRequestReview(1, ['reviewer']);

    expect(result).toBe(false);
  });
});
