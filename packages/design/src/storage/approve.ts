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
 * carrying `{ variantId, roundId, sha, ts }`. This replaces the parent spec's
 * per-variant `<variantId>.approved` / `{variantId, sessionId, approvedAt,
 * sha256, approverPid}` shape wholesale (§2.8 "Granularity change vs parent").
 * The two dropped fields are not equivalent losses: `sessionId` is recoverable
 * from the session directory path, so it was redundant on the marker, but no
 * §2.8 surface carries a pid, so dropping `approverPid` is a real loss of
 * provenance for audit or concurrent-approver detection. It goes because no
 * consumer wants it — slices 21 and 22 do not exist yet, and the read
 * contracts §3.1 rows 21/22 specify for them name no pid — not because the
 * information survives elsewhere.
 *
 * Keying by slot rather than by variant is what makes the marker *mutable*:
 * one variant is accepted per slot at a time (§2.8), so accepting again after
 * a fresh round replaces the file. That is the deliberate opposite of
 * `storage/variants.ts`, whose exclusive write refuses a second write under a
 * live id — a variant body is immutable once generated, an accept pointer is
 * not. `roundId` is what lets §2.6 un-accept reconstruct state-at-acceptance
 * without back-walking the round history.
 *
 * `roundId` arrives from the caller because `Variant` has no notion of one:
 * it lives in `elements/<slot>.json`, which the accept action reads anyway for
 * pre-accept state (§3.0 matrix). `ts` is minted here, unlike every other
 * module in this rework — those are handed a finished record and take its `ts`
 * as given, whereas this one *constructs* its record, so it owns the clock
 * (`now` for tests). The record is built from typed inputs by total
 * construction, so there is nothing for a validate-before-write to catch:
 * `storage/threads.ts` and `storage/chat.ts` validate on append because a bad
 * line poisons a whole strict-read log, and this file holds one record that a
 * later accept overwrites.
 *
 * The sha is taken over the body handed in, not copied from the matching
 * `elements/<slot>.json` variant entry, so it measures the accepted bytes
 * independently rather than restating what element state already claims.
 * `storage/variants.ts` writes bodies verbatim — no trailing newline — so the
 * bytes hashed here and the bytes at `variants/<variantId>.html` agree.
 *
 * The path guard moved with the filename: `variant.id` no longer appears in
 * it, so `slot` is what gets checked. It is checked by containment rather than
 * against a charset, as in `storage/elements.ts` — a stable-selector key like
 * `h1.header` can't be held to an id charset — but more strictly than there,
 * for two reasons specific to this file. The marker has no extension, so a
 * bare `..` resolves to the session directory itself where `elements.ts`'s
 * appended `.json` would have made it the ordinary filename `...json`, and
 * `''` / `'.'` resolve to `approved/` itself (reaching a write as EISDIR
 * rather than a stated rejection). And slice 21 walks `approved/` (§3.1 row
 * 21), so a slot containing a separator would nest a marker one level down
 * where a flat walk cannot see it. Hence: exactly one entry, directly inside
 * `approved/`. `variantId` needs no guard of its own here — it goes into the
 * record, not the path — and is charset-checked by `storage/variants.ts` at
 * the point where it does become a filename.
 *
 * `approved/` is a subdirectory, so writes mkdir it, as in
 * `storage/elements.ts`, `storage/threads.ts` and `storage/variants.ts`. The
 * `recursive` mkdir will also materialise a missing `sessionDir`, so — unlike
 * the pre-rework version of this module, whose marker sat flat in `sessionDir`
 * and which sibling docblocks cited for enforcing caller-owns-the-session-
 * directory by omission — it no longer enforces that expectation.
 *
 * Reads are strict: a marker that parses as JSON but fails the schema throws
 * rather than yielding a malformed object, which includes one left behind in
 * the superseded per-variant shape. A missing file means the slot is not
 * accepted — the normal state for every slot until one is, and where §2.6
 * un-accept returns it — and reads as `null`. Other I/O failures (EACCES,
 * EISDIR, ENOSPC) propagate.
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

  // One segment, so the only escape left to test for is exactly `..`; a
  // `rel.startsWith('..')` prefix test would also catch the contained
  // `..foo`. `''` covers both `''` and `'.'`, which resolve to the dir.
  if (rel === '' || rel === '..' || rel.includes(sep) || isAbsolute(rel)) {
    throw new Error(
      `approval marker: slot "${slot}" does not resolve to a single entry in the approved dir`,
    );
  }
  return path;
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
  const marker: ApprovalMarker = {
    variantId: options.variant.id,
    roundId: options.roundId,
    sha: createHash('sha256').update(options.variant.html).digest('hex'),
    ts: (options.now ?? new Date()).toISOString(),
  };

  const path = approvedPath(sessionDir, slot);
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
