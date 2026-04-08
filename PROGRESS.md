# Progress

## Session 53 Summary

### @chief-clancy/plan Phase B complete — PR 6b shipped + Phase C/D roadmap locked

**PR #204** — Add `--list` inventory + README (PR 6b):

- `--list` flag in command + workflow short-circuits at top of Step 1 (no installation detection, no `git fetch`, no docs/branch checks, no standalone guard)
- New Step 8 — Plan inventory: scans `.clancy/plans/`, parses Plan ID / Brief / Row / Source / Planned headers, displays sorted by date with deterministic tie-breakers
- Reserved a `Status` column today (always `Planned`) so PR 7c can wire it to live `Approved` state without breaking the listing format
- README rewritten with full local planning workflow walkthrough covering `--from`, row targeting, `--afk`, `--list`, and the `## Feedback` revision loop
- 16 new tests (115 → 131 plan)
- DA review caught C1/H1/H2/M1/M2/M3/L1/L2/L3/L4 — every finding addressed before push (slug vs Plan ID terminology, Step 1 short-circuit, explicit guard skip, sort tie-breakers, Status column placeholder, --list precedence wording, strengthened tests beyond tautological greps)

Test counts: 1608 core, 834 terminal, 51 brief, **131 plan**.

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

## Next: PR 7a — Plumbing for Phase C

Full PR 7a step-by-step lives in the local-only `.claude/plans/plan-package-extraction.md` Phase C section. Headline scope:

- Move `approve-plan.md` (command + workflow) from `packages/terminal/src/roles/planner/` → `packages/plan/src/{commands,workflows}/` byte-identical
- Convert `plan-content.ts` const strings to arrays, loop over them
- Extend plan installer + bin file lists
- Delete `packages/terminal/src/roles/planner/` entirely (planner becomes virtual role)
- Update `roles.test.ts` and `role-filter.test.ts` fixtures
- Add `packages/plan/test/helpers/fixtures.ts` (TS builders matching existing `packages/terminal/test/helpers/fixtures.ts` convention)
- Changeset: plan minor + terminal patch

### Build order (remaining standalone packages)

1. ~~`@chief-clancy/brief`~~ — **done** (Phase D in roadmap)
2. ~~`@chief-clancy/plan`~~ — Phase A+B done, Phase C in progress
3. `@chief-clancy/design` — same pattern + Stitch integration
4. `@chief-clancy/dev` — extract from core when chat arrives
5. `@chief-clancy/cli` — interactive wizard
6. `@chief-clancy/chat` — conversational interface (Slack/Teams)
