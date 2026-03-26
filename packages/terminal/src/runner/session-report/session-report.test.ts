import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';

import {
  buildSessionReport,
  generateSessionReport,
  parseCostsLog,
  progressTimestampToMs,
} from './session-report.js';

// ─── parseCostsLog ───────────────────────────────────────────────────────────

describe('parseCostsLog', () => {
  it('parses cost entries after a given timestamp', () => {
    const now = Date.now();
    const recent = new Date(now + 1000).toISOString();
    const old = new Date(now - 60_000).toISOString();

    const content =
      `${old} | OLD-1 | 5min | ~33000 tokens (estimated)\n` +
      `${recent} | NEW-1 | 10min | ~66000 tokens (estimated)\n`;

    const entries = parseCostsLog(content, now);

    expect(entries).toHaveLength(1);
    expect(entries[0]!.key).toBe('NEW-1');
    expect(entries[0]!.duration).toBe('10min');
    expect(entries[0]!.tokens).toBe('~66000 tokens (estimated)');
  });

  it('returns empty array for empty content', () => {
    expect(parseCostsLog('', 0)).toEqual([]);
  });

  it('skips malformed lines', () => {
    const ts = new Date().toISOString();
    const content = `bad line\n${ts} | KEY-1 | 3min | ~19800 tokens (estimated)\n`;

    const entries = parseCostsLog(content, 0);

    expect(entries).toHaveLength(1);
    expect(entries[0]!.key).toBe('KEY-1');
  });

  it('skips lines with invalid timestamps', () => {
    const content = 'not-a-date | KEY-1 | 3min | ~19800 tokens (estimated)\n';

    expect(parseCostsLog(content, 0)).toEqual([]);
  });

  it('returns entries with non-empty key and tokens fields for any input', () => {
    fc.assert(
      fc.property(fc.string(), (content) => {
        const entries = parseCostsLog(content, 0);
        return entries.every(
          (e) => e.key.trim().length > 0 && e.tokens.trim().length > 0,
        );
      }),
    );
  });

  it('parses lines with \\r\\n line endings', () => {
    const ts = new Date().toISOString();
    const content = `${ts} | KEY-1 | 3min | ~19800 tokens (estimated)\r\n${ts} | KEY-2 | 5min | ~33000 tokens (estimated)\r\n`;

    const entries = parseCostsLog(content, 0);

    expect(entries).toHaveLength(2);
    expect(entries[0]!.key).toBe('KEY-1');
    expect(entries[1]!.key).toBe('KEY-2');
  });

  it('parses comma-formatted token counts correctly', () => {
    const ts = new Date().toISOString();
    const content = `${ts} | KEY-1 | 10min | ~1,200,000 tokens (estimated)\n`;

    const entries = parseCostsLog(content, 0);

    expect(entries).toHaveLength(1);
    expect(entries[0]!.tokens).toBe('~1,200,000 tokens (estimated)');
  });
});

// ─── progressTimestampToMs ───────────────────────────────────────────────────

describe('progressTimestampToMs', () => {
  it('converts a progress timestamp to milliseconds', () => {
    const ms = progressTimestampToMs('2026-03-19 14:30');

    expect(ms).toBe(new Date('2026-03-19T14:30:00Z').getTime());
  });

  it('returns NaN for invalid timestamp', () => {
    expect(progressTimestampToMs('not-a-date')).toBeNaN();
  });

  it('returns NaN for empty string', () => {
    expect(progressTimestampToMs('')).toBeNaN();
  });

  it('returns a valid number for any well-formed YYYY-MM-DD HH:MM string', () => {
    const datePartsArb = fc.record({
      y: fc.integer({ min: 2000, max: 2099 }),
      mo: fc.integer({ min: 1, max: 12 }),
      d: fc.integer({ min: 1, max: 28 }),
      h: fc.integer({ min: 0, max: 23 }),
      m: fc.integer({ min: 0, max: 59 }),
    });

    fc.assert(
      fc.property(datePartsArb, ({ y, mo, d, h, m }) => {
        const pad = (n: number) => String(n).padStart(2, '0');
        const ts = `${y}-${pad(mo)}-${pad(d)} ${pad(h)}:${pad(m)}`;
        return !Number.isNaN(progressTimestampToMs(ts));
      }),
    );
  });

  it('returns NaN for format-matching but invalid date components', () => {
    // Month 13, day 32, hour 25 — all match the format regex but are invalid
    expect(progressTimestampToMs('2026-13-01 00:00')).toBeNaN();
    expect(progressTimestampToMs('2026-01-32 00:00')).toBeNaN();
    expect(progressTimestampToMs('2026-01-01 25:00')).toBeNaN();
  });
});

