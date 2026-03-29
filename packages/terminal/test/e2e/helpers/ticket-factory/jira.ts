/**
 * Jira ticket factory for E2E tests.
 */
import type { CreatedTicket, CreateTicketOptions } from './ticket-factory.js';

import { getJiraCredentials } from '../env.js';
import { fetchWithTimeout } from '../fetch-timeout.js';
import { buildJiraAuth } from '../jira-auth.js';
import { buildTitle } from './ticket-factory.js';

function jiraHeaders(auth: string): Record<string, string> {
  return {
    Authorization: `Basic ${auth}`,
    Accept: 'application/json',
  };
}

/**
 * Resolve the authenticated Jira user's account ID via GET /myself.
 *
 * @param baseUrl - Jira base URL.
 * @param auth - Base64-encoded auth string.
 * @returns The authenticated user's account ID.
 */
async function resolveJiraAccountId(
  baseUrl: string,
  auth: string,
): Promise<string> {
  const response = await fetchWithTimeout(`${baseUrl}/rest/api/3/myself`, {
    headers: jiraHeaders(auth),
  });

  if (!response.ok) {
    throw new Error(`Failed to resolve Jira account ID: ${response.status}`);
  }

  const data = (await response.json()) as { accountId: string };
  return data.accountId;
}

/**
 * Create a Jira issue for E2E testing.
 *
 * @param runId - Unique run ID for test isolation.
 * @param options - Ticket creation options.
 * @returns The created ticket.
 */
export async function createJiraTicket(
  runId: string,
  options: CreateTicketOptions,
): Promise<CreatedTicket> {
  const creds = getJiraCredentials();
  if (!creds) throw new Error('Jira credentials not available');

  const auth = buildJiraAuth(creds.user, creds.apiToken);
  const title = buildTitle('jira', runId, options.titleSuffix);
  const accountId = await resolveJiraAccountId(creds.baseUrl, auth);

  const response = await fetchWithTimeout(`${creds.baseUrl}/rest/api/3/issue`, {
    method: 'POST',
    headers: { ...jiraHeaders(auth), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        project: { key: creds.projectKey },
        summary: title,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Automated E2E test ticket created by Clancy QA suite.',
                },
              ],
            },
          ],
        },
        issuetype: { name: 'Task' },
        labels: ['clancy-build'],
        assignee: { accountId },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create Jira issue: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { id: string; key: string };

  return {
    id: data.id,
    key: data.key,
    url: `${creds.baseUrl}/browse/${data.key}`,
  };
}
