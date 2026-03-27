import type { ProgressFs } from './progress.js';

import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';

import {
  appendProgress,
  countReworkCycles,
  findEntriesWithStatus,
  findLastEntry,
  formatTimestamp,
  parseProgressFile,
} from './progress.js';

// ─── formatTimestamp ──────────────────────────────────────────────────

describe('formatTimestamp', () => {
  it('formats a date as YYYY-MM-DD HH:MM in UTC', () => {
    expect(formatTimestamp(new Date('2024-01-15T14:05:00Z'))).toBe(
      '2024-01-15 14:05',
    );
  });

  it('pads single-digit months, days, hours, and minutes', () => {
    expect(formatTimestamp(new Date('2024-03-03T09:07:00Z'))).toBe(
      '2024-03-03 09:07',
    );
  });

  it('handles midnight', () => {
    expect(formatTimestamp(new Date('2024-12-31T00:00:00Z'))).toBe(
      '2024-12-31 00:00',
    );
  });
});

// ─── appendProgress ───────────────────────────────────────────────────

function mockFs(): ProgressFs & {
  readonly written: readonly string[];
} {
  const written: string[] = [];

  return {
    written,
    readFile: vi.fn().mockReturnValue(''),
    appendFile: vi.fn((_path: string, content: string) => {
      written.push(content);
    }),
    mkdir: vi.fn(),
  };
}

describe('appendProgress', () => {
  it('appends a standard entry', () => {
    const fs = mockFs();

    appendProgress(fs, '/root', {
      key: 'PROJ-123',
      summary: 'Add login page',
      status: 'DONE',
    });

    expect(fs.mkdir).toHaveBeenCalledWith('/root/.clancy');
    expect(fs.written[0]).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} \| PROJ-123 \| Add login page \| DONE\n$/,
    );
  });

  it('includes pr:NNN suffix when prNumber is provided', () => {
    const fs = mockFs();

    appendProgress(fs, '/root', {
      key: 'PROJ-10',
      summary: 'Add feature',
      status: 'PR_CREATED',
      prNumber: 42,
    });

    expect(fs.written[0]).toContain('PR_CREATED | pr:42');
  });

  it('includes parent:KEY suffix when parent is provided', () => {
    const fs = mockFs();

    appendProgress(fs, '/root', {
      key: 'PROJ-101',
      summary: 'Add login',
      status: 'PR_CREATED',
      prNumber: 42,
      parent: 'PROJ-100',
    });

    expect(fs.written[0]).toContain('pr:42 | parent:PROJ-100');
  });

  it('includes parent without prNumber', () => {
    const fs = mockFs();

    appendProgress(fs, '/root', {
      key: 'PROJ-101',
      summary: 'Add login',
      status: 'DONE',
      parent: 'PROJ-100',
    });

    expect(fs.written[0]).toContain('DONE | parent:PROJ-100');
    expect(fs.written[0]).not.toContain('pr:');
  });

  it('writes BRIEF entry in slug-based format', () => {
    const fs = mockFs();

    appendProgress(fs, '/root', {
      key: 'add-dark-mode',
      summary: '4 proposed tickets',
      status: 'BRIEF',
    });

    expect(fs.written[0]).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} \| BRIEF \| add-dark-mode \| 4 proposed tickets\n$/,
    );
  });

  it('writes APPROVE_BRIEF entry in slug-based format', () => {
    const fs = mockFs();

    appendProgress(fs, '/root', {
      key: 'add-dark-mode',
      summary: '4 tickets created',
      status: 'APPROVE_BRIEF',
    });

    expect(fs.written[0]).toContain('APPROVE_BRIEF | add-dark-mode');
  });

  it('writes ticketType suffix when provided', () => {
    const fs = mockFs();

    appendProgress(fs, '/root', {
      key: 'PROJ-1',
      summary: 'Fix login',
      status: 'PR_CREATED',
      prNumber: 42,
      ticketType: 'Bug',
    });

    expect(fs.written[0]).toContain('type:Bug');
  });

  it('omits ticketType suffix when not provided', () => {
    const fs = mockFs();

    appendProgress(fs, '/root', {
      key: 'PROJ-1',
      summary: 'Fix login',
      status: 'PR_CREATED',
    });

    expect(fs.written[0]).not.toContain('type:');
  });
});

