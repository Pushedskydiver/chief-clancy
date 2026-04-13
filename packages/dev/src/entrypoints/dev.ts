/**
 * Dev runtime entry point — wire real Node.js I/O into the single-ticket executor.
 *
 * This file is the entry point for the `clancy-dev.js` bundle.
 * It parses CLI args, constructs dependency injection adapters from
 * real Node.js APIs (fs, child_process, fetch), detects the board,
 * and runs the pipeline for a single ticket identified by key.
 *
 * Built by esbuild into a self-contained ESM bundle with zero npm deps.
 */
import type { PipelineResult } from '../pipeline/index.js';
import type {
  BoardConfig,
  EnvFileSystem,
  FetchedTicket,
} from '@chief-clancy/core';

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createBoard, detectBoard, loadClancyEnv } from '@chief-clancy/core';

import { invokeReadinessGrade } from '../agents/invoke/index.js';
import { loadRubric } from '../agents/rubric-loader.js';
import { buildPipelineDeps } from '../dep-factory/dep-factory.js';
import { runSingleTicketByKey } from '../execute/index.js';
import { runReadinessGate } from '../execute/readiness/index.js';
import { formatDuration } from '../lifecycle/format/format.js';
import { createContext, runPipeline } from '../pipeline/index.js';
import { buildPrompt, buildReworkPrompt } from '../prompt-builder/index.js';
import {
  makeCostFs,
  makeEnvFs,
  makeExecGit,
  makeLockFs,
  makeProgressFs,
  makeQualityFs,
} from './adapters.js';

// ─── Types ──────────────────────────────────────────────────────────────────

type LoadEnvResult =
  | { readonly envFs: EnvFileSystem; readonly boardConfig: BoardConfig }
  | undefined;

// ─── Setup helpers ──────────────────────────────────────────────────────────

function parseTicketKey(): string {
  const key = process.argv[2];

  if (!key) {
    console.error('Usage: clancy-dev <ticket-key>');
    process.exit(2);
  }

  return key;
}

/**
 * Load `.clancy/.env` and detect the board provider.
 *
 * @internal Exported for testing.
 * @param projectRoot - Absolute path to the project root.
 * @returns Loaded env and board config, or `undefined` when no env file or no board detected.
 */
export function loadEnv(projectRoot: string): LoadEnvResult {
  const envFs = makeEnvFs();
  const env = loadClancyEnv(projectRoot, envFs);

  if (!env) {
    console.error('✗ No .clancy/.env found — run /clancy:init first');
    return undefined;
  }

  const boardResult = detectBoard(env);

  if (typeof boardResult === 'string') {
    console.error(boardResult);
    console.error(
      '  Use /clancy:implement --from <plan> for local mode, or run /clancy:init to configure a board.',
    );
    return undefined;
  }

  return { envFs, boardConfig: boardResult };
}

function displayResult(result: PipelineResult, elapsed: string): void {
  switch (result.status) {
    case 'completed':
      console.log(`✅ Ticket completed (${elapsed})`);
      break;

    case 'aborted':
      console.log(
        `⏹ Pipeline aborted at ${result.phase ?? 'unknown'} (${elapsed})`,
      );
      if (result.error) {
        console.log(`   ${result.error}`);
      }
      break;

    case 'resumed':
      console.log(`↩ Resumed previous session (${elapsed})`);
      break;

    case 'dry-run':
      console.log(`🏁 Dry run complete (${elapsed})`);
      break;

    case 'error':
      console.error(`❌ Clancy stopped (${elapsed})`);
      console.error(`   ${result.error ?? 'Unknown error'}`);
      process.exit(1);
      break;

    default: {
      const _exhaustive: never = result.status;
      return _exhaustive;
    }
  }
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

// ─── Argv helpers ───────────────────────────────────────────────────────────

/** Check `--from` in argv: `'valid'` with a usable path, `'bare'` without, or `false` if absent. */
function checkFromFlag(argv: readonly string[]): 'valid' | 'bare' | false {
  const idx = argv.indexOf('--from');
  if (idx === -1) return false;
  const value = argv[idx + 1];
  return value !== undefined && !value.startsWith('--') ? 'valid' : 'bare';
}

// ─── Local mode ─────────────────────────────────────────────────────────────

/**
 * Run the pipeline in local mode (`--from`), skipping board detection.
 * The pipeline's local-wiring handles preflight and ticket seeding.
 */
async function runLocalMode(
  projectRoot: string,
  argv: readonly string[],
): Promise<void> {
  const ctx = createContext({ projectRoot, argv, isAfk: false });

  const pipelineDeps = buildPipelineDeps({
    projectRoot,
    exec: makeExecGit(projectRoot),
    lockFs: makeLockFs(),
    progressFs: makeProgressFs(),
    costFs: makeCostFs(),
    envFs: makeEnvFs(),
    qualityFs: makeQualityFs(),
    spawn: (cmd, args, opts) =>
      spawnSync(cmd, [...args], { ...opts, stdio: [...opts.stdio] }),
    fetch: globalThis.fetch.bind(globalThis),
    buildPrompt,
    buildReworkPrompt,
  });

  const startTime = Date.now();
  const result = await runPipeline(ctx, pipelineDeps);
  displayResult(result, formatDuration(Date.now() - startTime));
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const projectRoot = process.cwd();

  // --from with a usable value → skip board detection and ticket key.
  const fromFlag = checkFromFlag(process.argv);

  if (fromFlag === 'valid')
    return runLocalMode(projectRoot, process.argv.slice(2));
  if (fromFlag === 'bare') {
    console.error('Usage: clancy-dev --from <plan-file>');
    return process.exit(2);
  }

  const ticketKey = parseTicketKey();
  const passthroughArgv = process.argv.slice(3);

  // Board mode: detect board, run single-ticket executor.
  const envResult = loadEnv(projectRoot);

  if (!envResult) return process.exit(1);

  const { envFs, boardConfig } = envResult;

  const board = createBoard(boardConfig, (url, init) =>
    globalThis.fetch(url, init),
  );

  const pipelineDeps = buildPipelineDeps({
    projectRoot,
    exec: makeExecGit(projectRoot),
    lockFs: makeLockFs(),
    progressFs: makeProgressFs(),
    costFs: makeCostFs(),
    envFs,
    qualityFs: makeQualityFs(),
    spawn: (cmd, args, opts) =>
      spawnSync(cmd, [...args], { ...opts, stdio: [...opts.stdio] }),
    fetch: globalThis.fetch.bind(globalThis),
    buildPrompt,
    buildReworkPrompt,
  });

  const startTime = Date.now();

  const result = await runSingleTicketByKey(ticketKey, {
    // Single-ticket mode intentionally bypasses queue filters (excludeHitl,
    // buildLabel) — the user explicitly chose this ticket by key. Cut F/G
    // can add a dedicated Board.fetchTicketByKey() method if needed.
    fetchTicketByKeyOnce: async (key) => {
      const tickets = await board.fetchTickets({});
      return tickets.find((t) => t.key === key);
    },
    pipelineDeps,
    runPipeline,
    projectRoot,
    argv: passthroughArgv,
    isAfk: false,
    readinessGate: makeReadinessGate({
      rubric: loadRubric(),
      projectRoot,
      model: boardConfig.env.CLANCY_MODEL,
    }),
  });

  displayResult(result, formatDuration(Date.now() - startTime));
}

// Main guard — self-execute when run directly (e.g. node .clancy/clancy-dev.js PROJ-42)
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
