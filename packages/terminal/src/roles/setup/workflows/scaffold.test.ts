/**
 * Content assertions for the scaffold workflow.
 *
 * Verifies the gitignore-fold lifecycle: scaffold writes `.clancy/` (not the
 * legacy `.clancy/.env`) into target-project gitignores, so the entire
 * `.clancy/` tree is gitignored on first install.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const content = readFileSync(
  fileURLToPath(new URL('scaffold.md', import.meta.url)),
  'utf8',
);

describe('scaffold workflow', () => {
  it('starts with the correct heading', () => {
    expect(content.split('\n')[0]?.trim()).toBe('# Clancy Scaffold Workflow');
  });

  it('has a .gitignore check section', () => {
    expect(content).toContain('## .gitignore check');
  });
});

describe('gitignore-fold lifecycle (.clancy/ is gitignored)', () => {
  const gitignoreSection =
    content.match(/## \.gitignore check[\s\S]*?(?=^## |^---$)/m)?.[0] ?? '';

  it('appends .clancy/ (not .clancy/.env) to existing .gitignore', () => {
    expect(gitignoreSection).toBeTruthy();
    expect(gitignoreSection).toMatch(/`\.clancy\/`/);
    expect(gitignoreSection).not.toMatch(
      /If `\.clancy\/\.env` is not present, append/,
    );
  });

  it('uses # Clancy header (not legacy # Clancy credentials)', () => {
    expect(gitignoreSection).not.toContain('# Clancy credentials');
    expect(gitignoreSection).toContain('# Clancy');
  });

  it('seeds new .gitignore with .clancy/ block', () => {
    const lines = gitignoreSection.split('\n');
    const clancyLines = lines.filter((line) => /^\.clancy\/?\s*$/.test(line));

    expect(clancyLines.length).toBeGreaterThan(0);
    const envLines = lines.filter((line) => /^\.clancy\/\.env\s*$/.test(line));
    expect(envLines).toEqual([]);
  });
});
