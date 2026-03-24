/**
 * Notion pure helper functions.
 *
 * Headers, property extraction, key parsing, and status checks.
 * All pure — no I/O.
 */
import type { NotionPage } from '~/c/schemas/index.js';

/** Notion REST API base URL. */
export const NOTION_API = 'https://api.notion.com/v1';

/** Notion API version for all requests. */
export const NOTION_VERSION = '2022-06-28';

/** Notion connection context. */
export type NotionCtx = {
  readonly token: string;
  readonly databaseId: string;
};

/**
 * Build standard Notion request headers.
 *
 * @param token - The Notion integration token.
 * @returns Headers object for Notion API requests.
 */
export function notionHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

// ─── Property extraction ─────────────────────────────────────────────────────

/**
 * Extract a single-value property (status, select, title, rich_text).
 *
 * @param page - The Notion page object.
 * @param propName - The property name to look up.
 * @param propType - The expected property type.
 * @returns The extracted string value, or `undefined`.
 */
export function getStringProperty(
  page: NotionPage,
  propName: string,
  propType: 'status' | 'select' | 'title' | 'rich_text',
): string | undefined {
  const prop = page.properties[propName];
  if (!prop || prop.type !== propType) return undefined;

  // Safe casts: type guard on prop.type guarantees the shape
  switch (propType) {
    case 'status': {
      const p = prop as { type: 'status'; status: { name: string } | null };
      return p.status?.name;
    }
    case 'select': {
      const p = prop as { type: 'select'; select: { name: string } | null };
      return p.select?.name;
    }
    case 'title': {
      const p = prop as { type: 'title'; title: { plain_text: string }[] };
      return p.title.map((t) => t.plain_text).join('');
    }
    case 'rich_text': {
      const p = prop as {
        type: 'rich_text';
        rich_text: { plain_text: string }[];
      };
      return p.rich_text.map((t) => t.plain_text).join('');
    }
  }
}

/**
 * Extract an array-value property (multi_select, relation, people).
 *
 * @param page - The Notion page object.
 * @param propName - The property name to look up.
 * @param propType - The expected property type.
 * @returns Array of string values, or `undefined`.
 */
export function getArrayProperty(
  page: NotionPage,
  propName: string,
  propType: 'multi_select' | 'relation' | 'people',
): readonly string[] | undefined {
  const prop = page.properties[propName];
  if (!prop || prop.type !== propType) return undefined;

  switch (propType) {
    case 'multi_select': {
      const p = prop as {
        type: 'multi_select';
        multi_select: { name: string }[];
      };
      return p.multi_select.map((o) => o.name);
    }
    case 'relation': {
      const p = prop as {
        type: 'relation';
        relation: { id: string }[];
      };
      return p.relation.map((r) => r.id);
    }
    case 'people': {
      const p = prop as {
        type: 'people';
        people: { id: string }[];
      };
      return p.people.map((u) => u.id);
    }
  }
}

// ─── Key helpers ─────────────────────────────────────────────────────────────

/**
 * Build a short key from a Notion page UUID.
 *
 * @param pageId - The full page UUID.
 * @returns Short key like `notion-ab12cd34`.
 */
export function buildNotionKey(pageId: string): string {
  const shortId = pageId.replace(/-/g, '').slice(0, 8);
  return `notion-${shortId}`;
}

/**
 * Extract the short ID from a Notion key.
 *
 * @param key - The key (e.g., `'notion-ab12cd34'`).
 * @returns The 8-char short ID, or `undefined` if invalid.
 */
export function parseNotionShortId(key: string): string | undefined {
  const shortId = key.replace('notion-', '');
  return shortId.length === 8 ? shortId : undefined;
}

// ─── Status helpers ──────────────────────────────────────────────────────────

/** Done-like status names (case-insensitive). */
const COMPLETE_STATUSES = new Set(['done', 'complete', 'completed', 'closed']);

/**
 * Check whether a status name indicates completion.
 *
 * @param statusName - The status name to check.
 * @returns `true` if the status is a done-like state.
 */
export function isCompleteStatus(statusName: string): boolean {
  return COMPLETE_STATUSES.has(statusName.toLowerCase());
}

/**
 * Extract description text from a page's rich_text properties.
 *
 * Tries common property names: Description, description, Body, body.
 *
 * @param page - The Notion page object.
 * @returns The description text, or `undefined`.
 */
export function getDescriptionText(page: NotionPage): string | undefined {
  const names = ['Description', 'description', 'Body', 'body'];
  return names
    .map((name) => getStringProperty(page, name, 'rich_text'))
    .find(Boolean);
}

/**
 * Extract the title from a page (first title-type property).
 *
 * @param page - The Notion page object.
 * @returns The title text, or empty string.
 */
export function getPageTitle(page: NotionPage): string {
  const titleEntry = Object.entries(page.properties).find(
    ([, prop]) => prop.type === 'title',
  );

  if (!titleEntry) return '';
  return getStringProperty(page, titleEntry[0], 'title') ?? '';
}

/**
 * Get the status of a page (tries status type, falls back to select).
 *
 * @param page - The Notion page object.
 * @param statusProp - The property name.
 * @returns The status name, or `undefined`.
 */
export function getPageStatus(
  page: NotionPage,
  statusProp: string,
): string | undefined {
  return (
    getStringProperty(page, statusProp, 'status') ??
    getStringProperty(page, statusProp, 'select')
  );
}

/**
 * Check if a page is incomplete (not in a done-like state).
 *
 * @param page - The Notion page object.
 * @param statusProp - The status property name.
 * @returns `true` if incomplete.
 */
export function isPageIncomplete(
  page: NotionPage,
  statusProp: string,
): boolean {
  const status = getPageStatus(page, statusProp);
  return !status || !isCompleteStatus(status);
}

/**
 * Find a property by name with case-insensitive fallback.
 *
 * @param page - The Notion page object.
 * @param name - The property name to search for.
 * @returns The property value, or `undefined`.
 */
export function findPropertyByName(
  page: NotionPage,
  name: string,
): { readonly type: string } | undefined {
  if (page.properties[name]) return page.properties[name];

  const lowerName = name.toLowerCase();
  const match = Object.entries(page.properties).find(
    ([key]) => key.toLowerCase() === lowerName,
  );

  return match?.[1];
}
