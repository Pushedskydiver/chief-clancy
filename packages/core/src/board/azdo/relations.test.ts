import type { AzdoCtx } from './api/helpers.js';
import type { Fetcher } from '~/c/shared/http/fetch-and-parse.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchBlockerStatus, fetchChildrenStatus } from './relations.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('azdo relations', () => {
  // ─── fetchBlockerStatus ───────────────────────────────────────────────────

  describe('fetchBlockerStatus', () => {
    it('returns false when no relations', async () => {
      const mockFetch = vi.fn<Fetcher>().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 42,
            fields: { 'System.Title': 'Test' },
            relations: null,
          }),
          { status: 200 },
        ),
      );
      const ctx: AzdoCtx = {
        org: 'org',
        project: 'proj',
        pat: 'pat',
        fetcher: mockFetch,
      };

      const blocked = await fetchBlockerStatus(ctx, 42);
      expect(blocked).toBe(false);
    });

    it('returns true when predecessor is not done', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        // First call: fetch work item with dependency
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 42,
              fields: { 'System.Title': 'Test' },
              relations: [
                {
                  rel: 'System.LinkTypes.Dependency-Reverse',
                  url: 'https://dev.azure.com/org/_apis/wit/workItems/10',
                },
              ],
            }),
            { status: 200 },
          ),
        )
        // Second call: batch fetch predecessors (Active = not done)
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              value: [
                {
                  id: 10,
                  fields: {
                    'System.Title': 'Predecessor',
                    'System.State': 'Active',
                  },
                  relations: null,
                },
              ],
            }),
            { status: 200 },
          ),
        );
      const ctx: AzdoCtx = {
        org: 'org',
        project: 'proj',
        pat: 'pat',
        fetcher: mockFetch,
      };

      const blocked = await fetchBlockerStatus(ctx, 42);
      expect(blocked).toBe(true);
    });

    it('returns false when predecessor is done', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 42,
              fields: { 'System.Title': 'Test' },
              relations: [
                {
                  rel: 'System.LinkTypes.Dependency-Reverse',
                  url: 'https://dev.azure.com/org/_apis/wit/workItems/10',
                },
              ],
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              value: [
                {
                  id: 10,
                  fields: {
                    'System.Title': 'Predecessor',
                    'System.State': 'Done',
                  },
                  relations: null,
                },
              ],
            }),
            { status: 200 },
          ),
        );
      const ctx: AzdoCtx = {
        org: 'org',
        project: 'proj',
        pat: 'pat',
        fetcher: mockFetch,
      };

      const blocked = await fetchBlockerStatus(ctx, 42);
      expect(blocked).toBe(false);
    });

    it('returns false on network failure', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        .mockRejectedValue(new Error('network'));
      const ctx: AzdoCtx = {
        org: 'org',
        project: 'proj',
        pat: 'pat',
        fetcher: mockFetch,
      };

      const blocked = await fetchBlockerStatus(ctx, 42);
      expect(blocked).toBe(false);
    });

    it('returns false when work item not found', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        .mockResolvedValue(new Response('', { status: 404 }));
      const ctx: AzdoCtx = {
        org: 'org',
        project: 'proj',
        pat: 'pat',
        fetcher: mockFetch,
      };

      const blocked = await fetchBlockerStatus(ctx, 999);
      expect(blocked).toBe(false);
    });
  });

  // ─── fetchChildrenStatus ──────────────────────────────────────────────────

  describe('fetchChildrenStatus', () => {
    it('uses Epic: text convention first (mode 1)', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        // WIQL for description search
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              workItems: [{ id: 100 }, { id: 101 }],
            }),
            { status: 200 },
          ),
        )
        // Batch fetch children
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              value: [
                {
                  id: 100,
                  fields: { 'System.State': 'Done' },
                  relations: null,
                },
                {
                  id: 101,
                  fields: { 'System.State': 'Active' },
                  relations: null,
                },
              ],
            }),
            { status: 200 },
          ),
        );
      const ctx: AzdoCtx = {
        org: 'org',
        project: 'proj',
        pat: 'pat',
        fetcher: mockFetch,
      };

      const result = await fetchChildrenStatus({
        ctx,
        parentId: 50,
        parentKey: 'azdo-50',
      });
      expect(result).toEqual({ total: 2, incomplete: 1 });
    });

    it('falls back to hierarchy links when description search finds nothing', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        // WIQL for description search — empty
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ workItems: [] }), { status: 200 }),
        )
        // WIQL for link query
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              workItemRelations: [
                { source: { id: 50 }, target: { id: 200 } },
                { source: { id: 50 }, target: { id: 201 } },
              ],
            }),
            { status: 200 },
          ),
        )
        // Batch fetch children
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              value: [
                {
                  id: 200,
                  fields: { 'System.State': 'Closed' },
                  relations: null,
                },
                {
                  id: 201,
                  fields: { 'System.State': 'Closed' },
                  relations: null,
                },
              ],
            }),
            { status: 200 },
          ),
        );
      const ctx: AzdoCtx = {
        org: 'org',
        project: 'proj',
        pat: 'pat',
        fetcher: mockFetch,
      };

      const result = await fetchChildrenStatus({
        ctx,
        parentId: 50,
        parentKey: 'azdo-50',
      });
      expect(result).toEqual({ total: 2, incomplete: 0 });
    });

    it('returns undefined on failure', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        .mockRejectedValue(new Error('network'));
      const ctx: AzdoCtx = {
        org: 'org',
        project: 'proj',
        pat: 'pat',
        fetcher: mockFetch,
      };

      const result = await fetchChildrenStatus({ ctx, parentId: 50 });
      expect(result).toBeUndefined();
    });

    it('skips description search when parentKey is not provided', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        // WIQL for link query (no description search — straight to links)
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              workItemRelations: [{ source: { id: 50 }, target: { id: 300 } }],
            }),
            { status: 200 },
          ),
        )
        // Batch fetch
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              value: [
                {
                  id: 300,
                  fields: { 'System.State': 'Active' },
                  relations: null,
                },
              ],
            }),
            { status: 200 },
          ),
        );
      const ctx: AzdoCtx = {
        org: 'org',
        project: 'proj',
        pat: 'pat',
        fetcher: mockFetch,
      };

      const result = await fetchChildrenStatus({ ctx, parentId: 50 });
      expect(result).toEqual({ total: 1, incomplete: 1 });
    });
  });
});
