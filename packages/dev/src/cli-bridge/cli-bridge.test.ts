import type { SpawnSyncReturns } from 'node:child_process';

import { describe, expect, it, vi } from 'vitest';

import { invokeClaudePrint, invokeClaudeSession } from './cli-bridge.js';

type SpawnSyncFn = Parameters<typeof invokeClaudePrint>[0]['spawn'];

type SpawnResultOverrides = Partial<
  Omit<SpawnSyncReturns<string>, 'stdout'> & { readonly stdout: string | null }
>;

function createSpawnResult(
  overrides: SpawnResultOverrides = {},
): SpawnSyncReturns<string> {
  return {
    pid: 1234,
    output: [],
    stdout: '',
    stderr: '',
    status: 0,
    signal: null,
    error: undefined,
    ...(overrides as Partial<SpawnSyncReturns<string>>),
  };
}

describe('invokeClaudePrint', () => {
  it('returns captured stdout on success', () => {
    const spawn = vi
      .fn<SpawnSyncFn>()
      .mockReturnValue(createSpawnResult({ stdout: 'response text' }));

    const result = invokeClaudePrint({ prompt: 'test prompt', spawn });

    expect(result).toEqual({ stdout: 'response text', ok: true });
  });

  it('passes prompt via stdin pipe', () => {
    const spawn = vi.fn<SpawnSyncFn>().mockReturnValue(createSpawnResult());

    invokeClaudePrint({ prompt: 'my prompt', spawn });

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      ['-p', '--dangerously-skip-permissions'],
      expect.objectContaining({ input: 'my prompt', encoding: 'utf8' }),
    );
  });

  it('includes model flag when specified', () => {
    const spawn = vi.fn<SpawnSyncFn>().mockReturnValue(createSpawnResult());

    invokeClaudePrint({ prompt: 'test', model: 'opus', spawn });

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      ['-p', '--dangerously-skip-permissions', '--model', 'opus'],
      expect.any(Object),
    );
  });

  it('returns ok false on non-zero exit', () => {
    const spawn = vi
      .fn<SpawnSyncFn>()
      .mockReturnValue(createSpawnResult({ status: 1 }));

    const result = invokeClaudePrint({ prompt: 'test', spawn });

    expect(result.ok).toBe(false);
  });

  it('returns ok false when spawn error occurs', () => {
    const spawn = vi
      .fn<SpawnSyncFn>()
      .mockReturnValue(createSpawnResult({ error: new Error('ENOENT') }));

    const result = invokeClaudePrint({ prompt: 'test', spawn });

    expect(result.ok).toBe(false);
  });

  it('returns empty string when stdout is null', () => {
    // Node spawnSync returns null for stdout when pipe is not consumed
    const spawn = vi
      .fn<SpawnSyncFn>()
      .mockReturnValue(createSpawnResult({ stdout: null }));

    const result = invokeClaudePrint({ prompt: 'test', spawn });

    expect(result.stdout).toBe('');
  });

  it('returns ok false when process is killed by signal', () => {
    const spawn = vi
      .fn<SpawnSyncFn>()
      .mockReturnValue(createSpawnResult({ status: null, signal: 'SIGTERM' }));

    const result = invokeClaudePrint({ prompt: 'test', spawn });

    expect(result.ok).toBe(false);
  });

  it('uses pipe for all stdio channels', () => {
    const spawn = vi.fn<SpawnSyncFn>().mockReturnValue(createSpawnResult());

    invokeClaudePrint({ prompt: 'test', spawn });

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      expect.any(Array),
      expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] }),
    );
  });
});

describe('invokeClaudeSession', () => {
  it('returns true on successful exit', () => {
    const spawn = vi.fn<SpawnSyncFn>().mockReturnValue(createSpawnResult());

    const result = invokeClaudeSession({ prompt: 'implement it', spawn });

    expect(result).toBe(true);
  });

  it('streams stdout and stderr to terminal', () => {
    const spawn = vi.fn<SpawnSyncFn>().mockReturnValue(createSpawnResult());

    invokeClaudeSession({ prompt: 'test', spawn });

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      expect.any(Array),
      expect.objectContaining({ stdio: ['pipe', 'inherit', 'inherit'] }),
    );
  });

  it('does not include -p flag', () => {
    const spawn = vi.fn<SpawnSyncFn>().mockReturnValue(createSpawnResult());

    invokeClaudeSession({ prompt: 'test', spawn });

    const args = spawn.mock.calls[0]![1];
    expect(args).not.toContain('-p');
  });

  it('includes model flag when specified', () => {
    const spawn = vi.fn<SpawnSyncFn>().mockReturnValue(createSpawnResult());

    invokeClaudeSession({ prompt: 'test', model: 'sonnet', spawn });

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      ['--dangerously-skip-permissions', '--model', 'sonnet'],
      expect.any(Object),
    );
  });

  it('returns false on non-zero exit', () => {
    const spawn = vi
      .fn<SpawnSyncFn>()
      .mockReturnValue(createSpawnResult({ status: 1 }));

    const result = invokeClaudeSession({ prompt: 'test', spawn });

    expect(result).toBe(false);
  });

  it('returns false when spawn error occurs', () => {
    const spawn = vi
      .fn<SpawnSyncFn>()
      .mockReturnValue(createSpawnResult({ error: new Error('ENOENT') }));

    const result = invokeClaudeSession({ prompt: 'test', spawn });

    expect(result).toBe(false);
  });

  it('returns false when process is killed by signal', () => {
    const spawn = vi
      .fn<SpawnSyncFn>()
      .mockReturnValue(createSpawnResult({ status: null, signal: 'SIGTERM' }));

    const result = invokeClaudeSession({ prompt: 'test', spawn });

    expect(result).toBe(false);
  });

  it('passes prompt via stdin', () => {
    const spawn = vi.fn<SpawnSyncFn>().mockReturnValue(createSpawnResult());

    invokeClaudeSession({ prompt: 'full prompt text', spawn });

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      expect.any(Array),
      expect.objectContaining({ input: 'full prompt text' }),
    );
  });
});
