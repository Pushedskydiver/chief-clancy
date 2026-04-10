---
status: Approved (revised 2026-04-10)
date: 2026-03-23
revised: 2026-04-10
---

# Package Evolution Strategy

## Decision

Ship v1 with two packages (`core` + `terminal`) but organise the code internally around future package boundaries. Extract into separate packages when a real consumer proves the need.

## Revision (2026-04-01)

The original plan (9 packages extracted from core/terminal) has been refined based on session 48 learnings. Key changes:

1. **Standalone capability packages** — `brief`, `plan`, and `design` earn standalone status not because terminal needs them extracted, but because they serve non-developer audiences (designers, PMs, founders) who don't need the full pipeline.
2. **QA stays in the pipeline** — the verification gate and quality metrics are tightly coupled to the implement/deliver loop. No standalone audience.
3. **`@chief-clancy/cli` as discovery wizard** — interactive package selector under the org scope. `chief-clancy` (unscoped) stays as a quick alias to terminal.
4. **Chat as a sibling to terminal** — both consume core/dev/brief/plan directly. Not a chain.

## Target package map

| Package                  | Purpose                                                          | Audience                            | Board needed?  |
| ------------------------ | ---------------------------------------------------------------- | ----------------------------------- | -------------- |
| `@chief-clancy/cli`      | Interactive wizard — "what do you need?"                         | Everyone                            | No             |
| `@chief-clancy/core`     | Domain model, types, schemas, board APIs                         | Library consumers                   | N/A            |
| `@chief-clancy/dev`      | Pipeline orchestration, lifecycle modules                        | Automators                          | Yes            |
| `@chief-clancy/brief`    | Grill → decompose → produce brief document                       | PMs, designers, founders, engineers | No             |
| `@chief-clancy/plan`     | Read brief/ticket → produce implementation plan                  | Tech leads, engineers               | No             |
| `@chief-clancy/design`   | Design specs, a11y, Stitch integration, visual verification      | Designers, frontend engineers       | No             |
| `@chief-clancy/terminal` | Full install — consumes all above + hooks, runners, all commands | Engineers using the full pipeline   | Yes            |
| `@chief-clancy/chat`     | Slack/Teams conversational interface                             | Teams wanting chat-driven workflows | Depends on use |
| `chief-clancy`           | Unscoped alias → terminal                                        | Existing users, quick install       | Yes            |

## Dependency direction

```
core
├── brief   (light dep — types/schemas only)
├── plan    (light dep — types/schemas only)
├── design  (light dep — types/schemas only)
├── dev     (heavy dep — board APIs, pipeline, lifecycle)
│
terminal    (consumes all above + adds installer/hooks/runners)
chat        (consumes all above + adds Slack/Teams adapter)
│
cli         (interactive wizard — installs other packages)
```

Terminal and chat are **siblings**, not a chain. Both wire their own I/O into core/dev.

## Standalone packages (brief, plan, design)

Each standalone package ships:

- A Claude Code slash command (markdown prompt)
- A lightweight installer (`npx @chief-clancy/brief` → copies commands to `.claude/commands/clancy/`)
- Minimal supporting code (file I/O for storing documents)

Each standalone package does NOT need:

- Hooks
- Runtime bundles
- Board configuration or `.clancy/.env`
- The pipeline

### Why standalone?

These capabilities serve audiences beyond developers:

- **Brief** — a designer structuring a feature idea, a PM writing a spec, a founder validating a concept
- **Plan** — a tech lead breaking down a project, a team planning a sprint
- **Design** — a designer writing component specs, accessibility requirements

They work with just Claude Code and a project directory. No board, no pipeline, no config.

### Conflict resolution

Multiple packages may install the same slash command (e.g. both `brief` and `terminal` ship `/clancy:brief`). This is handled by:

1. **Idempotent file writes** — slash commands are markdown files in `.claude/commands/clancy/`. Writing the same file twice is a no-op.
2. **Terminal is a superset** — it includes all standalone commands plus hooks/runners/board config. Installing terminal over brief just adds the extra pieces.
3. **Uninstall is clean** — removing terminal leaves standalone commands intact if the standalone package is still installed.

## What stays in terminal (not extracted)

- **QA** — verification gate (Stop hook) and quality metrics are pipeline-coupled. No standalone audience.
- **Hooks** — tightly bound to Claude Code's hook system. No other consumer.
- **Runners** — implement and autopilot entry points. Only terminal and chat consume these.
- **Installer** — the install/update/uninstall lifecycle.

