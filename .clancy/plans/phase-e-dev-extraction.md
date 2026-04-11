I have sufficient grounding. The user's provisional plan names ~7261 LOC non-test; actual is ~20k total but that includes tests. The 41 test files claim aligns. I'm ready to write the plan.

---

# Phase E Plan — `@chief-clancy/dev` Extraction + Ralph Wiggum Executor

**Status:** DRAFT for Devil's Advocate review
**Date:** 2026-04-10
**Author:** planning agent (read-only pass)
**Scope:** Cut D — extraction + standalone installer + runtime bundle + `/clancy:dev {ticket}` + 6-check readiness gate + autopilot loop + AFK behavior matrix.
**Out of scope:** Cut E (local-source tickets, Phase F), Cut F (`/clancy:implement-from`, Phase G).

---

## 1. Executive summary

Phase E lifted `packages/core/src/dev/` (lifecycle + pipeline, ~7.3k LOC of non-test source across 19 lifecycle modules + 16 pipeline phases) into a new standalone package `@chief-clancy/dev`, then layers an autonomous "Ralph Wiggum" execution surface on top of it. Dev becomes a **third package shape** in the monorepo: standalone installer + esbuild runtime bundle + slash commands, but — unlike terminal — no hooks and no `.clancy/.env` probing beyond what the pipeline already needs. The user-visible shipment is two slash commands (`/clancy:dev {ticket}` and `/clancy:dev --loop [--afk [--afk-strict]]`) gated by a Devil's-Advocate-style readiness subagent that scores each ticket against six checks before the executor touches a branch. Phase E ends when the readiness gate, the loop primitive (`executeQueue`), the AFK behavior matrix, and the `run-summary.md` / `readiness-report.md` / `deferred.json` artifacts are all shipping through the bundle and terminal's autopilot has become a thin wrapper importing `executeQueue` from `@chief-clancy/dev`.

---

## 2. Architecture overview

### 2.1 Post-extraction seam diagram

```
                           ┌──────────────────────────────────┐
                           │       @chief-clancy/core         │
                           │  (types, schemas, boards,        │
                           │  shared utils — NO pipeline)     │
                           └────────────────┬─────────────────┘
                                            │
                         ┌──────────────────┴──────────────────┐
                         │                                     │
                         ▼                                     ▼
          ┌──────────────────────────────┐     ┌──────────────────────────┐
          │     @chief-clancy/dev        │     │ @chief-clancy/brief/plan │
          │  (heavy — pipeline runtime)  │     │  (light — types only)    │
          │                              │     └──────────────────────────┘
          │  src/lifecycle/*  (19 mods)  │
          │  src/pipeline/*   (16 phases)│
          │  src/dep-factory/            │                  ▲
          │  src/queue.ts  (executeQueue)│                  │
          │  src/agents/readiness.md     │                  │
          │  src/commands/dev.md         │      ┌───────────┴───────────┐
          │  src/commands/dev-loop.md    │      │ @chief-clancy/terminal│
          │  src/workflows/dev.md        │◄─────┤  autopilot thin wrap  │
          │  src/workflows/dev-loop.md   │      │  buildPipelineDeps    │
          │  src/installer/install.ts    │      │  hooks/runners/       │
          │  src/artifacts/*.ts          │      │  installer            │
          │  bin/dev.js  (installer CLI) │      └───────────────────────┘
          │  dist/bundle/clancy-dev.js   │                  ▲
          │  dist/bundle/clancy-dev-     │                  │
          │    autopilot.js              │           ┌──────┴──────┐
          └──────────────────────────────┘           │ chief-clancy│
                                                     │  (wrapper)  │
                                                     └─────────────┘
```

### 2.2 Boundary rules

`eslint.config.ts:32-113` gains a new element `{ type: 'dev', pattern: 'packages/dev/*' }` and two new dependency rules:

- `from: dev` → `allow: [dev, core]`
- `from: terminal` → `allow: [terminal, core, dev]` (adds `dev`)
- `from: wrapper` → `allow: [wrapper, terminal, plan, dev]` (adds `dev` so the unscoped `chief-clancy` wrapper can surface readiness reports if asked)

brief and plan are **not** updated — they remain light standalones. dev does not import from them.

### 2.3 What dev exports (public surface)

- **Runtime types and phase functions** — everything currently re-exported from `core` via `core/dev/` barrels. Pipeline, lifecycle, `PipelineDeps`, `PipelineResult`, `RunContext`, `createContext`, `formatDuration`, etc.
- **`buildPipelineDeps(opts)`** — factory lifted from terminal (`dep-factory.ts:331`). Same signature, new home.
- **`executeQueue(opts)`** — new primitive (see §5) extracted from terminal's `runAutopilot()`.
- **Artifact writers** — `writeReadinessReport()`, `writeRunSummary()`, `writeDeferredJson()`. Pure functions over injected `fs`.
- **Readiness types** — `ReadinessVerdict`, `ReadinessCheckId`, `ReadinessReport`. Data-out only, schema validated with `zod/mini`.
- **NO exports for:** `runAutopilot` (stays in terminal, becomes the thin wrapper), hook helpers, installer prompts.

### 2.4 What terminal still owns

- `FATAL_ABORT_PHASES` + `checkStopCondition()` (pipeline-contract, not loop-contract)
- `runAutopilot()` — becomes a 20-line adapter: build deps → call `executeQueue()` → display result
- `runImplement()` — unchanged
- All hooks, `cli-bridge`, `notify`, `session-report`, `prompt-builder`
- Installer + manifest + role filtering

### 2.5 Runtime bundles

Two new entries in terminal's bundle list move into dev's own esbuild config:

| Bundle                         | Entry                                    | Consumer                                |
| ------------------------------ | ---------------------------------------- | --------------------------------------- |
| `clancy-dev.js`                | `packages/dev/src/entrypoints/dev.ts`    | `/clancy:dev {ticket}` — single ticket  |
| `clancy-dev-autopilot.js`      | `packages/dev/src/entrypoints/loop.ts`   | `/clancy:dev --loop` — queue + AFK      |

Both bundles are copied into `.clancy/` by dev's installer (`bin/dev.js`). Terminal's installer continues to copy `clancy-implement.js` and `clancy-autopilot.js` until a follow-up phase consolidates them — this is **NOTICED BUT NOT TOUCHING** in Phase E.

---

## 3. The 6-check readiness gate — concrete spec

### 3.1 Shape

