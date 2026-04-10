/**
 * Autopilot runner — loop orchestration for unattended ticket processing.
 *
 * Runs the implement pipeline repeatedly, checking for quiet hours and
 * stop conditions between iterations. Generates a session report and
 * optionally sends a webhook notification when the loop ends.
 */
import type { ConsoleLike, PipelineResult } from '@chief-clancy/dev';

import { formatDuration } from '@chief-clancy/dev';

import { bold, dim, green, yellow } from '../../shared/ansi/index.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type StopCondition =
  | { readonly stop: false }
  | { readonly stop: true; readonly reason: string };

/** Options for the autopilot runner. */
type AutopilotOpts = {
  readonly maxIterations: number;
  readonly runIteration: () => Promise<PipelineResult>;
  readonly buildReport: (loopStartTime: number, loopEndTime: number) => string;
  readonly sendNotification: (url: string, message: string) => Promise<void>;
  readonly sleep: (ms: number) => Promise<void>;
  readonly console: ConsoleLike;
  readonly clock: () => number;
  readonly now?: () => Date;
  readonly quietStart?: string;
  readonly quietEnd?: string;
  readonly webhookUrl?: string;
};

// ─── Pure helpers ────────────────────────────────────────────────────────────

/**
 * Parse a time string in HH:MM format.
 *
 * @param value - Time string like `"22:00"` or `"6:00"`.
 * @returns Parsed hours and minutes, or `undefined` if invalid.
 */
export function parseTime(
  value: string,
): { readonly hours: number; readonly minutes: number } | undefined {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;

  const hours = parseInt(match[1]!, 10);
  const minutes = parseInt(match[2]!, 10);
  const isValidHour = hours >= 0 && hours <= 23;
  const isValidMinute = minutes >= 0 && minutes <= 59;

  return isValidHour && isValidMinute ? { hours, minutes } : undefined;
}

/**
 * Check if the current time falls within a quiet hours window.
 *
 * Handles overnight windows (e.g. 22:00–06:00). Returns the number
 * of milliseconds to sleep, or 0 if not in quiet hours.
 *
 * @param startStr - Start time in HH:MM format.
 * @param endStr - End time in HH:MM format.
 * @param now - Current date for testing.
 * @returns Milliseconds to sleep, or 0 if outside quiet hours.
 */
export function getQuietSleepMs(
  startStr: string,
  endStr: string,
  now: Date,
): number {
  const start = parseTime(startStr);
  const end = parseTime(endStr);
  if (!start || !end) return 0;

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = start.hours * 60 + start.minutes;
  const endMin = end.hours * 60 + end.minutes;

  const isInQuiet = computeQuietStatus(nowMin, startMin, endMin);
  if (!isInQuiet) return 0;

  const minutesUntilEnd = computeMinutesUntilEnd(nowMin, endMin);
  const msIntoMinute = now.getSeconds() * 1000 + now.getMilliseconds();

  return Math.max(0, minutesUntilEnd * 60_000 - msIntoMinute);
}

/** Check if current minute falls inside the quiet window. */
function computeQuietStatus(
  nowMin: number,
  startMin: number,
  endMin: number,
): boolean {
  if (startMin === endMin) return false;

  const isSameDayWindow = startMin < endMin;
  const isAfterStart = nowMin >= startMin;
  const isBeforeEnd = nowMin < endMin;

  // Same-day window (e.g. 09:00–17:00): must be between start and end
  if (isSameDayWindow) return isAfterStart && isBeforeEnd;

  // Overnight window (e.g. 22:00–06:00): after start OR before end
  return isAfterStart || isBeforeEnd;
}

/** Calculate minutes remaining until end of quiet window. */
function computeMinutesUntilEnd(nowMin: number, endMin: number): number {
  const diff = endMin - nowMin;
  const wrappedToNextDay = diff + 24 * 60;

  return diff <= 0 ? wrappedToNextDay : diff;
}

/** Phases where an abort should stop the entire autopilot loop. */
const FATAL_ABORT_PHASES = new Set([
  'lock-check',
  'preflight',
  'ticket-fetch',
  'branch-setup',
]);

/**
 * Check whether a pipeline result should stop the autopilot loop.
 *
 * Completed and resumed results continue. Errors and dry-runs stop.
 * Aborts stop only for fatal phases (preflight, ticket-fetch, etc.);
 * non-fatal aborts (feasibility, invoke) allow the next ticket.
 *
 * @param result - The pipeline result to check.
 * @returns Stop flag and optional reason.
 */
export function checkStopCondition(result: PipelineResult): StopCondition {
  switch (result.status) {
    case 'completed':
    case 'resumed':
      return { stop: false };

    case 'error':
      return { stop: true, reason: result.error ?? 'Unknown error' };

    case 'dry-run':
      return { stop: true, reason: 'Dry run — loop not applicable' };

    case 'aborted': {
      const isFatal = FATAL_ABORT_PHASES.has(result.phase ?? '');
      return isFatal
        ? { stop: true, reason: `Aborted at ${result.phase}` }
        : { stop: false };
    }

    default: {
      const _exhaustive: never = result.status;
      return _exhaustive;
    }
  }
}

