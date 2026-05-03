import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  checkMrReviewState,
  createMergeRequest,
  fetchMrReviewComments,
  postMrNote,
  resolveDiscussions,
} from './gitlab.js';

/** Build a mock fetch that resolves a sequence of responses. */
function chainedFetch(...responses: readonly Record<string, unknown>[]) {
  const fn = vi.fn();
  responses.forEach((r) => {
    fn.mockResolvedValueOnce(r);
  });
  return fn;
}

const BASE_OPTS = {
  token: 'glpat-test',
  apiBase: 'https://gitlab.com/api/v4',
  projectPath: 'group/project',
};

const OPEN_MR = [
  { iid: 5, web_url: 'https://gitlab.com/group/project/-/merge_requests/5' },
];

// ─── createMergeRequest ─────────────────────────────────────────────────────

describe('createMergeRequest', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates an MR successfully', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            web_url: 'https://gitlab.com/group/project/-/merge_requests/5',
            iid: 5,
          }),
      }),
    );

    const result = await createMergeRequest({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      sourceBranch: 'feature/test',
      targetBranch: 'main',
      title: 'feat: test',
      description: 'Description',
    });

    expect(result).toEqual({
      ok: true,
      url: 'https://gitlab.com/group/project/-/merge_requests/5',
      number: 5,
    });
  });

  it('URL-encodes the project path', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ web_url: '', iid: 1 }),
      }),
    );

    await createMergeRequest({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      projectPath: 'group/subgroup/project',
      sourceBranch: 'branch',
      targetBranch: 'main',
      title: 'title',
      description: 'body',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('group%2Fsubgroup%2Fproject'),
      expect.any(Object),
    );
  });

  it('returns alreadyExists on 409 conflict', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 409,
        text: () => Promise.resolve('MR already exists'),
      }),
    );

    const result = await createMergeRequest({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      sourceBranch: 'branch',
      targetBranch: 'main',
      title: 'title',
      description: 'body',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.alreadyExists).toBe(true);
    }
  });

  it('sets remove_source_branch: true in request body', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ web_url: '', iid: 1 }),
      }),
    );

    await createMergeRequest({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      sourceBranch: 'branch',
      targetBranch: 'main',
      title: 'title',
      description: 'body',
    });

    const call = mockFetch.mock.calls[0] as unknown[];
    const init = call[1] as { body: string };
    const body = JSON.parse(init.body);
    expect(body.remove_source_branch).toBe(true);
  });
});

// ─── postMrNote ─────────────────────────────────────────────────────────────

describe('postMrNote', () => {
  afterEach(() => vi.restoreAllMocks());

  it('posts a note and returns true', async () => {
    const mockFetch = vi.fn(() => Promise.resolve({ ok: true }));

    const result = await postMrNote({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      mrIid: 5,
      body: 'Rework pushed.',
    });

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/notes'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ body: 'Rework pushed.' }),
      }),
    );
  });

  it('returns false on API error', async () => {
    const mockFetch = vi.fn(() => Promise.resolve({ ok: false, status: 403 }));

    const result = await postMrNote({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      mrIid: 5,
      body: 'comment',
    });

    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));

    const result = await postMrNote({
      fetchFn: mockFetch,
      ...BASE_OPTS,
      mrIid: 5,
      body: 'comment',
    });

    expect(result).toBe(false);
  });
});

// ─── resolveDiscussions ─────────────────────────────────────────────────────

describe('resolveDiscussions', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resolves all discussions and returns count', async () => {
    const mockFetch = vi.fn(() => Promise.resolve({ ok: true }));

    const count = await resolveDiscussions({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      mrIid: 5,
      discussionIds: ['d1', 'd2', 'd3'],
    });

    expect(count).toBe(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('counts only successful resolutions', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true });

    const count = await resolveDiscussions({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      mrIid: 5,
      discussionIds: ['d1', 'd2', 'd3'],
    });

    expect(count).toBe(2);
  });

  it('returns 0 for empty list', async () => {
    const mockFetch = vi.fn();

    const count = await resolveDiscussions({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      mrIid: 5,
      discussionIds: [],
    });

    expect(count).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles network errors gracefully', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('Network error'));

    const count = await resolveDiscussions({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      mrIid: 5,
      discussionIds: ['d1', 'd2'],
    });

    expect(count).toBe(1);
  });
});

// ─── checkMrReviewState ─────────────────────────────────────────────────────

