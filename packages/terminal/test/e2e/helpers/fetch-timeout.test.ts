import { describe, expect, it, vi } from 'vitest';

import { fetchWithTimeout } from './fetch-timeout.js';

describe('fetchWithTimeout', () => {
  it('returns the response on success', async () => {
    const body = JSON.stringify({ ok: true });
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(body, { status: 200 }));

    const res = await fetchWithTimeout(
      'https://example.com/api',
      undefined,
      15_000,
      fetcher,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('forwards request init options', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 201 }));

    const headers = { Authorization: 'Bearer test' };
    await fetchWithTimeout(
      'https://example.com/api',
      { method: 'POST', headers },
      15_000,
      fetcher,
    );

    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual(headers);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('throws a descriptive error on timeout', async () => {
    const fetcher = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(
              new DOMException('The operation was aborted.', 'AbortError'),
            );
          });
        }),
    );

    await expect(
      fetchWithTimeout('https://example.com/slow', undefined, 10, fetcher),
    ).rejects.toThrow('E2E fetch timeout after 10ms');
  });

  it('re-throws non-timeout errors', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      fetchWithTimeout(
        'https://example.com/broken',
        undefined,
        15_000,
        fetcher,
      ),
    ).rejects.toThrow('Failed to fetch');
  });

  it('attaches the original error as cause on timeout', async () => {
    const fetcher = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(
              new DOMException('The operation was aborted.', 'AbortError'),
            );
          });
        }),
    );

    const err = await fetchWithTimeout(
      'https://example.com/slow',
      undefined,
      10,
      fetcher,
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).cause).toBeInstanceOf(DOMException);
  });

  it('passes an abort signal to the fetcher', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 200 }));

    await fetchWithTimeout(
      'https://example.com/api',
      undefined,
      15_000,
      fetcher,
    );

    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal?.aborted).toBe(false);
  });
});
