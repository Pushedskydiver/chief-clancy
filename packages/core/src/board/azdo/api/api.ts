/**
 * Azure DevOps REST API functions.
 *
 * Low-level functions for interacting with the Azure DevOps REST API.
 * Pure helpers (auth, headers, parsing) are in `helpers.ts`.
 */
import type { AzdoCtx } from './helpers.js';
import type { AzdoWorkItem } from '~/c/schemas/index.js';
import type { PingResult } from '~/c/types/index.js';

import {
  azdoWiqlResponseSchema,
  azdoWorkItemsBatchResponseSchema,
  azdoWorkItemSchema,
} from '~/c/schemas/index.js';
import { fetchAndParse, pingEndpoint } from '~/c/shared/http/index.js';

import {
  apiBase,
  AZDO_API_VERSION,
  azdoHeaders,
  azdoPatchHeaders,
  extractIdFromRelationUrl,
  isSafeWiqlValue,
  parseTags,
} from './helpers.js';

/**
 * Ping the Azure DevOps API to verify connectivity and credentials.
 *
 * @param ctx - Azure DevOps connection context.
 * @returns Ping result with `ok` and optional `error`.
 */
export async function pingAzdo(ctx: AzdoCtx): Promise<PingResult> {
  const url = `https://dev.azure.com/${encodeURIComponent(ctx.org)}/_apis/projects/${encodeURIComponent(ctx.project)}?api-version=${AZDO_API_VERSION}`;

  return pingEndpoint({
    url,
    headers: azdoHeaders(ctx.pat),
    statusErrors: {
      401: '✗ Azure DevOps auth failed — check AZDO_PAT',
      403: '✗ Azure DevOps auth failed — check AZDO_PAT',
    },
    networkError: '✗ Could not reach Azure DevOps — check network',
    fetcher: ctx.fetcher,
  });
}

/**
 * Run a WIQL query against Azure DevOps.
 *
 * @param ctx - Azure DevOps connection context.
 * @param query - The WIQL query string.
 * @returns Array of work item IDs, or an empty array on failure.
 */
export async function runWiql(
  ctx: AzdoCtx,
  query: string,
): Promise<readonly number[]> {
  const data = await fetchAndParse(
    `${apiBase(ctx.org, ctx.project)}/wit/wiql?api-version=${AZDO_API_VERSION}`,
    {
      method: 'POST',
      headers: azdoHeaders(ctx.pat),
      body: JSON.stringify({ query }),
    },
    {
      schema: azdoWiqlResponseSchema,
      label: 'Azure DevOps WIQL',
      fetcher: ctx.fetcher,
    },
  );

  return data ? data.workItems.map((wi) => wi.id) : [];
}

/**
 * Fetch a single work item by ID.
 *
 * @param ctx - Azure DevOps connection context.
 * @param id - The work item ID.
 * @returns The work item, or `undefined` on failure.
 */
export async function fetchWorkItem(
  ctx: AzdoCtx,
  id: number,
): Promise<AzdoWorkItem | undefined> {
  return fetchAndParse(
    `${apiBase(ctx.org, ctx.project)}/wit/workitems/${String(id)}?$expand=relations&api-version=${AZDO_API_VERSION}`,
    { headers: azdoHeaders(ctx.pat) },
    {
      schema: azdoWorkItemSchema,
      label: 'Azure DevOps work item',
      fetcher: ctx.fetcher,
    },
  );
}

/** A JSON Patch operation for Azure DevOps work item updates. */
type JsonPatchOp = {
  readonly op: 'add' | 'replace' | 'remove' | 'test';
  readonly path: string;
  readonly value?: unknown;
};

/** Options for {@link updateWorkItem}. */
type UpdateWorkItemOpts = {
  readonly ctx: AzdoCtx;
  readonly id: number;
  readonly patchOps: readonly JsonPatchOp[];
};

/**
 * Update a work item using JSON Patch operations.
 *
 * @param opts - Connection context, work item ID, and patch operations.
 * @returns `true` if the update succeeded.
 */
export async function updateWorkItem(
  opts: UpdateWorkItemOpts,
): Promise<boolean> {
  const { ctx, id, patchOps } = opts;
  const doFetch = ctx.fetcher ?? fetch;

  try {
    const response = await doFetch(
      `${apiBase(ctx.org, ctx.project)}/wit/workitems/${String(id)}?api-version=${AZDO_API_VERSION}`,
      {
        method: 'PATCH',
        headers: azdoPatchHeaders(ctx.pat),
        body: JSON.stringify(patchOps),
      },
    );

    return response.ok;
  } catch {
    return false;
  }
}

// ─── Batch fetch ─────────────────────────────────────────────────────────────

/** Maximum work items per Azure DevOps batch request. */
const BATCH_SIZE = 200;

