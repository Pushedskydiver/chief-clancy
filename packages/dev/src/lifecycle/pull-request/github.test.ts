import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  checkPrReviewState,
  createPullRequest,
  fetchPrReviewComments,
  postPrComment,
  requestReview,
} from './github.js';

/** Build a mock fetch that resolves a sequence of responses. */
function chainedFetch(...responses: readonly Record<string, unknown>[]) {
  const fn = vi.fn();
  responses.forEach((r) => {
    fn.mockResolvedValueOnce(r);
  });
  return fn;
}

/** A standard open PR response for reuse. */
const OPEN_PR = [
  {
    number: 10,
    html_url: 'https://github.com/owner/repo/pull/10',
    state: 'open',
  },
];

const BASE_OPTS = {
  token: 'ghp_test',
  repo: 'owner/repo',
  apiBase: 'https://api.github.com',
};

// ─── createPullRequest ──────────────────────────────────────────────────────

describe('createPullRequest', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates a PR successfully', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            html_url: 'https://github.com/owner/repo/pull/42',
            number: 42,
          }),
      }),
    );

    const result = await createPullRequest({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      head: 'feature/test',
      base: 'main',
      title: 'feat: test',
      body: 'Description',
    });

    expect(result).toEqual({
      ok: true,
      url: 'https://github.com/owner/repo/pull/42',
      number: 42,
    });
  });

  it('returns alreadyExists on 422 duplicate', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 422,
        text: () =>
          Promise.resolve(
            'A pull request already exists for owner:feature/test',
          ),
      }),
    );

    const result = await createPullRequest({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      head: 'feature/test',
      base: 'main',
      title: 'title',
      body: 'body',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.alreadyExists).toBe(true);
    }
  });

  it('returns error on auth failure', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Bad credentials'),
      }),
    );

    const result = await createPullRequest({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      head: 'branch',
      base: 'main',
      title: 'title',
      body: 'body',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('401');
    }
  });

  it('returns error on network failure', async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));

    const result = await createPullRequest({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      head: 'branch',
      base: 'main',
      title: 'title',
      body: 'body',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Network error');
    }
  });

  it('uses custom API base URL', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ html_url: '', number: 1 }),
      }),
    );

    await createPullRequest({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      apiBase: 'https://github.acme.com/api/v3',
      head: 'branch',
      base: 'main',
      title: 'title',
      body: 'body',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://github.acme.com/api/v3/repos/owner/repo/pulls',
      expect.any(Object),
    );
  });
});

// ─── checkPrReviewState ─────────────────────────────────────────────────────

