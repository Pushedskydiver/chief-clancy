/**
 * Linear issue label operations.
 *
 * Linear labels are ID-based — adding/removing requires reading the
 * current label IDs, modifying the list, and writing back via GraphQL.
 * Label name→UUID resolution uses a {@link CachedMap} for efficiency.
 *
 * The 3-step {@link ensureLabel} flow: team labels → workspace labels → create.
 */
import type { CachedMap } from '~/shared/cache/index.js';

import {
  linearIssueLabelSearchResponseSchema,
  linearLabelCreateResponseSchema,
  linearTeamLabelsResponseSchema,
  linearWorkspaceLabelsResponseSchema,
} from '~/schemas/index.js';
import { safeLabel } from '~/shared/label-helpers/index.js';

import { linearGraphql } from '../api/index.js';

/** Options for {@link ensureLabel}. */
type EnsureLabelOpts = {
  readonly apiKey: string;
  readonly teamId: string;
  readonly labelCache: CachedMap<string, string>;
  readonly label: string;
};

/** Search team labels for a match by name and return its ID. */
async function findTeamLabel(
  apiKey: string,
  teamId: string,
  label: string,
): Promise<string | undefined> {
  const query = `
    query($teamId: String!, $name: String!) {
      team(id: $teamId) {
        labels(filter: { name: { eq: $name } }) { nodes { id name } }
      }
    }
  `;

  const raw = await linearGraphql(apiKey, query, { teamId, name: label });
  const parsed = linearTeamLabelsResponseSchema.safeParse(raw);
  return parsed.success
    ? parsed.data.data?.team?.labels?.nodes?.[0]?.id
    : undefined;
}

/** Search workspace labels for a match and return its ID. */
async function findWorkspaceLabel(
  apiKey: string,
  label: string,
): Promise<string | undefined> {
  const query = `
    query($name: String!) {
      issueLabels(filter: { name: { eq: $name } }) {
        nodes { id name }
      }
    }
  `;

  const raw = await linearGraphql(apiKey, query, { name: label });
  const parsed = linearWorkspaceLabelsResponseSchema.safeParse(raw);
  return parsed.success
    ? parsed.data.data?.issueLabels?.nodes?.[0]?.id
    : undefined;
}

/** Create a new team-scoped label and return its ID. */
async function createTeamLabel(
  apiKey: string,
  teamId: string,
  label: string,
): Promise<string | undefined> {
  const mutation = `
    mutation($teamId: String!, $name: String!) {
      issueLabelCreate(input: { teamId: $teamId, name: $name, color: "#0075ca" }) {
        issueLabel { id }
        success
      }
    }
  `;

  const raw = await linearGraphql(apiKey, mutation, { teamId, name: label });
  const parsed = linearLabelCreateResponseSchema.safeParse(raw);
  return parsed.success
    ? parsed.data.data?.issueLabelCreate?.issueLabel?.id
    : undefined;
}

/**
 * Ensure a label exists and cache its ID.
 *
 * 1. Check the label cache.
 * 2. Search team labels.
 * 3. Search workspace labels.
 * 4. Create a new team-scoped label.
 *
 * @param opts - API key, team ID, cache, and label name.
 */
export async function ensureLabel(opts: EnsureLabelOpts): Promise<void> {
  const { apiKey, teamId, labelCache, label } = opts;

  await safeLabel(async () => {
    if (labelCache.has(label)) return;

    const teamId_ = await findTeamLabel(apiKey, teamId, label);
    if (teamId_) {
      labelCache.store(label, teamId_);
      return;
    }

    const wsId = await findWorkspaceLabel(apiKey, label);
    if (wsId) {
      labelCache.store(label, wsId);
      return;
    }

    const newId = await createTeamLabel(apiKey, teamId, label);
    if (newId) labelCache.store(label, newId);
  }, 'ensureLabel');
}

/** Options for {@link addLabel}. */
type AddLabelOpts = {
  readonly apiKey: string;
  readonly labelCache: CachedMap<string, string>;
  readonly issueKey: string;
  readonly label: string;
};

/**
 * Add a label to a Linear issue (best-effort).
 *
 * @param opts - API key, label cache, issue key, and label name.
 */
export async function addLabel(opts: AddLabelOpts): Promise<void> {
  const { apiKey, labelCache, issueKey, label } = opts;

  await safeLabel(async () => {
    const labelId = labelCache.get(label);
    if (!labelId) return;

    const issue = await fetchIssueLabelIds(apiKey, issueKey);
    if (!issue) return;

    const currentIds = issue.labelIds;
    if (currentIds.includes(labelId)) return;

    await updateIssueLabels(apiKey, issue.id, [...currentIds, labelId]);
  }, 'addLabel');
}

/** Options for {@link removeLabel}. */
type RemoveLabelOpts = {
  readonly apiKey: string;
  readonly labelCache: CachedMap<string, string>;
  readonly issueKey: string;
  readonly label: string;
};

/**
 * Remove a label from a Linear issue (best-effort).
 *
 * @param opts - API key, label cache, issue key, and label name.
 */
export async function removeLabel(opts: RemoveLabelOpts): Promise<void> {
  const { apiKey, labelCache, issueKey, label } = opts;

  await safeLabel(async () => {
    const issue = await fetchIssueLabelIds(apiKey, issueKey);
    if (!issue) return;

    const cachedId = labelCache.get(label);
    const currentLabels = issue.labels;

    const targetId =
      cachedId ?? currentLabels.find((l) => l.name === label)?.id;
    if (!targetId) return;

    const updatedIds = currentLabels
      .map((l) => l.id)
      .filter((id) => id !== targetId);

    if (updatedIds.length === currentLabels.length) return;

    await updateIssueLabels(apiKey, issue.id, updatedIds);
  }, 'removeLabel');
}

// ── Internal helpers ──────────────────────────────────────────────

/** Resolved issue with label info for label operations. */
type ResolvedIssue = {
  readonly id: string;
  readonly labelIds: readonly string[];
  readonly labels: ReadonlyArray<{
    readonly id: string;
    readonly name?: string;
  }>;
};

/** Fetch an issue's UUID and current label IDs by identifier. */
async function fetchIssueLabelIds(
  apiKey: string,
  issueKey: string,
): Promise<ResolvedIssue | undefined> {
  const query = `
    query($identifier: String!) {
      issueSearch: issues(filter: { identifier: { eq: $identifier } }, first: 1) {
        nodes {
          id
          labels { nodes { id name } }
        }
      }
    }
  `;

  const raw = await linearGraphql(apiKey, query, { identifier: issueKey });
  const parsed = linearIssueLabelSearchResponseSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  const node = parsed.data.data?.issueSearch?.nodes?.[0];
  if (!node) return undefined;

  const labels = node.labels?.nodes ?? [];

  return {
    id: node.id,
    labelIds: labels.map((l) => l.id),
    labels,
  };
}

/** Update an issue's labels via GraphQL mutation. */
async function updateIssueLabels(
  apiKey: string,
  issueId: string,
  labelIds: readonly string[],
): Promise<void> {
  const mutation = `
    mutation($issueId: String!, $labelIds: [String!]!) {
      issueUpdate(id: $issueId, input: { labelIds: $labelIds }) {
        success
      }
    }
  `;

  await linearGraphql(apiKey, mutation, { issueId, labelIds });
}
