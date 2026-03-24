import type { ShortcutWorkflowsResponse } from '~/c/schemas/index.js';

import { Cached } from '~/c/shared/cache/index.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchBlockerStatus, fetchChildrenStatus } from './relations.js';

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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when a blocker is not done', async () => {
    const mockFetch = vi
      .fn()
      // Story detail (blocked, with story_links)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 42,
            name: 'Blocked story',
            blocked: true,
            story_links: [
              { verb: 'is blocked by', subject_id: 42, object_id: 99 },
            ],
          }),
      } as Response)
      // Blocker story detail (not done — state 101 is "started")
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ id: 99, name: 'Blocker', workflow_state_id: 101 }),
      } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchBlockerStatus(
      'tok',
      42,
      makeCacheWithWorkflows(),
    );
    expect(result).toBe(true);
  });

  it('returns false when all blockers are done', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 42,
            name: 'Story',
            blocked: true,
            story_links: [
              { verb: 'is blocked by', subject_id: 42, object_id: 99 },
            ],
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 99,
            name: 'Done blocker',
            workflow_state_id: 102,
          }),
      } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchBlockerStatus(
      'tok',
      42,
      makeCacheWithWorkflows(),
    );
    expect(result).toBe(false);
  });

  it('returns false when story is not blocked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 42, name: 'Story', blocked: false }),
      } as Response),
    );

    const result = await fetchBlockerStatus(
      'tok',
      42,
      makeCacheWithWorkflows(),
    );
    expect(result).toBe(false);
  });

  it('returns false when no story_links', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 42,
            name: 'Story',
            blocked: true,
            story_links: [],
          }),
      } as Response),
    );

    const result = await fetchBlockerStatus(
      'tok',
      42,
      makeCacheWithWorkflows(),
    );
    expect(result).toBe(false);
  });

  it('returns false on API failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('error'),
      } as Response),
    );

    const result = await fetchBlockerStatus(
      'tok',
      42,
      makeCacheWithWorkflows(),
    );
    expect(result).toBe(false);
  });
});

// ── fetchChildrenStatus ───────────────────────────────────────────

describe('fetchChildrenStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses text search when parentKey is provided', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { id: 1, name: 'Child 1', workflow_state_id: 102 },
              { id: 2, name: 'Child 2', workflow_state_id: 100 },
            ],
          }),
      } as Response),
    );

    const result = await fetchChildrenStatus({
      token: 'tok',
      epicId: 10,
      workflowCache: makeCacheWithWorkflows(),
      parentKey: 'sc-42',
    });
    expect(result).toEqual({ total: 2, incomplete: 1 });
  });

  it('falls back to epic API when text search returns empty', async () => {
    const mockFetch = vi
      .fn()
      // Text search — empty
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      } as Response)
      // Epic stories API
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([{ id: 1, name: 'Child', workflow_state_id: 100 }]),
      } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchChildrenStatus({
      token: 'tok',
      epicId: 10,
      workflowCache: makeCacheWithWorkflows(),
      parentKey: 'sc-42',
    });
    expect(result).toEqual({ total: 1, incomplete: 1 });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('skips text search when parentKey is missing', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([{ id: 1, name: 'Child', workflow_state_id: 102 }]),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchChildrenStatus({
      token: 'tok',
      epicId: 10,
      workflowCache: makeCacheWithWorkflows(),
    });
    expect(result).toEqual({ total: 1, incomplete: 0 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns undefined on complete failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const result = await fetchChildrenStatus({
      token: 'tok',
      epicId: 10,
      workflowCache: makeCacheWithWorkflows(),
      parentKey: 'sc-42',
    });
    expect(result).toBeUndefined();
  });
});
