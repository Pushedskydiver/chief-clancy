/**
 * Phase 7: Branch setup — git branch operations (epic, standalone, rework)
 * and lock file creation.
 *
 * Populates `effectiveTarget`, `originalBranch`, `skipEpicBranch`, and
 * `lockOwner` on the context. Returns structured results — no console output.
 */
import type { RunContext } from '../../context.js';
import type { ChildrenStatus, FetchedTicket } from '~/c/types/board.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Result of ensureEpicBranch operation. */
type EnsureEpicResult = {
  readonly ok: boolean;
  readonly error?: string;
};

/** Lock data written to `.clancy/lock.json`. */
type WriteLockData = {
  readonly ticketKey: string;
  readonly ticketTitle: string;
  readonly ticketBranch: string;
  readonly targetBranch: string;
  readonly parentKey: string;
  readonly description?: string;
  readonly startedAt: string;
};

/** Structured result of the branch-setup phase. */
type BranchSetupResult = {
  readonly ok: boolean;
  readonly error?: string;
};

/** Injected dependencies for branch-setup. */
export type BranchSetupDeps = {
  /** Get the current git branch. Pre-wired with exec. */
  readonly currentBranch: () => string;
  /** Check out a branch, optionally creating it. Pre-wired with exec. */
  readonly checkout: (branch: string, create?: boolean) => void;
  /** Fetch a remote branch. Returns true if found. Pre-wired with exec. */
  readonly fetchRemoteBranch: (branch: string) => boolean;
  /** Ensure a branch exists locally, fetching from remote if needed. Pre-wired with exec. */
  readonly ensureBranch: (branch: string, baseBranch: string) => void;
  /** Ensure an epic branch exists. Pre-wired with exec. */
  readonly ensureEpicBranch: (
    epicBranch: string,
    baseBranch: string,
  ) => EnsureEpicResult;
  /** Check children status for a parent ticket. Pre-wired with board + ticket field extraction. */
  readonly fetchChildrenStatus: (
    ticket: FetchedTicket,
  ) => Promise<ChildrenStatus | undefined>;
  /** Write the lock file. Pre-wired with lockFs + projectRoot. */
  readonly writeLock: (data: WriteLockData) => void;
};

// ─── Phase ───────────────────────────────────────────────────────────────────

/**
 * Set up git branches for the ticket and write the lock file.
 *
 * Handles three flows: epic branch (parented tickets), standalone (no parent),
 * and rework (existing feature branch). Single-child detection skips the
 * epic branch when the parent has exactly one child.
 *
 * @param ctx - Pipeline context (requires ticket + branches from prior phases).
 * @param deps - Injected dependencies.
 * @returns Structured result indicating success or failure.
 */
export async function branchSetup(
  ctx: RunContext,
  deps: BranchSetupDeps,
): Promise<BranchSetupResult> {
  // Safe: pipeline ordering guarantees prior phases populate these fields
  const ticketBranch = ctx.ticketBranch!;
  const targetBranch = ctx.targetBranch!;
  const baseBranch = ctx.baseBranch!;
  const hasParent = ctx.hasParent === true;
  const isRework = ctx.isRework === true;

  const originalBranch = deps.currentBranch();
  const skipEpicBranch = await checkSingleChild(ctx, deps);
  const effectiveTarget =
    hasParent && !skipEpicBranch ? targetBranch : baseBranch;

  // Populate context with computed branch-setup fields
  ctx.setBranchSetup({
    ticketBranch,
    targetBranch,
    effectiveTarget,
    baseBranch,
    originalBranch,
    skipEpicBranch,
    hasParent,
  });

  // Set up branches based on flow
  const branchResult = isRework
    ? setupReworkBranch(ctx, deps)
    : setupFreshBranch(ctx, deps);

  if (!branchResult.ok) {
    deps.checkout(originalBranch);
    return branchResult;
  }

  writeLockSafe(ctx, deps);

  return { ok: true };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Check if the parent has exactly 1 child, meaning we skip the epic branch. */
async function checkSingleChild(
  ctx: RunContext,
  deps: BranchSetupDeps,
): Promise<boolean> {
  if (ctx.hasParent !== true || ctx.isRework === true) return false;

  const status = await deps.fetchChildrenStatus(ctx.ticket!);

  return status?.total === 1;
}

/** Set up branches for a rework ticket. */
function setupReworkBranch(
  ctx: RunContext,
  deps: BranchSetupDeps,
): BranchSetupResult {
  const ticketBranch = ctx.ticketBranch!;
  const effectiveTarget = ctx.effectiveTarget!;
  const baseBranch = ctx.baseBranch!;

  if (ctx.hasParent === true && ctx.skipEpicBranch !== true) {
    const epic = deps.ensureEpicBranch(ctx.targetBranch!, baseBranch);
    if (!epic.ok) return { ok: false, error: epic.error };
  } else {
    deps.ensureBranch(effectiveTarget, baseBranch);
  }

  const fetched = deps.fetchRemoteBranch(ticketBranch);

  if (fetched) {
    deps.checkout(ticketBranch);
  } else {
    deps.checkout(effectiveTarget);
    deps.checkout(ticketBranch, true);
  }

  return { ok: true };
}

/** Set up branches for a fresh (non-rework) ticket. */
function setupFreshBranch(
  ctx: RunContext,
  deps: BranchSetupDeps,
): BranchSetupResult {
  if (ctx.hasParent === true && ctx.skipEpicBranch !== true) {
    return setupEpicBranch(ctx, deps);
  }

  return setupStandalone(ctx, deps);
}

/** Set up epic branch flow: ensure epic, create feature from it. */
function setupEpicBranch(
  ctx: RunContext,
  deps: BranchSetupDeps,
): BranchSetupResult {
  const epic = deps.ensureEpicBranch(ctx.targetBranch!, ctx.baseBranch!);
  if (!epic.ok) return { ok: false, error: epic.error };

  deps.checkout(ctx.targetBranch!);
  deps.checkout(ctx.ticketBranch!, true);

  return { ok: true };
}

/** Set up standalone flow: branch from base. */
function setupStandalone(
  ctx: RunContext,
  deps: BranchSetupDeps,
): BranchSetupResult {
  const baseBranch = ctx.baseBranch!;

  deps.ensureBranch(baseBranch, baseBranch);
  deps.checkout(baseBranch);
  deps.checkout(ctx.ticketBranch!, true);

  return { ok: true };
}

/** Best-effort lock write — never crashes the pipeline. */
function writeLockSafe(ctx: RunContext, deps: BranchSetupDeps): void {
  try {
    const ticket = ctx.ticket!;

    deps.writeLock({
      ticketKey: ticket.key,
      ticketTitle: ticket.title,
      ticketBranch: ctx.ticketBranch!,
      targetBranch: ctx.effectiveTarget!,
      parentKey: ticket.parentInfo,
      description: (ticket.description ?? '').slice(0, 2000) || undefined,
      startedAt: new Date().toISOString(),
    });
    ctx.setLockOwner(true);
  } catch {
    // Best-effort — continue without crash protection
  }
}
