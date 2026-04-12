/**
 * Run summary writer — markdown + JSON artifacts at end of every loop execution.
 *
 * Records which tickets were processed, their statuses, timing, and
 * any halt reason. Uses atomic-write + rotation (keep last 3).
 */
import type { PipelineResult } from '../../pipeline/index.js';
import type { LoopOutcome } from '../../queue.js';
import type { AtomicFs } from '../atomic-write/index.js';

import { join } from 'node:path';

import { atomicWrite, rotateFile } from '../atomic-write/index.js';

// ─── Constants ────────────────────────────────────────────────────────────

const MD_FILE = 'run-summary.md';
const JSON_FILE = 'run-summary.json';
const ROTATION_KEEP = 3;

// ─── Types ────────────────────────────────────────────────────────────────

type WriteRunSummaryOpts = {
  readonly fs: AtomicFs;
  readonly dir: string;
  readonly outcome: LoopOutcome<PipelineResult>;
  readonly totalQueued: number;
  readonly mode: 'interactive' | 'afk' | 'afk-strict';
  readonly timestamp: () => string;
};

type RunSummaryData = {
  readonly generatedAt: string;
  readonly mode: WriteRunSummaryOpts['mode'];
  readonly startedAt: number;
  readonly endedAt: number;
  readonly durationMs: number;
  readonly totalQueued: number;
  readonly totalProcessed: number;
  readonly haltReason?: string;
  readonly tickets: readonly {
    readonly ticketId: string;
    readonly status: PipelineResult['status'];
  }[];
};

// ─── Markdown rendering ───────────────────────────────────────────────────

const STATUS_ICONS: Record<PipelineResult['status'], string> = {
  completed: '\u2705',
  resumed: '\u21a9',
  aborted: '\u23f9',
  'dry-run': '\ud83c\udfc1',
  error: '\u274c',
};

function renderMarkdown(data: RunSummaryData): string {
  const header = [
    '# Run Summary',
    '',
    `<!-- generated: ${data.generatedAt} -->`,
    `<!-- mode: ${data.mode} -->`,
    '',
    `- **Mode:** ${data.mode}`,
    `- **Duration:** ${data.durationMs}ms`,
    `- **Queued:** ${data.totalQueued}`,
    `- **Processed:** ${data.totalProcessed}`,
    ...(data.haltReason ? [`- **Halted:** ${data.haltReason}`] : []),
    '',
  ];

  if (data.tickets.length === 0) return header.join('\n');

  const rows = data.tickets.map((t) => {
    const icon = STATUS_ICONS[t.status] ?? '';
    return `| ${t.ticketId} | ${icon} ${t.status} |`;
  });

  return [
    ...header,
    '## Tickets',
    '',
    '| Ticket | Status |',
    '| ------ | ------ |',
    ...rows,
    '',
  ].join('\n');
}

// ─── Writer ───────────────────────────────────────────────────────────────

function writeRunSummary(opts: WriteRunSummaryOpts): void {
  const { fs, dir, outcome, totalQueued, mode, timestamp } = opts;
  const ts = timestamp();
  const tsOnce = () => ts;

  const data: RunSummaryData = {
    generatedAt: ts,
    mode,
    startedAt: outcome.startedAt,
    endedAt: outcome.endedAt,
    durationMs: outcome.endedAt - outcome.startedAt,
    totalQueued,
    totalProcessed: outcome.iterations.length,
    ...(outcome.haltedAt ? { haltReason: outcome.haltedAt.reason } : {}),
    tickets: outcome.iterations.map((iter) => ({
      ticketId: iter.id,
      status: iter.result.status,
    })),
  };

  const mdPath = join(dir, MD_FILE);
  const jsonPath = join(dir, JSON_FILE);

  rotateFile({ fs, filePath: mdPath, keep: ROTATION_KEEP, timestamp: tsOnce });
  rotateFile({
    fs,
    filePath: jsonPath,
    keep: ROTATION_KEEP,
    timestamp: tsOnce,
  });

  atomicWrite(fs, mdPath, renderMarkdown(data));
  atomicWrite(fs, jsonPath, JSON.stringify(data, null, 2) + '\n');
}

// ─── Exports ──────────────────────────────────────────────────────────────

export { writeRunSummary };
