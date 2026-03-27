import { describe, expect, it } from 'vitest';

import {
  buildDriftWarning,
  readInstalledVersion,
  readPackageVersion,
  versionsDiffer,
} from './detect-drift.js';

// ---------------------------------------------------------------------------
// versionsDiffer
// ---------------------------------------------------------------------------

describe('versionsDiffer', () => {
  it('returns true when versions differ', () => {
    expect(versionsDiffer('0.1.0', '0.2.0')).toBe(true);
  });

  it('returns false when versions match', () => {
    expect(versionsDiffer('1.0.0', '1.0.0')).toBe(false);
  });

  it('returns false when versions match after trimming', () => {
    expect(versionsDiffer('1.0.0\n', '  1.0.0  ')).toBe(false);
  });

  it('returns false when first is empty', () => {
    expect(versionsDiffer('', '1.0.0')).toBe(false);
  });

  it('returns false when second is empty', () => {
    expect(versionsDiffer('1.0.0', '')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// readInstalledVersion
// ---------------------------------------------------------------------------

describe('readInstalledVersion', () => {
  it('returns version from version.json', () => {
    const deps = {
      readFileSync: () => JSON.stringify({ version: '0.3.0' }),
    };

    expect(readInstalledVersion('/project', deps)).toBe('0.3.0');
  });

  it('reads from the correct path', () => {
    const paths: string[] = [];
    const deps = {
      readFileSync: (path: string) => {
        paths[paths.length] = path;

        return JSON.stringify({ version: '1.0.0' });
      },
    };

    readInstalledVersion('/project', deps);

    expect(paths[0]).toContain('.clancy/version.json');
  });

  it('returns null when readFileSync throws', () => {
    const deps = {
      readFileSync: () => {
        throw new Error('ENOENT');
      },
    };

    expect(readInstalledVersion('/project', deps)).toBeNull();
  });

  it('returns null when version field is missing', () => {
    const deps = {
      readFileSync: () => JSON.stringify({ other: 'data' }),
    };

    expect(readInstalledVersion('/project', deps)).toBeNull();
  });

  it('returns null when JSON is an array', () => {
    const deps = {
      readFileSync: () => '[1, 2]',
    };

    expect(readInstalledVersion('/project', deps)).toBeNull();
  });

  it('returns null when JSON is a primitive', () => {
    const deps = {
      readFileSync: () => '"just a string"',
    };

    expect(readInstalledVersion('/project', deps)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// readPackageVersion
// ---------------------------------------------------------------------------

describe('readPackageVersion', () => {
  it('returns version from local path when it exists', () => {
    const deps = {
      readFileSync: (path: string) => {
        if (path.includes('.claude/commands')) return '0.4.0\n';
        throw new Error('ENOENT');
      },
    };

    expect(readPackageVersion('/project', '/home/user', deps)).toBe('0.4.0');
  });

  it('returns version from global path when local is missing', () => {
    const deps = {
      readFileSync: (path: string) => {
        if (path.startsWith('/project/')) throw new Error('ENOENT');

        return '0.5.0\n';
      },
    };

    expect(readPackageVersion('/project', '/home/user', deps)).toBe('0.5.0');
  });

  it('returns null when both paths fail', () => {
    const deps = {
      readFileSync: () => {
        throw new Error('ENOENT');
      },
    };

    expect(readPackageVersion('/project', '/home/user', deps)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildDriftWarning
// ---------------------------------------------------------------------------

describe('buildDriftWarning', () => {
  it('includes both version numbers', () => {
    const result = buildDriftWarning('0.1.0', '0.2.0');

    expect(result).toContain('0.1.0');
    expect(result).toContain('0.2.0');
    expect(result).toContain('DRIFT WARNING');
    expect(result).toContain('/clancy:update');
  });
});
