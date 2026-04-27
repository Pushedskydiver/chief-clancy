import type { FeasibilityPhaseDeps } from './feasibility.js';

import { describe, expect, it, vi } from 'vitest';

import { feasibilityPhase } from './feasibility.js';
import { makeCtx } from './test-helpers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePopulatedCtx(
  opts: {
    readonly skipFeasibility?: boolean;
    readonly isRework?: boolean;
    readonly configEnv?: Record<string, string>;
  } = {},
) {
  const ctx = makeCtx({
    argv: opts.skipFeasibility ? ['--skip-feasibility'] : [],
    configEnv: opts.configEnv,
  });

  ctx.setTicket({
    key: '#42',
    title: 'Add login page',
    description: 'Build a login form',
    parentInfo: 'none',
    blockers: 'None',
  });

  if (opts.isRework) {
    ctx.setRework({ isRework: true });
  }

  return ctx;
}

function makeDeps(
  overrides: Partial<FeasibilityPhaseDeps> = {},
): FeasibilityPhaseDeps {
  return {
    checkFeasibility: vi.fn(() =>
      Promise.resolve({ isFeasible: true } as const),
    ),
    appendProgress: vi.fn(),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('feasibilityPhase', () => {
  it('runs feasibility check and returns ok: true when feasible', async () => {
    const ctx = makePopulatedCtx();
    const deps = makeDeps();

    const result = await feasibilityPhase(ctx, deps);

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(false);
  });

  it('returns ok: false with not-feasible error when ticket is not feasible', async () => {
    const ctx = makePopulatedCtx();
    const deps = makeDeps({
      checkFeasibility: vi.fn(() =>
        Promise.resolve({
          isFeasible: false,
          reason: 'requires infrastructure changes',
        } as const),
      ),
    });

    const result = await feasibilityPhase(ctx, deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        kind: 'not-feasible',
        message: 'requires infrastructure changes',
      });
    }
  });

  it('returns ok: false with check-failed error when checker surfaces one', async () => {
    const ctx = makePopulatedCtx();
    const deps = makeDeps({
      checkFeasibility: vi.fn(() =>
        Promise.resolve({
          isFeasible: false,
          error: {
            kind: 'check-failed' as const,
            message: 'subprocess crashed',
          },
        } as const),
      ),
    });

    const result = await feasibilityPhase(ctx, deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        kind: 'check-failed',
        message: 'subprocess crashed',
      });
    }
  });

  it('appends SKIPPED progress when not feasible', async () => {
    const ctx = makePopulatedCtx();
    const deps = makeDeps({
      checkFeasibility: vi.fn(() =>
        Promise.resolve({
          isFeasible: false,
          reason: 'needs hardware',
        } as const),
      ),
    });

    await feasibilityPhase(ctx, deps);

    expect(deps.appendProgress).toHaveBeenCalledWith(
      expect.objectContaining({ key: '#42', status: 'SKIPPED' }),
    );
  });

  it('skips check for rework tickets', async () => {
    const ctx = makePopulatedCtx({ isRework: true });
    const deps = makeDeps();

    const result = await feasibilityPhase(ctx, deps);

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(deps.checkFeasibility).not.toHaveBeenCalled();
  });

  it('skips check when --skip-feasibility flag is set', async () => {
    const ctx = makePopulatedCtx({ skipFeasibility: true });
    const deps = makeDeps();

    const result = await feasibilityPhase(ctx, deps);

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(deps.checkFeasibility).not.toHaveBeenCalled();
  });

  it('passes ticket metadata and model to checkFeasibility', async () => {
    const ctx = makePopulatedCtx({ configEnv: { CLANCY_MODEL: 'sonnet' } });
    const checkFeasibility = vi.fn(() =>
      Promise.resolve({ isFeasible: true } as const),
    );
    const deps = makeDeps({ checkFeasibility });

    await feasibilityPhase(ctx, deps);

    expect(checkFeasibility).toHaveBeenCalledWith(
      {
        key: '#42',
        title: 'Add login page',
        description: 'Build a login form',
      },
      'sonnet',
    );
  });

  it('returns ok: true (no error field) when feasible', async () => {
    const ctx = makePopulatedCtx();
    const deps = makeDeps();

    const result = await feasibilityPhase(ctx, deps);

    expect(result.ok).toBe(true);
    expect('error' in result).toBe(false);
  });
});
