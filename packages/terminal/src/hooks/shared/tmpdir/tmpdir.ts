/**
 * Tmpdir path builders for hook state files.
 *
 * Hooks use `os.tmpdir()` for inter-hook communication (bridge files),
 * debounce state (warned files), and once-per-session flags (drift flags).
 * All paths are keyed by a sanitised session ID.
 */
import type { TmpdirDeps } from '../types.js';

import { join } from 'node:path';

/**
 * Sanitise a session ID for use in filesystem paths.
 *
 * Strips all characters except alphanumerics, hyphens, and underscores.
 *
 * @param session - The raw session ID from Claude Code.
 * @returns A filesystem-safe string.
 */
export function safeSessionId(session: string): string {
  return String(session).replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Build the bridge file path for a given session.
 *
 * The bridge file is written by the statusline hook and read by the
 * context monitor to share context usage metrics between hooks.
 *
 * @param session - The raw session ID.
 * @param deps - Tmpdir provider.
 * @returns Absolute path to the bridge JSON file.
 */
export function bridgePath(session: string, deps: TmpdirDeps): string {
  return join(deps.tmpdir(), `clancy-ctx-${safeSessionId(session)}.json`);
}

/**
 * Build the debounce state file path for a given session.
 *
 * The context monitor writes debounce counters here to avoid
 * firing warnings on every single tool use.
 *
 * @param session - The raw session ID.
 * @param deps - Tmpdir provider.
 * @returns Absolute path to the debounce state JSON file.
 */
export function debouncePath(session: string, deps: TmpdirDeps): string {
  return join(
    deps.tmpdir(),
    `clancy-ctx-${safeSessionId(session)}-warned.json`,
  );
}

/**
 * Build the drift detector flag path for a given session.
 *
 * A sentinel file — its existence means the drift check already
 * ran for this session.
 *
 * @param session - The raw session ID.
 * @param deps - Tmpdir provider.
 * @returns Absolute path to the drift flag file.
 */
export function driftFlagPath(session: string, deps: TmpdirDeps): string {
  return join(deps.tmpdir(), `clancy-drift-${safeSessionId(session)}`);
}
