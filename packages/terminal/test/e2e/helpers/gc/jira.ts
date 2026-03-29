/**
 * Jira orphan cleanup for E2E garbage collector.
 *
 * Searches for open issues with [QA] in the summary created more than
 * 24 hours ago and transitions them to "Done".
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
 * Clean up orphan Jira issues with [QA] in the summary.
 *
 * Uses JQL relative date syntax (`created <= -1d`) to avoid timezone
 * truncation issues with absolute ISO dates.
 *
 * @returns Number of issues transitioned to Done.
 */
export async function cleanupJiraOrphans(): Promise<number> {
  const creds = getJiraCredentials();
  if (!creds) {
    console.log('  Jira credentials not available — skipping');
    return 0;
  }

  const auth = buildJiraAuth(creds.user, creds.apiToken);
  const headers = jiraHeaders(auth);
  const jql = `project = ${creds.projectKey} AND summary ~ "[QA]" AND created <= -1d AND status != Done`;

  const searchResp = await fetchWithTimeout(
    `${creds.baseUrl}/rest/api/3/search/jql`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ jql, maxResults: 100, fields: ['summary'] }),
    },
  );

  if (!searchResp.ok) {
    console.log(`  Jira search failed: ${searchResp.status}`);
    return 0;
  }

  const data = (await searchResp.json()) as {
    issues: ReadonlyArray<{ key: string; fields: { summary: string } }>;
  };

  let cleaned = 0;

  for (const issue of data.issues) {
    console.log(`  Transitioning orphan ${issue.key}: ${issue.fields.summary}`);

    const transResp = await fetchWithTimeout(
      `${creds.baseUrl}/rest/api/3/issue/${issue.key}/transitions`,
      { headers },
    );

    if (!transResp.ok) continue;

    const transData = (await transResp.json()) as {
      transitions: ReadonlyArray<{ id: string; name: string }>;
    };
    const done = transData.transitions.find((t) =>
      t.name.toLowerCase().includes('done'),
    );

    if (!done) continue;

    const closeResp = await fetchWithTimeout(
      `${creds.baseUrl}/rest/api/3/issue/${issue.key}/transitions`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ transition: { id: done.id } }),
      },
    );

    if (closeResp.ok) cleaned++;
    else
      console.log(`    Failed to transition ${issue.key}: ${closeResp.status}`);
  }

  return cleaned;
}
