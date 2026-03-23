# Decision Documents

Design decisions for Clancy features — the "why" behind non-obvious choices. The code is the source of truth for "what" and "how."

## What belongs here

- **Briefs** (`brief.md`) — problem statement, success criteria, scope boundaries.
- **Design docs** (`design.md`) — architecture decisions, trade-offs, key choices.

Each version directory can contain up to three files:

```
docs/decisions/v0.8.24/
  brief.md           # what + why + scope
  design.md          # how it works — decisions + trade-offs
```

## Lifecycle

1. **Before building:** Create brief and/or design doc in a version directory
2. **During building:** Reference them
3. **After shipping:** Trim to decisions-only (~50 lines each). The code is the source of truth.

## Version directories

### Active

| Directory   | Feature                                                                                                                            | Version |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `monorepo/` | Monorepo rebuild — `@chief-clancy` workspace. Full brief with phases, standards, PR breakdowns.                                    | —       |
| `v0.9.0/`   | Design sub-phase in planner, Google Stitch integration, Playwright/axe-core/Lighthouse verification. Has `brief.md` + `design.md`. | v0.9.0  |

### Carried over from old repo

| Directory  | Feature                                                                                                         | Notes                        |
| ---------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `v0.8.24/` | Code quality refactor — `fetchAndParse<T>()`, deliver decomposition, label CRUD consolidation. Has `design.md`. | Carried as-is from old repo. |

### Archived (deleted after shipping)

Shipped decision docs are deleted per the lifecycle above. For historical context, check the old repo's git history.

- v0.5.12 — PR-based delivery, epic branches
- v0.7.0 — Verification gates, safety hooks, crash recovery
- v0.7.1 — Phase pipeline, Board type abstraction
- v0.7.4 — Pipeline stage labels, Board label methods
- v0.8.0 — Board ecosystem (6 boards), quiet hours, notifications
- qa-strategy — 3-layer QA (unit + integration + E2E)

## What does NOT belong here

- **Architecture docs** — those live in `docs/ARCHITECTURE.md`
- **Role descriptions** — those live in `docs/roles/`
- **Configuration guides** — those live in `docs/guides/`
- **Glossary** — that lives in `docs/GLOSSARY.md`
- **Code comments or inline docs** — those live next to the code