## Extraction criteria (unchanged)

Extract a directory into its own package when **any** of these are true:

1. **A second consumer exists.** Another package (e.g. `chat`) needs the capability without the rest.
2. **The directory exceeds 2000 lines.** It has grown into a substantial body of code.
3. **Independent release cadence.** The capability changes at a different rate than the rest.

When extracting:

1. Move the source directory to `packages/{name}/src/`
2. Add package.json, tsconfig, vitest config
3. Update imports across the monorepo
4. Add boundary rule in ESLint
5. Update turbo.json, knip.json

## Build order

Revised 2026-04-10: dev moves from "extract when chat arrives" to Phase E (in progress). The original framing (chat as the trigger) has been retired — dev is being extracted now as a real standalone-first package because it serves a real audience (automators running unattended ticket execution) and ships its own user-facing surface. design moves to Phase F or later. See "Phase E — `@chief-clancy/dev` extraction decisions" below for the full rationale.

1. ~~`@chief-clancy/brief`~~ — done (Phase A)
2. ~~`@chief-clancy/plan`~~ — done (Phase B + C)
3. **`@chief-clancy/dev`** — **Phase E (in progress)** — standalone-first extraction with Ralph Wiggum executor surface
4. **`@chief-clancy/design`** — Phase F or later (Stitch integration work)
5. **`@chief-clancy/cli`** — interactive wizard, built after standalone packages exist
6. **`@chief-clancy/chat`** — conversational interface, the big new capability

## Standalone packages own their slash commands

**Rule (locked 2026-04-09):** standalone packages own all of their slash commands — including approval gates — when the only runtime dependency the command needs is board credentials in `.clancy/.env`. The package does not have to wait for the full pipeline to ship its full lifecycle surface.

**Plan, brief, and dev all follow this rule.** Each package ships its full standalone+board lifecycle as a self-contained surface:

- **`@chief-clancy/plan`** ships `/clancy:plan`, `/clancy:approve-plan`, and `/clancy:board-setup`. Approval writes a `.clancy/plans/{stem}.approved` SHA-256 marker, and in standalone+board mode `/clancy:approve-plan` can optionally push the approved plan to the source board ticket as a comment — see [`packages/plan/src/workflows/approve-plan.md`](../../../packages/plan/src/workflows/approve-plan.md) Step 4c. The push uses the same six per-platform curl blocks already documented in `plan.md` Step 5b for the original board comment post.
- **`@chief-clancy/brief`** ships `/clancy:brief`, `/clancy:approve-brief`, and `/clancy:board-setup`. Approval walks the brief's decomposition table and creates child tickets on the board (in topological order) with a single-source-of-truth pipeline label rule — see [`packages/brief/src/workflows/approve-brief.md`](../../../packages/brief/src/workflows/approve-brief.md) Step 6. Standalone+board users have no `CLANCY_ROLES` configured but the workflow defaults to `CLANCY_LABEL_PLAN` because they have clearly intended to use plan — the standalone+board case in the precedence list explicitly handles this without needing a role gate.

- **`@chief-clancy/dev`** ships `/clancy:dev` and `/clancy:board-setup`. Dev needs board credentials to fetch tickets for autonomous execution. Board-setup is adapted from brief (same credential collection, same `.clancy/.env` output) with dev-specific text. Local-ticket execution (without board credentials) is deferred to a future release (Cut E, Phase F).

