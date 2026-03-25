/**
 * Notion page label (multi_select) operations.
 *
 * Uses read-modify-write via {@link modifyLabelList}. Labels are stored
 * as multi_select options which auto-create on first PATCH.
 */
import type { NotionCtx } from '../api/index.js';

import { modifyLabelList, safeLabel } from '~/c/shared/label-helpers/index.js';

import { findPageByKey, getArrayProperty, updatePage } from '../api/index.js';

/** Options for label operations. */
type LabelOpts = {
  readonly ctx: NotionCtx;
  readonly issueKey: string;
  readonly label: string;
  readonly labelsProp: string;
};

/** Write updated labels to a page via PATCH. */
async function writeLabels(
  opts: {
    readonly token: string;
    readonly pageId: string;
    readonly labelsProp: string;
  },
  labels: readonly string[],
): Promise<void> {
  await updatePage(opts.token, opts.pageId, {
    [opts.labelsProp]: {
      multi_select: labels.map((name) => ({ name })),
    },
  });
}

/**
 * Add a label to a Notion page (best-effort).
 *
 * @param opts - Connection context, issue key, label, and property name.
 * @returns Resolves when complete (best-effort — never throws).
 */
export async function addLabel(opts: LabelOpts): Promise<void> {
  const { ctx, issueKey, label, labelsProp } = opts;

  await safeLabel(async () => {
    const page = await findPageByKey(ctx, issueKey);
    if (!page) return;

    await modifyLabelList({
      fetchCurrent: () =>
        Promise.resolve(
          getArrayProperty(page, labelsProp, 'multi_select') ?? [],
        ),
      writeUpdated: (labels) =>
        writeLabels({ token: ctx.token, pageId: page.id, labelsProp }, labels),
      target: label,
      mode: 'add',
    });
  }, 'addLabel');
}

/**
 * Remove a label from a Notion page (best-effort).
 *
 * @param opts - Connection context, issue key, label, and property name.
 * @returns Resolves when complete (best-effort — never throws).
 */
export async function removeLabel(opts: LabelOpts): Promise<void> {
  const { ctx, issueKey, label, labelsProp } = opts;

  await safeLabel(async () => {
    const page = await findPageByKey(ctx, issueKey);
    if (!page) return;

    await modifyLabelList({
      fetchCurrent: () =>
        Promise.resolve(
          getArrayProperty(page, labelsProp, 'multi_select') ?? [],
        ),
      writeUpdated: (labels) =>
        writeLabels({ token: ctx.token, pageId: page.id, labelsProp }, labels),
      target: label,
      mode: 'remove',
    });
  }, 'removeLabel');
}
