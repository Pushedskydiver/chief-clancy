import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'design',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./test/setup-jsdom-dialog.ts'],
  },
});
