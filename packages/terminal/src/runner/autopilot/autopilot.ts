/**
 * Autopilot runner — thin wrapper around {@link executeFixedCount}.
 *
 * Delegates loop orchestration (quiet hours, halt conditions, iteration
 * capping) to `@chief-clancy/dev`. This module owns the banner, session
 * report, and webhook notification.
 */
import type {
  ConsoleLike,
  LoopOutcome,
  PipelineResult,
} from '@chief-clancy/dev';

import {
  checkStopCondition,
  executeFixedCount,
  formatDuration,
} from '@chief-clancy/dev';

import { bold, dim, green } from '../../shared/ansi/index.js';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Loop orchestrator ───────────────────────────────────────────────────────

/**
 * Run the autopilot loop — delegates iteration to {@link executeFixedCount}.
 *
 * @param opts - Injected I/O resources and configuration.
 * @returns Resolves when the loop ends.
 */
export async function runAutopilot(opts: AutopilotOpts): Promise<void> {
  printBanner(opts.console);

  const outcome = await executeFixedCount<PipelineResult>({
    iterations: opts.maxIterations,
    run: () => opts.runIteration(),
    shouldHalt: checkStopCondition,
    quietStart: opts.quietStart,
    quietEnd: opts.quietEnd,
    sleep: opts.sleep,
    clock: opts.clock,
    now: opts.now,
    console: opts.console,
  });

  await finalize(opts, outcome);
}

// ─── Private helpers ────────────────────────────────────────────────────────

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

async function finalize(
  opts: AutopilotOpts,
  outcome: LoopOutcome<PipelineResult>,
): Promise<void> {
  const { console: out } = opts;
  const totalElapsed = formatDuration(outcome.endedAt - outcome.startedAt);
  const iterationCount = outcome.iterations.length;

  out.log('');
  if (outcome.haltedAt) {
    out.log(outcome.haltedAt.reason);
    out.log(
      dim(
        `  Total: ${iterationCount} iteration${iterationCount !== 1 ? 's' : ''} in ${totalElapsed}`,
      ),
    );
  } else {
    out.log(
      green(`🏁 Completed ${iterationCount} iterations`) +
        dim(` (${totalElapsed})`),
    );
  }

  // Generate session report
  const report = opts.buildReport(outcome.startedAt, outcome.endedAt);
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
