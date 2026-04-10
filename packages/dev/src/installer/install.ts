/**
 * Dev installer — self-contained module for `npx @chief-clancy/dev`.
 *
 * Copies dev and autopilot bundles to the user's `.clancy/` directory,
 * scaffolds the directory structure, and writes a VERSION.dev marker.
 */
import type { DevInstallState } from './preflight.js';

import { join } from 'node:path';

import { detectDevInstallState } from './preflight.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The install target — global (`~/.claude`) or local (`./.claude`). */
type DevInstallMode = 'global' | 'local';

/** All resolved destination paths for a dev installation. */
export type DevInstallPaths = {
  readonly commandsDest: string;
  readonly workflowsDest: string;
  /** Always `<cwd>/.clancy` — runtime bundles live at project root. */
  readonly clancyProjectDir: string;
};

/**
 * File system operations the installer performs.
 *
 * `mkdir` must be idempotent (recursive, ignoring EEXIST).
 */
type DevInstallerFs = {
  readonly exists: (path: string) => boolean;
  readonly readFile: (path: string) => string;
  readonly writeFile: (path: string, content: string) => void;
  readonly mkdir: (path: string) => void;
  readonly copyFile: (src: string, dest: string) => void;
  /** Must return `false` (not throw) when the path does not exist. */
  readonly isSymlink: (path: string) => boolean;
};

/** Source directories within the npm package. */
type DevInstallSources = {
  readonly commandsDir: string;
  readonly workflowsDir: string;
  readonly bundlesDir: string;
};

/** Options for {@link runDevInstall}. */
export type RunDevInstallOptions = {
  readonly mode: DevInstallMode;
  readonly cwd: string;
  readonly paths: DevInstallPaths;
  readonly sources: DevInstallSources;
  readonly version: string;
  readonly fs: DevInstallerFs;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Command files shipped with the dev package. */
const COMMAND_FILES = ['dev.md'] as const;

/** Workflow files shipped with the dev package. */
const WORKFLOW_FILES = ['dev.md'] as const;

/** Bundle files copied into `.clancy/`. */
const BUNDLE_FILES = ['clancy-dev.js', 'clancy-dev-autopilot.js'] as const;

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
export const parseDevInstallFlag = (
  args: readonly string[],
): DevInstallMode | null => {
  if (args.includes('--global')) return 'global';
  if (args.includes('--local')) return 'local';

  return null;
};

/**
 * Compute all destination paths for a dev installation.
 *
 * @param mode - Global or local install target.
 * @param homeDir - The user's home directory.
 * @param cwd - The current working directory.
 * @returns All resolved destination paths.
 */
export const resolveDevInstallPaths = (
  mode: DevInstallMode,
  homeDir: string,
  cwd: string,
): DevInstallPaths => {
  const baseDir =
    mode === 'global' ? join(homeDir, '.claude') : join(cwd, '.claude');

  return {
    commandsDest: join(baseDir, 'commands', 'clancy'),
    workflowsDest: join(baseDir, 'clancy', 'workflows'),
    clancyProjectDir: join(cwd, '.clancy'),
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
  readonly fs: DevInstallerFs;
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
  fs: DevInstallerFs,
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
 * Run the dev installation pipeline.
 *
 * Copies bundle files to the bundles destination, creates hook
 * directories, writes a VERSION.dev marker, and returns the
 * detected installation state.
 *
 * @param options - All dependencies and configuration.
 * @returns The detected installation state after install completes.
 */
export const runDevInstall = (
  options: RunDevInstallOptions,
): DevInstallState => {
  const { mode, cwd, paths, sources, version, fs } = options;

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
    files: BUNDLE_FILES,
    srcDir: sources.bundlesDir,
    destDir: paths.clancyProjectDir,
    fs,
  });
  if (mode === 'global') {
    inlineWorkflow(paths.commandsDest, paths.workflowsDest, fs);
  }

  // ESM package.json — required for `node .clancy/clancy-dev.js` to work.
  // Idempotent: same content as terminal's setupProjectRuntime writes.
  const pkgJsonPath = join(paths.clancyProjectDir, 'package.json');
  rejectSymlink(pkgJsonPath, fs.isSymlink);
  fs.writeFile(pkgJsonPath, '{"type":"module"}\n');

  const versionPath = join(paths.clancyProjectDir, 'VERSION.dev');
  rejectSymlink(versionPath, fs.isSymlink);
  fs.writeFile(versionPath, version);

  return detectDevInstallState(cwd, fs);
};
