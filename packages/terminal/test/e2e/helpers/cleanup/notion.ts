/**
 * Notion cleanup helpers for E2E tests.
 *
 * Archives pages (Notion does not support hard delete via API).
 */
import { getNotionCredentials } from '../env.js';
import { fetchWithTimeout } from '../fetch-timeout.js';

/**
 * Archive a Notion page.
 *
 * @param pageId - The Notion page ID to archive.
 */
export async function cleanupNotionTicket(pageId: string): Promise<void> {
  const creds = getNotionCredentials();
  if (!creds) return;

  await fetchWithTimeout(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${creds.token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ archived: true }),
  });
}
