import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { detectConfidence, getConfidenceTier } from './confidence.js';

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'test',
  'fixtures',
);

describe('getConfidenceTier (pure logic)', () => {
  it('returns "low" when no signals are present', () => {
    expect(
      getConfidenceTier({
        hasShadcn: false,
        hasTailwind: false,
        hasTokensJson: false,
      }),
    ).toBe('low');
  });

  it('returns "high" when shadcn signal is present (single signal)', () => {
    expect(
      getConfidenceTier({
        hasShadcn: true,
        hasTailwind: false,
        hasTokensJson: false,
      }),
    ).toBe('high');
  });

  it('returns "high" when only the tailwind signal is present', () => {
    expect(
      getConfidenceTier({
        hasShadcn: false,
        hasTailwind: true,
        hasTokensJson: false,
      }),
    ).toBe('high');
  });

  it('returns "high" when only the tokens.json signal is present', () => {
    expect(
      getConfidenceTier({
        hasShadcn: false,
        hasTailwind: false,
        hasTokensJson: true,
      }),
    ).toBe('high');
  });

  it('returns "high" when all signals are present', () => {
    expect(
      getConfidenceTier({
        hasShadcn: true,
        hasTailwind: true,
        hasTokensJson: true,
      }),
    ).toBe('high');
  });
});

describe('detectConfidence (project-root scan)', () => {
  it('returns "low" for an empty project root', async () => {
    const result = await detectConfidence(join(FIXTURES, 'empty'));
    expect(result).toBe('low');
  });

  it('returns "high" when components.json is present at root (shadcn signal)', async () => {
    const result = await detectConfidence(join(FIXTURES, 'confidence-shadcn'));
    expect(result).toBe('high');
  });

  it('returns "high" when any tailwind.config.* is present at root', async () => {
    // Reuses the slice 2 `tailwind-basic` fixture — has `tailwind.config.js`
    // at root, no shadcn or tokens. Single-signal high tier.
    const result = await detectConfidence(join(FIXTURES, 'tailwind-basic'));
    expect(result).toBe('high');
  });

  it('returns "high" when tokens.json is present anywhere in the tree', async () => {
    // Reuses the slice 4 `tokens-json-nested` fixture — `tokens.json` at
    // `packages/ui/design/`, no shadcn or tailwind. The tokens signal is
    // recursive (mirrors slice 4's scan); shadcn + tailwind are root-only.
    const result = await detectConfidence(join(FIXTURES, 'tokens-json-nested'));
    expect(result).toBe('high');
  });

  it('returns "low" when components.json sits inside a subdirectory (shadcn signal is root-only)', async () => {
    // The shadcn probe scans the project root only — a `components.json`
    // anywhere below the root (whether in node_modules, src/, packages/, ...)
    // is not a host-project signal. node_modules is used here as a realistic
    // subdir; the test would pass identically for any non-root location.
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } =
      await import('node:fs');
    const { tmpdir } = await import('node:os');
    const root = mkdtempSync(join(tmpdir(), 'clancy-design-conf-subdir-'));
    mkdirSync(join(root, 'node_modules', 'some-pkg'), { recursive: true });
    writeFileSync(
      join(root, 'node_modules', 'some-pkg', 'components.json'),
      '{}',
    );
    try {
      const result = await detectConfidence(root);
      expect(result).toBe('low');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not follow symlinked components.json at root (security: path-traversal guard)', async () => {
    // `readRootFiles` uses `Dirent.isFile()` (false for symlinks), matching
    // slices 3 + 4. Slice 2 uses `existsSync` which follows symlinks; the
    // confidence module's own probes do not inherit that gap.
    const { mkdtempSync, writeFileSync, symlinkSync, rmSync } =
      await import('node:fs');
    const { tmpdir } = await import('node:os');
    const outside = mkdtempSync(join(tmpdir(), 'clancy-design-conf-out-'));
    const inside = mkdtempSync(join(tmpdir(), 'clancy-design-conf-in-'));
    writeFileSync(join(outside, 'components.json'), '{}');
    symlinkSync(
      join(outside, 'components.json'),
      join(inside, 'components.json'),
    );
    try {
      const result = await detectConfidence(inside);
      expect(result).toBe('low');
    } finally {
      rmSync(outside, { recursive: true, force: true });
      rmSync(inside, { recursive: true, force: true });
    }
  });
});
