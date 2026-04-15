/**
 * Deferred ticket writer — writes deferred.json for --afk-strict mode.
 *
 * Written when yellow tickets are skipped during afk-strict execution.
 * Overwritten each run (no rotation — each run starts fresh).
 */
import type { CheckColour } from '../../agents/types/types.js';
import type { AtomicFs } from '../atomic-write/atomic-write.js';

import { join } from 'node:path';

import { atomicWrite } from '../atomic-write/atomic-write.js';

// ─── Types ─────────────────────────────────────────────────────────────────

type DeferredEntry = {
  readonly ticketId: string;
  readonly overall: CheckColour;
  readonly reason: string;
};

type WriteDeferredOpts = {
  readonly fs: AtomicFs;
  readonly dir: string;
  readonly deferred: readonly DeferredEntry[];
};

// ─── Writer ────────────────────────────────────────────────────────────────

/** Write deferred.json atomically. No-op when deferred array is empty. */
function writeDeferred(opts: WriteDeferredOpts): void {
  if (opts.deferred.length === 0) return;

  const filePath = join(opts.dir, 'deferred.json');
  atomicWrite(opts.fs, filePath, JSON.stringify(opts.deferred, null, 2) + '\n');
}

// ─── Exports ───────────────────────────────────────────────────────────────

export { writeDeferred };
