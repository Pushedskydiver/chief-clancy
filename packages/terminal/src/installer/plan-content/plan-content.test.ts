import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  cleanPlanContent,
  copyPlanContent,
  handlePlanContent,
} from './plan-content.js';

// ---------------------------------------------------------------------------
// Mock FS
// ---------------------------------------------------------------------------

const createMockFs = () => ({
  copyFile: vi.fn(),
  unlink: vi.fn(),
});

const defaultDirs = {
  planCommandsDir: '/pkg/src/commands',
  planWorkflowsDir: '/pkg/src/workflows',
  commandsDest: '/dest/commands/clancy',
  workflowsDest: '/dest/clancy/workflows',
};

const defaultSources = {
  planCommandsDir: defaultDirs.planCommandsDir,
  planWorkflowsDir: defaultDirs.planWorkflowsDir,
};

const defaultDests = {
  commandsDest: defaultDirs.commandsDest,
  workflowsDest: defaultDirs.workflowsDest,
};

// ---------------------------------------------------------------------------
// copyPlanContent
// ---------------------------------------------------------------------------

describe('copyPlanContent', () => {
  it('copies plan command to commands destination', () => {
    const fs = createMockFs();
    copyPlanContent({ ...defaultDirs, fs });

    expect(fs.copyFile).toHaveBeenCalledWith(
      join(defaultDirs.planCommandsDir, 'plan.md'),
      join(defaultDirs.commandsDest, 'plan.md'),
    );
  });

  it('copies plan workflow to workflows destination', () => {
    const fs = createMockFs();
    copyPlanContent({ ...defaultDirs, fs });

    expect(fs.copyFile).toHaveBeenCalledWith(
      join(defaultDirs.planWorkflowsDir, 'plan.md'),
      join(defaultDirs.workflowsDest, 'plan.md'),
    );
  });

  it('copies approve-plan command to commands destination', () => {
    const fs = createMockFs();
    copyPlanContent({ ...defaultDirs, fs });

    expect(fs.copyFile).toHaveBeenCalledWith(
      join(defaultDirs.planCommandsDir, 'approve-plan.md'),
      join(defaultDirs.commandsDest, 'approve-plan.md'),
    );
  });

  it('copies approve-plan workflow to workflows destination', () => {
    const fs = createMockFs();
    copyPlanContent({ ...defaultDirs, fs });

    expect(fs.copyFile).toHaveBeenCalledWith(
      join(defaultDirs.planWorkflowsDir, 'approve-plan.md'),
      join(defaultDirs.workflowsDest, 'approve-plan.md'),
    );
  });

  it('copies implement-from command to commands destination', () => {
    const fs = createMockFs();
    copyPlanContent({ ...defaultDirs, fs });

    expect(fs.copyFile).toHaveBeenCalledWith(
      join(defaultDirs.planCommandsDir, 'implement-from.md'),
      join(defaultDirs.commandsDest, 'implement-from.md'),
    );
  });

  it('copies implement-from workflow to workflows destination', () => {
    const fs = createMockFs();
    copyPlanContent({ ...defaultDirs, fs });

    expect(fs.copyFile).toHaveBeenCalledWith(
      join(defaultDirs.planWorkflowsDir, 'implement-from.md'),
      join(defaultDirs.workflowsDest, 'implement-from.md'),
    );
  });
});

// ---------------------------------------------------------------------------
// cleanPlanContent
// ---------------------------------------------------------------------------

describe('cleanPlanContent', () => {
  it('unlinks plan files from destinations', () => {
    const fs = createMockFs();
    cleanPlanContent({ ...defaultDirs, fs });

    expect(fs.unlink).toHaveBeenCalledWith(
      join(defaultDirs.commandsDest, 'plan.md'),
    );
    expect(fs.unlink).toHaveBeenCalledWith(
      join(defaultDirs.workflowsDest, 'plan.md'),
    );
  });

  it('unlinks approve-plan files from destinations', () => {
    const fs = createMockFs();
    cleanPlanContent({ ...defaultDirs, fs });

    expect(fs.unlink).toHaveBeenCalledWith(
      join(defaultDirs.commandsDest, 'approve-plan.md'),
    );
    expect(fs.unlink).toHaveBeenCalledWith(
      join(defaultDirs.workflowsDest, 'approve-plan.md'),
    );
  });

  it('unlinks implement-from files from destinations', () => {
    const fs = createMockFs();
    cleanPlanContent({ ...defaultDirs, fs });

    expect(fs.unlink).toHaveBeenCalledWith(
      join(defaultDirs.commandsDest, 'implement-from.md'),
    );
    expect(fs.unlink).toHaveBeenCalledWith(
      join(defaultDirs.workflowsDest, 'implement-from.md'),
    );
  });

  it('ignores ENOENT errors from unlink', () => {
    const fs = createMockFs();
    const enoent = Object.assign(new Error('not found'), { code: 'ENOENT' });
    fs.unlink.mockImplementation(() => {
      throw enoent;
    });

    expect(() => cleanPlanContent({ ...defaultDirs, fs })).not.toThrow();
  });

  it('rethrows non-ENOENT errors from unlink', () => {
    const fs = createMockFs();
    const eperm = Object.assign(new Error('permission denied'), {
      code: 'EPERM',
    });
    fs.unlink.mockImplementation(() => {
      throw eperm;
    });

    expect(() => cleanPlanContent({ ...defaultDirs, fs })).toThrow(
      'permission denied',
    );
  });
});

// ---------------------------------------------------------------------------
// handlePlanContent
// ---------------------------------------------------------------------------

describe('handlePlanContent', () => {
  it('is a no-op when plan source dirs are absent', () => {
    const fs = createMockFs();

    handlePlanContent({
      sources: {},
      dests: defaultDests,
      enabledRoles: null,
      fs,
    });

    expect(fs.copyFile).not.toHaveBeenCalled();
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('copies when planner is enabled', () => {
    const fs = createMockFs();

    handlePlanContent({
      sources: defaultSources,
      dests: defaultDests,
      enabledRoles: new Set(['planner']),
      fs,
    });

    expect(fs.copyFile).toHaveBeenCalledTimes(6);
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('copies when enabledRoles is null (first install)', () => {
    const fs = createMockFs();

    handlePlanContent({
      sources: defaultSources,
      dests: defaultDests,
      enabledRoles: null,
      fs,
    });

    expect(fs.copyFile).toHaveBeenCalledTimes(6);
  });

  it('cleans when planner is disabled', () => {
    const fs = createMockFs();

    handlePlanContent({
      sources: defaultSources,
      dests: defaultDests,
      enabledRoles: new Set(['strategist']),
      fs,
    });

    expect(fs.copyFile).not.toHaveBeenCalled();
    expect(fs.unlink).toHaveBeenCalledTimes(6);
  });
});
