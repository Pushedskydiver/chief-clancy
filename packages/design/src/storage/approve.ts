/**
 * Variant approval marker — Phase F slice 20.
 *
 * Phase 1 of the two-phase accept/write flow (spec Phase 6): accepting a
 * variant in the canvas UI writes a `.approved` marker recording which
 * variant body was approved, by SHA-256, without touching source files.
 * `clancy:design write` (slice 21) reads the marker back to verify the
 * variant hasn't changed since approval before writing to source.
 *
 * One marker per variant at `<sessionDir>/<variantId>.approved`, mirroring
 * `storage/comments.ts`'s caller-owns-`sessionDir` contract.
 */
import type { Variant } from '../generate/types.js';

import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type ApprovalMarker = {
  readonly variantId: string;
  readonly sessionId: string;
  readonly approvedAt: string;
  readonly sha256: string;
  readonly approverPid: number;
};

type ApproveVariantOptions = {
  readonly sessionId: string;
  readonly now?: Date;
  readonly pid?: number;
};

export async function approveVariant(
  sessionDir: string,
  variant: Variant,
  options: ApproveVariantOptions,
): Promise<void> {
  const marker: ApprovalMarker = {
    variantId: variant.id,
    sessionId: options.sessionId,
    approvedAt: (options.now ?? new Date()).toISOString(),
    sha256: createHash('sha256').update(variant.html).digest('hex'),
    approverPid: options.pid ?? process.pid,
  };

  const path = join(sessionDir, `${variant.id}.approved`);
  await writeFile(path, JSON.stringify(marker, null, 2) + '\n', 'utf8');
}
