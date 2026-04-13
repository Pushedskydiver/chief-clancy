/**
 * Autopilot loop entry point — wire real Node.js I/O into executeQueue.
 *
 * This file is the entry point for the `clancy-dev-autopilot.js` bundle.
 * It fetches the ticket queue from the board, processes each ticket
 * sequentially through the pipeline, and reports results.
 *
 * Built by esbuild into a self-contained ESM bundle with zero npm deps.
 */
import type { AtomicFs } from '../artifacts/atomic-write/index.js';
import type { GradeOneFn } from '../artifacts/preflight-batch/index.js';
import type { GateResult } from '../execute/readiness/index.js';
import type { PipelineResult } from '../pipeline/index.js';
import type { LoopOutcome } from '../queue.js';
import type { ConsoleLike } from '../types/index.js';
import type { PreflightDecision } from './loop-preflight.js';
import type { EnvFileSystem, FetchedTicket } from '@chief-clancy/core';

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadRubric } from '../agents/rubric-loader.js';
import { writeDeferred } from '../artifacts/deferred/index.js';
import { writeDriftIfPossible } from '../artifacts/drift/index.js';
import { writeRunSummary } from '../artifacts/run-summary/index.js';
import { makeAtomicFs, makeExecGit } from './adapters.js';
import { runAndReport } from './loop-execute.js';
import { runPreflightIfNeeded } from './loop-preflight.js';
import {
  loadEnv,
  makeFetchQueue,
  makeGradeOneFn,
  makeReadinessGate,
  makeTimestamp,
  mergeEnv,
  resolveBuildLabelFromEnv,
} from './loop-setup.js';

export { resolveBuildLabelFromEnv };

// ─── Types ──────────────────────────────────────────────────────────────────

type LoopArgs = {
  readonly isAfk: boolean;
  readonly isAfkStrict: boolean;
  readonly maxIterations: number | undefined;
  readonly bypassReadiness: boolean;
  readonly maxBatch: number | undefined;
  readonly resume: boolean;
  readonly yes: boolean;
  readonly passthroughArgv: readonly string[];
};

type RunAndReportOpts = Parameters<typeof runAndReport>[0];

/**
 * Dependencies injected into the loop orchestrator.
 *
 * Production: `main()` wires real Node.js I/O.
 * Tests: inject mocks at I/O boundaries.
 */
type LoopDeps = {
  readonly loopArgs: LoopArgs;
  readonly projectRoot: string;
  readonly env: Record<string, string | undefined>;
  readonly envFs: EnvFileSystem;
  readonly model?: string;
  readonly fetchQueue: (
    limit: number | undefined,
  ) => Promise<readonly FetchedTicket[]>;
  readonly rubric: string | undefined;
  readonly gradeOne: GradeOneFn;
  readonly readinessGate: ((ticket: FetchedTicket) => GateResult) | undefined;
  readonly execute: (
    opts: RunAndReportOpts,
  ) => Promise<LoopOutcome<PipelineResult>>;
  readonly fs: AtomicFs;
  readonly readFile: (path: string) => string;
  readonly timestamp: () => string;
  readonly console: ConsoleLike;
  /** Run a git command and return stdout. Used for drift detection. */
  readonly exec: (args: readonly string[]) => string;
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
  '--afk-strict',
  '--bypass-readiness',
  '--resume',
  '--yes',
]);
const isLoopFlag = (a: string) =>
  LOOP_FLAGS.has(a) || a.startsWith('--max=') || a.startsWith('--max-batch=');

