/**
 * Azure DevOps ticket factory for E2E tests.
 */
import type { CreatedTicket, CreateTicketOptions } from './ticket-factory.js';

import { azdoBaseUrl, azdoPatchHeaders, buildAzdoAuth } from '../azdo-auth.js';
import { getAzdoCredentials } from '../env.js';
import { fetchWithTimeout } from '../fetch-timeout.js';
import { buildTitle } from './ticket-factory.js';

/**
 * Resolve the authenticated Azure DevOps user's identity.
 * Tries the VSSPS profile API first, then falls back to connectionData.
 *
 * @param org - Azure DevOps organisation.
 * @param auth - Base64-encoded auth payload.
 * @returns The user's identity string (email or display name).
 */
async function resolveAzdoIdentity(org: string, auth: string): Promise<string> {
  const profileResp = await fetchWithTimeout(
    `https://vssps.dev.azure.com/${encodeURIComponent(org)}/_apis/profile/profiles/me?api-version=7.1`,
    { headers: { Authorization: `Basic ${auth}` } },
  );

  if (profileResp.ok) {
    const data = (await profileResp.json()) as {
      emailAddress?: string;
      displayName?: string;
    };
    if (data.emailAddress) return data.emailAddress;
    if (data.displayName) return data.displayName;
  }

  const connResp = await fetchWithTimeout(
    `https://dev.azure.com/${encodeURIComponent(org)}/_apis/connectionData?api-version=7.1`,
    { headers: { Authorization: `Basic ${auth}` } },
  );

  if (connResp.ok) {
    const data = (await connResp.json()) as {
      authenticatedUser: {
        uniqueName?: string;
        providerDisplayName?: string;
      };
    };
    const name =
      data.authenticatedUser.uniqueName ??
      data.authenticatedUser.providerDisplayName;
    if (name) return name;
  }

  throw new Error(
    'Failed to resolve AzDo identity: no profile or connectionData available',
  );
}

/**
 * Create an Azure DevOps work item for E2E testing.
 *
 * @param runId - Unique run ID for test isolation.
 * @param options - Ticket creation options.
 * @returns The created ticket.
 */
export async function createAzdoTicket(
  runId: string,
  options: CreateTicketOptions,
): Promise<CreatedTicket> {
  const creds = getAzdoCredentials();
  if (!creds) throw new Error('Azure DevOps credentials not available');

  const auth = buildAzdoAuth(creds.pat);
  const base = azdoBaseUrl(creds.org, creds.project);
  const title = buildTitle('azdo', runId, options.titleSuffix);
  const identity = await resolveAzdoIdentity(creds.org, auth);

  const response = await fetchWithTimeout(
    `${base}/wit/workitems/$Task?api-version=7.1`,
    {
      method: 'POST',
      headers: azdoPatchHeaders(auth),
      body: JSON.stringify([
        { op: 'add', path: '/fields/System.Title', value: title },
        {
          op: 'add',
          path: '/fields/System.Description',
          value: 'Automated E2E test ticket created by Clancy QA suite.',
        },
        { op: 'add', path: '/fields/System.Tags', value: 'clancy:build' },
        {
          op: 'add',
          path: '/fields/System.AssignedTo',
          value: identity,
        },
      ]),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to create Azure DevOps work item: ${response.status} ${text}`,
    );
  }

  const data = (await response.json()) as {
    id: number;
    _links: { html: { href: string } };
  };

  return {
    id: String(data.id),
    key: `azdo-${data.id}`,
    url: data._links.html.href,
  };
}
