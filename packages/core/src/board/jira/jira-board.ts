/**
 * Jira board factory.
 *
 * Returns a plain object conforming to the Board type, delegating
 * to the Jira API, relations, and label functions.
 */
import type { JiraEnv } from '../../schemas/index.js';
import type {
  Board,
  FetchedTicket,
  FetchTicketOpts,
} from '../../types/index.js';
import type { JiraTicket } from './api/index.js';

import {
  buildAuthHeader,
  fetchTickets,
  isSafeJqlValue,
  pingJira,
  transitionIssue,
} from './api/index.js';
import { addLabel, removeLabel } from './labels/index.js';
import { fetchBlockerStatus, fetchChildrenStatus } from './relations/index.js';

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
};

/** Fetch and normalise Jira tickets. */
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
  });
  return tickets.map((t) => toFetchedTicket(t, ctx.statusName));
}

/**
 * Create a Board implementation for Jira.
 *
 * @param env - The validated Jira environment variables.
 * @returns A Board object that delegates to Jira API functions.
 */
export function createJiraBoard(env: JiraEnv): Board {
  const ctx: JiraCtx = {
    baseUrl: env.JIRA_BASE_URL,
    auth: buildAuthHeader(env.JIRA_USER, env.JIRA_API_TOKEN),
    projectKey: env.JIRA_PROJECT_KEY,
    statusName: env.CLANCY_JQL_STATUS ?? 'To Do',
  };
  const labelCtx = { baseUrl: ctx.baseUrl, auth: ctx.auth };

  return {
    ping: () => pingJira(ctx.baseUrl, ctx.projectKey, ctx.auth),
    validateInputs: () => validateJqlInputs(env),
    fetchTicket: async (opts) => (await fetchJiraTickets(ctx, opts, env))[0],
    fetchTickets: (opts) => fetchJiraTickets(ctx, opts, env),
    fetchBlockerStatus: (ticket) =>
      fetchBlockerStatus(ctx.baseUrl, ctx.auth, ticket.key),
    fetchChildrenStatus: (parentKey) =>
      fetchChildrenStatus(ctx.baseUrl, ctx.auth, parentKey),
    async transitionTicket(ticket, status) {
      const ok = await transitionIssue({
        baseUrl: ctx.baseUrl,
        auth: ctx.auth,
        issueKey: ticket.key,
        statusName: status,
      });
      if (ok) console.log(`  → Transitioned to ${status}`);
      return ok;
    },
    ensureLabel: async () => {
      // No-op — Jira auto-creates labels on use.
    },
    addLabel: (issueKey, label) => addLabel(labelCtx, issueKey, label),
    removeLabel: (issueKey, label) => removeLabel(labelCtx, issueKey, label),
    sharedEnv: () => env,
  };
}
