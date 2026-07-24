import { chmod, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readVariantHtml, writeVariantHtml } from './variants.js';

const HTML = '<section class="hero"><h1>Welcome to Pricing</h1></section>';

describe('variant-body persistence', () => {
  let sessionDir: string;

  beforeEach(async () => {
    sessionDir = await mkdtemp(join(tmpdir(), 'clancy-design-variants-'));
  });

  afterEach(async () => {
    await rm(sessionDir, { recursive: true, force: true });
  });

  it('writes variants/{variantId}.html and reads the body back verbatim', async () => {
    await writeVariantHtml(sessionDir, 'A1', HTML);

    // The on-disk path is the contract slices 13/14/22 read by, so pin it
    // directly rather than only round-tripping through this module.
    expect(
      await readFile(join(sessionDir, 'variants', 'A1.html'), 'utf8'),
    ).toBe(HTML);
    expect(await readVariantHtml(sessionDir, 'A1')).toBe(HTML);
  });

  it('returns null when the variant body has not been written yet', async () => {
    // Not a hypothetical: §2.8 records a variant as `status: "generating"` in
    // elements/{slot}.json before its body lands, so a reader that resolves
    // that pointer legitimately finds no file.
    expect(await readVariantHtml(sessionDir, 'B2')).toBeNull();
  });

  it('rejects a variantId that is not a single id-shaped path segment', async () => {
    // `variant.id` is scraped from raw model output by `generate/single.ts`,
    // whose header + attribute regexes between them admit every byte but `"`
    // and `>` — so these are reachable inputs, not just defensive ones.
    // `x/../y` would otherwise normalise onto variant `y`; `''` would open a
    // real file named `.html`.
    const rejected = ['../../evil', 'x/../y', '', 'sub/variant', '.'];

    await Promise.all(
      rejected.flatMap((variantId) => [
        expect(writeVariantHtml(sessionDir, variantId, HTML)).rejects.toThrow(
          /is not a valid variant id/,
        ),
        expect(readVariantHtml(sessionDir, variantId)).rejects.toThrow(
          /is not a valid variant id/,
        ),
      ]),
    );
  });

  it('refuses a second write under the same id instead of clobbering the first body', async () => {
    // Variant ids are session-unique, not round-unique (§2.2 / §3.1 row 11):
    // a locked variant carries into the next round keeping both its id and
    // its body, so a same-id rewrite means an id-space collision, and
    // overwriting would silently swap a locked variant's body underneath the
    // elements/{slot}.json pointer still naming it.
    await writeVariantHtml(sessionDir, 'A1', HTML);

    await expect(
      writeVariantHtml(sessionDir, 'A1', '<section>a different body</section>'),
    ).rejects.toThrow(/already exists/);

    expect(await readVariantHtml(sessionDir, 'A1')).toBe(HTML);
  });

  it('rethrows a write failure without leaving the id unwritable', async () => {
    // An unwritable variants/ dir fails the exclusive create itself, so the
    // cleanup has nothing to remove — which is the case that proves it does
    // not mask the real error or trip over the absent file.
    await mkdir(join(sessionDir, 'variants'), { recursive: true });
    await chmod(join(sessionDir, 'variants'), 0o500);

    try {
      await expect(
        writeVariantHtml(sessionDir, 'A1', HTML),
      ).rejects.toMatchObject({ code: 'EACCES' });
    } finally {
      await chmod(join(sessionDir, 'variants'), 0o700);
    }

    // The failure left nothing behind, so the id is still free to write.
    await writeVariantHtml(sessionDir, 'A1', HTML);
    expect(await readVariantHtml(sessionDir, 'A1')).toBe(HTML);
  });

  it('rethrows a non-ENOENT read error instead of reporting an absent body', async () => {
    // Make the target path a directory so readFile rejects with EISDIR — a
    // non-ENOENT error that must propagate, not be swallowed as "not
    // generated yet", which would render an empty variant with no error.
    await mkdir(join(sessionDir, 'variants', 'A1.html'), { recursive: true });

    await expect(readVariantHtml(sessionDir, 'A1')).rejects.toMatchObject({
      code: 'EISDIR',
    });
  });

  it('adds no trailing newline to a body that already ends in one', async () => {
    // The property test below puts this case in range but cannot guarantee
    // any single run draws it, and it is the one shape where an appended
    // newline would be easiest to miss by eye.
    const endsInNewline = '<p>trailing</p>\n';
    await writeVariantHtml(sessionDir, 'A1', endsInNewline);

    expect(
      await readFile(join(sessionDir, 'variants', 'A1.html'), 'utf8'),
    ).toBe(endsInNewline);
  });

  it('round-trips arbitrary markup byte-for-byte, adding no trailing newline', async () => {
    // Byte-exactness is load-bearing, not cosmetic: `storage/approve.ts`
    // records a sha over the variant body, so any byte this module adds or
    // drops makes the accept marker disagree with the file on disk. Whole-file
    // I/O has no line framing to hide behind — unlike the JSONL modules, the
    // delimiters below are just content. `fc.string()` is printable-ASCII and
    // emits no newline at all (measured 0 in 2000 samples by A2, re-measured
    // here), so the alphabet is spelled out to put newlines and a multi-byte
    // char in range at all — no single run is guaranteed to draw them, which
    // is why the newline-terminated case above is pinned separately. The
    // empty string is in range on purpose: it must read back as `''` (a body
    // that is present but empty), never as `null`.
    const messyHtml = fc
      .array(
        fc.constantFrom(
          '<p>a</p>',
          '\n',
          '\r\n',
          '"',
          '\\',
          '\t',
          '😀',
          '</script>',
          ' ',
        ),
        { maxLength: 16 },
      )
      .map((parts) => parts.join(''));

    await fc.assert(
      fc.asyncProperty(messyHtml, async (html) => {
        const dir = await mkdtemp(join(tmpdir(), 'clancy-design-variants-fc-'));
        try {
          await writeVariantHtml(dir, 'A1', html);

          expect(await readVariantHtml(dir, 'A1')).toBe(html);
          expect(await readFile(join(dir, 'variants', 'A1.html'), 'utf8')).toBe(
            html,
          );
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }),
      { numRuns: 25 },
    );
  });
});
