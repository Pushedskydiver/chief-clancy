#!/usr/bin/env node

/**
 * Clancy installer — CLI entry point for `npx chief-clancy`.
 *
 * Thin wiring layer that delegates to the @chief-clancy/terminal
 * installer orchestrator. All logic lives in the terminal package;
 * this script only resolves paths, builds the dependency bag, and
 * hands off to `runInstall`.
 */
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

import {
  createPrompts,
  dim,
  parseInstallFlag,
  printBanner,
  red,
  resolveInstallPaths,
  runInstall,
} from '@chief-clancy/terminal';

// ---------------------------------------------------------------------------
// Resolve package metadata and terminal source directories
// ---------------------------------------------------------------------------

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const terminalEntry = fileURLToPath(
  import.meta.resolve('@chief-clancy/terminal'),
);
const terminalRoot = join(dirname(terminalEntry), '..');

const briefEntry = fileURLToPath(import.meta.resolve('@chief-clancy/brief'));
const briefRoot = join(dirname(briefEntry), '..');

const planEntry = fileURLToPath(import.meta.resolve('@chief-clancy/plan'));
const planRoot = join(dirname(planEntry), '..');

const sources = {
  rolesDir: join(terminalRoot, 'src', 'roles'),
  hooksDir: join(terminalRoot, 'dist', 'hooks'),
  bundleDir: join(terminalRoot, 'dist', 'bundle'),
  agentsDir: join(terminalRoot, 'src', 'agents'),
  briefCommandsDir: join(briefRoot, 'src', 'commands'),
  briefWorkflowsDir: join(briefRoot, 'src', 'workflows'),
  briefAgentsDir: join(briefRoot, 'src', 'agents'),
  planCommandsDir: join(planRoot, 'src', 'commands'),
  planWorkflowsDir: join(planRoot, 'src', 'workflows'),
};

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const homeDir = process.env.HOME ?? process.env.USERPROFILE;

if (!homeDir) {
  console.error(red('  Error: Could not determine home directory.'));
  process.exit(1);
}

const cwd = process.cwd();

// ---------------------------------------------------------------------------
// CLI flag parsing
// ---------------------------------------------------------------------------

const flag = parseInstallFlag(process.argv.slice(2));
const nonInteractive = flag !== null;

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const rl = createInterface({ input: process.stdin, output: process.stdout });
const prompts = createPrompts(rl);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Prompt the user for global/local install mode when no CLI flag is provided.
 *
 * @param {ReturnType<typeof createPrompts>} p
 * @returns {Promise<'global' | 'local'>}
 */
async function chooseMode(p) {
  const choice = await p.choose('Where would you like to install?', [
    `Global  ${dim('(~/.claude)')}   — available in all projects`,
    `Local   ${dim('(./.claude)')}  — this project only`,
  ]);

  if (choice === '1' || choice.toLowerCase() === 'global') return 'global';
  if (choice === '2' || choice.toLowerCase() === 'local') return 'local';

  console.log(
    red('\n  Invalid choice. Run npx chief-clancy again and enter 1 or 2.'),
  );
  p.close();
  process.exit(1);
}

async function main() {
  printBanner(pkg.version);

  const mode = flag ?? (await chooseMode(prompts));

  if (flag) {
    console.log(dim(`  Mode: ${flag} (--${flag} flag)`));
  }

  const paths = resolveInstallPaths(mode, homeDir, cwd);

  await runInstall({
    mode,
    paths,
    sources,
    version: pkg.version,
    nonInteractive,
    prompts,
    cwd,
    fs: {
      exists: existsSync,
      readFile: (p) => readFileSync(p, 'utf8'),
      writeFile: (p, c) => writeFileSync(p, c, 'utf8'),
      mkdir: (p) => mkdirSync(p, { recursive: true }),
      copyFile: (s, d) => copyFileSync(s, d),
      unlink: (p) => unlinkSync(p),
      // TOCTOU: narrow window between lstat and the caller's write. Acceptable
      // for a local CLI installer — no privileged paths are involved.
      rejectSymlink: (p) => {
        try {
          if (lstatSync(p).isSymbolicLink()) {
            throw new Error(`Symlink rejected: ${p}`);
          }
        } catch (err) {
          if (/** @type {NodeJS.ErrnoException} */ (err).code !== 'ENOENT')
            throw err;
        }
      },
    },
  });

  prompts.close();
}

main().catch((err) => {
  console.error(red(`\n  Error: ${err.message}`));
  prompts.close();
  process.exit(1);
});
