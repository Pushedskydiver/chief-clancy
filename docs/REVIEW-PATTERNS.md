# Review Patterns

Recurring findings from Copilot, DA review, and self-review across sessions. When dispatched via `@agent-da-review`, the project subagent's system prompt (`.claude/agents/da-review.md`) instructs it to Read this file as part of its review brief. Compliance is best-effort, not mechanically enforced. When the same class of issue is caught 2+ times, add it here with the PR citation.

This is a **living document** — add patterns from real catches, not hypotheticals.

**Last updated:** 2026-04-13

---

## Workflow markdown

### Warn-without-stop fall-through

A step warns about a problem but doesn't stop, then the next step shows a success message as if nothing happened. Every warning path needs an explicit stop or gate.

_Caught: PR #269 (Copilot) — Step 8 warned "update may not have taken effect" then fell through to Step 9 "updated successfully"._

### Hardcoded install-mode flags in fallback

Fallback/manual-update messages hardcode `--local` (or `--global`) when the workflow handles multiple install modes. The message should reflect the mode detected earlier in the workflow.

_Caught: PR #269 (Copilot) — Step 2 fallback hardcoded `--local` regardless of Step 1 detection._

### Ambiguous descriptions after command rename

After renaming a command, descriptions that were fine before become ambiguous. "Update Clancy to latest version" is unclear when there are now 4 separate update commands. Post-rename descriptions need qualification ("Update the full pipeline").

_Caught: PR #272 (Copilot) — help.md and ui.ts said "Update Clancy" after rename to update-terminal, without distinguishing from update-brief/plan/dev._

### Forward references to commands in later PRs

When a workflow references a command that ships in a later PR of the same batch (e.g. `/clancy:update-terminal` referenced before PR U4 creates it), Copilot flags it every time. Not a real issue when PRs ship together via changesets, but explain in the PR body to avoid repeated false positives.

_Caught: PRs #269, #270, #271 (Copilot, 6 comments total) — all dismissed with forward-reference explanation._

### False positive: markdown table double pipes

Copilot sometimes flags standard single-pipe markdown tables (`| col1 | col2 |`) as having double pipes (`||`). Always verify by grepping the file for `||` before acting.

_Caught: PR #271 (Copilot, 4 false positive comments) — zero actual double pipes in the file._

---

## TypeScript / installer

### Installer file list sync

When adding a new command or workflow file, four places need updating in sync:

1. `install.ts` — `COMMAND_FILES` and `WORKFLOW_FILES` constants
2. `bin/<pkg>.js` — duplicated file lists
3. `bin/<pkg>.js` `printSuccess()` — command listing output
4. Uninstall workflow — package-exclusive files list in Step 4a

Missing any one causes silent install failures or incomplete uninstalls.

_Pattern from: PRs #262-#266, #269-#272 (all update/uninstall PRs follow this 4-point checklist)._

### Mock source files in install tests

When adding a file to `COMMAND_FILES` or `WORKFLOW_FILES`, the install test's `buildOptions` helper needs a matching mock source entry. The file path prefix varies by package:

- brief/plan: `/pkg/src/commands/` and `/pkg/src/workflows/`
- dev: `/pkg/dist/commands/` and `/pkg/dist/workflows/`

_Pattern from: all install test updates across PRs #262-#272._

---

## Cross-package consistency

### Step renumbering cascade

Inserting a new step in a workflow can break dozens of cross-references in other files (approve workflows, tests). Prefer sub-step notation (4a, 4b, 4g) over renumbering when the workflow already uses sub-steps.

_Caught: DA grill of plan-da-agent plan — approve-plan.md has ~50+ references to Steps 5-8. Using Step 4g instead of inserting Step 5 avoids the cascade entirely._

### VERSION marker paths per package

Each package stores its VERSION marker differently:

- brief: `<base>/commands/clancy/VERSION.brief`
- plan: `<base>/commands/clancy/VERSION.plan`
- terminal: `<base>/commands/clancy/VERSION`
- dev: `.clancy/VERSION.dev` (always project root, not in commands/clancy/)

When writing cross-package detection logic, use the correct path for each. Dev is the outlier.

_Pattern from: all uninstall/update workflows._

---

## Agent prompts

### Intra-file instruction conflicts

A prompt's conditional logic (skip clause, mode detection) and its output format template can contradict each other. If section A says "skip X and note it was skipped" but the output template says "if no X, write: 'none'" — those two paths produce different text for the same output section. Walk every conditional path through to the output format.

_Caught: PR #277 (Copilot, 2 comments) — DA agent skip clause said "note that it was skipped" but Challenges output said "write: No challenges identified."_

### Multi-mode prompts assuming single input type

When a prompt is invoked from multiple workflow steps with different inputs, the intro and instructions may only describe one input type. Every instruction must make sense for all invocation modes — "Work through each question" is wrong when the input is a generated brief, not questions.

_Caught: PR #277 (Copilot) — DA agent intro said "You receive 10-15 clarifying questions" but Step 8a passes the generated brief._

### Derived thresholds misaligned with source rules

When a mechanical check references a rule defined elsewhere (e.g., "max N rows"), the threshold must match the source. The source rule is authoritative — grep for it before writing a derived check.

_Caught: PR #277 (Copilot) — health check flagged >15 rows but brief.md's Ticket Decomposition rules say "Max 10 tickets."_

### Ambiguous table row counts

Markdown tables have header and separator lines that look like rows. When a mechanical check counts "rows", specify whether the header/separator lines are included or excluded to avoid off-by-two errors.

_Caught: PR #277 (Copilot) — ">10 rows" was ambiguous about header/separator lines._

---

## How this file is used

- When dispatched via `@agent-da-review`, the project subagent's system prompt instructs it to read `docs/DA-REVIEW.md`, targeted `docs/CONVENTIONS.md` sections, `docs/RATIONALIZATIONS.md`, and this file. Compliance is best-effort, not mechanically enforced (see `.claude/agents/da-review.md`)
- When a new pattern emerges (2+ catches of the same class), add it here with the PR citation
- Patterns that become repo conventions should be promoted to `CONVENTIONS.md`, `DA-REVIEW.md`, or `SELF-REVIEW.md` and removed from this file
