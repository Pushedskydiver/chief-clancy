import type { TransitionDeps } from './transition.js';

import { describe, expect, it, vi } from 'vitest';

import { makeCtx } from '../test-helpers.js';
import { transition } from './transition.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePopulatedCtx(opts: { readonly statusInProgress?: string } = {}) {
  const ctx = makeCtx({
    configEnv: opts.statusInProgress
      ? { CLANCY_STATUS_IN_PROGRESS: opts.statusInProgress }
      : {},
  });

  ctx.setTicket({
    key: 'PROJ-42',
    title: 'Add login page',
    description: '',
    parentInfo: 'none',
    blockers: 'None',
  });

  return ctx;
}

function makeDeps(overrides: Partial<TransitionDeps> = {}): TransitionDeps {
  return {
    transitionTicket: vi.fn(() => Promise.resolve(true)),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('transition', () => {
  it('transitions ticket when CLANCY_STATUS_IN_PROGRESS is set', async () => {
    const ctx = makePopulatedCtx({ statusInProgress: 'In Progress' });
    const deps = makeDeps();

    const result = await transition(ctx, deps);

    expect(result.ok).toBe(true);
    expect(deps.transitionTicket).toHaveBeenCalledWith(
      ctx.ticket,
      'In Progress',
    );
  });

  it('skips transition when CLANCY_STATUS_IN_PROGRESS is not set', async () => {
    const ctx = makePopulatedCtx();
    const deps = makeDeps();

    const result = await transition(ctx, deps);

    expect(result.ok).toBe(true);
    expect(deps.transitionTicket).not.toHaveBeenCalled();
  });

  it('returns ok: true even when transition fails', async () => {
    const ctx = makePopulatedCtx({ statusInProgress: 'In Progress' });
    const deps = makeDeps({
      transitionTicket: vi.fn(() => Promise.resolve(false)),
    });

    const result = await transition(ctx, deps);

    expect(result.ok).toBe(true);
  });

  it('returns ok: true when transition throws', async () => {
    const ctx = makePopulatedCtx({ statusInProgress: 'In Progress' });
    const deps = makeDeps({
      transitionTicket: vi.fn(() => Promise.reject(new Error('network error'))),
    });

    const result = await transition(ctx, deps);

    expect(result.ok).toBe(true);
  });
});
