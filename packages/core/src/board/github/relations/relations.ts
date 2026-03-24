/**
 * GitHub Issues relationship functions.
 *
 * Checks blocker status (via `Blocked by #N` in issue bodies) and
 * children status (via `Epic: #N` / `Parent: #N` text search).
 */
import type { ChildrenStatus } from '~/types/index.js';

import { GITHUB_API, githubHeaders, isValidRepo } from '../api/index.js';

/** Check if any blocker issue is still open (sequential, short-circuits). */
async function checkAnyBlockerOpen(
  headers: Record<string, string>,
  repo: string,
  blockerNumbers: readonly number[],
): Promise<boolean> {
  // Sequential check — must short-circuit on first open blocker
  const results = await blockerNumbers.reduce(
    async (accPromise, blockerNum) => {
      const found = await accPromise;
      if (found) return true;

      const response = await fetch(
        `${GITHUB_API}/repos/${repo}/issues/${blockerNum}`,
        { headers },
      );
      if (!response.ok) return false;

      // Safe cast: response validated by .ok, only reading one optional field
      const json = (await response.json()) as { state?: string };
      return json.state !== 'closed';
    },
    Promise.resolve(false),
  );
  return results;
}

/** Options for {@link fetchBlockerStatus}. */
export type FetchBlockerOpts = {
  readonly token: string;
  readonly repo: string;
  readonly issueNumber: number;
  readonly body: string;
};

/**
 * Check whether a GitHub issue is blocked by unresolved blockers.
 *
 * Parses the issue body for `Blocked by #N` lines and checks if
 * any of those issues are still open.
 *
 * @param opts - Token, repo, issue number, and issue body text.
 * @returns `true` if any blocker is unresolved, `false` otherwise.
 */
export async function fetchBlockerStatus(
  opts: FetchBlockerOpts,
): Promise<boolean> {
  const { token, repo, issueNumber, body } = opts;
  if (!isValidRepo(repo)) return false;

  const blockerNumbers = parseBlockerRefs(body, issueNumber);
  if (blockerNumbers.length === 0) return false;

  try {
    const headers = githubHeaders(token);
    const isOpen = await checkAnyBlockerOpen(headers, repo, blockerNumbers);
    return isOpen;
  } catch (err) {
    console.warn(
      `⚠ fetchBlockerStatus failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

/**
 * Parse `Blocked by #N` references from issue body text.
 *
 * @param body - The issue body text.
 * @param selfNumber - The current issue number (excluded from results).
 * @returns Array of blocker issue numbers.
 */
export function parseBlockerRefs(
  body: string,
  selfNumber: number,
): readonly number[] {
  return [...body.matchAll(/Blocked by #(\d+)/gi)]
    .map((m) => parseInt(m[1], 10))
    .filter((n) => !Number.isNaN(n) && n !== selfNumber);
}

/** Options for {@link fetchChildrenStatus}. */
export type FetchChildrenOpts = {
  readonly token: string;
  readonly repo: string;
  readonly parentNumber: number;
  readonly currentTicketKey?: string;
};

/** Try both Epic: and Parent: conventions, return the first with results. */
async function searchBothConventions(
  token: string,
  repo: string,
  parentNumber: number,
): Promise<{
  readonly epic: ChildrenStatus | undefined;
  readonly parent: ChildrenStatus | undefined;
}> {
  const epic = await fetchChildrenByBodyRef(
    token,
    repo,
    `Epic: #${parentNumber}`,
  );
  if (epic && epic.total > 0) return { epic, parent: undefined };

  const parent = await fetchChildrenByBodyRef(
    token,
    repo,
    `Parent: #${parentNumber}`,
  );
  return { epic, parent };
}

/**
 * Fetch children status of a GitHub parent issue (dual-mode).
 *
 * Tries `Epic: #{parentNumber}` text convention first. Falls back
 * to `Parent: #{parentNumber}` for backward compatibility.
 *
 * @param opts - Token, repo, parent number, and optional current ticket key.
 * @returns The children status, or `undefined` on failure.
 */
export async function fetchChildrenStatus(
  opts: FetchChildrenOpts,
): Promise<ChildrenStatus | undefined> {
  const { token, repo, parentNumber, currentTicketKey } = opts;
  if (!isValidRepo(repo)) return undefined;

  try {
    const { epic, parent } = await searchBothConventions(
      token,
      repo,
      parentNumber,
    );

    // Return whichever convention found children
    const withChildren = [epic, parent].find((r) => r && r.total > 0);
    if (withChildren) return withChildren;

    // If both searches failed (API errors), signal unknown state
    if (!epic && !parent) return undefined;

    // At least one succeeded with 0 results. If the current ticket
    // is a known child, the search index may not have caught up yet.
    if (currentTicketKey) return { total: 1, incomplete: 1 };

    return epic ?? parent ?? { total: 0, incomplete: 0 };
  } catch (err) {
    console.warn(
      `⚠ fetchChildrenStatus failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return undefined;
  }
}

/**
 * Fetch children status by searching for a body reference string.
 *
 * @param token - GitHub personal access token.
 * @param repo - Repository in `owner/repo` format.
 * @param bodyRef - The body reference string to search for.
 * @returns The children status, or `undefined` on failure.
 */
async function fetchChildrenByBodyRef(
  token: string,
  repo: string,
  bodyRef: string,
): Promise<ChildrenStatus | undefined> {
  const headers = githubHeaders(token);

  const allQuery = `"${bodyRef}" repo:${repo} is:issue`;
  const allParams = new URLSearchParams({ q: allQuery, per_page: '1' });
  const allResponse = await fetch(`${GITHUB_API}/search/issues?${allParams}`, {
    headers,
  });
  if (!allResponse.ok) return undefined;

  // Safe cast: only reading total_count from GitHub Search API response
  const allJson = (await allResponse.json()) as { total_count?: number };
  const total = allJson.total_count ?? 0;

  if (total === 0) return { total: 0, incomplete: 0 };

  const openQuery = `"${bodyRef}" repo:${repo} is:issue is:open`;
  const openParams = new URLSearchParams({
    q: openQuery,
    per_page: '1',
  });
  const openResponse = await fetch(
    `${GITHUB_API}/search/issues?${openParams}`,
    { headers },
  );

  // Assume all open on failure
  if (!openResponse.ok) return { total, incomplete: total };

  // Safe cast: only reading total_count from GitHub Search API response
  const openJson = (await openResponse.json()) as { total_count?: number };

  return { total, incomplete: openJson.total_count ?? 0 };
}
