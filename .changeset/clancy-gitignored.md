---
'@chief-clancy/terminal': minor
'@chief-clancy/scan': minor
'@chief-clancy/brief': minor
'@chief-clancy/plan': minor
'@chief-clancy/dev': minor
---

Move `.clancy/` to fully gitignored.

`/clancy:init` (terminal) now writes `.clancy/` to `.gitignore` (covering all artifacts including `.env`, `.env.example`, `docs/`, `version.json`, `package.json`, and bundled scripts). The init scaffold commit stages only parent-project files (`CLAUDE.md` + `.gitignore`).

`/clancy:map-codebase` and `/clancy:update-docs` (scan) no longer commit; their writes are local-only.

`/clancy:uninstall-terminal` accepts both new (`.clancy/`) and legacy (`.clancy/.env`) gitignore markers and removes ALL Clancy marker pairs found (legacy and current may coexist after migration). New Step 5b commits the parent-project cleanup (CLAUDE.md + .gitignore) before offering to remove `.clancy/`.

`/clancy:update-terminal` prints a one-time migration advisory (idempotent against partial state) for projects that were init'd before the gitignore fold and still have tracked content under `.clancy/`. The advisory prints branch-conditional commands (including `git add .gitignore` to stage the gitignore append).

Standalone packages (`@chief-clancy/brief`, `@chief-clancy/plan`, `@chief-clancy/dev`) board-setup workflows now suggest gitignoring `.clancy/` (not the legacy `.clancy/.env`) for symmetric treatment with terminal — covers credentials plus all local Clancy artifacts.

Migration: existing projects with tracked `.clancy/` content will see the advisory after running `/clancy:update-terminal`. Run the printed commands to migrate.
