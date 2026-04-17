import type { PreflightDeps, PreflightResult } from './preflight.js';
import type { EnvFileSystem } from '@chief-clancy/core/shared/env-parser.js';

import { describe, expect, it, vi } from 'vitest';

import { runPreflight } from './preflight.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type MockExec = ReturnType<
  typeof vi.fn<(file: string, args: readonly string[]) => string>
>;

function makeExec(): MockExec {
  return vi.fn<(file: string, args: readonly string[]) => string>(() => '');
}

function makeEnvFs(overrides: Partial<EnvFileSystem> = {}): EnvFileSystem {
  return {
    exists: vi.fn(() => true),
    readFile: vi.fn(() => 'CLANCY_BOARD=github\nCLANCY_BOARD_TOKEN=tok'),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<PreflightDeps> = {}): PreflightDeps {
  return {
    exec: makeExec(),
    envFs: makeEnvFs(),
    ...overrides,
  };
}

// ─── runPreflight ────────────────────────────────────────────────────────────

describe('runPreflight', () => {
  it('returns ok with env when all checks pass', () => {
    const result = runPreflight('/project', makeDeps());

    expect(result).toMatchObject({
      ok: true,
      env: {
        CLANCY_BOARD: 'github',
        CLANCY_BOARD_TOKEN: 'tok',
      },
    });
  });

  it('probes binaries with --version (cross-platform)', () => {
    const exec = makeExec();

    runPreflight('/project', makeDeps({ exec }));

    expect(exec).toHaveBeenCalledWith('claude', ['--version']);
    expect(exec).toHaveBeenCalledWith('git', ['--version']);
  });

  it('returns error when claude binary is missing', () => {
    const exec = makeExec();
    exec.mockImplementation((file: string) => {
      if (file === 'claude') throw new Error('ENOENT');
      return '';
    });

    const result = runPreflight('/project', makeDeps({ exec }));

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'unknown',
        message: expect.stringContaining('claude'),
      },
    });
  });

  it('returns error when git binary is missing', () => {
    const exec = makeExec();
    exec.mockImplementation((file: string) => {
      if (file === 'git') throw new Error('ENOENT');
      return '';
    });

    const result = runPreflight('/project', makeDeps({ exec }));

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'unknown',
        message: expect.stringContaining('git'),
      },
    });
  });

  it('returns error when .env file does not exist', () => {
    const envFs = makeEnvFs({
      readFile: vi.fn(() => {
        throw new Error('ENOENT');
      }),
    });

    const result = runPreflight('/project', makeDeps({ envFs }));

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'unknown',
        message: expect.stringContaining('.env'),
      },
    });
  });

  it('returns error when not inside a git repository', () => {
    const exec = makeExec();
    exec.mockImplementation((file: string, args: readonly string[]) => {
      if (file === 'git' && args[0] === 'rev-parse') {
        throw new Error('not a git repo');
      }
      return '';
    });

    const result = runPreflight('/project', makeDeps({ exec }));

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'unknown',
        message: expect.stringContaining('git repository'),
      },
    });
  });

  it('returns warning when remote is unreachable', () => {
    const exec = makeExec();
    exec.mockImplementation((file: string, args: readonly string[]) => {
      if (file === 'git' && args[0] === 'ls-remote') {
        throw new Error('timeout');
      }
      return '';
    });

    const result = runPreflight('/project', makeDeps({ exec }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warning).toContain('origin');
  });

  it('returns warning when working directory has uncommitted changes', () => {
    const exec = makeExec();
    exec.mockImplementation((file: string, args: readonly string[]) => {
      if (file === 'git' && args[0] === 'diff') {
        throw new Error('dirty');
      }
      return '';
    });

    const result = runPreflight('/project', makeDeps({ exec }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warning).toContain('uncommitted');
  });

  it('combines multiple warnings', () => {
    const exec = makeExec();
    exec.mockImplementation((file: string, args: readonly string[]) => {
      if (file === 'git' && args[0] === 'ls-remote') throw new Error('timeout');
      if (file === 'git' && args[0] === 'diff') throw new Error('dirty');
      return '';
    });

    const result = runPreflight('/project', makeDeps({ exec }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning).toContain('origin');
      expect(result.warning).toContain('uncommitted');
    }
  });

  it('checks binaries before env or git state', () => {
    const exec = makeExec();
    exec.mockImplementation(() => {
      throw new Error('not found');
    });
    const envFs = makeEnvFs({ exists: vi.fn(() => false) });

    const result = runPreflight('/project', makeDeps({ exec, envFs }));

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'unknown',
        message: expect.stringContaining('claude'),
      },
    });
    expect(envFs.exists).not.toHaveBeenCalled();
  });

  it('passes projectRoot to loadClancyEnv', () => {
    const envFs = makeEnvFs();

    runPreflight('/my/project', makeDeps({ envFs }));

    expect(envFs.readFile).toHaveBeenCalledWith('/my/project/.clancy/.env');
  });

  it('returns typed PreflightResult on success', () => {
    const result: PreflightResult = runPreflight('/project', makeDeps());

    expect(result).toEqual({
      ok: true,
      env: { CLANCY_BOARD: 'github', CLANCY_BOARD_TOKEN: 'tok' },
    });
  });
});
