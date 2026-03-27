import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTempRepo } from './temp-repo.js';

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe('createTempRepo', () => {
  it('creates a git repo in a temp directory', () => {
    const repo = createTempRepo();
    cleanup = repo.cleanup;

    expect(existsSync(join(repo.root, '.git'))).toBe(true);
  });

  it('has an initial commit on main branch', () => {
    const repo = createTempRepo();
    cleanup = repo.cleanup;

    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: repo.root,
      encoding: 'utf8',
    }).trim();

    expect(branch).toBe('main');

    const log = execSync('git log --oneline', {
      cwd: repo.root,
      encoding: 'utf8',
    }).trim();

    expect(log).toContain('initial commit');
  });

  it('provides an ExecGit function scoped to the repo', () => {
    const repo = createTempRepo();
    cleanup = repo.cleanup;

    const branch = repo.exec(['rev-parse', '--abbrev-ref', 'HEAD']).trim();

    expect(branch).toBe('main');
  });

  it('exec throws on non-zero exit', () => {
    const repo = createTempRepo();
    cleanup = repo.cleanup;

    expect(() => repo.exec(['checkout', 'nonexistent-branch'])).toThrow();
  });

  it('cleanup removes the temp directory', () => {
    const repo = createTempRepo();
    const root = repo.root;

    expect(existsSync(root)).toBe(true);

    repo.cleanup();

    expect(existsSync(root)).toBe(false);
  });

  it('supports creating branches via exec', () => {
    const repo = createTempRepo();
    cleanup = repo.cleanup;

    repo.exec(['checkout', '-b', 'feat/test']);

    const branch = repo.exec(['rev-parse', '--abbrev-ref', 'HEAD']).trim();

    expect(branch).toBe('feat/test');
  });
});
