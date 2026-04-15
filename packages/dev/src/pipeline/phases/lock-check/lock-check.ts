/**
 * Lock check — startup lock detection, stale cleanup, and resume.
 *
 * Returns structured results — no console output. The terminal layer
 * handles display. Decomposed into helpers to stay under 50-line limit.
 */
import type { RunContext } from '../../context.js';
import type { ExecGit } from '@chief-clancy/core/shared/git-ops/index.js';
import type { LockData, LockFs } from '~/d/lifecycle/lock/lock.js';
import type { ProgressFs } from '~/d/lifecycle/progress/progress.js';

import {
  deleteLock,
  deleteVerifyAttempt,
  isLockStale,
  readLock,
} from '~/d/lifecycle/lock/lock.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Structured result of the lock-check phase. */
type LockCheckResult = {
  /** `continue` = proceed to next phase, `abort` = stop, `resumed` = session resumed. */
  readonly action: 'continue' | 'abort' | 'resumed';
  /** Human-readable reason for the action. */
  readonly reason?: string;
};

/** Resume detection info returned by detectResume. */
type ResumeInfo = {
  readonly branch: string;
  readonly hasUncommitted: boolean;
  readonly hasUnpushed: boolean;
  readonly alreadyDelivered: boolean;
};

/** Resume detection options. */
type DetectResumeOpts = {
  readonly exec: ExecGit;
  readonly progressFs: ProgressFs;
  readonly projectRoot: string;
  readonly lock: LockData;
};

/** Resume execution result. */
type ResumeExecResult = {
  readonly ok: boolean;
};

/** Injected dependencies for lock-check. */
export type LockCheckDeps = {
  readonly lockFs: LockFs;
  readonly exec: ExecGit;
  readonly progressFs: ProgressFs;
  readonly detectResume: (opts: DetectResumeOpts) => ResumeInfo | undefined;
  readonly executeResume: (
    opts: DetectResumeOpts & { readonly resumeInfo: ResumeInfo },
  ) => Promise<ResumeExecResult>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Try resume detection and execution for a stale lock. Best-effort. */
async function attemptResume(
  ctx: RunContext,
  lock: LockData,
  deps: LockCheckDeps,
): Promise<LockCheckResult> {
  const resumeOpts = {
    exec: deps.exec,
    progressFs: deps.progressFs,
    projectRoot: ctx.projectRoot,
    lock,
  };

  const info = deps.detectResume(resumeOpts);

  if (!info) return { action: 'continue' };

  if (info.alreadyDelivered) {
    return {
      action: 'continue',
      reason: `${lock.ticketKey} already delivered — skipping`,
    };
  }

  if (!ctx.isAfk) {
    return {
      action: 'continue',
      reason: `Found in-progress work on ${info.branch}`,
    };
  }

  const result = await deps.executeResume({ ...resumeOpts, resumeInfo: info });

  return result.ok
    ? { action: 'resumed', reason: `Resumed ${lock.ticketKey}` }
    : { action: 'continue' };
}

// ─── Phase ───────────────────────────────────────────────────────────────────

/**
 * Check for an existing lock file and handle stale/active sessions.
 *
 * @param ctx - Pipeline context.
 * @param deps - Injected dependencies.
 * @returns Structured result indicating whether to continue, abort, or mark as resumed.
 */
export async function lockCheck(
  ctx: RunContext,
  deps: LockCheckDeps,
): Promise<LockCheckResult> {
  const lock = readLock(deps.lockFs, ctx.projectRoot);

  if (!lock) return { action: 'continue' };

  if (!isLockStale(lock)) {
    return {
      action: 'abort',
      reason: `Another Clancy session is running (PID ${lock.pid}, ticket ${lock.ticketKey})`,
    };
  }

  // Stale lock — clean up
  deleteLock(deps.lockFs, ctx.projectRoot);
  deleteVerifyAttempt(deps.lockFs, ctx.projectRoot);

  // Best-effort resume
  try {
    return await attemptResume(ctx, lock, deps);
  } catch {
    return { action: 'continue' };
  }
}
