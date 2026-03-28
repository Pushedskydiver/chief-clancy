/**
 * Jira Cloud API functions.
 *
 * Low-level functions for interacting with the Jira REST API.
 * Uses the POST `/rest/api/3/search/jql` endpoint (old GET `/search`
 * was removed by Atlassian in August 2025).
 */
import type { Fetcher } from '~/c/shared/http/index.js';
import type { PingResult } from '~/c/types/index.js';

import {
  jiraSearchResponseSchema,
  jiraTransitionsResponseSchema,
} from '~/c/schemas/index.js';
import { fetchAndParse, pingEndpoint } from '~/c/shared/http/index.js';

/** Pattern for safe JQL values (prevents injection). */
const SAFE_VALUE_PATTERN = /^[a-zA-Z0-9 _\-'.]+$/;

/** Pattern for valid Jira issue keys (e.g. `PROJ-123`). */
const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9]+-\d+$/;

/**
 * Build Jira Basic auth header value.
 *
 * @param user - The Jira username (email).
 * @param token - The Jira API token.
 * @returns The Base64-encoded `user:token` string for Basic auth.
 */
export function buildAuthHeader(user: string, token: string): string {
  return Buffer.from(`${user}:${token}`).toString('base64');
}

/**
 * Build standard Jira API request headers.
 *
 * @param auth - The Base64-encoded Basic auth string.
 * @returns Headers object for Jira REST API requests.
 */
export function jiraHeaders(auth: string): Record<string, string> {
  return {
    Authorization: `Basic ${auth}`,
    Accept: 'application/json',
  };
}

/**
 * Validate that a value is safe for use in JQL queries.
 *
 * @param value - The value to validate.
 * @returns `true` if safe for JQL interpolation.
 */
export function isSafeJqlValue(value: string): boolean {
  return SAFE_VALUE_PATTERN.test(value);
}

/**
 * Validate that a string is a valid Jira issue key.
 *
 * @param key - The string to validate.
 * @returns `true` if it matches `PROJ-123` format.
 */
export function isValidIssueKey(key: string): boolean {
  return ISSUE_KEY_PATTERN.test(key);
}

/** Options for {@link pingJira}. */
type PingJiraOpts = {
  readonly baseUrl: string;
  readonly projectKey: string;
  readonly auth: string;
  readonly fetcher?: Fetcher;
};

/**
 * Ping the Jira API to verify connectivity and credentials.
 *
 * @param opts - Base URL, project key, auth, and optional fetcher.
 * @returns Ping result with `ok` and optional `error`.
 */
export async function pingJira(opts: PingJiraOpts): Promise<PingResult> {
  const { baseUrl, projectKey, auth, fetcher } = opts;
  return pingEndpoint({
    url: `${baseUrl}/rest/api/3/project/${projectKey}`,
    headers: jiraHeaders(auth),
    statusErrors: {
      401: '✗ Jira auth failed — check credentials',
      403: '✗ Jira permission denied for this project',
      404: `✗ Jira project "${projectKey}" not found`,
    },
    networkError: '✗ Could not reach Jira — check network',
    fetcher,
  });
}

/** Options for {@link buildJql}. */
type BuildJqlOpts = {
  readonly projectKey: string;
  readonly status: string;
  readonly sprint?: string;
  readonly label?: string;
  readonly excludeHitl?: boolean;
};

/**
 * Build a JQL query for fetching tickets.
 *
 * @param opts - Project key, status, and optional filters.
 * @returns The JQL query string.
 */
export function buildJql(opts: BuildJqlOpts): string {
  const { projectKey, status, sprint, label, excludeHitl } = opts;
  const parts = [
    `project="${projectKey}"`,
    ...(sprint ? ['sprint in openSprints()'] : []),
    ...(label ? [`labels = "${label}"`] : []),
    ...(excludeHitl ? ['labels != "clancy:hitl"'] : []),
    'assignee=currentUser()',
    `status="${status}"`,
  ];

  return `${parts.join(' AND ')} ORDER BY priority ASC`;
}

/**
 * Extract all text from a Jira ADF (Atlassian Document Format) description.
 *
 * Recursively walks the ADF tree and collects all string values.
 *
 * @param adf - The ADF description object (or `undefined`).
 * @returns A single string with all text content joined by spaces.
 */
export function extractAdfText(adf: unknown): string {
  if (!adf || typeof adf !== 'object') return '';
  return collectStrings(adf).join(' ');
}

/** Recursively collect all string values from a nested structure. */
function collectStrings(node: unknown): readonly string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectStrings);
  if (node && typeof node === 'object') {
    return Object.values(node as Record<string, unknown>).flatMap(
      collectStrings,
    );
  }
  return [];
}

/** Jira ticket with epic, blocker, and label info. */
export type JiraTicket = {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly provider: 'jira';
  readonly epicKey?: string;
  readonly blockers: readonly string[];
  readonly labels?: readonly string[];
};

