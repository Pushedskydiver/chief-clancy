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

const EXPECTED_WORKFLOWS = [
  'approve-brief.md',
  'board-setup.md',
  'brief.md',
  'uninstall-brief.md',
];

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

  it('approve-brief workflow has structural step markers', () => {
    const content = readFileSync(
      new URL('approve-brief.md', import.meta.url),
      'utf8',
    );

    expect(content).toContain('## Step 1');
    expect(content).toContain('.clancy/briefs/');
  });

  it('uninstall-brief workflow starts with the correct heading', () => {
    const content = readFileSync(
      new URL('uninstall-brief.md', import.meta.url),
      'utf8',
    );

    expect(content.split('\n')[0]?.trim()).toBe(
      '# Clancy Uninstall Brief Workflow',
    );
  });
});

// ---------------------------------------------------------------------------
// approve-brief Step 1 install-mode preflight assertions
// ---------------------------------------------------------------------------

describe('approve-brief Step 1 install-mode preflight', () => {
  const content = readFileSync(
    new URL('approve-brief.md', import.meta.url),
    'utf8',
  );

  it('detects three installation states', () => {
    expect(content).toContain('standalone mode');
    expect(content).toContain('standalone+board mode');
    expect(content).toContain('terminal mode');
  });

  it('uses the same env-var probes as approve-plan and plan workflows', () => {
    // Schema-pair contract: must mirror approve-plan.md and plan.md exactly.
    expect(content).toContain('.clancy/.env');
    expect(content).toContain('.clancy/clancy-implement.js');
  });

  it('hard-stops in standalone mode with the board-setup message', () => {
    expect(content).toContain('No board credentials found');
    expect(content).toContain('Run /clancy:board-setup first');
  });

  it('does NOT use the old /clancy:init standalone hard-stop', () => {
    expect(content).not.toContain('Run /clancy:init to set up Clancy first');
  });

  it('terminal-mode preflight gates the strategist role check', () => {
    expect(content).toContain(
      '### 2. Terminal-mode preflight (skip in standalone+board mode)',
    );
    expect(content).toContain('CLANCY_ROLES` includes `strategist`');
  });

  it('standalone+board preflight notes the strategist role check does not apply', () => {
    expect(content).toContain(
      '### 3. Standalone+board preflight (only in standalone+board mode)',
    );
    expect(content).toContain('strategist role check above does not apply');
  });

  it('captures the install mode for Step 6 to read', () => {
    expect(content).toContain(
      "The detected install mode is captured for Step 6's pipeline label decision",
    );
  });
});

// ---------------------------------------------------------------------------
// approve-brief Step 6 pipeline label selection rule
// ---------------------------------------------------------------------------

