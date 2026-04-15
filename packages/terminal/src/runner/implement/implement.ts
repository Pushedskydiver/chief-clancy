/**
 * Implement entry point — parse args, create context, run pipeline, display result.
 *
 * Thin orchestration layer over the core pipeline. All business logic
 * lives in core phases; this module wires dependencies and formats output.
 * All exit paths use exit code 0 — the autopilot runner detects stop
 * conditions by parsing stdout, not exit codes.
 */
import type { EnvFileSystem, ExecGit } from '@chief-clancy/core';
import type {
  ConsoleLike,
  CostFs,
  FetchFn,
  LockFs,
  PipelineDeps,
  PipelineResult,
  ProgressFs,
  QualityFs,
  RunContext,
  SpawnSyncFn,
} from '@chief-clancy/dev';

import {
  buildPrompt,
  buildReworkPrompt,
  createContext,
  formatDuration,
} from '@chief-clancy/dev';

import { dim, green, red } from '../../shared/ansi/ansi.js';
import { buildPipelineDeps } from '../dep-factory/index.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type RunPipelineFn = (
  ctx: RunContext,
  deps: PipelineDeps,
) => Promise<PipelineResult>;

/** Options for running the implement orchestrator. */
type ImplementOpts = {
  readonly argv: readonly string[];
  readonly projectRoot: string;
  readonly isAfk: boolean;
  readonly exec: ExecGit;
  readonly lockFs: LockFs;
  readonly progressFs: ProgressFs;
  readonly costFs: CostFs;
  readonly envFs: EnvFileSystem;
  readonly qualityFs: QualityFs;
  readonly spawn: SpawnSyncFn;
  readonly fetch: FetchFn;
  readonly runPipeline: RunPipelineFn;
  readonly console: ConsoleLike;
  readonly now?: number;
  readonly clock?: () => number;
};

// ─── Display ─────────────────────────────────────────────────────────────────

function displayResult(
  result: PipelineResult,
  startTime: number,
  io: { readonly out: ConsoleLike; readonly clock: () => number },
): void {
  const elapsed = formatDuration(io.clock() - startTime);

  const { out } = io;

  switch (result.status) {
    case 'completed':
      out.log(green('✅ Ticket completed') + dim(` (${elapsed})`));
      break;

    case 'aborted':
      out.log(
        dim(`⏹ Pipeline aborted at ${result.phase ?? 'unknown'}`) +
          dim(` (${elapsed})`),
      );
      break;

    case 'resumed':
      out.log(dim(`↩ Resumed previous session`) + dim(` (${elapsed})`));
      break;

    case 'dry-run':
      out.log(dim(`🏁 Dry run complete`) + dim(` (${elapsed})`));
      break;

    case 'error':
      out.error(red('❌ Clancy stopped') + dim(` (${elapsed})`));
      out.error(red(`   ${result.error ?? 'Unknown error'}`));
      break;

    default: {
      const _exhaustive: never = result.status;
      return _exhaustive;
    }
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * Implement a single ticket — full lifecycle from pickup to PR delivery.
 *
 * @param opts - Injected I/O resources and configuration.
 * @returns Resolves when the pipeline run and result display are complete.
 */
export async function runImplement(opts: ImplementOpts): Promise<void> {
  const ctx = createContext({
    projectRoot: opts.projectRoot,
    argv: opts.argv,
    isAfk: opts.isAfk,
    now: opts.now,
  });

  const deps = buildPipelineDeps({
    projectRoot: opts.projectRoot,
    exec: opts.exec,
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

  const result = await opts.runPipeline(ctx, deps);

  const clock = opts.clock ?? Date.now;
  displayResult(result, ctx.startTime, { out: opts.console, clock });
}