/** Options for {@link fetchTickets}. */
type FetchTicketsOpts = {
  readonly baseUrl: string;
  readonly auth: string;
  readonly projectKey: string;
  readonly status: string;
  readonly sprint?: string;
  readonly label?: string;
  readonly excludeHitl?: boolean;
  readonly limit?: number;
  readonly fetcher?: Fetcher;
};

/**
 * Fetch candidate tickets from Jira.
 *
 * @param opts - Connection details, project key, and optional filters.
 * @returns Array of fetched tickets (may be empty).
 */
export async function fetchTickets(
  opts: FetchTicketsOpts,
): Promise<readonly JiraTicket[]> {
  const { baseUrl, auth, projectKey, status } = opts;
  const { sprint, label, excludeHitl, limit = 5, fetcher } = opts;

  const jql = buildJql({ projectKey, status, sprint, label, excludeHitl });

  const data = await fetchAndParse(
    `${baseUrl}/rest/api/3/search/jql`,
    {
      method: 'POST',
      headers: { ...jiraHeaders(auth), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jql,
        maxResults: limit,
        fields: [
          'summary',
          'description',
          'issuelinks',
          'parent',
          'customfield_10014',
          'labels',
        ],
      }),
    },
    { schema: jiraSearchResponseSchema, label: 'Jira API', fetcher },
  );

  if (!data) return [];

  return data.issues.map((issue) => mapIssueToTicket(issue));
}

/** Shape of a Jira issue from the search response. */
type JiraIssueFields = {
  readonly summary: string;
  readonly description?: unknown;
  readonly issuelinks?: ReadonlyArray<{
    readonly type?: { readonly name?: string };
    readonly inwardIssue?: { readonly key?: string };
  }>;
  readonly parent?: { readonly key?: string };
  readonly customfield_10014?: string | null;
  readonly labels?: readonly string[];
};

/** Extract blocker issue keys from Jira issue links. */
function extractBlockers(
  links: JiraIssueFields['issuelinks'],
): readonly string[] {
  return (links ?? [])
    .filter((link) => link.type?.name === 'Blocks' && link.inwardIssue?.key)
    .map((link) => link.inwardIssue?.key)
    .filter((key): key is string => Boolean(key));
}

/** Map a Jira search result issue to a JiraTicket. */
function mapIssueToTicket(issue: {
  readonly key: string;
  // Safe cast: fields shape is validated by jiraSearchResponseSchema
  readonly fields: JiraIssueFields;
}): JiraTicket {
  const { fields } = issue;

  return {
    key: issue.key,
    title: fields.summary,
    description: extractAdfText(fields.description),
    provider: 'jira',
    epicKey: fields.parent?.key ?? fields.customfield_10014 ?? undefined,
    blockers: extractBlockers(fields.issuelinks),
    labels: fields.labels,
  };
}

/** Options for {@link transitionIssue}. */
type TransitionOpts = {
  readonly baseUrl: string;
  readonly auth: string;
  readonly issueKey: string;
  readonly statusName: string;
  readonly fetcher?: Fetcher;
};

/**
 * Look up a Jira transition ID by status name.
 *
 * @param opts - Connection details and target status.
 * @returns The transition ID, or `undefined` if not found.
 */
export async function lookupTransitionId(
  opts: TransitionOpts,
): Promise<string | undefined> {
  const { baseUrl, auth, issueKey, statusName } = opts;
  if (!isValidIssueKey(issueKey)) return undefined;

  const data = await fetchAndParse(
    `${baseUrl}/rest/api/3/issue/${issueKey}/transitions`,
    { headers: jiraHeaders(auth) },
    {
      schema: jiraTransitionsResponseSchema,
      label: 'Jira transitions',
      fetcher: opts.fetcher,
    },
  );

  return data?.transitions.find((t) => t.name === statusName)?.id;
}

/**
 * Transition a Jira issue to a new status.
 *
 * @param opts - Connection details, issue key, and target status.
 * @returns `true` if the transition succeeded.
 */
export async function transitionIssue(opts: TransitionOpts): Promise<boolean> {
  const { baseUrl, auth, issueKey, statusName, fetcher } = opts;

  try {
    const transitionId = await lookupTransitionId(opts);

    if (!transitionId) {
      console.warn(
        `⚠ Jira transition "${statusName}" not found for ${issueKey}`,
      );
      return false;
    }

    const doFetch = fetcher ?? fetch;
    const response = await doFetch(
      `${baseUrl}/rest/api/3/issue/${issueKey}/transitions`,
      {
        method: 'POST',
        headers: { ...jiraHeaders(auth), 'Content-Type': 'application/json' },
        body: JSON.stringify({ transition: { id: transitionId } }),
      },
    );

    return response.ok;
  } catch {
    return false;
  }
}
