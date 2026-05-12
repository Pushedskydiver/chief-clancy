#!/usr/bin/env node

/**
 * Clancy Design CLI — entry point for `npx @chief-clancy/design`.
 *
 * Subcommand router (M3 fold per spec § "Bin routing model"). Unlike brief
 * and plan (whose bins are install-only), design routes subcommands because
 * canvas, write, handoff, document, and init all run from the same npm bin.
 *
 * Currently routed (Phase F slices 8-9):
 * - `document` — run detection + write design's two docs to `.clancy/docs/`
 * - `init` — greenfield 6-question grill writing starter DESIGN.md + PRODUCT.md
 *
 * Routing pattern at N=2 stays Set + explicit if/else branching per
 * `docs/RATIONALIZATIONS.md` L54 ("Three similar lines of code is better
 * than a premature abstraction"). Promote to switch / Map<name, handler>
 * when N >= 3 if branch-count or dispatch-uniformity warrants — defer
 * for now.
 *
 * Bare invocation (no argv) falls back to a "Not yet implemented" placeholder
 * + exit 0 (the full installer lands in a later slice). Unknown subcommands
 * emit a stderr error + exit 1 — distinct from bare invocation per DA M1
 * fold on the slice-8 PR; spec § "Bin routing model" L982 deferred a
 * suggestion-fuzzy-match hint to a slice with enough siblings to match
 * against.
 *
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

const KNOWN_SUBCOMMANDS = new Set(['document', 'init']);

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
  if (subcommand === 'init') {
    const { runInit } = await import('../dist/commands/init.js');
    const result = await runInit(process.cwd());
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

  if (first && !first.startsWith('--')) {
    // Unknown subcommand — distinct from bare invocation. Spec § "Bin
    // routing model" L982 calls for a "did you mean ...?" hint here;
    // slice 8 ships the error signal only (exit 1 + stderr), with the
    // suggestion-fuzzy-match deferred to a slice that adds enough
    // siblings to be worth fuzzy-matching against.
    console.error(red(`\n  Unknown subcommand: ${first}`));
    console.error(
      dim(
        `  Known subcommands: ${[...KNOWN_SUBCOMMANDS].join(', ')} (more land in subsequent Phase F slices)`,
      ),
    );
    console.error('');
    process.exit(1);
  }

  printPlaceholder();
  process.exit(0);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(red(`\n  Error: ${message}`));
  process.exit(1);
});
