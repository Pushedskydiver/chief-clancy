/**
 * Single-ticket executor — hydrate a ticket by key, optionally run the
 * readiness gate, then run the pipeline.
 *
 * The ticket-fetch phase becomes a no-op when `ctx.ticket` is already
 * set, so pre-seeding skips the queue-based fetch and runs a specific
 * ticket directly.
 */
import type { RunContext } from '../pipeline/context.js';
import type { PipelineDeps, PipelineResult } from '../pipeline/run-pipeline.js';
import type { FetchedTicket } from '@chief-clancy/core';

import { createContext } from '../pipeline/context.js';
import { parseReadinessFlags } from './flags/readiness-flags.js';

// TODO(legacy-error-shape-sweep): migrate the 4 remaining legacy `error: string`
// sites to the tagged `{ kind: 'unknown'; message }` house shape per CONVENTIONS.md
// §Error Handling. Deferred from PR-β (pipeline sweep). Peer sites:
//   - `execute/single.ts` (GateResult, below)
//   - `execute/readiness/readiness-gate.ts` (GateFailed)
//   - `execute/flags/readiness-flags.ts` (readiness-flags returned literal)
//   - `lifecycle/preflight/preflight.ts` (PreflightResult)
/** Result from the readiness gate. */
type GateResult =
  | { readonly passed: true }
  | {
      readonly passed: false;
      readonly overall?: string;
      readonly error?: { readonly kind: 'unknown'; readonly message: string };
    };

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
  /** Optional readiness gate. Receives the fetched ticket for grading. */
  readonly readinessGate?: (ticket: FetchedTicket) => GateResult;
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
  // Cannot use 'status' — FetchedTicket has an optional status field.
  // FetchedTicket always has 'key'; PipelineResult never does.
  return !('key' in value);
}

function checkReadiness(
  deps: SingleTicketDeps,
  ticket: FetchedTicket,
): PipelineResult | undefined {
  if (!deps.readinessGate) return undefined;

  const flags = parseReadinessFlags(deps.argv, deps.isAfk);

  if (!flags.ok) {
    return { status: 'error', error: flags.error.message };
  }

  if (flags.bypass) {
    // Bypass — skip readiness gate. Caller (entrypoint) handles logging.
    return undefined;
  }

  const gate = deps.readinessGate(ticket);

  if (!gate.passed) {
    const reason =
      gate.error?.message ?? `Readiness gate: ${gate.overall ?? 'failed'}`;
    return { status: 'aborted', phase: 'readiness', error: reason };
  }

  return undefined;
}

// ─── Executor ────────────────────────────────────────────────────────────────

/**
 * Run the pipeline for a single ticket identified by key.
 *
 * 1. Hydrate the ticket via a one-shot board lookup.
 * 2. Run the readiness gate (if provided and not bypassed).
 * 3. Create a fresh context with the ticket pre-seeded.
 * 4. Run the pipeline — the ticket-fetch phase skips because `ctx.ticket` is set.
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

  const readinessResult = checkReadiness(deps, result);

  if (readinessResult) {
    return readinessResult;
  }

  const ctx = createContext({
    projectRoot: deps.projectRoot,
    argv: deps.argv,
    isAfk: deps.isAfk,
  });

  ctx.setTicket(result);

  return deps.runPipeline(ctx, deps.pipelineDeps);
}
