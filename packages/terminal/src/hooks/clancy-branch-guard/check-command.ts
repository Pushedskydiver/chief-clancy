/**
 * Branch guard command checking logic.
 *
 * Focused check functions for dangerous git operations. Each targets a
 * specific operation and returns a rejection reason string with
 * actionable advice, or `null` (allowed).
 */

const DEFAULT_BRANCHES = ['main', 'master', 'develop'] as const;

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

const GIT_PUSH = /\bgit\s+push\b/;
const FORCE_FLAG = /\s--force\b/;
const SHORT_FORCE_FLAG = /\s-f\b/;
const FORCE_WITH_LEASE = /--force-with-lease/;
const RESET_HARD = /\bgit\s+reset\s+--hard\b/;
const GIT_CLEAN_ARGS = /\bgit\s+clean\s+(.*)/;
const CLEAN_FORCE = /(?:^|\s)-[a-zA-Z]*f/;
const CLEAN_DRY_RUN = /(?:^|\s)-[a-zA-Z]*n/;
const CHECKOUT_DISCARD = /\bgit\s+checkout\s+--\s+\./;
const RESTORE_ALL = /\bgit\s+restore\s+\.(?:\s*$|\s*[;&|])/;
const BRANCH_FORCE_DELETE = /\bgit\s+branch\s+.*-D\b/;

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const MSG_FORCE_PUSH =
  'Blocked: git push --force destroys remote history. Use --force-with-lease instead.';
const MSG_PROTECTED_BRANCH = (branch: string): string =>
  `Blocked: direct push to protected branch '${branch}'. Create a PR instead.`;
const MSG_RESET_HARD =
  'Blocked: git reset --hard discards all uncommitted changes.';
const MSG_CLEAN_FORCE =
  'Blocked: git clean -f deletes untracked files. Use -n for a dry run first.';
const MSG_CHECKOUT_DISCARD =
  'Blocked: git checkout -- . discards all unstaged changes.';
const MSG_RESTORE_ALL = 'Blocked: git restore . discards all unstaged changes.';
const MSG_BRANCH_DELETE =
  'Blocked: git branch -D force-deletes without merge check. Use -d for safe deletion.';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Build the list of protected branch names.
 *
 * Starts with `main`, `master`, `develop` and appends
 * `CLANCY_BASE_BRANCH` from the environment if not already present.
 *
 * @param envBranch - The `CLANCY_BASE_BRANCH` environment variable value.
 * @returns Immutable array of protected branch names.
 */
export function buildProtectedBranches(
  envBranch: string | undefined,
): readonly string[] {
  if (!envBranch) return [...DEFAULT_BRANCHES];

  const alreadyIncluded = DEFAULT_BRANCHES.includes(
    envBranch as (typeof DEFAULT_BRANCHES)[number],
  );

  return alreadyIncluded
    ? [...DEFAULT_BRANCHES]
    : [...DEFAULT_BRANCHES, envBranch];
}

// ---------------------------------------------------------------------------
// Check functions
// ---------------------------------------------------------------------------

/** Extract the git push segment, stopping at command separators. */
function gitPushSegment(cmd: string): string | null {
  const match = /\bgit\s+push\b[^&|;]*/.exec(cmd);

  return match ? match[0] : null;
}

/** Check for `git push --force` (without `--force-with-lease`). */
function checkForcePush(cmd: string): string | null {
  const segment = gitPushSegment(cmd);

  if (!segment) return null;

  const hasForceFlag =
    FORCE_FLAG.test(segment) || SHORT_FORCE_FLAG.test(segment);
  const hasLease = FORCE_WITH_LEASE.test(segment);

  return hasForceFlag && !hasLease ? MSG_FORCE_PUSH : null;
}

/**
 * Check for `git push` to a protected branch.
 *
 * Uses string splitting instead of dynamic regex to avoid ReDoS risk.
 * Parses tokens after `git push`, skips flags (starting with `-`),
 * then checks if the branch token matches a protected branch name.
 */
function checkProtectedBranchPush(
  cmd: string,
  branches: readonly string[],
): string | null {
  if (!GIT_PUSH.test(cmd)) return null;

  const tokens = cmd.split(/\s+/);
  const pushIndex = tokens.indexOf('push');

  if (pushIndex < 0) return null;

  const afterPush = tokens.slice(pushIndex + 1);
  const nonFlags = afterPush.filter((t) => !t.startsWith('-'));
  const branchToken = nonFlags[1] ?? '';
  const bareToken = branchToken.split(':')[0];

  const matched = branches.find((b) => bareToken === b);

  return matched ? MSG_PROTECTED_BRANCH(matched) : null;
}

/** Check for `git reset --hard`. */
function checkResetHard(cmd: string): string | null {
  return RESET_HARD.test(cmd) ? MSG_RESET_HARD : null;
}

/** Check for `git clean -f` without `-n` (dry-run). */
function checkCleanForce(cmd: string): string | null {
  const match = GIT_CLEAN_ARGS.exec(cmd);

  if (!match) return null;

  const args = match[1];
  const hasForce = CLEAN_FORCE.test(args);
  const hasDryRun = CLEAN_DRY_RUN.test(args);

  return hasForce && !hasDryRun ? MSG_CLEAN_FORCE : null;
}

/** Check for `git checkout -- .` (discard all changes). */
function checkCheckoutDiscard(cmd: string): string | null {
  return CHECKOUT_DISCARD.test(cmd) ? MSG_CHECKOUT_DISCARD : null;
}

/** Check for `git restore .` (restore all files). */
function checkRestoreAll(cmd: string): string | null {
  return RESTORE_ALL.test(cmd) ? MSG_RESTORE_ALL : null;
}

/** Check for `git branch -D` (force delete). */
function checkBranchForceDelete(cmd: string): string | null {
  return BRANCH_FORCE_DELETE.test(cmd) ? MSG_BRANCH_DELETE : null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Check a shell command for dangerous git operations.
 *
 * Runs each check function in order and returns the first rejection
 * reason, or `null` if the command is safe.
 *
 * @param cmd - The shell command string to check.
 * @param branches - Protected branch names (from `buildProtectedBranches`).
 * @returns A rejection reason string, or `null` if allowed.
 */
export function checkCommand(
  cmd: string,
  branches: readonly string[],
): string | null {
  if (!cmd) return null;

  const checks = [
    () => checkForcePush(cmd),
    () => checkProtectedBranchPush(cmd, branches),
    () => checkResetHard(cmd),
    () => checkCleanForce(cmd),
    () => checkCheckoutDiscard(cmd),
    () => checkRestoreAll(cmd),
    () => checkBranchForceDelete(cmd),
  ];

  const firstMatch = checks.map((check) => check()).find(Boolean);

  return firstMatch ?? null;
}
