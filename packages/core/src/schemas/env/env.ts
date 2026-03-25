/**
 * Zod schemas for `.clancy/.env` configuration variables.
 *
 * Validates board credentials and shared Clancy settings at startup.
 */
import { z } from 'zod/mini';

/** A non-empty string — rejects `""` from the .env file. */
const nonEmpty = z.string().check(z.minLength(1));

/** A valid HTTP(S) URL. */
const httpUrl = z.string().check(z.regex(/^https?:\/\/.+/));

// ─── Shared optional env vars ────────────────────────────────────────────────

export const sharedEnvSchema = z.object({
  CLANCY_BASE_BRANCH: z.optional(z.string()),
  CLANCY_LABEL: z.optional(z.string()),
  CLANCY_MODEL: z.optional(z.string()),
  CLANCY_NOTIFY_WEBHOOK: z.optional(z.string()),
  CLANCY_STATUS_IN_PROGRESS: z.optional(z.string()),
  CLANCY_STATUS_DONE: z.optional(z.string()),
  CLANCY_STATUS_REVIEW: z.optional(z.string()),
  MAX_ITERATIONS: z.optional(z.string()),
  PLAYWRIGHT_ENABLED: z.optional(z.string()),
  PLAYWRIGHT_DEV_PORT: z.optional(z.string()),
  CLANCY_ROLES: z.optional(z.string()),
  CLANCY_PLAN_STATUS: z.optional(z.string()),
  CLANCY_PLAN_LABEL: z.optional(z.string()),
  CLANCY_PLAN_STATE_TYPE: z.optional(z.string()),
  CLANCY_STATUS_PLANNED: z.optional(z.string()),
  CLANCY_SKIP_COMMENTS: z.optional(z.string()),

  // Git host integration (for PR creation on non-GitHub boards)
  GITHUB_TOKEN: z.optional(z.string()),
  GITLAB_TOKEN: z.optional(z.string()),
  BITBUCKET_USER: z.optional(z.string()),
  BITBUCKET_TOKEN: z.optional(z.string()),
  AZDO_PAT: z.optional(z.string()),
  CLANCY_GIT_PLATFORM: z.optional(z.string()),
  CLANCY_GIT_API_URL: z.optional(z.string()),

  // QA rework loop
  CLANCY_MAX_REWORK: z.optional(z.string()),

  // Implementation mode
  CLANCY_TDD: z.optional(z.string()),

  // Strategist role
  CLANCY_MODE: z.optional(z.string()),
  CLANCY_BRIEF_ISSUE_TYPE: z.optional(z.string()),
  CLANCY_BRIEF_EPIC: z.optional(z.string()),
  CLANCY_COMPONENT: z.optional(z.string()),

  // Reliable autonomous mode
  CLANCY_FIX_RETRIES: z.optional(z.string()),
  CLANCY_VERIFY_COMMANDS: z.optional(z.string()),
  CLANCY_TOKEN_RATE: z.optional(z.string()),
  CLANCY_TIME_LIMIT: z.optional(z.string()),
  CLANCY_BRANCH_GUARD: z.optional(z.string()),

  // Pipeline stage labels
  CLANCY_LABEL_BRIEF: z.optional(z.string()),
  CLANCY_LABEL_PLAN: z.optional(z.string()),
  CLANCY_LABEL_BUILD: z.optional(z.string()),
});

// ─── Board-specific schemas ──────────────────────────────────────────────────

export const jiraEnvSchema = z.extend(sharedEnvSchema, {
  JIRA_BASE_URL: httpUrl,
  JIRA_USER: nonEmpty,
  JIRA_API_TOKEN: nonEmpty,
  JIRA_PROJECT_KEY: nonEmpty,
  CLANCY_JQL_STATUS: z.optional(z.string()),
  CLANCY_JQL_SPRINT: z.optional(z.string()),
});

export const githubEnvSchema = z.extend(sharedEnvSchema, {
  GITHUB_TOKEN: nonEmpty,
  GITHUB_REPO: nonEmpty,
});

export const linearEnvSchema = z.extend(sharedEnvSchema, {
  LINEAR_API_KEY: nonEmpty,
  LINEAR_TEAM_ID: nonEmpty,
});

export const shortcutEnvSchema = z.extend(sharedEnvSchema, {
  SHORTCUT_API_TOKEN: nonEmpty,
  SHORTCUT_WORKFLOW: z.optional(z.string()),
});

export const notionEnvSchema = z.extend(sharedEnvSchema, {
  NOTION_TOKEN: nonEmpty,
  NOTION_DATABASE_ID: nonEmpty,
  CLANCY_NOTION_STATUS: z.optional(z.string()),
  CLANCY_NOTION_TODO: z.optional(z.string()),
  CLANCY_NOTION_ASSIGNEE: z.optional(z.string()),
  CLANCY_NOTION_LABELS: z.optional(z.string()),
  CLANCY_NOTION_PARENT: z.optional(z.string()),
});

export const azdoEnvSchema = z.extend(sharedEnvSchema, {
  AZDO_ORG: nonEmpty,
  AZDO_PROJECT: nonEmpty,
  AZDO_PAT: nonEmpty,
  CLANCY_AZDO_STATUS: z.optional(z.string()),
  CLANCY_AZDO_WIT: z.optional(z.string()),
});

// ─── Inferred types ──────────────────────────────────────────────────────────

/** Inferred shared env type. */
export type SharedEnv = z.infer<typeof sharedEnvSchema>;

/** Inferred Jira env type. */
export type JiraEnv = z.infer<typeof jiraEnvSchema>;

/** Inferred GitHub env type. */
export type GitHubEnv = z.infer<typeof githubEnvSchema>;

/** Inferred Linear env type. */
export type LinearEnv = z.infer<typeof linearEnvSchema>;

/** Inferred Shortcut env type. */
export type ShortcutEnv = z.infer<typeof shortcutEnvSchema>;

/** Inferred Notion env type. */
export type NotionEnv = z.infer<typeof notionEnvSchema>;

/** Inferred Azure DevOps env type. */
export type AzdoEnv = z.infer<typeof azdoEnvSchema>;

// ─── Board config discriminated union ────────────────────────────────────────

/** Discriminated union mapping each board provider to its validated env. */
export type BoardConfig =
  | { readonly provider: 'jira'; readonly env: JiraEnv }
  | { readonly provider: 'github'; readonly env: GitHubEnv }
  | { readonly provider: 'linear'; readonly env: LinearEnv }
  | { readonly provider: 'shortcut'; readonly env: ShortcutEnv }
  | { readonly provider: 'notion'; readonly env: NotionEnv }
  | { readonly provider: 'azdo'; readonly env: AzdoEnv };
