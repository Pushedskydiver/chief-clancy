/**
 * Generic loop primitives for iterating over work items.
 *
 * Two public entry points:
 * - {@link executeFixedCount} — run N iterations (terminal autopilot mode)
 * - {@link executeQueue} — run through a list of ticket ids (dev loop mode)
 *
 * Both delegate to {@link runLoopCore}, which handles quiet hours,
 * stop conditions, and inter-iteration sleep.
 */
import type { ConsoleLike } from './types/spawn.js';

// ─── Types ──────────────────────────────────────────────────────────────────

type QueueStopCondition =
  | { readonly stop: false }
  | { readonly stop: true; readonly reason: string };

type IterationResult<TResult> = {
  readonly id: string;
  readonly result: TResult;
};

type LoopOutcome<TResult> = {
  readonly iterations: readonly IterationResult<TResult>[];
  readonly haltedAt?: { readonly id: string; readonly reason: string };
  readonly startedAt: number;
  readonly endedAt: number;
};

// ─── Fixed-count opts (terminal autopilot) ──────────────────────────────────

type ExecuteFixedCountOpts<TResult> = {
  readonly iterations: number;
  readonly run: () => Promise<TResult>;
  readonly shouldHalt: (result: TResult) => QueueStopCondition;
  readonly quietStart?: string;
  readonly quietEnd?: string;
  readonly sleep: (ms: number) => Promise<void>;
  readonly clock: () => number;
  readonly now?: () => Date;
  readonly console: ConsoleLike;
};

// ─── Queue opts (dev loop) ──────────────────────────────────────────────────

type ExecuteQueueOpts<TResult> = {
  readonly queue: readonly string[];
  readonly run: (ticketId: string) => Promise<TResult>;
  readonly shouldHalt: (result: TResult) => QueueStopCondition;
  readonly maxIterations?: number;
  readonly quietStart?: string;
  readonly quietEnd?: string;
  readonly sleep: (ms: number) => Promise<void>;
  readonly clock: () => number;
  readonly now?: () => Date;
  readonly console: ConsoleLike;
};

// ─── Private core ───────────────────────────────────────────────────────────

const MAX_ITERATIONS_CAP = 100;

type RunLoopCoreOpts<TResult> = {
  readonly iterate: (id: string) => Promise<TResult>;
  readonly shouldHalt: (result: TResult) => QueueStopCondition;
  readonly indices: readonly string[];
  readonly quietStart?: string;
  readonly quietEnd?: string;
  readonly sleep: (ms: number) => Promise<void>;
  readonly clock: () => number;
  readonly now?: () => Date;
  readonly console: ConsoleLike;
};

type LoopState<TResult> = {
  readonly startedAt: number;
  readonly results: readonly IterationResult<TResult>[];
  readonly index: number;
};

async function runLoopCore<TResult>(
  opts: RunLoopCoreOpts<TResult>,
): Promise<LoopOutcome<TResult>> {
  return runLoopStep(opts, {
    startedAt: opts.clock(),
    results: [],
    index: 0,
  });
}

async function runLoopStep<TResult>(
  opts: RunLoopCoreOpts<TResult>,
  state: LoopState<TResult>,
): Promise<LoopOutcome<TResult>> {
  if (state.index >= opts.indices.length) {
    return {
      iterations: state.results,
      startedAt: state.startedAt,
      endedAt: opts.clock(),
    };
  }

  await handleQuietHours(opts);

  const id = opts.indices[state.index];
  const result = await opts.iterate(id);
  const updated = [...state.results, { id, result }];

  const condition = opts.shouldHalt(result);
  if (condition.stop) {
    return {
      iterations: updated,
      haltedAt: { id, reason: condition.reason },
      startedAt: state.startedAt,
      endedAt: opts.clock(),
    };
  }

  const isLast = state.index === opts.indices.length - 1;
  if (!isLast) await opts.sleep(2000);

  return runLoopStep(opts, {
    startedAt: state.startedAt,
    results: updated,
    index: state.index + 1,
  });
}

// ─── Quiet hours ────────────────────────────────────────────────────────────

