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
import type { CostFs, LockFs, ProgressFs, QualityFs } from '../index.js';
import type { PipelineResult } from '../pipeline/index.js';
import type { BoardConfig, EnvFileSystem, ExecGit } from '@chief-clancy/core';
import type { SpawnSyncReturns } from 'node:child_process';

import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createBoard, detectBoard, loadClancyEnv } from '@chief-clancy/core';

import { invokeReadinessGrade } from '../agents/invoke/index.js';
import { loadRubric } from '../agents/rubric-loader.js';
import { buildPipelineDeps } from '../dep-factory/dep-factory.js';
import { runSingleTicketByKey } from '../execute/index.js';
import { runReadinessGate } from '../execute/readiness/index.js';
import { formatDuration } from '../lifecycle/format/format.js';
import { runPipeline } from '../pipeline/index.js';
import { buildPrompt, buildReworkPrompt } from '../prompt-builder/index.js';

// ─── Types ──────────────────────────────────────────────────────────────────

type GitSpawnFn = (
  command: string,
  args: readonly string[],
  options: { readonly cwd: string; readonly encoding: 'utf8' },
) => SpawnSyncReturns<string>;

// ─── Adapter factories ──────────────────────────────────────────────────────
// Duplicated from terminal's entrypoint — dev cannot import from terminal.
// A future PR can extract these to a shared module in dev.

function makeExecGit(cwd: string, spawn: GitSpawnFn = spawnSync): ExecGit {
  return (args) => {
    const result = spawn('git', [...args], { cwd, encoding: 'utf8' });

    if (result.status !== 0) {
      const cmd = args[0] ?? 'unknown';
      const code = result.status ?? 'null';
      const detail = result.stderr?.trim();
      const message = detail
        ? `git ${cmd} failed (exit ${code}): ${detail}`
        : `git ${cmd} failed (exit ${code})`;

      throw new Error(message);
    }

    return result.stdout.trim();
  };
}

function makeLockFs(): LockFs {
  return {
    readFile: (path) => readFileSync(path, 'utf8'),
    writeFile: (path, content) => writeFileSync(path, content, 'utf8'),
    deleteFile: (path) => unlinkSync(path),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
  };
}

function makeProgressFs(): ProgressFs {
  return {
    readFile: (path) => readFileSync(path, 'utf8'),
    appendFile: (path, content) => appendFileSync(path, content, 'utf8'),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
  };
}

function makeCostFs(): CostFs {
  return {
    appendFile: (path, content) => appendFileSync(path, content, 'utf8'),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
  };
}

function makeQualityFs(): QualityFs {
  return {
    readFile: (path) => readFileSync(path, 'utf8'),
    writeFile: (path, content) => writeFileSync(path, content, 'utf8'),
    rename: (from, to) => renameSync(from, to),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
  };
}

function makeEnvFs(): EnvFileSystem {
  return {
    readFile: (path) => readFileSync(path, 'utf8'),
  };
}

// ─── Setup helpers ──────────────────────────────────────────────────────────

function parseTicketKey(): string {
  const key = process.argv[2];

  if (!key) {
    console.error('Usage: clancy-dev <ticket-key>');
    process.exit(2);
  }

  return key;
}

function loadEnv(projectRoot: string): {
  readonly envFs: EnvFileSystem;
  readonly boardConfig: BoardConfig;
} {
  const envFs = makeEnvFs();
  const env = loadClancyEnv(projectRoot, envFs);

  if (!env) {
    console.error('✗ No .clancy/.env found — run the installer first');
    process.exit(1);
  }

  const boardResult = detectBoard(env);

  if (typeof boardResult === 'string') {
    console.error(boardResult);
    return process.exit(1) as never;
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
  readonly ticketKey: string;
  readonly projectRoot: string;
  readonly model?: string;
}) {
  return () =>
    runReadinessGate({
      grade: () =>
        invokeReadinessGrade({
          rubric: opts.rubric,
          ticketId: opts.ticketKey,
          ticketTitle: opts.ticketKey,
          ticketDescription: '',
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

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const ticketKey = parseTicketKey();
  const projectRoot = process.cwd();
  const { envFs, boardConfig } = loadEnv(projectRoot);

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
    argv: process.argv.slice(3),
    isAfk: false,
    readinessGate: makeReadinessGate({
      rubric: loadRubric(),
      ticketKey,
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
