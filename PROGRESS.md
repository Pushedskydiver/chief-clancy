# Progress

Living state document for the Clancy monorepo. Records the current state, the phase ledger, and the next decision. Session-by-session detail lives in git history (each phase's PRs are tagged + commit messages reference them).

## Current state (2026-04-14)

**Local-init-flow near complete.** Full local pipeline is now covered end-to-end across every command: `/clancy:init` (board-optional) → `/clancy:brief` → `/clancy:plan --from` → `/clancy:approve-plan` → `/clancy:implement --from`. Settings, doctor, help, autopilot, status, review are all local-mode aware.

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

**Test counts:** 879 core, 755 terminal, 1201 dev, 126 brief, 326 plan = **3287 total**.

**Last shipped:** Local-init-flow PR 3 — settings/doctor/help/autopilot/status/review local-mode awareness (#290) in Session 77. 7 workflow .md files. Consistent 6-board detection across all files. New `[B] Connect a board` and `[D] Disconnect board` menu options. Doctor gains Shortcut/Notion/AzDO checks (pre-existing gap). Status shows plan inventory via `.approved` marker gate. 2 rounds of Copilot review, 6 comments total, all fixed. DA review caught 2 HIGH findings pre-push.

**Next:** Local-init-flow PR 4 — changeset only (dev patch for #288 guards, terminal patch for #289+#290 workflow updates). After that: audit current review chain + deep research Option A (pre-PR reviewer agent), comprehensive docs update for local pipeline lifecycle, readability review with Alex.

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
