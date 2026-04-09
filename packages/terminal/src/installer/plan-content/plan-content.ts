/**
 * Plan content installer — copies plan command and workflow files from
 * the @chief-clancy/plan package into the install destination.
 *
 * Separate from the role-filter system because plan is a standalone
 * package, not a terminal role directory.
 */
import { join } from 'node:path';

import { hasErrorCode } from '~/t/installer/shared/fs-errors/index.js';
import { rejectSymlink } from '~/t/installer/shared/fs-guards/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** File system operations for plan content copying. */
type PlanCopyFs = {
  readonly copyFile: (src: string, dest: string) => void;
};

type CopyPlanContentOptions = {
  readonly planCommandsDir: string;
  readonly planWorkflowsDir: string;
  readonly commandsDest: string;
  readonly workflowsDest: string;
  readonly fs: PlanCopyFs;
};

type PlanCleanFs = {
  readonly unlink: (path: string) => void;
};

type CleanPlanContentOptions = {
  readonly commandsDest: string;
  readonly workflowsDest: string;
  readonly fs: PlanCleanFs;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Plan command files terminal copies from the @chief-clancy/plan package.
 *
 * Kept separate from PLAN_WORKFLOW_FILES (rather than a single shared list) so
 * future asymmetry — e.g. a command-only helper or an agent file — does not
 * force a refactor. Mirrors brief-content.ts's separate-constant convention.
 */
const PLAN_COMMAND_FILES = [
  'approve-plan.md',
  'implement-from.md',
  'plan.md',
] as const;

/** Plan workflow files terminal copies from the @chief-clancy/plan package. */
const PLAN_WORKFLOW_FILES = [
  'approve-plan.md',
  'implement-from.md',
  'plan.md',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Copy a single file with symlink protection. */
const copyChecked = (src: string, dest: string, fs: PlanCopyFs): void => {
  rejectSymlink(dest);
  fs.copyFile(src, dest);
};

/** Remove a file, ignoring ENOENT. Rethrows other errors. */
const unlinkSafe = (path: string, fs: PlanCleanFs): void => {
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
 * Copy plan command and workflow files to the install destination.
 *
 * No agents directory needed — plan has no agent files.
 */
export const copyPlanContent = (options: CopyPlanContentOptions): void => {
  const { planCommandsDir, planWorkflowsDir, fs } = options;
  const { commandsDest, workflowsDest } = options;

  rejectSymlink(commandsDest);
  rejectSymlink(workflowsDest);

  PLAN_COMMAND_FILES.forEach((file) => {
    copyChecked(join(planCommandsDir, file), join(commandsDest, file), fs);
  });
  PLAN_WORKFLOW_FILES.forEach((file) => {
    copyChecked(join(planWorkflowsDir, file), join(workflowsDest, file), fs);
  });
};

/**
 * Remove plan files from a prior installation.
 *
 * Called when the planner role is disabled to prevent orphaned files.
 * Best-effort — silently ignores missing files.
 */
export const cleanPlanContent = (options: CleanPlanContentOptions): void => {
  const { commandsDest, workflowsDest, fs } = options;

  rejectSymlink(commandsDest);
  rejectSymlink(workflowsDest);

  PLAN_COMMAND_FILES.forEach((file) => {
    unlinkSafe(join(commandsDest, file), fs);
  });
  PLAN_WORKFLOW_FILES.forEach((file) => {
    unlinkSafe(join(workflowsDest, file), fs);
  });
};

type PlanSources = {
  readonly planCommandsDir?: string;
  readonly planWorkflowsDir?: string;
};

type PlanDests = {
  readonly commandsDest: string;
  readonly workflowsDest: string;
};

type HandlePlanContentOptions = {
  readonly sources: PlanSources;
  readonly dests: PlanDests;
  readonly enabledRoles: ReadonlySet<string> | null;
  readonly fs: PlanCopyFs & PlanCleanFs;
};

/**
 * Install or clean plan content based on available sources and role state.
 *
 * No-op when plan source dirs are absent (direct terminal usage).
 * When present: copies files if planner is enabled, cleans orphans if disabled.
 */
export const handlePlanContent = (options: HandlePlanContentOptions): void => {
  const { sources, dests, enabledRoles, fs } = options;
  const { planCommandsDir, planWorkflowsDir } = sources;

  if (!planCommandsDir || !planWorkflowsDir) return;

  const enabled = enabledRoles === null || enabledRoles.has('planner');

  if (enabled) {
    copyPlanContent({
      planCommandsDir,
      planWorkflowsDir,
      ...dests,
      fs,
    });
  } else {
    cleanPlanContent({ ...dests, fs });
  }
};
