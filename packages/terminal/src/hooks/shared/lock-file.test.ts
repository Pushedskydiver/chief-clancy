import { describe, expect, it } from 'vitest';

import { readLockFile } from './lock-file.js';

const VALID_LOCK = JSON.stringify({
  pid: 1234,
  ticketKey: 'PROJ-42',
  ticketTitle: 'Add auth middleware',
  ticketBranch: 'feature/auth',
  targetBranch: 'main',
  parentKey: 'PROJ-10',
  startedAt: '2026-03-27T10:00:00Z',
  description: 'Implement OAuth flow',
});

describe('readLockFile', () => {
  it('returns parsed LockData when file is valid JSON', () => {
    const deps = { readFileSync: () => VALID_LOCK };

    const result = readLockFile('/project', deps);

    expect(result).toStrictEqual({
      pid: 1234,
      ticketKey: 'PROJ-42',
      ticketTitle: 'Add auth middleware',
      ticketBranch: 'feature/auth',
      targetBranch: 'main',
      parentKey: 'PROJ-10',
      startedAt: '2026-03-27T10:00:00Z',
      description: 'Implement OAuth flow',
    });
  });

  it('returns null when readFileSync throws (file missing)', () => {
    const deps = {
      readFileSync: () => {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      },
    };

    expect(readLockFile('/project', deps)).toBeNull();
  });

  it('returns null when the file contains invalid JSON', () => {
    const deps = { readFileSync: () => 'not json' };

    expect(readLockFile('/project', deps)).toBeNull();
  });

  it('returns null when the file contains a JSON array', () => {
    const deps = { readFileSync: () => '[1, 2, 3]' };

    expect(readLockFile('/project', deps)).toBeNull();
  });

  it('returns null when readFileSync throws a permission error', () => {
    const deps = {
      readFileSync: () => {
        throw new Error('EACCES');
      },
    };

    expect(readLockFile('/project', deps)).toBeNull();
  });
});
