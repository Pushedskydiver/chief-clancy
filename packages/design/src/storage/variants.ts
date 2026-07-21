/**
 * JSONL append-only variant persistence — Phase F slice 21 prerequisite.
 *
 * Mirrors `storage/comments.ts`'s shape: one variants file per session at
 * `<sessionDir>/variants.jsonl`, one self-contained `Variant` record per
 * line, append-only to avoid concurrent-write hazards. Missing file on read
 * is "no variants yet" (empty list); unparseable/crash-truncated lines are
 * skipped. Caller owns `sessionDir` lifecycle — same traversal caveat as
 * `comments.ts` (validate `sessionDir` is within the canvas-session root
 * before calling either function). Not a byte-for-byte mirror: `Variant`
 * is validated here against `schemas/variant.ts`, a separate schema from
 * `comments.ts`'s self-derived `Comment` type — see that schema's TSDoc.
 *
 * Closes the storage half of the gap blocking `write/source.ts` (slice
 * 21): nothing else in the package persists a variant's HTML today, so
 * there was no way to look up one by id. This does NOT close the other
 * half — no caller appends on generation yet, since
 * `canvas/server/createServer.ts` doesn't invoke `generate()`/
 * `regenerate()` at all (verified: it only imports the `MessagesClient`
 * type). `readVariants` will return `[]` for any real session until that
 * live-generation wiring lands. Slice 21 itself can still be built and
 * tested against directly-constructed fixtures (this package's standard
 * mocked-SDK testing posture — see `generate/*.test.ts`), same as every
 * other slice before the canvas SPA build-target gap
 * (`.claude/research/canvas-spa-build-target/spec.md`) closes.
 */
import type { Variant } from '../generate/types.js';

import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod/mini';

import { variantSchema } from '../schemas/variant.js';

const VARIANTS_FILENAME = 'variants.jsonl';

const isNodeFsError = (err: unknown): err is NodeJS.ErrnoException =>
  typeof err === 'object' && err !== null && 'code' in err;

export async function appendVariant(
  sessionDir: string,
  variant: Variant,
): Promise<void> {
  const path = join(sessionDir, VARIANTS_FILENAME);
  await appendFile(path, JSON.stringify(variant) + '\n', 'utf8');
}

export async function readVariants(
  sessionDir: string,
): Promise<readonly Variant[]> {
  const path = join(sessionDir, VARIANTS_FILENAME);
  const raw = await readFile(path, 'utf8').catch(
    (err: unknown): string | null => {
      if (isNodeFsError(err) && err.code === 'ENOENT') return null;
      throw err;
    },
  );
  if (raw === null) return [];

  return raw
    .split('\n')
    .filter((line) => line.length > 0)
    .flatMap((line): readonly Variant[] => {
      try {
        return [z.parse(variantSchema, JSON.parse(line))];
      } catch {
        return [];
      }
    });
}
