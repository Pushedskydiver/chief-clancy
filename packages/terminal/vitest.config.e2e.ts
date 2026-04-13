import { fileURLToPath, URL } from 'node:url';

// defineConfig (not defineProject) — E2E runs standalone, not as a workspace project.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '~/t': fileURLToPath(new URL('./src', import.meta.url)),
      '~/c': fileURLToPath(new URL('../core/src', import.meta.url)),
      '~/d': fileURLToPath(new URL('../dev/src', import.meta.url)),
      '@chief-clancy/core': fileURLToPath(
        new URL('../core/src', import.meta.url),
      ),
      '@chief-clancy/dev': fileURLToPath(
        new URL('../dev/src', import.meta.url),
      ),
    },
  },
  test: {
    include: ['test/e2e/**/*.e2e.ts'],
    testTimeout: 60_000,
    restoreMocks: true,
    // Sequential: E2E tests use process.chdir and real git/filesystem ops.
    fileParallelism: false,
    // No retry — E2E tests create real external resources (issues, PRs,
    // branches). Retries would leak earlier-attempt resources. The GC
    // script handles orphan cleanup instead.
  },
});
