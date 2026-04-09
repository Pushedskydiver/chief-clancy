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
    expect(content).toContain('first column (after `#`) is the Plan ID');
  });

  it('Status column reads sibling .approved marker for live state', () => {
    expect(content).toContain('**Status**');
    expect(content).toContain('sibling `.approved` marker');
  });

  it('Status is Planned when no marker exists', () => {
    expect(content).toContain('marker absent → `Planned`');
  });

  it('Status is Approved when marker sha256 matches the current plan file', () => {
    expect(content).toContain('sha256` matches the current plan file');
    expect(content).toContain('→ `Approved`');
  });

  it('Status is Stale (re-approve) when marker sha256 drifts from the plan file', () => {
    expect(content).toContain('Stale (re-approve)');
    expect(content).toContain('sha256` differs');
  });

  it('inventory example shows at least one Approved row', () => {
    // Match a pipe-delimited table cell on both sides (literal `|`s with
    // tolerant whitespace) so the test proves the example output is in the
    // pipe-delimited table format, not just that the word `Approved` happens
    // to appear in nearby prose.
    expect(content).toMatch(/\|\s*Approved\s*\|/);
  });

  it('inventory example shows at least one Stale row', () => {
    expect(content).toMatch(/\|\s*Stale \(re-approve\)\s*\|/);
  });

  it('inventory example still shows at least one Planned row', () => {
    expect(content).toMatch(/\|\s*Planned\s*\|/);
  });

  it('inventory documents the summary line format and zero-count omission', () => {
    expect(content).toContain('Summary line');
    expect(content).toContain(
      '{N} local plan(s). {A} approved, {S} stale, {P} planned.',
    );
    expect(content).toContain('Omit zero-count states');
  });

  it('explains that Stale means the plan was edited after approval', () => {
    expect(content).toContain('plan file was edited after approval');
  });

  it('reserves an Implemented state for the deferred plan-implementing tool', () => {
    expect(content).toContain('Implemented');
    expect(content).toMatch(
      /deferred[\s\S]{0,120}(?:plan-implementing tool|future implementation tooling)|(?:plan-implementing tool|future implementation tooling)[\s\S]{0,120}deferred/i,
    );
    expect(content).toContain('shows three states');
  });

  it('folds malformed .approved markers into Stale (re-approve)', () => {
    expect(content).toContain('marker exists but is malformed');
    expect(content).toContain('non-hex or wrong-length');
    expect(content).toContain('cannot be parsed deterministically');
  });

  it('uses {plan-id} placeholder consistently in the footer (no <plan-id>)', () => {
    expect(content).not.toContain('<plan-id>');
    expect(content).toContain('/clancy:approve-plan {plan-id}');
  });

  it('inventory footer hint points at /clancy:approve-plan', () => {
    expect(content).toContain('/clancy:approve-plan');
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

// ---------------------------------------------------------------------------
// approve-plan.md content assertions (PR 7b — standalone adaptation)
// ---------------------------------------------------------------------------

describe('approve-plan three-state preflight', () => {
  const content = readFileSync(
    new URL('approve-plan.md', import.meta.url),
    'utf8',
  );

  it('Step 1 detects all three installation states', () => {
    expect(content).toContain('standalone mode');
    expect(content).toContain('standalone+board mode');
    expect(content).toContain('terminal mode');
  });

  it('Step 1 checks .clancy/.env presence for state detection', () => {
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

  it('standalone mode requires .clancy/plans/ to exist', () => {
    expect(content).toContain('.clancy/plans/');
  });
});

describe('approve-plan dual-mode resolver (Step 2)', () => {
  const content = readFileSync(
    new URL('approve-plan.md', import.meta.url),
    'utf8',
  );

  it('Step 2 routes between plan-file stem and ticket key based on mode', () => {
    expect(content).toContain('plan-file stem');
    expect(content).toContain('ticket key');
  });

  it('standalone mode only accepts plan-file stems', () => {
    expect(content).toContain(
      'In standalone mode, the argument must be a plan-file stem',
    );
  });

  it('standalone+board and terminal modes try plan-file lookup first', () => {
    expect(content).toContain(
      'Try plan-file lookup first (does `.clancy/plans/{arg}.md` exist?)',
    );
  });

  it('plan stem wins over ticket key on collision', () => {
    expect(content).toContain('plan stem wins over ticket key');
  });

  it('standalone no-arg auto-selects oldest unapproved plan', () => {
    expect(content).toContain('auto-select the oldest unapproved local plan');
    expect(content).toContain('no sibling marker');
  });

  it('standalone no-arg filters scan to actual plan files', () => {
    expect(content).toContain('## Clancy Implementation Plan');
    expect(content).toContain('Filter to plan files only');
  });

  it('standalone no-arg sorts files with missing/unparseable date last', () => {
    expect(content).toContain('missing or unparseable `**Planned:**` date');
    expect(content).toContain('sort **last**');
  });

  it('preserves existing terminal-mode no-arg progress.txt scan', () => {
    expect(content).toContain('.clancy/progress.txt');
    expect(content).toContain('| PLAN |');
  });

  it('errors clearly if standalone arg is not a plan-file stem', () => {
    expect(content).toContain('Plan file not found:');
  });

  it('errors if standalone has no plans and no arg', () => {
    expect(content).toContain('No local plans awaiting approval');
  });
});

describe('approve-plan local marker (Step 4a)', () => {
  const content = readFileSync(
    new URL('approve-plan.md', import.meta.url),
    'utf8',
  );

  it('defines Step 4a — Write local marker', () => {
    expect(content).toContain('## Step 4a — Write local marker');
  });

  it('Step 4a runs only when the resolved arg was a plan-file stem', () => {
    expect(content).toContain(
      'Run this step instead of Steps 5, 5b, 6 when the resolved argument was a plan-file stem',
    );
  });

  it('writes marker to .clancy/plans/{stem}.approved', () => {
    expect(content).toContain('.clancy/plans/{stem}.approved');
  });

  it('uses race-safe exclusive create (O_EXCL / wx)', () => {
    expect(content).toContain('exclusive create');
    expect(content).toContain('O_EXCL');
    expect(content).toContain('wx');
  });

  it('marker body contains sha256 and approved_at fields', () => {
    expect(content).toContain('sha256=');
    expect(content).toContain('approved_at=');
  });

  it('sha256 is computed over the plan file content at approval time', () => {
    expect(content).toContain('SHA-256');
    expect(content).toContain('Order of operations');
    expect(content).toContain(
      'Read the plan file at `.clancy/plans/{stem}.md` from disk',
    );
  });

  it('SHA hash is never computed over the .approved marker itself', () => {
    expect(content).toContain('`.approved` file is **never** included');
  });

  it('approved_at is ISO 8601 UTC', () => {
    expect(content).toContain('ISO 8601');
  });

  it('handles EEXIST as already-approved', () => {
    expect(content).toContain('EEXIST');
    expect(content).toContain('already approved');
  });

  it('explains the marker is the gate for future implementation tooling', () => {
    expect(content).toContain('gate');
    expect(content).toContain('future implementation tooling');
    expect(content).toMatch(
      /deferred[\s\S]{0,120}(?:plan-implementing tool|future implementation tooling)|(?:plan-implementing tool|future implementation tooling)[\s\S]{0,120}deferred/i,
    );
  });

  it('after writing the marker, Step 4a continues to Step 4c (PR 9 — was Step 7 in PR 7b)', () => {
    // PR 7b's "jump to Step 7" was rewritten in PR 9 slice 1 / DA H2 fix:
    // the post-marker tail now hands off to Step 4c (Optional board push),
    // which is best-effort and gates on board credentials. Steps 5/5b/6
    // remain unreachable in plan-file stem mode regardless.
    const afterMarkerIdx = content.indexOf('### After writing the marker');
    const tailEnd = content.indexOf('---', afterMarkerIdx);
    const tail = content.slice(afterMarkerIdx, tailEnd);
    expect(tail).toMatch(/Step 4c/);
    expect(tail).toMatch(/Steps 5, 5b, and 6[^.]*skipped/i);
  });
});

describe('approve-plan brief-marker update (Step 4b)', () => {
  const content = readFileSync(
    new URL('approve-plan.md', import.meta.url),
    'utf8',
  );

  it('defines Step 4b — Update brief marker', () => {
    expect(content).toContain('## Step 4b — Update brief marker');
  });

  it('resolves brief filename from the plan **Brief:** header', () => {
    expect(content).toContain('**Brief:**');
    expect(content).toContain('extract the `**Brief:**` header line');
  });

  it('resolves row number from the plan **Row:** header', () => {
    expect(content).toContain('**Row:**');
  });

  it('uses a tolerant line-anchored regex with optional approved prefix', () => {
    expect(content).toContain(
      '^<!--\\s*(?:approved:([\\d,]*)\\s+)?planned:([\\d,]+)\\s*-->\\s*$',
    );
  });

  it('canonical ordering puts approved before planned', () => {
    expect(content).toContain('approved:` first, `planned:` second');
  });

  it('handles existing planned-only marker (PR 6b state)', () => {
    expect(content).toContain('<!-- planned:1,2,3 -->');
  });

  it('handles existing approved+planned marker', () => {
    expect(content).toContain('<!-- approved:1 planned:1,2,3 -->');
  });

  it('handles unspaced marker variant', () => {
    expect(content).toContain('<!--planned:1,2,3-->');
  });

  it('best-effort: failure does not roll back the .approved marker', () => {
    expect(content).toContain('does NOT roll back');
    expect(content).toContain('local marker is the source of truth');
  });

  it('warns and skips when **Brief:** header is absent', () => {
    expect(content).toContain('cannot update brief marker');
  });

  it('documents concurrency-not-safe nature of the read-modify-write', () => {
    expect(content).toContain('not concurrency-safe');
  });

  it('documents reversed-order brief markers fall through to warn-and-skip', () => {
    expect(content).toContain('Reversed-order markers');
    expect(content).toContain('do NOT match this regex');
  });

  it('documents code-fence false-positive risk', () => {
    expect(content).toContain('Code-fence false positives');
    expect(content).toContain('first match wins');
  });
});

describe('approve-plan local-mode log + summary (Step 7)', () => {
  const content = readFileSync(
    new URL('approve-plan.md', import.meta.url),
    'utf8',
  );

  it('uses LOCAL_APPROVE_PLAN log token for plan-file stem mode', () => {
    expect(content).toContain('LOCAL_APPROVE_PLAN');
  });

  it('local log entry includes the sha256 prefix for audit', () => {
    expect(content).toContain('sha256={first 12 hex}');
  });

  it('local success summary points users at the deferred next-step paths', () => {
    expect(content).toContain('Ask Claude Code:');
    expect(content).toContain('Implement .clancy/plans/{stem}.md');
    expect(content).toContain('npx chief-clancy');
  });

  it('preserves board-mode APPROVE_PLAN log entry', () => {
    expect(content).toContain('| {KEY} | APPROVE_PLAN | —');
  });

  it('Step 7 has an explicit mode gate so local and board branches do not double-render', () => {
    expect(content).toContain('Mode gate (read first)');
    expect(content).toContain(
      'Do NOT render both — exactly one branch executes per approval',
    );
  });

  it('plan-file-not-found error hints at the row-number convention', () => {
    expect(content).toContain('Plan stems include the row number');
    expect(content).toContain('Run /clancy:plan --list');
  });

  it('EEXIST advice points at manual deletion, not a non-existent --fresh flag', () => {
    expect(content).toContain('Delete .clancy/plans/{stem}.approved manually');
    expect(content).not.toContain('/clancy:approve-plan --fresh');
  });
});

describe('approve-plan board mode preserved unchanged', () => {
  const content = readFileSync(
    new URL('approve-plan.md', import.meta.url),
    'utf8',
  );

  it('keeps Jira ADF construction', () => {
    expect(content).toContain('ADF');
  });

  it('keeps GitHub PATCH /issues for description update', () => {
    expect(content).toContain('PATCH');
    expect(content).toContain('/issues/');
  });

  it('keeps Linear issueUpdate mutation', () => {
    expect(content).toContain('issueUpdate');
  });

  it('keeps Azure DevOps work item update', () => {
    expect(content).toContain('Azure DevOps');
  });

  it('keeps Shortcut PUT /stories', () => {
    expect(content).toContain('Shortcut');
  });

  it('keeps Notion description update', () => {
    expect(content).toContain('Notion');
  });
});

// PR 9 — Slice 0/6: drift-prevention for the duplicated push curl blocks.
// Slice 0 declared the start/end anchors in both files. Slice 6 promotes
// this suite to a byte-equality check between the wrapped regions: the
// canonical curl blocks live in plan.md Step 5b; approve-plan.md Step 4c
// holds an identical duplicate.
describe('approve-plan board push drift anchors (PR 9 Slice 0/6)', () => {
  const planContent = readFileSync(new URL('plan.md', import.meta.url), 'utf8');
  const approveContent = readFileSync(
    new URL('approve-plan.md', import.meta.url),
    'utf8',
  );

  const startAnchor = '<!-- curl-blocks:approve-plan-push:start -->';
  const endAnchor = '<!-- curl-blocks:approve-plan-push:end -->';

  const extractRegion = (source: string): string => {
    const startIdx = source.indexOf(startAnchor);
    const endIdx = source.indexOf(endAnchor);
    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
      throw new Error('curl-blocks anchors missing or out of order');
    }
    return source.slice(startIdx + startAnchor.length, endIdx);
  };

  it('plan.md declares the start anchor exactly once', () => {
    const matches = planContent.split(startAnchor).length - 1;
    expect(matches).toBe(1);
  });

  it('plan.md declares the end anchor exactly once', () => {
    const matches = planContent.split(endAnchor).length - 1;
    expect(matches).toBe(1);
  });

  it('plan.md start anchor precedes end anchor', () => {
    expect(planContent.indexOf(startAnchor)).toBeLessThan(
      planContent.indexOf(endAnchor),
    );
  });

  it('approve-plan.md declares the start anchor exactly once', () => {
    const matches = approveContent.split(startAnchor).length - 1;
    expect(matches).toBe(1);
  });

  it('approve-plan.md declares the end anchor exactly once', () => {
    const matches = approveContent.split(endAnchor).length - 1;
    expect(matches).toBe(1);
  });

  it('approve-plan.md start anchor precedes end anchor', () => {
    expect(approveContent.indexOf(startAnchor)).toBeLessThan(
      approveContent.indexOf(endAnchor),
    );
  });

  it('the duplicated curl-blocks region is byte-equal between the two files', () => {
    const planRegion = extractRegion(planContent);
    const approveRegion = extractRegion(approveContent);
    expect(approveRegion).toBe(planRegion);
  });

  it('the duplicated region is non-empty (slice 6 populated it)', () => {
    const planRegion = extractRegion(planContent);
    expect(planRegion.length).toBeGreaterThan(100);
    // Sanity: region must contain at least one of the six platform headings.
    expect(planRegion).toMatch(/### Jira/);
  });
});

// PR 9 — Slice 1: Step 4c heading + run conditions. Step 4c is the optional
// board push, gated on (a) Step 4a having written a marker AND (b) board
// credentials being present in .clancy/.env. Either gate failing → skip
// silently and continue to Step 7. Step 4b's tail must now route through 4c
// instead of jumping straight to Step 7.
describe('approve-plan Step 4c run conditions (PR 9 Slice 1)', () => {
  const content = readFileSync(
    new URL('approve-plan.md', import.meta.url),
    'utf8',
  );

  it('defines Step 4c — Optional board push', () => {
    expect(content).toContain('## Step 4c — Optional board push (best-effort)');
  });

  it('Step 4c is positioned after Step 4b and before Step 5', () => {
    const stepFourB = content.indexOf('## Step 4b — Update brief marker');
    const stepFourC = content.indexOf('## Step 4c — Optional board push');
    const stepFive = content.indexOf('## Step 5 — Update ticket description');
    expect(stepFourB).toBeGreaterThan(-1);
    expect(stepFourC).toBeGreaterThan(stepFourB);
    expect(stepFive).toBeGreaterThan(stepFourC);
  });

  it('Step 4c gates on Step 4a having written the marker', () => {
    const fourCStart = content.indexOf('## Step 4c — Optional board push');
    const fourCEnd = content.indexOf('## Step 5 — Update ticket description');
    const fourCBody = content.slice(fourCStart, fourCEnd);
    // Run-condition prose must reference the marker write from 4a.
    expect(fourCBody).toMatch(/Step 4a/);
    expect(fourCBody).toMatch(/marker/i);
  });

  it('Step 4c gates on board credentials being available', () => {
    const fourCStart = content.indexOf('## Step 4c — Optional board push');
    const fourCEnd = content.indexOf('## Step 5 — Update ticket description');
    const fourCBody = content.slice(fourCStart, fourCEnd);
    expect(fourCBody).toContain('.clancy/.env');
    expect(fourCBody).toMatch(/board credentials/i);
  });

  it('Step 4c skips silently when either gate fails and continues to Step 7', () => {
    const fourCStart = content.indexOf('## Step 4c — Optional board push');
    const fourCEnd = content.indexOf('## Step 5 — Update ticket description');
    const fourCBody = content.slice(fourCStart, fourCEnd);
    // "skip silently" + onward routing to Step 7.
    expect(fourCBody).toMatch(/skip[^.]*silent/i);
    expect(fourCBody).toMatch(/Step 7/);
  });

  it('Step 4c is best-effort and never rolls back the local marker', () => {
    const fourCStart = content.indexOf('## Step 4c — Optional board push');
    const fourCEnd = content.indexOf('## Step 5 — Update ticket description');
    const fourCBody = content.slice(fourCStart, fourCEnd);
    expect(fourCBody).toMatch(/best-effort/i);
    // Marker is authoritative; push failure must not roll back.
    expect(fourCBody).toMatch(
      /never[^.]*rolls?[- ]?back|do(?:es)? not rolls?[- ]?back/i,
    );
  });

  it('Step 4b tail now routes through Step 4c instead of jumping to Step 7', () => {
    const fourBStart = content.indexOf('## Step 4b — Update brief marker');
    const fourCStart = content.indexOf('## Step 4c — Optional board push');
    const fourBBody = content.slice(fourBStart, fourCStart);
    // 4b should hand off to 4c, not directly to Step 7.
    expect(fourBBody).toMatch(/Step 4c/);
    // The old "skip Steps 5, 5b, and 6 entirely" line must be gone — push
    // can still run via Step 4c when board credentials are present.
    expect(fourBBody).not.toMatch(/Skip Steps 5, 5b, and 6 entirely/);
  });

  it('no stale "jump to Step 7" routing prose remains in Steps 4a/4b', () => {
    // DA review H2/L2: the stale routing prose ("jump to Step 7" / "Steps
    // 5, 5b, 6 are skipped entirely") existed in BOTH Step 4a's "After
    // writing the marker" subsection AND Step 4b's tail. Slice 1 only
    // rewrote 4b. This regression test scans the whole 4a→4c span and
    // asserts no leftover prose still implies a direct 4a/4b → 7 jump.
    const fourAStart = content.indexOf('## Step 4a — Write local marker');
    const fourCStart = content.indexOf('## Step 4c — Optional board push');
    const span = content.slice(fourAStart, fourCStart);
    expect(span).not.toMatch(/jump to Step 7/i);
    expect(span).not.toMatch(/Skip Steps 5, 5b, and 6 entirely/);
  });

  it('Step 4a "After writing the marker" continues to Step 4c', () => {
    // DA review H2: the Step 4a tail must explicitly hand off to 4c so
    // an LLM reading 4a in order doesn't internalise the old PR 7b flow.
    const afterMarkerIdx = content.indexOf('### After writing the marker');
    const nextHeadingIdx = content.indexOf('---', afterMarkerIdx);
    const afterMarkerBody = content.slice(afterMarkerIdx, nextHeadingIdx);
    expect(afterMarkerBody).toMatch(/Step 4c/);
  });
});

// PR 9 — Slice 2: Source field is read directly from the local plan file's
// **Source:** header (NOT chased through the brief file the way Step 4b does).
// The plan header is the single source of truth for Step 4c.
describe('approve-plan Step 4c source-field read (PR 9 Slice 2)', () => {
  const content = readFileSync(
    new URL('approve-plan.md', import.meta.url),
    'utf8',
  );
  const fourCStart = content.indexOf('## Step 4c — Optional board push');
  const fourCEnd = content.indexOf('## Step 5 — Update ticket description');
  const fourCBody = content.slice(fourCStart, fourCEnd);

  it('Step 4c reads the **Source:** header from the plan file', () => {
    expect(fourCBody).toContain('**Source:**');
    expect(fourCBody).toContain('.clancy/plans/{stem}.md');
  });

  it('Step 4c does NOT open the brief file to find Source', () => {
    // The brief-file path pattern (.clancy/briefs/) appears in Step 4b but
    // must not appear in Step 4c — slice 2 reads Source from the plan file
    // directly to avoid a second filesystem hop.
    expect(fourCBody).not.toContain('.clancy/briefs/');
  });

  it('Step 4c documents the read order (after marker, before Source parse)', () => {
    // The read happens inside Step 4c body, after the run-condition gates
    // and before the (slice 3) format detection. Test the prose calls out
    // "read" and "**Source:**" together so the order is unambiguous.
    expect(fourCBody).toMatch(/read[^.]*\*\*Source:\*\*/i);
  });

  it('Step 4c handles a missing **Source:** header gracefully', () => {
    // If the plan file has no **Source:** line, Step 4c must skip silently
    // (same semantics as the run-condition gates). No crash, no warning.
    expect(fourCBody).toMatch(
      /missing[^.]*\*\*Source:\*\*|no \*\*Source:\*\*/i,
    );
    expect(fourCBody).toMatch(/skip/i);
  });
});

// PR 9 — Slice 3: three-format Source parser. Brief writes Source in one of
// three formats (per brief.md ~806-810): [KEY] Title (bracketed, pushable),
// "text" (inline quoted, no ticket), or path/to/file.md (file path, no
// ticket). Bracketed → continue to slice 4 validation. Other two →
// BOARD_PUSH_SKIPPED_NO_TICKET log token + stdout note + continue to Step 7.
describe('approve-plan Step 4c source-format parser (PR 9 Slice 3)', () => {
  const content = readFileSync(
    new URL('approve-plan.md', import.meta.url),
    'utf8',
  );
  const fourCStart = content.indexOf('## Step 4c — Optional board push');
  const fourCEnd = content.indexOf('## Step 5 — Update ticket description');
  const fourCBody = content.slice(fourCStart, fourCEnd);

  it('Step 4c documents the three brief Source formats', () => {
    // Bracketed key — the only pushable format.
    expect(fourCBody).toMatch(/\[#?\d+\]|\[[A-Z]+-\d+\]|\[\{KEY\}\]/);
    // Inline-quoted text format.
    expect(fourCBody).toMatch(/inline[- ]quoted|"[^"]+"/i);
    // File-path format.
    expect(fourCBody).toMatch(/file[- ]path|\.md/);
  });

  it('Step 4c only pushes for the bracketed-key format', () => {
    // Prose must explicitly say bracketed is the only pushable format.
    expect(fourCBody).toMatch(
      /bracket[^.]*only[^.]*push|only[^.]*bracket[^.]*push/i,
    );
  });

  it('Step 4c logs BOARD_PUSH_SKIPPED_NO_TICKET for non-bracketed Source', () => {
    expect(fourCBody).toContain('BOARD_PUSH_SKIPPED_NO_TICKET');
  });

  it('Step 4c skip-token logs to .clancy/progress.txt', () => {
    // The skip token is a progress.txt row, not just stdout — same audit
    // surface as LOCAL_APPROVE_PLAN.
    expect(fourCBody).toMatch(
      /BOARD_PUSH_SKIPPED_NO_TICKET[\s\S]*progress\.txt|progress\.txt[\s\S]*BOARD_PUSH_SKIPPED_NO_TICKET/,
    );
  });

  it('Step 4c skip-token row uses the {stem} | TOKEN | {detail} convention', () => {
    // Matches plan.md Step 6 / Step 7 LOCAL_APPROVE_PLAN convention:
    //   {stem} | BOARD_PUSH_SKIPPED_NO_TICKET | {source_format}
    expect(fourCBody).toMatch(
      /\{stem\}\s*\\?\|\s*BOARD_PUSH_SKIPPED_NO_TICKET\s*\\?\|\s*\{source_format\}/,
    );
  });

  it('Step 4c surfaces the skip in the local-mode success block', () => {
    // Stdout note so the user knows why no push happened. Not a warning —
    // an info line under the marker write success.
    expect(fourCBody).toMatch(/stdout|success block|local[- ]mode/i);
    expect(fourCBody).toMatch(/no pushable[^.]*ticket|no ticket[^.]*push/i);
  });

  it('Step 4c continues to Step 7 after a skip-no-ticket', () => {
    // After logging the skip token, flow continues normally — not an error.
    const skipRegion = fourCBody.slice(
      fourCBody.indexOf('BOARD_PUSH_SKIPPED_NO_TICKET'),
    );
    expect(skipRegion).toMatch(/Step 7|continue|proceed/i);
  });
});

// PR 9 — Slice 4: per-platform key validation. Once Source has been parsed
// into a bracketed-key form, the extracted key must match the configured
// board's regex BEFORE any push attempt. Six platforms, six inline regexes,
// hard-error on mismatch — no second-chance fallback. Single-board env, no
// cross-board disambiguation.
describe('approve-plan Step 4c key validation (PR 9 Slice 4)', () => {
  const content = readFileSync(
    new URL('approve-plan.md', import.meta.url),
    'utf8',
  );
  const fourCStart = content.indexOf('## Step 4c — Optional board push');
  const fourCEnd = content.indexOf('## Step 5 — Update ticket description');
  const fourCBody = content.slice(fourCStart, fourCEnd);

  it('Step 4c declares all six per-platform key regexes inline', () => {
    // Each assertion requires a literal `\d` (escaped backslash + d) so a
    // doc that accidentally drops the backslash from the regex table fails
    // the test instead of silently passing on a bare `d`. The Jira and
    // Linear assertions match on the [A-Za-z] character class (their first
    // distinguishing feature — lowercase allowed for parity with Step 2)
    // and tighten with \\d for the digits.
    // Jira: ^[A-Za-z][A-Za-z0-9]+-\d+$
    expect(fourCBody).toMatch(/Jira[\s\S]{0,200}\[A-Za-z\]\[A-Za-z0-9\]\+-\\d/);
    // GitHub: ^#?\d+$ — optional # so bare numbers are accepted (Step 2 parity)
    expect(fourCBody).toMatch(/GitHub[\s\S]{0,200}#\?\\d/);
    // Linear: ^[A-Za-z]{1,10}-\d+$
    expect(fourCBody).toMatch(/Linear[\s\S]{0,200}\[A-Za-z\]\{1,10\}-\\d/);
    // Azure DevOps: ^\d+$
    expect(fourCBody).toMatch(/Azure DevOps[\s\S]{0,200}\\d/);
    // Shortcut: ^(?:[A-Za-z]{1,5}-)?\d+$ — optional alpha prefix
    expect(fourCBody).toMatch(
      /Shortcut[\s\S]{0,200}\(\?:\[A-Za-z\]\{1,5\}-\)\?\\d/,
    );
    // Notion: notion-xxxxxxxx | 32-hex | 36-char UUID alternation
    expect(fourCBody).toMatch(/Notion[\s\S]{0,200}notion-/);
    expect(fourCBody).toMatch(/Notion[\s\S]{0,200}\[a-f0-9\]/);
  });

  it('Step 4c selects the regex from the configured board (single-board env)', () => {
    // Detection mirrors Step 1's three-state preflight — same .env reads.
    expect(fourCBody).toMatch(/configured board|board.*configured/i);
    expect(fourCBody).toMatch(/single[- ]board/i);
  });

  it('Step 4c validates the extracted key BEFORE any push attempt', () => {
    // Validation must happen before the curl region — not after.
    const validateIdx = fourCBody.search(/validat/i);
    const anchorIdx = fourCBody.indexOf(
      '<!-- curl-blocks:approve-plan-push:start -->',
    );
    expect(validateIdx).toBeGreaterThan(-1);
    expect(anchorIdx).toBeGreaterThan(-1);
    expect(validateIdx).toBeLessThan(anchorIdx);
  });

  it('Step 4c hard-errors on key/board mismatch (no fallback)', () => {
    // Mismatch is a hard error — not a silent skip, not a warning. The
    // user explicitly asked to push something the board can't accept.
    expect(fourCBody).toMatch(/hard[- ]error|hard error/i);
    // No second-chance — the test must reject prose suggesting a fallback
    // platform attempt or a "try the other regex" path.
    expect(fourCBody).not.toMatch(/try the other|fall ?back to[^.]*platform/i);
  });

  it('Step 4c key-mismatch error names the key and the configured board', () => {
    // Error message must be actionable: which key, which board.
    expect(fourCBody).toMatch(
      /\{KEY\}[\s\S]{0,400}\{board\}|\{board\}[\s\S]{0,400}\{KEY\}/,
    );
  });

  it('Step 4c key-mismatch DOES NOT roll back the local marker', () => {
    // Same best-effort rule as push failure — the marker is authoritative.
    // A bad --ticket override should never undo a successful Step 4a.
    const mismatchRegion = fourCBody.slice(fourCBody.search(/hard[- ]error/i));
    expect(mismatchRegion).toMatch(
      /marker[^.]*(stays|preserved|kept|authoritative)|never[^.]*rolls?[- ]?back/i,
    );
  });
});

// PR 9 — Slice 5: decision matrix. Three orthogonal axes — --push, --afk,
// --ticket — produce six meaningful cells. Default prompt is [y/N] (default
// No, never surprise-write). Two interactive prompts in non-afk flow is
// intentional (Step 4 confirms approval, Step 4c confirms push).
describe('approve-plan Step 4c decision matrix (PR 9 Slice 5)', () => {
  const content = readFileSync(
    new URL('approve-plan.md', import.meta.url),
    'utf8',
  );
  const fourCStart = content.indexOf('## Step 4c — Optional board push');
  const fourCEnd = content.indexOf('## Step 5 — Update ticket description');
  const fourCBody = content.slice(fourCStart, fourCEnd);

  it('Step 4c declares the new --push and --ticket flags', () => {
    expect(fourCBody).toContain('`--push`');
    expect(fourCBody).toContain('`--ticket');
  });

  it('Step 4c interactive prompt defaults to [y/N] (default No)', () => {
    expect(fourCBody).toContain('[y/N]');
    expect(fourCBody).toMatch(/default[^.]*No|never surprise[- ]write/i);
  });

  it('Step 4c interactive prompt text names the resolved KEY', () => {
    // The prompt must show which ticket the push will hit.
    expect(fourCBody).toMatch(
      /Push approved plan to[^.]*\{KEY\}[^.]*comment\?[^.]*\[y\/N\]/,
    );
  });

  it('Step 4c covers interactive without --push (prompt the user)', () => {
    expect(fourCBody).toMatch(
      /interactive[^.]*no `--push`|no `--push`[^.]*interactive/i,
    );
    // Interactive cell explicitly prompts.
    expect(fourCBody).toMatch(/prompt[\s\S]{0,300}\[y\/N\]/);
  });

  it('Step 4c covers interactive + --push (skip prompt and push)', () => {
    expect(fourCBody).toMatch(
      /interactive[^.]*`--push`[^.]*skip[^.]*prompt|`--push`[^.]*skip[^.]*prompt[^.]*push/i,
    );
  });

  it('Step 4c covers --afk without --push (LOCAL_ONLY skip)', () => {
    expect(fourCBody).toContain('LOCAL_ONLY');
    expect(fourCBody).toMatch(
      /--afk[^.]*without[^.]*--push|--afk[^.]*no[^.]*--push/i,
    );
  });

  it('Step 4c LOCAL_ONLY token logs to .clancy/progress.txt with stem', () => {
    // {stem} | TOKEN | {detail} convention:
    //   {stem} | LOCAL_ONLY | afk-without-push
    expect(fourCBody).toMatch(
      /\{stem\}\s*\\?\|\s*LOCAL_ONLY\s*\\?\|\s*afk-without-push/,
    );
  });

  it('Step 4c covers --afk --push (push without prompting)', () => {
    expect(fourCBody).toMatch(
      /--afk\s*--push|--afk[^.]*--push[^.]*without[^.]*prompt/i,
    );
  });

  it('Step 4c covers --ticket KEY override (auto-detect bypassed)', () => {
    expect(fourCBody).toMatch(/--ticket[^.]*override|override[^.]*--ticket/i);
    // --ticket wins over Source auto-detect.
    expect(fourCBody).toMatch(
      /wins over[^.]*auto[- ]detect|override[^.]*auto[- ]detect/i,
    );
  });

  it('Step 4c documents --ticket is ignored under --afk-without-push', () => {
    // The LOCAL_ONLY skip cell ignores --ticket entirely (no push happens).
    const localOnlyRegion = fourCBody.slice(fourCBody.indexOf('LOCAL_ONLY'));
    expect(localOnlyRegion.slice(0, 800)).toMatch(
      /--ticket[^.]*ignored|ignored[^.]*--ticket/i,
    );
  });

  it('Step 4c calls out the two-prompt flow as intentional', () => {
    // Step 4 confirms approval, Step 4c confirms push — semantically distinct.
    expect(fourCBody).toMatch(/two[- ]prompt|two prompts|second prompt/i);
    expect(fourCBody).toMatch(/intentional|distinct|semantically/i);
  });
});

// PR 9 — Slice 7: failure semantics for actual push failures (HTTP non-2xx,
// network/timeout/dns/auth). Marker stays, BOARD_PUSH_FAILED logged, exact
// retry command printed. No rollback.
describe('approve-plan Step 4c push failure semantics (PR 9 Slice 7)', () => {
  const content = readFileSync(
    new URL('approve-plan.md', import.meta.url),
    'utf8',
  );
  const fourCStart = content.indexOf('## Step 4c — Optional board push');
  const fourCEnd = content.indexOf('## Step 5 — Update ticket description');
  const fourCBody = content.slice(fourCStart, fourCEnd);

  it('Step 4c handles push failure as best-effort (marker preserved)', () => {
    // Distinct from the slice 4 key-mismatch path — this is the
    // post-validation, post-curl HTTP failure path.
    expect(fourCBody).toMatch(/push fail/i);
    expect(fourCBody).toMatch(
      /marker[^.]*(stays|preserved|kept|authoritative)/i,
    );
  });

  it('Step 4c logs BOARD_PUSH_FAILED with stem and status class', () => {
    // {stem} | TOKEN | {detail} convention:
    //   {stem} | BOARD_PUSH_FAILED | {http_status_or_error_class}
    expect(fourCBody).toContain('BOARD_PUSH_FAILED');
    expect(fourCBody).toMatch(
      /\{stem\}\s*\\?\|\s*BOARD_PUSH_FAILED\s*\\?\|\s*\{http_status_or_error_class\}/,
    );
  });

  it('Step 4c defines the error-class vocabulary', () => {
    // Locked spec: HTTP status code on non-2xx, OR lowercase error class
    // on transport failure: network, timeout, dns, auth.
    expect(fourCBody).toMatch(/network/);
    expect(fourCBody).toMatch(/timeout/);
    expect(fourCBody).toMatch(/dns/);
    expect(fourCBody).toMatch(/auth/);
    // HTTP status path also documented.
    expect(fourCBody).toMatch(/HTTP[^.]*status|status code|non-2xx/i);
  });

  it('Step 4c prints the exact retry command on push failure', () => {
    // Exact command pattern: /clancy:approve-plan {stem} --push --ticket {KEY}
    expect(fourCBody).toMatch(
      /\/clancy:approve-plan\s+\{stem\}\s+--push\s+--ticket\s+\{KEY\}/,
    );
  });

  it('Step 4c push-failure path continues to Step 7 (does not exit non-zero)', () => {
    // Push failure is best-effort — workflow still continues to render the
    // local-mode success block in Step 7.
    const failRegion = fourCBody.slice(fourCBody.search(/push fail/i));
    expect(failRegion).toMatch(/Step 7|continue|proceed/i);
  });

  it('Step 4c push-failure NEVER rolls back the marker', () => {
    expect(fourCBody).toMatch(
      /never[^.]*rolls?[- ]?back|do(?:es)? not rolls?[- ]?back/i,
    );
  });

  it('Step 4c logs LOCAL_APPROVE_PLAN_PUSH success row with stem and KEY', () => {
    // DA review H1: the success path needs a second progress.txt row
    // distinct from LOCAL_APPROVE_PLAN. Two-row audit is unambiguous.
    expect(fourCBody).toContain('LOCAL_APPROVE_PLAN_PUSH');
    expect(fourCBody).toMatch(
      /\{stem\}\s*\\?\|\s*LOCAL_APPROVE_PLAN_PUSH\s*\\?\|\s*\{KEY\}/,
    );
  });

  it('Step 4c documents the BOARD_PUSH_FAILED reason-field disambiguation', () => {
    // DA review L1: HTTP status, error-class, and key-mismatch:{KEY} share
    // the token. The contract that disambiguates them must be explicit.
    expect(fourCBody).toMatch(
      /key-mismatch:[^.]*reserved|reserved[^.]*key-mismatch/i,
    );
  });
});

// PR 9 — Slice 8: retry path. EEXIST + --push falls through to Step 4c
// instead of stopping. Without --push, EEXIST stops as today (PR 7b).
// This is the only mechanism to re-attempt a failed push — no new flag,
// no marker deletion.
describe('approve-plan Step 4a EEXIST retry path (PR 9 Slice 8)', () => {
  const content = readFileSync(
    new URL('approve-plan.md', import.meta.url),
    'utf8',
  );

  // Step 4a's EEXIST handling section is the load-bearing region for slice 8.
  const eexistStart = content.indexOf('### Handle EEXIST');
  const eexistEnd = content.indexOf('### Marker is the gate');
  const eexistBody = content.slice(eexistStart, eexistEnd);

  it('Step 4a EEXIST handling references the --push retry path', () => {
    expect(eexistBody).toContain('--push');
  });

  it('EEXIST + --push falls through to Step 4c (does not stop)', () => {
    expect(eexistBody).toMatch(
      /EEXIST[\s\S]*--push[\s\S]*(falls?[- ]through|continue)[\s\S]*Step 4c/i,
    );
  });

  it('EEXIST without --push still stops with the PR 7b message', () => {
    // PR 7b's existing behaviour preserved — bare EEXIST without --push
    // still hits the "Plan already approved" stop branch.
    expect(eexistBody).toMatch(
      /without[^.]*--push|no `--push`|`--push`\s+is\s+NOT\s+set|NOT\s+set/i,
    );
    expect(eexistBody).toContain('Plan already approved');
  });

  it('EEXIST + --push does NOT re-write the marker', () => {
    // The marker is preserved as-is. The retry only re-runs Step 4c.
    expect(eexistBody).toMatch(
      /(?:does not|never|do not|is not|not) re[- ]?written|marker[^a-z]*(stays|preserved|unchanged)/i,
    );
  });

  it('EEXIST + --push retry skips Step 4b (brief marker already updated)', () => {
    // Step 4b ran on the original approval; the brief marker is already
    // updated. The retry path goes EEXIST → Step 4c directly, not via 4b.
    expect(eexistBody).toMatch(/skip[^.]*Step 4b|Step 4b[^.]*skip/i);
  });

  it('Step 4c documents the retry entry path from EEXIST', () => {
    // Symmetry test: Step 4c should mention the retry entry path from
    // 4a's EEXIST branch so a reader of 4c knows where re-runs come from.
    const fourCStart = content.indexOf('## Step 4c — Optional board push');
    const fourCEnd = content.indexOf('## Step 5 — Update ticket description');
    const fourCBody = content.slice(fourCStart, fourCEnd);
    expect(fourCBody).toMatch(
      /EEXIST[^.]*--push|--push[^.]*EEXIST|retry[^.]*Step 4a/i,
    );
  });
});

// PR 9 — Slice 9: Notion flat-text note + commands/approve-plan.md flag docs.
// Notion comments render as flat text — surface in the local-mode success
// block so Notion users aren't surprised. Command file gets the new flag
// surface (--push, --ticket).
describe('approve-plan Step 7 Notion flat-text note (PR 9 Slice 9)', () => {
  const content = readFileSync(
    new URL('approve-plan.md', import.meta.url),
    'utf8',
  );
  const stepSevenStart = content.indexOf('## Step 7');
  const stepSevenBody = content.slice(stepSevenStart);

  it('Step 7 local-mode block surfaces a Notion flat-text note', () => {
    expect(stepSevenBody).toMatch(
      /Notion[^.]*flat[- ]text|flat[- ]text[^.]*Notion/i,
    );
  });

  it('Notion note is conditional on the push target (only when Notion)', () => {
    expect(stepSevenBody).toMatch(
      /only[^.]*Notion|when[^.]*Notion|Notion[^.]*only/i,
    );
  });

  it('Notion note explicitly says structure will not be styled', () => {
    expect(stepSevenBody).toMatch(
      /won.?t be styled|no[^.]*styling|plain text/i,
    );
  });
});

describe('approve-plan command file flag surface (PR 9 Slice 9)', () => {
  const content = readFileSync(
    new URL('../commands/approve-plan.md', import.meta.url),
    'utf8',
  );

  it('command file documents --push flag', () => {
    expect(content).toContain('`--push`');
  });

  it('command file documents --ticket flag', () => {
    expect(content).toContain('`--ticket');
  });

  it('command file --push doc references board push target', () => {
    const pushIdx = content.indexOf('`--push`');
    expect(pushIdx).toBeGreaterThan(-1);
    const pushParagraph = content.slice(pushIdx, pushIdx + 400);
    expect(pushParagraph).toMatch(/push|board/i);
  });

  it('command file --ticket doc references KEY override of Source', () => {
    const ticketIdx = content.indexOf('`--ticket');
    expect(ticketIdx).toBeGreaterThan(-1);
    const ticketParagraph = content.slice(ticketIdx, ticketIdx + 400);
    expect(ticketParagraph).toMatch(/override|Source|KEY/i);
  });

  it('command file preserves --afk from PR 7b', () => {
    expect(content).toContain('`--afk`');
  });
});
