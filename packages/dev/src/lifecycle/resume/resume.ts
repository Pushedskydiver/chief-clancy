/**
 * Resume detection and execution for crash recovery.
 *
 * After a stale lock is cleaned up, checks if the ticket branch exists
 * locally with uncommitted or unpushed work. If so, the caller can
 * resume by committing, pushing, and optionally creating a PR.
 */
import type { ExecGit } from '@chief-clancy/core/shared/git-ops/index.js';
import type { PrCreationResult } from '@chief-clancy/core/types/remote.js';
import type { LockData } from '~/d/lifecycle/lock/index.js';
import type { ProgressFs } from '~/d/lifecycle/progress/index.js';

import { appendProgress, findLastEntry } from '~/d/lifecycle/progress/index.js';

import {
  branchExists,
  checkout,
  currentBranch,
  hasUncommittedChanges,
  pushBranch,
} from '@chief-clancy/core/shared/git-ops/index.js';
import { DELIVERED_STATUSES } from '@chief-clancy/core/types/progress.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Detection result for a resumable stale lock. */
type ResumeInfo = {
  readonly branch: string;
  readonly hasUncommitted: boolean;
  readonly hasUnpushed: boolean;
  readonly alreadyDelivered: boolean;
};

/** Options for {@link detectResume}. */
type DetectResumeOpts = {
  readonly exec: ExecGit;
  readonly progressFs: ProgressFs;
  readonly projectRoot: string;
  readonly lock: LockData;
};

/** Callback for PR creation during resume. */
type CreateResumePr = (
  lock: LockData,
  sourceBranch: string,
) => Promise<PrCreationResult | undefined>;

/** Result of executing a resume. */
type ResumeExecResult = {
  readonly ok: boolean;
  readonly prResult?: PrCreationResult;
  readonly error?: string;
};

/** Options for {@link executeResume}. */
type ExecuteResumeOpts = {
  readonly exec: ExecGit;
  readonly progressFs: ProgressFs;
  readonly projectRoot: string;
  readonly lock: LockData;
  readonly resumeInfo: ResumeInfo;
  readonly createPr?: CreateResumePr;
};

// ─── Detection ───────────────────────────────────────────────────────────────

/**
 * Check if the ticket branch from a stale lock has recoverable work.
 *
 * Switches to the branch, inspects for uncommitted or unpushed changes,
 * then restores the original branch. If no local work exists, checks
 * progress for an already-delivered ticket (crash after push but before
 * lock deletion).
 *
 * @param opts - Detection options with DI dependencies.
 * @returns Resume info if recovery is possible, `undefined` otherwise.
 */
export function detectResume(opts: DetectResumeOpts): ResumeInfo | undefined {
  const { exec, progressFs, projectRoot, lock } = opts;
  const branch = lock.ticketBranch;

  if (!branchExists(exec, branch)) return undefined;

  const previous = safeCurrent(exec);
  if (!previous) return undefined;

  if (!safeCheckout(exec, branch)) {
    safeCheckout(exec, previous);
    return undefined;
  }

  const state = inspectBranch(exec, branch, lock.targetBranch);
  safeCheckout(exec, previous);

  if (!state.hasUncommitted && !state.hasUnpushed) {
    return checkAlreadyDelivered({ progressFs, projectRoot, lock }, branch);
  }

  return { branch, ...state, alreadyDelivered: false };
}

// ─── Execution ───────────────────────────────────────────────────────────────

/**
 * Resume a crashed session: commit uncommitted changes, push, and
 * optionally create a PR.
 *
 * @param opts - Execution options with DI dependencies.
 * @returns Result indicating success/failure and optional PR info.
 */
