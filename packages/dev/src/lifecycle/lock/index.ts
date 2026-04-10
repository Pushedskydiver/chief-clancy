export type { LockData, LockFs } from './lock.js';
export {
  deleteLock,
  deleteVerifyAttempt,
  isLockStale,
  readLock,
  writeLock,
} from './lock.js';
