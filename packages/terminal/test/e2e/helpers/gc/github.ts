/**
 * GitHub orphan cleanup for E2E garbage collector.
 *
 * Searches for open issues, PRs, and branches with [QA] in the title
 * created more than 24 hours ago, and closes/deletes them.
 */
import { getGitHubCredentials } from '../env.js';
import { fetchWithTimeout } from '../fetch-timeout.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

type SearchItem = { number: number; title: string };

/**
 * Search GitHub issues/PRs via the search API.
 *
 * @param repo - The owner/repo string.
 * @param token - GitHub PAT.
 * @param query - The search query string.
 * @returns Matching items.
 */
async function searchIssues(
  repo: string,
  token: string,
  query: string,
): Promise<ReadonlyArray<SearchItem>> {
  const encoded = encodeURIComponent(query);
  const resp = await fetchWithTimeout(
    `https://api.github.com/search/issues?q=${encoded}&per_page=100`,
    { headers: githubHeaders(token) },
  );

  if (!resp.ok) return [];

  const data = (await resp.json()) as {
    items: ReadonlyArray<SearchItem>;
  };
  return data.items;
}

/**
 * Close orphan issues with [QA] in the title older than 24h.
 *
 * @returns Number of issues closed.
 */
async function closeOrphanIssues(
  repo: string,
  token: string,
  cutoff: string,
): Promise<number> {
  const items = await searchIssues(
    repo,
    token,
    `repo:${repo} is:issue is:open "[QA]" in:title created:<${cutoff}`,
  );

  let cleaned = 0;
  for (const issue of items) {
    console.log(`  Closing orphan issue #${issue.number}: ${issue.title}`);
    const resp = await fetchWithTimeout(
      `https://api.github.com/repos/${repo}/issues/${issue.number}`,
      {
        method: 'PATCH',
        headers: githubHeaders(token),
        body: JSON.stringify({ state: 'closed' }),
      },
    );
    if (resp.ok) cleaned++;
    else
      console.log(`    Failed to close issue #${issue.number}: ${resp.status}`);
  }
  return cleaned;
}

/**
 * Close orphan PRs with [QA] in the title older than 24h.
 *
 * @returns Number of PRs closed.
 */
async function closeOrphanPRs(
  repo: string,
  token: string,
  cutoff: string,
): Promise<number> {
  const items = await searchIssues(
    repo,
    token,
    `repo:${repo} is:pr is:open "[QA]" in:title created:<${cutoff}`,
  );

  let cleaned = 0;
  for (const pr of items) {
    console.log(`  Closing orphan PR #${pr.number}: ${pr.title}`);
    const resp = await fetchWithTimeout(
      `https://api.github.com/repos/${repo}/pulls/${pr.number}`,
      {
        method: 'PATCH',
        headers: githubHeaders(token),
        body: JSON.stringify({ state: 'closed' }),
      },
    );
    if (resp.ok) cleaned++;
    else console.log(`    Failed to close PR #${pr.number}: ${resp.status}`);
  }
  return cleaned;
}

/**
 * Delete orphan branches from closed [QA] PRs.
 *
 * Only deletes feature/* branches whose associated PR has already been
 * closed and matches the [QA] title pattern.
 *
 * @returns Number of branches deleted.
 */
async function deleteOrphanBranches(
  repo: string,
  token: string,
  cutoff: string,
): Promise<number> {
  const items = await searchIssues(
    repo,
    token,
    `repo:${repo} is:pr is:closed "[QA]" in:title created:<${cutoff}`,
  );

  const headers = githubHeaders(token);
  let cleaned = 0;

  for (const pr of items) {
    const detailResp = await fetchWithTimeout(
      `https://api.github.com/repos/${repo}/pulls/${pr.number}`,
      { headers },
    );
    if (!detailResp.ok) continue;

    const detail = (await detailResp.json()) as { head: { ref: string } };
    const branchName = detail.head.ref;

    if (!branchName.startsWith('feature/')) continue;

    const branchResp = await fetchWithTimeout(
      `https://api.github.com/repos/${repo}/git/refs/heads/${branchName}`,
      { headers },
    );
    if (!branchResp.ok) continue;

    console.log(`  Deleting orphan branch: ${branchName}`);
    const delResp = await fetchWithTimeout(
      `https://api.github.com/repos/${repo}/git/refs/heads/${branchName}`,
      { method: 'DELETE', headers },
    );
    if (delResp.ok) cleaned++;
    else
      console.log(
        `    Failed to delete branch ${branchName}: ${delResp.status}`,
      );
  }

  return cleaned;
}

/**
 * Clean up all orphan GitHub resources (issues, PRs, branches).
 *
 * @returns Total number of resources cleaned.
 */
export async function cleanupGitHubOrphans(): Promise<number> {
  const creds = getGitHubCredentials();
  if (!creds) {
    console.log('  GitHub credentials not available — skipping');
    return 0;
  }

  const cutoff = new Date(Date.now() - ONE_DAY_MS).toISOString();

  const issues = await closeOrphanIssues(creds.repo, creds.token, cutoff);
  const prs = await closeOrphanPRs(creds.repo, creds.token, cutoff);
  const branches = await deleteOrphanBranches(creds.repo, creds.token, cutoff);

  return issues + prs + branches;
}
