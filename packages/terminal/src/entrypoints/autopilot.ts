/**
 * Autopilot runtime entry point — wire real Node.js I/O into runAutopilot.
 *
 * This file is the entry point for the `clancy-autopilot.js` bundle.
 * Substantially more wiring than the implement entry point: env var
 * parsing, iteration closure (full runImplement call per iteration),
 * session report generation, webhook notifications, and quiet hours.
 *
 * Built by esbuild into a self-contained ESM bundle with zero npm deps.
 */
import type { EnvFileSystem, ExecGit } from '@chief-clancy/core';
import type {
  ConsoleLike,
  CostFs,
  ExecCmd,
  FetchFn,
  LockFs,
  PipelineDeps,
  PipelineResult,
  ProgressFs,
  QualityFs,
  RunContext,
  SpawnSyncFn,
} from '@chief-clancy/dev';

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import {
  buildPrompt,
  buildReworkPrompt,
  createContext,
  runPipeline,
  sendNotification,
} from '@chief-clancy/dev';

import { runAutopilot } from '../runner/autopilot.js';
import { buildPipelineDeps } from '../runner/dep-factory.js';
import { buildSessionReport } from '../runner/session-report.js';
import {
  makeCostFs,
  makeEnvFs,
  makeExecCmd,
  makeExecGit,
  makeLockFs,
  makeProgressFs,
  makeQualityFs,
} from './implement.js';

// ─── Types ──────────────────────────────────────────────────────────────────

type RunPipelineFn = (
  ctx: RunContext,
  deps: PipelineDeps,
) => Promise<PipelineResult>;

type IterationOpts = {
  readonly projectRoot: string;
  readonly exec: ExecGit;
  readonly execCmd: ExecCmd;
  readonly lockFs: LockFs;
  readonly progressFs: ProgressFs;
  readonly costFs: CostFs;
  readonly envFs: EnvFileSystem;
  readonly qualityFs: QualityFs;
  readonly spawn: SpawnSyncFn;
  readonly fetch: FetchFn;
  readonly runPipeline: RunPipelineFn;
  readonly argv: readonly string[];
};

type ReportFactoryOpts = {
  readonly progressFs: ProgressFs;
  readonly qualityFs: QualityFs;
  readonly projectRoot: string;
  readonly console: ConsoleLike;
  readonly readCostsFile: (path: string) => string;
  readonly writeFile: (path: string, content: string) => void;
  readonly mkdir: (path: string) => void;
  readonly buildSessionReport: typeof buildSessionReport;
};

type SendNotificationFn = typeof sendNotification;

// ─── Env var parsing ────────────────────────────────────────────────────────

const DEFAULT_MAX_ITERATIONS = 5;

/**
 * Parse MAX_ITERATIONS from an env var string.
 *
 * Returns the default (5) for missing, empty, non-numeric, zero,
 * or negative values. Floors decimals.
 *
 * @param value - The raw env var value (may be undefined).
 * @returns A positive integer for the iteration cap.
 */
export function parseMaxIterations(value: string | undefined): number {
  if (!value) return DEFAULT_MAX_ITERATIONS;

  const parsed = Math.floor(Number(value));
  return parsed > 0 ? parsed : DEFAULT_MAX_ITERATIONS;
}

// ─── Closure factories ──────────────────────────────────────────────────────

/**
 * Build the `runIteration` closure for autopilot.
 *
 * Each call constructs a fresh context and deps, runs the pipeline,
 * and returns the result. Uses `isAfk: true` since autopilot is
 * unattended mode.
 *
 * @param opts - Shared I/O resources for the pipeline.
 * @returns An async function that runs one implement iteration.
 */
export function buildRunIteration(
  opts: IterationOpts,
): () => Promise<PipelineResult> {
  return async () => {
    const ctx = createContext({
      projectRoot: opts.projectRoot,
      argv: opts.argv,
      isAfk: true,
    });

    const deps = buildPipelineDeps({
      projectRoot: opts.projectRoot,
      exec: opts.exec,
      execCmd: opts.execCmd,
      lockFs: opts.lockFs,
      progressFs: opts.progressFs,
      costFs: opts.costFs,
      envFs: opts.envFs,
      qualityFs: opts.qualityFs,
      spawn: opts.spawn,
      fetch: opts.fetch,
      buildPrompt,
      buildReworkPrompt,
    });

    return opts.runPipeline(ctx, deps);
  };
}

/**
 * Build the `buildReport` closure for autopilot.
 *
 * Captures all I/O resources and delegates to `buildSessionReport`
 * with the loop timing parameters.
 *
 * @param opts - Shared I/O resources for report generation.
 * @returns A function that generates a session report markdown string.
 */
export function buildReportFactory(
  opts: ReportFactoryOpts,
): (loopStartTime: number, loopEndTime: number) => string {
  return (loopStartTime, loopEndTime) =>
    opts.buildSessionReport({
      progressFs: opts.progressFs,
      qualityFs: opts.qualityFs,
      readCostsFile: opts.readCostsFile,
      writeFile: opts.writeFile,
      mkdir: opts.mkdir,
      console: opts.console,
      projectRoot: opts.projectRoot,
      loopStartTime,
      loopEndTime,
    });
}

/**
 * Build the `sendNotification` closure for autopilot.
 *
 * Captures the fetch function and delegates to the notify module.
 *
 * @param fetchFn - The fetch implementation to use.
 * @param send - The notification sender (injected for testability).
 * @returns An async function matching AutopilotOpts.sendNotification.
 */
export function buildNotify(
  fetchFn: FetchFn,
  send: SendNotificationFn = sendNotification,
): (url: string, message: string) => Promise<void> {
  return (url, message) => send({ webhookUrl: url, message, fetch: fetchFn });
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const env = process.env;

  const exec = makeExecGit(projectRoot);
  const execCmd = makeExecCmd(projectRoot);
  const lockFs = makeLockFs();
  const progressFs = makeProgressFs();
  const costFs = makeCostFs();
  const envFs = makeEnvFs();
  const qualityFs = makeQualityFs();
  const fetchFn: FetchFn = globalThis.fetch.bind(globalThis);
  const spawnFn: SpawnSyncFn = (cmd, args, opts) =>
    spawnSync(cmd, [...args], { ...opts, stdio: [...opts.stdio] });

  await runAutopilot({
    maxIterations: parseMaxIterations(env.MAX_ITERATIONS),

    runIteration: buildRunIteration({
      projectRoot,
      exec,
      execCmd,
      lockFs,
      progressFs,
      costFs,
      envFs,
      qualityFs,
      spawn: spawnFn,
      fetch: fetchFn,
      runPipeline,
      argv: process.argv,
    }),

    buildReport: buildReportFactory({
      progressFs,
      qualityFs,
      projectRoot,
      console,
      readCostsFile: (path) => readFileSync(path, 'utf8'),
      writeFile: (path, content) => writeFileSync(path, content, 'utf8'),
      mkdir: (path) => mkdirSync(path, { recursive: true }),
      buildSessionReport,
    }),

    sendNotification: buildNotify(fetchFn),
    sleep: (ms) => sleep(ms),
    console,
    clock: Date.now,
    quietStart: env.CLANCY_QUIET_START,
    quietEnd: env.CLANCY_QUIET_END,
    webhookUrl: env.CLANCY_NOTIFY_WEBHOOK,
  });
}

// Main guard — self-execute when run directly (e.g. node .clancy/clancy-autopilot.js)
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
  });
}
