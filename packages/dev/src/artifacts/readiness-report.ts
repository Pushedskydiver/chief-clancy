/**
 * Readiness report writer — markdown + JSON artifacts.
 *
 * Groups verdicts into colour buckets (red → yellow → green),
 * writes both a human-readable markdown report and a machine-readable
 * JSON sibling. Rotates existing reports before writing (keep last 3).
 */
import type {
  CheckColour,
  CheckResult,
  ReadinessVerdict,
} from '../agents/types.js';
import type { AtomicFs } from './atomic-write.js';

import { join } from 'node:path';

import { atomicWrite, rotateFile } from './atomic-write.js';

// ─── Constants ─────────────────────────────────────────────────────────────

const MD_FILE = 'readiness-report.md';
const JSON_FILE = 'readiness-report.json';
const ROTATION_KEEP = 3;

// ─── Types ─────────────────────────────────────────────────────────────────

type WriteReportOpts = {
  readonly fs: AtomicFs;
  readonly dir: string;
  readonly verdicts: readonly ReadinessVerdict[];
  readonly warnings: readonly string[];
  readonly timestamp: () => string;
};

type ReportData = {
  readonly generatedAt: string;
  readonly total: number;
  readonly green: readonly ReadinessVerdict[];
  readonly yellow: readonly ReadinessVerdict[];
  readonly red: readonly ReadinessVerdict[];
  readonly warnings: readonly string[];
};

// ─── Bucket helpers ────────────────────────────────────────────────────────

function bucket(
  verdicts: readonly ReadinessVerdict[],
): Pick<ReportData, 'green' | 'yellow' | 'red'> {
  return {
    green: verdicts.filter((v) => v.overall === 'green'),
    yellow: verdicts.filter((v) => v.overall === 'yellow'),
    red: verdicts.filter((v) => v.overall === 'red'),
  };
}

// ─── Markdown rendering ────────────────────────────────────────────────────

const COLOUR_EMOJI: Record<CheckColour, string> = {
  green: '\u2705',
  yellow: '\u26a0\ufe0f',
  red: '\u274c',
};

function renderCheck(check: CheckResult): string {
  const line = `- **${check.id}**: ${COLOUR_EMOJI[check.verdict]} ${check.reason}`;
  return check.question ? `${line}\n  - Question: ${check.question}` : line;
}

function renderVerdict(v: ReadinessVerdict): string {
  const header = `### ${v.ticketId} — ${COLOUR_EMOJI[v.overall]} ${v.overall}`;
  const checks = v.checks.map(renderCheck).join('\n');
  return `${header}\n\n${checks}\n`;
}

function renderBucket(
  colour: CheckColour,
  verdicts: readonly ReadinessVerdict[],
): string {
  if (verdicts.length === 0) return '';
  const label = `${colour.charAt(0).toUpperCase()}${colour.slice(1)}`;
  const header = `## ${label} (${verdicts.length})`;
  const body = verdicts.map(renderVerdict).join('\n');
  return `${header}\n\n${body}`;
}

function renderWarnings(warnings: readonly string[]): string {
  if (warnings.length === 0) return '';
  const items = warnings.map((w) => `- ${w}`).join('\n');
  return `## Warnings\n\n${items}\n\n`;
}

function renderMarkdown(data: ReportData): string {
  const header = [
    '# Readiness Report',
    '',
    `<!-- generated: ${data.generatedAt} -->`,
    `<!-- total: ${data.total} -->`,
    '',
    renderWarnings(data.warnings),
  ].join('\n');

  if (data.total === 0) {
    return `${header}No verdicts to report.\n`;
  }

  const sections = (
    [
      renderBucket('red', data.red),
      renderBucket('yellow', data.yellow),
      renderBucket('green', data.green),
    ] as const
  ).filter(Boolean);

  return `${header}${sections.join('\n')}`;
}

// ─── Writer ────────────────────────────────────────────────────────────────

/**
 * Write readiness report artifacts (markdown + JSON) with rotation.
 *
 * @param opts - Report data and filesystem dependencies.
 */
function writeReadinessReport(opts: WriteReportOpts): void {
  const { fs, dir, verdicts, warnings, timestamp } = opts;
  const ts = timestamp();

  const buckets = bucket(verdicts);
  const data: ReportData = {
    generatedAt: ts,
    total: verdicts.length,
    ...buckets,
    warnings,
  };

  // Compute timestamp once so rotation + report header stay consistent
  const mdPath = join(dir, MD_FILE);
  const jsonPath = join(dir, JSON_FILE);
  const fixedTs = ts;
  const tsOnce = () => fixedTs;

  rotateFile({ fs, filePath: mdPath, keep: ROTATION_KEEP, timestamp: tsOnce });
  rotateFile({
    fs,
    filePath: jsonPath,
    keep: ROTATION_KEEP,
    timestamp: tsOnce,
  });

  // Write new reports atomically
  atomicWrite(fs, mdPath, renderMarkdown(data));
  atomicWrite(fs, jsonPath, JSON.stringify(data, null, 2) + '\n');
}

// ─── Exports ───────────────────────────────────────────────────────────────

export { writeReadinessReport };
export type { ReportData, WriteReportOpts };
