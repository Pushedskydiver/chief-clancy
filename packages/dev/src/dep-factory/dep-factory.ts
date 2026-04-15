/**
 * Dep factory — wire all PipelineDeps fields.
 *
 * Single entry point that takes shared I/O resources and returns
 * fully wired {@link PipelineDeps}. Each field is a closure that
 * captures the shared resources and delegates to the corresponding
 * core phase function.
 */
import type { CostFs } from '../lifecycle/cost/cost.js';
import type { LockFs } from '../lifecycle/lock/lock.js';
import type { FetchFn } from '../lifecycle/pr-creation/pr-creation.js';
import type {
  ProgressEntry,
  ProgressFs,
} from '../lifecycle/progress/progress.js';
import type { QualityFs } from '../lifecycle/quality/quality.js';
import type { RunContext } from '../pipeline/context.js';
import type { PipelineDeps } from '../pipeline/run-pipeline.js';
import type { AppendFn } from '../types/progress.js';
import type { SpawnSyncFn } from '../types/spawn.js';
import type { InvokePhaseDeps } from './invoke-phase.js';
import type {
  Board,
  BoardProvider,
  EnvFileSystem,
  ExecGit,
  FetchedTicket,
  RemoteInfo,
} from '@chief-clancy/core';

import {
  checkout,
  detectRemote,
  ensureBranch,
  fetchRemoteBranch,
  currentBranch as gitCurrentBranch,
} from '@chief-clancy/core';

import { invokeClaudePrint } from '../cli-bridge/cli-bridge.js';
import {
  computeTargetBranch,
  computeTicketBranch,
} from '../lifecycle/branch/branch.js';
import { resolveCommitType } from '../lifecycle/commit-type/commit-type.js';
import { appendCostEntry } from '../lifecycle/cost/cost.js';
import { deliverEpicToBase } from '../lifecycle/deliver-epic/deliver-epic.js';
import { ensureEpicBranch } from '../lifecycle/epic/epic.js';
import { checkFeasibility } from '../lifecycle/feasibility/feasibility.js';
import {
  deleteLock,
  deleteVerifyAttempt,
  readLock,
  writeLock,
} from '../lifecycle/lock/lock.js';
import { attemptPrCreation } from '../lifecycle/pr-creation/pr-creation.js';
import {
  appendProgress,
  countReworkCycles,
  findEntriesWithStatus,
} from '../lifecycle/progress/progress.js';
import { buildPrBody } from '../lifecycle/pull-request/pr-body/pr-body.js';
import { detectResume, executeResume } from '../lifecycle/resume/resume.js';
import { resolvePlatformHandlers } from '../lifecycle/rework/rework-handlers.js';
import { fetchReworkFromPrReview } from '../lifecycle/rework/rework.js';
import { sendNotification } from '../notify/notify.js';
import { branchSetup } from '../pipeline/phases/branch-setup/branch-setup.js';
import { cleanupPhase } from '../pipeline/phases/cleanup-phase/cleanup-phase.js';
import { costPhase } from '../pipeline/phases/cost-phase/cost-phase.js';
import { epicCompletion } from '../pipeline/phases/epic-completion/epic-completion.js';
import { feasibilityPhase } from '../pipeline/phases/feasibility/feasibility.js';
import { lockCheck } from '../pipeline/phases/lock-check/lock-check.js';
import { prRetry } from '../pipeline/phases/pr-retry/pr-retry.js';
import { reworkDetection } from '../pipeline/phases/rework-detection/rework-detection.js';
import { ticketFetch } from '../pipeline/phases/ticket-fetch/ticket-fetch.js';
import { transition } from '../pipeline/phases/transition/transition.js';
import { wireDeliver } from './deliver-phase.js';
import { makeInvokePhase } from './invoke-phase.js';
import { localTicketSeed, wirePreflight } from './local-wiring.js';

/** Options for building the pipeline dependency object. */
type DepFactoryOpts = {
  readonly projectRoot: string;
  readonly exec: ExecGit;
  readonly lockFs: LockFs;
  readonly progressFs: ProgressFs;
  readonly costFs: CostFs;
  readonly envFs: EnvFileSystem;
  readonly qualityFs: QualityFs;
  readonly spawn: SpawnSyncFn;
  readonly fetch: FetchFn;
  readonly buildPrompt: InvokePhaseDeps['buildPrompt'];
  readonly buildReworkPrompt: InvokePhaseDeps['buildReworkPrompt'];
};

