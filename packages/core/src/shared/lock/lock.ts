/**
 * Lock file management for `.clancy/lock.json`.
 *
 * Prevents double-runs and provides context for hooks
 * (PostCompact, time guard, cost tracker).
 */
import { join } from 'node:path';

import { z } from 'zod/mini';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Injected filesystem operations for lock file I/O. */
export type LockFs = {
  /** Read a file as UTF-8, throwing if missing. */
  readonly readFile: (path: string) => string;
  /** Write UTF-8 content to a file (creates if missing, overwrites if exists). */
  readonly writeFile: (path: string, content: string) => void;
  /** Delete a file, throwing if missing. */
  readonly deleteFile: (path: string) => void;
  /** Create directory recursively. */
  readonly mkdir: (path: string) => void;
};

const lockDataSchema = z.object({
  pid: z.number(),
  ticketKey: z.string(),
  ticketTitle: z.string(),
  ticketBranch: z.string(),
  targetBranch: z.string(),
  parentKey: z.string(),
  description: z.optional(z.string()),
  startedAt: z.string().check(z.minLength(1)),
});

/** Lock file data — PID, ticket context, and ISO timestamp. */
export type LockData = z.infer<typeof lockDataSchema>;

const CLANCY_DIR = '.clancy';
const LOCK_FILE = 'lock.json';
const LOCK_PATH = `${CLANCY_DIR}/${LOCK_FILE}`;
const VERIFY_ATTEMPT_PATH = `${CLANCY_DIR}/verify-attempt.txt`;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Write lock data to `.clancy/lock.json`.
 *
 * @returns Nothing. Creates the `.clancy` directory if needed.
 */
export function writeLock(
  fs: LockFs,
  projectRoot: string,
  data: LockData,
): void {
  fs.mkdir(join(projectRoot, CLANCY_DIR));
  fs.writeFile(join(projectRoot, LOCK_PATH), JSON.stringify(data, null, 2));
}

/**
 * Read lock data from `.clancy/lock.json`.
 *
 * @returns Parsed lock data, or `undefined` if missing/corrupt/invalid.
 */
export function readLock(
  fs: LockFs,
  projectRoot: string,
): LockData | undefined {
  try {
    const raw: unknown = JSON.parse(fs.readFile(join(projectRoot, LOCK_PATH)));
    const result = lockDataSchema.safeParse(raw);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Delete `.clancy/lock.json`. No-op if the file does not exist.
 *
 * @returns Nothing.
 */
export function deleteLock(fs: LockFs, projectRoot: string): void {
  try {
    fs.deleteFile(join(projectRoot, LOCK_PATH));
  } catch {
    // File may not exist — that's fine
  }
}

/**
 * Check whether a process is still running.
 *
 * Uses signal 0 (no-op) to probe the process. Treats `EPERM` as alive
 * because the process exists but we lack permission to signal it.
 *
 * @returns `true` if the process is alive.
 */
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    // EPERM = process exists but we can't signal it — still alive
    if (err instanceof Error && 'code' in err && err.code === 'EPERM') {
      return true;
    }
    return false;
  }
}

/**
 * Delete `.clancy/verify-attempt.txt`. No-op if the file does not exist.
 *
 * @param fs - Injected filesystem operations.
 * @param projectRoot - The root directory of the project.
 * @returns Nothing.
 */
export function deleteVerifyAttempt(fs: LockFs, projectRoot: string): void {
  try {
    fs.deleteFile(join(projectRoot, VERIFY_ATTEMPT_PATH));
  } catch {
    // File may not exist — that's fine
  }
}

/**
 * Determine whether a lock is stale (safe to reclaim).
 *
 * A lock is stale when its owning PID is dead, when its age exceeds 24 hours
 * (guards against PID reuse), or when its timestamp is invalid.
 *
 * @returns `true` if the lock should be treated as abandoned.
 */
export function isLockStale(lock: LockData): boolean {
  if (!isPidAlive(lock.pid)) return true;

  const lockAge = Date.now() - new Date(lock.startedAt).getTime();
  if (Number.isNaN(lockAge)) return true;
  return lockAge > TWENTY_FOUR_HOURS;
}
