/**
 * Variant approval marker — Phase F slice 20.
 *
 * Phase 1 of the two-phase accept/write flow (spec Phase 6): accepting a
 * variant in the canvas UI writes a `.approved` marker recording which
 * variant body was approved, by SHA-256, without touching source files.
 * `clancy:design write` (slice 21) reads the marker back before writing
 * to source; whether it re-checks the sha256 for drift is that slice's
 * decision — not specified here.
 *
 * One marker per variant at `<sessionDir>/<variantId>.approved`, mirroring
 * `storage/comments.ts`'s caller-owns-`sessionDir` contract. Unlike
 * `comments.ts` (whose filename is the fixed constant `comments.jsonl`),
 * the marker filename interpolates `variant.id` — which flows from the
 * model's raw HTML output (`generate/single.ts`'s `id="..."` attribute
 * match has no charset restriction) and isn't verified against a
 * caller-expected id on the `generate()`/`regenerate()` path (only
 * `generateParallel`'s `assertVariantId` does that). So this module
 * guards the write itself rather than trusting the caller.
 */
import type { Variant } from '../generate/types.js';

import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

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

/** Reject a marker path that escapes `sessionDir` via a traversal-shaped `variant.id`. */
function assertWithinSessionDir(
  sessionDir: string,
  markerPath: string,
  variantId: string,
): void {
  const rel = relative(resolve(sessionDir), resolve(markerPath));
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(
      `approveVariant: variant id "${variantId}" resolves outside sessionDir`,
    );
  }
}

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
  assertWithinSessionDir(sessionDir, path, variant.id);
  await writeFile(path, JSON.stringify(marker, null, 2) + '\n', 'utf8');
}
