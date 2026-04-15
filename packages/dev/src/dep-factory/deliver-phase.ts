/**
 * Deliver phase wiring — push, PR creation, rework actions.
 *
 * Extracted from the dep factory to stay within file-length limits.
 */
import type { FetchFn } from '../lifecycle/pr-creation.js';
import type { ProgressFs } from '../lifecycle/progress.js';
import type { QualityFs } from '../lifecycle/quality/quality.js';
import type { RunContext } from '../pipeline/context.js';
import type { PipelineDeps } from '../pipeline/run-pipeline.js';
import type { AppendFn } from '../types/progress.js';
import type { ExecGit } from '@chief-clancy/core';

import { detectRemote } from '@chief-clancy/core';

import { deliverViaPullRequest } from '../lifecycle/deliver-ticket/deliver-ticket.js';
import { recordDelivery, recordRework } from '../lifecycle/quality/quality.js';
import { resolvePlatformHandlers } from '../lifecycle/rework/rework-handlers.js';
import { postReworkActions } from '../lifecycle/rework/rework.js';
import { deliverPhase } from '../pipeline/phases/deliver-phase.js';
import { resolveBuildLabel } from './build-label.js';

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
          await ctx.board!.removeLabel(ticketKey, resolveBuildLabel(ctx));
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
