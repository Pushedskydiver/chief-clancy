/**
 * Notion orphan cleanup for E2E garbage collector.
 *
 * Queries the test database for pages with [QA] in the title created
 * more than 24 hours ago and archives them. Notion does not support
 * text search on titles, so all pages are fetched and filtered
 * client-side.
 */
import { getNotionCredentials } from '../env.js';
import { fetchWithTimeout } from '../fetch-timeout.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type NotionPage = {
  readonly id: string;
  readonly created_time: string;
  readonly properties: Record<
    string,
    {
      type: string;
      title?: ReadonlyArray<{ plain_text: string }>;
    }
  >;
};

type QueryResponse = {
  readonly results: ReadonlyArray<NotionPage>;
  readonly has_more: boolean;
  readonly next_cursor: string | null;
};

/** Extract the plain-text title from a Notion page's properties. */
function extractTitle(page: NotionPage): string {
  const titleProp = Object.values(page.properties).find(
    (p) => p.type === 'title',
  );
  return titleProp?.title?.map((t) => t.plain_text).join('') ?? '';
}

/**
 * Clean up orphan Notion pages with [QA] in the title.
 *
 * @returns Number of pages archived.
 */
export async function cleanupNotionOrphans(): Promise<number> {
  const creds = getNotionCredentials();
  if (!creds) {
    console.log('  Notion credentials not available — skipping');
    return 0;
  }

  const headers = {
    Authorization: `Bearer ${creds.token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  const cutoff = Date.now() - ONE_DAY_MS;
  let cleaned = 0;
  let startCursor: string | undefined;

  for (let page = 0; page < 10; page++) {
    const body: Record<string, unknown> = { page_size: 100 };
    if (startCursor) body.start_cursor = startCursor;

    const resp = await fetchWithTimeout(
      `https://api.notion.com/v1/databases/${creds.databaseId}/query`,
      { method: 'POST', headers, body: JSON.stringify(body) },
    );

    if (!resp.ok) {
      console.log(`  Notion query failed: ${resp.status}`);
      break;
    }

    const data = (await resp.json()) as QueryResponse;

    for (const result of data.results) {
      const title = extractTitle(result);
      if (!title.includes('[QA]')) continue;
      if (new Date(result.created_time).getTime() > cutoff) continue;

      console.log(`  Archiving orphan: ${title}`);

      const archiveResp = await fetchWithTimeout(
        `https://api.notion.com/v1/pages/${result.id}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ archived: true }),
        },
      );

      if (archiveResp.ok) cleaned++;
      else
        console.log(`    Failed to archive Notion page: ${archiveResp.status}`);
    }

    if (!data.has_more || !data.next_cursor) break;
    startCursor = data.next_cursor;
  }

  return cleaned;
}
