/**
 * Structural tests for brief workflow files.
 *
 * Verifies the workflows directory contains the expected markdown files
 * that the brief installer depends on.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const WORKFLOWS_DIR = fileURLToPath(new URL('.', import.meta.url));

const EXPECTED_WORKFLOWS = ['brief.md'];

describe('workflows directory structure', () => {
  it('contains exactly the expected workflow files', () => {
    const workflows = readdirSync(WORKFLOWS_DIR)
      .filter((f) => f.endsWith('.md'))
      .sort();

    expect(workflows).toEqual([...EXPECTED_WORKFLOWS].sort());
  });

  it('all workflow files start with a heading', () => {
    const issues: string[] = [];

    EXPECTED_WORKFLOWS.forEach((file) => {
      const content = readFileSync(new URL(file, import.meta.url), 'utf8');
      const firstLine = content.split('\n')[0]?.trim() ?? '';

      if (!firstLine.startsWith('#')) {
        issues.push(file);
      }
    });

    expect(issues).toEqual([]);
  });

  it('brief workflow references the workflow reference marker', () => {
    const content = readFileSync(new URL('brief.md', import.meta.url), 'utf8');

    expect(content).toContain('## Step 1');
    expect(content).toContain('.clancy/briefs/');
  });
});

describe('standalone mode adaptations', () => {
  const content = readFileSync(new URL('brief.md', import.meta.url), 'utf8');

  it('Step 1 uses standalone/terminal mode detection', () => {
    expect(content).toContain('standalone mode');
    expect(content).toContain('terminal mode');
    expect(content).toContain('Detect installation context');
  });

  it('Step 1 does not hard-stop on missing .clancy/.env', () => {
    expect(content).not.toContain(
      '.clancy/ not found. Run /clancy:init to set up Clancy first.',
    );
  });

  it('includes standalone board-ticket guard', () => {
    expect(content).toContain('Standalone board-ticket guard');
    expect(content).toContain('Board credentials not found');
    expect(content).toContain('npx chief-clancy');
  });

  it('Step 10 includes standalone skip guard', () => {
    expect(content).toContain(
      'In **standalone mode**, skip this step and Step 10a entirely',
    );
  });

  it('Step 10a includes standalone skip back-reference', () => {
    expect(content).toContain('see Step 10 guard');
  });

  it('agent reference uses .claude/clancy/agents/ path', () => {
    expect(content).toContain('.claude/clancy/agents/devils-advocate.md');
    expect(content).not.toContain('src/agents/devils-advocate.md');
  });

  it('approve-brief references include standalone context', () => {
    expect(content).not.toMatch(/that is `\/clancy:approve-brief`\./);
    expect(content).toContain('npx chief-clancy');
  });
});
