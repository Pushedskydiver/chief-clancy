import type { PreflightPhaseDeps } from './preflight-phase.js';
import type { BoardConfig } from '@chief-clancy/core/schemas/env/env.js';
import type { Board } from '@chief-clancy/core/types/board.js';

import { describe, expect, it, vi } from 'vitest';

import { createContext } from '../../context.js';
import { preflightPhase } from './preflight-phase.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    ping: vi.fn(async () => ({ ok: true })),
    validateInputs: vi.fn(() => undefined),
    fetchTicket: async () => undefined,
    fetchTickets: async () => [],
    fetchBlockerStatus: async () => false,
    fetchChildrenStatus: async () => undefined,
    transitionTicket: async () => true,
    ensureLabel: async () => undefined,
    addLabel: async () => undefined,
    removeLabel: async () => undefined,
    sharedEnv: () => ({}),
    ...overrides,
  };
}

function makeDeps(
  overrides: Partial<PreflightPhaseDeps> = {},
): PreflightPhaseDeps {
  return {
    runPreflight: vi.fn(() => ({
      ok: true,
      env: { CLANCY_BOARD: 'github', CLANCY_BOARD_TOKEN: 'tok' },
      error: undefined,
      warning: undefined,
    })),
    detectBoard: vi.fn(
      () => ({ provider: 'github' as const, env: {} }) as BoardConfig,
    ),
    createBoard: vi.fn(() => makeBoard()),
    ...overrides,
  };
}

function makeCtx() {
  return createContext({ projectRoot: '/project', argv: [] });
}

// ─── preflightPhase ──────────────────────────────────────────────────────────

describe('preflightPhase', () => {
  it('sets ctx.config and ctx.board on success', async () => {
    const ctx = makeCtx();
    const board = makeBoard();
    const deps = makeDeps({ createBoard: vi.fn(() => board) });

    const result = await preflightPhase(ctx, deps);

    expect(result.ok).toBe(true);
    expect(ctx.config).toBeDefined();
    expect(ctx.board).toBe(board);
  });

  it('returns error when preflight fails', async () => {
    const deps = makeDeps({
      runPreflight: vi.fn(() => ({
        ok: false,
        env: undefined,
        error: 'git not found',
        warning: undefined,
      })),
    });

    const result = await preflightPhase(makeCtx(), deps);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('git not found');
  });

  it('returns error when detectBoard fails', async () => {
    const deps = makeDeps({
      detectBoard: vi.fn(() => 'Unknown board provider'),
    });

    const result = await preflightPhase(makeCtx(), deps);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Unknown board');
  });

  it('returns error when board validation fails', async () => {
    const board = makeBoard({
      validateInputs: vi.fn(() => 'Missing JIRA_BASE_URL'),
    });
    const deps = makeDeps({ createBoard: vi.fn(() => board) });

    const result = await preflightPhase(makeCtx(), deps);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('JIRA_BASE_URL');
  });

  it('returns error when board ping fails', async () => {
    const board = makeBoard({
      ping: vi.fn(async () => ({ ok: false, error: 'Connection refused' })),
    });
    const deps = makeDeps({ createBoard: vi.fn(() => board) });

    const result = await preflightPhase(makeCtx(), deps);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Connection refused');
  });

  it('passes preflight warning through on success', async () => {
    const deps = makeDeps({
      runPreflight: vi.fn(() => ({
        ok: true,
        env: { CLANCY_BOARD: 'github', CLANCY_BOARD_TOKEN: 'tok' },
        error: undefined,
        warning: 'Could not reach origin',
      })),
    });

    const result = await preflightPhase(makeCtx(), deps);

    expect(result.ok).toBe(true);
    expect(result.warning).toContain('origin');
  });

  it('returns error when preflight passes but env is missing', async () => {
    const deps = makeDeps({
      runPreflight: vi.fn(() => ({
        ok: true,
        env: undefined,
        error: undefined,
        warning: undefined,
      })),
    });

    const result = await preflightPhase(makeCtx(), deps);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('env is missing');
  });

  it('does not set ctx.config or ctx.board on failure', async () => {
    const ctx = makeCtx();
    const deps = makeDeps({
      runPreflight: vi.fn(() => ({
        ok: false,
        env: undefined,
        error: 'failed',
        warning: undefined,
      })),
    });

    await preflightPhase(ctx, deps);

    expect(ctx.config).toBeUndefined();
    expect(ctx.board).toBeUndefined();
  });

  it('passes projectRoot to runPreflight', async () => {
    const ctx = createContext({ projectRoot: '/my/project', argv: [] });
    const deps = makeDeps();

    await preflightPhase(ctx, deps);

    expect(deps.runPreflight).toHaveBeenCalledWith('/my/project');
  });
});
