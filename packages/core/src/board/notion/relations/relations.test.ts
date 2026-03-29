import type { NotionCtx } from '../api/index.js';
import type { Fetcher } from '~/c/shared/http/index.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchBlockerStatus, fetchChildrenStatus } from './relations.js';

const TOKEN = 'ntn_test_token';
const DATABASE_ID = 'db-uuid-1234';
const PAGE_ID = 'ab12cd34-5678-9abc-def0-123456789abc';

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function makePage(opts: {
  readonly id: string;
  readonly title: string;
  readonly statusName?: string;
  readonly extra?: Record<string, unknown>;
}) {
  return {
    id: opts.id,
    properties: {
      Name: { type: 'title', title: [{ plain_text: opts.title }] },
      Status: {
        type: 'status',
        status: { name: opts.statusName ?? 'To-do' },
      },
      ...opts.extra,
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('notion relations', () => {
  // ─── fetchBlockerStatus ─────────────────────────────────────────────────

  describe('fetchBlockerStatus', () => {
    it('returns false when page has no blockers', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        .mockResolvedValue(
          mockResponse(makePage({ id: PAGE_ID, title: 'Unblocked' })),
        );
      const ctx: NotionCtx = {
        token: TOKEN,
        databaseId: DATABASE_ID,
        fetcher: mockFetch,
      };

      const result = await fetchBlockerStatus({
        ctx,
        pageId: PAGE_ID,
        statusProp: 'Status',
      });
      expect(result).toBe(false);
    });

    it('returns true when blocked by relation with incomplete status', async () => {
      const blockerId = 'blocker-id-1234-5678-abcd-efgh12345678';
      const page = makePage({
        id: PAGE_ID,
        title: 'Blocked task',
        extra: {
          'Blocked by': {
            type: 'relation',
            relation: [{ id: blockerId }],
          },
        },
      });
      const blockerPage = makePage({
        id: blockerId,
        title: 'Blocker',
        statusName: 'In Progress',
      });

      const mockFetch = vi
        .fn<Fetcher>()
        .mockResolvedValueOnce(mockResponse(page))
        .mockResolvedValueOnce(mockResponse(blockerPage));
      const ctx: NotionCtx = {
        token: TOKEN,
        databaseId: DATABASE_ID,
        fetcher: mockFetch,
      };

      const result = await fetchBlockerStatus({
        ctx,
        pageId: PAGE_ID,
        statusProp: 'Status',
      });
      expect(result).toBe(true);
    });

    it('returns false when blocker is complete', async () => {
      const blockerId = 'blocker-id-1234-5678-abcd-efgh12345678';
      const page = makePage({
        id: PAGE_ID,
        title: 'Blocked task',
        extra: {
          'Blocked by': {
            type: 'relation',
            relation: [{ id: blockerId }],
          },
        },
      });
      const blockerPage = makePage({
        id: blockerId,
        title: 'Blocker',
        statusName: 'Done',
      });

      const mockFetch = vi
        .fn<Fetcher>()
        .mockResolvedValueOnce(mockResponse(page))
        .mockResolvedValueOnce(mockResponse(blockerPage));
      const ctx: NotionCtx = {
        token: TOKEN,
        databaseId: DATABASE_ID,
        fetcher: mockFetch,
      };

      const result = await fetchBlockerStatus({
        ctx,
        pageId: PAGE_ID,
        statusProp: 'Status',
      });
      expect(result).toBe(false);
    });

    it('falls back to description blockers when no relation property', async () => {
      const blockerId = 'bbbbbbbb-1111-2222-3333-444444444444';
      const blockerShortId = blockerId.replace(/-/g, '').slice(0, 8);

      const page = makePage({
        id: PAGE_ID,
        title: 'Blocked task',
        extra: {
          Description: {
            type: 'rich_text',
            rich_text: [{ plain_text: `Blocked by notion-${blockerShortId}` }],
          },
        },
      });
      const blockerPage = makePage({
        id: blockerId,
        title: 'Blocker',
        statusName: 'In Progress',
      });

      const mockFetch = vi
        .fn<Fetcher>()
        // fetchPage (the blocked page)
        .mockResolvedValueOnce(mockResponse(page))
        // queryAllPages (to find blockers)
        .mockResolvedValueOnce(
          mockResponse({
            results: [page, blockerPage],
            has_more: false,
            next_cursor: null,
          }),
        );
      const ctx: NotionCtx = {
        token: TOKEN,
        databaseId: DATABASE_ID,
        fetcher: mockFetch,
      };

      const result = await fetchBlockerStatus({
        ctx,
        pageId: PAGE_ID,
        statusProp: 'Status',
      });
      expect(result).toBe(true);
    });

    it('returns false on network failure', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        .mockRejectedValue(new Error('network'));
      const ctx: NotionCtx = {
        token: TOKEN,
        databaseId: DATABASE_ID,
        fetcher: mockFetch,
      };

      const result = await fetchBlockerStatus({
        ctx,
        pageId: PAGE_ID,
        statusProp: 'Status',
      });
      expect(result).toBe(false);
    });
  });

  // ─── fetchChildrenStatus ────────────────────────────────────────────────

  describe('fetchChildrenStatus', () => {
    it('returns children count from description text convention', async () => {
      const epicExtra = {
        Description: {
          type: 'rich_text',
          rich_text: [{ plain_text: 'Epic: notion-ab12cd34' }],
        },
      };
      const child1 = makePage({
        id: 'child-1-uuid-0000-0000-000000000000',
        title: 'Child 1',
        statusName: 'Done',
        extra: epicExtra,
      });
      const child2 = makePage({
        id: 'child-2-uuid-0000-0000-000000000000',
        title: 'Child 2',
        extra: epicExtra,
      });

      const mockFetch = vi.fn<Fetcher>().mockResolvedValue(
        mockResponse({
          results: [child1, child2],
          has_more: false,
          next_cursor: null,
        }),
      );
      const ctx: NotionCtx = {
        token: TOKEN,
        databaseId: DATABASE_ID,
        fetcher: mockFetch,
      };

      const result = await fetchChildrenStatus({
        ctx,
        parentKey: 'notion-ab12cd34',
        parentProp: 'Epic',
        statusProp: 'Status',
      });

      expect(result).toEqual({ total: 2, incomplete: 1 });
    });

    it('falls back to relation property when description returns 0', async () => {
      const parentId = 'ab12cd34-0000-0000-0000-000000000000';
      const childPage = makePage({
        id: 'child-1-uuid-0000-0000-000000000000',
        title: 'Child 1',
      });

      const mockFetch = vi
        .fn<Fetcher>()
        // queryAllPages for description search (no matches)
        .mockResolvedValueOnce(
          mockResponse({
            results: [],
            has_more: false,
            next_cursor: null,
          }),
        )
        // findPageByKey → queryAllPages (parent must match shortId)
        .mockResolvedValueOnce(
          mockResponse({
            results: [makePage({ id: parentId, title: 'Parent' })],
            has_more: false,
            next_cursor: null,
          }),
        )
        // queryDatabase with relation filter
        .mockResolvedValueOnce(
          mockResponse({
            results: [childPage],
            has_more: false,
            next_cursor: null,
          }),
        );
      const ctx: NotionCtx = {
        token: TOKEN,
        databaseId: DATABASE_ID,
        fetcher: mockFetch,
      };

      const result = await fetchChildrenStatus({
        ctx,
        parentKey: 'notion-ab12cd34',
        parentProp: 'Epic',
        statusProp: 'Status',
      });

      expect(result).toEqual({ total: 1, incomplete: 1 });
    });

    it('returns undefined on failure', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        .mockRejectedValue(new Error('network'));
      const ctx: NotionCtx = {
        token: TOKEN,
        databaseId: DATABASE_ID,
        fetcher: mockFetch,
      };

      const result = await fetchChildrenStatus({
        ctx,
        parentKey: 'notion-ab12cd34',
        parentProp: 'Epic',
        statusProp: 'Status',
      });

      expect(result).toBeUndefined();
    });

    it('returns undefined when no children match via either mode', async () => {
      const mockFetch = vi
        .fn<Fetcher>()
        .mockResolvedValueOnce(
          mockResponse({ results: [], has_more: false, next_cursor: null }),
        )
        .mockResolvedValueOnce(
          mockResponse({ results: [], has_more: false, next_cursor: null }),
        );
      const ctx: NotionCtx = {
        token: TOKEN,
        databaseId: DATABASE_ID,
        fetcher: mockFetch,
      };

      const result = await fetchChildrenStatus({
        ctx,
        parentKey: 'notion-ab12cd34',
        parentProp: 'Epic',
        statusProp: 'Status',
      });

      expect(result).toBeUndefined();
    });
  });
});
