/**
 * Source directory validation for the terminal installer.
 *
 * Guards against a corrupted npm package by checking that all required
 * source directories and bundle scripts exist before installation begins.
 */
import type { InstallSources } from './install.js';

import { join } from 'node:path';

import {
  requirePath,
  validateOptionalDirs,
} from '~/t/installer/shared/fs-guards.js';

import { BUNDLE_SCRIPTS } from './install.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate that all required source directories and files exist.
 *
 * Guards against a corrupted npm package. Throws on the first missing path.
 * `agentsDir` is intentionally not validated — the verification gate prompt
 * is read best-effort in the hook installer and skipped if missing.
 *
 * @param sources - The source directories to check.
 * @param exists - File existence check (injected for testability).
 */
export function validateSources(
  sources: InstallSources,
  exists: (path: string) => boolean,
): void {
  requirePath('Roles source', sources.rolesDir, exists);
  requirePath('Hooks source', sources.hooksDir, exists);
  requirePath('Runtime bundles source', sources.bundleDir, exists);

  BUNDLE_SCRIPTS.forEach((script) => {
    requirePath(
      `Bundled script ${script}`,
      join(sources.bundleDir, script),
      exists,
    );
  });

  const optionalGroups: ReadonlyArray<
    [string, ReadonlyArray<string | undefined>]
  > = [
    [
      'Brief',
      [
        sources.briefCommandsDir,
        sources.briefWorkflowsDir,
        sources.briefAgentsDir,
      ],
    ],
    ['Plan', [sources.planCommandsDir, sources.planWorkflowsDir]],
    [
      'Scan',
      [
        sources.scanAgentsDir,
        sources.scanCommandsDir,
        sources.scanWorkflowsDir,
      ],
    ],
  ];
  optionalGroups.forEach(([label, dirs]) =>
    validateOptionalDirs(label, dirs, exists),
  );
}
