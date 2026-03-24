import { afterEach, describe, expect, it, vi } from 'vitest';

import { addLabel, removeLabel } from './labels.js';

const ctx = { baseUrl: 'https://example.atlassian.net', auth: 'base64auth' };

describe('addLabel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('adds a label via read-modify-write', async () => {
    const mockFetch = vi
      .fn()
      // GET labels
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ fields: { labels: ['existing'] } }), {
          status: 200,
        }),
      )
      // PUT updated labels
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', mockFetch);

    await addLabel(ctx, 'PROJ-42', 'clancy:build');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const putBody = JSON.parse(mockFetch.mock.calls[1][1].body as string);
    expect(putBody.fields.labels).toEqual(['existing', 'clancy:build']);
  });

  it('skips add when label already present', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ fields: { labels: ['clancy:build'] } }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    await addLabel(ctx, 'PROJ-42', 'clancy:build');

    // Only GET, no PUT
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('skips for invalid issue key', async () => {
    vi.stubGlobal('fetch', vi.fn());

    await addLabel(ctx, 'invalid', 'label');

    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not throw on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await addLabel(ctx, 'PROJ-42', 'label');
    // Should not throw
  });
});

describe('removeLabel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('removes a label via read-modify-write', async () => {
    const mockFetch = vi
      .fn()
      // GET labels
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ fields: { labels: ['bug', 'clancy:build'] } }),
          { status: 200 },
        ),
      )
      // PUT updated labels
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', mockFetch);

    await removeLabel(ctx, 'PROJ-42', 'clancy:build');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const putBody = JSON.parse(mockFetch.mock.calls[1][1].body as string);
    expect(putBody.fields.labels).toEqual(['bug']);
  });

  it('skips remove when label not present', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ fields: { labels: ['bug'] } }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    await removeLabel(ctx, 'PROJ-42', 'clancy:build');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
