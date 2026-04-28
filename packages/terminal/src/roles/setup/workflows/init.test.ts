/**
 * Content assertions for the init workflow.
 *
 * Verifies the gitignore-fold lifecycle: `.clancy/` is gitignored entirely
 * in target projects, so init's commit must only stage parent-project files
 * (CLAUDE.md + .gitignore) and the gitignore check must reference `.clancy/`
 * (not the legacy `.clancy/.env`).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const content = readFileSync(
  fileURLToPath(new URL('init.md', import.meta.url)),
  'utf8',
);

describe('init workflow', () => {
  it('starts with the correct heading', () => {
    expect(content.split('\n')[0]?.trim()).toBe('# Clancy Init Workflow');
  });

  it('has a Step 4 scaffold and Step 4b commit section', () => {
    expect(content).toContain('## Step 4 — Scaffold');
    expect(content).toContain('## Step 4b — Commit scaffold');
  });
});

describe('gitignore-fold lifecycle (.clancy/ is gitignored)', () => {
  it('Step 4 gitignore check references .clancy/ (not .clancy/.env)', () => {
    const step4 =
      content.match(/## Step 4 — Scaffold[\s\S]*?(?=^## Step 4b)/m)?.[0] ?? '';

    expect(step4).toBeTruthy();
    expect(step4).toMatch(/`\.clancy\/`/);
    expect(step4).not.toMatch(/if `\.clancy\/\.env` is not listed, append it/);
  });

  it('Step 4b commit does not stage anything inside .clancy/', () => {
    const step4b =
      content.match(
        /## Step 4b — Commit scaffold[\s\S]*?(?=^## Step 4c)/m,
      )?.[0] ?? '';

    expect(step4b).toBeTruthy();
    expect(step4b).not.toContain('git add .clancy/.env.example');
    expect(step4b).not.toContain('.clancy/.env.example .clancy/docs/');
    expect(step4b).not.toMatch(/git add[^\n]*\.clancy\/docs\//);
  });

  it('Step 4b commit stages only CLAUDE.md and .gitignore', () => {
    const step4b =
      content.match(
        /## Step 4b — Commit scaffold[\s\S]*?(?=^## Step 4c)/m,
      )?.[0] ?? '';

    expect(step4b).toMatch(/git add CLAUDE\.md \.gitignore/);
  });
});
