import type { Board, FetchedTicket } from '~/c/types/board.js';

import { describe, expect, it, vi } from 'vitest';

import {
  fetchTicket,
  resolveBuildLabel,
  resolvePlanLabel,
} from './fetch-ticket.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTicket(overrides: Partial<FetchedTicket> = {}): FetchedTicket {
  return {
    key: 'PROJ-10',
    title: 'Test ticket',
    description: 'Description.',
    parentInfo: 'PROJ-1',
    blockers: 'None',
    labels: [],
    ...overrides,
  };
}

function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    ping: vi.fn(() => Promise.resolve({ ok: true })),
    validateInputs: vi.fn(() => undefined),
    fetchTicket: vi.fn(() => Promise.resolve(undefined)),
    fetchTickets: vi.fn(() => Promise.resolve([])),
    fetchBlockerStatus: vi.fn(() => Promise.resolve(false)),
    fetchChildrenStatus: vi.fn(() => Promise.resolve(undefined)),
    transitionTicket: vi.fn(() => Promise.resolve(true)),
    ensureLabel: vi.fn(() => Promise.resolve()),
    addLabel: vi.fn(() => Promise.resolve()),
    removeLabel: vi.fn(() => Promise.resolve()),
    sharedEnv: vi.fn(() => ({})),
    ...overrides,
  };
}

// ─── resolveBuildLabel ──────────────────────────────────────────────────────

describe('resolveBuildLabel', () => {
  it('uses CLANCY_LABEL_BUILD when set', () => {
    expect(resolveBuildLabel({ CLANCY_LABEL_BUILD: 'clancy:build' })).toBe(
      'clancy:build',
    );
  });

  it('falls back to CLANCY_LABEL', () => {
    expect(resolveBuildLabel({ CLANCY_LABEL: 'clancy' })).toBe('clancy');
  });

  it('returns undefined when neither is set', () => {
    expect(resolveBuildLabel({})).toBeUndefined();
  });

  it('prefers CLANCY_LABEL_BUILD over CLANCY_LABEL', () => {
    expect(
      resolveBuildLabel({
        CLANCY_LABEL_BUILD: 'clancy:build',
        CLANCY_LABEL: 'clancy',
      }),
    ).toBe('clancy:build');
  });
});

// ─── resolvePlanLabel ───────────────────────────────────────────────────────

describe('resolvePlanLabel', () => {
  it('uses CLANCY_LABEL_PLAN when set', () => {
    expect(resolvePlanLabel({ CLANCY_LABEL_PLAN: 'clancy:plan' })).toBe(
      'clancy:plan',
    );
  });

  it('falls back to CLANCY_PLAN_LABEL', () => {
    expect(resolvePlanLabel({ CLANCY_PLAN_LABEL: 'needs-plan' })).toBe(
      'needs-plan',
    );
  });

  it('returns undefined when neither is set', () => {
    expect(resolvePlanLabel({})).toBeUndefined();
  });

  it('prefers CLANCY_LABEL_PLAN over CLANCY_PLAN_LABEL', () => {
    expect(
      resolvePlanLabel({
        CLANCY_LABEL_PLAN: 'clancy:plan',
        CLANCY_PLAN_LABEL: 'old-plan',
      }),
    ).toBe('clancy:plan');
  });
});

// ─── fetchTicket ────────────────────────────────────────────────────────────

