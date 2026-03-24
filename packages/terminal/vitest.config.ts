import { fileURLToPath, URL } from 'node:url';

import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: {
    alias: {
      '~/t': fileURLToPath(new URL('./src', import.meta.url)),
      '~/c': fileURLToPath(new URL('../core/src', import.meta.url)),
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
