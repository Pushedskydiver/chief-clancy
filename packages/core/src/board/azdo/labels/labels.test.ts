import type { AzdoCtx } from '../api/index.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { addLabel, removeLabel } from './labels.js';

const ctx: AzdoCtx = { org: 'org', project: 'proj', pat: 'pat' };

describe('azdo labels', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ─── addLabel ─────────────────────────────────────────────────────────────

  describe('addLabel', () => {
    it('appends tag via JSON Patch', async () => {
      const mockFetch = vi
        .fn()
        // fetchWorkItem to get current tags
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 42,
              fields: { 'System.Tags': 'existing' },
              relations: null,
            }),
            { status: 200 },
          ),
        )
        // updateWorkItem PATCH
        .mockResolvedValueOnce({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await addLabel(ctx, 'azdo-42', 'new-tag');

      // Verify PATCH was called with updated tags
      const [, patchOptions] = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(patchOptions.body as string) as Array<{
        value: string;
      }>;
      expect(body[0].value).toBe('existing; new-tag');
    });

    it('does not duplicate existing tag', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 42,
            fields: { 'System.Tags': 'existing' },
            relations: null,
          }),
          { status: 200 },
        ),
      );
      vi.stubGlobal('fetch', mockFetch);

      await addLabel(ctx, 'azdo-42', 'existing');

      // Only 1 call (fetchWorkItem) — no PATCH needed
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('handles invalid key gracefully', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      await addLabel(ctx, 'invalid', 'tag');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles fetch failure gracefully', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

      // Should not throw
      await expect(addLabel(ctx, 'azdo-42', 'tag')).resolves.toBeUndefined();
    });
  });

  // ─── removeLabel ──────────────────────────────────────────────────────────

  describe('removeLabel', () => {
    it('removes tag via JSON Patch', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 42,
              fields: { 'System.Tags': 'keep; remove-me; also-keep' },
              relations: null,
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await removeLabel(ctx, 'azdo-42', 'remove-me');

      const [, patchOptions] = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(patchOptions.body as string) as Array<{
        value: string;
      }>;
      expect(body[0].value).toBe('keep; also-keep');
    });

    it('does nothing when tag not present', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 42,
            fields: { 'System.Tags': 'tag1; tag2' },
            relations: null,
          }),
          { status: 200 },
        ),
      );
      vi.stubGlobal('fetch', mockFetch);

      await removeLabel(ctx, 'azdo-42', 'nonexistent');

      // Only 1 call (fetchWorkItem) — no PATCH needed
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('handles invalid key gracefully', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      await removeLabel(ctx, 'invalid', 'tag');

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