export function parseLoopArgs(argv: readonly string[]): LoopArgs {
  const args = argv.slice(2);

  const isAfkStrict = args.includes('--afk-strict');

  return {
    isAfk: args.includes('--afk') || isAfkStrict,
    isAfkStrict,
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

// ─── Loop orchestrator (testable) ──────────────────────────────────────────

const DEFAULT_BATCH_CAP = 50;

function captureHead(exec: (args: readonly string[]) => string): string {
  try {
    return exec(['rev-parse', 'HEAD']).trim();
  } catch {
    return 'HEAD';
  }
}

function resolveMode(loopArgs: LoopArgs): 'interactive' | 'afk' | 'afk-strict' {
  if (loopArgs.isAfkStrict) return 'afk-strict';
  if (loopArgs.isAfk) return 'afk';
  return 'interactive';
}

function filterQueueByDecision(
  tickets: readonly FetchedTicket[],
  decision: PreflightDecision,
): readonly FetchedTicket[] {
  if (decision.action !== 'proceed') return tickets;
  const allowed = new Set(decision.greenIds);
  return tickets.filter((t) => allowed.has(t.key));
}

function writeDeferredIfNeeded(
  decision: PreflightDecision,
  fs: AtomicFs,
  dir: string,
): void {
  if (decision.action !== 'proceed' || decision.deferred.length === 0) return;
  writeDeferred({
    fs,
    dir,
    deferred: decision.deferred.map((v) => ({
      ticketId: v.ticketId,
      overall: v.overall,
      reason: v.checks
        .filter((c) => c.verdict === 'yellow')
        .map((c) => c.reason)
        .join('; '),
    })),
  });
}

function writePostExecutionArtifacts(opts: {
  readonly deps: LoopDeps;
  readonly devDir: string;
  readonly outcome: LoopOutcome<PipelineResult>;
  readonly totalQueued: number;
  readonly decision: PreflightDecision;
  readonly baseSha: string;
}): void {
  writeRunSummary({
    fs: opts.deps.fs,
    dir: opts.devDir,
    outcome: opts.outcome,
    totalQueued: opts.totalQueued,
    mode: resolveMode(opts.deps.loopArgs),
    timestamp: opts.deps.timestamp,
  });

  if (opts.decision.action === 'proceed') {
    // Filter to executed tickets only — deferred yellows should not
    // appear in drift predictions since they were intentionally skipped.
    const executedIds = new Set(opts.outcome.iterations.map((i) => i.id));
    const executedVerdicts = opts.decision.allVerdicts.filter((v) =>
      executedIds.has(v.ticketId),
    );
    writeDriftIfPossible({
      verdicts: executedVerdicts,
      exec: opts.deps.exec,
      fs: opts.deps.fs,
      dir: opts.devDir,
      baseSha: opts.baseSha,
      console: opts.deps.console,
    });
  }
}

/**
 * Core loop orchestration — fetch queue, run preflight, execute, write artifacts.
 *
 * Exported for acceptance testing. Production code calls this via `main()`.
 */
export async function runLoop(deps: LoopDeps): Promise<void> {
  const { loopArgs, projectRoot } = deps;

  const tickets = await deps.fetchQueue(loopArgs.maxIterations);
  if (tickets.length === 0) {
    deps.console.log('No tickets in the build queue. Nothing to do.');
    return;
  }
  deps.console.log(`Found ${tickets.length} ticket(s) in the build queue.`);

  const ticketMap = new Map(tickets.map((t) => [t.key, t]));
  const devDir = join(projectRoot, '.clancy', 'dev');

  const decision = runPreflightIfNeeded({
    shouldRun: loopArgs.isAfk && !!deps.rubric && !loopArgs.bypassReadiness,
    isAfkStrict: loopArgs.isAfkStrict,
    tickets,
    gradeOne: deps.gradeOne,
    fs: deps.fs,
    dir: devDir,
    maxBatch: loopArgs.maxBatch ?? DEFAULT_BATCH_CAP,
    resume: loopArgs.resume,
    timestamp: deps.timestamp,
    console: deps.console,
    readFile: deps.readFile,
  });
  if (decision.action === 'halt') return;

  writeDeferredIfNeeded(decision, deps.fs, devDir);

  // Capture HEAD before execution so drift can diff against the baseline
  const baseSha = captureHead(deps.exec);

  const outcome = await deps.execute({
    tickets: filterQueueByDecision(tickets, decision),
    ticketMap,
    projectRoot,
    envFs: deps.envFs,
    loopArgs,
    readinessGate: deps.readinessGate,
    env: deps.env,
  });

  // totalQueued = full board queue count (before filtering).
  // totalProcessed (inside run-summary) = actually executed count.
  writePostExecutionArtifacts({
    deps,
    devDir,
    outcome,
    totalQueued: tickets.length,
    decision,
    baseSha,
  });
}

// ─── Main (I/O wiring) ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const loopArgs = parseLoopArgs(process.argv);
  const projectRoot = process.cwd();
  const envResult = loadEnv(projectRoot);
  if (!envResult) return;
  const { envFs, boardConfig, rawEnv } = envResult;
  const env = mergeEnv(rawEnv);

  const rubric = loopArgs.bypassReadiness ? undefined : loadRubric();
  const model = boardConfig.env.CLANCY_MODEL;

  // Shared mutable state between fetchQueue and gradeOne closures.
  // Uses an object wrapper to satisfy functional/no-let while allowing
  // fetchQueue to populate the map that gradeOne reads.
  const shared: { ticketMap: ReadonlyMap<string, FetchedTicket> } = {
    ticketMap: new Map(),
  };
  const fetchQueue = async (limit: number | undefined) => {
    const tickets = await makeFetchQueue(boardConfig)(limit);
    // eslint-disable-next-line functional/immutable-data -- populated once by fetchQueue, read by gradeOne
    shared.ticketMap = new Map(tickets.map((t) => [t.key, t]));
    return tickets;
  };

  const gradeOne: GradeOneFn = rubric
    ? (ticketId) =>
        makeGradeOneFn({
          ticketMap: shared.ticketMap,
          rubric,
          projectRoot,
          model,
        })(ticketId)
    : () => ({ ok: false as const, error: 'No rubric loaded' });

  const readinessGate =
    rubric && !loopArgs.bypassReadiness
      ? makeReadinessGate({ rubric, projectRoot, model })
      : undefined;

  await runLoop({
    loopArgs,
    projectRoot,
    env,
    envFs,
    model,
    fetchQueue,
    rubric,
    gradeOne,
    readinessGate,
    execute: runAndReport,
    fs: makeAtomicFs(),
    readFile: (p) => readFileSync(p, 'utf8'),
    timestamp: makeTimestamp,
    console,
    exec: makeExecGit(projectRoot),
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
