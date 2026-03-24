import type { NotionCtx } from './helpers.js';

import { retryFetch } from '~/c/shared/http/index.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchPage,
  findPageByKey,
  pingNotion,
  queryAllPages,
  queryDatabase,
  updatePage,
} from './api.js';

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

function makePage(id: string, title: string, statusName = 'To-do') {
  return {
    id,
    properties: {
      Name: { type: 'title', title: [{ plain_text: title }] },
      Status: { type: 'status', status: { name: statusName } },
    },
  };
}

describe('notion api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  // ─── pingNotion ─────────────────────────────────────────────────────────

  describe('pingNotion', () => {
    it('returns ok true on successful response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({})));

      const result = await pingNotion(TOKEN);
      expect(result).toEqual({ ok: true });
    });

    it('returns error on auth failure (401)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({}, 401)));

      const result = await pingNotion(TOKEN);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('auth failed');
    });

    it('returns error on server error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({}, 500)));

      const result = await pingNotion(TOKEN);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('HTTP 500');
    });

    it('returns error on network failure', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      );

      const result = await pingNotion(TOKEN);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Could not reach');
    });

    it('sends correct headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockResponse({}));
      vi.stubGlobal('fetch', mockFetch);

      await pingNotion(TOKEN);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.notion.com/v1/users/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${TOKEN}`,
            'Notion-Version': '2022-06-28',
          }),
        }),
      );
    });
  });

  // ─── queryDatabase ──────────────────────────────────────────────────────

  describe('queryDatabase', () => {
    it('returns parsed results on success', async () => {
      const page = makePage(PAGE_ID, 'Test ticket');
      vi.mocked(retryFetch).mockResolvedValue(
        mockResponse({
          results: [page],
          has_more: false,
          next_cursor: null,
        }),
      );

      const result = await queryDatabase({ ctx });

      expect(result).toBeDefined();
      expect(result!.results).toHaveLength(1);
      expect(result!.results[0].id).toBe(PAGE_ID);
    });

    it('sends filter when provided', async () => {
      vi.mocked(retryFetch).mockResolvedValue(
        mockResponse({ results: [], has_more: false }),
      );

      const filter = { property: 'Status', status: { equals: 'To-do' } };
      await queryDatabase({ ctx, filter });

      expect(retryFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ filter }),
        }),
      );
    });

    it('returns undefined on HTTP error', async () => {
      vi.mocked(retryFetch).mockResolvedValue(mockResponse({}, 400));

      const result = await queryDatabase({ ctx });
      expect(result).toBeUndefined();
    });

    it('returns undefined on network failure', async () => {
      vi.mocked(retryFetch).mockRejectedValue(new Error('network'));

      const result = await queryDatabase({ ctx });
      expect(result).toBeUndefined();
    });
  });

  // ─── queryAllPages ──────────────────────────────────────────────────────

  describe('queryAllPages', () => {
    it('paginates through multiple pages', async () => {
      const page1 = makePage('page-1-id-0000-0000-000000000000', 'Page 1');
      const page2 = makePage('page-2-id-0000-0000-000000000000', 'Page 2');

      vi.mocked(retryFetch)
        .mockResolvedValueOnce(
          mockResponse({
            results: [page1],
            has_more: true,
            next_cursor: 'cursor-1',
          }),
        )
        .mockResolvedValueOnce(
          mockResponse({
            results: [page2],
            has_more: false,
            next_cursor: null,
          }),
        );

      const results = await queryAllPages({ ctx });
      expect(results).toHaveLength(2);
    });

    it('returns empty array on failure', async () => {
      vi.mocked(retryFetch).mockRejectedValue(new Error('network'));

      const results = await queryAllPages({ ctx });
      expect(results).toEqual([]);
    });
  });

  // ─── fetchPage ──────────────────────────────────────────────────────────

  describe('fetchPage', () => {
    it('returns parsed page on success', async () => {
      const page = makePage(PAGE_ID, 'Test page');
      vi.mocked(retryFetch).mockResolvedValue(mockResponse(page));

      const result = await fetchPage(TOKEN, PAGE_ID);
      expect(result).toBeDefined();
      expect(result!.id).toBe(PAGE_ID);
    });

    it('returns undefined on HTTP error', async () => {
      vi.mocked(retryFetch).mockResolvedValue(mockResponse({}, 404));

      const result = await fetchPage(TOKEN, PAGE_ID);
      expect(result).toBeUndefined();
    });
  });

  // ─── updatePage ─────────────────────────────────────────────────────────

  describe('updatePage', () => {
    it('returns true on success', async () => {
      vi.mocked(retryFetch).mockResolvedValue(mockResponse({}));

      const result = await updatePage(TOKEN, PAGE_ID, {
        Status: { status: { name: 'In Progress' } },
      });
      expect(result).toBe(true);
    });

    it('sends PATCH with properties in body', async () => {
      vi.mocked(retryFetch).mockResolvedValue(mockResponse({}));

      const props = { Status: { status: { name: 'Done' } } };
      await updatePage(TOKEN, PAGE_ID, props);

      expect(retryFetch).toHaveBeenCalledWith(
        `https://api.notion.com/v1/pages/${PAGE_ID}`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ properties: props }),
        }),
      );
    });

    it('returns false on HTTP error', async () => {
      vi.mocked(retryFetch).mockResolvedValue(mockResponse({}, 400));

      const result = await updatePage(TOKEN, PAGE_ID, {});
      expect(result).toBe(false);
    });

    it('returns false on network failure', async () => {
      vi.mocked(retryFetch).mockRejectedValue(new Error('network'));

      const result = await updatePage(TOKEN, PAGE_ID, {});
      expect(result).toBe(false);
    });
  });

  // ─── findPageByKey ──────────────────────────────────────────────────────

  describe('findPageByKey', () => {
    it('finds page by short ID match', async () => {
      const page = makePage(PAGE_ID, 'Target');
      vi.mocked(retryFetch).mockResolvedValue(
        mockResponse({
          results: [page],
          has_more: false,
          next_cursor: null,
        }),
      );

      const result = await findPageByKey(ctx, 'notion-ab12cd34');
      expect(result).toBeDefined();
      expect(result!.id).toBe(PAGE_ID);
    });

    it('returns undefined when not found', async () => {
      vi.mocked(retryFetch).mockResolvedValue(
        mockResponse({ results: [], has_more: false }),
      );

      const result = await findPageByKey(ctx, 'notion-00000000');
      expect(result).toBeUndefined();
    });

    it('returns undefined for empty key', async () => {
      const result = await findPageByKey(ctx, 'notion-');
      expect(result).toBeUndefined();
    });
  });
});
