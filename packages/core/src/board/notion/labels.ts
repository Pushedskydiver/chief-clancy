/**
 * Notion page label (multi_select) operations.
 *
 * Uses read-modify-write via {@link modifyLabelList}. Labels are stored
 * as multi_select options which auto-create on first PATCH.
 */
import type { NotionCtx } from './api/helpers.js';

import { modifyLabelList, safeLabel } from '~/c/shared/label-helpers.js';

import { findPageByKey, updatePage } from './api/api.js';
import { getArrayProperty } from './api/helpers.js';

/** Options for label operations. */
type LabelOpts = {
  readonly ctx: NotionCtx;
  readonly issueKey: string;
  readonly label: string;
  readonly labelsProp: string;
};

/** Write updated labels to a page via PATCH. */
async function writeLabels(
  opts: Pick<LabelOpts, 'ctx'> & {
    readonly pageId: string;
    readonly labelsProp: string;
  },
  labels: readonly string[],
): Promise<void> {
  await updatePage({
    token: opts.ctx.token,
    pageId: opts.pageId,
    properties: {
      [opts.labelsProp]: {
        multi_select: labels.map((name) => ({ name })),
      },
    },
    fetcher: opts.ctx.fetcher,
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
        writeLabels({ ctx, pageId: page.id, labelsProp }, labels),
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
        writeLabels({ ctx, pageId: page.id, labelsProp }, labels),
      target: label,
      mode: 'remove',
    });
  }, 'removeLabel');
}
