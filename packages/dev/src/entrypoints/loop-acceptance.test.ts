/**
 * Cut D acceptance test — table-driven matrix across 3 modes × verdict mixes.
 *
 * Tests `runLoop(deps)` with fully mocked deps (DI pattern, no vi.mock).
 * Each case asserts which artifact files are written and their contents.
 */
import type { CheckColour, ReadinessVerdict } from '../agents/types/index.js';
import type { AtomicFs } from '../artifacts/atomic-write/index.js';
import type { PipelineResult } from '../pipeline/index.js';
import type { LoopOutcome } from '../queue.js';
import type { FetchedTicket } from '@chief-clancy/core';

import { describe, expect, it, vi } from 'vitest';

import { runLoop } from './loop.js';

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

function makeTicket(key: string): FetchedTicket {
  return {
    key,
    title: `Ticket ${key}`,
    description: `Description for ${key}`,
    parentInfo: '',
    blockers: '',
    labels: [],
  };
}

function makeVerdict(ticketId: string, overall: CheckColour): ReadinessVerdict {
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
        reason: `${overall} bounded`,
      },
    ],
    gradedAt: '2026-04-12T10:00:00Z',
    rubricSha: 'abc123',
  };
}

function makeOutcome(
  ticketIds: readonly string[],
  overrides?: Partial<LoopOutcome<PipelineResult>>,
): LoopOutcome<PipelineResult> {
  return {
    iterations: ticketIds.map((id) => ({
      id,
      result: { status: 'completed' as const },
    })),
    startedAt: 1000,
    endedAt: 5000,
    ...overrides,
  };
}

type LoopArgsOverrides = {
  readonly isAfk?: boolean;
  readonly isAfkStrict?: boolean;
  readonly maxIterations?: number;
  readonly bypassReadiness?: boolean;
};

function makeLoopArgs(overrides: LoopArgsOverrides = {}) {
  return {
    isAfk: overrides.isAfk ?? false,
    isAfkStrict: overrides.isAfkStrict ?? false,
    maxIterations: overrides.maxIterations,
    bypassReadiness: overrides.bypassReadiness ?? false,
    maxBatch: undefined,
    resume: false,
    yes: false,
    passthroughArgv: [] as string[],
  };
}

type GradeMap = ReadonlyMap<string, CheckColour>;

function makeGradeOne(verdictMap: GradeMap) {
  return (ticketId: string) => {
    const colour = verdictMap.get(ticketId) ?? 'red';
    return { ok: true as const, verdict: makeVerdict(ticketId, colour) };
  };
}

function makeDeps(opts: {
  readonly tickets: readonly FetchedTicket[];
  readonly loopArgs: ReturnType<typeof makeLoopArgs>;
  readonly gradeMap: GradeMap;
  readonly executeResult?: LoopOutcome<PipelineResult>;
  readonly fs?: TestFs;
}) {
  const fs = opts.fs ?? makeFs();
  const executedTickets: string[] = [];

  return {
    deps: {
      loopArgs: opts.loopArgs,
      projectRoot: '/project',
      env: {},
      envFs: { readFile: vi.fn(), writeFile: vi.fn() },
      rubric: opts.loopArgs.isAfk ? 'test rubric' : undefined,
      gradeOne: makeGradeOne(opts.gradeMap),
      readinessGate: undefined,
      execute: vi.fn(
        async (executeOpts: { readonly tickets: readonly FetchedTicket[] }) => {
          executeOpts.tickets.forEach((t) => executedTickets.push(t.key));
          return (
            opts.executeResult ??
            makeOutcome(executeOpts.tickets.map((t) => t.key))
          );
        },
      ),
      fetchQueue: vi.fn(async () => opts.tickets),
      fs,
      readFile: vi.fn(() => {
        throw new Error('ENOENT');
      }),
      timestamp: () => '2026-04-12T10-00-00',
      console: { log: vi.fn(), error: vi.fn() },
      exec: vi.fn(() => ''),
    },
    fs,
    executedTickets,
  };
}

const DIR = '/project/.clancy/dev';

function hasFile(fs: TestFs, name: string): boolean {
  return fs.written.has(`${DIR}/${name}`);
}

