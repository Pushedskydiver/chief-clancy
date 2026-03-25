import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  checkPrReviewState,
  createPullRequest,
  fetchPrReviewComments,
  postPrComment,
} from './azdo.js';

/** Build a mock fetch that resolves a sequence of responses. */
function chainedFetch(...responses: readonly Record<string, unknown>[]) {
  const fn = vi.fn();
  responses.forEach((r) => {
    fn.mockResolvedValueOnce(r);
  });
  return fn;
}

const AZDO_OPTS = {
  org: 'my-org',
  project: 'my-project',
  repo: 'my-repo',
  pat: 'my-pat',
};

const AZDO_PR = {
  value: [{ pullRequestId: 42, status: 'active', reviewers: [] }],
  count: 1,
};

// ─── createPullRequest ──────────────────────────────────────────────────────

describe('createPullRequest', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates a PR successfully', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ pullRequestId: 42 }),
      }),
    );

    const result = await createPullRequest({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      sourceBranch: 'feature/test',
      targetBranch: 'main',
      title: 'feat: test',
      description: 'Description',
    });

    expect(result).toEqual({
      ok: true,
      url: 'https://dev.azure.com/my-org/my-project/_git/my-repo/pullrequest/42',
      number: 42,
    });
  });

  it('returns alreadyExists on 409', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 409,
        text: () => Promise.resolve('Conflict'),
      }),
    );

    const result = await createPullRequest({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      sourceBranch: 'branch',
      targetBranch: 'main',
      title: 'title',
      description: 'body',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.alreadyExists).toBe(true);
  });

  it('returns alreadyExists on 400 with active PR message', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        text: () =>
          Promise.resolve(
            'TF401179: already has an active pull request for this source',
          ),
      }),
    );

    const result = await createPullRequest({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
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
        json: () => Promise.resolve({ pullRequestId: 1 }),
      }),
    );

    await createPullRequest({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      sourceBranch: 'feature/x',
      targetBranch: 'main',
      title: 'title',
      description: 'body',
    });

    const call = mockFetch.mock.calls[0] as unknown[];
    const init = call[1] as { body: string };
    const body = JSON.parse(init.body);
    expect(body.sourceRefName).toBe('refs/heads/feature/x');
    expect(body.targetRefName).toBe('refs/heads/main');
  });

  it('uses Basic Auth with empty username', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ pullRequestId: 1 }),
      }),
    );

    await createPullRequest({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      sourceBranch: 'branch',
      targetBranch: 'main',
      title: 'title',
      description: 'body',
    });

    const call = mockFetch.mock.calls[0] as unknown[];
    const init = call[1] as { headers: Record<string, string> };
    const authHeader = init.headers['Authorization'] ?? '';
    const decoded = Buffer.from(
      authHeader.replace('Basic ', ''),
      'base64',
    ).toString();
    expect(decoded).toBe(':my-pat');
  });

  it('includes api-version query param', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ pullRequestId: 1 }),
      }),
    );

    await createPullRequest({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      sourceBranch: 'branch',
      targetBranch: 'main',
      title: 'title',
      description: 'body',
    });

    const call = mockFetch.mock.calls[0] as unknown[];
    const url = call[0] as string;
    expect(url).toContain('api-version=7.1');
  });
});

// ─── postPrComment ──────────────────────────────────────────────────────────

describe('postPrComment', () => {
  afterEach(() => vi.restoreAllMocks());

  it('posts comment thread and returns true', async () => {
    const mockFetch = vi.fn(() => Promise.resolve({ ok: true }));

    const result = await postPrComment({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      prId: 42,
      body: 'Rework pushed.',
    });

    expect(result).toBe(true);
  });

  it('sends correct thread structure', async () => {
    const mockFetch = vi.fn(() => Promise.resolve({ ok: true }));

    await postPrComment({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      prId: 42,
      body: 'Test comment',
    });

    const call = mockFetch.mock.calls[0] as unknown[];
    const init = call[1] as { body: string };
    const body = JSON.parse(init.body);
    expect(body.comments[0].content).toBe('Test comment');
    expect(body.comments[0].parentCommentId).toBe(0);
    expect(body.comments[0].commentType).toBe(1);
    expect(body.status).toBe(1);
  });

  it('returns false on error', async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));

    const result = await postPrComment({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      prId: 42,
      body: 'comment',
    });

    expect(result).toBe(false);
  });

  it('returns false on API error', async () => {
    const mockFetch = vi.fn(() => Promise.resolve({ ok: false, status: 403 }));

    const result = await postPrComment({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      prId: 42,
      body: 'comment',
    });

    expect(result).toBe(false);
  });
});

