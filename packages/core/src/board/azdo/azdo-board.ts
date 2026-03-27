/**
 * Azure DevOps board factory.
 *
 * Returns a plain object conforming to the Board type, delegating
 * to the Azure DevOps API, relations, and label functions.
 */
import type { AzdoCtx, AzdoTicket } from './api/index.js';
import type { AzdoEnv } from '~/c/schemas/index.js';
import type { Fetcher } from '~/c/shared/http/index.js';
import type { Board, FetchedTicket, FetchTicketOpts } from '~/c/types/index.js';

import {
  fetchTickets,
  isSafeWiqlValue,
  parseWorkItemId,
  pingAzdo,
  updateWorkItem,
} from './api/index.js';
import { addLabel, removeLabel } from './labels/index.js';
import { fetchBlockerStatus, fetchChildrenStatus } from './relations/index.js';

/** Map an AzdoTicket to the normalised FetchedTicket shape. */
function toFetchedTicket(
  ticket: AzdoTicket,
  statusName: string,
): FetchedTicket {
  return {
    key: ticket.key,
    title: ticket.title,
    description: ticket.description,
    parentInfo: ticket.parentId ? `azdo-${String(ticket.parentId)}` : 'none',
    blockers: 'None',
    issueId: String(ticket.workItemId),
    labels: ticket.labels ?? [],
    status: statusName,
  };
}

/** Validate WIQL-interpolated env values. */
function validateWiqlInputs(env: AzdoEnv): string | undefined {
  if (!env.AZDO_ORG.trim()) return '✗ AZDO_ORG must not be empty';
  if (!env.AZDO_PROJECT.trim()) return '✗ AZDO_PROJECT must not be empty';
  if (!env.AZDO_PAT.trim()) return '✗ AZDO_PAT must not be empty';

  if (!isSafeWiqlValue(env.AZDO_PROJECT)) {
    return '✗ AZDO_PROJECT contains unsafe characters for WIQL queries';
  }

  const status = env.CLANCY_AZDO_STATUS ?? 'New';
  if (!isSafeWiqlValue(status)) {
    return '✗ CLANCY_AZDO_STATUS contains unsafe characters for WIQL queries';
  }

  if (env.CLANCY_AZDO_WIT && !isSafeWiqlValue(env.CLANCY_AZDO_WIT)) {
    return '✗ CLANCY_AZDO_WIT contains unsafe characters for WIQL queries';
  }

  return undefined;
}

/** Fetch and normalise AzDo tickets into FetchedTickets. */
async function fetchAzdoTickets(
  ctx: AzdoCtx,
  opts: FetchTicketOpts,
  env: AzdoEnv,
): Promise<readonly FetchedTicket[]> {
  const status = env.CLANCY_AZDO_STATUS ?? 'New';

  const tickets = await fetchTickets({
    ctx,
    status,
    wit: env.CLANCY_AZDO_WIT,
    excludeHitl: opts.excludeHitl,
    label: opts.buildLabel ?? env.CLANCY_LABEL,
  });

  return tickets.map((t) => toFetchedTicket(t, status));
}

/** Transition an AzDo work item and log on success. */
async function doTransition(
  ctx: AzdoCtx,
  ticket: FetchedTicket,
  status: string,
): Promise<boolean> {
  const workItemId = parseWorkItemId(ticket.key);
  if (workItemId === undefined) return false;

  const ok = await updateWorkItem({
    ctx,
    id: workItemId,
    patchOps: [{ op: 'replace', path: '/fields/System.State', value: status }],
  });

  if (ok) console.log(`  → Transitioned to ${status}`);
  return ok;
}

/**
 * Create a Board implementation for Azure DevOps.
 *
 * @param env - The validated Azure DevOps environment variables.
 * @param fetcher - Optional custom fetch function for DI in tests.
 * @returns A Board object that delegates to Azure DevOps API functions.
 */
export function createAzdoBoard(env: AzdoEnv, fetcher?: Fetcher): Board {
  const ctx: AzdoCtx = {
    org: env.AZDO_ORG,
    project: env.AZDO_PROJECT,
    pat: env.AZDO_PAT,
    fetcher,
  };
  const doFetch = (opts: FetchTicketOpts) => fetchAzdoTickets(ctx, opts, env);

  return {
    ping: () => pingAzdo(ctx),
    validateInputs: () => validateWiqlInputs(env),

    fetchTicket: async (opts) => (await doFetch(opts))[0],
    fetchTickets: doFetch,

    fetchBlockerStatus(ticket) {
      const workItemId = parseWorkItemId(ticket.key);
      return workItemId !== undefined
        ? fetchBlockerStatus(ctx, workItemId)
        : Promise.resolve(false);
    },

    fetchChildrenStatus(parentKey, parentId?) {
      const id = parseWorkItemId(parentId ?? parentKey);
      return id === undefined
        ? Promise.resolve(undefined)
        : fetchChildrenStatus({ ctx, parentId: id, parentKey });
    },

    transitionTicket: (ticket, status) => doTransition(ctx, ticket, status),

    ensureLabel: async () => {
      // Azure DevOps tags auto-create — no-op.
    },

    addLabel: (issueKey, label) => addLabel(ctx, issueKey, label),
    removeLabel: (issueKey, label) => removeLabel(ctx, issueKey, label),

    sharedEnv: () => env,
  };
}
