import type { Fetcher } from '~/c/shared/http/index.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { addLabel, ensureLabel, removeLabel } from './labels.js';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Build a GitHub label context with a DI fetcher. */
function makeCtx(fetcher: Fetcher) {
  return { token: 'tok_test', repo: 'owner/repo', fetcher };
}

describe('ensureLabel', () => {
  it('does nothing when the label already exists', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce({ ok: true } as Response);

    await ensureLabel(makeCtx(mockFetch), 'bug');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('creates the label when GET returns 404', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 201 } as Response);

    await ensureLabel(makeCtx(mockFetch), 'new-label');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][1]).toEqual(
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('ignores 422 on create (race condition — label already exists)', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 422 } as Response);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await ensureLabel(makeCtx(mockFetch), 'race-label');

    expect(warn).not.toHaveBeenCalled();
  });

  it('warns on non-404 GET error', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await ensureLabel(makeCtx(mockFetch), 'label');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('ensureLabel GET returned HTTP 500'),
    );
  });

  it('warns on create failure (non-422)', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await ensureLabel(makeCtx(mockFetch), 'label');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('ensureLabel create returned HTTP 500'),
    );
  });

  it('warns on network error without throwing', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await ensureLabel(makeCtx(mockFetch), 'label');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('ensureLabel failed: ECONNREFUSED'),
    );
  });
});

describe('addLabel', () => {
  it('sends POST to the issue labels endpoint', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce({ ok: true } as Response);

    await addLabel(makeCtx(mockFetch), 42, 'bug');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/issues/42/labels',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ labels: ['bug'] }),
      }),
    );
  });

  it('warns on non-OK response without throwing', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce({ ok: false, status: 403 } as Response);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await addLabel(makeCtx(mockFetch), 42, 'label');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('addLabel returned HTTP 403'),
    );
  });

  it('warns on network error without throwing', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockRejectedValueOnce(new Error('timeout'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await addLabel(makeCtx(mockFetch), 42, 'label');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('addLabel failed: timeout'),
    );
  });
});

describe('removeLabel', () => {
  it('sends DELETE to the issue label endpoint', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce({ ok: true } as Response);

    await removeLabel(makeCtx(mockFetch), 42, 'clancy:build');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/issues/42/labels/clancy%3Abuild',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('ignores 404 (label not on issue)', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await removeLabel(makeCtx(mockFetch), 42, 'missing');

    expect(warn).not.toHaveBeenCalled();
  });

  it('warns on non-404 error without throwing', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await removeLabel(makeCtx(mockFetch), 42, 'label');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('removeLabel returned HTTP 500'),
    );
  });

  it('warns on network error without throwing', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockRejectedValueOnce(new Error('network'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await removeLabel(makeCtx(mockFetch), 42, 'label');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('removeLabel failed: network'),
    );
  });
});
