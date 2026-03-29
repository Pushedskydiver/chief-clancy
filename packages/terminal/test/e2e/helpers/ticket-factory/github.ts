/**
 * GitHub Issues ticket factory for E2E tests.
 */
import type { CreatedTicket, CreateTicketOptions } from './ticket-factory.js';

import { getGitHubCredentials } from '../env.js';
import { fetchWithTimeout } from '../fetch-timeout.js';
import { buildTitle } from './ticket-factory.js';

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

const QA_BODY = [
  '## Summary',
  '',
  'Automated E2E test ticket created by Clancy QA suite.',
  'This ticket will be cleaned up automatically after the test completes.',
  '',
  '## Acceptance Criteria',
  '',
  '- [ ] Simulated implementation passes verification',
  '- [ ] PR is created against the correct branch',
  '- [ ] Progress file is updated with DONE entry',
].join('\n');

/**
 * Resolve the authenticated GitHub username via GET /user.
 *
 * @param token - GitHub PAT.
 * @returns The authenticated username.
 */
async function resolveGitHubUsername(token: string): Promise<string> {
  const response = await fetchWithTimeout('https://api.github.com/user', {
    headers: githubHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`Failed to resolve GitHub username: ${response.status}`);
  }

  const data = (await response.json()) as { login: string };
  return data.login;
}

/**
 * Create a GitHub issue for E2E testing.
 *
 * @param runId - Unique run ID for test isolation.
 * @param options - Ticket creation options.
 * @returns The created ticket.
 */
export async function createGitHubTicket(
  runId: string,
  options: CreateTicketOptions,
): Promise<CreatedTicket> {
  const creds = getGitHubCredentials();
  if (!creds) throw new Error('GitHub credentials not available');

  const username = await resolveGitHubUsername(creds.token);
  const title = buildTitle('github', runId, options.titleSuffix);

  const response = await fetchWithTimeout(
    `https://api.github.com/repos/${creds.repo}/issues`,
    {
      method: 'POST',
      headers: {
        ...githubHeaders(creds.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body: QA_BODY,
        labels: ['clancy:build'],
        assignees: [username],
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to create GitHub issue: ${response.status} ${text}`,
    );
  }

  const data = (await response.json()) as { number: number; html_url: string };

  return {
    id: String(data.number),
    key: `#${data.number}`,
    url: data.html_url,
  };
}
