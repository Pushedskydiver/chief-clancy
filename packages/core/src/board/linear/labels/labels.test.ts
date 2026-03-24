import { afterEach, describe, expect, it, vi } from 'vitest';

import { CachedMap } from '../../../shared/cache/index.js';
import { addLabel, ensureLabel, removeLabel } from './labels.js';

/** Build a fresh label cache for each test. */
function makeCache(): CachedMap<string, string> {
  return new CachedMap<string, string>();
}

// ── ensureLabel ───────────────────────────────────────────────────

describe('ensureLabel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('caches label ID from team labels', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              team: {
                labels: {
                  nodes: [{ id: 'label-uuid', name: 'clancy:build' }],
                },
              },
            },
          }),
      } as Response),
    );

    const cache = makeCache();
    await ensureLabel({
      apiKey: 'key',
      teamId: 'team-1',
      labelCache: cache,
      label: 'clancy:build',
    });

    expect(cache.get('clancy:build')).toBe('label-uuid');
  });

  it('falls back to workspace labels when not in team', async () => {
    const mockFetch = vi
      .fn()
      // Team query — no match
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { team: { labels: { nodes: [] } } },
          }),
      } as Response)
      // Workspace query — match
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              issueLabels: {
                nodes: [{ id: 'ws-label-uuid', name: 'clancy:build' }],
              },
            },
          }),
      } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const cache = makeCache();
    await ensureLabel({
      apiKey: 'key',
      teamId: 'team-1',
      labelCache: cache,
      label: 'clancy:build',
    });

    expect(cache.get('clancy:build')).toBe('ws-label-uuid');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('creates a new label when not found anywhere', async () => {
    const mockFetch = vi
      .fn()
      // Team query — empty
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { team: { labels: { nodes: [] } } },
          }),
      } as Response)
      // Workspace query — empty
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { issueLabels: { nodes: [] } },
          }),
      } as Response)
      // Create mutation — success
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              issueLabelCreate: {
                issueLabel: { id: 'new-label-uuid' },
                success: true,
              },
            },
          }),
      } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const cache = makeCache();
    await ensureLabel({
      apiKey: 'key',
      teamId: 'team-1',
      labelCache: cache,
      label: 'clancy:build',
    });

    expect(cache.get('clancy:build')).toBe('new-label-uuid');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('skips API calls when label is already cached', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const cache = makeCache();
    cache.store('clancy:build', 'cached-uuid');

    await ensureLabel({
      apiKey: 'key',
      teamId: 'team-1',
      labelCache: cache,
      label: 'clancy:build',
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not throw on API failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network error')),
    );

    const cache = makeCache();
    await expect(
      ensureLabel({
        apiKey: 'key',
        teamId: 'team-1',
        labelCache: cache,
        label: 'clancy:build',
      }),
    ).resolves.toBeUndefined();
  });
});

// ── addLabel ──────────────────────────────────────────────────────

describe('addLabel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds label ID to issue label list', async () => {
    const mockFetch = vi
      .fn()
      // Issue lookup
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
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
      } as Response)
      // Issue update mutation
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ data: { issueUpdate: { success: true } } }),
      } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const cache = makeCache();
    cache.store('clancy:build', 'new-label-uuid');

    await addLabel({
      apiKey: 'key',
      labelCache: cache,
      issueKey: 'ENG-42',
      label: 'clancy:build',
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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
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
      } as Response),
    );

    const cache = makeCache();
    cache.store('clancy:build', 'label-uuid');

    await addLabel({
      apiKey: 'key',
      labelCache: cache,
      issueKey: 'ENG-42',
      label: 'clancy:build',
    });

    // Only one call (issue lookup), no update mutation
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('does nothing when label ID is not cached', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const cache = makeCache();

    await addLabel({
      apiKey: 'key',
      labelCache: cache,
      issueKey: 'ENG-42',
      label: 'unknown-label',
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not throw on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const cache = makeCache();
    cache.store('clancy:build', 'label-uuid');

    await expect(
      addLabel({
        apiKey: 'key',
        labelCache: cache,
        issueKey: 'ENG-42',
        label: 'clancy:build',
      }),
    ).resolves.toBeUndefined();
  });
});

// ── removeLabel ───────────────────────────────────────────────────

describe('removeLabel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('removes label ID from issue label list', async () => {
    const mockFetch = vi
      .fn()
      // Issue lookup
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
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
      } as Response)
      // Issue update mutation
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ data: { issueUpdate: { success: true } } }),
      } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const cache = makeCache();
    cache.store('clancy:build', 'remove-label');

    await removeLabel({
      apiKey: 'key',
      labelCache: cache,
      issueKey: 'ENG-42',
      label: 'clancy:build',
    });

    const updateBody = JSON.parse(
      (mockFetch.mock.calls[1]?.[1] as RequestInit).body as string,
    ) as { variables?: { labelIds?: string[] } };
    expect(updateBody.variables?.labelIds).toEqual(['keep-label']);
  });

  it('finds label by name when not cached', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
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
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ data: { issueUpdate: { success: true } } }),
      } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const cache = makeCache();

    await removeLabel({
      apiKey: 'key',
      labelCache: cache,
      issueKey: 'ENG-42',
      label: 'clancy:build',
    });

    const updateBody = JSON.parse(
      (mockFetch.mock.calls[1]?.[1] as RequestInit).body as string,
    ) as { variables?: { labelIds?: string[] } };
    expect(updateBody.variables?.labelIds).toEqual([]);
  });

  it('skips update when label is not on the issue', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
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
      } as Response),
    );

    const cache = makeCache();
    cache.store('clancy:build', 'not-on-issue');

    await removeLabel({
      apiKey: 'key',
      labelCache: cache,
      issueKey: 'ENG-42',
      label: 'clancy:build',
    });

    // Only one call (issue lookup), no update
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('does not throw on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const cache = makeCache();

    await expect(
      removeLabel({
        apiKey: 'key',
        labelCache: cache,
        issueKey: 'ENG-42',
        label: 'clancy:build',
      }),
    ).resolves.toBeUndefined();
  });
});
