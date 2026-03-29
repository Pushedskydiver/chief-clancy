/**
 * Notion ticket factory for E2E tests.
 */
import type { CreatedTicket, CreateTicketOptions } from './ticket-factory.js';

import { getNotionCredentials } from '../env.js';
import { fetchWithTimeout } from '../fetch-timeout.js';
import { buildTitle } from './ticket-factory.js';

const NOTION_API = 'https://api.notion.com/v1';

function notionHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };
}

type NotionSchema = {
  readonly titlePropName: string;
  readonly statusOptionName: string;
  readonly statusPropName: string;
  readonly labelsPropName?: string;
};

/**
 * Discover Notion database property names and status option.
 *
 * @param token - Notion integration token.
 * @param databaseId - Database UUID.
 * @returns The discovered schema info.
 */
// Export when needed by GC or other consumers
async function discoverNotionSchema(
  token: string,
  databaseId: string,
): Promise<NotionSchema> {
  const dbResp = await fetchWithTimeout(
    `${NOTION_API}/databases/${databaseId}`,
    { headers: notionHeaders(token) },
  );

  if (!dbResp.ok) {
    throw new Error(`Failed to fetch Notion database: ${dbResp.status}`);
  }

  const dbData = (await dbResp.json()) as {
    properties: Record<string, { type: string }>;
  };

  const statusEntry = Object.entries(dbData.properties).find(
    ([, v]) => v.type === 'status',
  );
  const statusPropName = statusEntry?.[0] ?? 'Status';
  const statusProp = statusEntry?.[1] as
    | {
        status?: {
          groups?: ReadonlyArray<{
            name: string;
            option_ids: readonly string[];
          }>;
          options?: ReadonlyArray<{ id: string; name: string }>;
        };
      }
    | undefined;

  const todoGroup = statusProp?.status?.groups?.find((g) => g.name === 'To-do');
  const firstTodoOptionId = todoGroup?.option_ids?.[0];
  const statusOptionName =
    statusProp?.status?.options?.find((o) => o.id === firstTodoOptionId)
      ?.name ??
    statusProp?.status?.options?.[0]?.name ??
    'To-do';

  const titlePropName =
    Object.entries(dbData.properties).find(
      ([, v]) => v.type === 'title',
    )?.[0] ?? 'Name';

  const multiSelectProps = Object.entries(dbData.properties).filter(
    ([, v]) => v.type === 'multi_select',
  );
  const labelsPropName =
    multiSelectProps.find(([k]) => /tags|labels/i.test(k))?.[0] ??
    multiSelectProps[0]?.[0];

  return { titlePropName, statusOptionName, statusPropName, labelsPropName };
}

/**
 * Create a Notion page for E2E testing.
 *
 * @param runId - Unique run ID for test isolation.
 * @param options - Ticket creation options.
 * @returns The created ticket.
 */
export async function createNotionTicket(
  runId: string,
  options: CreateTicketOptions,
): Promise<CreatedTicket> {
  const creds = getNotionCredentials();
  if (!creds) throw new Error('Notion credentials not available');

  const title = buildTitle('notion', runId, options.titleSuffix);
  const schema = await discoverNotionSchema(creds.token, creds.databaseId);

  const pageProperties: Record<string, unknown> = {
    [schema.titlePropName]: {
      title: [{ text: { content: title } }],
    },
    [schema.statusPropName]: {
      status: { name: schema.statusOptionName },
    },
  };

  if (schema.labelsPropName) {
    pageProperties[schema.labelsPropName] = {
      multi_select: [{ name: 'clancy:build' }],
    };
  }

  const response = await fetchWithTimeout(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: notionHeaders(creds.token),
    body: JSON.stringify({
      parent: { database_id: creds.databaseId },
      properties: pageProperties,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create Notion page: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { id: string; url: string };
  const shortId = data.id.replace(/-/g, '').slice(0, 8);

  return { id: data.id, key: `notion-${shortId}`, url: data.url };
}
