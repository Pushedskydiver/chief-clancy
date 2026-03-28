/**
 * Linear GraphQL API functions.
 *
 * Low-level functions for interacting with the Linear GraphQL API.
 * Personal API keys are passed directly (no "Bearer" prefix) per
 * Linear's documentation.
 */
import type { Fetcher } from '~/c/shared/http/index.js';
import type { PingResult } from '~/c/types/index.js';

import {
  linearIssuesResponseSchema,
  linearViewerResponseSchema,
} from '~/c/schemas/index.js';

/** Linear GraphQL API endpoint. */
const LINEAR_API = 'https://api.linear.app/graphql';

const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Build standard Linear API request headers.
 *
 * Personal API keys do NOT use "Bearer" prefix — only OAuth tokens do.
 *
 * @param apiKey - The Linear personal API key.
 * @returns Headers object for Linear GraphQL requests.
 */
export function linearHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: apiKey,
    'Content-Type': 'application/json',
  };
}

/**
 * Validate that a team ID is safe for use in GraphQL variables.
 *
 * @param teamId - The Linear team ID to validate.
 * @returns `true` if the ID matches the safe pattern.
 */
export function isValidTeamId(teamId: string): boolean {
  return SAFE_ID_PATTERN.test(teamId);
}

/** Build a GraphQL POST request init. */
function graphqlInit(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>,
): RequestInit {
  return {
    method: 'POST',
    headers: linearHeaders(apiKey),
    body: JSON.stringify({ query, variables }),
  };
}

/** Options for {@link linearGraphql}. */
type LinearGraphqlOpts = {
  readonly apiKey: string;
  readonly query: string;
  readonly variables?: Record<string, unknown>;
  readonly fetcher?: Fetcher;
};

/**
 * Make a GraphQL request to the Linear API.
 *
 * @param opts - API key, query, optional variables, and optional fetcher.
 * @returns The raw JSON response, or `undefined` on failure.
 */
