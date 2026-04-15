import type { Fetcher } from '~/c/shared/http/fetch-and-parse.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { addLabel, removeLabel } from './labels.js';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Build a Jira label context with a DI fetcher. */
function makeCtx(fetcher: Fetcher) {
  return {
    baseUrl: 'https://example.atlassian.net',
    auth: 'base64auth',
    fetcher,
  };
}

describe('addLabel', () => {
  it('adds a label via read-modify-write', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      // GET labels
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ fields: { labels: ['existing'] } }), {
          status: 200,
        }),
      )
      // PUT updated labels
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await addLabel(makeCtx(mockFetch), 'PROJ-42', 'clancy:build');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const putCall = mockFetch.mock.calls[1] as [string, RequestInit];
    const putBody = JSON.parse(putCall[1].body as string) as {
      readonly fields: { readonly labels: readonly string[] };
    };
    expect(putBody.fields.labels).toEqual(['existing', 'clancy:build']);
  });

  it('skips add when label already present', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValueOnce(
      new Response(JSON.stringify({ fields: { labels: ['clancy:build'] } }), {
        status: 200,
      }),
    );

    await addLabel(makeCtx(mockFetch), 'PROJ-42', 'clancy:build');

    // Only GET, no PUT
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('skips for invalid issue key', async () => {
    const mockFetch = vi.fn<Fetcher>();

    await addLabel(makeCtx(mockFetch), 'invalid', 'label');

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not throw on network error', async () => {
    const mockFetch = vi.fn<Fetcher>().mockRejectedValue(new Error('network'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await addLabel(makeCtx(mockFetch), 'PROJ-42', 'label');
    // Should not throw
  });
});

describe('removeLabel', () => {
  it('removes a label via read-modify-write', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      // GET labels
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ fields: { labels: ['bug', 'clancy:build'] } }),
          { status: 200 },
        ),
      )
      // PUT updated labels
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await removeLabel(makeCtx(mockFetch), 'PROJ-42', 'clancy:build');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const putCall = mockFetch.mock.calls[1] as [string, RequestInit];
    const putBody = JSON.parse(putCall[1].body as string) as {
      readonly fields: { readonly labels: readonly string[] };
    };
    expect(putBody.fields.labels).toEqual(['bug']);
  });

  it('skips remove when label not present', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValueOnce(
      new Response(JSON.stringify({ fields: { labels: ['bug'] } }), {
        status: 200,
      }),
    );

    await removeLabel(makeCtx(mockFetch), 'PROJ-42', 'clancy:build');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