describe('fetchTicket', () => {
  it('returns first unblocked candidate', async () => {
    const t1 = makeTicket({ key: 'PROJ-10' });
    const t2 = makeTicket({ key: 'PROJ-11' });
    const board = makeBoard({
      fetchTickets: vi.fn(() => Promise.resolve([t1, t2])),
      fetchBlockerStatus: vi.fn(() => Promise.resolve(false)),
    });

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await fetchTicket(board);
    log.mockRestore();

    expect(result).toEqual(t1);
    expect(board.fetchBlockerStatus).toHaveBeenCalledTimes(1);
  });

  it('skips blocked candidate and returns next unblocked', async () => {
    const t1 = makeTicket({ key: 'PROJ-10' });
    const t2 = makeTicket({ key: 'PROJ-11' });
    const board = makeBoard({
      fetchTickets: vi.fn(() => Promise.resolve([t1, t2])),
      fetchBlockerStatus: vi
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
    });

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await fetchTicket(board);
    log.mockRestore();

    expect(result).toEqual(t2);
    expect(board.fetchBlockerStatus).toHaveBeenCalledTimes(2);
  });

  it('returns undefined when all candidates are blocked', async () => {
    const t1 = makeTicket({ key: 'PROJ-10' });
    const board = makeBoard({
      fetchTickets: vi.fn(() => Promise.resolve([t1])),
      fetchBlockerStatus: vi.fn(() => Promise.resolve(true)),
    });

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await fetchTicket(board);
    log.mockRestore();

    expect(result).toBeUndefined();
  });

  it('walks 10 blocked candidates to find the last unblocked one', async () => {
    const blocked = Array.from({ length: 9 }, (_, i) =>
      makeTicket({ key: `PROJ-${i + 1}` }),
    );
    const unblocked = makeTicket({ key: 'PROJ-10' });
    const board = makeBoard({
      fetchTickets: vi.fn(() => Promise.resolve([...blocked, unblocked])),
      fetchBlockerStatus: vi
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
    });

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await fetchTicket(board);
    log.mockRestore();

    expect(result).toEqual(unblocked);
    expect(board.fetchBlockerStatus).toHaveBeenCalledTimes(10);
  });

  it('handles interleaved plan-label and blocked candidates', async () => {
    const plan = makeTicket({ key: 'PROJ-1', labels: ['clancy:plan'] });
    const blocked = makeTicket({ key: 'PROJ-2' });
    const target = makeTicket({ key: 'PROJ-3' });
    const board = makeBoard({
      fetchTickets: vi.fn(() => Promise.resolve([plan, blocked, target])),
      fetchBlockerStatus: vi
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
      sharedEnv: vi.fn(() => ({ CLANCY_LABEL_PLAN: 'clancy:plan' })),
    });

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await fetchTicket(board);
    log.mockRestore();

    expect(result).toEqual(target);
    // Plan ticket skipped without blocker check; blocked and target both checked
    expect(board.fetchBlockerStatus).toHaveBeenCalledTimes(2);
  });

  it('returns undefined when no candidates available', async () => {
    const board = makeBoard({
      fetchTickets: vi.fn(() => Promise.resolve([])),
    });

    const result = await fetchTicket(board);

    expect(result).toBeUndefined();
    expect(board.fetchBlockerStatus).not.toHaveBeenCalled();
  });

  it('passes buildLabel from board env to fetchTickets', async () => {
    const board = makeBoard({
      sharedEnv: vi.fn(() => ({ CLANCY_LABEL_BUILD: 'clancy:build' })),
    });

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await fetchTicket(board);
    log.mockRestore();

    expect(board.fetchTickets).toHaveBeenCalledWith(
      expect.objectContaining({ buildLabel: 'clancy:build' }),
    );
  });

  it('logs selected ticket with status', async () => {
    const t1 = makeTicket({ key: 'PROJ-10', status: 'To Do' });
    const board = makeBoard({
      fetchTickets: vi.fn(() => Promise.resolve([t1])),
      fetchBlockerStatus: vi.fn(() => Promise.resolve(false)),
    });

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await fetchTicket(board);

    expect(log).toHaveBeenCalledWith('Selected PROJ-10 (status: To Do)');
    log.mockRestore();
  });

  it('logs selected ticket without status when absent', async () => {
    const t1 = makeTicket({ key: 'PROJ-10', status: undefined });
    const board = makeBoard({
      fetchTickets: vi.fn(() => Promise.resolve([t1])),
      fetchBlockerStatus: vi.fn(() => Promise.resolve(false)),
    });

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await fetchTicket(board);

    expect(log).toHaveBeenCalledWith('Selected PROJ-10');
    log.mockRestore();
  });
});

// ─── Plan label guard ───────────────────────────────────────────────────────

