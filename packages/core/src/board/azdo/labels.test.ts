import type { AzdoCtx } from './api/helpers.js';
import type { Fetcher } from '~/c/shared/http/fetch-and-parse.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { addLabel, removeLabel } from './labels.js';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Build an Azure DevOps context with a DI fetcher. */
function makeCtx(fetcher: Fetcher): AzdoCtx {
  return { org: 'org', project: 'proj', pat: 'pat', fetcher };
}

/** Build a Response from JSON data (for fetchAndParse compatibility). */
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status });
}

describe('azdo labels', () => {
  // ─── addLabel ─────────────────────────────────────────────────────────────

  describe('addLabel', () => {
    it('appends tag via JSON Patch', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        // fetchWorkItem to get current tags
        .mockResolvedValueOnce(
          jsonResponse({
            id: 42,
            fields: { 'System.Tags': 'existing' },
            relations: null,
          }),
        )
        // updateWorkItem PATCH
        .mockResolvedValueOnce({ ok: true } as Response);

      await addLabel(makeCtx(mockFetch), 'azdo-42', 'new-tag');

      // Verify PATCH was called with updated tags
      const [, patchOptions] = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(patchOptions.body as string) as Array<{
        value: string;
      }>;
      expect(body[0].value).toBe('existing; new-tag');
    });

    it('does not duplicate existing tag', async () => {
      const mockFetch = vi.fn<Fetcher>().mockResolvedValueOnce(
        jsonResponse({
          id: 42,
          fields: { 'System.Tags': 'existing' },
          relations: null,
        }),
      );

      await addLabel(makeCtx(mockFetch), 'azdo-42', 'existing');

      // Only 1 call (fetchWorkItem) — no PATCH needed
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('handles invalid key gracefully', async () => {
      const mockFetch = vi.fn<Fetcher>();

      await addLabel(makeCtx(mockFetch), 'invalid', 'tag');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles fetch failure gracefully', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        .mockRejectedValue(new Error('network'));
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should not throw
      await expect(
        addLabel(makeCtx(mockFetch), 'azdo-42', 'tag'),
      ).resolves.toBeUndefined();
    });
  });

  // ─── removeLabel ──────────────────────────────────────────────────────────

  describe('removeLabel', () => {
    it('removes tag via JSON Patch', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        .mockResolvedValueOnce(
          jsonResponse({
            id: 42,
            fields: { 'System.Tags': 'keep; remove-me; also-keep' },
            relations: null,
          }),
        )
        .mockResolvedValueOnce({ ok: true } as Response);

      await removeLabel(makeCtx(mockFetch), 'azdo-42', 'remove-me');

      const [, patchOptions] = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(patchOptions.body as string) as Array<{
        value: string;
      }>;
      expect(body[0].value).toBe('keep; also-keep');
    });

    it('does nothing when tag not present', async () => {
      const mockFetch = vi.fn<Fetcher>().mockResolvedValueOnce(
        jsonResponse({
          id: 42,
          fields: { 'System.Tags': 'tag1; tag2' },
          relations: null,
        }),
      );

      await removeLabel(makeCtx(mockFetch), 'azdo-42', 'nonexistent');

      // Only 1 call (fetchWorkItem) — no PATCH needed
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('handles invalid key gracefully', async () => {
      const mockFetch = vi.fn<Fetcher>();

      await removeLabel(makeCtx(mockFetch), 'invalid', 'tag');

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