Source of truth: `packages/dev/src/agents/readiness.md` (markdown rubric, read by a fresh Claude subagent via Claude Code's Task tool). The main executor never hardcodes the rubric — the subagent reads the markdown, grades the ticket, and returns structured JSON via a terminal output block. This is the same architectural pattern as `packages/brief/src/agents/devils-advocate.md`.

**Why markdown-rubric + JSON-out?** Locked decision #5: iteration-friendly. The user wants to tune checks without editing runtime code. The bundle only knows how to invoke the subagent and parse `ReadinessVerdict`. Check wording lives in the prompt.

### 3.2 Per-check spec

Each check returns one of `green` / `yellow` / `red`. Worst colour wins the overall verdict. `yellow` means "answerable with one question"; `red` means "structurally unsuitable for a Ralph loop right now".

| Id | Name | Input | Verdict criteria | Failure-mode JSON |
|---|---|---|---|---|
| 1 | **Clear** | Ticket title + description, normalised to text | Green: one-paragraph restatement possible. Yellow: title OR description clear but not both. Red: cannot restate without guessing intent. | `{ id: "clear", verdict: "red", reason: "Title is a tag ('feat: do the thing'); description is empty", question: "What behaviour should this ticket deliver? In one sentence." }` |
| 2 | **Testable** | Ticket description + any `## Acceptance Criteria` section | Green: ≥1 concrete verifiable signal (test name, CLI command, HTTP endpoint, file path, measurable metric). Yellow: criteria present but vague ("works correctly"). Red: no criteria at all. | `{ id: "testable", verdict: "yellow", reason: "Acceptance says 'should load quickly' with no threshold", question: "What's the target load time — 100ms? 1s? And measured where?" }` |
| 3 | **Small** | Ticket body + tech debt signals (TODO count, surface area references) | Green: one logical change, one PR. Yellow: description lists 2-3 sub-items that could split. Red: ≥4 sub-items OR explicit "this is a big one". | `{ id: "small", verdict: "red", reason: "Description enumerates 6 unrelated sub-features", question: "Which of these 6 items is the MVP? The rest should be separate tickets." }` |
| 4 | **Independent** | Ticket's `dependencies` frontmatter (Cut E schema — see §8 decision 8) + progress log of completed tickets | Green: no deps, or all deps completed. Yellow: one dep that is in-progress. Red: unresolved dep on a not-yet-started ticket. | `{ id: "independent", verdict: "red", reason: "Depends on TICKET-42 which is not started", question: "Should TICKET-42 be picked first, or is the dependency actually obsolete?" }` |
| 5 | **Locatable** | Pre-flight Grep/Glob over the repo for load-bearing nouns in the ticket (file paths, type names, function names) | Green: grep finds non-empty plausibly-related files, OR ticket names a new path explicitly. Yellow: grep hits ambiguous files (many matches, none obviously relevant). Red: zero hits AND no new-path declaration. | `{ id: "locatable", verdict: "red", reason: "Grep for 'AuthMiddleware' returns zero hits; ticket doesn't name a new path", question: "Which file does this live in? Or is this a new module — what's its path?", evidence: { grepTerm: "AuthMiddleware", hits: 0 } }` |
| 6 | **Calibrated** | Subagent's OWN self-reported confidence + open-questions list after checks 1-5 | Green: subagent reports high confidence, no load-bearing open questions. Yellow: subagent reports 1-2 non-load-bearing questions (nice-to-knows). Red: subagent reports ≥1 load-bearing open question OR self-assessed confidence < 0.7. | `{ id: "calibrated", verdict: "red", reason: "Subagent flagged 2 load-bearing unknowns while grading check 2", questions: ["...", "..."] }` |

### 3.3 Verdict schema (dev exports `ReadinessVerdict` type + zod/mini parser)

```
type ReadinessCheckId = 'clear' | 'testable' | 'small' | 'independent' | 'locatable' | 'calibrated'
type CheckColour      = 'green' | 'yellow' | 'red'

type CheckResult = {
  readonly id:        ReadinessCheckId
  readonly verdict:   CheckColour
  readonly reason:    string
  readonly question?: string              // present when verdict !== 'green'
  readonly evidence?: Record<string, unknown>
}

type ReadinessVerdict = {
  readonly ticketId:  string
  readonly overall:   CheckColour         // worst of per-check colours
  readonly checks:    readonly CheckResult[]
  readonly gradedAt:  string              // ISO 8601
  readonly rubricSha: string              // sha256 of readiness.md at grading time — detects rubric drift
}
```

The `rubricSha` field is **new** — it lets the executor detect when the same ticket was re-graded against a different rubric version. Without it, a run that upgrades mid-loop silently mixes criteria. See §8 open question Q1 about whether to hard-fail on drift.

### 3.4 Prompt shape (readiness.md, high level)

```
# Readiness Gate Agent

You are a fresh reviewer. Grade the ticket below against 6 checks.
Never ask the human. Never execute the ticket. Return ONE fenced
json block matching the ReadinessVerdict schema.

## Input (injected by executor)
- ticket: { id, title, description, acceptance, dependencies }
- completedTickets: string[]
- repoRoot: string  (for grep/glob)

## Checks
... (each check spec verbatim from §3.2) ...

## Output
Return exactly one ```json fenced block. No prose outside it.
Schema: { ticketId, overall, checks[], gradedAt, rubricSha }.
```

**Schema-pair check:** the rubric in readiness.md MUST be grepped against the `ReadinessCheckId` union in `src/agents/types.ts` before every PR that touches either side. Drift between the 6 ids in the markdown and the 6 ids in the type is exactly the failure mode [`docs/DA-REVIEW.md:51`](docs/DA-REVIEW.md) names.

---

## 4. AFK behavior matrix — concrete spec

### 4.1 Mode table

| Mode | Invocation | Behaviour on yellow/red | Behaviour on mid-loop yellow |
|---|---|---|---|
| **Interactive** | `/clancy:dev TICKET-123` | Ask user inline, block until answered | N/A (single-ticket) |
| **AFK** | `/clancy:dev --loop --afk` | **Pre-flight batch:** grade ALL tickets up-front, write `readiness-report.md`, halt with exit 0 before loop starts | Defer this ticket with reason, continue loop |
| **AFK strict** | `/clancy:dev --loop --afk --afk-strict` | Pre-flight batch. Execute ONLY green tickets. Skip yellow. Red is error. | Defer this ticket with reason, continue loop |

### 4.2 Flow diagrams

**Interactive (single ticket):**

```
dev TICKET-123
  ├─ grade(TICKET-123) ──► verdict
  │   ├─ green  ──► runImplement(TICKET-123) ──► display result ──► exit 0
  │   ├─ yellow ──► print questions, read stdin, amend ticket context, re-grade
  │   └─ red    ──► print questions, exit 1 (user fixes ticket)
```

**AFK (loop, pre-flight batch):**

```
dev --loop --afk
  ├─ fetchQueue() ──► [T1, T2, T3, ...Tn]
  ├─ for each T: grade(T) ──► verdicts[]
  ├─ writeReadinessReport(verdicts) → .clancy/readiness-report.md
  ├─ if any yellow or red:
  │    print "N tickets need attention. See .clancy/readiness-report.md."
  │    exit 0                                       ◄── HALT BEFORE LOOP
  └─ else:
       executeQueue({ run: runImplement, shouldHalt: checkStopCondition, queue: verdicts.map(v => v.ticketId) })
       writeRunSummary(...)
```

**AFK strict (skip yellow, execute green):**

```
dev --loop --afk --afk-strict
  ├─ same pre-flight, but:
  ├─ splitBuckets(verdicts) → { green: [...], yellow: [...], red: [...] }
  ├─ if red.length > 0: writeReadinessReport + exit 1 (red is fatal in strict)
  ├─ writeDeferredJson(yellow, reason: 'afk-strict-skip')
  ├─ executeQueue(green)
  └─ writeRunSummary(completed: [...], deferred: yellow.map(...), failed: [...])
```

**Mid-loop discovery (green → yellow during execution):**

```
executeQueue running T5 (pre-graded green)
  T5's feasibility phase reports "ambiguous acceptance"
  ├─ capture discovery event
  ├─ append to deferred.json (reason: 'mid-loop-discovery', phase: 'feasibility')
  ├─ mark T5 status=deferred in run-summary
  └─ CONTINUE loop to T6         ◄── do NOT halt, do NOT best-effort
```

### 4.3 Artifact file formats

#### `readiness-report.md` (written to `.clancy/readiness-report.md`)

Structured markdown so humans can read it AND a future version can parse it:

```markdown
---
generated_at: 2026-04-10T14:30:00Z
rubric_sha: sha256:abc123...
total: 7
green: 3
yellow: 3
red: 1
---

# Readiness Report

## Green (3) — ready to execute

- `TICKET-101` — "Add --strict flag to installer" (all 6 checks green)
- `TICKET-104` — "Fix ENOENT on missing .clancy.env"
- `TICKET-107` — "Update README install snippet"

## Yellow (3) — needs one answer each

### TICKET-102 — "Speed up the loader"
- **testable:** "works fast" has no threshold
  - **Q:** Target load time — 100ms? 1s? Measured where?
### TICKET-103 — "Refactor auth"
- **small:** lists 4 unrelated sub-items
  - **Q:** Which is MVP? Split the others.
### TICKET-105 — "Support OIDC"
- **locatable:** grep for "AuthProvider" returns zero hits
  - **Q:** Which file? Or new module — what's the path?

## Red (1) — structurally unsuitable

### TICKET-106 — "Finish the thing"
- **clear:** title is a placeholder; description empty
  - **Q:** What behaviour should this deliver?
- **independent:** depends on TICKET-99 which is not started

---

## Human, do this next

1. Answer the 3 yellow questions in the ticket bodies (edit on the board or in `.clancy/tickets/`)
2. Either fix TICKET-106 or mark it `wontfix`
3. Re-run: `/clancy:dev --loop --afk`
```

#### `deferred.json` (written to `.clancy/deferred.json`)

```json
{
  "generatedAt": "2026-04-10T15:12:33Z",
  "mode": "afk-strict",
  "rubricSha": "sha256:abc123...",
  "entries": [
    {
      "ticketId": "TICKET-102",
      "reason": "afk-strict-skip",
      "verdict": "yellow",
      "checks": [ /* full CheckResult[] */ ]
    },
    {
      "ticketId": "TICKET-108",
      "reason": "mid-loop-discovery",
      "phase": "feasibility",
      "discoveredAt": "2026-04-10T15:08:01Z",
      "notes": "feasibility phase reported ambiguous acceptance"
    }
  ]
}
```

#### `run-summary.md` (written at end of EVERY loop, green or red)

```markdown
---
generated_at: 2026-04-10T16:45:00Z
mode: afk
started_at: 2026-04-10T14:30:00Z
duration: 2h 15m
iterations: 4
---

# Run Summary

## Completed (2)
- TICKET-101 — PR #231 opened
- TICKET-104 — PR #232 opened

## Deferred (2)
- TICKET-108 — mid-loop discovery (feasibility) — see `.clancy/deferred.json`
- Extract I/O adapter factories (makeExecGit, makeLockFs, etc.) to dev — currently duplicated in terminal's entrypoint and dev's entrypoint. Natural fit: PR 11a–11c (ExecuteQueue split) or standalone cleanup.

## Failed (1)
- TICKET-107 — pipeline error: "git push rejected (branch protected)"

## Human, do this next
1. Review and merge PR #231, PR #232
2. Address TICKET-108 ambiguity, re-queue
3. Check branch protection on TICKET-107 remote; re-run to retry
```

### 4.4 Iteration-friendly surface

Per locked decision #5: the rubric is markdown, the outputs are data. Changing "what yellow means" is a prompt edit. Adding a 7th check is a markdown + type edit + schema edit (all in dev's `src/agents/`) — no runtime code changes in `executeQueue` or the entrypoints.

---

## 5. `executeQueue` interface

### 5.1 Location

`packages/dev/src/queue.ts`, exported from `packages/dev/src/index.ts`.

### 5.2 Signature

```ts
import type { ConsoleLike } from '@chief-clancy/dev'  // or move ConsoleLike to dev

type QueueStopCondition =
  | { readonly stop: false }
  | { readonly stop: true; readonly reason: string }

type QueueIterationResult<TResult> = {
  readonly result: TResult
  readonly ticketId: string
}

type ExecuteQueueOpts<TResult> = {
  /** Opaque: the executor that processes one ticket. dev doesn't know what a ticket is. */
  readonly run: (ticketId: string) => Promise<TResult>

  /** Opaque: pipeline-contract stop decision. dev doesn't know FATAL_ABORT_PHASES. */
  readonly shouldHalt: (result: TResult) => QueueStopCondition

  /** The ticket ids to process, in order. */
  readonly queue: readonly string[]

  /** Maximum iterations regardless of queue length. Capped at 100 inside. */
  readonly maxIterations: number

  /** Quiet-hours config stays in the primitive — it's general-purpose. */
  readonly quietStart?: string           // "22:00"
  readonly quietEnd?: string             // "06:00"

  /** Injected I/O. */
  readonly sleep:  (ms: number) => Promise<void>
  readonly now?:   () => Date
  readonly clock:  () => number
  readonly console: ConsoleLike
}

type ExecuteQueueOutcome<TResult> = {
  readonly iterations: readonly QueueIterationResult<TResult>[]
  readonly haltedAt?:  { readonly ticketId: string; readonly reason: string }
  readonly startedAt:  number
  readonly endedAt:    number
}

export async function executeQueue<TResult>(
  opts: ExecuteQueueOpts<TResult>,
): Promise<ExecuteQueueOutcome<TResult>>
```

### 5.3 What stays behind in terminal

`FATAL_ABORT_PHASES` (the Set at `packages/terminal/src/runner/autopilot/autopilot.ts:119`) and `checkStopCondition` (`:136`) both stay in terminal. They know about pipeline phase names — that's a **pipeline-contract** concern, not a **loop-contract** concern. dev's queue only knows "the callback said halt".

### 5.4 Terminal call-site (post-extraction)

```ts
// packages/terminal/src/runner/autopilot/autopilot.ts — becomes a thin wrapper
import { executeQueue } from '@chief-clancy/dev'
import { checkStopCondition } from './stop-condition.js'  // stayed in terminal

export async function runAutopilot(opts: AutopilotOpts): Promise<void> {
  printBanner(opts.console)

  const outcome = await executeQueue({
    queue: Array.from({ length: opts.maxIterations }, (_, i) => `iter-${i + 1}`),
    run: (_id) => opts.runIteration(),        // terminal still runs one impl per "ticket slot"
    shouldHalt: checkStopCondition,
    maxIterations: opts.maxIterations,
    quietStart: opts.quietStart,
    quietEnd:   opts.quietEnd,
    sleep:      opts.sleep,
    clock:      opts.clock,
    now:        opts.now,
    console:    opts.console,
  })

  await finalize(opts, outcome.startedAt, outcome.iterations.length)
}
```

**Caveat that DA agents should grill:** terminal's existing autopilot has no per-ticket addressing — it loops over `runIteration()` N times and `runIteration` itself pulls the next ticket from the board. Extracting `executeQueue` with a `queue: string[]` parameter is a **semantic change**: dev's queue knows about ticket ids; terminal's loop was id-free. Either:

- **(A)** dev's queue takes `queue: readonly T[]` (generic — terminal passes `['iter-1', ..., 'iter-N']` as fillers)
- **(B)** dev's queue has two entry points — `executeFixedCount({ iterations, run, ... })` for terminal and `executeFromQueue({ queue, run, ... })` for dev
- **(C)** the queue is `undefined` → "run up to maxIterations, let `run()` decide what's next"

**Recommendation:** go with (C). It preserves terminal's current semantics exactly (terminal keeps pulling from board via its closure), and dev passes its own queue when it wants addressed execution. The signature becomes:

```ts
readonly queue?: readonly string[]                       // undefined = fixed-count mode
readonly run: (ticketId: string | undefined) => Promise<TResult>
```

This is an open question — see §8 Q2.

### 5.5 Dev call-site

```ts
// packages/dev/src/entrypoints/loop.ts
const graded = await Promise.all(queue.map((t) => gradeReadiness(t)))
const green  = graded.filter((v) => v.overall === 'green').map((v) => v.ticketId)

if (isAfkMode && graded.some((v) => v.overall !== 'green')) {
  await writeReadinessReport(graded)
  if (!isAfkStrict) process.exit(0)
}

const outcome = await executeQueue({
  queue: green,
  run: (ticketId) => runSingleTicket(ticketId!, deps),
  shouldHalt: checkStopCondition,  // imported from dev's phases or re-exported from terminal
  ...
})

await writeRunSummary({ outcome, deferred: [...], failed: [...] })
```

**Wait — `checkStopCondition` stays in terminal but dev needs it?** Yes, and this is a **contradiction in the locked decisions** — see §8 Q3. Either `checkStopCondition` is a pipeline-contract primitive (stays in core or dev, since dev now owns the pipeline) or it's a terminal concern. It cannot be both. My recommendation: **move `checkStopCondition` and `FATAL_ABORT_PHASES` into dev alongside the pipeline, because they know about pipeline phase names which are a pipeline-contract detail.** Locked decision #6 needs revision or clarification. Flagging for DA.

---

## 6. PR-by-PR sequence — refined

I'm expanding the provisional 12 into **16 PRs**. Reasons:

- **PR 2 and PR 3** each move a whole subtree + update imports across the monorepo. Combined with test churn, these are easily L-sized. I'm keeping them as-is but noting the risk.
- **PR 8 (slash command + three-state preflight + single-ticket execute)** is three conceptual changes; splitting into 8a/8b/8c.
- **PR 12** is FOUR conceptual changes (slash command file + bundle + pre-flight batch + artifacts). Splitting into 12a/12b/12c/12d.
- Adding **PR 6.5**: scaffolding the entrypoint file that the bundle will consume, with a no-op main that just prints version. This lets PR 7 validate the bundle works before PR 8 wires real logic.
- Adding a **PR 13**: the DA-caught consolidation. Every phase ends with a docs sweep; Phase E is no exception.

### PR sequence

| # | Title | Size | Risk |
|---|---|---|---|
| 0 | `📝 docs(architecture): lock Cut E schema + no-approve-dev decision` | XS | Low |
| 1 | `📦 chore(dev): scaffold @chief-clancy/dev package skeleton` | S | Low |
| 2 | `♻️ refactor(dev): move lifecycle modules from core → dev` | L | **Medium** |
| 3 | `♻️ refactor(dev): move pipeline + phases from core → dev` | L | **Medium** |
| 4 | `♻️ refactor(dev): move buildPipelineDeps factory from terminal → dev` | M | Low |
| 5 | `🔥 chore(core): delete empty core/dev/ + update re-exports + eslint boundaries` | S | Low |
| 6 | `📦 chore(dev): scaffold installer infrastructure (bin/install.ts/tests)` | M | Low |
| 6.5 | `✨ feat(dev): no-op entrypoint that prints version (prep for bundle)` | XS | Low |
| 7 | `📦 chore(dev): esbuild config + clancy-dev.js bundle + installer copies it` | M | **Medium** |
| 8a | `✨ feat(dev): three-state install preflight (standalone/standalone+board/terminal)` | S | Low |
| 8b | `✨ feat(dev): /clancy:dev slash command + workflow markdown` | S | Low |
| 8c | `✨ feat(dev): single-ticket executor wires runImplement through bundle (Cut B complete)` | M | **Medium** |
| 9 | `✨ feat(dev): readiness subagent prompt (readiness.md) + zod/mini verdict parser` | M | Low |
| 10 | `✨ feat(dev): wire readiness subagent into /clancy:dev Step 1 + --bypass-readiness flag (Cut C complete)` | M | **Medium** |
| 11 | `♻️ refactor(terminal,dev): extract executeQueue primitive from terminal autopilot` | M | **High** |
| 12a | `✨ feat(dev): /clancy:dev --loop slash command + loop entrypoint skeleton` | S | Low |
| 12b | `✨ feat(dev): clancy-dev-autopilot.js bundle` | S | Low |
| 12c | `✨ feat(dev): pre-flight batch + readiness-report.md writer` | M | Low |
| 12d | `✨ feat(dev): AFK behaviour matrix + deferred.json + run-summary.md (Cut D complete)` | M | **Medium** |
| 13 | `📝 docs: Phase E phase summary + PROGRESS.md + package-evolution.md update` | S | Low |

**16 PRs total (including 0, 6.5, 8a/b/c, 12a/b/c/d, 13).**

### Per-PR detail

#### PR 0 — Document Cut E schema + no-approve-dev

- **Touches:** `docs/decisions/architecture/package-evolution.md` only (+~80 lines)
- **Does:** Locks frontmatter schema (id/title/status/type/package/created/priority/dependencies/acceptance/estimate_loops), body sections (Description/Acceptance Criteria/Implementation Plan/Implementation Notes/Final Summary), `dependencies` (not `blocked_by`), path (`.clancy/tickets/<id>-<slug>.md`). Locks "no `/clancy:approve-dev`" next to the implement-from precedent.
- **Does NOT:** create any ticket files, change any code.
- **Tests:** docs-only; no test changes.
- **Deps:** none.
- **Risk:** low — docs only, but the stale-forward-reference sweep must run per [`docs/DA-REVIEW.md:62`](docs/DA-REVIEW.md) and both regexes must cover the new prose.

#### PR 1 — Scaffold `packages/dev/`

- **Touches:** `packages/dev/package.json` (new), `packages/dev/tsconfig.json` (new), `packages/dev/tsconfig.build.json` (new), `packages/dev/vitest.config.ts` (new), `packages/dev/src/index.ts` (empty barrel: `export const PACKAGE_NAME = '@chief-clancy/dev' as const`), `packages/dev/README.md` (new), `.changeset/*.md` (new), `pnpm-workspace.yaml` (already includes `packages/*` — verify, not edit), `turbo.json` (pipeline tasks), `knip.json` (ignore patterns), `tsconfig.json` root path alias `~/d/` → `packages/dev/src/*`.
- **Does:** creates an empty installable package with the standard build/test/lint scripts. Mirror brief/plan's package.json structure.
- **Does NOT:** move any source code.
- **Tests:** `pnpm test --filter @chief-clancy/dev` must pass (empty success).
- **Deps:** PR 0.
- **Risk:** low — pattern already proven twice (brief, plan).

#### PR 2 — `git mv` lifecycle

- **Touches:** `git mv packages/core/src/dev/lifecycle packages/dev/src/lifecycle` (19 subdirs × ~5 files each = ~95 files). Import rewrites across the monorepo wherever `from '@chief-clancy/core'` imported lifecycle symbols. `packages/core/src/index.ts` loses ~30 re-exports. `packages/dev/src/index.ts` gains them.
- **Does:** preserves git blame via `git mv`. Every lifecycle export now lives in dev.
- **Does NOT:** touch pipeline, touch terminal's `buildPipelineDeps`, delete `core/src/dev/` (still has pipeline).
- **Tests:** all 41 test files move with their subjects. `pnpm test` baseline should hold (1608 core → ~750 core + ~850 dev, roughly).
- **Deps:** PR 1.
- **Risk:** **medium** — large mechanical change, many imports. Biggest risk: missing a transitive re-export. Mitigation: run `pnpm typecheck` inside the branch after each subdirectory move and before opening the PR. Architectural review must run the post-restructure sweep per [`docs/DA-REVIEW.md:55`](docs/DA-REVIEW.md).

#### PR 3 — `git mv` pipeline

- **Touches:** `git mv packages/core/src/dev/pipeline packages/dev/src/pipeline`. Import rewrites. `core/src/index.ts` loses pipeline re-exports. `dev/src/index.ts` gains them.
- **Does:** pipeline + phases + `run-pipeline.ts` + `context.ts` all in dev.
- **Does NOT:** move `buildPipelineDeps`, delete `core/src/dev/` (still has README + possibly lifecycle/pipeline leftovers).
- **Tests:** baseline holds.
- **Deps:** PR 2.
- **Risk:** **medium** — same shape as PR 2.

#### PR 4 — Move `buildPipelineDeps` factory

- **Touches:** `packages/terminal/src/runner/dep-factory/` → `packages/dev/src/dep-factory/`. `runImplement` and `runAutopilot` update their import from `../dep-factory/index.js` to `@chief-clancy/dev`. The factory's `cli-bridge` import (for `invokeClaudePrint`) stays as a terminal import — **but dev cannot import from terminal**. This means `makeInvokePhase` either (a) stays in terminal and dev's factory takes it as an injected dep, or (b) moves with the factory and `invokeClaudePrint` becomes a dev concern.
- **Resolution:** **inject `invokeClaudePrint` into `buildPipelineDeps`.** dep-factory currently hardcodes `import { invokeClaudePrint } from '../cli-bridge/index.js'` (line 69) and calls it inside `wireTicketPhases` (line ~257). The factory signature gains an `invokePrint: InvokePrintFn` field; terminal passes its cli-bridge version; dev's bundle passes one of its own (probably an alias import from terminal's cli-bridge via a dist path — this needs verification). See §8 Q4.
- **Does NOT:** move `cli-bridge`, `notify`, or any terminal-runtime-only code.
- **Tests:** dep-factory tests move. invoke-phase test moves if invoke moves.
- **Deps:** PR 3.
- **Risk:** low, contingent on Q4 resolution.

#### PR 5 — Delete empty `core/dev/` + ESLint boundary

- **Touches:** `rm -rf packages/core/src/dev/`, `packages/core/src/index.ts` (remove the `export * from './dev/...'` block entirely), `eslint.config.ts:32-113` (add `dev` element + rules), `knip.json` (add dev to workspaces), `turbo.json` (add dev to pipeline graph if not already there via `packages/*`).
- **Does:** core becomes dev-free. ESLint enforces the new boundary. `pnpm lint` must pass.
- **Does NOT:** touch anything else.
- **Tests:** baseline.
- **Deps:** PR 4.
- **Risk:** low — mechanical.

#### PR 6 — Scaffold installer infrastructure

- **Touches:** `packages/dev/bin/dev.js` (new, CommonJS-hostile ESM CLI like `brief/bin/brief.js`), `packages/dev/src/installer/install.ts` (new, pure functions like `brief/src/installer/install.ts`), `packages/dev/src/installer/install.test.ts` (new), `packages/dev/package.json` adds `"bin": { "@chief-clancy/dev": "./bin/dev.js" }` and `"files"` list.
- **Does:** installer infrastructure, zero commands yet. Pure file-copy scaffolding + symlink rejection + VERSION.dev marker.
- **Does NOT:** copy any command files (none exist yet), copy any bundle (none exists yet). The installer has NO-OP file lists.
- **Tests:** `install.test.ts` covers parseFlag, resolvePaths, rejectSymlink, empty-copy happy path.
- **Deps:** PR 5.
- **Risk:** low — pattern proven by brief/plan.

#### PR 6.5 — No-op entrypoint

- **Touches:** `packages/dev/src/entrypoints/dev.ts` (new: `console.log('clancy-dev v' + version); process.exit(0)`), `packages/dev/src/entrypoints/loop.ts` (new: same shape).
- **Does:** gives PR 7 a stable target for the esbuild config.
- **Does NOT:** do anything useful.
- **Tests:** none (entrypoints are bundled, not unit tested).
- **Deps:** PR 6.
- **Risk:** low.

#### PR 7 — esbuild config + bundles

- **Touches:** `packages/dev/src/esbuild.runtime.ts` (new, cloned from `packages/terminal/src/runner/esbuild.runtime.ts` with the same zod-locale stub plugin), `packages/dev/package.json` `scripts.build` chain (tsc → tsc-alias → esbuild), installer's file list now includes `dist/bundle/clancy-dev.js` and `dist/bundle/clancy-dev-autopilot.js` as copy targets into `.clancy/`.
- **Does:** `pnpm --filter @chief-clancy/dev build` produces two bundles. `npx @chief-clancy/dev` copies them into `.clancy/`.
- **Does NOT:** wire them into any slash command yet (PR 8).
- **Tests:** installer test gains a bundle-copy happy-path case. E2E smoke: run bundle, see version line.
- **Deps:** PR 6.5.
- **Risk:** **medium** — esbuild configs drift across packages. The terminal's esbuild must NOT be deleted in this PR (terminal still uses it for `clancy-implement.js`). Dead-code hygiene per [`docs/DA-REVIEW.md:82`](docs/DA-REVIEW.md): list the terminal bundles that now have a duplicate-in-dev and explicitly note them as "kept intentionally until cut-over".

#### PR 8a — Three-state install preflight

- **Touches:** `packages/dev/src/installer/preflight.ts` (new), `preflight.test.ts` (new), `install.ts` gains a preflight call.
- **Does:** standalone / standalone+board / terminal classification, reusing the env probes pattern from `approve-plan`/`approve-brief`. See [`packages/plan/src/workflows/approve-plan.md`](packages/plan/src/workflows/approve-plan.md) Step 1.
- **Does NOT:** any slash command wiring.
- **Tests:** three-state preflight matrix, four cases (no-env / env-only / env+board / env+board+terminal-markers).
- **Deps:** PR 7.
- **Risk:** low — proven pattern.

#### PR 8b — `/clancy:dev` slash command + workflow markdown

- **Touches:** `packages/dev/src/commands/dev.md` (new), `packages/dev/src/workflows/dev.md` (new), installer `COMMAND_FILES` list gains `dev.md`.
- **Does:** writes the slash command that shells to `node .clancy/clancy-dev.js {ticket}`.
- **Does NOT:** implement the executor (PR 8c), the readiness gate (PR 10), or the loop (PR 12).
- **Tests:** installer test confirms `dev.md` is copied.
- **Deps:** PR 8a.
- **Risk:** low.

#### PR 8c — Single-ticket executor (Cut B complete)

- **Touches:** `packages/dev/src/entrypoints/dev.ts` (replaces the no-op from PR 6.5), `packages/dev/src/execute/single.ts` (new: wraps `runImplement` from dev's own factory path), tests.
- **Does:** `/clancy:dev TICKET-123` actually runs the pipeline for one ticket via the bundle. Cut B criterion met.
- **Does NOT:** grade readiness (PR 10), loop (PR 12).
- **Tests:** integration test that spawns the bundle with a mock pipeline dep set and asserts it runs one iteration.
- **Deps:** PR 8b.
- **Risk:** **medium** — first real end-to-end test of the new bundle shape.

#### PR 9 — Readiness subagent prompt + verdict parser

- **Touches:** `packages/dev/src/agents/readiness.md` (new, ~200 lines), `packages/dev/src/agents/types.ts` (new, `ReadinessVerdict` zod/mini parser + type), `packages/dev/src/agents/parse-verdict.ts` (new, `safeParseVerdict(text)` that extracts the JSON block and validates), tests.
- **Does:** ships the rubric + the parser. The agent can be invoked but isn't wired yet.
- **Does NOT:** wire into the executor.
- **Tests:** schema-pair check between `ReadinessCheckId` union and the ids listed in `readiness.md` (parse the markdown in the test). Parser tests for malformed JSON, missing fields, wrong colour values.
- **Deps:** PR 8c.
- **Risk:** low but the schema-pair check is load-bearing — failing to add it is exactly the failure mode in [`docs/DA-REVIEW.md:51`](docs/DA-REVIEW.md).

#### PR 10 — Wire readiness subagent + `--bypass-readiness` (Cut C complete)

- **Touches:** `packages/dev/src/execute/single.ts` (gains a grade step before run), `packages/dev/src/agents/invoke.ts` (new: calls Claude Code Task tool to spawn the subagent), refusal output format, `--bypass-readiness` flag parser.
- **Does:** `/clancy:dev TICKET-123` grades first, refuses with structured output if red. Interactive mode asks the question inline.
- **Does NOT:** loop (PR 12).
- **Tests:** green → runs, yellow → re-grades after user input, red → exits 1 with structured output; `--bypass-readiness` skips grading.
- **Deps:** PR 9.
- **Risk:** **medium** — first subagent wiring from a bundled context. If the Task tool isn't available inside a bundled runtime (it's normally a Claude Code API), this PR surfaces that early. See §8 Q5.

#### PR 11 — Extract `executeQueue`

- **Touches:** `packages/dev/src/queue.ts` (new, generic loop + quiet hours), `packages/dev/src/queue.test.ts` (new), `packages/terminal/src/runner/autopilot/autopilot.ts` becomes a thin wrapper that calls `executeQueue`. `FATAL_ABORT_PHASES` + `checkStopCondition` — per §5.5 Q3 — **I recommend they move to dev** alongside the pipeline, exported, and terminal imports them.
- **Does:** terminal autopilot gets shorter; dev owns the loop primitive.
- **Does NOT:** add any new features.
- **Tests:** queue tests for quiet hours (existing terminal tests migrate), queue-length vs max-iterations, halt propagation, the new `queue?: readonly string[]` option (C).
- **Deps:** PR 10.
- **Risk:** **HIGH** — refactoring a load-bearing primitive that terminal autopilot depends on, plus the contradiction in locked decision #6 must be resolved before this PR can ship. DA should grill the `queue?` vs two-entry-points vs generic `<T>` decision here.

#### PR 12a — Loop slash command + loop entrypoint skeleton

- **Touches:** `packages/dev/src/commands/dev-loop.md` (new), `packages/dev/src/workflows/dev-loop.md` (new), `packages/dev/src/entrypoints/loop.ts` (replaces no-op). Installer copies the new command file.
- **Does:** the slash command exists and the entrypoint can be invoked.
- **Does NOT:** pre-flight, AFK, or artifacts yet.
- **Tests:** installer test gains dev-loop.md, smoke test for bundle invocation.
- **Deps:** PR 11.
- **Risk:** low.

#### PR 12b — Autopilot bundle

- **Touches:** `packages/dev/src/esbuild.runtime.ts` already configured the bundle in PR 7; PR 12b activates it by making sure the entrypoint now pulls in `executeQueue` and the readiness parser. Installer copies `clancy-dev-autopilot.js`.
- **Does:** second bundle ships alongside the installer.
- **Does NOT:** wire behaviours.
- **Tests:** installer test for the bundle-copy case.
- **Deps:** PR 12a.
- **Risk:** low.

#### PR 12c — Pre-flight batch + `readiness-report.md`

- **Touches:** `packages/dev/src/artifacts/readiness-report.ts` (new, markdown writer), `packages/dev/src/execute/preflight-batch.ts` (new: grades all tickets, groups into buckets), `loop.ts` entrypoint wires it in.
- **Does:** `--loop --afk` grades everything and writes the report.
- **Does NOT:** execute (still halts after pre-flight if non-green). The `--afk-strict` path doesn't exist yet.
- **Tests:** writer tests (exact frontmatter format, bucket ordering, empty-bucket handling), batch grader test with a mix of colours.
- **Deps:** PR 12b.
- **Risk:** low.

#### PR 12d — AFK matrix + deferred.json + run-summary.md (Cut D complete)

- **Touches:** `packages/dev/src/artifacts/deferred.ts` (new), `packages/dev/src/artifacts/run-summary.ts` (new), `packages/dev/src/execute/afk-strict.ts` (new), loop.ts wires the full matrix. Mid-loop discovery: the queue's `run` callback inspects the result and, if feasibility reported ambiguity, records a deferral and continues.
- **Does:** all four modes work (interactive / afk / afk-strict / mid-loop). Every run writes `run-summary.md`. Strict mode writes `deferred.json` up-front; mid-loop appends to it.
- **Does NOT:** introduce any new runtime code edits for rubric changes (per iteration-friendly constraint).
- **Tests:** table-driven test across the four modes, each asserting the correct exit code and which artifacts are written. Mid-loop discovery test with a synthetic result that reports ambiguity.
- **Deps:** PR 12c.
- **Risk:** **medium** — the mid-loop discovery path is easy to get wrong. Specifically, "the queue continues" vs "the queue halts" must be tested with a 3-ticket queue where ticket 2 discovers mid-loop and ticket 3 still runs.

#### PR 13 — Docs sweep + PROGRESS.md

- **Touches:** `PROGRESS.md` (Phase E row → done), `docs/decisions/architecture/package-evolution.md` (dev now exists — update build order row), package READMEs for dev/core/terminal.
- **Does:** closes the phase.
- **Does NOT:** ship code.
- **Tests:** docs only.
- **Deps:** PR 12d.
- **Risk:** low but the stale-forward-reference sweep must run across every touched file per [`docs/DA-REVIEW.md:62`](docs/DA-REVIEW.md).

---

## 7. Dependency graph

```
PR 0 ──► PR 1 ──► PR 2 ──► PR 3 ──► PR 4 ──► PR 5 ──► PR 6 ──► PR 6.5 ──► PR 7
                                                                           │
                                                                           ▼
                                                              PR 8a ──► PR 8b ──► PR 8c
                                                                                   │
                                                                                   ▼
                                                                                PR 9
                                                                                   │
                                                                                   ▼
                                                                                PR 10 (Cut C done)
                                                                                   │
                                                                                   ▼
                                                                                PR 11
                                                                                   │
                                                                                   ▼
                                                                             PR 12a ──► 12b ──► 12c ──► 12d (Cut D done)
                                                                                                               │
                                                                                                               ▼
                                                                                                            PR 13
```

**No parallelism.** Every PR depends on the previous one via import graph or by wiring into a surface the previous PR created. The only PR that could theoretically parallel is PR 9 (readiness.md authoring) which has no code deps on PR 8a/b/c — but the review chain forces sequential landing.

---

## 8. Open questions

**Q1 — Rubric drift on mid-loop rubric upgrade.** If someone edits `readiness.md` while a loop is running, tickets graded early get one rubric, tickets graded late get another. Options: (a) hash rubric once at loop start and refuse to re-read mid-loop; (b) re-hash per-ticket and warn; (c) hard-fail on drift. I lean (a). DA: is this over-engineering? Does the scenario even happen in practice since the bundle is a frozen snapshot?

**Q2 — `executeQueue` signature: generic `<T>`, two entry points, or `queue?`.** §5.5 option (C) is my recommendation. DA should grill whether the two-mode nature of the loop (fixed-count for terminal, addressed for dev) justifies two functions instead of one conditional.

**Q3 — Contradiction in locked decision #6.** Decision says "`FATAL_ABORT_PHASES` and `checkStopCondition()` stay in terminal (pipeline-contract, not loop-contract)". But phase names ARE pipeline contract, and the pipeline is moving to dev. If terminal still owns them, terminal has to know about dev's phase name strings — a coupling the extraction was supposed to eliminate. **Recommendation: move both to dev.** This contradicts the locked decision; flagging for the user to re-decide before PR 11 ships.

**Q4 — `invokeClaudePrint` ownership.** PR 4's dep-factory move hits the boundary rule: dev cannot import from terminal. The factory currently uses `invokeClaudePrint` from terminal's `cli-bridge`. Options: (a) inject as a dep (cleanest), (b) move `cli-bridge` to dev too (expands PR 4 scope), (c) extract a tiny shared `invoke` module into core (adds a core dep). I lean (a). DA: is the closure-injection surface acceptable or does it obscure the contract?

**Q5 — Subagent invocation from a bundled runtime.** Does the Claude Code Task tool work when the code calling it is running inside `node .clancy/clancy-dev.js`, or is the Task tool only available inside the Claude Code harness itself? If the latter, the readiness subagent must be invoked by the slash command's markdown workflow (which runs inside the harness), not by the bundle (which runs outside). That changes the architecture: the bundle becomes the executor, the slash command markdown is the grader-invoker. **This is a show-stopper risk for PR 10** and must be verified before PR 9 ships. DA: verify this against how `/clancy:brief --afk` currently spawns `devils-advocate.md`.

**Q6 — Bundle deduplication with terminal.** Phase E leaves terminal shipping its own `clancy-implement.js` and `clancy-autopilot.js` while dev ships `clancy-dev.js` and `clancy-dev-autopilot.js`. That's two near-identical bundles per loop. Is Phase E the right time to delete the terminal bundles and have terminal depend on dev's, or does that violate the NOTICED-BUT-NOT-TOUCHING rule? I lean "leave them, NOTICED-BUT-NOT-TOUCHING, sweep in Phase F or G".

**Q7 — Where does `checkStopCondition` actually get called from the dev loop entrypoint?** If it moves to dev, it's fine. If it stays in terminal, dev's loop must inject it as a dep from outside — but dev's bundle doesn't import from terminal. This is the same shape as Q3 but concretised at the call-site. Resolved by Q3.

**Q8 — Ticket fetcher in dev.** The current pipeline `ticketFetch` phase pulls the next ticket from the board inside `runImplement`. For `/clancy:dev TICKET-123` with an explicit id, the phase should pick THAT ticket, not "next from queue". Does the existing phase support explicit-id mode or does PR 8c need to add it? Read `packages/core/src/dev/pipeline/phases/ticket-fetch/` to verify before PR 8c — this is an Assumption-I'm-Making-Surface per [`docs/DEVELOPMENT.md:115`](docs/DEVELOPMENT.md). Flagging.

---

## 9. Risks (top 5)

1. **Q3 contradiction unresolved → PR 11 blocked or ships wrong.** Locked decision #6 says one thing, the extraction physics say another. Must be re-decided by the user BEFORE PR 11. **Mitigation:** resolve Q3 during DA review of this plan, not during PR 11 implementation.

2. **Subagent cannot be invoked from a bundled runtime (Q5).** If the Task tool is harness-only, PR 10's architecture is wrong and the entire readiness gate becomes a slash-command-workflow concern, not a bundle concern. **Mitigation:** smoke-test this between PR 8c and PR 9 — write a 10-line script that tries to spawn a subagent from inside a bundle and see what happens. If it fails, the bundle becomes "execute only" and the slash command markdown becomes "grade then invoke execute" — a significant architecture shift.

3. **`buildPipelineDeps` import graph pulls terminal-only I/O into dev.** The current factory uses `invokeClaudePrint` (terminal `cli-bridge`), `sendNotification` (terminal `notify`). If ALL of those have to move, PR 4 balloons from M to L/XL. **Mitigation:** inject them as deps (Q4 option a) — keeps PR 4 small but shifts the complexity to the call-sites.

4. **PR 2 and PR 3 large mechanical moves miss a transitive re-export.** ~95 files moved per PR, ~40 tests, dozens of import paths. A missed re-export surfaces as a `pnpm typecheck` failure in an unrelated file. **Mitigation:** (i) per-subdir incremental moves inside the PR branch with typecheck between each, (ii) architectural review runs the post-restructure sweep with the specific concept set "lifecycle", "pipeline", "phase", "dev/", (iii) `pnpm publint` + `pnpm attw` catch public API breaks.

5. **AFK behaviour matrix has an untested state transition.** The mid-loop discovery path ("green ticket turns yellow during execution, defer and continue") is a state transition that spans two subsystems (pipeline result interpretation + deferred.json writer). PR 12d's table-driven tests must cover a 3-ticket queue where ticket 2 discovers and ticket 3 still executes. **Mitigation:** explicit test case in PR 12d; if the test is hard to write, the architecture is hard to use.

---

## 10. Validation criteria

Phase E is complete when ALL of the following hold:

- [ ] `pnpm test` passes with counts approximately: core ~750 / terminal ~650 / brief 73 / plan 264 / **dev ~1100** = ~2837 total (baseline +~54 for readiness, queue, artifacts, and new installer tests).
- [ ] `pnpm lint` passes with the new `dev` boundary rule enforced.
- [ ] `pnpm typecheck && pnpm format:check && pnpm knip && pnpm publint && pnpm attw` all green.
- [x] `packages/core/src/dev/` directory does not exist.
- [ ] `packages/dev/` exists with `src/lifecycle/`, `src/pipeline/`, `src/dep-factory/`, `src/queue.ts`, `src/agents/readiness.md`, `src/installer/`, `bin/dev.js`, `dist/bundle/clancy-dev.js`, `dist/bundle/clancy-dev-autopilot.js`.
- [ ] `@chief-clancy/dev` is published at `0.1.0` on npm (dry-run via changeset at minimum).
- [ ] `npx @chief-clancy/dev --local` installs `/clancy:dev` and `/clancy:dev --loop` slash commands + both bundles into `.clancy/`.
- [ ] `/clancy:dev TICKET-123` against a test ticket: grades → refuses on red / runs on green.
- [ ] `/clancy:dev --loop --afk` on a mixed queue: writes `.clancy/readiness-report.md` with correct buckets, halts with exit 0.
- [ ] `/clancy:dev --loop --afk --afk-strict` on the same queue: writes `deferred.json` for yellow, executes green, writes `run-summary.md`.
- [ ] `terminal/src/runner/autopilot/autopilot.ts` imports `executeQueue` from `@chief-clancy/dev` and is materially shorter than today.
- [ ] `terminal` test suite still passes with no behaviour changes (terminal autopilot is a thin wrapper, its externally observable behaviour is identical).
- [ ] `PROGRESS.md` Phase E row marked done; `docs/decisions/architecture/package-evolution.md` updated to reflect dev existing.
- [ ] No new entries in CLAUDE.md (executable-contract-bloat constraint held).
- [ ] `docs/RATIONALIZATIONS.md` gains any new self-deceptions caught during Phase E (if any — lessons-out, not lessons-in).

---

### Critical files for implementation

- `/Users/alexclapperton/Desktop/alex/@chief-clancy/packages/dev/src/pipeline/run-pipeline.ts`
- `/Users/alexclapperton/Desktop/alex/@chief-clancy/packages/dev/src/dep-factory/dep-factory.ts`
- `/Users/alexclapperton/Desktop/alex/@chief-clancy/packages/terminal/src/runner/autopilot/autopilot.ts`
- `/Users/alexclapperton/Desktop/alex/@chief-clancy/packages/terminal/src/runner/esbuild.runtime.ts`
- `/Users/alexclapperton/Desktop/alex/@chief-clancy/eslint.config.ts`
- `/Users/alexclapperton/Desktop/alex/@chief-clancy/packages/brief/src/installer/install.ts` (template for PR 6)
- `/Users/alexclapperton/Desktop/alex/@chief-clancy/packages/brief/src/agents/devils-advocate.md` (template for PR 9)
- `/Users/alexclapperton/Desktop/alex/@chief-clancy/docs/decisions/architecture/package-evolution.md` (PR 0 + PR 13)# Phase E Plan v2 — Deltas on top of `/tmp/phase-e-plan.md` (v1)

**Status:** DRAFT for DA round 2 sanity-check
**Date:** 2026-04-10
**Based on:** v1 plan + DA round 1 findings (3 parallel agents) + user decisions D1-D8
**Scope unchanged:** Cut D — extraction + standalone installer + runtime bundle + `/clancy:dev {ticket}` + 5-check readiness gate (was 6) + autopilot loop + AFK behavior matrix.

This document only describes **what changes from v1**. Anything not mentioned here is unchanged from v1. Read v1 first, then this.

---

## 1. User decisions locked (D1-D8)

| ID | Decision | Resolution |
|---|---|---|
| **D1** | Revise locked decision #6 (move `FATAL_ABORT_PHASES` + `checkStopCondition` to dev) | ✅ YES. PR 0 explicitly rewrites the locked decision. PR 11c moves them as a straight refactor. |
| **D2** | Q5 — spike vs commit to `spawn('claude', '-p', ...)` from bundle | ✅ **Commit upfront to spawn-based grading.** DA1 verified zero precedent for harness Agent tool from a bundled runtime via grep + reading `packages/brief/src/workflows/brief.md:579`. The spike has a known answer; running it is risk theatre. Dev's readiness subagent reuses the `cli-bridge` `invokeClaudePrint` pattern (which is moving to dev in PR 4a). Each grade = a fresh `claude -p --dangerously-skip-permissions` subprocess with the rubric + ticket as stdin. Stateless rubric grading doesn't need Agent-tool isolation. |
| **D3** | PR 4 scope — wholesale move vs inject | ✅ **Wholesale move.** `cli-bridge`, `notify`, `invoke-phase`, `deliver-phase` all relocate from `packages/terminal/src/runner/` to `packages/dev/src/`. Cohesion: invoking Claude IS dev's lifecycle, not downstream consumption. PR 4 splits into **PR 4a / 4b / 4c** (see §2). |
| **D4** | Q8 — `fetchTicketByKey` vs pre-seed `ctx.ticket` | ✅ **Pre-seed `ctx.ticket` from entrypoint.** The existing `if (!ctx.ticket)` guard at [ticket-fetch.ts:68-72](packages/dev/src/pipeline/phases/ticket-fetch/ticket-fetch.ts#L68) already supports this. The dev entrypoint hydrates `FetchedTicket` from a one-shot board lookup (NOT through the pipeline) and pre-populates `ctx.ticket` before calling `runPipeline`. The `ticketFetch` phase becomes a no-op for pre-seeded contexts. Cut F/G can promote to `fetchTicketByKey` uniformly later if a consumer demands it. |
| **D5** | Mid-loop discovery — cut or add pipeline-contract change | ✅ **CUT from Phase E.** DA3 verified by reading `packages/dev/src/pipeline/phases/feasibility/feasibility.ts:21-31` — the phase returns binary `{ feasible: boolean }` with no ambiguous third state. Adding a third state is hidden pipeline-contract scope creep. Pre-flight batch + AFK-strict covers the headline UX promise. Mid-loop becomes a Phase F enhancement. PR 12d's scope shrinks significantly. |
| **D6** | Replace `Calibrated` with `Touch-bounded` | ✅ YES. Literature backing (Tian 2023 [arxiv:2305.14975], Xiong 2024 [arxiv:2306.13063]) — LLM self-reported confidence is systematically overconfident; `<0.7` threshold essentially never fires. Touch-bounded asks the subagent to enumerate expected file paths. Concrete, ungameable, and the file list becomes evidence the executor uses at runtime for drift detection. |
| **D7** | `Independent` check in Phase E — stub or cut | ✅ **CUT entirely.** Depends on Cut E's `dependencies` frontmatter field. A no-op stub returning green is confusing noise. Phase E ships **5 checks**: Clear / Testable / Small / Locatable / Touch-bounded. Cut E adds `Independent` when the data exists. |
| **D8** | Yellow aggregation: `yellowCount ≥ 3 → red`, tunable via rubric constant | ✅ YES. Threshold is a top-level constant in `readiness.md` so Alex can tune without code changes. |

---

## 2. Revised PR sequence — 26 PRs, all S/M

### Delta summary vs v1

- **New PRs**: 1.5 (eslint boundary), 4a/4b/4c (cli-bridge+notify / invoke-phase / deliver-phase+dep-factory), 13.5 (private→public flip + publish changeset)
- **Split PRs**: 2 → 2a/2b/2c, 3 → 3a/3b, 11 → 11a/11b/11c
- **Folded**: 12b into 12a (PR 12b was a 5-line no-op in v1)
- **Removed scope**: PR 12d loses mid-loop discovery, PR 9 loses `Independent` check, readiness rubric drops from 6 checks to 5

### Full revised sequence

| # | Title | Size | Depends | Risk |
|---|---|---|---|---|
| **0** | `📝 docs(architecture): lock Cut E schema + no-approve-dev + decision #6 revision + Q5/Q8 resolution + no mid-loop discovery` | XS | — | Low |
| **1** | `📦 chore(dev): scaffold @chief-clancy/dev package skeleton (private:true, 0.0.0, empty)` | S | 0 (can parallel) | Low |
| **1.5** | `🔒 chore(eslint): add dev boundary rule + knip.json workspaces entry` | XS | 1 | Low |
| **2a** | `♻️ refactor(dev): move lifecycle cluster 1 (branch, commit-type, format, cost, lock, preflight)` | S/M | 1.5 | Low |
| **2b** | `♻️ refactor(dev): move lifecycle cluster 2 (fetch-ticket, feasibility, quality, progress, outcome, resume, rework)` | M | 2a | Low |
| **2c** | `♻️ refactor(dev): move lifecycle cluster 3 (deliver-ticket, deliver-epic, epic, pr-creation, pull-request)` | M | 2b | Low |
| **3a** | `♻️ refactor(dev): move pipeline infrastructure (run-pipeline, context, index, test-helpers, dry-run, lock-check, preflight-phase)` | S/M | 2c | Low |
| **3b** | `♻️ refactor(dev): move remaining pipeline phases (branch-setup, ticket-fetch, feasibility, cost, transition, cleanup, deliver, epic-completion, pr-retry, rework-detection)` | M | 3a | Low |
| **4a** | `♻️ refactor(dev): move cli-bridge + notify from terminal → dev` | S | 3b | Low |
| **4b** | `♻️ refactor(dev): move invoke-phase from terminal dep-factory → dev` | S | 4a | Low |
| **4c** | `♻️ refactor(dev): move deliver-phase + dep-factory from terminal → dev (buildPipelineDeps now in dev)` | M | 4b | Medium |
| **5** | `🔥 chore(core): delete empty core/dev/ + prune core/index.ts re-exports (dev-free core)` | S | 4c | Low |
| **6** | `📦 chore(dev): scaffold installer infrastructure (bin/dev.js, install.ts pure fns, install.test.ts)` | M | 5 | Low |
| **6.5** | `✨ feat(dev): no-op entrypoints (dev.ts, loop.ts) printing version — bundle target prep` | XS | 6 | Low |
| **7** | `📦 chore(dev): esbuild config + clancy-dev.js + clancy-dev-autopilot.js bundles + installer copies them` | M | 6.5 | Medium |
| **8a** | `✨ feat(dev): three-state install preflight (standalone/standalone+board/terminal)` | S | 7 | Low |
| **8b** | `✨ feat(dev): /clancy:dev {ticket} slash command + workflow markdown (shells to clancy-dev.js)` | S | 8a | Low |
| **8c** | `✨ feat(dev): single-ticket executor with pre-seeded ctx.ticket + Cut B acceptance test` | M | 8b | Medium |
| **9** | `✨ feat(dev): readiness.md rubric (5 checks) + zod/mini verdict parser + schema-pair test + rubric-fitness fixture test` | M | 8c | Low |
| **10** | `✨ feat(dev): wire spawn-based readiness grading into /clancy:dev (interactive + --bypass-readiness) + Cut C acceptance test` | M | 9 | Medium |
| **11a** | `✨ feat(dev): executeQueue + executeFixedCount primitives in dev (two entry points, opaque run/shouldHalt)` | M | 10 | Low |
| **11b** | `♻️ refactor(terminal): migrate autopilot to use executeFixedCount from @chief-clancy/dev (thin wrapper)` | S | 11a | Medium |
| **11c** | `♻️ refactor(dev): move FATAL_ABORT_PHASES + checkStopCondition from terminal → dev` | S | 11b | Low |
| **12a** | `✨ feat(dev): /clancy:dev --loop slash command + loop.ts entrypoint + clancy-dev-autopilot.js activation` | S | 11c | Low |
| **12c** | `✨ feat(dev): pre-flight batch grading + readiness-report.md writer + error matrix (timeout/retry/partial/cap/dedupe/atomic/rotate/mkdir)` | M | 12a | Medium |
| **12d** | `✨ feat(dev): AFK behaviour matrix (interactive/afk/afk-strict) + run-summary.md + deferred.json (afk-strict skip only) + Cut D acceptance test` | M | 12c | Medium |
| **13** | `📝 docs: Phase E phase summary + PROGRESS.md update + package-evolution.md build-order row` | S | 12d | Low |
| **13.5** | `📦 chore(dev): flip private:true → false + changeset bumping to 0.1.0 + publint/attw green` | XS | 13 | Low |

**Total: 26 PRs.** All S or M. Zero L. Zero XL.

---

## 3. Section-level deltas on v1

### §2.2 — ESLint boundary rules

v1 said "add `from: wrapper → allow: [wrapper, terminal, plan, dev]`". **Drop the wrapper → dev rule.** YAGNI — no code in the plan makes the wrapper consume dev. Add it when a concrete need appears.

**PR 5 must explicitly list all 6 existing package types** (core, brief, plan, terminal, chat, wrapper) and show exact before/after of the `boundaries/dependencies` rules array. v1 said "add a new element" which is not sufficient — DA1 caught that the existing `chat` rule could be clobbered.

### §3 — Readiness gate spec (major rewrite)

**Drop from 6 checks to 5.** The 5 checks are:

1. **Clear** — unchanged from v1, but tightened to not overlap with Testable (see below)
2. **Testable** — unchanged from v1
3. **Small** — unchanged from v1
4. **Locatable** — **changed**: grep terms are now supplied by the executor (loaded from the ticket body + any explicit file paths in the description), NOT chosen by the subagent. This prevents the self-justifying check DA3 flagged.
5. **Touch-bounded** (NEW, replaces Calibrated) — subagent must enumerate the file paths it expects the ticket to modify. Verdict: green = concrete non-empty list; yellow = vague list (directory names only, <2 concrete paths); red = cannot name any files. **The file list is captured in the verdict and becomes evidence the executor uses at runtime for drift detection** (if the executor touches files outside the declared set, that's interesting — logged, not fatal, in Phase E).

**Cut:** `Independent` — deferred to Cut E when the `dependencies` frontmatter field ships.

**Clear ↔ Testable disambiguation:**
- Clear asks: "can I restate the goal in one sentence?" (intent clarity)
- Testable asks: "does ≥1 concrete verifiable signal exist?" (success definition)
A ticket can be Clear but not Testable ("make the loader faster" — clear intent, no threshold) and vice versa ("assert fn X returns 42" — testable but unclear why). The rubric must give explicit disambiguation examples so two graders reach the same verdict.

### §3.2 — Per-check failure-mode JSON (new `Touch-bounded` entry)

```
{
  "id": "touch-bounded",
  "verdict": "red",
  "reason": "Subagent could not name any files expected to be modified. Ticket describes a cross-cutting concern without a concrete surface.",
  "evidence": {
    "id": "touch-bounded",
    "expectedFiles": [],
    "confidence": "low"
  }
}
```

Green example:
```
{
  "id": "touch-bounded",
  "verdict": "green",
  "reason": "Subagent identified 3 concrete files the change will touch.",
  "evidence": {
    "id": "touch-bounded",
    "expectedFiles": [
      "packages/terminal/src/installer/hook-installer/hook-installer.ts",
      "packages/terminal/src/installer/manifest/manifest.ts",
      "packages/terminal/src/installer/hook-installer/hook-installer.test.ts"
    ],
    "confidence": "high"
  }
}
```

### §3.3 — `ReadinessVerdict` schema (drop `rubricSha`, add fields, tagged-union evidence)

```ts
type ReadinessCheckId = 'clear' | 'testable' | 'small' | 'locatable' | 'touch-bounded'
type CheckColour      = 'green' | 'yellow' | 'red'

type Evidence =
  | { id: 'clear';         restatement: string }
  | { id: 'testable';      signals: readonly string[] }
  | { id: 'small';         subItemCount: number; reasoning: string }
  | { id: 'locatable';     grepTerms: readonly string[]; hits: number; matchedFiles: readonly string[] }
  | { id: 'touch-bounded'; expectedFiles: readonly string[]; confidence: 'high' | 'medium' | 'low' }

type CheckResult = {
  readonly id:        ReadinessCheckId
  readonly verdict:   CheckColour
  readonly reason:    string
  readonly question?: string              // present when verdict !== 'green'
  readonly evidence:  Evidence             // required, tagged union
}

type ReadinessVerdict = {
  readonly ticketId:        string
  readonly overall:         CheckColour   // worst + yellowCount ≥ 3 promotion rule
  readonly checks:          readonly CheckResult[]
  readonly yellowCount:     number        // top-level for aggregation rule
  readonly gradedAt:        string        // ISO 8601
  readonly agentModel:      string        // "claude-opus-4-6", etc.
  readonly gradingDurationMs: number
  readonly tokensIn?:       number        // optional — spawn-based may not report
  readonly tokensOut?:      number
  readonly repoSha:         string        // git rev-parse HEAD at grading time
}
```

**Dropped:** `rubricSha` (bundle is frozen snapshot; drift is impossible).

**Added:** `agentModel`, `gradingDurationMs`, `tokensIn/Out` (optional), `repoSha`, `yellowCount` (top-level), tagged-union `Evidence`.

### §3.4 — Rubric prompt (spawn-based grading)

The rubric in `readiness.md` is loaded by `src/agents/invoke.ts` via `readFile` at bundle-resolved path, concatenated with the ticket JSON, and passed as stdin to `spawn('claude', ['-p', '--dangerously-skip-permissions'])`. The subagent returns a fenced `json` block matching `ReadinessVerdict`. `src/agents/parse-verdict.ts` extracts and zod/mini-validates.

**Schema-pair check is now a vitest test**, not an honour-system rule: `src/agents/__tests__/schema-pair.test.ts` parses `readiness.md` for `## ` headings under `## Checks`, extracts the 5 ids, and asserts set-equality against `ReadinessCheckId` union. Build fails on drift.

**Rubric-fitness test** (new — DA3's recommendation): `src/agents/__tests__/rubric-fitness.test.ts` ships 10 known-good and 10 known-bad ticket fixtures. Spawns the rubric against each (or — for CI speed — against a mocked grader that uses the rubric ids deterministically). Asserts ≥16/20 correct classifications. Without this, the rubric is unfalsifiable.

### §3.5 — Aggregation rule (new subsection)

The overall verdict is computed as:

```ts
const worst = worstOf(checks.map(c => c.verdict))
const yellowCount = checks.filter(c => c.verdict === 'yellow').length
const YELLOW_TO_RED_THRESHOLD = 3  // constant, loaded from a <!-- @threshold yellow-to-red = 3 --> comment in readiness.md

const overall: CheckColour =
  worst === 'red'                         ? 'red'
  : yellowCount >= YELLOW_TO_RED_THRESHOLD ? 'red'
  : worst === 'yellow'                    ? 'yellow'
  : 'green'
```

The threshold is loaded from a rubric-markdown comment so Alex can tune without a code change. Parsing that comment is trivial (regex `<!-- @threshold yellow-to-red = (\d+) -->`).

### §4 — AFK behavior matrix (error-path spec added)

v1's flow diagrams were happy-path only. **PR 12c adds a full error matrix to the pre-flight batch**:

| Failure mode | Behaviour |
|---|---|
| Subagent timeout (60s per grade) | Retry 2x with exponential backoff (2s, 8s). Third failure → counted as red with reason `"grading timed out"` and a synthetic `Evidence` entry. |
| Subagent 529 / network error | Same as timeout. |
| Empty queue | Write `readiness-report.md` with `total: 0` + "No tickets to grade. Queue is empty." Exit 0. Do NOT enter executeQueue. |
| Queue > `--max-batch` (default 50) | Truncate to first 50. Warn in report header: `<!-- batch truncated from N to 50 — use --max-batch=N to override -->`. |
| Duplicate ticket id in queue | Dedupe by id (keep first), warn in report. |
| Ctrl-C mid-batch | Partial verdicts are checkpointed to `.clancy/dev/readiness-report.partial.json` after every grade. On restart, `--resume` reads partial and skips already-graded tickets. |
| `.clancy/dev/` doesn't exist | `mkdir -p` before every write. |
| `readiness-report.md` exists from previous run | Rotate existing to `.clancy/dev/readiness-report.<timestamp>.md` before writing new. Keep last 3 rotated files; delete older. |
| Writer crashes mid-write | All artifact writers use write-temp-then-rename atomicity: `writeFile(path + '.tmp', body, { flag: 'w' }); rename(path + '.tmp', path)`. Shared helper `atomicWrite()` in `src/artifacts/atomic-write.ts`. |
| Cost ceiling | Pre-flight logs estimated cost (`grades * avg_tokens * $ per token`) BEFORE the loop starts. User sees "Will grade N tickets (~$X, ~N minutes). Proceed? [y/N]" unless `--yes` or `--afk` is set. |

### §4.3 — Artifact file formats (namespaced, atomic)

**All dev artifacts namespaced under `.clancy/dev/`** (not `.clancy/`). This avoids path collisions with terminal's `.clancy/run-summary.md` and any future package's artifacts.

- `.clancy/dev/readiness-report.md` — human-readable
- `.clancy/dev/readiness-report.json` — machine-readable sibling (new, DA3's recommendation)
- `.clancy/dev/readiness-report.partial.json` — checkpoint file for Ctrl-C resume
- `.clancy/dev/deferred.json` — AFK-strict skips only (no mid-loop entries in Phase E)
- `.clancy/dev/run-summary.md` — human-readable
- `.clancy/dev/run-summary.json` — machine-readable sibling

**Atomic writes** via `atomicWrite()` helper in all writers. All writers `mkdir -p` the parent directory first.

### §4.4 — `--bypass-readiness` flag hygiene

- **`--bypass-readiness` + `--afk` = parser-level error.** Bypassing the gate unattended is asking for trouble. Flag parser rejects the combination with: `"--bypass-readiness cannot be combined with --afk. Bypassing the readiness gate requires interactive mode so you can review what's being executed."`
- **Bypass writes an audit token** to `.clancy/dev/progress.txt`: `LOCAL_BYPASS_READINESS:<ticketId>:<iso8601>:<reason>`.
- **`--bypass-readiness` requires `--reason="..."` arg.** Makes the user write down why.

### §4.5 — Iteration-friendliness — honest accounting

v1 §4.4 oversold this. **Rewrite the section honestly:**

- **Truly free:** Editing rubric prose in `readiness.md`. Changing the yellow-to-red threshold (it's in a markdown comment). Changing rubric examples / failure messages.
- **Small code change:** Adding/removing a check. Requires: (1) edit `readiness.md`, (2) update `ReadinessCheckId` union in `types.ts`, (3) add an `Evidence` variant, (4) update `schema-pair.test.ts` expected list, (5) update `rubric-fitness.test.ts` fixtures if the new check affects classification. **5 file edits, all in `src/agents/`.** No changes to `executeQueue`, entrypoints, or artifacts writers.
- **Medium code change:** Adding a new artifact file (new writer module + new entrypoint wiring + new tests).
- **NOT iteration-friendly:** changing the colour scheme (green/yellow/red → something else) — touches parser, aggregation, report writer, all tests.

### §5 — `executeQueue` interface (split into two entry points)

**v1 had one function with `queue?: string[]` as a flag-argument anti-pattern.** DA1's fix:

```ts
// packages/dev/src/queue.ts

type QueueStopCondition =
  | { readonly stop: false }
  | { readonly stop: true; readonly reason: string }

// ── Private shared core ───────────────────────────────────────────
type RunLoopCoreOpts<TResult> = {
  readonly iterate: (indexOrId: string) => Promise<TResult>
  readonly shouldHalt: (result: TResult) => QueueStopCondition
  readonly indices: readonly string[]
  readonly quietStart?: string
  readonly quietEnd?: string
  readonly sleep: (ms: number) => Promise<void>
  readonly clock: () => number
  readonly now?: () => Date
  readonly console: ConsoleLike
}

async function runLoopCore<TResult>(
  opts: RunLoopCoreOpts<TResult>,
): Promise<LoopOutcome<TResult>> { /* ... */ }