// ─── checkPrReviewState ─────────────────────────────────────────────────────

describe('checkPrReviewState', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns changesRequested: true when inline thread exists', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(AZDO_PR) },
      {
        ok: true,
        json: () =>
          Promise.resolve({
            value: [
              {
                id: 1,
                status: 'active',
                comments: [{ content: 'Fix this', commentType: 'text' }],
                threadContext: { filePath: '/src/index.ts' },
                publishedDate: '2026-01-01T00:00:00Z',
              },
            ],
          }),
      },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      branch: 'feature/test',
    });

    expect(result?.changesRequested).toBe(true);
    expect(result?.prNumber).toBe(42);
  });

  it('returns changesRequested: true when Rework: thread exists', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(AZDO_PR) },
      {
        ok: true,
        json: () =>
          Promise.resolve({
            value: [
              {
                id: 1,
                status: 'active',
                comments: [
                  {
                    content: 'Rework: Fix the validation',
                    commentType: 'text',
                  },
                ],
                publishedDate: '2026-01-01T00:00:00Z',
              },
            ],
          }),
      },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      branch: 'feature/test',
    });

    expect(result?.changesRequested).toBe(true);
  });

  it('returns changesRequested: false for non-Rework: threads', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(AZDO_PR) },
      {
        ok: true,
        json: () =>
          Promise.resolve({
            value: [
              {
                id: 1,
                status: 'active',
                comments: [{ content: 'Nice work!', commentType: 'text' }],
                publishedDate: '2026-01-01T00:00:00Z',
              },
            ],
          }),
      },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      branch: 'feature/test',
    });

    expect(result?.changesRequested).toBe(false);
  });

  it('returns undefined when no open PR', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ value: [], count: 0 }),
    });

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      branch: 'feature/no-pr',
    });

    expect(result).toBeUndefined();
  });

  it('returns undefined on API error', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 401 });

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      branch: 'feature/test',
    });

    expect(result).toBeUndefined();
  });

  it('excludes deleted threads', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(AZDO_PR) },
      {
        ok: true,
        json: () =>
          Promise.resolve({
            value: [
              {
                id: 1,
                status: 'active',
                comments: [{ content: 'Fix this', commentType: 'text' }],
                threadContext: { filePath: '/src/a.ts' },
                isDeleted: true,
                publishedDate: '2026-01-01T00:00:00Z',
              },
            ],
          }),
      },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      branch: 'feature/test',
    });

    expect(result?.changesRequested).toBe(false);
  });

  it('excludes system threads', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(AZDO_PR) },
      {
        ok: true,
        json: () =>
          Promise.resolve({
            value: [
              {
                id: 1,
                status: 'active',
                comments: [{ content: 'Vote updated', commentType: 'system' }],
                threadContext: { filePath: '/src/a.ts' },
                publishedDate: '2026-01-01T00:00:00Z',
              },
            ],
          }),
      },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      branch: 'feature/test',
    });

    expect(result?.changesRequested).toBe(false);
  });

  it('filters by since timestamp', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(AZDO_PR) },
      {
        ok: true,
        json: () =>
          Promise.resolve({
            value: [
              {
                id: 1,
                status: 'active',
                comments: [{ content: 'Old', commentType: 'text' }],
                threadContext: { filePath: '/f.ts' },
                publishedDate: '2025-01-01T00:00:00Z',
              },
            ],
          }),
      },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      branch: 'feature/test',
      since: '2026-01-01T00:00:00Z',
    });

    expect(result?.changesRequested).toBe(false);
  });

  it('returns correct PR URL', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(AZDO_PR) },
      {
        ok: true,
        json: () => Promise.resolve({ value: [] }),
      },
    );

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      branch: 'feature/test',
    });

    expect(result?.prUrl).toBe(
      'https://dev.azure.com/my-org/my-project/_git/my-repo/pullrequest/42',
    );
  });

  it('returns undefined on network error', async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));

    const result = await checkPrReviewState({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      branch: 'feature/test',
    });

    expect(result).toBeUndefined();
  });
});

