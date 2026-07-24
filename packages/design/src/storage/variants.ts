/**
 * Variant-body persistence — Phase F (UI-vision rework, slice A4).
 *
 * One file per generated variant at `<sessionDir>/variants/<variantId>.html`
 * (spec §2.8). The physical writer is the generation pipeline (slice 11);
 * slices 13 (composition), 14 (iframe render), and 22 (handoff bundle) read
 * bodies back by the `variantId` they find in `elements/<slot>.json`.
 *
 * Alone among the session-state modules, this one has no `schemas/` pair: a
 * variant body is opaque markup, not a record, so there is nothing to
 * validate it against. Nothing here parses the HTML. That also puts the
 * strict-read contract `storage/chat.ts` and `storage/threads.ts` share out
 * of scope — those are line-framed logs where a torn final line is
 * recognisable and every other line must parse; a whole-file body has no
 * framing, so a truncated write is simply shorter markup and cannot be
 * detected at this layer. The sha recorded alongside the accept marker
 * (`storage/approve.ts`) is where a body is checked against what was
 * approved.
 *
 * The body is therefore written verbatim — no trailing newline, unlike
 * `storage/elements.ts`'s pretty-printed JSON — so the bytes on disk are
 * byte-identical to the bytes hashed at accept time.
 *
 * `variants/` is a subdirectory, so writes mkdir it, as in
 * `storage/threads.ts` and `storage/elements.ts` (and unlike
 * `storage/chat.ts`, whose file sits directly in `sessionDir`). The
 * `recursive` mkdir will also materialise a missing `sessionDir`, so this
 * module does not enforce the caller-owns-the-session-directory expectation
 * that `storage/approve.ts` does by omission.
 *
 * Writes are once-only. Variant ids are unique across the session rather
 * than within a round (§2.2 future cherry-pick mode, §3.1 row 11), and a
 * locked variant carries into the next round keeping both its id and its
 * body (§2.6) — so a body is generated once and never mutated, and a second
 * write under a live id is an id-space collision rather than an update.
 * Overwriting would silently swap that body underneath every
 * `elements/{slot}.json` pointer still naming it, so the write fails
 * instead. A caller that genuinely needs to replace a body must remove the
 * file first, which keeps the destructive step explicit.
 *
 * `variantId` is held to an id-shaped charset rather than merely checked for
 * containment, because it interpolates into a filename and reaches this
 * module from the model's own output: `generate/single.ts` scrapes it with
 * `/\bid="([^"]+)"/`, which admits every byte but a quote. Containment alone
 * would silently normalise separators, so `x/../y` would alias onto variant
 * `y` and `''` would open a real file named `.html`. (`storage/elements.ts`
 * guards `slot` by containment instead — correctly, since a stable-selector
 * key like `h1.header` can't be held to a charset.)
 *
 * A missing file means "not generated yet" — legitimate state, since §2.8
 * records a variant as `status: "generating"` in `elements/{slot}.json`
 * before its body lands — and reads as `null`, distinct from `''` for a body
 * that exists and is empty. Other I/O failures (EACCES, EISDIR, ENOSPC)
 * propagate.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { isNodeFsError } from './fs-errors.js';

const VARIANTS_DIR = 'variants';

/**
 * A single portable path segment: non-empty, no separators, no dot segments.
 * The same shape `storage/threads.ts` holds `threadId` to.
 */
const VARIANT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Resolve `<sessionDir>/variants/<variantId>.html`, rejecting any `variantId`
 * that isn't a single id-shaped path segment.
 */
function variantPath(sessionDir: string, variantId: string): string {
  if (!VARIANT_ID_PATTERN.test(variantId)) {
    throw new Error(
      `variant storage: variant id "${variantId}" is not a valid variant id`,
    );
  }
  return join(sessionDir, VARIANTS_DIR, `${variantId}.html`);
}

export async function writeVariantHtml(
  sessionDir: string,
  variantId: string,
  html: string,
): Promise<void> {
  const path = variantPath(sessionDir, variantId);
  await mkdir(dirname(path), { recursive: true });
  // `wx` is the enforcement: a variant body is written once and never
  // mutated, so an existing file means two distinct variants claimed one id.
  await writeFile(path, html, { encoding: 'utf8', flag: 'wx' }).catch(
    (err: unknown) => {
      if (isNodeFsError(err) && err.code === 'EEXIST') {
        throw new Error(
          `variant storage: variant id "${variantId}" already has a body — variant ids must be unique across the session`,
          { cause: err },
        );
      }
      throw err;
    },
  );
}

export async function readVariantHtml(
  sessionDir: string,
  variantId: string,
): Promise<string | null> {
  return readFile(variantPath(sessionDir, variantId), 'utf8').catch(
    (err: unknown): string | null => {
      if (isNodeFsError(err) && err.code === 'ENOENT') return null;
      throw err;
    },
  );
}
