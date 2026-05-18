#!/usr/bin/env node

/**
 * Clancy Design CLI — entry point for `npx @chief-clancy/design`.
 *
 * Subcommand router (M3 fold per spec § "Bin routing model"). Unlike brief
 * and plan (whose bins are install-only), design routes subcommands because
 * canvas, write, handoff, document, and init all run from the same npm bin.
 *
 * Currently routed (Phase F slices 8-12):
 * - `document` — run detection + write design's two docs to `.clancy/docs/`
 * - `init` — greenfield 6-question grill writing starter DESIGN.md + PRODUCT.md
 * - `canvas` — start the foreground Vite design canvas server
 *
 * Routing pattern promoted at N=3 from explicit if/else branching to a
 * switch: the handlers now need slightly different argv parsing, and the
 * switch keeps those command-specific adapters adjacent to dispatch.
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

const KNOWN_SUBCOMMANDS = new Set(['document', 'init', 'canvas']);

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

/** @param {string} raw */
function parsePort(raw) {
  if (!/^\d+$/.test(raw)) {
    throw new Error('--port must be an integer between 1 and 65535');
  }
  const port = Number.parseInt(raw, 10);
  if (port < 1 || port > 65535) {
    throw new Error('--port must be an integer between 1 and 65535');
  }
  return port;
}

/** @param {string[]} args */
function parseCanvasOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--api-key') {
      const value = args[i + 1];
      if (!value) throw new Error('--api-key requires a value');
      options.apiKey = value;
      i += 1;
      continue;
    }
    if (arg.startsWith('--api-key=')) {
      options.apiKey = arg.slice('--api-key='.length);
      continue;
    }
    if (arg === '--port') {
      const value = args[i + 1];
      if (!value) throw new Error('--port requires a value');
      options.port = parsePort(value);
      i += 1;
      continue;
    }
    if (arg.startsWith('--port=')) {
      options.port = parsePort(arg.slice('--port='.length));
      continue;
    }
    throw new Error(`Unknown canvas option: ${arg}`);
  }
  return options;
}

/** @param {string} subcommand */
async function runSubcommand(subcommand) {
  switch (subcommand) {
    case 'document': {
      const { runDocument } = await import('../dist/commands/document.js');
      const result = await runDocument(process.cwd());
      return result.exitCode;
    }
    case 'init': {
      const { runInit } = await import('../dist/commands/init.js');
      const result = await runInit(process.cwd());
      return result.exitCode;
    }
    case 'canvas': {
      const { runCanvas } = await import('../dist/commands/canvas.js');
      const result = await runCanvas(
        process.cwd(),
        parseCanvasOptions(process.argv.slice(3)),
      );
      return result.exitCode;
    }
    default:
      // Defensive: KNOWN_SUBCOMMANDS gate ensures we never reach here.
      throw new Error(`Unhandled subcommand: ${subcommand}`);
  }
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
