/**
 * Loop execution helpers — build the per-ticket runner, execute the
 * queue, display results, and send notifications.
 */
import type { GateResult } from '../execute/readiness/readiness-gate.js';
import type { PipelineResult } from '../pipeline/run-pipeline.js';
import type { LoopOutcome } from '../queue.js';
import type { EnvFileSystem, FetchedTicket } from '@chief-clancy/core';

import { spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

import { buildPipelineDeps } from '../dep-factory/dep-factory.js';
import { runSingleTicketByKey } from '../execute/single.js';
import { runPipeline } from '../pipeline/run-pipeline.js';
import { buildPrompt, buildReworkPrompt } from '../prompt-builder.js';
import { executeQueue } from '../queue.js';
import { checkStopCondition } from '../stop-condition.js';
import {
  makeCostFs,
  makeExecCmd,
  makeExecGit,
  makeLockFs,
  makeProgressFs,
  makeQualityFs,
} from './adapters.js';
import { displayOutcome, notifyIfConfigured } from './loop-output.js';

// ─── Types ─────────────────────────────────────────────────────────────────

type LoopArgs = {
  readonly isAfk: boolean;
  readonly isAfkStrict: boolean;
  readonly bypassReadiness: boolean;
  readonly maxIterations: number | undefined;
  readonly passthroughArgv: readonly string[];
};

type RunAndReportOpts = {
  readonly tickets: readonly FetchedTicket[];
  readonly ticketMap: ReadonlyMap<string, FetchedTicket>;
  readonly projectRoot: string;
  readonly envFs: EnvFileSystem;
  readonly loopArgs: LoopArgs;
  readonly readinessGate: ((ticket: FetchedTicket) => GateResult) | undefined;
  readonly env: Record<string, string | undefined>;
};

// ─── Run-ticket closure factory ────────────────────────────────────────────

function buildRunTicket(
  opts: Omit<RunAndReportOpts, 'tickets' | 'env'>,
): (ticketId: string) => Promise<PipelineResult> {
  return async (ticketId) => {
    console.log(`\n── Processing ${ticketId} ──`);

    const pipelineDeps = buildPipelineDeps({
      projectRoot: opts.projectRoot,
      exec: makeExecGit(opts.projectRoot),
      execCmd: makeExecCmd(opts.projectRoot),
      lockFs: makeLockFs(),
      progressFs: makeProgressFs(),
      costFs: makeCostFs(),
      envFs: opts.envFs,
      qualityFs: makeQualityFs(),
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
      argv: opts.loopArgs.bypassReadiness
        ? ['--bypass-readiness', ...opts.loopArgs.passthroughArgv]
        : opts.loopArgs.passthroughArgv,
      isAfk: opts.loopArgs.isAfk,
      readinessGate: opts.readinessGate,
    });
  };
}

// ─── Execute + report ──────────────────────────────────────────────────────

/** Execute the queue, display results, and send webhook notification. */
async function runAndReport(
  opts: RunAndReportOpts,
): Promise<LoopOutcome<PipelineResult>> {
  const run = buildRunTicket(opts);

  const outcome = await executeQueue({
    queue: opts.tickets.map((t) => t.key),
    run,
    shouldHalt: checkStopCondition,
    maxIterations: opts.loopArgs.maxIterations,
    quietStart: opts.env.CLANCY_QUIET_START,
    quietEnd: opts.env.CLANCY_QUIET_END,
    sleep: (ms) => sleep(ms),
    clock: Date.now,
    console,
  });

  displayOutcome(outcome, opts.tickets.length);
  await notifyIfConfigured(
    opts.env.CLANCY_NOTIFY_WEBHOOK,
    outcome,
    opts.tickets.length,
  );

  return outcome;
}

// ─── Exports ───────────────────────────────────────────────────────────────

export { runAndReport };
