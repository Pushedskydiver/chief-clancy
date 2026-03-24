/**
 * Shortcut label operations.
 *
 * Labels are numeric-ID-based. Adding/removing uses read-modify-write
 * via {@link modifyLabelList}. Label list is cached per process via
 * {@link Cached}. Cache is invalidated when a new label is created.
 */
import type { ShortcutLabelsResponse } from '~/c/schemas/index.js';
import type { Cached } from '~/c/shared/cache/index.js';

import {
  shortcutLabelCreateResponseSchema,
  shortcutLabelsResponseSchema,
  shortcutStoryDetailResponseSchema,
} from '~/c/schemas/index.js';
import { fetchAndParse } from '~/c/shared/http/index.js';
import { modifyLabelList, safeLabel } from '~/c/shared/label-helpers/index.js';

import { SHORTCUT_API, shortcutHeaders } from '../api/index.js';

/**
 * Fetch all labels from Shortcut (cached per process).
 *
 * @param token - The Shortcut API token.
 * @param cache - The label cache instance.
 * @returns The labels array, or an empty array on failure.
 */
export async function fetchLabels(
  token: string,
  cache: Cached<ShortcutLabelsResponse>,
): Promise<ShortcutLabelsResponse> {
  const cached = cache.get();
  if (cached?.length) return cached;

  const data = await fetchAndParse(
    `${SHORTCUT_API}/labels`,
    { headers: shortcutHeaders(token) },
    { schema: shortcutLabelsResponseSchema, label: 'Shortcut labels' },
  );

  if (data) cache.store(data);
  return data ?? [];
}

/**
 * Create a new label in Shortcut.
 *
 * Invalidates the label cache on success so the next `fetchLabels`
 * call picks up the new label.
 *
 * @param token - The Shortcut API token.
 * @param name - The label name to create.
 * @param cache - The label cache instance (invalidated on success).
 * @returns The created label's numeric ID, or `undefined` on failure.
 */
export async function createLabel(
  token: string,
  name: string,
  cache: Cached<ShortcutLabelsResponse>,
): Promise<number | undefined> {
  const data = await fetchAndParse(
    `${SHORTCUT_API}/labels`,
    {
      method: 'POST',
      headers: shortcutHeaders(token),
      body: JSON.stringify({ name, color: '#0075ca' }),
    },
    {
      schema: shortcutLabelCreateResponseSchema,
      label: 'Shortcut label create',
    },
  );

  // Invalidate cache so next fetchLabels re-fetches
  if (data) cache.store([]);

  return data?.id;
}

/**
 * Fetch current label IDs for a story.
 *
 * @param token - The Shortcut API token.
 * @param storyId - The story numeric ID.
 * @returns The label IDs array, or `undefined` on failure.
 */
export async function getStoryLabelIds(
  token: string,
  storyId: number,
): Promise<readonly number[] | undefined> {
  const data = await fetchAndParse(
    `${SHORTCUT_API}/stories/${String(storyId)}`,
    { headers: shortcutHeaders(token) },
    { schema: shortcutStoryDetailResponseSchema, label: 'Shortcut story' },
  );

  return data ? (data.label_ids ?? []) : undefined;
}

/**
 * Update a story's label IDs.
 *
 * @param token - The Shortcut API token.
 * @param storyId - The story numeric ID.
 * @param labelIds - The new label IDs array.
 */
export async function updateStoryLabelIds(
  token: string,
  storyId: number,
  labelIds: readonly number[],
): Promise<void> {
  try {
    const response = await fetch(`${SHORTCUT_API}/stories/${String(storyId)}`, {
      method: 'PUT',
      headers: shortcutHeaders(token),
      body: JSON.stringify({ label_ids: labelIds }),
    });

    if (!response.ok) {
      console.warn(
        `⚠ Shortcut story label update returned HTTP ${response.status}`,
      );
    }
  } catch (err) {
    console.warn(
      `⚠ Shortcut story label update failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Options for {@link ensureLabel}. */
type EnsureLabelOpts = {
  readonly token: string;
  readonly labelCache: Cached<ShortcutLabelsResponse>;
  readonly label: string;
};

/**
 * Ensure a label exists in Shortcut. Creates it if missing.
 *
 * @param opts - Token, cache, and label name.
 */
export async function ensureLabel(opts: EnsureLabelOpts): Promise<void> {
  const { token, labelCache, label } = opts;

  await safeLabel(async () => {
    const labels = await fetchLabels(token, labelCache);
    const existing = labels.find((l) => l.name === label);
    if (existing) return;
    await createLabel(token, label, labelCache);
  }, 'ensureLabel');
}

/** Resolve a label name to its numeric ID. */
async function resolveLabelId(
  token: string,
  labelCache: Cached<ShortcutLabelsResponse>,
  label: string,
): Promise<number | undefined> {
  const labels = await fetchLabels(token, labelCache);
  return labels.find((l) => l.name === label)?.id;
}

/** Parse a story ID from a Shortcut key (e.g., `'sc-123'` → `123`). */
export function parseStoryId(key: string): number | undefined {
  const num = parseInt(key.replace('sc-', ''), 10);
  return Number.isNaN(num) ? undefined : num;
}

/** Options for {@link addLabel} and {@link removeLabel}. */
type ModifyLabelOpts = {
  readonly token: string;
  readonly labelCache: Cached<ShortcutLabelsResponse>;
  readonly issueKey: string;
  readonly label: string;
};

/**
 * Add a label to a Shortcut story (best-effort).
 *
 * @param opts - Token, cache, issue key, and label name.
 */
export async function addLabel(opts: ModifyLabelOpts): Promise<void> {
  const { token, labelCache, issueKey, label } = opts;

  await safeLabel(async () => {
    const storyId = parseStoryId(issueKey);
    if (storyId === undefined) return;

    const labelId = await resolveLabelId(token, labelCache, label);
    if (labelId === undefined) return;

    await modifyLabelList({
      fetchCurrent: () => getStoryLabelIds(token, storyId),
      writeUpdated: (ids) => updateStoryLabelIds(token, storyId, ids),
      target: labelId,
      mode: 'add',
    });
  }, 'addLabel');
}

/**
 * Remove a label from a Shortcut story (best-effort).
 *
 * @param opts - Token, cache, issue key, and label name.
 */
export async function removeLabel(opts: ModifyLabelOpts): Promise<void> {
  const { token, labelCache, issueKey, label } = opts;

  await safeLabel(async () => {
    const storyId = parseStoryId(issueKey);
    if (storyId === undefined) return;

    const labelId = await resolveLabelId(token, labelCache, label);
    if (labelId === undefined) return;

    await modifyLabelList({
      fetchCurrent: () => getStoryLabelIds(token, storyId),
      writeUpdated: (ids) => updateStoryLabelIds(token, storyId, ids),
      target: labelId,
      mode: 'remove',
    });
  }, 'removeLabel');
}
