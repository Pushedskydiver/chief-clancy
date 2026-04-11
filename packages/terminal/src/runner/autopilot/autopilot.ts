/**
 * Autopilot runner — thin wrapper around {@link executeFixedCount}.
 *
 * Delegates loop orchestration (quiet hours, halt conditions, iteration
 * capping) to `@chief-clancy/dev`. This module owns the banner, session
 * report, webhook notification, and stop-condition logic (planned for
 * migration to dev).
 */
import type {
  ConsoleLike,
  LoopOutcome,
  PipelineResult,
  QueueStopCondition,
} from '@chief-clancy/dev';

import { executeFixedCount, formatDuration } from '@chief-clancy/dev';

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

// ─── Stop condition ─────────────────────────────────────────────────────────

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
export function checkStopCondition(result: PipelineResult): QueueStopCondition {
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
