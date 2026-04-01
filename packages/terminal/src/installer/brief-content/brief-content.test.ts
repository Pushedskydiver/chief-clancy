import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  cleanBriefContent,
  copyBriefContent,
  handleBriefContent,
} from './brief-content.js';

// ---------------------------------------------------------------------------
// Mock FS
// ---------------------------------------------------------------------------

const createMockFs = (existingPaths: readonly string[] = []) => {
  const existing = new Set(existingPaths);

  return {
    exists: vi.fn((p: string) => existing.has(p)),
    mkdir: vi.fn(),
    copyFile: vi.fn(),
    unlink: vi.fn(),
  };
};

const defaultDirs = {
  briefCommandsDir: '/pkg/src/commands',
  briefWorkflowsDir: '/pkg/src/workflows',
  briefAgentsDir: '/pkg/src/agents',
  commandsDest: '/dest/commands/clancy',
  workflowsDest: '/dest/clancy/workflows',
  agentsDest: '/dest/clancy/agents',
};

const allSourcesExist = [
  defaultDirs.briefCommandsDir,
  defaultDirs.briefWorkflowsDir,
  defaultDirs.briefAgentsDir,
];

const defaultSources = {
  briefCommandsDir: defaultDirs.briefCommandsDir,
  briefWorkflowsDir: defaultDirs.briefWorkflowsDir,
  briefAgentsDir: defaultDirs.briefAgentsDir,
};

const defaultDests = {
  commandsDest: defaultDirs.commandsDest,
  workflowsDest: defaultDirs.workflowsDest,
  agentsDest: defaultDirs.agentsDest,
};

// ---------------------------------------------------------------------------
// copyBriefContent
// ---------------------------------------------------------------------------

describe('copyBriefContent', () => {
  it('copies brief command to commands destination', () => {
    const fs = createMockFs(allSourcesExist);
    copyBriefContent({ ...defaultDirs, fs });

    expect(fs.copyFile).toHaveBeenCalledWith(
      join(defaultDirs.briefCommandsDir, 'brief.md'),
      join(defaultDirs.commandsDest, 'brief.md'),
    );
  });

  it('copies brief workflow to workflows destination', () => {
    const fs = createMockFs(allSourcesExist);
    copyBriefContent({ ...defaultDirs, fs });

    expect(fs.copyFile).toHaveBeenCalledWith(
      join(defaultDirs.briefWorkflowsDir, 'brief.md'),
      join(defaultDirs.workflowsDest, 'brief.md'),
    );
  });

  it('copies devils-advocate agent to agents destination', () => {
    const fs = createMockFs(allSourcesExist);
    copyBriefContent({ ...defaultDirs, fs });

    expect(fs.copyFile).toHaveBeenCalledWith(
      join(defaultDirs.briefAgentsDir, 'devils-advocate.md'),
      join(defaultDirs.agentsDest, 'devils-advocate.md'),
    );
  });

  it('creates agents destination directory', () => {
    const fs = createMockFs(allSourcesExist);
    copyBriefContent({ ...defaultDirs, fs });

    expect(fs.mkdir).toHaveBeenCalledWith(defaultDirs.agentsDest);
  });

  it('throws when commands source dir does not exist', () => {
    const fs = createMockFs([
      defaultDirs.briefWorkflowsDir,
      defaultDirs.briefAgentsDir,
    ]);

    expect(() => copyBriefContent({ ...defaultDirs, fs })).toThrow(
      'Brief commands source not found',
    );
  });

  it('throws when workflows source dir does not exist', () => {
    const fs = createMockFs([
      defaultDirs.briefCommandsDir,
      defaultDirs.briefAgentsDir,
    ]);

    expect(() => copyBriefContent({ ...defaultDirs, fs })).toThrow(
      'Brief workflows source not found',
    );
  });

  it('throws when agents source dir does not exist', () => {
    const fs = createMockFs([
      defaultDirs.briefCommandsDir,
      defaultDirs.briefWorkflowsDir,
    ]);

    expect(() => copyBriefContent({ ...defaultDirs, fs })).toThrow(
      'Brief agents source not found',
    );
  });
});

// ---------------------------------------------------------------------------
// cleanBriefContent
// ---------------------------------------------------------------------------

describe('cleanBriefContent', () => {
  it('unlinks brief files from destinations', () => {
    const fs = createMockFs();
    cleanBriefContent({ ...defaultDirs, fs });

    expect(fs.unlink).toHaveBeenCalledWith(
      join(defaultDirs.commandsDest, 'brief.md'),
    );
    expect(fs.unlink).toHaveBeenCalledWith(
      join(defaultDirs.workflowsDest, 'brief.md'),
    );
    expect(fs.unlink).toHaveBeenCalledWith(
      join(defaultDirs.agentsDest, 'devils-advocate.md'),
    );
  });

  it('does not throw when unlink fails', () => {
    const fs = createMockFs();
    fs.unlink.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    expect(() => cleanBriefContent({ ...defaultDirs, fs })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// handleBriefContent
// ---------------------------------------------------------------------------

describe('handleBriefContent', () => {
  it('is a no-op when brief source dirs are absent', () => {
    const fs = createMockFs();

    handleBriefContent({
      sources: {},
      dests: {
        commandsDest: defaultDirs.commandsDest,
        workflowsDest: defaultDirs.workflowsDest,
        agentsDest: defaultDirs.agentsDest,
      },
      enabledRoles: null,
      fs,
    });

    expect(fs.copyFile).not.toHaveBeenCalled();
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('copies when strategist is enabled', () => {
    const fs = createMockFs(allSourcesExist);

    handleBriefContent({
      sources: defaultSources,
      dests: defaultDests,
      enabledRoles: new Set(['strategist']),
      fs,
    });

    expect(fs.copyFile).toHaveBeenCalledTimes(3);
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('copies when enabledRoles is null (first install)', () => {
    const fs = createMockFs(allSourcesExist);

    handleBriefContent({
      sources: defaultSources,
      dests: defaultDests,
      enabledRoles: null,
      fs,
    });

    expect(fs.copyFile).toHaveBeenCalledTimes(3);
  });

  it('cleans when strategist is disabled', () => {
    const fs = createMockFs();

    handleBriefContent({
      sources: defaultSources,
      dests: defaultDests,
      enabledRoles: new Set(['planner']),
      fs,
    });

    expect(fs.copyFile).not.toHaveBeenCalled();
    expect(fs.unlink).toHaveBeenCalledTimes(3);
  });
});
