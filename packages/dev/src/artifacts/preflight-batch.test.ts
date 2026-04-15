/**
 * Tests for the pre-flight batch grader — grades all tickets in the
 * queue before execution, with full error matrix handling.
 */
import type { CheckColour, ReadinessVerdict } from '../agents/types.js';
import type { AtomicFs } from './atomic-write.js';
import type { BatchGradeOpts, GradeOneFn } from './preflight-batch.js';

import { describe, expect, it, vi } from 'vitest';

import { runPreflightBatch } from './preflight-batch.js';

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeVerdict(ticketId: string, overall: CheckColour): ReadinessVerdict {
  return {
    ticketId,
    overall,
    checks: [
      { id: 'clear', verdict: overall, reason: `${overall} clear` },
      { id: 'testable', verdict: overall, reason: `${overall} testable` },
      { id: 'small', verdict: overall, reason: `${overall} small` },
      { id: 'locatable', verdict: overall, reason: `${overall} locatable` },
      { id: 'touch-bounded', verdict: overall, reason: `${overall} bounded` },
    ],
    gradedAt: '2026-04-11T10:00:00Z',
    rubricSha: 'abc123',
  };
}

function makeFs(): AtomicFs & {
  readonly written: ReadonlyMap<string, string>;
} {
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

function makeGrader(
  results: ReadonlyMap<string, ReadinessVerdict>,
): GradeOneFn {
  return vi.fn((ticketId: string) => {
    const v = results.get(ticketId);
    return v
      ? { ok: true as const, verdict: v }
      : { ok: false as const, error: `Grading failed for ${ticketId}` };
  });
}

function makeOpts(overrides: Partial<BatchGradeOpts> = {}): BatchGradeOpts {
  return {
    ticketIds: [],
    grade: vi.fn(),
    fs: makeFs(),
    dir: '/project/.clancy/dev',
    maxBatch: 50,
    timestamp: () => '2026-04-11T10-00-00',
    console: { log: vi.fn(), error: vi.fn() },
    ...overrides,
  };
}

// ─── Happy path ────────────────────────────────────────────────────────────

describe('runPreflightBatch', () => {
  it('grades all tickets and returns verdicts', () => {
    const results = new Map([
      ['PROJ-1', makeVerdict('PROJ-1', 'green')],
      ['PROJ-2', makeVerdict('PROJ-2', 'yellow')],
    ]);

    const result = runPreflightBatch(
      makeOpts({
        ticketIds: ['PROJ-1', 'PROJ-2'],
        grade: makeGrader(results),
      }),
    );

    expect(result.verdicts).toHaveLength(2);
    expect(result.verdicts[0]?.ticketId).toBe('PROJ-1');
    expect(result.verdicts[1]?.ticketId).toBe('PROJ-2');
  });

  it('returns warnings array (empty when no issues)', () => {
    const result = runPreflightBatch(
      makeOpts({
        ticketIds: ['PROJ-1'],
        grade: makeGrader(
          new Map([['PROJ-1', makeVerdict('PROJ-1', 'green')]]),
        ),
      }),
    );

    expect(result.warnings).toEqual([]);
  });

  // ─── Empty queue ───────────────────────────────────────────────────────

  it('handles empty queue with zero verdicts', () => {
    const result = runPreflightBatch(makeOpts({ ticketIds: [] }));

    expect(result.verdicts).toHaveLength(0);
    expect(result.warnings).toEqual([]);
  });

  // ─── Batch cap (--max-batch) ───────────────────────────────────────────

  it('returns warning and no verdicts when maxBatch is 0', () => {
    const result = runPreflightBatch(
      makeOpts({
        ticketIds: ['PROJ-1'],
        maxBatch: 0,
      }),
    );

    expect(result.verdicts).toHaveLength(0);
    expect(result.warnings).toContainEqual(
      expect.stringContaining('maxBatch must be a positive integer'),
    );
  });

  it('truncates to maxBatch with a warning', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `PROJ-${i + 1}`);
    const results = new Map(ids.map((id) => [id, makeVerdict(id, 'green')]));

    const result = runPreflightBatch(
      makeOpts({
        ticketIds: ids,
        grade: makeGrader(results),
        maxBatch: 3,
      }),
    );

    expect(result.verdicts).toHaveLength(3);
    expect(result.warnings).toContainEqual(
      expect.stringContaining('truncated from 10 to 3'),
    );
  });

  // ─── Dedupe ────────────────────────────────────────────────────────────

  it('deduplicates ticket ids keeping first occurrence', () => {
    const results = new Map([
      ['PROJ-1', makeVerdict('PROJ-1', 'green')],
      ['PROJ-2', makeVerdict('PROJ-2', 'green')],
    ]);
    const grade = makeGrader(results);

    const result = runPreflightBatch(
      makeOpts({
        ticketIds: ['PROJ-1', 'PROJ-2', 'PROJ-1'],
        grade,
      }),
    );

    expect(result.verdicts).toHaveLength(2);
    expect(result.warnings).toContainEqual(
      expect.stringContaining('Duplicate ticket PROJ-1'),
    );
    // Grade should only be called twice (not three times)
    expect(grade).toHaveBeenCalledTimes(2);
  });

  // ─── Grading failure (timeout/529/network) ────────────────────────────

  it('counts grading failure as red with error reason', () => {
    const grade = vi.fn().mockReturnValue({
      ok: false,
      error: 'Claude spawn failed: timeout',
    });

    const result = runPreflightBatch(
      makeOpts({
        ticketIds: ['PROJ-1'],
        grade,
      }),
    );

    expect(result.verdicts).toHaveLength(1);
    expect(result.verdicts[0]?.overall).toBe('red');
    expect(result.verdicts[0]?.checks[0]?.reason).toContain('timeout');
  });

  // ─── Partial checkpoint ────────────────────────────────────────────────

  it('writes partial checkpoint after each grade', () => {
    const results = new Map([
      ['PROJ-1', makeVerdict('PROJ-1', 'green')],
      ['PROJ-2', makeVerdict('PROJ-2', 'yellow')],
    ]);
    const fs = makeFs();

    runPreflightBatch(
      makeOpts({
        ticketIds: ['PROJ-1', 'PROJ-2'],
        grade: makeGrader(results),
        fs,
      }),
    );

    // Partial checkpoint written after each grade (mkdir + writeFile + rename per write)
    const partialWrites = [...fs.written.keys()].filter((k) =>
      k.includes('readiness-report.partial.json.tmp'),
    );
    expect(partialWrites.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Resume from partial ───────────────────────────────────────────────

  it('skips already-graded tickets when resuming from partial', () => {
    const results = new Map([
      ['PROJ-1', makeVerdict('PROJ-1', 'green')],
      ['PROJ-2', makeVerdict('PROJ-2', 'yellow')],
    ]);
    const grade = makeGrader(results);

    const result = runPreflightBatch(
      makeOpts({
        ticketIds: ['PROJ-1', 'PROJ-2'],
        grade,
        partial: [makeVerdict('PROJ-1', 'green')],
      }),
    );

    // PROJ-1 was already graded, only PROJ-2 should be graded
    expect(grade).toHaveBeenCalledTimes(1);
    expect(grade).toHaveBeenCalledWith('PROJ-2');
    expect(result.verdicts).toHaveLength(2);
  });

  // ─── Cost estimate ─────────────────────────────────────────────────────

  it('logs cost estimate before grading', () => {
    const con = { log: vi.fn(), error: vi.fn() };
    const results = new Map([
      ['PROJ-1', makeVerdict('PROJ-1', 'green')],
      ['PROJ-2', makeVerdict('PROJ-2', 'green')],
    ]);

    runPreflightBatch(
      makeOpts({
        ticketIds: ['PROJ-1', 'PROJ-2'],
        grade: makeGrader(results),
        console: con,
      }),
    );

    // Cost estimate logged before grading
    expect(con.log).toHaveBeenCalledWith(
      expect.stringContaining('Will grade 2 ticket'),
    );
  });

  // ─── Mixed colours ────────────────────────────────────────────────────

  it('handles a mix of green, yellow, and red verdicts', () => {
    const results = new Map([
      ['PROJ-1', makeVerdict('PROJ-1', 'green')],
      ['PROJ-2', makeVerdict('PROJ-2', 'yellow')],
      ['PROJ-3', makeVerdict('PROJ-3', 'red')],
    ]);

    const result = runPreflightBatch(
      makeOpts({
        ticketIds: ['PROJ-1', 'PROJ-2', 'PROJ-3'],
        grade: makeGrader(results),
      }),
    );

    const colours = result.verdicts.map((v) => v.overall);
    expect(colours).toEqual(['green', 'yellow', 'red']);
  });

  // ─── Dedupe + truncation combined ──────────────────────────────────────

  it('dedupes before truncation', () => {
    const ids = ['A', 'B', 'C', 'A', 'D', 'E'];
    const results = new Map(
      ['A', 'B', 'C', 'D', 'E'].map((id) => [id, makeVerdict(id, 'green')]),
    );

    const result = runPreflightBatch(
      makeOpts({
        ticketIds: ids,
        grade: makeGrader(results),
        maxBatch: 3,
      }),
    );

    // After dedupe: [A, B, C, D, E] → truncate to 3 → [A, B, C]
    expect(result.verdicts).toHaveLength(3);
    expect(result.verdicts.map((v) => v.ticketId)).toEqual(['A', 'B', 'C']);
  });
});
