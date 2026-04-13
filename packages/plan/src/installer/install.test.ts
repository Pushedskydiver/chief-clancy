import type { RunPlanInstallOptions } from './install.js';

import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  parsePlanInstallFlag,
  resolvePlanInstallPaths,
  runPlanInstall,
} from './install.js';

// ---------------------------------------------------------------------------
// parsePlanInstallFlag
// ---------------------------------------------------------------------------

describe('parsePlanInstallFlag', () => {
  it('returns "global" when --global is present', () => {
    expect(parsePlanInstallFlag(['--global'])).toBe('global');
  });

  it('returns "local" when --local is present', () => {
    expect(parsePlanInstallFlag(['--local'])).toBe('local');
  });

  it('returns null when no flag is present', () => {
    expect(parsePlanInstallFlag([])).toBeNull();
  });

  it('returns null for unrelated flags', () => {
    expect(parsePlanInstallFlag(['--verbose', '--force'])).toBeNull();
  });

  it('prefers --global when both flags are present', () => {
    expect(parsePlanInstallFlag(['--global', '--local'])).toBe('global');
  });
});

// ---------------------------------------------------------------------------
// resolvePlanInstallPaths
// ---------------------------------------------------------------------------

describe('resolvePlanInstallPaths', () => {
  const homeDir = '/home/user';
  const cwd = '/projects/my-app';

  describe('global mode', () => {
    it('resolves commands destination under ~/.claude', () => {
      const paths = resolvePlanInstallPaths('global', homeDir, cwd);

      expect(paths.commandsDest).toBe(
        join(homeDir, '.claude', 'commands', 'clancy'),
      );
    });

    it('resolves workflows destination under ~/.claude', () => {
      const paths = resolvePlanInstallPaths('global', homeDir, cwd);

      expect(paths.workflowsDest).toBe(
        join(homeDir, '.claude', 'clancy', 'workflows'),
      );
    });

    it('resolves agents destination under ~/.claude', () => {
      const paths = resolvePlanInstallPaths('global', homeDir, cwd);

      expect(paths.agentsDest).toBe(
        join(homeDir, '.claude', 'clancy', 'agents'),
      );
    });
  });

  describe('local mode', () => {
    it('resolves commands destination under cwd/.claude', () => {
      const paths = resolvePlanInstallPaths('local', homeDir, cwd);

      expect(paths.commandsDest).toBe(
        join(cwd, '.claude', 'commands', 'clancy'),
      );
    });

    it('resolves workflows destination under cwd/.claude', () => {
      const paths = resolvePlanInstallPaths('local', homeDir, cwd);

      expect(paths.workflowsDest).toBe(
        join(cwd, '.claude', 'clancy', 'workflows'),
      );
    });

    it('resolves agents destination under cwd/.claude', () => {
      const paths = resolvePlanInstallPaths('local', homeDir, cwd);

      expect(paths.agentsDest).toBe(join(cwd, '.claude', 'clancy', 'agents'));
    });
  });
});

// ---------------------------------------------------------------------------
// runPlanInstall
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
    isSymlink: vi.fn(() => false),
  };
};

const defaultSources = {
  commandsDir: '/pkg/src/commands',
  workflowsDir: '/pkg/src/workflows',
  agentsDir: '/pkg/src/agents',
  scanAgentsDir: '/scan/src/agents',
  scanCommandsDir: '/scan/src/commands',
  scanWorkflowsDir: '/scan/src/workflows',
};

const defaultPaths = {
  commandsDest: '/dest/commands/clancy',
  workflowsDest: '/dest/clancy/workflows',
  agentsDest: '/dest/clancy/agents',
};

type MockFs = ReturnType<typeof createMockFs>;

type MockOptions = Omit<RunPlanInstallOptions, 'fs'> & {
  readonly fs: MockFs;
};

