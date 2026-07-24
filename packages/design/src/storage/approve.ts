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
 * provenance for post-hoc audit. It goes because no consumer wants it —
 * slices 21 and 22 do not exist yet, and the read contracts §3.1 rows 21/22
 * specify for them name no pid. The narrower half of the old rationale does
 * not survive inspection, though: `canvas/server/lock.ts` persists
 * `{pid, sessionId, startedAt}` under an exclusive create for as long as the
 * server runs, so a concurrent approver is structurally prevented rather than
 * merely detectable, and the pid *is* recoverable while a session is live.
 * What is lost is the record after the lock is released.
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
 * (`now` for tests).
 *
 * The default is for a marker written on its own, and Phase C's accept action
 * is not that case: it writes two records for one user event — this marker and
 * the `accepted` pointer in `elements/<slot>.json`, which carries its own `ts`
 * and whose module is clock-free. That is the same shape the rework plan's
 * clock rule was written for (one action, two records, one timestamp fanned
 * out from the caller), and the plan's fan-out list names chat + thread +
 * elements without naming this file. So the accept action must pass `now`
 * explicitly, with the same instant it writes into `elements.accepted`;
 * letting this default fire there stamps one event twice, and §2.6 un-accept
 * reconstructs from both surfaces.
 *
 * The record is built from typed inputs by total construction, so there is
 * nothing for a validate-before-write to catch:
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
 * `h1.header` can't be held to an id charset. Two things specific to this file
 * push it past a bare containment test. The marker has no extension, so a bare
 * `..` resolves to the session directory itself, where `elements.ts`'s appended
 * `.json` would have made it the ordinary filename `...json`, and `''` / `'.'`
 * resolve to `approved/` itself (reaching a write as EISDIR rather than a
 * stated rejection). And slice 21 walks `approved/` (§3.1 row 21), so a slot
 * containing a separator would nest a marker one level down where a flat walk
 * cannot see it. Hence: exactly one entry, directly inside `approved/`.
 *
 * That makes this guard *different* from `elements.ts`'s, not a superset of
 * it, and the two disagree in both directions — measured, not assumed. This
 * one rejects `sub/slot`, `''`, and `a[href="/docs"]`, which `elements.ts`
 * admits (nesting them under a created subdirectory); `elements.ts` rejects
 * `..foo` and `...`, which are contained here and admitted, because its
 * `startsWith('..')` prefix test also catches names that merely begin with
 * two dots. Reconciling them is not this slice's call: `a[href="/docs"]` is a
 * plausible selector-derived key that *neither* guard handles well — one
 * hard-fails it, the other silently creates a directory from it — so the fix
 * belongs with the unresolved selector→slot mapping (rework plan, slice-16
 * sub-issue), which has to decide whether such a key is encoded rather than
 * passed through. Until then the divergence is load-bearing for Phase C: the
 * accept action dual-writes this marker and `elements/<slot>.json`, so a slot
 * either guard rejects must be validated once *before* either write, or one
 * leg lands and the other throws.
 *
 * Containment here is lexical, not filesystem-level — a symlink planted at
 * `approved/<slot>` is followed, and the write lands wherever it points. The
 * whole session directory is local and user-owned, and every sibling storage
 * module has the same exposure, so this is a statement about what the guard
 * covers rather than a gap peculiar to this file.
 *
 * `variantId` needs no guard of its own here — it goes into the record, not
 * the path — and is charset-checked by `storage/variants.ts` at the point
 * where it does become a filename. Nothing checks that the body it names has
 * actually been written, so a marker can reference a `variants/<variantId>.html`
 * that slice 22 will not find; the id↔body pairing is the caller's to keep.
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
 * accepted — the normal state for every slot until one is — and reads as
 * `null`. Other I/O failures (EACCES, EISDIR, ENOSPC) propagate.
 *
 * Two operations the spec calls for are absent, for different reasons. Slices
 * 21 and 22 iterate
 * `approved/*`, which wants a listing primitive here rather than a `readdir`
 * open-coded in a UI slice — deferred because its shape (slot names or parsed
 * markers, and how it treats non-file and symlinked entries) is decided by
 * slice 21's `--slot`-vs-walk-all CLI, which does not exist. And returning a
 * slot to the unaccepted state means unlinking this file, which §2.6 requires
 * and the §3.0 matrix assigns to no slice at all — a gap in the spec, not a
 * deferral within it. Both are recorded in the rework plan.
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
