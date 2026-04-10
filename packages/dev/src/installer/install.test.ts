import type { RunDevInstallOptions } from './install.js';

import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  parseDevInstallFlag,
  resolveDevInstallPaths,
  runDevInstall,
} from './install.js';

// ---------------------------------------------------------------------------
// parseDevInstallFlag
// ---------------------------------------------------------------------------

describe('parseDevInstallFlag', () => {
  it('returns "global" when --global is present', () => {
    expect(parseDevInstallFlag(['--global'])).toBe('global');
  });

  it('returns "local" when --local is present', () => {
    expect(parseDevInstallFlag(['--local'])).toBe('local');
  });

  it('returns null when no flag is present', () => {
    expect(parseDevInstallFlag([])).toBeNull();
  });

  it('returns null for unrelated flags', () => {
    expect(parseDevInstallFlag(['--verbose', '--force'])).toBeNull();
  });

  it('prefers --global when both flags are present', () => {
    expect(parseDevInstallFlag(['--global', '--local'])).toBe('global');
  });
});

// ---------------------------------------------------------------------------
// resolveDevInstallPaths
// ---------------------------------------------------------------------------

describe('resolveDevInstallPaths', () => {
  const homeDir = '/home/user';
  const cwd = '/projects/my-app';

  describe('global mode', () => {
    it('resolves bundles destination under ~/.claude', () => {
      const paths = resolveDevInstallPaths('global', homeDir, cwd);

      expect(paths.bundlesDest).toBe(
        join(homeDir, '.claude', 'clancy', 'bundles'),
      );
    });

    it('resolves hooks destination under ~/.claude', () => {
      const paths = resolveDevInstallPaths('global', homeDir, cwd);

      expect(paths.hooksDest).toBe(join(homeDir, '.claude', 'clancy', 'hooks'));
    });
  });

  describe('local mode', () => {
    it('resolves bundles destination under cwd/.claude', () => {
      const paths = resolveDevInstallPaths('local', homeDir, cwd);

      expect(paths.bundlesDest).toBe(join(cwd, '.claude', 'clancy', 'bundles'));
    });

    it('resolves hooks destination under cwd/.claude', () => {
      const paths = resolveDevInstallPaths('local', homeDir, cwd);

      expect(paths.hooksDest).toBe(join(cwd, '.claude', 'clancy', 'hooks'));
    });
  });
});

// ---------------------------------------------------------------------------
// runDevInstall
// ---------------------------------------------------------------------------

/** Build a mock FS with in-memory file storage. */
const createMockFs = (files: Record<string, string> = {}) => {
  const store = new Map(Object.entries(files));
  const dirs = new Set<string>();

  return {
    exists: vi.fn((p: string) => store.has(p) || dirs.has(p)),
    writeFile: vi.fn((p: string, c: string) => {
      store.set(p, c);
    }),
    mkdir: vi.fn((p: string) => {
      dirs.add(p);
    }),
    copyFile: vi.fn((src: string, dest: string) => {
      const content = store.get(src);
      if (content === undefined) throw new Error(`ENOENT: ${src}`);
      store.set(dest, content);
    }),
    isSymlink: vi.fn((_p: string) => false),
  };
};

const defaultPaths = {
  bundlesDest: '/dest/clancy/bundles',
  hooksDest: '/dest/clancy/hooks',
};

const defaultSources = {
  bundlesDir: '/pkg/dist/bundle',
  hooksDir: '/pkg/dist/hooks',
};

type MockFs = ReturnType<typeof createMockFs>;

type MockOptions = Omit<RunDevInstallOptions, 'fs'> & {
  readonly fs: MockFs;
};

const defaultCwd = '/projects/my-app';

const buildOptions = (
  overrides: Partial<Omit<RunDevInstallOptions, 'fs'>> = {},
  files: Readonly<Record<string, string>> = {},
): MockOptions => {
  const sourceFiles: Record<string, string> = {
    '/pkg/dist/bundle/clancy-dev.js': '// clancy-dev bundle',
    '/pkg/dist/bundle/clancy-dev-autopilot.js':
      '// clancy-dev-autopilot bundle',
    ...files,
  };
  const fs = createMockFs(sourceFiles);

  return {
    cwd: defaultCwd,
    paths: defaultPaths,
    sources: defaultSources,
    version: '0.1.0',
    fs,
    ...overrides,
  };
};

describe('runDevInstall', () => {
  it('creates destination directories', () => {
    const opts = buildOptions();
    runDevInstall(opts);

    expect(opts.fs.mkdir).toHaveBeenCalledWith(defaultPaths.bundlesDest);
    expect(opts.fs.mkdir).toHaveBeenCalledWith(defaultPaths.hooksDest);
  });

  it('writes VERSION.dev with the package version', () => {
    const opts = buildOptions({ version: '1.2.3' });
    runDevInstall(opts);

    expect(opts.fs.writeFile).toHaveBeenCalledWith(
      join(defaultPaths.bundlesDest, 'VERSION.dev'),
      '1.2.3',
    );
  });

  it('copies bundle files to bundles destination', () => {
    const opts = buildOptions();
    runDevInstall(opts);

    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.bundlesDir, 'clancy-dev.js'),
      join(defaultPaths.bundlesDest, 'clancy-dev.js'),
    );
    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.bundlesDir, 'clancy-dev-autopilot.js'),
      join(defaultPaths.bundlesDest, 'clancy-dev-autopilot.js'),
    );
  });

  it('does not copy hook files when hook list is empty', () => {
    const opts = buildOptions();
    runDevInstall(opts);

    const hookCopyCalls = opts.fs.copyFile.mock.calls.filter(([, dest]) =>
      (dest as string).startsWith(defaultPaths.hooksDest),
    );

    expect(hookCopyCalls).toHaveLength(0);
  });

  it('throws when a bundle source file is missing', () => {
    const fs = createMockFs({});

    expect(() =>
      runDevInstall({
        cwd: defaultCwd,
        paths: defaultPaths,
        sources: defaultSources,
        version: '0.1.0',
        fs,
      }),
    ).toThrow('Source file not found');
  });

  it('rejects symlink at destination directory', () => {
    const opts = buildOptions();
    opts.fs.isSymlink.mockReturnValue(true);

    expect(() => runDevInstall(opts)).toThrow(
      `Symlink rejected: ${defaultPaths.bundlesDest}`,
    );
  });

  it('rejects symlink at version marker path', () => {
    const opts = buildOptions();
    opts.fs.isSymlink.mockImplementation(
      (p: string) => p === join(defaultPaths.bundlesDest, 'VERSION.dev'),
    );

    expect(() => runDevInstall(opts)).toThrow(
      `Symlink rejected: ${join(defaultPaths.bundlesDest, 'VERSION.dev')}`,
    );
  });

  it('returns the detected install state after installation', () => {
    const envPath = join(defaultCwd, '.clancy', '.env');
    const opts = buildOptions({}, { [envPath]: 'BOARD=github' });
    const state = runDevInstall(opts);

    expect(state).toBe('standalone-board');
  });
});
