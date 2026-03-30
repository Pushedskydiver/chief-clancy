import type { CostFs } from './cost.js';

import { describe, expect, it, vi } from 'vitest';

import { appendCostEntry } from './cost.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type MemoryFs = CostFs & {
  readonly appended: () => readonly string[];
};

function memoryFs(): MemoryFs {
  const lines: string[] = [];
  return {
    appended: () => lines,
    appendFile: vi.fn((_path: string, content: string) => {
      lines.push(content);
    }),
    mkdir: vi.fn(),
  };
}

const TEN_MINUTES_MS = 10 * 60_000;
const DEFAULT_TOKEN_RATE = 6600;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('appendCostEntry', () => {
  it('writes a line matching the expected format', () => {
    const fs = memoryFs();
    const fiveMinAgo = new Date(1000 - 5 * 60_000).toISOString();

    appendCostEntry(fs, '/project', {
      ticketKey: 'TICKET-42',
      startedAt: fiveMinAgo,
      now: 1000,
    });

    const line = fs.appended()[0];
    expect(line).toMatch(
      /^\d{4}-\d{2}-\d{2}T.+ \| TICKET-42 \| \d+min \| ~\d+ tokens \(estimated\)\n$/,
    );
  });

  it('calculates duration from startedAt to now', () => {
    const fs = memoryFs();
    const tenMinAgo = new Date(1000 - TEN_MINUTES_MS).toISOString();

    appendCostEntry(fs, '/project', {
      ticketKey: 'PROJ-1',
      startedAt: tenMinAgo,
      now: 1000,
    });

    expect(fs.appended()[0]).toContain('10min');
  });

  it('applies custom token rate', () => {
    const fs = memoryFs();
    const tenMinAgo = new Date(1000 - TEN_MINUTES_MS).toISOString();

    appendCostEntry(fs, '/project', {
      ticketKey: 'PROJ-2',
      startedAt: tenMinAgo,
      now: 1000,
      tokenRate: 1000,
    });

    expect(fs.appended()[0]).toContain('~10000 tokens (estimated)');
  });

  it('uses default token rate of 6600', () => {
    const fs = memoryFs();
    const tenMinAgo = new Date(1000 - TEN_MINUTES_MS).toISOString();

    appendCostEntry(fs, '/project', {
      ticketKey: 'PROJ-3',
      startedAt: tenMinAgo,
      now: 1000,
    });

    const expected = `~${10 * DEFAULT_TOKEN_RATE} tokens (estimated)`;
    expect(fs.appended()[0]).toContain(expected);
  });

  it('appends multiple entries without overwriting', () => {
    const fs = memoryFs();

    appendCostEntry(fs, '/project', {
      ticketKey: 'PROJ-A',
      startedAt: new Date(500).toISOString(),
      now: 1000,
    });
    appendCostEntry(fs, '/project', {
      ticketKey: 'PROJ-B',
      startedAt: new Date(1500).toISOString(),
      now: 2000,
    });

    expect(fs.appended()).toHaveLength(2);
    expect(fs.appended()[0]).toContain('PROJ-A');
    expect(fs.appended()[1]).toContain('PROJ-B');
  });

  it('produces 0min when startedAt is after now', () => {
    const fs = memoryFs();

    appendCostEntry(fs, '/project', {
      ticketKey: 'FUTURE-1',
      startedAt: new Date(5000).toISOString(),
      now: 1000,
    });

    expect(fs.appended()[0]).toContain('0min');
  });

  it('produces 0min duration for invalid startedAt', () => {
    const fs = memoryFs();

    appendCostEntry(fs, '/project', {
      ticketKey: 'BAD-1',
      startedAt: 'not-a-date',
      now: Date.now(),
    });

    expect(fs.appended()[0]).toContain('0min');
    expect(fs.appended()[0]).toContain('~0 tokens (estimated)');
  });

  it('creates .clancy directory before appending', () => {
    const fs = memoryFs();

    appendCostEntry(fs, '/project', {
      ticketKey: 'PROJ-NEW',
      startedAt: new Date().toISOString(),
      now: Date.now(),
    });

    expect(fs.mkdir).toHaveBeenCalledWith('/project/.clancy');
  });

  it('writes to .clancy/costs.log path', () => {
    const fs = memoryFs();

    appendCostEntry(fs, '/project', {
      ticketKey: 'PROJ-1',
      startedAt: new Date().toISOString(),
      now: Date.now(),
    });

    expect(fs.appendFile).toHaveBeenCalledWith(
      '/project/.clancy/costs.log',
      expect.any(String),
    );
  });

  it('propagates mkdir failure', () => {
    const fs = memoryFs();
    vi.mocked(fs.mkdir).mockImplementation(() => {
      throw new Error('EACCES');
    });

    expect(() =>
      appendCostEntry(fs, '/project', {
        ticketKey: 'PROJ-1',
        startedAt: new Date().toISOString(),
        now: Date.now(),
      }),
    ).toThrow('EACCES');
  });
});
