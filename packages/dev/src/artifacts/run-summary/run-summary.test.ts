import type { PipelineResult } from '../../pipeline/run-pipeline.js';
import type { LoopOutcome } from '../../queue.js';
import type { AtomicFs } from '../atomic-write/atomic-write.js';

import { describe, expect, it, vi } from 'vitest';

import { writeRunSummary } from './run-summary.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

type TestFs = AtomicFs & { readonly written: ReadonlyMap<string, string> };

function makeFs(overrides?: { readonly stat?: AtomicFs['stat'] }): TestFs {
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
    stat: overrides?.stat ?? vi.fn(() => undefined),
  };
}

function makeOutcome(
  overrides?: Partial<LoopOutcome<PipelineResult>>,
): LoopOutcome<PipelineResult> {
  return {
    iterations: [
      { id: 'PROJ-1', result: { status: 'completed' } },
      { id: 'PROJ-2', result: { status: 'aborted', phase: 'feasibility' } },
    ],
    startedAt: 1000,
    endedAt: 5000,
    ...overrides,
  };
}

const DIR = '/project/.clancy/dev';
const TS = '2026-04-12T10-00-00';

// ─── writeRunSummary ──────────────────────────────────────────────────────

describe('writeRunSummary', () => {
  it('writes run-summary.md and run-summary.json', () => {
    const fs = makeFs();

    writeRunSummary({
      fs,
      dir: DIR,
      outcome: makeOutcome(),
      totalQueued: 5,
      mode: 'afk',
      timestamp: () => TS,
    });

    const mdTmp = fs.written.get(`${DIR}/run-summary.md.tmp`);
    const jsonTmp = fs.written.get(`${DIR}/run-summary.json.tmp`);
    expect(mdTmp).toBeDefined();
    expect(jsonTmp).toBeDefined();
  });

  it('includes correct JSON structure', () => {
    const fs = makeFs();

    writeRunSummary({
      fs,
      dir: DIR,
      outcome: makeOutcome(),
      totalQueued: 5,
      mode: 'afk-strict',
      timestamp: () => TS,
    });

    const json = JSON.parse(fs.written.get(`${DIR}/run-summary.json.tmp`)!);
    expect(json.generatedAt).toBe(TS);
    expect(json.mode).toBe('afk-strict');
    expect(json.startedAt).toBe(1000);
    expect(json.endedAt).toBe(5000);
    expect(json.durationMs).toBe(4000);
    expect(json.totalQueued).toBe(5);
    expect(json.totalProcessed).toBe(2);
    expect(json.tickets).toEqual([
      { ticketId: 'PROJ-1', status: 'completed' },
      { ticketId: 'PROJ-2', status: 'aborted' },
    ]);
  });

  it('includes halt reason in JSON when present', () => {
    const fs = makeFs();

    writeRunSummary({
      fs,
      dir: DIR,
      outcome: makeOutcome({
        haltedAt: { id: 'PROJ-2', reason: 'fatal abort in lock-check' },
      }),
      totalQueued: 3,
      mode: 'afk',
      timestamp: () => TS,
    });

    const json = JSON.parse(fs.written.get(`${DIR}/run-summary.json.tmp`)!);
    expect(json.haltReason).toBe('fatal abort in lock-check');
  });

  it('omits haltReason from JSON when not halted', () => {
    const fs = makeFs();

    writeRunSummary({
      fs,
      dir: DIR,
      outcome: makeOutcome(),
      totalQueued: 2,
      mode: 'interactive',
      timestamp: () => TS,
    });

    const json = JSON.parse(fs.written.get(`${DIR}/run-summary.json.tmp`)!);
    expect(json.haltReason).toBeUndefined();
  });

  it('renders markdown with header and ticket table', () => {
    const fs = makeFs();

    writeRunSummary({
      fs,
      dir: DIR,
      outcome: makeOutcome(),
      totalQueued: 5,
      mode: 'afk',
      timestamp: () => TS,
    });

    const md = fs.written.get(`${DIR}/run-summary.md.tmp`)!;
    expect(md).toContain('# Run Summary');
    expect(md).toContain('PROJ-1');
    expect(md).toContain('completed');
    expect(md).toContain('PROJ-2');
    expect(md).toContain('aborted');
  });

  it('rotates existing files before writing (keep 3)', () => {
    const fs = makeFs({
      stat: vi.fn(() => ({ mtimeMs: 1000 })),
    });

    writeRunSummary({
      fs,
      dir: DIR,
      outcome: makeOutcome(),
      totalQueued: 2,
      mode: 'afk',
      timestamp: () => TS,
    });

    // rotateFile calls rename for existing files
    expect(fs.rename).toHaveBeenCalledWith(
      `${DIR}/run-summary.md`,
      `${DIR}/run-summary.${TS}.md`,
    );
    expect(fs.rename).toHaveBeenCalledWith(
      `${DIR}/run-summary.json`,
      `${DIR}/run-summary.${TS}.json`,
    );
  });

  it('handles empty iterations', () => {
    const fs = makeFs();

    writeRunSummary({
      fs,
      dir: DIR,
      outcome: makeOutcome({ iterations: [] }),
      totalQueued: 0,
      mode: 'interactive',
      timestamp: () => TS,
    });

    const json = JSON.parse(fs.written.get(`${DIR}/run-summary.json.tmp`)!);
    expect(json.totalProcessed).toBe(0);
    expect(json.tickets).toEqual([]);
  });
});
