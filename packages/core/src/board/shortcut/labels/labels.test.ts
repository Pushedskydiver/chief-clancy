import type { ShortcutLabelsResponse } from '~/c/schemas/index.js';
import type { Fetcher } from '~/c/shared/http/index.js';

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

afterEach(() => {
  vi.restoreAllMocks();
});

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

/** Build a Response from JSON data (for fetchAndParse compatibility). */
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status });
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
  it('returns labels on success', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue(
      jsonResponse([
        { id: 1, name: 'bug' },
        { id: 2, name: 'feature' },
      ]),
    );

    const cache = makeLabelCache();
    const labels = await fetchLabels({
      token: 'tok',
      cache,
      fetcher: mockFetch,
    });
    expect(labels).toHaveLength(2);
  });

  it('returns cached value on subsequent calls', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(jsonResponse([{ id: 1, name: 'bug' }]));

    const cache = makeLabelCache();
    await fetchLabels({ token: 'tok', cache, fetcher: mockFetch });
    await fetchLabels({ token: 'tok', cache, fetcher: mockFetch });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ── createLabel ───────────────────────────────────────────────────

describe('createLabel', () => {
  it('returns label ID on success', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(jsonResponse({ id: 99, name: 'clancy:build' }));

    const id = await createLabel('tok', 'clancy:build', mockFetch);
    expect(id).toBe(99);
  });

  it('returns undefined on failure', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(jsonResponse('error', 500));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const id = await createLabel('tok', 'test', mockFetch);
    expect(id).toBeUndefined();
  });
});

// ── getStoryLabelIds ──────────────────────────────────────────────

describe('getStoryLabelIds', () => {
  it('returns label IDs from story', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(
        jsonResponse({ id: 42, name: 'Story', label_ids: [1, 2, 3] }),
      );

    const ids = await getStoryLabelIds('tok', 42, mockFetch);
    expect(ids).toEqual([1, 2, 3]);
  });

  it('returns empty array when no label_ids', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(jsonResponse({ id: 42, name: 'Story' }));

    const ids = await getStoryLabelIds('tok', 42, mockFetch);
    expect(ids).toEqual([]);
  });

  it('returns undefined on failure', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(jsonResponse('not found', 404));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ids = await getStoryLabelIds('tok', 42, mockFetch);
    expect(ids).toBeUndefined();
  });
});

// ── updateStoryLabelIds ───────────────────────────────────────────

describe('updateStoryLabelIds', () => {
  it('sends PUT with label_ids', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue({ ok: true } as Response);

    await updateStoryLabelIds({
      token: 'tok',
      storyId: 42,
      labelIds: [1, 2, 3],
      fetcher: mockFetch,
    });

    const body = JSON.parse(
      (mockFetch.mock.calls[0]?.[1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(body.label_ids).toEqual([1, 2, 3]);
  });
});

// ── ensureLabel ───────────────────────────────────────────────────

describe('ensureLabel', () => {
  it('does not create when label exists', async () => {
    const mockFetch = vi.fn<Fetcher>();

    const cache = makeLabelCacheWith([{ id: 1, name: 'clancy:build' }]);
    await ensureLabel({
      token: 'tok',
      labelCache: cache,
      label: 'clancy:build',
      fetcher: mockFetch,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('creates label when not found', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(jsonResponse({ id: 99, name: 'clancy:build' }));

    const cache = makeLabelCacheWith([{ id: 1, name: 'bug' }]);
    await ensureLabel({
      token: 'tok',
      labelCache: cache,
      label: 'clancy:build',
      fetcher: mockFetch,
    });
    // 1 call to create + 1 call to refresh cache
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not throw on failure', async () => {
    const mockFetch = vi.fn<Fetcher>().mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const cache = makeLabelCache();
    await expect(
      ensureLabel({
        token: 'tok',
        labelCache: cache,
        label: 'test',
        fetcher: mockFetch,
      }),
    ).resolves.toBeUndefined();
  });
});

// ── addLabel ──────────────────────────────────────────────────────

describe('addLabel', () => {
  it('adds label ID to story', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      // getStoryLabelIds
      .mockResolvedValueOnce(
        jsonResponse({ id: 42, name: 'Story', label_ids: [1] }),
      )
      // updateStoryLabelIds
      .mockResolvedValueOnce({ ok: true } as Response);

    const cache = makeLabelCacheWith([
      { id: 1, name: 'bug' },
      { id: 5, name: 'clancy:build' },
    ]);

    await addLabel({
      token: 'tok',
      labelCache: cache,
      issueKey: 'sc-42',
      label: 'clancy:build',
      fetcher: mockFetch,
    });

    const body = JSON.parse(
      (mockFetch.mock.calls[1]?.[1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(body.label_ids).toEqual([1, 5]);
  });

  it('does nothing for invalid key', async () => {
    const mockFetch = vi.fn<Fetcher>();

    const cache = makeLabelCacheWith([{ id: 1, name: 'bug' }]);
    await addLabel({
      token: 'tok',
      labelCache: cache,
      issueKey: 'invalid',
      label: 'bug',
      fetcher: mockFetch,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── removeLabel ───────────────────────────────────────────────────

describe('removeLabel', () => {
  it('removes label ID from story', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(
        jsonResponse({ id: 42, name: 'Story', label_ids: [1, 5] }),
      )
      .mockResolvedValueOnce({ ok: true } as Response);

    const cache = makeLabelCacheWith([
      { id: 1, name: 'bug' },
      { id: 5, name: 'clancy:build' },
    ]);

    await removeLabel({
      token: 'tok',
      labelCache: cache,
      issueKey: 'sc-42',
      label: 'clancy:build',
      fetcher: mockFetch,
    });

    const body = JSON.parse(
      (mockFetch.mock.calls[1]?.[1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(body.label_ids).toEqual([1]);
  });

  it('skips update when label not on story', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(
        jsonResponse({ id: 42, name: 'Story', label_ids: [1] }),
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
      fetcher: mockFetch,
    });

    // Only one call (getStoryLabelIds), no update
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
