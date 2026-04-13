# Progress

Living state document for the Clancy monorepo. Records the current state, the phase ledger, and the next decision. Session-by-session detail lives in git history (each phase's PRs are tagged + commit messages reference them).

## Current state (2026-04-13)

**DA agents shipped for both brief and plan.** Brief DA now has dual-mode operation (grill + health-check), Challenges section with severity levels, and Step 8a post-brief invocation. Plan DA added with Step 4g grill, 6-item plan health check, and installer infrastructure. Review docs strengthened (DA-REVIEW, SELF-REVIEW, REVIEW-PATTERNS) with 4 new patterns from Copilot catches.

**Published versions:**

| Package                  | Version |
| ------------------------ | ------- |
| `@chief-clancy/core`     | 0.1.1   |
| `@chief-clancy/terminal` | 0.1.13  |
| `@chief-clancy/dev`      | 0.2.1   |
| `@chief-clancy/brief`    | 0.4.2   |
| `@chief-clancy/plan`     | 0.7.0   |
| `@chief-clancy/scan`     | 0.2.2   |
| `chief-clancy` (wrapper) | 0.9.22  |

**Test counts:** 879 core, 742 terminal, 1106 dev, 126 brief, 326 plan = **3179 total**.

**Last shipped:** Plan DA agent (#277-#279) + e2e test fix in Session 74.

**Next:** `--from` support for `/clancy:implement` — plan grilled (3 DA rounds) at `.clancy/plans/implement-from.md`. 6 PRs: parser, local-mode infra, pipeline wiring, batch mode, e2e tests, changeset + READMEs.

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