// ─── parseProgressFile ────────────────────────────────────────────────

function readerFs(content: string): ProgressFs {
  return {
    readFile: vi.fn().mockReturnValue(content),
    appendFile: vi.fn(),
    mkdir: vi.fn(),
  };
}

function throwingFs(): ProgressFs {
  return {
    readFile: vi.fn().mockImplementation(() => {
      throw new Error('ENOENT');
    }),
    appendFile: vi.fn(),
    mkdir: vi.fn(),
  };
}

describe('parseProgressFile', () => {
  it('parses a standard entry', () => {
    const fs = readerFs(
      '2024-01-15 14:30 | PROJ-123 | Add login page | DONE\n',
    );

    const entries = parseProgressFile(fs, '/root');
    expect(entries).toEqual([
      {
        timestamp: '2024-01-15 14:30',
        key: 'PROJ-123',
        summary: 'Add login page',
        status: 'DONE',
      },
    ]);
  });

  it('parses entry with pr:NNN', () => {
    const fs = readerFs(
      '2024-01-15 14:30 | PROJ-5 | Add login | PR_CREATED | pr:99\n',
    );

    const entries = parseProgressFile(fs, '/root');
    expect(entries[0]?.prNumber).toBe(99);
    expect(entries[0]?.summary).toBe('Add login');
  });

  it('parses entry with parent:KEY', () => {
    const fs = readerFs(
      '2024-01-15 14:30 | PROJ-101 | Add login | PR_CREATED | pr:42 | parent:PROJ-100\n',
    );

    const entries = parseProgressFile(fs, '/root');
    expect(entries[0]?.prNumber).toBe(42);
    expect(entries[0]?.parent).toBe('PROJ-100');
  });

  it('parses entry with type:VALUE', () => {
    const fs = readerFs(
      '2024-01-15 14:30 | PROJ-1 | Fix login | PR_CREATED | pr:42 | type:Bug\n',
    );

    const entries = parseProgressFile(fs, '/root');
    expect(entries[0]?.ticketType).toBe('Bug');
    expect(entries[0]?.prNumber).toBe(42);
  });

  it('parses entry with all optional fields', () => {
    const fs = readerFs(
      '2024-01-15 14:30 | PROJ-1 | Fix login | PR_CREATED | pr:42 | parent:PROJ-100 | type:Bug\n',
    );

    const entries = parseProgressFile(fs, '/root');
    expect(entries[0]?.prNumber).toBe(42);
    expect(entries[0]?.parent).toBe('PROJ-100');
    expect(entries[0]?.ticketType).toBe('Bug');
  });

  it('parses BRIEF entry in slug format', () => {
    const fs = readerFs(
      '2024-01-15 14:30 | BRIEF | add-customer-portal | 6 proposed tickets\n',
    );

    const entries = parseProgressFile(fs, '/root');
    expect(entries).toEqual([
      {
        timestamp: '2024-01-15 14:30',
        key: 'add-customer-portal',
        summary: '6 proposed tickets',
        status: 'BRIEF',
      },
    ]);
  });

  it('parses APPROVE_BRIEF entry', () => {
    const fs = readerFs(
      '2024-01-15 14:30 | APPROVE_BRIEF | add-dark-mode | 4 tickets created\n',
    );

    const entries = parseProgressFile(fs, '/root');
    expect(entries[0]?.status).toBe('APPROVE_BRIEF');
    expect(entries[0]?.key).toBe('add-dark-mode');
  });

  it('returns empty array when file does not exist', () => {
    const fs = throwingFs();

    expect(parseProgressFile(fs, '/root')).toEqual([]);
  });

  it('skips blank lines', () => {
    const fs = readerFs('\n2024-01-15 14:30 | PROJ-1 | Task | DONE\n\n');

    expect(parseProgressFile(fs, '/root')).toHaveLength(1);
  });

  it('skips malformed lines with too few parts', () => {
    const fs = readerFs('bad line\nonly | two parts\n');

    expect(parseProgressFile(fs, '/root')).toEqual([]);
  });

  it('rewrites legacy APPROVE status to APPROVE_PLAN', () => {
    const fs = readerFs('2024-01-15 14:30 | PROJ-1 | Task | APPROVE\n');

    const entries = parseProgressFile(fs, '/root');
    expect(entries[0]?.status).toBe('APPROVE_PLAN');
  });

  it('parses mixed standard and slug entries', () => {
    const fs = readerFs(
      '2024-01-15 14:30 | BRIEF | add-dark-mode | 4 proposed tickets\n' +
        '2024-01-15 14:35 | PROJ-123 | Add login page | DONE\n',
    );

    const entries = parseProgressFile(fs, '/root');
    expect(entries).toHaveLength(2);
    expect(entries[0]?.status).toBe('BRIEF');
    expect(entries[1]?.status).toBe('DONE');
  });

  it('does not misidentify ALL_CAPS summary words as status', () => {
    const fs = readerFs('2024-01-15 14:30 | PROJ-1 | Set up CI | DONE\n');

    const entries = parseProgressFile(fs, '/root');
    expect(entries[0]?.status).toBe('DONE');
    expect(entries[0]?.summary).toBe('Set up CI');
  });

  it('skips entries with no valid status segment', () => {
    const fs = readerFs(
      '2024-01-15 14:30 | PROJ-1 | Set up CI | CD pipeline\n',
    );

    expect(parseProgressFile(fs, '/root')).toEqual([]);
  });

  it('handles \\r\\n line endings', () => {
    const fs = readerFs(
      '2024-01-15 14:30 | PROJ-1 | Add login | DONE\r\n' +
        '2024-01-15 14:35 | PROJ-2 | Fix bug | PR_CREATED\r\n',
    );

    const entries = parseProgressFile(fs, '/root');
    expect(entries).toHaveLength(2);
    expect(entries[0]?.status).toBe('DONE');
    expect(entries[1]?.status).toBe('PR_CREATED');
  });
});