// ── Public: fixed-count mode (terminal autopilot) ─────────────────
export type ExecuteFixedCountOpts<TResult> = {
  readonly iterations: number              // capped at 100 inside
  readonly run: () => Promise<TResult>
  readonly shouldHalt: (result: TResult) => QueueStopCondition
  readonly quietStart?: string
  readonly quietEnd?: string
  readonly sleep: (ms: number) => Promise<void>
  readonly clock: () => number
  readonly now?: () => Date
  readonly console: ConsoleLike
}

export async function executeFixedCount<TResult>(
  opts: ExecuteFixedCountOpts<TResult>,
): Promise<LoopOutcome<TResult>> {
  const indices = Array.from({ length: Math.min(opts.iterations, 100) }, (_, i) => `iter-${i + 1}`)
  return runLoopCore({ ...opts, indices, iterate: () => opts.run() })
}

// ── Public: queue mode (dev loop) ─────────────────────────────────
export type ExecuteQueueOpts<TResult> = {
  readonly queue: readonly string[]        // ticket ids, pre-graded green
  readonly run: (ticketId: string) => Promise<TResult>
  readonly shouldHalt: (result: TResult) => QueueStopCondition
  readonly maxIterations?: number          // default = queue.length, capped at 100
  readonly quietStart?: string
  readonly quietEnd?: string
  readonly sleep: (ms: number) => Promise<void>
  readonly clock: () => number
  readonly now?: () => Date
  readonly console: ConsoleLike
}

