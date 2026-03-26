/**
 * Invoke phase wiring — build prompt and run Claude session.
 *
 * Extracted from the dep factory to stay within file-length limits.
 */
import type { RunContext } from '@chief-clancy/core';
import type { SpawnSyncReturns } from 'node:child_process';

import { invokeClaudeSession } from '../cli-bridge/index.js';
import { buildPrompt, buildReworkPrompt } from '../prompt-builder/index.js';

type SpawnSyncFn = (
  command: string,
  args: readonly string[],
  options: {
    readonly input: string;
    readonly stdio: readonly (string | number)[];
    readonly encoding: 'utf8';
  },
) => SpawnSyncReturns<string>;

/**
 * Create the invoke phase closure.
 *
 * Builds the appropriate prompt (fresh or rework) from context,
 * then delegates to `invokeClaudeSession`.
 *
 * @param spawn - Injected process spawner.
 * @returns An invoke phase function matching PipelineDeps.invoke.
 */
export function makeInvokePhase(
  spawn: SpawnSyncFn,
): (ctx: RunContext) => Promise<{ readonly ok: boolean }> {
  return async (ctx) => {
    const config = ctx.config!;
    const ticket = ctx.ticket!;
    const tdd = config.env.CLANCY_TDD === 'true';

    const prompt = ctx.isRework
      ? buildReworkPrompt({
          provider: config.provider,
          key: ticket.key,
          title: ticket.title,
          description: ticket.description,
          feedbackComments: ctx.prFeedback ?? [],
          tdd,
        })
      : buildPrompt({
          provider: config.provider,
          key: ticket.key,
          title: ticket.title,
          description: ticket.description,
          parentInfo: ticket.parentInfo,
          blockers: ticket.blockers,
          tdd,
        });

    return {
      ok: invokeClaudeSession({
        prompt,
        model: config.env.CLANCY_MODEL,
        spawn,
      }),
    };
  };
}
