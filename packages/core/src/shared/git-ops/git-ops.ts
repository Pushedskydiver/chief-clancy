/**
 * Git operations — command wrappers with dependency-injected exec.
 *
 * Wraps common git commands used during the ticket lifecycle:
 * branch creation, checkout, squash merge, push, and cleanup.
 * The `exec` function is injected for testability — no direct
 * `child_process` imports in this module.
 */
import type { GitPlatform, RemoteInfo } from '~/c/types/index.js';

import { parseRemote } from '~/c/shared/remote/remote.js';

/** Execute a git sub-command and return stdout. Throws on non-zero exit. */
type ExecGit = (args: readonly string[]) => string;

/** Valid values for the `CLANCY_GIT_PLATFORM` env var override. Must stay in sync with {@link GitPlatform}. */
const VALID_PLATFORMS = new Set<string>([
  'github',
  'gitlab',
  'bitbucket',
  'bitbucket-server',
  'azure',
]);

/**
 * Get the name of the currently checked-out branch.
 *
 * @param exec - Injected git executor.
 * @returns The current branch name.
 */
export function currentBranch(exec: ExecGit): string {
  return exec(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
}

/**
 * Check whether the working directory has uncommitted changes.
 *
 * @param exec - Injected git executor.
 * @returns `true` if there are staged or unstaged changes.
 */
export function hasUncommittedChanges(exec: ExecGit): boolean {
  try {
    exec(['diff', '--quiet']);
    exec(['diff', '--cached', '--quiet']);
    return false;
  } catch {
    return true;
  }
}

/**
 * Check whether a local branch exists.
 *
 * @param exec - Injected git executor.
 * @param branch - The branch name to check.
 * @returns `true` if the branch exists locally.
 */
export function branchExists(exec: ExecGit, branch: string): boolean {
  try {
    exec(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a branch from a base branch if it doesn't already exist.
 *
 * @param exec - Injected git executor.
 * @param branch - The branch name to create.
 * @param baseBranch - The base branch to create from.
 */
export function ensureBranch(
  exec: ExecGit,
  branch: string,
  baseBranch: string,
): void {
  if (!branchExists(exec, branch)) {
    exec(['checkout', '-b', branch, baseBranch]);
  }
}

/**
 * Check out a branch. Uses `-B` flag to force-create if needed.
 *
 * @param exec - Injected git executor.
 * @param branch - The branch name to check out.
 * @param force - If `true`, uses `-B` to force-create/reset the branch.
 */
export function checkout(exec: ExecGit, branch: string, force = false): void {
  const flag = force ? ['-B'] : [];
  exec(['checkout', ...flag, branch]);
}

/**
 * Squash merge a source branch into the currently checked-out branch
 * and commit with the given message.
 *
 * @param exec - Injected git executor.
 * @param sourceBranch - The branch to squash merge from.
 * @param commitMessage - The commit message for the squash merge.
 * @returns `true` if changes were committed, `false` if nothing to commit.
 */
export function squashMerge(
  exec: ExecGit,
  sourceBranch: string,
  commitMessage: string,
): boolean {
  exec(['merge', '--squash', sourceBranch]);

  try {
    exec(['diff', '--cached', '--quiet']);
    return false;
  } catch {
    exec(['commit', '-m', commitMessage]);
    return true;
  }
}

/**
 * Delete a local branch (force).
 *
 * Uses `-D` because squash merges leave the branch in an "unmerged"
 * state from git's perspective, causing `-d` to fail.
 *
 * @param exec - Injected git executor.
 * @param branch - The branch name to delete.
 */
export function deleteBranch(exec: ExecGit, branch: string): void {
  exec(['branch', '-D', branch]);
}

/**
 * Check whether a branch exists on the remote (without fetching it).
 *
 * @param exec - Injected git executor.
 * @param branch - The branch name to check.
 * @returns `true` if the branch exists on the remote.
 */
export function remoteBranchExists(exec: ExecGit, branch: string): boolean {
  try {
    const output = exec(['ls-remote', '--heads', 'origin', branch]).trim();
    return output.length > 0;
  } catch {
    return false;
  }
}

/**
 * Fetch a remote branch into a local branch of the same name.
 *
 * @param exec - Injected git executor.
 * @param branch - The branch name to fetch from the remote.
 * @returns `true` if the fetch succeeded, `false` if it doesn't exist.
 */
export function fetchRemoteBranch(exec: ExecGit, branch: string): boolean {
  try {
    exec(['fetch', 'origin', `${branch}:${branch}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the diff stat between the current branch and a target branch.
 *
 * Truncated to `maxLength` characters to avoid oversized prompts.
 *
 * @param exec - Injected git executor.
 * @param targetBranch - The branch to diff against.
 * @param maxLength - Maximum output length (default 8000).
 * @returns The diff stat output, or `undefined` on failure.
 */
export function diffAgainstBranch(
  exec: ExecGit,
  targetBranch: string,
  maxLength = 8000,
): string | undefined {
  try {
    const output = exec(['diff', `${targetBranch}...HEAD`, '--stat']).trim();
    if (!output) return undefined;
    if (output.length <= maxLength) return output;

    return output.slice(0, maxLength) + '\n... (truncated)';
  } catch {
    return undefined;
  }
}

/**
 * Push a branch to the remote origin with upstream tracking.
 *
 * @param exec - Injected git executor.
 * @param branch - The branch name to push.
 * @returns `true` if the push succeeded, `false` on failure.
 */
export function pushBranch(exec: ExecGit, branch: string): boolean {
  try {
    exec(['push', '-u', 'origin', branch]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect the remote origin and parse it into {@link RemoteInfo}.
 *
 * Shells out to `git remote get-url origin` via the injected exec.
 * If `platformOverride` is a valid {@link GitPlatform}, it forces
 * that platform instead of detecting from the hostname.
 *
 * @param exec - Injected git executor.
 * @param platformOverride - Optional platform string (from `CLANCY_GIT_PLATFORM` env var).
 * @returns Parsed remote info, or `{ host: 'none' }` when no remote exists.
 */
export function detectRemote(
  exec: ExecGit,
  platformOverride?: string,
): RemoteInfo {
  const rawUrl = safeExec(exec, ['remote', 'get-url', 'origin']);
  if (!rawUrl) return { host: 'none' };

  const validOverride = isValidPlatform(platformOverride)
    ? platformOverride
    : undefined;

  return parseRemote(rawUrl, validOverride);
}

/** Run exec and return trimmed stdout, or `undefined` on failure/empty. */
function safeExec(exec: ExecGit, args: readonly string[]): string | undefined {
  try {
    const output = exec(args).trim();
    return output || undefined;
  } catch {
    return undefined;
  }
}

/** Type guard: is the value a valid {@link GitPlatform} override? */
function isValidPlatform(value?: string): value is GitPlatform {
  return value !== undefined && VALID_PLATFORMS.has(value);
}
