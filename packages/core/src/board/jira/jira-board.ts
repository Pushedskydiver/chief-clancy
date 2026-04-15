/**
 * Jira board factory.
 *
 * Returns a plain object conforming to the Board type, delegating
 * to the Jira API, relations, and label functions.
 */
import type { JiraTicket } from './api.js';
import type { JiraEnv } from '~/c/schemas/index.js';
import type { Fetcher } from '~/c/shared/http/index.js';
import type { Board, FetchedTicket, FetchTicketOpts } from '~/c/types/index.js';

import {
  buildAuthHeader,
  fetchTickets,
  isSafeJqlValue,
  pingJira,
  transitionIssue,
} from './api.js';
import { addLabel, removeLabel } from './labels.js';
import { fetchBlockerStatus, fetchChildrenStatus } from './relations.js';

/** Map a JiraTicket to the normalised FetchedTicket shape. */
function toFetchedTicket(
  ticket: JiraTicket,
  statusName: string,
): FetchedTicket {
  const blockerStr = ticket.blockers.length
    ? `Blocked by: ${ticket.blockers.join(', ')}`
    : 'None';

  return {
    key: ticket.key,
    title: ticket.title,
    description: ticket.description,
    parentInfo: ticket.epicKey ?? 'none',
    blockers: blockerStr,
    issueId: ticket.key,
    labels: ticket.labels ?? [],
    status: statusName,
  };
}

/** Validate JQL-interpolated env values. */
function validateJqlInputs(env: JiraEnv): string | undefined {
  if (!isSafeJqlValue(env.JIRA_PROJECT_KEY)) {
    return '✗ JIRA_PROJECT_KEY contains invalid characters';
  }
  if (env.CLANCY_LABEL && !isSafeJqlValue(env.CLANCY_LABEL)) {
    return '✗ CLANCY_LABEL contains invalid characters';
  }
  if (env.CLANCY_JQL_STATUS && !isSafeJqlValue(env.CLANCY_JQL_STATUS)) {
    return '✗ CLANCY_JQL_STATUS contains invalid characters';
  }
  return undefined;
}

/** Jira connection context. */
type JiraCtx = {
  readonly baseUrl: string;
  readonly auth: string;
  readonly projectKey: string;
  readonly statusName: string;
  readonly fetcher?: Fetcher;
};

/** Fetch and normalise Jira tickets into FetchedTickets. */
async function fetchJiraTickets(
  ctx: JiraCtx,
  opts: FetchTicketOpts,
  env: JiraEnv,
): Promise<readonly FetchedTicket[]> {
  const tickets = await fetchTickets({
    baseUrl: ctx.baseUrl,
    auth: ctx.auth,
    projectKey: ctx.projectKey,
    status: ctx.statusName,
    sprint: env.CLANCY_JQL_SPRINT,
    label: opts.buildLabel ?? env.CLANCY_LABEL,
    excludeHitl: opts.excludeHitl,
    limit: opts.limit,
    fetcher: ctx.fetcher,
  });
  return tickets.map((t) => toFetchedTicket(t, ctx.statusName));
}

/** Transition a Jira issue and log on success. */
async function doTransition(
  ctx: JiraCtx,
  ticket: FetchedTicket,
  status: string,
): Promise<boolean> {
  const ok = await transitionIssue({
    baseUrl: ctx.baseUrl,
    auth: ctx.auth,
    issueKey: ticket.key,
    statusName: status,
    fetcher: ctx.fetcher,
  });
  if (ok) console.log(`  → Transitioned to ${status}`);
  return ok;
}

/**
 * Create a Board implementation for Jira.
 *
 * @param env - The validated Jira environment variables.
 * @param fetcher - Optional custom fetch function for DI in tests.
 * @returns A Board object that delegates to Jira API functions.
 */
export function createJiraBoard(env: JiraEnv, fetcher?: Fetcher): Board {
  const ctx: JiraCtx = {
    baseUrl: env.JIRA_BASE_URL,
    auth: buildAuthHeader(env.JIRA_USER, env.JIRA_API_TOKEN),
    projectKey: env.JIRA_PROJECT_KEY,
    statusName: env.CLANCY_JQL_STATUS ?? 'To Do',
    fetcher,
  };
  const labelCtx = {
    baseUrl: ctx.baseUrl,
    auth: ctx.auth,
    fetcher: ctx.fetcher,
  };
  const doFetch = (opts: FetchTicketOpts) => fetchJiraTickets(ctx, opts, env);

  return {
    ping: () =>
      pingJira({
        baseUrl: ctx.baseUrl,
        projectKey: ctx.projectKey,
        auth: ctx.auth,
        fetcher: ctx.fetcher,
      }),
    validateInputs: () => validateJqlInputs(env),

    fetchTicket: async (opts) => (await doFetch(opts))[0],
    fetchTickets: doFetch,

    fetchBlockerStatus: (ticket) =>
      fetchBlockerStatus({
        baseUrl: ctx.baseUrl,
        auth: ctx.auth,
        key: ticket.key,
        fetcher: ctx.fetcher,
      }),

    fetchChildrenStatus: (parentKey) =>
      fetchChildrenStatus({
        baseUrl: ctx.baseUrl,
        auth: ctx.auth,
        parentKey,
        fetcher: ctx.fetcher,
      }),

    transitionTicket: (ticket, status) => doTransition(ctx, ticket, status),

    ensureLabel: async () => {
      // No-op — Jira auto-creates labels on use.
    },

    addLabel: (issueKey, label) => addLabel(labelCtx, issueKey, label),
    removeLabel: (issueKey, label) => removeLabel(labelCtx, issueKey, label),

    sharedEnv: () => env,
  };
}
