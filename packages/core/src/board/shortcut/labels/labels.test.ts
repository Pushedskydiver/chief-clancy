import type { ShortcutLabelsResponse } from '~/c/schemas/index.js';

import { Cached } from '~/c/shared/cache/index.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  addLabel,
  createLabel,
  ensureLabel,
  fetchLabels,
  getStoryLabelIds,
  parseStoryId,
  removeLabel,
  updateStoryLabelIds,
} from './labels.js';

/** Build a fresh label cache. */
function makeLabelCache(): Cached<ShortcutLabelsResponse> {
  return new Cached<ShortcutLabelsResponse>();
}

/** Pre-loaded label cache. */
function makeLabelCacheWith(
  labels: ShortcutLabelsResponse,
): Cached<ShortcutLabelsResponse> {
  const cache = new Cached<ShortcutLabelsResponse>();
  cache.store(labels);
  return cache;
}

// ── parseStoryId ──────────────────────────────────────────────────

describe('parseStoryId', () => {
  it('parses sc-123 to 123', () => {
    expect(parseStoryId('sc-123')).toBe(123);
  });

  it('returns undefined for invalid key', () => {
    expect(parseStoryId('invalid')).toBeUndefined();
  });
});

// ── fetchLabels ───────────────────────────────────────────────────

describe('fetchLabels', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns labels on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { id: 1, name: 'bug' },
            { id: 2, name: 'feature' },
          ]),
      } as Response),
    );

    const cache = makeLabelCache();
    const labels = await fetchLabels({ token: 'tok', cache });
    expect(labels).toHaveLength(2);
  });

  it('returns cached value on subsequent calls', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 1, name: 'bug' }]),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const cache = makeLabelCache();
    await fetchLabels({ token: 'tok', cache });
    await fetchLabels({ token: 'tok', cache });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ── createLabel ───────────────────────────────────────────────────

describe('createLabel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns label ID on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 99, name: 'clancy:build' }),
      } as Response),
    );

    const id = await createLabel('tok', 'clancy:build');
    expect(id).toBe(99);
  });

  it('returns undefined on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('error'),
      } as Response),
    );

    const id = await createLabel('tok', 'test');
    expect(id).toBeUndefined();
  });
});

// ── getStoryLabelIds ──────────────────────────────────────────────

describe('getStoryLabelIds', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns label IDs from story', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ id: 42, name: 'Story', label_ids: [1, 2, 3] }),
      } as Response),
    );

    const ids = await getStoryLabelIds('tok', 42);
    expect(ids).toEqual([1, 2, 3]);
  });

  it('returns empty array when no label_ids', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 42, name: 'Story' }),
      } as Response),
    );

    const ids = await getStoryLabelIds('tok', 42);
    expect(ids).toEqual([]);
  });

  it('returns undefined on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('not found'),
      } as Response),
    );

    const ids = await getStoryLabelIds('tok', 42);
    expect(ids).toBeUndefined();
  });
});

// ── updateStoryLabelIds ───────────────────────────────────────────

describe('updateStoryLabelIds', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends PUT with label_ids', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true } as Response);
    vi.stubGlobal('fetch', mockFetch);

    await updateStoryLabelIds({
      token: 'tok',
      storyId: 42,
      labelIds: [1, 2, 3],
    });

    const body = JSON.parse(
      (mockFetch.mock.calls[0]?.[1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(body.label_ids).toEqual([1, 2, 3]);
  });
});

// ── ensureLabel ───────────────────────────────────────────────────

describe('ensureLabel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not create when label exists', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const cache = makeLabelCacheWith([{ id: 1, name: 'clancy:build' }]);
    await ensureLabel({
      token: 'tok',
      labelCache: cache,
      label: 'clancy:build',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('creates label when not found', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 99, name: 'clancy:build' }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const cache = makeLabelCacheWith([{ id: 1, name: 'bug' }]);
    await ensureLabel({
      token: 'tok',
      labelCache: cache,
      label: 'clancy:build',
    });
    // 1 call to create + 1 call to refresh cache
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not throw on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const cache = makeLabelCache();
    await expect(
      ensureLabel({ token: 'tok', labelCache: cache, label: 'test' }),
    ).resolves.toBeUndefined();
  });
});

// ── addLabel ──────────────────────────────────────────────────────

describe('addLabel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds label ID to story', async () => {
    const mockFetch = vi
      .fn()
      // getStoryLabelIds
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 42, name: 'Story', label_ids: [1] }),
      } as Response)
      // updateStoryLabelIds
      .mockResolvedValueOnce({ ok: true } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const cache = makeLabelCacheWith([
      { id: 1, name: 'bug' },
      { id: 5, name: 'clancy:build' },
    ]);

    await addLabel({
      token: 'tok',
      labelCache: cache,
      issueKey: 'sc-42',
      label: 'clancy:build',
    });

    const body = JSON.parse(
      (mockFetch.mock.calls[1]?.[1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(body.label_ids).toEqual([1, 5]);
  });

  it('does nothing for invalid key', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const cache = makeLabelCacheWith([{ id: 1, name: 'bug' }]);
    await addLabel({
      token: 'tok',
      labelCache: cache,
      issueKey: 'invalid',
      label: 'bug',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── removeLabel ───────────────────────────────────────────────────

describe('removeLabel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('removes label ID from story', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ id: 42, name: 'Story', label_ids: [1, 5] }),
      } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const cache = makeLabelCacheWith([
      { id: 1, name: 'bug' },
      { id: 5, name: 'clancy:build' },
    ]);

    await removeLabel({
      token: 'tok',
      labelCache: cache,
      issueKey: 'sc-42',
      label: 'clancy:build',
    });

    const body = JSON.parse(
      (mockFetch.mock.calls[1]?.[1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(body.label_ids).toEqual([1]);
  });

  it('skips update when label not on story', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 42, name: 'Story', label_ids: [1] }),
      } as Response),
    );

    const cache = makeLabelCacheWith([
      { id: 1, name: 'bug' },
      { id: 5, name: 'clancy:build' },
    ]);

    await removeLabel({
      token: 'tok',
      labelCache: cache,
      issueKey: 'sc-42',
      label: 'clancy:build',
    });

    // Only one call (getStoryLabelIds), no update
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});