// ─── Loop orchestrator ───────────────────────────────────────────────────────

/**
 * Run the autopilot loop — iterate implement, check stop conditions.
 *
 * @param opts - Injected I/O resources and configuration.
 * @returns Resolves when the loop ends.
 */
export async function runAutopilot(opts: AutopilotOpts): Promise<void> {
  const { console: out, clock } = opts;
  const loopStart = clock();

  printBanner(out);

  const iterationCount = await runIterations(opts, loopStart);

  await finalize(opts, loopStart, iterationCount);
}

function printBanner(out: ConsoleLike): void {
  out.log(dim('┌──────────────────────────────────────────────────────────┐'));
  out.log(
    dim('│') +
      bold('  🤖 Clancy — autopilot mode                              ') +
      dim('│'),
  );
  out.log(
    dim('│') +
      dim('  "I\'m on it. Proceed to the abandoned warehouse."       ') +
      dim('│'),
  );
  out.log(dim('└──────────────────────────────────────────────────────────┘'));
}

async function runIterations(
  opts: AutopilotOpts,
  loopStart: number,
): Promise<number> {
  const { console: out, clock } = opts;
  const iterIndices = iterations(opts.maxIterations);
  const totalIterations = iterIndices.length;

  // eslint-disable-next-line functional/no-loop-statements -- sequential async loop with early return on stop conditions; map/flatMap can't express this
  for (const i of iterIndices) {
    await handleQuietHours(opts);

    const iterStart = clock();
    out.log('');
    out.log(bold(`🔁 Iteration ${i}/${totalIterations}`));

    const result = await opts.runIteration();
    const iterElapsed = formatDuration(clock() - iterStart);
    out.log(dim(`  Iteration ${i} took ${iterElapsed}`));

    const condition = checkStopCondition(result);

    if (condition.stop) {
      const totalElapsed = formatDuration(clock() - loopStart);
      out.log('');
      out.log(`${condition.reason}`);
      out.log(
        dim(`  Total: ${i} iteration${i > 1 ? 's' : ''} in ${totalElapsed}`),
      );
      return i;
    }

    const isLastIteration = i === totalIterations;
    if (!isLastIteration) await opts.sleep(2000);
  }

  return totalIterations;
}

const MAX_ITERATIONS_CAP = 100;

/** Generate 1-based iteration indices, capped at {@link MAX_ITERATIONS_CAP}. */
function iterations(max: number): readonly number[] {
  const capped = Math.min(Math.max(0, max), MAX_ITERATIONS_CAP);
  return Array.from({ length: capped }, (_, idx) => idx + 1);
}

async function handleQuietHours(opts: AutopilotOpts): Promise<void> {
  const { quietStart, quietEnd, console: out } = opts;
  if (!quietStart || !quietEnd) return;

  const now = opts.now ? opts.now() : new Date();
  const sleepMs = getQuietSleepMs(quietStart, quietEnd, now);

  if (sleepMs <= 0) return;

  const sleepMin = Math.ceil(sleepMs / 60_000);
  out.log('');
  out.log(
    yellow(
      `⏸ Quiet hours active (${quietStart}–${quietEnd}). Sleeping ${sleepMin} minutes.`,
    ),
  );

  await opts.sleep(sleepMs);
  out.log(dim('  Quiet hours ended. Resuming.'));
}

async function finalize(
  opts: AutopilotOpts,
  loopStart: number,
  iterationCount: number,
): Promise<void> {
  const { console: out, clock } = opts;
  const loopEnd = clock();
  const totalElapsed = formatDuration(loopEnd - loopStart);

  out.log('');
  out.log(
    green(`🏁 Completed ${iterationCount} iterations`) +
      dim(` (${totalElapsed})`),
  );

  // Generate session report
  const report = opts.buildReport(loopStart, loopEnd);
  out.log('');
  out.log(dim('─── Session Report ───'));
  out.log(report);

  // Send webhook notification (best-effort)
  if (opts.webhookUrl) {
    const summary = extractSummaryForWebhook(report);
    try {
      await opts.sendNotification(opts.webhookUrl, summary);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      out.error(`Webhook notification failed: ${message}`);
    }
  }
}

/** Extract summary lines from report for webhook message. */
function extractSummaryForWebhook(report: string): string {
  const summaryLines = report
    .split(/\r?\n/)
    .filter((l) => l.startsWith('- Tickets') || l.startsWith('- Total'));

  const detail =
    summaryLines.length > 0 ? summaryLines.join('. ') : 'session complete';

  return `Clancy autopilot: ${detail}`;
}
