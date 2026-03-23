import { fileURLToPath, URL } from 'node:url';

import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: {
    alias: {
      '@chief-clancy/core': fileURLToPath(
        new URL('../core/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    name: 'terminal',
    include: ['src/**/*.test.ts'],
  },
});
