import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeInvokePhase } from './invoke-phase.js';

vi.mock('../cli-bridge/index.js', () => ({
  invokeClaudeSession: vi.fn(() => true),
}));

const buildPrompt = vi.fn(() => 'fresh-prompt');
const buildReworkPrompt = vi.fn(() => 'rework-prompt');

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
    const invoke = makeInvokePhase({ spawn, buildPrompt, buildReworkPrompt });

    const result = await invoke(createCtx());

    expect(buildPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'github',
        key: 'GH-1',
        tdd: false,
      }),
    );

    const { invokeClaudeSession } = await import('../cli-bridge/index.js');
    expect(invokeClaudeSession).toHaveBeenCalledWith({
      prompt: 'fresh-prompt',
      model: 'opus',
      spawn,
    });
    expect(result).toEqual({ ok: true });
  });

  it('builds a rework prompt when ctx.isRework is true', async () => {
    const spawn = vi.fn();
    const invoke = makeInvokePhase({ spawn, buildPrompt, buildReworkPrompt });

    await invoke(
      createCtx({
        isRework: true,
        prFeedback: ['fix the tests'],
      }),
    );

    expect(buildReworkPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'github',
        key: 'GH-1',
        feedbackComments: ['fix the tests'],
      }),
    );
  });

  it('returns ok: false when session fails', async () => {
    const { invokeClaudeSession } = await import('../cli-bridge/index.js');
    vi.mocked(invokeClaudeSession).mockReturnValueOnce(false);

    const spawn = vi.fn();
    const invoke = makeInvokePhase({ spawn, buildPrompt, buildReworkPrompt });

    const result = await invoke(createCtx());

    expect(result).toEqual({ ok: false });
  });

  it('forwards TDD flag from config', async () => {
    const spawn = vi.fn();
    const invoke = makeInvokePhase({ spawn, buildPrompt, buildReworkPrompt });

    await invoke(
      createCtx({
        config: {
          provider: 'github',
          env: { CLANCY_TDD: 'true', CLANCY_MODEL: undefined },
        },
      }),
    );

    expect(buildPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ tdd: true }),
    );
  });

  it('defaults prFeedback to empty array for rework', async () => {
    const spawn = vi.fn();
    const invoke = makeInvokePhase({ spawn, buildPrompt, buildReworkPrompt });

    await invoke(
      createCtx({
        isRework: true,
        prFeedback: undefined,
      }),
    );

    expect(buildReworkPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ feedbackComments: [] }),
    );
  });
});