const buildOptions = (
  overrides: Partial<Omit<RunPlanInstallOptions, 'fs'>> = {},
  files: Readonly<Record<string, string>> = {},
): MockOptions => {
  const sourceFiles: Record<string, string> = {
    '/pkg/src/commands/approve-plan.md':
      '# /clancy:approve-plan\n\n@.claude/clancy/workflows/approve-plan.md\n',
    '/pkg/src/commands/board-setup.md':
      '# /clancy:board-setup\n\n@.claude/clancy/workflows/board-setup.md\n',
    '/pkg/src/commands/plan.md':
      '# /clancy:plan\n\n@.claude/clancy/workflows/plan.md\n',
    '/pkg/src/commands/uninstall-plan.md':
      '# /clancy:uninstall-plan\n\n@.claude/clancy/workflows/uninstall-plan.md\n',
    '/pkg/src/commands/update-plan.md':
      '# /clancy:update-plan\n\n@.claude/clancy/workflows/update-plan.md\n',
    '/pkg/src/workflows/approve-plan.md':
      '# Clancy Approve Plan Workflow\n\nApprove plan content here.',
    '/pkg/src/workflows/board-setup.md':
      '# Board Setup Workflow\n\nSetup content here.',
    '/pkg/src/workflows/plan.md':
      '# Clancy Plan Workflow\n\nWorkflow content here.',
    '/pkg/src/workflows/uninstall-plan.md':
      '# Clancy Uninstall Plan Workflow\n\nUninstall content here.',
    '/pkg/src/workflows/update-plan.md':
      '# Clancy Update Plan Workflow\n\nUpdate content here.',
    '/pkg/src/agents/devils-advocate.md': "# Devil's Advocate Agent",
    '/scan/src/agents/arch-agent.md': '# Architecture Agent',
    '/scan/src/agents/concerns-agent.md': '# Concerns Agent',
    '/scan/src/agents/design-agent.md': '# Design Agent',
    '/scan/src/agents/quality-agent.md': '# Quality Agent',
    '/scan/src/agents/tech-agent.md': '# Tech Agent',
    '/scan/src/commands/map-codebase.md':
      '# /clancy:map-codebase\n\n@.claude/clancy/workflows/map-codebase.md\n\nRun the scan.',
    '/scan/src/commands/update-docs.md':
      '# /clancy:update-docs\n\n@.claude/clancy/workflows/update-docs.md\n\nRun the update.',
    '/scan/src/workflows/map-codebase.md':
      '# Map Codebase Workflow\n\nStep 1...',
    '/scan/src/workflows/update-docs.md': '# Update Docs Workflow\n\nStep 1...',
    ...files,
  };
  const fs = createMockFs(sourceFiles);

  return {
    mode: 'local',
    paths: defaultPaths,
    sources: defaultSources,
    version: '0.1.0',
    fs,
    ...overrides,
  };
};

