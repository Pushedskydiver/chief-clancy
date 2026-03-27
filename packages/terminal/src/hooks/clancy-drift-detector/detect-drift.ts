/**
 * Drift detection logic.
 *
 * Compares the installed runtime version (`.clancy/version.json`)
 * against the package VERSION file to detect stale installations.
 * All I/O is injected for testability.
 */
import type { HookFs } from '../shared/types.js';

import { join } from 'node:path';

import { isPlainObject } from '../shared/types.js';

const VERSION_JSON = join('.clancy', 'version.json');

/** Relative path to the VERSION file — same path, rooted at cwd or homedir. */
const COMMANDS_VERSION = join('.claude', 'commands', 'clancy', 'VERSION');

/**
 * Compare two version strings after trimming whitespace.
 *
 * Returns `false` if either is empty — missing versions are not drift.
 *
 * @param a - First version string.
 * @param b - Second version string.
 * @returns `true` if both are non-empty and differ.
 */
export function versionsDiffer(a: string, b: string): boolean {
  if (!a || !b) return false;

  return a.trim() !== b.trim();
}

/** Safely read a file, returning `null` on any error. */
function safeRead(path: string, deps: HookFs): string | null {
  try {
    return deps.readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Read the installed runtime version from `.clancy/version.json`.
 *
 * @param cwd - Project root directory.
 * @param deps - Filesystem reader.
 * @returns The version string, or `null` if unavailable.
 */
export function readInstalledVersion(cwd: string, deps: HookFs): string | null {
  const raw = safeRead(join(cwd, VERSION_JSON), deps);

  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!isPlainObject(parsed)) return null;

    const version = parsed.version;

    return typeof version === 'string' ? version : null;
  } catch {
    return null;
  }
}

/**
 * Read the package VERSION file, checking local then global paths.
 *
 * @param cwd - Project root directory.
 * @param homeDir - User home directory.
 * @param deps - Filesystem reader.
 * @returns The trimmed version string, or `null` if unavailable.
 */
export function readPackageVersion(
  cwd: string,
  homeDir: string,
  deps: HookFs,
): string | null {
  const localPath = join(cwd, COMMANDS_VERSION);
  const globalPath = join(homeDir, COMMANDS_VERSION);

  const local = safeRead(localPath, deps);

  if (local) return local.trim();

  const global = safeRead(globalPath, deps);

  return global ? global.trim() : null;
}

/**
 * Build the drift warning message.
 *
 * @param installed - The runtime version.
 * @param packaged - The package version.
 * @returns Human-readable warning string.
 */
export function buildDriftWarning(installed: string, packaged: string): string {
  return (
    `DRIFT WARNING: Clancy runtime files are outdated ` +
    `(runtime: ${installed}, commands: ${packaged}). ` +
    `Run /clancy:update to sync your installation.`
  );
}
