/**
 * Linear ticket factory for E2E tests.
 */
import type { CreatedTicket, CreateTicketOptions } from './ticket-factory.js';

import { getLinearCredentials } from '../env.js';
import { fetchWithTimeout } from '../fetch-timeout.js';
import { buildTitle } from './ticket-factory.js';

const LINEAR_API_URL = 'https://api.linear.app/graphql';

function linearHeaders(apiKey: string): Record<string, string> {
  return { Authorization: apiKey, 'Content-Type': 'application/json' };
}

/**
 * Execute a Linear GraphQL query.
 *
 * @param apiKey - Linear API key.
 * @param query - GraphQL query string.
 * @param variables - Query variables.
 * @returns The parsed data field.
 */
async function linearGraphql<T>(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetchWithTimeout(LINEAR_API_URL, {
    method: 'POST',
    headers: linearHeaders(apiKey),
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Linear GraphQL error: ${response.status} ${text}`);
  }

  const json = (await response.json()) as {
    data?: T;
    errors?: ReadonlyArray<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(`Linear GraphQL error: ${json.errors[0].message}`);
  }

  if (json.data == null) {
    throw new Error(
      `Linear GraphQL error: missing data in response: ${JSON.stringify(json)}`,
    );
  }

  return json.data;
}

/**
 * Resolve the Linear team UUID from a key or UUID.
 * LINEAR_TEAM_ID may be a key (e.g. "clancy-qa") or UUID.
 *
 * @param apiKey - Linear API key.
 * @param teamIdOrKey - Team ID or key.
 * @returns The resolved team UUID.
 */
export async function resolveLinearTeamUuid(
  apiKey: string,
  teamIdOrKey: string,
): Promise<string> {
  if (/^[0-9a-f]{8}-/i.test(teamIdOrKey)) return teamIdOrKey;

  const data = await linearGraphql<{
    teams: { nodes: ReadonlyArray<{ id: string; key: string; name: string }> };
  }>(apiKey, `{ teams { nodes { id key name } } }`);

  const needle = teamIdOrKey.toLowerCase();
  const team = data.teams.nodes.find(
    (t) =>
      t.key.toLowerCase() === needle ||
      t.name.toLowerCase() === needle ||
      t.id === teamIdOrKey,
  );

  if (!team) {
    const available = data.teams.nodes
      .map((t) => `${t.key} (${t.name}) [${t.id}]`)
      .join(', ');
    throw new Error(
      `Linear team not found for "${teamIdOrKey}". Available: ${available}`,
    );
  }

  return team.id;
}

/** Look up the first "unstarted" workflow state ID for the team. */
async function resolveUnstartedStateId(
  apiKey: string,
  teamUuid: string,
): Promise<string> {
  const data = await linearGraphql<{
    team: {
      states: {
        nodes: ReadonlyArray<{ id: string; name: string; type: string }>;
      };
    };
  }>(
    apiKey,
    `query($teamId: String!) {
      team(id: $teamId) { states { nodes { id name type } } }
    }`,
    { teamId: teamUuid },
  );

  const state = data.team.states.nodes.find((s) => s.type === 'unstarted');
  if (!state)
    throw new Error('No unstarted workflow state found for Linear team');
  return state.id;
}

/** Look up or create a label on the team. */
async function resolveLabelId(
  apiKey: string,
  teamId: string,
  labelName: string,
): Promise<string> {
  const data = await linearGraphql<{
    team: {
      labels: { nodes: ReadonlyArray<{ id: string; name: string }> };
    };
  }>(
    apiKey,
    `query($teamId: String!) {
      team(id: $teamId) { labels { nodes { id name } } }
    }`,
    { teamId },
  );

  const existing = data.team.labels.nodes.find((l) => l.name === labelName);
  if (existing) return existing.id;

  const created = await linearGraphql<{
    issueLabelCreate: { issueLabel: { id: string } };
  }>(
    apiKey,
    `mutation($teamId: String!, $name: String!) {
      issueLabelCreate(input: { teamId: $teamId, name: $name, color: "#0075ca" }) {
        issueLabel { id }
      }
    }`,
    { teamId, name: labelName },
  );

  return created.issueLabelCreate.issueLabel.id;
}

/** Resolve the authenticated Linear user's ID. */
async function resolveViewerId(apiKey: string): Promise<string> {
  const data = await linearGraphql<{ viewer: { id: string } }>(
    apiKey,
    `query { viewer { id } }`,
  );
  return data.viewer.id;
}

/**
 * Create a Linear issue for E2E testing.
 *
 * @param runId - Unique run ID for test isolation.
 * @param options - Ticket creation options.
 * @returns The created ticket.
 */
export async function createLinearTicket(
  runId: string,
  options: CreateTicketOptions,
): Promise<CreatedTicket> {
  const creds = getLinearCredentials();
  if (!creds) throw new Error('Linear credentials not available');

  const title = buildTitle('linear', runId, options.titleSuffix);
  const teamUuid = await resolveLinearTeamUuid(creds.apiKey, creds.teamId);

  const [stateId, labelId, viewerId] = await Promise.all([
    resolveUnstartedStateId(creds.apiKey, teamUuid),
    resolveLabelId(creds.apiKey, teamUuid, 'clancy:build'),
    resolveViewerId(creds.apiKey),
  ]);

  const data = await linearGraphql<{
    issueCreate: {
      issue: { id: string; identifier: string; url: string };
    };
  }>(
    creds.apiKey,
    `mutation($teamId: String!, $title: String!, $stateId: String!, $labelIds: [String!], $assigneeId: String!) {
      issueCreate(input: {
        teamId: $teamId, title: $title,
        description: "Automated E2E test ticket created by Clancy QA suite.",
        stateId: $stateId, labelIds: $labelIds, assigneeId: $assigneeId,
      }) { issue { id identifier url } }
    }`,
    {
      teamId: teamUuid,
      title,
      stateId,
      labelIds: [labelId],
      assigneeId: viewerId,
    },
  );

  const issue = data.issueCreate.issue;
  return { id: issue.id, key: issue.identifier, url: issue.url };
}
