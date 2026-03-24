/**
 * Jira issue relationship functions.
 *
 * Checks blocker status (via issue links) and children status
 * (via Epic: text convention + native parent JQL).
 */
import type { ChildrenStatus } from '~/types/index.js';

import { jiraIssueLinksResponseSchema } from '~/schemas/index.js';

import { isValidIssueKey, jiraHeaders } from '../api/index.js';

/**
 * Check whether a Jira issue is blocked by unresolved blockers.
 *
 * Fetches the issue's links and checks for inward "Blocks"
 * relationships where the blocking issue is not done.
 *
 * @param baseUrl - The Jira Cloud base URL.
 * @param auth - The Base64-encoded Basic auth string.
 * @param key - The Jira issue key (e.g., `'PROJ-123'`).
 * @returns `true` if any blocker is unresolved, `false` otherwise.
 */
export async function fetchBlockerStatus(
  baseUrl: string,
  auth: string,
  key: string,
): Promise<boolean> {
  if (!isValidIssueKey(key)) return false;

  try {
    const response = await fetch(
      `${baseUrl}/rest/api/3/issue/${key}?fields=issuelinks`,
      { headers: jiraHeaders(auth) },
    );

    if (!response.ok) return false;

    const json: unknown = await response.json();
    const parsed = jiraIssueLinksResponseSchema.safeParse(json);
    if (!parsed.success) return false;

    const links = parsed.data.fields?.issuelinks ?? [];

    return links.some((link) => {
      if (link.type?.name !== 'Blocks') return false;
      if (!link.inwardIssue?.key) return false;
      const categoryKey = link.inwardIssue.fields?.status?.statusCategory?.key;
      return categoryKey ? categoryKey !== 'done' : false;
    });
  } catch (err) {
    console.warn(
      `⚠ fetchBlockerStatus failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

/**
 * Fetch the children status of a Jira epic (dual-mode).
 *
 * Tries the `Epic: {key}` text convention first. Falls back to
 * the native `parent = {key}` JQL for backward compatibility.
 *
 * @param baseUrl - The Jira Cloud base URL.
 * @param auth - The Base64-encoded Basic auth string.
 * @param parentKey - The parent issue key (e.g., `'PROJ-100'`).
 * @returns The children status, or `undefined` on failure.
 */
export async function fetchChildrenStatus(
  baseUrl: string,
  auth: string,
  parentKey: string,
): Promise<ChildrenStatus | undefined> {
  if (!isValidIssueKey(parentKey)) return undefined;

  try {
    const projectPrefix = parentKey.split('-')[0];
    const epicResult = await fetchChildrenByJql(
      baseUrl,
      auth,
      `project = "${projectPrefix}" AND description ~ "Epic: ${parentKey}"`,
    );

    if (epicResult && epicResult.total > 0) return epicResult;

    return await fetchChildrenByJql(baseUrl, auth, `parent = ${parentKey}`);
  } catch (err) {
    console.warn(
      `⚠ fetchChildrenStatus failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return undefined;
  }
}

/** Fetch children status using a JQL query. */
async function fetchChildrenByJql(
  baseUrl: string,
  auth: string,
  jql: string,
): Promise<ChildrenStatus | undefined> {
  const headers = {
    ...jiraHeaders(auth),
    'Content-Type': 'application/json',
  };

  const totalResponse = await fetch(`${baseUrl}/rest/api/3/search/jql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jql, maxResults: 0 }),
  });

  if (!totalResponse.ok) return undefined;

  // Safe cast: only reading total from Jira search response
  const totalJson = (await totalResponse.json()) as { total?: number };
  const total = totalJson.total ?? 0;

  if (total === 0) return { total: 0, incomplete: 0 };

  const incompleteResponse = await fetch(`${baseUrl}/rest/api/3/search/jql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jql: `${jql} AND statusCategory != "done"`,
      maxResults: 0,
    }),
  });

  if (!incompleteResponse.ok) return undefined;

  // Safe cast: only reading total from Jira search response
  const incJson = (await incompleteResponse.json()) as { total?: number };

  return { total, incomplete: incJson.total ?? 0 };
}
