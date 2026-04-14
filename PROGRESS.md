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

**Last shipped:** Local-init-flow PR 4 — changeset + comprehensive docs sweep (#291) in Session 77. 15+ docs updated for local-mode awareness. Eight rounds of Copilot review produced the seed corpus (49 findings) for the Option A research initiative.

**Session 78 (research-only, no PRs):** Option A research phase complete. Four-round peer-review gauntlet (ML/SWE/DA lenses × 3 rounds + focused SWE on §11) surfaced 29 → 8 → 3 → 6 findings; exit criterion met. All evidence + final design at `.claude/research/option-a/` (gitignored). Key outcomes: three-layer framing collapsed to dual-mode (grounding + code-review) with write-time prevention deferred as bounded follow-on; invocation mechanism identified as `PreToolUse` agent-hook (novel-in-repo, spike as Step 0c); docs-maintenance reduced to three docs-as-tests (~11% corpus, low cost).

**Next:** **Step 0 — hardened DA prompt A/B.** Add "Claim-extraction pass" as a Required discipline to `docs/DA-REVIEW.md`, run on 3 reconstructed historical PRs as dry-run. If hardened DA catches ≥50% of retrieval-addressable findings, Option A as a separate subagent is unjustified — ship DA-hardening only. Otherwise proceed to Step 0b (Copilot-instructions A/B) and Step 0c (mechanism spike) before any subagent work. See `.claude/research/option-a/design.md` §10.1 (gate) + §11 (sequencing).

## Phase ledger

| Phase                                     | Status             | Shipped       | Headline                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | ------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** — Monorepo rebuild                  | ✅ done            | 2026-03-31    | Two packages (core + terminal), internal capability boundaries enforced by eslint-plugin-boundaries                                                                                                                                                                                 |
| **B** — Plan extraction + local planning  | ✅ done            | (pre-Phase-C) | `@chief-clancy/plan` standalone, `--from <brief>` flow, local plans in `.clancy/plans/`                                                                                                                                                                                             |
| **C** — Plan approval gate                | ✅ done            | 2026-04-09    | SHA-256 `.approved` marker, standalone-aware Step 1, optional board push from approve-plan, PR 8 deferred to dev                                                                                                                                                                    |
| **D** — Brief absorbs approve-brief       | ✅ done            | 2026-04-09    | Strategist directory deleted, virtual-role transition, install-mode preflight, Step 6 label-decision preamble                                                                                                                                                                       |
| **Docs lifecycle update**                 | ✅ done            | 2026-04-09    | RATIONALIZATIONS.md + DA-REVIEW Required disciplines + Severity Labels + Prove-It Pattern + Stop-the-Line + CLAUDE.md                                                                                                                                                               |
| **Post-research trim**                    | ✅ done            | 2026-04-09    | CLAUDE.md trimmed 10 → 4 bullets per AGENTS.md paper, CONVENTIONS.md "Output style" added per Brevity Constraints paper, GIT.md No --amend, memory pruned 8 files                                                                                                                   |
| **E** — `dev` extraction + AFK executor   | ✅ done            | 2026-04-12    | Standalone dev package with readiness gate, AFK loop, artifact writers, cross-package install/update/uninstall system                                                                                                                                                               |
| **Local-init-flow** — board-optional path | ✅ done            | 2026-04-14    | Init board gate, settings/doctor/help/autopilot/status/review local-mode awareness, comprehensive docs sweep. PRs #288, #289, #290, #291. Batch mode filters by `.approved` existence; SHA verifier deferred                                                                        |
| **Option A research** — pre-PR reviewer   | 📋 design complete | 2026-04-14    | 82-finding corpus across 7 PRs; 9-class scheme; four-round peer-review gauntlet (exit criterion met); design + evidence at `.claude/research/option-a/` (gitignored). Implementation starts at Step 0 (hardened-DA-prompt A/B — may invalidate whole initiative if ≥50% catch rate) |

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