export async function linearGraphql(opts: LinearGraphqlOpts): Promise<unknown> {
  const { apiKey, query, variables, fetcher } = opts;
  const doFetch = fetcher ?? fetch;
  const response = await doFetch(
    LINEAR_API,
    graphqlInit(apiKey, query, variables),
  ).catch((err: unknown) => {
    console.warn(
      `⚠ Linear API request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return undefined;
  });

  if (!response) return undefined;

  if (!response.ok) {
    console.warn(`⚠ Linear API returned HTTP ${response.status}`);
    return undefined;
  }

  try {
    return await response.json();
  } catch {
    console.warn('⚠ Linear API returned invalid JSON');
    return undefined;
  }
}

/**
 * Evaluate a raw ping response from Linear.
 *
 * @param response - The fetch response, or `undefined` on network failure.
 * @returns A failure result, or `undefined` if the response needs JSON validation.
 */
function evaluatePingResponse(
  response: Response | undefined,
): PingResult | undefined {
  if (!response) {
    return { ok: false, error: '✗ Could not reach Linear — check network' };
  }

  if (!response.ok) {
    return response.status === 401 || response.status === 403
      ? { ok: false, error: '✗ Linear auth failed — check LINEAR_API_KEY' }
      : { ok: false, error: `✗ Linear API returned HTTP ${response.status}` };
  }

  return undefined;
}

/**
 * Ping the Linear API to verify connectivity and credentials.
 *
 * @param apiKey - The Linear personal API key.
 * @param fetcher - Optional custom fetch function for DI in tests.
 * @returns Ping result with `ok` and optional `error`.
 */
export async function pingLinear(
  apiKey: string,
  fetcher?: Fetcher,
): Promise<PingResult> {
  const doFetch = fetcher ?? fetch;
  const response = await doFetch(
    LINEAR_API,
    graphqlInit(apiKey, '{ viewer { id } }'),
  ).catch(() => undefined);

  const failure = evaluatePingResponse(response);
  if (failure || !response)
    return failure ?? { ok: false, error: '✗ Linear ping failed' };

  try {
    const json: unknown = await response.json();
    const parsed = linearViewerResponseSchema.safeParse(json);
    if (parsed.success && parsed.data.data?.viewer?.id) return { ok: true };
  } catch {
    // Invalid JSON — treat as auth issue
  }

  return { ok: false, error: '✗ Linear auth failed — check LINEAR_API_KEY' };
}

/** Linear ticket with issue ID, optional parent info, and labels. */
type LinearTicket = {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly provider: 'linear';
  readonly issueId: string;
  readonly parentIdentifier?: string;
  readonly labels?: readonly string[];
};

/** Options for {@link fetchIssues}. */
type FetchIssuesOpts = {
  readonly apiKey: string;
  readonly teamId: string;
  readonly label?: string;
  readonly excludeHitl?: boolean;
  readonly limit?: number;
  readonly fetcher?: Fetcher;
};

/** Build the GraphQL query for fetching assigned issues. */
function buildIssuesQuery(opts: FetchIssuesOpts): {
  readonly query: string;
  readonly variables: Record<string, unknown>;
} {
  const { teamId, label, excludeHitl, limit = 5 } = opts;
  const hasLabel = Boolean(label?.trim());

  const varDecls = ['$teamId: ID!', ...(hasLabel ? ['$label: String!'] : [])];
  const labelFilter = hasLabel ? 'labels: { name: { eq: $label } }' : '';
  const filterParts = [
    'state: { type: { eq: "unstarted" } }',
    'team: { id: { eq: $teamId } }',
    labelFilter,
  ].filter(Boolean);

  const clampedLimit = Math.min(Math.max(limit, 1), 50);
  const fetchLimit = excludeHitl ? clampedLimit * 3 : clampedLimit;

  const query = `
    query(${varDecls.join(', ')}) {
      viewer {
        assignedIssues(
          filter: {
            ${filterParts.join('\n            ')}
          }
          first: ${String(fetchLimit)}
          orderBy: createdAt
        ) {
          nodes {
            id
            identifier
            title
            description
            parent { identifier title }
            labels { nodes { name } }
          }
        }
      }
    }
  `;

  const variables: Record<string, unknown> = hasLabel
    ? { teamId, label }
    : { teamId };

  return { query, variables };
}

/** Check if an issue has the HITL exclusion label. */
function isHitlIssue(issue: {
  readonly labels?: {
    readonly nodes?: ReadonlyArray<{ readonly name: string }>;
  };
}): boolean {
  return issue.labels?.nodes?.some((l) => l.name === 'clancy:hitl') === true;
}

/**
 * Fetch candidate issues from Linear.
 *
 * @param opts - API key, team ID, and optional filters.
 * @returns Array of fetched tickets (may be empty).
 */
export async function fetchIssues(
  opts: FetchIssuesOpts,
): Promise<readonly LinearTicket[]> {
  if (!isValidTeamId(opts.teamId)) return [];
  const { apiKey, excludeHitl, limit = 5 } = opts;
  const { query, variables } = buildIssuesQuery(opts);

  const raw = await linearGraphql({
    apiKey,
    query,
    variables,
    fetcher: opts.fetcher,
  });
  const parsed = linearIssuesResponseSchema.safeParse(raw);
  if (!parsed.success) return [];

  const allNodes = parsed.data.data?.viewer?.assignedIssues?.nodes ?? [];
  const filtered = excludeHitl
    ? allNodes.filter((n) => !isHitlIssue(n))
    : allNodes;

  return filtered.slice(0, limit).map(
    (issue): LinearTicket => ({
      key: issue.identifier,
      title: issue.title,
      description: issue.description ?? '',
      provider: 'linear',
      issueId: issue.id,
      parentIdentifier: issue.parent?.identifier,
      labels: issue.labels?.nodes
        ?.map((l) => l.name)
        .filter((n): n is string => Boolean(n)),
    }),
  );
}
