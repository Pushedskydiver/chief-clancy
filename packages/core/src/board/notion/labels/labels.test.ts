import type { NotionCtx } from '../api/index.js';

import { retryFetch } from '~/c/shared/http/index.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { addLabel, removeLabel } from './labels.js';

vi.mock('~/c/shared/http/retry-fetch/retry-fetch.js', () => ({
  retryFetch: vi.fn(),
}));

const ctx: NotionCtx = { token: 'ntn_test', databaseId: 'db-uuid' };
const PAGE_ID = 'ab12cd34-5678-9abc-def0-123456789abc';

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
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('addLabel', () => {
    it('appends label via PATCH', async () => {
      const page = makePageWithLabels(['existing']);

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

      await addLabel({
        ctx,
        issueKey: 'notion-ab12cd34',
        label: 'new-label',
        labelsProp: 'Labels',
      });

      const patchCall = vi.mocked(retryFetch).mock.calls[1];
      const body = JSON.parse((patchCall[1] as RequestInit).body as string) as {
        properties: Record<string, unknown>;
      };

      expect(body.properties.Labels).toEqual({
        multi_select: [{ name: 'existing' }, { name: 'new-label' }],
      });
    });

    it('skips update when label already present', async () => {
      const page = makePageWithLabels(['existing']);

      vi.mocked(retryFetch).mockResolvedValueOnce(
        mockResponse({
          results: [page],
          has_more: false,
          next_cursor: null,
        }),
      );

      await addLabel({
        ctx,
        issueKey: 'notion-ab12cd34',
        label: 'existing',
        labelsProp: 'Labels',
      });

      // Only 1 call (queryAllPages) — no PATCH
      expect(retryFetch).toHaveBeenCalledTimes(1);
    });

    it('handles page not found gracefully', async () => {
      vi.mocked(retryFetch).mockResolvedValueOnce(
        mockResponse({ results: [], has_more: false }),
      );

      await expect(
        addLabel({
          ctx,
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

      vi.mocked(retryFetch)
        .mockResolvedValueOnce(
          mockResponse({
            results: [page],
            has_more: false,
            next_cursor: null,
          }),
        )
        .mockResolvedValueOnce(mockResponse({}));

      await removeLabel({
        ctx,
        issueKey: 'notion-ab12cd34',
        label: 'remove-me',
        labelsProp: 'Labels',
      });

      const patchCall = vi.mocked(retryFetch).mock.calls[1];
      const body = JSON.parse((patchCall[1] as RequestInit).body as string) as {
        properties: Record<string, unknown>;
      };

      expect(body.properties.Labels).toEqual({
        multi_select: [{ name: 'keep' }],
      });
    });

    it('skips update when label not present', async () => {
      const page = makePageWithLabels(['other']);

      vi.mocked(retryFetch).mockResolvedValueOnce(
        mockResponse({
          results: [page],
          has_more: false,
          next_cursor: null,
        }),
      );

      await removeLabel({
        ctx,
        issueKey: 'notion-ab12cd34',
        label: 'nonexistent',
        labelsProp: 'Labels',
      });

      expect(retryFetch).toHaveBeenCalledTimes(1);
    });
  });
});
