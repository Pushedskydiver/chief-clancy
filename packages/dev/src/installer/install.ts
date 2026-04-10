/**
 * Dev installer — self-contained module for `npx @chief-clancy/dev`.
 *
 * Scaffolds the directory structure and writes a VERSION.dev marker.
 * No bundles or commands are copied yet — file lists are populated as
 * the dev package gains entrypoints (PR 7+).
 */
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The install target — global (`~/.claude`) or local (`./.claude`). */
type DevInstallMode = 'global' | 'local';

/** All resolved destination paths for a dev installation. */
export type DevInstallPaths = {
  readonly bundlesDest: string;
  readonly hooksDest: string;
};

/**
 * File system operations the installer performs.
 *
 * `mkdir` must be idempotent (recursive, ignoring EEXIST).
 */
type DevInstallerFs = {
  readonly exists: (path: string) => boolean;
  readonly writeFile: (path: string, content: string) => void;
  readonly mkdir: (path: string) => void;
  readonly copyFile: (src: string, dest: string) => void;
  /** Must return `false` (not throw) when the path does not exist. */
  readonly isSymlink: (path: string) => boolean;
};

/** Source directories within the npm package. */
type DevInstallSources = {
  readonly bundlesDir: string;
  readonly hooksDir: string;
};

/** Options for {@link runDevInstall}. */
export type RunDevInstallOptions = {
  readonly paths: DevInstallPaths;
  readonly sources: DevInstallSources;
  readonly version: string;
  readonly fs: DevInstallerFs;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Bundle files copied into `.clancy/bundles/`.
 * Empty until PR 7 adds the esbuild config and entrypoints.
 */
const BUNDLE_FILES: readonly string[] = [];

/** Hook files copied into `.clancy/hooks/`. */
const HOOK_FILES: readonly string[] = [];

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
    bundlesDest: join(baseDir, 'clancy', 'bundles'),
    hooksDest: join(baseDir, 'clancy', 'hooks'),
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

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

/**
 * Run the dev installation pipeline.
 *
 * Creates destination directories and writes a VERSION.dev marker.
 * Bundle and hook file lists are currently empty — they'll be populated
 * as the dev package gains entrypoints and hooks.
 *
 * @param options - All dependencies and configuration.
 */
export const runDevInstall = (options: RunDevInstallOptions): void => {
  const { paths, sources, version, fs } = options;

  copyFiles({
    files: BUNDLE_FILES,
    srcDir: sources.bundlesDir,
    destDir: paths.bundlesDest,
    fs,
  });
  copyFiles({
    files: HOOK_FILES,
    srcDir: sources.hooksDir,
    destDir: paths.hooksDest,
    fs,
  });

  const versionPath = join(paths.bundlesDest, 'VERSION.dev');
  rejectSymlink(versionPath, fs.isSymlink);
  fs.writeFile(versionPath, version);
};
