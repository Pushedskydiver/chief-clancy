/**
 * Variant regeneration with comments context — Phase F slice 19.
 *
 * Composes slice 10's `generate()` with the slice 18 `Comment` record
 * shape: filters the supplied comment list to those that are (a) `status
 * === 'open'` and (b) anchored to the target `variantId`, serialises
 * each as a JSONL line, and threads the resulting block into
 * `generate()`'s `comments` field per spec §Phase 4 — Iteration loop
 * step 6 ("Comments: [JSONL contents filtered to status='open']") and
 * §Phase 4 — Open risks → Multi-variant comment lifecycle (the
 * single-variantId default that v0.2 may revisit).
 *
 * `priorVariant` is required here (vs optional on `GenerateInput`) —
 * regeneration by definition iterates on a prior render, so a caller
 * that lacks one should call `generate()` directly.
 *
 * Each comment's `anchor.selector` (typically
 * `"[data-clancy-slot='<id>']"` per slice 16 `computeStableSelector`
 * 4-tier preference) tells Claude which element the user picked.
 * The (now tightened) shared system prompt in `single.ts` instructs
 * Claude to preserve existing `data-clancy-slot` values on retained
 * elements, so selector strings remain resolvable across iterations.
 *
 * When no open comments match the target variantId, the `comments`
 * field is left undefined so `generate()` skips the
 * "User comments to address:" header rather than emitting an empty
 * one — an empty block would mislead Claude into looking for
 * directives that aren't there.
 *
 * **Forwarding shape.** The call site spreads the residual input fields
 * into `generate()` rather than naming each one, so any future
 * `GenerateInput` growth (e.g. a `temperature` knob) flows through
 * without an explicit per-field update here. The only fields this
 * module deliberately rebinds are `comments` (transformed from
 * `readonly Comment[]` to the JSONL string) and the structurally
 * unchanged `priorVariant` (re-narrowed from optional to required at
 * the `RegenerateInput` type level, not at the call site).
 */
import type { Comment } from '../schemas/comment.js';
import type { GenerateInput, MessagesClient, Variant } from './single.js';

import { generate } from './single.js';

type RegenerateInput = Omit<GenerateInput, 'priorVariant' | 'comments'> & {
  readonly priorVariant: string;
  readonly comments: readonly Comment[];
};

const findOpenMatchingComments = (
  comments: readonly Comment[],
  variantId: string,
): readonly Comment[] =>
  comments.filter((c) => c.status === 'open' && c.variantId === variantId);

const buildCommentsBlock = (
  selected: readonly Comment[],
): string | undefined =>
  selected.length === 0
    ? undefined
    : selected.map((c) => JSON.stringify(c)).join('\n');

export async function regenerate(
  input: RegenerateInput,
  client: MessagesClient,
): Promise<Variant> {
  const selected = findOpenMatchingComments(input.comments, input.variantId);
  return generate({ ...input, comments: buildCommentsBlock(selected) }, client);
}
