/**
 * Variant record schema — Phase F slice 21 prerequisite.
 *
 * Validates JSONL round-trips through `storage/variants.ts`. `generate/
 * types.ts`'s `Variant` type stays the hand-written source of truth for the
 * SDK-facing generation code (single-call/parallel/regenerate) — this schema
 * exists only at the storage boundary, matching `schemas/comment.ts`'s role
 * for `storage/comments.ts`. Field set is kept identical to `Variant` so a
 * parsed record is structurally assignable without a cast.
 *
 * `z.looseObject` for parity with `comment.ts`/`design.ts` — round-trips
 * unknown keys instead of stripping them.
 */
import { z } from 'zod/mini';

export const variantSchema = z.looseObject({
  id: z.string(),
  seed: z.string(),
  html: z.string(),
  rationale: z.string(),
});
