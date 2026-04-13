---
applyTo: 'packages/*/src/{commands,workflows,agents}/**/*.md'
---

# Workflow Markdown Review Rules

These files are runtime prompts — Claude follows them step-by-step. Review them like code, not documentation.

## Control flow

- Every conditional branch (if/else, found/not-found, success/failure) must have an explicit outcome: **stop**, proceed to a named step, or skip silently with a documented reason.
- Warning steps that don't stop must not fall through into success messages. If Step N warns, either stop or gate Step N+1 on the warning being resolved.
- `--afk` flag support: if the workflow has a confirmation prompt, it must document what happens when `--afk` is passed (skip confirmation).

## Package-specific values

- VERSION marker paths: `VERSION.brief` and `VERSION.plan` live at `<base>/commands/clancy/`. `VERSION.dev` lives at `.clancy/VERSION.dev`. `VERSION` (terminal) lives at `<base>/commands/clancy/`.
- `npx` commands must use `@latest` suffix (cache bypass) and the correct package name (`@chief-clancy/brief`, not `@chief-clancy/plan`).
- Fallback/manual-update instructions must reflect the detected install mode (`--local`/`--global`), not hardcode one flag.
- GitHub releases API URLs must URL-encode the tag: `@` → `%40`, `/` → `%2F`.

## Cross-file consistency

- After renaming a command (e.g. `/clancy:update` → `/clancy:update-terminal`), check that ALL workflow files, help text, and descriptions reference the new name.
- Step numbers referenced in other files (approve workflows, tests) must stay in sync. Prefer sub-step notation (4a, 4b, 4g) over renumbering when inserting steps.
- Commands referenced in coexistence advisories must exist (or ship in the same PR batch).

## Markdown tables

- Tables use standard single-pipe syntax (`| col1 | col2 |`). Do not flag correctly-formatted tables as having double pipes.
- Run Prettier before reviewing table alignment — hand-aligned tables may differ from Prettier output.

## Hard constraints sections

- The "Hard constraints" section at the end must be consistent with the "Overview" section at the top (same list of "never touch" items).
- Standalone packages (brief, plan, dev) scope out `.clancy/` or `.clancy/.env`. Terminal scopes out `.clancy/` project data.