/** Split an array into chunks of a given size. */
function chunk<T>(arr: readonly T[], size: number): readonly (readonly T[])[] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );
}

/** Fetch a single batch of work items by comma-separated IDs. */
async function fetchBatch(
  ctx: AzdoCtx,
  batch: readonly number[],
): Promise<readonly AzdoWorkItem[]> {
  const idString = batch.join(',');
  const data = await fetchAndParse(
    `${apiBase(ctx.org, ctx.project)}/wit/workitems?ids=${idString}&$expand=relations&api-version=${AZDO_API_VERSION}`,
    { headers: azdoHeaders(ctx.pat) },
    {
      schema: azdoWorkItemsBatchResponseSchema,
      label: 'Azure DevOps work items batch',
      fetcher: ctx.fetcher,
    },
  );

  return data ? data.value : [];
}

/**
 * Batch-fetch work items by IDs (up to 200 per request).
 *
 * @param ctx - Azure DevOps connection context.
 * @param ids - Array of work item IDs to fetch.
 * @returns Array of work items, or an empty array on failure.
 */
export async function fetchWorkItems(
  ctx: AzdoCtx,
  ids: readonly number[],
): Promise<readonly AzdoWorkItem[]> {
  if (!ids.length) return [];

  const batches = chunk(ids, BATCH_SIZE);
  const results = await Promise.all(
    batches.map((batch) => fetchBatch(ctx, batch)),
  );

  return results.flat();
}

// ─── High-level fetch ────────────────────────────────────────────────────────

/** Azure DevOps ticket with work item ID and optional tags. */
export type AzdoTicket = {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly workItemId: number;
  readonly parentId?: number;
  readonly labels?: readonly string[];
};

/**
 * Convert a raw AzdoWorkItem to an AzdoTicket.
 *
 * @param item - The raw work item from the API.
 * @returns A normalised AzdoTicket.
 */
export function workItemToTicket(item: AzdoWorkItem): AzdoTicket {
  const tags = parseTags(item.fields['System.Tags']);

  const parentRelation = (item.relations ?? []).find(
    (rel) => rel.rel === 'System.LinkTypes.Hierarchy-Reverse',
  );
  const parentId = parentRelation
    ? extractIdFromRelationUrl(parentRelation.url)
    : undefined;

  return {
    key: `azdo-${String(item.id)}`,
    title: item.fields['System.Title'] ?? '',
    description: item.fields['System.Description'] ?? '',
    workItemId: item.id,
    parentId,
    labels: tags,
  };
}

/** Options for {@link fetchTickets}. */
type FetchTicketsOpts = {
  readonly ctx: AzdoCtx;
  readonly status: string;
  readonly wit?: string;
  readonly excludeHitl?: boolean;
  readonly label?: string;
  readonly limit?: number;
};

/** Build the WIQL query for fetching tickets. */
function buildWiql(opts: FetchTicketsOpts): string | undefined {
  const { ctx, status, wit } = opts;

  if (!isSafeWiqlValue(ctx.project) || !isSafeWiqlValue(status)) {
    return undefined;
  }
  if (wit && !isSafeWiqlValue(wit)) return undefined;

  const parts = [
    `[System.TeamProject] = '${ctx.project}'`,
    `[System.State] = '${status}'`,
    '[System.AssignedTo] = @Me',
    ...(wit ? [`[System.WorkItemType] = '${wit}'`] : []),
  ];

  return `SELECT [System.Id] FROM WorkItems WHERE ${parts.join(' AND ')} ORDER BY [System.CreatedDate] ASC`;
}

/**
 * Fetch work items matching a WIQL query and convert to AzdoTicket format.
 *
 * Two-step fetch: WIQL returns IDs, then batch fetch gets details.
 *
 * @param opts - Connection context, status, and optional filters.
 * @returns Array of AzdoTickets.
 */
export async function fetchTickets(
  opts: FetchTicketsOpts,
): Promise<readonly AzdoTicket[]> {
  const { ctx, excludeHitl, label, limit = 5 } = opts;

  const wiql = buildWiql(opts);
  if (!wiql) return [];

  const ids = await runWiql(ctx, wiql);
  if (!ids.length) return [];

  // Fetch up to 2x limit to allow for client-side filtering
  const limitedIds = ids.slice(0, limit * 2);
  const items = await fetchWorkItems(ctx, limitedIds);

  const tickets = items.map(workItemToTicket);

  const hitlFiltered = excludeHitl
    ? tickets.filter((t) => !t.labels?.includes('clancy:hitl'))
    : tickets;

  const labelFiltered = label
    ? hitlFiltered.filter((t) => t.labels?.includes(label))
    : hitlFiltered;

  return labelFiltered.slice(0, limit);
}
