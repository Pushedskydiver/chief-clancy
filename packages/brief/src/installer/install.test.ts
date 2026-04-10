import type { RunBriefInstallOptions } from './install.js';

import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  parseBriefInstallFlag,
  resolveBriefInstallPaths,
  runBriefInstall,
} from './install.js';

// ---------------------------------------------------------------------------
// parseBriefInstallFlag
// ---------------------------------------------------------------------------

describe('parseBriefInstallFlag', () => {
  it('returns "global" when --global is present', () => {
    expect(parseBriefInstallFlag(['--global'])).toBe('global');
  });

  it('returns "local" when --local is present', () => {
    expect(parseBriefInstallFlag(['--local'])).toBe('local');
  });

  it('returns null when no flag is present', () => {
    expect(parseBriefInstallFlag([])).toBeNull();
  });

  it('returns null for unrelated flags', () => {
    expect(parseBriefInstallFlag(['--verbose', '--force'])).toBeNull();
  });

  it('prefers --global when both flags are present', () => {
    expect(parseBriefInstallFlag(['--global', '--local'])).toBe('global');
  });
});

// ---------------------------------------------------------------------------
// resolveBriefInstallPaths
// ---------------------------------------------------------------------------

describe('resolveBriefInstallPaths', () => {
  const homeDir = '/home/user';
  const cwd = '/projects/my-app';

  describe('global mode', () => {
    it('resolves commands destination under ~/.claude', () => {
      const paths = resolveBriefInstallPaths('global', homeDir, cwd);

      expect(paths.commandsDest).toBe(
        join(homeDir, '.claude', 'commands', 'clancy'),
      );
    });

    it('resolves workflows destination under ~/.claude', () => {
      const paths = resolveBriefInstallPaths('global', homeDir, cwd);

      expect(paths.workflowsDest).toBe(
        join(homeDir, '.claude', 'clancy', 'workflows'),
      );
    });

    it('resolves agents destination under ~/.claude', () => {
      const paths = resolveBriefInstallPaths('global', homeDir, cwd);

      expect(paths.agentsDest).toBe(
        join(homeDir, '.claude', 'clancy', 'agents'),
      );
    });
  });

  describe('local mode', () => {
    it('resolves commands destination under cwd/.claude', () => {
      const paths = resolveBriefInstallPaths('local', homeDir, cwd);

      expect(paths.commandsDest).toBe(
        join(cwd, '.claude', 'commands', 'clancy'),
      );
    });

    it('resolves workflows destination under cwd/.claude', () => {
      const paths = resolveBriefInstallPaths('local', homeDir, cwd);

      expect(paths.workflowsDest).toBe(
        join(cwd, '.claude', 'clancy', 'workflows'),
      );
    });

    it('resolves agents destination under cwd/.claude', () => {
      const paths = resolveBriefInstallPaths('local', homeDir, cwd);

      expect(paths.agentsDest).toBe(join(cwd, '.claude', 'clancy', 'agents'));
    });
  });
});

// ---------------------------------------------------------------------------
// runBriefInstall
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

type MockOptions = Omit<RunBriefInstallOptions, 'fs'> & {
  readonly fs: MockFs;
};