describe('checkPrReviewState', () => {
  afterEach(() => vi.restoreAllMocks());

  const reviewOpts = {
    ...BASE_OPTS,
    branch: 'feature/test',
    owner: 'owner',
  };

  it('returns hasChangesRequested: true when inline comments exist', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(OPEN_PR) },
      {
        ok: true,
        json: () =>
          Promise.resolve([
            { body: 'Needs error handling', path: 'src/index.ts' },
          ]),
      },
      { ok: true, json: () => Promise.resolve([]) },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...reviewOpts,
    });

    expect(result).toEqual({
      hasChangesRequested: true,
      prNumber: 10,
      prUrl: 'https://github.com/owner/repo/pull/10',
    });
  });

  it('returns hasChangesRequested: true when a Rework: conversation comment exists', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(OPEN_PR) },
      { ok: true, json: () => Promise.resolve([]) },
      {
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 1,
              body: 'Rework: Fix the validation logic',
              created_at: '2026-01-01T00:00:00Z',
            },
          ]),
      },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...reviewOpts,
    });

    expect(result).toEqual({
      hasChangesRequested: true,
      prNumber: 10,
      prUrl: 'https://github.com/owner/repo/pull/10',
    });
  });

  it('returns hasChangesRequested: false when only non-Rework: conversation comments exist', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(OPEN_PR) },
      { ok: true, json: () => Promise.resolve([]) },
      {
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 1,
              body: 'Nice work!',
              created_at: '2026-01-01T00:00:00Z',
            },
          ]),
      },
      { ok: true, json: () => Promise.resolve([]) },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...reviewOpts,
    });

    expect(result).toEqual({
      hasChangesRequested: false,
      prNumber: 10,
      prUrl: 'https://github.com/owner/repo/pull/10',
    });
  });

  it('is case-insensitive for Rework: prefix', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(OPEN_PR) },
      { ok: true, json: () => Promise.resolve([]) },
      {
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 1,
              body: 'rework: lowercase prefix',
              created_at: '2026-01-01T00:00:00Z',
            },
          ]),
      },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...reviewOpts,
    });

    expect(result?.hasChangesRequested).toBe(true);
  });

  it('returns undefined when no open PR for branch', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...reviewOpts,
    });

    expect(result).toBeUndefined();
  });

  it('returns undefined on API error', async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...reviewOpts,
    });

    expect(result).toBeUndefined();
  });

  it('passes since parameter to API URLs when provided', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(OPEN_PR) },
      { ok: true, json: () => Promise.resolve([]) },
      { ok: true, json: () => Promise.resolve([]) },
      { ok: true, json: () => Promise.resolve([]) },
    );

    await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...reviewOpts,
      since: '2026-03-14T10:00:00Z',
    });

    expect(mockFetch.mock.calls[1][0]).toContain(
      `&since=${encodeURIComponent('2026-03-14T10:00:00Z')}`,
    );
    expect(mockFetch.mock.calls[2][0]).toContain(
      `&since=${encodeURIComponent('2026-03-14T10:00:00Z')}`,
    );
  });

  it('without since, URLs do not include since parameter', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(OPEN_PR) },
      {
        ok: true,
        json: () =>
          Promise.resolve([{ body: 'Inline comment', path: 'src/index.ts' }]),
      },
      { ok: true, json: () => Promise.resolve([]) },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...reviewOpts,
    });

    expect(result?.hasChangesRequested).toBe(true);
    expect(mockFetch.mock.calls[1][0]).not.toContain('&since=');
  });

  it('CHANGES_REQUESTED review triggers rework', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(OPEN_PR) },
      { ok: true, json: () => Promise.resolve([]) },
      { ok: true, json: () => Promise.resolve([]) },
      {
        ok: true,
        json: () =>
          Promise.resolve([
            {
              state: 'CHANGES_REQUESTED',
              user: { login: 'reviewer1' },
              submitted_at: '2026-01-01T00:00:00Z',
            },
          ]),
      },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...reviewOpts,
    });

    expect(result).toEqual({
      hasChangesRequested: true,
      prNumber: 10,
      prUrl: 'https://github.com/owner/repo/pull/10',
      reviewers: ['reviewer1'],
    });
  });

  it('APPROVED review does not trigger rework when no comments', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(OPEN_PR) },
      { ok: true, json: () => Promise.resolve([]) },
      { ok: true, json: () => Promise.resolve([]) },
      {
        ok: true,
        json: () =>
          Promise.resolve([
            {
              state: 'APPROVED',
              user: { login: 'reviewer1' },
              submitted_at: '2026-01-01T00:00:00Z',
            },
          ]),
      },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...reviewOpts,
    });

    expect(result).toEqual({
      hasChangesRequested: false,
      prNumber: 10,
      prUrl: 'https://github.com/owner/repo/pull/10',
    });
  });

  it('review fetch failure does not break flow', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(OPEN_PR) },
      { ok: true, json: () => Promise.resolve([]) },
      { ok: true, json: () => Promise.resolve([]) },
      { ok: false, status: 500 },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...reviewOpts,
    });

    expect(result).toEqual({
      hasChangesRequested: false,
      prNumber: 10,
      prUrl: 'https://github.com/owner/repo/pull/10',
    });
  });

  it('filters out [clancy] prefixed comments', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(OPEN_PR) },
      {
        ok: true,
        json: () =>
          Promise.resolve([
            {
              body: '[clancy] Rework pushed addressing 1 feedback item.',
              path: 'src/index.ts',
            },
          ]),
      },
      {
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 1,
              body: '[clancy] Rework pushed addressing reviewer feedback.',
              created_at: '2026-01-01T00:00:00Z',
            },
          ]),
      },
      { ok: true, json: () => Promise.resolve([]) },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...reviewOpts,
    });

    expect(result?.hasChangesRequested).toBe(false);
  });

  it('allows user Rework: comments through even when same author', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(OPEN_PR) },
      { ok: true, json: () => Promise.resolve([]) },
      {
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 1,
              body: 'Rework: Fix the validation logic',
              created_at: '2026-01-01T00:00:00Z',
              user: { login: 'testuser' },
            },
          ]),
      },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...reviewOpts,
    });

    expect(result?.hasChangesRequested).toBe(true);
  });
});

// ─── fetchPrReviewComments ──────────────────────────────────────────────────

