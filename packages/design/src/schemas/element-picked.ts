/**
 * Element-pick channel envelope.
 *
 * The postMessage envelope crosses an opaque-origin sandbox boundary
 * (variant iframes ship with `sandbox="allow-scripts"`), so the receiver
 * cannot trust `event.origin` and must validate the payload structurally
 * before acting on it. This module owns the schema + the inferred types
 * for both sides of the channel so the iframe-side sender and the
 * parent-side receiver agree on shape; tests import the same type rather
 * than redeclaring.
 *
 * Bounding-box uses `z.looseObject` as a forward-compat hedge: the
 * receiver only requires the four positioning fields used to anchor the
 * comment modal (`top`, `left`, `width`, `height`), so future channel
 * versions may add fields on either side without breaking the parse.
 * Field names use camelCase (sender constructs the payload from
 * `getBoundingClientRect()` which is camelCase per the CSSOM-View spec).
 */
import { z } from 'zod/mini';

export const ELEMENT_PICKED_TYPE = 'clancy:design:element-picked';

const boundingBoxSchema = z.looseObject({
  top: z.number(),
  left: z.number(),
  width: z.number(),
  height: z.number(),
});

const elementAnchorSchema = z.looseObject({
  selector: z.string(),
  tag: z.string(),
  textSnippet: z.string(),
  boundingBox: boundingBoxSchema,
});

export const elementPickedMessageSchema = z.looseObject({
  type: z.literal(ELEMENT_PICKED_TYPE),
  variantId: z.string(),
  anchor: elementAnchorSchema,
});

export type BoundingBox = z.infer<typeof boundingBoxSchema>;
export type ElementAnchor = z.infer<typeof elementAnchorSchema>;
export type ElementPickedMessage = z.infer<typeof elementPickedMessageSchema>;
