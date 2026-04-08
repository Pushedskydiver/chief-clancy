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

const EXPECTED_WORKFLOWS = ['approve-plan.md', 'board-setup.md', 'plan.md'];

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

// ---------------------------------------------------------------------------
// --from flag: parsing and validation
// ---------------------------------------------------------------------------

describe('--from flag parsing', () => {
  const content = readFileSync(new URL('plan.md', import.meta.url), 'utf8');

  it('documents --from input mode in Step 2', () => {
    expect(content).toContain('--from');
    expect(content).toContain('local brief file');
  });

  it('cannot combine --from with ticket key', () => {
    expect(content).toContain('Cannot use both a ticket reference and --from');
  });

  it('cannot combine --from with batch mode', () => {
    expect(content).toContain('Cannot use batch mode with --from');
  });

  it('validates file exists', () => {
    expect(content).toContain('File not found');
  });

  it('validates file is not empty', () => {
    expect(content).toContain('File is empty');
  });

  it('warns on large files (>50KB)', () => {
    expect(content).toContain('50KB');
  });
});

describe('--from brief validation', () => {
  const content = readFileSync(new URL('plan.md', import.meta.url), 'utf8');

  it('validates file is a Clancy brief', () => {
    expect(content).toContain('does not appear to be a Clancy brief');
  });

  it('checks for Problem Statement or Ticket Decomposition', () => {
    expect(content).toContain('## Problem Statement');
    expect(content).toContain('## Ticket Decomposition');
  });

  it('points to /clancy:brief --from for raw files', () => {
    expect(content).toContain('/clancy:brief --from');
  });
});

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

  it('--from mode gathers from local brief file', () => {
    expect(content).toContain('Step 3a');
    expect(content).toContain('Gather from local brief');
  });

  it('--from parses Source field from brief', () => {
    expect(content).toContain('**Source:**');
  });

  it('--from extracts Problem Statement and Goals', () => {
    expect(content).toContain('## Problem Statement');
    expect(content).toContain('## Goals');
  });

  it('--from reads Ticket Decomposition for context', () => {
    expect(content).toContain('## Ticket Decomposition');
  });

  it('--from mode bypasses standalone board-ticket guard', () => {
    expect(content).toContain('--from');
    expect(content).toContain('bypasses the standalone board-ticket guard');
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

// ---------------------------------------------------------------------------
// Local plan output (--from mode)
// ---------------------------------------------------------------------------

describe('local plan output', () => {
  const content = readFileSync(new URL('plan.md', import.meta.url), 'utf8');

  it('saves plans to .clancy/plans/ directory', () => {
    expect(content).toContain('.clancy/plans/');
  });

  it('creates .clancy/plans/ directory if needed', () => {
    expect(content).toContain('Create `.clancy/plans/` directory');
  });

  it('generates slug from brief filename', () => {
    expect(content).toContain('YYYY-MM-DD-');
    expect(content).toContain('date prefix');
  });

  it('checks for existing local plan by filename', () => {
    expect(content).toContain('.clancy/plans/{slug}-{row-number}.md');
  });

  it('--fresh overwrites existing local plan', () => {
    expect(content).toContain('--fresh');
    expect(content).toContain('overwrite');
  });

  it('stops if plan exists without --fresh', () => {
    expect(content).toContain('Already planned');
  });

  it('local plan header includes Source and Brief fields', () => {
    expect(content).toContain('**Source:**');
    expect(content).toContain('**Brief:**');
  });

  it('offers to post as comment when board credentials available', () => {
    expect(content).toContain('board credentials ARE available');
  });
});

// ---------------------------------------------------------------------------
// --from mode Step 4 adaptations
// ---------------------------------------------------------------------------

describe('--from Step 4 adaptations', () => {
  const content = readFileSync(new URL('plan.md', import.meta.url), 'utf8');

  it('documents Step 4 adaptations for --from mode', () => {
    expect(content).toContain('--from mode Step 4 adaptations');
  });

  it('uses slug as display identifier instead of ticket key', () => {
    expect(content).toContain('Use the slug');
    expect(content).toContain('wherever board mode uses `{KEY}`');
  });

  it('skips board comment posting for infeasible tickets', () => {
    expect(content).toContain(
      'do NOT post a "Clancy skipped" comment to any board',
    );
  });

  it('skips QA return detection in --from mode', () => {
    expect(content).toContain('Skip entirely in `--from` mode');
  });
});

// ---------------------------------------------------------------------------
// --from mode Step 6 log entries
// ---------------------------------------------------------------------------

describe('--from Step 6 log entries', () => {
  const content = readFileSync(new URL('plan.md', import.meta.url), 'utf8');

  it('defines --from mode log format with slug', () => {
    expect(content).toContain('LOCAL_PLAN');
    expect(content).toContain('{slug}');
  });
});

// ---------------------------------------------------------------------------
// Summary update for --from mode
// ---------------------------------------------------------------------------

describe('--from summary output', () => {
  const content = readFileSync(new URL('plan.md', import.meta.url), 'utf8');

  it('shows local file path instead of Comment posted', () => {
    expect(content).toContain('Saved to .clancy/plans/');
  });

  it('mentions --from in standalone guard hint', () => {
    expect(content).toContain('/clancy:plan --from');
  });
});

// ---------------------------------------------------------------------------
// Row selection + multi-row planning (--from mode)
// ---------------------------------------------------------------------------

describe('decomposition table parsing', () => {
  const content = readFileSync(new URL('plan.md', import.meta.url), 'utf8');

  it('parses decomposition table rows', () => {
    expect(content).toContain('row number (column 1)');
    expect(content).toContain('title (column 2)');
  });

  it('validates rows have minimum required fields', () => {
    expect(content).toContain('valid row must have');
  });

  it('skips malformed rows with warning', () => {
    expect(content).toContain('Skipping malformed row');
  });

  it('falls back to single planning unit when table is missing', () => {
    expect(content).toContain('Planning the brief as a single item');
  });

  it('falls back to single unit when all rows are malformed', () => {
    expect(content).toContain('ALL rows are malformed');
  });

  it('rows are 1-indexed from data rows', () => {
    expect(content).toContain('1-indexed');
    expect(content).toContain('excluding header and separator');
  });
});

describe('planned marker tracking', () => {
  const content = readFileSync(new URL('plan.md', import.meta.url), 'utf8');

  it('tracks planned rows via HTML comment marker', () => {
    expect(content).toContain('<!-- planned:');
  });

  it('updates marker after planning a row', () => {
    expect(content).toContain('<!-- planned:1,2,3 -->');
    expect(content).toContain('<!-- planned:1,2,3,4 -->');
  });

  it('places marker before trailing --- or at EOF', () => {
    expect(content).toContain('trailing `---`');
  });

  it('stops when all rows are planned', () => {
    expect(content).toContain('All decomposition rows have been planned');
  });

  it('notes concurrency limitation', () => {
    expect(content).toContain('not concurrency-safe');
  });
});

describe('row targeting with --from path N', () => {
  const content = readFileSync(new URL('plan.md', import.meta.url), 'utf8');

  it('bare integer after --from selects a specific row', () => {
    expect(content).toContain('selects row N');
  });

  it('defaults to first unplanned row without a number', () => {
    expect(content).toContain('first unplanned row');
  });

  it('errors if targeted row is already planned without --fresh', () => {
    expect(content).toContain('already planned');
  });

  it('validates row number is a positive integer', () => {
    expect(content).toContain('Row number must be a positive integer');
  });

  it('validates row number exists in decomposition table', () => {
    expect(content).toContain('Row {N} not found');
    expect(content).toContain('decomposition rows');
  });

  it('bare integer with --from is always a row number, not batch', () => {
    expect(content).toContain(
      'bare integer is always interpreted as a row number',
    );
  });
});

describe('--afk multi-row and single-row default', () => {
  const content = readFileSync(new URL('plan.md', import.meta.url), 'utf8');

  it('--afk plans all unplanned rows in sequence', () => {
    expect(content).toContain('all unplanned rows');
    expect(content).toContain('sequentially');
  });

  it('without --afk plans exactly one row', () => {
    expect(content).toContain('exactly one row');
  });

  it('--fresh with specific row overwrites plan file', () => {
    expect(content).toContain('marker is not modified');
  });

  it('--fresh + --afk re-plans all rows from scratch', () => {
    expect(content).toContain('clears the planned marker entirely');
  });
});

describe('row-aware plan filename', () => {
  const content = readFileSync(new URL('plan.md', import.meta.url), 'utf8');

  it('plan filename includes row number', () => {
    expect(content).toContain('{slug}-{row-number}.md');
  });

  it('plan header includes Row field', () => {
    expect(content).toContain('**Row:**');
  });
});

// ---------------------------------------------------------------------------
// Local plan feedback loop (--from mode)
// ---------------------------------------------------------------------------

describe('local plan feedback loop', () => {
  const content = readFileSync(new URL('plan.md', import.meta.url), 'utf8');

  it('detects ## Feedback section in existing plan files', () => {
    expect(content).toContain('## Feedback');
    expect(content).toContain('local plan file');
  });

  it('revises plan when feedback found', () => {
    expect(content).toContain('Revise:');
    expect(content).toContain('read existing plan + feedback');
  });

  it('stops on existing plan without feedback or --fresh', () => {
    expect(content).toContain('Add a ## Feedback section to revise');
  });

  it('prepends Changes From Previous Plan section', () => {
    expect(content).toContain('### Changes From Previous Plan');
  });

  it('passes feedback to generation step as additional context', () => {
    expect(content).toContain('Pass this feedback to the plan generation');
  });

  it('plan footer mentions ## Feedback for revision', () => {
    expect(content).toContain('add a ## Feedback section');
  });

  it('--fresh takes precedence over feedback', () => {
    expect(content).toContain('takes precedence over feedback');
  });

  it('handles multiple ## Feedback sections by concatenating', () => {
    expect(content).toContain('multiple `## Feedback` sections');
    expect(content).toContain('concatenate all sections');
  });

  it('matches ## Feedback as line-anchored heading not in code fences', () => {
    expect(content).toContain('start of a line');
    expect(content).toContain('not inside code fences');
  });

  it('feedback is not carried forward to revised plan', () => {
    expect(content).toContain('NOT carried forward');
  });

  it('specifies revision procedure for Step 4 sub-steps', () => {
    expect(content).toContain('Skip Step 4a');
    expect(content).toContain('reuse the existing exploration');
  });

  it('--afk multi-row includes rows with feedback', () => {
    expect(content).toContain('(unplanned rows) ∪ (rows with feedback)');
  });

  it('default row selection prefers rows with feedback first', () => {
    expect(content).toContain(
      'first row with feedback if any, otherwise first unplanned row',
    );
  });

  it('revised local plans use LOCAL_REVISED log entry', () => {
    expect(content).toContain('LOCAL_REVISED');
  });

  it('Changes From Previous Plan is positioned for local template', () => {
    expect(content).toContain('after the local header block');
  });
});

// ---------------------------------------------------------------------------
// --list flag: plan inventory
// ---------------------------------------------------------------------------

describe('--list flag handling', () => {
  const content = readFileSync(new URL('plan.md', import.meta.url), 'utf8');

  it('documents --list flag in Step 2 arg list', () => {
    expect(content).toContain('**`--list`:** display the plan inventory');
  });

  it('--list short-circuits Step 1 preflight', () => {
    expect(content).toContain('### 0. Short-circuit on `--list`');
    expect(content).toContain(
      'skip the rest of Step 1 entirely (no installation detection, no `git fetch`',
    );
    expect(content).toContain('jump straight to Step 8');
  });

  it('--list takes precedence over other flags and arguments', () => {
    expect(content).toContain('`--list` always wins over other flags');
    expect(content).toContain(
      'the inventory is displayed and the other flags are ignored',
    );
  });

  it('standalone board-ticket guard skips when --list is present', () => {
    expect(content).toContain(
      'Skip this guard entirely if `--list` was passed',
    );
  });
});

describe('plan inventory step', () => {
  const content = readFileSync(new URL('plan.md', import.meta.url), 'utf8');

  it('defines a Plan inventory step at Step 8', () => {
    expect(content).toContain('## Step 8 — Plan inventory (`--list`)');
  });

  it('scans .clancy/plans/ for markdown files', () => {
    expect(content).toContain('Scan `.clancy/plans/` for all `.md` files');
  });

  it('parses plan headers written by Step 5a', () => {
    // Each header field gets its own line item describing how it is parsed
    // (the `**Foo:**` strings exist elsewhere in the file too — these tests
    // assert the Step 8 parsing intent, not just substring presence).
    expect(content).toContain('value of the `**Brief:**` line');
    expect(content).toContain('value of the `**Row:**` line');
    expect(content).toContain('value of the `**Source:**` line');
    expect(content).toContain('value of the `**Planned:**` line');
  });

  it('Plan ID is the filename minus .md, not the brief slug', () => {
    expect(content).toContain(
      '**Plan ID** — the plan filename minus the `.md` extension',
    );
    expect(content).toContain('first column in the listing is the Plan ID');
  });

  it('reserves a Status column for the future approve-plan PR', () => {
    expect(content).toContain('**Status**');
    expect(content).toContain('always `Planned`');
    expect(content).toContain('`.approved` marker');
  });

  it('sort is deterministic with explicit tie-breakers', () => {
    expect(content).toContain('newest first');
    expect(content).toContain(
      'Tie-break on same date by Plan ID, alphabetical ascending',
    );
    expect(content).toContain(
      'Files with a missing or unparseable date sort last',
    );
    expect(content).toContain('deterministic across runs');
  });

  it('handles empty or missing .clancy/plans/ directory', () => {
    expect(content).toContain(
      'If `.clancy/plans/` does not exist or contains no `.md` files',
    );
    expect(content).toContain('No plans found');
  });

  it('describes how missing header fields are rendered', () => {
    expect(content).toContain(
      'Display the literal `?` if the line is absent or empty',
    );
  });

  it('inventory step is filesystem-only (no API/board access)', () => {
    expect(content).toContain(
      'filesystem-only — no API calls, no board access, no `.clancy/.env` required',
    );
  });

  it('--list never writes to progress.txt or any other file', () => {
    expect(content).toContain(
      'never logs to `.clancy/progress.txt` and never modifies any file',
    );
  });
});
