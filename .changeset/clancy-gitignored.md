---
'@chief-clancy/terminal': minor
'@chief-clancy/scan': minor
---

Move `.clancy/` to fully gitignored.

`/clancy:init` now writes `.clancy/` to `.gitignore` (covering all artifacts including `.env`, `.env.example`, `docs/`, `version.json`, `package.json`, and bundled scripts). The init scaffold commit stages only parent-project files (`CLAUDE.md` + `.gitignore`).

`/clancy:map-codebase` and `/clancy:update-docs` no longer commit; their writes are local-only.

`/clancy:uninstall-terminal` accepts both new (`.clancy/`) and legacy (`.clancy/.env`) gitignore markers and now commits the parent-project cleanup (CLAUDE.md + .gitignore) in a new Step 5b before offering to remove `.clancy/`.

`/clancy:update-terminal` prints a one-time migration advisory (idempotent against partial state) for projects that were init'd before the gitignore fold and still have tracked content under `.clancy/`. Run `git rm --cached -r .clancy/` then re-add `.clancy/` to `.gitignore` to migrate.
