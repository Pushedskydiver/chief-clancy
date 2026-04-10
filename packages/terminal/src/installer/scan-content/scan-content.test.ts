import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { handleScanContent } from './scan-content.js';

// ---------------------------------------------------------------------------
// Mock FS
// ---------------------------------------------------------------------------

const createMockFs = () => ({
  mkdir: vi.fn(),
  copyFile: vi.fn(),
});

const defaultSources = {
  scanAgentsDir: '/scan/src/agents',
  scanCommandsDir: '/scan/src/commands',
  scanWorkflowsDir: '/scan/src/workflows',
};

const defaultDests = {
  commandsDest: '/dest/commands/clancy',
  workflowsDest: '/dest/clancy/workflows',
  agentsDest: '/dest/clancy/agents',
};

// ---------------------------------------------------------------------------
// handleScanContent
// ---------------------------------------------------------------------------

describe('handleScanContent', () => {
  it('copies scan agent files to agents destination', () => {
    const fs = createMockFs();
    handleScanContent({ sources: defaultSources, dests: defaultDests, fs });

    expect(fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.scanAgentsDir, 'tech-agent.md'),
      join(defaultDests.agentsDest, 'tech-agent.md'),
    );
    expect(fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.scanAgentsDir, 'arch-agent.md'),
      join(defaultDests.agentsDest, 'arch-agent.md'),
    );
  });

  it('copies scan command files to commands destination', () => {
    const fs = createMockFs();
    handleScanContent({ sources: defaultSources, dests: defaultDests, fs });

    expect(fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.scanCommandsDir, 'map-codebase.md'),
      join(defaultDests.commandsDest, 'map-codebase.md'),
    );
    expect(fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.scanCommandsDir, 'update-docs.md'),
      join(defaultDests.commandsDest, 'update-docs.md'),
    );
  });

  it('copies scan workflow files to workflows destination', () => {
    const fs = createMockFs();
    handleScanContent({ sources: defaultSources, dests: defaultDests, fs });

    expect(fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.scanWorkflowsDir, 'map-codebase.md'),
      join(defaultDests.workflowsDest, 'map-codebase.md'),
    );
    expect(fs.copyFile).toHaveBeenCalledWith(
      join(defaultSources.scanWorkflowsDir, 'update-docs.md'),
      join(defaultDests.workflowsDest, 'update-docs.md'),
    );
  });

  it('creates agentsDest directory before copying', () => {
    const fs = createMockFs();
    handleScanContent({ sources: defaultSources, dests: defaultDests, fs });

    expect(fs.mkdir).toHaveBeenCalledWith(defaultDests.agentsDest);
  });

  it('is a no-op when scan source dirs are absent', () => {
    const fs = createMockFs();
    handleScanContent({ sources: {}, dests: defaultDests, fs });

    expect(fs.copyFile).not.toHaveBeenCalled();
    expect(fs.mkdir).not.toHaveBeenCalled();
  });

  it('is a no-op when only some scan dirs are present', () => {
    const fs = createMockFs();
    handleScanContent({
      sources: { scanAgentsDir: '/scan/src/agents' },
      dests: defaultDests,
      fs,
    });

    expect(fs.copyFile).not.toHaveBeenCalled();
  });
});
