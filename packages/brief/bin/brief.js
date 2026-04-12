#!/usr/bin/env node

/**
 * Brief installer — CLI entry point for `npx @chief-clancy/brief`.
 *
 * Self-contained installer that copies the brief slash command, workflow,
 * and devil's advocate agent prompt to the Claude Code commands directory.
 * No dependencies on @chief-clancy/core or @chief-clancy/terminal.
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
// Resolve package metadata and source directories
// ---------------------------------------------------------------------------

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const briefRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const scanRoot = join(
  dirname(require.resolve('@chief-clancy/scan/package.json')),
);

const sources = {
  commandsDir: join(briefRoot, 'src', 'commands'),
  workflowsDir: join(briefRoot, 'src', 'workflows'),
  agentsDir: join(briefRoot, 'src', 'agents'),
};

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
const nonInteractive = flag !== null;

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
  'approve-brief.md',
  'board-setup.md',
  'brief.md',
  'uninstall-brief.md',
];
const WORKFLOW_FILES = [
  'approve-brief.md',
  'board-setup.md',
  'brief.md',
  'uninstall-brief.md',
];
const AGENT_FILES = ['devils-advocate.md'];
const SCAN_AGENT_FILES = [
  'arch-agent.md',
  'concerns-agent.md',
  'design-agent.md',
  'quality-agent.md',
  'tech-agent.md',
];
const SCAN_COMMAND_FILES = ['map-codebase.md', 'update-docs.md'];
const SCAN_WORKFLOW_FILES = ['map-codebase.md', 'update-docs.md'];

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

/** Inline workflow @-references into command files (global mode only). */
function inlineWorkflows(commandsDest, workflowsDest) {
  const WORKFLOW_REF = /^@\.claude\/clancy\/workflows\/([^/\\]+\.md)\r?$/gm;

  [...COMMAND_FILES, ...SCAN_COMMAND_FILES].forEach((file) => {
    const cmdPath = join(commandsDest, file);
    const content = readFileSync(cmdPath, 'utf8');
    const resolved = content.replace(WORKFLOW_REF, (match, fileName) => {
      const wfPath = join(workflowsDest, fileName);
      if (!existsSync(wfPath)) return match;
      rejectSymlink(wfPath);
      return readFileSync(wfPath, 'utf8');
    });

    if (resolved !== content) {
      rejectSymlink(cmdPath);
      writeFileSync(cmdPath, resolved);
    }
  });
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

  console.log(red('\n  Invalid choice. Run npx @chief-clancy/brief again.'));
  rl.close();
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Install helpers
// ---------------------------------------------------------------------------

/** Copy all brief + scan files and write version marker. */
function installFiles(dest, mode) {
  const { commandsDest, workflowsDest, agentsDest } = dest;

  // Brief files
  COMMAND_FILES.forEach((f) =>
    copyChecked(join(sources.commandsDir, f), join(commandsDest, f)),
  );
  WORKFLOW_FILES.forEach((f) =>
    copyChecked(join(sources.workflowsDir, f), join(workflowsDest, f)),
  );
  AGENT_FILES.forEach((f) =>
    copyChecked(join(sources.agentsDir, f), join(agentsDest, f)),
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

  const versionPath = join(commandsDest, 'VERSION.brief');
  rejectSymlink(versionPath);
  writeFileSync(versionPath, pkg.version);
}

/** Print the install success output. */
function printSuccess() {
  console.log('');
  console.log(green('  ✓ Clancy Brief installed successfully.'));
  console.log('');
  console.log('  Commands available:');
  console.log(
    `      ${cyan('/clancy:brief')}          ${dim('Generate a strategic brief')}`,
  );
  console.log(
    `      ${cyan('/clancy:approve-brief')}  ${dim('Approve a brief and create board tickets')}`,
  );
  console.log(
    `      ${cyan('/clancy:board-setup')}    ${dim('Configure board credentials (optional)')}`,
  );
  console.log(
    `      ${cyan('/clancy:map-codebase')}   ${dim('Scan codebase and generate .clancy/docs/')}`,
  );
  console.log(
    `      ${cyan('/clancy:update-docs')}    ${dim('Refresh .clancy/docs/ incrementally')}`,
  );
  console.log(
    `      ${cyan('/clancy:uninstall-brief')}${dim(' Remove Clancy Brief')}`,
  );
  console.log('');
  console.log('  Next steps:');
  console.log(`    1. Open a project in Claude Code`);
  console.log(
    `    2. Optional: ${cyan('/clancy:map-codebase')} ${dim('for richer briefs')}`,
  );
  console.log(`    3. Run: ${cyan('/clancy:brief "Your feature idea"')}`);
  console.log('');
  console.log(dim('  Want to brief from board tickets?'));
  console.log(dim(`    Run: ${cyan('/clancy:board-setup')}`));
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
  console.log(blue('  Clancy Brief'));
  console.log(
    `  ${bold(`v${pkg.version}`)}${dim('  Strategic brief generator for Claude Code.')}`,
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

  console.log(dim(`  Installing to: ${commandsDest}`));

  mkdirSync(commandsDest, { recursive: true });
  mkdirSync(workflowsDest, { recursive: true });
  mkdirSync(agentsDest, { recursive: true });

  installFiles({ commandsDest, workflowsDest, agentsDest }, mode);
  printSuccess();

  rl.close();
}

main().catch((err) => {
  console.error(red(`\n  Error: ${err.message}`));
  rl.close();
  process.exit(1);
});
