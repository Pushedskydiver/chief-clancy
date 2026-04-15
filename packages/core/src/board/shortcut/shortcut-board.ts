/**
 * Shortcut board factory.
 *
 * Returns a plain object conforming to the Board type, delegating
 * to the Shortcut API, relations, and label functions.
 */
import type {
  ShortcutEnv,
  ShortcutLabelsResponse,
  ShortcutWorkflowsResponse,
} from '~/c/schemas/index.js';
import type { Fetcher } from '~/c/shared/http/index.js';
import type { Board, FetchedTicket, FetchTicketOpts } from '~/c/types/index.js';

import { Cached } from '~/c/shared/cache.js';

import {
  fetchStories,
  pingShortcut,
  resolveWorkflowStateId,
  resolveWorkflowStateIdsByType,
  transitionStory,
} from './api/index.js';
import {
  addLabel,
  ensureLabel,
  parseStoryId,
  removeLabel,
} from './labels/index.js';
import { fetchBlockerStatus, fetchChildrenStatus } from './relations/index.js';

/** Internal context for Shortcut board operations. */
type ShortcutCtx = {
  readonly token: string;
  readonly workflowName?: string;
  readonly defaultLabel?: string;
  readonly workflowCache: Cached<ShortcutWorkflowsResponse>;
  readonly labelCache: Cached<ShortcutLabelsResponse>;
  readonly fetcher?: Fetcher;
};

/** Map a story ticket to the normalised FetchedTicket shape. */
function toFetchedTicket(ticket: {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly storyId: number;
  readonly epicId?: number;
  readonly labels?: readonly string[];
}): FetchedTicket {
  return {
    key: ticket.key,
    title: ticket.title,
    description: ticket.description,
    parentInfo: ticket.epicId ? `epic-${String(ticket.epicId)}` : 'none',
    blockers: 'None',
    issueId: String(ticket.storyId),
    labels: ticket.labels ?? [],
    status: 'unstarted',
  };
}

/** Build the resolve-state opts from context. */
function stateOpts(ctx: ShortcutCtx) {
  return {
    token: ctx.token,
    cache: ctx.workflowCache,
    workflowName: ctx.workflowName,
    fetcher: ctx.fetcher,
  };
}

/** Fetch and normalise Shortcut stories into FetchedTickets. */
async function fetchShortcutTickets(
  ctx: ShortcutCtx,
  opts: FetchTicketOpts,
): Promise<readonly FetchedTicket[]> {
  const stateIds = await resolveWorkflowStateIdsByType(
    'unstarted',
    stateOpts(ctx),
  );

  const tickets = await fetchStories({
    token: ctx.token,
    workflowStateIds: stateIds,
    label: opts.buildLabel ?? ctx.defaultLabel,
    excludeHitl: opts.excludeHitl,
    limit: opts.limit,
    fetcher: ctx.fetcher,
  });

  return tickets.map(toFetchedTicket);
}

/** Transition a story and log on success. */
async function doTransition(
  ctx: ShortcutCtx,
  ticket: FetchedTicket,
  status: string,
): Promise<boolean> {
  const storyId = parseStoryId(ticket.key);
  if (storyId === undefined) return false;

  const stateId = await resolveWorkflowStateId(status, stateOpts(ctx));

  if (stateId === undefined) {
    console.warn(
      `⚠ Shortcut workflow state "${status}" not found — check workflow configuration`,
    );
    return false;
  }

  const ok = await transitionStory({
    token: ctx.token,
    storyId,
    workflowStateId: stateId,
    fetcher: ctx.fetcher,
  });
  if (ok) console.log(`  → Transitioned to ${status}`);
  return ok;
}

/** Check blocker status for a Shortcut story. */
async function fetchShortcutBlocker(ctx: ShortcutCtx, key: string) {
  const storyId = parseStoryId(key);
  return storyId !== undefined
    ? fetchBlockerStatus({
        token: ctx.token,
        storyId,
        workflowCache: ctx.workflowCache,
        fetcher: ctx.fetcher,
      })
    : false;
}

/** Resolve children status for a Shortcut epic. */
async function fetchShortcutChildren(
  ctx: ShortcutCtx,
  parentKey: string,
  parentId?: string,
) {
  const raw = parentId ?? parentKey.replace(/^(?:sc-|epic-)/, '');
  const epicId = parseInt(raw, 10);
  return Number.isNaN(epicId)
    ? undefined
    : fetchChildrenStatus({
        token: ctx.token,
        epicId,
        workflowCache: ctx.workflowCache,
        parentKey,
        fetcher: ctx.fetcher,
      });
}

/** Ensure a label exists then add it to a story. */
async function ensureAndAddLabel(
  ctx: ShortcutCtx,
  issueKey: string,
  label: string,
): Promise<void> {
  await ensureLabel({
    token: ctx.token,
    labelCache: ctx.labelCache,
    label,
    fetcher: ctx.fetcher,
  });
  await addLabel({
    token: ctx.token,
    labelCache: ctx.labelCache,
    issueKey,
    label,
    fetcher: ctx.fetcher,
  });
}

/**
 * Create a Board implementation for Shortcut.
 *
 * @param env - The validated Shortcut environment variables.
 * @param fetcher - Optional custom fetch function for DI in tests.
 * @returns A Board object that delegates to Shortcut API functions.
 */
export function createShortcutBoard(
  env: ShortcutEnv,
  fetcher?: Fetcher,
): Board {
  const ctx: ShortcutCtx = {
    token: env.SHORTCUT_API_TOKEN,
    workflowName: env.SHORTCUT_WORKFLOW,
    defaultLabel: env.CLANCY_LABEL,
    workflowCache: new Cached<ShortcutWorkflowsResponse>(),
    labelCache: new Cached<ShortcutLabelsResponse>(),
    fetcher,
  };

  const doFetch = (opts: FetchTicketOpts) => fetchShortcutTickets(ctx, opts);

  return {
    ping: () => pingShortcut(ctx.token, ctx.fetcher),
    validateInputs: () => undefined,

    fetchTicket: async (opts) => (await doFetch(opts))[0],
    fetchTickets: doFetch,

    fetchBlockerStatus: (ticket) => fetchShortcutBlocker(ctx, ticket.key),

    fetchChildrenStatus: (parentKey, parentId?) =>
      fetchShortcutChildren(ctx, parentKey, parentId),

    transitionTicket: (ticket, status) => doTransition(ctx, ticket, status),

    ensureLabel: (label) =>
      ensureLabel({
        token: ctx.token,
        labelCache: ctx.labelCache,
        label,
        fetcher: ctx.fetcher,
      }),

    addLabel: (issueKey, label) => ensureAndAddLabel(ctx, issueKey, label),

    removeLabel: (issueKey, label) =>
      removeLabel({
        token: ctx.token,
        labelCache: ctx.labelCache,
        issueKey,
        label,
        fetcher: ctx.fetcher,
      }),

    sharedEnv: () => env,
  };
}
