/**
 * Zod schemas for Azure DevOps Pull Request API responses.
 */
import { z } from 'zod/mini';

/** A single PR from the pull requests list endpoint. */
const azdoPrSchema = z.object({
  pullRequestId: z.number(),
  status: z.optional(z.string()),
  reviewers: z.optional(
    z.array(
      z.object({
        vote: z.optional(z.number()),
        displayName: z.optional(z.string()),
        uniqueName: z.optional(z.string()),
      }),
    ),
  ),
});

/** Minimal fields from a PR creation response. */
export const azdoPrCreatedSchema = z.object({
  pullRequestId: z.optional(z.number()),
});

/** Response from `GET .../pullrequests?searchCriteria.sourceRefName=...`. */
export const azdoPrListSchema = z.object({
  value: z.array(azdoPrSchema),
  count: z.optional(z.number()),
});

/** Thread context — present for inline (file-level) comments, absent for general. */
const azdoThreadContextSchema = z.object({
  filePath: z.optional(z.string()),
});

/** A single comment inside a thread. */
const azdoCommentSchema = z.object({
  content: z.optional(z.string()),
  commentType: z.optional(z.string()),
  publishedDate: z.optional(z.string()),
});

/** A comment thread on a pull request. */
const azdoThreadSchema = z.object({
  id: z.number(),
  status: z.optional(z.string()),
  comments: z.array(azdoCommentSchema),
  threadContext: z.optional(z.nullable(azdoThreadContextSchema)),
  isDeleted: z.optional(z.boolean()),
  publishedDate: z.optional(z.string()),
});

/** Response from `GET .../pullRequests/{id}/threads`. */
export const azdoThreadListSchema = z.object({
  value: z.array(azdoThreadSchema),
  count: z.optional(z.number()),
});

/** Inferred type for an AzDO PR thread. */
export type AzdoThread = z.infer<typeof azdoThreadSchema>;
