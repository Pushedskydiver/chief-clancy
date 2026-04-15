/**
 * Progress logger for completed tickets.
 *
 * Reads and writes `.clancy/progress.txt` entries with timestamps,
 * ticket keys, summaries, and statuses. Filesystem access is
 * dependency-injected for testability.
 */
import type { ProgressStatus } from '@chief-clancy/core/types/progress.js';

import { join } from 'node:path';

/** Injected filesystem operations for progress file I/O. */
export type ProgressFs = {
  /** Read a file as UTF-8, throwing if missing. */
  readonly readFile: (path: string) => string;
  /** Append UTF-8 content to a file (creates if missing). */
  readonly appendFile: (path: string, content: string) => void;
  /** Create directory recursively. */
  readonly mkdir: (path: string) => void;
};

/** Options for {@link appendProgress}. */
type AppendProgressOpts = {
  readonly key: string;
  readonly summary: string;
  readonly status: ProgressStatus;
  readonly prNumber?: number;
  readonly parent?: string;
  readonly ticketType?: string;
};

/**
 * Format a date as `YYYY-MM-DD HH:MM` in UTC.
 *
 * @param date - The date to format.
 * @returns The formatted timestamp string.
 */
export function formatTimestamp(date: Date): string {
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');

  return `${y}-${mo}-${d} ${h}:${mi}`;
}

/** Relative path to the progress file within a project. */
const PROGRESS_PATH = '.clancy/progress.txt';

/** Brief-style statuses that use slug-based format. */
const SLUG_STATUSES = new Set<ProgressStatus>(['BRIEF', 'APPROVE_BRIEF']);

/** All valid progress statuses — used to validate parsed segments. Includes legacy 'APPROVE'. */
const VALID_STATUSES: ReadonlySet<string> = new Set([
  'DONE',
  'SKIPPED',
  'PR_CREATED',
  'PUSHED',
  'PUSH_FAILED',
  'LOCAL',
  'PLAN',
  'APPROVE_PLAN',
  'APPROVE',
  'REWORK',
  'EPIC_PR_CREATED',
  'BRIEF',
  'APPROVE_BRIEF',
  'TIME_LIMIT',
  'RESUMED',
]);

/**
 * Append a progress entry to `.clancy/progress.txt`.
 *
 * Creates the directory if it doesn't exist. Uses slug-based format
 * for BRIEF/APPROVE_BRIEF statuses, standard format for all others.
 *
 * @param fs - Injected filesystem operations.
 * @param projectRoot - The root directory of the project.
 * @param opts - Entry details (key, summary, status, optional prNumber/parent).
 */
export function appendProgress(
  fs: ProgressFs,
  projectRoot: string,
  opts: AppendProgressOpts,
): void {
  const filePath = join(projectRoot, PROGRESS_PATH);
  fs.mkdir(join(projectRoot, '.clancy'));

  const timestamp = formatTimestamp(new Date());
  const line = SLUG_STATUSES.has(opts.status)
    ? formatSlugLine(timestamp, opts)
    : formatStandardLine(timestamp, opts);

  fs.appendFile(filePath, line);
}

/** Format a slug-based line: `timestamp | STATUS | slug | detail`. */
function formatSlugLine(ts: string, opts: AppendProgressOpts): string {
  return `${ts} | ${opts.status} | ${opts.key} | ${opts.summary}\n`;
}

/** Format a standard line: `timestamp | key | summary | STATUS [| pr:N] [| parent:KEY] [| type:VALUE]`. */
function formatStandardLine(ts: string, opts: AppendProgressOpts): string {
  const prSuffix = opts.prNumber != null ? ` | pr:${opts.prNumber}` : '';
  const parentSuffix = opts.parent ? ` | parent:${opts.parent}` : '';
  const typeSuffix = opts.ticketType ? ` | type:${opts.ticketType}` : '';

  return `${ts} | ${opts.key} | ${opts.summary} | ${opts.status}${prSuffix}${parentSuffix}${typeSuffix}\n`;
}

/** A single parsed entry from the progress log. */
export type ProgressEntry = {
  readonly timestamp: string;
  readonly key: string;
  readonly summary: string;
  readonly status: ProgressStatus;
  readonly prNumber?: number;
  readonly parent?: string;
  readonly ticketType?: string;
};

/**
 * Parse a progress file into an array of entries.
 *
 * Supports both standard (`timestamp | key | summary | STATUS`) and
 * slug-based (`timestamp | STATUS | slug | detail`) formats.
 * Lines that don't match the minimum format are silently skipped.
 *
 * @param fs - Injected filesystem operations.
 * @param projectRoot - The root directory of the project.
 * @returns Array of parsed progress entries.
 */
export function parseProgressFile(
  fs: ProgressFs,
  projectRoot: string,
): readonly ProgressEntry[] {
  const content = safeReadFile(fs, join(projectRoot, PROGRESS_PATH));
  if (!content) return [];

  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => parseLine(line.trim()))
    .filter((entry): entry is ProgressEntry => entry !== undefined);
}

/** Read a file, returning `undefined` on any error. */
function safeReadFile(fs: ProgressFs, path: string): string | undefined {
  try {
    return fs.readFile(path);
  } catch {
    return undefined;
  }
}

