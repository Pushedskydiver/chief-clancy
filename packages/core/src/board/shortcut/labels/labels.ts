/**
 * Shortcut label operations.
 *
 * Labels are numeric-ID-based. Adding/removing uses read-modify-write
 * via {@link modifyLabelList}. Label list is cached per process via
 * {@link Cached}. Cache is invalidated when a new label is created.
 */
import type { ShortcutLabelsResponse } from '~/c/schemas/index.js';
import type { Cached } from '~/c/shared/cache/index.js';
import type { Fetcher } from '~/c/shared/http/index.js';

import {
  shortcutLabelCreateResponseSchema,
  shortcutLabelsResponseSchema,
  shortcutStoryDetailResponseSchema,
} from '~/c/schemas/index.js';
import { fetchAndParse } from '~/c/shared/http/index.js';
import { modifyLabelList, safeLabel } from '~/c/shared/label-helpers/index.js';

import { SHORTCUT_API, shortcutHeaders } from '../api/index.js';

/** Options for {@link fetchLabels}. */
type FetchLabelsOpts = {
  readonly token: string;
  readonly cache: Cached<ShortcutLabelsResponse>;
  readonly refresh?: boolean;
  readonly fetcher?: Fetcher;
};

/**
 * Fetch all labels from Shortcut (cached per process).
 *
 * @param opts - Token, cache, optional refresh flag, and optional fetcher.
 * @returns The labels array, or an empty array on failure.
 */
export async function fetchLabels(
  opts: FetchLabelsOpts,
): Promise<ShortcutLabelsResponse> {
  const { token, cache, refresh, fetcher } = opts;
  const cached = cache.get();
  if (cached && !refresh) return cached;

  const data = await fetchAndParse(
    `${SHORTCUT_API}/labels`,
    { headers: shortcutHeaders(token) },
    { schema: shortcutLabelsResponseSchema, label: 'Shortcut labels', fetcher },
  );

  if (data) cache.store(data);
  return data ?? [];
}

/**
 * Create a new label in Shortcut.
 *
 * @param token - The Shortcut API token.
 * @param name - The label name to create.
 * @param fetcher - Optional custom fetch function.
 * @returns The created label's numeric ID, or `undefined` on failure.
 */
export async function createLabel(
  token: string,
  name: string,
  fetcher?: Fetcher,
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
      fetcher,
    },
  );

  // Cache is refreshed by the caller (ensureLabel passes refresh: true)

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
  fetcher?: Fetcher,
): Promise<readonly number[] | undefined> {
  const data = await fetchAndParse(
    `${SHORTCUT_API}/stories/${String(storyId)}`,
    { headers: shortcutHeaders(token) },
    {
      schema: shortcutStoryDetailResponseSchema,
      label: 'Shortcut story',
      fetcher,
    },
  );

  return data ? (data.label_ids ?? []) : undefined;
}

/**
 * Update a story's label IDs.
 *
 * @param token - The Shortcut API token.
 * @param storyId - The story numeric ID.
 * @param labelIds - The new label IDs array.
 * @returns Resolves when complete (best-effort — never throws).
 */
/** Options for {@link updateStoryLabelIds}. */
type UpdateStoryLabelsOpts = {
  readonly token: string;
  readonly storyId: number;
  readonly labelIds: readonly number[];
  readonly fetcher?: Fetcher;
};

export async function updateStoryLabelIds(
  opts: UpdateStoryLabelsOpts,
): Promise<void> {
  const { token, storyId, labelIds, fetcher } = opts;
  const doFetch = fetcher ?? fetch;
  try {
    const response = await doFetch(
      `${SHORTCUT_API}/stories/${String(storyId)}`,
      {
        method: 'PUT',
        headers: shortcutHeaders(token),
        body: JSON.stringify({ label_ids: labelIds }),
      },
    );

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
  readonly fetcher?: Fetcher;
};

/**
 * Ensure a label exists in Shortcut. Creates it if missing.
 *
 * @param opts - Token, cache, and label name.
 * @returns Resolves when complete (best-effort — never throws).
 */
export async function ensureLabel(opts: EnsureLabelOpts): Promise<void> {
  const { token, labelCache, label, fetcher } = opts;

  await safeLabel(async () => {
    const labels = await fetchLabels({ token, cache: labelCache, fetcher });
    const existing = labels.find((l) => l.name === label);
    if (existing) return;
    await createLabel(token, label, fetcher);
    await fetchLabels({ token, cache: labelCache, refresh: true, fetcher });
  }, 'ensureLabel');
}

/** Resolve a label name to its numeric ID. */
async function resolveLabelId(
  opts: Pick<ModifyLabelOpts, 'token' | 'labelCache' | 'label' | 'fetcher'>,
): Promise<number | undefined> {
  const { token, labelCache, label, fetcher } = opts;
  const labels = await fetchLabels({ token, cache: labelCache, fetcher });
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
  readonly fetcher?: Fetcher;
};

/**
 * Add a label to a Shortcut story (best-effort).
 *
 * @param opts - Token, cache, issue key, and label name.
 * @returns Resolves when complete (best-effort — never throws).
 */
export async function addLabel(opts: ModifyLabelOpts): Promise<void> {
  const { token, labelCache, issueKey, label, fetcher } = opts;

  await safeLabel(async () => {
    const storyId = parseStoryId(issueKey);
    if (storyId === undefined) return;

    const labelId = await resolveLabelId({ token, labelCache, label, fetcher });
    if (labelId === undefined) return;

    await modifyLabelList({
      fetchCurrent: () => getStoryLabelIds(token, storyId, fetcher),
      writeUpdated: (ids) =>
        updateStoryLabelIds({ token, storyId, labelIds: ids, fetcher }),
      target: labelId,
      mode: 'add',
    });
  }, 'addLabel');
}

/**
 * Remove a label from a Shortcut story (best-effort).
 *
 * @param opts - Token, cache, issue key, and label name.
 * @returns Resolves when complete (best-effort — never throws).
 */
export async function removeLabel(opts: ModifyLabelOpts): Promise<void> {
  const { token, labelCache, issueKey, label, fetcher } = opts;

  await safeLabel(async () => {
    const storyId = parseStoryId(issueKey);
    if (storyId === undefined) return;

    const labelId = await resolveLabelId({ token, labelCache, label, fetcher });
    if (labelId === undefined) return;

    await modifyLabelList({
      fetchCurrent: () => getStoryLabelIds(token, storyId, fetcher),
      writeUpdated: (ids) =>
        updateStoryLabelIds({ token, storyId, labelIds: ids, fetcher }),
      target: labelId,
      mode: 'remove',
    });
  }, 'removeLabel');
}
