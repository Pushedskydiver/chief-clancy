/**
 * Quality feedback tracking for `.clancy/quality.json`.
 *
 * Tracks per-ticket quality metrics: rework cycles, verification retries,
 * and delivery duration. Filesystem access is dependency-injected for
 * testability.
 */
import { join } from 'node:path';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Injected filesystem operations for quality data I/O. */
export type QualityFs = {
  /** Read a file as UTF-8, throwing if missing. */
  readonly readFile: (path: string) => string;
  /** Write UTF-8 content to a file (creates if missing, overwrites if exists). */
  readonly writeFile: (path: string, content: string) => void;
  /** Atomically rename a file. */
  readonly rename: (from: string, to: string) => void;
  /** Create directory recursively. */
  readonly mkdir: (path: string) => void;
};

/** Quality metrics for a single ticket. */
type QualityEntry = {
  readonly reworkCycles: number;
  readonly verificationRetries: number;
  readonly deliveredAt?: string;
  readonly duration?: number;
};

/** Aggregate quality summary across all tracked tickets. */
type QualitySummary = {
  readonly totalTickets: number;
  readonly avgReworkCycles: number;
  readonly avgVerificationRetries: number;
  readonly avgDuration: number;
};

/** Options for recording a verification retry. */
type VerificationRetryOpts = {
  readonly ticketKey: string;
  readonly retries: number;
};

/** Options for recording a delivery. */
type DeliveryOpts = {
  readonly ticketKey: string;
  readonly duration: number;
  readonly now: number;
};