describe('checkMrReviewState', () => {
  afterEach(() => vi.restoreAllMocks());

  const checkOpts = { ...BASE_OPTS, branch: 'feature/test' };

  it('returns hasChangesRequested: true when DiffNote exists', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(OPEN_MR) },
      {
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 'd1',
              notes: [
                {
                  body: 'Needs fixing',
                  type: 'DiffNote',
                  resolvable: true,
                  system: false,
                },
              ],
            },
          ]),
      },
    );

    const result = await checkMrReviewState({
      fetchFn: mockFetch as never,
      ...checkOpts,
    });

    expect(result).toEqual({
      hasChangesRequested: true,
      prNumber: 5,
      prUrl: 'https://gitlab.com/group/project/-/merge_requests/5',
    });
  });

  it('returns hasChangesRequested: true when Rework: comment exists', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(OPEN_MR) },
      {
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 'd1',
              notes: [
                {
                  body: 'Rework: Fix validation',
                  type: null,
                  resolvable: false,
                  system: false,
                },
              ],
            },
          ]),
      },
    );

    const result = await checkMrReviewState({
      fetchFn: mockFetch as never,
      ...checkOpts,
    });

    expect(result?.hasChangesRequested).toBe(true);
  });

  it('returns hasChangesRequested: false when no actionable notes', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(OPEN_MR) },
      {
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 'd1',
              notes: [
                {
                  body: 'Nice work!',
                  type: null,
                  resolvable: false,
                  system: false,
                },
              ],
            },
          ]),
      },
    );

    const result = await checkMrReviewState({
      fetchFn: mockFetch as never,
      ...checkOpts,
    });

    expect(result?.hasChangesRequested).toBe(false);
  });

  it('ignores system notes', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(OPEN_MR) },
      {
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 'd1',
              notes: [
                {
                  body: 'merged by admin',
                  type: 'DiffNote',
                  resolvable: true,
                  system: true,
                },
              ],
            },
          ]),
      },
    );

    const result = await checkMrReviewState({
      fetchFn: mockFetch as never,
      ...checkOpts,
    });

    expect(result?.hasChangesRequested).toBe(false);
  });

  it('filters notes before since timestamp', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(OPEN_MR) },
      {
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 'd1',
              notes: [
                {
                  body: 'Old inline comment',
                  type: 'DiffNote',
                  resolvable: true,
                  system: false,
                  created_at: '2026-01-01T00:00:00Z',
                },
              ],
            },
          ]),
      },
    );

    const result = await checkMrReviewState({
      fetchFn: mockFetch as never,
      ...checkOpts,
      since: '2026-03-01T00:00:00Z',
    });

    expect(result?.hasChangesRequested).toBe(false);
  });

  it('ignores resolved DiffNotes', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(OPEN_MR) },
      {
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 'd1',
              notes: [
                {
                  body: 'Fixed',
                  type: 'DiffNote',
                  resolvable: true,
                  resolved: true,
                  system: false,
                },
              ],
            },
          ]),
      },
    );

    const result = await checkMrReviewState({
      fetchFn: mockFetch as never,
      ...checkOpts,
    });

    expect(result?.hasChangesRequested).toBe(false);
  });

  it('returns undefined when no open MR', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const result = await checkMrReviewState({
      fetchFn: mockFetch as never,
      ...checkOpts,
    });

    expect(result).toBeUndefined();
  });

  it('returns undefined on API error', async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));

    const result = await checkMrReviewState({
      fetchFn: mockFetch,
      ...checkOpts,
    });

    expect(result).toBeUndefined();
  });

  it('is case-insensitive for Rework: prefix', async () => {
    const mockFetch = chainedFetch(
      { ok: true, json: () => Promise.resolve(OPEN_MR) },
      {
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 'd1',
              notes: [
                {
                  body: 'rework: lowercase',
                  type: null,
                  resolvable: false,
                  system: false,
                },
              ],
            },
          ]),
      },
    );

    const result = await checkMrReviewState({
      fetchFn: mockFetch as never,
      ...checkOpts,
    });

    expect(result?.hasChangesRequested).toBe(true);
  });
});

// ─── fetchMrReviewComments ──────────────────────────────────────────────────

describe('fetchMrReviewComments', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns inline comments with file path prefix', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 'd1',
            notes: [
              {
                body: 'Needs error handling',
                type: 'DiffNote',
                resolvable: true,
                system: false,
                position: { new_path: 'src/index.ts' },
              },
            ],
          },
        ]),
    });

    const result = await fetchMrReviewComments({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      mrIid: 5,
    });

    expect(result.comments).toEqual(['[src/index.ts] Needs error handling']);
    expect(result.discussionIds).toEqual(['d1']);
  });

  it('extracts Rework: content from conversation notes', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 'd1',
            notes: [
              {
                body: 'Rework: Fix validation',
                type: null,
                resolvable: false,
                system: false,
              },
            ],
          },
        ]),
    });

    const result = await fetchMrReviewComments({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      mrIid: 5,
    });

    expect(result.comments).toEqual(['Fix validation']);
    expect(result.discussionIds).toEqual(['d1']);
  });

  it('excludes non-Rework: conversation notes', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 'd1',
            notes: [
              {
                body: 'Nice work!',
                type: null,
                resolvable: false,
                system: false,
              },
            ],
          },
        ]),
    });

    const result = await fetchMrReviewComments({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      mrIid: 5,
    });

    expect(result.comments).toEqual([]);
    expect(result.discussionIds).toEqual([]);
  });

  it('filters system notes', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 'd1',
            notes: [
              {
                body: 'merged',
                type: 'DiffNote',
                resolvable: true,
                system: true,
              },
            ],
          },
        ]),
    });

    const result = await fetchMrReviewComments({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      mrIid: 5,
    });

    expect(result.comments).toEqual([]);
  });

  it('excludes [clancy] comments', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 'd1',
            notes: [
              {
                body: '[clancy] Rework pushed.',
                type: 'DiffNote',
                resolvable: true,
                system: false,
                position: { new_path: 'src/a.ts' },
              },
            ],
          },
          {
            id: 'd2',
            notes: [
              {
                body: 'Fix this',
                type: 'DiffNote',
                resolvable: true,
                system: false,
                position: { new_path: 'src/b.ts' },
              },
            ],
          },
        ]),
    });

    const result = await fetchMrReviewComments({
      fetchFn: mockFetch as never,
      ...BASE_OPTS,
      mrIid: 5,
    });

    expect(result.comments).toEqual(['[src/b.ts] Fix this']);
  });

  it('returns empty on error', async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));

    const result = await fetchMrReviewComments({
      fetchFn: mockFetch,
      ...BASE_OPTS,
      mrIid: 5,
    });

    expect(result).toEqual({ comments: [], discussionIds: [] });
  });
});
