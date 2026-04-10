import { fileURLToPath, URL } from 'node:url';

import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: {
    alias: {
      '~/d': fileURLToPath(new URL('./src', import.meta.url)),
      '~/c': fileURLToPath(new URL('../core/src', import.meta.url)),
      '@chief-clancy/core': fileURLToPath(
        new URL('../core/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    name: 'dev',
    include: ['src/**/*.test.ts'],
  },
});
