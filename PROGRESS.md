# Progress

Living state document for the Clancy monorepo. Records the current state, the phase ledger, and the next decision. Session-by-session detail lives in git history (each phase's PRs are tagged + commit messages reference them).

## Current state (2026-04-12)

**Phase E complete. Cross-package uninstall system shipped.** All packages published with per-package uninstall commands (`/clancy:uninstall-brief`, `/clancy:uninstall-plan`, `/clancy:uninstall-dev`, `/clancy:uninstall-terminal`). Next: per-package update commands.

**Published versions:**

| Package                  | Version |
| ------------------------ | ------- |
| `@chief-clancy/core`     | 0.1.1   |
| `@chief-clancy/terminal` | 0.1.11  |
| `@chief-clancy/dev`      | 0.1.1   |
| `@chief-clancy/brief`    | 0.3.4   |
| `@chief-clancy/plan`     | 0.5.4   |
| `@chief-clancy/scan`     | 0.2.2   |
| `chief-clancy` (wrapper) | 0.9.19  |

**Test counts:** 879 core, 731 terminal, 1058 dev, 77 brief, 270 plan = **3015 total**.

**Last shipped:** Cross-package uninstall changeset (#267) in Session 72.

## Phase E summary

`@chief-clancy/dev` extracted as standalone package (0.1.x) over Sessions 60–72. 30+ PRs covering lifecycle/pipeline move from core, scan package extraction, installer infrastructure, readiness gate, AFK loop with artifacts, and cross-package uninstall system. Detail lives in git history (PRs #228–#267).

## Phase ledger

| Phase                                    | Status  | Shipped       | Headline                                                                                                                                                          |
| ---------------------------------------- | ------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** — Monorepo rebuild                 | ✅ done | 2026-03-31    | Two packages (core + terminal), internal capability boundaries enforced by eslint-plugin-boundaries                                                               |
| **B** — Plan extraction + local planning | ✅ done | (pre-Phase-C) | `@chief-clancy/plan` standalone, `--from <brief>` flow, local plans in `.clancy/plans/`                                                                           |
| **C** — Plan approval gate               | ✅ done | 2026-04-09    | SHA-256 `.approved` marker, standalone-aware Step 1, optional board push from approve-plan, PR 8 deferred to dev                                                  |
| **D** — Brief absorbs approve-brief      | ✅ done | 2026-04-09    | Strategist directory deleted, virtual-role transition, install-mode preflight, Step 6 label-decision preamble                                                     |
| **Docs lifecycle update**                | ✅ done | 2026-04-09    | RATIONALIZATIONS.md + DA-REVIEW Required disciplines + Severity Labels + Prove-It Pattern + Stop-the-Line + CLAUDE.md                                             |
| **Post-research trim**                   | ✅ done | 2026-04-09    | CLAUDE.md trimmed 10 → 4 bullets per AGENTS.md paper, CONVENTIONS.md "Output style" added per Brevity Constraints paper, GIT.md No --amend, memory pruned 8 files |
| **E** — `dev` extraction + AFK executor  | ✅ done | 2026-04-12    | Standalone dev package (0.1.x) with readiness gate, AFK loop, artifact writers, cross-package uninstall system                                                    |

Detail for Phases C and D lives in git history (PRs #207–#224). Disciplines are documented in `docs/DEVELOPMENT.md`, `docs/DA-REVIEW.md`, `docs/TESTING.md`, `docs/CONVENTIONS.md`, and `docs/RATIONALIZATIONS.md`.

## Build order (remaining packages)

1. ~~`@chief-clancy/brief`~~ — done (Phase A)
2. ~~`@chief-clancy/plan`~~ — done (Phase B + C)
3. ~~`@chief-clancy/dev`~~ — done (Phase E)
4. `@chief-clancy/design` — Phase F (Stitch integration)
5. `@chief-clancy/cli` — interactive wizard
6. `@chief-clancy/chat` — conversational interface (Slack/Teams)

See [`docs/decisions/architecture/package-evolution.md`](docs/decisions/architecture/package-evolution.md) for the full rationale.

## Repo

https://github.com/Pushedskydiver/chief-clancy
