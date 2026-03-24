import type { NotionCtx } from '../api/index.js';

import { retryFetch } from '~/c/shared/http/index.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchBlockerStatus, fetchChildrenStatus } from './relations.js';

vi.mock('~/c/shared/http/retry-fetch/retry-fetch.js', () => ({
  retryFetch: vi.fn(),
}));

const TOKEN = 'ntn_test_token';
const DATABASE_ID = 'db-uuid-1234';
const PAGE_ID = 'ab12cd34-5678-9abc-def0-123456789abc';
const ctx: NotionCtx = { token: TOKEN, databaseId: DATABASE_ID };

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

describe('notion relations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  // ─── fetchBlockerStatus ─────────────────────────────────────────────────

  describe('fetchBlockerStatus', () => {
    it('returns false when page has no blockers', async () => {
      vi.mocked(retryFetch).mockResolvedValue(
        mockResponse(makePage({ id: PAGE_ID, title: 'Unblocked' })),
      );

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

      vi.mocked(retryFetch)
        .mockResolvedValueOnce(mockResponse(page))
        .mockResolvedValueOnce(mockResponse(blockerPage));

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

      vi.mocked(retryFetch)
        .mockResolvedValueOnce(mockResponse(page))
        .mockResolvedValueOnce(mockResponse(blockerPage));

      const result = await fetchBlockerStatus({
        ctx,
        pageId: PAGE_ID,
        statusProp: 'Status',
      });
      expect(result).toBe(false);
    });

    it('returns false on network failure', async () => {
      vi.mocked(retryFetch).mockRejectedValue(new Error('network'));

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

      vi.mocked(retryFetch).mockResolvedValue(
        mockResponse({
          results: [child1, child2],
          has_more: false,
          next_cursor: null,
        }),
      );

      const result = await fetchChildrenStatus({
        ctx,
        parentKey: 'notion-ab12cd34',
        parentProp: 'Epic',
        statusProp: 'Status',
      });

      expect(result).toEqual({ total: 2, incomplete: 1 });
    });

    it('returns undefined on failure', async () => {
      vi.mocked(retryFetch).mockRejectedValue(new Error('network'));

      const result = await fetchChildrenStatus({
        ctx,
        parentKey: 'notion-ab12cd34',
        parentProp: 'Epic',
        statusProp: 'Status',
      });

      expect(result).toBeUndefined();
    });

    it('returns undefined when no children match via either mode', async () => {
      vi.mocked(retryFetch)
        .mockResolvedValueOnce(
          mockResponse({ results: [], has_more: false, next_cursor: null }),
        )
        .mockResolvedValueOnce(
          mockResponse({ results: [], has_more: false, next_cursor: null }),
        );

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
