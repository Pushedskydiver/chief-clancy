/**
 * Approval-marker schema — Phase F (UI-vision rework, slice A5).
 *
 * The accept marker persisted at `<sessionDir>/approved/<slot>` (spec §2.8).
 * Its presence marks the slot as accepted and its content names which variant
 * body was committed; slices 21 (`clancy:design write`) and 22 (handoff
 * bundle) read it back.
 *
 * `roundId` is what makes un-accept able to reconstruct "state at acceptance
 * time" without back-walking the round history in `elements/<slot>.json`
 * (§2.6). `sha` is taken over the accepted variant body, so it is the value a
 * drift check between marker and `variants/<variantId>.html` would compare
 * against — no slice performs that check today.
 *
 * `z.looseObject` for parity with `element-state.ts` / `thread-message.ts` /
 * `chat-message.ts` — a v0.1 reader round-trips unknown keys instead of
 * stripping them, so fields added by a later slice survive parse →
 * re-serialize without loss. The superseded per-variant marker shape
 * (`{variantId, sessionId, approvedAt, sha256, approverPid}`) still fails the
 * parse: it carries none of `roundId` / `sha` / `ts`, and looseObject forgives
 * only *extra* keys, never missing ones.
 */
import { z } from 'zod/mini';

export const approvalMarkerSchema = z.looseObject({
  variantId: z.string(),
  roundId: z.string(),
  sha: z.string(),
  ts: z.string(),
});

export type ApprovalMarker = z.infer<typeof approvalMarkerSchema>;
