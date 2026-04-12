#!/usr/bin/env node

/**
 * Dev installer — CLI entry point for `npx @chief-clancy/dev`.
 *
 * Scaffolds the `.clancy/` directory structure for the autonomous
 * execution surface. No dependencies on @chief-clancy/core or
 * @chief-clancy/terminal.
 */
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// ANSI helpers (inlined — no external dependencies)
// ---------------------------------------------------------------------------

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const blue = (s) => `\x1b[1;34m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

// ---------------------------------------------------------------------------
// Resolve package metadata
// ---------------------------------------------------------------------------

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const devRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const scanRoot = join(
  dirname(require.resolve('@chief-clancy/scan/package.json')),
);

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const homeDir = process.env.HOME ?? process.env.USERPROFILE;

if (!homeDir) {
  console.error(red('  Error: Could not determine home directory.'));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CLI flag parsing
// ---------------------------------------------------------------------------

/** @param {readonly string[]} args */
function parseFlag(args) {
  if (args.includes('--global')) return 'global';
  if (args.includes('--local')) return 'local';
  return null;
}

const flag = parseFlag(process.argv.slice(2));

// ---------------------------------------------------------------------------
// Prompt helpers
// ---------------------------------------------------------------------------

const rl = createInterface({ input: process.stdin, output: process.stdout });

/** @param {string} label */
const ask = (label) => new Promise((resolve) => rl.question(label, resolve));

// ---------------------------------------------------------------------------
// File lists (keep in sync with install.ts)
// ---------------------------------------------------------------------------

const COMMAND_FILES = [
  'board-setup.md',
  'dev.md',
  'dev-loop.md',
  'uninstall-dev.md',
];
const WORKFLOW_FILES = [
  'board-setup.md',
  'dev.md',
  'dev-loop.md',
  'uninstall-dev.md',
];
const BUNDLE_FILES = ['clancy-dev.js', 'clancy-dev-autopilot.js'];
const SCAN_AGENT_FILES = [
  'arch-agent.md',
  'concerns-agent.md',
  'design-agent.md',
  'quality-agent.md',
  'tech-agent.md',
];
const SCAN_COMMAND_FILES = ['map-codebase.md', 'update-docs.md'];
const SCAN_WORKFLOW_FILES = ['map-codebase.md', 'update-docs.md'];

/** Matches `@.claude/clancy/workflows/<filename>.md` on its own line. */
const WORKFLOW_REF = /^@\.claude\/clancy\/workflows\/([^/\\]+\.md)\r?$/gm;

// ---------------------------------------------------------------------------
// Installer
// ---------------------------------------------------------------------------

/** @param {string} path */
function rejectSymlink(path) {
  try {
    if (lstatSync(path).isSymbolicLink()) {
      throw new Error(`Symlink rejected: ${path}`);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

/** @param {string} src @param {string} dest */
function copyChecked(src, dest) {
  rejectSymlink(dest);
  copyFileSync(src, dest);
}

// ---------------------------------------------------------------------------
// Mode selection
// ---------------------------------------------------------------------------

const MODE_MAP = { 1: 'global', 2: 'local', global: 'global', local: 'local' };

/** Prompt the user for global/local and return the mode (or exit on bad input). */
async function chooseMode() {
  console.log(blue('  Where would you like to install?'));
  console.log('');
  console.log(
    `  1) Global  ${dim('(~/.claude)')}   — available in all projects`,
  );
  console.log(`  2) Local   ${dim('(./.claude)')}  — this project only`);
  console.log('');
  const raw = await ask(cyan('  Choice [1]: '));
  const key = (raw || '1').trim().toLowerCase();
  const resolved = MODE_MAP[key];

  if (resolved) return resolved;

  console.log(red('\n  Invalid choice. Run npx @chief-clancy/dev again.'));
  rl.close();
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Install helpers
// ---------------------------------------------------------------------------

/** Inline workflow @-refs in command files (global mode only). */
function inlineWorkflows(commandsDest, workflowsDest) {
  [...COMMAND_FILES, ...SCAN_COMMAND_FILES].forEach((f) => {
    const cmdPath = join(commandsDest, f);
    const content = readFileSync(cmdPath, 'utf-8');
    const resolved = content.replace(WORKFLOW_REF, (match, fileName) => {
      const wfPath = join(workflowsDest, fileName);
      if (!existsSync(wfPath)) return match;
      rejectSymlink(wfPath);
      return readFileSync(wfPath, 'utf-8');
    });
    if (resolved !== content) {
      rejectSymlink(cmdPath);
      writeFileSync(cmdPath, resolved);
    }
  });
}

/** Copy all dev + scan files and write project metadata. */
function installFiles(dest, mode) {
  const { commandsDest, workflowsDest, agentsDest, clancyProjectDir } = dest;

  // Dev files
  COMMAND_FILES.forEach((f) =>
    copyChecked(join(devRoot, 'src', 'commands', f), join(commandsDest, f)),
  );
  WORKFLOW_FILES.forEach((f) =>
    copyChecked(join(devRoot, 'src', 'workflows', f), join(workflowsDest, f)),
  );
  BUNDLE_FILES.forEach((f) =>
    copyChecked(join(devRoot, 'dist', 'bundle', f), join(clancyProjectDir, f)),
  );

  // Scan files (agents, commands, workflows from @chief-clancy/scan)
  SCAN_AGENT_FILES.forEach((f) =>
    copyChecked(join(scanRoot, 'src', 'agents', f), join(agentsDest, f)),
  );
  SCAN_COMMAND_FILES.forEach((f) =>
    copyChecked(join(scanRoot, 'src', 'commands', f), join(commandsDest, f)),
  );
  SCAN_WORKFLOW_FILES.forEach((f) =>
    copyChecked(join(scanRoot, 'src', 'workflows', f), join(workflowsDest, f)),
  );

  if (mode === 'global') inlineWorkflows(commandsDest, workflowsDest);

  // ESM package.json + version marker
  const pkgJsonPath = join(clancyProjectDir, 'package.json');
  rejectSymlink(pkgJsonPath);
  writeFileSync(
    pkgJsonPath,
    JSON.stringify({ type: 'module' }, null, 2) + '\n',
  );
  const versionPath = join(clancyProjectDir, 'VERSION.dev');
  rejectSymlink(versionPath);
  writeFileSync(versionPath, pkg.version);
}

/** Print the install success output. */
function printSuccess() {
  console.log('');
  console.log(green('  ✓ Clancy Dev installed successfully.'));
  console.log('');
  console.log('  Commands available:');
  console.log(
    `      ${cyan('/clancy:dev')}            ${dim('Execute a board ticket autonomously')}`,
  );
  console.log(
    `      ${cyan('/clancy:dev-loop')}       ${dim('Process the ticket queue in a loop')}`,
  );
  console.log(
    `      ${cyan('/clancy:board-setup')}    ${dim('Configure board credentials')}`,
  );
  console.log(
    `      ${cyan('/clancy:map-codebase')}   ${dim('Scan codebase and generate .clancy/docs/')}`,
  );
  console.log(
    `      ${cyan('/clancy:update-docs')}    ${dim('Refresh .clancy/docs/ incrementally')}`,
  );
  console.log(
    `      ${cyan('/clancy:uninstall-dev')}  ${dim('Remove Clancy Dev')}`,
  );
  console.log('');
  console.log('  Next steps:');
  console.log(`    1. Open a project in Claude Code`);
  console.log(`    2. Run: ${cyan('/clancy:board-setup')}`);
  console.log(`    3. Recommended: ${cyan('/clancy:map-codebase')}`);
  console.log(`    4. Run: ${cyan('/clancy:dev PROJ-123')}`);
  console.log('');
  console.log(
    dim('  For the full pipeline (tickets, planning, implementation):'),
  );
  console.log(dim(`    npx chief-clancy`));
  console.log('');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('');
  console.log(blue('  Clancy Dev'));
  console.log(
    `  ${bold(`v${pkg.version}`)}${dim('  Autonomous execution surface for Claude Code.')}`,
  );
  console.log('');

  const mode = flag ?? (await chooseMode());

  if (flag) {
    console.log(dim(`  Mode: ${flag} (--${flag} flag)`));
  }

  const cwd = process.cwd();
  const baseDir =
    mode === 'global' ? join(homeDir, '.claude') : join(cwd, '.claude');

  const commandsDest = join(baseDir, 'commands', 'clancy');
  const workflowsDest = join(baseDir, 'clancy', 'workflows');
  const agentsDest = join(baseDir, 'clancy', 'agents');
  const clancyProjectDir = join(cwd, '.clancy');

  console.log(dim(`  Installing to: ${baseDir}`));

  // Reject symlinked destination directories
  rejectSymlink(commandsDest);
  rejectSymlink(workflowsDest);
  rejectSymlink(agentsDest);
  rejectSymlink(clancyProjectDir);

  // Create directories
  mkdirSync(commandsDest, { recursive: true });
  mkdirSync(workflowsDest, { recursive: true });
  mkdirSync(agentsDest, { recursive: true });
  mkdirSync(clancyProjectDir, { recursive: true });

  installFiles(
    { commandsDest, workflowsDest, agentsDest, clancyProjectDir },
    mode,
  );
  printSuccess();

  rl.close();
}

main().catch((err) => {
  console.error(red(`\n  Error: ${err.message}`));
  rl.close();
  process.exit(1);
});
