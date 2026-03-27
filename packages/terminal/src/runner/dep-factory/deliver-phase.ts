/**
 * Deliver phase wiring — push, PR creation, rework actions.
 *
 * Extracted from the dep factory to stay within file-length limits.
 */
import type { AppendFn } from '../shared/types.js';
import type {
  ExecGit,
  FetchFn,
  PipelineDeps,
  ProgressFs,
  QualityFs,
  RunContext,
} from '@chief-clancy/core';

import {
  deliverPhase,
  deliverViaPullRequest,
  detectRemote,
  postReworkActions,
  recordDelivery,
  recordRework,
  resolvePlatformHandlers,
} from '@chief-clancy/core';

type DeliverOpts = {
  readonly projectRoot: string;
  readonly exec: ExecGit;
  readonly progressFs: ProgressFs;
  readonly qualityFs: QualityFs;
  readonly fetch: FetchFn;
};

/**
 * Wire the deliver phase with shared I/O resources.
 *
 * @param opts - Shared I/O resources for delivery.
 * @param progress - Pre-wired progress append function.
 * @returns The deliver field for PipelineDeps.
 */
export function wireDeliver(
  opts: DeliverOpts,
  progress: AppendFn,
): Pick<PipelineDeps, 'deliver'> {
  const { projectRoot, exec, fetch: fetchFn, qualityFs } = opts;

  return {
    deliver: (ctx: RunContext) =>
      deliverPhase(ctx, {
        deliverViaPullRequest: (callOpts) =>
          deliverViaPullRequest({
            ...callOpts,
            exec,
            fetchFn,
            progressFs: opts.progressFs,
            deliverFs: { readFile: (p: string) => qualityFs.readFile(p) },
            projectRoot,
            // Safe: deliver runs after preflight (config) and ticketFetch (ticket)
            config: ctx.config!,
            ticket: ctx.ticket!,
          }),
        appendProgress: progress,
        recordDelivery: () => {
          const now = Date.now();
          recordDelivery(qualityFs, projectRoot, {
            // Safe: recordDelivery runs after ticketFetch, which sets ticket
            ticketKey: ctx.ticket!.key,
            duration: now - ctx.startTime,
            now,
          });
        },
        recordRework: () =>
          // Safe: recordRework runs after ticketFetch, which sets ticket
          recordRework(qualityFs, projectRoot, ctx.ticket!.key),
        removeBuildLabel: async (ticketKey) => {
          // Safe: deliver runs after preflight (config + board populated)
          const env = ctx.config!.env;
          const label = env.CLANCY_LABEL_BUILD ?? env.CLANCY_LABEL;

          if (!label) return;

          await ctx.board!.removeLabel(ticketKey, label);
        },
        postReworkActions: async (reworkCallOpts) => {
          const remote = detectRemote(exec);
          const handlers = resolvePlatformHandlers({
            fetchFn,
            // Safe: postReworkActions runs after preflight, which sets config
            env: ctx.config!.env,
            remote,
          });
          if (!handlers) return;
          await postReworkActions({ ...reworkCallOpts, handlers });
        },
      }),
  };
}
