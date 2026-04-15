/**
 * Notion page relationship functions.
 *
 * Checks blocker status (via "Blocked by" relation + description text)
 * and children status (dual-mode: description text + relation property).
 */
import type { NotionCtx } from './api/helpers.js';
import type { NotionPage } from '~/c/schemas/index.js';
import type { ChildrenStatus } from '~/c/types/index.js';

import {
  fetchPage,
  findPageByKey,
  queryAllPages,
  queryDatabase,
} from './api/api.js';
import {
  findPropertyByName,
  getDescriptionText,
  getPageStatus,
  isCompleteStatus,
  isPageIncomplete,
} from './api/helpers.js';

/** Check whether a page has an active (non-complete) status. */
function hasActiveStatus(page: NotionPage, statusProp: string): boolean {
  const status = getPageStatus(page, statusProp);
  return status !== undefined && !isCompleteStatus(status);
}

// ─── Blocker status ──────────────────────────────────────────────────────────

/** Options for {@link fetchBlockerStatus}. */
type BlockerStatusOpts = {
  readonly ctx: NotionCtx;
  readonly pageId: string;
  readonly statusProp: string;
};

/**
 * Check whether a Notion page is blocked by unresolved blockers.
 *
 * Checks "Blocked by" relation property first, then falls back to
 * description text search for "Blocked by notion-{shortId}" references.
 *
 * @param opts - Connection context, page ID, and status property name.
 * @returns `true` if any blocker is unresolved, `false` otherwise.
 */
export async function fetchBlockerStatus(
  opts: BlockerStatusOpts,
): Promise<boolean> {
  const { ctx, pageId, statusProp } = opts;

  try {
    const page = await fetchPage(ctx.token, pageId, ctx.fetcher);
    if (!page) return false;

    const blocked = await checkRelationBlockers(ctx, page, statusProp);
    if (blocked !== undefined) return blocked;

    return checkDescriptionBlockers({ ctx, page, pageId, statusProp });
  } catch {
    return false;
  }
}

/** Check blockers via "Blocked by" relation property. */
async function checkRelationBlockers(
  ctx: NotionCtx,
  page: NotionPage,
  statusProp: string,
): Promise<boolean | undefined> {
  const blockedByProp = findPropertyByName(page, 'Blocked by');
  if (blockedByProp?.type !== 'relation') return undefined;

  // Safe cast: type guard guarantees relation shape
  const relations = (
    blockedByProp as { type: 'relation'; relation: { id: string }[] }
  ).relation;

  if (!relations.length) return false;

  const blockerPages = await Promise.all(
    relations.map((rel) => fetchPage(ctx.token, rel.id, ctx.fetcher)),
  );

  return blockerPages.some(
    (blockerPage) => !!blockerPage && hasActiveStatus(blockerPage, statusProp),
  );
}

/** Options for description-based blocker check. */
type DescriptionBlockerOpts = {
  readonly ctx: NotionCtx;
  readonly page: NotionPage;
  readonly pageId: string;
  readonly statusProp: string;
};

/** Check blockers via description text "Blocked by notion-{id}" references. */
async function checkDescriptionBlockers(
  opts: DescriptionBlockerOpts,
): Promise<boolean> {
  const { ctx, page, pageId, statusProp } = opts;
  const description = getDescriptionText(page);
  if (!description) return false;

  const blockerMatch = description.match(/Blocked by (notion-[a-f0-9]{8})/gi);
  if (!blockerMatch) return false;

  const selfShortId = pageId.replace(/-/g, '').slice(0, 8);
  const allPages = await queryAllPages({ ctx });
  if (!allPages.length) return false;

  const isBlockedByActive = (match: string): boolean => {
    const shortId = match.replace(/blocked by notion-/i, '').toLowerCase();
    if (shortId === selfShortId) return false;

    const candidate = allPages.find(
      (p) => p.id.replace(/-/g, '').slice(0, 8) === shortId,
    );
    return candidate != null && hasActiveStatus(candidate, statusProp);
  };

  return blockerMatch.some(isBlockedByActive);
}

// ─── Children status ─────────────────────────────────────────────────────────

/** Options for {@link fetchChildrenStatus}. */
type ChildrenStatusOpts = {
  readonly ctx: NotionCtx;
  readonly parentKey: string;
  readonly parentProp: string;
  readonly statusProp: string;
};

/**
 * Fetch the children status of a parent page (dual-mode).
 *
 * Mode 1: Search descriptions for `Epic: notion-{shortId}` text.
 * Mode 2: Query by parent relation property as fallback.
 *
 * @param opts - Connection context, parent key, and property names.
 * @returns The children status, or `undefined` on failure.
 */
export async function fetchChildrenStatus(
  opts: ChildrenStatusOpts,
): Promise<ChildrenStatus | undefined> {
  const { ctx, parentKey, parentProp, statusProp } = opts;

  try {
    const epicRef = `Epic: ${parentKey}`;
    const textResult = await fetchChildrenByDescription(
      ctx,
      epicRef,
      statusProp,
    );
    if (textResult && textResult.total > 0) return textResult;

    const parentPage = await findPageByKey(ctx, parentKey);
    if (!parentPage) return undefined;

    return await fetchChildrenByRelation({
      ctx,
      parentPageId: parentPage.id,
      parentProp,
      statusProp,
    });
  } catch {
    return undefined;
  }
}

/** Count children by searching descriptions for an Epic: reference. */
async function fetchChildrenByDescription(
  ctx: NotionCtx,
  descriptionRef: string,
  statusProp: string,
): Promise<ChildrenStatus | undefined> {
  const allPages = await queryAllPages({ ctx });
  if (!allPages.length) return undefined;

  const matching = allPages.filter((page) => {
    const desc = getDescriptionText(page);
    return desc?.includes(descriptionRef);
  });

  return countStatus(matching, statusProp);
}

/** Options for relation-based children query. */
type RelationChildrenOpts = {
  readonly ctx: NotionCtx;
  readonly parentPageId: string;
  readonly parentProp: string;
  readonly statusProp: string;
};

/** Count children via relation property filter. */
async function fetchChildrenByRelation(
  opts: RelationChildrenOpts,
): Promise<ChildrenStatus | undefined> {
  const { ctx, parentPageId, parentProp, statusProp } = opts;
  const result = await queryDatabase({
    ctx,
    filter: {
      property: parentProp,
      relation: { contains: parentPageId },
    },
  });

  if (!result) return undefined;
  return countStatus([...result.results], statusProp);
}

/** Count total and incomplete pages. */
function countStatus(
  pages: readonly NotionPage[],
  statusProp: string,
): ChildrenStatus {
  return {
    total: pages.length,
    incomplete: pages.filter((p) => isPageIncomplete(p, statusProp)).length,
  };
}
