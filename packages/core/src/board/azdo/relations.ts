/**
 * Azure DevOps work item relationship functions.
 *
 * Checks blocker status (via dependency-reverse relations) and children
 * status (dual-mode: Epic: text convention + native hierarchy links).
 */
import type { AzdoCtx } from './api/helpers.js';
import type { AzdoWorkItem } from '~/c/schemas/azdo/azdo.js';
import type { ChildrenStatus } from '~/c/types/board.js';

import { azdoWiqlLinkResponseSchema } from '~/c/schemas/azdo/azdo.js';
import { fetchAndParse } from '~/c/shared/http/fetch-and-parse.js';

import { fetchWorkItem, fetchWorkItems, runWiql } from './api/api.js';
import {
  apiBase,
  AZDO_API_VERSION,
  azdoHeaders,
  extractIdFromRelationUrl,
  isSafeWiqlValue,
} from './api/helpers.js';

/** Done/Closed states — used for blocker resolution check. */
const DONE_STATES = new Set(['Done', 'Closed', 'Completed', 'Resolved']);

/** Check if a work item's state is not in a done/closed state. */
function isIncomplete(item: AzdoWorkItem): boolean {
  const state = item.fields['System.State'];
  return !state || !DONE_STATES.has(state);
}

/** Count total and incomplete items from a work item list. */
function countStatus(items: readonly AzdoWorkItem[]): ChildrenStatus {
  return {
    total: items.length,
    incomplete: items.filter((item) => isIncomplete(item)).length,
  };
}

/**
 * Check whether a work item is blocked by unresolved predecessors.
 *
 * Looks for relations with `rel: "System.LinkTypes.Dependency-Reverse"`
 * (predecessor). Fetches each predecessor and checks if its state is done.
 *
 * @param ctx - Azure DevOps connection context.
 * @param workItemId - The work item ID to check.
 * @returns `true` if any predecessor is unresolved, `false` otherwise.
 */
export async function fetchBlockerStatus(
  ctx: AzdoCtx,
  workItemId: number,
): Promise<boolean> {
  try {
    const item = await fetchWorkItem(ctx, workItemId);
    if (!item) return false;

    const predecessors = (item.relations ?? []).filter(
      (r) => r.rel === 'System.LinkTypes.Dependency-Reverse',
    );

    if (!predecessors.length) return false;

    const predIds = predecessors
      .map((p) => extractIdFromRelationUrl(p.url))
      .filter((id): id is number => id !== undefined);

    if (!predIds.length) return false;

    const predItems = await fetchWorkItems(ctx, predIds);
    return predItems.some((item) => isIncomplete(item));
  } catch {
    return false;
  }
}

// ─── Children status ─────────────────────────────────────────────────────────

/** Options for {@link fetchChildrenStatus}. */
type ChildrenStatusOpts = {
  readonly ctx: AzdoCtx;
  readonly parentId: number;
  readonly parentKey?: string;
};

/**
 * Fetch the children status of a parent work item (dual-mode).
 *
 * Mode 1: Tries the `Epic: azdo-{parentId}` text convention (WIQL).
 * Mode 2: Falls back to native hierarchy links (child work items).
 *
 * @param opts - Connection context, parent ID, and optional parent key.
 * @returns The children status, or `undefined` on failure.
 */
export async function fetchChildrenStatus(
  opts: ChildrenStatusOpts,
): Promise<ChildrenStatus | undefined> {
  const { ctx, parentId, parentKey } = opts;

  try {
    if (parentKey) {
      const epicRef = `Epic: ${parentKey}`;
      const result = await fetchChildrenByDescription(ctx, epicRef);
      if (result && result.total > 0) return result;
    }

    return await fetchChildrenByLinks(ctx, parentId);
  } catch {
    return undefined;
  }
}

/** Count children by searching descriptions for an Epic: reference. */
async function fetchChildrenByDescription(
  ctx: AzdoCtx,
  descriptionRef: string,
): Promise<ChildrenStatus | undefined> {
  if (!isSafeWiqlValue(ctx.project) || !isSafeWiqlValue(descriptionRef)) {
    return undefined;
  }

  const wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${ctx.project}' AND [System.Description] CONTAINS '${descriptionRef}'`;

  const ids = await runWiql(ctx, wiql);
  if (!ids.length) return { total: 0, incomplete: 0 };

  const items = await fetchWorkItems(ctx, ids);
  return countStatus(items);
}

/** Count children via hierarchy link queries. */
async function fetchChildrenByLinks(
  ctx: AzdoCtx,
  parentId: number,
): Promise<ChildrenStatus | undefined> {
  if (Number.isNaN(parentId)) return undefined;

  const wiql = `SELECT [System.Id] FROM WorkItemLinks WHERE [Source].[System.Id] = ${String(parentId)} AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward' MODE (MustContain)`;

  const data = await fetchAndParse(
    `${apiBase(ctx.org, ctx.project)}/wit/wiql?api-version=${AZDO_API_VERSION}`,
    {
      method: 'POST',
      headers: azdoHeaders(ctx.pat),
      body: JSON.stringify({ query: wiql }),
    },
    {
      schema: azdoWiqlLinkResponseSchema,
      label: 'Azure DevOps WIQL links',
      fetcher: ctx.fetcher,
    },
  );

  if (!data) return undefined;

  const relations = data.workItemRelations ?? [];
  const childIds = relations
    .map((r) => r.target?.id)
    .filter((id): id is number => id !== undefined && id !== parentId);

  if (!childIds.length) return { total: 0, incomplete: 0 };

  const items = await fetchWorkItems(ctx, childIds);
  return countStatus(items);
}
