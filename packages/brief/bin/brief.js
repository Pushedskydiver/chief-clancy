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
function inlineWorkflow(commandsDest, workflowsDest) {
  const WORKFLOW_REF = /^@\.claude\/clancy\/workflows\/([^/\\]+\.md)\r?$/gm;
  const cmdPath = join(commandsDest, 'brief.md');
  const content = readFileSync(cmdPath, 'utf8');
  const resolved = content.replace(WORKFLOW_REF, (match, fileName) => {
    const wfPath = join(workflowsDest, fileName);
    if (!existsSync(wfPath)) return match;
    return readFileSync(wfPath, 'utf8');
  });

  if (resolved !== content) {
    rejectSymlink(cmdPath);
    writeFileSync(cmdPath, resolved);
  }
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

  // Determine install mode
  let mode = flag;

  if (!mode) {
    console.log(blue('  Where would you like to install?'));
    console.log('');
    console.log(
      `  1) Global  ${dim('(~/.claude)')}   — available in all projects`,
    );
    console.log(`  2) Local   ${dim('(./.claude)')}  — this project only`);
    console.log('');
    const choice = await ask(cyan('  Choice [1]: '));
    const trimmed = (choice || '1').trim();

    if (trimmed === '1' || trimmed.toLowerCase() === 'global') {
      mode = 'global';
    } else if (trimmed === '2' || trimmed.toLowerCase() === 'local') {
      mode = 'local';
    } else {
      console.log(
        red('\n  Invalid choice. Run npx @chief-clancy/brief again.'),
      );
      rl.close();
      process.exit(1);
    }
  } else {
    console.log(dim(`  Mode: ${flag} (--${flag} flag)`));
  }

  const cwd = process.cwd();
  const baseDir =
    mode === 'global' ? join(homeDir, '.claude') : join(cwd, '.claude');

  const commandsDest = join(baseDir, 'commands', 'clancy');
  const workflowsDest = join(baseDir, 'clancy', 'workflows');
  const agentsDest = join(baseDir, 'clancy', 'agents');

  console.log(dim(`  Installing to: ${commandsDest}`));

  // Create directories
  mkdirSync(commandsDest, { recursive: true });
  mkdirSync(workflowsDest, { recursive: true });
  mkdirSync(agentsDest, { recursive: true });

  // Copy files
  copyChecked(
    join(sources.commandsDir, 'brief.md'),
    join(commandsDest, 'brief.md'),
  );
  copyChecked(
    join(sources.workflowsDir, 'brief.md'),
    join(workflowsDest, 'brief.md'),
  );
  copyChecked(
    join(sources.agentsDir, 'devils-advocate.md'),
    join(agentsDest, 'devils-advocate.md'),
  );

  // Inline workflows for global mode
  if (mode === 'global') {
    inlineWorkflow(commandsDest, workflowsDest);
  }

  // Write version marker
  const versionPath = join(commandsDest, 'VERSION.brief');
  rejectSymlink(versionPath);
  writeFileSync(versionPath, pkg.version);

  // Success
  console.log('');
  console.log(green('  ✓ Clancy Brief installed successfully.'));
  console.log('');
  console.log('  Command available:');
  console.log(
    `      ${cyan('/clancy:brief')}  ${dim('Generate a strategic brief for a feature')}`,
  );
  console.log('');
  console.log('  Next steps:');
  console.log(`    1. Open a project in Claude Code`);
  console.log(`    2. Run: ${cyan('/clancy:brief "Your feature idea"')}`);
  console.log('');
  console.log(
    dim('  For the full pipeline (tickets, planning, implementation):'),
  );
  console.log(dim(`    npx chief-clancy`));
  console.log('');

  rl.close();
}

main().catch((err) => {
  console.error(red(`\n  Error: ${err.message}`));
  rl.close();
  process.exit(1);
});
