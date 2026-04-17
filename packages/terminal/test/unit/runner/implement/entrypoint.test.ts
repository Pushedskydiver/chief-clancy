/**
 * Implement entrypoint adapter tests.
 *
 * Verifies the adapter factories that wire real Node.js APIs
 * into the dependency injection interfaces expected by runImplement.
 */
import type { SpawnSyncReturns } from 'node:child_process';

import {
  makeCostFs,
  makeEnvFs,
  makeExecCmd,
  makeExecGit,
  makeLockFs,
  makeProgressFs,
  makeQualityFs,
} from '~/t/entrypoints/implement.js';
import { describe, expect, it, vi } from 'vitest';

// ─── makeExecGit ────────────────────────────────────────────────────────────

describe('makeExecGit', () => {
  it('returns trimmed stdout on success', () => {
    const spawn = vi.fn().mockReturnValue({
      status: 0,
      stdout: '  main\n',
      stderr: '',
    } satisfies Partial<SpawnSyncReturns<string>>);

    const exec = makeExecGit('/repo', spawn);
    const result = exec(['rev-parse', '--abbrev-ref', 'HEAD']);

    expect(result).toBe('main');
    expect(spawn).toHaveBeenCalledWith(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: '/repo', encoding: 'utf8' },
    );
  });

  it('throws on non-zero exit code', () => {
    const spawn = vi.fn().mockReturnValue({
      status: 128,
      stdout: '',
      stderr: 'fatal: not a git repository',
    } satisfies Partial<SpawnSyncReturns<string>>);

    const exec = makeExecGit('/repo', spawn);

    expect(() => exec(['status'])).toThrow('git status failed (exit 128)');
  });

  it('includes stderr in error message when available', () => {
    const spawn = vi.fn().mockReturnValue({
      status: 1,
      stdout: '',
      stderr: 'error: pathspec did not match',
    } satisfies Partial<SpawnSyncReturns<string>>);

    const exec = makeExecGit('/repo', spawn);

    expect(() => exec(['checkout', 'missing'])).toThrow(
      'error: pathspec did not match',
    );
  });

  it('handles null status (killed by signal)', () => {
    const spawn = vi.fn().mockReturnValue({
      status: null,
      stdout: '',
      stderr: '',
      signal: 'SIGTERM',
    } satisfies Partial<SpawnSyncReturns<string>>);

    const exec = makeExecGit('/repo', spawn);

    expect(() => exec(['fetch'])).toThrow('git fetch failed');
  });
});

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
    // The inverse assertion is the one that matters: spawn MUST NOT be called
    // with 'git' as the command when the caller passed 'claude'.
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

// ─── FS adapter factories ───────────────────────────────────────────────────

describe('makeLockFs', () => {
  it('maps readFile to readFileSync', () => {
    const fs = makeLockFs();
    expect(fs).toHaveProperty('readFile');
    expect(fs).toHaveProperty('writeFile');
    expect(fs).toHaveProperty('deleteFile');
    expect(fs).toHaveProperty('mkdir');
  });
});

describe('makeProgressFs', () => {
  it('maps appendFile and readFile', () => {
    const fs = makeProgressFs();
    expect(fs).toHaveProperty('readFile');
    expect(fs).toHaveProperty('appendFile');
    expect(fs).toHaveProperty('mkdir');
  });
});

describe('makeCostFs', () => {
  it('maps appendFile and mkdir', () => {
    const fs = makeCostFs();
    expect(fs).toHaveProperty('appendFile');
    expect(fs).toHaveProperty('mkdir');
  });
});

describe('makeQualityFs', () => {
  it('maps readFile, writeFile, rename, and mkdir', () => {
    const fs = makeQualityFs();
    expect(fs).toHaveProperty('readFile');
    expect(fs).toHaveProperty('writeFile');
    expect(fs).toHaveProperty('rename');
    expect(fs).toHaveProperty('mkdir');
  });
});

describe('makeEnvFs', () => {
  it('maps readFile', () => {
    const fs = makeEnvFs();
    expect(fs).toHaveProperty('readFile');
  });
});
