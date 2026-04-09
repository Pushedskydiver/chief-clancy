/**
 * Brief content installer — copies brief command, workflow, and agent
 * files from the @chief-clancy/brief package into the install destination.
 *
 * Separate from the role-filter system because brief is a standalone
 * package, not a terminal role directory.
 */
import { join } from 'node:path';

import { hasErrorCode } from '~/t/installer/shared/fs-errors/index.js';
import { rejectSymlink } from '~/t/installer/shared/fs-guards/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** File system operations for brief content copying. */
type BriefCopyFs = {
  readonly mkdir: (path: string) => void;
  readonly copyFile: (src: string, dest: string) => void;
};

type CopyBriefContentOptions = {
  readonly briefCommandsDir: string;
  readonly briefWorkflowsDir: string;
  readonly briefAgentsDir: string;
  readonly commandsDest: string;
  readonly workflowsDest: string;
  readonly agentsDest: string;
  readonly fs: BriefCopyFs;
};

type BriefCleanFs = {
  readonly unlink: (path: string) => void;
};

type CleanBriefContentOptions = {
  readonly commandsDest: string;
  readonly workflowsDest: string;
  readonly agentsDest: string;
  readonly fs: BriefCleanFs;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BRIEF_COMMANDS = ['approve-brief.md', 'brief.md'] as const;
const BRIEF_WORKFLOWS = ['approve-brief.md', 'brief.md'] as const;
const BRIEF_AGENT = 'devils-advocate.md';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Copy a single file with symlink protection. */
const copyChecked = (src: string, dest: string, fs: BriefCopyFs): void => {
  rejectSymlink(dest);
  fs.copyFile(src, dest);
};

/** Remove a file, ignoring ENOENT. Rethrows other errors. */
const unlinkSafe = (path: string, fs: BriefCleanFs): void => {
  try {
    fs.unlink(path);
  } catch (err: unknown) {
    if (!hasErrorCode(err, 'ENOENT')) throw err;
  }
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Copy brief command, workflow, and agent files to the install destination.
 *
 * Validates that all source directories exist before copying. Creates the
 * agents destination directory if needed.
 */
export const copyBriefContent = (options: CopyBriefContentOptions): void => {
  const { briefCommandsDir, briefWorkflowsDir, briefAgentsDir, fs } = options;
  const { commandsDest, workflowsDest, agentsDest } = options;

  rejectSymlink(commandsDest);
  rejectSymlink(workflowsDest);
  rejectSymlink(agentsDest);
  fs.mkdir(agentsDest);

  BRIEF_COMMANDS.forEach((file) => {
    copyChecked(join(briefCommandsDir, file), join(commandsDest, file), fs);
  });
  BRIEF_WORKFLOWS.forEach((file) => {
    copyChecked(join(briefWorkflowsDir, file), join(workflowsDest, file), fs);
  });
  copyChecked(
    join(briefAgentsDir, BRIEF_AGENT),
    join(agentsDest, BRIEF_AGENT),
    fs,
  );
};

/**
 * Remove brief files from a prior installation.
 *
 * Called when the strategist role is disabled to prevent orphaned files.
 * Best-effort — silently ignores missing files.
 */
export const cleanBriefContent = (options: CleanBriefContentOptions): void => {
  const { commandsDest, workflowsDest, agentsDest, fs } = options;

  rejectSymlink(commandsDest);
  rejectSymlink(workflowsDest);
  rejectSymlink(agentsDest);

  BRIEF_COMMANDS.forEach((file) => {
    unlinkSafe(join(commandsDest, file), fs);
  });
  BRIEF_WORKFLOWS.forEach((file) => {
    unlinkSafe(join(workflowsDest, file), fs);
  });
  unlinkSafe(join(agentsDest, BRIEF_AGENT), fs);
};

type BriefSources = {
  readonly briefCommandsDir?: string;
  readonly briefWorkflowsDir?: string;
  readonly briefAgentsDir?: string;
};

type BriefDests = {
  readonly commandsDest: string;
  readonly workflowsDest: string;
  readonly agentsDest: string;
};

type HandleBriefContentOptions = {
  readonly sources: BriefSources;
  readonly dests: BriefDests;
  readonly enabledRoles: ReadonlySet<string> | null;
  readonly fs: BriefCopyFs & BriefCleanFs;
};

/**
 * Install or clean brief content based on available sources and role state.
 *
 * No-op when brief source dirs are absent (direct terminal usage).
 * When present: copies files if strategist is enabled, cleans orphans if disabled.
 */
export const handleBriefContent = (
  options: HandleBriefContentOptions,
): void => {
  const { sources, dests, enabledRoles, fs } = options;
  const { briefCommandsDir, briefWorkflowsDir, briefAgentsDir } = sources;

  if (!briefCommandsDir || !briefWorkflowsDir || !briefAgentsDir) return;

  const enabled = enabledRoles === null || enabledRoles.has('strategist');

  if (enabled) {
    copyBriefContent({
      briefCommandsDir,
      briefWorkflowsDir,
      briefAgentsDir,
      ...dests,
      fs,
    });
  } else {
    cleanBriefContent({ ...dests, fs });
  }
};
