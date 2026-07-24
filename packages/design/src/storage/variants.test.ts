import type * as FsPromises from 'node:fs/promises';

import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readVariantHtml, writeVariantHtml } from './variants.js';

// Passthrough by default — every test below runs against the real filesystem.
// One test replaces `writeFile` for a single call to reach the
// failed-after-create branch, which no real-fs setup can trigger portably.
vi.mock('node:fs/promises', async (importActual) => {
  const actual = await importActual<typeof FsPromises>();
  return { ...actual, writeFile: vi.fn(actual.writeFile) };
});

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
    // and `>` — so the other four are inputs the model can actually emit,
    // not just defensive ones, and `x/../y` would otherwise normalise onto
    // variant `y`. `''` is the exception: `/\bid="([^"]+)"/` needs at least
    // one character, so an empty id fails the parse upstream and never
    // reaches here. It is guarded anyway, for a caller assembling the id
    // itself — it would otherwise open a real file named `.html`.
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

  it('rethrows a failure to create at all, surfacing the real errno', async () => {
    // An unwritable variants/ dir fails the exclusive create itself, so this
    // covers only that the original errno reaches the caller rather than
    // being converted into the collision error. It does NOT exercise the
    // post-create cleanup — nothing was created — which is why the ENOSPC
    // test below exists.
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

  it('removes the partial file when the write fails after the exclusive create', async () => {
    // The failure this guards is the one write-once makes permanent: the
    // create succeeds, the write dies partway, and the truncated body reads
    // back as valid markup forever after. Only reachable by making the write
    // itself fail, so `writeFile` is substituted for one call — the rest of
    // the module (mkdir, rm, readFile) stays on the real filesystem.
    const { writeFile: actualWriteFile } =
      await vi.importActual<typeof FsPromises>('node:fs/promises');

    vi.mocked(writeFile).mockImplementationOnce(async (path) => {
      // Exactly what an ENOSPC mid-write leaves behind: the file exists and
      // holds a prefix of the intended body.
      await actualWriteFile(path, '<section class="he', 'utf8');
      throw Object.assign(new Error('ENOSPC: no space left on device'), {
        code: 'ENOSPC',
      });
    });

    await expect(
      writeVariantHtml(sessionDir, 'A1', HTML),
    ).rejects.toMatchObject({ code: 'ENOSPC' });

    // Without the cleanup this reads back as a short-but-valid body, and the
    // id can never be written again.
    expect(await readVariantHtml(sessionDir, 'A1')).toBeNull();

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