/** Parse a single progress line into an entry, or `undefined` if malformed. */
function parseLine(line: string): ProgressEntry | undefined {
  const parts = line.split(' | ');
  if (parts.length < 4) return undefined;

  const timestamp = parts[0];

  // Safe cast: SLUG_STATUSES.has() returns false for non-matching strings
  const isSlugEntry = SLUG_STATUSES.has(parts[1] as ProgressStatus);
  if (isSlugEntry) return parseSlugEntry(timestamp, parts);

  return parseStandardEntry(timestamp, parts);
}

/** Parse a slug-based entry: `timestamp | STATUS | slug | detail`. */
function parseSlugEntry(
  timestamp: string,
  parts: readonly string[],
): ProgressEntry {
  return {
    timestamp,
    key: parts[2],
    summary: parts.slice(3).join(' | '),
    // Safe cast: caller already verified parts[1] is in SLUG_STATUSES
    status: parts[1] as ProgressStatus,
  };
}

/** Parse a standard entry: `timestamp | key | summary | STATUS [| pr:N] [| parent:KEY] [| type:VALUE]`. */
function parseStandardEntry(
  timestamp: string,
  parts: readonly string[],
): ProgressEntry | undefined {
  const key = parts[1];
  const tail = parts.slice(2);

  const { status, summary, prNumber, parent, ticketType } =
    extractTailFields(tail);
  if (!status) return undefined;

  const resolvedStatus =
    (status as string) === 'APPROVE' ? 'APPROVE_PLAN' : status;

  return {
    timestamp,
    key,
    summary,
    status: resolvedStatus,
    ...(prNumber != null && { prNumber }),
    ...(parent != null && { parent }),
    ...(ticketType != null && { ticketType }),
  };
}

/** Parsed tail fields from a standard progress line. */
type TailFields = {
  readonly status: ProgressStatus | undefined;
  readonly summary: string;
  readonly prNumber: number | undefined;
  readonly parent: string | undefined;
  readonly ticketType: string | undefined;
};

/** Extract status, summary, prNumber, parent, and ticketType from tail segments. */
function extractTailFields(tail: readonly string[]): TailFields {
  const prSegment = tail.find((s) => /^pr:\d+$/.test(s));
  const parentSegment = tail.find((s) => s.startsWith('parent:'));
  const typeSegment = tail.find((s) => s.startsWith('type:'));
  const statusSegment = tail.find(
    (s, i) =>
      i >= 1 &&
      isStatusSegment(s) &&
      s !== prSegment &&
      s !== parentSegment &&
      s !== typeSegment,
  );

  const prNumber = prSegment ? parseInt(prSegment.slice(3), 10) : undefined;
  const parent = parentSegment ? parentSegment.slice(7) : undefined;
  const ticketType = typeSegment ? typeSegment.slice(5) : undefined;

  const summaryParts = tail.filter(
    (s) =>
      s !== prSegment &&
      s !== parentSegment &&
      s !== typeSegment &&
      s !== statusSegment,
  );

  return {
    // Safe cast: isStatusSegment validates against VALID_STATUSES set
    status: statusSegment as ProgressStatus | undefined,
    summary: summaryParts.join(' | '),
    prNumber,
    parent,
    ticketType,
  };
}

/** Check if a segment is a known progress status. */
function isStatusSegment(segment: string): boolean {
  return VALID_STATUSES.has(segment);
}

/**
 * Find the last progress entry for a given ticket key.
 *
 * @param fs - Injected filesystem operations.
 * @param projectRoot - The root directory of the project.
 * @param key - The ticket key to search for (case-insensitive).
 * @returns The last matching entry, or `undefined` if not found.
 */
export function findLastEntry(
  fs: ProgressFs,
  projectRoot: string,
  key: string,
): ProgressEntry | undefined {
  const entries = parseProgressFile(fs, projectRoot);
  const needle = key.toLowerCase();

  return [...entries]
    .reverse()
    .find((entry) => entry.key.toLowerCase() === needle);
}

/**
 * Count how many times a ticket has been sent back for rework.
 *
 * @param fs - Injected filesystem operations.
 * @param projectRoot - The root directory of the project.
 * @param key - The ticket key to search for (case-insensitive).
 * @returns The number of `REWORK` entries for the given key.
 */
export function countReworkCycles(
  fs: ProgressFs,
  projectRoot: string,
  key: string,
): number {
  const entries = parseProgressFile(fs, projectRoot);
  const needle = key.toLowerCase();

  return entries.filter(
    (entry) => entry.key.toLowerCase() === needle && entry.status === 'REWORK',
  ).length;
}

/**
 * Find all ticket keys whose most recent entry has the given status.
 *
 * Scans progress.txt and returns the latest entry per ticket key,
 * filtered to only those with the specified status.
 *
 * @param fs - Injected filesystem operations.
 * @param projectRoot - The project root directory.
 * @param status - The status to filter by (e.g. `'PR_CREATED'`).
 * @returns Array of progress entries (latest per key) with the given status.
 */
export function findEntriesWithStatus(
  fs: ProgressFs,
  projectRoot: string,
  status: ProgressStatus,
): readonly ProgressEntry[] {
  const entries = parseProgressFile(fs, projectRoot);
  const latestByKey = new Map(entries.map((entry) => [entry.key, entry]));

  return [...latestByKey.values()].filter((entry) => entry.status === status);
}
