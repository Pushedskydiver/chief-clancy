/**
 * esbuild config for bundling hook scripts to CommonJS.
 *
 * Produces self-contained CJS bundles for each hook. Claude Code
 * requires hooks to be CommonJS — the hook installer writes a
 * `{ "type": "commonjs" }` package.json alongside the compiled files.
 *
 * Build order: tsc → tsc-alias → this script.
 * Entry points are the tsc-compiled JS in `dist/hooks/`.
 */
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const DIST_HOOKS = join(THIS_DIR, '..', '..', 'dist', 'hooks');

const HOOK_NAMES = [
  'clancy-check-update',
  'clancy-statusline',
  'clancy-context-monitor',
  'clancy-credential-guard',
  'clancy-branch-guard',
  'clancy-post-compact',
  'clancy-notification',
  'clancy-drift-detector',
] as const;

const SHARED_OPTIONS = {
  bundle: true,
  platform: 'node' as const,
  format: 'cjs' as const,
  target: 'node22',
  minify: true,
  treeShaking: true,
};

mkdirSync(DIST_HOOKS, { recursive: true });

await Promise.all(
  HOOK_NAMES.map((name) =>
    build({
      ...SHARED_OPTIONS,
      entryPoints: [join(DIST_HOOKS, name, `${name}.js`)],
      outfile: join(DIST_HOOKS, `${name}.js`),
    }),
  ),
);

// Clean up tsc intermediates — only the flat bundled .js files should remain.
const entries = readdirSync(DIST_HOOKS);

entries.forEach((entry) => {
  const full = join(DIST_HOOKS, entry);
  const isDir = statSync(full).isDirectory();
  const isBuildArtifact = entry.startsWith('esbuild.');

  if (isDir || isBuildArtifact) rmSync(full, { recursive: true });
});
