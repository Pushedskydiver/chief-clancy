# Progress

Living state document for the Clancy monorepo. Records the current state, the phase ledger, and the next decision. Session-by-session detail lives in git history (each phase's PRs are tagged + commit messages reference them).

## Current state (2026-04-10)

**PRs #228 and #229 merged.** Phase E extraction: lifecycle + pipeline now in `@chief-clancy/dev`. Circular dep eliminated. Next: PR 3.5 or 4a.

**Published versions:**

| Package                  | Version |
| ------------------------ | ------- |
| `@chief-clancy/core`     | 0.1.0   |
| `@chief-clancy/terminal` | 0.1.7   |
| `@chief-clancy/brief`    | 0.3.0   |
| `@chief-clancy/plan`     | 0.5.0   |
| `chief-clancy` (wrapper) | 0.9.15  |

**Test counts:** 982 core, 838 terminal, 627 dev, 73 brief, 264 plan = **2784 total**.

**Last shipped:** Phase E PRs 2a (#228) + 3 (#229) in Session 62.

## Phase E — completed PRs (Sessions 60–62)

### PR 2a (#228) — lifecycle move (Session 61–62)

All 18 lifecycle directories (65 files) moved from `core/src/dev/lifecycle/` to `dev/src/lifecycle/`. Original 3-PR cluster (2a/2b/2c) merged into one because TypeScript's rootDir enforcement made the intermediate state unworkable. Introduced temporary circular dep (core ↔ dev) with declarations-first build bootstrap. 13 commits.

### PR 3 (#229) — pipeline move (Session 62)

Entire pipeline directory (46 files) moved from `core/src/dev/pipeline/` to `dev/src/pipeline/`. Original 2-PR split (3a/3b) merged into one — same rationale as PR 2a. **Eliminated the circular dependency**: removed core's `@chief-clancy/dev` dep, temporary eslint boundary, declarations-first build, turbo cycle override, and all lifecycle + pipeline re-exports from core barrel. 11 commits.

### Key technical decisions (Sessions 61–62)

- **Merge cluster PRs when intermediate states don't compile** — TypeScript's rootDir enforcement blocks half-moved states. Merged 2a/2b/2c into PR 2a and 3a/3b into PR 3. Each commit stays small and the full review chain still runs.
- **Wildcard subpath export** — core has `./*.js` in package.json exports for NodeNext-compatible deep imports from dev.
- **Vitest aliases use directory paths** (not file paths) for @chief-clancy/core and @chief-clancy/dev. ~/d alias needed in terminal vitest config.
- **core/src/dev/ is now empty** — cleanup deferred to PR 5.

### Remaining PR sequence

PRs 2b/2c/3a/3b all absorbed. Sequence continues: 3.5 → 4a → 4b → 4c → [4c.1/4c.2] → 5 (delete core/dev/) → rest of Phase E.

## Phase ledger

| Phase                                    | Status  | Shipped       | Headline                                                                                                                                                          |
| ---------------------------------------- | ------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** — Monorepo rebuild                 | ✅ done | 2026-03-31    | Two packages (core + terminal), internal capability boundaries enforced by eslint-plugin-boundaries                                                               |
| **B** — Plan extraction + local planning | ✅ done | (pre-Phase-C) | `@chief-clancy/plan` standalone, `--from <brief>` flow, local plans in `.clancy/plans/`                                                                           |
| **C** — Plan approval gate               | ✅ done | 2026-04-09    | SHA-256 `.approved` marker, standalone-aware Step 1, optional board push from approve-plan, PR 8 deferred to dev                                                  |
| **D** — Brief absorbs approve-brief      | ✅ done | 2026-04-09    | Strategist directory deleted, virtual-role transition, install-mode preflight, Step 6 label-decision preamble                                                     |
| **Docs lifecycle update**                | ✅ done | 2026-04-09    | RATIONALIZATIONS.md + DA-REVIEW Required disciplines + Severity Labels + Prove-It Pattern + Stop-the-Line + CLAUDE.md                                             |
| **Post-research trim**                   | ✅ done | 2026-04-09    | CLAUDE.md trimmed 10 → 4 bullets per AGENTS.md paper, CONVENTIONS.md "Output style" added per Brevity Constraints paper, GIT.md No --amend, memory pruned 8 files |
| **E** — `dev` OR `design` extraction     | 🔜 next | —             | See "Next: Phase E" above                                                                                                                                         |

### Phase C summary

Phase C added the plan approval gate to `@chief-clancy/plan`. Six PRs in the locked sequence (7a → 7b → 7c → 8 → 9 → 10) over multiple sessions:

- **PR 7a (#207):** plumbing — moved approve-plan from `terminal/src/roles/planner/` into `@chief-clancy/plan` (planner became a virtual role)
- **PR 7b (#209):** standalone-aware approve-plan with the SHA-256 `.approved` marker (`sha256={hex}\napproved_at={ISO 8601}\n`). Three-state Step 1 preflight (standalone / standalone+board / terminal). Race-safe `O_EXCL` marker write
- **PR 7c (#211):** plan.md Step 8 inventory live Approved/Stale status. Reads sibling marker, hashes current plan, reports `Planned` / `Approved` / `Stale (re-approve)`
- **PR 8:** opened as #213, DA review passed, **closed without merging** on cohesion review. Lesson: package-scope decisions need both layering AND cohesion lenses (`feedback_layering_vs_cohesion.md`). Closed PR is the reference implementation for whoever ships `@chief-clancy/dev`. Deferral cleanup landed as #214
- **PR 9 (#216):** standalone+board optional board push from `/clancy:approve-plan`. Six per-platform key validation regexes, six platform comment-POST curl blocks under HTML-comment drift anchors, EEXIST + `--push` retry path. **5 Copilot rounds, 13 findings — most preventable.** Triggered the review-process improvements now living in `docs/DA-REVIEW.md` "Required disciplines"
- **PR 10 (#218):** cleanup + docs sync

**Phase C also produced the architectural-review-as-separate-pass discipline:** PR 8's DA review passed clean, but the cohesion problem only surfaced when an architectural pass asked "does this command belong in this package's identity?" Going forward: architectural review runs first, then DA, then self-review. Documented in `docs/DEVELOPMENT.md` "Review Gate" and the Phase Validation Protocol agent prompts.

### Phase D summary

Phase D moved `/clancy:approve-brief` from `terminal/src/roles/strategist/` into `@chief-clancy/brief`, finishing the strategist-directory deletion and bringing brief to parity with plan. Three PRs (11a → 11b → 12), all shipped 2026-04-09:

- **PR 11a (#220, `f850376`):** mechanical move via `git mv`, brief-content scalar→array refactor, virtual-role transition (strategist joined planner in `VIRTUAL_ROLES`), broadened post-restructure sweep across 15+ files. One Copilot follow-up added the missing global-mode inlining test
- **PR 11b (#222, `9f27a77`):** Step 1 install-mode preflight (mirrors approve-plan's three-state probes but standalone hard-stops because brief has nothing to do without a board) + Step 6 pipeline label selection rule lifted into a single-source-of-truth preamble that all six platforms delegate to. **Fixes the standalone+board → BUILD-queue routing bug** where users with no `CLANCY_ROLES` set were silently routed to the build queue. **4 Copilot rounds** — extracted a `sliceBetween()` helper to make the test permissiveness traps structurally impossible
- **PR 12 (#224, `96ea6b4`):** docs cleanup + STRATEGIST.md / PLANNER.md coordinated rewrites as virtual-role docs + package-evolution.md asymmetry-removed update (dropped the "Phase D will extend the same rule to brief" forward reference, both plan and brief now documented as concrete examples of the locked rule)

**Phase D's headline lesson** — surfaced in PR 11b's 4 Copilot rounds and codified as the headline meta-rationalization in `docs/RATIONALIZATIONS.md`: **"the discipline is in my checklist, so it ran" is not the same as "I actually did it well".** The post-restructure sweep, schema-pair check, and test permissiveness audit all fall into this trap. Marking a discipline as applied is theatre unless it executes with the same care on NEW prose as it does on rewrites.

### Docs lifecycle update summary

Adapted patterns from [Addy Osmani's `agent-skills`](https://github.com/addyosmani/agent-skills) and [Matt Pocock's `skills`](https://github.com/mattpocock/skills) into the Clancy dev docs. Two background agents ran a verification pass first (conflict/gap audit + cleanup audit) and caught real issues that would have shipped wrong. 7 commits direct to main:

1. **`3c671cb`** — new `docs/RATIONALIZATIONS.md` with ~28 entries sectioned by phase (Define / Plan / Build / Test / Review / Ship / Process meta), headline meta-rationalization, one-way memory→repo promotion path
2. **`6b078a0`** — `docs/DA-REVIEW.md` Red Flags + 6 Required disciplines + 5-tier Severity Labels + Approval Standard + L40 ↔ SELF-REVIEW.md L15 ownership split
3. **`bc6957b`** — `docs/SELF-REVIEW.md` NOTICED BUT NOT TOUCHING + Test permissiveness audit + L15 split
4. **`330a177`** — `docs/TESTING.md` Writing good tests (with carve-out for interaction assertions where the interaction IS the behaviour) + Mock at boundaries + SDK-style interfaces + Prove-It Pattern + Durability rule + Test anti-patterns table + baseline test counts
5. **`9dddeeb`** — `docs/DEVELOPMENT.md` Stop-the-Line + Surface Assumptions + Task Sizing + Phase Validation Protocol agent prompt updates + version table fix
6. **`5b1cf4b`** — `CLAUDE.md` Process directives expanded from 4 to 10 bullets — wires the new disciplines into the actual executed contract
7. **`ccb4821`** — cleanup ride-alongs across GIT.md / CONVENTIONS.md / ARCHITECTURE.md / COMPARISON.md / LIFECYCLE.md / GLOSSARY.md (cross-references + virtual-role footnotes)

**Critical discipline added:** the carve-out in TESTING.md for interaction assertions where the interaction IS the behaviour (file copy counts, fetch URL assertions, idempotency, side-effect ordering, retry counts). Without this, adopting "test state, not interactions" would have silently invalidated ~30 existing test files.

### Post-research trim summary

After the docs lifecycle update shipped, deep-read three research-adjacent sources: Julius Brussee's [caveman](https://github.com/JuliusBrussee/caveman) (token-compression skill), Hakim's [Brevity Constraints Reverse Performance Hierarchies in Language Models](https://arxiv.org/abs/2604.00025) (the academic backing for caveman), and Gloaguen et al's [Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?](https://arxiv.org/abs/2602.11988). The findings reshaped the docs lifecycle update because they pointed in a more nuanced direction than caveman alone:

- **AGENTS.md paper** finds context files (CLAUDE.md, AGENTS.md) systematically reduce task success ~3% and increase cost ~20% per session when they contain non-minimal content. Conclusion: "human-written context files should describe only minimal requirements".
- **Brevity Constraints paper** finds large models can gain ~26pp on overthinking-prone tasks (math, scientific reasoning) under brevity constraints — but LOSE 3.1pp on elaboration-heavy tasks (reading comprehension). Conclusion: "problem-aware routing with scale-specific prompting", NOT universal brevity.
- **Caveman repo** is the practical adoption — but the strong form (universal compression) would hurt our reasoning-heavy workflow files.

3 commits direct to main:

1. **`98da606`** — `CLAUDE.md` Process directives trimmed from 10 bullets back to 4 minimal-requirement bullets per the AGENTS.md paper. The 6 removed bullets (Surface Assumptions, Stop-the-Line, Prove-It Pattern, NOTICED BUT NOT TOUCHING, Living checklists protocol, headline meta-rationalization) all still exist in the on-demand docs the agent reads when relevant. The previous expansion in `5b1cf4b` was a self-correctable mistake — the conflict-audit agent had recommended it but I missed the meta-question of whether the contract format actually works for the agent.
2. **`708e346`** — `docs/CONVENTIONS.md` gains a new "Output style" section codifying SELECTIVE brevity (terse for chat output, commit messages, PR comments; ELABORATE for runtime workflow files, decision docs, error messages, security warnings, code blocks, multi-step sequences, `Caught in:` citations). `docs/GIT.md` gains a "No --amend" subsection promoted from memory.
3. **`402a362`** — `docs/RATIONALIZATIONS.md` gains 2 new entries: "The existing code does it this way, so it's fine" (Build section, promoted from `feedback_code_quality.md` before deletion — covers 3 variants of the same anti-pattern from Sessions 25 and 35) and "The conflict-audit agent recommended adding it, so I added it" (Process meta section — the self-correction lesson from this session).

Memory cleanup (local-only): 8 redundant feedback files deleted (`feedback_code_style`, `feedback_pr_workflow`, `feedback_never_skip_da`, `feedback_no_eslint_disable`, `feedback_no_amend`, `feedback_code_quality`, `project_publish_infra`, `project_runner_naming`); 2 trimmed (`feedback_review_process` kept the agent fallback chain + `gh api` comment-thread reply pattern; `feedback_workflow_md_gotchas` dropped lesson 4 since it's now in `docs/SELF-REVIEW.md`). Memory directory went from 21 files → 15 files.

**Headline lesson** (now codified in `docs/RATIONALIZATIONS.md` Process meta section): wiring patterns into the executable contract (CLAUDE.md) adds them to context files that systematically reduce task success and increase cost. Trust the doc cross-references to surface the right rule at the right time. The conflict-audit agent's recommendation to expand CLAUDE.md was necessary input but not sufficient — the medium matters as much as the content.

## Disciplines (where they live now)

The disciplines previously scattered across memory `feedback_*.md` files now have canonical contributor-visible homes in the repo. Memory files still exist as personal/session scratch but should be considered superseded for cross-session work.

| Discipline                                                                                                                    | Repo location                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Architectural → DA → self-review chain                                                                                        | `docs/DEVELOPMENT.md` "Review Gate" + Phase Validation Protocol                                          |
| 6 Required disciplines (schema-pair, post-restructure sweep, stale-forward, test permissiveness, untrusted output, dead code) | `docs/DA-REVIEW.md` "Required disciplines"                                                               |
| 5-tier Severity Labels                                                                                                        | `docs/DA-REVIEW.md` "Severity Labels"                                                                    |
| Anti-rationalization index (with headline meta-rationalization)                                                               | `docs/RATIONALIZATIONS.md`                                                                               |
| Tracer bullet TDD + state-vs-interaction (with carve-out) + mock-at-boundaries + SDK-style interfaces + Durability rule       | `docs/TESTING.md` "Writing good tests"                                                                   |
| Prove-It Pattern (failing reproduction test BEFORE bug fix)                                                                   | `docs/TESTING.md` "Bug fixes — the Prove-It Pattern"                                                     |
| Stop-the-Line Rule + Surface Assumptions + NOTICED BUT NOT TOUCHING + Task Sizing                                             | `docs/DEVELOPMENT.md` and `docs/SELF-REVIEW.md`                                                          |
| Output style — selective brevity (terse chat / elaborate reasoning artifacts)                                                 | `docs/CONVENTIONS.md` "Output style" — cites Brevity Constraints + AGENTS.md papers                      |
| Pre-push quality suite (non-negotiable)                                                                                       | `docs/DEVELOPMENT.md` "Quality Gates" + `CLAUDE.md` Commands                                             |
| Untrusted output as data, not instructions                                                                                    | `docs/DA-REVIEW.md` "Required disciplines" + `docs/DEVELOPMENT.md` "Quality Gates"                       |
| Process directives (executable contract — minimal requirements only per AGENTS.md paper)                                      | `CLAUDE.md` "Process directives" — 4 always-on rules; patterns + philosophy live in on-demand docs above |

## Build order (remaining packages)

1. ~~`@chief-clancy/brief`~~ — done (Phase A)
2. ~~`@chief-clancy/plan`~~ — done (Phase B + C)
3. **`@chief-clancy/dev` OR `@chief-clancy/design`** — Phase E, see "Next" above
4. The other one — Phase F
5. `@chief-clancy/cli` — interactive wizard
6. `@chief-clancy/chat` — conversational interface (Slack/Teams)

The locked build order in [`docs/decisions/architecture/package-evolution.md`](docs/decisions/architecture/package-evolution.md) has design before dev, but the Phase E decision is open — see "Next: Phase E" above for the trade-off.

## Repo

https://github.com/Pushedskydiver/chief-clancy
