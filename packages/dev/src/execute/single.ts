/**
 * Single-ticket executor — hydrate a ticket by key, pre-seed context,
 * then run the pipeline.
 *
 * The ticket-fetch phase becomes a no-op when `ctx.ticket` is already
 * set, so pre-seeding skips the queue-based fetch and runs a specific
 * ticket directly.
 */
import type {
  PipelineDeps,
  PipelineResult,
  RunContext,
} from '../pipeline/index.js';
import type { FetchedTicket } from '@chief-clancy/core';

import { createContext } from '../pipeline/index.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Dependencies injected into the single-ticket executor. */
export type SingleTicketDeps = {
  /** Fetch a ticket by its key (e.g. `'PROJ-42'`). Returns `undefined` if not found. */
  readonly fetchTicketByKeyOnce: (
    key: string,
  ) => Promise<FetchedTicket | undefined>;
  /** Pre-built pipeline dependencies (phases wired with I/O adapters). */
  readonly pipelineDeps: PipelineDeps;
  /** Pipeline orchestrator function. */
  readonly runPipeline: (
    ctx: RunContext,
    deps: PipelineDeps,
  ) => Promise<PipelineResult>;
  /** Absolute path to the project root directory. */
  readonly projectRoot: string;
  /** Process arguments (e.g. `['--dry-run']`). */
  readonly argv: readonly string[];
  /** Whether the runner is in AFK (unattended) mode. */
  readonly isAfk: boolean;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchTicket(
  key: string,
  lookup: SingleTicketDeps['fetchTicketByKeyOnce'],
): Promise<PipelineResult | FetchedTicket> {
  try {
    const ticket = await lookup(key);
    return (
      ticket ?? { status: 'error', error: `Ticket ${key} not found on board` }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'error', error: `Ticket lookup failed: ${message}` };
  }
}

function isPipelineResult(
  value: PipelineResult | FetchedTicket,
): value is PipelineResult {
  return 'status' in value;
}

// ─── Executor ────────────────────────────────────────────────────────────────

/**
 * Run the pipeline for a single ticket identified by key.
 *
 * 1. Hydrate the ticket via a one-shot board lookup.
 * 2. Create a fresh context with the ticket pre-seeded.
 * 3. Run the pipeline — the ticket-fetch phase skips because `ctx.ticket` is set.
 *
 * @param ticketKey - Board-specific ticket identifier (e.g. `'PROJ-42'`, `'#123'`).
 * @param deps - Injected dependencies.
 * @returns Structured pipeline result (never throws).
 */
export async function runSingleTicketByKey(
  ticketKey: string,
  deps: SingleTicketDeps,
): Promise<PipelineResult> {
  const result = await fetchTicket(ticketKey, deps.fetchTicketByKeyOnce);

  if (isPipelineResult(result)) {
    return result;
  }

  const ctx = createContext({
    projectRoot: deps.projectRoot,
    argv: deps.argv,
    isAfk: deps.isAfk,
  });

  ctx.setTicket(result);

  return deps.runPipeline(ctx, deps.pipelineDeps);
}
