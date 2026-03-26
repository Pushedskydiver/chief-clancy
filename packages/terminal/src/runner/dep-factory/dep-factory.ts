/**
 * Dep factory — wire all PipelineDeps fields.
 *
 * Single entry point that takes shared I/O resources and returns
 * fully wired {@link PipelineDeps}. Each field is a closure that
 * captures the shared resources and delegates to the corresponding
 * core phase function.
 */
import type { AppendFn, SpawnSyncFn } from '../shared/types.js';
import type {
  Board,
  BoardProvider,
  CostFs,
  EnvFileSystem,
  ExecGit,
  FetchedTicket,
  FetchFn,
  LockFs,
  PipelineDeps,
  ProgressEntry,
  ProgressFs,
  QualityFs,
  RunContext,
} from '@chief-clancy/core';

import {
  appendCostEntry,
  appendProgress,
  branchSetup,
  checkFeasibility,
  checkout,
  cleanupPhase,
  computeTargetBranch,
  computeTicketBranch,
  costPhase,
  countReworkCycles,
  createBoard,
  deleteLock,
  deleteVerifyAttempt,
  deliverEpicToBase,
  detectBoard,
  detectRemote,
  detectResume,
  ensureBranch,
  ensureEpicBranch,
  epicCompletion,
  executeResume,
  feasibilityPhase,
  fetchRemoteBranch,
  fetchReworkFromPrReview,
  findEntriesWithStatus,
  currentBranch as gitCurrentBranch,
  lockCheck,
  preflightPhase,
  prRetry,
  readLock,
  resolvePlatformHandlers,
  reworkDetection,
  runPreflight,
  ticketFetch,
  transition,
  writeLock,
} from '@chief-clancy/core';

import { invokeClaudePrint } from '../cli-bridge/index.js';
import { sendNotification } from '../notify/index.js';
import { wireDeliver } from './deliver-phase.js';
import { makeInvokePhase } from './invoke-phase.js';

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
};

function makeAppendProgress(
  progressFs: ProgressFs,
  projectRoot: string,
): AppendFn {
  return (opts) => appendProgress(progressFs, projectRoot, opts);
}

function hasParent(
  entry: ProgressEntry,
): entry is ProgressEntry & { readonly parent: string } {
  return entry.parent !== undefined;
}

function makeFindCompletedEpics(progressFs: ProgressFs, projectRoot: string) {
  return () => {
    const entries = findEntriesWithStatus(progressFs, projectRoot, 'DONE');
    const pairs = entries
      .filter(hasParent)
      .map((e) => [e.parent, e.key] as const);
    return new Map(pairs);
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

    preflight: (ctx: RunContext) =>
      preflightPhase(ctx, {
        runPreflight: (root) =>
          runPreflight(root, {
            exec: (file, args) => exec([file, ...args]),
            envFs: opts.envFs,
          }),
        detectBoard: (env) => detectBoard(env),
        createBoard: (config) => createBoard(config),
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
        // Stub — PR retry creation wired in 9.5 (once entry point)
        retryEntry: async () => undefined,
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

    ticketFetch: (ctx: RunContext) =>
      ticketFetch(ctx, {
        fetchTicket: (board: Board) => board.fetchTicket({}),
        countReworkCycles: (key: string) =>
          countReworkCycles(progressFs, projectRoot, key),
        appendProgress: progress,
        computeTicketBranch: (provider: BoardProvider, key: string) =>
          computeTicketBranch(provider, key),
        computeTargetBranch: (
          provider: BoardProvider,
          baseBranch: string,
          parent?: string,
        ) => computeTargetBranch(provider, baseBranch, parent),
      }),

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

    invoke: makeInvokePhase(spawn),
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
