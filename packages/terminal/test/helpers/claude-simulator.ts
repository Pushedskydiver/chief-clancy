/**
 * Claude CLI simulator for integration tests.
 *
 * Creates mock spawn functions that record every invocation and return
 * configurable responses — avoiding real `claude` subprocess calls. Provides
 * both a synchronous {@link SpawnSyncFn} (used by `invokeClaudePrint`) and an
 * asynchronous {@link StreamingSpawnFn} (used by `invokeClaudeSession`); both
 * record into the same call log so test assertions remain unified regardless
 * of which surface fires.
 */
import type {
  SpawnSyncFn,
  StdioValue,
  StreamingSpawnFn,
  StreamingSpawnResult,
} from '@chief-clancy/dev';
import type { SpawnSyncReturns } from 'node:child_process';

/** A recorded simulator invocation. */
export type SimulatorCall = {
  readonly command: string;
  readonly args: readonly string[];
  readonly input: string;
  /** stdio shape for sync calls; undefined for streaming calls. */
  readonly stdio?: readonly StdioValue[];
};

/** Per-call response override. Unset fields fall back to defaults. */
export type SimulatorResponse = {
  readonly stdout?: string;
  readonly stderr?: string;
  readonly exitCode?: number;
  readonly error?: Error;
};

/** Options for creating a Claude simulator. */
type SimulatorOptions = SimulatorResponse & {
  /** Ordered per-call overrides. After exhaustion, defaults apply. */
  readonly responses?: readonly SimulatorResponse[];
};

type ClaudeSimulator = {
  /** Synchronous spawn — drives `invokeClaudePrint`. */
  readonly spawn: SpawnSyncFn;
  /** Async streaming spawn — drives `invokeClaudeSession`. */
  readonly streamingSpawn: StreamingSpawnFn;
  /** All recorded calls, in order, across both spawn surfaces. */
  readonly calls: readonly SimulatorCall[];
  /** Number of calls made. */
  readonly callCount: number;
};

function buildSyncResult(resp: SimulatorResponse): SpawnSyncReturns<string> {
  return {
    pid: 0,
    output: [],
    stdout: resp.stdout ?? '',
    stderr: resp.stderr ?? '',
    status: resp.exitCode ?? 0,
    signal: null,
    error: resp.error,
  };
}

function buildStreamingResult(resp: SimulatorResponse): StreamingSpawnResult {
  return {
    stdout: resp.stdout ?? '',
    stderr: resp.stderr ?? '',
    status: resp.error ? null : (resp.exitCode ?? 0),
    signal: null,
    error: resp.error,
  };
}

/**
 * Create a Claude CLI simulator.
 *
 * @param options - Default response values and optional per-call sequence.
 * @returns An object with injectable spawn functions and call records.
 */
export function createClaudeSimulator(
  options: SimulatorOptions = {},
): ClaudeSimulator {
  const { responses, ...defaults } = options;
  const mutableCalls: SimulatorCall[] = [];
  let callIndex = 0;

  const resolveResponse = (): SimulatorResponse => {
    const sequenced = responses?.[callIndex];
    callIndex++;
    return sequenced ? { ...defaults, ...sequenced } : defaults;
  };

  const spawn: SpawnSyncFn = (command, args, spawnOpts) => {
    mutableCalls.push({
      command,
      args,
      input: spawnOpts.input,
      stdio: spawnOpts.stdio,
    });

    return buildSyncResult(resolveResponse());
  };

  const streamingSpawn: StreamingSpawnFn = (command, args, spawnOpts) => {
    mutableCalls.push({
      command,
      args,
      input: spawnOpts.input,
    });

    return Promise.resolve(buildStreamingResult(resolveResponse()));
  };

  return {
    spawn,
    streamingSpawn,
    get calls() {
      return mutableCalls;
    },
    get callCount() {
      return mutableCalls.length;
    },
  };
}
