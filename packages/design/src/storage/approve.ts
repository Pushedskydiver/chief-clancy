/**
 * Variant approval marker — Phase F (UI-vision rework, slice A5).
 *
 * Phase 1 of the two-phase accept/write flow (spec Phase 6): accepting a
 * variant in the canvas UI records which body was committed, by SHA-256,
 * without touching source files. `clancy:design write` (slice 21) reads the
 * marker back before writing to source, and slice 22 copies the referenced
 * body into the handoff bundle; whether either re-checks the sha for drift is
 * those slices' decision — not specified here.
 *
 * One marker per element slot at `<sessionDir>/approved/<slot>` (spec §2.8),
 * carrying `{ variantId, roundId, sha, ts }`. See `./README.md` for how this
 * module's write, guard, read and clock choices sit against its siblings'.
 *
 * This replaces the parent spec's per-variant `<variantId>.approved` /
 * `{variantId, sessionId, approvedAt, sha256, approverPid}` shape wholesale
 * (§2.8 "Granularity change vs parent"). The two dropped fields are not
 * equivalent losses: `sessionId` is recoverable from the session directory
 * path, so it was redundant on the marker, but no §2.8 surface carries a pid,
 * so dropping `approverPid` is a real loss of provenance for audit or
 * concurrent-approver detection. It goes because no consumer wants it — slices
 * 21 and 22 do not exist yet, and the read contracts §3.1 rows 21/22 specify
 * for them name no pid — not because the information survives elsewhere. The
 * one pid the package does persist, `canvas/server/lock.ts`, is not a
 * substitute: it is per project root rather than per approval, gone once the
 * lock is released, and reclaimable by another process after 24h even while the
 * holder is alive, because that module's staleness check returns before its
 * liveness probe runs.
 *
 * `roundId` arrives from the caller because `Variant` has no notion of one: it
 * lives in `elements/<slot>.json`, which the accept action reads anyway for
 * pre-accept state (§3.0 matrix). It is what lets §2.6 un-accept reconstruct
 * state-at-acceptance without back-walking the round history.
 *
 * The sha is taken over the body handed in, not copied from the matching
 * `elements/<slot>.json` variant entry, so it measures the accepted bytes
 * independently rather than restating what element state already claims.
 *
 * The record is built from typed inputs by total construction, so there is
 * nothing for a validate-before-write to catch.
 *
 * The path guard moved with the filename at A5: `variant.id` no longer appears
 * in it, so `slot` is what gets checked. Two things specific to this file push
 * it past a bare containment test — the marker has no extension, so a bare `..`
 * resolves to the session directory itself, and `''` / `'.'` resolve to
 * `approved/` (reaching a write as EISDIR rather than a stated rejection); and
 * slice 22 iterates `approved/*`, so a nested marker would be invisible to it.
 * Hence: exactly one entry, directly inside `approved/`. `variantId` needs no
 * guard here — it goes into the record, not the path. Nothing checks that the
 * body it names has been written, so a marker can reference a
 * `variants/<variantId>.html` that slice 22 will not find; the id↔body pairing
 * is the caller's to keep.
 */
import type { Variant } from '../generate/types.js';
import type { ApprovalMarker } from '../schemas/approval-marker.js';

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { z } from 'zod/mini';

import { approvalMarkerSchema } from '../schemas/approval-marker.js';
import { isNodeFsError } from './fs-errors.js';

const APPROVED_DIR = 'approved';

/**
 * Resolve `<sessionDir>/approved/<slot>`, rejecting any `slot` that does not
 * land on a single entry directly inside the approved dir.
 */
function approvedPath(sessionDir: string, slot: string): string {
  const dir = join(sessionDir, APPROVED_DIR);
  const path = join(dir, slot);
  const rel = relative(resolve(dir), resolve(path));

  // The separator test is what makes `rel` a single segment; given that, the
  // only escape left is exactly `..`, so a `rel.startsWith('..')` prefix test
  // would buy nothing and would reject the contained `..foo`. `rel === ''`
  // covers both `''` and `'.'`, which resolve to the dir itself.
  if (rel === '' || rel === '..' || rel.includes(sep) || isAbsolute(rel)) {
    throw new Error(
      `approval marker: slot "${slot}" does not resolve to a single entry in the approved dir`,
    );
  }
  // `rel` rather than `slot`: the check ran against the resolved path, so
  // returning the raw join would let a normalised-away trailing separator
  // through to `writeFile` as an ENOENT instead of the rejection above.
  return join(dir, rel);
}

type ApproveVariantOptions = {
  readonly variant: Variant;
  readonly roundId: string;
  readonly now?: Date;
};

export async function approveVariant(
  sessionDir: string,
  slot: string,
  options: ApproveVariantOptions,
): Promise<void> {
  const path = approvedPath(sessionDir, slot);

  const marker: ApprovalMarker = {
    variantId: options.variant.id,
    roundId: options.roundId,
    sha: createHash('sha256').update(options.variant.html).digest('hex'),
    ts: (options.now ?? new Date()).toISOString(),
  };

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(marker, null, 2) + '\n', 'utf8');
}

export async function readApprovalMarker(
  sessionDir: string,
  slot: string,
): Promise<ApprovalMarker | null> {
  const path = approvedPath(sessionDir, slot);

  const raw = await readFile(path, 'utf8').catch(
    (err: unknown): string | null => {
      if (isNodeFsError(err) && err.code === 'ENOENT') return null;
      throw err;
    },
  );
  if (raw === null) return null;

  return z.parse(approvalMarkerSchema, JSON.parse(raw));
}