// ─── findLastEntry ────────────────────────────────────────────────────

describe('findLastEntry', () => {
  it('returns the last entry for a key', () => {
    const fs = readerFs(
      '2024-01-15 14:30 | PROJ-1 | First attempt | DONE\n' +
        '2024-01-15 14:35 | PROJ-2 | Other | DONE\n' +
        '2024-01-15 14:40 | PROJ-1 | Second attempt | REWORK\n',
    );

    const entry = findLastEntry(fs, '/root', 'PROJ-1');
    expect(entry?.summary).toBe('Second attempt');
    expect(entry?.status).toBe('REWORK');
  });

  it('matches keys case-insensitively', () => {
    const fs = readerFs('2024-01-15 14:30 | PROJ-1 | Some task | DONE\n');

    expect(findLastEntry(fs, '/root', 'proj-1')?.key).toBe('PROJ-1');
  });

  it('returns undefined when key not found', () => {
    const fs = readerFs('2024-01-15 14:30 | PROJ-1 | Task | DONE\n');

    expect(findLastEntry(fs, '/root', 'PROJ-999')).toBeUndefined();
  });

  it('returns undefined when file does not exist', () => {
    expect(findLastEntry(throwingFs(), '/root', 'PROJ-1')).toBeUndefined();
  });
});

// ─── countReworkCycles ────────────────────────────────────────────────

