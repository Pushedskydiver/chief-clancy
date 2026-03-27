import { describe, expect, it } from 'vitest';

import {
  buildUpdateCache,
  countStaleBriefs,
  fetchLatestVersion,
  findInstallDir,
  parseBriefDate,
  readInstalledVersion,
  resolveCachePaths,
  staleCountPath,
} from './check-update.js';

// ---------------------------------------------------------------------------
// findInstallDir
// ---------------------------------------------------------------------------

describe('findInstallDir', () => {
  it('returns local dir when local VERSION exists', () => {
    const deps = {
      existsSync: (p: string) => p.includes('/project/'),
      homedir: () => '/home/user',
    };

    const result = findInstallDir('/project', deps);

    expect(result).toContain('/project/');
    expect(result).toContain('.claude/commands/clancy');
  });

  it('returns global dir when local is missing', () => {
    const deps = {
      existsSync: (p: string) => p.includes('/home/user/'),
      homedir: () => '/home/user',
    };

    const result = findInstallDir('/project', deps);

    expect(result).toContain('/home/user/');
  });

  it('returns null when neither exists', () => {
    const deps = {
      existsSync: () => false,
      homedir: () => '/home/user',
    };

    expect(findInstallDir('/project', deps)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// readInstalledVersion
// ---------------------------------------------------------------------------

describe('readInstalledVersion', () => {
  it('returns trimmed version from file', () => {
    const deps = { readFileSync: () => '1.2.3\n' };

    expect(readInstalledVersion('/install', deps)).toBe('1.2.3');
  });

  it('returns 0.0.0 on read failure', () => {
    const deps = {
      readFileSync: () => {
        throw new Error('ENOENT');
      },
    };

    expect(readInstalledVersion('/install', deps)).toBe('0.0.0');
  });
});

// ---------------------------------------------------------------------------
// fetchLatestVersion
// ---------------------------------------------------------------------------

describe('fetchLatestVersion', () => {
  it('returns trimmed npm output', () => {
    const deps = { execFileSync: () => '2.0.0\n' };

    expect(fetchLatestVersion(deps)).toBe('2.0.0');
  });

  it('returns unknown on exec failure', () => {
    const deps = {
      execFileSync: () => {
        throw new Error('timeout');
      },
    };

    expect(fetchLatestVersion(deps)).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// buildUpdateCache
// ---------------------------------------------------------------------------

describe('buildUpdateCache', () => {
  it('marks update available when versions differ', () => {
    const cache = buildUpdateCache('1.0.0', '2.0.0', 1000);

    expect(cache.update_available).toBe(true);
    expect(cache.installed).toBe('1.0.0');
    expect(cache.latest).toBe('2.0.0');
    expect(cache.checked).toBe(1000);
  });

  it('marks no update when versions match', () => {
    const cache = buildUpdateCache('1.0.0', '1.0.0', 1000);

    expect(cache.update_available).toBe(false);
  });

  it('marks no update when latest is unknown', () => {
    const cache = buildUpdateCache('1.0.0', 'unknown', 1000);

    expect(cache.update_available).toBe(false);
  });

  it('marks no update when latest is empty', () => {
    const cache = buildUpdateCache('1.0.0', '', 1000);

    expect(cache.update_available).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseBriefDate
// ---------------------------------------------------------------------------

describe('parseBriefDate', () => {
  it('parses valid YYYY-MM-DD prefix', () => {
    const date = parseBriefDate('2025-01-15-my-brief.md');

    expect(date).not.toBeNull();
    expect(date?.getUTCFullYear()).toBe(2025);
    expect(date?.getUTCMonth()).toBe(0);
    expect(date?.getUTCDate()).toBe(15);
  });

  it('returns null for invalid date prefix', () => {
    expect(parseBriefDate('not-a-date-file.md')).toBeNull();
  });

  it('returns null for short filename', () => {
    expect(parseBriefDate('abc.md')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// countStaleBriefs
// ---------------------------------------------------------------------------

const EIGHT_DAYS_AGO = Date.now() - 8 * 86_400_000;
const TWO_DAYS_AGO = Date.now() - 2 * 86_400_000;

function dateStr(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

describe('countStaleBriefs', () => {
  it('returns null when briefs dir does not exist', () => {
    const deps = {
      existsSync: () => false,
      readdirSync: () => [],
    };

    expect(countStaleBriefs('/project', Date.now(), deps)).toBeNull();
  });

  it('counts stale unapproved briefs', () => {
    const staleFile = `${dateStr(EIGHT_DAYS_AGO)}-old-brief.md`;
    const deps = {
      existsSync: (p: string) => !p.endsWith('.approved'),
      readdirSync: () => [staleFile],
    };

    expect(countStaleBriefs('/project', Date.now(), deps)).toBe(1);
  });

  it('excludes approved briefs', () => {
    const staleFile = `${dateStr(EIGHT_DAYS_AGO)}-old-brief.md`;
    const deps = {
      existsSync: () => true,
      readdirSync: () => [staleFile],
    };

    expect(countStaleBriefs('/project', Date.now(), deps)).toBe(0);
  });

  it('excludes recent briefs', () => {
    const recentFile = `${dateStr(TWO_DAYS_AGO)}-new-brief.md`;
    const deps = {
      existsSync: (p: string) => !p.endsWith('.approved'),
      readdirSync: () => [recentFile],
    };

    expect(countStaleBriefs('/project', Date.now(), deps)).toBe(0);
  });

  it('excludes feedback files', () => {
    const feedbackFile = `${dateStr(EIGHT_DAYS_AGO)}-brief.feedback.md`;
    const deps = {
      existsSync: (p: string) => !p.endsWith('.approved'),
      readdirSync: () => [feedbackFile],
    };

    expect(countStaleBriefs('/project', Date.now(), deps)).toBe(0);
  });

  it('excludes non-md files', () => {
    const deps = {
      existsSync: (p: string) => !p.endsWith('.approved'),
      readdirSync: () => ['readme.txt', 'notes.json'],
    };

    expect(countStaleBriefs('/project', Date.now(), deps)).toBe(0);
  });

  it('returns null on readdir failure', () => {
    const deps = {
      existsSync: () => true,
      readdirSync: () => {
        throw new Error('EACCES');
      },
    };

    expect(countStaleBriefs('/project', Date.now(), deps)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveCachePaths
// ---------------------------------------------------------------------------

describe('resolveCachePaths', () => {
  it('returns dir and file under ~/.claude/cache', () => {
    const result = resolveCachePaths('/home/user');

    expect(result.dir).toContain('.claude/cache');
    expect(result.file).toContain('clancy-update-check.json');
  });
});

// ---------------------------------------------------------------------------
// staleCountPath
// ---------------------------------------------------------------------------

describe('staleCountPath', () => {
  it('returns path under .clancy/', () => {
    const result = staleCountPath('/project');

    expect(result).toContain('.clancy/.brief-stale-count');
  });
});
