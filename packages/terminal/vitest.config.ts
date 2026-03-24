import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import { defineProject } from 'vitest/config';

const terminalSrc = fileURLToPath(new URL('./src', import.meta.url));
const coreSrc = fileURLToPath(new URL('../core/src', import.meta.url));

export default defineProject({
  plugins: [
    {
      name: 'resolve-tilde-alias',
      resolveId(source, importer) {
        if (!source.startsWith('~/') || !importer) return null;

        const suffix = source.slice(2).replace(/\.js$/, '.ts');
        const base = importer.includes('/packages/core/')
          ? coreSrc
          : terminalSrc;

        return resolve(base, suffix);
      },
    },
  ],
  resolve: {
    alias: {
      '@chief-clancy/core': fileURLToPath(
        new URL('../core/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    name: 'terminal',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