/** Quality data persisted to `.clancy/quality.json`. */
type QualityData = {
  readonly tickets: Record<string, QualityEntry>;
  readonly summary: QualitySummary;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const CLANCY_DIR = '.clancy';
const QUALITY_FILE = 'quality.json';
const QUALITY_PATH = `${CLANCY_DIR}/${QUALITY_FILE}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMPTY_SUMMARY: QualitySummary = {
  totalTickets: 0,
  avgReworkCycles: 0,
  avgVerificationRetries: 0,
  avgDuration: 0,
};

function emptyData(): QualityData {
  return { tickets: {}, summary: EMPTY_SUMMARY };
}

/** Round a number to two decimal places. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Recompute aggregate summary from ticket entries. */
function recomputeSummary(
  tickets: Record<string, QualityEntry>,
): QualitySummary {
  const entries = Object.values(tickets);
  const total = entries.length;

  if (total === 0) return EMPTY_SUMMARY;

  const delivered = entries.filter(
    (e): e is QualityEntry & { duration: number } => e.duration != null,
  );
  const reworkSum = entries.map((e) => e.reworkCycles).reduce((a, b) => a + b);
  const retriesSum = entries
    .map((e) => e.verificationRetries)
    .reduce((a, b) => a + b);
  const durationSum =
    delivered.length > 0
      ? delivered.map((e) => e.duration).reduce((a, b) => a + b)
      : 0;

  return {
    totalTickets: total,
    avgReworkCycles: round2(reworkSum / total),
    avgVerificationRetries: round2(retriesSum / total),
    avgDuration:
      delivered.length > 0 ? round2(durationSum / delivered.length) : 0,
  };
}

/** Write quality data atomically via temp file + rename. */
function writeQualityData(
  fs: QualityFs,
  projectRoot: string,
  data: QualityData,
): void {
  const filePath = join(projectRoot, QUALITY_PATH);
  const tmpPath = `${filePath}.tmp`;

  fs.mkdir(join(projectRoot, CLANCY_DIR));
  fs.writeFile(tmpPath, JSON.stringify(data, null, 2) + '\n');
  fs.rename(tmpPath, filePath);
}

/**
 * Ensure a ticket entry exists, returning the entry and updated tickets map.
 *
 * @returns A tuple of [entry, updatedTickets].
 */
function ensureEntry(
  tickets: Record<string, QualityEntry>,
  ticketKey: string,
): readonly [QualityEntry, Record<string, QualityEntry>] {
  const existing = tickets[ticketKey];
  if (existing) return [existing, tickets];

  const entry: QualityEntry = { reworkCycles: 0, verificationRetries: 0 };
  return [entry, { ...tickets, [ticketKey]: entry }];
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Read quality data from `.clancy/quality.json`.
 *
 * Returns empty data if the file is missing, corrupt, or structurally invalid.
 * Summary is always recomputed from ticket entries to guard against stale data.
 *
 * @returns The quality data.
 */
export function readQualityData(
  fs: QualityFs,
  projectRoot: string,
): QualityData {
  try {
    const raw: unknown = JSON.parse(
      fs.readFile(join(projectRoot, QUALITY_PATH)),
    );

    if (
      raw !== null &&
      typeof raw === 'object' &&
      'tickets' in raw &&
      typeof raw.tickets === 'object' &&
      raw.tickets !== null &&
      !Array.isArray(raw.tickets)
    ) {
      // Safe: structure validated above; entry shapes are best-effort (unvalidated JSON)
      const tickets = raw.tickets as Record<string, QualityEntry>;
      return { tickets, summary: recomputeSummary(tickets) };
    }
  } catch {
    // File missing or corrupt — return empty
  }

  return emptyData();
}

/**
 * Record a rework cycle for a ticket.
 *
 * Increments the rework counter. Best-effort — filesystem errors are
 * swallowed to avoid crashing the orchestrator.
 *
 * @returns Nothing.
 */
export function recordRework(
  fs: QualityFs,
  projectRoot: string,
  ticketKey: string,
): void {
  try {
    const data = readQualityData(fs, projectRoot);
    const [entry, tickets] = ensureEntry(data.tickets, ticketKey);
    const updated: Record<string, QualityEntry> = {
      ...tickets,
      [ticketKey]: { ...entry, reworkCycles: entry.reworkCycles + 1 },
    };
    writeQualityData(fs, projectRoot, {
      tickets: updated,
      summary: recomputeSummary(updated),
    });
  } catch {
    // Best-effort — never crash the orchestrator
  }
}

/**
 * Record verification retries for a ticket.
 *
 * Sets the verification retry count. Best-effort — filesystem errors are
 * swallowed to avoid crashing the orchestrator.
 *
 * @returns Nothing.
 */
export function recordVerificationRetry(
  fs: QualityFs,
  projectRoot: string,
  opts: VerificationRetryOpts,
): void {
  try {
    const data = readQualityData(fs, projectRoot);
    const [entry, tickets] = ensureEntry(data.tickets, opts.ticketKey);
    const updated: Record<string, QualityEntry> = {
      ...tickets,
      [opts.ticketKey]: { ...entry, verificationRetries: opts.retries },
    };
    writeQualityData(fs, projectRoot, {
      tickets: updated,
      summary: recomputeSummary(updated),
    });
  } catch {
    // Best-effort — never crash the orchestrator
  }
}

/**
 * Record successful delivery of a ticket.
 *
 * Sets the delivery timestamp (from injected `now`) and duration.
 * Best-effort — filesystem errors are swallowed to avoid crashing
 * the orchestrator.
 *
 * @returns Nothing.
 */
export function recordDelivery(
  fs: QualityFs,
  projectRoot: string,
  opts: DeliveryOpts,
): void {
  try {
    const data = readQualityData(fs, projectRoot);
    const [entry, tickets] = ensureEntry(data.tickets, opts.ticketKey);
    const updated: Record<string, QualityEntry> = {
      ...tickets,
      [opts.ticketKey]: {
        ...entry,
        deliveredAt: new Date(opts.now).toISOString(),
        duration: opts.duration,
      },
    };
    writeQualityData(fs, projectRoot, {
      tickets: updated,
      summary: recomputeSummary(updated),
    });
  } catch {
    // Best-effort — never crash the orchestrator
  }
}

/**
 * Read quality data for reporting.
 *
 * @returns The quality data, or `undefined` if no tickets have been tracked.
 */
export function getQualityData(
  fs: QualityFs,
  projectRoot: string,
): QualityData | undefined {
  const data = readQualityData(fs, projectRoot);
  return Object.keys(data.tickets).length === 0 ? undefined : data;
}
