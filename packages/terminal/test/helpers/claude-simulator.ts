/**
 * Claude CLI simulator for integration tests.
 *
 * Creates a mock {@link SpawnSyncFn} that records every invocation and
 * returns configurable responses — avoiding real `claude` subprocess calls.
 *
 * Designed for DI injection into `invokeClaudeSession` and
 * `invokeClaudePrint`, which both accept a `spawn` parameter.
 */
import type { SpawnSyncFn, StdioValue } from '~/t/runner/shared/types.js';
import type { SpawnSyncReturns } from 'node:child_process';

/** A recorded simulator invocation. */
export type SimulatorCall = {
  readonly command: string;
  readonly args: readonly string[];
  readonly input: string;
  readonly stdio: readonly StdioValue[];
};

/** Per-call response override. Unset fields fall back to defaults. */
type SimulatorResponse = {
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
  /** The injectable spawn function. */
  readonly spawn: SpawnSyncFn;
  /** All recorded calls, in order. */
  readonly calls: readonly SimulatorCall[];
  /** Number of calls made. */
  readonly callCount: number;
};

function buildResult(resp: SimulatorResponse): SpawnSyncReturns<string> {
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

/**
 * Create a Claude CLI simulator.
 *
 * @param options - Default response values and optional per-call sequence.
 * @returns An object with an injectable `spawn` function and call records.
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

    return buildResult(resolveResponse());
  };

  return {
    spawn,
    get calls() {
      return mutableCalls;
    },
    get callCount() {
      return mutableCalls.length;
    },
  };
}
