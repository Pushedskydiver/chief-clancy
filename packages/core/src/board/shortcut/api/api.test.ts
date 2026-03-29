import type { ShortcutWorkflowsResponse } from '~/c/schemas/index.js';
import type { Fetcher } from '~/c/shared/http/index.js';

import { Cached } from '~/c/shared/cache/index.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchStories,
  fetchWorkflows,
  pingShortcut,
  resolveDoneStateIds,
  resolveWorkflowStateId,
  resolveWorkflowStateIdsByType,
  shortcutHeaders,
  transitionStory,
} from './api.js';

/** Build a fresh workflow cache for each test. */
function makeCache(): Cached<ShortcutWorkflowsResponse> {
  return new Cached<ShortcutWorkflowsResponse>();
}

/** Standard workflow fixture. */
const WORKFLOWS = [
  {
    id: 1,
    name: 'Engineering',
    states: [
      { id: 100, name: 'Backlog', type: 'unstarted' },
      { id: 101, name: 'In Progress', type: 'started' },
      { id: 102, name: 'Done', type: 'done' },
    ],
  },
  {
    id: 2,
    name: 'Design',
    states: [
      { id: 200, name: 'To Do', type: 'unstarted' },
      { id: 201, name: 'Done', type: 'done' },
    ],
  },
];

// ── shortcutHeaders ───────────────────────────────────────────────

describe('shortcutHeaders', () => {
  it('returns Shortcut-Token header without Bearer prefix', () => {
    const headers = shortcutHeaders('tok_abc');
    expect(headers['Shortcut-Token']).toBe('tok_abc');
  });

  it('includes JSON content-type', () => {
    const headers = shortcutHeaders('tok_abc');
    expect(headers['Content-Type']).toBe('application/json');
  });
});

// ── pingShortcut ──────────────────────────────────────────────────

describe('pingShortcut', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ok on valid member-info response', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'user-uuid', mention_name: 'alex' }),
    } as Response);

    const result = await pingShortcut('tok', mockFetch);
    expect(result).toEqual({ ok: true });
  });

  it('falls back to /workflows when member-info fails', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 1, name: 'Eng', states: [] }]),
      } as Response);

    const result = await pingShortcut('tok', mockFetch);
    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns auth error on 401', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue({ ok: false, status: 401 } as Response);

    const result = await pingShortcut('tok', mockFetch);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('auth failed');
  });

  it('returns network error on fetch failure', async () => {
    const mockFetch = vi.fn<Fetcher>().mockRejectedValue(new Error('offline'));

    const result = await pingShortcut('tok', mockFetch);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('network');
  });
});

// ── fetchWorkflows ────────────────────────────────────────────────

describe('fetchWorkflows', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns workflows on success', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(
        new Response(JSON.stringify(WORKFLOWS), { status: 200 }),
      );

    const cache = makeCache();
    const result = await fetchWorkflows('tok', cache, mockFetch);
    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe('Engineering');
  });

  it('returns cached value on subsequent calls', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(
        new Response(JSON.stringify(WORKFLOWS), { status: 200 }),
      );

    const cache = makeCache();
    await fetchWorkflows('tok', cache, mockFetch);
    await fetchWorkflows('tok', cache, mockFetch);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns empty array on failure', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(new Response('error', { status: 500 }));

    const cache = makeCache();
    const result = await fetchWorkflows('tok', cache, mockFetch);
    expect(result).toEqual([]);
  });
});

// ── resolveWorkflowStateId ────────────────────────────────────────

describe('resolveWorkflowStateId', () => {
  it('resolves state name to ID (case-insensitive)', async () => {
    const cache = makeCache();
    cache.store(WORKFLOWS);

    const id = await resolveWorkflowStateId('in progress', {
      token: 'tok',
      cache,
    });
    expect(id).toBe(101);
  });

  it('scopes to workflow when name provided', async () => {
    const cache = makeCache();
    cache.store(WORKFLOWS);

    const id = await resolveWorkflowStateId('Done', {
      token: 'tok',
      cache,
      workflowName: 'Design',
    });
    expect(id).toBe(201);
  });

  it('returns undefined when state not found', async () => {
    const cache = makeCache();
    cache.store(WORKFLOWS);

    const id = await resolveWorkflowStateId('NonExistent', {
      token: 'tok',
      cache,
    });
    expect(id).toBeUndefined();
  });
});

// ── resolveWorkflowStateIdsByType ─────────────────────────────────

