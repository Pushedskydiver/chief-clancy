import { afterEach, describe, expect, it, vi } from 'vitest';

import { addLabel, ensureLabel, removeLabel } from './labels.js';

const ctx = { token: 'tok_test', repo: 'owner/repo' };

describe('ensureLabel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does nothing when the label already exists', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: true } as Response);
    vi.stubGlobal('fetch', mockFetch);

    await ensureLabel(ctx, 'bug');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('creates the label when GET returns 404', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 201 } as Response);
    vi.stubGlobal('fetch', mockFetch);

    await ensureLabel(ctx, 'new-label');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][1]).toEqual(
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('ignores 422 on create (race condition — label already exists)', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 422 } as Response);
    vi.stubGlobal('fetch', mockFetch);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await ensureLabel(ctx, 'race-label');

    expect(warn).not.toHaveBeenCalled();
  });

  it('warns on non-404 GET error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: false, status: 500 } as Response),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await ensureLabel(ctx, 'label');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('ensureLabel GET returned HTTP 500'),
    );
  });

  it('warns on create failure (non-422)', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    vi.stubGlobal('fetch', mockFetch);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await ensureLabel(ctx, 'label');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('ensureLabel create returned HTTP 500'),
    );
  });

  it('warns on network error without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED')),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await ensureLabel(ctx, 'label');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('ensureLabel failed: ECONNREFUSED'),
    );
  });
});

describe('addLabel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends POST to the issue labels endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: true } as Response);
    vi.stubGlobal('fetch', mockFetch);

    await addLabel(ctx, 42, 'bug');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/issues/42/labels',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ labels: ['bug'] }),
      }),
    );
  });

  it('warns on non-OK response without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: false, status: 403 } as Response),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await addLabel(ctx, 42, 'label');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('addLabel returned HTTP 403'),
    );
  });

  it('warns on network error without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('timeout')));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await addLabel(ctx, 42, 'label');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('addLabel failed: timeout'),
    );
  });
});

describe('removeLabel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends DELETE to the issue label endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: true } as Response);
    vi.stubGlobal('fetch', mockFetch);

    await removeLabel(ctx, 42, 'clancy:build');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/issues/42/labels/clancy%3Abuild',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('ignores 404 (label not on issue)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: false, status: 404 } as Response),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await removeLabel(ctx, 42, 'missing');

    expect(warn).not.toHaveBeenCalled();
  });

  it('warns on non-404 error without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: false, status: 500 } as Response),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await removeLabel(ctx, 42, 'label');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('removeLabel returned HTTP 500'),
    );
  });

  it('warns on network error without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('network')));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await removeLabel(ctx, 42, 'label');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('removeLabel failed: network'),
    );
  });
});
