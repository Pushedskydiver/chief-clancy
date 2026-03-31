/**
 * Runtime bundle smoke tests.
 *
 * Verifies that each esbuild-bundled ESM runtime script exists and
 * can be loaded without crashing. Catches bundling regressions
 * (missing imports, broken tree-shaking, zod locale stubbing issues).
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

const DIST_BUNDLE = resolve(import.meta.dirname, '../../../dist/bundle');

const BUNDLE_NAMES = ['clancy-implement', 'clancy-autopilot'] as const;

// ─── Bundle existence ───────────────────────────────────────────────────────

describe('runtime bundle existence', () => {
  it.each(BUNDLE_NAMES)('%s.js bundle exists', (name) => {
    expect(existsSync(resolve(DIST_BUNDLE, `${name}.js`))).toBe(true);
  });
});

// ─── Bundle loads without crashing ──────────────────────────────────────────

describe('runtime bundle loads without crashing', () => {
  it.each(BUNDLE_NAMES)('%s.js loads via dynamic import', async (name) => {
    const bundlePath = resolve(DIST_BUNDLE, `${name}.js`);
    const url = pathToFileURL(bundlePath).href;

    // The main guard checks process.argv[1] !== this file, so it
    // won't self-execute — the import just evaluates the module.
    await expect(import(url)).resolves.toBeDefined();
  });
});
