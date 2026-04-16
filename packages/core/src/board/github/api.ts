/**
 * GitHub Issues API functions.
 *
 * Low-level functions for interacting with the GitHub REST API.
 * Used by the GitHub board adapter ({@link ../github-board.ts}).
 */
import type { GitHubIssue } from '~/c/schemas/github.js';
import type { Fetcher } from '~/c/shared/http/fetch-and-parse.js';
import type { PingResult } from '~/c/types/board.js';

import { githubIssuesResponseSchema } from '~/c/schemas/github.js';
import { fetchAndParse } from '~/c/shared/http/fetch-and-parse.js';
import { pingEndpoint } from '~/c/shared/http/ping-endpoint.js';
import { z } from 'zod/mini';

/** Default GitHub API base URL. */
export const GITHUB_API = 'https://api.github.com';

/** Pattern for validating `owner/repo` format. */
const SAFE_REPO_PATTERN = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

/** Schema for the `GET /user` response. */
const githubUserSchema = z.object({ login: z.string() });

/**
 * Build standard GitHub API request headers.
 *
 * @param token - GitHub personal access token.
 * @returns Headers object for GitHub REST API requests.
 */
export function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/**
 * Validate that a repo string matches `owner/repo` format.
 *
 * @param repo - The repository string to validate.
 * @returns `true` if valid.
 */
export function isValidRepo(repo: string): boolean {
  return SAFE_REPO_PATTERN.test(repo);
}

/**
 * Ping the GitHub API to verify connectivity and credentials.
 *
 * @param token - GitHub personal access token.
 * @param repo - Repository in `owner/repo` format.
 * @param fetcher - Optional custom fetch function for DI in tests.
 * @returns Ping result with `ok` and optional `error`.
 */
export async function pingGitHub(
  token: string,
  repo: string,
  fetcher?: Fetcher,
): Promise<PingResult> {
  if (!isValidRepo(repo)) {
    return { ok: false, error: '✗ GITHUB_REPO format is invalid' };
  }

  return pingEndpoint({
    url: `${GITHUB_API}/repos/${repo}`,
    headers: githubHeaders(token),
    statusErrors: {
      401: '✗ GitHub auth failed — check GITHUB_TOKEN',
      403: '✗ GitHub permission denied',
      404: `✗ GitHub repo "${repo}" not found`,
    },
    networkError: '✗ Could not reach GitHub — check network',
    fetcher,
  });
}

/**
 * Resolve the authenticated GitHub username from the token.
 *
 * Uses `GET /user` and caches the result via the provided cache.
 * Falls back to `@me` if the API call fails.
 *
 * @param token - GitHub personal access token.
 * @param cache - Cache instance to store the resolved username.
 * @returns The GitHub username, or `@me` as a fallback.
 */
export async function resolveUsername(
  token: string,
  cache: { get(): string | undefined; store(v: string): void },
  fetcher?: Fetcher,
): Promise<string> {
  const cached = cache.get();
  if (cached) return cached;

  const doFetch = fetcher ?? fetch;
  try {
    const response = await doFetch(`${GITHUB_API}/user`, {
      headers: githubHeaders(token),
    });

    if (response.ok) {
      const json: unknown = await response.json();
      const parsed = githubUserSchema.safeParse(json);

      if (parsed.success) {
        cache.store(parsed.data.login);
        return parsed.data.login;
      }

      console.warn('⚠ Unexpected GitHub /user response — falling back to @me');
    } else {
      console.warn(
        `⚠ GitHub /user returned HTTP ${response.status} — falling back to @me`,
      );
    }
  } catch (err) {
    console.warn(
      `⚠ GitHub /user request failed: ${err instanceof Error ? err.message : String(err)} — falling back to @me`,
    );
  }

  cache.store('@me');
  return '@me';
}

/** GitHub issue with optional milestone and labels. */
export type GitHubTicket = {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly provider: 'github';
  readonly milestone?: string;
  readonly labels?: readonly string[];
};

/** Map a raw GitHub issue to a {@link GitHubTicket}. */
function toGitHubTicket(issue: GitHubIssue): GitHubTicket {
  return {
    key: `#${issue.number}`,
    title: issue.title,
    description: issue.body ?? '',
    provider: 'github',
    milestone: issue.milestone?.title,
    labels: issue.labels
      ?.map((l) => l.name)
      .filter((n): n is string => Boolean(n)),
  };
}

/** Options for {@link fetchIssues}. */
type FetchIssuesOpts = {
  readonly token: string;
  readonly repo: string;
  readonly label?: string;
  readonly username?: string;
  readonly excludeHitl?: boolean;
  readonly limit?: number;
  readonly fetcher?: Fetcher;
};

/**
 * Fetch candidate issues from GitHub Issues.
 *
 * Requests extra results to account for PR pollution (the Issues
 * endpoint returns PRs too), then filters to real issues only.
 *
 * @param opts - Token, repo, and optional filters.
 * @returns Array of fetched tickets (may be empty).
 */
export async function fetchIssues(
  opts: FetchIssuesOpts,
): Promise<readonly GitHubTicket[]> {
  const {
    token,
    repo,
    label,
    username,
    excludeHitl,
    limit = 5,
    fetcher,
  } = opts;
  if (!isValidRepo(repo)) return [];

  // Overfetch (2x limit, min 10) because PRs are filtered client-side.
  // GitHub's max per_page is 100.
  const perPage = Math.min(Math.max(limit * 2, 10), 100);
  const params = new URLSearchParams({
    state: 'open',
    assignee: username ?? '@me',
    per_page: String(perPage),
    ...(label ? { labels: label } : {}),
  });

  const data = await fetchAndParse(
    `${GITHUB_API}/repos/${repo}/issues?${params.toString()}`,
    { headers: githubHeaders(token) },
    { schema: githubIssuesResponseSchema, label: 'GitHub Issues API', fetcher },
  );

  if (!data) return [];

  const withoutPrs = data.filter((item) => !item.pull_request);

  const filtered = excludeHitl
    ? withoutPrs.filter(
        (issue) => !issue.labels?.some((l) => l.name === 'clancy:hitl'),
      )
    : withoutPrs;

  return filtered.slice(0, limit).map((issue) => toGitHubTicket(issue));
}

/** Options for {@link closeIssue}. */
type CloseIssueOpts = {
  readonly token: string;
  readonly repo: string;
  readonly issueNumber: number;
  readonly fetcher?: Fetcher;
};

/**
 * Close a GitHub issue.
 *
 * @param opts - Token, repo, and issue number.
 * @returns `true` if the issue was closed successfully.
 */
export async function closeIssue(opts: CloseIssueOpts): Promise<boolean> {
  const { token, repo, issueNumber, fetcher } = opts;
  if (!isValidRepo(repo)) return false;

  const doFetch = fetcher ?? fetch;
  try {
    const response = await doFetch(
      `${GITHUB_API}/repos/${repo}/issues/${issueNumber}`,
      {
        method: 'PATCH',
        headers: {
          ...githubHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state: 'closed' }),
      },
    );

    return response.ok;
  } catch {
    return false;
  }
}
