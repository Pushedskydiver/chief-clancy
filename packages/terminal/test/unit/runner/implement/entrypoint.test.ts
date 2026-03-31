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
  makeExecGit,
  makeLockFs,
  makeProgressFs,
  makeQualityFs,
} from '~/t/runner/implement/entrypoint.js';
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
