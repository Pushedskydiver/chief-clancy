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
} from '~/schemas/index.js';
import type { Board, FetchedTicket, FetchTicketOpts } from '~/types/index.js';

import { Cached } from '~/shared/cache/index.js';

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

  const ok = await transitionStory(ctx.token, storyId, stateId);
  if (ok) console.log(`  → Transitioned to ${status}`);
  return ok;
}

/** Ensure a label exists then add it to a story. */
async function ensureAndAddLabel(
  ctx: ShortcutCtx,
  issueKey: string,
  label: string,
): Promise<void> {
  await ensureLabel({ token: ctx.token, labelCache: ctx.labelCache, label });
  await addLabel({
    token: ctx.token,
    labelCache: ctx.labelCache,
    issueKey,
    label,
  });
}

/**
 * Create a Board implementation for Shortcut.
 *
 * @param env - The validated Shortcut environment variables.
 * @returns A Board object that delegates to Shortcut API functions.
 */
export function createShortcutBoard(env: ShortcutEnv): Board {
  const ctx: ShortcutCtx = {
    token: env.SHORTCUT_API_TOKEN,
    workflowName: env.SHORTCUT_WORKFLOW,
    defaultLabel: env.CLANCY_LABEL,
    workflowCache: new Cached<ShortcutWorkflowsResponse>(),
    labelCache: new Cached<ShortcutLabelsResponse>(),
  };

  const doFetch = (opts: FetchTicketOpts) => fetchShortcutTickets(ctx, opts);

  return {
    ping: () => pingShortcut(ctx.token),
    validateInputs: () => undefined,

    fetchTicket: async (opts) => (await doFetch(opts))[0],
    fetchTickets: doFetch,

    async fetchBlockerStatus(ticket) {
      const storyId = parseStoryId(ticket.key);
      return storyId !== undefined
        ? fetchBlockerStatus(ctx.token, storyId, ctx.workflowCache)
        : false;
    },

    fetchChildrenStatus(parentKey, parentId?) {
      const raw = parentId ?? parentKey.replace(/^(?:sc-|epic-)/, '');
      const epicId = parseInt(raw, 10);
      return Number.isNaN(epicId)
        ? Promise.resolve(undefined)
        : fetchChildrenStatus({
            token: ctx.token,
            epicId,
            workflowCache: ctx.workflowCache,
            parentKey,
          });
    },

    transitionTicket: (ticket, status) => doTransition(ctx, ticket, status),

    ensureLabel: (label) =>
      ensureLabel({ token: ctx.token, labelCache: ctx.labelCache, label }),

    addLabel: (issueKey, label) => ensureAndAddLabel(ctx, issueKey, label),

    removeLabel: (issueKey, label) =>
      removeLabel({
        token: ctx.token,
        labelCache: ctx.labelCache,
        issueKey,
        label,
      }),

    sharedEnv: () => env,
  };
}
