import type {
  AzdoRemote,
  BitbucketRemote,
  BitbucketServerRemote,
  GenericRemote,
  GitHubRemote,
  GitLabRemote,
  NoRemote,
} from '@chief-clancy/core/types/remote.js';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bbCloudHandlers } from './rework-builders.js';
import { resolvePlatformHandlers } from './rework-handlers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockFetchFn = vi.fn((_url: string, _init: RequestInit) =>
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
  beforeEach(() => {
    mockFetchFn.mockClear();
  });

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

// ─── Handler method invocation ──────────────────────────────────────────────

describe('handler method invocation', () => {
  beforeEach(() => {
    mockFetchFn.mockClear();
  });

  it('GitHub checkReviewState calls fetch with pulls endpoint', async () => {
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env: githubEnv(),
      remote: githubRemote,
    });
    mockFetchFn.mockClear();
    mockFetchFn.mockResolvedValue(new Response('[]', { status: 200 }));

    await handlers!.checkReviewState('feature/test');

    expect(mockFetchFn).toHaveBeenCalled();
    expect(mockFetchFn.mock.calls[0][0]).toContain('api.github.com');
  });

  it('GitHub fetchComments calls fetch with comments endpoint', async () => {
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env: githubEnv(),
      remote: githubRemote,
    });
    mockFetchFn.mockClear();
    mockFetchFn.mockResolvedValue(new Response('[]', { status: 200 }));

    await handlers!.fetchComments(42);

    expect(mockFetchFn).toHaveBeenCalled();
    expect(mockFetchFn.mock.calls[0][0]).toContain('api.github.com');
    expect(mockFetchFn.mock.calls[0][0]).toContain('42');
  });

  it('GitHub postComment calls fetch with POST method', async () => {
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env: githubEnv(),
      remote: githubRemote,
    });
    mockFetchFn.mockClear();
    mockFetchFn.mockResolvedValue(new Response('{}', { status: 201 }));

    await handlers!.postComment(42, 'rework needed');

    expect(mockFetchFn).toHaveBeenCalled();
    expect(mockFetchFn.mock.calls[0][0]).toContain('api.github.com');
    expect(mockFetchFn.mock.calls[0][1]).toHaveProperty('method', 'POST');
  });

  it('GitLab postComment calls fetch with notes endpoint', async () => {
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env: gitlabEnv(),
      remote: gitlabRemote,
    });
    mockFetchFn.mockClear();
    mockFetchFn.mockResolvedValue(new Response('{}', { status: 201 }));

    await handlers!.postComment(10, 'rework needed');

    expect(mockFetchFn).toHaveBeenCalled();
    expect(mockFetchFn.mock.calls[0][0]).toContain('gitlab.com/api/v4');
    expect(mockFetchFn.mock.calls[0][0]).toContain('notes');
  });

  it('Bitbucket Cloud postComment calls fetch with comments endpoint', async () => {
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env: bitbucketEnv(),
      remote: bbCloudRemote,
    });
    mockFetchFn.mockClear();
    mockFetchFn.mockResolvedValue(new Response('{}', { status: 201 }));

    await handlers!.postComment(5, 'rework needed');

    expect(mockFetchFn).toHaveBeenCalled();
    expect(mockFetchFn.mock.calls[0][0]).toContain('api.bitbucket.org');
    expect(mockFetchFn.mock.calls[0][1]).toHaveProperty('method', 'POST');
  });

  it('Bitbucket Server postComment calls fetch with comments endpoint', async () => {
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env: bitbucketEnv(),
      remote: bbServerRemote,
    });
    mockFetchFn.mockClear();
    mockFetchFn.mockResolvedValue(new Response('{}', { status: 201 }));

    await handlers!.postComment(7, 'rework needed');

    expect(mockFetchFn).toHaveBeenCalled();
    expect(mockFetchFn.mock.calls[0][0]).toContain('bitbucket.internal.com');
    expect(mockFetchFn.mock.calls[0][1]).toHaveProperty('method', 'POST');
  });

  it('Azure DevOps postComment calls fetch with threads endpoint', async () => {
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env: azdoEnv(),
      remote: azdoRemote,
    });
    mockFetchFn.mockClear();
    mockFetchFn.mockResolvedValue(new Response('{}', { status: 201 }));

    await handlers!.postComment(3, 'rework needed');

    expect(mockFetchFn).toHaveBeenCalled();
    expect(mockFetchFn.mock.calls[0][0]).toContain('dev.azure.com');
    expect(mockFetchFn.mock.calls[0][1]).toHaveProperty('method', 'POST');
  });
});

// ─── CLANCY_GIT_API_URL override ────────────────────────────────────────────

describe('CLANCY_GIT_API_URL override', () => {
  beforeEach(() => {
    mockFetchFn.mockClear();
  });

  it('uses custom API URL for GitHub when set', async () => {
    const env = {
      ...githubEnv(),
      CLANCY_GIT_API_URL: 'https://ghe.internal.com/api/v3',
    };
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env,
      remote: githubRemote,
    });
    mockFetchFn.mockClear();
    mockFetchFn.mockResolvedValue(new Response('[]', { status: 200 }));

    await handlers!.checkReviewState('feature/test');

    expect(mockFetchFn.mock.calls[0][0]).toContain('ghe.internal.com');
  });

  it('uses custom API URL for GitLab when set', async () => {
    const env = {
      ...gitlabEnv(),
      CLANCY_GIT_API_URL: 'https://gl.internal.com/api/v4',
    };
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env,
      remote: gitlabRemote,
    });
    mockFetchFn.mockClear();
    mockFetchFn.mockResolvedValue(new Response('[]', { status: 200 }));

    await handlers!.postComment(1, 'test');

    expect(mockFetchFn.mock.calls[0][0]).toContain('gl.internal.com');
  });
});

// ─── Per-platform credential resolution ─────────────────────────────────────

describe('per-platform credential resolution', () => {
  it('returns undefined when GitLab token is missing', () => {
    const env = { CLANCY_GIT_API_URL: undefined } as Parameters<
      typeof resolvePlatformHandlers
    >[0]['env'];
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env,
      remote: gitlabRemote,
    });

    expect(handlers).toBeUndefined();
  });

  it('returns undefined when Bitbucket credentials are missing', () => {
    const env = { CLANCY_GIT_API_URL: undefined } as Parameters<
      typeof resolvePlatformHandlers
    >[0]['env'];
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env,
      remote: bbCloudRemote,
    });

    expect(handlers).toBeUndefined();
  });

  it('returns undefined when Azure DevOps PAT is missing', () => {
    const env = { CLANCY_GIT_API_URL: undefined } as Parameters<
      typeof resolvePlatformHandlers
    >[0]['env'];
    const handlers = resolvePlatformHandlers({
      fetchFn: mockFetchFn,
      env,
      remote: azdoRemote,
    });

    expect(handlers).toBeUndefined();
  });
});

// ─── Bitbucket Cloud username guard ─────────────────────────────────────────

describe('bbCloudHandlers', () => {
  it('throws when username is missing', () => {
    const ctx = {
      fetchFn: mockFetchFn,
      token: 'bbtoken',
      apiBase: 'https://api.bitbucket.org/2.0',
      username: undefined,
    };

    expect(() => bbCloudHandlers(ctx, bbCloudRemote)).toThrow(
      'Bitbucket Cloud requires a username',
    );
  });
});