function readJson(fs: TestFs, name: string): unknown {
  const content = fs.written.get(`${DIR}/${name}`);
  return content ? JSON.parse(content) : undefined;
}

// ─── Acceptance matrix ────────────────────────────────────────────────────

describe('Cut D acceptance — runLoop', () => {
  // ── Non-AFK (interactive loop) ──────────────────────────────────────

  it('non-AFK: skips preflight, executes all tickets, writes run-summary', async () => {
    const tickets = [makeTicket('T-1'), makeTicket('T-2')];
    const { deps, fs, executedTickets } = makeDeps({
      tickets,
      loopArgs: makeLoopArgs(),
      gradeMap: new Map(),
    });

    await runLoop(deps);

    expect(executedTickets).toEqual(['T-1', 'T-2']);
    expect(hasFile(fs, 'run-summary.md')).toBe(true);
    expect(hasFile(fs, 'run-summary.json')).toBe(true);
    expect(hasFile(fs, 'readiness-report.md')).toBe(false);
    expect(hasFile(fs, 'deferred.json')).toBe(false);
    expect(hasFile(fs, 'drift.json')).toBe(false);
  });

  // ── --afk mode ──────────────────────────────────────────────────────

  it('--afk all-green: runs preflight, executes all, writes run-summary + drift', async () => {
    const tickets = [makeTicket('T-1'), makeTicket('T-2')];
    const { deps, fs, executedTickets } = makeDeps({
      tickets,
      loopArgs: makeLoopArgs({ isAfk: true }),
      gradeMap: new Map([
        ['T-1', 'green'],
        ['T-2', 'green'],
      ]),
    });

    await runLoop(deps);

    expect(executedTickets).toEqual(['T-1', 'T-2']);
    expect(hasFile(fs, 'readiness-report.md')).toBe(true);
    expect(hasFile(fs, 'run-summary.md')).toBe(true);
    expect(hasFile(fs, 'drift.json')).toBe(true);
    expect(hasFile(fs, 'deferred.json')).toBe(false);
  });

  it('--afk mixed: halts at preflight, no execution, no run-summary', async () => {
    const tickets = [makeTicket('T-1'), makeTicket('T-2')];
    const { deps, fs, executedTickets } = makeDeps({
      tickets,
      loopArgs: makeLoopArgs({ isAfk: true }),
      gradeMap: new Map([
        ['T-1', 'green'],
        ['T-2', 'yellow'],
      ]),
    });

    await runLoop(deps);

    expect(executedTickets).toEqual([]);
    expect(deps.execute).not.toHaveBeenCalled();
    expect(hasFile(fs, 'readiness-report.md')).toBe(true);
    expect(hasFile(fs, 'run-summary.md')).toBe(false);
    expect(hasFile(fs, 'deferred.json')).toBe(false);
  });

  it('--afk all-red: halts at preflight', async () => {
    const tickets = [makeTicket('T-1')];
    const { deps, fs } = makeDeps({
      tickets,
      loopArgs: makeLoopArgs({ isAfk: true }),
      gradeMap: new Map([['T-1', 'red']]),
    });

    await runLoop(deps);

    expect(deps.execute).not.toHaveBeenCalled();
    expect(hasFile(fs, 'readiness-report.md')).toBe(true);
    expect(hasFile(fs, 'run-summary.md')).toBe(false);
  });

  // ── --afk-strict mode ───────────────────────────────────────────────

  it('--afk-strict all-green: executes all, writes run-summary + drift', async () => {
    const tickets = [makeTicket('T-1'), makeTicket('T-2')];
    const { deps, fs, executedTickets } = makeDeps({
      tickets,
      loopArgs: makeLoopArgs({ isAfk: true, isAfkStrict: true }),
      gradeMap: new Map([
        ['T-1', 'green'],
        ['T-2', 'green'],
      ]),
    });

    await runLoop(deps);

    expect(executedTickets).toEqual(['T-1', 'T-2']);
    expect(hasFile(fs, 'run-summary.md')).toBe(true);
    expect(hasFile(fs, 'drift.json')).toBe(true);
    expect(hasFile(fs, 'deferred.json')).toBe(false);
  });

  it('--afk-strict mixed: executes greens, defers yellows', async () => {
    const tickets = [makeTicket('T-1'), makeTicket('T-2'), makeTicket('T-3')];
    const { deps, fs, executedTickets } = makeDeps({
      tickets,
      loopArgs: makeLoopArgs({ isAfk: true, isAfkStrict: true }),
      gradeMap: new Map([
        ['T-1', 'green'],
        ['T-2', 'yellow'],
        ['T-3', 'green'],
      ]),
    });

    await runLoop(deps);

    expect(executedTickets).toEqual(['T-1', 'T-3']);
    expect(hasFile(fs, 'readiness-report.md')).toBe(true);
    expect(hasFile(fs, 'run-summary.md')).toBe(true);
    expect(hasFile(fs, 'deferred.json')).toBe(true);
    expect(hasFile(fs, 'drift.json')).toBe(true);

    const deferred = readJson(fs, 'deferred.json') as ReadonlyArray<{
      readonly ticketId: string;
    }>;
    expect(deferred).toHaveLength(1);
    expect(deferred[0]).toHaveProperty('ticketId', 'T-2');
  });

  it('--afk-strict all-red: halts', async () => {
    const tickets = [makeTicket('T-1')];
    const { deps, fs } = makeDeps({
      tickets,
      loopArgs: makeLoopArgs({ isAfk: true, isAfkStrict: true }),
      gradeMap: new Map([['T-1', 'red']]),
    });

    await runLoop(deps);

    expect(deps.execute).not.toHaveBeenCalled();
    expect(hasFile(fs, 'readiness-report.md')).toBe(true);
    expect(hasFile(fs, 'run-summary.md')).toBe(false);
  });

  it('--afk-strict yellows-only: halts with no green tickets', async () => {
    const tickets = [makeTicket('T-1'), makeTicket('T-2')];
    const { deps, fs } = makeDeps({
      tickets,
      loopArgs: makeLoopArgs({ isAfk: true, isAfkStrict: true }),
      gradeMap: new Map([
        ['T-1', 'yellow'],
        ['T-2', 'yellow'],
      ]),
    });

    await runLoop(deps);

    expect(deps.execute).not.toHaveBeenCalled();
    expect(hasFile(fs, 'readiness-report.md')).toBe(true);
    expect(hasFile(fs, 'run-summary.md')).toBe(false);

    const logs = (deps.console.log as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[0])
      .join('\n');
    expect(logs).toContain('No green tickets');
  });

  // ── Special cases ───────────────────────────────────────────────────

  it('empty queue: exits with nothing-to-do message', async () => {
    const { deps, fs } = makeDeps({
      tickets: [],
      loopArgs: makeLoopArgs(),
      gradeMap: new Map(),
    });

    await runLoop(deps);

    expect(deps.execute).not.toHaveBeenCalled();
    expect(fs.written.size).toBe(0);

    const logs = (deps.console.log as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[0])
      .join('\n');
    expect(logs).toContain('Nothing to do');
  });

  it('run-summary JSON includes correct mode field', async () => {
    const tickets = [makeTicket('T-1')];
    const { deps, fs } = makeDeps({
      tickets,
      loopArgs: makeLoopArgs({ isAfk: true, isAfkStrict: true }),
      gradeMap: new Map([['T-1', 'green']]),
    });

    await runLoop(deps);

    const summary = readJson(fs, 'run-summary.json') as { mode: string };
    expect(summary.mode).toBe('afk-strict');
  });

  it('run-summary JSON includes ticket statuses', async () => {
    const tickets = [makeTicket('T-1'), makeTicket('T-2')];
    const { deps, fs } = makeDeps({
      tickets,
      loopArgs: makeLoopArgs(),
      gradeMap: new Map(),
      executeResult: {
        iterations: [
          { id: 'T-1', result: { status: 'completed' } },
          { id: 'T-2', result: { status: 'error', error: 'failed' } },
        ],
        startedAt: 1000,
        endedAt: 3000,
      },
    });

    await runLoop(deps);

    const summary = readJson(fs, 'run-summary.json') as {
      tickets: Array<{ ticketId: string; status: string }>;
    };
    expect(summary.tickets).toEqual([
      { ticketId: 'T-1', status: 'completed' },
      { ticketId: 'T-2', status: 'error' },
    ]);
  });
});
