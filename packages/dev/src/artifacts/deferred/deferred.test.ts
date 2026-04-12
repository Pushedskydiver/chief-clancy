import type { AtomicFs } from '../atomic-write/index.js';

import { describe, expect, it, vi } from 'vitest';

import { writeDeferred } from './deferred.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

type TestFs = AtomicFs & { readonly written: ReadonlyMap<string, string> };

function makeFs(): TestFs {
  const written = new Map<string, string>();
  return {
    written,
    mkdir: vi.fn(),
    writeFile: vi.fn((p: string, c: string) => {
      written.set(p, c);
    }),
    rename: vi.fn(),
    readdir: vi.fn(() => []),
    unlink: vi.fn(),
    stat: vi.fn(() => undefined),
  };
}

// ─── writeDeferred ────────────────────────────────────────────────────────

describe('writeDeferred', () => {
  it('writes deferred.json with ticket entries', () => {
    const fs = makeFs();

    writeDeferred({
      fs,
      dir: '/project/.clancy/dev',
      deferred: [
        {
          ticketId: 'PROJ-1',
          overall: 'yellow',
          reason: 'Needs clarification',
        },
        { ticketId: 'PROJ-2', overall: 'yellow', reason: 'Too broad' },
      ],
    });

    const json = fs.written.get('/project/.clancy/dev/deferred.json.tmp');
    expect(json).toBeDefined();
    const parsed = JSON.parse(json!);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].ticketId).toBe('PROJ-1');
    expect(parsed[1].reason).toBe('Too broad');
  });

  it('does not write when deferred array is empty', () => {
    const fs = makeFs();

    writeDeferred({ fs, dir: '/project/.clancy/dev', deferred: [] });

    expect(fs.written.size).toBe(0);
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('uses atomicWrite (write tmp then rename)', () => {
    const fs = makeFs();

    writeDeferred({
      fs,
      dir: '/project/.clancy/dev',
      deferred: [{ ticketId: 'T-1', overall: 'yellow', reason: 'Ambiguous' }],
    });

    expect(fs.mkdir).toHaveBeenCalledWith('/project/.clancy/dev');
    expect(fs.writeFile).toHaveBeenCalledWith(
      '/project/.clancy/dev/deferred.json.tmp',
      expect.any(String),
    );
    expect(fs.rename).toHaveBeenCalledWith(
      '/project/.clancy/dev/deferred.json.tmp',
      '/project/.clancy/dev/deferred.json',
    );
  });

  it('produces valid JSON with trailing newline', () => {
    const fs = makeFs();

    writeDeferred({
      fs,
      dir: '/project/.clancy/dev',
      deferred: [
        { ticketId: 'T-1', overall: 'yellow', reason: 'Unclear scope' },
      ],
    });

    const json = fs.written.get('/project/.clancy/dev/deferred.json.tmp');
    expect(json).toBeDefined();
    expect(json!.endsWith('\n')).toBe(true);
    expect(() => JSON.parse(json!)).not.toThrow();
  });
});
