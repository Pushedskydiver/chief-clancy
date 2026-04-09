# Progress

## Session 57 Summary

### Phase C PR 9 shipped — optional board push from `/clancy:approve-plan`. Phase C effectively complete (5 of 5 PRs merged, PR 8 deferred)

This session shipped **PR #216** (Phase C PR 9) — `/clancy:approve-plan` now optionally pushes the approved plan to the source board ticket as a comment when the user is in standalone+board mode. Closes the "I have credentials and I want both modes" UX cliff. After PR 10 (this docs sync), Phase C is fully done and Phase D (brief absorbs approve-brief) can begin.

**PR #216 (MERGED as 3cbfcc7)** — `✨ feat(plan)`: Phase C PR 9 — optional board push from `/clancy:approve-plan`:

- New **Step 4c — Optional board push (best-effort)** in `packages/plan/src/workflows/approve-plan.md`. When approving a local plan-file stem, gates on (a) Step 4a having written a marker AND (b) board credentials present in `.clancy/.env`. Either gate failing → silent skip + continue to Step 7
- New flags: `--push` (skip prompt + push immediately, also the retry path) and `--ticket KEY` (override Source auto-detect from `**Source:**` header in the plan file). Default interactive prompt is `[y/N]` with default No — never surprise-write to a board
- Six per-platform key validation regexes inline in Step 4c, aligned to match Step 2's broader formats exactly: Jira `^[A-Za-z][A-Za-z0-9]+-\d+$`, GitHub `^#?\d+$`, Linear `^[A-Za-z]{1,10}-\d+$`, Azure DevOps `^\d+$`, Shortcut `^(?:[A-Za-z]{1,5}-)?\d+$`, Notion `^(?:notion-[a-f0-9]{8}|[a-f0-9]{32}|[a-f0-9-]{36})$`. The Notion regex lives outside the table because GFM force-escapes pipes inside table cells (real bug Copilot caught — see `feedback_workflow_md_gotchas.md`)
- Six platform comment-POST curl blocks duplicated from `plan.md` Step 5b under HTML comment drift anchors. A workflow test byte-compares the two regions and fails on mismatch — editing one without updating the other can never silently diverge
- EEXIST + `--push` retry path through Step 4a: re-running `/clancy:approve-plan {stem} --push` after a failed push falls through Step 4a's already-approved check, skips Step 4b (brief marker already updated), and re-attempts Step 4c. The original `sha256=` and `approved_at=` values are preserved
- All Step 4c progress.txt writes are deferred to Step 7 so the audit row order is always `LOCAL_APPROVE_PLAN` first, then the Step 4c outcome row (one of: `LOCAL_APPROVE_PLAN_PUSH`, `BOARD_PUSH_SKIPPED_NO_TICKET`, `LOCAL_ONLY`, or `BOARD_PUSH_FAILED`). Two-row audit per approval, never out of order
- 67 new tests (197 → **264 plan**). Test counts elsewhere unchanged: 1608 core, 836 terminal, 51 brief

**Process notes from this session — extensive review history:**

- **Architectural review** — Plan agent and general-purpose agent both 529'd from Anthropic capacity. Self-ran the architectural pass with full context loaded as the documented last-resort fallback (see `feedback_review_process.md`). COHESION + LAYERING + SCOPE all clean
- **DA review** (general-purpose agent on third attempt after two 529s): caught 6 findings (H1 missing `LOCAL_APPROVE_PLAN_PUSH` token, H2 stale Step 4a routing prose, M1 column-order inconsistency, M2 EEXIST branch ordering, L1 disambiguation contract, L2 narrow stale-prose check). All addressed in `fed52bd`
- **Copilot reviews — 5 rounds, 13 findings, every one a real bug:**
  - Round 1 (5 findings, fixed in `6792b6f`): run-condition gate self-contradiction, 2x nested-backticks-in-bold breaking Prettier rendering, wrong relative path to brief.md (one segment short), changeset column order
  - Round 2 (4 findings, fixed in `ca8ee16`): two ordering bugs where Step 4c claimed to write rows "after" Step 7 but executes BEFORE Step 7, Notion `\|` regex bug (escaped pipe matches literal pipe in JS regex, not alternation), test regex `\\?d` permissiveness (matches both `\d` and bare `d`)
  - Round 3 (1 finding, fixed in `4317ad4`): Step 4a retry section claimed "one approval row even if 4c was attempted multiple times" but Step 7's local-mode block writes per-invocation
  - Round 4 (3 findings, fixed in `6227b89`): stale "deferred to a future PR" prose at Step 2 (Step 4c was implemented in this same PR), Step 4c regexes stricter than Step 2's accepted formats (5 platform mismatches), bracketed-key parser missing Notion shapes
  - Round 5 (1 finding, fixed in `b54ec45`): Notion test assertions too permissive — same class as the round 2 `\\?d` finding
