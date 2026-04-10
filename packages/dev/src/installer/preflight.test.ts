import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { detectDevInstallState } from './preflight.js';

// ---------------------------------------------------------------------------
// detectDevInstallState
// ---------------------------------------------------------------------------

describe('detectDevInstallState', () => {
  const cwd = '/projects/my-app';
  const envPath = join(cwd, '.clancy', '.env');
  const pipelinePath = join(cwd, '.clancy', 'clancy-implement.js');

  it('returns "standalone" when .clancy/.env is absent', () => {
    const state = detectDevInstallState(cwd, {
      exists: () => false,
    });

    expect(state).toBe('standalone');
  });

  it('returns "standalone-board" when .clancy/.env exists but clancy-implement.js does not', () => {
    const state = detectDevInstallState(cwd, {
      exists: (p) => p === envPath,
    });

    expect(state).toBe('standalone-board');
  });

  it('returns "terminal" when both .clancy/.env and clancy-implement.js exist', () => {
    const state = detectDevInstallState(cwd, {
      exists: (p) => p === envPath || p === pipelinePath,
    });

    expect(state).toBe('terminal');
  });

  it('returns "standalone" when clancy-implement.js exists but .clancy/.env does not', () => {
    const state = detectDevInstallState(cwd, {
      exists: (p) => p === pipelinePath,
    });

    expect(state).toBe('standalone');
  });
});
