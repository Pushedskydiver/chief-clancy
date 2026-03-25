import type { NotionEnv } from '~/c/schemas/index.js';
import type { FetchedTicket } from '~/c/types/index.js';

import { retryFetch } from '~/c/shared/http/index.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createNotionBoard } from './notion-board.js';

vi.mock('~/c/shared/http/retry-fetch/retry-fetch.js', () => ({
  retryFetch: vi.fn(),
}));

const baseEnv: NotionEnv = {
  NOTION_TOKEN: 'ntn_test_token',
  NOTION_DATABASE_ID: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
};

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: new Headers(),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function makeFullPage(
  id: string,
  title: string,
  labels: readonly string[] = [],
) {
  return {
    id,
    properties: {
      Name: { type: 'title', title: [{ plain_text: title }] },
      Status: { type: 'status', status: { name: 'To-do' } },
      Description: {
        type: 'rich_text',
        rich_text: [{ plain_text: 'Desc text' }],
      },
      Labels: {
        type: 'multi_select',
        multi_select: labels.map((name) => ({ name })),
      },
      Epic: { type: 'relation', relation: [] },
    },
  };
}

describe('createNotionBoard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('returns an object with all Board methods', () => {
    const board = createNotionBoard(baseEnv);

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
    it('returns undefined for valid UUID', () => {
      const board = createNotionBoard(baseEnv);
      expect(board.validateInputs()).toBeUndefined();
    });

    it('returns error for invalid database ID', () => {
      const board = createNotionBoard({
        ...baseEnv,
        NOTION_DATABASE_ID: 'not-a-uuid',
      });
      expect(board.validateInputs()).toContain('NOTION_DATABASE_ID');
    });
  });

  // ─── sharedEnv ──────────────────────────────────────────────────────────

  it('sharedEnv returns the env object', () => {
    const board = createNotionBoard(baseEnv);
    expect(board.sharedEnv()).toBe(baseEnv);
  });

  // ─── ping ───────────────────────────────────────────────────────────────

  describe('ping', () => {
    it('delegates to pingNotion', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({})));

      const board = createNotionBoard(baseEnv);
      const result = await board.ping();
      expect(result.ok).toBe(true);
    });
  });

  // ─── fetchTickets ───────────────────────────────────────────────────────

  describe('fetchTickets', () => {
    it('returns normalised FetchedTickets', async () => {
      const page = makeFullPage(
        'ab12cd34-5678-9abc-def0-123456789abc',
        'Fix login bug',
        ['bug'],
      );

      vi.mocked(retryFetch).mockResolvedValue(
        mockResponse({
          results: [page],
          has_more: false,
          next_cursor: null,
        }),
      );

      const board = createNotionBoard(baseEnv);
      const tickets = await board.fetchTickets({});

      expect(tickets).toHaveLength(1);
      expect(tickets[0].key).toBe('notion-ab12cd34');
      expect(tickets[0].title).toBe('Fix login bug');
      expect(tickets[0].description).toBe('Desc text');
      expect(tickets[0].issueId).toBe('ab12cd34-5678-9abc-def0-123456789abc');
      expect(tickets[0].parentInfo).toBe('none');
      expect(tickets[0].labels).toEqual(['bug']);
      expect(tickets[0].status).toBe('To-do');
    });

    it('returns empty array when query returns undefined', async () => {
      vi.mocked(retryFetch).mockRejectedValue(new Error('network'));

      const board = createNotionBoard(baseEnv);
      const tickets = await board.fetchTickets({});
      expect(tickets).toEqual([]);
    });

    it('filters out hitl tickets', async () => {
      const page = makeFullPage(
        'ab12cd34-5678-9abc-def0-123456789abc',
        'HITL',
        ['clancy:hitl'],
      );

      vi.mocked(retryFetch).mockResolvedValue(
        mockResponse({
          results: [page],
          has_more: false,
          next_cursor: null,
        }),
      );

      const board = createNotionBoard(baseEnv);
      const tickets = await board.fetchTickets({ excludeHitl: true });
      expect(tickets).toEqual([]);
    });
  });

  // ─── fetchTicket ────────────────────────────────────────────────────────

  describe('fetchTicket', () => {
    it('returns undefined when no tickets', async () => {
      vi.mocked(retryFetch).mockResolvedValue(
        mockResponse({ results: [], has_more: false }),
      );

      const board = createNotionBoard(baseEnv);
      const ticket = await board.fetchTicket({});
      expect(ticket).toBeUndefined();
    });
  });

  // ─── fetchBlockerStatus ─────────────────────────────────────────────────

  describe('fetchBlockerStatus', () => {
    it('returns false when ticket has no issueId', async () => {
      const board = createNotionBoard(baseEnv);
      const ticket: FetchedTicket = {
        key: 'notion-ab12cd34',
        title: 'Test',
        description: '',
        parentInfo: 'none',
        blockers: 'None',
      };

      const result = await board.fetchBlockerStatus(ticket);
      expect(result).toBe(false);
    });
  });

  // ─── fetchChildrenStatus ───────────────────────────────────────────────

  describe('fetchChildrenStatus', () => {
    it('delegates to relations module', async () => {
      const epicExtra = {
        Description: {
          type: 'rich_text',
          rich_text: [{ plain_text: 'Epic: notion-ab12cd34' }],
        },
      };
      const childPage = {
        id: 'child1-uuid-5678-9abc-def0-123456789abc',
        properties: {
          Name: { type: 'title', title: [{ plain_text: 'Child 1' }] },
          Status: { type: 'status', status: { name: 'In Progress' } },
          Description: epicExtra.Description,
        },
      };

      vi.mocked(retryFetch).mockResolvedValue(
        mockResponse({
          results: [childPage],
          has_more: false,
          next_cursor: null,
        }),
      );

      const board = createNotionBoard(baseEnv);
      const result = await board.fetchChildrenStatus('notion-ab12cd34');

      expect(result).toEqual({ total: 1, incomplete: 1 });
    });
  });

  // ─── addLabel / removeLabel ───────────────────────────────────────────

  describe('addLabel', () => {
    it('delegates to label module', async () => {
      const page = {
        ...makeFullPage('ab12cd34-5678-9abc-def0-123456789abc', 'Test'),
        properties: {
          ...makeFullPage('ab12cd34-5678-9abc-def0-123456789abc', 'Test')
            .properties,
          Labels: {
            type: 'multi_select',
            multi_select: [{ name: 'existing' }],
          },
        },
      };

      vi.mocked(retryFetch)
        // findPageByKey → queryAllPages
        .mockResolvedValueOnce(
          mockResponse({
            results: [page],
            has_more: false,
            next_cursor: null,
          }),
        )
        // updatePage PATCH
        .mockResolvedValueOnce(mockResponse({}));

      const board = createNotionBoard(baseEnv);
      await board.addLabel('notion-ab12cd34', 'new-label');

      expect(retryFetch).toHaveBeenCalledWith(
        expect.stringContaining('/pages/'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  describe('removeLabel', () => {
    it('delegates to label module', async () => {
      const page = {
        ...makeFullPage('ab12cd34-5678-9abc-def0-123456789abc', 'Test'),
        properties: {
          ...makeFullPage('ab12cd34-5678-9abc-def0-123456789abc', 'Test')
            .properties,
          Labels: {
            type: 'multi_select',
            multi_select: [{ name: 'old-label' }, { name: 'keep' }],
          },
        },
      };

      vi.mocked(retryFetch)
        // findPageByKey → queryAllPages
        .mockResolvedValueOnce(
          mockResponse({
            results: [page],
            has_more: false,
            next_cursor: null,
          }),
        )
        // updatePage PATCH
        .mockResolvedValueOnce(mockResponse({}));

      const board = createNotionBoard(baseEnv);
      await board.removeLabel('notion-ab12cd34', 'old-label');

      expect(retryFetch).toHaveBeenCalledWith(
        expect.stringContaining('/pages/'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  // ─── transitionTicket ───────────────────────────────────────────────────

  describe('transitionTicket', () => {
    it('updates page status property', async () => {
      vi.mocked(retryFetch).mockResolvedValue(mockResponse({}));

      const board = createNotionBoard(baseEnv);
      const ticket: FetchedTicket = {
        key: 'notion-ab12cd34',
        title: 'Test',
        description: '',
        parentInfo: 'none',
        blockers: 'None',
        issueId: 'ab12cd34-5678-9abc-def0-123456789abc',
      };

      const result = await board.transitionTicket(ticket, 'In Progress');
      expect(result).toBe(true);

      expect(retryFetch).toHaveBeenCalledWith(
        expect.stringContaining('/pages/'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });

    it('falls back to select on status failure', async () => {
      vi.mocked(retryFetch)
        .mockResolvedValueOnce(mockResponse({}, 400))
        .mockResolvedValueOnce(mockResponse({}));

      const board = createNotionBoard(baseEnv);
      const ticket: FetchedTicket = {
        key: 'notion-ab12cd34',
        title: 'Test',
        description: '',
        parentInfo: 'none',
        blockers: 'None',
        issueId: 'ab12cd34-5678-9abc-def0-123456789abc',
      };

      const result = await board.transitionTicket(ticket, 'Done');
      expect(result).toBe(true);
      expect(retryFetch).toHaveBeenCalledTimes(2);
    });

    it('returns false when no issueId', async () => {
      const board = createNotionBoard(baseEnv);
      const ticket: FetchedTicket = {
        key: 'notion-ab12cd34',
        title: 'Test',
        description: '',
        parentInfo: 'none',
        blockers: 'None',
      };

      const result = await board.transitionTicket(ticket, 'Done');
      expect(result).toBe(false);
    });
  });

  // ─── ensureLabel ────────────────────────────────────────────────────────

  describe('ensureLabel', () => {
    it('is a no-op', async () => {
      const board = createNotionBoard(baseEnv);
      await expect(board.ensureLabel('test')).resolves.toBeUndefined();
    });
  });
});
