import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  checkPrReviewState,
  createPullRequest,
  fetchPrReviewComments,
  postCloudPrComment,
} from './cloud.js';
import {
  checkServerPrReviewState,
  createServerPullRequest,
  fetchServerPrReviewComments,
  postServerPrComment,
} from './server.js';

/** Build a mock fetch that resolves a sequence of responses. */
function chainedFetch(...responses: readonly Record<string, unknown>[]) {
  const fn = vi.fn();
  responses.forEach((r) => {
    fn.mockResolvedValueOnce(r);
  });
  return fn;
}

const CLOUD_OPTS = {
  username: 'user',
  token: 'app-pass',
  workspace: 'ws',
  repoSlug: 'repo',
};

const SERVER_OPTS = {
  token: 'pat-token',
  apiBase: 'https://bb.acme.com/rest/api/1.0',
  projectKey: 'PROJ',
  repoSlug: 'repo',
};

const CLOUD_PR = {
  values: [
    {
      id: 10,
      links: {
        html: { href: 'https://bitbucket.org/ws/repo/pull-requests/10' },
      },
      participants: [],
    },
  ],
};
const SERVER_PR = {
  values: [
    {
      id: 10,
      links: {
        self: [
          {
            href: 'https://bb.acme.com/projects/PROJ/repos/repo/pull-requests/10',
          },
        ],
      },
      reviewers: [],
    },
  ],
};

// ─── createPullRequest (Cloud) ──────────────────────────────────────────────

describe('createPullRequest', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates a PR successfully', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 10,
            links: {
              html: { href: 'https://bitbucket.org/ws/repo/pull-requests/10' },
            },
          }),
      }),
    );

    const result = await createPullRequest({
      fetchFn: mockFetch as never,
      ...CLOUD_OPTS,
      sourceBranch: 'feature/test',
      targetBranch: 'main',
      title: 'feat: test',
      description: 'Description',
    });

    expect(result).toEqual({
      ok: true,
      url: 'https://bitbucket.org/ws/repo/pull-requests/10',
      number: 10,
    });
  });

  it('returns alreadyExists on 409', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 409,
        text: () => Promise.resolve('PR already exists'),
      }),
    );

    const result = await createPullRequest({
      fetchFn: mockFetch as never,
      ...CLOUD_OPTS,
      sourceBranch: 'branch',
      targetBranch: 'main',
      title: 'title',
      description: 'body',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.alreadyExists).toBe(true);
  });

  it('sets close_source_branch: true', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 1, links: { html: {} } }),
      }),
    );

    await createPullRequest({
      fetchFn: mockFetch as never,
      ...CLOUD_OPTS,
      sourceBranch: 'branch',
      targetBranch: 'main',
      title: 'title',
      description: 'body',
    });

    const call = mockFetch.mock.calls[0] as unknown[];
    const init = call[1] as { body: string };
    const body = JSON.parse(init.body);
    expect(body.close_source_branch).toBe(true);
  });
});

// ─── createServerPullRequest ────────────────────────────────────────────────

describe('createServerPullRequest', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates a Server PR successfully', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 10,
            links: { self: [{ href: 'https://bb.acme.com/pull-requests/10' }] },
          }),
      }),
    );

    const result = await createServerPullRequest({
      fetchFn: mockFetch as never,
      ...SERVER_OPTS,
      sourceBranch: 'feature/test',
      targetBranch: 'main',
      title: 'feat: test',
      description: 'Description',
    });

    expect(result).toEqual({
      ok: true,
      url: 'https://bb.acme.com/pull-requests/10',
      number: 10,
    });
  });

  it('detects "Only one pull request" as duplicate', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 409,
        text: () => Promise.resolve('Only one pull request may be open'),
      }),
    );

    const result = await createServerPullRequest({
      fetchFn: mockFetch as never,
      ...SERVER_OPTS,
      sourceBranch: 'branch',
      targetBranch: 'main',
      title: 'title',
      description: 'body',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.alreadyExists).toBe(true);
  });

  it('uses refs/heads/ prefix in branch refs', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 1, links: { self: [] } }),
      }),
    );

    await createServerPullRequest({
      fetchFn: mockFetch as never,
      ...SERVER_OPTS,
      sourceBranch: 'feature/x',
      targetBranch: 'main',
      title: 'title',
      description: 'body',
    });

    const call = mockFetch.mock.calls[0] as unknown[];
    const init = call[1] as { body: string };
    const body = JSON.parse(init.body);
    expect(body.fromRef.id).toBe('refs/heads/feature/x');
    expect(body.toRef.id).toBe('refs/heads/main');
  });
});

