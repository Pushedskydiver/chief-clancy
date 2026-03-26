/**
 * Once entry point — parse args, create context, run pipeline, display result.
 *
 * Thin orchestration layer over the core pipeline. All business logic
 * lives in core phases; this module wires dependencies and formats output.
 * All exit paths use exit code 0 — the AFK runner detects stop conditions
 * by parsing stdout, not exit codes.
 */
import type {
  CostFs,
  EnvFileSystem,
  ExecGit,
  FetchFn,
  LockFs,
  PipelineDeps,
  PipelineResult,
  ProgressFs,
  QualityFs,
  RunContext,
} from '@chief-clancy/core';
import type { SpawnSyncReturns } from 'node:child_process';

import { createContext, formatDuration } from '@chief-clancy/core';

import { dim, green, red } from '../../shared/ansi/index.js';
import { buildPipelineDeps } from '../dep-factory/index.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type SpawnSyncFn = (
  command: string,
  args: readonly string[],
  options: {
    readonly input: string;
    readonly stdio: readonly (string | number)[];
    readonly encoding: 'utf8';
  },
) => SpawnSyncReturns<string>;

type ConsoleLike = {
  readonly log: (message: string) => void;
  readonly error: (message: string) => void;
};

type RunPipelineFn = (
  ctx: RunContext,
  deps: PipelineDeps,
) => Promise<PipelineResult>;

/** Options for running the once orchestrator. */
type OnceOpts = {
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
 * Run the once orchestrator — full ticket lifecycle.
 *
 * @param opts - Injected I/O resources and configuration.
 * @returns Resolves when the pipeline run and result display are complete.
 */
export async function runOnce(opts: OnceOpts): Promise<void> {
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
  });

  const result = await opts.runPipeline(ctx, deps);

  const clock = opts.clock ?? Date.now;
  displayResult(result, ctx.startTime, { out: opts.console, clock });
}
