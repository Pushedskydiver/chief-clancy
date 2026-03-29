import type { NotionCtx } from '../api/index.js';
import type { Fetcher } from '~/c/shared/http/index.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { addLabel, removeLabel } from './labels.js';

afterEach(() => {
  vi.restoreAllMocks();
});

const PAGE_ID = 'ab12cd34-5678-9abc-def0-123456789abc';

/** Build a Notion context with a DI fetcher. */
function makeCtx(fetcher: Fetcher): NotionCtx {
  return { token: 'ntn_test', databaseId: 'db-uuid', fetcher };
}

/** Build a Response from JSON data (for fetchAndParse compatibility). */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function makePageWithLabels(labels: readonly string[]) {
  return {
    id: PAGE_ID,
    properties: {
      Name: { type: 'title', title: [{ plain_text: 'Test' }] },
      Labels: {
        type: 'multi_select',
        multi_select: labels.map((name) => ({ name })),
      },
    },
  };
}

describe('notion labels', () => {
  describe('addLabel', () => {
    it('appends label via PATCH', async () => {
      const page = makePageWithLabels(['existing']);
      const mockFetch: Fetcher = vi
        .fn()
        // findPageByKey → queryAllPages → queryDatabase
        .mockResolvedValueOnce(
          jsonResponse({
            results: [page],
            has_more: false,
            next_cursor: null,
          }),
        )
        // updatePage PATCH
        .mockResolvedValueOnce(jsonResponse({}));

      await addLabel({
        ctx: makeCtx(mockFetch),
        issueKey: 'notion-ab12cd34',
        label: 'new-label',
        labelsProp: 'Labels',
      });

      const patchCall = vi.mocked(mockFetch).mock.calls[1];
      const body = JSON.parse((patchCall[1] as RequestInit).body as string) as {
        properties: Record<string, unknown>;
      };

      expect(body.properties.Labels).toEqual({
        multi_select: [{ name: 'existing' }, { name: 'new-label' }],
      });
    });

    it('skips update when label already present', async () => {
      const page = makePageWithLabels(['existing']);
      const mockFetch: Fetcher = vi.fn().mockResolvedValueOnce(
        jsonResponse({
          results: [page],
          has_more: false,
          next_cursor: null,
        }),
      );

      await addLabel({
        ctx: makeCtx(mockFetch),
        issueKey: 'notion-ab12cd34',
        label: 'existing',
        labelsProp: 'Labels',
      });

      // Only 1 call (queryAllPages) — no PATCH
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('handles page not found gracefully', async () => {
      const mockFetch: Fetcher = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ results: [], has_more: false }));

      await expect(
        addLabel({
          ctx: makeCtx(mockFetch),
          issueKey: 'notion-00000000',
          label: 'tag',
          labelsProp: 'Labels',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('removeLabel', () => {
    it('removes label via PATCH', async () => {
      const page = makePageWithLabels(['keep', 'remove-me']);
      const mockFetch: Fetcher = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            results: [page],
            has_more: false,
            next_cursor: null,
          }),
        )
        .mockResolvedValueOnce(jsonResponse({}));

      await removeLabel({
        ctx: makeCtx(mockFetch),
        issueKey: 'notion-ab12cd34',
        label: 'remove-me',
        labelsProp: 'Labels',
      });

      const patchCall = vi.mocked(mockFetch).mock.calls[1];
      const body = JSON.parse((patchCall[1] as RequestInit).body as string) as {
        properties: Record<string, unknown>;
      };

      expect(body.properties.Labels).toEqual({
        multi_select: [{ name: 'keep' }],
      });
    });

    it('skips update when label not present', async () => {
      const page = makePageWithLabels(['other']);
      const mockFetch: Fetcher = vi.fn().mockResolvedValueOnce(
        jsonResponse({
          results: [page],
          has_more: false,
          next_cursor: null,
        }),
      );

      await removeLabel({
        ctx: makeCtx(mockFetch),
        issueKey: 'notion-ab12cd34',
        label: 'nonexistent',
        labelsProp: 'Labels',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
