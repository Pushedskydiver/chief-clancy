/**
 * Linear orphan cleanup for E2E garbage collector.
 *
 * Searches for issues with [QA] in the title created more than 24 hours
 * ago and deletes them via GraphQL.
 */
import { getLinearCredentials } from '../env.js';
import { fetchWithTimeout } from '../fetch-timeout.js';
import { resolveLinearTeamUuid } from '../ticket-factory/linear.js';

const LINEAR_API_URL = 'https://api.linear.app/graphql';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function linearHeaders(apiKey: string): Record<string, string> {
  return { Authorization: apiKey, 'Content-Type': 'application/json' };
}

type LinearIssue = {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
};

/**
 * Clean up orphan Linear issues with [QA] in the title.
 *
 * @returns Number of issues deleted.
 */
export async function cleanupLinearOrphans(): Promise<number> {
  const creds = getLinearCredentials();
  if (!creds) {
    console.log('  Linear credentials not available — skipping');
    return 0;
  }

  const headers = linearHeaders(creds.apiKey);
  const teamUuid = await resolveLinearTeamUuid(creds.apiKey, creds.teamId);

  const searchResp = await fetchWithTimeout(LINEAR_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: `query($teamId: String!) {
        issues(first: 100, filter: {
          team: { id: { eq: $teamId } },
          title: { contains: "[QA]" }
        }) {
          nodes { id title createdAt }
        }
      }`,
      variables: { teamId: teamUuid },
    }),
  });

  if (!searchResp.ok) {
    console.log(`  Linear search failed: ${searchResp.status}`);
    return 0;
  }

  const json = (await searchResp.json()) as {
    data?: { issues: { nodes: ReadonlyArray<LinearIssue> } };
    errors?: ReadonlyArray<{ message: string }>;
  };

  if (json.errors?.length) {
    console.log(`  Linear GraphQL error: ${json.errors[0].message}`);
    return 0;
  }

  const issues = json.data?.issues.nodes ?? [];
  const cutoff = Date.now() - ONE_DAY_MS;
  let cleaned = 0;

  for (const issue of issues) {
    if (new Date(issue.createdAt).getTime() > cutoff) continue;

    console.log(`  Deleting orphan: ${issue.title}`);

    const delResp = await fetchWithTimeout(LINEAR_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: `mutation($id: String!) { issueDelete(id: $id) { success } }`,
        variables: { id: issue.id },
      }),
    });

    if (!delResp.ok) {
      console.log(`    Failed to delete Linear issue: HTTP ${delResp.status}`);
      continue;
    }

    const delJson = (await delResp.json()) as {
      data?: { issueDelete?: { success?: boolean } };
      errors?: ReadonlyArray<{ message: string }>;
    };

    if (delJson.errors?.length) {
      console.log(`    Linear delete error: ${delJson.errors[0].message}`);
      continue;
    }

    if (!delJson.data?.issueDelete?.success) {
      console.log('    Linear delete unsuccessful (success=false)');
      continue;
    }

    cleaned++;
  }

  return cleaned;
}
