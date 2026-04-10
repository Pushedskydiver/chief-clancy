/**
 * Dev runtime entry point — no-op stub for `clancy-dev.js` bundle.
 *
 * Replaced with real pipeline wiring in PR 8c. Exists so PR 7 can
 * validate the esbuild config produces a working bundle.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as {
  readonly version: string;
};

console.log(`clancy-dev v${version}`);
process.exit(0);
