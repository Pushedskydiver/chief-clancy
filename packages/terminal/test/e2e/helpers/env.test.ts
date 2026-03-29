import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAzdoCredentials,
  getGitHubCredentials,
  getJiraCredentials,
  getLinearCredentials,
  getNotionCredentials,
  getShortcutCredentials,
  hasCredentials,
  loadEnvFile,
} from './env.js';

/** Set env vars for a board, clearing any leftovers first. */
function stubBoard(vars: Record<string, string>): void {
  for (const [key, value] of Object.entries(vars)) {
    vi.stubEnv(key, value);
  }
}

/** Clear all board env vars. */
function clearAll(): void {
  const keys = [
    'GITHUB_TOKEN',
    'GITHUB_REPO',
    'JIRA_BASE_URL',
    'JIRA_USER',
    'JIRA_API_TOKEN',
    'JIRA_PROJECT_KEY',
    'LINEAR_API_KEY',
    'LINEAR_TEAM_ID',
    'SHORTCUT_TOKEN',
    'NOTION_TOKEN',
    'NOTION_DATABASE_ID',
    'AZURE_ORG',
    'AZURE_PROJECT',
    'AZURE_PAT',
  ];
  for (const key of keys) {
    vi.stubEnv(key, '');
  }
}

beforeEach(() => {
  clearAll();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getGitHubCredentials', () => {
  it('returns credentials when both vars are set', () => {
    stubBoard({ GITHUB_TOKEN: 'ghp_abc', GITHUB_REPO: 'org/repo' });

    expect(getGitHubCredentials()).toEqual({
      token: 'ghp_abc',
      repo: 'org/repo',
    });
  });

  it('returns undefined when token is missing', () => {
    stubBoard({ GITHUB_REPO: 'org/repo' });

    expect(getGitHubCredentials()).toBeUndefined();
  });

  it('returns undefined when repo is missing', () => {
    stubBoard({ GITHUB_TOKEN: 'ghp_abc' });

    expect(getGitHubCredentials()).toBeUndefined();
  });

  it('trims whitespace from values', () => {
    stubBoard({ GITHUB_TOKEN: '  ghp_abc  ', GITHUB_REPO: ' org/repo ' });

    expect(getGitHubCredentials()).toEqual({
      token: 'ghp_abc',
      repo: 'org/repo',
    });
  });

  it('treats whitespace-only values as missing', () => {
    stubBoard({ GITHUB_TOKEN: '   ', GITHUB_REPO: 'org/repo' });

    expect(getGitHubCredentials()).toBeUndefined();
  });
});

describe('getJiraCredentials', () => {
  it('returns credentials when required vars are set', () => {
    stubBoard({
      JIRA_BASE_URL: 'https://jira.example.com',
      JIRA_USER: 'user@example.com',
      JIRA_API_TOKEN: 'jira_token',
    });

    const creds = getJiraCredentials();
    expect(creds?.baseUrl).toBe('https://jira.example.com');
    expect(creds?.user).toBe('user@example.com');
    expect(creds?.apiToken).toBe('jira_token');
    expect(creds?.projectKey).toBe('CLANCYQA');
  });

  it('uses custom project key when set', () => {
    stubBoard({
      JIRA_BASE_URL: 'https://jira.example.com',
      JIRA_USER: 'user@example.com',
      JIRA_API_TOKEN: 'jira_token',
      JIRA_PROJECT_KEY: 'CUSTOM',
    });

    expect(getJiraCredentials()?.projectKey).toBe('CUSTOM');
  });

  it('returns undefined when base URL is missing', () => {
    stubBoard({
      JIRA_USER: 'user@example.com',
      JIRA_API_TOKEN: 'jira_token',
    });

    expect(getJiraCredentials()).toBeUndefined();
  });
});

describe('getLinearCredentials', () => {
  it('returns credentials when both vars are set', () => {
    stubBoard({ LINEAR_API_KEY: 'lin_key', LINEAR_TEAM_ID: 'team_123' });

    expect(getLinearCredentials()).toEqual({
      apiKey: 'lin_key',
      teamId: 'team_123',
    });
  });

  it('returns undefined when API key is missing', () => {
    stubBoard({ LINEAR_TEAM_ID: 'team_123' });

    expect(getLinearCredentials()).toBeUndefined();
  });
});

describe('getShortcutCredentials', () => {
  it('returns credentials when token is set', () => {
    stubBoard({ SHORTCUT_TOKEN: 'sc_token' });

    expect(getShortcutCredentials()).toEqual({ token: 'sc_token' });
  });

  it('returns undefined when token is missing', () => {
    expect(getShortcutCredentials()).toBeUndefined();
  });
});

describe('getNotionCredentials', () => {
  it('returns credentials when both vars are set', () => {
    stubBoard({
      NOTION_TOKEN: 'ntn_token',
      NOTION_DATABASE_ID: 'db_123',
    });

    expect(getNotionCredentials()).toEqual({
      token: 'ntn_token',
      databaseId: 'db_123',
    });
  });

  it('returns undefined when token is missing', () => {
    stubBoard({ NOTION_DATABASE_ID: 'db_123' });

    expect(getNotionCredentials()).toBeUndefined();
  });
});

describe('getAzdoCredentials', () => {
  it('returns credentials when all vars are set', () => {
    stubBoard({
      AZURE_ORG: 'my-org',
      AZURE_PROJECT: 'my-project',
      AZURE_PAT: 'azdo_pat',
    });

    expect(getAzdoCredentials()).toEqual({
      org: 'my-org',
      project: 'my-project',
      pat: 'azdo_pat',
    });
  });

  it('returns undefined when org is missing', () => {
    stubBoard({ AZURE_PROJECT: 'my-project', AZURE_PAT: 'azdo_pat' });

    expect(getAzdoCredentials()).toBeUndefined();
  });
});

describe('hasCredentials', () => {
  it('returns true for a board with credentials', () => {
    stubBoard({ GITHUB_TOKEN: 'ghp_abc', GITHUB_REPO: 'org/repo' });

    expect(hasCredentials('github')).toBe(true);
  });

  it('returns false for a board without credentials', () => {
    expect(hasCredentials('github')).toBe(false);
  });

  it('checks all 6 boards', () => {
    expect(hasCredentials('github')).toBe(false);
    expect(hasCredentials('jira')).toBe(false);
    expect(hasCredentials('linear')).toBe(false);
    expect(hasCredentials('shortcut')).toBe(false);
    expect(hasCredentials('notion')).toBe(false);
    expect(hasCredentials('azdo')).toBe(false);
  });
});

describe('loadEnvFile', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'clancy-env-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads vars from .env.e2e into process.env', () => {
    writeFileSync(join(tempDir, '.env.e2e'), 'SHORTCUT_TOKEN=sc_from_file\n');

    loadEnvFile(tempDir);

    expect(process.env.SHORTCUT_TOKEN).toBe('sc_from_file');
  });

  it('does not override existing env vars', () => {
    vi.stubEnv('SHORTCUT_TOKEN', 'existing_value');
    writeFileSync(join(tempDir, '.env.e2e'), 'SHORTCUT_TOKEN=from_file\n');

    loadEnvFile(tempDir);

    expect(process.env.SHORTCUT_TOKEN).toBe('existing_value');
  });

  it('is a no-op when .env.e2e does not exist', () => {
    expect(() => loadEnvFile(tempDir)).not.toThrow();
  });
});
