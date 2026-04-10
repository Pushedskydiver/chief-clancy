import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeInvokePhase } from './invoke-phase.js';

vi.mock('@chief-clancy/dev', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  invokeClaudeSession: vi.fn(() => true),
}));

vi.mock('../prompt-builder/index.js', () => ({
  buildPrompt: vi.fn(() => 'fresh-prompt'),
  buildReworkPrompt: vi.fn(() => 'rework-prompt'),
}));

function createCtx(overrides: Record<string, unknown> = {}) {
  return {
    config: {
      provider: 'github' as const,
      env: { CLANCY_TDD: 'false', CLANCY_MODEL: 'opus' },
    },
    ticket: {
      key: 'GH-1',
      title: 'Test ticket',
      description: 'Do the thing',
      parentInfo: undefined,
      blockers: [],
    },
    isRework: false,
    prFeedback: undefined,
    ...overrides,
  } as never;
}

describe('makeInvokePhase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a fresh prompt and delegates to invokeClaudeSession', async () => {
    const spawn = vi.fn();
    const invoke = makeInvokePhase(spawn);

    const result = await invoke(createCtx());

    const { buildPrompt } = await import('../prompt-builder/index.js');
    expect(buildPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'github',
        key: 'GH-1',
        tdd: false,
      }),
    );

    const { invokeClaudeSession } = await import('@chief-clancy/dev');
    expect(invokeClaudeSession).toHaveBeenCalledWith({
      prompt: 'fresh-prompt',
      model: 'opus',
      spawn,
    });
    expect(result).toEqual({ ok: true });
  });

  it('builds a rework prompt when ctx.isRework is true', async () => {
    const spawn = vi.fn();
    const invoke = makeInvokePhase(spawn);

    await invoke(
      createCtx({
        isRework: true,
        prFeedback: ['fix the tests'],
      }),
    );

    const { buildReworkPrompt } = await import('../prompt-builder/index.js');
    expect(buildReworkPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'github',
        key: 'GH-1',
        feedbackComments: ['fix the tests'],
      }),
    );
  });

  it('returns ok: false when session fails', async () => {
    const { invokeClaudeSession } = await import('@chief-clancy/dev');
    vi.mocked(invokeClaudeSession).mockReturnValueOnce(false);

    const spawn = vi.fn();
    const invoke = makeInvokePhase(spawn);

    const result = await invoke(createCtx());

    expect(result).toEqual({ ok: false });
  });

  it('forwards TDD flag from config', async () => {
    const spawn = vi.fn();
    const invoke = makeInvokePhase(spawn);

    await invoke(
      createCtx({
        config: {
          provider: 'github',
          env: { CLANCY_TDD: 'true', CLANCY_MODEL: undefined },
        },
      }),
    );

    const { buildPrompt } = await import('../prompt-builder/index.js');
    expect(buildPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ tdd: true }),
    );
  });

  it('defaults prFeedback to empty array for rework', async () => {
    const spawn = vi.fn();
    const invoke = makeInvokePhase(spawn);

    await invoke(
      createCtx({
        isRework: true,
        prFeedback: undefined,
      }),
    );

    const { buildReworkPrompt } = await import('../prompt-builder/index.js');
    expect(buildReworkPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ feedbackComments: [] }),
    );
  });
});
