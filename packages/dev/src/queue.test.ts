/**
 * Tests for executeQueue and executeFixedCount loop primitives.
 *
 * Full matrix from plan PR 11a:
 * - Empty queue / zero iterations
 * - Queue > maxIterations (cap wins)
 * - Queue < maxIterations (queue wins)
 * - Fixed-count: 0, 1, 10
 * - Quiet hours: inside (sleeps), outside (runs), wrap-around midnight
 * - Halt at iteration 0 and N-1
 * - run() throwing mid-iteration
 * - sleep() rejecting
 * - Opaque generic: TResult = string AND PipelineResult shape
 * - Max iterations hard cap at 100
 */
import type {
  ExecuteFixedCountOpts,
  ExecuteQueueOpts,
  QueueStopCondition,
} from './queue.js';
import type { ConsoleLike } from './types/spawn.js';

import { describe, expect, it, vi } from 'vitest';

import { executeFixedCount, executeQueue } from './queue.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const neverHalt = (): QueueStopCondition => ({ stop: false });

function makeConsole(): ConsoleLike {
  return { log: vi.fn(), error: vi.fn() };
}

function makeQueueOpts<TResult>(
  overrides: Partial<ExecuteQueueOpts<TResult>> & {
    readonly queue: readonly string[];
    readonly run: (ticketId: string) => Promise<TResult>;
  },
): ExecuteQueueOpts<TResult> {
  return {
    shouldHalt: neverHalt,
    sleep: vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined),
    clock: vi.fn<() => number>().mockReturnValue(1000),
    console: makeConsole(),
    ...overrides,
  };
}

function makeFixedOpts<TResult>(
  overrides: Partial<ExecuteFixedCountOpts<TResult>> & {
    readonly iterations: number;
    readonly run: () => Promise<TResult>;
  },
): ExecuteFixedCountOpts<TResult> {
  return {
    shouldHalt: neverHalt,
    sleep: vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined),
    clock: vi.fn<() => number>().mockReturnValue(1000),
    console: makeConsole(),
    ...overrides,
  };
}

// ─── executeQueue ───────────────────────────────────────────────────────────

