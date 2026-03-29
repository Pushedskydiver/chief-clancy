/**
 * Linear cleanup helpers for E2E tests.
 *
 * Deletes issues entirely (Linear supports full delete via GraphQL).
 */
import { getLinearCredentials } from '../env.js';
import { fetchWithTimeout } from '../fetch-timeout.js';

/**
 * Delete a Linear issue.
 *
 * Linear returns HTTP 200 even on GraphQL errors, so the response body
 * is checked for success. Failures are logged but not thrown — cleanup
 * should not break tests.
 *
 * @param issueId - The Linear issue ID (UUID) to delete.
 */
export async function cleanupLinearTicket(issueId: string): Promise<void> {
  const creds = getLinearCredentials();
  if (!creds) return;

  const resp = await fetchWithTimeout('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      Authorization: creds.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `mutation($id: String!) { issueDelete(id: $id) { success } }`,
      variables: { id: issueId },
    }),
  });

  if (resp.ok) {
    const json = (await resp.json()) as {
      data?: { issueDelete?: { success?: boolean } };
      errors?: ReadonlyArray<{ message: string }>;
    };

    if (json.errors?.length || !json.data?.issueDelete?.success) {
      console.log(`  Linear cleanup may have failed for ${issueId}`);
    }
  }
}
