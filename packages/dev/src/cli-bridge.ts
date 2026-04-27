import type {
  SpawnSyncFn,
  StreamingSpawnFn,
  StreamingSpawnResult,
} from './types/spawn.js';
import type { SpawnSyncReturns } from 'node:child_process';

/** Options for the synchronous print invocation. */
type ClaudePrintInvokeOptions = {
  readonly prompt: string;
  readonly model?: string;
  readonly spawn: SpawnSyncFn;
};

/** Options for the asynchronous streaming session invocation. */
type ClaudeSessionInvokeOptions = {
  readonly prompt: string;
  readonly model?: string;
  readonly spawn: StreamingSpawnFn;
};

type ClaudePrintResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly ok: boolean;
};

type ClaudeSessionResult = {
  readonly ok: boolean;
  readonly stderr: string;
};

const STDERR_TAIL_BYTES = 4096;

function buildArgs(base: readonly string[], model?: string): readonly string[] {
  return model ? [...base, '--model', model] : base;
}

function isSyncSuccess(result: SpawnSyncReturns<string>): boolean {
  return result.status === 0 && !result.error;
}

function isStreamingSuccess(result: StreamingSpawnResult): boolean {
  return result.status === 0 && !result.error;
}

/**
 * Truncate stderr to the trailing 4 KiB to bound the boundary-layer error
 * payload. Production stderr from a long Claude session can run into MB; the
 * outer pipeline result is a single-line display surface, so a tail of the
 * trailing context is enough to explain a failure.
 */
function tailStderr(stderr: string): string {
  if (stderr.length <= STDERR_TAIL_BYTES) return stderr;
  const truncated = stderr.slice(-STDERR_TAIL_BYTES);
  return `…(stderr truncated, last ${STDERR_TAIL_BYTES} bytes shown)…\n${truncated}`;
}

/**
 * Invoke Claude in print mode and capture the response.
 *
 * Uses `claude -p` for a single-prompt, non-interactive invocation.
 * Both stdout and stderr are captured (not streamed) so the caller can parse
 * the response and surface failure context.
 *
 * @param options - The print invocation options.
 * @returns Captured stdout, captured stderr (4 KiB tail), and process success.
 */
export function invokeClaudePrint(
  options: ClaudePrintInvokeOptions,
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
    stderr: tailStderr(result.stderr ?? ''),
    ok: isSyncSuccess(result),
  };
}

/**
 * Invoke a Claude Code session with the given prompt.
 *
 * Pipes the prompt to stdin and streams stdout/stderr live to the terminal
 * via the injected {@link StreamingSpawnFn} (production implementations tee
 * to `process.stdout` / `process.stderr`). Resolves once the session exits.
 *
 * @param options - The session invocation options.
 * @returns Process success flag plus the trailing 4 KiB of captured stderr.
 */
export async function invokeClaudeSession(
  options: ClaudeSessionInvokeOptions,
): Promise<ClaudeSessionResult> {
  const { prompt, model, spawn } = options;
  // Clancy runs autonomously — skip the interactive permission prompt
  const base = ['--dangerously-skip-permissions'] as const;
  const args = buildArgs(base, model);

  const result = await spawn('claude', args, { input: prompt });

  return {
    ok: isStreamingSuccess(result),
    stderr: tailStderr(result.stderr),
  };
}
