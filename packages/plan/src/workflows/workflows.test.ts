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

const EXPECTED_WORKFLOWS = [
  'approve-plan.md',
  'board-setup.md',
  'implement-from.md',
  'plan.md',
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

  it('reserves an Implemented state for a follow-up PR without claiming it exists today', () => {
    expect(content).toContain('Implemented');
    expect(content).toContain('PR 8.1');
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
// implement-from.md content assertions (PR 8)
// ---------------------------------------------------------------------------

describe('implement-from preflight (Step 1)', () => {
  const content = readFileSync(
    new URL('implement-from.md', import.meta.url),
    'utf8',
  );

  it('detects all three installation states', () => {
    expect(content).toContain('standalone mode');
    expect(content).toContain('standalone+board mode');
    expect(content).toContain('terminal mode');
  });

  it('checks .clancy/.env presence for state detection', () => {
    expect(content).toContain('.clancy/.env');
  });

  it('checks clancy-implement.js for terminal detection', () => {
    expect(content).toContain('clancy-implement.js');
  });

  it('CLANCY_ROLES check only runs in terminal mode', () => {
    expect(content).toContain('Terminal-mode preflight');
    expect(content).toContain(
      'skip in standalone mode and standalone+board mode',
    );
  });

  it('stops if .clancy/plans/ directory is absent', () => {
    expect(content).toContain('No plans directory found');
  });
});

describe('implement-from arg resolution (Step 2)', () => {
  const content = readFileSync(
    new URL('implement-from.md', import.meta.url),
    'utf8',
  );

  it('accepts path form', () => {
    expect(content).toContain('Path form');
    expect(content).toContain('.clancy/plans/');
  });

  it('accepts bare-stem form', () => {
    expect(content).toContain('Bare-stem form');
  });

  it('path form takes precedence on collision', () => {
    expect(content).toContain('path form takes precedence');
  });

  it('errors clearly when plan file is not found', () => {
    expect(content).toContain('Plan file not found');
  });

  it('hint mentions /clancy:plan --list', () => {
    expect(content).toContain('/clancy:plan --list');
  });

  it('row-number hint matches approve-plan convention', () => {
    expect(content).toContain('Plan stems include the row number');
  });

  it('rejects absolute paths', () => {
    expect(content).toContain('Absolute paths are not supported');
  });

  it('rejects path traversal (.. segments, null bytes)', () => {
    expect(content).toContain("must not contain '..'");
  });

  it('rejects bare-stem form ending in .md', () => {
    expect(content).toContain('stem must not end in `.md`');
  });

  it('rejects empty/whitespace-only argument as no-arg', () => {
    expect(content).toContain('whitespace-only');
  });

  it('Step 2.0 validation runs before path/stem branching', () => {
    expect(content).toContain('### 2.0 — Argument validation');
    expect(content).toContain('before** the path/stem branch');
  });
});

describe('implement-from approval gate (Step 3)', () => {
  const content = readFileSync(
    new URL('implement-from.md', import.meta.url),
    'utf8',
  );

  it('--bypass-approval short-circuits the gate', () => {
    expect(content).toContain('--bypass-approval');
    expect(content).toContain('short-circuit');
  });

  it('explicitly says --afk does not imply --bypass-approval', () => {
    expect(content).toContain('`--afk` does NOT imply `--bypass-approval`');
  });

  it('reads the sibling .approved marker', () => {
    expect(content).toContain('.clancy/plans/{stem}.approved');
    expect(content).toContain('sibling marker');
  });

  it('blocks with "not approved" when marker is missing', () => {
    expect(content).toContain('Plan not approved');
    expect(content).toContain('Marker missing');
  });

  it('parses sha256= and approved_at= lines', () => {
    expect(content).toContain('sha256=');
    expect(content).toContain('approved_at=');
  });

  it('validates sha256 is 64 lowercase hex characters', () => {
    expect(content).toContain('64-char lowercase hex');
    expect(content).toContain('/^[0-9a-f]{64}$/');
  });

  it('blocks malformed markers with delete-and-recreate hint', () => {
    expect(content).toContain('Plan marker malformed');
    expect(content).toContain('Delete .clancy/plans/{stem}.approved manually');
  });

  it('malformed marker error distinguishes itself from sha mismatch', () => {
    expect(content).toContain(
      'NOT the same as a sha mismatch — your plan file may be unchanged',
    );
  });

  it('malformed marker uses its own log token (not sha mismatch)', () => {
    expect(content).toContain('LOCAL_BLOCKED | malformed marker');
  });

  it('hashes the plan file the same way as approve-plan Step 4a', () => {
    expect(content).toContain('Order of operations');
    expect(content).toContain(
      'Read the plan file at `.clancy/plans/{stem}.md` from disk into memory as bytes',
    );
    expect(content).toContain('no normalisation');
    expect(content).toContain('Hex-encode lowercase');
  });

  it('never includes the .approved file in the hash', () => {
    expect(content).toContain('`.approved` file is **never** included');
  });

  it('blocks with "Plan changed since approval" on hash mismatch', () => {
    expect(content).toContain('Plan changed since approval');
  });
});

describe('implement-from plan parsing (Step 4)', () => {
  const content = readFileSync(
    new URL('implement-from.md', import.meta.url),
    'utf8',
  );

  it('extracts header fields Source, Brief, Row, Planned', () => {
    expect(content).toContain('**Source:**');
    expect(content).toContain('**Brief:**');
    expect(content).toContain('**Row:**');
    expect(content).toContain('**Planned:**');
  });

  it('uses tolerant em-dash regex for the Row line', () => {
    expect(content).toContain('em-dash (U+2014)');
    expect(content).toContain('en-dash (U+2013)');
    expect(content).toContain('^\\*\\*Row:\\*\\*\\s*#(\\d+)\\s*[—–-]\\s*(.+)$');
  });

  it('parses ### Affected Files using the actual plan.md schema (File | Change Type | Description)', () => {
    expect(content).toContain('### Affected Files');
    expect(content).toContain('| File                    | Change Type');
  });

  it('reads File column and strips backticks', () => {
    expect(content).toContain('strip the backticks');
  });

  it('Change Type bucketing is case-insensitive', () => {
    expect(content).toContain('case-insensitive match');
  });

  it('rejects unrecognised Change Type values with a fail-loud error', () => {
    expect(content).toContain('unrecognised `Change Type`');
  });

  it('fails loud when Affected Files is missing or empty', () => {
    expect(content).toContain('Plan has no Affected Files section');
    expect(content).toContain('Cannot implement without an explicit file list');
  });

  it('Affected Files is the central input that other sections augment', () => {
    expect(content).toContain('central input');
    expect(content).toContain('augment the file list rather than replace it');
  });

  it('parses ### Test Strategy as a checklist', () => {
    expect(content).toContain('### Test Strategy');
    expect(content).toContain('markdown checklist');
  });

  it('parses ### Acceptance Criteria as a checklist', () => {
    expect(content).toContain('### Acceptance Criteria');
  });

  it('reads ### Implementation Approach in full before writing code', () => {
    expect(content).toContain('### Implementation Approach');
    expect(content).toContain('Read it in full');
  });

  it('all four plan sections are required (fail loud, no warn-and-continue)', () => {
    expect(content).toContain('Required-section invariant');
    expect(content).toContain('Plan is missing required section');
    expect(content).toContain(
      'There is no `--force` escape hatch for missing sections',
    );
  });
});

describe('implement-from implement loop (Step 5)', () => {
  const content = readFileSync(
    new URL('implement-from.md', import.meta.url),
    'utf8',
  );

  it('reads every Modify-row file for context', () => {
    expect(content).toContain('Read every Modify-row file');
  });

  it('writes tests first per Test Strategy (TDD vertical slices)', () => {
    expect(content).toContain('vertical slices');
    expect(content).toContain('Never write all tests first');
  });

  it('does NOT touch board APIs', () => {
    expect(content).toContain('Do NOT touch board APIs');
    expect(content).toContain('local-only');
  });

  it('does not commit the changes', () => {
    expect(content).toContain('commit-free');
  });
});

describe('implement-from log tokens (Step 6)', () => {
  const content = readFileSync(
    new URL('implement-from.md', import.meta.url),
    'utf8',
  );

  it('writes LOCAL_IMPLEMENT on success', () => {
    expect(content).toContain('LOCAL_IMPLEMENT | {N} files');
  });

  it('writes LOCAL_BYPASS instead of LOCAL_IMPLEMENT when --bypass-approval', () => {
    expect(content).toContain('LOCAL_BYPASS | {N} files');
    expect(content).toContain('written **instead of** `LOCAL_IMPLEMENT`');
  });

  it('writes LOCAL_BLOCKED | not approved when marker is missing', () => {
    expect(content).toContain('LOCAL_BLOCKED | not approved');
  });

  it('writes LOCAL_BLOCKED | sha mismatch on hash drift', () => {
    expect(content).toContain('LOCAL_BLOCKED | sha mismatch');
  });

  it('writes LOCAL_BLOCKED | malformed marker as a distinct token', () => {
    expect(content).toContain('LOCAL_BLOCKED | malformed marker');
  });

  it('explains the three LOCAL_BLOCKED qualifiers are distinct', () => {
    expect(content).toContain(
      'three blocked tokens (`not approved`, `malformed marker`, `sha mismatch`)',
    );
  });

  it('log tokens use the pipe-delimited four-field format', () => {
    expect(content).toContain('YYYY-MM-DD HH:MM | {stem} | LOCAL_IMPLEMENT');
  });
});

describe('implement-from terminal-vs-local distinction', () => {
  const content = readFileSync(
    new URL('implement-from.md', import.meta.url),
    'utf8',
  );

  it('explains it does not create a board-ticket lock file', () => {
    expect(content).toContain('No lock file');
  });

  it('explains the terminal verification gate does not fire', () => {
    expect(content).toContain('Stop hook will not fire');
  });

  it('points users at /clancy:implement for the board-driven flow', () => {
    expect(content).toContain('/clancy:implement` (terminal)');
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

  it('explains the marker is the gate for /clancy:implement-from', () => {
    expect(content).toContain('/clancy:implement-from');
    expect(content).toContain('gate');
  });

  it('after writing the marker, Step 4a jumps to Step 7 (log) and skips board flow', () => {
    expect(content).toContain('jump to Step 7');
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

  it('local success summary points to /clancy:implement-from', () => {
    expect(content).toContain(
      'Next: /clancy:implement-from .clancy/plans/{stem}.md',
    );
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
