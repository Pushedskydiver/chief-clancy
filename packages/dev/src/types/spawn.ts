/**
 * Shared process-spawning types used across runner modules.
 *
 * Consolidates types that were previously in terminal's runner/shared/types.ts.
 */
import type { SpawnSyncReturns } from 'node:child_process';

export type StdioValue = 'inherit' | 'ignore' | 'pipe' | number;

/** Synchronous process spawner with narrowed stdio options. */
export type SpawnSyncFn = (
  command: string,
  args: readonly string[],
  options: {
    readonly input: string;
    readonly stdio: readonly StdioValue[];
    readonly encoding: 'utf8';
  },
) => SpawnSyncReturns<string>;

/** Result of a streaming spawn — captured buffers + exit info. */
export type StreamingSpawnResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly error?: Error;
};

/**
 * Async streaming process spawner.
 *
 * Production implementations tee child stdout/stderr live to the terminal
 * while accumulating captured buffers. Resolves once the process exits.
 * Test implementations return `Promise.resolve(...)` with synthetic buffers.
 */
export type StreamingSpawnFn = (
  command: string,
  args: readonly string[],
  options: {
    readonly input: string;
  },
) => Promise<StreamingSpawnResult>;

/** Minimal console interface for injecting log output. */
export type ConsoleLike = {
  readonly log: (message: string) => void;
  readonly error: (message: string) => void;
};
