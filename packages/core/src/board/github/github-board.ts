/**
 * GitHub Issues board factory.
 *
 * Returns a plain object conforming to the Board type, delegating
 * to the GitHub API, relations, and label functions.
 */
import type { GitHubTicket } from './api/index.js';
import type { GitHubEnv } from '~/c/schemas/index.js';
import type { Fetcher } from '~/c/shared/http/index.js';
import type { Board, FetchedTicket, FetchTicketOpts } from '~/c/types/index.js';

import { Cached } from '~/c/shared/cache/index.js';

import {
  fetchIssues,
  isValidRepo,
  pingGitHub,
  resolveUsername,
} from './api/index.js';
import { addLabel, ensureLabel, removeLabel } from './labels/index.js';
import { fetchBlockerStatus, fetchChildrenStatus } from './relations/index.js';

/** Pattern matching `Epic: #N` or `Parent: #N` in issue descriptions. */
const EPIC_REF_PATTERN = /^(?:Epic|Parent): (#\d+)/m;

/**
 * Extract a parent issue reference from a GitHub issue description.
 *
 * @param description - The issue body text.
 * @returns The `#N` string if found, or `undefined`.
 */
export function parseEpicRef(description: string): string | undefined {
  return description.match(EPIC_REF_PATTERN)?.[1];
}

/** Parse an issue number from a `#N` key string. */
function parseIssueNumber(key: string): number | undefined {
  const num = parseInt(key.replace('#', ''), 10);
  return Number.isNaN(num) ? undefined : num;
}

/** Map a GitHubTicket to the normalised FetchedTicket shape. */
function toFetchedTicket(ticket: GitHubTicket): FetchedTicket {
  return {
    key: ticket.key,
    title: ticket.title,
    description: ticket.description,
    parentInfo: ticket.milestone ?? parseEpicRef(ticket.description) ?? 'none',
    blockers: 'None',
    issueId: ticket.key,
    labels: ticket.labels ?? [],
    status: 'open',
  };
}

/** Internal context for GitHub board operations. */
type GitHubCtx = {
  readonly token: string;
  readonly repo: string;
  readonly defaultLabel?: string;
  readonly usernameCache: Cached<string>;
  readonly fetcher?: Fetcher;
};

/** Fetch and normalise GitHub issues into FetchedTickets. */
async function fetchGitHubTickets(
  ctx: GitHubCtx,
  opts: FetchTicketOpts,
): Promise<readonly FetchedTicket[]> {
  const username = await resolveUsername(
    ctx.token,
    ctx.usernameCache,
    ctx.fetcher,
  );
  const tickets = await fetchIssues({
    token: ctx.token,
    repo: ctx.repo,
    label: opts.buildLabel ?? ctx.defaultLabel,
    username,
    excludeHitl: opts.excludeHitl,
    fetcher: ctx.fetcher,
  });
  return tickets.map(toFetchedTicket);
}

/**
 * Create a Board implementation for GitHub Issues.
 *
 * @param env - The validated GitHub environment variables.
 * @param fetcher - Optional custom fetch function for DI in tests.
 * @returns A Board object that delegates to GitHub API functions.
 */
export function createGitHubBoard(env: GitHubEnv, fetcher?: Fetcher): Board {
  const ctx: GitHubCtx = {
    token: env.GITHUB_TOKEN,
    repo: env.GITHUB_REPO,
    defaultLabel: env.CLANCY_LABEL,
    usernameCache: new Cached<string>(),
    fetcher,
  };
  const doFetch = (opts: FetchTicketOpts) => fetchGitHubTickets(ctx, opts);
  return {
    ping: () => pingGitHub(ctx.token, ctx.repo, ctx.fetcher),

    validateInputs: () =>
      isValidRepo(ctx.repo)
        ? undefined
        : '✗ GITHUB_REPO format is invalid — expected owner/repo',

    fetchTicket: async (opts) => (await doFetch(opts))[0],

    fetchTickets: doFetch,

    async fetchBlockerStatus(ticket) {
      const n = parseIssueNumber(ticket.key);
      const conn = { token: ctx.token, repo: ctx.repo, fetcher: ctx.fetcher };
      return n
        ? fetchBlockerStatus({
            ...conn,
            issueNumber: n,
            body: ticket.description,
          })
        : false;
    },

    async fetchChildrenStatus(parentKey, _parentId?, currentTicketKey?) {
      const n = parseIssueNumber(parentKey);
      const conn = { token: ctx.token, repo: ctx.repo, fetcher: ctx.fetcher };
      return n
        ? fetchChildrenStatus({ ...conn, parentNumber: n, currentTicketKey })
        : undefined;
    },

    transitionTicket: () => Promise.resolve(false),

    ensureLabel: (label) => ensureLabel(ctx, label),

    async addLabel(issueKey, label) {
      await ensureLabel(ctx, label);
      const n = parseIssueNumber(issueKey);
      if (n) await addLabel(ctx, n, label);
    },

    async removeLabel(issueKey, label) {
      const n = parseIssueNumber(issueKey);
      if (n) await removeLabel(ctx, n, label);
    },

    sharedEnv: () => env,
  };
}