// ─── postCloudPrComment ─────────────────────────────────────────────────────

describe('postCloudPrComment', () => {
  afterEach(() => vi.restoreAllMocks());

  it('posts comment and returns true', async () => {
    const mockFetch = vi.fn(() => Promise.resolve({ ok: true }));

    const result = await postCloudPrComment({
      fetchFn: mockFetch as never,
      ...CLOUD_OPTS,
      prId: 10,
      body: 'Rework pushed.',
    });

    expect(result).toBe(true);
  });

  it('returns false on error', async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));

    const result = await postCloudPrComment({
      fetchFn: mockFetch as never,
      ...CLOUD_OPTS,
      prId: 10,
      body: 'comment',
    });

    expect(result).toBe(false);
  });
});

// ─── postServerPrComment ────────────────────────────────────────────────────

describe('postServerPrComment', () => {
  afterEach(() => vi.restoreAllMocks());

  it('posts comment and returns true', async () => {
    const mockFetch = vi.fn(() => Promise.resolve({ ok: true }));

    const result = await postServerPrComment({
      fetchFn: mockFetch as never,
      ...SERVER_OPTS,
      prId: 10,
      body: 'Rework pushed.',
    });

    expect(result).toBe(true);
  });

  it('returns false on API error', async () => {
    const mockFetch = vi.fn(() => Promise.resolve({ ok: false, status: 403 }));

    const result = await postServerPrComment({
      fetchFn: mockFetch as never,
      ...SERVER_OPTS,
      prId: 10,
      body: 'comment',
    });

    expect(result).toBe(false);
  });
});

// ─── checkPrReviewState (Cloud) ─────────────────────────────────────────────

describe('checkPrReviewState', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns hasChangesRequested: true when inline comments exist', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(CLOUD_PR) },
      {
        ok: true,
        json: () =>
          Promise.resolve({
            values: [
              {
                content: { raw: 'Fix this' },
                inline: { path: 'src/index.ts' },
                created_on: '2026-01-01T00:00:00Z',
              },
            ],
          }),
      },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...CLOUD_OPTS,
      branch: 'feature/test',
    });

    expect(result?.hasChangesRequested).toBe(true);
  });

  it('returns hasChangesRequested: true when Rework: comment exists', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(CLOUD_PR) },
      {
        ok: true,
        json: () =>
          Promise.resolve({
            values: [
              {
                content: { raw: 'Rework: Fix it' },
                created_on: '2026-01-01T00:00:00Z',
              },
            ],
          }),
      },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...CLOUD_OPTS,
      branch: 'feature/test',
    });

    expect(result?.hasChangesRequested).toBe(true);
  });

  it('returns hasChangesRequested: false for non-Rework: comments', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(CLOUD_PR) },
      {
        ok: true,
        json: () =>
          Promise.resolve({
            values: [
              {
                content: { raw: 'Nice work!' },
                created_on: '2026-01-01T00:00:00Z',
              },
            ],
          }),
      },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...CLOUD_OPTS,
      branch: 'feature/test',
    });

    expect(result?.hasChangesRequested).toBe(false);
  });

  it('returns undefined when no open PR', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ values: [] }),
    });

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...CLOUD_OPTS,
      branch: 'feature/no-pr',
    });

    expect(result).toBeUndefined();
  });

  it('filters by since timestamp', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(CLOUD_PR) },
      {
        ok: true,
        json: () =>
          Promise.resolve({
            values: [
              {
                content: { raw: 'Old comment' },
                inline: { path: 'f.ts' },
                created_on: '2025-01-01T00:00:00Z',
              },
            ],
          }),
      },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...CLOUD_OPTS,
      branch: 'feature/test',
      since: '2026-01-01T00:00:00Z',
    });

    expect(result?.hasChangesRequested).toBe(false);
  });
});

// ─── fetchPrReviewComments (Cloud) ──────────────────────────────────────────

