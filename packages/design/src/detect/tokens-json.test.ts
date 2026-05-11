import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { detectTokensJson } from './tokens-json.js';

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'test',
  'fixtures',
);

describe('detectTokensJson', () => {
  it('parses a single DTCG-shaped tokens.json at the project root', async () => {
    const result = await detectTokensJson(join(FIXTURES, 'tokens-json-basic'));
    expect(result).toEqual({
      color: {
        primary: { $value: '#ff0080', $type: 'color' },
        secondary: { $value: '#00ff80', $type: 'color' },
      },
      spacing: {
        small: { $value: '4px', $type: 'dimension' },
      },
    });
  });

  it('returns null when the project root contains no tokens.json files', async () => {
    const result = await detectTokensJson(join(FIXTURES, 'empty'));
    expect(result).toBeNull();
  });

  it('returns null and does not throw when the project root does not exist', async () => {
    const result = await detectTokensJson(
      join(FIXTURES, 'tokens-json-does-not-exist'),
    );
    expect(result).toBeNull();
  });

  it('deep-merges last-wins when multiple tokens.json files exist', async () => {
    // Order is alphabetical by path. `packages/a/tokens.json` is read first,
    // `packages/b/tokens.json` second — overlapping nested keys take the
    // last-seen value. Mirrors slice 3's flat-map last-wins semantics.
    const result = await detectTokensJson(join(FIXTURES, 'tokens-json-multi'));
    expect(result).toEqual({
      color: {
        primary: { $value: '#00cc00', $type: 'color' },
        secondary: { $value: '#00ff80', $type: 'color' },
        accent: { $value: '#ff9500', $type: 'color' },
      },
    });
  });

  it('recursively descends into subdirectories to find tokens.json files', async () => {
    const result = await detectTokensJson(join(FIXTURES, 'tokens-json-nested'));
    expect(result).toEqual({
      spacing: {
        small: { $value: '4px', $type: 'dimension' },
        medium: { $value: '8px', $type: 'dimension' },
      },
    });
  });

  it('skips node_modules, dist, and other excluded directories at any depth', async () => {
    // Synthesised inline because root .gitignore excludes `node_modules/` and
    // `dist/` everywhere — committing the fixture as plain files would leave
    // CI with an empty tree and the test would falsely pass without exercising
    // the exclusion logic. Covers both top-level and nested exclusion.
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } =
      await import('node:fs');
    const { tmpdir } = await import('node:os');
    const root = mkdtempSync(join(tmpdir(), 'clancy-design-tokens-exclude-'));
    mkdirSync(join(root, 'node_modules', 'some-pkg'), { recursive: true });
    mkdirSync(join(root, 'dist'), { recursive: true });
    mkdirSync(join(root, 'src', 'feature', 'node_modules'), {
      recursive: true,
    });
    writeFileSync(
      join(root, 'node_modules', 'some-pkg', 'tokens.json'),
      JSON.stringify({ vendor: { $value: 'red' } }),
    );
    writeFileSync(
      join(root, 'dist', 'tokens.json'),
      JSON.stringify({ built: { $value: 'blue' } }),
    );
    writeFileSync(
      join(root, 'src', 'feature', 'node_modules', 'tokens.json'),
      JSON.stringify({ nestedVendor: { $value: 'purple' } }),
    );
    writeFileSync(
      join(root, 'tokens.json'),
      JSON.stringify({ app: { $value: 'green' } }),
    );
    try {
      const result = await detectTokensJson(root);
      expect(result).toEqual({ app: { $value: 'green' } });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not match `.tokens.json` / `design-tokens.json` / other DTCG-shaped filenames', async () => {
    // The DTCG spec does not standardize a filename; slice 4 matches the
    // most common convention (`tokens.json` exact) only. Other names are
    // skipped — extend the matcher when real-world usage surfaces them.
    const result = await detectTokensJson(
      join(FIXTURES, 'tokens-json-other-names'),
    );
    expect(result).toBeNull();
  });

  it('warns and continues when a tokens.json file contains invalid JSON', async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'clancy-design-tokens-bad-json-'));
    writeFileSync(join(dir, 'tokens.json'), '{ "color": { not-valid-json }');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await detectTokensJson(dir);
      // Malformed file is skipped; no other files → list-of-parsed is empty;
      // reduce from `{}` seed → returns `{}` (not null — files existed).
      expect(result).toEqual({});
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0]?.[0]).toContain('tokens.json');
    } finally {
      warnSpy.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('warns and continues when a tokens.json file cannot be read', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } =
      await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'clancy-design-tokens-unread-'));
    mkdirSync(join(dir, 'pkg-a'));
    mkdirSync(join(dir, 'pkg-b'));
    writeFileSync(
      join(dir, 'pkg-a', 'tokens.json'),
      JSON.stringify({ kept: { $value: 'red' } }),
    );
    const unreadable = join(dir, 'pkg-b', 'tokens.json');
    writeFileSync(unreadable, JSON.stringify({ dropped: { $value: 'blue' } }));
    chmodSync(unreadable, 0o000);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await detectTokensJson(dir);
      expect(result).toEqual({ kept: { $value: 'red' } });
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0]?.[0]).toContain('tokens.json');
    } finally {
      warnSpy.mockRestore();
      chmodSync(unreadable, 0o644);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not follow symlinked tokens.json files (security: path-traversal guard)', async () => {
    // Dirent.isFile() returns false for symlinks — used as the filter to
    // exclude them. Slice 2 documented the same trust posture; slices 3 + 4
    // enforce it mechanically as well.
    const { mkdtempSync, writeFileSync, symlinkSync, rmSync } =
      await import('node:fs');
    const { tmpdir } = await import('node:os');
    const outside = mkdtempSync(join(tmpdir(), 'clancy-design-tokens-out-'));
    const inside = mkdtempSync(join(tmpdir(), 'clancy-design-tokens-in-'));
    writeFileSync(
      join(outside, 'tokens.json'),
      JSON.stringify({ leaked: { $value: 'secret' } }),
    );
    writeFileSync(
      join(inside, 'real-tokens.json'),
      JSON.stringify({ irrelevant: true }),
    );
    symlinkSync(join(outside, 'tokens.json'), join(inside, 'tokens.json'));
    try {
      const result = await detectTokensJson(inside);
      // Symlink filtered out by isFile guard; the non-`tokens.json` real file
      // is also skipped (doesn't match the filename) — net result: null.
      expect(result).toBeNull();
    } finally {
      rmSync(outside, { recursive: true, force: true });
      rmSync(inside, { recursive: true, force: true });
    }
  });

  it('parses an empty DTCG object as an empty record (file exists, no tokens)', async () => {
    // Distinct from no-files (null) — file exists but carries no tokens.
    // Callers should treat this as "DTCG present, zero tokens."
    const result = await detectTokensJson(join(FIXTURES, 'tokens-json-empty'));
    expect(result).toEqual({});
  });

  it('skips non-object DTCG roots (JSON array or primitive) with no merge effect', async () => {
    // DTCG spec requires the root to be an object (group). A top-level array
    // or primitive is legal JSON but malformed DTCG. The detector parses it
    // (no warning — JSON.parse succeeds), then `isPlainObject` filter drops
    // it from the merge. Slice 6 schema will warn explicitly.
    const result = await detectTokensJson(
      join(FIXTURES, 'tokens-json-non-object-root'),
    );
    expect(result).toEqual({});
  });
});