All three packages use the same `.clancy/.env` and `.clancy/clancy-implement.js` env-var probes in their Step 1 preflight to classify into three install contexts (standalone / standalone+board / terminal). In standalone mode, brief hard-stops on `/clancy:approve-brief` (there is nothing to do without a board, since approve-brief's job is to create tickets on the board) while plan continues with the local marker path (it can write a `.approved` SHA without a board).

**What's NOT in scope under this rule:** code-applying tooling. A slash command that reads a plan file and writes code (the originally-scoped `/clancy:implement-from`) does NOT belong in the plan package, even though it would also be prompt-only. The cohesion test is "is this part of the package's lifecycle, or is it downstream consumption of the package's output?" Planning produces plans; executing the plan is downstream consumption and lives in `@chief-clancy/dev` (Phase E — see below). The lesson — that package-scope decisions need both layering AND cohesion lenses, and that the cohesion test alone is what kept `/clancy:implement-from` out of the plan package even though layering would have allowed it — surfaced when PR #213 was opened, reviewed, and then closed without merging in favour of deferring `/clancy:implement-from` to `dev`. The closed PR is preserved at [#213](https://github.com/Pushedskydiver/chief-clancy/pull/213) as the reference implementation for whoever ships `/clancy:implement-from` in `dev` (Cut F or later — Phase E itself does not ship implement-from; it ships the executor surface that implement-from will eventually plug into).

## Phase E — `@chief-clancy/dev` extraction decisions (locked 2026-04-10)

Phase E lifted `packages/core/src/dev/` (lifecycle + pipeline, ~7,261 LOC of non-test source) into a new standalone package `@chief-clancy/dev`, then layers an autonomous "Ralph Wiggum" execution surface on top of it. The decisions below were locked through 3 rounds of research and 3 rounds of Devil's Advocate review. They are the source of truth for whoever implements Phase E and any future phase that depends on dev.

### Hybrid package shape (a new third category)

`@chief-clancy/dev` is neither brief/plan-shaped (zero-runtime markdown-only standalone installers) nor terminal-shaped (full installer + hooks + esbuild bundles). It is a **third category**: standalone installer + esbuild runtime bundle + slash commands, with NO hooks. The installer copies a `clancy-dev.js` bundle into `.clancy/` (flat, alongside terminal's `clancy-implement.js`) and copies slash commands into `.claude/commands/clancy/`. The slash command shells out to `node .clancy/clancy-dev.js {args}`. See [ARCHITECTURE.md "Two Directory Trees"](../../../docs/ARCHITECTURE.md#two-directory-trees) for the full `.claude/` vs `.clancy/` layout.

This finding emerged when the canonical brief/plan template was applied to dev's actual shape (~7k lines of pipeline runtime code). brief and plan can be prompt-only because they have no real runtime. dev cannot. The third category was the lowest-cost way to stay standalone-first without requiring the full terminal install for any user who only wants the executor.

### Locked decision revision: `FATAL_ABORT_PHASES` + `checkStopCondition` move to dev

An earlier draft of this doc said these symbols should "stay in terminal as a loop-policy concern". DA review surfaced the contradiction: phase-name string literals are produced inside the pipeline ([`packages/dev/src/pipeline/run-pipeline.ts`](../../../packages/dev/src/pipeline/run-pipeline.ts)), the pipeline moves to dev in Phase E, and a `Set<string>` whose members are defined in another package is exactly the leaky coupling extraction was supposed to eliminate.

**Revised:** `FATAL_ABORT_PHASES` and `checkStopCondition` are pipeline-contract primitives. They move to `@chief-clancy/dev` alongside `run-pipeline.ts`. Terminal's autopilot (after becoming a thin wrapper over dev's `executeFixedCount`) imports `checkStopCondition` from `@chief-clancy/dev` like any other consumer.

### No `/clancy:approve-dev`

Mirroring the existing decision to keep `/clancy:implement-from` out of the plan package: `@chief-clancy/dev` ships NO `/clancy:approve-dev` slash command. The cohesion test rules it out from both framings:

- **Pre-approval (approve a ticket before execution)** is downstream consumption of brief's output, not part of dev's own lifecycle. Brief already owns this via `/clancy:approve-brief`. A pre-approval batch is also strictly worse than inline readiness gating because dev mutates its own input space — by the time the AFK loop reaches ticket 7, tickets 1-6 may have edited the codebase in ways that invalidate ticket 7's pre-approval.
- **Post-execution sign-off (approve a delivered PR)** is downstream consumption of dev's output. The PR is born already-handed-off to GitHub; PR review is the platform's job.

The 5-check readiness gate (running as a Devil's-Advocate-style fresh-Claude subagent before each ticket) is the de-facto inline approval. Approval in Clancy means "draft → lock → handoff artifact" and dev has no such artifact. Confirmed across four independent angles in DA review (semantics, mutation safety, cohesion test, prior-art absence in Devin/OpenHands/Aider/Claude Code/SWE-agent — none ship a separate approval verb for the execution loop).

### Pre-seed `ctx.ticket` (Q8 resolution)

For `/clancy:dev TICKET-123` (single-ticket interactive mode), the executor pre-seeds `ctx.ticket` from a one-shot board lookup BEFORE calling `runPipeline`. The existing `if (!ctx.ticket)` guard at [`packages/dev/src/pipeline/phases/ticket-fetch/ticket-fetch.ts`](../../../packages/dev/src/pipeline/phases/ticket-fetch/ticket-fetch.ts) makes the ticket-fetch path a no-op when `ctx.ticket` is already set. `computeBranches` still runs inside `ticketFetch` regardless, so `branchSetup` reads its computed values normally.

**This is intentional and contractual.** The pre-seed pattern is documented as a public behaviour of the `ticketFetch` phase. Future pipeline changes that might remove the `if (!ctx.ticket)` guard must preserve the pre-seed escape hatch by some other means (or extend the Board API with a uniform `fetchTicketByKey()` and migrate the pre-seed pattern to the new method). Phase E PR 8c includes a regression test asserting `ctx.targetBranch` and `ctx.ticketBranch` are populated after `runPipeline` returns under the pre-seed path.

The alternative (adding `Board.fetchTicketByKey()` across every board provider in Phase E) was considered and rejected as scope creep — Cut F or later may promote to the uniform method if a real consumer demands it. Until then, pre-seed is the intentional escape hatch.

### Readiness gate via spawn-based grading (Q5 resolution)

The readiness gate is invoked as a fresh `claude -p` subprocess from inside the dev bundle, NOT via the Claude Code Agent/Task tool. The Agent tool is a harness capability available only when Claude Code interprets a workflow markdown file — it is not callable from `node .clancy/dev/clancy-dev.js`. The bundle must use `child_process.spawn` to invoke a fresh Claude session per grade.

**Argv:** `claude -p --bare --dangerously-skip-permissions --output-format json --json-schema <verdict-schema> --model <model>`

Three flags from the [Claude Code headless docs](https://code.claude.com/docs/en/headless) are load-bearing:

- **`--bare`** skips auto-discovery of hooks, skills, plugins, MCP servers, auto-memory, and CLAUDE.md. Eliminates per-grade startup of all those subsystems. Docs: _"`--bare` is the recommended mode for scripted and SDK calls, and will become the default for `-p` in a future release."_ Requires `ANTHROPIC_API_KEY` in env (no OAuth/keychain read).
- **`--output-format json`** returns structured JSON with `session_id` and `usage.input_tokens` / `usage.output_tokens`. An earlier draft of this plan erroneously assumed token counts were unavailable under spawn-based grading and dropped them from the verdict schema; they are restored.
- **`--json-schema`** enforces verdict shape at the CLI layer, eliminating an entire class of parsing bug (malformed JSON in code fences, stray prose, missing fields).

**Default model:** `claude-haiku-4-5`. Grading is a stateless rubric task. Claude Code rate-limit guidance explicitly says "reserve Opus for complex reasoning, route simpler tasks through Sonnet/Haiku" because the parallel-Opus pattern blows past per-account throughput pools. Override via `CLANCY_DEV_GRADING_MODEL` env var. If a user forces Opus, dev caps concurrency at 2 instead of the default 4.

**Per-grade timeout: 120s** (not 60s). `claude -p` has built-in silent retry on 429/529 — the longer budget gives room for 2 silent retries before the grade is killed.

**Environment requirement:** `ANTHROPIC_API_KEY` must be set. Dev's bundle fails fast at module init with a clear error message if unset (per `--bare` requirement — no OAuth fallback when `--bare` is on).

The new module `packages/dev/src/agents/claude-spawn.ts` (~120 LOC, shipping in PR 9) wraps async `child_process.spawn` with: per-grade timeout via `AbortController`, staged shutdown (`SIGTERM` → 2s grace → `SIGKILL`), `SIGINT` propagation to all active controllers, stdin cap at 32KB, stdout buffer at 10MB, stderr drained into a 256KB ring buffer to prevent kernel pipe-buffer deadlock on retry-heavy runs. Caller-side concurrency cap (default 4) via an inlined `withConcurrency` helper. No npm dependency — runtime bundles must be zero-dep per `CLAUDE.md` non-obvious constraints.

### No mid-loop discovery in Phase E

An earlier draft included a "mid-loop discovery" path: a green-graded ticket that turned yellow during execution would get deferred and the loop would continue. DA review verified by reading [`packages/dev/src/pipeline/phases/feasibility/feasibility.ts`](../../../packages/dev/src/pipeline/phases/feasibility/feasibility.ts) that the feasibility phase returns a binary `{ feasible: boolean, reason?: string }` — there is no third "ambiguous" state. Adding one would be a hidden pipeline-contract change Phase E does not budget for, and the "ticket may have already created a branch" cleanup story is unspecified.

**Phase E ships pre-flight batch grading only.** `/clancy:dev --loop --afk` grades all tickets up front, writes `.clancy/dev/readiness-report.md`, and halts before the loop if any are not green. `/clancy:dev --loop --afk --afk-strict` skips yellows, executes greens only, writes `deferred.json` for the skipped tickets. Phase F or later may extend `FeasibilityPhaseResult` with an `ambiguous` discriminated-union variant and add mid-loop discovery on top.

### 5-check readiness gate (Cut E will add a 6th)

Phase E ships a 5-check readiness rubric. The 5 checks are:

1. **Clear** — title + description answer "what" and "why" in one paragraph the agent can restate
2. **Testable** — at least one concrete verifiable signal (test name, CLI command, HTTP response, file path, measurable metric)
3. **Small** — fits in one Ralph loop (≈ one PR, one logical change)
4. **Locatable** — pre-flight grep over caller-supplied terms returns non-empty plausibly-related files (or the ticket explicitly names a new path)
5. **Touch-bounded** — subagent enumerates the file paths the change is expected to modify (concrete non-empty list = green; vague/directory-only = yellow; cannot name files = red). The file list is captured in the verdict and Phase E PR 12d wires post-execution drift detection that compares against `git diff --name-only` and writes `.clancy/dev/drift.json` for the run summary

**`Independent` (the 6th check) is intentionally cut from Phase E.** Board APIs already expose dependency data natively (GitHub parent/child task lists, Jira `issuelinks`, Azure work-item link types), so a board-coupled `Independent` check is technically feasible in Phase E. However, Cut E (Phase F or later) ships a `dependencies` frontmatter field on local tickets that supersedes the board-side path. Plumbing two different code paths (board-side now, frontmatter later) creates migration burden we don't want to pay. Phase E ships 5 checks; Cut E adds `Independent` once. The pre-flight `readiness-report.md` writer surfaces board-side blocker hints as NON-GRADING warnings in the report header so users still see them, but they don't affect colour verdicts.

**`Calibrated` (an earlier candidate 6th check) was rejected** based on LLM self-confidence calibration literature ([Tian et al. 2023, "Just Ask for Calibration"](https://arxiv.org/abs/2305.14975); [Xiong et al. 2024, "Can LLMs Express Their Uncertainty?"](https://arxiv.org/abs/2306.13063)). LLMs are systematically overconfident on free-form tasks; verbalised numeric confidence clusters at 0.8-0.95 regardless of accuracy. A `<0.7` threshold would essentially never fire. Touch-bounded replaces it with a concrete, ungameable measurement (a file list) that doubles as evidence the executor can use at runtime for drift detection.

**Aggregation rule:** the overall verdict is `worst(per-check verdicts)` with one promotion: if `yellowCount >= 3`, the overall is `red`. The threshold lives in a `<!-- @threshold yellow-to-red = 3 -->` comment in `readiness.md` so it can be tuned without code changes.

### Cut E ticket schema (locked now for forward-compatibility)

Cut E (Phase F or later) will introduce local-source tickets stored as markdown files in `.clancy/tickets/`. The schema is locked NOW so that Phase E's readiness-report and drift-report formats align with Phase F's local-ticket format from day one. Locking now also ensures that Phase E PR authors don't paint themselves into a corner with verdict shapes that have to be reworked when Cut E ships.

**Path:** `.clancy/tickets/<id>-<slug>.md` (e.g. `.clancy/tickets/0042-add-credential-guard-hook.md`). Sequential numeric ids survive renames; the slug is for human readability.

**Frontmatter (Clancy-native, not Backlog.md-compatible):**

```yaml
---
id: 0042
title: Add credential guard hook to terminal
status: draft|ready|in-progress|done|blocked
type: feature|fix|chore|refactor|docs|test
package: core|terminal|brief|plan|dev|chief-clancy
created: 2026-04-10
priority: low|normal|high
dependencies: [] # array of ticket ids — named "dependencies" to match Backlog.md, GitHub Issues, and Linear (NOT "blocked_by")
acceptance:
  - 'concrete verifiable signal'
estimate_loops: 1 # how many Ralph iterations expected; >1 means the ticket should be split
---
```

**Body sections (adopted from [Backlog.md](https://github.com/MrLesk/Backlog.md) conventions verbatim):** `## Description`, `## Acceptance Criteria` with indexed checkboxes (`- [ ] #1`, `- [ ] #2`), `## Implementation Plan`, `## Implementation Notes`, `## Final Summary`. Body conventions follow Backlog.md so a future one-way export to their TUI/Web UI is trivial. Frontmatter does NOT follow Backlog.md because their schema is closed (their writer rebuilds frontmatter from a fixed TypeScript interface, dropping unknown fields on round-trip) and has no first-class slot for `package` or our `type` taxonomy. Backlog.md also lacks bidirectional sync to remote boards, so the "free future sync" benefit of adopting their format is hypothetical.

### Move-first-improve-second discipline (locked for Phase E)

Phase E moves ~7k LOC across two packages (terminal → dev, core → dev). Every move PR in the chain (PRs 2a/2b/2c/3a/3b/3.5/4a/4b/4c) ships under a strict discipline:

1. **Pure `git mv` + import rewrites only.** Every file shows `similarity index 100%` in `git log --stat -M`. No logic changes, no style changes, no renames, no test changes beyond import paths.
2. **PR description includes a NOTICED list** — bulleted improvement opportunities spotted during the move, with `file:line` references. Zero fixes in the move PR itself.
3. **Separate improvement PRs land after the corresponding move chain completes.** Each improvement PR targets ONE cluster (one lifecycle module, one helper, etc) for reviewability. Improvement PRs are numbered `Nx.1`, `Nx.2`, etc.
4. **Improvement PRs evaluate against current standards.** Per [`docs/RATIONALIZATIONS.md`](../../RATIONALIZATIONS.md) "The existing code does it this way, so it's fine" entry, do not let "but the old code did it this way" gatekeep the improvements.
5. **NOTICED items that don't ship as improvement PRs** carry forward into a "Phase E deferred improvements" section of `PROGRESS.md` so they don't get forgotten.

This discipline is grounded in seven-PR precedent from the earlier core → dev/lifecycle refactor (commits `f8cd61f`, `46ba20a`, `0fa2ba1`, `8c49a26`, `6edc40e`, `02c4fc6`, `6aa9af9` — every file showed `similarity index 100%`). It also implements [`docs/DEVELOPMENT.md`](../../DEVELOPMENT.md) "NOTICED BUT NOT TOUCHING" and [`docs/RATIONALIZATIONS.md`](../../RATIONALIZATIONS.md) "I'll quickly clean up this adjacent code" entry as a hard rule for the duration of Phase E.

### Locked decisions index

For future phases that depend on dev:

| Decision                                             | Resolution                                                                | Rationale                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Hybrid package shape                                 | dev = standalone installer + esbuild bundle + slash commands, no hooks    | New third category — see "Hybrid package shape" above                 |
| `FATAL_ABORT_PHASES` + `checkStopCondition` location | dev (pipeline-contract)                                                   | Revision of an earlier "stay in terminal" call — see above            |
| `/clancy:approve-dev`                                | does not exist                                                            | Cohesion test rules out both pre- and post- framings — see above      |
| Ticket-fetch explicit-id mode                        | pre-seed `ctx.ticket` from entrypoint                                     | Existing `if (!ctx.ticket)` guard at `ticket-fetch.ts:68` — see above |
| Readiness grader transport                           | spawn-based fresh `claude -p` from bundle                                 | Agent tool is harness-only — see above                                |
| Readiness grading model                              | `claude-haiku-4-5` default; override via env; force concurrency=2 on Opus | Rate-limit guidance — see above                                       |
| Mid-loop discovery in Phase E                        | excluded; pre-flight batch only                                           | `feasibility.ts` returns binary verdict — see above                   |
| Readiness check count                                | 5 in Phase E (Cut E adds Independent → 6)                                 | See above                                                             |
| Cut E ticket schema                                  | locked now for forward-compatibility                                      | See above                                                             |
| Move-first-improve-second discipline                 | every move PR is `git mv` only; improvements in follow-up PRs             | See above + `docs/RATIONALIZATIONS.md`                                |

## Original context (2026-03-23)

The original decision was to ship v1 with two packages (core + terminal) and organise code internally by future package boundaries. That decision was correct — the rebuild completed successfully with this structure.

The evolution above builds on that foundation. Internal boundaries (enforced by eslint-plugin-boundaries) remain in place. Extraction is mechanical because import rules are already enforced.
