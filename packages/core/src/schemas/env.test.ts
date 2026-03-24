import { describe, expect, it } from 'vitest';
import { z } from 'zod/mini';

import {
  azdoEnvSchema,
  githubEnvSchema,
  jiraEnvSchema,
  linearEnvSchema,
  notionEnvSchema,
  sharedEnvSchema,
  shortcutEnvSchema,
} from './env.js';

/** Minimal shared env — all fields optional, so empty object is valid. */
const SHARED_BASE = {};

/** Omit a key from an object without triggering no-unused-vars. */
const omit = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  key: K,
): Omit<T, K> => {
  const copy = { ...obj };
  delete copy[key];
  return copy;
};

/** Helper: parse and assert success. */
const expectSuccess = (
  schema: Parameters<typeof z.safeParse>[0],
  data: unknown,
): void => {
  const result = z.safeParse(schema, data);
  expect(result.success).toBe(true);
};

/** Helper: parse and assert failure. */
const expectFailure = (
  schema: Parameters<typeof z.safeParse>[0],
  data: unknown,
): void => {
  const result = z.safeParse(schema, data);
  expect(result.success).toBe(false);
};

// ─── Shared env schema ───────────────────────────────────────────────────────

describe('sharedEnvSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expectSuccess(sharedEnvSchema, {});
  });

  it('accepts all shared fields', () => {
    expectSuccess(sharedEnvSchema, {
      CLANCY_BASE_BRANCH: 'main',
      CLANCY_LABEL: 'clancy:build',
      CLANCY_MODEL: 'sonnet',
      CLANCY_NOTIFY_WEBHOOK: 'https://hooks.slack.com/abc',
      CLANCY_STATUS_IN_PROGRESS: 'In Progress',
      CLANCY_STATUS_DONE: 'Done',
      CLANCY_STATUS_REVIEW: 'Review',
      MAX_ITERATIONS: '5',
      PLAYWRIGHT_ENABLED: 'true',
      PLAYWRIGHT_DEV_PORT: '3000',
      CLANCY_ROLES: 'implementer,reviewer',
    });
  });

  it('rejects non-string values', () => {
    expectFailure(sharedEnvSchema, { CLANCY_BASE_BRANCH: 42 });
  });
});

// ─── Jira env schema ─────────────────────────────────────────────────────────

describe('jiraEnvSchema', () => {
  const VALID_JIRA = {
    ...SHARED_BASE,
    JIRA_BASE_URL: 'https://myorg.atlassian.net',
    JIRA_USER: 'user@example.com',
    JIRA_API_TOKEN: 'token-123',
    JIRA_PROJECT_KEY: 'PROJ',
  };

  it('accepts valid Jira credentials', () => {
    expectSuccess(jiraEnvSchema, VALID_JIRA);
  });

  it('accepts optional JQL fields', () => {
    expectSuccess(jiraEnvSchema, {
      ...VALID_JIRA,
      CLANCY_JQL_STATUS: 'To Do',
      CLANCY_JQL_SPRINT: 'Sprint 1',
    });
  });

  it('rejects missing JIRA_BASE_URL', () => {
    expectFailure(jiraEnvSchema, omit(VALID_JIRA, 'JIRA_BASE_URL'));
  });

  it('rejects empty JIRA_USER', () => {
    expectFailure(jiraEnvSchema, { ...VALID_JIRA, JIRA_USER: '' });
  });

  it('rejects empty JIRA_API_TOKEN', () => {
    expectFailure(jiraEnvSchema, { ...VALID_JIRA, JIRA_API_TOKEN: '' });
  });

  it('rejects empty JIRA_PROJECT_KEY', () => {
    expectFailure(jiraEnvSchema, { ...VALID_JIRA, JIRA_PROJECT_KEY: '' });
  });

  it('rejects non-HTTP JIRA_BASE_URL', () => {
    expectFailure(jiraEnvSchema, {
      ...VALID_JIRA,
      JIRA_BASE_URL: 'ftp://invalid',
    });
  });
});

// ─── GitHub env schema ───────────────────────────────────────────────────────

describe('githubEnvSchema', () => {
  const VALID_GITHUB = {
    ...SHARED_BASE,
    GITHUB_TOKEN: 'fake-gh-token-abc123',
    GITHUB_REPO: 'org/repo',
  };

  it('accepts valid GitHub credentials', () => {
    expectSuccess(githubEnvSchema, VALID_GITHUB);
  });

  it('rejects missing GITHUB_TOKEN', () => {
    expectFailure(githubEnvSchema, omit(VALID_GITHUB, 'GITHUB_TOKEN'));
  });

  it('rejects empty GITHUB_TOKEN', () => {
    expectFailure(githubEnvSchema, { ...VALID_GITHUB, GITHUB_TOKEN: '' });
  });

  it('rejects missing GITHUB_REPO', () => {
    expectFailure(githubEnvSchema, omit(VALID_GITHUB, 'GITHUB_REPO'));
  });

  it('rejects empty GITHUB_REPO', () => {
    expectFailure(githubEnvSchema, { ...VALID_GITHUB, GITHUB_REPO: '' });
  });
});

// ─── Linear env schema ──────────────────────────────────────────────────────

describe('linearEnvSchema', () => {
  const VALID_LINEAR = {
    ...SHARED_BASE,
    LINEAR_API_KEY: 'lin_api_abc123',
    LINEAR_TEAM_ID: 'TEAM-1',
  };

  it('accepts valid Linear credentials', () => {
    expectSuccess(linearEnvSchema, VALID_LINEAR);
  });

  it('rejects missing LINEAR_API_KEY', () => {
    expectFailure(linearEnvSchema, omit(VALID_LINEAR, 'LINEAR_API_KEY'));
  });

  it('rejects empty LINEAR_API_KEY', () => {
    expectFailure(linearEnvSchema, { ...VALID_LINEAR, LINEAR_API_KEY: '' });
  });

  it('rejects missing LINEAR_TEAM_ID', () => {
    expectFailure(linearEnvSchema, omit(VALID_LINEAR, 'LINEAR_TEAM_ID'));
  });

  it('rejects empty LINEAR_TEAM_ID', () => {
    expectFailure(linearEnvSchema, { ...VALID_LINEAR, LINEAR_TEAM_ID: '' });
  });
});

