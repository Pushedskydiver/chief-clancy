/**
 * esbuild config for bundling dev runtime scripts to ESM.
 *
 * Produces self-contained ESM bundles for the dev and autopilot loop
 * runners. These bundles are copied to the user's `.clancy/` directory
 * by the installer and executed via `node .clancy/clancy-dev.js`.
 *
 * Strips unused zod locale files (~1.2 MB) that are re-exported from
 * `zod/v4/core/index.js` but never used at runtime.
 *
 * Build order: tsc → tsc-alias → this script.
 * Entry points are the tsc-compiled JS in `dist/entrypoints/`.
 */
import type { Plugin } from 'esbuild';

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const DIST = dirname(fileURLToPath(import.meta.url));
const DIST_BUNDLE = join(DIST, 'bundle');

const BUNDLES = [
  {
    entryPoint: join(DIST, 'entrypoints', 'dev.js'),
    outfile: join(DIST_BUNDLE, 'clancy-dev.js'),
  },
  {
    entryPoint: join(DIST, 'entrypoints', 'loop.js'),
    outfile: join(DIST_BUNDLE, 'clancy-dev-autopilot.js'),
  },
] as const;

/**
 * esbuild plugin that stubs zod's locale barrel import.
 *
 * Zod v4 re-exports all ~50 locale modules from `zod/v4/core/index.js`
 * via `export * as locales from "../locales/index.js"`. These are never
 * used at runtime (Clancy uses zod/mini with default English messages).
 *
 * The plugin intercepts any resolve to a `locales/index.js` originating
 * from within the zod package and replaces it with an empty export,
 * saving ~1.2 MB from the final bundle.
 */
const stubZodLocales: Plugin = {
  name: 'stub-zod-locales',
  setup(b) {
    b.onResolve({ filter: /locales\/index\.js$/ }, (args) => {
      const isFromZod = /[\\/]zod[\\/]/.test(args.resolveDir);
      return isFromZod
        ? { path: 'zod-locales-stub', namespace: 'zod-stub' }
        : undefined;
    });

    b.onLoad({ filter: /.*/, namespace: 'zod-stub' }, () => ({
      contents: 'export default {};',
      loader: 'js',
    }));
  },
};

const SHARED_OPTIONS = {
  bundle: true,
  platform: 'node' as const,
  format: 'esm' as const,
  target: 'node22',
  minify: true,
  treeShaking: true,
  plugins: [stubZodLocales],
};

mkdirSync(DIST_BUNDLE, { recursive: true });

await Promise.all(
  BUNDLES.map(({ entryPoint, outfile }) =>
    build({ ...SHARED_OPTIONS, entryPoints: [entryPoint], outfile }),
  ),
);
