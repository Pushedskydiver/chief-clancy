import type { SpawnSyncFn } from '../shared/types.js';
import type { SpawnSyncReturns } from 'node:child_process';

/** Options for both print and session invocations. */
type ClaudeInvokeOptions = {
  readonly prompt: string;
  readonly model?: string;
  readonly spawn: SpawnSyncFn;
};

type ClaudePrintResult = {
  readonly stdout: string;
  readonly ok: boolean;
};

function buildArgs(base: readonly string[], model?: string): readonly string[] {
  return model ? [...base, '--model', model] : base;
}

function isSuccess(result: SpawnSyncReturns<string>): boolean {
  return result.status === 0 && !result.error;
}

/**
 * Invoke Claude in print mode and capture the response.
 *
 * Uses `claude -p` for a single-prompt, non-interactive invocation.
 * Stdout is captured (not streamed) so the caller can parse it.
 *
 * @param options - The print invocation options.
 * @returns The captured stdout and whether the process succeeded.
 */
export function invokeClaudePrint(
  options: ClaudeInvokeOptions,
): ClaudePrintResult {
  const { prompt, model, spawn } = options;
  // Clancy runs autonomously — skip the interactive permission prompt
  const base = ['-p', '--dangerously-skip-permissions'] as const;
  const args = buildArgs(base, model);

  const result = spawn('claude', args, {
    input: prompt,
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
  });

  return {
    stdout: result.stdout ?? '',
    ok: isSuccess(result),
  };
}

/**
 * Invoke a Claude Code session with the given prompt.
 *
 * Pipes the prompt to stdin and streams stdout/stderr live to the
 * terminal. Uses `--dangerously-skip-permissions` for autonomous
 * operation.
 *
 * @param options - The session invocation options.
 * @returns `true` if Claude exited successfully (code 0), `false` otherwise.
 */
export function invokeClaudeSession(options: ClaudeInvokeOptions): boolean {
  const { prompt, model, spawn } = options;
  // Clancy runs autonomously — skip the interactive permission prompt
  const base = ['--dangerously-skip-permissions'] as const;
  const args = buildArgs(base, model);

  const result = spawn('claude', args, {
    input: prompt,
    stdio: ['pipe', 'inherit', 'inherit'],
    encoding: 'utf8',
  });

  return isSuccess(result);
}