// ─── Shortcut env schema ────────────────────────────────────────────────────

describe('shortcutEnvSchema', () => {
  const VALID_SHORTCUT = {
    ...SHARED_BASE,
    SHORTCUT_API_TOKEN: 'sc_token_abc',
  };

  it('accepts valid Shortcut credentials', () => {
    expectSuccess(shortcutEnvSchema, VALID_SHORTCUT);
  });

  it('accepts optional workflow field', () => {
    expectSuccess(shortcutEnvSchema, {
      ...VALID_SHORTCUT,
      SHORTCUT_WORKFLOW: 'Engineering',
    });
  });

  it('rejects missing SHORTCUT_API_TOKEN', () => {
    expectFailure(shortcutEnvSchema, SHARED_BASE);
  });

  it('rejects empty SHORTCUT_API_TOKEN', () => {
    expectFailure(shortcutEnvSchema, { SHORTCUT_API_TOKEN: '' });
  });
});

// ─── Notion env schema ──────────────────────────────────────────────────────

describe('notionEnvSchema', () => {
  const VALID_NOTION = {
    ...SHARED_BASE,
    NOTION_TOKEN: 'ntn_abc123',
    NOTION_DATABASE_ID: 'db-uuid-123',
  };

  it('accepts valid Notion credentials', () => {
    expectSuccess(notionEnvSchema, VALID_NOTION);
  });

  it('accepts all optional Notion fields', () => {
    expectSuccess(notionEnvSchema, {
      ...VALID_NOTION,
      CLANCY_NOTION_STATUS: 'Status',
      CLANCY_NOTION_TODO: 'To Do',
      CLANCY_NOTION_ASSIGNEE: 'Assignee',
      CLANCY_NOTION_LABELS: 'Tags',
      CLANCY_NOTION_PARENT: 'Parent',
    });
  });

  it('rejects missing NOTION_TOKEN', () => {
    expectFailure(notionEnvSchema, omit(VALID_NOTION, 'NOTION_TOKEN'));
  });

  it('rejects empty NOTION_TOKEN', () => {
    expectFailure(notionEnvSchema, { ...VALID_NOTION, NOTION_TOKEN: '' });
  });

  it('rejects missing NOTION_DATABASE_ID', () => {
    expectFailure(notionEnvSchema, omit(VALID_NOTION, 'NOTION_DATABASE_ID'));
  });

  it('rejects empty NOTION_DATABASE_ID', () => {
    expectFailure(notionEnvSchema, {
      ...VALID_NOTION,
      NOTION_DATABASE_ID: '',
    });
  });
});

// ─── Azure DevOps env schema ────────────────────────────────────────────────

describe('azdoEnvSchema', () => {
  const VALID_AZDO = {
    ...SHARED_BASE,
    AZDO_ORG: 'myorg',
    AZDO_PROJECT: 'myproject',
    AZDO_PAT: 'pat-token-abc',
  };

  it('accepts valid Azure DevOps credentials', () => {
    expectSuccess(azdoEnvSchema, VALID_AZDO);
  });

  it('accepts optional AZDO fields', () => {
    expectSuccess(azdoEnvSchema, {
      ...VALID_AZDO,
      CLANCY_AZDO_STATUS: 'To Do',
      CLANCY_AZDO_WIT: 'User Story',
    });
  });

  it('rejects missing AZDO_ORG', () => {
    expectFailure(azdoEnvSchema, omit(VALID_AZDO, 'AZDO_ORG'));
  });

  it('rejects empty AZDO_ORG', () => {
    expectFailure(azdoEnvSchema, { ...VALID_AZDO, AZDO_ORG: '' });
  });

  it('rejects missing AZDO_PROJECT', () => {
    expectFailure(azdoEnvSchema, omit(VALID_AZDO, 'AZDO_PROJECT'));
  });

  it('rejects empty AZDO_PROJECT', () => {
    expectFailure(azdoEnvSchema, { ...VALID_AZDO, AZDO_PROJECT: '' });
  });

  it('rejects missing AZDO_PAT', () => {
    expectFailure(azdoEnvSchema, omit(VALID_AZDO, 'AZDO_PAT'));
  });

  it('rejects empty AZDO_PAT', () => {
    expectFailure(azdoEnvSchema, { ...VALID_AZDO, AZDO_PAT: '' });
  });
});

// ─── Board schemas inherit shared fields ────────────────────────────────────

describe('board schemas inherit shared fields', () => {
  it('jira schema accepts shared fields alongside board fields', () => {
    expectSuccess(jiraEnvSchema, {
      JIRA_BASE_URL: 'https://myorg.atlassian.net',
      JIRA_USER: 'user@example.com',
      JIRA_API_TOKEN: 'token-123',
      JIRA_PROJECT_KEY: 'PROJ',
      CLANCY_BASE_BRANCH: 'develop',
      CLANCY_LABEL: 'clancy:build',
    });
  });

  it('github schema accepts shared fields alongside board fields', () => {
    expectSuccess(githubEnvSchema, {
      GITHUB_TOKEN: 'fake-gh-token-abc123',
      GITHUB_REPO: 'org/repo',
      CLANCY_MODEL: 'sonnet',
      MAX_ITERATIONS: '10',
    });
  });
});
