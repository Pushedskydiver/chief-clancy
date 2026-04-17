/**
 * Epic branch management.
 *
 * Ensures epic branches exist, builds epic context for child PRs,
 * and gathers child entries for the final epic PR.
 */
import type { ExecGit } from '@chief-clancy/core/shared/git-ops.js';
import type { ProgressEntry, ProgressFs } from '~/d/lifecycle/progress.js';
import type { EpicContext } from '~/d/lifecycle/pull-request/pr-body.js';

import { findEntriesWithStatus } from '~/d/lifecycle/progress.js';
import { isEpicBranch } from '~/d/lifecycle/pull-request/pr-body.js';

import {
  branchExists,
  fetchRemoteBranch,
  pushBranch,
  remoteBranchExists,
} from '@chief-clancy/core/shared/git-ops.js';
import { DELIVERED_STATUSES } from '@chief-clancy/core/types/progress.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Result of ensuring an epic branch. */
type EnsureEpicResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly error: { readonly kind: 'unknown'; readonly message: string };
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
    if (fetched) return { ok: true };
    return {
      ok: false,
      error: {
        kind: 'unknown',
        message: `Could not fetch ${epicBranch} from remote`,
      },
    };
  }

  if (existsLocally) {
    return {
      ok: false,
      error: {
        kind: 'unknown',
        message: `${epicBranch} exists locally but not on remote — push manually: git push -u origin ${epicBranch}`,
      },
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
    if (pushed) return { ok: true };
    return {
      ok: false,
      error: {
        kind: 'unknown',
        message: `Created ${epicBranch} locally but could not push`,
      },
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: {
        kind: 'unknown',
        message: `Could not create epic branch: ${detail}`,
      },
    };
  }
}
