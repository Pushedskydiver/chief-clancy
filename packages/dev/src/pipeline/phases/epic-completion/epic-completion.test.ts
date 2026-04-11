import type { EpicCompletionDeps } from './epic-completion.js';
import type { BoardConfig } from '@chief-clancy/core/schemas/env/env.js';

import { describe, expect, it, vi } from 'vitest';

import { RunContext } from '../../context.js';
import { epicCompletion } from './epic-completion.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCtx(): RunContext {
  const ctx = new RunContext({
    projectRoot: '/repo',
    argv: [],
  });

  ctx.setPreflight(
    {
      provider: 'github',
      env: { GITHUB_TOKEN: 'ghp_test', CLANCY_BASE_BRANCH: 'main' },
    } as BoardConfig,
    {
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
    },
  );

  return ctx;
}

function makeDeps(
  overrides: {
    readonly completedEpics?: ReadonlyMap<string, string>;
    readonly deliverOk?: boolean;
  } = {},
): EpicCompletionDeps {
  const { completedEpics = new Map(), deliverOk = true } = overrides;

  return {
    findCompletedEpics: vi.fn(() => completedEpics),
    deliverEpicToBase: vi.fn(() => Promise.resolve({ ok: deliverOk })),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('epicCompletion', () => {
  it('returns empty results when no completed epics found', async () => {
    const ctx = makeCtx();
    const deps = makeDeps();

    const result = await epicCompletion(ctx, deps);

    expect(result.results).toHaveLength(0);
  });

  it('delivers epic PR for each completed epic', async () => {
    const ctx = makeCtx();
    const completedEpics = new Map([['PROJ-100', 'epic/proj-100']]);
    const deps = makeDeps({ completedEpics });

    const result = await epicCompletion(ctx, deps);

    expect(deps.deliverEpicToBase).toHaveBeenCalledOnce();
    expect(result.results).toHaveLength(1);
    expect(result.results[0].epicKey).toBe('PROJ-100');
    expect(result.results[0].ok).toBe(true);
  });

  it('handles multiple completed epics', async () => {
    const ctx = makeCtx();
    const completedEpics = new Map([
      ['PROJ-100', 'epic/proj-100'],
      ['PROJ-200', 'epic/proj-200'],
    ]);
    const deps = makeDeps({ completedEpics });

    const result = await epicCompletion(ctx, deps);

    expect(deps.deliverEpicToBase).toHaveBeenCalledTimes(2);
    expect(result.results).toHaveLength(2);
  });

  it('records failure when delivery fails', async () => {
    const ctx = makeCtx();
    const completedEpics = new Map([['PROJ-100', 'epic/proj-100']]);
    const deps = makeDeps({ completedEpics, deliverOk: false });

    const result = await epicCompletion(ctx, deps);

    expect(result.results[0].ok).toBe(false);
  });

  it('catches sync errors and returns empty results', async () => {
    const ctx = makeCtx();
    const deps: EpicCompletionDeps = {
      findCompletedEpics: vi.fn(() => {
        throw new Error('progress read failed');
      }),
      deliverEpicToBase: vi.fn(),
    };

    const result = await epicCompletion(ctx, deps);

    expect(result.results).toHaveLength(0);
  });

  it('catches async rejection from deliverEpicToBase', async () => {
    const ctx = makeCtx();
    const completedEpics = new Map([['PROJ-100', 'epic/proj-100']]);
    const deps: EpicCompletionDeps = {
      findCompletedEpics: vi.fn(() => completedEpics),
      deliverEpicToBase: vi.fn(() => Promise.reject(new Error('network'))),
    };

    const result = await epicCompletion(ctx, deps);

    expect(result.results).toHaveLength(0);
  });

  it('passes config and baseBranch to deliverEpicToBase', async () => {
    const ctx = makeCtx();
    const completedEpics = new Map([['PROJ-100', 'epic/proj-100']]);
    const deps = makeDeps({ completedEpics });

    await epicCompletion(ctx, deps);

    const call = (deps.deliverEpicToBase as ReturnType<typeof vi.fn>).mock
      .calls[0] as [unknown];
    const opts = call[0] as Record<string, unknown>;
    expect(opts).toMatchObject({
      epicKey: 'PROJ-100',
      epicBranch: 'epic/proj-100',
      baseBranch: 'main',
    });
  });

  it('defaults baseBranch to main when CLANCY_BASE_BRANCH not set', async () => {
    const ctx = makeCtx();
    ctx.setPreflight(
      { provider: 'github', env: { GITHUB_TOKEN: 'ghp_test' } } as BoardConfig,
      ctx.board!,
    );
    const completedEpics = new Map([['PROJ-100', 'epic/proj-100']]);
    const deps = makeDeps({ completedEpics });

    await epicCompletion(ctx, deps);

    const call = (deps.deliverEpicToBase as ReturnType<typeof vi.fn>).mock
      .calls[0] as [unknown];
    const opts = call[0] as Record<string, unknown>;
    expect(opts).toMatchObject({ baseBranch: 'main' });
  });
});
