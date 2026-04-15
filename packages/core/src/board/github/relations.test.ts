import type { Fetcher } from '~/c/shared/http/fetch-and-parse.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchBlockerStatus,
  fetchChildrenStatus,
  parseBlockerRefs,
} from './relations.js';

afterEach(() => {
  vi.restoreAllMocks();
});

// ── parseBlockerRefs ───────────────────────────────────────────────

describe('parseBlockerRefs', () => {
  it('parses Blocked by #N references', () => {
    const body = 'Blocked by #10\nBlocked by #20';
    expect(parseBlockerRefs(body, 99)).toEqual([10, 20]);
  });

  it('excludes the current issue number', () => {
    const body = 'Blocked by #10\nBlocked by #42';
    expect(parseBlockerRefs(body, 42)).toEqual([10]);
  });

  it('returns empty array when no blockers found', () => {
    expect(parseBlockerRefs('No blockers here', 1)).toEqual([]);
  });

  it('is case-insensitive', () => {
    const body = 'blocked by #5\nBLOCKED BY #6';
    expect(parseBlockerRefs(body, 99)).toEqual([5, 6]);
  });
});

// ── fetchBlockerStatus ─────────────────────────────────────────────

describe('fetchBlockerStatus', () => {
  it('returns false when no blockers in body', async () => {
    const result = await fetchBlockerStatus({
      token: 'tok',
      repo: 'owner/repo',
      issueNumber: 1,
      body: 'No blockers',
    });
    expect(result).toBe(false);
  });

  it('returns true when a blocker is still open', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(
        new Response(JSON.stringify({ state: 'open' }), { status: 200 }),
      );

    const result = await fetchBlockerStatus({
      token: 'tok',
      repo: 'owner/repo',
      issueNumber: 1,
      body: 'Blocked by #10',
      fetcher: mockFetch,
    });

    expect(result).toBe(true);
  });

  it('returns false when all blockers are closed', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(
        new Response(JSON.stringify({ state: 'closed' }), { status: 200 }),
      );

    const result = await fetchBlockerStatus({
      token: 'tok',
      repo: 'owner/repo',
      issueNumber: 1,
      body: 'Blocked by #10',
      fetcher: mockFetch,
    });

    expect(result).toBe(false);
  });

  it('returns false for invalid repo', async () => {
    const result = await fetchBlockerStatus({
      token: 'tok',
      repo: 'invalid',
      issueNumber: 1,
      body: 'Blocked by #10',
    });
    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    const mockFetch = vi.fn<Fetcher>().mockRejectedValue(new Error('network'));

    const result = await fetchBlockerStatus({
      token: 'tok',
      repo: 'owner/repo',
      issueNumber: 1,
      body: 'Blocked by #10',
      fetcher: mockFetch,
    });

    expect(result).toBe(false);
  });
});

// ── fetchChildrenStatus ────────────────────────────────────────────

describe('fetchChildrenStatus', () => {
  it('returns children count from Epic text search', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      // All children query
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total_count: 3 }), { status: 200 }),
      )
      // Open children query
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total_count: 1 }), { status: 200 }),
      );

    const result = await fetchChildrenStatus({
      token: 'tok',
      repo: 'owner/repo',
      parentNumber: 5,
      fetcher: mockFetch,
    });

    expect(result).toEqual({ total: 3, incomplete: 1 });
  });

  it('falls back to Parent text search when Epic returns 0', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      // Epic: all returns 0
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total_count: 0 }), { status: 200 }),
      )
      // Parent: all returns 2
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total_count: 2 }), { status: 200 }),
      )
      // Parent: open returns 1
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total_count: 1 }), { status: 200 }),
      );

    const result = await fetchChildrenStatus({
      token: 'tok',
      repo: 'owner/repo',
      parentNumber: 5,
      fetcher: mockFetch,
    });

    expect(result).toEqual({ total: 2, incomplete: 1 });
  });

  it('returns {1, 1} when both return 0 but currentTicketKey is set', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total_count: 0 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total_count: 0 }), { status: 200 }),
      );

    const result = await fetchChildrenStatus({
      token: 'tok',
      repo: 'owner/repo',
      parentNumber: 5,
      currentTicketKey: '#99',
      fetcher: mockFetch,
    });

    expect(result).toEqual({ total: 1, incomplete: 1 });
  });

  it('returns undefined for invalid repo', async () => {
    const result = await fetchChildrenStatus({
      token: 'tok',
      repo: 'invalid',
      parentNumber: 5,
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined on network error', async () => {
    const mockFetch = vi.fn<Fetcher>().mockRejectedValue(new Error('network'));

    const result = await fetchChildrenStatus({
      token: 'tok',
      repo: 'owner/repo',
      parentNumber: 5,
      fetcher: mockFetch,
    });

    expect(result).toBeUndefined();
  });
});
