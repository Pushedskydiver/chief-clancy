import type { AzdoCtx } from './helpers.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchTickets,
  fetchWorkItem,
  fetchWorkItems,
  pingAzdo,
  runWiql,
  updateWorkItem,
  workItemToTicket,
} from './api.js';

const baseCtx: AzdoCtx = { org: 'myorg', project: 'MyProject', pat: 'pat' };

describe('azdo api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ─── workItemToTicket ─────────────────────────────────────────────────────

  describe('workItemToTicket', () => {
    it('converts a work item to AzdoTicket', () => {
      const ticket = workItemToTicket({
        id: 42,
        fields: {
          'System.Title': 'Test item',
          'System.Description': 'Description here',
          'System.State': 'New',
          'System.Tags': 'tag1; tag2',
        },
        relations: null,
      });

      expect(ticket.key).toBe('azdo-42');
      expect(ticket.title).toBe('Test item');
      expect(ticket.description).toBe('Description here');
      expect(ticket.workItemId).toBe(42);
      expect(ticket.labels).toEqual(['tag1', 'tag2']);
      expect(ticket.parentId).toBeUndefined();
    });

    it('extracts parent from hierarchy-reverse relation', () => {
      const ticket = workItemToTicket({
        id: 50,
        fields: { 'System.Title': 'Child item' },
        relations: [
          {
            rel: 'System.LinkTypes.Hierarchy-Reverse',
            url: 'https://dev.azure.com/org/_apis/wit/workItems/10',
          },
        ],
      });

      expect(ticket.parentId).toBe(10);
    });

    it('handles missing fields gracefully', () => {
      const ticket = workItemToTicket({
        id: 1,
        fields: {},
        relations: null,
      });

      expect(ticket.title).toBe('');
      expect(ticket.description).toBe('');
      expect(ticket.labels).toEqual([]);
    });
  });

  // ─── pingAzdo ─────────────────────────────────────────────────────────────

  describe('pingAzdo', () => {
    it('returns ok true on successful response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              id: 'proj-uuid',
              name: 'P',
              state: 'wellFormed',
            }),
            { status: 200 },
          ),
        ),
      );

      const result = await pingAzdo(baseCtx);
      expect(result).toEqual({ ok: true });
    });

    it('returns error on auth failure', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('', { status: 401 })),
      );

      const result = await pingAzdo({ ...baseCtx, pat: 'bad' });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('auth failed');
    });

    it('returns error on network failure', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      );

      const result = await pingAzdo(baseCtx);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Could not reach');
    });
  });

  // ─── runWiql ──────────────────────────────────────────────────────────────

  describe('runWiql', () => {
    it('returns work item IDs from WIQL response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              workItems: [{ id: 1 }, { id: 2 }],
            }),
            { status: 200 },
          ),
        ),
      );

      const ids = await runWiql(baseCtx, 'SELECT ...');
      expect(ids).toEqual([1, 2]);
    });

    it('returns empty array on failure', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('', { status: 400 })),
      );

      const ids = await runWiql(baseCtx, 'BAD');
      expect(ids).toEqual([]);
    });

    it('returns empty array on network failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));

      const ids = await runWiql(baseCtx, 'SELECT ...');
      expect(ids).toEqual([]);
    });
  });

  // ─── fetchWorkItem ────────────────────────────────────────────────────────

  describe('fetchWorkItem', () => {
    it('returns a single work item', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              id: 42,
              fields: { 'System.Title': 'Test' },
              relations: null,
            }),
            { status: 200 },
          ),
        ),
      );

      const item = await fetchWorkItem(baseCtx, 42);
      expect(item).toBeDefined();
      expect(item?.id).toBe(42);
    });

    it('returns undefined on failure', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('', { status: 404 })),
      );

      const item = await fetchWorkItem(baseCtx, 999);
      expect(item).toBeUndefined();
    });
  });

  // ─── updateWorkItem ───────────────────────────────────────────────────────

  describe('updateWorkItem', () => {
    it('returns true on successful PATCH', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

      const result = await updateWorkItem({
        ctx: baseCtx,
        id: 42,
        patchOps: [
          { op: 'replace', path: '/fields/System.State', value: 'Active' },
        ],
      });
      expect(result).toBe(true);
    });

    it('sends JSON Patch content type', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await updateWorkItem({
        ctx: baseCtx,
        id: 42,
        patchOps: [
          { op: 'replace', path: '/fields/System.State', value: 'Active' },
        ],
      });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((options.headers as Record<string, string>)['Content-Type']).toBe(
        'application/json-patch+json',
      );
      expect(options.method).toBe('PATCH');
    });

    it('returns false on HTTP error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 400 }),
      );

      const result = await updateWorkItem({
        ctx: baseCtx,
        id: 42,
        patchOps: [],
      });
      expect(result).toBe(false);
    });

    it('returns false on network failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

      const result = await updateWorkItem({
        ctx: baseCtx,
        id: 42,
        patchOps: [],
      });
      expect(result).toBe(false);
    });
  });

  // ─── fetchWorkItems ───────────────────────────────────────────────────────

  describe('fetchWorkItems', () => {
    it('returns work items from batch response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              value: [
                {
                  id: 1,
                  fields: { 'System.Title': 'Item 1' },
                  relations: null,
                },
              ],
              count: 1,
            }),
            { status: 200 },
          ),
        ),
      );

      const items = await fetchWorkItems(baseCtx, [1]);
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(1);
    });

    it('returns empty array for empty IDs', async () => {
      const items = await fetchWorkItems(baseCtx, []);
      expect(items).toEqual([]);
    });

    it('batches requests in chunks of 200', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ value: [], count: 0 }), {
          status: 200,
        }),
      );
      vi.stubGlobal('fetch', mockFetch);

      const ids = Array.from({ length: 250 }, (_, i) => i + 1);
      await fetchWorkItems(baseCtx, ids);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ─── fetchTickets ─────────────────────────────────────────────────────────

  describe('fetchTickets', () => {
    it('returns tickets from two-step fetch', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ workItems: [{ id: 10 }, { id: 20 }] }),
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
                    'System.Title': 'Item 10',
                    'System.Description': 'Desc 10',
                    'System.Tags': 'tag1',
                  },
                  relations: null,
                },
                {
                  id: 20,
                  fields: {
                    'System.Title': 'Item 20',
                    'System.Description': 'Desc 20',
                    'System.Tags': null,
                  },
                  relations: null,
                },
              ],
            }),
            { status: 200 },
          ),
        );
      vi.stubGlobal('fetch', mockFetch);

      const tickets = await fetchTickets({
        ctx: { org: 'org', project: 'proj', pat: 'pat' },
        status: 'New',
      });

      expect(tickets).toHaveLength(2);
      expect(tickets[0].key).toBe('azdo-10');
      expect(tickets[0].labels).toEqual(['tag1']);
      expect(tickets[1].key).toBe('azdo-20');
    });

    it('filters out clancy:hitl when excludeHitl is true', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ workItems: [{ id: 10 }, { id: 20 }] }),
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
                    'System.Title': 'Normal',
                    'System.Tags': 'feature',
                  },
                  relations: null,
                },
                {
                  id: 20,
                  fields: {
                    'System.Title': 'HITL',
                    'System.Tags': 'clancy:hitl; feature',
                  },
                  relations: null,
                },
              ],
            }),
            { status: 200 },
          ),
        );
      vi.stubGlobal('fetch', mockFetch);

      const tickets = await fetchTickets({
        ctx: { org: 'org', project: 'proj', pat: 'pat' },
        status: 'New',
        excludeHitl: true,
      });

      expect(tickets).toHaveLength(1);
      expect(tickets[0].key).toBe('azdo-10');
    });

    it('filters by label when provided', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ workItems: [{ id: 10 }, { id: 20 }] }),
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
                    'System.Title': 'Match',
                    'System.Tags': 'clancy:build; feature',
                  },
                  relations: null,
                },
                {
                  id: 20,
                  fields: {
                    'System.Title': 'No match',
                    'System.Tags': 'feature',
                  },
                  relations: null,
                },
              ],
            }),
            { status: 200 },
          ),
        );
      vi.stubGlobal('fetch', mockFetch);

      const tickets = await fetchTickets({
        ctx: { org: 'org', project: 'proj', pat: 'pat' },
        status: 'New',
        label: 'clancy:build',
      });

      expect(tickets).toHaveLength(1);
      expect(tickets[0].key).toBe('azdo-10');
    });

    it('returns empty array when WIQL returns no IDs', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify({ workItems: [] }), { status: 200 }),
          ),
      );

      const tickets = await fetchTickets({
        ctx: { org: 'org', project: 'proj', pat: 'pat' },
        status: 'New',
      });
      expect(tickets).toEqual([]);
    });

    it('includes WIT filter in WIQL when provided', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ workItems: [] }), { status: 200 }),
        );
      vi.stubGlobal('fetch', mockFetch);

      await fetchTickets({
        ctx: { org: 'org', project: 'proj', pat: 'pat' },
        status: 'New',
        wit: 'User Story',
      });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as { query: string };
      expect(body.query).toContain("System.WorkItemType] = 'User Story'");
    });

    it('returns empty array for unsafe WIQL values', async () => {
      const tickets = await fetchTickets({
        ctx: { org: 'org', project: "proj'injection", pat: 'pat' },
        status: 'New',
      });
      expect(tickets).toEqual([]);
    });
  });
});
