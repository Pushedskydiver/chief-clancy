import type { QualityFs } from './quality.js';

import { describe, expect, it, vi } from 'vitest';

import {
  getQualityData,
  readQualityData,
  recordDelivery,
  recordRework,
  recordVerificationRetry,
} from './quality.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type MemoryFs = QualityFs & {
  /** Seed a file into the in-memory store (test arrangement). */
  readonly seed: (path: string, content: string) => void;
  /** Read the last content written to a path, or `undefined`. */
  readonly lastWritten: (path: string) => string | undefined;
};

function memoryFs(): MemoryFs {
  const store = new Map<string, string>();
  return {
    seed: (path, content) => store.set(path, content),
    lastWritten: (path) => store.get(path),
    readFile: vi.fn((path: string) => {
      const content = store.get(path);
      if (content === undefined) throw new Error('ENOENT');
      return content;
    }),
    writeFile: vi.fn((path: string, content: string) => {
      store.set(path, content);
    }),
    rename: vi.fn((from: string, to: string) => {
      const content = store.get(from);
      if (content === undefined) throw new Error('ENOENT');
      store.delete(from);
      store.set(to, content);
    }),
    mkdir: vi.fn(),
  };
}

// ─── readQualityData ────────────────────────────────────────────────────────

describe('readQualityData', () => {
  it('returns empty data when file does not exist', () => {
    const fs = memoryFs();

    const result = readQualityData(fs, '/project');

    expect(result).toEqual({
      tickets: {},
      summary: {
        totalTickets: 0,
        avgReworkCycles: 0,
        avgVerificationRetries: 0,
        avgDuration: 0,
      },
    });
  });

  it('parses valid quality data', () => {
    const fs = memoryFs();
    const data = {
      tickets: {
        'PROJ-1': { reworkCycles: 2, verificationRetries: 1 },
      },
      summary: {
        totalTickets: 1,
        avgReworkCycles: 2,
        avgVerificationRetries: 1,
        avgDuration: 0,
      },
    };
    fs.seed('/project/.clancy/quality.json', JSON.stringify(data));

    const result = readQualityData(fs, '/project');

    expect(result.tickets['PROJ-1']).toEqual({
      reworkCycles: 2,
      verificationRetries: 1,
    });
  });

  it('returns empty data for corrupt JSON', () => {
    const fs = memoryFs();
    fs.seed('/project/.clancy/quality.json', '{ bad json');

    const result = readQualityData(fs, '/project');

    expect(result.tickets).toEqual({});
  });

  it('returns empty data when tickets is not an object', () => {
    const fs = memoryFs();
    fs.seed(
      '/project/.clancy/quality.json',
      JSON.stringify({ tickets: 'not-an-object' }),
    );

    const result = readQualityData(fs, '/project');

    expect(result.tickets).toEqual({});
  });

  it('returns empty data when tickets is an array', () => {
    const fs = memoryFs();
    fs.seed(
      '/project/.clancy/quality.json',
      JSON.stringify({ tickets: [1, 2] }),
    );

    const result = readQualityData(fs, '/project');

    expect(result.tickets).toEqual({});
  });

  it('recomputes summary from ticket data on read', () => {
    const fs = memoryFs();
    const data = {
      tickets: {
        'PROJ-1': {
          reworkCycles: 1,
          verificationRetries: 0,
          deliveredAt: '2026-01-01T00:00:00.000Z',
          duration: 60_000,
        },
      },
      summary: {
        totalTickets: 0,
        avgReworkCycles: 0,
        avgVerificationRetries: 0,
        avgDuration: 0,
      },
    };
    fs.seed('/project/.clancy/quality.json', JSON.stringify(data));

    const result = readQualityData(fs, '/project');

    expect(result.summary.avgDuration).toBe(60_000);
  });

  it('averages duration only across delivered tickets', () => {
    const fs = memoryFs();
    const data = {
      tickets: {
        'PROJ-1': { reworkCycles: 4, verificationRetries: 2 },
        'PROJ-2': { reworkCycles: 2, verificationRetries: 0 },
      },
      summary: {
        totalTickets: 999,
        avgReworkCycles: 999,
        avgVerificationRetries: 999,
        avgDuration: 999,
      },
    };
    fs.seed('/project/.clancy/quality.json', JSON.stringify(data));

    const result = readQualityData(fs, '/project');

    expect(result.summary).toEqual({
      totalTickets: 2,
      avgReworkCycles: 3,
      avgVerificationRetries: 1,
      avgDuration: 0,
    });
  });
});

