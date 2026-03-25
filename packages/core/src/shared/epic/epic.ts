/**
 * Epic branch management.
 *
 * Ensures epic branches exist, builds epic context for child PRs,
 * and gathers child entries for the final epic PR.
 */
import type { ExecGit } from '~/c/shared/git-ops/index.js';
import type { ProgressEntry, ProgressFs } from '~/c/shared/progress/index.js';
import type { EpicContext } from '~/c/shared/pull-request/pr-body/index.js';

import {
  branchExists,
  fetchRemoteBranch,
  pushBranch,
  remoteBranchExists,
} from '~/c/shared/git-ops/index.js';
import { findEntriesWithStatus } from '~/c/shared/progress/index.js';
import { isEpicBranch } from '~/c/shared/pull-request/pr-body/index.js';
import { DELIVERED_STATUSES } from '~/c/types/progress.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Result of ensuring an epic branch. */
type EnsureEpicResult = {
  readonly ok: boolean;
  readonly error?: string;
};

/** Options for {@link ensureEpicBranch}. */
type EnsureEpicOpts = {
  readonly exec: ExecGit;
  readonly epicBranch: string;
  readonly baseBranch: string;
};

/** Options for {@link buildEpicContext}. */
type BuildEpicContextOpts = {
  readonly progressFs: ProgressFs;
  readonly projectRoot: string;
  readonly parent: string | undefined;
  readonly targetBranch: string;
  readonly ticketKey: string;
};

/** Options for {@link gatherChildEntries}. */
type GatherChildOpts = {
  readonly progressFs: ProgressFs;
  readonly projectRoot: string;
  readonly epicKey: string;
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Ensure the epic branch exists locally and on the remote.
 *
 * If it exists on the remote, fetches it locally. If it only exists
 * locally (not remote), returns an error (safety guard for stale
 * local branches). If it doesn't exist, creates from
 * `origin/{baseBranch}` and pushes.
 *
 * @param opts - Options with DI dependencies.
 * @returns Result indicating success or failure with error message.
 */
export function ensureEpicBranch(opts: EnsureEpicOpts): EnsureEpicResult {
  const { exec, epicBranch, baseBranch } = opts;

  const existsOnRemote = remoteBranchExists(exec, epicBranch);
  const existsLocally = branchExists(exec, epicBranch);

  if (existsOnRemote) {
    const fetched = fetchRemoteBranch(exec, epicBranch);
    return fetched
      ? { ok: true }
      : { ok: false, error: `Could not fetch ${epicBranch} from remote` };
  }

  if (existsLocally) {
    return {
      ok: false,
      error: `${epicBranch} exists locally but not on remote — push manually: git push -u origin ${epicBranch}`,
    };
  }

  return createFreshEpic(exec, epicBranch, baseBranch);
}

/**
 * Build epic context for child PRs targeting epic/milestone branches.
 *
 * Returns `undefined` if the target is not an epic branch or no parent.
 *
 * @param opts - Options with progress FS and branch info.
 * @returns Epic context for PR body, or `undefined`.
 */
export function buildEpicContext(
  opts: BuildEpicContextOpts,
): EpicContext | undefined {
  const { progressFs, projectRoot, parent, targetBranch, ticketKey } = opts;

  if (!parent || !isEpicBranch(targetBranch)) return undefined;

  const siblingEntries = [...DELIVERED_STATUSES]
    .flatMap((s) => findEntriesWithStatus(progressFs, projectRoot, s))
    .filter((e) => e.parent === parent && e.key !== ticketKey);

  return {
    parentKey: parent,
    siblingsDelivered: siblingEntries.length,
    epicBranch: targetBranch,
  };
}

/**
 * Gather child progress entries for an epic PR body.
 *
 * Collects entries with delivered statuses whose parent matches the epic key.
 *
 * @param opts - Options with progress FS and epic key.
 * @returns Child entries for the epic PR body.
 */
export function gatherChildEntries(
  opts: GatherChildOpts,
): readonly ProgressEntry[] {
  const { progressFs, projectRoot, epicKey } = opts;

  return [...DELIVERED_STATUSES]
    .flatMap((s) => findEntriesWithStatus(progressFs, projectRoot, s))
    .filter((e) => e.parent === epicKey);
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Create a fresh epic branch from remote base and push it. */
function createFreshEpic(
  exec: ExecGit,
  epicBranch: string,
  baseBranch: string,
): EnsureEpicResult {
  try {
    exec(['fetch', 'origin', baseBranch]);
    exec(['checkout', '-b', epicBranch, `origin/${baseBranch}`]);
    const pushed = pushBranch(exec, epicBranch);
    return pushed
      ? { ok: true }
      : {
          ok: false,
          error: `Created ${epicBranch} locally but could not push`,
        };
  } catch (err) {
    return {
      ok: false,
      error: `Could not create epic branch: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