export async function executeQueue<TResult>(
  opts: ExecuteQueueOpts<TResult>,
): Promise<LoopOutcome<TResult>> {
  const cap = Math.min(opts.maxIterations ?? opts.queue.length, 100)
  const indices = opts.queue.slice(0, cap)
  return runLoopCore({ ...opts, indices, iterate: (id) => opts.run(id) })
}
```

**Terminal call-site** (PR 11b):
```ts
const outcome = await executeFixedCount({
  iterations: opts.maxIterations,
  run: () => opts.runIteration(),
  shouldHalt: checkStopCondition,          // now imported from @chief-clancy/dev (PR 11c)
  quietStart: opts.quietStart,
  quietEnd: opts.quietEnd,
  sleep: opts.sleep,
  clock: opts.clock,
  now: opts.now,
  console: opts.console,
})
```

**Dev call-site**:
```ts
const greens = graded.filter(v => v.overall === 'green').map(v => v.ticketId)
const outcome = await executeQueue({
  queue: greens,
  maxIterations: cliArgs.max,
  run: (ticketId) => runSingleTicketByKey(ticketId, deps),
  shouldHalt: checkStopCondition,
  quietStart: cliArgs.quietStart,
  quietEnd: cliArgs.quietEnd,
  sleep: (ms) => new Promise(r => setTimeout(r, ms)),
  clock: Date.now,
  now: () => new Date(),
  console: process.stdout,
})
```

---

## 4. PR detail deltas

Only PRs with material changes from v1 are listed. Anything not here is unchanged.

### PR 0 — Document everything upfront

v1 only locked Cut E schema + no-approve-dev. **v2 additionally locks:**

- **Locked decision #6 revision:** `FATAL_ABORT_PHASES` and `checkStopCondition` move to `@chief-clancy/dev` as pipeline-contract primitives. Updates `docs/decisions/architecture/package-evolution.md` with explicit "revised 2026-04-10" line.
- **Q5 resolution:** readiness subagent invocation uses `spawn('claude', '-p', '--dangerously-skip-permissions')` from the dev bundle, reusing the `cli-bridge` / `invokeClaudePrint` pattern (which is moving to dev in PR 4a). NOT the Claude Code Task tool. Documented next to the locked-decision section.
- **Q8 resolution:** dev entrypoint pre-seeds `ctx.ticket` from a one-shot board lookup before calling `runPipeline`. The existing `if (!ctx.ticket)` guard at [ticket-fetch.ts:68-72](packages/dev/src/pipeline/phases/ticket-fetch/ticket-fetch.ts#L68) supports this. No Board API changes.
- **No mid-loop discovery in Phase E:** explicit deferral documented. Phase F (or later) may extend `FeasibilityPhaseResult` with an `ambiguous` third state. Until then dev's AFK loop does pre-flight batch only.

PR 0 now touches `docs/decisions/architecture/package-evolution.md` only (+~150 lines, up from ~80 in v1). Still XS sizing — it's all prose.

### PR 1 — Scaffold

v1 said `.changeset/*.md (new)` without specifying content. **v2 explicit:** `.changeset/initial-dev-package.md` declares `"@chief-clancy/dev": minor` for the 0.0.0 → 0.1.0 bump, with a body citing "Phase E initial package scaffold". `package.json` starts with `"private": true` per `feedback_private_until_ready.md`. Flipped to `false` in PR 13.5.

### PR 1.5 (NEW) — ESLint boundary rule

- **Touches:** `eslint.config.ts` (add `dev` type + rules), `knip.json` (add `packages/dev/`)
- **Does:** enforces `from: dev → allow: [dev, core]` and `from: terminal → allow: [terminal, core, dev]` against the (still empty) `packages/dev/`. PRs 2/3/4 will now lint-fail if they introduce a disallowed import, which is what we want.
- **Does NOT:** touch wrapper rule (DA1: YAGNI, no wrapper→dev consumer exists). Does NOT touch chat rule (must preserve unchanged).
- **Explicit before/after in PR description:** full rules array with all 6 package types (core, brief, plan, terminal, chat, wrapper) shown side-by-side so reviewers can diff.
- **Deps:** PR 1.
- **Risk:** low.

### PR 2a/2b/2c — Lifecycle moves (split)

Each cluster chosen by coupling density (utility-heavy first, delivery-heavy last):

- **PR 2a:** `branch`, `commit-type`, `format`, `cost`, `lock`, `preflight` — 6 dirs, low intra-coupling, ~20 files
- **PR 2b:** `fetch-ticket`, `feasibility`, `quality`, `progress`, `outcome`, `resume`, `rework` — 7 dirs, runtime-aware, ~22 files
- **PR 2c:** `deliver-ticket`, `deliver-epic`, `epic`, `pr-creation`, `pull-request` — 5-6 dirs, delivery-heavy, ~23 files

Each sub-PR runs the full pre-push quality suite in its own CI pass. `git mv` preserves blame. Import rewrites are per-cluster. Architectural review runs the post-restructure sweep per `docs/DA-REVIEW.md:55` with the cluster names as the concept set.

### PR 3a/3b — Pipeline moves (split)

- **PR 3a:** `run-pipeline.ts`, `context.ts`, `index.ts`, `test-helpers.ts`, `dry-run`, `lock-check`, `preflight-phase` — low-coupling infrastructure
- **PR 3b:** `branch-setup`, `ticket-fetch`, `feasibility`, `cost-phase`, `transition`, `cleanup-phase`, `deliver-phase`, `epic-completion`, `pr-retry`, `rework-detection` — the remaining 10 phases

### PR 4a/4b/4c — Terminal→dev moves (new)

v1 had PR 4 as a single M-size PR. **v2 splits into three**:

- **PR 4a:** move `packages/terminal/src/runner/cli-bridge/` → `packages/dev/src/cli-bridge/`. Move `packages/terminal/src/runner/notify/` → `packages/dev/src/notify/`. Update imports. These are standalone modules with no deps on other terminal internals.
- **PR 4b:** move `packages/terminal/src/runner/dep-factory/invoke-phase.ts` → `packages/dev/src/dep-factory/invoke-phase.ts`. It now imports from dev's local `cli-bridge` (moved in PR 4a).
- **PR 4c:** move `packages/terminal/src/runner/dep-factory/` (all remaining files including `dep-factory.ts`, `deliver-phase.ts`, and the rest of the directory) → `packages/dev/src/dep-factory/`. Terminal's `implement.ts` and `autopilot.ts` now import `buildPipelineDeps` from `@chief-clancy/dev`. This is the biggest of the three — but still M-sized because the moves are mechanical and the consumers are isolated.

### PR 5 — Delete empty core/dev/

Unchanged from v1 except: no longer touches eslint.config.ts (that moved to PR 1.5). PR 5 is now strictly a deletion + `core/index.ts` pruning.

### PR 8c — Single-ticket executor with pre-seeded ctx.ticket

v1 assumed `ticketFetch` supported explicit-id mode. **v2 uses pre-seed pattern:**

```ts
// packages/dev/src/execute/single.ts
export async function runSingleTicketByKey(
  ticketKey: string,
  deps: SingleTicketDeps,
): Promise<PipelineResult> {
  // 1. Hydrate the ticket outside the pipeline (one-shot board lookup)
  const ticket = await deps.fetchTicketByKeyOnce(ticketKey)
  if (!ticket) {
    return { status: 'error', error: `Ticket ${ticketKey} not found on board` }
  }

  // 2. Build ctx with pre-seeded ticket
  const ctx = createContext({ projectRoot: deps.projectRoot, argv: deps.argv, isAfk: deps.isAfk })
  ctx.setTicket(ticket)

  // 3. Run pipeline — ticketFetch phase becomes a no-op because ctx.ticket is set
  const pipelineDeps = buildPipelineDeps({ /* ... */ })
  return runPipeline(ctx, pipelineDeps)
}
```

**The `fetchTicketByKeyOnce` is NOT added to the Board API.** It's a thin adapter in dev's entrypoint that uses the existing Board instance's label query or similar to look up the ticket. If the ticket isn't found via standard queries, the entrypoint errors out with a clear message. Cut F/G can promote to a uniform `Board.fetchTicketByKey()` API if needed.

**Cut B acceptance test** (last commit of PR 8c): `test/acceptance/cut-b.test.ts` — spawns `clancy-dev.js TICKET-MOCK-1` against a mock board fixture, asserts exit code 0 + expected PR creation call. Four cases: success, mock board returns null (ticket not found), pipeline fails at branch-setup (exit non-zero with stderr), missing ticket arg (exit 2 with usage).

### PR 9 — Readiness rubric with 5 checks + tests

v1 had 6 checks and a hand-wavy schema-pair check. **v2:**

- **5 checks** in `src/agents/readiness.md`: Clear, Testable, Small, Locatable, Touch-bounded
- `src/agents/types.ts` exports `ReadinessCheckId` union of exactly those 5
- `src/agents/parse-verdict.ts` uses zod/mini discriminated union on `Evidence`
- `src/agents/__tests__/schema-pair.test.ts` — vitest test that parses `readiness.md`, extracts the 5 heading ids under `## Checks`, and asserts set-equality against `ReadinessCheckId`. Fails build on drift.
- `src/agents/__tests__/rubric-fitness.test.ts` — ships 10 known-good + 10 known-bad ticket JSON fixtures in `src/agents/__tests__/fixtures/`. For CI speed, this test uses a deterministic mock grader (not a real Claude spawn) that applies the rubric rules as a pure function to the fixture, asserts ≥16/20 correct classifications. **A separate, opt-in `pnpm test:rubric-live` command runs the same fixtures against a real `claude -p` spawn for manual validation.**
- `src/agents/invoke.ts` — NEW: spawns `claude -p --dangerously-skip-permissions` with the rubric + ticket as stdin, parses the fenced json block from stdout. Reuses `spawnSync` pattern from `cli-bridge.ts:33-51` (which lives in dev after PR 4a).
- `src/agents/aggregate.ts` — NEW: applies the aggregation rule (`worst` + `yellowCount >= threshold → red`), reads the threshold from a rubric markdown comment.

