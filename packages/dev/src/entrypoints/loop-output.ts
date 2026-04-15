/**
 * Loop output helpers — display and notification for the autopilot loop.
 */
import type { LoopOutcome } from '../index.js';
import type { PipelineResult } from '../pipeline/run-pipeline.js';

import { formatDuration } from '../lifecycle/format/format.js';
import { sendNotification } from '../notify.js';

// ─── Result display ─────────────────────────────────────────────────────────

const STATUS_ICONS: Record<PipelineResult['status'], string> = {
  completed: '✅',
  resumed: '↩',
  aborted: '⏹',
  'dry-run': '🏁',
  error: '❌',
};

/** Log a human-readable summary of the loop outcome to the console. */
export function displayOutcome(
  outcome: LoopOutcome<PipelineResult>,
  totalTickets: number,
): void {
  const elapsed = formatDuration(outcome.endedAt - outcome.startedAt);

  console.log('');
  console.log(`Loop complete (${elapsed})`);
  console.log(`  Tickets queued: ${totalTickets}`);
  console.log(`  Tickets processed: ${outcome.iterations.length}`);

  if (outcome.haltedAt) {
    console.log(`  Halted at: ${outcome.haltedAt.id}`);
    console.log(`  Reason: ${outcome.haltedAt.reason}`);
  }

  outcome.iterations.forEach((iter) => {
    const icon = STATUS_ICONS[iter.result.status];
    console.log(`  ${icon} ${iter.id}: ${iter.result.status}`);
  });
}

// ─── Webhook notification ───────────────────────────────────────────────────

/** Send a webhook notification with the loop summary. No-op when `webhookUrl` is undefined. */
export async function notifyIfConfigured(
  webhookUrl: string | undefined,
  outcome: LoopOutcome<PipelineResult>,
  totalTickets: number,
): Promise<void> {
  if (!webhookUrl) return;

  const elapsed = formatDuration(outcome.endedAt - outcome.startedAt);
  const message = outcome.haltedAt
    ? `Loop halted after ${outcome.iterations.length}/${totalTickets} tickets (${elapsed}): ${outcome.haltedAt.reason}`
    : `Loop complete: ${outcome.iterations.length}/${totalTickets} tickets processed (${elapsed})`;

  await sendNotification({
    webhookUrl,
    message,
    fetch: globalThis.fetch.bind(globalThis),
  });
}
