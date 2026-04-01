/**
 * Brief installer — self-contained module for `npx @chief-clancy/brief`.
 *
 * Copies the brief slash command, workflow, and devil's advocate agent
 * prompt to the Claude Code commands directory. No hooks, bundles,
 * manifests, role filtering, or board configuration.
 */
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The install target — global (`~/.claude`) or local (`./.claude`). */
export type BriefInstallMode = 'global' | 'local';

/** All resolved destination paths for a brief installation. */
export type BriefInstallPaths = {
  readonly commandsDest: string;
  readonly workflowsDest: string;
  readonly agentsDest: string;
};

/** Source directories within the npm package. */
type BriefInstallSources = {
  readonly commandsDir: string;
  readonly workflowsDir: string;
  readonly agentsDir: string;
};

/**
 * File system operations the installer performs.
 *
 * `mkdir` must be idempotent (recursive, ignoring EEXIST).
 */
type BriefInstallerFs = {
  readonly exists: (path: string) => boolean;
  readonly readFile: (path: string) => string;
  readonly writeFile: (path: string, content: string) => void;
  readonly mkdir: (path: string) => void;
  readonly copyFile: (src: string, dest: string) => void;
  /** Must return `false` (not throw) when the path does not exist. */
  readonly isSymlink: (path: string) => boolean;
};

/** Options for {@link runBriefInstall}. */
export type RunBriefInstallOptions = {
  readonly mode: BriefInstallMode;
  readonly paths: BriefInstallPaths;
  readonly sources: BriefInstallSources;
  readonly version: string;
  readonly fs: BriefInstallerFs;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Command files shipped with the brief package. */
const COMMAND_FILES = ['brief.md'] as const;

/** Workflow files shipped with the brief package. */
const WORKFLOW_FILES = ['brief.md'] as const;

/** Agent files shipped with the brief package. */
const AGENT_FILES = ['devils-advocate.md'] as const;

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
export const parseBriefInstallFlag = (
  args: readonly string[],
): BriefInstallMode | null => {
  if (args.includes('--global')) return 'global';
  if (args.includes('--local')) return 'local';

  return null;
};

/**
 * Compute all destination paths for a brief installation.
 *
 * @param mode - Global or local install target.
 * @param homeDir - The user's home directory.
 * @param cwd - The current working directory.
 * @returns All resolved destination paths.
 */
export const resolveBriefInstallPaths = (
  mode: BriefInstallMode,
  homeDir: string,
  cwd: string,
): BriefInstallPaths => {
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
  readonly fs: BriefInstallerFs;
};

/** Copy a list of files from src dir to dest dir with symlink protection. */
const copyFiles = (options: CopyFilesOptions): void => {
  const { files, srcDir, destDir, fs } = options;
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
  fs: BriefInstallerFs,
): void => {
  COMMAND_FILES.forEach((file) => {
    const cmdPath = join(commandsDest, file);
    const content = fs.readFile(cmdPath);
    const resolved = content.replace(
      WORKFLOW_REF,
      (match, fileName: string) => {
        const wfPath = join(workflowsDest, fileName);

        return fs.exists(wfPath) ? fs.readFile(wfPath) : match;
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
 * Run the brief installation pipeline.
 *
 * Copies command, workflow, and agent files to the target directory.
 * For global mode, inlines workflow content into the command file.
 * Writes a VERSION.brief marker with the package version.
 *
 * @param options - All dependencies and configuration.
 */
export const runBriefInstall = (options: RunBriefInstallOptions): void => {
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

  if (mode === 'global') {
    inlineWorkflow(paths.commandsDest, paths.workflowsDest, fs);
  }

  const versionPath = join(paths.commandsDest, 'VERSION.brief');
  rejectSymlink(versionPath, fs.isSymlink);
  fs.writeFile(versionPath, version);
};
