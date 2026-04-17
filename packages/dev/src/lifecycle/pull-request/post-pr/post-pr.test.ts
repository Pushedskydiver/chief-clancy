import { afterEach, describe, expect, it, vi } from 'vitest';

import { basicAuth, postPullRequest } from './post-pr.js';

// ─── postPullRequest ────────────────────────────────────────────────────────

/** Shorthand: builds opts with a mock fetch and sensible defaults. */
function makeOpts(overrides: Record<string, unknown> = {}) {
  return {
    fetchFn: vi.fn() as unknown as (
      u: string,
      i: RequestInit,
    ) => Promise<Response>,
    url: 'https://api.example.com/pulls',
    headers: {},
    body: {},
    parseSuccess: () => ({ url: '', number: 0 }),
    ...overrides,
  };
}

describe('postPullRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns success when response is ok', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ url: 'https://example.com/pr/1' }),
      }),
    );

    const result = await postPullRequest(
      makeOpts({
        fetchFn: mockFetch,
        headers: { Authorization: 'Bearer token' },
        body: { title: 'test', head: 'feat', base: 'main' },
        parseSuccess: (json: unknown) => {
          const data = json as { url?: string };
          return { url: data.url ?? '', number: 1 };
        },
      }),
    );

    expect(result).toEqual({
      ok: true,
      url: 'https://example.com/pr/1',
      number: 1,
    });
  });

  it('returns error with status text on failure', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Bad credentials'),
      }),
    );

    const result = await postPullRequest(makeOpts({ fetchFn: mockFetch }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('401');
      expect(result.error.message).toContain('Bad credentials');
    }
  });

  it('detects already-exists via custom check', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 422,
        text: () => Promise.resolve('A pull request already exists'),
      }),
    );

    const result = await postPullRequest(
      makeOpts({
        fetchFn: mockFetch,
        isAlreadyExists: (status: number, text: string) =>
          status === 422 && text.includes('already exists'),
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.alreadyExists).toBe(true);
    }
  });

  it('returns error on network failure', async () => {
    const mockFetch = vi.fn(() =>
      Promise.reject(new Error('Connection refused')),
    );

    const result = await postPullRequest(makeOpts({ fetchFn: mockFetch }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Connection refused');
    }
  });

  it('truncates long error text to 200 chars', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve('x'.repeat(300)),
      }),
    );

    const result = await postPullRequest(makeOpts({ fetchFn: mockFetch }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // "HTTP 500: " + 200 chars
      expect(result.error.message.length).toBeLessThanOrEqual(210);
    }
  });

  it('sends correct headers and body', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    await postPullRequest(
      makeOpts({
        fetchFn: mockFetch,
        headers: { Authorization: 'Bearer tok' },
        body: { title: 'PR title' },
      }),
    );

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/pulls', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer tok',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'PR title' }),
      signal: expect.any(AbortSignal),
    });
  });

  it('returns error when parseSuccess returns empty url and zero number', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    const result = await postPullRequest(makeOpts({ fetchFn: mockFetch }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('missing URL or number');
    }
  });

  it('returns error when parseSuccess returns truthy url but zero number', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    const result = await postPullRequest(
      makeOpts({
        fetchFn: mockFetch,
        parseSuccess: () => ({ url: 'https://example.com/pr/1', number: 0 }),
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('missing URL or number');
    }
  });

  it('returns error when parseSuccess returns truthy number but empty url', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    const result = await postPullRequest(
      makeOpts({
        fetchFn: mockFetch,
        parseSuccess: () => ({ url: '', number: 42 }),
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('missing URL or number');
    }
  });
});

// ─── basicAuth ──────────────────────────────────────────────────────────────

describe('basicAuth', () => {
  it('encodes username:token as base64', () => {
    const result = basicAuth('user', 'pass');
    const expected = `Basic ${Buffer.from('user:pass').toString('base64')}`;
    expect(result).toBe(expected);
  });
});
