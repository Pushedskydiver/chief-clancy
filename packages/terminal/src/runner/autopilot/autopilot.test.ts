import * as fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';

import {
  checkStopCondition,
  getQuietSleepMs,
  parseTime,
  runAutopilot,
} from './autopilot.js';

// ─── parseTime ───────────────────────────────────────────────────────────────

describe('parseTime', () => {
  it('parses valid HH:MM', () => {
    expect(parseTime('22:00')).toEqual({ hours: 22, minutes: 0 });
  });

  it('parses single-digit hour', () => {
    expect(parseTime('6:00')).toEqual({ hours: 6, minutes: 0 });
  });

  it('returns undefined for invalid format', () => {
    expect(parseTime('abc')).toBeUndefined();
    expect(parseTime('25:00')).toBeUndefined();
    expect(parseTime('12:60')).toBeUndefined();
    expect(parseTime('')).toBeUndefined();
  });

  it('trims whitespace', () => {
    expect(parseTime('  08:30  ')).toEqual({ hours: 8, minutes: 30 });
  });

  it('returns a result for all valid hour/minute combinations', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        (h, m) => {
          const input = `${h}:${String(m).padStart(2, '0')}`;
          const result = parseTime(input);
          return (
            result !== undefined && result.hours === h && result.minutes === m
          );
        },
      ),
    );
  });

  it('returns undefined for out-of-range hours', () => {
    fc.assert(
      fc.property(fc.integer({ min: 24, max: 99 }), (h) => {
        return parseTime(`${h}:00`) === undefined;
      }),
    );
  });
});

// ─── getQuietSleepMs ─────────────────────────────────────────────────────────

describe('getQuietSleepMs', () => {
  it('returns 0 when outside same-day quiet window', () => {
    const now = new Date(2026, 2, 20, 20, 0, 0);
    expect(getQuietSleepMs('09:00', '17:00', now)).toBe(0);
  });

  it('returns sleep ms when inside same-day quiet window', () => {
    const now = new Date(2026, 2, 20, 12, 0, 0);
    const ms = getQuietSleepMs('09:00', '17:00', now);
    expect(ms).toBe(300 * 60_000); // 5 hours
  });

  it('handles overnight window — current time after start', () => {
    const now = new Date(2026, 2, 20, 23, 0, 0);
    const ms = getQuietSleepMs('22:00', '06:00', now);
    expect(ms).toBe(420 * 60_000); // 7 hours
  });

  it('handles overnight window — current time before end', () => {
    const now = new Date(2026, 2, 20, 3, 0, 0);
    const ms = getQuietSleepMs('22:00', '06:00', now);
    expect(ms).toBe(180 * 60_000); // 3 hours
  });

  it('returns 0 when outside overnight window', () => {
    const now = new Date(2026, 2, 20, 12, 0, 0);
    expect(getQuietSleepMs('22:00', '06:00', now)).toBe(0);
  });

  it('returns 0 for invalid time strings', () => {
    const now = new Date(2026, 2, 20, 12, 0, 0);
    expect(getQuietSleepMs('invalid', '06:00', now)).toBe(0);
    expect(getQuietSleepMs('22:00', 'invalid', now)).toBe(0);
  });

  it('returns 0 when start equals end', () => {
    const now = new Date(2026, 2, 20, 12, 0, 0);
    expect(getQuietSleepMs('12:00', '12:00', now)).toBe(0);
  });
});

// ─── checkStopCondition ──────────────────────────────────────────────────────

describe('checkStopCondition', () => {
  // ── Fatal abort phases ────────────────────────────────────────────────

  it('stops on aborted at preflight', () => {
    const result = checkStopCondition({
      status: 'aborted',
      phase: 'preflight',
    });
    expect(result.stop).toBe(true);
  });

  it('stops on aborted at ticket-fetch', () => {
    const result = checkStopCondition({
      status: 'aborted',
      phase: 'ticket-fetch',
    });
    expect(result.stop).toBe(true);
  });

  it('stops on aborted at lock-check', () => {
    const result = checkStopCondition({
      status: 'aborted',
      phase: 'lock-check',
    });
    expect(result.stop).toBe(true);
  });

  it('stops on aborted at branch-setup', () => {
    const result = checkStopCondition({
      status: 'aborted',
      phase: 'branch-setup',
    });
    expect(result.stop).toBe(true);
  });

  // ── Non-fatal abort phases ────────────────────────────────────────────

  it('continues on aborted at feasibility', () => {
    const result = checkStopCondition({
      status: 'aborted',
      phase: 'feasibility',
    });
    expect(result.stop).toBe(false);
  });

  it('continues on aborted at invoke', () => {
    const result = checkStopCondition({
      status: 'aborted',
      phase: 'invoke',
    });
    expect(result.stop).toBe(false);
  });

  // ── Other statuses ────────────────────────────────────────────────────

  it('stops on error', () => {
    const result = checkStopCondition({
      status: 'error',
      error: 'Something broke',
    });
    expect(result.stop).toBe(true);
    if (result.stop) expect(result.reason).toContain('Something broke');
  });

  it('does not stop on completed', () => {
    expect(checkStopCondition({ status: 'completed' }).stop).toBe(false);
  });

  it('does not stop on resumed', () => {
    expect(checkStopCondition({ status: 'resumed' }).stop).toBe(false);
  });

  it('stops on dry-run', () => {
    expect(checkStopCondition({ status: 'dry-run' }).stop).toBe(true);
  });
});

// ─── runAutopilot ────────────────────────────────────────────────────────────

type AutopilotOpts = Parameters<typeof runAutopilot>[0];

