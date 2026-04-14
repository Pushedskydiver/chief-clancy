# Progress

Living state document for the Clancy monorepo. Records the current state, the phase ledger, and the next decision. Session-by-session detail lives in git history (each phase's PRs are tagged + commit messages reference them).

## Current state (2026-04-14)

**Local-init-flow complete.** Full local pipeline shipped end-to-end: `/clancy:init` (board-optional) → `/clancy:brief` → `/clancy:plan --from` → `/clancy:approve-plan` (writes `.approved` marker) → `/clancy:implement --from` (single-plan runs without marker check; batch filters by marker existence; SHA verification deferred). All four PRs (#288, #289, #290, #291) merged. Changeset will publish `@chief-clancy/dev` patch and `@chief-clancy/terminal` patch on next publish workflow run.

**Published versions:** (versions bumped by changeset merge — publish workflow pending)

| Package                  | Version |
| ------------------------ | ------- |
| `@chief-clancy/core`     | 0.1.2   |
| `@chief-clancy/terminal` | 0.1.15  |
| `@chief-clancy/dev`      | 0.3.1   |
| `@chief-clancy/brief`    | 0.4.3   |
| `@chief-clancy/plan`     | 0.7.1   |
| `@chief-clancy/scan`     | 0.2.3   |
| `chief-clancy` (wrapper) | 0.9.24  |

**Test counts:** 879 core, 755 terminal, 1201 dev, 126 brief, 326 plan = **3287 total**.

**Last shipped:** Local-init-flow PR 4 — changeset + comprehensive docs sweep (#291) in Session 77. 15+ docs updated for local-mode awareness (READMEs, COMPARISON, LIFECYCLE, ARCHITECTURE, TECHNICAL-REFERENCE, GLOSSARY, VISUAL-ARCHITECTURE, CONFIGURATION, roles). Eight rounds of Copilot review produced 43 findings total, every round caught real factual bugs (invented runtime gates, wrong package deps, wrong function names, wrong URL paths, narrative overgeneralisations). Convergence trajectory: 8→1→5→9→15→9→1→2→2→2. DA review caught 3 HIGH findings before push. This PR is the seed corpus for the Option A research initiative.

**Next:** Option A (pre-PR reviewer) + docs maintenance research initiative — scoped in `project_pre_pr_reviewer_research.md` memory. Three-layer design (prevention / verification / backstop) with literature review across retrieval classes (lexical/semantic/structural) and self-verification (CoVe, Reflexion). Research deliverable is an evidence-backed design doc before any implementation.

## Phase ledger

| Phase                                     | Status  | Shipped       | Headline                                                                                                                                                                                                     |
| ----------------------------------------- | ------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A** — Monorepo rebuild                  | ✅ done | 2026-03-31    | Two packages (core + terminal), internal capability boundaries enforced by eslint-plugin-boundaries                                                                                                          |
| **B** — Plan extraction + local planning  | ✅ done | (pre-Phase-C) | `@chief-clancy/plan` standalone, `--from <brief>` flow, local plans in `.clancy/plans/`                                                                                                                      |
| **C** — Plan approval gate                | ✅ done | 2026-04-09    | SHA-256 `.approved` marker, standalone-aware Step 1, optional board push from approve-plan, PR 8 deferred to dev                                                                                             |
| **D** — Brief absorbs approve-brief       | ✅ done | 2026-04-09    | Strategist directory deleted, virtual-role transition, install-mode preflight, Step 6 label-decision preamble                                                                                                |
| **Docs lifecycle update**                 | ✅ done | 2026-04-09    | RATIONALIZATIONS.md + DA-REVIEW Required disciplines + Severity Labels + Prove-It Pattern + Stop-the-Line + CLAUDE.md                                                                                        |
| **Post-research trim**                    | ✅ done | 2026-04-09    | CLAUDE.md trimmed 10 → 4 bullets per AGENTS.md paper, CONVENTIONS.md "Output style" added per Brevity Constraints paper, GIT.md No --amend, memory pruned 8 files                                            |
| **E** — `dev` extraction + AFK executor   | ✅ done | 2026-04-12    | Standalone dev package with readiness gate, AFK loop, artifact writers, cross-package install/update/uninstall system                                                                                        |
| **Local-init-flow** — board-optional path | ✅ done | 2026-04-14    | Init board gate, settings/doctor/help/autopilot/status/review local-mode awareness, comprehensive docs sweep. PRs #288, #289, #290, #291. Batch mode filters by `.approved` existence; SHA verifier deferred |

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
