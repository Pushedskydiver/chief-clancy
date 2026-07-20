/**
 * JSONL append-only variant persistence — Phase F slice 21 prerequisite.
 *
 * Mirrors `storage/comments.ts` exactly: one variants file per session at
 * `<sessionDir>/variants.jsonl`, one self-contained `Variant` record per
 * line, append-only to avoid concurrent-write hazards. Missing file on read
 * is "no variants yet" (empty list); unparseable/crash-truncated lines are
 * skipped. Caller owns `sessionDir` lifecycle — same traversal caveat as
 * `comments.ts` (validate `sessionDir` is within the canvas-session root
 * before calling either function).
 *
 * Exists so `write/source.ts` (slice 21) can look up a variant's actual
 * HTML by id — nothing else in the package persists generated variants
 * today (they're transient in-memory objects produced by `generate()`/
 * `regenerate()`); wiring a caller to append on generation is deferred to
 * whichever slice wires the canvas server's generate flow end-to-end.
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
