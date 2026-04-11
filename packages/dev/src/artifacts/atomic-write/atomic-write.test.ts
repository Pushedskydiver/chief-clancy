/**
 * Tests for atomic-write — write-temp-rename with mkdir.
 */
import { describe, expect, it, vi } from 'vitest';

import { atomicWrite, rotateFile } from './atomic-write.js';

// ─── Types ─────────────────────────────────────────────────────────────────

type FsCall = readonly [method: string, ...args: readonly unknown[]];

type MutableFs = {
  readonly mkdir: (path: string) => void;
  readonly writeFile: (path: string, content: string) => void;
  readonly rename: (from: string, to: string) => void;
  readonly readdir: (path: string) => readonly string[];
  readonly unlink: (path: string) => void;
  readonly stat: (path: string) => { readonly mtimeMs: number } | undefined;
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeFsCalls(): {
  readonly fs: MutableFs;
  readonly calls: readonly FsCall[];
} {
  const calls: FsCall[] = [];
  return {
    calls,
    fs: {
      mkdir: vi.fn((p: string) => {
        calls.push(['mkdir', p]);
      }),
      writeFile: vi.fn((p: string, c: string) => {
        calls.push(['writeFile', p, c]);
      }),
      rename: vi.fn((from: string, to: string) => {
        calls.push(['rename', from, to]);
      }),
      readdir: vi.fn((): readonly string[] => []),
      unlink: vi.fn((p: string) => {
        calls.push(['unlink', p]);
      }),
      stat: vi.fn((): { readonly mtimeMs: number } | undefined => undefined),
    },
  };
}

// ─── atomicWrite ───────────────────────────────────────────────────────────

describe('atomicWrite', () => {
  it('creates parent directory before writing', () => {
    const { fs, calls } = makeFsCalls();

    atomicWrite(fs, '/a/b/report.md', 'content');

    expect(calls[0]).toEqual(['mkdir', '/a/b']);
  });

  it('writes to a .tmp file then renames', () => {
    const { fs, calls } = makeFsCalls();

    atomicWrite(fs, '/a/b/report.md', 'content');

    expect(calls).toEqual([
      ['mkdir', '/a/b'],
      ['writeFile', '/a/b/report.md.tmp', 'content'],
      ['rename', '/a/b/report.md.tmp', '/a/b/report.md'],
    ]);
  });

  it('handles paths with trailing slashes in parent', () => {
    const { fs } = makeFsCalls();

    atomicWrite(fs, '/x/y/file.json', '{}');

    expect(fs.mkdir).toHaveBeenCalledWith('/x/y');
    expect(fs.writeFile).toHaveBeenCalledWith('/x/y/file.json.tmp', '{}');
    expect(fs.rename).toHaveBeenCalledWith(
      '/x/y/file.json.tmp',
      '/x/y/file.json',
    );
  });
});

// ─── rotateFile ────────────────────────────────────────────────────────────

describe('rotateFile', () => {
  it('renames existing file with ISO timestamp suffix', () => {
    const { fs } = makeFsCalls();
    fs.stat = vi.fn(() => ({ mtimeMs: Date.now() }));
    fs.readdir = vi.fn(() => []);

    rotateFile({
      fs,
      filePath: '/a/report.md',
      keep: 3,
      timestamp: () => '2026-04-11T10-00-00',
    });

    expect(fs.rename).toHaveBeenCalledWith(
      '/a/report.md',
      '/a/report.2026-04-11T10-00-00.md',
    );
  });

  it('is a no-op when file does not exist (stat returns undefined)', () => {
    const { fs } = makeFsCalls();
    fs.stat = vi.fn(() => undefined);

    rotateFile({
      fs,
      filePath: '/a/report.md',
      keep: 3,
      timestamp: () => '2026-04-11T10-00-00',
    });

    expect(fs.rename).not.toHaveBeenCalled();
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('deletes oldest rotated files when exceeding keep count', () => {
    const { fs } = makeFsCalls();
    fs.stat = vi.fn(() => ({ mtimeMs: Date.now() }));
    // readdir is called AFTER the rename, so the new rotated file is visible
    fs.readdir = vi.fn(() => [
      'report.2026-04-08T10-00-00.md',
      'report.2026-04-09T10-00-00.md',
      'report.2026-04-10T10-00-00.md',
      'report.2026-04-11T10-00-00.md',
      'other-file.md',
    ]);

    rotateFile({
      fs,
      filePath: '/a/report.md',
      keep: 3,
      timestamp: () => '2026-04-11T10-00-00',
    });

    // 4 rotated files, keep 3 → delete oldest
    expect(fs.unlink).toHaveBeenCalledWith('/a/report.2026-04-08T10-00-00.md');
    expect(fs.unlink).toHaveBeenCalledTimes(1);
  });

  it('does not delete when within keep count', () => {
    const { fs } = makeFsCalls();
    fs.stat = vi.fn(() => ({ mtimeMs: Date.now() }));
    // readdir returns files AFTER rename — includes the new rotated file
    fs.readdir = vi.fn(() => [
      'report.2026-04-09T10-00-00.md',
      'report.2026-04-10T10-00-00.md',
      'report.2026-04-11T10-00-00.md',
    ]);

    rotateFile({
      fs,
      filePath: '/a/report.md',
      keep: 3,
      timestamp: () => '2026-04-11T10-00-00',
    });

    // 3 rotated files, keep 3 → delete none
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('handles .json extensions correctly', () => {
    const { fs } = makeFsCalls();
    fs.stat = vi.fn(() => ({ mtimeMs: Date.now() }));
    fs.readdir = vi.fn(() => []);

    rotateFile({
      fs,
      filePath: '/a/report.json',
      keep: 3,
      timestamp: () => '2026-04-11T10-00-00',
    });

    expect(fs.rename).toHaveBeenCalledWith(
      '/a/report.json',
      '/a/report.2026-04-11T10-00-00.json',
    );
  });
});
