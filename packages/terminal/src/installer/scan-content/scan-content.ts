/**
 * Scan content installer — copies scan agent, command, and workflow files
 * from the @chief-clancy/scan package into the install destination.
 *
 * Separate from the role-filter system because scan is a standalone
 * package, not a terminal role directory.
 */
import { join } from 'node:path';

import { rejectSymlink } from '~/t/installer/shared/fs-guards/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** File system operations for scan content copying. */
type ScanCopyFs = {
  readonly mkdir: (path: string) => void;
  readonly copyFile: (src: string, dest: string) => void;
};

type CopyScanContentOptions = {
  readonly scanAgentsDir: string;
  readonly scanCommandsDir: string;
  readonly scanWorkflowsDir: string;
  readonly commandsDest: string;
  readonly workflowsDest: string;
  readonly agentsDest: string;
  readonly fs: ScanCopyFs;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Scan agent files from @chief-clancy/scan. */
const SCAN_AGENT_FILES = [
  'arch-agent.md',
  'concerns-agent.md',
  'design-agent.md',
  'quality-agent.md',
  'tech-agent.md',
] as const;

/** Scan command files from @chief-clancy/scan. */
const SCAN_COMMAND_FILES = ['map-codebase.md', 'update-docs.md'] as const;

/** Scan workflow files from @chief-clancy/scan. */
const SCAN_WORKFLOW_FILES = ['map-codebase.md', 'update-docs.md'] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Copy a single file with symlink protection. */
const copyChecked = (src: string, dest: string, fs: ScanCopyFs): void => {
  rejectSymlink(dest);
  fs.copyFile(src, dest);
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Copy scan agent, command, and workflow files to the install destination.
 *
 * Always copies — scan content is unconditional (not role-gated).
 */
const copyScanContent = (options: CopyScanContentOptions): void => {
  const { scanAgentsDir, scanCommandsDir, scanWorkflowsDir, fs } = options;
  const { commandsDest, workflowsDest, agentsDest } = options;

  rejectSymlink(commandsDest);
  rejectSymlink(workflowsDest);
  rejectSymlink(agentsDest);
  fs.mkdir(agentsDest);

  SCAN_AGENT_FILES.forEach((file) => {
    copyChecked(join(scanAgentsDir, file), join(agentsDest, file), fs);
  });
  SCAN_COMMAND_FILES.forEach((file) => {
    copyChecked(join(scanCommandsDir, file), join(commandsDest, file), fs);
  });
  SCAN_WORKFLOW_FILES.forEach((file) => {
    copyChecked(join(scanWorkflowsDir, file), join(workflowsDest, file), fs);
  });
};

type ScanSources = {
  readonly scanAgentsDir?: string;
  readonly scanCommandsDir?: string;
  readonly scanWorkflowsDir?: string;
};

type ScanDests = {
  readonly commandsDest: string;
  readonly workflowsDest: string;
  readonly agentsDest: string;
};

type HandleScanContentOptions = {
  readonly sources: ScanSources;
  readonly dests: ScanDests;
  readonly fs: ScanCopyFs;
};

/**
 * Install scan content if source dirs are available.
 *
 * No-op when scan source dirs are absent (direct terminal usage without
 * the scan package). Unlike brief/plan, scan content is not role-gated —
 * map-codebase and update-docs are always useful.
 */
export const handleScanContent = (options: HandleScanContentOptions): void => {
  const { sources, dests, fs } = options;
  const { scanAgentsDir, scanCommandsDir, scanWorkflowsDir } = sources;

  if (!scanAgentsDir || !scanCommandsDir || !scanWorkflowsDir) return;

  copyScanContent({
    scanAgentsDir,
    scanCommandsDir,
    scanWorkflowsDir,
    ...dests,
    fs,
  });
};
