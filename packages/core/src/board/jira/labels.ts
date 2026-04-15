/**
 * Jira issue label operations.
 *
 * Uses read-modify-write via {@link modifyLabelList} because Jira's
 * label API requires reading the current labels and writing the full
 * list back. Wrapped in {@link safeLabel} for best-effort error handling.
 */
import type { Fetcher } from '~/c/shared/http/fetch-and-parse.js';

import { jiraIssueLabelsResponseSchema } from '~/c/schemas/jira.js';
import { modifyLabelList, safeLabel } from '~/c/shared/label-helpers.js';

import { isValidIssueKey, jiraHeaders } from './api.js';

/** Context for Jira label operations. */
type JiraLabelContext = {
  readonly baseUrl: string;
  readonly auth: string;
  readonly fetcher?: Fetcher;
};

/** Fetch current labels for a Jira issue. */
async function fetchLabels(
  ctx: JiraLabelContext,
  issueKey: string,
): Promise<readonly string[] | undefined> {
  const doFetch = ctx.fetcher ?? fetch;
  const res = await doFetch(
    `${ctx.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=labels`,
    { headers: jiraHeaders(ctx.auth) },
  );

  if (!res.ok) {
    console.warn(`⚠ label GET ${issueKey} failed: HTTP ${res.status}`);
    return undefined;
  }

  const parsed = jiraIssueLabelsResponseSchema.safeParse(await res.json());
  if (!parsed.success) return undefined;
  return parsed.data.fields?.labels ?? [];
}

/** Write updated labels to a Jira issue. */
async function writeLabels(
  ctx: JiraLabelContext,
  issueKey: string,
  labels: readonly string[],
): Promise<void> {
  const doFetch = ctx.fetcher ?? fetch;
  const res = await doFetch(
    `${ctx.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}`,
    {
      method: 'PUT',
      headers: { ...jiraHeaders(ctx.auth), 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { labels } }),
    },
  );

  if (!res.ok) {
    console.warn(`⚠ label PUT ${issueKey} returned HTTP ${res.status}`);
  }
}

/**
 * Add a label to a Jira issue (best-effort).
 *
 * @param ctx - Jira connection context.
 * @param issueKey - The Jira issue key.
 * @param label - The label to add.
 * @returns Resolves when complete (best-effort — never throws).
 */
export async function addLabel(
  ctx: JiraLabelContext,
  issueKey: string,
  label: string,
): Promise<void> {
  await safeLabel(async () => {
    if (!isValidIssueKey(issueKey)) return;

    await modifyLabelList({
      fetchCurrent: () => fetchLabels(ctx, issueKey),
      writeUpdated: (labels) => writeLabels(ctx, issueKey, labels),
      target: label,
      mode: 'add',
    });
  }, 'addLabel');
}

/**
 * Remove a label from a Jira issue (best-effort).
 *
 * @param ctx - Jira connection context.
 * @param issueKey - The Jira issue key.
 * @param label - The label to remove.
 * @returns Resolves when complete (best-effort — never throws).
 */
export async function removeLabel(
  ctx: JiraLabelContext,
  issueKey: string,
  label: string,
): Promise<void> {
  await safeLabel(async () => {
    if (!isValidIssueKey(issueKey)) return;

    await modifyLabelList({
      fetchCurrent: () => fetchLabels(ctx, issueKey),
      writeUpdated: (labels) => writeLabels(ctx, issueKey, labels),
      target: label,
      mode: 'remove',
    });
  }, 'removeLabel');
}