// ─── recordRework ───────────────────────────────────────────────────────────

describe('recordRework', () => {
  it('creates a new entry and increments rework to 1', () => {
    const fs = memoryFs();

    recordRework(fs, '/project', 'PROJ-1');

    const written = JSON.parse(
      fs.lastWritten('/project/.clancy/quality.json')!,
    );
    expect(written.tickets['PROJ-1'].reworkCycles).toBe(1);
  });

  it('increments existing rework counter', () => {
    const fs = memoryFs();
    const data = {
      tickets: {
        'PROJ-1': { reworkCycles: 2, verificationRetries: 0 },
      },
      summary: {
        totalTickets: 1,
        avgReworkCycles: 2,
        avgVerificationRetries: 0,
        avgDuration: 0,
      },
    };
    fs.seed('/project/.clancy/quality.json', JSON.stringify(data));

    recordRework(fs, '/project', 'PROJ-1');

    const written = JSON.parse(
      fs.lastWritten('/project/.clancy/quality.json')!,
    );
    expect(written.tickets['PROJ-1'].reworkCycles).toBe(3);
  });

  it('preserves other tickets when recording rework', () => {
    const fs = memoryFs();
    const data = {
      tickets: {
        'PROJ-1': { reworkCycles: 1, verificationRetries: 0 },
        'PROJ-2': { reworkCycles: 0, verificationRetries: 3 },
      },
      summary: {
        totalTickets: 2,
        avgReworkCycles: 0.5,
        avgVerificationRetries: 1.5,
        avgDuration: 0,
      },
    };
    fs.seed('/project/.clancy/quality.json', JSON.stringify(data));

    recordRework(fs, '/project', 'PROJ-1');

    const written = JSON.parse(
      fs.lastWritten('/project/.clancy/quality.json')!,
    );
    expect(written.tickets['PROJ-2']).toEqual({
      reworkCycles: 0,
      verificationRetries: 3,
    });
  });

  it('uses atomic write via temp file and rename', () => {
    const fs = memoryFs();

    recordRework(fs, '/project', 'PROJ-1');

    expect(fs.writeFile).toHaveBeenCalledWith(
      '/project/.clancy/quality.json.tmp',
      expect.any(String),
    );
    expect(fs.rename).toHaveBeenCalledWith(
      '/project/.clancy/quality.json.tmp',
      '/project/.clancy/quality.json',
    );
  });

  it('creates .clancy directory before writing', () => {
    const fs = memoryFs();

    recordRework(fs, '/project', 'PROJ-1');

    expect(fs.mkdir).toHaveBeenCalledWith('/project/.clancy');
  });

  it('recomputes summary after recording rework', () => {
    const fs = memoryFs();

    recordRework(fs, '/project', 'PROJ-1');
    recordRework(fs, '/project', 'PROJ-2');

    const written = JSON.parse(
      fs.lastWritten('/project/.clancy/quality.json')!,
    );
    expect(written.summary.totalTickets).toBe(2);
    expect(written.summary.avgReworkCycles).toBe(1);
  });

  it('does not throw when filesystem errors occur', () => {
    const fs = memoryFs();
    // Make readFile always throw (simulate permission error)
    vi.mocked(fs.readFile).mockImplementation(() => {
      throw new Error('EACCES');
    });
    // Make writeFile also throw
    vi.mocked(fs.writeFile).mockImplementation(() => {
      throw new Error('EACCES');
    });

    expect(() => recordRework(fs, '/project', 'PROJ-1')).not.toThrow();
  });
});

