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
    it('resolves commands destination under ~/.claude', () => {
      const paths = resolveDevInstallPaths('global', homeDir, cwd);

      expect(paths.commandsDest).toBe(
        join(homeDir, '.claude', 'commands', 'clancy'),
      );
    });

    it('resolves workflows destination under ~/.claude', () => {
      const paths = resolveDevInstallPaths('global', homeDir, cwd);

      expect(paths.workflowsDest).toBe(
        join(homeDir, '.claude', 'clancy', 'workflows'),
      );
    });

    it('resolves bundles destination under ~/.claude', () => {
      const paths = resolveDevInstallPaths('global', homeDir, cwd);

      expect(paths.bundlesDest).toBe(
        join(homeDir, '.claude', 'clancy', 'bundles'),
      );
    });
  });

  describe('local mode', () => {
    it('resolves commands destination under cwd/.claude', () => {
      const paths = resolveDevInstallPaths('local', homeDir, cwd);

      expect(paths.commandsDest).toBe(
        join(cwd, '.claude', 'commands', 'clancy'),
      );
    });

    it('resolves workflows destination under cwd/.claude', () => {
      const paths = resolveDevInstallPaths('local', homeDir, cwd);

      expect(paths.workflowsDest).toBe(
        join(cwd, '.claude', 'clancy', 'workflows'),
      );
    });

    it('resolves bundles destination under cwd/.claude', () => {
      const paths = resolveDevInstallPaths('local', homeDir, cwd);

      expect(paths.bundlesDest).toBe(join(cwd, '.claude', 'clancy', 'bundles'));
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
    readFile: vi.fn((p: string) => {
      const content = store.get(p);
      if (content === undefined) throw new Error(`ENOENT: ${p}`);
      return content;
    }),
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
  commandsDest: '/dest/commands/clancy',
  workflowsDest: '/dest/clancy/workflows',
  bundlesDest: '/dest/clancy/bundles',
};

const defaultSources = {
  commandsDir: '/pkg/dist/commands',
  workflowsDir: '/pkg/dist/workflows',
  bundlesDir: '/pkg/dist/bundle',
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
    '/pkg/dist/commands/dev.md':
      '# /clancy:dev\n\n@.claude/clancy/workflows/dev.md\n\nFollow the dev workflow above.',
    '/pkg/dist/workflows/dev.md': '# Clancy Dev Workflow\n\nStep 1...',
    '/pkg/dist/bundle/clancy-dev.js': '// clancy-dev bundle',
    '/pkg/dist/bundle/clancy-dev-autopilot.js':
      '// clancy-dev-autopilot bundle',
    ...files,
  };
  const fs = createMockFs(sourceFiles);

  return {
    mode: 'local',
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

  it('throws when a source file is missing', () => {
    const fs = createMockFs({});

    expect(() =>
      runDevInstall({
        mode: 'local',
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
      `Symlink rejected: ${defaultPaths.commandsDest}`,
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

  it('copies command files to commands destination', () => {
    const opts = buildOptions();
    runDevInstall(opts);

    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.commandsDir, 'dev.md'),
      join(defaultPaths.commandsDest, 'dev.md'),
    );
  });

  it('copies workflow files to workflows destination', () => {
    const opts = buildOptions();
    runDevInstall(opts);

    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.workflowsDir, 'dev.md'),
      join(defaultPaths.workflowsDest, 'dev.md'),
    );
  });

  it('inlines workflow content in global mode', () => {
    const opts = buildOptions({ mode: 'global' });
    runDevInstall(opts);

    expect(opts.fs.writeFile).toHaveBeenCalledWith(
      join(defaultPaths.commandsDest, 'dev.md'),
      expect.stringContaining('# Clancy Dev Workflow'),
    );
  });

  it('does not inline workflow content in local mode', () => {
    const opts = buildOptions({ mode: 'local' });
    runDevInstall(opts);

    const writeCallsToCmd = opts.fs.writeFile.mock.calls.filter(
      ([path]) => path === join(defaultPaths.commandsDest, 'dev.md'),
    );

    expect(writeCallsToCmd).toHaveLength(0);
  });
});