describe('fetchPrReviewComments', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns inline comments with path prefix and Rework: content', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          values: [
            {
              content: { raw: 'Fix this' },
              inline: { path: 'src/a.ts' },
              created_on: '2026-01-01T00:00:00Z',
            },
            {
              content: { raw: 'Rework: validation broken' },
              created_on: '2026-01-01T00:00:00Z',
            },
            {
              content: { raw: 'Looks good!' },
              created_on: '2026-01-01T00:00:00Z',
            },
          ],
        }),
    });

    const result = await fetchPrReviewComments({
      fetchFn: mockFetch as never,
      ...CLOUD_OPTS,
      prId: 10,
    });

    expect(result).toEqual(['[src/a.ts] Fix this', 'validation broken']);
  });

  it('excludes [clancy] comments', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          values: [
            {
              content: { raw: '[clancy] Rework pushed.' },
              created_on: '2026-01-01T00:00:00Z',
            },
            {
              content: { raw: 'Fix this' },
              inline: { path: 'src/a.ts' },
              created_on: '2026-01-01T00:00:00Z',
            },
          ],
        }),
    });

    const result = await fetchPrReviewComments({
      fetchFn: mockFetch as never,
      ...CLOUD_OPTS,
      prId: 10,
    });

    expect(result).toEqual(['[src/a.ts] Fix this']);
  });

  it('returns empty on error', async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));

    const result = await fetchPrReviewComments({
      fetchFn: mockFetch as never,
      ...CLOUD_OPTS,
      prId: 10,
    });

    expect(result).toEqual([]);
  });
});

// ─── checkServerPrReviewState ───────────────────────────────────────────────

describe('checkServerPrReviewState', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns hasChangesRequested: true when anchor comment exists', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(SERVER_PR) },
      {
        ok: true,
        json: () =>
          Promise.resolve({
            values: [
              {
                action: 'COMMENTED',
                comment: {
                  text: 'Fix',
                  anchor: { path: 'src/a.ts' },
                  createdDate: Date.now(),
                },
              },
            ],
          }),
      },
    );

    const result = await checkServerPrReviewState({
      fetchFn: mockFetch as never,
      ...SERVER_OPTS,
      branch: 'feature/test',
    });

    expect(result?.hasChangesRequested).toBe(true);
  });

  it('returns hasChangesRequested: false for non-comment activities', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(SERVER_PR) },
      {
        ok: true,
        json: () =>
          Promise.resolve({
            values: [{ action: 'APPROVED' }],
          }),
      },
    );

    const result = await checkServerPrReviewState({
      fetchFn: mockFetch as never,
      ...SERVER_OPTS,
      branch: 'feature/test',
    });

    expect(result?.hasChangesRequested).toBe(false);
  });

  it('filters by since timestamp (epoch ms)', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(SERVER_PR) },
      {
        ok: true,
        json: () =>
          Promise.resolve({
            values: [
              {
                action: 'COMMENTED',
                comment: {
                  text: 'Old',
                  anchor: { path: 'f.ts' },
                  createdDate: 1000,
                },
              },
            ],
          }),
      },
    );

    const result = await checkServerPrReviewState({
      fetchFn: mockFetch as never,
      ...SERVER_OPTS,
      branch: 'feature/test',
      since: '2026-01-01T00:00:00Z',
    });

    expect(result?.hasChangesRequested).toBe(false);
  });

  it('returns undefined when no open PR', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ values: [] }),
    });

    const result = await checkServerPrReviewState({
      fetchFn: mockFetch as never,
      ...SERVER_OPTS,
      branch: 'feature/no-pr',
    });

    expect(result).toBeUndefined();
  });
});

// ─── fetchServerPrReviewComments ────────────────────────────────────────────

describe('fetchServerPrReviewComments', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns anchor comments with path prefix and Rework: content', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          values: [
            {
              action: 'COMMENTED',
              comment: {
                text: 'Fix this',
                anchor: { path: 'src/a.ts' },
                createdDate: Date.now(),
              },
            },
            {
              action: 'COMMENTED',
              comment: { text: 'Rework: broken', createdDate: Date.now() },
            },
            {
              action: 'COMMENTED',
              comment: { text: 'Looks good', createdDate: Date.now() },
            },
            { action: 'APPROVED' },
          ],
        }),
    });

    const result = await fetchServerPrReviewComments({
      fetchFn: mockFetch as never,
      ...SERVER_OPTS,
      prId: 10,
    });

    expect(result).toEqual(['[src/a.ts] Fix this', 'broken']);
  });

  it('excludes [clancy] comments', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          values: [
            {
              action: 'COMMENTED',
              comment: {
                text: '[clancy] Rework pushed.',
                createdDate: Date.now(),
              },
            },
            {
              action: 'COMMENTED',
              comment: {
                text: 'Fix this',
                anchor: { path: 'src/a.ts' },
                createdDate: Date.now(),
              },
            },
          ],
        }),
    });

    const result = await fetchServerPrReviewComments({
      fetchFn: mockFetch as never,
      ...SERVER_OPTS,
      prId: 10,
    });

    expect(result).toEqual(['[src/a.ts] Fix this']);
  });

  it('returns empty on error', async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));

    const result = await fetchServerPrReviewComments({
      fetchFn: mockFetch as never,
      ...SERVER_OPTS,
      prId: 10,
    });

    expect(result).toEqual([]);
  });
});
