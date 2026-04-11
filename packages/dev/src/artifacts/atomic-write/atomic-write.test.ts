/**
 * Tests for atomic-write — write-temp-rename with mkdir.
 */
import type { AtomicFs } from './atomic-write.js';

import { describe, expect, it, vi } from 'vitest';

import { atomicWrite, rotateFile } from './atomic-write.js';

// ─── Types ─────────────────────────────────────────────────────────────────

type FsCall = readonly [method: string, ...args: readonly unknown[]];

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeFsCalls(overrides?: {
  readonly stat?: AtomicFs['stat'];
  readonly readdir?: AtomicFs['readdir'];
}): { readonly fs: AtomicFs; readonly calls: readonly FsCall[] } {
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
      readdir: overrides?.readdir ?? vi.fn((): readonly string[] => []),
      unlink: vi.fn((p: string) => {
        calls.push(['unlink', p]);
      }),
      stat:
        overrides?.stat ??
        vi.fn((): { readonly mtimeMs: number } | undefined => undefined),
    },
  };
}

const EXISTS = vi.fn(() => ({ mtimeMs: Date.now() }));
const NOT_EXISTS = vi.fn(() => undefined);

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
    const { fs } = makeFsCalls({ stat: EXISTS });

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
    const { fs } = makeFsCalls({ stat: NOT_EXISTS });

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
    const { fs } = makeFsCalls({
      stat: EXISTS,
      // readdir is called AFTER the rename, so the new rotated file is visible
      readdir: vi.fn(() => [
        'report.2026-04-08T10-00-00.md',
        'report.2026-04-09T10-00-00.md',
        'report.2026-04-10T10-00-00.md',
        'report.2026-04-11T10-00-00.md',
        'other-file.md',
      ]),
    });

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
    const { fs } = makeFsCalls({
      stat: EXISTS,
      // readdir returns files AFTER rename — includes the new rotated file
      readdir: vi.fn(() => [
        'report.2026-04-09T10-00-00.md',
        'report.2026-04-10T10-00-00.md',
        'report.2026-04-11T10-00-00.md',
      ]),
    });

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
    const { fs } = makeFsCalls({ stat: EXISTS });

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
