# Progress

Living state document for the Clancy monorepo. Records the current state, the phase ledger, and the next decision. Session-by-session detail lives in git history (each phase's PRs are tagged + commit messages reference them).

## Current state (2026-04-13)

**Implement `--from` feature complete.** Full local pipeline works: brief → plan → approve → implement, no board needed. All 6 PRs shipped (#281-#286). Batch mode (`--from {dir} --afk`), 20 e2e tests, README audit across all packages, 7 feedback memories promoted to repo docs.

**Published versions:** (changeset merged — version bump pending publish workflow)

| Package                  | Version |
| ------------------------ | ------- |
| `@chief-clancy/core`     | 0.1.2   |
| `@chief-clancy/terminal` | 0.1.14  |
| `@chief-clancy/dev`      | 0.3.0   |
| `@chief-clancy/brief`    | 0.4.3   |
| `@chief-clancy/plan`     | 0.7.1   |
| `@chief-clancy/scan`     | 0.2.3   |
| `chief-clancy` (wrapper) | 0.9.23  |

**Test counts:** 879 core, 755 terminal, 1195 dev, 126 brief, 326 plan = **3281 total**.

**Last shipped:** Implement `--from` PRs 4-6 (#284, #285, #286) in Session 75.

**Next:** Local-aware init flow — make `/clancy:init` board-optional. Plan at `.clancy/plans/local-init-flow.md` (v3, DA-grilled 3 rounds). 4 PRs: runtime guards → init workflow → settings/doctor/help/autopilot/reviewer guards → changeset. After that: comprehensive docs update for local pipeline lifecycle + readability review with Alex.

## Phase ledger

| Phase                                    | Status  | Shipped       | Headline                                                                                                                                                          |
| ---------------------------------------- | ------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** — Monorepo rebuild                 | ✅ done | 2026-03-31    | Two packages (core + terminal), internal capability boundaries enforced by eslint-plugin-boundaries                                                               |
| **B** — Plan extraction + local planning | ✅ done | (pre-Phase-C) | `@chief-clancy/plan` standalone, `--from <brief>` flow, local plans in `.clancy/plans/`                                                                           |
| **C** — Plan approval gate               | ✅ done | 2026-04-09    | SHA-256 `.approved` marker, standalone-aware Step 1, optional board push from approve-plan, PR 8 deferred to dev                                                  |
| **D** — Brief absorbs approve-brief      | ✅ done | 2026-04-09    | Strategist directory deleted, virtual-role transition, install-mode preflight, Step 6 label-decision preamble                                                     |
| **Docs lifecycle update**                | ✅ done | 2026-04-09    | RATIONALIZATIONS.md + DA-REVIEW Required disciplines + Severity Labels + Prove-It Pattern + Stop-the-Line + CLAUDE.md                                             |
| **Post-research trim**                   | ✅ done | 2026-04-09    | CLAUDE.md trimmed 10 → 4 bullets per AGENTS.md paper, CONVENTIONS.md "Output style" added per Brevity Constraints paper, GIT.md No --amend, memory pruned 8 files |
| **E** — `dev` extraction + AFK executor  | ✅ done | 2026-04-12    | Standalone dev package with readiness gate, AFK loop, artifact writers, cross-package install/update/uninstall system                                             |

Detail for all phases lives in git history. Disciplines are documented in `docs/DEVELOPMENT.md`, `docs/DA-REVIEW.md`, `docs/TESTING.md`, `docs/CONVENTIONS.md`, and `docs/RATIONALIZATIONS.md`.

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