describe('fetchTicket — plan label guard', () => {
  it('skips candidate with plan label', async () => {
    const planTicket = makeTicket({
      key: 'PROJ-10',
      labels: ['clancy:build', 'clancy:plan'],
    });
    const cleanTicket = makeTicket({
      key: 'PROJ-11',
      labels: ['clancy:build'],
    });
    const board = makeBoard({
      fetchTickets: vi.fn(() => Promise.resolve([planTicket, cleanTicket])),
      fetchBlockerStatus: vi.fn(() => Promise.resolve(false)),
      sharedEnv: vi.fn(() => ({ CLANCY_LABEL_PLAN: 'clancy:plan' })),
    });

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await fetchTicket(board);
    log.mockRestore();

    expect(result).toEqual(cleanTicket);
  });

  it('does not check blockers for plan-label tickets', async () => {
    const planTicket = makeTicket({
      key: 'PROJ-10',
      labels: ['clancy:plan'],
    });
    const cleanTicket = makeTicket({ key: 'PROJ-11' });
    const board = makeBoard({
      fetchTickets: vi.fn(() => Promise.resolve([planTicket, cleanTicket])),
      fetchBlockerStatus: vi.fn(() => Promise.resolve(false)),
      sharedEnv: vi.fn(() => ({ CLANCY_LABEL_PLAN: 'clancy:plan' })),
    });

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await fetchTicket(board);
    log.mockRestore();

    expect(board.fetchBlockerStatus).toHaveBeenCalledTimes(1);
    expect(board.fetchBlockerStatus).toHaveBeenCalledWith(cleanTicket);
  });

  it('returns candidate when no plan label is configured', async () => {
    const ticket = makeTicket({
      key: 'PROJ-10',
      labels: ['clancy:build', 'some-label'],
    });
    const board = makeBoard({
      fetchTickets: vi.fn(() => Promise.resolve([ticket])),
      fetchBlockerStatus: vi.fn(() => Promise.resolve(false)),
      sharedEnv: vi.fn(() => ({})),
    });

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await fetchTicket(board);
    log.mockRestore();

    expect(result).toEqual(ticket);
  });

  it('returns undefined when all candidates have plan label', async () => {
    const planTicket = makeTicket({
      key: 'PROJ-10',
      labels: ['clancy:plan'],
    });
    const board = makeBoard({
      fetchTickets: vi.fn(() => Promise.resolve([planTicket])),
      sharedEnv: vi.fn(() => ({ CLANCY_LABEL_PLAN: 'clancy:plan' })),
    });

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await fetchTicket(board);
    log.mockRestore();

    expect(result).toBeUndefined();
  });

  it('uses CLANCY_PLAN_LABEL fallback', async () => {
    const planTicket = makeTicket({
      key: 'PROJ-10',
      labels: ['needs-refinement'],
    });
    const cleanTicket = makeTicket({ key: 'PROJ-11', labels: ['clancy'] });
    const board = makeBoard({
      fetchTickets: vi.fn(() => Promise.resolve([planTicket, cleanTicket])),
      fetchBlockerStatus: vi.fn(() => Promise.resolve(false)),
      sharedEnv: vi.fn(() => ({ CLANCY_PLAN_LABEL: 'needs-refinement' })),
    });

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await fetchTicket(board);
    log.mockRestore();

    expect(result).toEqual(cleanTicket);
  });
});

// ─── AFK mode ───────────────────────────────────────────────────────────────

describe('fetchTicket — AFK mode', () => {
  it('passes excludeHitl=true when opts.isAfk is true', async () => {
    const board = makeBoard();

    await fetchTicket(board, { isAfk: true });

    expect(board.fetchTickets).toHaveBeenCalledWith(
      expect.objectContaining({ excludeHitl: true }),
    );
  });

  it('passes excludeHitl=false in interactive mode', async () => {
    const board = makeBoard();

    await fetchTicket(board);

    expect(board.fetchTickets).toHaveBeenCalledWith(
      expect.objectContaining({ excludeHitl: false }),
    );
  });

  it('reads CLANCY_AFK_MODE from board sharedEnv', async () => {
    const board = makeBoard({
      sharedEnv: vi.fn(() => ({ CLANCY_AFK_MODE: '1' })),
    });

    await fetchTicket(board);

    expect(board.fetchTickets).toHaveBeenCalledWith(
      expect.objectContaining({ excludeHitl: true }),
    );
  });

  it('opts.isAfk takes precedence over env var', async () => {
    const board = makeBoard({
      sharedEnv: vi.fn(() => ({ CLANCY_AFK_MODE: '1' })),
    });

    await fetchTicket(board, { isAfk: false });

    expect(board.fetchTickets).toHaveBeenCalledWith(
      expect.objectContaining({ excludeHitl: false }),
    );
  });

  it('propagates error when fetchTickets throws', async () => {
    const board = makeBoard({
      fetchTickets: vi.fn(() => Promise.reject(new Error('network error'))),
    });

    await expect(fetchTicket(board)).rejects.toThrow('network error');
  });

  it('propagates error when fetchBlockerStatus throws', async () => {
    const t1 = makeTicket({ key: 'PROJ-10' });
    const board = makeBoard({
      fetchTickets: vi.fn(() => Promise.resolve([t1])),
      fetchBlockerStatus: vi.fn(() =>
        Promise.reject(new Error('auth failure')),
      ),
    });

    await expect(fetchTicket(board)).rejects.toThrow('auth failure');
  });
});
