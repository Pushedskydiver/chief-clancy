import type { LockData, LockFs } from './lock.js';

import { describe, expect, it, vi } from 'vitest';

import {
  deleteLock,
  deleteVerifyAttempt,
  isLockStale,
  readLock,
  writeLock,
} from './lock.js';

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

type MemoryFs = LockFs & {
  /** Seed a file into the in-memory store (test arrangement). */
  readonly seed: (path: string, content: string) => void;
  /** Read the last content written to a path, or `undefined`. */
  readonly lastWritten: (path: string) => string | undefined;
  /** Whether a path exists in the store. */
  readonly has: (path: string) => boolean;
};

function memoryFs(): MemoryFs {
  const store = new Map<string, string>();
  return {
    seed: (path, content) => store.set(path, content),
    lastWritten: (path) => store.get(path),
    has: (path) => store.has(path),
    readFile: vi.fn((path: string) => {
      const content = store.get(path);
      if (content === undefined) throw new Error('ENOENT');
      return content;
    }),
    writeFile: vi.fn((path: string, content: string) => {
      store.set(path, content);
    }),
    deleteFile: vi.fn((path: string) => {
      if (!store.has(path)) {
        const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        throw err;
      }
      store.delete(path);
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

    const written = JSON.parse(fs.lastWritten('/project/.clancy/lock.json')!);
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
    fs.seed('/project/.clancy/lock.json', JSON.stringify(data));

    const result = readLock(fs, '/project');

    expect(result).toEqual(data);
  });

  it('returns undefined when file does not exist', () => {
    const fs = memoryFs();

    expect(readLock(fs, '/project')).toBeUndefined();
  });

  it('returns undefined for corrupt JSON', () => {
    const fs = memoryFs();
    fs.seed('/project/.clancy/lock.json', '{ bad json');

    expect(readLock(fs, '/project')).toBeUndefined();
  });

  it('returns undefined for JSON missing required fields', () => {
    const fs = memoryFs();
    fs.seed('/project/.clancy/lock.json', JSON.stringify({ pid: 123 }));

    expect(readLock(fs, '/project')).toBeUndefined();
  });

  it('returns undefined for empty startedAt', () => {
    const fs = memoryFs();
    const data = { ...makeLockData(), startedAt: '' };
    fs.seed('/project/.clancy/lock.json', JSON.stringify(data));

    expect(readLock(fs, '/project')).toBeUndefined();
  });

  it('preserves optional description field', () => {
    const fs = memoryFs();
    const data = makeLockData({ description: 'Some ticket context' });
    fs.seed('/project/.clancy/lock.json', JSON.stringify(data));

    const result = readLock(fs, '/project');

    expect(result?.description).toBe('Some ticket context');
  });

  it('strips unknown fields', () => {
    const fs = memoryFs();
    const data = { ...makeLockData(), extra: 'should-be-stripped' };
    fs.seed('/project/.clancy/lock.json', JSON.stringify(data));

    const result = readLock(fs, '/project');

    expect(result).toBeDefined();
    expect((result as Record<string, unknown>)['extra']).toBeUndefined();
  });
});

// ─── deleteLock ──────────────────────────────────────────────────────────────

describe('deleteLock', () => {
  it('removes the lock file', () => {
    const fs = memoryFs();
    fs.seed('/project/.clancy/lock.json', '{}');

    deleteLock(fs, '/project');

    expect(fs.has('/project/.clancy/lock.json')).toBe(false);
  });

  it('does not throw when file does not exist', () => {
    const fs = memoryFs();

    expect(() => deleteLock(fs, '/project')).not.toThrow();
  });

  it('rethrows non-ENOENT errors', () => {
    const fs = memoryFs();
    vi.mocked(fs.deleteFile).mockImplementation(() => {
      throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
    });

    expect(() => deleteLock(fs, '/project')).toThrow('EACCES');
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

  it('returns true when startedAt is an invalid timestamp', () => {
    const lock = makeLockData({ startedAt: 'not-a-date' });

    expect(isLockStale(lock)).toBe(true);
  });

  it('returns false when PID is alive and lock is recent', () => {
    const lock = makeLockData();

    expect(isLockStale(lock)).toBe(false);
  });

  it('returns false at exactly 24 hours (boundary — strictly greater)', () => {
    const now = Date.now();
    vi.useFakeTimers({ now });
    const exactly24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const lock = makeLockData({ startedAt: exactly24h });

    expect(isLockStale(lock)).toBe(false);
    vi.useRealTimers();
  });

  it('returns true at 24 hours + 1 second', () => {
    const justOver24h = new Date(
      Date.now() - (24 * 60 * 60 * 1000 + 1000),
    ).toISOString();
    const lock = makeLockData({ startedAt: justOver24h });

    expect(isLockStale(lock)).toBe(true);
  });
});

// ─── deleteVerifyAttempt ─────────────────────────────────────────────────────

describe('deleteVerifyAttempt', () => {
  it('deletes the verify-attempt.txt file', () => {
    const fs = memoryFs();
    fs.seed('/project/.clancy/verify-attempt.txt', '1');

    deleteVerifyAttempt(fs, '/project');

    expect(fs.has('/project/.clancy/verify-attempt.txt')).toBe(false);
  });

  it('does not throw when file does not exist', () => {
    const fs = memoryFs();

    expect(() => deleteVerifyAttempt(fs, '/project')).not.toThrow();
  });

  it('rethrows non-ENOENT errors', () => {
    const fs = memoryFs();
    vi.mocked(fs.deleteFile).mockImplementation(() => {
      throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
    });

    expect(() => deleteVerifyAttempt(fs, '/project')).toThrow('EACCES');
  });
});
