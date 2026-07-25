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
 * information survives elsewhere. `canvas/server/lock.ts` does persist a pid,
 * but it is per project root rather than per approval, it is gone once the
 * lock is released, and another process can reclaim the lock after 24h even
 * while the holder is alive, because its staleness check returns before the
 * liveness probe runs. Nothing connects it to an approval. (It records the
 * canvas server's pid, which may or may not turn out to be the approver's —
 * that depends on where Phase C runs the accept action, which does not exist
 * yet, so it is not a reason either way.)
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
 * `ts`-writing module in this rework — `elements.ts`, `threads.ts` and
 * `chat.ts` are handed a finished record and take its `ts` as given (and
 * `variants.ts` has no timestamp at all), whereas this one *constructs* its
 * record, so it owns the clock (`now` for tests).
 *
 * The default is for a marker written on its own, and Phase C's accept action
 * is not that case: it writes two records for one user event — this marker and
 * the `accepted` pointer in `elements/<slot>.json`, which carries its own `ts`
 * and whose module is clock-free. That is the same shape the rework plan's
 * clock rule was written for (one action, two records, one timestamp fanned
 * out from the caller), and the plan's fan-out list names chat + thread +
 * elements without naming this file. So the accept action must pass `now`
 * explicitly, with the same instant it writes into `elements.accepted`;
 * letting this default fire there stamps one event twice. Both surfaces feed
 * state-at-acceptance reconstruction — `elements.accepted`'s structure per
 * §2.8, this marker's `roundId` per §3.1 row 20. §2.6 names this file on its
 * accept path but not `elements/<slot>.json`, so the pairing is assembled from
 * §2.8 and §3.1 rather than stated in one place.
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
 * stated rejection). And slice 22 iterates `approved/*` unconditionally (§3.1
 * row 22; row 21 offers a walk only as the alternative to `--slot`), so a slot
 * that nests a marker one level down puts it where a flat walk cannot see it.
 * Hence: exactly one entry, directly inside `approved/`.
 *
 * The test is on the *normalised* path, not on the raw slot, so this rejects
 * separators only where they survive normalisation: `sub/slot` is refused, but
 * `a/../b` normalises onto slot `b` and is accepted, which means two distinct
 * slot keys can alias onto one marker. `storage/variants.ts` names that same
 * aliasing as its reason for holding `variantId` to a charset instead — an
 * option not open here, since a stable-selector key can't be charset-bound.
 *
 * That makes this guard *different* from `elements.ts`'s, not a superset of
 * it, and the two disagree in both directions — measured, not assumed. This
 * one rejects `sub/slot`, `''`, and `a[href="/docs"]`, which `elements.ts`
 * admits: `sub/slot` and `a[href="/docs"]` nest under a created subdirectory,
 * while `''` lands flat as the hidden file `elements/.json`, since the `.json`
 * is appended before its containment test runs. `elements.ts` in turn rejects
 * `..foo` and `...`, contained here and admitted, because its `startsWith('..')`
 * prefix test also catches names that merely begin with two dots. Reconciling
 * them is not this slice's call: `a[href="/docs"]` is a plausible
 * selector-derived key that *neither* guard handles well — one hard-fails it,
 * the other silently creates a directory from it — so the fix belongs with the
 * unresolved selector→slot mapping (rework plan, slice-16 sub-issue), which
 * has to decide whether such a key is encoded rather than passed through.
 * Until then the divergence is load-bearing for Phase C: the accept action
 * dual-writes this marker and `elements/<slot>.json`, so a slot either guard
 * rejects must be validated once *before* either write, or one leg lands and
 * the other throws.
 *
 * Containment here is lexical, not filesystem-level — a symlink planted at
 * `approved/<slot>` is followed, and the write lands wherever it points. The
 * whole session directory is local and user-owned, and `chat.ts`, `threads.ts`
 * and `elements.ts` all write the same way, so this is a statement about what
 * the guard covers rather than a gap peculiar to this file. `variants.ts` is
 * the exception: its exclusive `wx` create fails EEXIST on a symlink instead
 * of following it, which is a side effect of write-once rather than a
 * hardening step available to a file that is meant to be overwritten.
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
 * The overwrite has a torn-write window of its own, since `writeFile`
 * truncates before it writes: a crash mid-overwrite leaves a partial marker,
 * which the strict read then throws on rather than reporting as unaccepted.
 * That is the safe direction — a slot whose acceptance is in doubt refuses to
 * be read rather than silently reverting — but it does mean a previously
 * accepted slot can become unreadable until the marker is rewritten or
 * removed. Untreated, as it is in `storage/elements.ts`, which overwrites its
 * file the same way — the two whole-file mutable surfaces share this window.
 * The other storage writers have differently shaped ones because they append
 * or write once rather than replace.
 *
 * Two operations the spec calls for are absent, and §3.0 places them
 * differently. Unlinking this file — how §2.6 returns a slot to the unaccepted
 * state, through either of its two trigger paths — is a write, and §3.0 makes
 * the physical writer the sole owner of a file's write implementation, naming
 * slice 20 here. So the unlink belongs to this module and nowhere else; it
 * waits because un-accept's other leg clears `elements.accepted`, making its
 * shape the same Phase C dual-write question as accept itself. Listing is a
 * read, and §3.0's reader definition explicitly allows a reader to read
 * directly, so slice 22 — which iterates `approved/*` unconditionally — may
 * legitimately open-code a `readdir`. A listing primitive here would be
 * drift-prevention rather than ownership, and it waits on a question of its
 * own: its shape (slot names or parsed markers, and how it treats non-file and
 * symlinked entries) follows slice 21's `--slot`-vs-walk-all CLI, which does
 * not exist.
 *
 * The one real gap in the spec is narrower than either of those: §3.1 rows
 * 23/24 bind un-accept to a shortcut and a palette entry, but no cell of the
 * §3.0 row names them — its caller-writer column reads `20`, the accept side
 * only — while §3.0 claims to pair every file with every slice performing I/O
 * on it. Recorded in the rework plan.
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
