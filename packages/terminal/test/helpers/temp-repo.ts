/**
 * Temporary git repository helper for integration tests.
 *
 * Creates a real git repo in a temp directory with an initial commit
 * on the `main` branch. Provides an {@link ExecGit} executor scoped
 * to the repo for use with core's git-ops functions.
 */
import type { ExecGit } from '~/c/shared/git-ops/git-ops.js';

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type TempRepo = {
  /** Absolute path to the repo root. */
  readonly root: string;
  /** Git executor scoped to this repo. */
  readonly exec: ExecGit;
  /** Remove the temp directory. */
  readonly cleanup: () => void;
};

/**
 * Create a temporary git repository with an initial commit.
 *
 * @returns A temp repo with root path, scoped exec, and cleanup function.
 */
export function createTempRepo(): TempRepo {
  const root = mkdtempSync(join(tmpdir(), 'clancy-test-repo-'));

  const git = (args: readonly string[]): void => {
    execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  };

  git(['init', '-b', 'main']);
  git(['config', 'user.email', 'test@clancy.dev']);
  git(['config', 'user.name', 'Clancy Test']);

  writeFileSync(join(root, '.gitkeep'), '');
  git(['add', '.']);
  git(['commit', '-m', 'initial commit']);

  const exec: ExecGit = (args) =>
    execFileSync('git', args, {
      cwd: root,
      stdio: 'pipe',
      encoding: 'utf8',
    });

  const cleanup = (): void => {
    rmSync(root, { recursive: true, force: true });
  };

  return { root, exec, cleanup };
}