// ─── recordVerificationRetry ────────────────────────────────────────────────

describe('recordVerificationRetry', () => {
  it('creates a new entry and sets retry count', () => {
    const fs = memoryFs();

    recordVerificationRetry(fs, '/project', {
      ticketKey: 'PROJ-1',
      retries: 3,
    });

    const written = JSON.parse(
      fs.lastWritten('/project/.clancy/quality.json')!,
    );
    expect(written.tickets['PROJ-1'].verificationRetries).toBe(3);
  });

  it('overwrites existing retry count', () => {
    const fs = memoryFs();
    const data = {
      tickets: {
        'PROJ-1': { reworkCycles: 1, verificationRetries: 2 },
      },
      summary: {
        totalTickets: 1,
        avgReworkCycles: 1,
        avgVerificationRetries: 2,
        avgDuration: 0,
      },
    };
    fs.seed('/project/.clancy/quality.json', JSON.stringify(data));

    recordVerificationRetry(fs, '/project', {
      ticketKey: 'PROJ-1',
      retries: 5,
    });

    const written = JSON.parse(
      fs.lastWritten('/project/.clancy/quality.json')!,
    );
    expect(written.tickets['PROJ-1'].verificationRetries).toBe(5);
  });

  it('preserves rework cycles when setting retries', () => {
    const fs = memoryFs();
    const data = {
      tickets: {
        'PROJ-1': { reworkCycles: 3, verificationRetries: 0 },
      },
      summary: {
        totalTickets: 1,
        avgReworkCycles: 3,
        avgVerificationRetries: 0,
        avgDuration: 0,
      },
    };
    fs.seed('/project/.clancy/quality.json', JSON.stringify(data));

    recordVerificationRetry(fs, '/project', {
      ticketKey: 'PROJ-1',
      retries: 2,
    });

    const written = JSON.parse(
      fs.lastWritten('/project/.clancy/quality.json')!,
    );
    expect(written.tickets['PROJ-1'].reworkCycles).toBe(3);
  });

  it('does not throw when filesystem errors occur', () => {
    const fs = memoryFs();
    vi.mocked(fs.readFile).mockImplementation(() => {
      throw new Error('EACCES');
    });
    vi.mocked(fs.writeFile).mockImplementation(() => {
      throw new Error('EACCES');
    });

    expect(() =>
      recordVerificationRetry(fs, '/project', {
        ticketKey: 'PROJ-1',
        retries: 1,
      }),
    ).not.toThrow();
  });
});

// ─── recordDelivery ─────────────────────────────────────────────────────────

