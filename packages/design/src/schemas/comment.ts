/**
 * Comment record schema — Phase F slice 18.
 *
 * Anchors a user comment to an overlay-picked element (slice 17 channel)
 * and tracks lifecycle status across regeneration cycles. The `anchor`
 * field reuses `elementAnchorSchema` so the picked-element payload from
 * the iframe overlay can flow straight into the persisted record without
 * a shape conversion.
 */
import { z } from 'zod/mini';

import { elementAnchorSchema } from './element-picked.js';

export const commentSchema = z.object({
  id: z.string(),
  variantId: z.string(),
  anchor: elementAnchorSchema,
  text: z.string(),
  status: z.enum(['open', 'addressed', 'stale']),
  createdAt: z.string(),
  addressedAt: z.optional(z.string()),
  addressedByVariantId: z.optional(z.string()),
});

export type Comment = z.infer<typeof commentSchema>;
