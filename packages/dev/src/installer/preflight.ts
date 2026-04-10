/**
 * Three-state install preflight for `@chief-clancy/dev`.
 *
 * Classifies the installation context as standalone, standalone+board,
 * or terminal by probing the same files as approve-plan / approve-brief.
 */
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The three installation states. */
export type DevInstallState = 'standalone' | 'standalone-board' | 'terminal';

/** Minimal file-system interface for preflight probes. */
type PreflightFs = {
  /** Return `true` if the path exists (file or directory). */
  readonly exists: (path: string) => boolean;
};

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Detect the installation state by probing `.clancy/.env` and
 * `.clancy/clancy-implement.js`.
 *
 * - **standalone**: no `.clancy/.env` — no board credentials configured.
 * - **standalone-board**: `.clancy/.env` present, no `clancy-implement.js` —
 *   board credentials available but full pipeline not installed.
 * - **terminal**: both present — full Clancy pipeline installed.
 *
 * @param cwd - The current working directory (project root).
 * @param fs - File-system operations (injectable for testing).
 */
export const detectDevInstallState = (
  cwd: string,
  fs: PreflightFs,
): DevInstallState => {
  const clancyDir = join(cwd, '.clancy');

  if (!fs.exists(join(clancyDir, '.env'))) return 'standalone';
  if (!fs.exists(join(clancyDir, 'clancy-implement.js')))
    return 'standalone-board';

  return 'terminal';
};
