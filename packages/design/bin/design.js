#!/usr/bin/env node

/**
 * Clancy Design installer — CLI entry point for `npx @chief-clancy/design`.
 *
 * Phase F slice 1: scaffolding only. Subsequent slices add the full installer
 * (slash commands, workflows, agents) mirroring the brief/plan pattern at
 * packages/brief/bin/brief.js. For now this binary prints a "not yet
 * implemented" notice so that bin-resolution is wired up cleanly when the
 * package gets exercised in later slices.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const blue = (s) => `\x1b[1;34m${s}\x1b[0m`;

console.log('');
console.log(blue('  Clancy Design'));
console.log(`  ${dim(`v${pkg.version}  Not yet implemented (Phase F).`)}`);
console.log('');
console.log(
  dim('  Track progress: https://github.com/Pushedskydiver/chief-clancy'),
);
console.log('');
process.exit(0);
