/**
 * Shortcut story relationship functions.
 *
 * Checks blocker status (via story_links + blocked flag), children
 * status (via Epic: text convention + native epic stories API).
 */
import type { ShortcutWorkflowsResponse } from '~/schemas/index.js';
import type { Cached } from '~/shared/cache/index.js';
import type { ChildrenStatus } from '~/types/index.js';

import {
  shortcutEpicStoriesResponseSchema,
  shortcutStoryDetailResponseSchema,
  shortcutStorySearchResponseSchema,
} from '~/schemas/index.js';
import { fetchAndParse } from '~/shared/http/index.js';

import {
  resolveDoneStateIds,
  SHORTCUT_API,
  shortcutHeaders,
} from '../api/index.js';

/** Check if a single blocking story is unresolved (not in a done state). */
async function isBlockerUnresolved(
  token: string,
  blockerId: number,
  doneStateIds: ReadonlySet<number>,
): Promise<boolean> {
  const blocker = await fetchAndParse(
    `${SHORTCUT_API}/stories/${String(blockerId)}`,
    { headers: shortcutHeaders(token) },
    { schema: shortcutStoryDetailResponseSchema, label: 'Shortcut blocker' },
  );

  if (!blocker) return false;

  return (
    blocker.workflow_state_id !== undefined &&
    !doneStateIds.has(blocker.workflow_state_id)
  );
}

/**
 * Check whether a Shortcut story is blocked by unresolved blockers.
 *
 * Checks the `blocked` flag first, then examines `story_links` with
 * verb `"is blocked by"`. For each blocker, fetches the story to
 * check if it's in a "done" state.
 *
 * @param token - The Shortcut API token.
 * @param storyId - The story numeric ID.
 * @param workflowCache - The workflow cache instance.
 * @returns `true` if any blocker is unresolved, `false` otherwise.
 */
export async function fetchBlockerStatus(
  token: string,
  storyId: number,
  workflowCache: Cached<ShortcutWorkflowsResponse>,
): Promise<boolean> {
  try {
    const story = await fetchAndParse(
      `${SHORTCUT_API}/stories/${String(storyId)}`,
      { headers: shortcutHeaders(token) },
      { schema: shortcutStoryDetailResponseSchema, label: 'Shortcut story' },
    );

    if (!story?.blocked) return false;

    const blockerLinks = (story.story_links ?? []).filter(
      (link) => link.verb === 'is blocked by',
    );

    if (!blockerLinks.length) return false;

    const doneStateIds = await resolveDoneStateIds(token, workflowCache);

    const results = await Promise.all(
      blockerLinks.map((link) =>
        isBlockerUnresolved(token, link.object_id, doneStateIds),
      ),
    );

    return results.some(Boolean);
  } catch {
    return false;
  }
}

/** Options for {@link fetchChildrenStatus}. */
type FetchChildrenOpts = {
  readonly token: string;
  readonly epicId: number;
  readonly workflowCache: Cached<ShortcutWorkflowsResponse>;
  readonly parentKey?: string;
};

/**
 * Fetch children status of a Shortcut epic (dual-mode).
 *
 * Tries `Epic: {parentKey}` text convention first. Falls back
 * to the native `/epics/{id}/stories` endpoint.
 *
 * @param opts - Token, epic ID, workflow cache, and optional parent key.
 * @returns The children status, or `undefined` on failure.
 */
export async function fetchChildrenStatus(
  opts: FetchChildrenOpts,
): Promise<ChildrenStatus | undefined> {
  const { token, epicId, workflowCache, parentKey } = opts;

  try {
    if (parentKey) {
      const epicResult = await fetchChildrenByDescription(
        token,
        `Epic: ${parentKey}`,
        workflowCache,
      );

      if (epicResult && epicResult.total > 0) return epicResult;
    }

    return await fetchChildrenByEpicApi(token, epicId, workflowCache);
  } catch {
    return undefined;
  }
}

/** Count children status from stories and done state IDs. */
function countChildrenStatus(
  stories: ReadonlyArray<{ readonly workflow_state_id?: number }>,
  doneStateIds: ReadonlySet<number>,
): ChildrenStatus {
  const total = stories.length;
  const incomplete = stories.filter(
    (s) =>
      s.workflow_state_id === undefined ||
      !doneStateIds.has(s.workflow_state_id),
  ).length;
  return { total, incomplete };
}

/** Fetch children by searching story descriptions for a text reference. */
async function fetchChildrenByDescription(
  token: string,
  descriptionRef: string,
  workflowCache: Cached<ShortcutWorkflowsResponse>,
): Promise<ChildrenStatus | undefined> {
  const data = await fetchAndParse(
    `${SHORTCUT_API}/stories/search`,
    {
      method: 'POST',
      headers: shortcutHeaders(token),
      body: JSON.stringify({ query: descriptionRef }),
    },
    {
      schema: shortcutStorySearchResponseSchema,
      label: 'Shortcut story search',
    },
  );

  if (!data) return undefined;

  const stories = data.data;
  if (!stories.length) return { total: 0, incomplete: 0 };

  const doneStateIds = await resolveDoneStateIds(token, workflowCache);
  return countChildrenStatus(stories, doneStateIds);
}

/** Fetch children from the native epic stories endpoint. */
async function fetchChildrenByEpicApi(
  token: string,
  epicId: number,
  workflowCache: Cached<ShortcutWorkflowsResponse>,
): Promise<ChildrenStatus | undefined> {
  const stories = await fetchAndParse(
    `${SHORTCUT_API}/epics/${String(epicId)}/stories`,
    { headers: shortcutHeaders(token) },
    {
      schema: shortcutEpicStoriesResponseSchema,
      label: 'Shortcut epic stories',
    },
  );

  if (!stories) return undefined;
  if (!stories.length) return { total: 0, incomplete: 0 };

  const doneStateIds = await resolveDoneStateIds(token, workflowCache);
  return countChildrenStatus(stories, doneStateIds);
}