// Mock shape — vi.fn() doesn't satisfy exact function signatures
function createMockOpts(overrides?: Partial<AutopilotOpts>): AutopilotOpts {
  return {
    maxIterations: 3,
    runIteration: vi.fn().mockResolvedValue({ status: 'completed' }),
    buildReport: vi.fn().mockReturnValue('# Report'),
    sendNotification: vi.fn().mockResolvedValue(undefined),
    sleep: vi.fn().mockResolvedValue(undefined),
    console: { log: vi.fn(), error: vi.fn() },
    clock: () => 1000,
    quietStart: undefined,
    quietEnd: undefined,
    webhookUrl: undefined,
    ...overrides,
  } as unknown as AutopilotOpts;
}

describe('runAutopilot', () => {
  it('runs up to maxIterations', async () => {
    const runIteration = vi.fn().mockResolvedValue({ status: 'completed' });
    const opts = createMockOpts({ maxIterations: 3, runIteration });

    await runAutopilot(opts);

    expect(runIteration).toHaveBeenCalledTimes(3);
  });

  it('stops early on error result', async () => {
    const runIteration = vi
      .fn()
      .mockResolvedValueOnce({ status: 'completed' })
      .mockResolvedValueOnce({ status: 'error', error: 'crash' });
    const opts = createMockOpts({ maxIterations: 5, runIteration });

    await runAutopilot(opts);

    expect(runIteration).toHaveBeenCalledTimes(2);
  });

  it('stops on preflight abort', async () => {
    const runIteration = vi
      .fn()
      .mockResolvedValue({ status: 'aborted', phase: 'preflight' });
    const opts = createMockOpts({ runIteration });

    await runAutopilot(opts);

    expect(runIteration).toHaveBeenCalledTimes(1);
  });

  it('continues on feasibility abort (skip to next ticket)', async () => {
    const runIteration = vi
      .fn()
      .mockResolvedValueOnce({ status: 'aborted', phase: 'feasibility' })
      .mockResolvedValueOnce({ status: 'completed' })
      .mockResolvedValueOnce({ status: 'completed' });
    const opts = createMockOpts({ maxIterations: 3, runIteration });

    await runAutopilot(opts);

    expect(runIteration).toHaveBeenCalledTimes(3);
  });

  it('generates report after loop ends', async () => {
    const buildReport = vi.fn().mockReturnValue('# Report');
    const opts = createMockOpts({ maxIterations: 1, buildReport });

    await runAutopilot(opts);

    expect(buildReport).toHaveBeenCalled();
  });

  it('sends webhook with summary data', async () => {
    const sendNotification = vi.fn().mockResolvedValue(undefined);
    const buildReport = vi
      .fn()
      .mockReturnValue(
        '# Report\n\n## Summary\n- Tickets completed: 1\n- Total duration: 5m',
      );
    const opts = createMockOpts({
      maxIterations: 1,
      webhookUrl: 'https://hooks.slack.com/x',
      sendNotification,
      buildReport,
    });

    await runAutopilot(opts);

    expect(sendNotification).toHaveBeenCalledWith(
      'https://hooks.slack.com/x',
      expect.stringContaining('Tickets completed'),
    );
  });

  it('sends fallback message when report has no summary lines', async () => {
    const sendNotification = vi.fn().mockResolvedValue(undefined);
    const buildReport = vi.fn().mockReturnValue('# Report\n\nNo data.');
    const opts = createMockOpts({
      maxIterations: 1,
      webhookUrl: 'https://hooks.slack.com/x',
      sendNotification,
      buildReport,
    });

    await runAutopilot(opts);

    expect(sendNotification).toHaveBeenCalledWith(
      'https://hooks.slack.com/x',
      expect.stringContaining('session complete'),
    );
  });

  it('does not send webhook when URL is not configured', async () => {
    const sendNotification = vi.fn();
    const opts = createMockOpts({
      maxIterations: 1,
      webhookUrl: undefined,
      sendNotification,
    });

    await runAutopilot(opts);

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('warns and completes when webhook notification fails', async () => {
    const sendNotification = vi
      .fn()
      .mockRejectedValue(new Error('ECONNREFUSED'));
    const consoleMock = { log: vi.fn(), error: vi.fn() };
    const opts = createMockOpts({
      maxIterations: 1,
      webhookUrl: 'https://hooks.slack.com/x',
      sendNotification,
      console: consoleMock,
    });

    await expect(runAutopilot(opts)).resolves.toBeUndefined();
    expect(consoleMock.error).toHaveBeenCalledWith(
      expect.stringContaining('Webhook notification failed'),
    );
  });

  it('sleeps between iterations', async () => {
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const opts = createMockOpts({ maxIterations: 2, sleep: sleepFn });

    await runAutopilot(opts);

    expect(sleepFn).toHaveBeenCalledWith(2000);
  });

  it('does not sleep after last iteration', async () => {
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const opts = createMockOpts({ maxIterations: 1, sleep: sleepFn });

    await runAutopilot(opts);

    expect(sleepFn).not.toHaveBeenCalledWith(2000);
  });

  it('sleeps during quiet hours', async () => {
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const now = new Date(2026, 2, 20, 23, 0, 0);
    const opts = createMockOpts({
      maxIterations: 1,
      quietStart: '22:00',
      quietEnd: '06:00',
      sleep: sleepFn,
      clock: () => now.getTime(),
      now: () => now,
    });

    await runAutopilot(opts);

    const quietSleepCall = sleepFn.mock.calls.find(
      (c: number[]) => c[0] > 60_000,
    );
    expect(quietSleepCall).toBeDefined();
  });
});
