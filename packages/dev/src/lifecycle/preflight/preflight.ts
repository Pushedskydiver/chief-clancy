/**
 * Preflight checks shared across pipeline scripts.
 *
 * Validates the environment before running a ticket:
 * required binaries, `.clancy/.env` file, git repository, and working
 * directory state. All I/O is dependency-injected for testability.
 */
import type { EnvFileSystem } from '@chief-clancy/core/shared/env-parser.js';

import { loadClancyEnv } from '@chief-clancy/core/shared/env-parser.js';
import { hasUncommittedChanges } from '@chief-clancy/core/shared/git-ops.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Execute a command by file name and return stdout.
 * Throws on non-zero exit. Unlike `ExecGit` (git-ops), this is not
 * scoped to git — it can run any binary.
 */
type ExecCmd = (file: string, args: readonly string[]) => string;

/** Injected dependencies for preflight checks. */
export type PreflightDeps = {
  /** Execute a shell command (for binary checks and git state). */
  readonly exec: ExecCmd;
  /** File system operations for `.clancy/.env` loading. */
  readonly envFs: EnvFileSystem;
};

/** Result of running preflight checks. */
export type PreflightResult = {
  readonly ok: boolean;
  readonly error: string | undefined;
  readonly warning: string | undefined;
  readonly env: Record<string, string> | undefined;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Check whether a binary is available on the system PATH.
 *
 * Probes the binary with `--version` — works cross-platform (no `which`).
 *
 * @param exec - Injected command executor.
 * @param name - The binary name to check (e.g., `'git'`, `'claude'`).
 * @returns `true` if the binary is found.
 */
function binaryExists(exec: ExecCmd, name: string): boolean {
  try {
    exec(name, ['--version']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check whether the current directory is inside a git repository.
 *
 * @param exec - Injected command executor.
 * @returns `true` if a `.git` directory is found.
 */
function isGitRepo(exec: ExecCmd): boolean {
  try {
    exec('git', ['rev-parse', '--git-dir']);
    return true;
  } catch {
    return false;
  }
}

/** Check whether the remote origin is reachable (warning-only). */
function isRemoteReachable(exec: ExecCmd): boolean {
  try {
    exec('git', ['ls-remote', 'origin', 'HEAD']);
    return true;
  } catch {
    return false;
  }
}

/** Collect non-blocking warnings about repository state. */
function collectWarnings(exec: ExecCmd): string | undefined {
  const execGit = (args: readonly string[]): string => exec('git', args);

  const checks: readonly (readonly [boolean, string])[] = [
    [
      !isRemoteReachable(exec),
      'Could not reach origin. PR creation and rework detection may not work.',
    ],
    [
      hasUncommittedChanges(execGit),
      'Working directory has uncommitted changes — they will be included in the branch.',
    ],
  ];

  const messages = checks.filter(([flag]) => flag).map(([, msg]) => msg);

  return messages.length > 0 ? messages.join('\n') : undefined;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Run all preflight checks common to every pipeline script.
 *
 * Checks for required binaries (`claude`, `git`), the `.clancy/.env` file,
 * git repository state, and uncommitted changes. Returns structured data
 * — no console output.
 *
 * @param projectRoot - The root directory of the project.
 * @param deps - Injected dependencies (exec, filesystem).
 * @returns A result with `ok`, optional `error`/`warning`, and parsed `env`.
 */
export function runPreflight(
  projectRoot: string,
  deps: PreflightDeps,
): PreflightResult {
  const fail = (error: string): PreflightResult => ({
    ok: false,
    error,
    warning: undefined,
    env: undefined,
  });

  // Check required binaries
  const REQUIRED_BINARIES = ['claude', 'git'] as const;
  const missingBin = REQUIRED_BINARIES.find((b) => !binaryExists(deps.exec, b));

  if (missingBin) {
    return fail(`${missingBin} is required but not found`);
  }

  // Check .env file
  const env = loadClancyEnv(projectRoot, deps.envFs);

  if (!env) {
    return fail('.clancy/.env not found — run /clancy:init first');
  }

  // Check git repo
  if (!isGitRepo(deps.exec)) {
    return fail('Not inside a git repository');
  }

  // Collect non-blocking warnings
  const warning = collectWarnings(deps.exec);

  return { ok: true, env, error: undefined, warning };
}