export async function executeResume(
  opts: ExecuteResumeOpts,
): Promise<ResumeExecResult> {
  const { exec, progressFs, projectRoot, lock, resumeInfo, createPr } = opts;

  try {
    checkout(exec, resumeInfo.branch);

    if (resumeInfo.hasUncommitted && !commitResumableWork(exec, lock)) {
      return { ok: false, error: 'Could not commit in-progress work' };
    }

    if (!pushBranch(exec, resumeInfo.branch)) {
      return { ok: false, error: 'Could not push branch' };
    }

    const prResult = createPr
      ? await createPr(lock, resumeInfo.branch)
      : undefined;

    appendResumedProgress({ progressFs, projectRoot, lock }, prResult);
    safeCheckout(exec, lock.targetBranch);

    return { ok: true, prResult };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Get current branch, returning `undefined` on failure. */
function safeCurrent(exec: ExecGit): string | undefined {
  try {
    return currentBranch(exec);
  } catch {
    return undefined;
  }
}

/** Checkout a branch, returning `true` on success. */
function safeCheckout(exec: ExecGit, branch: string): boolean {
  try {
    checkout(exec, branch);
    return true;
  } catch {
    return false;
  }
}

/**
 * Inspect a branch for uncommitted and unpushed changes.
 *
 * Assumes the branch is already checked out.
 */
function inspectBranch(
  exec: ExecGit,
  branch: string,
  targetBranch: string,
): { readonly hasUncommitted: boolean; readonly hasUnpushed: boolean } {
  const uncommitted = safeHasUncommitted(exec);
  const unpushed = hasUnpushedCommits(exec, branch, targetBranch);

  return { hasUncommitted: uncommitted, hasUnpushed: unpushed };
}

/** Check for uncommitted changes, returning `false` on error. */
function safeHasUncommitted(exec: ExecGit): boolean {
  try {
    return hasUncommittedChanges(exec);
  } catch {
    return false;
  }
}

/**
 * Check for unpushed commits on a branch.
 *
 * First checks `origin/{branch}..{branch}`. If the remote branch
 * doesn't exist, falls back to `origin/{targetBranch}..{branch}`.
 */
function hasUnpushedCommits(
  exec: ExecGit,
  branch: string,
  targetBranch: string,
): boolean {
  try {
    const log = exec(['log', `origin/${branch}..${branch}`, '--oneline']);
    return log.trim().length > 0;
  } catch {
    try {
      const log = exec([
        'log',
        `origin/${targetBranch}..${branch}`,
        '--oneline',
      ]);
      return log.trim().length > 0;
    } catch {
      return false;
    }
  }
}

/** Check progress file for an already-delivered ticket. */
function checkAlreadyDelivered(
  opts: Pick<DetectResumeOpts, 'progressFs' | 'projectRoot' | 'lock'>,
  branch: string,
): ResumeInfo | undefined {
  const lastEntry = findLastEntry(
    opts.progressFs,
    opts.projectRoot,
    opts.lock.ticketKey,
  );

  if (lastEntry && DELIVERED_STATUSES.has(lastEntry.status)) {
    return {
      branch,
      hasUncommitted: false,
      hasUnpushed: false,
      alreadyDelivered: true,
    };
  }

  return undefined;
}

/** Commit in-progress work during resume. Returns `true` on success. */
function commitResumableWork(exec: ExecGit, lock: LockData): boolean {
  try {
    exec(['add', '-A']);
    exec(['commit', '-m', `fix(${lock.ticketKey}): resume after crash`]);
    return true;
  } catch {
    return false;
  }
}

/** Resolve parentKey from lock, treating empty/'none' as `undefined`. */
function resolveParentKey(lock: LockData): string | undefined {
  return lock.parentKey && lock.parentKey !== 'none'
    ? lock.parentKey
    : undefined;
}

/** Append a RESUMED progress entry. */
function appendResumedProgress(
  opts: Pick<ExecuteResumeOpts, 'progressFs' | 'projectRoot' | 'lock'>,
  prResult: PrCreationResult | undefined,
): void {
  appendProgress(opts.progressFs, opts.projectRoot, {
    key: opts.lock.ticketKey,
    summary: opts.lock.ticketTitle,
    status: 'RESUMED',
    prNumber: prResult?.ok ? prResult.number : undefined,
    parent: resolveParentKey(opts.lock),
  });
}
