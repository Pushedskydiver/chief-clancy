/**
 * Autopilot loop entry point — wire real Node.js I/O into executeQueue.
 *
 * This file is the entry point for the `clancy-dev-autopilot.js` bundle.
 * It fetches the ticket queue from the board, processes each ticket
 * sequentially through the pipeline, and reports results.
 *
 * Built by esbuild into a self-contained ESM bundle with zero npm deps.
 */
import type {
  BoardConfig,
  EnvFileSystem,
  FetchedTicket,
} from '@chief-clancy/core';

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createBoard, detectBoard, loadClancyEnv } from '@chief-clancy/core';

import { invokeReadinessGrade } from '../agents/invoke/index.js';
import { loadRubric } from '../agents/rubric-loader.js';
import { runReadinessGate } from '../execute/readiness/index.js';
import { makeAtomicFs, makeEnvFs } from './adapters.js';
import { runAndReport } from './loop-execute.js';
import { runLoopPreflight } from './loop-preflight.js';

// ─── Types ──────────────────────────────────────────────────────────────────

type LoopArgs = {
  readonly isAfk: boolean;
  readonly maxIterations: number | undefined;
  readonly bypassReadiness: boolean;
  readonly maxBatch: number | undefined;
  readonly resume: boolean;
  /** Skip interactive cost confirmation. Consumed in PR 12d. */
  readonly yes: boolean;
  readonly passthroughArgv: readonly string[];
};

// ─── Argument parsing ──────────────────────────────────────────────────────

function parseIntFlag(
  flag: string | undefined,
  prefix: string,
): number | undefined {
  if (!flag) return undefined;
  const parsed = Math.floor(Number(flag.slice(prefix.length)));
  return parsed > 0 ? parsed : undefined;
}

const LOOP_FLAGS = new Set([
  '--afk',
  '--bypass-readiness',
  '--resume',
  '--yes',
]);
const isLoopFlag = (a: string) =>
  LOOP_FLAGS.has(a) || a.startsWith('--max=') || a.startsWith('--max-batch=');

export function parseLoopArgs(argv: readonly string[]): LoopArgs {
  const args = argv.slice(2);

  return {
    isAfk: args.includes('--afk'),
    maxIterations: parseIntFlag(
      args.find((a) => a.startsWith('--max=')),
      '--max=',
    ),
    bypassReadiness: args.includes('--bypass-readiness'),
    maxBatch: parseIntFlag(
      args.find((a) => a.startsWith('--max-batch=')),
      '--max-batch=',
    ),
    resume: args.includes('--resume'),
    yes: args.includes('--yes'),
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
    console.error('✗ No .clancy/.env found — run /clancy:board-setup first');
    return process.exit(1);
  }

  const boardResult = detectBoard(rawEnv);

  if (typeof boardResult === 'string') {
    console.error(boardResult);
    return process.exit(1);
  }

  return { envFs, boardConfig: boardResult, rawEnv };
}

/** Resolve the build label from board config env vars (raw env, no RunContext). */
export function resolveBuildLabelFromEnv(
  env: Record<string, string | undefined>,
): string {
  return env.CLANCY_LABEL_BUILD ?? env.CLANCY_LABEL ?? 'clancy:build';
}

const DEFAULT_QUEUE_LIMIT = 50;
const DEFAULT_BATCH_CAP = 50;
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

function makeGradeOneFn(opts: {
  readonly ticketMap: ReadonlyMap<string, FetchedTicket>;
  readonly rubric: string;
  readonly projectRoot: string;
  readonly model?: string;
}) {
  return (ticketId: string) => {
    const ticket = opts.ticketMap.get(ticketId);
    if (!ticket)
      return { ok: false as const, error: `Ticket ${ticketId} not found` };
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

function mergeEnv(
  rawEnv: Record<string, string>,
): Record<string, string | undefined> {
  return { ...rawEnv, ...process.env };
}

function makeTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d+Z$/, '');
}

// ─── Pre-flight orchestration ──────────────────────────────────────────────

function runPreflightIfNeeded(opts: {
  readonly shouldRun: boolean;
  readonly tickets: readonly FetchedTicket[];
  readonly ticketMap: ReadonlyMap<string, FetchedTicket>;
  readonly rubric: string;
  readonly projectRoot: string;
  readonly model?: string;
  readonly loopArgs: LoopArgs;
}): readonly string[] | 'skip' | 'halt' {
  if (!opts.shouldRun) return 'skip';

  const devDir = join(opts.projectRoot, '.clancy', 'dev');
  const preflight = runLoopPreflight({
    ticketIds: opts.tickets.map((t) => t.key),
    grade: makeGradeOneFn({
      ticketMap: opts.ticketMap,
      rubric: opts.rubric,
      projectRoot: opts.projectRoot,
      model: opts.model,
    }),
    fs: makeAtomicFs(),
    dir: devDir,
    maxBatch: opts.loopArgs.maxBatch ?? DEFAULT_BATCH_CAP,
    resume: opts.loopArgs.resume,
    timestamp: makeTimestamp,
    console,
    readFile: (p) => readFileSync(p, 'utf8'),
  });

  if (!preflight.canProceed) {
    console.log('Pre-flight found non-green tickets. Halting.');
    console.log(`Report: ${devDir}/readiness-report.md`);
    return 'halt';
  }

  return preflight.verdicts.map((v) => v.ticketId);
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
  const rubric = loopArgs.bypassReadiness ? undefined : loadRubric();
  const model = boardConfig.env.CLANCY_MODEL;
  const readinessGate =
    rubric && !loopArgs.bypassReadiness
      ? makeReadinessGate({ rubric, projectRoot, model })
      : undefined;

  // Pre-flight returns graded ticket ids — only these run in the queue.
  // When preflight is skipped (non-AFK or bypass), all fetched tickets run.
  const preflightedIds = runPreflightIfNeeded({
    shouldRun: loopArgs.isAfk && !!rubric && !loopArgs.bypassReadiness,
    tickets,
    ticketMap,
    rubric: rubric ?? '',
    projectRoot,
    model,
    loopArgs,
  });
  if (preflightedIds === 'halt') return;

  const queueTickets =
    preflightedIds === 'skip'
      ? tickets
      : tickets.filter((t) => preflightedIds.includes(t.key));

  await runAndReport({
    tickets: queueTickets,
    ticketMap,
    projectRoot,
    envFs,
    loopArgs,
    readinessGate,
    env,
  });
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