### PR 10 — Wire readiness + --bypass-readiness + Cut C acceptance test

v1 referenced the "Claude Code Task tool" which doesn't work from a bundle. **v2:** readiness is invoked via `src/agents/invoke.ts` (the spawn-based grader from PR 9). No Task tool. No Agent tool. Plain `spawn('claude', ['-p', ...], { input: prompt })`.

- `/clancy:dev {ticket}` (interactive) flow: Step 1 grades via `invoke.ts`. If green → execute. If yellow → print per-check questions, read stdin for answer (one round of amendment), re-grade (one retry max). If yellow after retry, or red → exit 1 with structured output.
- **Re-grade loop capped at 3 rounds** (DA3) including the initial grade.
- **`--bypass-readiness` requires `--reason=...`** (DA3). Writes `LOCAL_BYPASS_READINESS:<ticketId>:<iso8601>:<reason>` to `.clancy/dev/progress.txt`.
- **`--bypass-readiness` + `--afk` = parser error** (DA3). Flag parser rejects the combination.
- **Cut C acceptance test** (last commit of PR 10): spawn `clancy-dev.js TICKET-MOCK-RED` (a fixture ticket that rubric will grade red), assert exit 1 and refusal output. Second: `TICKET-MOCK-GREEN` → exit 0. Third: `TICKET-MOCK-GREEN --bypass-readiness --reason="test"` → exit 0 + progress.txt has the bypass token. Fourth: `--bypass-readiness --afk` → exit 2 with parser error.

### PR 11a/11b/11c — ExecuteQueue split

