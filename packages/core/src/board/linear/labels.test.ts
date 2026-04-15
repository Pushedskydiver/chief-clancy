import type { Fetcher } from '~/c/shared/http/index.js';

import { CachedMap } from '~/c/shared/cache.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { addLabel, ensureLabel, removeLabel } from './labels.js';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Build a fresh label cache for each test. */
function makeCache(): CachedMap<string, string> {
  return new CachedMap<string, string>();
}

/** Build a mock Response with JSON body. */
function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(data),
  } as Response;
}

// ── ensureLabel ───────────────────────────────────────────────────

describe('ensureLabel', () => {
  it('caches label ID from team labels', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue(
      jsonResponse({
        data: {
          team: {
            labels: {
              nodes: [{ id: 'label-uuid', name: 'clancy:build' }],
            },
          },
        },
      }),
    );

    const cache = makeCache();
    await ensureLabel({
      apiKey: 'key',
      teamId: 'team-1',
      labelCache: cache,
      label: 'clancy:build',
      fetcher: mockFetch,
    });

    expect(cache.get('clancy:build')).toBe('label-uuid');
  });

  it('falls back to workspace labels when not in team', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      // Team query — no match
      .mockResolvedValueOnce(
        jsonResponse({
          data: { team: { labels: { nodes: [] } } },
        }),
      )
      // Workspace query — match
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            issueLabels: {
              nodes: [{ id: 'ws-label-uuid', name: 'clancy:build' }],
            },
          },
        }),
      );

    const cache = makeCache();
    await ensureLabel({
      apiKey: 'key',
      teamId: 'team-1',
      labelCache: cache,
      label: 'clancy:build',
      fetcher: mockFetch,
    });

    expect(cache.get('clancy:build')).toBe('ws-label-uuid');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('creates a new label when not found anywhere', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      // Team query — empty
      .mockResolvedValueOnce(
        jsonResponse({
          data: { team: { labels: { nodes: [] } } },
        }),
      )
      // Workspace query — empty
      .mockResolvedValueOnce(
        jsonResponse({
          data: { issueLabels: { nodes: [] } },
        }),
      )
      // Create mutation — success
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            issueLabelCreate: {
              issueLabel: { id: 'new-label-uuid' },
              success: true,
            },
          },
        }),
      );

    const cache = makeCache();
    await ensureLabel({
      apiKey: 'key',
      teamId: 'team-1',
      labelCache: cache,
      label: 'clancy:build',
      fetcher: mockFetch,
    });

    expect(cache.get('clancy:build')).toBe('new-label-uuid');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('skips API calls when label is already cached', async () => {
    const mockFetch = vi.fn<Fetcher>();

    const cache = makeCache();
    cache.store('clancy:build', 'cached-uuid');

    await ensureLabel({
      apiKey: 'key',
      teamId: 'team-1',
      labelCache: cache,
      label: 'clancy:build',
      fetcher: mockFetch,
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not throw on API failure', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockRejectedValue(new Error('network error'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const cache = makeCache();
    await expect(
      ensureLabel({
        apiKey: 'key',
        teamId: 'team-1',
        labelCache: cache,
        label: 'clancy:build',
        fetcher: mockFetch,
      }),
    ).resolves.toBeUndefined();
  });
});

// ── addLabel ──────────────────────────────────────────────────────

