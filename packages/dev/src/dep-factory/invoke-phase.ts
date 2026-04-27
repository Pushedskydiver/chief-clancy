/**
 * Invoke phase wiring — build prompt and run Claude session.
 *
 * Extracted from the dep factory to stay within file-length limits.
 * Prompt builders are injected so this module has no terminal dependency.
 */
import type { RunContext } from '../pipeline/context.js';
import type { StreamingSpawnFn } from '../types/spawn.js';
import type { BoardProvider } from '@chief-clancy/core';

import { invokeClaudeSession } from '../cli-bridge.js';

/** Prompt builder for fresh tickets. */
type BuildPromptFn = (opts: {
  readonly provider: BoardProvider;
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly parentInfo: string;
  readonly blockers?: string;
  readonly tdd?: boolean;
}) => string;

/** Prompt builder for rework iterations. */
type BuildReworkPromptFn = (opts: {
  readonly provider: BoardProvider;
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly feedbackComments: readonly string[];
  readonly previousContext?: string;
  readonly tdd?: boolean;
}) => string;

/** Dependencies for creating an invoke phase closure. */
export type InvokePhaseDeps = {
  readonly streamingSpawn: StreamingSpawnFn;
  readonly buildPrompt: BuildPromptFn;
  readonly buildReworkPrompt: BuildReworkPromptFn;
};

/** Result returned from the invoke phase to the pipeline orchestrator. */
type InvokePhaseResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly error: { readonly kind: 'unknown'; readonly message: string };
    };

const EMPTY_STDERR_FALLBACK_MESSAGE =
  'Claude session exited non-zero (no stderr captured)';

/**
 * Create the invoke phase closure.
 *
 * Builds the appropriate prompt (fresh or rework) from context,
 * then delegates to `invokeClaudeSession`. Surfaces the captured stderr
 * tail as `error.message` on failure so the terminal display can show
 * the operator why the Claude session aborted. Falls back to a generic
 * message when stderr is empty.
 *
 * @param deps - Injected process spawner and prompt builders.
 * @returns An invoke phase function matching PipelineDeps.invoke.
 */
export function makeInvokePhase(
  deps: InvokePhaseDeps,
): (ctx: RunContext) => Promise<InvokePhaseResult> {
  return async (ctx) => {
    // Safe: invoke runs after preflight (config) and ticketFetch (ticket)
    const config = ctx.config!;
    const ticket = ctx.ticket!;
    const tdd = config.env.CLANCY_TDD === 'true';

    const prompt = ctx.isRework
      ? deps.buildReworkPrompt({
          provider: config.provider,
          key: ticket.key,
          title: ticket.title,
          description: ticket.description,
          feedbackComments: ctx.prFeedback ?? [],
          tdd,
        })
      : deps.buildPrompt({
          provider: config.provider,
          key: ticket.key,
          title: ticket.title,
          description: ticket.description,
          parentInfo: ticket.parentInfo,
          blockers: ticket.blockers,
          tdd,
        });

    const result = await invokeClaudeSession({
      prompt,
      model: config.env.CLANCY_MODEL,
      spawn: deps.streamingSpawn,
    });

    if (result.ok) return { ok: true };

    return {
      ok: false,
      error: {
        kind: 'unknown',
        message: result.stderr || EMPTY_STDERR_FALLBACK_MESSAGE,
      },
    };
  };
}
