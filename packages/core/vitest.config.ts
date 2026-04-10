import { resolve } from 'node:path';

import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: {
    alias: {
      '~/c': resolve(import.meta.dirname, 'src'),
      '@chief-clancy/dev': resolve(import.meta.dirname, '../dev/src/index.ts'),
    },
  },
  test: {
    name: 'core',
    include: ['src/**/*.test.ts'],
  },
});
