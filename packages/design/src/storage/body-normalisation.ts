/**
 * Body normalisation between `chat.jsonl` and `threads/{threadId}.jsonl`
 * — Phase F (UI-vision rework, slice A3; spec §2.8 body-normalisation rule).
 *
 * A single element-scoped user action writes to two files: the global chat
 * log carries a body tagged with `[{threadId}] {slot} ` so the flat
 * conversation stays readable, and the per-thread file carries the bare
 * text so a thread view reads without redundant tagging on every line.
 * These two functions are the sole definition of that prefix, so the write
 * side (`storage/chat.ts` callers) and the lossy reconstruction side
 * (§2.8) can never disagree on its exact shape.
 *
 * `toChatBody` and `toThreadBody` are exact inverses:
 *
 *   toThreadBody(id, slot, toChatBody(id, slot, body)) === body
 *
 * for every `body` — including one that itself begins with a copy of the
 * prefix — because `toThreadBody` removes exactly one prefix's worth of
 * characters and no more. Both take `threadId` and `slot` explicitly and
 * reconstruct the exact prefix rather than parsing brackets out of the
 * body, so a `slot` containing spaces (a CSS descendant selector like
 * `nav ul li`) is unambiguous — provided the *exact* slot is passed. The
 * disambiguation is by slot-equality, not slot-containment: a shorter
 * space-prefixed slot (`nav` against a body tagged for `nav ul li`) would
 * mis-strip rather than throw. That never arises because the `slotRef`
 * handed to `toThreadBody` comes from the same record that produced the
 * tag, so it is exact by construction.
 *
 * `toThreadBody` throws when the prefix is absent rather than returning the
 * input unchanged. It is only ever called on a chat line the record marks
 * element-scoped (`threadRef` set), which by the write-side invariant
 * carries the prefix; its absence — or a prefix for a different thread or
 * slot — is corruption to surface, consistent with the strict-read stance
 * of `storage/chat.ts` and `storage/threads.ts`.
 */

function chatPrefix(threadId: string, slot: string): string {
  return `[${threadId}] ${slot} `;
}

/** Bare thread body → tagged `chat.jsonl` body. */
export function toChatBody(
  threadId: string,
  slot: string,
  body: string,
): string {
  return chatPrefix(threadId, slot) + body;
}

/** Tagged `chat.jsonl` body → bare thread body (throws if not so tagged). */
export function toThreadBody(
  threadId: string,
  slot: string,
  chatBody: string,
): string {
  const prefix = chatPrefix(threadId, slot);
  if (!chatBody.startsWith(prefix)) {
    throw new Error(
      `body normalisation: chat body is not tagged for thread "${threadId}" slot "${slot}"`,
    );
  }
  return chatBody.slice(prefix.length);
}
