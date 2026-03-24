/**
 * Installer orchestrator — decomposed pipeline for `npx chief-clancy`.
 *
 * Coordinates all installer modules (file-ops, manifest, role-filter,
 * hook-installer, prompts, ui) into a single installation flow.
 * Pure helpers are exported for testing; pipeline steps are boundary functions.
 */
import type { EnvFileSystem } from '@chief-clancy/core';

import { dirname, join } from 'node:path';

import { inlineWorkflows } from '~/installer/file-ops/file-ops.js';
import { installHooks } from '~/installer/hook-installer/hook-installer.js';
import {
  backupModifiedFiles,
  buildManifest,
  detectModifiedFiles,
} from '~/installer/manifest/manifest.js';
import { copyRoleFiles } from '~/installer/role-filter/role-filter.js';
import { printSuccess } from '~/installer/ui/ui.js';
import { blue, dim, green } from '~/shared/ansi/index.js';

import { loadClancyEnv } from '@chief-clancy/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The install target — global (`~/.claude`) or local (`./.claude`). */
export type InstallMode = 'global' | 'local';

/** Source directories within the npm package. */
type InstallSources = {
  readonly rolesDir: string;
  readonly hooksDir: string;
  readonly bundleDir: string;
  readonly agentsDir: string;
};

/** All resolved destination paths for an installation. */
export type InstallPaths = {
  readonly commandsDest: string;
  readonly workflowsDest: string;
  readonly claudeConfigDir: string;
  readonly manifestPath: string;
  readonly workflowsManifestPath: string;
  readonly patchesDir: string;
  readonly clancyProjectDir: string;
};

/**
 * File system operations the orchestrator performs directly.
 *
 * `mkdir` must be idempotent (recursive, ignoring EEXIST) — the pipeline
 * calls it unconditionally on paths that may already exist during updates.
 */
type InstallerFs = {
  readonly exists: (path: string) => boolean;
  readonly readFile: (path: string) => string;
  readonly writeFile: (path: string, content: string) => void;
  /** Create a directory recursively (must not throw on existing dirs). */
  readonly mkdir: (path: string) => void;
  readonly copyFile: (src: string, dest: string) => void;
};

/**
 * Prompt API used by the orchestrator.
 *
 * Only `ask` is called by {@link runInstall}. The caller owns the prompt
 * lifecycle — create before calling `runInstall`, close after it returns.
 */
type InstallerPrompts = {
  readonly ask: (label: string) => Promise<string>;
};