- **Cleanup:** 17 PR/slice references stripped from runtime workflow prose in `6baec2a` after Alex flagged that workflow files are Clancy's working knowledge, not a changelog. Captured as `feedback_no_pr_history_in_prompts.md`

**Review-process improvements triggered by the PR 9 review history:**

After 5 rounds of Copilot findings, Alex asked whether any of the bugs should have been caught earlier. Analysis: **6-7 of 13 findings** were preventable by zero-cost discipline improvements. Captured the improvements in `feedback_review_process.md`:

1. **Post-restructure consistency sweep** — when a slice rewrites a load-bearing model (column order, write ordering, gate semantics), grep the whole file for the load-bearing concept and re-read every hit. The R2/R3 rounds were almost entirely downstream of the M1 column-order restructure I touched 5 of 6 places for. One sweep would have caught all of them
2. **Schema-pair check** — when two sections describe the same accept/reject set (parser/validator, Step N preflight/Step M validation, matrix/flag prose), read them side-by-side with 3-5 example inputs. R4#2 and R4#3 were both schema-pair mismatches between sections written in different slices that were never read together
3. **Broadened stale-reference sweep** — `feedback_no_pr_history_in_prompts.md` updated with a second regex for forward-references (`deferred to a future|TODO|FIXME|coming soon|will be added`). The original sweep only looked for `PR \d+|slice \d|Phase [A-D]` and missed R4#1
4. **DA prompt required sections** — four explicit checks the DA agent runs every PR: cross-section consistency, schema-pair audit, test permissiveness audit, stale forward-reference sweep. Documented as non-negotiable

PR 10 is the first PR to apply these disciplines on real work.

**Test counts at end of session:** 1608 core, 836 terminal, 51 brief, **264 plan** (197 baseline + 67 from PR 9)

**Memories added/updated this session:**

- `feedback_workflow_md_gotchas.md` — four traps that bit PR 9 (GFM table-pipe escaping, `\\?d` test permissiveness, nested-backtick bold, multi-step audit-log ordering)
- `feedback_no_pr_history_in_prompts.md` — runtime prompts must not contain PR/slice/phase OR stale forward-references
- `feedback_review_process.md` — added post-restructure sweep, schema-pair check, DA prompt required sections
- `project_status.md` — Phase C ~83% → done after PR 10; PR 9 merged

---

## Session 56 Summary

### Clean handoff boundary — only PROGRESS.md update for Session 55

