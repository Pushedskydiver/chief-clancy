import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'plan',
    include: ['src/**/*.test.ts'],
  },
});