function parseTime(
  value: string,
): { readonly hours: number; readonly minutes: number } | undefined {
  const trimmed = value.trim();
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx === -1) return undefined;

  // Reject multiple colons (e.g. "10:00:00") or missing minutes digits
  if (trimmed.indexOf(':', colonIdx + 1) !== -1) return undefined;

  const hourStr = trimmed.slice(0, colonIdx);
  const minStr = trimmed.slice(colonIdx + 1);

  // Require exactly 2-digit minutes (e.g. "6:0" → rejected, "6:00" → ok)
  if (minStr.length !== 2) return undefined;

  const hours = parseInt(hourStr, 10);
  const minutes = parseInt(minStr, 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return undefined;

  const isOutOfRange = hours < 0 || hours > 23 || minutes < 0 || minutes > 59;
  if (isOutOfRange) return undefined;

  return { hours, minutes };
}

function getQuietSleepMs(startStr: string, endStr: string, now: Date): number {
  const start = parseTime(startStr);
  const end = parseTime(endStr);
  if (!start || !end) return 0;

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = start.hours * 60 + start.minutes;
  const endMin = end.hours * 60 + end.minutes;

  if (!isInQuietWindow(nowMin, startMin, endMin)) return 0;

  const minutesLeft = minutesUntilEnd(nowMin, endMin);
  const msIntoMinute = now.getSeconds() * 1000 + now.getMilliseconds();

  return Math.max(0, minutesLeft * 60_000 - msIntoMinute);
}

function isInQuietWindow(
  nowMin: number,
  startMin: number,
  endMin: number,
): boolean {
  if (startMin === endMin) return false;
  if (startMin < endMin) return nowMin >= startMin && nowMin < endMin;
  return nowMin >= startMin || nowMin < endMin;
}

function minutesUntilEnd(nowMin: number, endMin: number): number {
  const diff = endMin - nowMin;
  return diff <= 0 ? diff + 24 * 60 : diff;
}

async function handleQuietHours<TResult>(
  opts: Pick<
    RunLoopCoreOpts<TResult>,
    'quietStart' | 'quietEnd' | 'sleep' | 'now' | 'console'
  >,
): Promise<void> {
  const { quietStart, quietEnd } = opts;
  if (!quietStart || !quietEnd) return;

  const now = opts.now ? opts.now() : new Date();
  const sleepMs = getQuietSleepMs(quietStart, quietEnd, now);
  if (sleepMs <= 0) return;

  const sleepMin = Math.ceil(sleepMs / 60_000);
  opts.console.log(
    `Quiet hours active (${quietStart}-${quietEnd}). Sleeping ${sleepMin} minutes.`,
  );

  await opts.sleep(sleepMs);
  opts.console.log('Quiet hours ended. Resuming.');
}

// ─── Public: fixed-count mode ───────────────────────────────────────────────

/**
 * Run a fixed number of iterations with opaque run/halt callbacks.
 *
 * Each iteration is assigned a synthetic id (`iter-1`, `iter-2`, ...).
 * Iterations are capped at {@link MAX_ITERATIONS_CAP} (100).
 *
 * @param opts - Fixed-count loop configuration.
 * @returns Loop outcome with iteration results and optional halt info.
 */
async function executeFixedCount<TResult>(
  opts: ExecuteFixedCountOpts<TResult>,
): Promise<LoopOutcome<TResult>> {
  const capped = Math.min(Math.max(0, opts.iterations), MAX_ITERATIONS_CAP);
  const indices = Array.from({ length: capped }, (_, i) => `iter-${i + 1}`);

  return runLoopCore({ ...opts, indices, iterate: () => opts.run() });
}

// ─── Public: queue mode ─────────────────────────────────────────────────────

/**
 * Run through a queue of ticket ids with opaque run/halt callbacks.
 *
 * Processes tickets in order, capped at `maxIterations` (default:
 * `queue.length`) and hard-capped at {@link MAX_ITERATIONS_CAP} (100).
 *
 * @param opts - Queue loop configuration.
 * @returns Loop outcome with iteration results and optional halt info.
 */
async function executeQueue<TResult>(
  opts: ExecuteQueueOpts<TResult>,
): Promise<LoopOutcome<TResult>> {
  const cap = Math.min(
    Math.max(0, opts.maxIterations ?? opts.queue.length),
    MAX_ITERATIONS_CAP,
  );
  const indices = opts.queue.slice(0, cap);

  return runLoopCore({ ...opts, indices, iterate: (id) => opts.run(id) });
}

export { executeFixedCount, executeQueue };
export type {
  ExecuteFixedCountOpts,
  ExecuteQueueOpts,
  IterationResult,
  LoopOutcome,
  QueueStopCondition,
};
