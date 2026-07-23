/**
 * Thread-message schema — Phase F (UI-vision rework, slice A2).
 *
 * One line of the per-element thread log at
 * `<sessionDir>/threads/<threadId>.jsonl` (spec §2.8). The file is an
 * append-only denormalised view of a single element's conversation.
 *
 * `slot` is carried on every line so the file loads standalone during
 * recovery, without back-reading `chat.jsonl` or the `threadId` pointer in
 * `elements/<slot>.json`. `tag` + `textSnippet` are the anchor fallbacks
 * used when the slot disappears between rounds (§2.11), and `status`
 * tracks that lifecycle: `active` (anchor resolves) → `stale` (anchor
 * missing this round) → `reanchored` (user re-picked a slot).
 *
 * `body` is the bare message text — the `[threadId] slot ` prefix belongs
 * to the `chat.jsonl` side of the pair (§2.8 body-normalisation rule), so
 * the per-thread view reads without redundant tagging on every line.
 *
 * `z.looseObject` for parity with `element-state.ts` / `comment.ts` /
 * `design.ts` — a v0.1 reader round-trips unknown keys instead of
 * stripping them, so fields added by a later slice survive parse →
 * re-serialize without loss.
 */
import { z } from 'zod/mini';

export const threadMessageSchema = z.looseObject({
  ts: z.string(),
  kind: z.enum(['user', 'assistant']),
  slot: z.string(),
  tag: z.string(),
  textSnippet: z.string(),
  status: z.enum(['active', 'stale', 'reanchored']),
  body: z.string(),
});

export type ThreadMessage = z.infer<typeof threadMessageSchema>;
