/**
 * Lock file reader for Clancy hooks.
 *
 * Reads `.clancy/lock.json` from the project directory. The lock file
 * contains ticket metadata written by the runner so hooks can provide
 * context-aware behaviour (e.g. post-compact re-injection).
 *
 * Best-effort: returns `null` on any failure — hooks must never crash.
 */
import type { HookFs, LockData } from './types.js';

import { join } from 'node:path';

import { isPlainObject } from './types.js';

/**
 * Read and parse `.clancy/lock.json` from the given working directory.
 *
 * @param cwd - The project root containing `.clancy/`.
 * @param deps - Filesystem reader (injected for testability).
 * @returns Parsed lock data, or `null` if missing or malformed.
 */
export function readLockFile(cwd: string, deps: HookFs): LockData | null {
  const lockPath = join(cwd, '.clancy', 'lock.json');

  try {
    const raw: unknown = JSON.parse(deps.readFileSync(lockPath, 'utf8'));

    // Safe: all LockData fields are optional — any plain object is a valid shape
    return isPlainObject(raw) ? raw : null;
  } catch {
    return null;
  }
}
