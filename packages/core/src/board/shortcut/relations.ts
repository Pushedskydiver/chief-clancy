/**
 * Shortcut story relationship functions.
 *
 * Checks blocker status (via story_links + blocked flag), children
 * status (via Epic: text convention + native epic stories API).
 */
import type { ShortcutWorkflowsResponse } from '~/c/schemas/shortcut.js';
import type { Cached } from '~/c/shared/cache.js';
import type { Fetcher } from '~/c/shared/http/fetch-and-parse.js';
import type { ChildrenStatus } from '~/c/types/board.js';

import {
  shortcutEpicStoriesResponseSchema,
  shortcutStoryDetailResponseSchema,
  shortcutStorySearchResponseSchema,
} from '~/c/schemas/shortcut.js';
import { fetchAndParse } from '~/c/shared/http/fetch-and-parse.js';

import { resolveDoneStateIds, SHORTCUT_API, shortcutHeaders } from './api.js';

/** Options for {@link isBlockerUnresolved}. */
type BlockerCheckOpts = {
  readonly token: string;
  readonly blockerId: number;
  readonly doneStateIds: ReadonlySet<number>;
  readonly fetcher?: Fetcher;
};

/** Check if a single blocking story is unresolved (not in a done state). */
async function isBlockerUnresolved(opts: BlockerCheckOpts): Promise<boolean> {
  const { token, blockerId, doneStateIds, fetcher } = opts;
  const blocker = await fetchAndParse(
    `${SHORTCUT_API}/stories/${String(blockerId)}`,
    { headers: shortcutHeaders(token) },
    {
      schema: shortcutStoryDetailResponseSchema,
      label: 'Shortcut blocker',
      fetcher,
    },
  );

  if (!blocker) return false;

  return (
    blocker.workflow_state_id !== undefined &&
    !doneStateIds.has(blocker.workflow_state_id)
  );
}

/** Options for {@link fetchBlockerStatus}. */
type FetchBlockerOpts = {
  readonly token: string;
  readonly storyId: number;
  readonly workflowCache: Cached<ShortcutWorkflowsResponse>;
  readonly fetcher?: Fetcher;
};

/**
 * Check whether a Shortcut story is blocked by unresolved blockers.
 *
 * @param opts - Token, story ID, workflow cache, and optional fetcher.
 * @returns `true` if any blocker is unresolved, `false` otherwise.
 */
export async function fetchBlockerStatus(
  opts: FetchBlockerOpts,
): Promise<boolean> {
  const { token, storyId, workflowCache, fetcher } = opts;
  try {
    const story = await fetchAndParse(
      `${SHORTCUT_API}/stories/${String(storyId)}`,
      { headers: shortcutHeaders(token) },
      {
        schema: shortcutStoryDetailResponseSchema,
        label: 'Shortcut story',
        fetcher,
      },
    );

    if (!story?.blocked) return false;

    const blockerLinks = (story.story_links ?? []).filter(
      (link) => link.verb === 'is blocked by',
    );

    if (!blockerLinks.length) return false;

    const doneStateIds = await resolveDoneStateIds(token, workflowCache);

    const results = await Promise.all(
      blockerLinks.map((link) =>
        isBlockerUnresolved({
          token,
          blockerId: link.object_id,
          doneStateIds,
          fetcher,
        }),
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
  readonly fetcher?: Fetcher;
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
  const { token, epicId, workflowCache, parentKey, fetcher } = opts;

  try {
    const shared = { token, workflowCache, fetcher };

    if (parentKey) {
      const epicResult = await fetchChildrenByDescription({
        ...shared,
        descriptionRef: `Epic: ${parentKey}`,
      });

      if (epicResult && epicResult.total > 0) return epicResult;
    }

    return await fetchChildrenByEpicApi({ ...shared, epicId });
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

/** Options for internal children fetch functions. */
type InternalChildrenOpts = {
  readonly token: string;
  readonly workflowCache: Cached<ShortcutWorkflowsResponse>;
  readonly fetcher?: Fetcher;
};

/** Fetch children by searching story descriptions for a text reference. */
async function fetchChildrenByDescription(
  opts: InternalChildrenOpts & { readonly descriptionRef: string },
): Promise<ChildrenStatus | undefined> {
  const { token, workflowCache, fetcher, descriptionRef } = opts;
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
      fetcher,
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
  opts: InternalChildrenOpts & { readonly epicId: number },
): Promise<ChildrenStatus | undefined> {
  const { token, workflowCache, fetcher, epicId } = opts;
  const stories = await fetchAndParse(
    `${SHORTCUT_API}/epics/${String(epicId)}/stories`,
    { headers: shortcutHeaders(token) },
    {
      schema: shortcutEpicStoriesResponseSchema,
      label: 'Shortcut epic stories',
      fetcher,
    },
  );

  if (!stories) return undefined;
  if (!stories.length) return { total: 0, incomplete: 0 };

  const doneStateIds = await resolveDoneStateIds(token, workflowCache);
  return countChildrenStatus(stories, doneStateIds);
}
