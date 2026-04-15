/**
 * Filesystem safety guards shared across installer modules.
 */
import { lstatSync } from 'node:fs';

import { hasErrorCode } from './fs-errors.js';

/** Throw if `path` does not exist (checked via the injected `exists`). */
export const requirePath = (
  label: string,
  path: string,
  exists: (p: string) => boolean,
): void => {
  if (!exists(path)) throw new Error(`${label} not found: ${path}`);
};

/** Validate all-or-none optional source dirs and require each path if present. */
export const validateOptionalDirs = (
  label: string,
  dirs: readonly (string | undefined)[],
  exists: (path: string) => boolean,
): void => {
  const defined = dirs.filter(Boolean) as string[];

  if (defined.length > 0 && defined.length < dirs.length) {
    throw new Error(
      `${label} source dirs must be all-or-none — some are missing.`,
    );
  }

  defined.forEach((dir) => requirePath(`${label} source`, dir, exists));
};

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
