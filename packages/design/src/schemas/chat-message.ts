/**
 * Chat-message schema — Phase F (UI-vision rework, slice A3).
 *
 * One line of the global conversation log at `<sessionDir>/chat.jsonl`
 * (spec §2.8): the single source of truth for the page-level chat, and the
 * canonical record of message *content* that the per-thread files
 * denormalise (§2.8 "Why the file split").
 *
 * A page-level message ("change the overall aesthetic to more brutalist")
 * carries just `ts` / `kind` / `body`. An element-scoped message also
 * carries `threadRef` + `slotRef`, and its `body` is tagged with the
 * `[threadId] slot ` prefix (§2.8 body-normalisation rule) — the bare text
 * lives on the `threads/{threadId}.jsonl` side. `threadRef` / `slotRef` are
 * typed as independent optionals to match the §2.8 wire signature; that an
 * element-scoped line always carries both is enforced by the write side
 * (via `toChatBody`), not re-encoded as a cross-field schema refinement.
 *
 * `kind` is closed to `user | assistant`, identical to `thread-message.ts`
 * — §2.8 shows no other author on either surface, and because reads are
 * strict (`storage/chat.ts`), an unexpected `kind` throws on read rather
 * than being silently ignored. A future `system` author would be added to
 * both schemas together, deliberately.
 *
 * `ts` is an ISO-8601 string minted by the caller, not here: a single user
 * action writes one chat line and one thread line, and the pair must share
 * a timestamp — see `storage/chat.ts` and the rework plan's clock note.
 *
 * `z.looseObject` for parity with `thread-message.ts` / `element-state.ts`
 * / `design.ts` — a v0.1 reader round-trips unknown keys instead of
 * stripping them, so fields added by a later slice survive parse →
 * re-serialize without loss.
 */
import { z } from 'zod/mini';

export const chatMessageSchema = z.looseObject({
  ts: z.string(),
  kind: z.enum(['user', 'assistant']),
  body: z.string(),
  threadRef: z.optional(z.string()),
  slotRef: z.optional(z.string()),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