// ─── generateSessionReport ───────────────────────────────────────────────────

describe('generateSessionReport', () => {
  it('generates report with completed tickets', () => {
    const report = generateSessionReport({
      entries: [
        {
          timestamp: '2026-03-19 14:30',
          key: 'PROJ-101',
          summary: 'Add login form',
          status: 'PR_CREATED',
          prNumber: 42,
        },
      ],
      costs: [
        {
          timestamp: '2026-03-19T14:35:00Z',
          key: 'PROJ-101',
          duration: '18min',
          tokens: '~120000 tokens (estimated)',
        },
      ],
      quality: undefined,
      loopStartTime: 0,
      loopEndTime: 30 * 60_000, // 30m
    });

    expect(report).toContain('# Autopilot Session Report');
    expect(report).toContain('Tickets completed: 1');
    expect(report).toContain('Tickets failed: 0');
    expect(report).toContain('✓ PROJ-101 — Add login form');
    expect(report).toContain('Duration: 18min');
    expect(report).toContain('Tokens: ~120000 tokens (estimated)');
    expect(report).toContain('PR: #42');
    expect(report).toContain('Status: PR_CREATED');
    expect(report).toContain('Review PRs #42');
  });

  it('generates report with mixed completed and failed tickets', () => {
    const report = generateSessionReport({
      entries: [
        {
          timestamp: '2026-03-19 14:30',
          key: 'PROJ-101',
          summary: 'Add login form',
          status: 'PR_CREATED',
          prNumber: 42,
        },
        {
          timestamp: '2026-03-19 14:35',
          key: 'PROJ-104',
          summary: 'OAuth2 integration',
          status: 'SKIPPED',
        },
      ],
      costs: [],
      quality: undefined,
      loopStartTime: 0,
      loopEndTime: 60 * 60_000,
    });

    expect(report).toContain('Tickets completed: 1');
    expect(report).toContain('Tickets failed: 1');
    expect(report).toContain('✓ PROJ-101');
    expect(report).toContain('✗ PROJ-104');
    expect(report).toContain('PROJ-104 needs manual intervention');
  });

  it('generates report with zero tickets', () => {
    const report = generateSessionReport({
      entries: [],
      costs: [],
      quality: undefined,
      loopStartTime: 0,
      loopEndTime: 5000,
    });

    expect(report).toContain('Tickets completed: 0');
    expect(report).toContain('Tickets failed: 0');
    expect(report).toContain('No tickets were processed in this session.');
  });

  it('includes total estimated tokens when available', () => {
    const report = generateSessionReport({
      entries: [
        {
          timestamp: '2026-03-19 14:30',
          key: 'PROJ-101',
          summary: 'Add login',
          status: 'PR_CREATED',
          prNumber: 10,
        },
        {
          timestamp: '2026-03-19 14:40',
          key: 'PROJ-102',
          summary: 'Add logout',
          status: 'DONE',
        },
      ],
      costs: [
        {
          timestamp: '2026-03-19T14:35:00Z',
          key: 'PROJ-101',
          duration: '10min',
          tokens: '~66000 tokens (estimated)',
        },
        {
          timestamp: '2026-03-19T14:45:00Z',
          key: 'PROJ-102',
          duration: '15min',
          tokens: '~99000 tokens (estimated)',
        },
      ],
      quality: undefined,
      loopStartTime: 0,
      loopEndTime: 30 * 60_000,
    });

    expect(report).toContain('Estimated token usage: 165,000');
  });

  it('includes total duration', () => {
    const report = generateSessionReport({
      entries: [],
      costs: [],
      quality: undefined,
      loopStartTime: 0,
      loopEndTime: 102 * 60_000, // 1h 42m
    });

    expect(report).toContain('Total duration: 1h 42m');
  });

  it('includes quality metrics when available', () => {
    const report = generateSessionReport({
      entries: [],
      costs: [],
      quality: {
        summary: {
          avgReworkCycles: 1.2,
          avgVerificationRetries: 0.4,
          avgDuration: 900_000,
        },
      },
      loopStartTime: 0,
      loopEndTime: 5000,
    });

    expect(report).toContain('## Quality Metrics');
    expect(report).toContain('Avg rework cycles: 1.2');
    expect(report).toContain('Avg verification retries: 0.4');
    expect(report).toContain('Avg delivery time: 15m');
  });

  it('omits quality section when no data', () => {
    const report = generateSessionReport({
      entries: [],
      costs: [],
      quality: undefined,
      loopStartTime: 0,
      loopEndTime: 5000,
    });

    expect(report).not.toContain('Quality Metrics');
  });

  it('deduplicates progress entries keeping latest per key', () => {
    const report = generateSessionReport({
      entries: [
        {
          timestamp: '2026-03-19 14:30',
          key: 'PROJ-101',
          summary: 'Add login',
          status: 'REWORK',
        },
        {
          timestamp: '2026-03-19 15:00',
          key: 'PROJ-101',
          summary: 'Add login',
          status: 'PR_CREATED',
          prNumber: 42,
        },
      ],
      costs: [],
      quality: undefined,
      loopStartTime: 0,
      loopEndTime: 60 * 60_000,
    });

    expect(report).toContain('Tickets completed: 1');
    expect(report).toContain('Tickets failed: 0');
    expect(report).toContain('PR: #42');
  });
});

