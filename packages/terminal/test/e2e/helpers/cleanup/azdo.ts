/**
 * Azure DevOps cleanup helpers for E2E tests.
 *
 * Tries hard delete first, falls back to close + tag if destroy
 * permission is unavailable.
 */
import { azdoBaseUrl, azdoPatchHeaders, buildAzdoAuth } from '../azdo-auth.js';
import { getAzdoCredentials } from '../env.js';
import { fetchWithTimeout } from '../fetch-timeout.js';

/**
 * Delete or close an Azure DevOps work item.
 *
 * Attempts hard delete (destroy=true) first. If the token lacks
 * destroy permission, falls back to closing the work item and
 * tagging it with qa-cleanup.
 *
 * @param workItemId - The work item ID to clean up.
 */
export async function cleanupAzdoTicket(workItemId: string): Promise<void> {
  const creds = getAzdoCredentials();
  if (!creds) return;

  const auth = buildAzdoAuth(creds.pat);
  const base = azdoBaseUrl(creds.org, creds.project);

  const delResp = await fetchWithTimeout(
    `${base}/wit/workitems/${workItemId}?destroy=true&api-version=7.1`,
    {
      method: 'DELETE',
      headers: { Authorization: `Basic ${auth}` },
    },
  );

  if (delResp.ok) return;

  // Fallback: close the work item and tag for manual cleanup
  await fetchWithTimeout(
    `${base}/wit/workitems/${workItemId}?api-version=7.1`,
    {
      method: 'PATCH',
      headers: azdoPatchHeaders(auth),
      body: JSON.stringify([
        { op: 'add', path: '/fields/System.State', value: 'Closed' },
        { op: 'add', path: '/fields/System.Tags', value: 'qa-cleanup' },
      ]),
    },
  );
}
