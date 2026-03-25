import type { LockData, LockFs } from './lock.js';

import { describe, expect, it, vi } from 'vitest';

import { deleteLock, isLockStale, readLock, writeLock } from './lock.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeLockData(overrides: Partial<LockData> = {}): LockData {
  return {
    pid: process.pid,
    ticketKey: 'PROJ-42',
    ticketTitle: 'Add login page',
    ticketBranch: 'feature/proj-42',
    targetBranch: 'main',
    parentKey: '',
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

function memoryFs(): LockFs & { readonly files: ReadonlyMap<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    readFile: vi.fn((path: string) => {
      const content = files.get(path);
      if (content === undefined) throw new Error('ENOENT');
      return content;
    }),
    writeFile: vi.fn((path: string, content: string) => {
      files.set(path, content);
    }),
    deleteFile: vi.fn((path: string) => {
      if (!files.has(path)) throw new Error('ENOENT');
      files.delete(path);
    }),
    mkdir: vi.fn(),
  };
}

// ─── writeLock ───────────────────────────────────────────────────────────────

describe('writeLock', () => {
  it('writes lock data as JSON to the lock file', () => {
    const fs = memoryFs();
    const data = makeLockData();

    writeLock(fs, '/project', data);

    const written = JSON.parse(fs.files.get('/project/.clancy/lock.json')!);
    expect(written).toEqual(data);
  });

  it('creates the .clancy directory before writing', () => {
    const fs = memoryFs();

    writeLock(fs, '/project', makeLockData());

    expect(fs.mkdir).toHaveBeenCalledWith('/project/.clancy');
  });
});

// ─── readLock ────────────────────────────────────────────────────────────────

describe('readLock', () => {
  it('reads and parses valid lock data', () => {
    const fs = memoryFs();
    const data = makeLockData();
    fs.files.set('/project/.clancy/lock.json', JSON.stringify(data));

    const result = readLock(fs, '/project');

    expect(result).toEqual(data);
  });

  it('returns undefined when file does not exist', () => {
    const fs = memoryFs();

    expect(readLock(fs, '/project')).toBeUndefined();
  });

  it('returns undefined for corrupt JSON', () => {
    const fs = memoryFs();
    fs.files.set('/project/.clancy/lock.json', '{ bad json');

    expect(readLock(fs, '/project')).toBeUndefined();
  });

  it('returns undefined for JSON missing required fields', () => {
    const fs = memoryFs();
    fs.files.set('/project/.clancy/lock.json', JSON.stringify({ pid: 123 }));

    expect(readLock(fs, '/project')).toBeUndefined();
  });

  it('returns undefined for empty startedAt', () => {
    const fs = memoryFs();
    const data = { ...makeLockData(), startedAt: '' };
    fs.files.set('/project/.clancy/lock.json', JSON.stringify(data));

    expect(readLock(fs, '/project')).toBeUndefined();
  });

  it('preserves optional description field', () => {
    const fs = memoryFs();
    const data = makeLockData({ description: 'Some ticket context' });
    fs.files.set('/project/.clancy/lock.json', JSON.stringify(data));

    const result = readLock(fs, '/project');

    expect(result?.description).toBe('Some ticket context');
  });

  it('strips unknown fields', () => {
    const fs = memoryFs();
    const data = { ...makeLockData(), extra: 'should-be-stripped' };
    fs.files.set('/project/.clancy/lock.json', JSON.stringify(data));

    const result = readLock(fs, '/project');

    expect(result).toBeDefined();
    expect((result as Record<string, unknown>)['extra']).toBeUndefined();
  });
});

// ─── deleteLock ──────────────────────────────────────────────────────────────

describe('deleteLock', () => {
  it('removes the lock file', () => {
    const fs = memoryFs();
    fs.files.set('/project/.clancy/lock.json', '{}');

    deleteLock(fs, '/project');

    expect(fs.files.has('/project/.clancy/lock.json')).toBe(false);
  });

  it('does not throw when file does not exist', () => {
    const fs = memoryFs();

    expect(() => deleteLock(fs, '/project')).not.toThrow();
  });
});

// ─── isLockStale ─────────────────────────────────────────────────────────────

describe('isLockStale', () => {
  it('returns true when PID is dead', () => {
    const lock = makeLockData({ pid: 999999 });

    expect(isLockStale(lock)).toBe(true);
  });

  it('returns true when lock is older than 24 hours', () => {
    const twentyFiveHoursAgo = new Date(
      Date.now() - 25 * 60 * 60 * 1000,
    ).toISOString();
    const lock = makeLockData({ startedAt: twentyFiveHoursAgo });

    expect(isLockStale(lock)).toBe(true);
  });

  it('returns false when PID is alive and lock is recent', () => {
    const lock = makeLockData();

    expect(isLockStale(lock)).toBe(false);
  });
});
