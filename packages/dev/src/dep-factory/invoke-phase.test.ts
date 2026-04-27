import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeInvokePhase } from './invoke-phase.js';

vi.mock('../cli-bridge.js', () => ({
  invokeClaudeSession: vi.fn(() => Promise.resolve({ ok: true, stderr: '' })),
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
      parentInfo: '',
      blockers: '',
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
    const streamingSpawn = vi.fn();
    const invoke = makeInvokePhase({
      streamingSpawn,
      buildPrompt,
      buildReworkPrompt,
    });

    const result = await invoke(createCtx());

    expect(buildPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'github',
        key: 'GH-1',
        tdd: false,
      }),
    );

    const { invokeClaudeSession } = await import('../cli-bridge.js');
    expect(invokeClaudeSession).toHaveBeenCalledWith({
      prompt: 'fresh-prompt',
      model: 'opus',
      spawn: streamingSpawn,
    });
    expect(result).toEqual({ ok: true });
  });

  it('builds a rework prompt when ctx.isRework is true', async () => {
    const streamingSpawn = vi.fn();
    const invoke = makeInvokePhase({
      streamingSpawn,
      buildPrompt,
      buildReworkPrompt,
    });

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

  it('returns tagged unknown error with captured stderr when session fails', async () => {
    const { invokeClaudeSession } = await import('../cli-bridge.js');
    vi.mocked(invokeClaudeSession).mockResolvedValueOnce({
      ok: false,
      stderr: 'auth error: token expired',
    });

    const streamingSpawn = vi.fn();
    const invoke = makeInvokePhase({
      streamingSpawn,
      buildPrompt,
      buildReworkPrompt,
    });

    const result = await invoke(createCtx());

    expect(result).toEqual({
      ok: false,
      error: { kind: 'unknown', message: 'auth error: token expired' },
    });
  });

  it('falls back to generic message when stderr is empty on failure', async () => {
    const { invokeClaudeSession } = await import('../cli-bridge.js');
    vi.mocked(invokeClaudeSession).mockResolvedValueOnce({
      ok: false,
      stderr: '',
    });

    const streamingSpawn = vi.fn();
    const invoke = makeInvokePhase({
      streamingSpawn,
      buildPrompt,
      buildReworkPrompt,
    });

    const result = await invoke(createCtx());

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'unknown',
        message: 'Claude session exited non-zero (no stderr captured)',
      },
    });
  });

  it('forwards TDD flag from config', async () => {
    const streamingSpawn = vi.fn();
    const invoke = makeInvokePhase({
      streamingSpawn,
      buildPrompt,
      buildReworkPrompt,
    });

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
    const streamingSpawn = vi.fn();
    const invoke = makeInvokePhase({
      streamingSpawn,
      buildPrompt,
      buildReworkPrompt,
    });

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
