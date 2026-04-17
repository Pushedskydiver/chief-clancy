/**
 * Loop setup helpers — production I/O wiring for main().
 *
 * These functions create real Node.js adapters used by the loop
 * entrypoint. Separated from loop.ts to keep the orchestrator lean.
 */
import type { GradeOneFn } from '../artifacts/preflight-batch.js';
import type { GateResult } from '../execute/readiness/readiness-gate.js';
import type {
  BoardConfig,
  EnvFileSystem,
  FetchedTicket,
} from '@chief-clancy/core';

import { spawnSync } from 'node:child_process';

import { createBoard, detectBoard, loadClancyEnv } from '@chief-clancy/core';

import { invokeReadinessGrade } from '../agents/invoke.js';
import { runReadinessGate } from '../execute/readiness/readiness-gate.js';
import { makeEnvFs } from './adapters.js';

// ─── Constants ────────────────────────────────────────────────────────────

const DEFAULT_QUEUE_LIMIT = 50;
const MAX_FETCH_LIMIT = 100;

// ─── Types ────────────────────────────────────────────────────────────────

type LoadEnvResult =
  | {
      readonly envFs: EnvFileSystem;
      readonly boardConfig: BoardConfig;
      readonly rawEnv: Record<string, string>;
    }
  | undefined;

// ─── Env loading ──────────────────────────────────────────────────────────

/**
 * Load `.clancy/.env` and detect the board provider for the autopilot loop.
 *
 * @param projectRoot - Absolute path to the project root.
 * @returns Loaded env, board config, and raw env vars, or `undefined` when no env file or no board detected.
 */
function loadEnv(projectRoot: string): LoadEnvResult {
  const envFs = makeEnvFs();
  const rawEnv = loadClancyEnv(projectRoot, envFs);

  if (!rawEnv) {
    console.error('✗ No .clancy/.env found — run /clancy:init first');
    return undefined;
  }

  const boardResult = detectBoard(rawEnv);

  if (typeof boardResult === 'string') {
    console.error(boardResult);
    console.error(
      '  Use /clancy:implement --from <plan> for local mode, or run /clancy:init to configure a board.',
    );
    return undefined;
  }

  return { envFs, boardConfig: boardResult, rawEnv };
}

function mergeEnv(
  rawEnv: Record<string, string>,
): Record<string, string | undefined> {
  return { ...rawEnv, ...process.env };
}

// ─── Queue fetching ───────────────────────────────────────────────────────

/** Resolve the build label from board config env vars (raw env, no RunContext). */
function resolveBuildLabelFromEnv(
  env: Record<string, string | undefined>,
): string {
  return env.CLANCY_LABEL_BUILD ?? env.CLANCY_LABEL ?? 'clancy:build';
}

/** Create a queue-fetcher bound to the given board configuration. */
function makeFetchQueue(
  boardConfig: BoardConfig,
): (limit: number | undefined) => Promise<readonly FetchedTicket[]> {
  return async (limit) => {
    const board = createBoard(boardConfig, (url, init) =>
      globalThis.fetch(url, init),
    );
    return board.fetchTickets({
      excludeHitl: true,
      buildLabel: resolveBuildLabelFromEnv(boardConfig.env),
      limit: Math.min(limit ?? DEFAULT_QUEUE_LIMIT, MAX_FETCH_LIMIT),
    });
  };
}

// ─── Grading + readiness gate ─────────────────────────────────────────────

function makeGradeOneFn(opts: {
  readonly ticketMap: ReadonlyMap<string, FetchedTicket>;
  readonly rubric: string;
  readonly projectRoot: string;
  readonly model?: string;
}): GradeOneFn {
  return (ticketId: string) => {
    const ticket = opts.ticketMap.get(ticketId);
    if (!ticket)
      return {
        ok: false as const,
        error: {
          kind: 'unknown' as const,
          message: `Ticket ${ticketId} not found`,
        },
      };
    return invokeReadinessGrade({
      rubric: opts.rubric,
      ticketId: ticket.key,
      ticketTitle: ticket.title,
      ticketDescription: ticket.description,
      projectRoot: opts.projectRoot,
      spawn: (cmd, args, spawnOpts) =>
        spawnSync(cmd, [...args], {
          ...spawnOpts,
          stdio: [...spawnOpts.stdio],
        }),
      model: opts.model,
    });
  };
}

function makeReadinessGate(opts: {
  readonly rubric: string;
  readonly projectRoot: string;
  readonly model?: string;
}): (ticket: FetchedTicket) => GateResult {
  return (ticket) =>
    runReadinessGate({
      grade: () =>
        invokeReadinessGrade({
          rubric: opts.rubric,
          ticketId: ticket.key,
          ticketTitle: ticket.title,
          ticketDescription: ticket.description,
          projectRoot: opts.projectRoot,
          spawn: (cmd, args, spawnOpts) =>
            spawnSync(cmd, [...args], {
              ...spawnOpts,
              stdio: [...spawnOpts.stdio],
            }),
          model: opts.model,
        }),
      maxRounds: 3,
    });
}

function makeTimestamp(): string {
  return new Date().toISOString().replace(/:/g, '-').replace(/Z$/, '');
}

// ─── Exports ──────────────────────────────────────────────────────────────

export {
  loadEnv,
  makeFetchQueue,
  makeGradeOneFn,
  makeReadinessGate,
  makeTimestamp,
  mergeEnv,
  resolveBuildLabelFromEnv,
};
