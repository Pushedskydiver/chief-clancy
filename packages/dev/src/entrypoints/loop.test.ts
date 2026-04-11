import { describe, expect, it } from 'vitest';

import { parseLoopArgs, resolveBuildLabelFromEnv } from './loop.js';

// ─── parseLoopArgs ──────────────────────────────────────────────────────────

describe('parseLoopArgs', () => {
  const base = ['node', 'clancy-dev-autopilot.js'];

  it('defaults to non-afk, no max, no bypass', () => {
    const args = parseLoopArgs(base);

    expect(args).toEqual({
      isAfk: false,
      maxIterations: undefined,
      bypassReadiness: false,
      passthroughArgv: [],
    });
  });

  it('parses --afk flag', () => {
    const args = parseLoopArgs([...base, '--afk']);

    expect(args.isAfk).toBe(true);
  });

  it('parses --bypass-readiness flag', () => {
    const args = parseLoopArgs([...base, '--bypass-readiness']);

    expect(args.bypassReadiness).toBe(true);
  });

  it('parses --max=N as a positive integer', () => {
    const args = parseLoopArgs([...base, '--max=5']);

    expect(args.maxIterations).toBe(5);
  });

  it('floors decimal --max values', () => {
    const args = parseLoopArgs([...base, '--max=3.7']);

    expect(args.maxIterations).toBe(3);
  });

  it('ignores --max=0', () => {
    const args = parseLoopArgs([...base, '--max=0']);

    expect(args.maxIterations).toBeUndefined();
  });

  it('ignores --max with negative value', () => {
    const args = parseLoopArgs([...base, '--max=-2']);

    expect(args.maxIterations).toBeUndefined();
  });

  it('ignores --max with non-numeric value', () => {
    const args = parseLoopArgs([...base, '--max=abc']);

    expect(args.maxIterations).toBeUndefined();
  });

  it('combines all flags', () => {
    const args = parseLoopArgs([
      ...base,
      '--afk',
      '--max=10',
      '--bypass-readiness',
    ]);

    expect(args).toEqual({
      isAfk: true,
      maxIterations: 10,
      bypassReadiness: true,
      passthroughArgv: [],
    });
  });

  it('passes through non-loop flags like --dry-run', () => {
    const args = parseLoopArgs([...base, '--afk', '--dry-run', '--max=3']);

    expect(args.passthroughArgv).toEqual(['--dry-run']);
  });

  it('passes through multiple non-loop flags', () => {
    const args = parseLoopArgs([
      ...base,
      '--dry-run',
      '--skip-feasibility',
      '--afk',
    ]);

    expect(args.passthroughArgv).toEqual(['--dry-run', '--skip-feasibility']);
  });
});

// ─── resolveBuildLabelFromEnv ───────────────────────────────────────────────

describe('resolveBuildLabelFromEnv', () => {
  it('returns default label when no env vars are set', () => {
    expect(resolveBuildLabelFromEnv({})).toBe('clancy:build');
  });

  it('prefers CLANCY_LABEL_BUILD over CLANCY_LABEL', () => {
    expect(
      resolveBuildLabelFromEnv({
        CLANCY_LABEL_BUILD: 'custom:build',
        CLANCY_LABEL: 'custom:label',
      }),
    ).toBe('custom:build');
  });

  it('falls back to CLANCY_LABEL when CLANCY_LABEL_BUILD is absent', () => {
    expect(resolveBuildLabelFromEnv({ CLANCY_LABEL: 'custom:label' })).toBe(
      'custom:label',
    );
  });

  it('returns default when both are undefined', () => {
    expect(
      resolveBuildLabelFromEnv({
        CLANCY_LABEL_BUILD: undefined,
        CLANCY_LABEL: undefined,
      }),
    ).toBe('clancy:build');
  });
});
