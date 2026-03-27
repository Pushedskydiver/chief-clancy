/**
 * Shortcut REST API functions.
 *
 * Low-level functions for interacting with the Shortcut v3 API.
 * Auth uses `Shortcut-Token` header (no "Bearer" prefix).
 */
import type {
  ShortcutStoryNode,
  ShortcutWorkflowsResponse,
} from '~/c/schemas/index.js';
import type { Cached } from '~/c/shared/cache/index.js';
import type { Fetcher } from '~/c/shared/http/index.js';
import type { PingResult } from '~/c/types/index.js';

import {
  shortcutMemberInfoResponseSchema,
  shortcutStorySearchResponseSchema,
  shortcutWorkflowsResponseSchema,
} from '~/c/schemas/index.js';
import { fetchAndParse } from '~/c/shared/http/index.js';

/** Shortcut REST API v3 endpoint. */
export const SHORTCUT_API = 'https://api.app.shortcut.com/api/v3';

/**
 * Build standard Shortcut API request headers.
 *
 * @param token - The Shortcut API token.
 * @returns Headers object for Shortcut API requests.
 */
export function shortcutHeaders(token: string): Record<string, string> {
  return {
    'Shortcut-Token': token,
    'Content-Type': 'application/json',
  };
}

/**
 * Ping the Shortcut API to verify connectivity and credentials.
 *
 * Tries `/member-info` first, falls back to `/workflows` (some
 * token types return 404 on member-info).
 *
 * @param token - The Shortcut API token.
 * @returns Ping result with `ok` and optional `error`.
 */
export async function pingShortcut(
  token: string,
  fetcher?: Fetcher,
): Promise<PingResult> {
  const headers = shortcutHeaders(token);
  const doFetch = fetcher ?? fetch;

  const response = await doFetch(`${SHORTCUT_API}/member-info`, { headers })
    .then(async (res) =>
      res.ok ? res : doFetch(`${SHORTCUT_API}/workflows`, { headers }),
    )
    .catch(() => undefined);

  if (!response) {
    return { ok: false, error: '✗ Could not reach Shortcut — check network' };
  }

  if (!response.ok) {
    return response.status === 401 || response.status === 403
      ? {
          ok: false,
          error: '✗ Shortcut auth failed — check SHORTCUT_API_TOKEN',
        }
      : { ok: false, error: `✗ Shortcut API returned HTTP ${response.status}` };
  }

  try {
    const json: unknown = await response.json();
    const parsed = shortcutMemberInfoResponseSchema.safeParse(json);
    if (parsed.success && parsed.data.id) return { ok: true };
    if (Array.isArray(json)) return { ok: true };
  } catch {
    // Invalid JSON — treat as auth issue
  }

  return {
    ok: false,
    error: '✗ Shortcut auth failed — check SHORTCUT_API_TOKEN',
  };
}

/**
 * Fetch all workflows from Shortcut (cached per process).
 *
 * @param token - The Shortcut API token.
 * @param cache - The workflow cache instance.
 * @returns The workflows array, or an empty array on failure.
 */
export async function fetchWorkflows(
  token: string,
  cache: Cached<ShortcutWorkflowsResponse>,
  fetcher?: Fetcher,
): Promise<ShortcutWorkflowsResponse> {
  const cached = cache.get();
  if (cached) return cached;

  const data = await fetchAndParse(
    `${SHORTCUT_API}/workflows`,
    { headers: shortcutHeaders(token) },
    {
      schema: shortcutWorkflowsResponseSchema,
      label: 'Shortcut workflows',
      fetcher,
    },
  );

  if (data) cache.store(data);
  return data ?? [];
}

/**
 * Resolve a workflow state name to its numeric ID.
 *
 * @param stateName - The state name (case-insensitive).
 * @param opts - Token, cache, and optional workflow name.
 * @returns The state ID, or `undefined` if not found.
 */
/** Options for {@link resolveWorkflowStateId}. */
type ResolveStateOpts = {
  readonly token: string;
  readonly cache: Cached<ShortcutWorkflowsResponse>;
  readonly workflowName?: string;
  readonly fetcher?: Fetcher;
};

export async function resolveWorkflowStateId(
  stateName: string,
  opts: ResolveStateOpts,
): Promise<number | undefined> {
  const { token, cache, workflowName, fetcher } = opts;
  const workflows = await fetchWorkflows(token, cache, fetcher);
  const lower = stateName.toLowerCase();

  const matching = workflows
    .filter((wf) => !workflowName || wf.name === workflowName)
    .flatMap((wf) => wf.states)
    .find((s) => s.name.toLowerCase() === lower);

  return matching?.id;
}

/**
 * Resolve all workflow state IDs matching a given type.
 *
 * @param stateType - The state type (e.g., `"unstarted"`, `"done"`).
 * @param opts - Token, cache, and optional workflow name.
 * @returns Array of matching state IDs.
 */
