/**
 * Local-mode infrastructure for `--from` plan execution.
 *
 * Provides a no-op board stub, synthetic board config, and a local
 * preflight that wires them into the pipeline context so all downstream
 * phases work unchanged.
 */
import type { EnvFileSystem } from '@chief-clancy/core';
import type { BoardConfig } from '@chief-clancy/core/schemas/env/env.js';
import type { Board } from '@chief-clancy/core/types/board.js';
import type { RunContext } from '~/d/pipeline/context.js';

import { loadClancyEnv } from '@chief-clancy/core';

// ─── createNoopBoard ─────────────────────────────────────────────────────────

/**
 * Create a no-op {@link Board} stub implementing all 11 methods with safe defaults.
 *
 * All API-calling methods resolve silently. The stub absorbs every board
 * call so downstream phases work unchanged in local mode.
 *
 * @returns A Board where all methods return safe no-op values.
 */
export function createNoopBoard(): Board {
  return {
    ping: () => Promise.resolve({ ok: true }),
    validateInputs: () => undefined,
    fetchTicket: () => Promise.resolve(undefined),
    fetchTickets: () => Promise.resolve([]),
    fetchBlockerStatus: () => Promise.resolve(false),
    fetchChildrenStatus: () => Promise.resolve(undefined),
    transitionTicket: () => Promise.resolve(true),
    ensureLabel: () => Promise.resolve(),
    addLabel: () => Promise.resolve(),
    removeLabel: () => Promise.resolve(),
    sharedEnv: () => ({}),
  };
}

// ─── createLocalConfig ───────────────────────────────────────────────────────

/** Keys from `.clancy/.env` to pass through to the synthetic config. */
const GIT_PASSTHROUGH_KEYS = [
  'GITHUB_TOKEN',
  'GITLAB_TOKEN',
  'BITBUCKET_USER',
  'BITBUCKET_TOKEN',
  'AZDO_PAT',
  'CLANCY_GIT_PLATFORM',
  'CLANCY_GIT_API_URL',
] as const;

/** Pick defined values for the passthrough keys from an env record. */
function pickGitEnv(envFile: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    GIT_PASSTHROUGH_KEYS.filter((k) => envFile[k]).map((k) => [k, envFile[k]]),
  );
}

/**
 * Create a synthetic {@link BoardConfig} for local-mode execution.
 *
 * Uses `'shortcut'` as the provider (minimal required fields, clean
 * `feature/{key}` branch names, generic PR body). The API token is a
 * `'local-mode'` sentinel that never hits the network — the no-op board
 * absorbs all calls.
 *
 * @param opts - Optional env file contents for git host token passthrough.
 * @returns A BoardConfig with shortcut provider and optional git tokens.
 */
export function createLocalConfig(opts?: {
  readonly envFile?: Record<string, string>;
}): BoardConfig {
  const envFile = opts?.envFile ?? {};

  return {
    provider: 'shortcut',
    env: {
      SHORTCUT_API_TOKEN: 'local-mode',
      CLANCY_BASE_BRANCH:
        envFile['CLANCY_BASE_BRANCH'] ??
        process.env['CLANCY_BASE_BRANCH'] ??
        'main',
      ...pickGitEnv(envFile),
    },
  };
}

// ─── runLocalPreflight ───────────────────────────────────────────────────────

/**
 * Run a local-mode preflight that wires synthetic config + no-op board
 * into the pipeline context.
 *
 * Reads `.clancy/.env` via `envFs` (best-effort — missing file is not an
 * error) to pick up git host tokens for PR creation. Board-specific
 * credentials are ignored; the no-op board absorbs all API calls.
 *
 * @param ctx - Pipeline run context to populate.
 * @param opts - Filesystem and project root for env file reading.
 */
export function runLocalPreflight(
  ctx: RunContext,
  opts: { readonly envFs: EnvFileSystem; readonly projectRoot: string },
): void {
  const envFile = loadClancyEnv(opts.projectRoot, opts.envFs);
  const config = createLocalConfig({ envFile: envFile ?? undefined });
  const board = createNoopBoard();
  ctx.setPreflight(config, board);
}
