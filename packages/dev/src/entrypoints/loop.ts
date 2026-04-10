/**
 * Autopilot loop entry point — no-op stub for `clancy-dev-autopilot.js` bundle.
 *
 * Replaced with real loop wiring in a later PR. Exists so PR 7 can
 * validate the esbuild config produces a working bundle.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as {
  readonly version: string;
};

console.log(`clancy-dev-autopilot v${version}`);
process.exit(0);
