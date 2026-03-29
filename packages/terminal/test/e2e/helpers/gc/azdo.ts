/**
 * Azure DevOps orphan cleanup for E2E garbage collector.
 *
 * Uses WIQL to find work items with [QA] in the title created more
 * than 24 hours ago and deletes or closes them.
 */
import { azdoBaseUrl, azdoHeaders, buildAzdoAuth } from '../azdo-auth.js';
import { getAzdoCredentials } from '../env.js';
import { fetchWithTimeout } from '../fetch-timeout.js';

/**
 * Clean up orphan Azure DevOps work items with [QA] in the title.
 *
 * Validates the project name against WIQL injection before building
 * the query (mirrors runtime `isSafeWiqlValue` check).
 *
 * @returns Number of work items cleaned.
 */
export async function cleanupAzdoOrphans(): Promise<number> {
  const creds = getAzdoCredentials();
  if (!creds) {
    console.log('  Azure DevOps credentials not available — skipping');
    return 0;
  }

  // Defence-in-depth: validate project name before WIQL interpolation
  if (
    !/^[a-zA-Z0-9 _\-.]+$/.test(creds.project) ||
    /--|;|\/\*/.test(creds.project)
  ) {
    console.log(
      '  Azure DevOps project name contains unsafe characters — skipping',
    );
    return 0;
  }

  const auth = buildAzdoAuth(creds.pat);
  const base = azdoBaseUrl(creds.org, creds.project);
  const wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${creds.project}' AND [System.Title] CONTAINS '[QA]' AND [System.CreatedDate] < @Today - 1 AND [System.State] <> 'Closed' AND [System.State] <> 'Removed'`;

  const searchResp = await fetchWithTimeout(
    `${base}/wit/wiql?api-version=7.1`,
    {
      method: 'POST',
      headers: azdoHeaders(auth),
      body: JSON.stringify({ query: wiql }),
    },
  );

  if (!searchResp.ok) {
    console.log(`  Azure DevOps WIQL query failed: ${searchResp.status}`);
    return 0;
  }

  const data = (await searchResp.json()) as {
    workItems: ReadonlyArray<{ id: number }>;
  };

  let cleaned = 0;

  for (const item of data.workItems) {
    console.log(`  Deleting orphan: azdo-${item.id}`);

    // Try hard delete first
    const delResp = await fetchWithTimeout(
      `${base}/wit/workitems/${item.id}?destroy=true&api-version=7.1`,
      {
        method: 'DELETE',
        headers: { Authorization: `Basic ${auth}` },
      },
    );

    if (delResp.ok) {
      cleaned++;
      continue;
    }

    // Fallback: close the work item
    const closeResp = await fetchWithTimeout(
      `${base}/wit/workitems/${item.id}?api-version=7.1`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json-patch+json',
        },
        body: JSON.stringify([
          { op: 'replace', path: '/fields/System.State', value: 'Closed' },
        ]),
      },
    );

    if (closeResp.ok) cleaned++;
    else
      console.log(`    Failed to close azdo-${item.id}: ${closeResp.status}`);
  }

  return cleaned;
}
