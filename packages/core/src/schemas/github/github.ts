/**
 * Zod schemas for GitHub Issues REST API responses.
 */
import { z } from 'zod/mini';

/** A single GitHub issue from the list endpoint. */
export const githubIssueSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.optional(z.nullable(z.string())),
  pull_request: z.optional(z.unknown()),
  milestone: z.optional(
    z.nullable(
      z.object({
        title: z.string(),
      }),
    ),
  ),
  labels: z.optional(
    z.array(
      z.object({
        name: z.optional(z.string()),
      }),
    ),
  ),
});

/** Response from `GET /repos/{owner}/{repo}/issues` (array of issues). */
export const githubIssuesResponseSchema = z.array(githubIssueSchema);

/** A single GitHub issue comment from the comments endpoint. */
export const githubCommentSchema = z.object({
  id: z.number(),
  body: z.optional(z.nullable(z.string())),
  created_at: z.string(),
  user: z.optional(z.object({ login: z.string() })),
});

/** Response from `GET /repos/{owner}/{repo}/issues/{number}/comments`. */
export const githubCommentsResponseSchema = z.array(githubCommentSchema);

/** A single PR from the list endpoint. */
export const githubPrSchema = z.object({
  number: z.number(),
  html_url: z.string(),
  state: z.string(),
});

/** Response from `GET /repos/{owner}/{repo}/pulls` (array of PRs). */
export const githubPrListSchema = z.array(githubPrSchema);

/** A single review on a PR. */
export const githubReviewSchema = z.object({
  state: z.string(),
  user: z.object({ login: z.string() }),
  submitted_at: z.string(),
});

/** Response from `GET /repos/{owner}/{repo}/pulls/{number}/reviews`. */
export const githubReviewListSchema = z.array(githubReviewSchema);

/** A single inline (pull request) comment. */
export const githubPrCommentSchema = z.object({
  body: z.optional(z.nullable(z.string())),
  path: z.optional(z.string()),
  created_at: z.optional(z.string()),
  user: z.optional(z.object({ login: z.string() })),
});

/** Response from `GET /repos/{owner}/{repo}/pulls/{number}/comments`. */
export const githubPrCommentsSchema = z.array(githubPrCommentSchema);

/** Inferred type for a single GitHub issue. */
export type GitHubIssue = z.infer<typeof githubIssueSchema>;

/** Inferred type for the GitHub issues response. */
export type GitHubIssuesResponse = z.infer<typeof githubIssuesResponseSchema>;

/** Inferred type for a single GitHub comment. */
export type GitHubComment = z.infer<typeof githubCommentSchema>;

/** Inferred type for the GitHub comments response. */
export type GitHubCommentsResponse = z.infer<
  typeof githubCommentsResponseSchema
>;

/** Inferred type for a single GitHub PR. */
export type GitHubPr = z.infer<typeof githubPrSchema>;

/** Inferred type for the GitHub PR list response. */
export type GitHubPrList = z.infer<typeof githubPrListSchema>;

/** Inferred type for a single GitHub review. */
export type GitHubReview = z.infer<typeof githubReviewSchema>;

/** Inferred type for the GitHub review list response. */
export type GitHubReviewList = z.infer<typeof githubReviewListSchema>;

/** Inferred type for a single GitHub PR inline comment. */
export type GitHubPrComment = z.infer<typeof githubPrCommentSchema>;

/** Inferred type for the GitHub PR comments response. */
export type GitHubPrComments = z.infer<typeof githubPrCommentsSchema>;