/** Options for {@link runInstall}. */
export type RunInstallOptions = {
  readonly mode: InstallMode;
  readonly paths: InstallPaths;
  readonly sources: InstallSources;
  readonly version: string;
  readonly nonInteractive: boolean;
  readonly prompts: InstallerPrompts;
  readonly fs: InstallerFs;
  readonly cwd: string;
  readonly now?: () => string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Bundled runtime scripts that are copied to `.clancy/` in the project. */
const BUNDLE_SCRIPTS = ['clancy-once.js', 'clancy-afk.js'] as const;

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Parse `--global` / `--local` from CLI arguments.
 *
 * When present the installer runs non-interactively — no prompts are shown.
 * Used by the `/clancy:update` workflow for unattended updates.
 *
 * @param args - CLI arguments (typically `process.argv.slice(2)`).
 * @returns The install mode, or `null` if no flag was provided.
 */
export function parseInstallFlag(args: readonly string[]): InstallMode | null {
  if (args.includes('--global')) return 'global';
  if (args.includes('--local')) return 'local';

  return null;
}

/**
 * Compute all destination paths for an installation.
 *
 * Global installs target `~/.claude`; local installs target `<cwd>/.claude`.
 * The `.clancy/` project directory always resolves to `cwd` regardless of
 * mode — runtime scripts run relative to the project root.
 *
 * @param mode - Global or local install target.
 * @param homeDir - The user's home directory.
 * @param cwd - The current working directory.
 * @returns All resolved destination paths.
 */
export function resolveInstallPaths(
  mode: InstallMode,
  homeDir: string,
  cwd: string,
): InstallPaths {
  const baseDir =
    mode === 'global' ? join(homeDir, '.claude') : join(cwd, '.claude');

  return {
    commandsDest: join(baseDir, 'commands', 'clancy'),
    workflowsDest: join(baseDir, 'clancy', 'workflows'),
    claudeConfigDir: baseDir,
    manifestPath: join(baseDir, 'clancy', 'manifest.json'),
    workflowsManifestPath: join(baseDir, 'clancy', 'workflows-manifest.json'),
    patchesDir: join(baseDir, 'clancy', 'local-patches'),
    clancyProjectDir: join(cwd, '.clancy'),
  };
}

/**
 * Parse enabled optional roles from the project's `.clancy/.env` file.
 *
 * Returns `null` when no `.clancy/.env` exists (first install — install all
 * roles as a safe default). Returns an empty set when the file exists but
 * `CLANCY_ROLES` is unset or empty, so optional roles are truly opt-in.
 *
 * @param projectRoot - The project root containing `.clancy/`.
 * @param fs - File system operations (injected for testability).
 * @returns A set of enabled role names, or `null` for first install.
 */
export function parseEnabledRoles(
  projectRoot: string,
  fs: EnvFileSystem,
): ReadonlySet<string> | null {
  const env = loadClancyEnv(projectRoot, fs);
  if (!env) return null;

  const roles = env.CLANCY_ROLES;
  if (!roles) return new Set<string>();

  return new Set(
    roles
      .split(',')
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Throw if a required path does not exist. */
function requirePath(
  label: string,
  path: string,
  exists: (p: string) => boolean,
): void {
  if (!exists(path)) {
    throw new Error(`${label} not found: ${path}`);
  }
}

/**
 * Validate that all required source directories and files exist.
 *
 * Guards against a corrupted npm package. Throws on the first missing path.
 * `agentsDir` is intentionally not validated — the verification gate prompt
 * is read best-effort in {@link registerHooks} and skipped if missing.
 *
 * @param sources - The source directories to check.
 * @param exists - File existence check (injected for testability).
 */
export function validateSources(
  sources: InstallSources,
  exists: (path: string) => boolean,
): void {
  requirePath('Roles source', sources.rolesDir, exists);
  requirePath('Hooks source', sources.hooksDir, exists);
  requirePath('Runtime bundles source', sources.bundleDir, exists);

  BUNDLE_SCRIPTS.forEach((script) => {
    requirePath(
      `Bundled script ${script}`,
      join(sources.bundleDir, script),
      exists,
    );
  });
}

// ---------------------------------------------------------------------------
// Pipeline steps
// ---------------------------------------------------------------------------

/** Print a list of modified files the user should know about. */
function printModifiedFiles(
  modified: readonly { readonly rel: string }[],
): void {
  console.log(blue('  Modified files detected:'));
  modified.forEach(({ rel }) => console.log(`    ${dim('•')} ${rel}`));
  console.log('');
  console.log(dim('  These will be backed up before overwriting.'));
  console.log('');
}

/** Back up modified files and log the result. */
function backupAndReport(
  modified: readonly { readonly rel: string; readonly absPath: string }[],
  patchesDir: string,
): void {
  const backedUp = backupModifiedFiles(modified, patchesDir);
  const message = backedUp
    ? green(`\n  ✓ ${modified.length} modified file(s) backed up`)
    : dim('\n  No files needed backup (removed before copy).');

  console.log(message);
}

/** Confirm overwrite — auto-accepts in non-interactive mode. */
async function confirmOverwrite(
  nonInteractive: boolean,
  prompts: InstallerPrompts,
): Promise<boolean> {
  if (nonInteractive) {
    console.log(dim('  Auto-overwriting (non-interactive mode).'));
    return true;
  }

  const answer = await prompts.ask(
    blue(`  Overwrite existing installation? [y/N] `),
  );

  return answer.trim().toLowerCase().startsWith('y');
}

/** Detect modified files, prompt for overwrite, and back up if needed. */
async function handleExistingInstall(options: {
  readonly paths: InstallPaths;
  readonly nonInteractive: boolean;
  readonly prompts: InstallerPrompts;
  readonly exists: (path: string) => boolean;
}): Promise<boolean> {
  const { paths, nonInteractive, prompts, exists } = options;
  const hasExisting = exists(paths.commandsDest) || exists(paths.workflowsDest);

  if (!hasExisting) return true;

  const cmdModified = detectModifiedFiles(
    paths.commandsDest,
    paths.manifestPath,
  );
  const wfModified = detectModifiedFiles(
    paths.workflowsDest,
    paths.workflowsManifestPath,
  );
  const allModified = [...cmdModified, ...wfModified];

  if (allModified.length > 0) printModifiedFiles(allModified);

  const confirmed = await confirmOverwrite(nonInteractive, prompts);
  if (!confirmed) return false;

  if (allModified.length > 0) backupAndReport(allModified, paths.patchesDir);

  return true;
}

/** Copy role files, inline workflows, and write manifests. */
function installContent(options: {
  readonly mode: InstallMode;
  readonly paths: InstallPaths;
  readonly sources: InstallSources;
  readonly version: string;
  readonly enabledRoles: ReadonlySet<string> | null;
  readonly fs: InstallerFs;
}): void {
  const { mode, paths, sources, version, enabledRoles, fs } = options;

  copyRoleFiles({
    rolesDir: sources.rolesDir,
    subdir: 'commands',
    dest: paths.commandsDest,
    enabledRoles,
  });
  copyRoleFiles({
    rolesDir: sources.rolesDir,
    subdir: 'workflows',
    dest: paths.workflowsDest,
    enabledRoles,
  });

  if (mode === 'global') {
    inlineWorkflows(paths.commandsDest, paths.workflowsDest);
  }

  fs.writeFile(join(paths.commandsDest, 'VERSION'), version);

  fs.mkdir(dirname(paths.manifestPath));
  const cmdManifest = JSON.stringify(
    buildManifest(paths.commandsDest),
    null,
    2,
  );
  const wfManifest = JSON.stringify(
    buildManifest(paths.workflowsDest),
    null,
    2,
  );
  fs.writeFile(paths.manifestPath, cmdManifest);
  fs.writeFile(paths.workflowsManifestPath, wfManifest);
}

/** Copy runtime bundles and write project-level metadata. */
function setupProjectRuntime(options: {
  readonly paths: InstallPaths;
  readonly sources: InstallSources;
  readonly version: string;
  readonly fs: InstallerFs;
  readonly now: () => string;
}): void {
  const { paths, sources, version, fs } = options;

  fs.mkdir(paths.clancyProjectDir);

  BUNDLE_SCRIPTS.forEach((script) => {
    fs.copyFile(
      join(sources.bundleDir, script),
      join(paths.clancyProjectDir, script),
    );
  });

  fs.writeFile(
    join(paths.clancyProjectDir, 'package.json'),
    JSON.stringify({ type: 'module' }, null, 2) + '\n',
  );

  const versionMeta = { version, installedAt: options.now() };
  fs.writeFile(
    join(paths.clancyProjectDir, 'version.json'),
    JSON.stringify(versionMeta, null, 2) + '\n',
  );
}

/** Register Clancy hooks in Claude's settings.json. */
function registerHooks(options: {
  readonly paths: InstallPaths;
  readonly sources: InstallSources;
  readonly fs: InstallerFs;
}): void {
  const { paths, sources, fs } = options;
  const gatePromptPath = join(sources.agentsDir, 'verification-gate.md');
  const verificationGatePrompt = fs.exists(gatePromptPath)
    ? fs.readFile(gatePromptPath)
    : undefined;

  const success = installHooks({
    claudeConfigDir: paths.claudeConfigDir,
    hooksSourceDir: sources.hooksDir,
    verificationGatePrompt,
  });

  if (!success) {
    console.log(
      dim('  Warning: hooks could not be installed. Configure manually.'),
    );
  }
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

/**
 * Run the full installation pipeline.
 *
 * Validates sources, handles existing installations (detect modified, prompt,
 * backup), copies role files, writes metadata, sets up the project runtime
 * directory, and registers hooks. Returns normally on success or user abort.
 *
 * @param options - All dependencies and configuration for the install.
 */
export async function runInstall(options: RunInstallOptions): Promise<void> {
  const { mode, paths, sources, version, nonInteractive, prompts, fs, cwd } =
    options;
  const now = options.now ?? (() => new Date().toISOString());

  validateSources(sources, fs.exists);

  console.log('');
  console.log(dim(`  Installing to: ${paths.commandsDest}`));

  const shouldContinue = await handleExistingInstall({
    paths,
    nonInteractive,
    prompts,
    exists: fs.exists,
  });

  if (!shouldContinue) {
    console.log('\n  Aborted. No files changed.');
    return;
  }

  const enabledRoles =
    mode === 'global'
      ? null
      : parseEnabledRoles(cwd, {
          exists: fs.exists,
          readFile: fs.readFile,
        });

  installContent({ mode, paths, sources, version, enabledRoles, fs });
  setupProjectRuntime({ paths, sources, version, fs, now });
  registerHooks({ paths, sources, fs });

  printSuccess(enabledRoles);
}
