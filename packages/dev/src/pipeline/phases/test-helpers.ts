/**
 * Shared test helpers for pipeline phase tests.
 *
 * Prevents mock drift across test files when the Board type changes.
 */
import type { BoardConfig } from '~/c/schemas/env/env.js';
import type { Board } from '~/c/types/board.js';

import { vi } from 'vitest';

import { RunContext } from '../context.js';

/** Create a stub Board with all methods mocked. */
export function makeBoard(): Board {
  return {
    fetchChildrenStatus: vi.fn(),
    fetchTicket: vi.fn(),
    fetchTickets: vi.fn(),
    fetchBlockerStatus: vi.fn(),
    transitionTicket: vi.fn(),
    addLabel: vi.fn(),
    removeLabel: vi.fn(),
    ensureLabel: vi.fn(),
    validateInputs: vi.fn(),
    ping: vi.fn(),
    sharedEnv: vi.fn(),
  };
}

/** Build a minimal valid BoardConfig for the given provider. */
export function makeBoardConfig(
  provider: BoardConfig['provider'],
  envOverrides?: Record<string, string>,
): BoardConfig {
  const base = { ...envOverrides };

  switch (provider) {
    case 'github':
      return {
        provider,
        env: { GITHUB_TOKEN: 'ghp_test', GITHUB_REPO: 'org/repo', ...base },
      };
    case 'jira':
      return {
        provider,
        env: {
          JIRA_BASE_URL: 'https://jira.test',
          JIRA_USER: 'user@test',
          JIRA_API_TOKEN: 'tok',
          JIRA_PROJECT_KEY: 'PROJ',
          ...base,
        },
      };
    case 'linear':
      return {
        provider,
        env: { LINEAR_API_KEY: 'lin_test', LINEAR_TEAM_ID: 'TEAM', ...base },
      };
    case 'shortcut':
      return { provider, env: { SHORTCUT_API_TOKEN: 'sc_test', ...base } };
    case 'notion':
      return {
        provider,
        env: {
          NOTION_TOKEN: 'ntn_test',
          NOTION_DATABASE_ID: 'db-id',
          ...base,
        },
      };
    case 'azdo':
      return {
        provider,
        env: {
          AZDO_ORG: 'test-org',
          AZDO_PAT: 'pat',
          AZDO_PROJECT: 'proj',
          ...base,
        },
      };
  }
}

/**
 * Create a RunContext with preflight already populated.
 *
 * @param opts - Optional overrides for config env and provider.
 * @returns A RunContext ready for phase testing.
 */
export function makeCtx(
  opts: {
    readonly argv?: readonly string[];
    readonly provider?: BoardConfig['provider'];
    readonly configEnv?: Record<string, string>;
  } = {},
): RunContext {
  const ctx = new RunContext({
    projectRoot: '/repo',
    argv: opts.argv ?? [],
  });

  const config = makeBoardConfig(opts.provider ?? 'github', opts.configEnv);

  ctx.setPreflight(config, makeBoard());

  return ctx;
}
