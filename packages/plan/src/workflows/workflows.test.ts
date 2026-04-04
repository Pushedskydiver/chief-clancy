/**
 * Structural tests for plan workflow files.
 *
 * Verifies the workflows directory contains the expected markdown files
 * that the plan installer depends on.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const WORKFLOWS_DIR = fileURLToPath(new URL('.', import.meta.url));

const EXPECTED_WORKFLOWS = ['board-setup.md', 'plan.md'];

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

  it('plan workflow references Step 1', () => {
    const content = readFileSync(new URL('plan.md', import.meta.url), 'utf8');

    expect(content).toContain('## Step 1');
  });
});

// ---------------------------------------------------------------------------
// board-setup.md content assertions
// ---------------------------------------------------------------------------

describe('board-setup workflow', () => {
  const content = readFileSync(
    new URL('board-setup.md', import.meta.url),
    'utf8',
  );

  it('checks for full pipeline before proceeding', () => {
    expect(content).toContain('clancy-implement.js');
    expect(content).toContain('/clancy:settings');
  });

  it('checks for existing board credentials', () => {
    expect(content).toContain('Existing board credentials found');
    expect(content).toContain('Reconfigure');
  });

  it('offers all 6 supported boards', () => {
    expect(content).toContain('Jira');
    expect(content).toContain('GitHub Issues');
    expect(content).toContain('Linear');
    expect(content).toContain('Shortcut');
    expect(content).toContain('Notion');
    expect(content).toContain('Azure DevOps');
  });

  it('includes credential prompts for each board', () => {
    expect(content).toContain('JIRA_BASE_URL');
    expect(content).toContain('GITHUB_TOKEN');
    expect(content).toContain('LINEAR_API_KEY');
    expect(content).toContain('SHORTCUT_API_TOKEN');
    expect(content).toContain('NOTION_TOKEN');
    expect(content).toContain('AZDO_PAT');
  });

  it('includes credential verification for each board', () => {
    expect(content).toContain('Jira connected');
    expect(content).toContain('GitHub connected');
    expect(content).toContain('Linear connected');
    expect(content).toContain('Shortcut connected');
    expect(content).toContain('Notion connected');
    expect(content).toContain('Azure DevOps connected');
  });

  it('offers re-enter, skip, and cancel on verification failure', () => {
    expect(content).toContain('Re-enter credentials');
    expect(content).toContain('Skip verification');
    expect(content).toContain('Cancel');
  });

  it('warns about .gitignore', () => {
    expect(content).toContain('.gitignore');
    expect(content).toContain('.clancy/.env');
  });

  it('notes credentials are per-project', () => {
    expect(content).toContain('this project only');
  });

  it('includes plan header comment in env file', () => {
    expect(content).toContain('Configured by @chief-clancy/plan');
  });

  it('references /clancy:plan not /clancy:brief', () => {
    expect(content).toContain('/clancy:plan');
    expect(content).not.toContain('/clancy:brief');
  });
});

// ---------------------------------------------------------------------------
// plan.md content assertions
// ---------------------------------------------------------------------------

describe('three-state mode detection', () => {
  const content = readFileSync(new URL('plan.md', import.meta.url), 'utf8');

  it('Step 1 detects three installation states', () => {
    expect(content).toContain('standalone mode');
    expect(content).toContain('standalone+board mode');
    expect(content).toContain('terminal mode');
  });

  it('Step 1 checks .clancy/.env for credentials', () => {
    expect(content).toContain('.clancy/.env');
  });

  it('Step 1 checks clancy-implement.js for terminal detection', () => {
    expect(content).toContain('clancy-implement.js');
  });

  it('Step 1 does not hard-stop on missing .clancy/.env', () => {
    expect(content).not.toContain(
      '.clancy/ not found. Run /clancy:init to set up Clancy first.',
    );
  });

  it('CLANCY_ROLES check only runs in terminal mode', () => {
    expect(content).toContain('Terminal-mode preflight');
    expect(content).toContain(
      'skip in standalone mode and standalone+board mode',
    );
  });

  it('standalone guard mentions /clancy:board-setup', () => {
    expect(content).toContain('Standalone board-ticket guard');
    expect(content).toContain('Board credentials not found');
    expect(content).toContain('/clancy:board-setup');
  });

  it('Step 5 runs when board credentials are available', () => {
    expect(content).toContain(
      'when board credentials are available (terminal mode or standalone+board mode)',
    );
  });

  it('approve-plan references include standalone guidance', () => {
    expect(content).toContain('npx chief-clancy');
  });
});