- **PR 11a:** adds `packages/dev/src/queue.ts` with `executeFixedCount` and `executeQueue` (two public entry points, private `runLoopCore`). Ships `packages/dev/src/queue.test.ts` with full test matrix:
  - Empty queue (queue = [])
  - queue.length > maxIterations (cap wins)
  - queue.length < maxIterations (queue wins)
  - Fixed-count mode: iterations = 0, iterations = 1, iterations = 10
  - Quiet hours: inside window (sleeps), outside window (runs), wrap-around midnight
  - Halt at iteration 0
  - Halt at iteration N-1
  - `run()` throwing mid-iteration
  - `sleep()` rejecting
  - Opaque generic: test with `TResult = string` AND `TResult = { phase: string, status: string }` (PipelineResult shape)
  - Max iterations hard cap at 100 (queue of 200 truncates)
  - **12+ test cases** (v1 had ~5).
  Terminal autopilot NOT yet migrated. No other consumer changes.

- **PR 11b:** migrates `packages/terminal/src/runner/autopilot/autopilot.ts` to call `executeFixedCount` from `@chief-clancy/dev`. Deletes the now-duplicate loop logic from autopilot.ts. Migrates quiet-hours tests from `autopilot.test.ts` to `queue.test.ts`. Enumerates explicitly in the PR description which terminal tests delete, which stay (thin-wrapper smoke tests), which migrate.

- **PR 11c:** moves `FATAL_ABORT_PHASES` (Set<string>) and `checkStopCondition` from `packages/terminal/src/runner/autopilot/autopilot.ts` to `packages/dev/src/stop-condition.ts`. Exports from dev's index. Terminal's autopilot imports `checkStopCondition` from `@chief-clancy/dev`. This is the concrete realisation of the locked-decision-#6 revision from PR 0.

### PR 12a — Loop slash command + entrypoint

Unchanged from v1 except: PR 12b (activate autopilot bundle) is folded into 12a since PR 7 already built the bundle. PR 12a is now the full "command exists, entrypoint has a shell, bundle is copied on install" slice.

### PR 12c — Pre-flight batch + error matrix + readiness-report writer

v1 only had the happy-path pre-flight. **v2 adds the full error matrix from §4 above:**

- Per-grade timeout (60s) with 2x retry + exponential backoff
- Partial-results checkpoint to `.clancy/dev/readiness-report.partial.json` after every grade
- `--max-batch=N` (default 50) with truncation warning in report header
- `--resume` flag reads partial and skips already-graded tickets
- Dedupe by ticket id with warning
- `mkdir -p` before every write
- Atomic write helper (write-temp-rename)
- Report rotation: existing `readiness-report.md` rotates to `readiness-report.<timestamp>.md`, keep last 3
- Cost estimate printed BEFORE the loop starts: "Will grade N tickets (~$X, ~N minutes)." In interactive mode asks for confirmation unless `--yes`. In `--afk` mode prints and proceeds (user already opted in to autonomous).

### PR 12d — AFK matrix + run-summary + deferred.json + Cut D acceptance

**Mid-loop discovery REMOVED from this PR per D5.** What's left:

