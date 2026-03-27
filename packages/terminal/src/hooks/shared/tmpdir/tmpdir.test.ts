import { describe, expect, it } from 'vitest';

import {
  bridgePath,
  debouncePath,
  driftFlagPath,
  safeSessionId,
} from './tmpdir.js';

const fakeTmpdir = { tmpdir: () => '/tmp' };

describe('safeSessionId', () => {
  it('strips characters outside [a-zA-Z0-9_-]', () => {
    expect(safeSessionId('abc/def:123!')).toBe('abcdef123');
  });

  it('preserves hyphens and underscores', () => {
    expect(safeSessionId('session_01-abc')).toBe('session_01-abc');
  });

  it('returns empty string for empty input', () => {
    expect(safeSessionId('')).toBe('');
  });
});

describe('bridgePath', () => {
  it('returns tmpdir/clancy-ctx-{safe}.json', () => {
    expect(bridgePath('sess-1', fakeTmpdir)).toBe(
      '/tmp/clancy-ctx-sess-1.json',
    );
  });
});

describe('debouncePath', () => {
  it('returns tmpdir/clancy-ctx-{safe}-warned.json', () => {
    expect(debouncePath('sess-1', fakeTmpdir)).toBe(
      '/tmp/clancy-ctx-sess-1-warned.json',
    );
  });
});

describe('driftFlagPath', () => {
  it('returns tmpdir/clancy-drift-{safe}', () => {
    expect(driftFlagPath('sess-1', fakeTmpdir)).toBe(
      '/tmp/clancy-drift-sess-1',
    );
  });
});
