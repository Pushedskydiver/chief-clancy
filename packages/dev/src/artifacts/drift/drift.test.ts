import type { ReadinessVerdict } from '../../agents/types/types.js';
import type { AtomicFs } from '../atomic-write/atomic-write.js';

import { describe, expect, it, vi } from 'vitest';

import { computeDrift, writeDrift, writeDriftIfPossible } from './drift.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeVerdict(
  ticketId: string,
  overall: 'green' | 'yellow' | 'red',
  checkOverrides?: Partial<{
    readonly touchBoundedReason: string;
    readonly touchBoundedEvidence: Record<string, unknown>;
  }>,
): ReadinessVerdict {
  return {
    ticketId,
    overall,
    checks: [
      { id: 'clear', verdict: overall, reason: `${overall} clear` },
      { id: 'testable', verdict: overall, reason: `${overall} testable` },
      { id: 'small', verdict: overall, reason: `${overall} small` },
      { id: 'locatable', verdict: overall, reason: `${overall} locatable` },
      {
        id: 'touch-bounded',
        verdict: overall,
        reason:
          checkOverrides?.touchBoundedReason ?? `${overall} touch-bounded`,
        evidence: checkOverrides?.touchBoundedEvidence,
      },
    ],
    gradedAt: '2026-04-12T10:00:00Z',
    rubricSha: 'abc123',
  };
}

type TestFs = AtomicFs & { readonly written: ReadonlyMap<string, string> };

function makeFs(): TestFs {
  const written = new Map<string, string>();
  return {
    written,
    mkdir: vi.fn(),
    writeFile: vi.fn((p: string, c: string) => {
      written.set(p, c);
    }),
    rename: vi.fn((from: string, to: string) => {
      const content = written.get(from);
      if (content !== undefined) {
        written.set(to, content);
        written.delete(from);
      }
    }),
    readdir: vi.fn(() => []),
    unlink: vi.fn(),
    stat: vi.fn(() => undefined),
  };
}

// ─── computeDrift ─────────────────────────────────────────────────────────

describe('computeDrift', () => {
  it('extracts expectedFiles from touch-bounded evidence', () => {
    const verdicts = [
      makeVerdict('T-1', 'green', {
        touchBoundedEvidence: {
          expectedFiles: ['src/foo.ts', 'src/bar.ts'],
        },
      }),
    ];

    const drift = computeDrift(verdicts, ['src/foo.ts', 'src/baz.ts']);

    expect(drift.predicted).toContain('src/foo.ts');
    expect(drift.predicted).toContain('src/bar.ts');
    expect(drift.actual).toEqual(['src/foo.ts', 'src/baz.ts']);
    expect(drift.unpredicted).toEqual(['src/baz.ts']);
    expect(drift.missed).toEqual(['src/bar.ts']);
  });

  it('extracts file paths from reason strings as fallback', () => {
    const verdicts = [
      makeVerdict('T-1', 'green', {
        touchBoundedReason:
          'Touches packages/dev/src/queue.ts and packages/dev/src/index.ts',
      }),
    ];

    const drift = computeDrift(verdicts, ['packages/dev/src/queue.ts']);

    expect(drift.predicted).toContain('packages/dev/src/queue.ts');
    expect(drift.predicted).toContain('packages/dev/src/index.ts');
    expect(drift.missed).toEqual(['packages/dev/src/index.ts']);
  });

  it('returns empty predicted when no paths extractable', () => {
    const verdicts = [
      makeVerdict('T-1', 'green', {
        touchBoundedReason: 'The ticket is well-scoped',
      }),
    ];

    const drift = computeDrift(verdicts, ['src/foo.ts']);

    expect(drift.predicted).toEqual([]);
    expect(drift.unpredicted).toEqual(['src/foo.ts']);
  });

  it('deduplicates predicted paths across multiple verdicts', () => {
    const verdicts = [
      makeVerdict('T-1', 'green', {
        touchBoundedEvidence: { expectedFiles: ['src/a.ts'] },
      }),
      makeVerdict('T-2', 'green', {
        touchBoundedEvidence: { expectedFiles: ['src/a.ts', 'src/b.ts'] },
      }),
    ];

    const drift = computeDrift(verdicts, ['src/a.ts']);

    expect(drift.predicted).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('handles empty verdicts and empty changed files', () => {
    const drift = computeDrift([], []);

    expect(drift.predicted).toEqual([]);
    expect(drift.actual).toEqual([]);
    expect(drift.unpredicted).toEqual([]);
    expect(drift.missed).toEqual([]);
  });
});

// ─── writeDrift ───────────────────────────────────────────────────────────

describe('writeDrift', () => {
  it('writes drift.json atomically', () => {
    const fs = makeFs();

    writeDrift({
      fs,
      dir: '/project/.clancy/dev',
      drift: {
        predicted: ['src/a.ts'],
        actual: ['src/a.ts', 'src/b.ts'],
        unpredicted: ['src/b.ts'],
        missed: [],
      },
    });

    const json = fs.written.get('/project/.clancy/dev/drift.json');
    expect(json).toBeDefined();
    const parsed = JSON.parse(json!);
    expect(parsed.unpredicted).toEqual(['src/b.ts']);
    expect(parsed.missed).toEqual([]);
  });
});

// ─── writeDriftIfPossible ─────────────────────────────────────────────────

describe('writeDriftIfPossible', () => {
  it('writes drift.json on success', () => {
    const fs = makeFs();

    writeDriftIfPossible({
      verdicts: [
        makeVerdict('T-1', 'green', {
          touchBoundedEvidence: { expectedFiles: ['src/a.ts'] },
        }),
      ],
      exec: () => 'src/a.ts\nsrc/b.ts\n',
      fs,
      dir: '/project/.clancy/dev',
      baseSha: 'abc123',
      console: { log: vi.fn() },
    });

    expect(fs.written.has('/project/.clancy/dev/drift.json')).toBe(true);
  });

  it('logs and skips when git diff fails', () => {
    const fs = makeFs();
    const log = vi.fn();

    writeDriftIfPossible({
      verdicts: [],
      exec: () => {
        throw new Error('git not found');
      },
      fs,
      dir: '/project/.clancy/dev',
      baseSha: 'abc123',
      console: { log },
    });

    expect(fs.written.size).toBe(0);
    expect(log).toHaveBeenCalledWith(
      'Drift detection skipped (git diff failed).',
    );
  });
});