This session was a clean handoff boundary. Only updated PROGRESS.md with the Session 55 summary (PR #213 closed without merging on cohesion concern, PR #214 deferral cleanup merged, `/clancy:implement-from` deferred to `@chief-clancy/dev`). No code changes — the next session would start PR 9.

---

## Session 55 Summary

### Phase C PR 8 attempted, deferred — `/clancy:implement-from` postponed to `@chief-clancy/dev`

This session opened PR #213 (the full PR 8 `/clancy:implement-from` implementation), then closed it without merging after a cohesion concern surfaced post-DA-review. PR #214 shipped the deferral cleanup. Phase C is now ~67% done (4 of 6 PRs merged; PR 8 deferred, not counted).

**PR #213 (CLOSED, not merged)** — `✨ feat(plan)`: PR 7d-equivalent `/clancy:implement-from`:

- Full implementation of the marker-gated `/clancy:implement-from <stem>` command in `@chief-clancy/plan`: read `.approved` marker, verify SHA-256 still matches the plan file, refuse on Stale, drive the implementation loop
- DA review passed; architectural review surfaced the concern: shipping a code-implementing command inside `@chief-clancy/plan` violates package cohesion. The plan package's job is planning lifecycle (write plan → approve plan). Actually executing the plan is a separate concern that wants its own home
- Closed the PR rather than merging. The full branch (`feature/phase-c-pr-8-implement-from`) and PR #213 are preserved as the reference implementation for whoever ships `@chief-clancy/dev` later
- Lesson recorded as `feedback_layering_vs_cohesion.md`: the original Phase C lock asked only the layering question (does `plan` already own approve-plan? yes → fine to also own implement-from). It missed the cohesion question (is implementing code part of planning lifecycle? no). Future package-scope decisions need both lenses

**PR #214 (MERGED)** — `🔥 chore(plan)`: defer `/clancy:implement-from` until `@chief-clancy/dev` lands:

- Removed the `/clancy:implement-from` command + workflow from `@chief-clancy/plan` (plan tests back to the 197 baseline from PR 7c)
- Step 8 inventory: dropped the fourth `Implemented` state. Inventory now shows three states only — `Planned`, `Approved`, `Stale (re-approve)` — until the consumer ships
- Neutralised every forward-reference to `/clancy:implement-from` and "PR 8" on `main`: now points at "a future plan-implementing tool" / "deferred to `@chief-clancy/dev`". Touched README files, command/workflow prose, and the locked roadmap
- The `.clancy/plans/{stem}.approved` marker format from PR 7b ships **unchanged** (`sha256={hex}\napproved_at={ISO 8601}\n`). The eventual consumer plugs in without re-approving existing plans
- Approval stays in `plan` (planning lifecycle, not implementation). Phase D's brief→approve-brief move still ships as planned
- Follow-up commit (`e08eb1e`) addressed Copilot review on the deferral cleanup

**Test counts at end of session:** 1608 core, 836 terminal, 51 brief, **197 plan** (back to PR 7c baseline)

**Key versions shipped:** `@chief-clancy/plan@0.4.1`, `@chief-clancy/terminal@0.1.6`, `chief-clancy@0.9.11`

### Process notes from this session

- **Architectural review must run before DA, as a separate pass.** DA review on PR #213 passed clean — DA catches implementation defects but won't catch package-scope concerns. The cohesion problem only surfaced when an architectural pass asked "does this command belong in this package's identity?" Going forward: architectural review (Plan agent) → DA review → self-review → PR
- **The Plan agent kept 529'ing during the architectural pass.** Fall back to the general-purpose agent with the same prompt if it happens again
- **Closing a merged-ready PR is the right move when a fundamental concern surfaces late.** The cost of unwinding PR 8 from `main` later would have been much higher than closing #213 and shipping the deferral cleanup
- **DA is non-negotiable even on cleanup PRs.** Re-affirmed during PR #214

### Memories added/updated this session

- `project_implement_from_deferred.md` — do NOT re-ship `/clancy:implement-from` in plan/terminal; deferred to `@chief-clancy/dev`
- `feedback_layering_vs_cohesion.md` — package-scope decisions need both layering AND cohesion lenses
- `project_status.md` — Phase C ~67% done; PR 8 deferred; next is PR 9

---

## Session 54 Summary

### Phase C kickoff — PRs 6b, 7a, 7b, 7c shipped (4 PRs + roadmap docs commit + handoff docs)

This session shipped PR 6b (the last of Phase B) plus all three sub-PRs of Phase C PR 7. Phase C is now ~50% complete (4 of 6 PRs done). Plan tests went from 115 → **197**.

**PR #204** — `--list` inventory + README (PR 6b):

- `--list` flag in command + workflow short-circuits at top of Step 1 (no installation detection, no `git fetch`, no docs/branch checks, no standalone guard)
- New Step 8 — Plan inventory: scans `.clancy/plans/`, parses Plan ID / Brief / Row / Source / Planned headers, displays sorted by date with deterministic tie-breakers
- Reserved a `Status` column hardcoded to `Planned` so PR 7c could later wire it to live state without breaking the listing format
- README rewritten with full local planning workflow walkthrough
- 16 new tests (115 → 131 plan)
- DA review caught 1 critical, 2 high, 3 medium, 4 low — all addressed before push

**PR #206** — `📝 docs(progress)`: lock Phase C+D roadmap (chore):

- Updated PROGRESS.md with the locked Phase C+D breakdown after a planning session: 3 Plan agents in parallel + 1 DA agent + 1 research agent on the brief asymmetry question
- Six findings reversed the original draft (most importantly: brief should also absorb its `approve-brief` in Phase D, and the `.approved` marker must store SHA-256 + timestamp instead of being empty-touch)
- Locked sequence: PR 7a → 7b → 7c → 8 → 9 → 10 → 11a → 11b → 12

**PR #207** — `✨ feat(plan)`: PR 7a plumbing — move approve-plan into @chief-clancy/plan:

- Byte-identical move of approve-plan command + workflow from `packages/terminal/src/roles/planner/` → `packages/plan/src/{commands,workflows}/`. Git records both as 100% renames
- Terminal's `plan-content.ts` extended to copy both `plan.md` AND `approve-plan.md`. Constants split into `PLAN_COMMAND_FILES` / `PLAN_WORKFLOW_FILES` (mirrors brief-content's separate-constant convention)
- `packages/terminal/src/roles/planner/` deleted entirely. `planner` becomes a "virtual role" — concept stays in `installer/ui.ts`, `CLANCY_ROLES` env parsing, and `plan-content.ts`'s gate, but no terminal-owned files
- `roles.test.ts` gained a `VIRTUAL_ROLES` constant + positive "no on-disk directory" assertion that scales for Phase D when strategist follows
- Standalone installer (`bin/plan.js` + `install.ts`) deliberately did NOT ship approve-plan yet — DA review caught that adding it would surface a board-only command as a runtime failure for `npx @chief-clancy/plan` users
- 836 terminal tests (was 834), 131 plan tests (unchanged)
- DA review caught 2 high (standalone installer scope leak) + 1 medium (PLAN_FILES over-coupling) — all addressed before push

