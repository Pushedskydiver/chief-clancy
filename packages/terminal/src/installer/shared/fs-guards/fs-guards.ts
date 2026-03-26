/**
 * Filesystem safety guards shared across installer modules.
 */
import { lstatSync } from 'node:fs';

import { hasErrorCode } from '../fs-errors/fs-errors.js';

/** Throw if the given path is a symlink. Only swallows ENOENT. */
export function rejectSymlink(path: string): void {
  try {
    if (lstatSync(path).isSymbolicLink()) {
      throw new Error(`${path} is a symlink. Remove it before installing.`);
    }
  } catch (err: unknown) {
    if (!hasErrorCode(err, 'ENOENT')) throw err;
  }
}
