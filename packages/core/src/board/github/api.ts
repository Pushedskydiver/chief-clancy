/**
 * GitHub Issues API functions.
 *
 * Low-level functions for interacting with the GitHub REST API.
 * Used by the GitHub board adapter ({@link ../github-board.ts}).
 */
import type { PingResult } from '../../types/index.js';

import { z } from 'zod/mini';

import { githubIssuesResponseSchema } from '../../schemas/index.js';
import { fetchAndParse, pingEndpoint } from '../../shared/http/index.js';

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
 * @returns Ping result with `ok` and optional `error`.
 */
export async function pingGitHub(
  token: string,
  repo: string,
): Promise<PingResult> {
  return pingEndpoint({
    url: `${GITHUB_API}/repos/${repo}`,
    headers: githubHeaders(token),
    statusErrors: {
      401: '✗ GitHub auth failed — check GITHUB_TOKEN',
      403: '✗ GitHub permission denied',
      404: `✗ GitHub repo "${repo}" not found`,
    },
    networkError: '✗ Could not reach GitHub — check network',
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
): Promise<string> {
  const cached = cache.get();
  if (cached) return cached;

  try {
    const response = await fetch(`${GITHUB_API}/user`, {
      headers: githubHeaders(token),
    });

    if (!response.ok) {
      console.warn(
        `⚠ GitHub /user returned HTTP ${response.status} — falling back to @me`,
      );
      return '@me';
    }

    const json: unknown = await response.json();
    const parsed = githubUserSchema.safeParse(json);

    if (parsed.success) {
      cache.store(parsed.data.login);
      return parsed.data.login;
    }

    console.warn('⚠ Unexpected GitHub /user response — falling back to @me');
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

/** Options for {@link fetchIssues}. */
export type FetchIssuesOpts = {
  readonly token: string;
  readonly repo: string;
  readonly label?: string;
  readonly username?: string;
  readonly excludeHitl?: boolean;
  readonly limit?: number;
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
  const { token, repo, label, username, excludeHitl, limit = 5 } = opts;

  const params = new URLSearchParams({
    state: 'open',
    assignee: username ?? '@me',
    per_page: '10',
    ...(label ? { labels: label } : {}),
  });

  const data = await fetchAndParse(
    `${GITHUB_API}/repos/${repo}/issues?${params}`,
    { headers: githubHeaders(token) },
    { schema: githubIssuesResponseSchema, label: 'GitHub Issues API' },
  );

  if (!data) return [];

  const withoutPrs = data.filter((item) => !item.pull_request);

  const filtered = excludeHitl
    ? withoutPrs.filter(
        (issue) => !issue.labels?.some((l) => l.name === 'clancy:hitl'),
      )
    : withoutPrs;

  return filtered.slice(0, limit).map(
    (issue): GitHubTicket => ({
      key: `#${issue.number}`,
      title: issue.title,
      description: issue.body ?? '',
      provider: 'github',
      milestone: issue.milestone?.title,
      labels: issue.labels
        ?.map((l) => l.name)
        .filter((n): n is string => Boolean(n)),
    }),
  );
}

/**
 * Close a GitHub issue.
 *
 * @param token - GitHub personal access token.
 * @param repo - Repository in `owner/repo` format.
 * @param issueNumber - The issue number to close.
 * @returns `true` if the issue was closed successfully.
 */
export async function closeIssue(
  token: string,
  repo: string,
  issueNumber: number,
): Promise<boolean> {
  if (!isValidRepo(repo)) return false;

  try {
    const response = await fetch(
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
