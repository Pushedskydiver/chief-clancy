/**
 * Azure DevOps work item label (tag) operations.
 *
 * Uses read-modify-write via {@link modifyLabelList} because Azure DevOps
 * stores tags as a semicolon-delimited string field. Wrapped in
 * {@link safeLabel} for best-effort error handling.
 */
import type { AzdoCtx } from '../api/index.js';

import { modifyLabelList, safeLabel } from '~/c/shared/label-helpers/index.js';

import {
  buildTagsString,
  fetchWorkItem,
  parseTags,
  parseWorkItemId,
  updateWorkItem,
} from '../api/index.js';

/** Fetch current tags for a work item as a string array. */
async function fetchTags(
  ctx: AzdoCtx,
  workItemId: number,
): Promise<readonly string[] | undefined> {
  const item = await fetchWorkItem(ctx, workItemId);
  return item ? parseTags(item.fields['System.Tags']) : undefined;
}

/** Write updated tags to a work item via JSON Patch. */
async function writeTags(
  ctx: AzdoCtx,
  workItemId: number,
  tags: readonly string[],
): Promise<void> {
  await updateWorkItem({
    ctx,
    id: workItemId,
    patchOps: [
      {
        op: 'replace',
        path: '/fields/System.Tags',
        value: buildTagsString(tags),
      },
    ],
  });
}

/**
 * Add a tag to an Azure DevOps work item (best-effort).
 *
 * @param ctx - Azure DevOps connection context.
 * @param issueKey - The work item key (e.g., `'azdo-42'`).
 * @param label - The tag to add.
 * @returns Resolves when complete (best-effort — never throws).
 */
export async function addLabel(
  ctx: AzdoCtx,
  issueKey: string,
  label: string,
): Promise<void> {
  await safeLabel(async () => {
    const workItemId = parseWorkItemId(issueKey);
    if (workItemId === undefined) return;

    await modifyLabelList({
      fetchCurrent: () => fetchTags(ctx, workItemId),
      writeUpdated: (tags) => writeTags(ctx, workItemId, tags),
      target: label,
      mode: 'add',
    });
  }, 'addLabel');
}

/**
 * Remove a tag from an Azure DevOps work item (best-effort).
 *
 * @param ctx - Azure DevOps connection context.
 * @param issueKey - The work item key (e.g., `'azdo-42'`).
 * @param label - The tag to remove.
 * @returns Resolves when complete (best-effort — never throws).
 */
export async function removeLabel(
  ctx: AzdoCtx,
  issueKey: string,
  label: string,
): Promise<void> {
  await safeLabel(async () => {
    const workItemId = parseWorkItemId(issueKey);
    if (workItemId === undefined) return;

    await modifyLabelList({
      fetchCurrent: () => fetchTags(ctx, workItemId),
      writeUpdated: (tags) => writeTags(ctx, workItemId, tags),
      target: label,
      mode: 'remove',
    });
  }, 'removeLabel');
}
