/**
 * Live schema validation — auth-endpoint checks against Zod schemas.
 *
 * Calls each board's auth/ping endpoint with real credentials and
 * validates the response body against the corresponding Zod schema.
 * Failures indicate API drift — the external API has changed in a
 * way our schemas don't account for.
 *
 * Unlike pipeline E2E tests, these are read-only (no ticket creation,
 * no branch/PR creation, no cleanup needed).
 *
 * Prerequisites: .env.e2e with credentials for the boards under test.
 */
import { describe, expect, it } from 'vitest';

import {
  azdoProjectResponseSchema,
  githubRepoPingSchema,
  jiraProjectPingSchema,
  linearViewerResponseSchema,
  notionUserResponseSchema,
  shortcutMemberInfoResponseSchema,
  shortcutWorkflowsResponseSchema,
} from '@chief-clancy/core';

import {
  getAzdoCredentials,
  getGitHubCredentials,
  getJiraCredentials,
  getLinearCredentials,
  getNotionCredentials,
  getShortcutCredentials,
  hasCredentials,
  loadEnvFile,
} from '../helpers/env.js';
import { fetchWithTimeout } from '../helpers/fetch-timeout.js';

// ── Credential loading ─────────────────────────────────────────

loadEnvFile();

// ── GitHub ──────────────────────────────────────────────────────

describe.skipIf(!hasCredentials('github'))('Schema validation: GitHub', () => {
  it('GET /repos/{owner}/{repo} matches githubRepoPingSchema', async () => {
    const { token, repo } = getGitHubCredentials()!;

    const response = await fetchWithTimeout(
      `https://api.github.com/repos/${repo}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    expect(response.ok).toBe(true);

    const json: unknown = await response.json();
    const parsed = githubRepoPingSchema.safeParse(json);

    if (!parsed.success) {
      console.error('GitHub schema drift:', parsed.error.issues);
    }
    expect(parsed.success).toBe(true);
  });
});

// ── Jira ────────────────────────────────────────────────────────

describe.skipIf(!hasCredentials('jira'))('Schema validation: Jira', () => {
  it('GET /rest/api/3/project/{key} matches jiraProjectPingSchema', async () => {
    const { baseUrl, user, apiToken, projectKey } = getJiraCredentials()!;
    const auth = Buffer.from(`${user}:${apiToken}`).toString('base64');

    const response = await fetchWithTimeout(
      `${baseUrl}/rest/api/3/project/${projectKey}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
      },
    );

    expect(response.ok).toBe(true);

    const json: unknown = await response.json();
    const parsed = jiraProjectPingSchema.safeParse(json);

    if (!parsed.success) {
      console.error('Jira schema drift:', parsed.error.issues);
    }
    expect(parsed.success).toBe(true);
  });
});

// ── Linear ──────────────────────────────────────────────────────

describe.skipIf(!hasCredentials('linear'))('Schema validation: Linear', () => {
  it('GraphQL { viewer { id } } matches linearViewerResponseSchema', async () => {
    const { apiKey } = getLinearCredentials()!;

    const response = await fetchWithTimeout('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: '{ viewer { id } }' }),
    });

    expect(response.ok).toBe(true);

    const json: unknown = await response.json();
    const parsed = linearViewerResponseSchema.safeParse(json);

    if (!parsed.success) {
      console.error('Linear schema drift:', parsed.error.issues);
    }
    expect(parsed.success).toBe(true);
  });
});

// ── Shortcut ────────────────────────────────────────────────────

describe.skipIf(!hasCredentials('shortcut'))(
  'Schema validation: Shortcut',
  () => {
    // Shortcut ping has a fallback: /member-info first, then /workflows.
    // Some token types return 404 on /member-info — mirrors pingShortcut().
    it('GET /member-info or /workflows matches Shortcut schema', async () => {
      const { token } = getShortcutCredentials()!;
      const headers = {
        'Shortcut-Token': token,
        'Content-Type': 'application/json',
      };

      const memberRes = await fetchWithTimeout(
        'https://api.app.shortcut.com/api/v3/member-info',
        { headers },
      );

      if (memberRes.ok) {
        const json: unknown = await memberRes.json();
        const parsed = shortcutMemberInfoResponseSchema.safeParse(json);

        if (!parsed.success) {
          console.error('Shortcut schema drift:', parsed.error.issues);
        }
        expect(parsed.success).toBe(true);
        return;
      }

      // Fallback to /workflows (same as production pingShortcut)
      const workflowsRes = await fetchWithTimeout(
        'https://api.app.shortcut.com/api/v3/workflows',
        { headers },
      );

      expect(workflowsRes.ok).toBe(true);

      const json: unknown = await workflowsRes.json();
      const parsed = shortcutWorkflowsResponseSchema.safeParse(json);

      if (!parsed.success) {
        console.error('Shortcut schema drift:', parsed.error.issues);
      }
      expect(parsed.success).toBe(true);
    });
  },
);

// ── Notion ──────────────────────────────────────────────────────

describe.skipIf(!hasCredentials('notion'))('Schema validation: Notion', () => {
  it('GET /users/me matches notionUserResponseSchema', async () => {
    const { token } = getNotionCredentials()!;

    const response = await fetchWithTimeout(
      'https://api.notion.com/v1/users/me',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
      },
    );

    expect(response.ok).toBe(true);

    const json: unknown = await response.json();
    const parsed = notionUserResponseSchema.safeParse(json);

    if (!parsed.success) {
      console.error('Notion schema drift:', parsed.error.issues);
    }
    expect(parsed.success).toBe(true);
  });
});

// ── Azure DevOps ────────────────────────────────────────────────

describe.skipIf(!hasCredentials('azdo'))(
  'Schema validation: Azure DevOps',
  () => {
    it('GET /_apis/projects/{project} matches azdoProjectResponseSchema', async () => {
      const { org, project, pat } = getAzdoCredentials()!;
      const auth = `Basic ${btoa(`:${pat}`)}`;

      const response = await fetchWithTimeout(
        `https://dev.azure.com/${encodeURIComponent(org)}/_apis/projects/${encodeURIComponent(project)}?api-version=7.1`,
        {
          headers: {
            Authorization: auth,
            'Content-Type': 'application/json',
          },
        },
      );

      expect(response.ok).toBe(true);

      const json: unknown = await response.json();
      const parsed = azdoProjectResponseSchema.safeParse(json);

      if (!parsed.success) {
        console.error('Azure DevOps schema drift:', parsed.error.issues);
      }
      expect(parsed.success).toBe(true);
    });
  },
);
