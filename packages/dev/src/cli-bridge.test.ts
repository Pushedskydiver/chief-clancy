import type {
  SpawnSyncFn,
  StreamingSpawnFn,
  StreamingSpawnResult,
} from './types/spawn.js';
import type { SpawnSyncReturns } from 'node:child_process';

import { describe, expect, it, vi } from 'vitest';

import { invokeClaudePrint, invokeClaudeSession } from './cli-bridge.js';

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

function createStreamingResult(
  overrides: Partial<StreamingSpawnResult> = {},
): StreamingSpawnResult {
  return {
    stdout: '',
    stderr: '',
    status: 0,
    signal: null,
    ...overrides,
  };
}

describe('invokeClaudePrint', () => {
  it('returns captured stdout and stderr on success', () => {
    const spawn = vi
      .fn<SpawnSyncFn>()
      .mockReturnValue(
        createSpawnResult({ stdout: 'response text', stderr: 'log line' }),
      );

    const result = invokeClaudePrint({ prompt: 'test prompt', spawn });

    expect(result).toEqual({
      stdout: 'response text',
      stderr: 'log line',
      ok: true,
    });
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
    expect(result.stderr).toBe('');
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

  it('truncates stderr to the trailing 4 KiB', () => {
    const longStderr = 'x'.repeat(8192);
    const spawn = vi
      .fn<SpawnSyncFn>()
      .mockReturnValue(createSpawnResult({ stderr: longStderr }));

    const result = invokeClaudePrint({ prompt: 'test', spawn });

    expect(result.stderr).toContain('stderr truncated');
    expect(result.stderr.endsWith('x'.repeat(4096))).toBe(true);
  });
});

describe('invokeClaudeSession', () => {
  it('returns ok true and empty stderr on successful exit', async () => {
    const spawn = vi
      .fn<StreamingSpawnFn>()
      .mockResolvedValue(createStreamingResult());

    const result = await invokeClaudeSession({
      prompt: 'implement it',
      spawn,
    });

    expect(result).toEqual({ ok: true, stderr: '' });
  });

  it('does not include -p flag', async () => {
    const spawn = vi
      .fn<StreamingSpawnFn>()
      .mockResolvedValue(createStreamingResult());

    await invokeClaudeSession({ prompt: 'test', spawn });

    const args = spawn.mock.calls[0][1];
    expect(args).not.toContain('-p');
  });

  it('includes model flag when specified', async () => {
    const spawn = vi
      .fn<StreamingSpawnFn>()
      .mockResolvedValue(createStreamingResult());

    await invokeClaudeSession({ prompt: 'test', model: 'sonnet', spawn });

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      ['--dangerously-skip-permissions', '--model', 'sonnet'],
      expect.objectContaining({ input: 'test' }),
    );
  });

  it('returns ok false on non-zero exit', async () => {
    const spawn = vi
      .fn<StreamingSpawnFn>()
      .mockResolvedValue(createStreamingResult({ status: 1 }));

    const result = await invokeClaudeSession({ prompt: 'test', spawn });

    expect(result.ok).toBe(false);
  });

  it('returns ok false when spawn error occurs', async () => {
    const spawn = vi.fn<StreamingSpawnFn>().mockResolvedValue(
      createStreamingResult({
        status: null,
        error: new Error('ENOENT'),
      }),
    );

    const result = await invokeClaudeSession({ prompt: 'test', spawn });

    expect(result.ok).toBe(false);
  });

  it('returns ok false when process is killed by signal', async () => {
    const spawn = vi
      .fn<StreamingSpawnFn>()
      .mockResolvedValue(
        createStreamingResult({ status: null, signal: 'SIGTERM' }),
      );

    const result = await invokeClaudeSession({ prompt: 'test', spawn });

    expect(result.ok).toBe(false);
  });

  it('passes prompt via input option', async () => {
    const spawn = vi
      .fn<StreamingSpawnFn>()
      .mockResolvedValue(createStreamingResult());

    await invokeClaudeSession({ prompt: 'full prompt text', spawn });

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      expect.any(Array),
      expect.objectContaining({ input: 'full prompt text' }),
    );
  });

  it('returns captured stderr on failure', async () => {
    const spawn = vi.fn<StreamingSpawnFn>().mockResolvedValue(
      createStreamingResult({
        status: 1,
        stderr: 'auth error: invalid token',
      }),
    );

    const result = await invokeClaudeSession({ prompt: 'test', spawn });

    expect(result.stderr).toContain('auth error: invalid token');
  });

  it('truncates stderr to the trailing 4 KiB', async () => {
    const longStderr = 'y'.repeat(8192);
    const spawn = vi.fn<StreamingSpawnFn>().mockResolvedValue(
      createStreamingResult({
        status: 1,
        stderr: longStderr,
      }),
    );

    const result = await invokeClaudeSession({ prompt: 'test', spawn });

    expect(result.stderr).toContain('stderr truncated');
    expect(result.stderr.endsWith('y'.repeat(4096))).toBe(true);
  });
});
