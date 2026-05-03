/**
 * Plan installer — self-contained module for `npx @chief-clancy/plan`.
 *
 * Copies the plan slash command and workflow to the Claude Code commands
 * directory. No hooks, bundles, manifests, role filtering, or board
 * configuration.
 */
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The install target — global (`~/.claude`) or local (`./.claude`). */
type PlanInstallMode = 'global' | 'local';

/** All resolved destination paths for a plan installation. */
type PlanInstallPaths = {
  readonly commandsDest: string;
  readonly workflowsDest: string;
  readonly agentsDest: string;
};

/** Source directories within the npm package. */
type PlanInstallSources = {
  readonly commandsDir: string;
  readonly workflowsDir: string;
  readonly agentsDir: string;
  readonly scanAgentsDir: string;
  readonly scanCommandsDir: string;
  readonly scanWorkflowsDir: string;
};

/**
 * File system operations the installer performs.
 *
 * `mkdir` must be idempotent (recursive, ignoring EEXIST).
 */
type PlanInstallerFs = {
  readonly exists: (path: string) => boolean;
  readonly readFile: (path: string) => string;
  readonly writeFile: (path: string, content: string) => void;
  readonly mkdir: (path: string) => void;
  readonly copyFile: (src: string, dest: string) => void;
  /** Must return `false` (not throw) when the path does not exist. */
  readonly isSymlink: (path: string) => boolean;
};

/** Options for {@link runPlanInstall}. */
export type RunPlanInstallOptions = {
  readonly mode: PlanInstallMode;
  readonly paths: PlanInstallPaths;
  readonly sources: PlanInstallSources;
  readonly version: string;
  readonly fs: PlanInstallerFs;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Command files shipped with the plan package. */
const COMMAND_FILES = [
  'approve-plan.md',
  'board-setup.md',
  'plan.md',
  'uninstall-plan.md',
  'update-plan.md',
] as const;

/** Workflow files shipped with the plan package. */
const WORKFLOW_FILES = [
  'approve-plan.md',
  'board-setup.md',
  'plan.md',
  'uninstall-plan.md',
  'update-plan.md',
] as const;

/** Agent files shipped with the plan package. */
const AGENT_FILES = ['devils-advocate.md'] as const;

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

/** Matches `@.claude/clancy/workflows/<filename>.md` on its own line. */
const WORKFLOW_REF = /^@\.claude\/clancy\/workflows\/([^/\\]+\.md)\r?$/gm;

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Parse `--global` / `--local` from CLI arguments.
 *
 * @param args - CLI arguments (typically `process.argv.slice(2)`).
 * @returns The install mode, or `null` if no flag was provided.
 */
export const parsePlanInstallFlag = (
  args: readonly string[],
): PlanInstallMode | null => {
  if (args.includes('--global')) return 'global';
  if (args.includes('--local')) return 'local';

  return null;
};

/**
 * Compute all destination paths for a plan installation.
 *
 * @param mode - Global or local install target.
 * @param homeDir - The user's home directory.
 * @param cwd - The current working directory.
 * @returns All resolved destination paths.
 */
export const resolvePlanInstallPaths = (
  mode: PlanInstallMode,
  homeDir: string,
  cwd: string,
): PlanInstallPaths => {
  const baseDir =
    mode === 'global' ? join(homeDir, '.claude') : join(cwd, '.claude');

  return {
    commandsDest: join(baseDir, 'commands', 'clancy'),
    workflowsDest: join(baseDir, 'clancy', 'workflows'),
    agentsDest: join(baseDir, 'clancy', 'agents'),
  };
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Throw if the given path is a symlink (ENOENT is swallowed). */
const rejectSymlink = (
  path: string,
  isSymlink: (p: string) => boolean,
): void => {
  if (isSymlink(path)) {
    throw new Error(`Symlink rejected: ${path}`);
  }
};

type CopyFilesOptions = {
  readonly files: readonly string[];
  readonly srcDir: string;
  readonly destDir: string;
  readonly fs: PlanInstallerFs;
};

/** Copy a list of files from src dir to dest dir with symlink protection. */
const copyFiles = (options: CopyFilesOptions): void => {
  const { files, srcDir, destDir, fs } = options;
  rejectSymlink(destDir, fs.isSymlink);
  fs.mkdir(destDir);

  files.forEach((file) => {
    const src = join(srcDir, file);
    const dest = join(destDir, file);

    if (!fs.exists(src)) {
      throw new Error(`Source file not found: ${src}`);
    }

    rejectSymlink(dest, fs.isSymlink);
    fs.copyFile(src, dest);
  });
};

/**
 * Inline workflow content into command files (global mode only).
 *
 * Replaces `@.claude/clancy/workflows/<name>.md` references with the
 * actual workflow content so global installs work without project-relative
 * @-file resolution.
 */
const inlineWorkflow = (
  commandsDest: string,
  workflowsDest: string,
  fs: PlanInstallerFs,
): void => {
  [...COMMAND_FILES, ...SCAN_COMMAND_FILES].forEach((file) => {
    const cmdPath = join(commandsDest, file);
    const content = fs.readFile(cmdPath);
    const resolved = content.replace(
      WORKFLOW_REF,
      (match, fileName: string) => {
        const wfPath = join(workflowsDest, fileName);
        rejectSymlink(wfPath, fs.isSymlink);
        if (!fs.exists(wfPath)) return match;

        return fs.readFile(wfPath);
      },
    );

    if (resolved !== content) {
      rejectSymlink(cmdPath, fs.isSymlink);
      fs.writeFile(cmdPath, resolved);
    }
  });
};

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

/**
 * Run the plan installation pipeline.
 *
 * Copies command and workflow files to the target directory.
 * For global mode, inlines workflow content into the command file.
 * Writes a VERSION.plan marker with the package version.
 *
 * @param options - All dependencies and configuration.
 */
export const runPlanInstall = (options: RunPlanInstallOptions): void => {
  const { mode, paths, sources, version, fs } = options;

  copyFiles({
    files: COMMAND_FILES,
    srcDir: sources.commandsDir,
    destDir: paths.commandsDest,
    fs,
  });
  copyFiles({
    files: WORKFLOW_FILES,
    srcDir: sources.workflowsDir,
    destDir: paths.workflowsDest,
    fs,
  });
  copyFiles({
    files: AGENT_FILES,
    srcDir: sources.agentsDir,
    destDir: paths.agentsDest,
    fs,
  });
  copyFiles({
    files: SCAN_AGENT_FILES,
    srcDir: sources.scanAgentsDir,
    destDir: paths.agentsDest,
    fs,
  });
  copyFiles({
    files: SCAN_COMMAND_FILES,
    srcDir: sources.scanCommandsDir,
    destDir: paths.commandsDest,
    fs,
  });
  copyFiles({
    files: SCAN_WORKFLOW_FILES,
    srcDir: sources.scanWorkflowsDir,
    destDir: paths.workflowsDest,
    fs,
  });

  if (mode === 'global') {
    inlineWorkflow(paths.commandsDest, paths.workflowsDest, fs);
  }

  const versionPath = join(paths.commandsDest, 'VERSION.plan');
  rejectSymlink(versionPath, fs.isSymlink);
  fs.writeFile(versionPath, version);
};
