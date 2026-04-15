/**
 * Linear issue relationship functions.
 *
 * Checks blocker status (via issue relations), children status
 * (via Epic: text convention + native children API), and issue
 * state transitions via GraphQL mutations.
 */
import type { Fetcher } from '~/c/shared/http/index.js';
import type { ChildrenStatus } from '~/c/types/index.js';

import {
  linearIssueChildrenResponseSchema,
  linearIssueRelationsResponseSchema,
  linearIssueSearchResponseSchema,
  linearIssueUpdateResponseSchema,
  linearWorkflowStatesResponseSchema,
} from '~/c/schemas/index.js';

import { linearGraphql } from './api.js';

/** Set of Linear state types that indicate a resolved issue. */
const DONE_TYPES = new Set(['completed', 'canceled']);

/**
 * Check whether a Linear issue is blocked by unresolved blockers.
 *
 * @param apiKey - The Linear personal API key.
 * @param issueId - The Linear issue UUID.
 * @returns `true` if any blocker is unresolved, `false` otherwise.
 */
export async function fetchBlockerStatus(
  apiKey: string,
  issueId: string,
  fetcher?: Fetcher,
): Promise<boolean> {
  const query = `
    query($issueId: String!) {
      issue(id: $issueId) {
        relations {
          nodes {
            type
            relatedIssue {
              state { type }
            }
          }
        }
      }
    }
  `;

  const raw = await linearGraphql({
    apiKey,
    query,
    variables: { issueId },
    fetcher,
  });
  const parsed = linearIssueRelationsResponseSchema.safeParse(raw);
  if (!parsed.success) return false;

  const relations = parsed.data.data?.issue?.relations?.nodes ?? [];

  return relations.some((rel) => {
    if (rel.type !== 'blockedBy') return false;
    const stateType = rel.relatedIssue?.state?.type;
    if (!stateType) return false;
    return !DONE_TYPES.has(stateType);
  });
}

/** Options for {@link fetchChildrenStatus}. */
type FetchChildrenOpts = {
  readonly apiKey: string;
  readonly parentId: string;
  readonly parentIdentifier?: string;
  readonly fetcher?: Fetcher;
};

/**
 * Fetch children status of a Linear parent issue (dual-mode).
 *
 * Tries the `Epic: {identifier}` text convention first. Falls back
 * to the native `children` API for backward compatibility.
 *
 * @param opts - API key, parent ID, and optional parent identifier.
 * @returns The children status, or `undefined` on failure.
 */
export async function fetchChildrenStatus(
  opts: FetchChildrenOpts,
): Promise<ChildrenStatus | undefined> {
  const { apiKey, parentId, parentIdentifier, fetcher } = opts;
  try {
    if (parentIdentifier) {
      const epicResult = await fetchChildrenByDescription(
        apiKey,
        `Epic: ${parentIdentifier}`,
        fetcher,
      );

      if (epicResult && epicResult.total > 0) return epicResult;
    }

    return await fetchChildrenByNativeApi(apiKey, parentId, fetcher);
  } catch {
    return undefined;
  }
}

/** Count children status from an array of state nodes. */
function countChildrenStatus(
  nodes: ReadonlyArray<{ readonly state?: { readonly type?: string } }>,
): ChildrenStatus {
  const total = nodes.length;
  const incomplete = nodes.filter(
    (n) => !n.state?.type || !DONE_TYPES.has(n.state.type),
  ).length;
  return { total, incomplete };
}

/** Fetch children status by searching for a description substring. */
async function fetchChildrenByDescription(
  apiKey: string,
  descriptionRef: string,
  fetcher?: Fetcher,
): Promise<ChildrenStatus | undefined> {
  const query = `
    query($filter: String!) {
      issueSearch(query: $filter) {
        nodes {
          state { type }
        }
      }
    }
  `;

  const raw = await linearGraphql({
    apiKey,
    query,
    variables: { filter: descriptionRef },
    fetcher,
  });
  const parsed = linearIssueSearchResponseSchema.safeParse(raw);
  if (!parsed.success) return undefined;

  const nodes = parsed.data.data?.issueSearch?.nodes ?? [];
  return countChildrenStatus(nodes);
}

/** Fetch children status using the native parent-child API. */
async function fetchChildrenByNativeApi(
  apiKey: string,
  parentId: string,
  fetcher?: Fetcher,
): Promise<ChildrenStatus | undefined> {
  const query = `
    query($issueId: String!) {
      issue(id: $issueId) {
        children {
          nodes {
            state { type }
          }
        }
      }
    }
  `;

  const raw = await linearGraphql({
    apiKey,
    query,
    variables: { issueId: parentId },
    fetcher,
  });
  const parsed = linearIssueChildrenResponseSchema.safeParse(raw);
  if (!parsed.success) return undefined;

  const nodes = parsed.data.data?.issue?.children?.nodes ?? [];
  return countChildrenStatus(nodes);
}

/** Options for {@link lookupWorkflowStateId}. */
type LookupStateOpts = {
  readonly apiKey: string;
  readonly teamId: string;
  readonly stateName: string;
  readonly fetcher?: Fetcher;
};

/**
 * Look up a Linear workflow state ID by name and team.
 *
 * @param opts - API key, team ID, and state name.
 * @returns The state ID, or `undefined` if not found.
 */
export async function lookupWorkflowStateId(
  opts: LookupStateOpts,
): Promise<string | undefined> {
  const { apiKey, teamId, stateName, fetcher } = opts;
  const query = `
    query($teamId: String!, $name: String!) {
      workflowStates(filter: {
        team: { id: { eq: $teamId } }
        name: { eq: $name }
      }) {
        nodes { id }
      }
    }
  `;

  const raw = await linearGraphql({
    apiKey,
    query,
    variables: { teamId, name: stateName },
    fetcher,
  });
  const parsed = linearWorkflowStatesResponseSchema.safeParse(raw);
  if (!parsed.success) return undefined;

  return parsed.data.data?.workflowStates?.nodes?.[0]?.id;
}

/** Options for {@link transitionIssue}. */
type TransitionOpts = {
  readonly apiKey: string;
  readonly teamId: string;
  readonly issueId: string;
  readonly stateName: string;
  readonly fetcher?: Fetcher;
};

/**
 * Transition a Linear issue to a new workflow state.
 *
 * Looks up the state ID by name, then executes an `issueUpdate` mutation.
 *
 * @param opts - API key, team/issue IDs, and target state name.
 * @returns `true` if the transition succeeded.
 */
export async function transitionIssue(opts: TransitionOpts): Promise<boolean> {
  const { apiKey, teamId, issueId, stateName, fetcher } = opts;

  try {
    const stateId = await lookupWorkflowStateId({
      apiKey,
      teamId,
      stateName,
      fetcher,
    });

    if (!stateId) {
      console.warn(
        `⚠ Linear workflow state "${stateName}" not found — check team configuration`,
      );
      return false;
    }

    const mutation = `
      mutation($issueId: String!, $stateId: String!) {
        issueUpdate(id: $issueId, input: { stateId: $stateId }) {
          success
        }
      }
    `;

    const raw = await linearGraphql({
      apiKey,
      query: mutation,
      variables: { issueId, stateId },
      fetcher,
    });
    const parsed = linearIssueUpdateResponseSchema.safeParse(raw);
    if (!parsed.success) return false;

    return parsed.data.data?.issueUpdate?.success === true;
  } catch {
    return false;
  }
}
