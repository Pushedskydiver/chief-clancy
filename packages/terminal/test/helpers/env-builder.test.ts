import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadClancyEnv } from '~/c/shared/env-parser.js';
import { afterEach, describe, expect, it } from 'vitest';

import { createEnvBuilder } from './env-builder.js';

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe('createEnvBuilder', () => {
  it('creates .clancy/.env in a temp directory', () => {
    const builder = createEnvBuilder({ GITHUB_TOKEN: 'ghp_test' });
    cleanup = builder.cleanup;

    const envPath = join(builder.root, '.clancy', '.env');

    expect(existsSync(envPath)).toBe(true);
  });

  it('writes quoted key=value pairs to the env file', () => {
    const builder = createEnvBuilder({
      GITHUB_TOKEN: 'ghp_test',
      GITHUB_REPO: 'org/repo',
    });
    cleanup = builder.cleanup;

    const envPath = join(builder.root, '.clancy', '.env');
    const content = readFileSync(envPath, 'utf8');

    expect(content).toBe('GITHUB_TOKEN="ghp_test"\nGITHUB_REPO="org/repo"');
  });

  it('returns an EnvFileSystem that can read the env file', () => {
    const builder = createEnvBuilder({ LINEAR_API_KEY: 'lin_test' });
    cleanup = builder.cleanup;

    const envPath = join(builder.root, '.clancy', '.env');

    expect(builder.fs.exists!(envPath)).toBe(true);
    expect(builder.fs.readFile(envPath)).toBe('LINEAR_API_KEY="lin_test"');
  });

  it('fs.exists returns false for missing files', () => {
    const builder = createEnvBuilder({ KEY: 'val' });
    cleanup = builder.cleanup;

    expect(builder.fs.exists!(join(builder.root, 'nonexistent'))).toBe(false);
  });

  it('cleanup removes the temp directory', () => {
    const builder = createEnvBuilder({ KEY: 'val' });
    const root = builder.root;

    expect(existsSync(root)).toBe(true);

    builder.cleanup();

    expect(existsSync(root)).toBe(false);
  });

  it('works with loadClancyEnv round-trip', () => {
    const builder = createEnvBuilder({
      NOTION_TOKEN: 'ntn_test',
      NOTION_DATABASE_ID: 'db-123',
    });
    cleanup = builder.cleanup;

    const env = loadClancyEnv(builder.root, builder.fs);

    expect(env).toEqual({
      NOTION_TOKEN: 'ntn_test',
      NOTION_DATABASE_ID: 'db-123',
    });
  });
});
