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
function makeBoard(): Board {
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

/**
 * Create a RunContext with preflight already populated.
 *
 * @param opts - Optional overrides for config env and provider.
 * @returns A RunContext ready for phase testing.
 */
export function makeCtx(
  opts: {
    readonly argv?: readonly string[];
    readonly provider?: string;
    readonly configEnv?: Record<string, string>;
  } = {},
): RunContext {
  const ctx = new RunContext({
    projectRoot: '/repo',
    argv: opts.argv ?? [],
  });

  ctx.setPreflight(
    {
      provider: opts.provider ?? 'github',
      env: { GITHUB_TOKEN: 'ghp_test', ...opts.configEnv },
    } as BoardConfig,
    makeBoard(),
  );

  return ctx;
}