describe('approve-brief Step 6 pipeline label selection rule', () => {
  const content = readFileSync(
    new URL('approve-brief.md', import.meta.url),
    'utf8',
  );

  it('has the preamble heading at the top of Step 6', () => {
    expect(content).toContain(
      '### Pipeline label selection rule (applies to all six platforms below)',
    );
  });

  it('preamble enumerates rule 1 — --skip-plan flag uses build label', () => {
    expect(content).toMatch(
      /1\. `--skip-plan` flag is set → use `CLANCY_LABEL_BUILD`/,
    );
  });

  it('preamble enumerates rule 2 — standalone+board uses plan label', () => {
    expect(content).toMatch(
      /2\. Install mode is \*\*standalone\+board\*\*[^\n]*→ use `CLANCY_LABEL_PLAN`/,
    );
  });

  it('preamble enumerates rule 3 — terminal + planner enabled uses plan label', () => {
    expect(content).toMatch(
      /3\. Install mode is \*\*terminal\*\* AND `CLANCY_ROLES` includes `planner`[^\n]*→ use `CLANCY_LABEL_PLAN`/,
    );
  });

  it('preamble enumerates rule 4 — terminal + planner not enabled uses build label', () => {
    expect(content).toMatch(
      /4\. Install mode is \*\*terminal\*\* AND `CLANCY_ROLES` is set but does NOT include `planner` → use `CLANCY_LABEL_BUILD`/,
    );
  });

  it('GitHub subsection delegates to the preamble (no inline 3-rule fallthrough)', () => {
    expect(content).toContain(
      'Apply the pipeline label per the rule above to every child ticket',
    );
    // The old per-platform fallthrough must be gone — no leftover
    // "Planner role enabled" / "Planner role NOT enabled" lines anywhere.
    expect(content).not.toContain('Planner role enabled');
    expect(content).not.toContain('Planner role NOT enabled');
  });

  it('all five non-GitHub platform subsections delegate to the preamble', () => {
    // Each non-GitHub platform must reference the preamble explicitly
    // and must NOT use the old "same logic as GitHub/other boards" wording.
    expect(content).not.toContain('same logic as GitHub');
    expect(content).not.toContain('same logic as other boards');

    // GitHub uses "above"; the other 5 use "at the top of Step 6". Of those
    // 5, four are "pipeline label per the rule" (Jira, Linear, Shortcut,
    // Notion) and one is "pipeline tag determined by the rule" (Azure
    // DevOps, which uses System.Tags rather than labels).
    const labelDelegations = content.match(
      /Apply the pipeline label per the rule at the top of Step 6/g,
    );
    const tagDelegations = content.match(
      /Apply the pipeline tag determined by the rule at the top of Step 6/g,
    );

    expect(labelDelegations).not.toBeNull();
    expect(labelDelegations?.length).toBe(4);
    expect(tagDelegations).not.toBeNull();
    expect(tagDelegations?.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// approve-brief test permissiveness audit
// ---------------------------------------------------------------------------

describe('approve-brief test regex permissiveness audit', () => {
  // These tests guard against the `\\?d` class of trap from
  // feedback_workflow_md_gotchas.md by walking through the simplest wrong
  // inputs that the regexes above SHOULD reject.
  const content = readFileSync(
    new URL('approve-brief.md', import.meta.url),
    'utf8',
  );

  /**
   * Slice the workflow content between two literal markers, asserting both
   * markers are present AND the end marker comes after the start marker.
   * Without these guards a missing marker would return -1 from indexOf,
   * which slice() interprets as a negative index — that produces a
   * substring counted from the END of the file and silently passes
   * (or silently fails) the body assertions for the wrong reason. Per
   * Copilot finding on PR #222 + the test permissiveness audit discipline.
   */
  const sliceBetween = (start: string, end: string): string => {
    const startIdx = content.indexOf(start);
    const endIdx = content.indexOf(end);

    expect(startIdx, `start marker not found: ${start}`).toBeGreaterThanOrEqual(
      0,
    );
    expect(endIdx, `end marker not found: ${end}`).toBeGreaterThanOrEqual(0);
    expect(endIdx, `end marker before start marker`).toBeGreaterThan(startIdx);

    return content.slice(startIdx, endIdx);
  };

  it('rule-2 body does NOT contain a swapped label', () => {
    // Sanity check: rule 2 must reference CLANCY_LABEL_PLAN, not _BUILD.
    // If someone accidentally swapped the labels in the preamble, the
    // existing rule-2 assertion above would still match the heading; this
    // assertion makes the swap fail loudly.
    const rule2ToRule3 = sliceBetween(
      '2. Install mode is **standalone+board**',
      '3. Install mode is **terminal** AND `CLANCY_ROLES` includes `planner`',
    );

    expect(rule2ToRule3).not.toContain('CLANCY_LABEL_BUILD');
  });

  it('rule-3 body does NOT contain a swapped label', () => {
    // Symmetric to rule-2 / rule-4. Rule 3 must reference CLANCY_LABEL_PLAN.
    const rule3ToRule4 = sliceBetween(
      '3. Install mode is **terminal** AND `CLANCY_ROLES` includes `planner`',
      '4. Install mode is **terminal** AND `CLANCY_ROLES` is set but does NOT include `planner`',
    );

    expect(rule3ToRule4).not.toContain('CLANCY_LABEL_BUILD');
  });

  it('rule-4 body does NOT contain a swapped label', () => {
    // Symmetric to the rule-2 check: rule 4 must reference
    // CLANCY_LABEL_BUILD, not _PLAN. Slice from rule-4 to the rule-block
    // terminator paragraph (the "This rule replaces..." line that follows
    // rule 4 in the preamble).
    const rule4ToTerminator = sliceBetween(
      '4. Install mode is **terminal** AND `CLANCY_ROLES` is set but does NOT include `planner`',
      'This rule replaces the per-platform fallthrough',
    );

    expect(rule4ToTerminator).not.toContain('CLANCY_LABEL_PLAN');
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

  it('includes brief header comment in env file', () => {
    expect(content).toContain('Configured by @chief-clancy/brief');
  });
});

// ---------------------------------------------------------------------------
// brief.md content assertions
// ---------------------------------------------------------------------------

describe('three-state mode detection', () => {
  const content = readFileSync(new URL('brief.md', import.meta.url), 'utf8');

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

  it('Step 10 runs when board credentials are available', () => {
    expect(content).toContain(
      'when board credentials are available (terminal mode or standalone+board mode)',
    );
  });

  it('Step 10a runs when board credentials are available', () => {
    expect(content).toContain('see Step 10 guard');
  });

  it('agent reference uses .claude/clancy/agents/ path', () => {
    expect(content).toContain('.claude/clancy/agents/devils-advocate.md');
    expect(content).not.toContain('src/agents/devils-advocate.md');
  });

  it('approve-brief references include standalone guidance', () => {
    expect(content).not.toMatch(/that is `\/clancy:approve-brief`\./);
    expect(content).toContain('npx chief-clancy');
  });
});

// ---------------------------------------------------------------------------
// uninstall-brief.md content assertions
// ---------------------------------------------------------------------------

describe('uninstall-brief workflow', () => {
  const content = readFileSync(
    new URL('uninstall-brief.md', import.meta.url),
    'utf8',
  );

  it('detects install location via VERSION.brief marker', () => {
    expect(content).toContain('VERSION.brief');
  });

  it('checks both local and global locations', () => {
    expect(content).toContain('.claude/commands/clancy/VERSION.brief');
    expect(content).toContain('~/.claude/commands/clancy/VERSION.brief');
  });

  it('lists brief-exclusive files to remove', () => {
    expect(content).toContain('approve-brief.md');
    expect(content).toContain('brief.md');
    expect(content).toContain('devils-advocate.md');
  });

  it('lists shared files that require version-marker checks', () => {
    expect(content).toContain('board-setup.md');
    expect(content).toContain('map-codebase.md');
    expect(content).toContain('update-docs.md');
    expect(content).toContain('arch-agent.md');
    expect(content).toContain('concerns-agent.md');
    expect(content).toContain('design-agent.md');
    expect(content).toContain('quality-agent.md');
    expect(content).toContain('tech-agent.md');
  });

  it('checks VERSION markers for all other packages', () => {
    expect(content).toContain('VERSION.plan');
    expect(content).toContain('VERSION.dev');
    expect(content).toContain('<base>/commands/clancy/VERSION`');
  });

  it('notes VERSION.dev lives at .clancy/ not commands/clancy/', () => {
    expect(content).toContain('.clancy/VERSION.dev');
  });

  it('defaults to keeping shared files when VERSION.dev cannot be confirmed absent', () => {
    expect(content).toContain('assume dev may be installed elsewhere');
  });

  it('deletes VERSION.brief last for crash recovery', () => {
    expect(content).toContain('VERSION marker (always last)');
    expect(content).toContain(
      'deleted **last** so that a crash during removal leaves the marker in place',
    );
  });

  it('does not touch hooks, settings, or CLAUDE.md', () => {
    expect(content).toContain('Never touch hooks');
    expect(content).toContain('settings.json');
    expect(content).toContain('CLAUDE.md');
  });

  it('removes the uninstall command itself', () => {
    expect(content).toContain('uninstall-brief.md');
    expect(content).toContain('Uninstall command itself');
  });

  it('cleans up empty directories', () => {
    expect(content).toContain('Clean up empty directories');
    expect(content).toContain('only if it is completely empty');
  });

  it('provides reinstall instructions in the final message', () => {
    expect(content).toContain('npx @chief-clancy/brief');
  });

  it('scopes out .clancy/ folder removal', () => {
    expect(content).not.toContain('Remove .clancy/');
    expect(content).toContain(
      'Never touch hooks, `settings.json`, `CLAUDE.md`, `.gitignore`, `.prettierignore`, or `.clancy/`',
    );
  });
});
