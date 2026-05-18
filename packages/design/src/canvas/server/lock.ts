import { readFileSync, unlinkSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export class CanvasLockError extends Error {
  constructor(message = 'Canvas server already running.') {
    super(
      `${message} Stop it with Ctrl-C in the other terminal, or remove .clancy/design/.lock if the process is gone.`,
    );
    this.name = 'CanvasLockError';
  }
}

type AcquireCanvasLockOptions = {
  readonly projectRoot: string;
  readonly sessionId: string;
  readonly pid?: number;
  readonly now?: Date;
  readonly processExists?: (pid: number) => boolean;
};

export type CanvasLock = {
  readonly lockPath: string;
  readonly release: () => Promise<void>;
  readonly releaseSync: () => void;
};

type CanvasLockPayload = {
  readonly pid: number;
  readonly sessionId: string;
  readonly startedAt: string;
};

const LOCK_PATH = join('.clancy', 'design', '.lock');
const STALE_LOCK_MS = 24 * 60 * 60 * 1000;

const isNodeError = (err: unknown): err is NodeJS.ErrnoException =>
  err instanceof Error && 'code' in err;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isCanvasLockPayload = (value: unknown): value is CanvasLockPayload => {
  if (!isRecord(value)) return false;
  const { pid, sessionId, startedAt } = value;
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  if (typeof sessionId !== 'string' || sessionId.length === 0) return false;
  if (typeof startedAt !== 'string') return false;
  return Number.isFinite(new Date(startedAt).getTime());
};

type LockStatus =
  | { readonly kind: 'absent' }
  | { readonly kind: 'active' }
  | { readonly kind: 'stale'; readonly observedText: string };

const probeLockStatus = async (
  lockPath: string,
  processExists: (pid: number) => boolean,
  now: Date,
): Promise<LockStatus> => {
  try {
    const observedText = await readFile(lockPath, 'utf8');
    const parsed = JSON.parse(observedText) as unknown;
    if (!isCanvasLockPayload(parsed)) return { kind: 'active' };

    const ageMs = now.getTime() - new Date(parsed.startedAt).getTime();
    if (ageMs > STALE_LOCK_MS) return { kind: 'stale', observedText };
    return processExists(parsed.pid)
      ? { kind: 'active' }
      : { kind: 'stale', observedText };
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') return { kind: 'absent' };
    return { kind: 'active' };
  }
};

const removeMatchingLock = async (
  lockPath: string,
  expectedText: string,
): Promise<boolean> => {
  // Re-read before rm so we don't nuke a lock that a concurrent process
  // re-acquired between our staleness probe and this cleanup step.
  try {
    const current = await readFile(lockPath, 'utf8');
    if (current !== expectedText) return false;
    await rm(lockPath, { force: true });
    return true;
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') return true;
    throw err;
  }
};

const defaultProcessExists = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return !(isNodeError(err) && err.code === 'ESRCH');
  }
};

const serializeLockPayload = (payload: CanvasLockPayload): string =>
  JSON.stringify(payload, null, 2) + '\n';

const writeLockFile = async (
  lockPath: string,
  payloadText: string,
): Promise<'created' | 'exists'> => {
  try {
    await writeFile(lockPath, payloadText, {
      encoding: 'utf8',
      flag: 'wx',
    });
    return 'created';
  } catch (err) {
    if (isNodeError(err) && err.code === 'EEXIST') return 'exists';
    throw err;
  }
};

const releaseOwnedLock = async (
  lockPath: string,
  payloadText: string,
): Promise<void> => {
  try {
    const current = await readFile(lockPath, 'utf8');
    if (current === payloadText) await rm(lockPath, { force: true });
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') return;
    throw err;
  }
};

const releaseOwnedLockSync = (lockPath: string, payloadText: string): void => {
  try {
    const current = readFileSync(lockPath, 'utf8');
    if (current === payloadText) unlinkSync(lockPath);
  } catch {
    // Best-effort synchronous cleanup for process signals.
  }
};

export const acquireCanvasLock = async (
  options: AcquireCanvasLockOptions,
): Promise<CanvasLock> => {
  const lockPath = join(options.projectRoot, LOCK_PATH);
  const now = options.now ?? new Date();
  const processExists = options.processExists ?? defaultProcessExists;

  await mkdir(join(options.projectRoot, '.clancy', 'design'), {
    recursive: true,
  });

  const payload = {
    pid: options.pid ?? process.pid,
    sessionId: options.sessionId,
    startedAt: now.toISOString(),
  };
  const payloadText = serializeLockPayload(payload);
  const firstWrite = await writeLockFile(lockPath, payloadText);
  if (firstWrite === 'exists') {
    const status = await probeLockStatus(lockPath, processExists, now);
    if (status.kind === 'active') throw new CanvasLockError();
    if (status.kind === 'stale') {
      const removed = await removeMatchingLock(lockPath, status.observedText);
      if (!removed)
        throw new CanvasLockError('Canvas server started concurrently.');
    }
    const retryWrite = await writeLockFile(lockPath, payloadText);
    if (retryWrite === 'exists') {
      throw new CanvasLockError('Canvas server started concurrently.');
    }
  }

  return {
    lockPath,
    release: async () => {
      await releaseOwnedLock(lockPath, payloadText);
    },
    releaseSync: () => {
      releaseOwnedLockSync(lockPath, payloadText);
    },
  };
};
