/**
 * Shortcut ticket factory for E2E tests.
 */
import type { CreatedTicket, CreateTicketOptions } from './ticket-factory.js';

import { getShortcutCredentials } from '../env.js';
import { fetchWithTimeout } from '../fetch-timeout.js';
import { buildTitle } from './ticket-factory.js';

const SHORTCUT_API = 'https://api.app.shortcut.com/api/v3';

function shortcutHeaders(token: string): Record<string, string> {
  return { 'Shortcut-Token': token, 'Content-Type': 'application/json' };
}

/** Resolve the first "Unstarted" workflow state ID. */
async function resolveUnstartedStateId(token: string): Promise<number> {
  const response = await fetchWithTimeout(`${SHORTCUT_API}/workflows`, {
    headers: shortcutHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Shortcut workflows: ${response.status}`);
  }

  const workflows = (await response.json()) as ReadonlyArray<{
    states: ReadonlyArray<{ id: number; type: string }>;
  }>;

  for (const wf of workflows) {
    const state = wf.states.find((s) => s.type === 'unstarted');
    if (state) return state.id;
  }

  throw new Error('No unstarted workflow state found in Shortcut');
}

/**
 * Resolve the authenticated member's UUID.
 * Tries /member-info first (user tokens), falls back to /members (API tokens).
 */
async function resolveMemberId(token: string): Promise<string> {
  const infoResp = await fetchWithTimeout(`${SHORTCUT_API}/member-info`, {
    headers: shortcutHeaders(token),
  });

  if (infoResp.ok) {
    const data = (await infoResp.json()) as {
      id?: string;
      member?: { id: string };
    };
    const memberId = data.member?.id ?? data.id;
    if (memberId) return memberId;
  }

  const membersResp = await fetchWithTimeout(`${SHORTCUT_API}/members`, {
    headers: shortcutHeaders(token),
  });

  if (!membersResp.ok) {
    throw new Error(`Failed to resolve Shortcut member: ${membersResp.status}`);
  }

  const members = (await membersResp.json()) as ReadonlyArray<{
    id: string;
    role: string;
  }>;

  const owner = members.find((m) => m.role === 'owner') ?? members[0];
  if (!owner) throw new Error('No members found in Shortcut workspace');
  return owner.id;
}

/**
 * Create a Shortcut story for E2E testing.
 *
 * @param runId - Unique run ID for test isolation.
 * @param options - Ticket creation options.
 * @returns The created ticket.
 */
export async function createShortcutTicket(
  runId: string,
  options: CreateTicketOptions,
): Promise<CreatedTicket> {
  const creds = getShortcutCredentials();
  if (!creds) throw new Error('Shortcut credentials not available');

  const title = buildTitle('shortcut', runId, options.titleSuffix);

  const [stateId, memberId] = await Promise.all([
    resolveUnstartedStateId(creds.token),
    resolveMemberId(creds.token),
  ]);

  const response = await fetchWithTimeout(`${SHORTCUT_API}/stories`, {
    method: 'POST',
    headers: shortcutHeaders(creds.token),
    body: JSON.stringify({
      name: title,
      description: 'Automated E2E test ticket created by Clancy QA suite.',
      workflow_state_id: stateId,
      owner_ids: [memberId],
      labels: [{ name: 'clancy:build' }],
      // Explicitly no epic — prevents workspace automation assigning one
      epic_id: null,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to create Shortcut story: ${response.status} ${text}`,
    );
  }

  const data = (await response.json()) as { id: number; app_url: string };

  return {
    id: String(data.id),
    key: `sc-${data.id}`,
    url: data.app_url,
  };
}