describe('resolveWorkflowStateIdsByType', () => {
  it('returns all IDs for a given type', async () => {
    const cache = makeCache();
    cache.store(WORKFLOWS);

    const ids = await resolveWorkflowStateIdsByType('unstarted', {
      token: 'tok',
      cache,
    });
    expect(ids).toEqual([100, 200]);
  });

  it('scopes to workflow when name provided', async () => {
    const cache = makeCache();
    cache.store(WORKFLOWS);

    const ids = await resolveWorkflowStateIdsByType('unstarted', {
      token: 'tok',
      cache,
      workflowName: 'Engineering',
    });
    expect(ids).toEqual([100]);
  });

  it('returns empty array when no match', async () => {
    const cache = makeCache();
    cache.store(WORKFLOWS);

    const ids = await resolveWorkflowStateIdsByType('cancelled', {
      token: 'tok',
      cache,
    });
    expect(ids).toEqual([]);
  });
});

// ── resolveDoneStateIds ───────────────────────────────────────────

describe('resolveDoneStateIds', () => {
  it('returns set of done state IDs', async () => {
    const cache = makeCache();
    cache.store(WORKFLOWS);

    const done = await resolveDoneStateIds('tok', cache);
    expect(done.has(102)).toBe(true);
    expect(done.has(201)).toBe(true);
    expect(done.has(100)).toBe(false);
  });
});

// ── fetchStories ──────────────────────────────────────────────────

describe('fetchStories', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty array when no workflow state IDs', async () => {
    const result = await fetchStories({
      token: 'tok',
      workflowStateIds: [],
    });
    expect(result).toEqual([]);
  });

  it('maps stories to ShortcutTicket shape', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              id: 42,
              name: 'Fix bug',
              description: 'A bug',
              epic_id: 10,
              labels: [{ id: 1, name: 'bug' }],
            },
          ],
        }),
    } as Response);

    const result = await fetchStories({
      token: 'tok',
      workflowStateIds: [100],
      fetcher: mockFetch,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      key: 'sc-42',
      title: 'Fix bug',
      description: 'A bug',
      provider: 'shortcut',
      storyId: 42,
      epicId: 10,
      labels: ['bug'],
    });
  });

  it('handles bare array response shape', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([{ id: 1, name: 'Story', description: null }]),
    } as Response);

    const result = await fetchStories({
      token: 'tok',
      workflowStateIds: [100],
      fetcher: mockFetch,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe('sc-1');
  });

  it('filters HITL stories when excludeHitl is true', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            { id: 1, name: 'Normal', labels: [{ id: 1, name: 'bug' }] },
            {
              id: 2,
              name: 'HITL',
              labels: [{ id: 2, name: 'clancy:hitl' }],
            },
          ],
        }),
    } as Response);

    const result = await fetchStories({
      token: 'tok',
      workflowStateIds: [100],
      excludeHitl: true,
      fetcher: mockFetch,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe('sc-1');
  });

  it('includes label filter in search body', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    } as Response);

    await fetchStories({
      token: 'tok',
      workflowStateIds: [100],
      label: 'clancy:build',
      fetcher: mockFetch,
    });

    const body = JSON.parse(
      (mockFetch.mock.calls[0]?.[1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(body.label_name).toBe('clancy:build');
  });

  it('returns empty array on API failure', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue({ ok: false, status: 500 } as Response);

    const result = await fetchStories({
      token: 'tok',
      workflowStateIds: [100],
      fetcher: mockFetch,
    });
    expect(result).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    const mockFetch = vi.fn<Fetcher>().mockRejectedValue(new Error('offline'));

    const result = await fetchStories({
      token: 'tok',
      workflowStateIds: [100],
      fetcher: mockFetch,
    });
    expect(result).toEqual([]);
  });

  it('handles null description', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [{ id: 1, name: 'Story', description: null }],
        }),
    } as Response);

    const result = await fetchStories({
      token: 'tok',
      workflowStateIds: [100],
      fetcher: mockFetch,
    });
    expect(result[0]?.description).toBe('');
  });
});

// ── transitionStory ───────────────────────────────────────────────

describe('transitionStory', () => {
  it('returns true on successful transition', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue({ ok: true } as Response);

    const result = await transitionStory({
      token: 'tok',
      storyId: 42,
      workflowStateId: 101,
      fetcher: mockFetch,
    });
    expect(result).toBe(true);
  });

  it('returns false on failure', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue({ ok: false, status: 404 } as Response);

    const result = await transitionStory({
      token: 'tok',
      storyId: 42,
      workflowStateId: 101,
      fetcher: mockFetch,
    });
    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    const mockFetch = vi.fn<Fetcher>().mockRejectedValue(new Error('offline'));

    const result = await transitionStory({
      token: 'tok',
      storyId: 42,
      workflowStateId: 101,
      fetcher: mockFetch,
    });
    expect(result).toBe(false);
  });
});