// ─── buildSessionReport ──────────────────────────────────────────────────────

describe('buildSessionReport', () => {
  it('reads files, generates report, and writes to disk', () => {
    const progressFs = {
      readFile: vi.fn().mockReturnValue(''),
      appendFile: vi.fn(),
      mkdir: vi.fn(),
    };
    const qualityFs = {
      readFile: vi.fn().mockImplementation(() => {
        throw new Error('ENOENT');
      }),
      writeFile: vi.fn(),
      rename: vi.fn(),
      mkdir: vi.fn(),
    };
    const readCostsFile = vi.fn().mockReturnValue('');
    const writeFile = vi.fn();
    const mkdir = vi.fn();

    const report = buildSessionReport({
      progressFs,
      qualityFs,
      readCostsFile,
      writeFile,
      mkdir,
      console: { log: vi.fn(), error: vi.fn() },
      projectRoot: '/my/project',
      loopStartTime: 1000,
      loopEndTime: 61_000, // 1m
    });

    expect(report).toContain('# Autopilot Session Report');
    expect(report).toContain('Total duration: 1m');
    expect(mkdir).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledWith(
      '/my/project/.clancy/session-report.md',
      report,
    );
  });

  it('rethrows non-ENOENT error from readCostsFile', () => {
    const progressFs = {
      readFile: vi.fn().mockReturnValue(''),
      appendFile: vi.fn(),
      mkdir: vi.fn(),
    };
    const qualityFs = {
      readFile: vi.fn().mockImplementation(() => {
        throw new Error('ENOENT');
      }),
      writeFile: vi.fn(),
      rename: vi.fn(),
      mkdir: vi.fn(),
    };
    const eacces = Object.assign(new Error('EACCES'), { code: 'EACCES' });
    const readCostsFile = vi.fn().mockImplementation(() => {
      throw eacces;
    });

    expect(() =>
      buildSessionReport({
        progressFs,
        qualityFs,
        readCostsFile,
        writeFile: vi.fn(),
        mkdir: vi.fn(),
        console: { log: vi.fn(), error: vi.fn() },
        projectRoot: '/my/project',
        loopStartTime: 0,
        loopEndTime: 5000,
      }),
    ).toThrow('EACCES');
  });

  it('returns empty costs when readCostsFile throws ENOENT', () => {
    const progressFs = {
      readFile: vi.fn().mockReturnValue(''),
      appendFile: vi.fn(),
      mkdir: vi.fn(),
    };
    const qualityFs = {
      readFile: vi.fn().mockImplementation(() => {
        throw new Error('ENOENT');
      }),
      writeFile: vi.fn(),
      rename: vi.fn(),
      mkdir: vi.fn(),
    };
    const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    const readCostsFile = vi.fn().mockImplementation(() => {
      throw enoent;
    });

    const report = buildSessionReport({
      progressFs,
      qualityFs,
      readCostsFile,
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      console: { log: vi.fn(), error: vi.fn() },
      projectRoot: '/my/project',
      loopStartTime: 0,
      loopEndTime: 5000,
    });

    expect(report).toContain('# Autopilot Session Report');
  });

  it('warns and still returns report when write fails', () => {
    const progressFs = {
      readFile: vi.fn().mockReturnValue(''),
      appendFile: vi.fn(),
      mkdir: vi.fn(),
    };
    const qualityFs = {
      readFile: vi.fn().mockImplementation(() => {
        throw new Error('ENOENT');
      }),
      writeFile: vi.fn(),
      rename: vi.fn(),
      mkdir: vi.fn(),
    };
    const writeFile = vi.fn().mockImplementation(() => {
      throw new Error('EACCES');
    });
    const consoleMock = { log: vi.fn(), error: vi.fn() };

    const report = buildSessionReport({
      progressFs,
      qualityFs,
      readCostsFile: vi.fn().mockReturnValue(''),
      writeFile,
      mkdir: vi.fn(),
      console: consoleMock,
      projectRoot: '/my/project',
      loopStartTime: 0,
      loopEndTime: 5000,
    });

    expect(report).toContain('# Autopilot Session Report');
    expect(consoleMock.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to write session report'),
    );
  });

  it('warns and still returns report when mkdir fails', () => {
    const progressFs = {
      readFile: vi.fn().mockReturnValue(''),
      appendFile: vi.fn(),
      mkdir: vi.fn(),
    };
    const qualityFs = {
      readFile: vi.fn().mockImplementation(() => {
        throw new Error('ENOENT');
      }),
      writeFile: vi.fn(),
      rename: vi.fn(),
      mkdir: vi.fn(),
    };
    const mkdirFn = vi.fn().mockImplementation(() => {
      throw new Error('EACCES');
    });
    const consoleMock = { log: vi.fn(), error: vi.fn() };

    const report = buildSessionReport({
      progressFs,
      qualityFs,
      readCostsFile: vi.fn().mockReturnValue(''),
      writeFile: vi.fn(),
      mkdir: mkdirFn,
      console: consoleMock,
      projectRoot: '/my/project',
      loopStartTime: 0,
      loopEndTime: 5000,
    });

    expect(report).toContain('# Autopilot Session Report');
    expect(consoleMock.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to write session report'),
    );
  });

  it('filters progress entries to session window', () => {
    const loopStart = new Date('2026-03-19T14:00:00Z').getTime();
    const loopEnd = new Date('2026-03-19T15:00:00Z').getTime();

    const progressContent =
      '2026-03-19 13:00 | OLD-1 | Old ticket | DONE\n' +
      '2026-03-19 14:30 | NEW-1 | New ticket | PR_CREATED | pr:10\n';

    const progressFs = {
      readFile: vi.fn().mockReturnValue(progressContent),
      appendFile: vi.fn(),
      mkdir: vi.fn(),
    };
    const qualityFs = {
      readFile: vi.fn().mockImplementation(() => {
        throw new Error('ENOENT');
      }),
      writeFile: vi.fn(),
      rename: vi.fn(),
      mkdir: vi.fn(),
    };

    const report = buildSessionReport({
      progressFs,
      qualityFs,
      readCostsFile: vi.fn().mockReturnValue(''),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      console: { log: vi.fn(), error: vi.fn() },
      projectRoot: '/my/project',
      loopStartTime: loopStart,
      loopEndTime: loopEnd,
    });

    expect(report).toContain('NEW-1');
    expect(report).not.toContain('OLD-1');
  });
});