describe('countReworkCycles', () => {
  it('returns 0 when no REWORK entries exist', () => {
    const fs = readerFs('2024-01-15 14:30 | PROJ-1 | Task | DONE\n');

    expect(countReworkCycles(fs, '/root', 'PROJ-1')).toBe(0);
  });

  it('counts REWORK entries for a specific key', () => {
    const fs = readerFs(
      '2024-01-15 14:30 | PROJ-1 | Attempt 1 | DONE\n' +
        '2024-01-15 14:35 | PROJ-1 | Rework 1 | REWORK\n' +
        '2024-01-15 14:40 | PROJ-2 | Other rework | REWORK\n' +
        '2024-01-15 14:45 | PROJ-1 | Rework 2 | REWORK\n',
    );

    expect(countReworkCycles(fs, '/root', 'PROJ-1')).toBe(2);
  });

  it('matches keys case-insensitively', () => {
    const fs = readerFs('2024-01-15 14:30 | PROJ-1 | Rework | REWORK\n');

    expect(countReworkCycles(fs, '/root', 'proj-1')).toBe(1);
  });

  it('returns 0 when file does not exist', () => {
    expect(countReworkCycles(throwingFs(), '/root', 'PROJ-1')).toBe(0);
  });
});

// ─── findEntriesWithStatus ────────────────────────────────────────────

describe('findEntriesWithStatus', () => {
  it('returns entries with matching status', () => {
    const fs = readerFs(
      '2024-01-15 14:30 | PROJ-1 | Add login | PR_CREATED\n' +
        '2024-01-15 14:35 | PROJ-2 | Fix bug | PR_CREATED\n' +
        '2024-01-15 14:40 | PROJ-3 | Refactor | DONE\n',
    );

    const result = findEntriesWithStatus(fs, '/root', 'PR_CREATED');
    expect(result).toHaveLength(2);

    const keys = result.map((e) => e.key);
    expect(keys).toContain('PROJ-1');
    expect(keys).toContain('PROJ-2');
  });

  it('uses only the latest entry per key', () => {
    const fs = readerFs(
      '2024-01-15 14:30 | PROJ-1 | Add login | PR_CREATED\n' +
        '2024-01-15 14:35 | PROJ-1 | Add login | REWORK\n',
    );

    expect(findEntriesWithStatus(fs, '/root', 'PR_CREATED')).toHaveLength(0);
  });

  it('returns empty array when file does not exist', () => {
    expect(findEntriesWithStatus(throwingFs(), '/root', 'PR_CREATED')).toEqual(
      [],
    );
  });

  it('includes parent field in results', () => {
    const fs = readerFs(
      '2024-01-15 14:30 | PROJ-101 | Add login | PR_CREATED | pr:42 | parent:PROJ-100\n',
    );

    const result = findEntriesWithStatus(fs, '/root', 'PR_CREATED');
    expect(result[0]?.parent).toBe('PROJ-100');
    expect(result[0]?.prNumber).toBe(42);
  });

  it('returns BRIEF entries', () => {
    const fs = readerFs(
      '2024-01-15 14:30 | BRIEF | add-dark-mode | 4 proposed tickets\n' +
        '2024-01-15 14:35 | PROJ-1 | Task | DONE\n',
    );

    const result = findEntriesWithStatus(fs, '/root', 'BRIEF');
    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe('add-dark-mode');
  });
});

// ─── Property-based ───────────────────────────────────────────────────

describe('formatTimestamp property-based', () => {
  it('always produces YYYY-MM-DD HH:MM format', () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date('2000-01-01'),
          max: new Date('2099-12-31'),
          noInvalidDate: true,
        }),
        (date) => {
          const result = formatTimestamp(date);
          return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(result);
        },
      ),
    );
  });

  it('round-trips standard entries through append then parse', () => {
    const keyArb = fc.stringMatching(/^[A-Z]{2,6}-\d{1,5}$/);
    const summaryArb = fc.stringMatching(/^[A-Za-z0-9 ]{1,40}$/);

    fc.assert(
      fc.property(keyArb, summaryArb, (key, summary) => {
        const written: string[] = [];
        const fs: ProgressFs = {
          readFile: () => written.join(''),
          appendFile: (_p: string, content: string) => {
            written.push(content);
          },
          mkdir: () => undefined,
        };

        appendProgress(fs, '/root', { key, summary, status: 'DONE' });

        const entries = parseProgressFile(fs, '/root');
        return (
          entries.length === 1 &&
          entries[0]?.key === key &&
          entries[0]?.summary === summary &&
          entries[0]?.status === 'DONE'
        );
      }),
    );
  });
});
