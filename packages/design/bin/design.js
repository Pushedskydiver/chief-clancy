#!/usr/bin/env node

/**
 * Clancy Design CLI — entry point for `npx @chief-clancy/design`.
 *
 * Subcommand router (M3 fold per spec § "Bin routing model"). Unlike brief
 * and plan (whose bins are install-only), design routes subcommands because
 * canvas, write, handoff, document, and init all run from the same npm bin.
 *
 * Currently routed (Phase F slice 8):
 * - `document` — run detection + write design's two docs to `.clancy/docs/`
 *
 * Falls back to a "Not yet implemented" placeholder for unknown subcommands
 * and the bare-invocation case (the full installer lands in a later slice).
 * The subcommand dispatcher dynamically imports runtime handlers from
 * `../dist/commands/<name>.js`, so the package must be built before bin
 * invocation works (turbo's `test: { dependsOn: ['^build', 'build'] }`
 * guarantees this for the in-repo test suite; published-npm consumers get
 * `dist/` in the tarball alongside `bin/`).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const blue = (s) => `\x1b[1;34m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

const KNOWN_SUBCOMMANDS = new Set(['document']);

function printPlaceholder() {
  console.log('');
  console.log(blue('  Clancy Design'));
  console.log(`  ${dim(`v${pkg.version}  Not yet implemented (Phase F).`)}`);
  console.log('');
  console.log(
    dim('  Track progress: https://github.com/Pushedskydiver/chief-clancy'),
  );
  console.log('');
}

/** @param {string} subcommand */
async function runSubcommand(subcommand) {
  if (subcommand === 'document') {
    const { runDocument } = await import('../dist/commands/document.js');
    const result = await runDocument(process.cwd());
    return result.exitCode;
  }
  // Defensive: KNOWN_SUBCOMMANDS gate ensures we never reach here.
  throw new Error(`Unhandled subcommand: ${subcommand}`);
}

async function main() {
  const first = process.argv[2];

  if (first && KNOWN_SUBCOMMANDS.has(first)) {
    const code = await runSubcommand(first);
    process.exit(code);
  }

  printPlaceholder();
  process.exit(0);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(red(`\n  Error: ${message}`));
  process.exit(1);
});
