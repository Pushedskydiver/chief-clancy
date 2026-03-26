import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { rejectSymlink } from './fs-guards.js';

describe('rejectSymlink', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = join(tmpdir(), `clancy-test-${Date.now()}-${crypto.randomUUID()}`);
    mkdirSync(tmp, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('does nothing for a regular file', () => {
    const file = join(tmp, 'regular.txt');
    writeFileSync(file, 'content');

    expect(() => rejectSymlink(file)).not.toThrow();
  });

  it('does nothing for a non-existent path', () => {
    expect(() => rejectSymlink(join(tmp, 'missing'))).not.toThrow();
  });

  it('throws for a symlink', () => {
    const target = join(tmp, 'target.txt');
    const link = join(tmp, 'link.txt');
    writeFileSync(target, 'content');
    symlinkSync(target, link);

    expect(() => rejectSymlink(link)).toThrow(/symlink/i);
  });

  it('throws for a dangling symlink', () => {
    const link = join(tmp, 'dangling');
    symlinkSync(join(tmp, 'nonexistent'), link);

    expect(() => rejectSymlink(link)).toThrow(/symlink/i);
  });

  it('re-throws non-ENOENT errors', () => {
    const dir = join(tmp, 'noread');
    mkdirSync(dir, { mode: 0o000 });
    const target = join(dir, 'child', 'file.txt');

    try {
      expect(() => rejectSymlink(target)).toThrow();
    } finally {
      // Restore permissions for cleanup
      mkdirSync(dir, { mode: 0o755, recursive: true });
    }
  });
});
