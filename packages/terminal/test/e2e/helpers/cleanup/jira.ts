/**
 * Jira cleanup helpers for E2E tests.
 *
 * Transitions issues to "Done" and adds a qa-cleanup label.
 */
import { getJiraCredentials } from '../env.js';
import { fetchWithTimeout } from '../fetch-timeout.js';
import { buildJiraAuth } from '../jira-auth.js';

function jiraHeaders(auth: string): Record<string, string> {
  return {
    Authorization: `Basic ${auth}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

/**
 * Transition a Jira issue to "Done" and add a qa-cleanup label.
 *
 * @param issueIdOrKey - The Jira issue ID or key to clean up.
 */
export async function cleanupJiraTicket(issueIdOrKey: string): Promise<void> {
  const creds = getJiraCredentials();
  if (!creds) return;

  const auth = buildJiraAuth(creds.user, creds.apiToken);
  const headers = jiraHeaders(auth);

  const transResp = await fetchWithTimeout(
    `${creds.baseUrl}/rest/api/3/issue/${issueIdOrKey}/transitions`,
    { headers },
  );

  if (transResp.ok) {
    const transData = (await transResp.json()) as {
      transitions: ReadonlyArray<{ id: string; name: string }>;
    };
    const done = transData.transitions.find((t) =>
      t.name.toLowerCase().includes('done'),
    );

    if (done) {
      await fetchWithTimeout(
        `${creds.baseUrl}/rest/api/3/issue/${issueIdOrKey}/transitions`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ transition: { id: done.id } }),
        },
      );
    }
  }

  // Add qa-cleanup label (best-effort)
  await fetchWithTimeout(`${creds.baseUrl}/rest/api/3/issue/${issueIdOrKey}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      update: { labels: [{ add: 'qa-cleanup' }] },
    }),
  }).catch(() => {});
}
