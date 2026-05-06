/**
 * @chief-clancy/design
 *
 * AI-design tool for Claude Code — variant generation, canvas, and
 * design-system documentation. Phase F slice 1: package scaffolding only;
 * detection, variant generation, and canvas server land in subsequent slices.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { readonly version: string };

export const PACKAGE_NAME = '@chief-clancy/design' as const;
export const version = pkg.version;
