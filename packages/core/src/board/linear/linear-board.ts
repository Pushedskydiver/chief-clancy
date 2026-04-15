/**
 * Linear board factory.
 *
 * Returns a plain object conforming to the Board type, delegating
 * to the Linear API, relations, and label functions.
 */
import type { LinearEnv } from '~/c/schemas/index.js';
import type { Fetcher } from '~/c/shared/http/index.js';
import type { Board, FetchedTicket, FetchTicketOpts } from '~/c/types/index.js';

import { CachedMap } from '~/c/shared/cache.js';

import { fetchIssues, isValidTeamId, pingLinear } from './api.js';
import { addLabel, ensureLabel, removeLabel } from './labels.js';
import {
  fetchBlockerStatus,
  fetchChildrenStatus,
  transitionIssue,
} from './relations.js';

/** Internal context for Linear board operations. */
type LinearCtx = {
  readonly apiKey: string;
  readonly teamId: string;
  readonly defaultLabel?: string;
  readonly labelCache: CachedMap<string, string>;
  readonly fetcher?: Fetcher;
};

/** Map a Linear ticket to the normalised FetchedTicket shape. */
function toFetchedTicket(ticket: {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly issueId: string;
  readonly parentIdentifier?: string;
  readonly labels?: readonly string[];
}): FetchedTicket {
  return {
    key: ticket.key,
    title: ticket.title,
    description: ticket.description,
    parentInfo: ticket.parentIdentifier ?? 'none',
    blockers: 'None',
    linearIssueId: ticket.issueId,
    issueId: ticket.issueId,
    labels: ticket.labels ?? [],
    status: 'unstarted',
  };
}

/** Fetch and normalise Linear issues into FetchedTickets. */
async function fetchLinearTickets(
  ctx: LinearCtx,
  opts: FetchTicketOpts,
): Promise<readonly FetchedTicket[]> {
  const tickets = await fetchIssues({
    apiKey: ctx.apiKey,
    teamId: ctx.teamId,
    label: opts.buildLabel ?? ctx.defaultLabel,
    excludeHitl: opts.excludeHitl,
    limit: opts.limit,
    fetcher: ctx.fetcher,
  });

  return tickets.map(toFetchedTicket);
}

/** Transition a Linear issue and log on success. */
async function doTransition(
  ctx: LinearCtx,
  ticket: FetchedTicket,
  status: string,
): Promise<boolean> {
  if (!ticket.linearIssueId) return false;

  const ok = await transitionIssue({
    apiKey: ctx.apiKey,
    teamId: ctx.teamId,
    issueId: ticket.linearIssueId,
    stateName: status,
    fetcher: ctx.fetcher,
  });

  if (ok) console.log(`  → Transitioned to ${status}`);
  return ok;
}

/** Ensure a label exists then add it to an issue. */
async function ensureAndAddLabel(
  ctx: LinearCtx,
  issueKey: string,
  label: string,
): Promise<void> {
  await ensureLabel({
    apiKey: ctx.apiKey,
    teamId: ctx.teamId,
    labelCache: ctx.labelCache,
    label,
    fetcher: ctx.fetcher,
  });
  await addLabel({
    apiKey: ctx.apiKey,
    labelCache: ctx.labelCache,
    issueKey,
    label,
    fetcher: ctx.fetcher,
  });
}

/**
 * Create a Board implementation for Linear.
 *
 * @param env - The validated Linear environment variables.
 * @param fetcher - Optional custom fetch function for DI in tests.
 * @returns A Board object that delegates to Linear API functions.
 */
export function createLinearBoard(env: LinearEnv, fetcher?: Fetcher): Board {
  const ctx: LinearCtx = {
    apiKey: env.LINEAR_API_KEY,
    teamId: env.LINEAR_TEAM_ID,
    defaultLabel: env.CLANCY_LABEL,
    labelCache: new CachedMap<string, string>(),
    fetcher,
  };

  const doFetch = (opts: FetchTicketOpts) => fetchLinearTickets(ctx, opts);

  return {
    ping: () => pingLinear(ctx.apiKey, ctx.fetcher),

    validateInputs: () =>
      isValidTeamId(ctx.teamId)
        ? undefined
        : '✗ LINEAR_TEAM_ID contains invalid characters',

    fetchTicket: async (opts) => (await doFetch(opts))[0],

    fetchTickets: doFetch,

    async fetchBlockerStatus(ticket) {
      if (!ticket.issueId) return false;
      return fetchBlockerStatus(ctx.apiKey, ticket.issueId, ctx.fetcher);
    },

    fetchChildrenStatus: (parentKey, parentId?) =>
      fetchChildrenStatus({
        apiKey: ctx.apiKey,
        parentId: parentId ?? parentKey,
        parentIdentifier: parentKey,
        fetcher: ctx.fetcher,
      }),

    transitionTicket: (ticket, status) => doTransition(ctx, ticket, status),

    ensureLabel: (label) =>
      ensureLabel({
        apiKey: ctx.apiKey,
        teamId: ctx.teamId,
        labelCache: ctx.labelCache,
        label,
        fetcher: ctx.fetcher,
      }),

    addLabel: (issueKey, label) => ensureAndAddLabel(ctx, issueKey, label),

    removeLabel: (issueKey, label) =>
      removeLabel({
        apiKey: ctx.apiKey,
        labelCache: ctx.labelCache,
        issueKey,
        label,
        fetcher: ctx.fetcher,
      }),

    sharedEnv: () => env,
  };
}
