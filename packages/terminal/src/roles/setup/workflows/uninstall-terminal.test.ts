/**
 * Content assertions for the uninstall-terminal workflow.
 *
 * Verifies the workflow detects standalone package VERSION markers,
 * warns the user before removal, and provides reinstall guidance.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const content = readFileSync(
  fileURLToPath(new URL('uninstall-terminal.md', import.meta.url)),
  'utf8',
);

describe('uninstall-terminal workflow', () => {
  it('starts with the correct heading', () => {
    expect(content.split('\n')[0]?.trim()).toBe(
      '# Clancy Uninstall Terminal Workflow',
    );
  });

  it('has a standalone package detection step', () => {
    expect(content).toContain('## Step 1b — Detect standalone packages');
  });

  it('checks VERSION markers for all standalone packages', () => {
    expect(content).toContain('VERSION.brief');
    expect(content).toContain('VERSION.plan');
    expect(content).toContain('VERSION.dev');
  });

  it('notes VERSION.dev lives at .clancy/', () => {
    expect(content).toContain('.clancy/VERSION.dev');
  });

  it('shows advisory when standalone packages are detected', () => {
    expect(content).toContain('Standalone packages detected');
    expect(content).toContain('per-package');
    expect(content).toContain('/clancy:uninstall-brief');
    expect(content).toContain('/clancy:uninstall-plan');
    expect(content).toContain('/clancy:uninstall-dev');
  });

  it('explains VERSION.dev uses .clancy/ not commands/clancy/', () => {
    expect(content).toContain('VERSION.dev` uses `.clancy/` (project root)');
  });

  it('provides reinstall guidance in the final message', () => {
    expect(content).toContain('standalone packages were also removed');
    expect(content).toContain('npx @chief-clancy/brief');
    expect(content).toContain('npx @chief-clancy/plan');
    expect(content).toContain('npx @chief-clancy/dev');
  });

  it('only lists actually detected packages in final message', () => {
    expect(content).toContain('Only list packages that were actually detected');
  });

  it('still removes hooks and settings entries', () => {
    expect(content).toContain('clancy-branch-guard');
    expect(content).toContain('clancy-credential-guard');
    expect(content).toContain('settings.json');
  });

  it('still cleans up CLAUDE.md, .gitignore, .prettierignore', () => {
    expect(content).toContain('clancy:start');
    expect(content).toContain('.gitignore');
    expect(content).toContain('.prettierignore');
  });

  it('still offers .clancy/ removal separately', () => {
    expect(content).toContain('Remove it too? This cannot be undone.');
  });
});