- Three modes supported: interactive (single-ticket only), `--afk` (halts after pre-flight if non-green), `--afk-strict` (executes only greens, skips yellows)
- `run-summary.md` (and `.json` sibling) written at end of every loop
- `deferred.json` written by `--afk-strict` path for yellow tickets (not mid-loop; those don't exist in Phase E)
- Atomic writes, namespaced under `.clancy/dev/`
- **Cut D acceptance test** (last commit): table-driven matrix across 3 modes × 3 verdict mixes (all-green / mixed / all-red):
  - 9 cases + 3 special cases (empty queue, `--max` override, `--resume` after Ctrl-C simulation)
  - Each case asserts: exit code, which artifacts are written, artifact contents

### PR 13 — Docs sweep

Unchanged from v1. Handles `PROGRESS.md` update, `package-evolution.md` build-order row update (dev is now live, remove "in progress" marker), package READMEs.

### PR 13.5 (NEW) — Private → public flip + publish

- **Touches:** `packages/dev/package.json` (`"private": true` → `"private": false`), `.changeset/publish-dev.md` (new, bumping to 0.1.0)
- **Does:** finalises the publish story per `feedback_private_until_ready.md`. CI runs `pnpm publint && pnpm attw` on the now-public package and must pass.
- **Does NOT:** actually run `changeset publish` (that happens on main post-merge via the existing publish workflow).
- **Deps:** PR 13.
- **Risk:** low — but separated from PR 13 because public-publish is irreversible and deserves its own review pass.

---

## 5. Dependency graph (v2)

```
PR 0 (docs)
  ├──►  (PR 0 can parallel with PR 1)
PR 1 (scaffold) ──► PR 1.5 (eslint) ──► PR 2a ──► 2b ──► 2c ──► 3a ──► 3b
                                                                        │
                                                                        ▼
                                                          PR 4a ──► 4b ──► 4c
                                                                           │
                                                                           ▼
                                                                         PR 5
                                                                           │
                                                                           ▼
                                                                         PR 6 ──► 6.5 ──► 7
                                                                                          │
                                                                                          ▼
                                                                           PR 8a ──► 8b ──► 8c
                                                                                             │
                                                                                             ▼
                                                                                           PR 9 (Cut B acceptance complete here)
                                                                                             │
                                                                                             ▼
                                                                                           PR 10 (Cut C complete)
                                                                                             │
                                                                                             ▼
                                                                                           PR 11a ──► 11b ──► 11c
                                                                                                               │
                                                                                                               ▼
                                                                                                             PR 12a ──► 12c ──► 12d (Cut D complete)
                                                                                                                                 │
                                                                                                                                 ▼
                                                                                                                               PR 13 ──► 13.5
```

**Parallelisable pairs** (DA2):
- PR 0 ∥ PR 1 (docs vs scaffold, no code overlap)
- Everything else is sequential by construction.

---

## 6. New risks (added by v2 choices)

1. **PR 4a/4b/4c transitive closure risk.** Moving cli-bridge + notify + invoke-phase + deliver-phase + dep-factory wholesale is a larger cross-package surgery than v1 planned. If any file in that closure imports from a terminal-only module not caught in the migration, PR 4 chain breaks. **Mitigation:** PR 4a starts by grepping all terminal imports in the four target directories BEFORE moving anything. If any are found, they're either moved alongside or extracted as injected deps in a pre-PR.

2. **Spawn-based grading latency.** `spawn('claude', '-p')` cold-starts a new Claude session per grade. Pre-flight batch of 50 tickets = 50 cold starts. Terminal's `invokeClaudePrint` has latency data we can extrapolate from. **Mitigation:** the `--max-batch=50` cap + parallel grading (configurable concurrency, default 4) + the cost-estimate printed BEFORE the loop. User knows what they're signing up for.

3. **Rubric-fitness test false confidence.** The mock grader uses deterministic rules, not a real Claude session. A rubric that passes the mock may fail in production because a real Claude grades differently. **Mitigation:** `pnpm test:rubric-live` is an opt-in command that runs the fixtures against real `claude -p` and reports accuracy. Run manually before each rubric change.

4. **Pre-seed ctx.ticket pattern leaks into the pipeline.** The `ticketFetch` phase has `if (!ctx.ticket)` which was never designed as a pre-seed hook. If a future pipeline change removes that guard, dev's single-ticket path breaks silently. **Mitigation:** PR 8c adds a test that asserts `ticketFetch` is a no-op when `ctx.ticket` is pre-set, AND adds a comment at [ticket-fetch.ts:68](packages/dev/src/pipeline/phases/ticket-fetch/ticket-fetch.ts#L68) documenting the pre-seed contract as a public behaviour.

5. **Atomic write under Windows.** `rename()` is not atomic on Windows if the target exists. **Mitigation:** `atomicWrite()` helper checks `process.platform === 'win32'` and uses `unlink + rename` with a fallback. Tested with a synthetic Windows-path test. (The repo doesn't currently target Windows for the pipeline, but the installer and dev artifacts might land in Windows home dirs, so this matters.)

---

## 7. Validation criteria (updated)

Phase E is complete when ALL of the following hold:

- [ ] `pnpm test` passes. Approximate counts: core ~750 / terminal ~650 / brief 73 / plan 264 / **dev ~1200** = ~2937 total (baseline + 154 for readiness, queue, artifacts, installer tests, rubric-fitness fixtures, Cut B/C/D acceptance tests).
- [ ] `pnpm lint` passes with the new `dev` boundary rule enforced (added in PR 1.5, live since PR 2a).
- [ ] `pnpm typecheck && pnpm format:check && pnpm knip && pnpm publint && pnpm attw` all green.
- [x] `packages/core/src/dev/` directory does not exist (deleted in PR 5).
- [ ] `packages/dev/` exists with: `src/lifecycle/` (19 modules), `src/pipeline/` (13 phases + run-pipeline + context), `src/cli-bridge/`, `src/notify/`, `src/dep-factory/` (including invoke-phase, deliver-phase), `src/queue.ts`, `src/stop-condition.ts`, `src/agents/readiness.md` + fitness tests, `src/installer/`, `src/artifacts/`, `bin/dev.js`, `dist/bundle/clancy-dev.js`, `dist/bundle/clancy-dev-autopilot.js`.
- [ ] `@chief-clancy/dev` is published at `0.1.0` (PR 13.5 flips private + changeset; actual publish happens on main via existing workflow).
- [ ] `npx @chief-clancy/dev --local` installs `/clancy:dev` and `/clancy:dev --loop` slash commands + both bundles into `.clancy/dev/`.
- [ ] `/clancy:dev TICKET-123` against a test ticket: grades via `spawn('claude', '-p')`, refuses on red with structured output / runs on green.
- [ ] `/clancy:dev --loop --afk` on a mixed queue: writes `.clancy/dev/readiness-report.md` + `.json`, halts with exit 0 before any execution.
- [ ] `/clancy:dev --loop --afk --afk-strict --max=5` on a mixed queue: writes `deferred.json` for yellow, executes up to 5 greens, writes `run-summary.md` + `.json`.
- [ ] `--bypass-readiness --afk` combination errors out at the parser with a clear message.
- [ ] `terminal/src/runner/autopilot/autopilot.ts` imports `executeFixedCount` + `checkStopCondition` from `@chief-clancy/dev` and is materially shorter than today (~200 lines → ~50 lines expected).
- [ ] Terminal test suite still passes with only behaviour-preserving changes.
- [ ] Rubric-fitness test (mock grader) classifies ≥16/20 fixture tickets correctly.
- [ ] `PROGRESS.md` Phase E row marked done. `docs/decisions/architecture/package-evolution.md` updated to reflect dev existing + the locked-decision-#6 revision.
- [ ] **No new entries in CLAUDE.md** (executable-contract-bloat constraint held per `docs/RATIONALIZATIONS.md`).
- [ ] `docs/RATIONALIZATIONS.md` gains any new self-deceptions caught during Phase E.
- [ ] Each of Cut B / Cut C / Cut D has an acceptance test as the last commit of its completing PR (PR 8c / PR 10 / PR 12d).

---

## 8. Open questions remaining (for DA round 2)

**Q-v2-1.** PR 4a/4b/4c transitive closure — is the grep-before-move mitigation sufficient, or should there be a separate "survey PR" that just reports the transitive closure without moving anything, so the scope is known before PR 4a commits?

**Q-v2-2.** Rubric-fitness mock grader — is a mock grader that uses deterministic rules actually testing the rubric, or is it testing my mental model of the rubric? The opt-in `pnpm test:rubric-live` is the real test but it's manual. Is there a way to make it run in CI without burning tokens per push? (One option: cron-nightly CI job against a frozen fixture set.)

**Q-v2-3.** Pre-seed `ctx.ticket` — does it need to also skip `branchSetup` or other phases that assume a fresh board fetch? Read `branch-setup.ts` to verify.

**Q-v2-4.** The `executeQueue.maxIterations` default of `queue.length` — is that the right default? Alternative: default to `min(queue.length, 100)`. User can override with `--max=N`. Think about: what happens when a user has a 200-ticket queue and runs `/clancy:dev --loop --afk --afk-strict` with no `--max`? Does dev just run for hours?

**Q-v2-5.** Atomic write on Windows — is Phase E the right time to add cross-platform atomicity, or is NOTICED-BUT-NOT-TOUCHING the right call? The existing codebase has no Windows-specific file IO.

**Q-v2-6.** Cost-estimate pre-flight message — where does the "per-grade token estimate" come from? Hardcoded constant (cheap but stale) vs reading `ANTHROPIC_MODEL_TOKEN_RATES` from env (overkill for Phase E)?

---

**End of v2 deltas. Read alongside `/tmp/phase-e-plan.md` for the full context. Any section not mentioned here is unchanged from v1.**
# Phase E Plan v3 — Deltas on top of v2 (`/tmp/phase-e-plan-v2.md`)

**Status:** DRAFT for DA round 3 sanity-check
**Date:** 2026-04-10
**Based on:** v2 + DA round 2 findings + Option A validation research + user decisions R5
**Scope unchanged:** Cut D — extraction + standalone installer + runtime bundle + `/clancy:dev {ticket}` + 5-check readiness gate + autopilot loop + AFK behavior matrix.

This document only describes **what changes from v2**. Read v1 first, then v2, then v3.

---

## 1. Round-5 decisions locked

| ID | Decision | Resolution |
|---|---|---|
| **R5-1** | Alt 3 (harness-delegated grading) vs Option A (spawn from bundle) | ✅ **Option A.** Three reasons: (a) unit-testability — `spawn` mocks cleanly, Agent tool doesn't exist in vitest runtime; (b) CI rubric-fitness test must run path-filtered on `readiness.md` edits, which requires grading without the harness; (c) ad-hoc invocation (`node .clancy/clancy-dev.js TICKET-123` from a normal terminal) is a valid workflow we shouldn't foreclose. |
| **R5-2** | Default grading model | ✅ **Haiku (`claude-haiku-4-5`).** Cheapest, fastest, grading is stateless rubric work. [Claude Code rate-limit guidance](https://www.clawport.dev/blog/claude-code-rate-limits-explained) explicitly says "reserve Opus for complex reasoning, route simpler tasks through Sonnet/Haiku." **Fallback rule:** if rubric-fitness test scores Haiku <16/20 on fixtures, PR 9 switches default to Sonnet. |
| **R5-3** | Move-first-improve-second policy | ✅ **Locked.** Pure `git mv` + import rewrites only in each move PR (every file `similarity index 100%`). NOTICED lists in PR description. Separate improvement PRs in the new location. Improvement PRs evaluate against current standards per `docs/RATIONALIZATIONS.md:55`, not against the old code's patterns. Seven-PR precedent from earlier core→dev refactor (`f8cd61f`, `46ba20a`, `0fa2ba1`, `8c49a26`, `6edc40e`, `02c4fc6`, `6aa9af9`). |

---

## 2. Option A amendments (answering DA round 2 Crit-2)

v2 committed to "reuse `cli-bridge`" for grading. Research found that assumption was load-bearing-wrong because `cli-bridge` is `spawnSync` (blocking, no parallelism, no timeout, no signal handling). Research also found **three Claude Code CLI flags v2 didn't know about** that tip Option A from "complex but necessary" to "feasible and better":

### 2.1 `--bare` flag

[Claude Code headless docs](https://code.claude.com/docs/en/headless) document `--bare` — skips auto-discovery of hooks, skills, plugins, MCP servers, auto-memory, and CLAUDE.md. Quoted from docs: *"`--bare` is the recommended mode for scripted and SDK calls, and will become the default for `-p` in a future release."*

**Impact:** eliminates per-grade startup of CLAUDE.md parsing, MCP server connection, skill scanning. Likely halves cold start for a monorepo session like Clancy's. Requires `ANTHROPIC_API_KEY` in env (no OAuth/keychain read). PR 9's `claude-spawn.ts` fails fast at module init if the var is unset.

### 2.2 `--output-format json` + parse `.usage`

Docs confirm structured JSON mode returns `session_id` and `usage.input_tokens` / `usage.output_tokens`. v2 dropped `tokensIn/Out` from `ReadinessVerdict` on the false assumption those counts were unavailable. **Restore both fields** plus add `sessionId: string` for debugging:

```ts
type ReadinessVerdict = {
  // ...existing fields...
  readonly tokensIn:  number    // from usage.input_tokens
  readonly tokensOut: number    // from usage.output_tokens
  readonly sessionId: string    // from session_id, for debugging
}
```

### 2.3 `--json-schema <schema>` for CLI-layer verdict validation

Docs support `--output-format json --json-schema '<JSON Schema>'` to constrain the model's structured output. Hand-author a JSON Schema that matches `ReadinessVerdict`'s shape (per-check array with tagged-union evidence). Eliminates an entire class of parsing bug (stray prose, malformed code fences, missing fields).

Implementation: derive the JSON Schema from the `zod/mini` types in `src/agents/types.ts` at build time (or hand-write and schema-pair test it against the zod types). Ship in PR 9.

### 2.4 Default model + concurrency rules

- **Default model:** Haiku (`claude-haiku-4-5`). Validated by rubric-fitness test in PR 9 before Cut B acceptance. Override via `CLANCY_DEV_GRADING_MODEL` env var.
- **Default concurrency:** 4 for Haiku/Sonnet, **force 2 for Opus** if user overrides. Research found explicit "avoid parallel sessions on Opus" guidance.
- **Rate-limit backoff:** `claude -p` has built-in silent retry on 429/529, so the caller doesn't need its own retry logic — but DOES need a longer per-grade timeout because retries eat time. **Per-grade budget: 120s total (not 60s)**, giving room for 2 silent retries.

---

## 3. `packages/dev/src/agents/claude-spawn.ts` — concrete spec (new in PR 9)

~120 LOC (not 80 — adding stderr drain, staged SIGINT, pLimit inline).

### 3.1 Public API

```ts
import type { AbortController } from 'node:abort-controller'

export type ClaudeSpawnConfig = {
  readonly claudeBinary?:   string       // default: 'claude'
  readonly model?:          string       // default: env CLANCY_DEV_GRADING_MODEL ?? 'claude-haiku-4-5'
  readonly timeoutMs?:      number       // default: 120_000 (120s)
  readonly maxStdinBytes?:  number       // default: 32 * 1024
  readonly jsonSchema?:     object       // optional --json-schema payload
}

export type ClaudeSpawnResult =
  | { readonly ok: true;  readonly stdout: string; readonly usage: Usage; readonly sessionId: string; readonly durationMs: number }
  | { readonly ok: false; readonly reason: 'timeout' | 'non-zero-exit' | 'signal-killed' | 'stdin-too-large' | 'json-parse-error' | 'schema-invalid'; readonly details: string; readonly durationMs: number }

export type Usage = { readonly inputTokens: number; readonly outputTokens: number }

/**
 * Spawn a fresh `claude -p --bare --output-format json` subprocess with the given prompt.
 * 
 * Requires ANTHROPIC_API_KEY in env (--bare skips OAuth/keychain).
 * Drains stderr to prevent pipe-buffer deadlock.
 * Propagates SIGINT → SIGTERM → 2s grace → SIGKILL on abort.
 * 
 * @param prompt stdin-piped input (rubric + ticket JSON)
 * @param config overrides
 * @param abort external abort controller (also listens for SIGINT)
 */
export async function invokeClaudeGrader(
  prompt: string,
  config: ClaudeSpawnConfig,
  abort?: AbortController,
): Promise<ClaudeSpawnResult>

/**
 * Run N async tasks with a max concurrency cap.
 * Caller-side concurrency helper, inlined here (no npm dep, no shared helper until 3rd caller).
 */
export async function withConcurrency<T>(
  cap: number,
  tasks: readonly (() => Promise<T>)[],
): Promise<readonly T[]>
```

### 3.2 Key implementation points (from research findings)

- **`argv`:** `['claude', '-p', '--bare', '--dangerously-skip-permissions', '--output-format', 'json', '--model', model]` + optional `['--json-schema', JSON.stringify(jsonSchema)]`.
- **Env:** inherit parent env (`env: process.env`). Fail fast at module init if `process.env.ANTHROPIC_API_KEY` is unset with a clear error message.
- **stdio:** `['pipe', 'pipe', 'pipe']`. **Drain stderr** into a ring-buffer capped at 256KB (for debugging on failure) to prevent kernel pipe backpressure deadlock on retry-heavy runs.
- **stdin:** write prompt, immediately `child.stdin.end()`. Assert `Buffer.byteLength(prompt, 'utf8') <= maxStdinBytes` before spawn — fail with `'stdin-too-large'` if exceeded.
- **stdout:** accumulate into buffer capped at 10MB. On close, `JSON.parse(stdout)` → extract `.result` (the actual model output), `.usage`, `.session_id`.
- **Timeout:** `AbortController` with `setTimeout(() => abort(), timeoutMs)`. On abort: send SIGTERM, `await setTimeout(2000)`, if child still alive send SIGKILL.
- **SIGINT propagation:** module-level `process.on('SIGINT', () => abortAll())` where `abortAll()` iterates active controllers. `process.on('exit', abortAll)` as belt-and-braces.
- **`withConcurrency`:** trivial 15-line implementation — queue of pending tasks, N active workers, `Promise.race` to unblock. No `p-limit` dep. Inlined per `docs/RATIONALIZATIONS.md:54` "three similar lines of code is better than a premature abstraction".

### 3.3 Tests (PR 9 + follow-ups)

- **Unit tests** (mock `spawn`): success path, timeout, non-zero exit, SIGTERM, malformed JSON output, schema validation failure, stdin-too-large, stderr-drain (assert stderr reads happen), SIGINT propagation.
- **`withConcurrency` tests**: empty array, cap=1, cap>N, task throws, all-parallel, ordering preserved.
- **Integration (opt-in, gated on `ANTHROPIC_API_KEY` in env, not run by default):** 3 real Haiku spawns against fixture prompts, assert `ok: true` + valid usage. Run via `pnpm --filter dev test:live`.
- **Rubric-fitness mock-grader test** (in PR 9): 10 known-good + 10 known-bad fixture tickets, deterministic rule-based mock, ≥16/20 classification accuracy.
- **Rubric-fitness LIVE test** (opt-in, new): `pnpm --filter dev test:rubric-live` — path-filtered GitHub Actions workflow runs ONLY when `packages/dev/src/agents/readiness.md` is in the PR diff. Cost bounded to ~$0.50/run (20 × Haiku grades). See §4 DA-major-1 below.

---

## 4. DA round 2 critical + major fixes

### Crit-4 resolution: split `shared/types.ts`

DA round 2 verified: `packages/terminal/src/runner/shared/types.ts` is imported by 8 files across both the moving population (cli-bridge, dep-factory, deliver-phase, invoke-phase, autopilot — moving to dev) and the staying population (implement, session-report, autopilot/entrypoint — staying in terminal).

**Resolution — insert PR 3.5** (between 3b and 4a):

- **PR 3.5 title:** `♻️ refactor(dev): split terminal/runner/shared/types.ts into dev/src/types/{spawn,progress}.ts + re-export stubs`
- **Touches:**
  - `packages/dev/src/types/spawn.ts` (NEW) — exports `SpawnSyncFn`, `SpawnFn` (new async type for claude-spawn), `StdioValue`, `ConsoleLike`
  - `packages/dev/src/types/progress.ts` (NEW) — exports `AppendFn`
  - `packages/terminal/src/runner/shared/types.ts` — becomes thin re-export: `export { SpawnSyncFn, StdioValue, ConsoleLike } from '@chief-clancy/dev'; export { AppendFn } from '@chief-clancy/dev'`
  - Import rewrites in terminal's surviving consumers (implement, session-report, autopilot/entrypoint) to import directly from `@chief-clancy/dev` (NOT via the re-export stub — stub is kept only for a single transitional release).
- **Does NOT:** touch any of the moving files yet — PR 4a picks them up next.
- **Size:** S.
- **Deps:** PR 3b.
- **Risk:** low — mechanical split, tests stay green by construction.
- **NOTICED list:** if the split reveals any typing improvements (e.g. stricter `StdioValue` unions), list them for a follow-up improvement PR — do NOT fix in PR 3.5.

The re-export stub in terminal's `shared/types.ts` is a temporary compatibility shim — **PR 13 (docs sweep) deletes the stub** after all consumers have migrated to direct imports. This is the only place in the Phase E plan where a transitional shim exists, and it's explicitly scheduled to be removed in the same phase.

### DA-major-1: Rubric-fitness live CI gate

DA2 correctly flagged that a mock grader tests the author's mental model of the rubric, not the rubric itself. **Resolution:**

- Ship the mock-grader fitness test in PR 9 as the primary gate (runs every push, fast)
- Ship a LIVE fitness test (`pnpm --filter dev test:rubric-live`) in PR 9 that spawns real Haiku against the same 20 fixtures
- **GitHub Actions workflow in PR 9** includes a path-filtered job: runs the LIVE test ONLY when the PR touches `packages/dev/src/agents/readiness.md` OR `packages/dev/src/agents/readiness.test.ts` OR any fixture file. Cost: ~20 × $0.025 (Haiku input+output per grade at current rates) ≈ $0.50 per rubric change. Rare, bounded, worth it.
- **Fitness fixture source:** recent Clancy tickets from commit history that were clearly green (merged cleanly in 1 PR) + rejected/edited tickets that had to be split or clarified. PR 9 description names the specific tickets by sha/number used as fixtures so the provenance is auditable.

### DA-major-2: Touch-bounded honesty

DA2 caught: v2 said "the file list becomes evidence the executor uses at runtime for drift detection" but no Phase E PR wires drift detection. Two options:

- **(a) Wire drift detection in PR 12d.** After pipeline execution, compute `git diff --name-only base...HEAD` and diff against `expectedFiles`. Write result to `.clancy/dev/drift.json`. **Logged, not fatal, in Phase E.**
- **(b) Downgrade the description honestly.** Touch-bounded measures ticket specificity (can the subagent name files?), not drift.

**Resolution: both.** Do (a) because it's cheap (~20 LOC in PR 12d), AND rewrite the `readiness.md` description to say "measures specificity now, feeds drift detection logged to `.clancy/dev/drift.json` at end of execution." The drift.json becomes another artifact the run-summary references.

### DA-major-3: `Independent` cut rationale rewording

DA2 caught: v2's rationale ("depends on Cut E frontmatter") is misleading because board-side dependency data (GitHub parent/child, Jira `issuelinks`, Azure work-item links) is already available via `FetchedTicket.parentInfo` or similar.

**Resolution — reword v2 §1 D7 as:**

> **D7 — `Independent` check in Phase E.** ✅ **Cut entirely.** Board APIs expose dependency data natively (GitHub parent/child task lists, Jira `issuelinks`, Azure work-item link types) — so a board-coupled `Independent` check is technically feasible in Phase E. However, Cut E ships a `dependencies` frontmatter field that supersedes the board-side path, and plumbing two different code paths (board-side in Phase E → frontmatter in Cut E) creates migration burden we don't want to pay. Phase E ships 5 checks; Cut E adds `Independent` once. **Side effect:** a queue of mutually-blocked tickets in Phase E will execute in board-fetch order, potentially producing confusing PR conflicts. The pre-flight `readiness-report.md` writer (PR 12c) surfaces board-side blocker hints as NON-GRADING warnings in the report header so users see them, but they don't affect color verdicts.

Three paragraph changes total. PR 0 description incorporates the reworded rationale.

### DA-major-4: Interactive "amend ticket context" hand-waving

DA2 caught: v2's "yellow → print questions, read stdin, amend, re-grade" didn't spec what "amend" means.

**Resolution — PR 10 spec for interactive amendment:**

1. Print yellow questions to stdout
2. Read single line of user input per question (stdin)
3. Construct an **in-memory `amendedTicket`** = `{ ...ticket, description: ticket.description + '\n\n## User amendment (in-memory only, not persisted)\n' + answers.join('\n') }`
4. Re-grade `amendedTicket`, NOT the original `ticket`
5. **Tell the user explicitly:** `"Amendment is for this run only. Update the board or local ticket file separately if you want it persisted."`
6. Cap at 3 re-grade rounds total (DA3 nice-to-fix from round 1). After 3 rounds still not green → exit 1 with the final verdict.

Nothing is written back to the board. Nothing is persisted to disk. PR 10 test matrix covers: green-first-try, yellow-then-green (1 round), yellow-then-yellow-then-green (2 rounds), 3-rounds-still-yellow (exit 1), red-immediately (exit 1, no amendment prompt).

### Nice-to-fixes resolved inline

| # | DA2 finding | v3 resolution |
|---|---|---|
| 1 | `tokensIn/Out` cargo cult (v2 dropped them assuming unavailable) | **RESTORE** them — research found `--output-format json` exposes `.usage.input_tokens/output_tokens`. Also add `sessionId`. |
| 2 | PR count drift (v2 said 26, actual 28) | v3 re-counts (see §5 below). With added improvement PRs + PR 3.5 split, v3 count is **32 PRs**. |
| 3 | PR 12c explicit `atomicWrite.ts` ownership | PR 12c "Touches" list explicitly includes `packages/dev/src/artifacts/atomic-write.ts` (NEW) + `atomic-write.test.ts` (NEW). |
| 4 | Q-v2-3: pre-seed `branchSetup` skip | Not needed. `computeBranches` runs inside `ticketFetch` regardless; `branchSetup` reads the computed values. Verified by DA2. |
| 5 | Q-v2-4: `executeQueue.maxIterations` default | Default to `Math.min(queue.length, 100)`. 1-line consistency fix with `executeFixedCount`. |
| 6 | Q-v2-5: Windows atomic-write | Phase E doesn't target Windows. `// TODO(windows): non-atomic on Windows due to rename-over-existing; revisit when Windows support lands.` comment in `atomic-write.ts`. NOTICED BUT NOT TOUCHING. |
| 7 | Q-v2-6: cost estimate token source | Hardcoded constants in `preflight-batch.ts`: `AVG_INPUT_TOKENS_PER_GRADE = 2000`, `AVG_OUTPUT_TOKENS_PER_GRADE = 500`, `HAIKU_INPUT_COST_PER_1K = 0.001`, `HAIKU_OUTPUT_COST_PER_1K = 0.005`. Printed in cost-estimate line before loop. |
| 8 | PR 9 fitness fixture source | PR 9 description enumerates the specific Clancy PR shas used as green/red fixtures. |
| 9 | Cut B label in dependency graph | Corrected in §5 below — Cut B completes at PR 8c, not PR 9. |
| 10 | Implicit PR 11c ← PR 4c edge | Added explicit edge in §5 below. |

---

## 5. Move-first-improve-second policy — concrete implementation

### 5.1 Policy restatement (locked)

For every PR in `2a/2b/2c/3a/3b/3.5/4a/4b/4c`:

1. **Pure `git mv` + import rewrites only.** Every file shows `similarity index 100%` in `git log --stat -M`. No logic, style, rename, or test changes beyond import paths.
2. **PR description includes NOTICED list** — bulleted improvement opportunities with `file:line` refs. Zero fixes in the move PR.
3. **Separate improvement PRs** land after the corresponding move chain completes. Each improvement PR targets ONE cluster (one lifecycle module, one pipeline phase, etc) for reviewability.
4. **Improvement PRs evaluate against current standards.** Per `docs/RATIONALIZATIONS.md:55`, don't let "the old code did it this way" gatekeep the improvements.
5. **NOTICED list becomes PROGRESS.md tracking items.** At end of Phase E (PR 13), any NOTICED items that didn't get addressed are carried forward into a "Phase E deferred improvements" section of PROGRESS.md so they don't get forgotten.

### 5.2 Expected improvement PRs (sketch)

I'm not pre-committing to specific improvements — the NOTICED lists will surface them at move time. But the likely clusters based on reading the code during research:

- **`cli-bridge` simplification** — current code has defensive `null`-checking on stdout that's easier to express with modern TS narrowing. ~20 LOC reduction.
- **`dep-factory` wiring** — v1 of dev's dep-factory likely has repetitive `make*` helpers that can collapse into a single factory with a config object. ~40 LOC reduction.
- **Pull-request platform handlers** (6 modules) — probably have duplicated error-shape handling that can extract to a shared helper. ~60 LOC reduction.
- **`rework` module** — DA1 flagged it's ~1,214 LOC which feels high; likely has opportunity for a readability pass.
- **Types consolidation** — PR 3.5's shared/types.ts split may reveal that `ConsoleLike` and `StdioValue` should live in a single `dev/src/types/index.ts` barrel.

**Numbering:** improvement PRs are `Nx.1`, `Nx.2`, etc where `N` is the completing move PR. E.g. `4c.1: improve cli-bridge`, `4c.2: simplify dep-factory wiring`. They land AFTER PR 4c and BEFORE PR 5. Each is S-sized.

**Estimated improvement PR count:** 3-6, depending on what NOTICED lists surface. Conservatively budget 4.

### 5.3 PROGRESS.md deferred-improvements tracking

PR 13 (docs sweep) adds a new `## Phase E deferred improvements` section to `PROGRESS.md` listing any NOTICED items that weren't picked up. This is the "remember to come back to this" promise from R5-3.

---

## 6. Updated PR sequence (v3 — 32 PRs)

**Delta from v2**: +1 (PR 3.5 shared/types.ts split), +3 estimated improvement PRs (after PR 4c). Total: 32.

| # | Title | Size | Depends | Risk |
|---|---|---|---|---|
| 0 | `📝 docs(architecture): lock Cut E schema + no-approve-dev + decision #6 revision + Q5/Q8 resolution + Option A amendments + no mid-loop` | S | — | Low |
| 1 | `📦 chore(dev): scaffold @chief-clancy/dev package skeleton (private:true)` | S | 0 (parallel) | Low |
| 1.5 | `🔒 chore(eslint): add dev boundary rule + knip.json workspaces entry` | XS | 1 | Low |
| 2a | `♻️ refactor(dev): move lifecycle cluster 1 (branch, commit-type, format, cost, lock, preflight)` | S/M | 1.5 | Low |
| 2b | `♻️ refactor(dev): move lifecycle cluster 2 (fetch-ticket, feasibility, quality, progress, outcome, resume, rework)` | M | 2a | Low |
| 2c | `♻️ refactor(dev): move lifecycle cluster 3 (deliver-ticket, deliver-epic, epic, pr-creation, pull-request)` | M | 2b | Low |
| 3a | `♻️ refactor(dev): move pipeline infrastructure (run-pipeline, context, index, test-helpers, dry-run, lock-check, preflight-phase)` | S/M | 2c | Low |
| 3b | `♻️ refactor(dev): move remaining pipeline phases` | M | 3a | Low |
| **3.5** | `♻️ refactor(dev): split terminal/runner/shared/types.ts → dev/src/types/{spawn,progress}.ts + re-export stub` | S | 3b | Low |
| 4a | `♻️ refactor(dev): move cli-bridge + notify from terminal → dev` | S | 3.5 | Low |
| 4b | `♻️ refactor(dev): move invoke-phase from terminal → dev` | S | 4a | Low |
| 4c | `♻️ refactor(dev): move deliver-phase + dep-factory from terminal → dev (buildPipelineDeps now in dev)` | M | 4b | Medium |
| **4c.1** | `♻️ refactor(dev): improve cli-bridge null-handling + error narrowing` (NOTICED follow-up) | S | 4c | Low |
| **4c.2** | `♻️ refactor(dev): simplify dep-factory wiring (collapse make* helpers)` (NOTICED follow-up) | S | 4c.1 | Low |
| **4c.3** | `♻️ refactor(dev): extract shared PR-handler error-shape helper` (NOTICED follow-up — OPTIONAL, only if NOTICED list surfaces it) | S | 4c.2 | Low |
| 5 | `🔥 chore(core): delete empty core/dev/ + prune core/index.ts re-exports` | S | 4c.3 (or 4c.2 if 4c.3 skipped) | Low |
| 6 | `📦 chore(dev): scaffold installer infrastructure (bin/dev.js, install.ts, tests)` | M | 5 | Low |
| 6.5 | `✨ feat(dev): no-op entrypoints (dev.ts, loop.ts) printing version` | XS | 6 | Low |
| 7 | `📦 chore(dev): esbuild config + clancy-dev.js + clancy-dev-autopilot.js bundles` | M | 6.5 | Medium |
| 8a | `✨ feat(dev): three-state install preflight` | S | 7 | Low |
| 8b | `✨ feat(dev): /clancy:dev {ticket} slash command + workflow markdown` | S | 8a | Low |
| 8c | `✨ feat(dev): single-ticket executor (pre-seeded ctx.ticket) + Cut B acceptance test` | M | 8b | Medium |
| 9 | `✨ feat(dev): readiness.md rubric (5 checks) + claude-spawn.ts + zod/mini verdict parser + mock-grader fitness test + live-fitness CI workflow` | M | 8c | Low |
| 10 | `✨ feat(dev): wire spawn-based readiness grading into /clancy:dev (interactive + 3-round amendment + --bypass-readiness) + Cut C acceptance test` | M | 9 | Medium |
| 11a | `✨ feat(dev): executeQueue + executeFixedCount primitives in dev (two entry points, opaque run/shouldHalt)` | M | 10 | Low |
| 11b | `♻️ refactor(terminal): migrate autopilot to use executeFixedCount from @chief-clancy/dev` | S | 11a | Medium |
| 11c | `♻️ refactor(dev): move FATAL_ABORT_PHASES + checkStopCondition from terminal → dev` | S | 11b, 4c | Low |
| 12a | `✨ feat(dev): /clancy:dev --loop slash command + loop.ts entrypoint + autopilot bundle activation` | S | 11c | Low |
| 12c | `✨ feat(dev): pre-flight batch grading + readiness-report.md writer + error matrix (timeout/retry/partial/cap/dedupe/atomic/rotate/mkdir/cost) + atomic-write.ts helper` | M | 12a | Medium |
| 12d | `✨ feat(dev): AFK matrix (interactive/afk/afk-strict) + run-summary.md + deferred.json + drift.json + Cut D acceptance test` | M | 12c | Medium |
| 13 | `📝 docs: Phase E phase summary + PROGRESS.md update + deferred-improvements list + delete terminal re-export stub` | S | 12d | Low |
| 13.5 | `📦 chore(dev): flip private:true → false + changeset bumping to 0.1.0 + publint/attw green` | XS | 13 | Low |

**Total: 32 PRs** (29 in v2 + PR 3.5 + 3 improvement PRs).

### Dependency graph (v3)

```
PR 0 (docs)  ∥  PR 1 (scaffold)
                     │
                     ▼
                  PR 1.5 (eslint)
                     │
                     ▼
              PR 2a ─► 2b ─► 2c
                              │
                              ▼
                        PR 3a ─► 3b
                                  │
                                  ▼
                              PR 3.5  (shared/types.ts split)
                                  │
                                  ▼
                              PR 4a ─► 4b ─► 4c
                                              │
                                              ▼
                                      PR 4c.1 ─► 4c.2 ─► (4c.3)
                                                            │
                                                            ▼
                                                        PR 5
                                                            │
                                                            ▼
                                             PR 6 ─► 6.5 ─► 7
                                                              │
                                                              ▼
                                                       PR 8a ─► 8b ─► 8c (Cut B ✓)
                                                                         │
                                                                         ▼
                                                                      PR 9
                                                                         │
                                                                         ▼
                                                                      PR 10 (Cut C ✓)
                                                                         │
                                                                         ▼
                                                                      PR 11a ─► 11b ─► 11c
                                                                                         │
                                                                                         ▼
                                                                                     PR 12a ─► 12c ─► 12d (Cut D ✓)
                                                                                                              │
                                                                                                              ▼
                                                                                                         PR 13 ─► 13.5
```

**Parallelizable pairs:** PR 0 ∥ PR 1. Improvement PRs 4c.1/4c.2/4c.3 could theoretically parallelize with each other but the branch overhead isn't worth it — ship sequentially.

---

## 7. Validation criteria (updated for v3)

Unchanged from v2 except:

- [ ] `@chief-clancy/dev` exports `invokeClaudeGrader` + `withConcurrency` from `src/agents/claude-spawn.ts`
- [ ] `packages/dev/src/types/spawn.ts` and `packages/dev/src/types/progress.ts` exist
- [ ] `packages/terminal/src/runner/shared/types.ts` deleted (the re-export stub is removed in PR 13)
- [ ] `packages/dev/src/artifacts/atomic-write.ts` exists and is covered by tests
- [ ] `readiness.md` ships with `--json-schema` equivalent in `src/agents/schema.json` (or generated at build time)
- [ ] Mock-grader fitness test runs on every push and passes ≥16/20
- [ ] Live fitness test runs on `readiness.md` changes only (path-filtered CI), asserts ≥16/20
- [ ] `CLANCY_DEV_GRADING_MODEL` env var override works; default is `claude-haiku-4-5`
- [ ] `ANTHROPIC_API_KEY` required in env for dev runtime — fails fast with clear error if unset
- [ ] `ReadinessVerdict` schema includes `tokensIn`, `tokensOut`, `sessionId`, `agentModel`, `gradingDurationMs`, `repoSha` — all populated
- [ ] Phase E PROGRESS.md has "deferred improvements" section listing any NOTICED items that didn't ship as 4c.N PRs
- [ ] All 9 move PRs (`2a/2b/2c/3a/3b/3.5/4a/4b/4c`) show `similarity index 100%` on every moved file (`git log --stat -M`)
- [ ] All improvement PRs (`4c.1/4c.2/[4c.3]`) evaluated against current standards, not ported-code standards

---

## 8. Open questions for DA round 3

Very few — v3 has addressed the known findings. These are the only places I'm uncertain:

**Q-v3-1.** Does `--bare` + `--json-schema` work together? Research didn't explicitly confirm both flags on the same invocation. Worth a smoke test in PR 9 before wiring the rubric as the load-bearing path. If they don't compose, fall back to `--output-format json` + in-code schema validation.

**Q-v3-2.** Is 4c.3 (shared PR-handler error-shape helper) a real improvement or speculative? The NOTICED list at PR 4c completion determines this. If no shared error-shape pattern surfaces in practice, drop 4c.3 entirely.

**Q-v3-3.** Does `claude -p --bare` actually read from stdin (piped `input:`) the same way as without `--bare`? Almost certainly yes (headless mode is explicitly designed for piped input) but worth a sanity smoke test in PR 9.

**Q-v3-4.** The re-export stub in terminal's `shared/types.ts` (PR 3.5) is deleted in PR 13. Is that the right timing, or should it go in its own PR between 11b and 12a? I'm leaving it in PR 13 because by then every consumer has migrated and the deletion is mechanical, but DA may push back.

**Q-v3-5.** `CLANCY_DEV_GRADING_MODEL` env var — should it also be settable per-invocation via `--model` flag on `/clancy:dev`? I lean yes for flexibility but haven't spec'd it in PR 10. DA check.

---

**End of v3 deltas. Read alongside v1 + v2 for full context. v3 is ready for DA round 3 sanity-check.**

---

## 9. Scan extraction — `@chief-clancy/scan` (added Session 66)

### Problem

`/clancy:map-codebase` lives only in terminal. It produces `.clancy/docs/` (10 structured codebase docs via 5 parallel agents). Brief, plan, and dev all reference these docs in their workflows but have no way to produce them standalone. Additionally, terminal's installer has a pre-existing bug: the 5 agent files (`tech-agent.md`, `arch-agent.md`, `quality-agent.md`, `design-agent.md`, `concerns-agent.md`) are never copied to the user's machine — the workflow references `src/agents/` paths that don't exist post-install.

**Release blocker for dev.** Dev executes tickets against the codebase. Without `.clancy/docs/`, the prompt-builder has no codebase context and implementations will be significantly lower quality.

### Decision: new `@chief-clancy/scan` package (consumed as dependency, not user-facing)

Create `@chief-clancy/scan` as a published npm package containing only markdown files:

- `src/agents/` — 5 agent prompts (~600 lines total)
- `src/commands/` — `map-codebase.md`, `update-docs.md`
- `src/workflows/` — `map-codebase.md`, `update-docs.md`

No installer, no `bin` field, no TypeScript runtime. Just `"files": ["src"]` in `package.json`. The package exists purely so other packages can depend on it and resolve its files at install time.

**Consuming packages add `@chief-clancy/scan` as a dependency.** Each package's installer resolves scan's source directories (e.g. `require.resolve('@chief-clancy/scan/package.json')` → find root → `src/agents/`) and copies the files alongside its own commands/workflows. Users never run `npx @chief-clancy/scan` — they run `npx @chief-clancy/dev` (or brief, plan, terminal) and get scan's files automatically.

### Why not the alternatives

- **Copy to each package (Option A):** 5 complex agent prompts × 4 packages = drift risk. When an agent prompt improves, 4 copies need updating. Single source of truth is critical for ~600 lines of nuanced scanning instructions.
- **Move to dev (Option C):** brief and plan need the docs too. Making brief depend on dev breaks the "standalone packages have zero deps on dev/terminal" rule.
- **Shared monorepo directory without npm package:** Works for terminal (monorepo-relative path) but doesn't work for brief/plan/dev when installed from npm — they can't resolve monorepo-relative paths.
- **Standalone `npx @chief-clancy/scan`:** Adds a user-facing install step. Users shouldn't need to know about scan as a separate concept.

### What each consuming package does

| Package | Adds scan as dep | Installer copies agents | Installer copies commands/workflows | Install output mentions map-codebase |
| ------- | ---------------- | ---------------------- | ----------------------------------- | ------------------------------------ |
| **dev** | Yes | Yes → `.claude/clancy/agents/` | Yes → `.claude/commands/clancy/` + `.claude/clancy/workflows/` | "Recommended: Run `/clancy:map-codebase` for better results" |
| **brief** | Yes | Yes → `.claude/clancy/agents/` | Yes → `.claude/commands/clancy/` + `.claude/clancy/workflows/` | "Optional: Run `/clancy:map-codebase` for richer briefs" |
| **plan** | Yes | Yes → `.claude/clancy/agents/` | Yes → `.claude/commands/clancy/` + `.claude/clancy/workflows/` | "Optional: Run `/clancy:map-codebase` for better plans" |
| **terminal** (via chief-clancy) | Yes (in chief-clancy wrapper) | Yes → `.claude/clancy/agents/` | Yes (already has map-codebase in setup role) | Existing init flow offers map-codebase |

### Workflow wording changes

References to `.clancy/docs/` in downstream workflows must handle absence gracefully:

1. **`prompt-builder.ts`** (HARD dependency, lines 109-110): Change from unconditional "Read core docs in .clancy/docs/" to conditional "If `.clancy/docs/` exists, read: STACK.md, ARCHITECTURE.md, ... If the directory is missing, work with what you find in the codebase directly."

2. **`brief.md` line 585** (devil's advocate agent): Change "read `.clancy/docs/`" to "read `.clancy/docs/` if available".

3. **`brief.md` line 698** (Step 7 agent exploration): Already soft — agents explore what's there.

4. **`plan.md` Step 3**: Already handles absence with interactive warning. No change needed.

5. **`review.md`**: Already conditional. No change needed.

6. **`map-codebase.md` workflow**: Agent path references must change from `src/agents/` to `.claude/clancy/agents/` to match installed location.

### PR sequence (revised after DA grill)

This work inserts into the Phase E sequence. Placement: after PR 8b (shipped), before PR 8c (single-ticket executor needs the docs). **S2–S4 must be sequential** (each modifies `pnpm-lock.yaml`).

| PR | Description | Size | Depends on | Risk |
| --- | --- | --- | --- | --- |
| **S0** | `♻️ refactor: make .clancy/docs/ references conditional` — `prompt-builder.ts` (hard dep → conditional), `brief.md` lines 585/698 ("if available"), `devils-advocate.md` line 11, + prompt-builder tests. Independent of scan package. | S | None | Low |
| **S1** | `📦 chore: scaffold @chief-clancy/scan package` — new `packages/scan/` with `package.json` (`private: false`, no bin, no installer). COPY (not move) 5 scan agents from `terminal/src/agents/` (tech, arch, quality, design, concerns — NOT devils-advocate or verification-gate). COPY `map-codebase.md` + `update-docs.md` commands + workflows. Fix agent path refs from `src/agents/` to `.claude/clancy/agents/` (matches brief's established `devils-advocate.md` reference pattern). Add scan entry to `eslint.config.ts` boundaries + `knip.json`. Terminal retains its copies until S5. | S–M | None | Low |
| **S2** | `✨ feat(dev): consume @chief-clancy/scan` — add scan dep to `package.json`, add `agentsDest` + `SCAN_AGENT_FILES` / `SCAN_COMMAND_FILES` / `SCAN_WORKFLOW_FILES` to `install.ts`, resolve scan root via `createRequire`. Update `bin/dev.js` to resolve and copy scan files (accepts the dependency — scan is markdown-only, not a heavy runtime). Update install output: "Recommended: Run `/clancy:map-codebase`". | M | S1 | Low |
| **S3** | `✨ feat(brief): consume @chief-clancy/scan` — same pattern as S2 for `install.ts` + `bin/brief.js`. Update install output: "Optional: Run `/clancy:map-codebase` for richer briefs". | M | S2 (lockfile) | Low |
| **S4** | `✨ feat(plan): consume @chief-clancy/scan` — same pattern as S2 for `install.ts` + `bin/plan.js`. Update install output: "Optional: Run `/clancy:map-codebase` for better plans". | M | S3 (lockfile) | Low |
| **S5** | `✨ feat(terminal): consume @chief-clancy/scan + remove duplicates` — add scan slots to `InstallSources` (`scanCommandsDir`, `scanWorkflowsDir`, `scanAgentsDir`), add `handleScanContent`. Update `chief-clancy/bin/clancy.js` to resolve scan package root + pass source paths. **In the same PR:** remove 5 scan agent files from `terminal/src/agents/` (keep `devils-advocate.md`, `verification-gate.md`), remove `map-codebase.md` + `update-docs.md` from `terminal/src/roles/setup/commands/` + `workflows/`. Update `agents.test.ts`. Atomic swap avoids dual installation. | M | S4 (lockfile) | Medium |

**6 PRs total (S0–S5).** S0 can merge at any time. S1 is the foundation. S2–S5 are sequential (lockfile). S7 from the original plan is eliminated — install output changes are absorbed into S2–S5.

### Resolved blockers from DA grill

1. **bin/*.js zero-dependency contract (Blocker 1):** Accepted as an architectural evolution. Scan is markdown-only — not a heavy runtime dep like core or terminal. The bin file header comments ("No dependencies on @chief-clancy/core or terminal") remain true; scan is a different category (content, not code). `createRequire` resolves scan's `package.json` to find its root, then copies from `src/`. For `npx` installs, npm installs transitive deps automatically.

2. **Dual installation in terminal (Blocker 2):** S5 does both the add (handleScanContent) AND the remove (delete from src/roles/setup/) in one PR. No intermediate state with dual installation. `copyRoleFiles` uses `readdirSync` (not a static list), so removing files from the directory is safe.

3. **Global mode agent paths (Issue):** Agents use `.claude/clancy/agents/tech-agent.md` path convention (not `@`-file syntax). This matches the established pattern — brief's workflow already references `devils-advocate.md` at `.claude/clancy/agents/devils-advocate.md` (line 582 of brief.md). Claude Code resolves from `~/.claude/` in global mode.

4. **Brief wording fix (Issue):** Absorbed into S0. Lines 585, 698 in `brief.md` get "if available" conditionals. `devils-advocate.md` line 11 gets the same treatment.

5. **S2–S4 lockfile conflicts (Issue):** Sequenced S2 → S3 → S4 → S5. Each merges before the next starts.
