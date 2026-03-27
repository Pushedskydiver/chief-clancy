import type { SimulatorCall } from './claude-simulator.js';

import { describe, expect, it } from 'vitest';

import { createClaudeSimulator } from './claude-simulator.js';

describe('createClaudeSimulator', () => {
  it('returns a SpawnSyncFn that records calls', () => {
    const sim = createClaudeSimulator();

    sim.spawn('claude', ['--dangerously-skip-permissions'], {
      input: 'hello',
      stdio: ['pipe', 'inherit', 'inherit'],
      encoding: 'utf8',
    });

    expect(sim.calls).toHaveLength(1);
    expect(sim.calls[0]).toEqual(
      expect.objectContaining({
        command: 'claude',
        args: ['--dangerously-skip-permissions'],
        input: 'hello',
      }),
    );
  });

  it('defaults to exit code 0 with empty stdout/stderr', () => {
    const sim = createClaudeSimulator();

    const result = sim.spawn('claude', ['-p'], {
      input: 'prompt',
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
    expect(result.error).toBeUndefined();
  });

  it('returns configured stdout for print-mode responses', () => {
    const sim = createClaudeSimulator({ stdout: 'Claude says hi' });

    const result = sim.spawn('claude', ['-p'], {
      input: 'prompt',
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
    });

    expect(result.stdout).toBe('Claude says hi');
  });

  it('simulates failure with non-zero exit code', () => {
    const sim = createClaudeSimulator({ exitCode: 1 });

    const result = sim.spawn('claude', ['--dangerously-skip-permissions'], {
      input: 'prompt',
      stdio: ['pipe', 'inherit', 'inherit'],
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
  });

  it('simulates spawn error', () => {
    const spawnError = new Error('ENOENT');
    const sim = createClaudeSimulator({ error: spawnError });

    const result = sim.spawn('claude', ['-p'], {
      input: 'prompt',
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
    });

    expect(result.error).toBe(spawnError);
  });

  it('supports per-call response sequences', () => {
    const sim = createClaudeSimulator({
      responses: [{ stdout: 'first' }, { stdout: 'second', exitCode: 1 }],
    });

    const opts = {
      input: 'prompt',
      stdio: ['pipe' as const, 'pipe' as const, 'pipe' as const],
      encoding: 'utf8' as const,
    };

    const first = sim.spawn('claude', ['-p'], opts);
    const second = sim.spawn('claude', ['-p'], opts);
    const third = sim.spawn('claude', ['-p'], opts);

    expect(first.stdout).toBe('first');
    expect(first.status).toBe(0);

    expect(second.stdout).toBe('second');
    expect(second.status).toBe(1);

    // Falls back to defaults after exhausting responses
    expect(third.stdout).toBe('');
    expect(third.status).toBe(0);
  });

  it('exposes call count for convenience assertions', () => {
    const sim = createClaudeSimulator();
    const opts = {
      input: 'p',
      stdio: ['pipe' as const, 'pipe' as const, 'pipe' as const],
      encoding: 'utf8' as const,
    };

    sim.spawn('claude', ['-p'], opts);
    sim.spawn('claude', ['-p'], opts);

    expect(sim.callCount).toBe(2);
  });

  it('provides typed call records with stdio', () => {
    const sim = createClaudeSimulator();

    sim.spawn('claude', ['-p'], {
      input: 'prompt',
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
    });

    const call: SimulatorCall = sim.calls[0]!;
    expect(call.stdio).toEqual(['pipe', 'pipe', 'pipe']);
  });
});
