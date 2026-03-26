/**
 * Session report generator — parse costs.log + progress.txt, build markdown.
 *
 * Produces a structured markdown report of all tickets processed during
 * an autopilot session. Pure functions handle parsing and generation;
 * the orchestrator reads FS and writes the report.
 */
import type { ProgressEntry, ProgressFs, QualityFs } from '@chief-clancy/core';

import { join } from 'node:path';

import {
  COMPLETED_STATUSES,
  FAILED_STATUSES,
  formatDuration,
  getQualityData,
  parseProgressFile,
} from '@chief-clancy/core';

// ─── Types ───────────────────────────────────────────────────────────────────

/** A parsed cost entry from costs.log. */
type CostEntry = {
  readonly timestamp: string;
  readonly key: string;
  readonly duration: string;
  readonly tokens: string;
};

/** Data required to generate a session report. */
type SessionReportData = {
  readonly entries: readonly ProgressEntry[];
  readonly costs: readonly CostEntry[];
  readonly quality:
    | {
        readonly summary: {
          readonly avgReworkCycles: number;
          readonly avgVerificationRetries: number;
          readonly avgDuration: number;
        };
      }
    | undefined;
  readonly loopStartTime: number;
  readonly loopEndTime: number;
};

/** Options for the session report orchestrator. */
type BuildReportOpts = {
  readonly progressFs: ProgressFs;
  readonly qualityFs: QualityFs;
  readonly readCostsFile: (path: string) => string;
  readonly writeFile: (path: string, content: string) => void;
  readonly mkdir: (path: string) => void;
  readonly projectRoot: string;
  readonly loopStartTime: number;
  readonly loopEndTime: number;
};

// ─── Pure helpers ────────────────────────────────────────────────────────────

/**
 * Convert a progress timestamp (`YYYY-MM-DD HH:MM`) to milliseconds.
 *
 * @param timestamp - The progress file timestamp string.
 * @returns Milliseconds since epoch, or `NaN` if invalid.
 */
export function progressTimestampToMs(timestamp: string): number {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(timestamp)) return NaN;
  return new Date(timestamp.replace(' ', 'T') + ':00Z').getTime();
}

/**
 * Parse costs.log content and filter entries after a given timestamp.
 *
 * Each line is expected to follow the format:
 * `ISO-timestamp | KEY | Nmin | ~N tokens (estimated)`
 *
 * @param content - Raw costs.log file content.
 * @param sinceMs - Only include entries with timestamp >= this value.
 * @returns Parsed cost entries from this session.
 */
export function parseCostsLog(
  content: string,
  sinceMs: number,
): readonly CostEntry[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => parseCostLine(line, sinceMs))
    .filter((entry): entry is CostEntry => entry !== undefined);
}

/** Parse a single cost line, or return undefined if invalid/filtered. */
function parseCostLine(line: string, sinceMs: number): CostEntry | undefined {
  const parts = line.split(' | ');
  if (parts.length < 4) return undefined;

  const timestamp = parts[0]!;
  const entryTime = new Date(timestamp).getTime();
  if (Number.isNaN(entryTime) || entryTime < sinceMs) return undefined;

  return {
    timestamp,
    key: parts[1]!,
    duration: parts[2]!,
    tokens: parts[3]!,
  };
}

/** Parse token count from a single cost entry, or 0 if malformed. */
function parseTokenCount(tokens: string): number {
  const match = tokens.match(/~(\d[\d,]*)/);
  return match ? parseInt(match[1]!.replace(/,/g, ''), 10) : 0;
}

/** Sum token counts from cost entries (recursive to avoid reduce). */
function sumTokens(costs: readonly CostEntry[], i = 0): number {
  return i >= costs.length
    ? 0
    : parseTokenCount(costs[i]!.tokens) + sumTokens(costs, i + 1);
}

/** Format a UTC date as `YYYY-MM-DD`. */
function formatDate(ms: number): string {
  const date = new Date(ms);
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');

  return `${y}-${mo}-${d}`;
}

/**
 * Generate a session report from pre-parsed data.
 *
 * @param data - Progress entries, cost entries, quality data, and timing.
 * @returns The report as a markdown string.
 */
export function generateSessionReport(data: SessionReportData): string {
  const { entries, costs, quality, loopStartTime, loopEndTime } = data;

  // Build cost lookup by ticket key
  const costByKey = new Map(costs.map((c) => [c.key, c]));

  // Deduplicate entries — keep latest per key (for rework cycles)
  const latestByKey = new Map(entries.map((e) => [e.key, e]));

  // Build session tickets with cost data
  const tickets = [...latestByKey.values()].map((entry) => {
    const cost = costByKey.get(entry.key);
    return { ...entry, duration: cost?.duration, tokens: cost?.tokens };
  });

  const completed = tickets.filter((t) => COMPLETED_STATUSES.has(t.status));
  const failed = tickets.filter((t) => FAILED_STATUSES.has(t.status));

  return [
    ...buildSummary(
      { completed: completed.length, failed: failed.length },
      { start: loopStartTime, end: loopEndTime },
      costs,
    ),
    ...buildTicketSection(tickets),
    ...buildNextSteps(tickets, failed),
    ...buildQualitySection(quality),
    '',
  ].join('\n');
}

