import type { ReworkCtx } from './rework-handlers.js';
import type {
  AzdoRemote,
  BitbucketRemote,
  BitbucketServerRemote,
  GitHubRemote,
  GitLabRemote,
} from '@chief-clancy/core/types/remote.js';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  azdoHandlers,
  bbCloudHandlers,
  bbServerHandlers,
  githubHandlers,
  gitlabHandlers,
} from './rework-builders.js';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const mockFetchFn = vi.fn((_url: string, _init: RequestInit) =>
  Promise.resolve(new Response('{}', { status: 200 })),
);

const baseCtx: ReworkCtx = {
  fetchFn: mockFetchFn,
  token: 'test-token',
  apiBase: 'https://api.example.com',
};

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

beforeEach(() => {
  mockFetchFn.mockClear();
  mockFetchFn.mockResolvedValue(new Response('{}', { status: 200 }));
});

// ─── githubHandlers ─────────────────────────────────────────────────────────

describe('githubHandlers', () => {
  it('returns all five handler methods', () => {
    const handlers = githubHandlers(baseCtx, githubRemote);

    expect(typeof handlers.checkReviewState).toBe('function');
    expect(typeof handlers.fetchComments).toBe('function');
    expect(typeof handlers.postComment).toBe('function');
    expect(typeof handlers.resolveThreads).toBe('function');
    expect(typeof handlers.reRequestReview).toBe('function');
  });

  it('resolveThreads is a no-op returning 0', async () => {
    const handlers = githubHandlers(baseCtx, githubRemote);

    expect(await handlers.resolveThreads(1, ['d1'])).toBe(0);
  });

  it('checkReviewState forwards ctx fields to fetch', async () => {
    const handlers = githubHandlers(baseCtx, githubRemote);

    await handlers.checkReviewState('feature/test');

    expect(mockFetchFn).toHaveBeenCalled();
    const url = mockFetchFn.mock.calls[0][0];
    expect(url).toContain('api.example.com');
    expect(url).toContain('acme/app');
  });

  it('fetchComments forwards prNumber to fetch', async () => {
    const handlers = githubHandlers(baseCtx, githubRemote);

    await handlers.fetchComments(42);

    expect(mockFetchFn).toHaveBeenCalled();
    const url = mockFetchFn.mock.calls[0][0];
    expect(url).toContain('api.example.com');
    expect(url).toContain('/42/');
  });

  it('postComment forwards prNumber and body to fetch', async () => {
    const handlers = githubHandlers(baseCtx, githubRemote);

    await handlers.postComment(42, 'rework comment');

    expect(mockFetchFn).toHaveBeenCalled();
    const url = mockFetchFn.mock.calls[0][0];
    expect(url).toContain('/42/');
  });

  it('reRequestReview forwards prNumber and reviewers to fetch', async () => {
    const handlers = githubHandlers(baseCtx, githubRemote);

    await handlers.reRequestReview(42, ['reviewer1']);

    expect(mockFetchFn).toHaveBeenCalled();
    const url = mockFetchFn.mock.calls[0][0];
    expect(url).toContain('api.example.com');
    expect(url).toContain('acme/app');
    expect(url).toContain('/42/');
  });
});

// ─── gitlabHandlers ─────────────────────────────────────────────────────────

describe('gitlabHandlers', () => {
  it('returns all five handler methods', () => {
    const handlers = gitlabHandlers(baseCtx, gitlabRemote);

    expect(typeof handlers.checkReviewState).toBe('function');
    expect(typeof handlers.fetchComments).toBe('function');
    expect(typeof handlers.postComment).toBe('function');
    expect(typeof handlers.resolveThreads).toBe('function');
    expect(typeof handlers.reRequestReview).toBe('function');
  });

  it('reRequestReview is a no-op returning false', async () => {
    const handlers = gitlabHandlers(baseCtx, gitlabRemote);

    expect(await handlers.reRequestReview(1, ['user'])).toBe(false);
  });

  it('postComment forwards projectPath and mrIid to fetch', async () => {
    const handlers = gitlabHandlers(baseCtx, gitlabRemote);

    await handlers.postComment(10, 'note body');

    expect(mockFetchFn).toHaveBeenCalled();
    const url = mockFetchFn.mock.calls[0][0];
    expect(url).toContain('api.example.com');
    expect(url).toContain('acme%2Fapp');
  });

  it('resolveThreads forwards projectPath and discussionIds to fetch', async () => {
    const handlers = gitlabHandlers(baseCtx, gitlabRemote);

    await handlers.resolveThreads(10, ['disc-1', 'disc-2']);

    expect(mockFetchFn).toHaveBeenCalled();
    const url = mockFetchFn.mock.calls[0][0];
    expect(url).toContain('api.example.com');
    expect(url).toContain('acme%2Fapp');
    expect(url).toContain('disc-1');
  });
});

