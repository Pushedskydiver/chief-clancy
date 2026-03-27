/**
 * Update check and stale brief detection logic.
 *
 * Pure functions for finding the Clancy install directory, checking
 * npm for the latest version, detecting stale unapproved briefs,
 * and building the update cache payload. All I/O is injected.
 */
import type { HookFs } from '../shared/types.js';

import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VERSION_FILE = 'VERSION';
const COMMANDS_PATH = join('.claude', 'commands', 'clancy');
const BRIEFS_DIR = join('.clancy', 'briefs');
const STALE_COUNT_FILE = join('.clancy', '.brief-stale-count');
const STALE_DAYS = 7;
const MS_PER_DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Update check cache payload written to disk. */
type UpdateCache = {
  readonly update_available: boolean;
  readonly installed: string;
  readonly latest: string;
  readonly checked: number;
};

/** Dependencies for finding the install directory. */
type FindInstallDeps = {
  readonly existsSync: (path: string) => boolean;
  readonly homedir: () => string;
};

/** Dependencies for checking the latest npm version. */
type NpmCheckDeps = {
  readonly execFileSync: (
    cmd: string,
    args: readonly string[],
    opts: { readonly timeout: number; readonly encoding: 'utf8' },
  ) => string;
};

/** Dependencies for stale brief detection. */
type StaleBriefDeps = {
  readonly readdirSync: (path: string) => readonly string[];
  readonly existsSync: (path: string) => boolean;
};

// ---------------------------------------------------------------------------
// Install directory
// ---------------------------------------------------------------------------

/**
 * Find the Clancy installation directory.
 *
 * Checks the local project first (`.claude/commands/clancy/VERSION`),
 * then falls back to the global home directory.
 *
 * @param cwd - Current working directory.
 * @param deps - Filesystem and homedir provider.
 * @returns The install directory path, or `null` if not found.
 */
export function findInstallDir(
  cwd: string,
  deps: FindInstallDeps,
): string | null {
  const localDir = join(cwd, COMMANDS_PATH);
  const localVersionExists = deps.existsSync(join(localDir, VERSION_FILE));

  if (localVersionExists) return localDir;

  const globalDir = join(deps.homedir(), COMMANDS_PATH);
  const globalVersionExists = deps.existsSync(join(globalDir, VERSION_FILE));

  return globalVersionExists ? globalDir : null;
}

// ---------------------------------------------------------------------------
// Version reading
// ---------------------------------------------------------------------------

/**
 * Read the installed version from the VERSION file.
 *
 * @param installDir - Path to the Clancy commands directory.
 * @param deps - Filesystem reader.
 * @returns Trimmed version string, or `'0.0.0'` on failure.
 */
export function readInstalledVersion(installDir: string, deps: HookFs): string {
  try {
    return deps.readFileSync(join(installDir, VERSION_FILE), 'utf8').trim();
  } catch {
    return '0.0.0';
  }
}

/**
 * Fetch the latest published version from npm.
 *
 * @param deps - Command executor.
 * @returns The latest version string, or `'unknown'` on failure.
 */
export function fetchLatestVersion(deps: NpmCheckDeps): string {
  try {
    return deps
      .execFileSync('npm', ['view', 'chief-clancy', 'version'], {
        timeout: 10_000,
        encoding: 'utf8',
      })
      .trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Build the update cache payload.
 *
 * @param installed - Currently installed version.
 * @param latest - Latest version from npm.
 * @param nowSeconds - Current time in Unix seconds.
 * @returns Cache data object ready for JSON serialisation.
 */
export function buildUpdateCache(
  installed: string,
  latest: string,
  nowSeconds: number,
): UpdateCache {
  const hasLatest = latest !== 'unknown' && latest !== '';
  // Simple string inequality — no semver comparison. A downgrade after
  // npm unpublish could false-positive, but that scenario is rare and
  // implementing semver parsing in a zero-dep hook is disproportionate.
  const updateAvailable = hasLatest && latest !== installed;

  return {
    update_available: updateAvailable,
    installed,
    latest,
    checked: nowSeconds,
  };
}

// ---------------------------------------------------------------------------
// Stale brief detection
// ---------------------------------------------------------------------------

/** Date prefix pattern for brief filenames: YYYY-MM-DD- */
const DATE_PREFIX_LENGTH = 11; // "YYYY-MM-DD-"

/**
 * Parse the date from a brief filename prefix.
 *
 * @param filename - Brief filename (e.g. `2025-01-15-my-brief.md`).
 * @returns Parsed date, or `null` if the prefix is invalid.
 */
export function parseBriefDate(filename: string): Date | null {
  const prefix = filename.slice(0, DATE_PREFIX_LENGTH - 1); // "YYYY-MM-DD"
  const date = new Date(`${prefix}T00:00:00Z`);
  const isValid = !isNaN(date.getTime());

  return isValid ? date : null;
}

/**
 * Check whether a single brief file is stale and unapproved.
 *
 * A brief is stale if it is a `.md` file (not `.feedback.md`) with a
 * valid date prefix older than the threshold, and no `.approved` marker.
 */
type StaleBriefContext = {
  readonly briefsPath: string;
  readonly staleThreshold: number;
  readonly deps: StaleBriefDeps;
};

function isStaleBrief(file: string, ctx: StaleBriefContext): boolean {
  const isBrief = file.endsWith('.md') && !file.endsWith('.feedback.md');

  if (!isBrief) return false;

  const hasApproval = ctx.deps.existsSync(
    join(ctx.briefsPath, `${file}.approved`),
  );

  if (hasApproval) return false;

  const date = parseBriefDate(file);

  return date !== null && date.getTime() < ctx.staleThreshold;
}

/**
 * Count stale unapproved briefs in the project.
 *
 * A brief is stale if it is a `.md` file with a valid date prefix
 * older than 7 days, and has no corresponding `.md.approved` marker.
 * Feedback files (`.feedback.md`) are excluded.
 *
 * @param cwd - Current working directory.
 * @param nowMs - Current time in milliseconds.
 * @param deps - Filesystem deps.
 * @returns Number of stale briefs, or `null` if the briefs dir is missing.
 */
export function countStaleBriefs(
  cwd: string,
  nowMs: number,
  deps: StaleBriefDeps,
): number | null {
  const briefsPath = join(cwd, BRIEFS_DIR);
  const dirExists = deps.existsSync(briefsPath);

  if (!dirExists) return null;

  try {
    const files = deps.readdirSync(briefsPath);
    const staleThreshold = nowMs - STALE_DAYS * MS_PER_DAY;

    const ctx: StaleBriefContext = { briefsPath, staleThreshold, deps };
    const count = files.filter((file) => isStaleBrief(file, ctx)).length;

    return count;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cache path
// ---------------------------------------------------------------------------

/**
 * Resolve the update cache directory and file path.
 *
 * @param homedir - User home directory.
 * @returns Object with `dir` and `file` paths.
 */
export function resolveCachePaths(homedir: string): {
  readonly dir: string;
  readonly file: string;
} {
  const dir = join(homedir, '.claude', 'cache');

  return { dir, file: join(dir, 'clancy-update-check.json') };
}

/**
 * Resolve the stale brief count file path.
 *
 * @param cwd - Current working directory.
 * @returns Absolute path to the stale count file.
 */
export function staleCountPath(cwd: string): string {
  return join(cwd, STALE_COUNT_FILE);
}