describe('addLabel', () => {
  it('adds label ID to issue label list', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      // Issue lookup
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            issueSearch: {
              nodes: [
                {
                  id: 'issue-uuid',
                  labels: { nodes: [{ id: 'existing-label' }] },
                },
              ],
            },
          },
        }),
      )
      // Issue update mutation
      .mockResolvedValueOnce(
        jsonResponse({ data: { issueUpdate: { success: true } } }),
      );

    const cache = makeCache();
    cache.store('clancy:build', 'new-label-uuid');

    await addLabel({
      apiKey: 'key',
      labelCache: cache,
      issueKey: 'ENG-42',
      label: 'clancy:build',
      fetcher: mockFetch,
    });

    // Verify the update mutation includes both existing and new label
    const updateBody = JSON.parse(
      (mockFetch.mock.calls[1]?.[1] as RequestInit).body as string,
    ) as { variables?: { labelIds?: string[] } };
    expect(updateBody.variables?.labelIds).toEqual([
      'existing-label',
      'new-label-uuid',
    ]);
  });

  it('skips update when label is already on the issue', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue(
      jsonResponse({
        data: {
          issueSearch: {
            nodes: [
              {
                id: 'issue-uuid',
                labels: { nodes: [{ id: 'label-uuid' }] },
              },
            ],
          },
        },
      }),
    );

    const cache = makeCache();
    cache.store('clancy:build', 'label-uuid');

    await addLabel({
      apiKey: 'key',
      labelCache: cache,
      issueKey: 'ENG-42',
      label: 'clancy:build',
      fetcher: mockFetch,
    });

    // Only one call (issue lookup), no update mutation
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does nothing when label ID is not cached', async () => {
    const mockFetch = vi.fn<Fetcher>();

    const cache = makeCache();

    await addLabel({
      apiKey: 'key',
      labelCache: cache,
      issueKey: 'ENG-42',
      label: 'unknown-label',
      fetcher: mockFetch,
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not throw on failure', async () => {
    const mockFetch = vi.fn<Fetcher>().mockRejectedValue(new Error('network'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const cache = makeCache();
    cache.store('clancy:build', 'label-uuid');

    await expect(
      addLabel({
        apiKey: 'key',
        labelCache: cache,
        issueKey: 'ENG-42',
        label: 'clancy:build',
        fetcher: mockFetch,
      }),
    ).resolves.toBeUndefined();
  });
});

// ── removeLabel ───────────────────────────────────────────────────

describe('removeLabel', () => {
  it('removes label ID from issue label list', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      // Issue lookup
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            issueSearch: {
              nodes: [
                {
                  id: 'issue-uuid',
                  labels: {
                    nodes: [
                      { id: 'keep-label', name: 'bug' },
                      { id: 'remove-label', name: 'clancy:build' },
                    ],
                  },
                },
              ],
            },
          },
        }),
      )
      // Issue update mutation
      .mockResolvedValueOnce(
        jsonResponse({ data: { issueUpdate: { success: true } } }),
      );

    const cache = makeCache();
    cache.store('clancy:build', 'remove-label');

    await removeLabel({
      apiKey: 'key',
      labelCache: cache,
      issueKey: 'ENG-42',
      label: 'clancy:build',
      fetcher: mockFetch,
    });

    const updateBody = JSON.parse(
      (mockFetch.mock.calls[1]?.[1] as RequestInit).body as string,
    ) as { variables?: { labelIds?: string[] } };
    expect(updateBody.variables?.labelIds).toEqual(['keep-label']);
  });

  it('finds label by name when not cached', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            issueSearch: {
              nodes: [
                {
                  id: 'issue-uuid',
                  labels: {
                    nodes: [{ id: 'target-id', name: 'clancy:build' }],
                  },
                },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { issueUpdate: { success: true } } }),
      );

    const cache = makeCache();

    await removeLabel({
      apiKey: 'key',
      labelCache: cache,
      issueKey: 'ENG-42',
      label: 'clancy:build',
      fetcher: mockFetch,
    });

    const updateBody = JSON.parse(
      (mockFetch.mock.calls[1]?.[1] as RequestInit).body as string,
    ) as { variables?: { labelIds?: string[] } };
    expect(updateBody.variables?.labelIds).toEqual([]);
  });

  it('skips update when label is not on the issue', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue(
      jsonResponse({
        data: {
          issueSearch: {
            nodes: [
              {
                id: 'issue-uuid',
                labels: {
                  nodes: [{ id: 'other-label', name: 'bug' }],
                },
              },
            ],
          },
        },
      }),
    );

    const cache = makeCache();
    cache.store('clancy:build', 'not-on-issue');

    await removeLabel({
      apiKey: 'key',
      labelCache: cache,
      issueKey: 'ENG-42',
      label: 'clancy:build',
      fetcher: mockFetch,
    });

    // Only one call (issue lookup), no update
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not throw on failure', async () => {
    const mockFetch = vi.fn<Fetcher>().mockRejectedValue(new Error('network'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const cache = makeCache();

    await expect(
      removeLabel({
        apiKey: 'key',
        labelCache: cache,
        issueKey: 'ENG-42',
        label: 'clancy:build',
        fetcher: mockFetch,
      }),
    ).resolves.toBeUndefined();
  });
});