describe('fetchPrReviewComments', () => {
  afterEach(() => vi.restoreAllMocks());

  it('filters out [clancy] prefixed inline and conversation comments', async () => {
    const mockFetch = chainedFetch(
      {
        ok: true,
        json: () =>
          Promise.resolve([
            { body: 'Real reviewer feedback', path: 'src/index.ts' },
            {
              body: '[clancy] Rework pushed addressing 1 feedback item.',
              path: 'src/index.ts',
            },
          ]),
      },
      {
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 1,
              body: 'Rework: Fix validation',
              created_at: '2026-01-01T00:00:00Z',
            },
            {
              id: 2,
              body: '[clancy] Rework pushed addressing reviewer feedback.',
              created_at: '2026-01-01T00:00:00Z',
            },
          ]),
      },
    );

    const result = await fetchPrReviewComments({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      prNumber: 10,
    });

    expect(result).toEqual([
      '[src/index.ts] Real reviewer feedback',
      'Fix validation',
    ]);
  });

  it('returns all inline comments and only Rework: conversation comments', async () => {
    const mockFetch = chainedFetch(
      {
        ok: true,
        json: () =>
          Promise.resolve([
            { body: 'This needs error handling', path: 'src/index.ts' },
            { body: 'Looks good', path: 'src/utils.ts' },
          ]),
      },
      {
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 1,
              body: 'Rework: Overall validation is wrong',
              created_at: '2026-01-01T00:00:00Z',
            },
            {
              id: 2,
              body: 'Nice work on the tests',
              created_at: '2026-01-02T00:00:00Z',
            },
          ]),
      },
    );

    const result = await fetchPrReviewComments({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      prNumber: 10,
    });

    expect(result).toEqual([
      '[src/index.ts] This needs error handling',
      '[src/utils.ts] Looks good',
      'Overall validation is wrong',
    ]);
  });

  it('excludes non-Rework: conversation comments', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve([]) },
      {
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 1,
              body: 'Please rework this part',
              created_at: '2026-01-01T00:00:00Z',
            },
          ]),
      },
    );

    const result = await fetchPrReviewComments({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      prNumber: 10,
    });

    expect(result).toEqual([]);
  });

  it('returns empty array on error', async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));

    const result = await fetchPrReviewComments({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      prNumber: 10,
    });

    expect(result).toEqual([]);
  });
});

// ─── postPrComment ──────────────────────────────────────────────────────────

describe('postPrComment', () => {
  afterEach(() => vi.restoreAllMocks());

  it('posts a comment successfully and returns true', async () => {
    const mockFetch = vi.fn(() => Promise.resolve({ ok: true }));

    const result = await postPrComment({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      prNumber: 42,
      body: 'Rework pushed.',
    });

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/issues/42/comments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ body: 'Rework pushed.' }),
      }),
    );
  });

  it('returns false on API error', async () => {
    const mockFetch = vi.fn(() => Promise.resolve({ ok: false, status: 403 }));

    const result = await postPrComment({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      prNumber: 42,
      body: 'comment',
    });

    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));

    const result = await postPrComment({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      prNumber: 42,
      body: 'comment',
    });

    expect(result).toBe(false);
  });

  it('uses custom API base URL', async () => {
    const mockFetch = vi.fn(() => Promise.resolve({ ok: true }));

    await postPrComment({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      apiBase: 'https://github.acme.com/api/v3',
      prNumber: 42,
      body: 'comment',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://github.acme.com/api/v3/repos/owner/repo/issues/42/comments',
      expect.any(Object),
    );
  });
});

// ─── requestReview ──────────────────────────────────────────────────────────

describe('requestReview', () => {
  afterEach(() => vi.restoreAllMocks());

  it('requests review successfully and returns true', async () => {
    const mockFetch = vi.fn(() => Promise.resolve({ ok: true }));

    const result = await requestReview({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      prNumber: 42,
      reviewers: ['reviewer1', 'reviewer2'],
    });

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/pulls/42/requested_reviewers',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reviewers: ['reviewer1', 'reviewer2'] }),
      }),
    );
  });

  it('returns false on API error', async () => {
    const mockFetch = vi.fn(() => Promise.resolve({ ok: false, status: 422 }));

    const result = await requestReview({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      prNumber: 42,
      reviewers: ['not-a-collaborator'],
    });

    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));

    const result = await requestReview({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      prNumber: 42,
      reviewers: ['reviewer1'],
    });

    expect(result).toBe(false);
  });
});
