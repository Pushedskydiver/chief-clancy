import type { CostPhaseDeps } from './cost-phase.js';

import { describe, expect, it, vi } from 'vitest';

import { makeCtx } from '../test-helpers.js';
import { costPhase } from './cost-phase.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDeps(overrides: Partial<CostPhaseDeps> = {}): CostPhaseDeps {
  return {
    readLock: vi.fn().mockReturnValue({ startedAt: '2026-03-25T10:00:00Z' }),
    appendCostEntry: vi.fn(),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('costPhase', () => {
  it('returns ok: true and appends cost entry when lock exists', () => {
    const ctx = makeCtx();
    ctx.setTicket({
      key: 'PROJ-1',
      title: 'Test ticket',
      description: '',
      parentInfo: 'none',
      blockers: 'None',
    });

    const deps = makeDeps();
    const result = costPhase(ctx, deps);

    expect(result.ok).toBe(true);
    expect(deps.appendCostEntry).toHaveBeenCalledOnce();
    expect(deps.appendCostEntry).toHaveBeenCalledWith({
      ticketKey: 'PROJ-1',
      startedAt: '2026-03-25T10:00:00Z',
      tokenRate: 6600,
    });
  });

  it('uses custom CLANCY_TOKEN_RATE from config env', () => {
    const ctx = makeCtx({ configEnv: { CLANCY_TOKEN_RATE: '10000' } });
    ctx.setTicket({
      key: 'PROJ-2',
      title: 'Custom rate',
      description: '',
      parentInfo: 'none',
      blockers: 'None',
    });

    const deps = makeDeps();
    costPhase(ctx, deps);

    expect(deps.appendCostEntry).toHaveBeenCalledWith(
      expect.objectContaining({ tokenRate: 10000 }),
    );
  });

  it('falls back to 6600 when CLANCY_TOKEN_RATE is invalid', () => {
    const ctx = makeCtx({ configEnv: { CLANCY_TOKEN_RATE: 'abc' } });
    ctx.setTicket({
      key: 'PROJ-3',
      title: 'Bad rate',
      description: '',
      parentInfo: 'none',
      blockers: 'None',
    });

    const deps = makeDeps();
    costPhase(ctx, deps);

    expect(deps.appendCostEntry).toHaveBeenCalledWith(
      expect.objectContaining({ tokenRate: 6600 }),
    );
  });

  it('falls back to 6600 when CLANCY_TOKEN_RATE is zero', () => {
    const ctx = makeCtx({ configEnv: { CLANCY_TOKEN_RATE: '0' } });
    ctx.setTicket({
      key: 'PROJ-4',
      title: 'Zero rate',
      description: '',
      parentInfo: 'none',
      blockers: 'None',
    });

    const deps = makeDeps();
    costPhase(ctx, deps);

    expect(deps.appendCostEntry).toHaveBeenCalledWith(
      expect.objectContaining({ tokenRate: 6600 }),
    );
  });

  it('returns ok: true without appending when lock is missing', () => {
    const ctx = makeCtx();
    ctx.setTicket({
      key: 'PROJ-5',
      title: 'No lock',
      description: '',
      parentInfo: 'none',
      blockers: 'None',
    });

    const deps = makeDeps({ readLock: vi.fn().mockReturnValue(undefined) });
    const result = costPhase(ctx, deps);

    expect(result.ok).toBe(true);
    expect(deps.appendCostEntry).not.toHaveBeenCalled();
  });

  it('returns ok: true when appendCostEntry throws', () => {
    const ctx = makeCtx();
    ctx.setTicket({
      key: 'PROJ-6',
      title: 'Cost error',
      description: '',
      parentInfo: 'none',
      blockers: 'None',
    });

    const deps = makeDeps({
      appendCostEntry: vi.fn().mockImplementation(() => {
        throw new Error('disk full');
      }),
    });
    const result = costPhase(ctx, deps);

    expect(result.ok).toBe(true);
  });

  it('returns ok: true when readLock throws', () => {
    const ctx = makeCtx();
    ctx.setTicket({
      key: 'PROJ-7',
      title: 'Lock error',
      description: '',
      parentInfo: 'none',
      blockers: 'None',
    });

    const deps = makeDeps({
      readLock: vi.fn().mockImplementation(() => {
        throw new Error('corrupt');
      }),
    });
    const result = costPhase(ctx, deps);

    expect(result.ok).toBe(true);
  });
});
