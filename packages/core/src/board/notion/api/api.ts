/**
 * Notion REST API functions.
 *
 * All calls use `retryFetch` to handle Notion's 3 req/s rate limit.
 * Pure helpers (headers, property extraction) are in `helpers.ts`.
 */
import type { NotionCtx } from './helpers.js';
import type { NotionPage } from '~/c/schemas/index.js';
import type { PingResult } from '~/c/types/index.js';

import {
  notionDatabaseQueryResponseSchema,
  notionPageSchema,
  notionUserResponseSchema,
} from '~/c/schemas/index.js';
import { fetchAndParse, retryFetch } from '~/c/shared/http/index.js';

import { NOTION_API, notionHeaders } from './helpers.js';

// ─── Ping ────────────────────────────────────────────────────────────────────

/**
 * Ping the Notion API to verify connectivity and credentials.
 *
 * @param token - The Notion integration token.
 * @returns Ping result with `ok` and optional `error`.
 */
export async function pingNotion(token: string): Promise<PingResult> {
  const headers = notionHeaders(token);

  const response = await retryFetch(`${NOTION_API}/users/me`, {
    headers,
  }).catch(() => undefined);

  if (!response) {
    return { ok: false, error: '✗ Could not reach Notion — check network' };
  }

  if (!response.ok) {
    return response.status === 401 || response.status === 403
      ? { ok: false, error: '✗ Notion auth failed — check NOTION_TOKEN' }
      : { ok: false, error: `✗ Notion API returned HTTP ${response.status}` };
  }

  try {
    const json: unknown = await response.json();
    const parsed = notionUserResponseSchema.safeParse(json);
    if (parsed.success && parsed.data.id) return { ok: true };
  } catch {
    // Invalid JSON — treat as auth issue
  }

  return { ok: false, error: '✗ Notion auth failed — check NOTION_TOKEN' };
}

// ─── Database query ──────────────────────────────────────────────────────────

/** Paginated query result from Notion. */
type QueryResult = {
  readonly results: readonly NotionPage[];
  readonly has_more: boolean;
  readonly next_cursor?: string | null;
};

/** Options for {@link queryDatabase}. */
type QueryDatabaseOpts = {
  readonly ctx: NotionCtx;
  readonly filter?: Record<string, unknown>;
  readonly sorts?: readonly Record<string, unknown>[];
  readonly startCursor?: string;
};

/**
 * Query a Notion database with optional filters and pagination.
 *
 * @param opts - Connection context, filter, sorts, and cursor.
 * @returns The query response, or `undefined` on failure.
 */
export async function queryDatabase(
  opts: QueryDatabaseOpts,
): Promise<QueryResult | undefined> {
  const { ctx, filter, sorts, startCursor } = opts;
  const body = {
    ...(filter ? { filter } : {}),
    ...(sorts ? { sorts } : {}),
    ...(startCursor ? { start_cursor: startCursor } : {}),
  };

  return fetchAndParse(
    `${NOTION_API}/databases/${ctx.databaseId}/query`,
    {
      method: 'POST',
      headers: notionHeaders(ctx.token),
      body: JSON.stringify(body),
    },
    {
      schema: notionDatabaseQueryResponseSchema,
      label: 'Notion API',
      fetcher: retryFetch,
    },
  );
}

// ─── Paginated query ─────────────────────────────────────────────────────────

/** Max pagination pages to prevent runaway queries (1000 items). */
const MAX_PAGES = 10;

/** Options for {@link queryAllPages}. */
type QueryAllPagesOpts = {
  readonly ctx: NotionCtx;
  readonly filter?: Record<string, unknown>;
};

/**
 * Query all pages from a Notion database, handling pagination.
 *
 * Caps at 10 pages (1000 items) to prevent runaway queries.
 *
 * @param opts - Connection context and optional filter.
 * @returns All matching pages, or an empty array on failure.
 */
export async function queryAllPages(
  opts: QueryAllPagesOpts,
): Promise<readonly NotionPage[]> {
  return collectPages(opts, undefined, []);
}

/** Recursively collect pages with cursor-based pagination. */
async function collectPages(
  opts: QueryAllPagesOpts,
  cursor: string | undefined,
  accumulated: readonly NotionPage[],
): Promise<readonly NotionPage[]> {
  const response = await queryDatabase({ ...opts, startCursor: cursor });
  if (!response) return accumulated;

  const combined = [...accumulated, ...response.results];
  const nextCursor = response.has_more ? response.next_cursor : undefined;
  const underLimit = Math.ceil(combined.length / 100) < MAX_PAGES;

  if (nextCursor && underLimit) {
    return collectPages(opts, nextCursor, combined);
  }

  return combined;
}

// ─── Single page ─────────────────────────────────────────────────────────────

/**
 * Fetch a single Notion page by ID.
 *
 * @param token - The Notion integration token.
 * @param pageId - The page UUID.
 * @returns The page object, or `undefined` on failure.
 */
export async function fetchPage(
  token: string,
  pageId: string,
): Promise<NotionPage | undefined> {
  return fetchAndParse(
    `${NOTION_API}/pages/${pageId}`,
    { headers: notionHeaders(token) },
    { schema: notionPageSchema, label: 'Notion page', fetcher: retryFetch },
  );
}

// ─── Update ──────────────────────────────────────────────────────────────────

/**
 * Update a Notion page's properties.
 *
 * @param token - The Notion integration token.
 * @param pageId - The page UUID.
 * @param properties - The properties to update.
 * @returns `true` if the update succeeded.
 */
export async function updatePage(
  token: string,
  pageId: string,
  properties: Record<string, unknown>,
): Promise<boolean> {
  try {
    const response = await retryFetch(`${NOTION_API}/pages/${pageId}`, {
      method: 'PATCH',
      headers: notionHeaders(token),
      body: JSON.stringify({ properties }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

// ─── Page resolution ─────────────────────────────────────────────────────────

/**
 * Find a page by its short key (notion-{first8}) in a database.
 *
 * @param ctx - Notion connection context.
 * @param key - The short key (e.g., `'notion-ab12cd34'`).
 * @returns The matching page, or `undefined`.
 */
export async function findPageByKey(
  ctx: NotionCtx,
  key: string,
): Promise<NotionPage | undefined> {
  const shortId = key.replace('notion-', '');
  if (!shortId) return undefined;

  const allPages = await queryAllPages({ ctx });

  return allPages.find(
    (page) => page.id.replace(/-/g, '').slice(0, 8) === shortId,
  );
}
