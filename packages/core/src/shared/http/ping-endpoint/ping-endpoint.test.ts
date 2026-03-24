import { afterEach, describe, expect, it, vi } from 'vitest';

import { pingEndpoint } from './ping-endpoint.js';

/** Create a minimal Response-like object for mocking. */
function mockResponse(status: number): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  } as Response;
}

describe('pingEndpoint', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns ok true on successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200)));

    const result = await pingEndpoint({
      url: 'https://api.example.com',
      headers: { Authorization: 'Bearer tok' },
      statusErrors: { 401: '✗ Auth failed' },
      networkError: '✗ Network error',
    });

    expect(result).toEqual({ ok: true });
  });

  it('returns mapped error message for known status codes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(401)));

    const result = await pingEndpoint({
      url: 'https://api.example.com',
      headers: { Authorization: 'Bearer tok' },
      statusErrors: { 401: '✗ Auth failed', 404: '✗ Not found' },
      networkError: '✗ Network error',
    });

    expect(result).toEqual({ ok: false, error: '✗ Auth failed' });
  });

  it('returns generic HTTP status for unmapped status codes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(500)));

    const result = await pingEndpoint({
      url: 'https://api.example.com',
      headers: {},
      statusErrors: { 401: '✗ Auth failed' },
      networkError: '✗ Network error',
    });

    expect(result).toEqual({ ok: false, error: '✗ HTTP 500' });
  });

  it('returns network error message when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    );

    const result = await pingEndpoint({
      url: 'https://api.example.com',
      headers: {},
      statusErrors: {},
      networkError: '✗ Could not reach API',
    });

    expect(result).toEqual({ ok: false, error: '✗ Could not reach API' });
  });

  it('passes an AbortSignal to fetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockResponse(200));
    vi.stubGlobal('fetch', mockFetch);

    await pingEndpoint({
      url: 'https://api.example.com',
      headers: { Authorization: 'Bearer tok' },
      statusErrors: {},
      networkError: '✗ Network error',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
