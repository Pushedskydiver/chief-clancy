import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchBlockerStatus,
  fetchChildrenStatus,
  lookupWorkflowStateId,
  transitionIssue,
} from './relations.js';

// ── fetchBlockerStatus ────────────────────────────────────────────

describe('fetchBlockerStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when a blocker is unresolved', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              issue: {
                relations: {
                  nodes: [
                    {
                      type: 'blockedBy',
                      relatedIssue: { state: { type: 'started' } },
                    },
                  ],
                },
              },
            },
          }),
      } as Response),
    );

    const result = await fetchBlockerStatus('key', 'issue-uuid');
    expect(result).toBe(true);
  });

  it('returns false when all blockers are completed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              issue: {
                relations: {
                  nodes: [
                    {
                      type: 'blockedBy',
                      relatedIssue: { state: { type: 'completed' } },
                    },
                  ],
                },
              },
            },
          }),
      } as Response),
    );

    const result = await fetchBlockerStatus('key', 'issue-uuid');
    expect(result).toBe(false);
  });

  it('returns false when blockers are canceled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              issue: {
                relations: {
                  nodes: [
                    {
                      type: 'blockedBy',
                      relatedIssue: { state: { type: 'canceled' } },
                    },
                  ],
                },
              },
            },
          }),
      } as Response),
    );

    const result = await fetchBlockerStatus('key', 'issue-uuid');
    expect(result).toBe(false);
  });

  it('ignores non-blockedBy relations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              issue: {
                relations: {
                  nodes: [
                    {
                      type: 'blocks',
                      relatedIssue: { state: { type: 'started' } },
                    },
                  ],
                },
              },
            },
          }),
      } as Response),
    );

    const result = await fetchBlockerStatus('key', 'issue-uuid');
    expect(result).toBe(false);
  });

  it('returns false when no relations exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { issue: { relations: { nodes: [] } } },
          }),
      } as Response),
    );

    const result = await fetchBlockerStatus('key', 'issue-uuid');
    expect(result).toBe(false);
  });

  it('returns false on API failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response),
    );

    const result = await fetchBlockerStatus('key', 'issue-uuid');
    expect(result).toBe(false);
  });
});

// ── fetchChildrenStatus ───────────────────────────────────────────

describe('fetchChildrenStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses Epic: text search when parentIdentifier is provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            issueSearch: {
              nodes: [
                { state: { type: 'completed' } },
                { state: { type: 'started' } },
              ],
            },
          },
        }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchChildrenStatus('key', 'parent-uuid', 'ENG-42');

    expect(result).toEqual({ total: 2, incomplete: 1 });

    const body = JSON.parse(
      (mockFetch.mock.calls[0]?.[1] as RequestInit).body as string,
    ) as { variables?: Record<string, unknown> };
    expect(body.variables).toHaveProperty('filter', 'Epic: ENG-42');
  });

  it('falls back to native children API when text search returns no results', async () => {
    const mockFetch = vi
      .fn()
      // First call: Epic text search — empty
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { issueSearch: { nodes: [] } },
          }),
      } as Response)
      // Second call: Native children API
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              issue: {
                children: {
                  nodes: [
                    { state: { type: 'completed' } },
                    { state: { type: 'unstarted' } },
                    { state: { type: 'unstarted' } },
                  ],
                },
              },
            },
          }),
      } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchChildrenStatus('key', 'parent-uuid', 'ENG-42');

    expect(result).toEqual({ total: 3, incomplete: 2 });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('skips text search when parentIdentifier is missing', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            issue: {
              children: {
                nodes: [{ state: { type: 'completed' } }],
              },
            },
          },
        }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchChildrenStatus('key', 'parent-uuid');

    expect(result).toEqual({ total: 1, incomplete: 0 });
    // Should only make one call (native API), not two
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns undefined on complete API failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network error')),
    );

    const result = await fetchChildrenStatus('key', 'parent-uuid', 'ENG-42');
    expect(result).toBeUndefined();
  });
});

// ── lookupWorkflowStateId ─────────────────────────────────────────

describe('lookupWorkflowStateId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns state ID when found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              workflowStates: {
                nodes: [{ id: 'state-uuid' }],
              },
            },
          }),
      } as Response),
    );

    const result = await lookupWorkflowStateId('key', 'team-1', 'In Progress');
    expect(result).toBe('state-uuid');
  });

  it('returns undefined when state not found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { workflowStates: { nodes: [] } },
          }),
      } as Response),
    );

    const result = await lookupWorkflowStateId('key', 'team-1', 'NonExistent');
    expect(result).toBeUndefined();
  });
});

// ── transitionIssue ───────────────────────────────────────────────

describe('transitionIssue', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true on successful transition', async () => {
    const mockFetch = vi
      .fn()
      // First call: lookup workflow state
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { workflowStates: { nodes: [{ id: 'state-uuid' }] } },
          }),
      } as Response)
      // Second call: issue update mutation
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { issueUpdate: { success: true } },
          }),
      } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const result = await transitionIssue({
      apiKey: 'key',
      teamId: 'team-1',
      issueId: 'issue-uuid',
      stateName: 'In Progress',
    });

    expect(result).toBe(true);
  });

  it('returns false when workflow state not found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { workflowStates: { nodes: [] } },
          }),
      } as Response),
    );

    const result = await transitionIssue({
      apiKey: 'key',
      teamId: 'team-1',
      issueId: 'issue-uuid',
      stateName: 'NonExistent',
    });

    expect(result).toBe(false);
  });

  it('returns false on mutation failure', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { workflowStates: { nodes: [{ id: 'state-uuid' }] } },
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { issueUpdate: { success: false } },
          }),
      } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const result = await transitionIssue({
      apiKey: 'key',
      teamId: 'team-1',
      issueId: 'issue-uuid',
      stateName: 'In Progress',
    });

    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const result = await transitionIssue({
      apiKey: 'key',
      teamId: 'team-1',
      issueId: 'issue-uuid',
      stateName: 'In Progress',
    });

    expect(result).toBe(false);
  });
});