describe('recordDelivery', () => {
  it('creates a new entry with delivery timestamp and duration', () => {
    const fs = memoryFs();
    const now = Date.parse('2026-03-25T12:00:00.000Z');

    recordDelivery(fs, '/project', {
      ticketKey: 'PROJ-1',
      duration: 300_000,
      now,
    });

    const written = JSON.parse(
      fs.lastWritten('/project/.clancy/quality.json')!,
    );
    expect(written.tickets['PROJ-1'].deliveredAt).toBe(
      '2026-03-25T12:00:00.000Z',
    );
    expect(written.tickets['PROJ-1'].duration).toBe(300_000);
  });

  it('preserves existing rework and retry data', () => {
    const fs = memoryFs();
    const data = {
      tickets: {
        'PROJ-1': { reworkCycles: 2, verificationRetries: 3 },
      },
      summary: {
        totalTickets: 1,
        avgReworkCycles: 2,
        avgVerificationRetries: 3,
        avgDuration: 0,
      },
    };
    fs.seed('/project/.clancy/quality.json', JSON.stringify(data));

    recordDelivery(fs, '/project', {
      ticketKey: 'PROJ-1',
      duration: 120_000,
      now: Date.now(),
    });

    const written = JSON.parse(
      fs.lastWritten('/project/.clancy/quality.json')!,
    );
    expect(written.tickets['PROJ-1'].reworkCycles).toBe(2);
    expect(written.tickets['PROJ-1'].verificationRetries).toBe(3);
    expect(written.tickets['PROJ-1'].duration).toBe(120_000);
  });

  it('uses injected now for the deliveredAt timestamp', () => {
    const fs = memoryFs();
    const fixedNow = Date.parse('2026-06-15T08:30:00.000Z');

    recordDelivery(fs, '/project', {
      ticketKey: 'PROJ-1',
      duration: 60_000,
      now: fixedNow,
    });

    const written = JSON.parse(
      fs.lastWritten('/project/.clancy/quality.json')!,
    );
    expect(written.tickets['PROJ-1'].deliveredAt).toBe(
      '2026-06-15T08:30:00.000Z',
    );
  });

  it('updates summary avgDuration after delivery', () => {
    const fs = memoryFs();
    const data = {
      tickets: {
        'PROJ-1': {
          reworkCycles: 0,
          verificationRetries: 0,
          deliveredAt: '2026-01-01T00:00:00.000Z',
          duration: 100_000,
        },
      },
      summary: {
        totalTickets: 1,
        avgReworkCycles: 0,
        avgVerificationRetries: 0,
        avgDuration: 100_000,
      },
    };
    fs.seed('/project/.clancy/quality.json', JSON.stringify(data));

    recordDelivery(fs, '/project', {
      ticketKey: 'PROJ-2',
      duration: 200_000,
      now: Date.now(),
    });

    const written = JSON.parse(
      fs.lastWritten('/project/.clancy/quality.json')!,
    );
    expect(written.summary.avgDuration).toBe(150_000);
  });

  it('does not throw when filesystem errors occur', () => {
    const fs = memoryFs();
    vi.mocked(fs.readFile).mockImplementation(() => {
      throw new Error('EACCES');
    });
    vi.mocked(fs.writeFile).mockImplementation(() => {
      throw new Error('EACCES');
    });

    expect(() =>
      recordDelivery(fs, '/project', {
        ticketKey: 'PROJ-1',
        duration: 60_000,
        now: Date.now(),
      }),
    ).not.toThrow();
  });
});

// ─── getQualityData ─────────────────────────────────────────────────────────

describe('getQualityData', () => {
  it('returns undefined when no tickets exist', () => {
    const fs = memoryFs();

    expect(getQualityData(fs, '/project')).toBeUndefined();
  });

  it('returns undefined when file does not exist', () => {
    const fs = memoryFs();

    expect(getQualityData(fs, '/project')).toBeUndefined();
  });

  it('returns quality data when tickets exist', () => {
    const fs = memoryFs();
    const data = {
      tickets: {
        'PROJ-1': { reworkCycles: 1, verificationRetries: 0 },
      },
      summary: {
        totalTickets: 1,
        avgReworkCycles: 1,
        avgVerificationRetries: 0,
        avgDuration: 0,
      },
    };
    fs.seed('/project/.clancy/quality.json', JSON.stringify(data));

    const result = getQualityData(fs, '/project');

    expect(result).toBeDefined();
    expect(result!.tickets['PROJ-1'].reworkCycles).toBe(1);
  });

  it('returns recomputed summary', () => {
    const fs = memoryFs();
    const data = {
      tickets: {
        'PROJ-1': { reworkCycles: 4, verificationRetries: 2 },
      },
      summary: {
        totalTickets: 999,
        avgReworkCycles: 999,
        avgVerificationRetries: 999,
        avgDuration: 999,
      },
    };
    fs.seed('/project/.clancy/quality.json', JSON.stringify(data));

    const result = getQualityData(fs, '/project');

    expect(result!.summary.totalTickets).toBe(1);
    expect(result!.summary.avgReworkCycles).toBe(4);
  });
});