export async function resolveWorkflowStateIdsByType(
  stateType: string,
  opts: ResolveStateOpts,
): Promise<readonly number[]> {
  const { token, cache, workflowName, fetcher } = opts;
  const workflows = await fetchWorkflows(token, cache, fetcher);

  return workflows.flatMap((wf) => {
    if (workflowName && wf.name !== workflowName) return [];
    return wf.states.filter((s) => s.type === stateType).map((s) => s.id);
  });
}

/**
 * Build the set of "done" workflow state IDs.
 *
 * @param token - The Shortcut API token.
 * @param cache - The workflow cache instance.
 * @returns A set of numeric state IDs with type `"done"`.
 */
export async function resolveDoneStateIds(
  token: string,
  cache: Cached<ShortcutWorkflowsResponse>,
): Promise<ReadonlySet<number>> {
  const ids = await resolveWorkflowStateIdsByType('done', { token, cache });
  return new Set(ids);
}

// ── Fetch stories ─────────────────────────────────────────────────

/** Shortcut ticket with optional epic and label info. */
type ShortcutTicket = {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly provider: 'shortcut';
  readonly storyId: number;
  readonly epicId?: number;
  readonly labels?: readonly string[];
};

/** Options for {@link fetchStories}. */
type FetchStoriesOpts = {
  readonly token: string;
  readonly workflowStateIds: readonly number[];
  readonly label?: string;
  readonly excludeHitl?: boolean;
  readonly limit?: number;
  readonly fetcher?: Fetcher;
};

/** Parse the dual-shape Shortcut search response. */
function parseSearchResponse(json: unknown): readonly ShortcutStoryNode[] {
  const parsed = shortcutStorySearchResponseSchema.safeParse(json);
  if (parsed.success) return parsed.data.data;

  // Shortcut may return a bare array instead of { data: [...] }
  if (Array.isArray(json)) {
    const wrapped = shortcutStorySearchResponseSchema.safeParse({ data: json });
    if (wrapped.success) return wrapped.data.data;
  }

  return [];
}

/** Map a raw story node to a ShortcutTicket. */
function toShortcutTicket(story: ShortcutStoryNode): ShortcutTicket {
  return {
    key: `sc-${String(story.id)}`,
    title: story.name,
    description: story.description ?? '',
    provider: 'shortcut',
    storyId: story.id,
    epicId: story.epic_id ?? undefined,
    labels: story.labels
      ?.map((l) => l.name)
      .filter((n): n is string => Boolean(n)),
  };
}

/**
 * Fetch candidate stories from Shortcut.
 *
 * @param opts - Token, workflow state IDs, and optional filters.
 * @returns Array of fetched tickets (may be empty).
 */
export async function fetchStories(
  opts: FetchStoriesOpts,
): Promise<readonly ShortcutTicket[]> {
  const {
    token,
    workflowStateIds,
    label,
    excludeHitl,
    limit = 5,
    fetcher,
  } = opts;
  if (!workflowStateIds.length) return [];

  // Shortcut removed workflow_state_ids (plural) — the API now
  // accepts only workflow_state_id (singular). We use the first ID.
  const body = {
    workflow_state_id: workflowStateIds[0],
    ...(label ? { label_name: label } : {}),
  };

  const doFetch = fetcher ?? fetch;
  const response = await doFetch(`${SHORTCUT_API}/stories/search`, {
    method: 'POST',
    headers: shortcutHeaders(token),
    body: JSON.stringify(body),
  }).catch((err: unknown) => {
    console.warn(
      `⚠ Shortcut API request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return undefined;
  });

  if (!response) return [];

  if (!response.ok) {
    console.warn(`⚠ Shortcut API returned HTTP ${response.status}`);
    return [];
  }

  const json: unknown = await response.json().catch(() => {
    console.warn('⚠ Shortcut API returned invalid JSON');
    return undefined;
  });

  if (json === undefined) return [];

  const stories = parseSearchResponse(json);
  const filtered = excludeHitl
    ? stories.filter((s) => !s.labels?.some((l) => l.name === 'clancy:hitl'))
    : stories;

  return filtered.slice(0, limit).map(toShortcutTicket);
}

/** Options for {@link transitionStory}. */
type TransitionStoryOpts = {
  readonly token: string;
  readonly storyId: number;
  readonly workflowStateId: number;
  readonly fetcher?: Fetcher;
};

/**
 * Transition a Shortcut story to a new workflow state.
 *
 * @param opts - Token, story ID, target state ID, and optional fetcher.
 * @returns `true` if the transition succeeded.
 */
export async function transitionStory(
  opts: TransitionStoryOpts,
): Promise<boolean> {
  const { token, storyId, workflowStateId, fetcher } = opts;
  const doFetch = fetcher ?? fetch;
  try {
    const response = await doFetch(
      `${SHORTCUT_API}/stories/${String(storyId)}`,
      {
        method: 'PUT',
        headers: shortcutHeaders(token),
        body: JSON.stringify({ workflow_state_id: workflowStateId }),
      },
    );

    return response.ok;
  } catch {
    return false;
  }
}
