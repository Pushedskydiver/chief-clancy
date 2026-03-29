/**
 * GitHub cleanup helpers for E2E tests.
 *
 * Closes issues, closes PRs, and adds qa-cleanup labels.
 */
import { getGitHubCredentials } from '../env.js';
import { fetchWithTimeout } from '../fetch-timeout.js';

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

/**
 * Close a GitHub issue and add a qa-cleanup label.
 *
 * @param issueNumber - The issue number to close.
 */
export async function cleanupGitHubTicket(issueNumber: string): Promise<void> {
  const creds = getGitHubCredentials();
  if (!creds) return;

  const baseUrl = `https://api.github.com/repos/${creds.repo}/issues/${issueNumber}`;
  const headers = githubHeaders(creds.token);

  await fetchWithTimeout(baseUrl, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ state: 'closed' }),
  });

  // Add qa-cleanup label (best-effort)
  await fetchWithTimeout(`${baseUrl}/labels`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ labels: ['qa-cleanup'] }),
  }).catch(() => {
    // Label may not exist — that's fine
  });
}

/**
 * Close a GitHub pull request.
 *
 * All boards use the same GitHub sandbox repo for PRs.
 *
 * @param prNumber - The PR number to close.
 */
export async function cleanupGitHubPullRequest(
  prNumber: string,
): Promise<void> {
  const creds = getGitHubCredentials();
  if (!creds) return;

  await fetchWithTimeout(
    `https://api.github.com/repos/${creds.repo}/pulls/${prNumber}`,
    {
      method: 'PATCH',
      headers: githubHeaders(creds.token),
      body: JSON.stringify({ state: 'closed' }),
    },
  );
}
