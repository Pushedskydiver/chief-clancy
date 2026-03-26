import {
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  backupModifiedFiles,
  buildManifest,
  detectModifiedFiles,
} from './manifest.js';

function makeTmp(): string {
  const dir = join(
    tmpdir(),
    `clancy-test-${Date.now()}-${crypto.randomUUID()}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('buildManifest', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmp();
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('builds a manifest with SHA-256 hashes', () => {
    writeFileSync(join(tmp, 'a.md'), 'hello');
    writeFileSync(join(tmp, 'b.md'), 'world');

    const manifest = buildManifest(tmp);

    expect(Object.keys(manifest).sort()).toEqual(['a.md', 'b.md']);
    expect(manifest['a.md']).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest['b.md']).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest['a.md']).not.toBe(manifest['b.md']);
  });

  it('includes files in subdirectories', () => {
    mkdirSync(join(tmp, 'sub'), { recursive: true });
    writeFileSync(join(tmp, 'top.md'), 'top');
    writeFileSync(join(tmp, 'sub', 'nested.md'), 'nested');

    const manifest = buildManifest(tmp);

    expect(Object.keys(manifest)).toContain('top.md');
    expect(Object.keys(manifest)).toContain('sub/nested.md');
  });

  it('returns empty record for empty directory', () => {
    const manifest = buildManifest(tmp);

    expect(manifest).toEqual({});
  });

  it('skips symlinks', () => {
    writeFileSync(join(tmp, 'real.md'), 'content');
    symlinkSync(join(tmp, 'real.md'), join(tmp, 'link.md'));

    const manifest = buildManifest(tmp);

    expect(Object.keys(manifest)).toEqual(['real.md']);
  });
});

describe('detectModifiedFiles', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmp();
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns empty when no manifest exists', () => {
    const result = detectModifiedFiles(tmp, join(tmp, 'nonexistent.json'));

    expect(result).toEqual([]);
  });

  it('returns empty for corrupted manifest JSON', () => {
    const manifestPath = join(tmp, 'manifest.json');
    writeFileSync(manifestPath, 'not json');

    const result = detectModifiedFiles(tmp, manifestPath);

    expect(result).toEqual([]);
  });

  it('propagates non-ENOENT errors when reading manifest (H4)', () => {
    // Reading through a file as if it were a directory triggers ENOTDIR
    writeFileSync(join(tmp, 'blocker'), 'x');
    const badManifestPath = join(tmp, 'blocker', 'manifest.json');

    expect(() => detectModifiedFiles(tmp, badManifestPath)).toThrow();
  });

  it('propagates non-ENOENT errors when hashing a file (H5)', () => {
    // Create a valid manifest pointing to a path that triggers ENOTDIR
    writeFileSync(join(tmp, 'blocker'), 'x');
    const manifestPath = join(tmp, 'manifest.json');
    writeFileSync(
      manifestPath,
      JSON.stringify({ 'blocker/nested.md': 'fakehash' }),
    );

    expect(() => detectModifiedFiles(tmp, manifestPath)).toThrow();
  });

  it('returns empty for manifest with valid JSON array (L12)', () => {
    const manifestPath = join(tmp, 'manifest.json');
    writeFileSync(manifestPath, '[1, 2, 3]');

    const result = detectModifiedFiles(tmp, manifestPath);

    expect(result).toEqual([]);
  });

  it('detects modified files', () => {
    writeFileSync(join(tmp, 'a.md'), 'original');
    const manifest = buildManifest(tmp);
    const manifestPath = join(tmp, 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify(manifest));

    writeFileSync(join(tmp, 'a.md'), 'modified');

    const modified = detectModifiedFiles(tmp, manifestPath);

    expect(modified).toHaveLength(1);
    expect(modified[0]?.rel).toBe('a.md');
  });

  it('ignores unmodified files', () => {
    writeFileSync(join(tmp, 'a.md'), 'unchanged');
    const manifest = buildManifest(tmp);
    const manifestPath = join(tmp, 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify(manifest));

    const modified = detectModifiedFiles(tmp, manifestPath);

    expect(modified).toHaveLength(0);
  });

  it('rejects manifest keys with path traversal', () => {
    const manifestPath = join(tmp, 'manifest.json');
    writeFileSync(
      manifestPath,
      JSON.stringify({ '../../etc/passwd': 'fakehash' }),
    );

    const modified = detectModifiedFiles(tmp, manifestPath);

    expect(modified).toHaveLength(0);
  });

  it('rejects manifest keys with normalised traversal like sub/../a.md', () => {
    writeFileSync(join(tmp, 'a.md'), 'content');
    const manifestPath = join(tmp, 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify({ 'sub/../a.md': 'fakehash' }));

    const modified = detectModifiedFiles(tmp, manifestPath);

    expect(modified).toHaveLength(0);
  });

  it('filters out non-string manifest values', () => {
    writeFileSync(join(tmp, 'a.md'), 'content');
    const manifestPath = join(tmp, 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify({ 'a.md': 12345 }));

    const modified = detectModifiedFiles(tmp, manifestPath);

    expect(modified).toHaveLength(0);
  });

  it('skips files that no longer exist', () => {
    writeFileSync(join(tmp, 'a.md'), 'content');
    const manifest = buildManifest(tmp);
    const manifestPath = join(tmp, 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify(manifest));

    rmSync(join(tmp, 'a.md'));

    const modified = detectModifiedFiles(tmp, manifestPath);

    expect(modified).toHaveLength(0);
  });
});

describe('backupModifiedFiles', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmp();
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns null when no files to back up', () => {
    const result = backupModifiedFiles([], join(tmp, 'patches'));

    expect(result).toBeNull();
  });

  it('copies modified files and writes metadata', () => {
    const srcDir = join(tmp, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'a.md'), 'modified content');
    const patchesDir = join(tmp, 'patches');

    const result = backupModifiedFiles(
      [{ rel: 'a.md', absPath: join(srcDir, 'a.md') }],
      patchesDir,
    );

    expect(result).toBe(patchesDir);

    const backed = readFileSync(join(patchesDir, 'a.md'), 'utf8');
    expect(backed).toBe('modified content');

    const meta = JSON.parse(
      readFileSync(join(patchesDir, 'backup-meta.json'), 'utf8'),
    ) as { backed_up: string[]; date: string };
    expect(meta.backed_up).toEqual(['a.md']);
    expect(meta.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('propagates non-ENOENT errors when copying backup files (M8)', () => {
    const srcDir = join(tmp, 'src');
    mkdirSync(srcDir, { recursive: true });
    // Use a directory as the source — copyFileSync on a directory throws EISDIR
    mkdirSync(join(srcDir, 'subdir'), { recursive: true });
    const patchesDir = join(tmp, 'patches');

    expect(() =>
      backupModifiedFiles(
        [{ rel: 'subdir', absPath: join(srcDir, 'subdir') }],
        patchesDir,
      ),
    ).toThrow();
  });

  it('preserves nested directory structure in backup', () => {
    const srcDir = join(tmp, 'src');
    mkdirSync(join(srcDir, 'sub'), { recursive: true });
    writeFileSync(join(srcDir, 'sub', 'deep.md'), 'deep content');
    const patchesDir = join(tmp, 'patches');

    backupModifiedFiles(
      [{ rel: 'sub/deep.md', absPath: join(srcDir, 'sub', 'deep.md') }],
      patchesDir,
    );

    const backed = readFileSync(join(patchesDir, 'sub', 'deep.md'), 'utf8');
    expect(backed).toBe('deep content');
  });
});
