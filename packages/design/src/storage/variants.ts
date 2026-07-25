/**
 * Variant-body persistence — Phase F (UI-vision rework, slice A4).
 *
 * One file per generated variant at `<sessionDir>/variants/<variantId>.html`
 * (spec §2.8). The physical writer is the generation pipeline (slice 11).
 * Slices 13 (composition) and 14 (iframe render) read bodies back by the
 * `variantId` they find in `elements/<slot>.json`; slice 22 (handoff bundle)
 * resolves its `variantId` from `approved/<slot>` instead (spec §3.1 row 22
 * — the §3.0 matrix does not list 22 as an `elements/` reader).
 *
 * Alone among the modules that read session state back, this one has no
 * `schemas/` pair: a variant body is opaque markup, not a record, so there
 * is nothing to validate it against. Nothing here parses the HTML. That also
 * puts the strict-read contract `storage/chat.ts` and `storage/threads.ts`
 * share out of scope — those are line-framed logs where a torn final line is
 * recognisable and every other line must parse; a whole-file body has no
 * framing, so a truncated write is simply shorter markup and cannot be
 * detected at this layer. Nor is it caught downstream today: `approve.ts`
 * records a sha over the body it was handed, but nothing reads that sha back
 * — whether `clancy:design write` (slice 21) re-checks it for drift is that
 * slice's open decision (`approve.ts` header). So the sha is what a drift
 * check *would* compare against, not a check that exists.
 *
 * The body is therefore written verbatim — no trailing newline, unlike
 * `storage/elements.ts`'s pretty-printed JSON — so the bytes on disk stay
 * byte-identical to the bytes hashed at accept time.
 *
 * `variants/` is a subdirectory, so writes mkdir it, as in
 * `storage/threads.ts`, `storage/elements.ts` and `storage/approve.ts`. The
 * `recursive` mkdir will also materialise a missing `sessionDir`, so this
 * module does not enforce the caller-owns-the-session-directory expectation
 * that `storage/chat.ts`, whose file sits directly in `sessionDir`, does by
 * omission.
 *
 * Writes are once-only. Variant ids are unique across the session rather
 * than within a round (§2.2 future cherry-pick mode, §3.1 row 11), and a
 * locked variant carries into the next round keeping both its id and its
 * body (§2.6) — so a body is generated once and never mutated, and a second
 * write under a live id is an id-space collision rather than an update.
 * Overwriting would silently swap that body underneath every
 * `elements/{slot}.json` pointer still naming it, so the write fails
 * instead.
 *
 * **The contract this puts on callers:** mint a fresh session-unique id for
 * every generated body. Neither shipped generation path does that yet —
 * `generate/parallel.ts` requests the fixed `['v1','v2','v3']` on every
 * call, and `generate/regenerate.ts` forwards the id of the variant being
 * iterated — so both collide from round 2 onward. Both have to change under
 * §3.1 row 11 regardless of this module; B1 (slice 11 rework) owns that.
 * A caller that genuinely needs to replace a body must remove the file
 * first, which keeps the destructive step explicit. The collision `throw`s
 * rather than returning a `Result` (`docs/CONVENTIONS.md` §Error Handling)
 * because a duplicate id is a minting bug in the caller, not a domain
 * outcome it can meaningfully branch on.
 *
 * A write that fails *after* the exclusive create — ENOSPC, EIO — would
 * otherwise leave a 0-byte or truncated file that write-once then makes
 * permanent, and a short body reads back as valid markup rather than as an
 * error, so the failed write removes it. That removal is best-effort, which
 * leaves two windows where residue survives and recovery is deleting the
 * file by hand: a process killed between the create and the write, and a
 * cleanup that itself fails (its error is swallowed in favour of the
 * original). Closing the first needs an atomic temp-then-link publish, which
 * is not worth the machinery until a caller exists to want it.
 *
 * `variantId` is held to an id-shaped charset rather than merely checked for
 * containment, because it interpolates into a filename and reaches this
 * module from the model's own output: `generate/single.ts` scrapes the
 * `<variant>` header with `/<variant\b([^>]*)>/` and the id out of it with
 * `/\bid="([^"]+)"/`, so between them every byte but `"` and `>` survives,
 * and only the `generateParallel` path re-checks the id against the one
 * requested. Containment alone would silently normalise separators, so
 * `x/../y` would alias onto variant `y` and `''` would open a real file
 * named `.html`. (`storage/elements.ts` guards `slot` by containment instead
 * — correctly, since a stable-selector key like `h1.header` can't be held to
 * a charset.) As in `storage/threads.ts`, the charset still admits the Win32
 * device names (`CON`, `NUL`, `COM1`…) — measured, they pass — and the
 * excuse made there, that the id is minted rather than user-supplied, does
 * *not* transfer to an id lifted from model output. What such an id does
 * under an exclusive create on Win32 is untested here, so treat it as an
 * open gap rather than a known-benign one.
 *
 * A missing file means "not generated yet" — legitimate state, since §2.8
 * records a variant as `status: "generating"` in `elements/{slot}.json`
 * before its body lands — and reads as `null`, distinct from `''` for a body
 * that exists and is empty. Whether an empty body is *worth* persisting is
 * generation's question, not storage's: `generate/single.ts` already trims
 * the captured markup, so rejecting `''` here would put a second definition
 * of "valid variant" in the wrong layer. Other I/O failures (EACCES, EISDIR,
 * ENOSPC) propagate.
 *
 * `writeVariantHtml` takes three positional parameters rather than an
 * options object — at the `max-params` limit in `docs/CONVENTIONS.md`, not
 * over it — so that it, `elements.ts`, `threads.ts` and `approve.ts`, the
 * four writers taking `(sessionDir, key, payload)`, keep one shape. Both mis-orderings
 * that shape invites are caught by the charset guard, which sits on the
 * second parameter: swapping the id and the payload puts markup there, and
 * swapping `sessionDir` and the id puts a path there. The second is caught
 * only because a session directory isn't id-shaped — a caller passing a
 * bare id-shaped `sessionDir` would slip through.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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
  // `wx` is the enforcement, and it is one atomic `O_CREAT|O_EXCL` rather
  // than an exists-then-write race: a variant body is written once and never
  // mutated, so anything already at this path means two distinct variants
  // claimed one id.
  await writeFile(path, html, { encoding: 'utf8', flag: 'wx' }).catch(
    async (err: unknown) => {
      if (isNodeFsError(err) && err.code === 'EEXIST') {
        throw new Error(
          `variant storage: variants/${variantId}.html already exists — variant ids must be unique across the session`,
          { cause: err },
        );
      }

      // The exclusive create may already have succeeded when the write
      // failed, leaving residue that write-once would make permanent. Drop
      // it so the id stays writable; `force` no-ops in the usual case where
      // the create is what failed and no file exists. Cleanup failure is
      // swallowed because the original error is the one worth reporting.
      //
      // This is not free: a failure that precedes the `O_EXCL` check rather
      // than following it — fd exhaustion, measured with EMFILE, and ENFILE
      // by the same argument — reports something other than EEXIST while a
      // body does exist at the path, and the cleanup then deletes it.
      // `open(path, 'wx')` would close this properly: it is the same atomic
      // create, but it yields a handle only when this call made the file, so
      // the cleanup becomes provably scoped to it. Deferred rather than
      // dismissed — it also moves the failure seam the ENOSPC test injects
      // at, and the trigger needs ~92k open fds in a single-process local
      // CLI. Worth revisiting if a second write-side module wants the shape.
      await rm(path, { force: true }).catch(() => undefined);
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