describe('executeQueue', () => {
  it('returns zero iterations for an empty queue', async () => {
    const run = vi
      .fn<(id: string) => Promise<string>>()
      .mockResolvedValue('ok');
    const outcome = await executeQueue(makeQueueOpts({ queue: [], run }));

    expect(outcome.iterations).toEqual([]);
    expect(outcome.haltedAt).toBeUndefined();
    expect(run).not.toHaveBeenCalled();
  });

  it('caps at maxIterations when queue is longer', async () => {
    const queue = ['A', 'B', 'C', 'D', 'E'];
    const run = vi
      .fn<(id: string) => Promise<string>>()
      .mockResolvedValue('ok');

    const outcome = await executeQueue(
      makeQueueOpts({ queue, run, maxIterations: 3 }),
    );

    expect(outcome.iterations).toHaveLength(3);
    expect(outcome.iterations.map((r) => r.id)).toEqual(['A', 'B', 'C']);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('processes entire queue when shorter than maxIterations', async () => {
    const queue = ['A', 'B'];
    const run = vi
      .fn<(id: string) => Promise<string>>()
      .mockResolvedValue('ok');

    const outcome = await executeQueue(
      makeQueueOpts({ queue, run, maxIterations: 10 }),
    );

    expect(outcome.iterations).toHaveLength(2);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('defaults maxIterations to queue.length', async () => {
    const queue = ['A', 'B', 'C'];
    const run = vi
      .fn<(id: string) => Promise<string>>()
      .mockResolvedValue('ok');

    const outcome = await executeQueue(makeQueueOpts({ queue, run }));

    expect(outcome.iterations).toHaveLength(3);
  });

  it('halts at iteration 0 (first ticket)', async () => {
    const run = vi
      .fn<(id: string) => Promise<string>>()
      .mockResolvedValue('fail');
    const shouldHalt = (): QueueStopCondition => ({
      stop: true,
      reason: 'fatal error',
    });

    const outcome = await executeQueue(
      makeQueueOpts({ queue: ['A', 'B', 'C'], run, shouldHalt }),
    );

    expect(outcome.iterations).toHaveLength(1);
    expect(outcome.haltedAt).toEqual({ id: 'A', reason: 'fatal error' });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('halts at iteration N-1 (last ticket)', async () => {
    let callCount = 0;
    const run = vi
      .fn<(id: string) => Promise<string>>()
      .mockImplementation(async () => {
        callCount++;
        return callCount === 3 ? 'bad' : 'ok';
      });
    const shouldHalt = (result: string): QueueStopCondition =>
      result === 'bad' ? { stop: true, reason: 'bad result' } : { stop: false };

    const outcome = await executeQueue(
      makeQueueOpts({ queue: ['A', 'B', 'C'], run, shouldHalt }),
    );

    expect(outcome.iterations).toHaveLength(3);
    expect(outcome.haltedAt).toEqual({ id: 'C', reason: 'bad result' });
  });

  it('propagates run() error as rejection', async () => {
    const run = vi
      .fn<(id: string) => Promise<string>>()
      .mockResolvedValueOnce('ok')
      .mockRejectedValueOnce(new Error('boom'));

    await expect(
      executeQueue(makeQueueOpts({ queue: ['A', 'B', 'C'], run })),
    ).rejects.toThrow('boom');
  });

  it('propagates sleep() rejection', async () => {
    const run = vi
      .fn<(id: string) => Promise<string>>()
      .mockResolvedValue('ok');
    const sleep = vi
      .fn<(ms: number) => Promise<void>>()
      .mockRejectedValue(new Error('sleep failed'));

    await expect(
      executeQueue(makeQueueOpts({ queue: ['A', 'B'], run, sleep })),
    ).rejects.toThrow('sleep failed');
  });

  it('hard-caps at 100 iterations regardless of queue length', async () => {
    const queue = Array.from({ length: 200 }, (_, i) => `T-${i}`);
    const run = vi
      .fn<(id: string) => Promise<string>>()
      .mockResolvedValue('ok');

    const outcome = await executeQueue(
      makeQueueOpts({ queue, run, maxIterations: 200 }),
    );

    expect(outcome.iterations).toHaveLength(100);
    expect(run).toHaveBeenCalledTimes(100);
  });

  it('treats negative maxIterations as zero', async () => {
    const run = vi
      .fn<(id: string) => Promise<string>>()
      .mockResolvedValue('ok');

    const outcome = await executeQueue(
      makeQueueOpts({ queue: ['A', 'B'], run, maxIterations: -5 }),
    );

    expect(outcome.iterations).toEqual([]);
    expect(run).not.toHaveBeenCalled();
  });

  it('works with opaque PipelineResult-shaped generic', async () => {
    type MockResult = {
      readonly status: string;
      readonly phase?: string;
    };

    const run = vi.fn<(id: string) => Promise<MockResult>>().mockResolvedValue({
      status: 'completed',
    });

    const shouldHalt = (r: MockResult): QueueStopCondition =>
      r.status === 'error'
        ? { stop: true, reason: 'pipeline error' }
        : { stop: false };

    const outcome = await executeQueue(
      makeQueueOpts({ queue: ['A'], run, shouldHalt }),
    );

    expect(outcome.iterations[0].result).toEqual({ status: 'completed' });
  });

  it('passes ticket id to run()', async () => {
    const run = vi
      .fn<(id: string) => Promise<string>>()
      .mockResolvedValue('ok');

    await executeQueue(makeQueueOpts({ queue: ['PROJ-1', 'PROJ-2'], run }));

    expect(run).toHaveBeenCalledWith('PROJ-1');
    expect(run).toHaveBeenCalledWith('PROJ-2');
  });

  it('records startedAt and endedAt from clock()', async () => {
    let time = 5000;
    const clock = vi.fn<() => number>().mockImplementation(() => {
      const t = time;
      time += 100;
      return t;
    });
    const run = vi
      .fn<(id: string) => Promise<string>>()
      .mockResolvedValue('ok');

    const outcome = await executeQueue(
      makeQueueOpts({ queue: ['A'], run, clock }),
    );

    expect(outcome.startedAt).toBe(5000);
    expect(outcome.endedAt).toBeGreaterThan(5000);
  });

  it('sleeps between iterations but not after the last', async () => {
    const run = vi
      .fn<(id: string) => Promise<string>>()
      .mockResolvedValue('ok');
    const sleep = vi
      .fn<(ms: number) => Promise<void>>()
      .mockResolvedValue(undefined);

    await executeQueue(makeQueueOpts({ queue: ['A', 'B', 'C'], run, sleep }));

    // 3 items = 2 inter-iteration sleeps (2000ms each)
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });
});

// ─── executeFixedCount ──────────────────────────────────────────────────────

describe('executeFixedCount', () => {
  it('runs zero iterations when iterations = 0', async () => {
    const run = vi.fn<() => Promise<string>>().mockResolvedValue('ok');

    const outcome = await executeFixedCount(
      makeFixedOpts({ iterations: 0, run }),
    );

    expect(outcome.iterations).toEqual([]);
    expect(run).not.toHaveBeenCalled();
  });

  it('runs exactly 1 iteration', async () => {
    const run = vi.fn<() => Promise<string>>().mockResolvedValue('ok');

    const outcome = await executeFixedCount(
      makeFixedOpts({ iterations: 1, run }),
    );

    expect(outcome.iterations).toHaveLength(1);
    expect(outcome.iterations[0].id).toBe('iter-1');
    expect(outcome.iterations[0].result).toBe('ok');
  });

  it('runs exactly 10 iterations', async () => {
    const run = vi.fn<() => Promise<string>>().mockResolvedValue('ok');

    const outcome = await executeFixedCount(
      makeFixedOpts({ iterations: 10, run }),
    );

    expect(outcome.iterations).toHaveLength(10);
    expect(outcome.iterations[9].id).toBe('iter-10');
  });

  it('caps at 100 when iterations > 100', async () => {
    const run = vi.fn<() => Promise<string>>().mockResolvedValue('ok');

    const outcome = await executeFixedCount(
      makeFixedOpts({ iterations: 150, run }),
    );

    expect(outcome.iterations).toHaveLength(100);
  });

  it('handles negative iterations as zero', async () => {
    const run = vi.fn<() => Promise<string>>().mockResolvedValue('ok');

    const outcome = await executeFixedCount(
      makeFixedOpts({ iterations: -5, run }),
    );

    expect(outcome.iterations).toEqual([]);
    expect(run).not.toHaveBeenCalled();
  });

  it('does not pass id to run()', async () => {
    const run = vi.fn<() => Promise<string>>().mockResolvedValue('ok');

    await executeFixedCount(makeFixedOpts({ iterations: 2, run }));

    // run() is called with no arguments (not with the synthetic iter-N id)
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenCalledWith();
  });
});

// ─── Quiet hours ────────────────────────────────────────────────────────────

describe('quiet hours', () => {
  it('sleeps when inside quiet window', async () => {
    const sleep = vi
      .fn<(ms: number) => Promise<void>>()
      .mockResolvedValue(undefined);
    const run = vi
      .fn<(id: string) => Promise<string>>()
      .mockResolvedValue('ok');
    // 23:00 with quiet 22:00-06:00 → should sleep ~7 hours
    const now = vi
      .fn<() => Date>()
      .mockReturnValue(new Date(2026, 0, 15, 23, 0, 0, 0));

    await executeQueue(
      makeQueueOpts({
        queue: ['A'],
        run,
        sleep,
        quietStart: '22:00',
        quietEnd: '06:00',
        now,
      }),
    );

    // First call to sleep is the quiet-hours sleep, second would be inter-iteration
    // With 1 item, only the quiet-hours sleep happens
    expect(sleep).toHaveBeenCalledTimes(1);
    const sleepMs = sleep.mock.calls[0][0];
    // 23:00 → 06:00 = 7 hours = 25,200,000ms
    expect(sleepMs).toBe(7 * 60 * 60 * 1000);
  });

  it('does not sleep when outside quiet window', async () => {
    const sleep = vi
      .fn<(ms: number) => Promise<void>>()
      .mockResolvedValue(undefined);
    const run = vi
      .fn<(id: string) => Promise<string>>()
      .mockResolvedValue('ok');
    // 14:00 with quiet 22:00-06:00 → not in quiet hours
    const now = vi
      .fn<() => Date>()
      .mockReturnValue(new Date(2026, 0, 15, 14, 0, 0, 0));

    await executeQueue(
      makeQueueOpts({
        queue: ['A'],
        run,
        sleep,
        quietStart: '22:00',
        quietEnd: '06:00',
        now,
      }),
    );

    // No sleep at all (1 item, outside quiet hours)
    expect(sleep).not.toHaveBeenCalled();
  });

  it('handles wrap-around midnight correctly', async () => {
    const sleep = vi
      .fn<(ms: number) => Promise<void>>()
      .mockResolvedValue(undefined);
    const run = vi
      .fn<(id: string) => Promise<string>>()
      .mockResolvedValue('ok');
    // 02:00 with quiet 22:00-06:00 → inside, should sleep ~4 hours
    const now = vi
      .fn<() => Date>()
      .mockReturnValue(new Date(2026, 0, 15, 2, 0, 0, 0));

    await executeQueue(
      makeQueueOpts({
        queue: ['A'],
        run,
        sleep,
        quietStart: '22:00',
        quietEnd: '06:00',
        now,
      }),
    );

    expect(sleep).toHaveBeenCalledTimes(1);
    const sleepMs = sleep.mock.calls[0][0];
    // 02:00 → 06:00 = 4 hours = 14,400,000ms
    expect(sleepMs).toBe(4 * 60 * 60 * 1000);
  });

  it('logs quiet hours messages', async () => {
    const con = makeConsole();
    const sleep = vi
      .fn<(ms: number) => Promise<void>>()
      .mockResolvedValue(undefined);
    const run = vi
      .fn<(id: string) => Promise<string>>()
      .mockResolvedValue('ok');
    const now = vi
      .fn<() => Date>()
      .mockReturnValue(new Date(2026, 0, 15, 23, 0, 0, 0));

    await executeQueue(
      makeQueueOpts({
        queue: ['A'],
        run,
        sleep,
        quietStart: '22:00',
        quietEnd: '06:00',
        now,
        console: con,
      }),
    );

    const logCalls = (con.log as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: readonly unknown[]) => c[0],
    );
    expect(
      logCalls.some(
        (m) => typeof m === 'string' && m.includes('Quiet hours active'),
      ),
    ).toBe(true);
    expect(
      logCalls.some((m) => typeof m === 'string' && m.includes('Resuming')),
    ).toBe(true);
  });
});