**PR #209** — `✨ feat(plan)`: PR 7b standalone-aware approve-plan with SHA-256 marker:

- Step 1 rewritten with three-state preflight (standalone / standalone+board / terminal) mirroring plan.md
- Step 2 dual-mode resolver: standalone needs a plan-file stem; standalone+board / terminal try plan-file lookup first then ticket-key validation; plan stems win on collision; plan-file scan filters to actual plan files (must contain `## Clancy Implementation Plan` heading)
- New Step 4a writes `.clancy/plans/{stem}.approved` with race-safe `O_EXCL`. Body is two `key=value` lines: `sha256={hex}\napproved_at={ISO 8601}\n`. Explicit numbered "read plan → compute SHA → open marker for exclusive create" order of operations. EEXIST handled with manual remediation advice (no ghost `--fresh` flag)
- New Step 4b updates source brief marker `<!-- planned:1,2 -->` → `<!-- approved:1 planned:1,2 -->` with tolerant regex. Best-effort: failure does NOT roll back the local marker
- Step 7 gained a mode gate at the top so local-mode and board-success-message branches never double-render. New `LOCAL_APPROVE_PLAN | sha256={first 12 hex}` log token
- Standalone installer (`bin/plan.js` + `install.ts`) now ships approve-plan (the bit deferred from PR 7a)
- README Approving plans section with three install-mode examples
- Existing 970-line board transport flow (Steps 5/5b/6) byte-preserved
- 185 plan tests (was 132 → +53)
- DA review caught 2 critical, 3 high, 5 medium — all addressed before push
- Copilot review caught 6 follow-ups across 2 rounds (stale Step 5a refs, Step 6 transition predicate, sha example truncation, brief-marker update is best-effort, Step 7 success block must be conditional, README same-issue) — all fixed and replied to

**PR #211** — `✨ feat(plan)`: PR 7c Step 8 inventory live Approved/Stale status:

