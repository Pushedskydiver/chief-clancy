/**
 * Element-state schema — Phase F (UI-vision rework, slice A1).
 *
 * Per-element mutable session state persisted at
 * `<sessionDir>/elements/<slot>.json` (spec §2.8): the round history with
 * per-variant lock + generation status, the current soft-selection, and
 * the structured `accepted` pointer (`null` until a variant is accepted;
 * structured so un-accept can reconstruct state-at-acceptance without
 * back-walking rounds). Unlike the append-only JSONL surfaces, this file
 * is overwritten wholesale on every state change.
 *
 * `z.looseObject` for parity with `comment.ts` / `design.ts` — a v0.1
 * reader round-trips unknown keys instead of stripping them, so fields
 * added by a later slice survive parse → re-serialize without loss.
 */
import { z } from 'zod/mini';

const variantStateSchema = z.looseObject({
  id: z.string(),
  sha: z.string(),
  isLocked: z.boolean(),
  status: z.enum(['generating', 'ready', 'failed']),
});

const roundSchema = z.looseObject({
  roundId: z.string(),
  variants: z.array(variantStateSchema),
});

const acceptedSchema = z.looseObject({
  variantId: z.string(),
  roundId: z.string(),
  ts: z.string(),
});

export const elementStateSchema = z.looseObject({
  slot: z.string(),
  threadId: z.string(),
  rounds: z.array(roundSchema),
  softSelected: z.string(),
  accepted: z.nullable(acceptedSchema),
});

export type ElementState = z.infer<typeof elementStateSchema>;
