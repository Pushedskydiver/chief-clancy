/**
 * Cost estimation logger for `.clancy/costs.log`.
 *
 * Appends duration-based token cost estimates per ticket. Filesystem
 * access is dependency-injected for testability.
 */
import { join } from 'node:path';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Injected filesystem operations for cost log I/O. */
export type CostFs = {
  /** Append UTF-8 content to a file (creates if missing). */
  readonly appendFile: (path: string, content: string) => void;
  /** Create directory recursively. */
  readonly mkdir: (path: string) => void;
};

/** Options for appending a cost entry. */
type CostEntryOpts = {
  readonly ticketKey: string;
  readonly startedAt: string;
  readonly now: number;
  readonly tokenRate?: number;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const CLANCY_DIR = '.clancy';
const COSTS_FILE = 'costs.log';
const DEFAULT_TOKEN_RATE = 6600;
const MS_PER_MINUTE = 60_000;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Append a cost entry to `.clancy/costs.log`.
 *
 * Calculates session duration from `startedAt` to `now`, estimates token
 * usage based on the token rate, and appends a human-readable line.
 * Best-effort — invalid timestamps produce `0min`.
 */
export function appendCostEntry(
  fs: CostFs,
  projectRoot: string,
  opts: CostEntryOpts,
): void {
  const { ticketKey, startedAt, now, tokenRate = DEFAULT_TOKEN_RATE } = opts;

  const start = new Date(startedAt).getTime();
  const durationMs = Number.isNaN(start) ? 0 : Math.max(0, now - start);
  const durationMin = Math.round(durationMs / MS_PER_MINUTE);
  const estimatedTokens = Math.round(durationMin * tokenRate);

  const timestamp = new Date(now).toISOString();
  const line = `${timestamp} | ${ticketKey} | ${durationMin}min | ~${estimatedTokens} tokens (estimated)\n`;

  fs.mkdir(join(projectRoot, CLANCY_DIR));
  fs.appendFile(join(projectRoot, CLANCY_DIR, COSTS_FILE), line);
}