describe('runPlanInstall', () => {
  it('creates destination directories', () => {
    const opts = buildOptions();
    runPlanInstall(opts);

    expect(opts.fs.mkdir).toHaveBeenCalledWith(defaultPaths.commandsDest);
    expect(opts.fs.mkdir).toHaveBeenCalledWith(defaultPaths.workflowsDest);
    expect(opts.fs.mkdir).toHaveBeenCalledWith(defaultPaths.agentsDest);
  });

  it('copies all command files', () => {
    const opts = buildOptions();
    runPlanInstall(opts);

    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.commandsDir, 'plan.md'),
      join(defaultPaths.commandsDest, 'plan.md'),
    );
    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.commandsDir, 'board-setup.md'),
      join(defaultPaths.commandsDest, 'board-setup.md'),
    );
    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.commandsDir, 'approve-plan.md'),
      join(defaultPaths.commandsDest, 'approve-plan.md'),
    );
  });

  it('copies all workflow files', () => {
    const opts = buildOptions();
    runPlanInstall(opts);

    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.workflowsDir, 'plan.md'),
      join(defaultPaths.workflowsDest, 'plan.md'),
    );
    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.workflowsDir, 'board-setup.md'),
      join(defaultPaths.workflowsDest, 'board-setup.md'),
    );
    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.workflowsDir, 'approve-plan.md'),
      join(defaultPaths.workflowsDest, 'approve-plan.md'),
    );
  });

  it('writes VERSION.plan with the package version', () => {
    const opts = buildOptions({ version: '1.2.3' });
    runPlanInstall(opts);

    expect(opts.fs.writeFile).toHaveBeenCalledWith(
      join(defaultPaths.commandsDest, 'VERSION.plan'),
      '1.2.3',
    );
  });

  it('throws when a source file is missing', () => {
    const fs = createMockFs({
      '/pkg/src/workflows/plan.md': '# wf',
    });

    expect(() =>
      runPlanInstall({
        mode: 'local',
        paths: defaultPaths,
        sources: defaultSources,
        version: '0.1.0',
        fs,
      }),
    ).toThrow('Source file not found');
  });

  it('rejects symlink destinations', () => {
    const opts = buildOptions();
    opts.fs.isSymlink.mockReturnValue(true);

    expect(() => runPlanInstall(opts)).toThrow('Symlink rejected');
  });

  it('copies plan agent files to agents destination', () => {
    const opts = buildOptions();
    runPlanInstall(opts);

    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.agentsDir, 'devils-advocate.md'),
      join(defaultPaths.agentsDest, 'devils-advocate.md'),
    );
  });

  it('does not inline plan agent files in global mode', () => {
    const opts = buildOptions({ mode: 'global' });
    runPlanInstall(opts);

    const writeCalls = opts.fs.writeFile.mock.calls;
    const agentWrite = writeCalls.find(
      ([path]) => path === join(defaultPaths.agentsDest, 'devils-advocate.md'),
    );

    expect(agentWrite).toBeUndefined();
  });

  it('copies scan agent files to agents destination', () => {
    const opts = buildOptions();
    runPlanInstall(opts);

    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.scanAgentsDir, 'tech-agent.md'),
      join(defaultPaths.agentsDest, 'tech-agent.md'),
    );
    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.scanAgentsDir, 'arch-agent.md'),
      join(defaultPaths.agentsDest, 'arch-agent.md'),
    );
  });

  it('copies scan command files to commands destination', () => {
    const opts = buildOptions();
    runPlanInstall(opts);

    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.scanCommandsDir, 'map-codebase.md'),
      join(defaultPaths.commandsDest, 'map-codebase.md'),
    );
    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.scanCommandsDir, 'update-docs.md'),
      join(defaultPaths.commandsDest, 'update-docs.md'),
    );
  });

  it('copies scan workflow files to workflows destination', () => {
    const opts = buildOptions();
    runPlanInstall(opts);

    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.scanWorkflowsDir, 'map-codebase.md'),
      join(defaultPaths.workflowsDest, 'map-codebase.md'),
    );
    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.scanWorkflowsDir, 'update-docs.md'),
      join(defaultPaths.workflowsDest, 'update-docs.md'),
    );
  });

  it('copies the uninstall-plan command file', () => {
    const opts = buildOptions();
    runPlanInstall(opts);

    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.commandsDir, 'uninstall-plan.md'),
      join(defaultPaths.commandsDest, 'uninstall-plan.md'),
    );
  });

  it('copies the uninstall-plan workflow file', () => {
    const opts = buildOptions();
    runPlanInstall(opts);

    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.workflowsDir, 'uninstall-plan.md'),
      join(defaultPaths.workflowsDest, 'uninstall-plan.md'),
    );
  });

  it('inlines uninstall-plan workflow in global mode', () => {
    const opts = buildOptions({ mode: 'global' });
    runPlanInstall(opts);

    const writeCalls = opts.fs.writeFile.mock.calls;
    const cmdWrite = writeCalls.find(
      ([path]) => path === join(defaultPaths.commandsDest, 'uninstall-plan.md'),
    );

    expect(cmdWrite).toBeDefined();
    expect(cmdWrite?.[1]).toContain('Uninstall content here.');
    expect(cmdWrite?.[1]).not.toContain(
      '@.claude/clancy/workflows/uninstall-plan.md',
    );
  });

  it('copies the update-plan command file', () => {
    const opts = buildOptions();
    runPlanInstall(opts);

    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.commandsDir, 'update-plan.md'),
      join(defaultPaths.commandsDest, 'update-plan.md'),
    );
  });

  it('copies the update-plan workflow file', () => {
    const opts = buildOptions();
    runPlanInstall(opts);

    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.workflowsDir, 'update-plan.md'),
      join(defaultPaths.workflowsDest, 'update-plan.md'),
    );
  });

  it('inlines update-plan workflow in global mode', () => {
    const opts = buildOptions({ mode: 'global' });
    runPlanInstall(opts);

    const writeCalls = opts.fs.writeFile.mock.calls;
    const cmdWrite = writeCalls.find(
      ([path]) => path === join(defaultPaths.commandsDest, 'update-plan.md'),
    );

    expect(cmdWrite).toBeDefined();
    expect(cmdWrite?.[1]).toContain('Update content here.');
    expect(cmdWrite?.[1]).not.toContain(
      '@.claude/clancy/workflows/update-plan.md',
    );
  });

  it('inlines scan workflow content in global mode', () => {
    const opts = buildOptions({ mode: 'global' });
    runPlanInstall(opts);

    const writeCall = opts.fs.writeFile.mock.calls.find(
      ([path]) => path === join(defaultPaths.commandsDest, 'map-codebase.md'),
    );

    expect(writeCall).toBeDefined();

    const content = writeCall![1];

    expect(content).toContain('# Map Codebase Workflow');
    expect(content).not.toContain('@.claude/clancy/workflows/map-codebase.md');
  });

  describe('global mode inlining', () => {
    it('inlines workflow content into command file', () => {
      const opts = buildOptions({ mode: 'global' });
      runPlanInstall(opts);

      const writeCalls = opts.fs.writeFile.mock.calls;
      const cmdWrite = writeCalls.find(
        ([path]) => path === join(defaultPaths.commandsDest, 'plan.md'),
      );

      expect(cmdWrite).toBeDefined();
      expect(cmdWrite?.[1]).toContain('Workflow content here.');
      expect(cmdWrite?.[1]).not.toContain('@.claude/clancy/workflows/plan.md');
    });

    it('inlines workflow content into board-setup command file', () => {
      const opts = buildOptions({ mode: 'global' });
      runPlanInstall(opts);

      const writeCalls = opts.fs.writeFile.mock.calls;
      const cmdWrite = writeCalls.find(
        ([path]) => path === join(defaultPaths.commandsDest, 'board-setup.md'),
      );

      expect(cmdWrite).toBeDefined();
      expect(cmdWrite?.[1]).toContain('Setup content here.');
      expect(cmdWrite?.[1]).not.toContain(
        '@.claude/clancy/workflows/board-setup.md',
      );
    });

    it('inlines workflow content into approve-plan command file', () => {
      const opts = buildOptions({ mode: 'global' });
      runPlanInstall(opts);

      const writeCalls = opts.fs.writeFile.mock.calls;
      const cmdWrite = writeCalls.find(
        ([path]) => path === join(defaultPaths.commandsDest, 'approve-plan.md'),
      );

      expect(cmdWrite).toBeDefined();
      expect(cmdWrite?.[1]).toContain('Approve plan content here.');
      expect(cmdWrite?.[1]).not.toContain(
        '@.claude/clancy/workflows/approve-plan.md',
      );
    });

    it('does not inline workflow for local mode', () => {
      const opts = buildOptions({ mode: 'local' });
      runPlanInstall(opts);

      const writeCalls = opts.fs.writeFile.mock.calls;
      const cmdWrite = writeCalls.find(
        ([path]) => path === join(defaultPaths.commandsDest, 'plan.md'),
      );

      expect(cmdWrite).toBeUndefined();
    });

    it('keeps @-reference when workflow file is missing', () => {
      const opts = buildOptions(
        { mode: 'global' },
        {
          '/pkg/src/workflows/plan.md': '# Empty workflow',
        },
      );
      // Override exists to return false for the installed workflow path
      const originalExists = opts.fs.exists.getMockImplementation()!;
      opts.fs.exists.mockImplementation((p: string) => {
        if (p === join(defaultPaths.workflowsDest, 'plan.md')) return false;
        return originalExists(p);
      });

      runPlanInstall(opts);

      const writeCalls = opts.fs.writeFile.mock.calls;
      const cmdWrite = writeCalls.find(
        ([path]) => path === join(defaultPaths.commandsDest, 'plan.md'),
      );

      // Command file should NOT be rewritten (no-op because @-ref is unchanged)
      expect(cmdWrite).toBeUndefined();
    });

    it('is a no-op when command has no workflow references', () => {
      const opts = buildOptions(
        { mode: 'global' },
        {
          '/pkg/src/commands/plan.md': '# /clancy:plan\n\nNo refs here.',
        },
      );

      runPlanInstall(opts);

      const writeCalls = opts.fs.writeFile.mock.calls;
      const cmdWrite = writeCalls.find(
        ([path]) => path === join(defaultPaths.commandsDest, 'plan.md'),
      );

      // No rewrite — only VERSION.plan is written
      expect(cmdWrite).toBeUndefined();
    });
  });
});