function makeAppendProgress(
  progressFs: ProgressFs,
  projectRoot: string,
): AppendFn {
  return (opts) => appendProgress(progressFs, projectRoot, opts);
}

/** Default build-queue label when no env var is configured. */
const DEFAULT_BUILD_LABEL = 'clancy:build';

/**
 * Resolve the build label: CLANCY_LABEL_BUILD → CLANCY_LABEL → default.
 *
 * @param ctx - Pipeline context (config may be undefined before preflight).
 * @returns The resolved build label string.
 */
export function resolveBuildLabel(ctx: RunContext): string {
  const env = ctx.config?.env;
  return env?.CLANCY_LABEL_BUILD ?? env?.CLANCY_LABEL ?? DEFAULT_BUILD_LABEL;
}

function hasParent(
  entry: ProgressEntry,
): entry is ProgressEntry & { readonly parent: string } {
  return entry.parent !== undefined;
}

function makeFindCompletedEpics(progressFs: ProgressFs, projectRoot: string) {
  return (): ReadonlyMap<string, string> => {
    const entries = findEntriesWithStatus(progressFs, projectRoot, 'DONE');
    const pairs = entries
      .filter(hasParent)
      .map((e) => [e.parent, e.key] as const);
    return new Map(pairs);
  };
}

function makeRetryEntry(fetchFn: FetchFn) {
  return async (entry: ProgressEntry, remote: RemoteInfo, ctx: RunContext) => {
    // Safe: prRetry runs after preflight, which sets config
    const config = ctx.config!;
    const baseBranch = config.env.CLANCY_BASE_BRANCH ?? 'main';
    const parent = hasParent(entry) ? entry.parent : undefined;

    const ticketBranch = computeTicketBranch(config.provider, entry.key);
    const targetBranch = computeTargetBranch(
      config.provider,
      baseBranch,
      parent,
    );

    const commitType = resolveCommitType(entry.ticketType);
    const prTitle = `${commitType}(${entry.key}): ${entry.summary}`;
    // Retry uses summary as description — full ticket data unavailable from progress
    const prBody = buildPrBody({
      config,
      ticket: {
        key: entry.key,
        title: entry.summary,
        description: entry.summary,
        provider: config.provider,
      },
      targetBranch,
    });

    return attemptPrCreation({
      fetchFn,
      env: config.env,
      remote,
      sourceBranch: ticketBranch,
      targetBranch,
      title: prTitle,
      body: prBody,
    });
  };
}

function wireEarlyPhases(opts: DepFactoryOpts, progress: AppendFn) {
  const { projectRoot, exec, lockFs, progressFs } = opts;

  return {
    lockCheck: (ctx: RunContext) =>
      lockCheck(ctx, {
        lockFs,
        exec,
        progressFs,
        detectResume: (resumeOpts) => detectResume(resumeOpts),
        executeResume: (resumeOpts) => executeResume(resumeOpts),
      }),

    preflight: wirePreflight({
      envFs: opts.envFs,
      projectRoot,
      exec,
      fetch: opts.fetch,
    }),

    epicCompletion: (ctx: RunContext) =>
      epicCompletion(ctx, {
        findCompletedEpics: makeFindCompletedEpics(progressFs, projectRoot),
        deliverEpicToBase: (epicOpts) =>
          deliverEpicToBase({
            ...epicOpts,
            exec,
            fetchFn: opts.fetch,
            progressFs,
            projectRoot,
            // Safe: epicCompletion runs after preflight, which sets config
            config: epicOpts.config!,
          }),
      }),

    prRetry: (ctx: RunContext) =>
      prRetry(ctx, {
        findRetryable: () =>
          findEntriesWithStatus(progressFs, projectRoot, 'PUSHED'),
        detectRemote: () => detectRemote(exec),
        retryEntry: makeRetryEntry(opts.fetch),
        appendProgress: progress,
      }),
  };
}

