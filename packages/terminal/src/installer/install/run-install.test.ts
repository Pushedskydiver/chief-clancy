import { join } from 'node:path';

import { inlineWorkflows } from '~/installer/file-ops/file-ops.js';
import { installHooks } from '~/installer/hook-installer/hook-installer.js';
import {
  resolveInstallPaths,
  runInstall,
} from '~/installer/install/install.js';
import {
  backupModifiedFiles,
  detectModifiedFiles,
} from '~/installer/manifest/manifest.js';
import { copyRoleFiles } from '~/installer/role-filter/role-filter.js';
import { printSuccess } from '~/installer/ui/ui.js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('~/installer/file-ops/file-ops.js', () => ({
  inlineWorkflows: vi.fn(),
}));

vi.mock('~/installer/hook-installer/hook-installer.js', () => ({
  installHooks: vi.fn(() => true),
}));

vi.mock('~/installer/manifest/manifest.js', () => ({
  buildManifest: vi.fn(() => ({})),
  detectModifiedFiles: vi.fn(() => []),
  backupModifiedFiles: vi.fn(() => null),
}));

vi.mock('~/installer/role-filter/role-filter.js', () => ({
  copyRoleFiles: vi.fn(),
}));

vi.mock('~/installer/ui/ui.js', () => ({
  printSuccess: vi.fn(),
}));

const mockCopyRoleFiles = vi.mocked(copyRoleFiles);
const mockInlineWorkflows = vi.mocked(inlineWorkflows);
const mockInstallHooks = vi.mocked(installHooks);
const mockPrintSuccess = vi.mocked(printSuccess);
const mockDetectModified = vi.mocked(detectModifiedFiles);
const mockBackupModified = vi.mocked(backupModifiedFiles);

const sources = {
  rolesDir: '/pkg/src/roles',
  hooksDir: '/pkg/hooks',
  bundleDir: '/pkg/bundle',
  agentsDir: '/pkg/src/agents',
};

const paths = resolveInstallPaths('local', '/home/user', '/projects/app');

const stubFs = {
  exists: () => true,
  readFile: () => '',
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  copyFile: vi.fn(),
};

const stubPrompts = {
  ask: vi.fn(() => Promise.resolve('y')),
  choose: vi.fn(() => Promise.resolve('1')),
  close: vi.fn(),
};

const baseOptions = {
  mode: 'local' as const,
  paths,
  sources,
  version: '1.0.0',
  nonInteractive: true,
  prompts: stubPrompts,
  fs: { ...stubFs },
  cwd: '/projects/app',
};

const resetMocks = (): void => {
  vi.clearAllMocks();
  mockDetectModified.mockReturnValue([]);
};

describe('runInstall', () => {
  describe('fresh install', () => {
    it('copies commands and workflows via copyRoleFiles', async () => {
      resetMocks();
      await runInstall(baseOptions);

      expect(mockCopyRoleFiles).toHaveBeenCalledWith(
        expect.objectContaining({ subdir: 'commands' }),
      );
      expect(mockCopyRoleFiles).toHaveBeenCalledWith(
        expect.objectContaining({ subdir: 'workflows' }),
      );
    });

    it('installs hooks', async () => {
      resetMocks();
      await runInstall(baseOptions);

      expect(mockInstallHooks).toHaveBeenCalledWith(
        expect.objectContaining({
          claudeConfigDir: paths.claudeConfigDir,
          hooksSourceDir: sources.hooksDir,
        }),
      );
    });

    it('calls printSuccess', async () => {
      resetMocks();
      await runInstall(baseOptions);
      expect(mockPrintSuccess).toHaveBeenCalled();
    });

    it('writes VERSION file', async () => {
      resetMocks();
      await runInstall(baseOptions);

      expect(stubFs.writeFile).toHaveBeenCalledWith(
        join(paths.commandsDest, 'VERSION'),
        '1.0.0',
      );
    });

    it('copies bundle scripts to .clancy/', async () => {
      resetMocks();
      await runInstall(baseOptions);

      expect(stubFs.copyFile).toHaveBeenCalledWith(
        join(sources.bundleDir, 'clancy-once.js'),
        join(paths.clancyProjectDir, 'clancy-once.js'),
      );
      expect(stubFs.copyFile).toHaveBeenCalledWith(
        join(sources.bundleDir, 'clancy-afk.js'),
        join(paths.clancyProjectDir, 'clancy-afk.js'),
      );
    });
  });

  describe('global mode', () => {
    it('inlines workflows for global installs', async () => {
      resetMocks();
      const globalPaths = resolveInstallPaths(
        'global',
        '/home/user',
        '/projects/app',
      );

      await runInstall({ ...baseOptions, mode: 'global', paths: globalPaths });

      expect(mockInlineWorkflows).toHaveBeenCalledWith(
        globalPaths.commandsDest,
        globalPaths.workflowsDest,
      );
    });

    it('skips inlining for local installs', async () => {
      resetMocks();
      await runInstall(baseOptions);
      expect(mockInlineWorkflows).not.toHaveBeenCalled();
    });

    it('passes null enabledRoles for global installs', async () => {
      resetMocks();
      const globalPaths = resolveInstallPaths(
        'global',
        '/home/user',
        '/projects/app',
      );

      await runInstall({ ...baseOptions, mode: 'global', paths: globalPaths });

      expect(mockCopyRoleFiles).toHaveBeenCalledWith(
        expect.objectContaining({ enabledRoles: null }),
      );
    });
  });

  describe('existing install handling', () => {
    it('aborts when user declines overwrite', async () => {
      resetMocks();
      stubPrompts.ask.mockResolvedValueOnce('n');

      await runInstall({ ...baseOptions, nonInteractive: false });

      expect(mockCopyRoleFiles).not.toHaveBeenCalled();
    });

    it('backs up modified files before overwriting', async () => {
      resetMocks();
      const modified = [{ rel: 'test.md', absPath: '/abs/test.md' }];
      mockDetectModified.mockReturnValue(modified);

      await runInstall(baseOptions);

      expect(mockBackupModified).toHaveBeenCalledWith(
        expect.arrayContaining(modified),
        paths.patchesDir,
      );
    });

    it('skips backup when no files are modified', async () => {
      resetMocks();
      mockDetectModified.mockReturnValue([]);

      await runInstall(baseOptions);

      expect(mockBackupModified).not.toHaveBeenCalled();
    });
  });
});
