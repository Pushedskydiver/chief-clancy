import type { Fetcher } from '~/c/shared/http/index.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  closeIssue,
  fetchIssues,
  githubHeaders,
  isValidRepo,
  pingGitHub,
  resolveUsername,
} from './api.js';

// ── githubHeaders ──────────────────────────────────────────────────

describe('githubHeaders', () => {
  it('returns Bearer authorization with the token', () => {
    const headers = githubHeaders('tok_123');
    expect(headers.Authorization).toBe('Bearer tok_123');
  });

  it('includes GitHub JSON accept header', () => {
    const headers = githubHeaders('tok_123');
    expect(headers.Accept).toBe('application/vnd.github+json');
  });

  it('includes API version header', () => {
    const headers = githubHeaders('tok_123');
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
  });
});

// ── isValidRepo ────────────────────────────────────────────────────

describe('isValidRepo', () => {
  it('accepts owner/repo format', () => {
    expect(isValidRepo('owner/repo')).toBe(true);
  });

  it('accepts dots and hyphens', () => {
    expect(isValidRepo('my-org/my.repo')).toBe(true);
  });

  it('rejects bare repo name', () => {
    expect(isValidRepo('repo')).toBe(false);
  });

  it('rejects path traversal', () => {
    expect(isValidRepo('../etc/passwd')).toBe(false);
  });

  it('rejects spaces', () => {
    expect(isValidRepo('owner/repo name')).toBe(false);
  });
});

// ── pingGitHub ─────────────────────────────────────────────────────

describe('pingGitHub', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ok on successful response', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    } as Response);

    const result = await pingGitHub('tok_123', 'owner/repo', mockFetch);
    expect(result).toEqual({ ok: true });
  });

  it('returns auth error on 401', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
      ok: false,
      status: 401,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    } as Response);

    const result = await pingGitHub('bad_token', 'owner/repo', mockFetch);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('auth failed');
  });

  it('returns not found on 404', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
      ok: false,
      status: 404,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    } as Response);

    const result = await pingGitHub('tok_123', 'owner/missing', mockFetch);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ── resolveUsername ─────────────────────────────────────────────────

describe('resolveUsername', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns cached username without fetching', async () => {
    const cache = { get: () => 'cached-user', store: vi.fn() };
    const mockFetch = vi.fn<Fetcher>();

    const result = await resolveUsername('tok', cache, mockFetch);

    expect(result).toBe('cached-user');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches and caches the username from /user', async () => {
    const cache = { get: () => undefined, store: vi.fn() };
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(
        new Response(JSON.stringify({ login: 'octocat' }), { status: 200 }),
      );

    const result = await resolveUsername('tok', cache, mockFetch);

    expect(result).toBe('octocat');
    expect(cache.store).toHaveBeenCalledWith('octocat');
  });

  it('falls back to @me on non-OK response', async () => {
    const cache = { get: () => undefined, store: vi.fn() };
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(new Response('', { status: 401 }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await resolveUsername('bad_tok', cache, mockFetch);

    expect(result).toBe('@me');
    expect(cache.store).toHaveBeenCalledWith('@me');
  });

  it('falls back to @me on network error', async () => {
    const cache = { get: () => undefined, store: vi.fn() };
    const mockFetch = vi
      .fn<Fetcher>()
      .mockRejectedValue(new Error('ECONNREFUSED'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await resolveUsername('tok', cache, mockFetch);

    expect(result).toBe('@me');
  });

  it('falls back to @me on unexpected response shape', async () => {
    const cache = { get: () => undefined, store: vi.fn() };
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(
        new Response(JSON.stringify({ wrong: 'shape' }), { status: 200 }),
      );
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await resolveUsername('tok', cache, mockFetch);

    expect(result).toBe('@me');
  });
});

// ── fetchIssues ────────────────────────────────────────────────────

describe('fetchIssues', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns mapped tickets from API response', async () => {
    const issues = [
      {
        number: 42,
        title: 'Fix bug',
        body: 'Description here',
        milestone: { title: 'Sprint 1' },
        labels: [{ name: 'bug' }],
      },
    ];
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(new Response(JSON.stringify(issues), { status: 200 }));

    const result = await fetchIssues({
      token: 'tok',
      repo: 'owner/repo',
      fetcher: mockFetch,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      key: '#42',
      title: 'Fix bug',
      description: 'Description here',
      provider: 'github',
      milestone: 'Sprint 1',
      labels: ['bug'],
    });
  });

  it('filters out pull requests', async () => {
    const items = [
      { number: 1, title: 'Issue', body: '', labels: [] },
      {
        number: 2,
        title: 'PR',
        body: '',
        pull_request: { url: 'https://...' },
        labels: [],
      },
    ];
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(new Response(JSON.stringify(items), { status: 200 }));

    const result = await fetchIssues({
      token: 'tok',
      repo: 'owner/repo',
      fetcher: mockFetch,
    });

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('#1');
  });

  it('excludes clancy:hitl issues when excludeHitl is true', async () => {
    const items = [
      { number: 1, title: 'Normal', body: '', labels: [{ name: 'bug' }] },
      {
        number: 2,
        title: 'HITL',
        body: '',
        labels: [{ name: 'clancy:hitl' }],
      },
    ];
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(new Response(JSON.stringify(items), { status: 200 }));

    const result = await fetchIssues({
      token: 'tok',
      repo: 'owner/repo',
      excludeHitl: true,
      fetcher: mockFetch,
    });

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('#1');
  });

  it('respects limit parameter', async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      number: i + 1,
      title: `Issue ${i + 1}`,
      body: '',
      labels: [],
    }));
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(new Response(JSON.stringify(items), { status: 200 }));

    const result = await fetchIssues({
      token: 'tok',
      repo: 'owner/repo',
      limit: 2,
      fetcher: mockFetch,
    });

    expect(result).toHaveLength(2);
  });

  it('returns empty array on fetch failure', async () => {
    const mockFetch = vi.fn<Fetcher>().mockRejectedValue(new Error('network'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await fetchIssues({
      token: 'tok',
      repo: 'owner/repo',
      fetcher: mockFetch,
    });

    expect(result).toEqual([]);
  });

  it('passes label as query parameter when provided', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(new Response('[]', { status: 200 }));

    await fetchIssues({
      token: 'tok',
      repo: 'owner/repo',
      label: 'clancy:build',
      fetcher: mockFetch,
    });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('labels=clancy%3Abuild');
  });
});

// ── closeIssue ─────────────────────────────────────────────────────

describe('closeIssue', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true on successful close', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue({ ok: true } as Response);

    const result = await closeIssue({
      token: 'tok',
      repo: 'owner/repo',
      issueNumber: 42,
      fetcher: mockFetch,
    });
    expect(result).toBe(true);
  });

  it('sends PATCH with closed state', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue({ ok: true } as Response);

    await closeIssue({
      token: 'tok',
      repo: 'owner/repo',
      issueNumber: 42,
      fetcher: mockFetch,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/issues/42',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ state: 'closed' }),
      }),
    );
  });

  it('returns false for invalid repo', async () => {
    const result = await closeIssue({
      token: 'tok',
      repo: 'invalid',
      issueNumber: 42,
    });
    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    const mockFetch = vi.fn<Fetcher>().mockRejectedValue(new Error('network'));

    const result = await closeIssue({
      token: 'tok',
      repo: 'owner/repo',
      issueNumber: 42,
      fetcher: mockFetch,
    });
    expect(result).toBe(false);
  });
});
