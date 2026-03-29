import type { ShortcutWorkflowsResponse } from '~/c/schemas/index.js';

import { Cached } from '~/c/shared/cache/index.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchBlockerStatus, fetchChildrenStatus } from './relations.js';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Build a workflow cache pre-loaded with standard workflows. */
function makeCacheWithWorkflows(): Cached<ShortcutWorkflowsResponse> {
  const cache = new Cached<ShortcutWorkflowsResponse>();
  cache.store([
    {
      id: 1,
      name: 'Engineering',
      states: [
        { id: 100, name: 'Backlog', type: 'unstarted' },
        { id: 101, name: 'In Progress', type: 'started' },
        { id: 102, name: 'Done', type: 'done' },
      ],
    },
  ]);
  return cache;
}

// ── fetchBlockerStatus ────────────────────────────────────────────

describe('fetchBlockerStatus', () => {
  it('returns true when a blocker is not done', async () => {
    const mockFetch = vi
      .fn()
      // Story detail (blocked, with story_links)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 42,
            name: 'Blocked story',
            blocked: true,
            story_links: [
              { verb: 'is blocked by', subject_id: 42, object_id: 99 },
            ],
          }),
          { status: 200 },
        ),
      )
      // Blocker story detail (not done — state 101 is "started")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 99, name: 'Blocker', workflow_state_id: 101 }),
          { status: 200 },
        ),
      );

    const result = await fetchBlockerStatus({
      token: 'tok',
      storyId: 42,
      workflowCache: makeCacheWithWorkflows(),
      fetcher: mockFetch,
    });
    expect(result).toBe(true);
  });

  it('returns false when all blockers are done', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 42,
            name: 'Story',
            blocked: true,
            story_links: [
              { verb: 'is blocked by', subject_id: 42, object_id: 99 },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 99,
            name: 'Done blocker',
            workflow_state_id: 102,
          }),
          { status: 200 },
        ),
      );

    const result = await fetchBlockerStatus({
      token: 'tok',
      storyId: 42,
      workflowCache: makeCacheWithWorkflows(),
      fetcher: mockFetch,
    });
    expect(result).toBe(false);
  });

  it('returns false when story is not blocked', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: 42, name: 'Story', blocked: false }),
          { status: 200 },
        ),
      );

    const result = await fetchBlockerStatus({
      token: 'tok',
      storyId: 42,
      workflowCache: makeCacheWithWorkflows(),
      fetcher: mockFetch,
    });
    expect(result).toBe(false);
  });

  it('returns false when no story_links', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 42,
          name: 'Story',
          blocked: true,
          story_links: [],
        }),
        { status: 200 },
      ),
    );

    const result = await fetchBlockerStatus({
      token: 'tok',
      storyId: 42,
      workflowCache: makeCacheWithWorkflows(),
      fetcher: mockFetch,
    });
    expect(result).toBe(false);
  });

  it('returns false on API failure', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response('error', { status: 500 }));

    const result = await fetchBlockerStatus({
      token: 'tok',
      storyId: 42,
      workflowCache: makeCacheWithWorkflows(),
      fetcher: mockFetch,
    });
    expect(result).toBe(false);
  });
});

// ── fetchChildrenStatus ───────────────────────────────────────────

describe('fetchChildrenStatus', () => {
  it('uses text search when parentKey is provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: 1, name: 'Child 1', workflow_state_id: 102 },
            { id: 2, name: 'Child 2', workflow_state_id: 100 },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await fetchChildrenStatus({
      token: 'tok',
      epicId: 10,
      workflowCache: makeCacheWithWorkflows(),
      parentKey: 'sc-42',
      fetcher: mockFetch,
    });
    expect(result).toEqual({ total: 2, incomplete: 1 });
  });

  it('falls back to epic API when text search returns empty', async () => {
    const mockFetch = vi
      .fn()
      // Text search — empty
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), { status: 200 }),
      )
      // Epic stories API
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: 1, name: 'Child', workflow_state_id: 100 }]),
          { status: 200 },
        ),
      );

    const result = await fetchChildrenStatus({
      token: 'tok',
      epicId: 10,
      workflowCache: makeCacheWithWorkflows(),
      parentKey: 'sc-42',
      fetcher: mockFetch,
    });
    expect(result).toEqual({ total: 1, incomplete: 1 });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('skips text search when parentKey is missing', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify([{ id: 1, name: 'Child', workflow_state_id: 102 }]),
          { status: 200 },
        ),
      );

    const result = await fetchChildrenStatus({
      token: 'tok',
      epicId: 10,
      workflowCache: makeCacheWithWorkflows(),
      fetcher: mockFetch,
    });
    expect(result).toEqual({ total: 1, incomplete: 0 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns undefined on complete failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('offline'));

    const result = await fetchChildrenStatus({
      token: 'tok',
      epicId: 10,
      workflowCache: makeCacheWithWorkflows(),
      parentKey: 'sc-42',
      fetcher: mockFetch,
    });
    expect(result).toBeUndefined();
  });
});
