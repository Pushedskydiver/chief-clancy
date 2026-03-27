/**
 * Notion board factory.
 *
 * Returns a plain object conforming to the Board type. Notion's dynamic
 * property system requires configurable property names via env vars.
 *
 * Key format: `notion-{first-8-chars-of-uuid}` (e.g., `notion-ab12cd34`)
 * Full UUID stored in `issueId` for API calls.
 */
import type { NotionCtx } from './api/index.js';
import type { NotionEnv, NotionPage } from '~/c/schemas/index.js';
import type { Fetcher } from '~/c/shared/http/index.js';
import type { Board, FetchedTicket, FetchTicketOpts } from '~/c/types/index.js';

import {
  buildNotionKey,
  getArrayProperty,
  getDescriptionText,
  getPageTitle,
  pingNotion,
  queryDatabase,
  updatePage,
} from './api/index.js';
import { addLabel, removeLabel } from './labels/index.js';
import { fetchBlockerStatus, fetchChildrenStatus } from './relations/index.js';

/** Default property names for Notion databases. */
const DEFAULTS = {
  status: 'Status',
  labels: 'Labels',
  parent: 'Epic',
  todo: 'To-do',
} as const;

/** Resolved Notion property configuration. */
type NotionProps = {
  readonly statusProp: string;
  readonly labelsProp: string;
  readonly parentProp: string;
  readonly todoName: string;
};

/** UUID pattern for NOTION_DATABASE_ID validation. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/** Convert a Notion page to a FetchedTicket. */
function pageToFetchedTicket(
  page: NotionPage,
  props: NotionProps,
): FetchedTicket {
  const parentRelations = getArrayProperty(page, props.parentProp, 'relation');
  const hasParent = parentRelations && parentRelations.length > 0;
  const parentInfo = hasParent ? buildNotionKey(parentRelations[0]) : 'none';

  return {
    key: buildNotionKey(page.id),
    title: getPageTitle(page),
    description: getDescriptionText(page) ?? '',
    parentInfo,
    blockers: 'None',
    issueId: page.id,
    labels: getArrayProperty(page, props.labelsProp, 'multi_select') ?? [],
    status: props.todoName,
  };
}

/** Options for {@link fetchNotionTickets}. */
type FetchNotionOpts = {
  readonly ctx: NotionCtx;
  readonly fetchOpts: FetchTicketOpts;
  readonly props: NotionProps;
  readonly defaultLabel?: string;
};

/** Fetch and normalise Notion pages into FetchedTickets. */
async function fetchNotionTickets(
  opts: FetchNotionOpts,
): Promise<readonly FetchedTicket[]> {
  const { ctx, fetchOpts, props, defaultLabel } = opts;
  const filter = {
    property: props.statusProp,
    status: { equals: props.todoName },
  };

  const result = await queryDatabase({ ctx, filter });
  if (!result) return [];

  const hitlFiltered = fetchOpts.excludeHitl
    ? result.results.filter((page) => {
        const labels = getArrayProperty(page, props.labelsProp, 'multi_select');
        return !labels?.includes('clancy:hitl');
      })
    : [...result.results];

  const requiredLabel = fetchOpts.buildLabel ?? defaultLabel;
  const labelFiltered = requiredLabel
    ? hitlFiltered.filter((page) => {
        const labels = getArrayProperty(page, props.labelsProp, 'multi_select');
        return labels?.includes(requiredLabel);
      })
    : hitlFiltered;

  return labelFiltered
    .slice(0, 5)
    .map((page) => pageToFetchedTicket(page, props));
}

/** Options for {@link doTransition}. */
type TransitionOpts = {
  readonly token: string;
  readonly ticket: FetchedTicket;
  readonly status: string;
  readonly statusProp: string;
};

/** Transition a page's status (tries status type, falls back to select). */
async function doTransition(opts: TransitionOpts): Promise<boolean> {
  const { token, ticket, status, statusProp } = opts;
  const pageId = ticket.issueId;
  if (!pageId) return false;

  const ok = await updatePage(token, pageId, {
    [statusProp]: { status: { name: status } },
  });

  if (ok) {
    console.log(`  → Transitioned to ${status}`);
    return true;
  }

  const fallbackOk = await updatePage(token, pageId, {
    [statusProp]: { select: { name: status } },
  });

  if (fallbackOk) console.log(`  → Transitioned to ${status}`);
  return fallbackOk;
}

/** Build connection context from env. */
function buildCtx(env: NotionEnv, fetcher?: Fetcher): NotionCtx {
  return {
    token: env.NOTION_TOKEN,
    databaseId: env.NOTION_DATABASE_ID,
    fetcher,
  };
}

/** Resolve property names from env with defaults. */
function buildProps(env: NotionEnv): NotionProps {
  return {
    statusProp: env.CLANCY_NOTION_STATUS ?? DEFAULTS.status,
    labelsProp: env.CLANCY_NOTION_LABELS ?? DEFAULTS.labels,
    parentProp: env.CLANCY_NOTION_PARENT ?? DEFAULTS.parent,
    todoName: env.CLANCY_NOTION_TODO ?? DEFAULTS.todo,
  };
}

/**
 * Create a Board implementation for Notion.
 *
 * @param env - The validated Notion environment variables.
 * @param fetcher - Optional custom fetch function for DI in tests.
 * @returns A Board object that delegates to Notion API functions.
 */
export function createNotionBoard(env: NotionEnv, fetcher?: Fetcher): Board {
  const ctx = buildCtx(env, fetcher);
  const props = buildProps(env);
  const doFetch = (fetchOpts: FetchTicketOpts) =>
    fetchNotionTickets({
      ctx,
      fetchOpts,
      props,
      defaultLabel: env.CLANCY_LABEL,
    });

  return {
    ping: () => pingNotion(ctx.token),

    validateInputs() {
      if (!UUID_PATTERN.test(env.NOTION_DATABASE_ID)) {
        return '✗ NOTION_DATABASE_ID does not look like a valid UUID';
      }
      return undefined;
    },

    fetchTicket: async (opts) => (await doFetch(opts))[0],
    fetchTickets: doFetch,

    fetchBlockerStatus(ticket) {
      const pageId = ticket.issueId;
      return pageId
        ? fetchBlockerStatus({ ctx, pageId, statusProp: props.statusProp })
        : Promise.resolve(false);
    },

    fetchChildrenStatus(parentKey) {
      return fetchChildrenStatus({
        ctx,
        parentKey,
        parentProp: props.parentProp,
        statusProp: props.statusProp,
      });
    },

    transitionTicket: (ticket, status) =>
      doTransition({
        token: ctx.token,
        ticket,
        status,
        statusProp: props.statusProp,
      }),

    ensureLabel: async () => {
      // No-op — Notion multi_select options auto-create on first PATCH.
    },

    addLabel: (issueKey, label) =>
      addLabel({ ctx, issueKey, label, labelsProp: props.labelsProp }),

    removeLabel: (issueKey, label) =>
      removeLabel({ ctx, issueKey, label, labelsProp: props.labelsProp }),

    sharedEnv: () => env,
  };
}
