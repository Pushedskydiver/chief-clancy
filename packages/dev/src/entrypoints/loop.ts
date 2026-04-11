/**
 * Autopilot loop entry point — wire real Node.js I/O into executeQueue.
 *
 * This file is the entry point for the `clancy-dev-autopilot.js` bundle.
 * It fetches the ticket queue from the board, processes each ticket
 * sequentially through the pipeline, and reports results.
 *
 * Built by esbuild into a self-contained ESM bundle with zero npm deps.
 */
import type { CostFs, LockFs, ProgressFs, QualityFs } from '../index.js';
import type { PipelineResult } from '../pipeline/index.js';
import type {
  BoardConfig,
  EnvFileSystem,
  FetchedTicket,
} from '@chief-clancy/core';

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { createBoard, detectBoard, loadClancyEnv } from '@chief-clancy/core';

import { invokeReadinessGrade } from '../agents/invoke/index.js';
import { loadRubric } from '../agents/rubric-loader.js';
import { buildPipelineDeps } from '../dep-factory/dep-factory.js';
import { runSingleTicketByKey } from '../execute/index.js';
import { runReadinessGate } from '../execute/readiness/index.js';
import { runPipeline } from '../pipeline/index.js';
import { buildPrompt, buildReworkPrompt } from '../prompt-builder/index.js';
import { executeQueue } from '../queue.js';
import { checkStopCondition } from '../stop-condition.js';
import {
  makeCostFs,
  makeEnvFs,
  makeExecGit,
  makeLockFs,
  makeProgressFs,
  makeQualityFs,
} from './adapters.js';
import { displayOutcome, notifyIfConfigured } from './loop-output.js';

// ─── Types ──────────────────────────────────────────────────────────────────

type LoopArgs = {
  readonly isAfk: boolean;
  readonly maxIterations: number | undefined;
  readonly bypassReadiness: boolean;
  /** Non-loop flags to forward to each ticket run (e.g. --dry-run). */
  readonly passthroughArgv: readonly string[];
};

// ─── Argument parsing ──────────────────────────────────────────────────────

function parseMaxFlag(flag: string | undefined): number | undefined {
  if (!flag) return undefined;
  const parsed = Math.floor(Number(flag.slice('--max='.length)));
  return parsed > 0 ? parsed : undefined;
}

/**
 * Parse loop-specific arguments from CLI argv.
 *
 * Recognises `--afk`, `--max=N`, and `--bypass-readiness`.
 *
 * @param argv - Raw process.argv (including node and script path).
 * @returns Parsed loop arguments.
 */
const LOOP_FLAGS = new Set(['--afk', '--bypass-readiness']);
const isLoopFlag = (a: string) => LOOP_FLAGS.has(a) || a.startsWith('--max=');

export function parseLoopArgs(argv: readonly string[]): LoopArgs {
  const args = argv.slice(2);

  return {
    isAfk: args.includes('--afk'),
    maxIterations: parseMaxFlag(args.find((a) => a.startsWith('--max='))),
    bypassReadiness: args.includes('--bypass-readiness'),
    passthroughArgv: args.filter((a) => !isLoopFlag(a)),
  };
}

// ─── Setup helpers ──────────────────────────────────────────────────────────

function loadEnv(projectRoot: string): {
  readonly envFs: EnvFileSystem;
  readonly boardConfig: BoardConfig;
  readonly rawEnv: Record<string, string>;
} {
  const envFs = makeEnvFs();
  const rawEnv = loadClancyEnv(projectRoot, envFs);

  if (!rawEnv) {
    console.error(
      '✗ No .clancy/.env found — run /clancy:board-setup to configure your board',
    );
    return process.exit(1);
  }

  const boardResult = detectBoard(rawEnv);

  if (typeof boardResult === 'string') {
    console.error(boardResult);
    return process.exit(1);
  }

  return { envFs, boardConfig: boardResult, rawEnv };
}

/**
 * Resolve the build label from board config env vars.
 *
 * Mirrors dep-factory's `resolveBuildLabel` but reads from raw env
 * rather than RunContext (which doesn't exist yet at queue-fetch time).
 *
 * @param env - Board config environment variables.
 * @returns The resolved build label string.
 */
export function resolveBuildLabelFromEnv(
  env: Record<string, string | undefined>,
): string {
  return env.CLANCY_LABEL_BUILD ?? env.CLANCY_LABEL ?? 'clancy:build';
}

/** Default queue fetch limit when no `--max` flag is provided. */
const DEFAULT_QUEUE_LIMIT = 50;

/** Hard cap matching executeQueue's MAX_ITERATIONS_CAP (100). */
const MAX_FETCH_LIMIT = 100;