// ─── bbCloudHandlers ────────────────────────────────────────────────────────

describe('bbCloudHandlers', () => {
  const bbCtx: ReworkCtx = { ...baseCtx, username: 'bbuser' };

  it('returns all five handler methods', () => {
    const handlers = bbCloudHandlers(bbCtx, bbCloudRemote);

    expect(typeof handlers.checkReviewState).toBe('function');
    expect(typeof handlers.fetchComments).toBe('function');
    expect(typeof handlers.postComment).toBe('function');
    expect(typeof handlers.resolveThreads).toBe('function');
    expect(typeof handlers.reRequestReview).toBe('function');
  });

  it('throws when username is missing', () => {
    expect(() => bbCloudHandlers(baseCtx, bbCloudRemote)).toThrow(
      'Bitbucket Cloud requires a username',
    );
  });

  it('resolveThreads is a no-op returning 0', async () => {
    const handlers = bbCloudHandlers(bbCtx, bbCloudRemote);

    expect(await handlers.resolveThreads(1, ['t1'])).toBe(0);
  });

  it('reRequestReview is a no-op returning false', async () => {
    const handlers = bbCloudHandlers(bbCtx, bbCloudRemote);

    expect(await handlers.reRequestReview(1, ['user'])).toBe(false);
  });

  it('postComment forwards workspace and repoSlug to fetch', async () => {
    const handlers = bbCloudHandlers(bbCtx, bbCloudRemote);

    await handlers.postComment(5, 'cloud comment');

    expect(mockFetchFn).toHaveBeenCalled();
    const url = mockFetchFn.mock.calls[0][0];
    expect(url).toContain('bitbucket.org');
    expect(url).toContain('acme');
    expect(url).toContain('app');
  });
});

// ─── bbServerHandlers ───────────────────────────────────────────────────────

describe('bbServerHandlers', () => {
  it('returns all five handler methods', () => {
    const handlers = bbServerHandlers(baseCtx, bbServerRemote);

    expect(typeof handlers.checkReviewState).toBe('function');
    expect(typeof handlers.fetchComments).toBe('function');
    expect(typeof handlers.postComment).toBe('function');
    expect(typeof handlers.resolveThreads).toBe('function');
    expect(typeof handlers.reRequestReview).toBe('function');
  });

  it('resolveThreads is a no-op returning 0', async () => {
    const handlers = bbServerHandlers(baseCtx, bbServerRemote);

    expect(await handlers.resolveThreads(1, ['t1'])).toBe(0);
  });

  it('reRequestReview is a no-op returning false', async () => {
    const handlers = bbServerHandlers(baseCtx, bbServerRemote);

    expect(await handlers.reRequestReview(1, ['user'])).toBe(false);
  });

  it('postComment forwards projectKey and repoSlug to fetch', async () => {
    const handlers = bbServerHandlers(baseCtx, bbServerRemote);

    await handlers.postComment(7, 'server comment');

    expect(mockFetchFn).toHaveBeenCalled();
    const url = mockFetchFn.mock.calls[0][0];
    expect(url).toContain('api.example.com');
    expect(url).toContain('ACME');
    expect(url).toContain('app');
  });
});

// ─── azdoHandlers ───────────────────────────────────────────────────────────

describe('azdoHandlers', () => {
  it('returns all five handler methods', () => {
    const handlers = azdoHandlers(baseCtx, azdoRemote);

    expect(typeof handlers.checkReviewState).toBe('function');
    expect(typeof handlers.fetchComments).toBe('function');
    expect(typeof handlers.postComment).toBe('function');
    expect(typeof handlers.resolveThreads).toBe('function');
    expect(typeof handlers.reRequestReview).toBe('function');
  });

  it('resolveThreads is a no-op returning 0', async () => {
    const handlers = azdoHandlers(baseCtx, azdoRemote);

    expect(await handlers.resolveThreads(1, ['t1'])).toBe(0);
  });

  it('reRequestReview is a no-op returning false', async () => {
    const handlers = azdoHandlers(baseCtx, azdoRemote);

    expect(await handlers.reRequestReview(1, ['user'])).toBe(false);
  });

  it('postComment forwards org, project, repo to fetch', async () => {
    const handlers = azdoHandlers(baseCtx, azdoRemote);

    await handlers.postComment(3, 'azdo comment');

    expect(mockFetchFn).toHaveBeenCalled();
    const url = mockFetchFn.mock.calls[0][0];
    expect(url).toContain('acme');
    expect(url).toContain('platform');
    expect(url).toContain('app');
  });
});