function wireTicketPhases(opts: DepFactoryOpts, progress: AppendFn) {
  const { projectRoot, exec, progressFs, spawn, fetch: fetchFn } = opts;
  return {
    reworkDetection: (ctx: RunContext) =>
      reworkDetection(ctx, {
        fetchRework: async (config) => {
          const remote = detectRemote(exec);
          const handlers = resolvePlatformHandlers({
            fetchFn,
            env: config.env,
            remote,
          });
          if (!handlers) return undefined;
          return fetchReworkFromPrReview({
            progressFs,
            projectRoot,
            provider: config.provider,
            handlers,
          });
        },
      }),

    ticketFetch: async (ctx: RunContext) => {
      if (ctx.fromPath) localTicketSeed(ctx, ctx.fromPath, opts.envFs.readFile);
      return ticketFetch(ctx, {
        fetchTicket: (board: Board) =>
          board.fetchTicket({ buildLabel: resolveBuildLabel(ctx) }),
        countReworkCycles: (key: string) =>
          countReworkCycles(progressFs, projectRoot, key),
        appendProgress: progress,
        computeTicketBranch: (provider: BoardProvider, key: string) =>
          computeTicketBranch(provider, key),
        computeTargetBranch: (p: BoardProvider, b: string, par?: string) =>
          computeTargetBranch(p, b, par),
      });
    },
    feasibility: (ctx: RunContext) =>
      feasibilityPhase(ctx, {
        checkFeasibility: (ticket, model) => {
          const result = checkFeasibility(
            (prompt) => invokeClaudePrint({ prompt, model, spawn }),
            ticket,
            model,
          );
          return Promise.resolve(result);
        },
        appendProgress: progress,
      }),
  };
}

function wireGitAndInvoke(opts: DepFactoryOpts) {
  const { projectRoot, exec, lockFs, spawn } = opts;

  return {
    branchSetup: (ctx: RunContext) =>
      branchSetup(ctx, {
        currentBranch: () => gitCurrentBranch(exec),
        checkout: (branch, create) => checkout(exec, branch, create),
        fetchRemoteBranch: (branch) => fetchRemoteBranch(exec, branch),
        ensureBranch: (branch, baseBranch) =>
          ensureBranch(exec, branch, baseBranch),
        ensureEpicBranch: (epicBranch, baseBranch) =>
          ensureEpicBranch({ exec, epicBranch, baseBranch }),
        fetchChildrenStatus: (ticket: FetchedTicket) =>
          // Safe: branchSetup runs after preflight, which sets board
          ctx.board!.fetchChildrenStatus(ticket.key, ticket.issueId),
        writeLock: (data) =>
          writeLock(lockFs, projectRoot, { ...data, pid: process.pid }),
      }),

    transition: (ctx: RunContext) =>
      transition(ctx, {
        transitionTicket: (ticket, status) =>
          // Safe: transition runs after preflight, which sets board
          ctx.board!.transitionTicket(ticket, status),
      }),

    invoke: makeInvokePhase({
      spawn,
      buildPrompt: opts.buildPrompt,
      buildReworkPrompt: opts.buildReworkPrompt,
    }),
  };
}

function wireFinalization(opts: DepFactoryOpts) {
  const { projectRoot, exec, lockFs, costFs, fetch: fetchFn } = opts;

  return {
    cost: (ctx: RunContext) =>
      costPhase(ctx, {
        readLock: () => readLock(lockFs, projectRoot),
        appendCostEntry: (args) =>
          appendCostEntry(costFs, projectRoot, { ...args, now: Date.now() }),
      }),

    cleanup: (ctx: RunContext) =>
      cleanupPhase(ctx, {
        notify: (webhook, message) =>
          sendNotification({ webhookUrl: webhook, message, fetch: fetchFn }),
      }),

    checkout: (branch: string) => checkout(exec, branch),

    deleteLock: () => deleteLock(lockFs, projectRoot),

    deleteVerifyAttempt: () => deleteVerifyAttempt(lockFs, projectRoot),
  };
}

/**
 * Build the complete PipelineDeps object from shared I/O resources.
 *
 * @param opts - Shared I/O resources for all phases.
 * @returns Fully wired pipeline dependencies.
 */
export function buildPipelineDeps(opts: DepFactoryOpts): PipelineDeps {
  const progress = makeAppendProgress(opts.progressFs, opts.projectRoot);

  return {
    ...wireEarlyPhases(opts, progress),
    ...wireTicketPhases(opts, progress),
    ...wireGitAndInvoke(opts),
    ...wireDeliver(opts, progress),
    ...wireFinalization(opts),
  };
}