async function fetchTicketQueue(
  boardConfig: BoardConfig,
  limit: number | undefined,
): Promise<readonly FetchedTicket[]> {
  const board = createBoard(boardConfig, (url, init) =>
    globalThis.fetch(url, init),
  );
  return board.fetchTickets({
    excludeHitl: true,
    buildLabel: resolveBuildLabelFromEnv(boardConfig.env),
    limit: Math.min(limit ?? DEFAULT_QUEUE_LIMIT, MAX_FETCH_LIMIT),
  });
}

// ─── Readiness wiring ───────────────────────────────────────────────────────

function makeReadinessGate(opts: {
  readonly rubric: string;
  readonly projectRoot: string;
  readonly model?: string;
}) {
  return (ticket: FetchedTicket) =>
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

// ─── Run-ticket closure factory ─────────────────────────────────────────────

type BuildRunTicketOpts = {
  readonly ticketMap: ReadonlyMap<string, FetchedTicket>;
  readonly projectRoot: string;
  readonly envFs: EnvFileSystem;
  readonly lockFs: LockFs;
  readonly progressFs: ProgressFs;
  readonly costFs: CostFs;
  readonly qualityFs: QualityFs;
  readonly loopArgs: LoopArgs;
  readonly readinessGate:
    | ((ticket: FetchedTicket) => ReturnType<typeof runReadinessGate>)
    | undefined;
};

function buildRunTicket(
  opts: BuildRunTicketOpts,
): (ticketId: string) => Promise<PipelineResult> {
  return async (ticketId) => {
    console.log(`\n── Processing ${ticketId} ──`);

    const pipelineDeps = buildPipelineDeps({
      projectRoot: opts.projectRoot,
      exec: makeExecGit(opts.projectRoot),
      lockFs: opts.lockFs,
      progressFs: opts.progressFs,
      costFs: opts.costFs,
      envFs: opts.envFs,
      qualityFs: opts.qualityFs,
      spawn: (cmd, args, spawnOpts) =>
        spawnSync(cmd, [...args], {
          ...spawnOpts,
          stdio: [...spawnOpts.stdio],
        }),
      fetch: globalThis.fetch.bind(globalThis),
      buildPrompt,
      buildReworkPrompt,
    });

    return runSingleTicketByKey(ticketId, {
      fetchTicketByKeyOnce: (key) => Promise.resolve(opts.ticketMap.get(key)),
      pipelineDeps,
      runPipeline,
      projectRoot: opts.projectRoot,
      // Forward non-loop flags (--dry-run, --skip-feasibility, etc.) plus
      // --bypass-readiness when set (belt-and-suspenders with undefined gate).
      argv: opts.loopArgs.bypassReadiness
        ? ['--bypass-readiness', ...opts.loopArgs.passthroughArgv]
        : opts.loopArgs.passthroughArgv,
      isAfk: opts.loopArgs.isAfk,
      readinessGate: opts.readinessGate,
    });
  };
}

// ─── Env merging ────────────────────────────────────────────────────────────

/**
 * Merge raw .clancy/.env with shell env — shell overrides file settings.
 *
 * Uses the raw (pre-validation) env record so non-schema keys like
 * CLANCY_QUIET_START/END survive the board detection step.
 */
function mergeEnv(
  rawEnv: Record<string, string>,
): Record<string, string | undefined> {
  return { ...rawEnv, ...process.env };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const loopArgs = parseLoopArgs(process.argv);
  const projectRoot = process.cwd();
  const { envFs, boardConfig, rawEnv } = loadEnv(projectRoot);
  const env = mergeEnv(rawEnv);

  const tickets = await fetchTicketQueue(boardConfig, loopArgs.maxIterations);
  if (tickets.length === 0) {
    console.log('No tickets in the build queue. Nothing to do.');
    return;
  }
  console.log(`Found ${tickets.length} ticket(s) in the build queue.`);

  const ticketMap = new Map(tickets.map((t) => [t.key, t]));
  const readinessGate = loopArgs.bypassReadiness
    ? undefined
    : makeReadinessGate({
        rubric: loadRubric(),
        projectRoot,
        model: boardConfig.env.CLANCY_MODEL,
      });

  const run = buildRunTicket({
    ticketMap,
    projectRoot,
    envFs,
    lockFs: makeLockFs(),
    progressFs: makeProgressFs(),
    costFs: makeCostFs(),
    qualityFs: makeQualityFs(),
    loopArgs,
    readinessGate,
  });

  const outcome = await executeQueue({
    queue: tickets.map((t) => t.key),
    run,
    shouldHalt: checkStopCondition,
    maxIterations: loopArgs.maxIterations,
    quietStart: env.CLANCY_QUIET_START,
    quietEnd: env.CLANCY_QUIET_END,
    sleep: (ms) => sleep(ms),
    clock: Date.now,
    console,
  });

  displayOutcome(outcome, tickets.length);
  await notifyIfConfigured(env.CLANCY_NOTIFY_WEBHOOK, outcome, tickets.length);
}

// Main guard — self-execute when run directly
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
