/**
 * Shortcut orphan cleanup for E2E garbage collector.
 *
 * Searches for stories with [QA] in the name created more than 24 hours
 * ago and deletes them. Handles pagination.
 */
import { getShortcutCredentials } from '../env.js';
import { fetchWithTimeout } from '../fetch-timeout.js';

const SHORTCUT_API = 'https://api.app.shortcut.com/api/v3';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type ShortcutStory = {
  readonly id: number;
  readonly name: string;
  readonly created_at: string;
};

type SearchResponse = {
  readonly data: ReadonlyArray<ShortcutStory>;
  readonly next?: string | null;
};

/**
 * Clean up orphan Shortcut stories with [QA] in the name.
 *
 * @returns Number of stories deleted.
 */
export async function cleanupShortcutOrphans(): Promise<number> {
  const creds = getShortcutCredentials();
  if (!creds) {
    console.log('  Shortcut credentials not available — skipping');
    return 0;
  }

  const headers = {
    'Shortcut-Token': creds.token,
    'Content-Type': 'application/json',
  };

  const cutoff = Date.now() - ONE_DAY_MS;
  let cleaned = 0;
  let nextToken: string | undefined;

  for (let page = 0; page < 100; page++) {
    const body: Record<string, unknown> = { query: '[QA]', page_size: 25 };
    if (nextToken) body.next = nextToken;

    const searchResp = await fetchWithTimeout(
      `${SHORTCUT_API}/stories/search`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      },
    );

    if (!searchResp.ok) {
      console.log(`  Shortcut search failed: ${searchResp.status}`);
      break;
    }

    const data = (await searchResp.json()) as SearchResponse;
    if (!data.data?.length) break;

    for (const story of data.data) {
      if (new Date(story.created_at).getTime() > cutoff) continue;

      console.log(`  Deleting orphan: sc-${story.id} ${story.name}`);

      const delResp = await fetchWithTimeout(
        `${SHORTCUT_API}/stories/${story.id}`,
        {
          method: 'DELETE',
          headers: { 'Shortcut-Token': creds.token },
        },
      );

      if (delResp.ok) cleaned++;
      else
        console.log(`    Failed to delete sc-${story.id}: ${delResp.status}`);
    }

    nextToken = data.next ?? undefined;
    if (!nextToken) break;
  }

  return cleaned;
}
