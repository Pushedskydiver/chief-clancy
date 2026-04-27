/**
 * Batch implement runner — execute approved plans from a directory.
 *
 * Lists plan files, filters by approval status, runs the pipeline
 * for each approved plan sequentially using {@link executeQueue},
 * and stops on first failure. Reports implemented/skipped/remaining.
 */
import type { EnvFileSystem, ExecGit } from '@chief-clancy/core';
import type {
  ConsoleLike,
  CostFs,
  ExecCmd,
  FetchFn,
  ListPlansFs,
  LockFs,
  LoopOutcome,
  PipelineDeps,
  PipelineResult,
  ProgressFs,
  QualityFs,
  RunContext,
  SpawnSyncFn,
  StreamingSpawnFn,
} from '@chief-clancy/dev';

import {
  buildPrompt,
  buildReworkPrompt,
  createContext,
  executeQueue,
  formatDuration,
  listPlanFiles,
} from '@chief-clancy/dev';

import { dim, green, red, yellow } from '../../shared/ansi.js';
import { buildPipelineDeps } from '../dep-factory.js';

// ─── Types ──────────────────────────────────────────────────────────────────

type RunPipelineFn = (
  ctx: RunContext,
  deps: PipelineDeps,
) => Promise<PipelineResult>;

/** Options for the batch implement runner. */
type BatchOpts = {
  readonly directory: string;
  readonly argv: readonly string[];
  readonly projectRoot: string;
  readonly exec: ExecGit;
  readonly execCmd: ExecCmd;
  readonly lockFs: LockFs;
  readonly progressFs: ProgressFs;
  readonly costFs: CostFs;
  readonly envFs: EnvFileSystem;
  readonly qualityFs: QualityFs;
  readonly spawn: SpawnSyncFn;
  readonly streamingSpawn: StreamingSpawnFn;
  readonly fetch: FetchFn;
  readonly runPipeline: RunPipelineFn;
  readonly console: ConsoleLike;
  readonly planFs: ListPlansFs;
  readonly now?: number;
  readonly clock?: () => number;
};

type SummaryCounts = {
  readonly processed: number;
  readonly skipped: number;
  readonly remaining: number;
  readonly isDryRun: boolean;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildSummaryLine(counts: SummaryCounts, elapsed: string): string {
  const label = counts.isDryRun ? 'previewed' : 'implemented';
  const parts = [
    green(`${counts.processed} ${label}`),
    counts.skipped > 0 ? yellow(`${counts.skipped} skipped`) : undefined,
    counts.remaining > 0 ? red(`${counts.remaining} remaining`) : undefined,
  ].filter((p): p is string => p !== undefined);

  return parts.join(dim(', ')) + dim(` (${elapsed})`);
}

function warnSkipped(out: ConsoleLike, slugs: readonly string[]): void {
  slugs.forEach((slug) =>
    out.log(yellow(`⏭ ${slug}`) + dim(' — not approved, skipping')),
  );
}

/** Batch halt — stop on error/abort but allow dry-run to continue. */
function batchHalt(result: PipelineResult) {
  if (
    result.status === 'completed' ||
    result.status === 'resumed' ||
    result.status === 'dry-run'
  ) {
    return { stop: false } as const;
  }
  return {
    stop: true,
    reason: result.error ?? `${result.status} at ${result.phase ?? 'unknown'}`,
  } as const;
}

// ─── Entry point ────────────────────────────────────────────────────────────

/**
 * Run batch implementation — execute approved plans from a directory.
 *
 * @param opts - Injected I/O resources and configuration.
 * @returns Resolves when all plans are processed or first failure.
 */
export async function runImplementBatch(opts: BatchOpts): Promise<void> {
  const clock = opts.clock ?? Date.now;
  const startTime = opts.now ?? clock();
  const { console: out } = opts;

  const allPlans = listPlanFiles(opts.directory, opts.planFs);

  if (allPlans.length === 0) {
    out.log(dim('No plan files found in ') + dim(opts.directory));
    return;
  }

  const approved = allPlans.filter((p) => p.approved);
  const skippedSlugs = allPlans.filter((p) => !p.approved).map((p) => p.slug);

  warnSkipped(out, skippedSlugs);

  if (approved.length === 0) {
    out.log(dim('No approved plans to implement.'));
    out.log('');
    out.log(
      buildSummaryLine(
        {
          processed: 0,
          skipped: skippedSlugs.length,
          remaining: 0,
          isDryRun: false,
        },
        formatDuration(clock() - startTime),
      ),
    );
    return;
  }

  out.log(
    dim(`Batch: ${approved.length} approved`) +
      (skippedSlugs.length > 0 ? dim(`, ${skippedSlugs.length} skipped`) : '') +
      dim('. Starting...'),
  );

  const pathBySlug = new Map(approved.map((p) => [p.slug, p.path] as const));

  const outcome = await executeQueue<PipelineResult>({
    queue: approved.map((p) => p.slug),
    run: (slug) => runOnePlan(opts, pathBySlug.get(slug)!),
    shouldHalt: batchHalt,
    sleep: () => Promise.resolve(),
    clock,
    console: out,
  });

  reportOutcome(out, outcome, {
    total: approved.length,
    skipped: skippedSlugs.length,
    elapsed: formatDuration(clock() - startTime),
  });
}

function reportOutcome(
  out: ConsoleLike,
  outcome: LoopOutcome<PipelineResult>,
  info: {
    readonly total: number;
    readonly skipped: number;
    readonly elapsed: string;
  },
): void {
  const processed = outcome.iterations.length - (outcome.haltedAt ? 1 : 0);
  const remaining = info.total - outcome.iterations.length;
  const isDryRun = outcome.iterations.every(
    (i) => i.result.status === 'dry-run',
  );

  if (outcome.haltedAt) {
    out.error(
      red(`✗ ${outcome.haltedAt.id} failed`) +
        dim(` — ${outcome.haltedAt.reason}`),
    );
  }

  out.log('');
  out.log(
    buildSummaryLine(
      { processed, skipped: info.skipped, remaining, isDryRun },
      info.elapsed,
    ),
  );
}

async function runOnePlan(
  opts: BatchOpts,
  planPath: string,
): Promise<PipelineResult> {
  const ctx = createContext({
    projectRoot: opts.projectRoot,
    argv: opts.argv,
    fromPath: planPath,
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
    streamingSpawn: opts.streamingSpawn,
    fetch: opts.fetch,
    buildPrompt,
    buildReworkPrompt,
  });

  return opts.runPipeline(ctx, deps);
}
