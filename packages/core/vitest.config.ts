import { resolve } from 'node:path';

import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: {
    alias: {
      '~/c': resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    name: 'core',
    include: ['src/**/*.test.ts'],
  },
});
