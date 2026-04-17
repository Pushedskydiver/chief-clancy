/**
 * Adapter factory tests.
 *
 * Verifies the Node.js-backed factory functions in adapters.ts. Most FS
 * adapters are too thin to unit-test meaningfully (they're direct
 * `readFileSync`/`writeFileSync` mappings); the executor factories carry
 * enough logic to warrant coverage.
 */
import type { SpawnSyncReturns } from 'node:child_process';

import { describe, expect, it, vi } from 'vitest';

import { makeExecCmd } from './adapters.js';

// ─── makeExecCmd ────────────────────────────────────────────────────────────

describe('makeExecCmd', () => {
  it('spawns the file argument directly — does NOT prepend git', () => {
    // Regression guard: runPreflightTagged used to adapt makeExecGit into an
    // arbitrary-binary executor by prepending `git`, turning `claude --version`
    // into `git claude --version`. The separation between ExecGit + ExecCmd
    // fixes that.
    const spawn = vi.fn().mockReturnValue({
      status: 0,
      stdout: '1.0.0\n',
      stderr: '',
    } satisfies Partial<SpawnSyncReturns<string>>);

    const execCmd = makeExecCmd('/repo', spawn);
    const result = execCmd('claude', ['--version']);

    expect(result).toBe('1.0.0');
    expect(spawn).toHaveBeenCalledWith('claude', ['--version'], {
      cwd: '/repo',
      encoding: 'utf8',
    });
    expect(spawn).not.toHaveBeenCalledWith(
      'git',
      expect.anything(),
      expect.anything(),
    );
  });

  it('throws with the binary name in the error on non-zero exit', () => {
    const spawn = vi.fn().mockReturnValue({
      status: 127,
      stdout: '',
      stderr: 'command not found: claude',
    } satisfies Partial<SpawnSyncReturns<string>>);

    const execCmd = makeExecCmd('/repo', spawn);

    expect(() => execCmd('claude', ['--version'])).toThrow(
      'claude failed (exit 127)',
    );
  });

  it('trims trailing whitespace from stdout', () => {
    const spawn = vi.fn().mockReturnValue({
      status: 0,
      stdout: 'git version 2.42.0\n\n',
      stderr: '',
    } satisfies Partial<SpawnSyncReturns<string>>);

    const execCmd = makeExecCmd('/repo', spawn);

    expect(execCmd('git', ['--version'])).toBe('git version 2.42.0');
  });
});
