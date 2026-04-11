import type { AzdoEnv } from '~/c/schemas/index.js';
import type { Fetcher } from '~/c/shared/http/index.js';
import type { FetchedTicket } from '~/c/types/index.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAzdoBoard } from './azdo-board.js';

const baseEnv: AzdoEnv = {
  AZDO_ORG: 'myorg',
  AZDO_PROJECT: 'MyProject',
  AZDO_PAT: 'test-pat',
};

describe('createAzdoBoard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Interface check ────────────────────────────────────────────────────

  it('returns an object with all Board methods', () => {
    const board = createAzdoBoard(baseEnv);

    expect(typeof board.ping).toBe('function');
    expect(typeof board.validateInputs).toBe('function');
    expect(typeof board.fetchTicket).toBe('function');
    expect(typeof board.fetchTickets).toBe('function');
    expect(typeof board.fetchBlockerStatus).toBe('function');
    expect(typeof board.fetchChildrenStatus).toBe('function');
    expect(typeof board.transitionTicket).toBe('function');
    expect(typeof board.ensureLabel).toBe('function');
    expect(typeof board.addLabel).toBe('function');
    expect(typeof board.removeLabel).toBe('function');
    expect(typeof board.sharedEnv).toBe('function');
  });

  // ─── validateInputs ─────────────────────────────────────────────────────

  describe('validateInputs', () => {
    it('returns undefined for valid inputs', () => {
      const board = createAzdoBoard(baseEnv);
      expect(board.validateInputs()).toBeUndefined();
    });

    it('returns error when AZDO_ORG is empty', () => {
      const board = createAzdoBoard({ ...baseEnv, AZDO_ORG: '  ' });
      expect(board.validateInputs()).toContain('AZDO_ORG');
    });

    it('returns error when AZDO_PROJECT is empty', () => {
      const board = createAzdoBoard({ ...baseEnv, AZDO_PROJECT: '  ' });
      expect(board.validateInputs()).toContain('AZDO_PROJECT');
    });

    it('returns error when AZDO_PAT is empty', () => {
      const board = createAzdoBoard({ ...baseEnv, AZDO_PAT: '  ' });
      expect(board.validateInputs()).toContain('AZDO_PAT');
    });

    it('returns error when AZDO_PROJECT has unsafe WIQL chars', () => {
      const board = createAzdoBoard({
        ...baseEnv,
        AZDO_PROJECT: "test'injection",
      });
      expect(board.validateInputs()).toContain('AZDO_PROJECT');
    });

    it('returns error when CLANCY_AZDO_STATUS has unsafe WIQL chars', () => {
      const board = createAzdoBoard({
        ...baseEnv,
        CLANCY_AZDO_STATUS: "bad'status",
      });
      expect(board.validateInputs()).toContain('CLANCY_AZDO_STATUS');
    });

    it('returns error when CLANCY_AZDO_WIT has unsafe WIQL chars', () => {
      const board = createAzdoBoard({
        ...baseEnv,
        CLANCY_AZDO_WIT: "bad'wit",
      });
      expect(board.validateInputs()).toContain('CLANCY_AZDO_WIT');
    });
  });

  // ─── sharedEnv ──────────────────────────────────────────────────────────

  it('sharedEnv returns the env object', () => {
    const board = createAzdoBoard(baseEnv);
    expect(board.sharedEnv()).toBe(baseEnv);
  });

  // ─── ping ───────────────────────────────────────────────────────────────

  describe('ping', () => {
    it('delegates to pingAzdo', async () => {
      const mockFetch = vi.fn<Fetcher>().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'proj-uuid',
            name: 'P',
            state: 'wellFormed',
          }),
          { status: 200 },
        ),
      );

      const board = createAzdoBoard(baseEnv, mockFetch);
      const result = await board.ping();
      expect(result.ok).toBe(true);
    });
  });

  // ─── fetchTickets ───────────────────────────────────────────────────────

  describe('fetchTickets', () => {
    it('returns normalised FetchedTickets', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        // WIQL response
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ workItems: [{ id: 42 }] }), {
            status: 200,
          }),
        )
        // Batch fetch response
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              value: [
                {
                  id: 42,
                  fields: {
                    'System.Title': 'Test item',
                    'System.Description': 'Desc',
                    'System.Tags': 'tag1',
                  },
                  relations: [
                    {
                      rel: 'System.LinkTypes.Hierarchy-Reverse',
                      url: 'https://dev.azure.com/org/_apis/wit/workItems/10',
                    },
                  ],
                },
              ],
            }),
            { status: 200 },
          ),
        );

      const board = createAzdoBoard(baseEnv, mockFetch);
      const tickets = await board.fetchTickets({});

      expect(tickets).toHaveLength(1);
      expect(tickets[0].key).toBe('azdo-42');
      expect(tickets[0].title).toBe('Test item');
      expect(tickets[0].parentInfo).toBe('azdo-10');
      expect(tickets[0].blockers).toBe('None');
      expect(tickets[0].issueId).toBe('42');
      expect(tickets[0].labels).toEqual(['tag1']);
      expect(tickets[0].status).toBe('New');
    });

    it('sets parentInfo to none when no parent', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ workItems: [{ id: 42 }] }), {
            status: 200,
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              value: [
                {
                  id: 42,
                  fields: { 'System.Title': 'Test' },
                  relations: null,
                },
              ],
            }),
            { status: 200 },
          ),
        );

      const board = createAzdoBoard(baseEnv, mockFetch);
      const tickets = await board.fetchTickets({});
      expect(tickets[0].parentInfo).toBe('none');
    });

    it('uses custom status from CLANCY_AZDO_STATUS', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        .mockResolvedValue(
          new Response(JSON.stringify({ workItems: [] }), { status: 200 }),
        );

      const board = createAzdoBoard(
        {
          ...baseEnv,
          CLANCY_AZDO_STATUS: 'Active',
        },
        mockFetch,
      );
      await board.fetchTickets({});

      // Verify WIQL contains Active status
      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as { query: string };
      expect(body.query).toContain("System.State] = 'Active'");
    });

    it('respects limit parameter', async () => {
      const ids = Array.from({ length: 5 }, (_, i) => ({ id: i + 1 }));
      const items = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        fields: { 'System.Title': `Item ${i + 1}` },
        relations: null,
      }));

      const mockFetch = vi
        .fn<Fetcher>()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ workItems: ids }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ value: items }), { status: 200 }),
        );

      const board = createAzdoBoard(baseEnv, mockFetch);
      const tickets = await board.fetchTickets({ limit: 2 });

      expect(tickets).toHaveLength(2);
    });
  });

  // ─── fetchTicket ────────────────────────────────────────────────────────

  describe('fetchTicket', () => {
    it('returns the first ticket from fetchTickets', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ workItems: [{ id: 1 }, { id: 2 }] }), {
            status: 200,
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              value: [
                {
                  id: 1,
                  fields: { 'System.Title': 'First' },
                  relations: null,
                },
                {
                  id: 2,
                  fields: { 'System.Title': 'Second' },
                  relations: null,
                },
              ],
            }),
            { status: 200 },
          ),
        );

      const board = createAzdoBoard(baseEnv, mockFetch);
      const ticket = await board.fetchTicket({});

      expect(ticket).toBeDefined();
      expect(ticket?.key).toBe('azdo-1');
    });

    it('returns undefined when no tickets', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        .mockResolvedValue(
          new Response(JSON.stringify({ workItems: [] }), { status: 200 }),
        );

      const board = createAzdoBoard(baseEnv, mockFetch);
      const ticket = await board.fetchTicket({});
      expect(ticket).toBeUndefined();
    });
  });

  // ─── fetchBlockerStatus ─────────────────────────────────────────────────

  describe('fetchBlockerStatus', () => {
    it('delegates to fetchBlockerStatus with parsed ID', async () => {
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

      const board = createAzdoBoard(baseEnv, mockFetch);
      const ticket: FetchedTicket = {
        key: 'azdo-42',
        title: 'Test',
        description: '',
        parentInfo: 'none',
        blockers: 'None',
      };

      const blocked = await board.fetchBlockerStatus(ticket);
      expect(blocked).toBe(false);
    });

    it('returns false for invalid key', async () => {
      const board = createAzdoBoard(baseEnv);
      const ticket: FetchedTicket = {
        key: 'invalid',
        title: 'Test',
        description: '',
        parentInfo: 'none',
        blockers: 'None',
      };

      const blocked = await board.fetchBlockerStatus(ticket);
      expect(blocked).toBe(false);
    });
  });

  // ─── fetchChildrenStatus ────────────────────────────────────────────────

  describe('fetchChildrenStatus', () => {
    it('returns undefined for invalid parentId', async () => {
      const board = createAzdoBoard(baseEnv);
      const result = await board.fetchChildrenStatus('azdo-50', 'invalid');
      expect(result).toBeUndefined();
    });

    it('extracts ID from parentKey when parentId not provided', async () => {
      const board = createAzdoBoard(baseEnv);
      const result = await board.fetchChildrenStatus('azdo-invalid');
      expect(result).toBeUndefined();
    });
  });

  // ─── transitionTicket ───────────────────────────────────────────────────

  describe('transitionTicket', () => {
    it('updates System.State via JSON Patch', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        .mockResolvedValue({ ok: true } as Response);

      const board = createAzdoBoard(baseEnv, mockFetch);
      const ticket: FetchedTicket = {
        key: 'azdo-42',
        title: 'Test',
        description: '',
        parentInfo: 'none',
        blockers: 'None',
      };

      const result = await board.transitionTicket(ticket, 'Active');
      expect(result).toBe(true);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as Array<{
        path: string;
        value: string;
      }>;
      expect(body[0].path).toBe('/fields/System.State');
      expect(body[0].value).toBe('Active');
    });

    it('returns false for invalid key', async () => {
      const board = createAzdoBoard(baseEnv);
      const ticket: FetchedTicket = {
        key: 'invalid',
        title: 'Test',
        description: '',
        parentInfo: 'none',
        blockers: 'None',
      };

      const result = await board.transitionTicket(ticket, 'Active');
      expect(result).toBe(false);
    });
  });

  // ─── ensureLabel ────────────────────────────────────────────────────────

  describe('ensureLabel', () => {
    it('is a no-op (Azure DevOps tags auto-create)', async () => {
      const board = createAzdoBoard(baseEnv);
      await expect(board.ensureLabel('test-label')).resolves.toBeUndefined();
    });
  });

  // ─── addLabel / removeLabel ─────────────────────────────────────────────

  describe('addLabel', () => {
    it('delegates to label module addLabel', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
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
        .mockResolvedValueOnce({ ok: true } as Response);

      const board = createAzdoBoard(baseEnv, mockFetch);
      await board.addLabel('azdo-42', 'new-tag');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('removeLabel', () => {
    it('delegates to label module removeLabel', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 42,
              fields: { 'System.Tags': 'keep; remove-me' },
              relations: null,
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce({ ok: true } as Response);

      const board = createAzdoBoard(baseEnv, mockFetch);
      await board.removeLabel('azdo-42', 'remove-me');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
