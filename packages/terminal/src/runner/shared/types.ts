/**
 * Shared types used across runner modules.
 *
 * Consolidates types that were previously duplicated in cli-bridge,
 * dep-factory, invoke-phase, implement, autopilot, and deliver-phase.
 */
import type { ProgressStatus } from '@chief-clancy/core';
import type { SpawnSyncReturns } from 'node:child_process';

type StdioValue = 'inherit' | 'ignore' | 'pipe' | number;

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

/** Minimal console interface for injecting log output. */
export type ConsoleLike = {
  readonly log: (message: string) => void;
  readonly error: (message: string) => void;
};

/** Progress append function used by dep-factory and deliver-phase. */
export type AppendFn = (opts: {
  readonly key: string;
  readonly summary: string;
  readonly status: ProgressStatus;
  readonly prNumber?: number;
  readonly parent?: string;
  readonly ticketType?: string;
}) => void;