type SessionTicket = ProgressEntry & {
  readonly duration?: string;
  readonly tokens?: string;
};

function buildSummary(
  tickets: { readonly completed: number; readonly failed: number },
  timing: { readonly start: number; readonly end: number },
  costs: readonly CostEntry[],
): readonly string[] {
  const totalDuration = formatDuration(timing.end - timing.start);
  const totalTokens = sumTokens(costs);
  const tokenLine =
    totalTokens > 0
      ? [`- Estimated token usage: ${totalTokens.toLocaleString('en-US')}`]
      : [];

  return [
    `# Autopilot Session Report — ${formatDate(timing.start)}`,
    '',
    '## Summary',
    `- Tickets completed: ${tickets.completed}`,
    `- Tickets failed: ${tickets.failed}`,
    `- Total duration: ${totalDuration}`,
    ...tokenLine,
  ];
}

function buildTicketSection(
  tickets: readonly SessionTicket[],
): readonly string[] {
  if (tickets.length === 0) {
    return ['', '## Tickets', '', 'No tickets were processed in this session.'];
  }

  return ['', '## Tickets', ...tickets.flatMap(formatTicket)];
}

function formatTicket(ticket: SessionTicket): readonly string[] {
  const isCompleted = COMPLETED_STATUSES.has(ticket.status);
  const icon = isCompleted ? '\u2713' : '\u2717';

  return [
    '',
    `### ${icon} ${ticket.key} — ${ticket.summary}`,
    ...(ticket.duration ? [`- Duration: ${ticket.duration}`] : []),
    ...(ticket.tokens ? [`- Tokens: ${ticket.tokens}`] : []),
    ...(ticket.prNumber != null ? [`- PR: #${ticket.prNumber}`] : []),
    `- Status: ${ticket.status}`,
  ];
}

function buildNextSteps(
  tickets: readonly SessionTicket[],
  failed: readonly SessionTicket[],
): readonly string[] {
  const prNumbers = tickets
    .filter((t) => t.prNumber != null)
    .map((t) => `#${t.prNumber}`);
  const skippedKeys = failed.map((t) => t.key);

  if (prNumbers.length === 0 && skippedKeys.length === 0) return [];

  return [
    '',
    '## Next Steps',
    ...(prNumbers.length > 0 ? [`- Review PRs ${prNumbers.join(', ')}`] : []),
    ...skippedKeys.map((key) => `- ${key} needs manual intervention`),
  ];
}

function buildQualitySection(
  quality: SessionReportData['quality'],
): readonly string[] {
  if (!quality) return [];

  const durationLine =
    quality.summary.avgDuration > 0
      ? [`- Avg delivery time: ${formatDuration(quality.summary.avgDuration)}`]
      : [];

  return [
    '',
    '## Quality Metrics',
    `- Avg rework cycles: ${quality.summary.avgReworkCycles}`,
    `- Avg verification retries: ${quality.summary.avgVerificationRetries}`,
    ...durationLine,
  ];
}

/** Read a file, returning empty string on any error. */
function safeRead(readFile: (path: string) => string, path: string): string {
  try {
    return readFile(path);
  } catch {
    return '';
  }
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

/**
 * Build a session report from FS data and write to disk.
 *
 * Reads progress.txt and costs.log, filters entries to the session window,
 * generates the markdown report, and writes to `.clancy/session-report.md`.
 *
 * @param opts - Injected I/O resources and timing.
 * @returns The report markdown string.
 */
export function buildSessionReport(opts: BuildReportOpts): string {
  const { progressFs, qualityFs, projectRoot, loopStartTime, loopEndTime } =
    opts;

  // Round start down to the minute to match progress file precision
  const startMinute = Math.floor(loopStartTime / 60_000) * 60_000;

  // Read and filter progress entries
  const allProgress = parseProgressFile(progressFs, projectRoot);
  const sessionEntries = allProgress.filter((entry) => {
    const entryMs = progressTimestampToMs(entry.timestamp);
    return !Number.isNaN(entryMs) && entryMs >= startMinute;
  });

  // Read and filter cost entries
  const costsPath = join(projectRoot, '.clancy', 'costs.log');
  const costsContent = safeRead(opts.readCostsFile, costsPath);
  const costs = parseCostsLog(costsContent, loopStartTime);

  // Read quality data (best-effort)
  const quality = getQualityData(qualityFs, projectRoot);

  // Generate the report
  const report = generateSessionReport({
    entries: sessionEntries,
    costs,
    quality,
    loopStartTime,
    loopEndTime,
  });

  // Write to disk (best-effort)
  try {
    opts.mkdir(join(projectRoot, '.clancy'));
    opts.writeFile(join(projectRoot, '.clancy', 'session-report.md'), report);
  } catch {
    // Best-effort — report is still returned for stdout
  }

  return report;
}
