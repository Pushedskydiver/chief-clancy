/**
 * Role-based file filtering for the installer.
 *
 * Copies command/workflow files from role directories into a shared destination,
 * applying core vs optional role filtering. Disabled optional roles have their
 * previously-installed files removed.
 */
import { mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

import { copyDir } from '~/t/installer/file-ops/file-ops.js';
import { hasErrorCode } from '~/t/installer/shared/fs-errors/index.js';

/** Roles that are always installed regardless of CLANCY_ROLES. */
const CORE_ROLES = new Set(['implementer', 'reviewer', 'setup']);

/** Options for copying role files. */
type CopyRoleFilesOptions = {
  /** The roles source directory (e.g. `src/roles/`). */
  readonly rolesDir: string;
  /** The subdirectory within each role (`commands` or `workflows`). */
  readonly subdir: string;
  /** The shared destination directory (all roles merge into this). */
  readonly dest: string;
  /** Set of enabled optional roles, or `null` to install all (first install). */
  readonly enabledRoles: ReadonlySet<string> | null;
};

/** Check whether a role should be installed. */
function shouldInstallRole(
  roleName: string,
  enabledRoles: ReadonlySet<string> | null,
): boolean {
  if (CORE_ROLES.has(roleName)) return true;

  return enabledRoles === null || enabledRoles.has(roleName);
}

/** Silently unlink a file, ignoring ENOENT if it no longer exists. */
function safeUnlink(filePath: string): void {
  try {
    unlinkSync(filePath);
  } catch (err: unknown) {
    if (!hasErrorCode(err, 'ENOENT')) throw err;
  }
}

/** Remove previously-installed files for a disabled role. */
function cleanDisabledFiles(srcDir: string, dest: string): void {
  readdirSync(srcDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .forEach((entry) => {
      safeUnlink(join(dest, entry.name));
    });
}

/** Try to read a directory, returning null if it doesn't exist or isn't a directory. */
function safeReaddir(dir: string): readonly string[] | null {
  try {
    return readdirSync(dir);
  } catch (err: unknown) {
    const isMissingDir = hasErrorCode(err, 'ENOENT');
    const isNotDirectory = hasErrorCode(err, 'ENOTDIR');

    if (isMissingDir || isNotDirectory) return null;

    throw err;
  }
}

/**
 * Copy files from role subdirectories into a shared destination directory.
 *
 * Walks `rolesDir/{role}/{subdir}/` for each role and merges contents
 * into `dest` (no per-role subdirectories). Core roles (implementer, reviewer, setup) are always
 * copied. Optional roles are only copied if listed in `enabledRoles`,
 * or if `enabledRoles` is `null` (first install — install all).
 *
 * Files for disabled optional roles are removed from the destination
 * based on the current source tree. If a role's subdir is missing,
 * no cleanup occurs (we can't know what to remove).
 *
 * Filenames must be unique across all roles — if two roles define the same
 * filename, the last one copied wins silently. This is enforced by convention
 * in the role directory structure, not at runtime.
 *
 * @param options - The role filter options.
 */
export function copyRoleFiles(options: CopyRoleFilesOptions): void {
  const { rolesDir, subdir, dest, enabledRoles } = options;

  mkdirSync(dest, { recursive: true });

  const roles = readdirSync(rolesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  roles.forEach((role) => {
    const srcDir = join(rolesDir, role.name, subdir);

    if (safeReaddir(srcDir) === null) return;

    if (shouldInstallRole(role.name, enabledRoles)) {
      copyDir(srcDir, dest);
      return;
    }

    cleanDisabledFiles(srcDir, dest);
  });
}