const buildOptions = (
  overrides: Partial<Omit<RunBriefInstallOptions, 'fs'>> = {},
  files: Readonly<Record<string, string>> = {},
): MockOptions => {
  const sourceFiles: Record<string, string> = {
    '/pkg/src/commands/approve-brief.md':
      '# /clancy:approve-brief\n\n@.claude/clancy/workflows/approve-brief.md\n',
    '/pkg/src/commands/board-setup.md':
      '# /clancy:board-setup\n\n@.claude/clancy/workflows/board-setup.md\n',
    '/pkg/src/commands/brief.md':
      '# /clancy:brief\n\n@.claude/clancy/workflows/brief.md\n',
    '/pkg/src/workflows/approve-brief.md':
      '# Clancy Approve Brief Workflow\n\nApprove content here.',
    '/pkg/src/workflows/board-setup.md':
      '# Board Setup Workflow\n\nSetup content here.',
    '/pkg/src/workflows/brief.md':
      '# Clancy Brief Workflow\n\nWorkflow content here.',
    '/pkg/src/agents/devils-advocate.md':
      "# Devil's Advocate Agent\n\nAgent content here.",
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

describe('runBriefInstall', () => {
  it('creates destination directories', () => {
    const opts = buildOptions();
    runBriefInstall(opts);

    expect(opts.fs.mkdir).toHaveBeenCalledWith(defaultPaths.commandsDest);
    expect(opts.fs.mkdir).toHaveBeenCalledWith(defaultPaths.workflowsDest);
    expect(opts.fs.mkdir).toHaveBeenCalledWith(defaultPaths.agentsDest);
  });

  it('copies all command files', () => {
    const opts = buildOptions();
    runBriefInstall(opts);

    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.commandsDir, 'brief.md'),
      join(defaultPaths.commandsDest, 'brief.md'),
    );
    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.commandsDir, 'board-setup.md'),
      join(defaultPaths.commandsDest, 'board-setup.md'),
    );
  });

  it('copies the approve-brief command file', () => {
    const opts = buildOptions();
    runBriefInstall(opts);

    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.commandsDir, 'approve-brief.md'),
      join(defaultPaths.commandsDest, 'approve-brief.md'),
    );
  });

  it('copies all workflow files', () => {
    const opts = buildOptions();
    runBriefInstall(opts);

    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.workflowsDir, 'brief.md'),
      join(defaultPaths.workflowsDest, 'brief.md'),
    );
    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.workflowsDir, 'board-setup.md'),
      join(defaultPaths.workflowsDest, 'board-setup.md'),
    );
  });

  it('copies the approve-brief workflow file', () => {
    const opts = buildOptions();
    runBriefInstall(opts);

    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.workflowsDir, 'approve-brief.md'),
      join(defaultPaths.workflowsDest, 'approve-brief.md'),
    );
  });

  it('copies the agent file', () => {
    const opts = buildOptions();
    runBriefInstall(opts);

    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.agentsDir, 'devils-advocate.md'),
      join(defaultPaths.agentsDest, 'devils-advocate.md'),
    );
  });

  it('writes VERSION.brief with the package version', () => {
    const opts = buildOptions({ version: '1.2.3' });
    runBriefInstall(opts);

    expect(opts.fs.writeFile).toHaveBeenCalledWith(
      join(defaultPaths.commandsDest, 'VERSION.brief'),
      '1.2.3',
    );
  });

  it('throws when a source file is missing', () => {
    const fs = createMockFs({
      '/pkg/src/workflows/brief.md': '# wf',
      '/pkg/src/agents/devils-advocate.md': '# agent',
    });

    expect(() =>
      runBriefInstall({
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

    expect(() => runBriefInstall(opts)).toThrow('Symlink rejected');
  });

  it('copies scan agent files to agents destination', () => {
    const opts = buildOptions();
    runBriefInstall(opts);

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
    runBriefInstall(opts);

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
    runBriefInstall(opts);

    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.scanWorkflowsDir, 'map-codebase.md'),
      join(defaultPaths.workflowsDest, 'map-codebase.md'),
    );
    expect(opts.fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.scanWorkflowsDir, 'update-docs.md'),
      join(defaultPaths.workflowsDest, 'update-docs.md'),
    );
  });

  it('inlines scan workflow content in global mode', () => {
    const opts = buildOptions({ mode: 'global' });
    runBriefInstall(opts);

    const writeCall = opts.fs.writeFile.mock.calls.find(
      ([path]) => path === join(defaultPaths.commandsDest, 'map-codebase.md'),
    );

    expect(writeCall).toBeDefined();

    const content = writeCall![1] as string;

    expect(content).toContain('# Map Codebase Workflow');
    expect(content).not.toContain('@.claude/clancy/workflows/map-codebase.md');
  });

  describe('global mode inlining', () => {
    it('inlines workflow content into command file', () => {
      const opts = buildOptions({ mode: 'global' });
      runBriefInstall(opts);

      const writeCalls = opts.fs.writeFile.mock.calls;
      const cmdWrite = writeCalls.find(
        ([path]) => path === join(defaultPaths.commandsDest, 'brief.md'),
      );

      expect(cmdWrite).toBeDefined();
      expect(cmdWrite?.[1]).toContain('Workflow content here.');
      expect(cmdWrite?.[1]).not.toContain('@.claude/clancy/workflows/brief.md');
    });

    it('inlines workflow content into board-setup command file', () => {
      const opts = buildOptions({ mode: 'global' });
      runBriefInstall(opts);

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

    it('inlines workflow content into approve-brief command file', () => {
      const opts = buildOptions({ mode: 'global' });
      runBriefInstall(opts);

      const writeCalls = opts.fs.writeFile.mock.calls;
      const cmdWrite = writeCalls.find(
        ([path]) =>
          path === join(defaultPaths.commandsDest, 'approve-brief.md'),
      );

      expect(cmdWrite).toBeDefined();
      expect(cmdWrite?.[1]).toContain('Approve content here.');
      expect(cmdWrite?.[1]).not.toContain(
        '@.claude/clancy/workflows/approve-brief.md',
      );
    });

    it('does not inline workflow for local mode', () => {
      const opts = buildOptions({ mode: 'local' });
      runBriefInstall(opts);

      const writeCalls = opts.fs.writeFile.mock.calls;
      const cmdWrite = writeCalls.find(
        ([path]) => path === join(defaultPaths.commandsDest, 'brief.md'),
      );

      expect(cmdWrite).toBeUndefined();
    });

    it('keeps @-reference when workflow file is missing', () => {
      const opts = buildOptions(
        { mode: 'global' },
        {
          '/pkg/src/workflows/brief.md': '# Empty workflow',
        },
      );
      // Override exists to return false for the installed workflow path
      const originalExists = opts.fs.exists.getMockImplementation()!;
      opts.fs.exists.mockImplementation((p: string) => {
        if (p === join(defaultPaths.workflowsDest, 'brief.md')) return false;
        return originalExists(p);
      });

      runBriefInstall(opts);

      const writeCalls = opts.fs.writeFile.mock.calls;
      const cmdWrite = writeCalls.find(
        ([path]) => path === join(defaultPaths.commandsDest, 'brief.md'),
      );

      // Command file should NOT be rewritten (no-op because @-ref is unchanged)
      expect(cmdWrite).toBeUndefined();
    });

    it('is a no-op when command has no workflow references', () => {
      const opts = buildOptions(
        { mode: 'global' },
        {
          '/pkg/src/commands/brief.md': '# /clancy:brief\n\nNo refs here.',
        },
      );

      runBriefInstall(opts);

      const writeCalls = opts.fs.writeFile.mock.calls;
      const cmdWrite = writeCalls.find(
        ([path]) => path === join(defaultPaths.commandsDest, 'brief.md'),
      );

      // No rewrite — only VERSION.brief is written
      expect(cmdWrite).toBeUndefined();
    });
  });
});
