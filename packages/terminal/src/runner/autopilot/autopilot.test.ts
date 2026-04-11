import { describe, expect, it, vi } from 'vitest';

import { runAutopilot } from './autopilot.js';

// ─── runAutopilot ────────────────────────────────────────────────────────────

type AutopilotOpts = Parameters<typeof runAutopilot>[0];

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

  it('logs halt reason on early stop', async () => {
    const consoleMock = { log: vi.fn(), error: vi.fn() };
    const runIteration = vi
      .fn()
      .mockResolvedValue({ status: 'error', error: 'Something broke' });
    const opts = createMockOpts({
      maxIterations: 3,
      runIteration,
      console: consoleMock,
    });

    await runAutopilot(opts);

    const logCalls = (consoleMock.log as ReturnType<typeof vi.fn>).mock.calls
      .map((c: readonly unknown[]) => c[0])
      .filter((m): m is string => typeof m === 'string');
    expect(logCalls.some((m) => m.includes('Something broke'))).toBe(true);
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

    expect(buildReport).toHaveBeenCalledWith(1000, 1000);
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

  it('extracts summary from report with \\r\\n line endings', async () => {
    const sendNotification = vi.fn().mockResolvedValue(undefined);
    const buildReport = vi
      .fn()
      .mockReturnValue(
        '# Report\r\n\r\n## Summary\r\n- Tickets completed: 2\r\n- Total duration: 10m',
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
});