- Step 8 Status column reads sibling `.approved` marker live, parses `sha256=` line, hashes the current plan file, reports `Planned` / `Approved` / `Stale (re-approve)`
- Inventory format switched from space-delimited columns to a pipe-delimited markdown table so multi-word states are unambiguous
- Example shows all three states + a summary line spec'd in the procedure (zero-count states omitted)
- **Footer cleanup** — fixed FOUR other stale "install the full pipeline" footers in `plan.md` (Steps 6/7) that were already wrong since PR 7b shipped approve-plan in the plan package
- Implemented state explicitly reserved for PR 8 in the prose
- Malformed `.approved` markers (missing/invalid `sha256=` line) fold into `Stale (re-approve)` with a delete-and-recreate hint
- 197 plan tests (was 191 → +6)
- DA review caught 2 high, 3 medium, 2 low — all addressed before push
- Copilot review caught 4 follow-ups across 3 rounds (Overview line scoping, malformed marker rule, `<plan-id>` vs `{plan-id}` placeholder consistency, regex test "bug" that wasn't actually a bug but the upgrade was worth taking) — all fixed and replied to

**Test counts at end of session:** 1608 core, 836 terminal, 51 brief, **197 plan**.

**Key versions shipped:** `@chief-clancy/plan@0.4.0`, `@chief-clancy/terminal@0.1.6`, `chief-clancy@0.9.10`

### Process notes from this session

- DA review caught real things every PR: PR 7a's standalone installer scope leak (would have shipped a broken command), PR 7b's stale Step 5a refs + Step 6 transition predicate + brief-marker best-effort wording, PR 7c's stale "install the full pipeline" footers across the rest of plan.md. Skipping DA on a "small" PR would have shipped 8+ defects across the session
- Pre-PR planning session (3 Plan agents in parallel + 1 DA + 1 research) reversed two early decisions that would have shipped: empty `.approved` marker (PR 8 gate would have been brittle without metadata) and "approve-brief stays in terminal forever" (research showed brief already ships board-setup, making the UX cliff identical to plan's)
- Copilot reviewer caught 10 distinct follow-ups across PR 7b/7c rounds. About half were factual misstatements I'd made about Step 6's behaviour or stale references; one (the regex "bug") was a misreading of JS syntax that I corrected in the reply but accepted the underlying upgrade anyway

---

## Phase C+D roadmap locked (2026-04-08)

Phase B shipped. Before starting Phase C, ran a planning session: 3 Plan agents in parallel (one per PR) → 1 DA agent over the combined plans → 1 research agent on the brief asymmetry question. Six findings reversed the original draft. The full locked roadmap lives in `.claude/plans/plan-package-extraction.md` (local-only working state — `.claude/` is gitignored). The headline tables and key decisions below are the canonical reference for the repo.

### Phase C — Plan local approve + implement (PRs 7-10)

| #      | Title                                                               | Size      | Labels                  |
| ------ | ------------------------------------------------------------------- | --------- | ----------------------- |
| **7a** | Plumbing: move approve-plan + delete terminal planner dir + helpers | M (~4h)   | feature, plan, terminal |
| **7b** | Standalone approve-plan with SHA-256 marker                         | L (~6-8h) | feature, plan           |
| **7c** | plan.md Step 8 live Approved status                                 | S (~30m)  | feature, plan           |
| **8**  | `/clancy:implement-from` + `--list` Implemented state               | M (~5-6h) | feature, plan           |
| **9**  | Standalone+board: optional board push from approve-plan             | M (~4-5h) | feature, plan           |
| **10** | Phase C cleanup + docs sync                                         | S (~1-2h) | chore, plan, terminal   |

### Phase D — Brief absorbs approve-brief (PRs 11-12)

| #       | Title                                                                 | Size      | Labels                   |
| ------- | --------------------------------------------------------------------- | --------- | ------------------------ |
| **11a** | Plumbing: move approve-brief + delete terminal strategist dir         | M (~3-4h) | feature, brief, terminal |
| **11b** | Standalone+board approve-brief with three-state detection             | M (~4-5h) | feature, brief           |
| **12**  | Phase D cleanup + final asymmetry-removed update to package-evolution | S (~1h)   | chore, brief, terminal   |

### Key locked decisions

- **`.approved` marker contains SHA-256 + timestamp** (`sha256=...\napproved_at=...\n`), not empty-touch. PR 8's gate compares the current plan's hash to the marker. Eliminates the brittle "feedback heading at column 0" heuristic the early plan proposed
- **`/clancy:implement-from` lives in the plan package**, ruled out absorbing terminal's `/clancy:implement` (would drag `runPipeline` + 13 pipeline phases into a "light dep" package), new `@chief-clancy/dev` package (premature per [package-evolution.md:114](docs/decisions/architecture/package-evolution.md#L114)), and `--from` flag on terminal's implement (kills standalone story)
- **`--bypass-approval` flag required to skip the gate** even with `--afk`. Approval is the only thing between "plan generated" and "code changes applied"; warnings scroll past in non-interactive runs
- **Brief asymmetry reversed:** brief should ALSO own its approve command. The original "approve-brief stays in terminal" decision was wrong — the 1540-line approve-brief workflow has zero terminal-only coupling, brief already ships board-setup, and forcing standalone+board brief users to install the full pipeline just to push tickets is the same UX cliff PR 7 fixes for plan. Phase D ships this after Phase C lands and stabilises
- **Strict sequence:** PR 7a → 7b → 7c → 8 → 9 → 10 → 11a → 11b → 12. Each PR's tip must be green; intermediate commits inside a PR don't matter

---

## Next: PR 8 — `/clancy:implement-from` in plan package

Full PR 8 step-by-step lives in the local-only `.claude/plans/plan-package-extraction.md` Phase C section. Headline scope (~5-6h):

- New `packages/plan/src/commands/implement-from.md` and `packages/plan/src/workflows/implement-from.md`
- Add to `COMMAND_FILES` / `WORKFLOW_FILES` arrays in plan installer + bin + terminal `plan-content.ts`. Update structural tests
- `/clancy:implement-from .clancy/plans/{stem}.md` reads the local plan file
- **Approval gate (the load-bearing bit):** read sibling `.approved` marker. If missing → block with "Plan not approved. Run `/clancy:approve-plan {stem}` first." If present, hash the current plan file, compare to marker's `sha256`. Match → proceed. Mismatch → block with "Plan changed since approval." Reuses the SHA-256 + marker format PR 7b shipped
- **`--bypass-approval` flag** required to skip the gate even with `--afk` (per locked decision: approval is the only thing between "plan generated" and "code changes applied"; warnings scroll past in non-interactive runs)
- Plan section parsing (prompt-only, no TS — Claude reads the markdown): `### Affected Files` table, `### Test Strategy` checklist, `### Acceptance Criteria` checklist, `### Implementation Approach` paragraph
- New log tokens: `LOCAL_IMPLEMENT | {stem} | {N} files`, `LOCAL_BLOCKED | {stem} | not approved` or `... | sha mismatch`, `LOCAL_BYPASS | {stem} | {N} files`
- **Wire `Implemented` state into [`plan.md` Step 8](packages/plan/src/workflows/plan.md#L1093):** scan `.clancy/progress.txt` for `LOCAL_IMPLEMENT` entries matching the plan id. Status column gains a fourth state
- Changeset: plan minor

The PR 7c work explicitly reserved the `Implemented` state in Step 8's prose so PR 8's diff stays narrow.

After PR 8: PR 9 (standalone+board optional board push from approve-plan), then PR 10 (Phase C cleanup + docs sync), then Phase D (PRs 11a/11b/12 — brief absorbs approve-brief).

### Build order (remaining standalone packages)

1. ~~`@chief-clancy/brief`~~ — **done** (Phase D in roadmap)
2. ~~`@chief-clancy/plan`~~ — Phase A+B done, Phase C in progress
3. `@chief-clancy/design` — same pattern + Stitch integration
4. `@chief-clancy/dev` — extract from core when chat arrives
5. `@chief-clancy/cli` — interactive wizard
6. `@chief-clancy/chat` — conversational interface (Slack/Teams)
