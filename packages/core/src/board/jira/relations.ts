/**
 * Jira issue relationship functions.
 *
 * Checks blocker status (via issue links) and children status
 * (via Epic: text convention + native parent JQL).
 */
import type { Fetcher } from '~/c/shared/http/fetch-and-parse.js';
import type { ChildrenStatus } from '~/c/types/board.js';

import { jiraIssueLinksResponseSchema } from '~/c/schemas/jira.js';
import { z } from 'zod/mini';

import { isValidIssueKey, jiraHeaders } from './api.js';

const jiraSearchCountSchema = z.object({ total: z.optional(z.number()) });

/** Options for {@link fetchBlockerStatus}. */
type FetchBlockerOpts = {
  readonly baseUrl: string;
  readonly auth: string;
  readonly key: string;
  readonly fetcher?: Fetcher;
};

/**
 * Check whether a Jira issue is blocked by unresolved blockers.
 *
 * Fetches the issue's links and checks for inward "Blocks"
 * relationships where the blocking issue is not done.
 *
 * @param opts - Connection details and issue key.
 * @returns `true` if any blocker is unresolved, `false` otherwise.
 */
export async function fetchBlockerStatus(
  opts: FetchBlockerOpts,
): Promise<boolean> {
  const { baseUrl, auth, key, fetcher } = opts;
  if (!isValidIssueKey(key)) return false;

  const doFetch = fetcher ?? fetch;
  try {
    const response = await doFetch(
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

/** Options for {@link fetchChildrenStatus}. */
type FetchChildrenOpts = {
  readonly baseUrl: string;
  readonly auth: string;
  readonly parentKey: string;
  readonly fetcher?: Fetcher;
};

/**
 * Fetch the children status of a Jira epic (dual-mode).
 *
 * Tries the `Epic: {key}` text convention first. Falls back to
 * the native `parent = {key}` JQL for backward compatibility.
 *
 * @param opts - Connection details and parent issue key.
 * @returns The children status, or `undefined` on failure.
 */
export async function fetchChildrenStatus(
  opts: FetchChildrenOpts,
): Promise<ChildrenStatus | undefined> {
  const { baseUrl, auth, parentKey, fetcher } = opts;
  if (!isValidIssueKey(parentKey)) return undefined;

  try {
    const projectPrefix = parentKey.split('-')[0];
    const shared = { baseUrl, auth, fetcher };
    const epicResult = await fetchChildrenByJql({
      ...shared,
      jql: `project = "${projectPrefix}" AND description ~ "Epic: ${parentKey}"`,
    });

    if (epicResult && epicResult.total > 0) return epicResult;

    return await fetchChildrenByJql({
      ...shared,
      jql: `parent = ${parentKey}`,
    });
  } catch (err) {
    console.warn(
      `⚠ fetchChildrenStatus failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return undefined;
  }
}

/** Options for {@link fetchChildrenByJql}. */
type JqlChildrenOpts = {
  readonly baseUrl: string;
  readonly auth: string;
  readonly jql: string;
  readonly fetcher?: Fetcher;
};

/** Fetch children status using a JQL query. */
async function fetchChildrenByJql(
  opts: JqlChildrenOpts,
): Promise<ChildrenStatus | undefined> {
  const { baseUrl, auth, jql, fetcher } = opts;
  const headers = {
    ...jiraHeaders(auth),
    'Content-Type': 'application/json',
  };
  const doFetch = fetcher ?? fetch;

  const totalResponse = await doFetch(`${baseUrl}/rest/api/3/search/jql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jql, maxResults: 0 }),
  });

  if (!totalResponse.ok) return undefined;

  const totalParsed = jiraSearchCountSchema.safeParse(
    await totalResponse.json(),
  );
  if (!totalParsed.success) return undefined;
  const total = totalParsed.data.total ?? 0;

  if (total === 0) return { total: 0, incomplete: 0 };

  const incompleteResponse = await doFetch(`${baseUrl}/rest/api/3/search/jql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jql: `${jql} AND statusCategory != "done"`,
      maxResults: 0,
    }),
  });

  if (!incompleteResponse.ok) return undefined;

  const incParsed = jiraSearchCountSchema.safeParse(
    await incompleteResponse.json(),
  );

  return {
    total,
    incomplete: incParsed.success ? (incParsed.data.total ?? 0) : total,
  };
}
