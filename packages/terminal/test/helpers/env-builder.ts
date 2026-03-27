/**
 * Environment file builder for integration tests.
 *
 * Creates a temporary `.clancy/.env` file with the given key-value pairs
 * and provides an {@link EnvFileSystem} for use with `loadClancyEnv`.
 */
import type { EnvFileSystem } from '~/c/shared/env-parser/env-parser.js';

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type EnvBuilder = {
  /** Absolute path to the project root (parent of `.clancy/`). */
  readonly root: string;
  /** File system ops compatible with `loadClancyEnv`. */
  readonly fs: EnvFileSystem;
  /** Remove the temp directory. */
  readonly cleanup: () => void;
};

/**
 * Create a temporary `.clancy/.env` file with the given variables.
 *
 * @param vars - Key-value pairs to write to the env file.
 * @returns An env builder with root path, fs adapter, and cleanup function.
 */
export function createEnvBuilder(vars: Record<string, string>): EnvBuilder {
  const root = mkdtempSync(join(tmpdir(), 'clancy-test-env-'));
  const clancyDir = join(root, '.clancy');

  mkdirSync(clancyDir, { recursive: true });

  const content = Object.entries(vars)
    .map(([key, value]) => `${key}="${value}"`)
    .join('\n');

  writeFileSync(join(clancyDir, '.env'), content);

  const fs: EnvFileSystem = {
    exists: existsSync,
    readFile: (path) => readFileSync(path, 'utf8'),
  };

  const cleanup = (): void => {
    rmSync(root, { recursive: true, force: true });
  };

  return { root, fs, cleanup };
}
