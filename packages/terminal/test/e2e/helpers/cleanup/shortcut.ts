/**
 * Shortcut cleanup helpers for E2E tests.
 *
 * Deletes stories entirely (Shortcut supports full delete via API).
 */
import { getShortcutCredentials } from '../env.js';
import { fetchWithTimeout } from '../fetch-timeout.js';

/**
 * Delete a Shortcut story.
 *
 * @param storyId - The Shortcut story ID to delete.
 */
export async function cleanupShortcutTicket(storyId: string): Promise<void> {
  const creds = getShortcutCredentials();
  if (!creds) return;

  await fetchWithTimeout(
    `https://api.app.shortcut.com/api/v3/stories/${storyId}`,
    {
      method: 'DELETE',
      headers: { 'Shortcut-Token': creds.token },
    },
  );
}
