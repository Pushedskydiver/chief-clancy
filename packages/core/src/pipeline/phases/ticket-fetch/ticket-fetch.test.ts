import type { TicketFetchDeps } from './ticket-fetch.js';
import type { FetchedTicket } from '~/c/types/board.js';

import { describe, expect, it, vi } from 'vitest';

import { makeCtx } from '../test-helpers.js';
import { ticketFetch } from './ticket-fetch.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TICKET: FetchedTicket = {
  key: '#42',
  title: 'Add login page',
  description: 'Build a login form',
  parentInfo: '#100',
  blockers: 'None',
};

const NO_PARENT_TICKET: FetchedTicket = {
  key: '#42',
  title: 'Add login page',
  description: '',
  parentInfo: 'none',
  blockers: 'None',
};

function makeDeps(overrides: Partial<TicketFetchDeps> = {}): TicketFetchDeps {
  return {
    fetchTicket: vi.fn(() => Promise.resolve(TICKET)),
    countReworkCycles: vi.fn(() => 0),
    appendProgress: vi.fn(),
    computeTicketBranch: vi.fn(() => 'feature/issue-42'),
    computeTargetBranch: vi.fn(() => 'epic/100'),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ticketFetch', () => {
  it('fetches a fresh ticket when ctx.ticket is not set', async () => {
    const ctx = makeCtx();
    const deps = makeDeps();

    const result = await ticketFetch(ctx, deps);

    expect(result.ok).toBe(true);
    expect(deps.fetchTicket).toHaveBeenCalledWith(ctx.board);
    expect(ctx.ticket).toBe(TICKET);
  });

  it('skips fetch when ctx.ticket is already set (rework)', async () => {
    const ctx = makeCtx();
    ctx.setTicket(TICKET);
    const deps = makeDeps();

    const result = await ticketFetch(ctx, deps);

    expect(result.ok).toBe(true);
    expect(deps.fetchTicket).not.toHaveBeenCalled();
  });

  it('returns ok: false with no-tickets when fetchTicket returns undefined', async () => {
    const ctx = makeCtx();
    const deps = makeDeps({
      fetchTicket: vi.fn(() => Promise.resolve(undefined)),
    });

    const result = await ticketFetch(ctx, deps);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no-tickets');
  });

  it('applies max rework guard and skips when limit reached', async () => {
    const ctx = makeCtx({
      configEnv: { CLANCY_MAX_REWORK: '2' },
    });
    ctx.setTicket(TICKET);
    ctx.setRework({ isRework: true });
    const deps = makeDeps({
      countReworkCycles: vi.fn(() => 2),
    });

    const result = await ticketFetch(ctx, deps);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('max-rework');
    expect(deps.appendProgress).toHaveBeenCalledWith(
      expect.objectContaining({ key: '#42', status: 'SKIPPED' }),
    );
  });

  it('allows rework when cycles below max', async () => {
    const ctx = makeCtx({
      configEnv: { CLANCY_MAX_REWORK: '3' },
    });
    ctx.setTicket(TICKET);
    ctx.setRework({ isRework: true });
    const deps = makeDeps({
      countReworkCycles: vi.fn(() => 2),
    });

    const result = await ticketFetch(ctx, deps);

    expect(result.ok).toBe(true);
  });

  it('defaults max rework to 3 when env var not set', async () => {
    const ctx = makeCtx();
    ctx.setTicket(TICKET);
    ctx.setRework({ isRework: true });
    const deps = makeDeps({
      countReworkCycles: vi.fn(() => 3),
    });

    const result = await ticketFetch(ctx, deps);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('max-rework');
  });

  it('blocks all rework when CLANCY_MAX_REWORK is 0', async () => {
    const ctx = makeCtx({ configEnv: { CLANCY_MAX_REWORK: '0' } });
    ctx.setTicket(TICKET);
    ctx.setRework({ isRework: true });
    const deps = makeDeps({
      countReworkCycles: vi.fn(() => 0),
    });

    const result = await ticketFetch(ctx, deps);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('max-rework');
  });

  it('defaults max rework to 3 for invalid env values', async () => {
    const ctx = makeCtx({ configEnv: { CLANCY_MAX_REWORK: 'abc' } });
    ctx.setTicket(TICKET);
    ctx.setRework({ isRework: true });
    const deps = makeDeps({
      countReworkCycles: vi.fn(() => 3),
    });

    const result = await ticketFetch(ctx, deps);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('max-rework');
  });

  it('defaults max rework to 3 for negative env values', async () => {
    const ctx = makeCtx({ configEnv: { CLANCY_MAX_REWORK: '-1' } });
    ctx.setTicket(TICKET);
    ctx.setRework({ isRework: true });
    const deps = makeDeps({
      countReworkCycles: vi.fn(() => 3),
    });

    const result = await ticketFetch(ctx, deps);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('max-rework');
  });

  it('computes branches and sets them on context', async () => {
    const ctx = makeCtx();
    const deps = makeDeps({
      computeTicketBranch: vi.fn(() => 'feature/issue-42'),
      computeTargetBranch: vi.fn(() => 'epic/100'),
    });

    await ticketFetch(ctx, deps);

    expect(ctx.ticketBranch).toBe('feature/issue-42');
    expect(ctx.targetBranch).toBe('epic/100');
    expect(ctx.baseBranch).toBe('main');
    expect(ctx.hasParent).toBe(true);
  });

  it('sets hasParent false when parentInfo is none', async () => {
    const ctx = makeCtx();
    const deps = makeDeps({
      fetchTicket: vi.fn(() => Promise.resolve(NO_PARENT_TICKET)),
    });

    await ticketFetch(ctx, deps);

    expect(ctx.hasParent).toBe(false);
  });

  it('treats empty parentInfo as hasParent: true', async () => {
    const emptyParent: FetchedTicket = {
      ...TICKET,
      parentInfo: '',
    };
    const ctx = makeCtx();
    const deps = makeDeps({
      fetchTicket: vi.fn(() => Promise.resolve(emptyParent)),
    });

    await ticketFetch(ctx, deps);

    expect(ctx.hasParent).toBe(true);
  });

  it('passes parent to computeTargetBranch only when present', async () => {
    const ctx = makeCtx();
    const computeTargetBranch = vi.fn(() => 'main');
    const deps = makeDeps({
      fetchTicket: vi.fn(() => Promise.resolve(NO_PARENT_TICKET)),
      computeTargetBranch,
    });

    await ticketFetch(ctx, deps);

    expect(computeTargetBranch).toHaveBeenCalledWith(
      'github',
      'main',
      undefined,
    );
  });

  it('uses CLANCY_BASE_BRANCH from config env', async () => {
    const ctx = makeCtx({ configEnv: { CLANCY_BASE_BRANCH: 'develop' } });
    const computeTargetBranch = vi.fn(() => 'develop');
    const deps = makeDeps({ computeTargetBranch });

    await ticketFetch(ctx, deps);

    expect(ctx.baseBranch).toBe('develop');
    expect(computeTargetBranch).toHaveBeenCalledWith(
      'github',
      'develop',
      '#100',
    );
  });

  it('returns ticket info in result', async () => {
    const ctx = makeCtx();
    const deps = makeDeps();

    const result = await ticketFetch(ctx, deps);

    expect(result.ok).toBe(true);
    expect(result.ticketKey).toBe('#42');
  });

  it('skips max rework guard for non-rework tickets', async () => {
    const ctx = makeCtx();
    const deps = makeDeps({
      countReworkCycles: vi.fn(() => 100),
    });

    const result = await ticketFetch(ctx, deps);

    expect(result.ok).toBe(true);
    expect(deps.countReworkCycles).not.toHaveBeenCalled();
  });
});
