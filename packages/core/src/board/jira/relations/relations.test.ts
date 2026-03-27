import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchBlockerStatus, fetchChildrenStatus } from './relations.js';

// ── fetchBlockerStatus ─────────────────────────────────────────────

describe('fetchBlockerStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns true when a blocker is unresolved', async () => {
    const response = {
      fields: {
        issuelinks: [
          {
            type: { name: 'Blocks' },
            inwardIssue: {
              key: 'PROJ-99',
              fields: { status: { statusCategory: { key: 'indeterminate' } } },
            },
          },
        ],
      },
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(response), { status: 200 }),
        ),
    );

    const result = await fetchBlockerStatus({
      baseUrl: 'https://example.atlassian.net',
      auth: 'auth',
      key: 'PROJ-42',
    });
    expect(result).toBe(true);
  });

  it('returns false when all blockers are done', async () => {
    const response = {
      fields: {
        issuelinks: [
          {
            type: { name: 'Blocks' },
            inwardIssue: {
              key: 'PROJ-99',
              fields: { status: { statusCategory: { key: 'done' } } },
            },
          },
        ],
      },
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(response), { status: 200 }),
        ),
    );

    const result = await fetchBlockerStatus({
      baseUrl: 'https://example.atlassian.net',
      auth: 'auth',
      key: 'PROJ-42',
    });
    expect(result).toBe(false);
  });

  it('returns false for invalid issue key', async () => {
    const result = await fetchBlockerStatus(
      'https://example.atlassian.net',
      'auth',
      'invalid',
    );
    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await fetchBlockerStatus({
      baseUrl: 'https://example.atlassian.net',
      auth: 'auth',
      key: 'PROJ-42',
    });
    expect(result).toBe(false);
  });
});

// ── fetchChildrenStatus ────────────────────────────────────────────

describe('fetchChildrenStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns children count from Epic text search', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        // Total query
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ total: 3 }), { status: 200 }),
        )
        // Incomplete query
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ total: 1 }), { status: 200 }),
        ),
    );

    const result = await fetchChildrenStatus({
      baseUrl: 'https://example.atlassian.net',
      auth: 'auth',
      parentKey: 'PROJ-100',
    });
    expect(result).toEqual({ total: 3, incomplete: 1 });
  });

  it('falls back to parent JQL when Epic returns 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        // Epic total → 0
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ total: 0 }), { status: 200 }),
        )
        // Parent total → 2
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ total: 2 }), { status: 200 }),
        )
        // Parent incomplete → 1
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ total: 1 }), { status: 200 }),
        ),
    );

    const result = await fetchChildrenStatus({
      baseUrl: 'https://example.atlassian.net',
      auth: 'auth',
      parentKey: 'PROJ-100',
    });
    expect(result).toEqual({ total: 2, incomplete: 1 });
  });

  it('returns undefined for invalid issue key', async () => {
    const result = await fetchChildrenStatus(
      'https://example.atlassian.net',
      'auth',
      'invalid',
    );
    expect(result).toBeUndefined();
  });

  it('returns undefined on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await fetchChildrenStatus({
      baseUrl: 'https://example.atlassian.net',
      auth: 'auth',
      parentKey: 'PROJ-100',
    });
    expect(result).toBeUndefined();
  });
});