// ─── fetchPrReviewComments ──────────────────────────────────────────────────

describe('fetchPrReviewComments', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns inline comments with path prefix and Rework: content', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          value: [
            {
              id: 1,
              comments: [{ content: 'Fix this', commentType: 'text' }],
              threadContext: { filePath: '/src/a.ts' },
              publishedDate: '2026-01-01T00:00:00Z',
            },
            {
              id: 2,
              comments: [
                {
                  content: 'Rework: validation broken',
                  commentType: 'text',
                },
              ],
              publishedDate: '2026-01-01T00:00:00Z',
            },
            {
              id: 3,
              comments: [{ content: 'Looks good!', commentType: 'text' }],
              publishedDate: '2026-01-01T00:00:00Z',
            },
          ],
        }),
    });

    const result = await fetchPrReviewComments({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      prId: 42,
    });

    expect(result).toEqual(['[/src/a.ts] Fix this', 'validation broken']);
  });

  it('excludes deleted threads', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          value: [
            {
              id: 1,
              comments: [{ content: 'Fix this', commentType: 'text' }],
              threadContext: { filePath: '/src/a.ts' },
              isDeleted: true,
              publishedDate: '2026-01-01T00:00:00Z',
            },
          ],
        }),
    });

    const result = await fetchPrReviewComments({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      prId: 42,
    });

    expect(result).toEqual([]);
  });

  it('excludes system threads', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          value: [
            {
              id: 1,
              comments: [{ content: 'Vote updated', commentType: 'system' }],
              threadContext: { filePath: '/src/a.ts' },
              publishedDate: '2026-01-01T00:00:00Z',
            },
          ],
        }),
    });

    const result = await fetchPrReviewComments({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      prId: 42,
    });

    expect(result).toEqual([]);
  });

  it('returns empty on error', async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));

    const result = await fetchPrReviewComments({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      prId: 42,
    });

    expect(result).toEqual([]);
  });

  it('returns empty when threads API returns error', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const result = await fetchPrReviewComments({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      prId: 42,
    });

    expect(result).toEqual([]);
  });

  it('filters by since timestamp', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          value: [
            {
              id: 1,
              comments: [{ content: 'Old inline', commentType: 'text' }],
              threadContext: { filePath: '/src/a.ts' },
              publishedDate: '2025-01-01T00:00:00Z',
            },
            {
              id: 2,
              comments: [{ content: 'New inline', commentType: 'text' }],
              threadContext: { filePath: '/src/b.ts' },
              publishedDate: '2026-06-01T00:00:00Z',
            },
          ],
        }),
    });

    const result = await fetchPrReviewComments({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      prId: 42,
      since: '2026-01-01T00:00:00Z',
    });

    expect(result).toEqual(['[/src/b.ts] New inline']);
  });

  it('handles Rework: case-insensitively', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          value: [
            {
              id: 1,
              comments: [
                { content: 'REWORK: uppercase check', commentType: 'text' },
              ],
              publishedDate: '2026-01-01T00:00:00Z',
            },
          ],
        }),
    });

    const result = await fetchPrReviewComments({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      prId: 42,
    });

    expect(result).toEqual(['uppercase check']);
  });

  it('handles thread with no filePath in context', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          value: [
            {
              id: 1,
              comments: [{ content: 'Fix this', commentType: 'text' }],
              threadContext: {},
              publishedDate: '2026-01-01T00:00:00Z',
            },
          ],
        }),
    });

    const result = await fetchPrReviewComments({
      fetchFn: mockFetch as never,
      ...AZDO_OPTS,
      prId: 42,
    });

    expect(result).toEqual(['Fix this']);
  });
});
