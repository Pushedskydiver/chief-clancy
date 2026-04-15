/**
 * Zod schemas for Bitbucket PR API responses (Cloud and Server).
 */
import { z } from 'zod/mini';

// ─── Bitbucket Cloud ────────────────────────────────────────────────────────

/** A single PR from the Cloud list endpoint. */
const bitbucketPrSchema = z.object({
  id: z.number(),
  links: z.object({
    html: z.optional(z.object({ href: z.optional(z.string()) })),
  }),
  participants: z.array(
    z.object({
      state: z.optional(z.string()),
      role: z.string(),
    }),
  ),
});

/** Response from `GET /repositories/{workspace}/{slug}/pullrequests`. */
export const bitbucketPrListSchema = z.object({
  values: z.array(bitbucketPrSchema),
});

/** Minimal fields from a Cloud PR creation response. */
export const bitbucketPrCreatedSchema = z.object({
  id: z.optional(z.number()),
  links: z.optional(
    z.object({ html: z.optional(z.object({ href: z.optional(z.string()) })) }),
  ),
});

/** A single comment on a Cloud PR. */
const bitbucketCommentSchema = z.object({
  content: z.object({ raw: z.string() }),
  inline: z.optional(z.object({ path: z.optional(z.string()) })),
  created_on: z.string(),
  user: z.optional(z.object({ nickname: z.optional(z.string()) })),
});

/** Response from `GET .../pullrequests/{id}/comments`. */
export const bitbucketCommentsSchema = z.object({
  values: z.array(bitbucketCommentSchema),
});

// ─── Bitbucket Server / Data Center ─────────────────────────────────────────

/** A single PR from the Server list endpoint. */
const bitbucketServerPrSchema = z.object({
  id: z.number(),
  links: z.object({
    self: z.optional(z.array(z.object({ href: z.optional(z.string()) }))),
  }),
  reviewers: z.array(z.object({ status: z.string() })),
});

/** Response from `GET .../pull-requests` (Server). */
export const bitbucketServerPrListSchema = z.object({
  values: z.array(bitbucketServerPrSchema),
});

/** Minimal fields from a Server PR creation response. */
export const bitbucketServerPrCreatedSchema = z.object({
  id: z.optional(z.number()),
  links: z.optional(
    z.object({
      self: z.optional(z.array(z.object({ href: z.optional(z.string()) }))),
    }),
  ),
});

/** A comment nested inside a Server activity. */
const bitbucketServerCommentSchema = z.object({
  text: z.string(),
  anchor: z.optional(z.object({ path: z.optional(z.string()) })),
  createdDate: z.number(),
  author: z.optional(z.object({ slug: z.optional(z.string()) })),
});

/** A single activity on a Server PR. */
const bitbucketServerActivitySchema = z.object({
  action: z.string(),
  comment: z.optional(bitbucketServerCommentSchema),
});

/** Response from `GET .../pull-requests/{id}/activities` (Server). */
export const bitbucketServerActivitiesSchema = z.object({
  values: z.array(bitbucketServerActivitySchema),
});

// ─── Inferred types ─────────────────────────────────────────────────────────

/** Inferred type for a Bitbucket Cloud comment. */
export type BitbucketComment = z.infer<typeof bitbucketCommentSchema>;

/** Inferred type for a Bitbucket Server comment. */
export type BitbucketServerComment = z.infer<
  typeof bitbucketServerCommentSchema
>;
