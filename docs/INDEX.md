# INDEX

Scenario-organized router. Maps trigger situations to the docs Claude consults + the protocol Claude follows.

**When to consult**: per `CLAUDE.md` Process directives — before Edit/Write on policy-adjacent paths (`CLAUDE.md`, `docs/**/*.md`, `.claude/agents/*.md`, `.github/copilot-instructions.md`), AND after `gh pr merge` of a PR containing `.changeset/*.md`.

**What this is**: a router. Authoritative content lives in `docs/DEVELOPMENT.md`, `docs/DA-REVIEW.md`, etc. — this doc points; it does not re-encode.

**What this is not**: a file inventory, a RAG substrate, a permission system, a replacement for any other policy doc.

**Affected-files taxonomy**: each scenario splits files into:

- **Observed** — touched by a cited evidence PR (verified via diff).
- **Derived** — principled additions based on scenario class; not yet exercised by a cited PR. Treat as lower-confidence; promote to Observed when a real PR triggers them.

**Maintenance**: scenarios drift like any other doc. The sibling-sweep rule (`docs/DA-REVIEW.md §Cross-doc consistency sweep (d)`) catches stale INDEX entries on the next relevant edit. Add new scenarios via the rule-promotion path in §7 at n=3 occurrences (rule-of-three). Pure-Derived scenarios (zero Observed) get re-evaluated after 5 sessions or first real trigger.

---

## Content scenarios

### §1 — Package graph change

**When**: adding or removing a package, OR changing dependency direction between existing packages.

**Affected files**:

- **Observed** (union of PRs #388/#393/#395 diffs):
  - `.github/copilot-instructions.md`
  - `CLAUDE.md`
  - `docs/ARCHITECTURE.md`
  - `docs/VISUAL-ARCHITECTURE.md`
  - `docs/decisions/PACKAGE-EVOLUTION.md`
  - `packages/scan/README.md`
  - `packages/scan/package.json`
- **Derived** (principled, unverified):
  - `CONTRIBUTING.md` (package-count block)
  - `README.md` (package list)
  - `docs/GLOSSARY.md` (chain references)
  - `eslint.config.ts` (boundaries — dep-direction edits only)
  - `tsconfig.json` (path aliases — add/remove only)
  - root `package.json` `pnpm.overrides` (if peer-dep anchor needed — see PR #386 novel pattern)
  - new `packages/{pkg}/README.md` (add only)

**Protocol**:

1. Synonym-variant grep before assuming files complete: arrow form (`A ← B`), phrase form (`A depends on B`), alias names (`chief-clancy` vs `wrapper`). See PR #388 (`← wrapper` miss) and PR #393 (`← core, scan` arrow-form miss) for evidence of this gap.
2. New packages start with `"private": true` per [`docs/DEVELOPMENT.md §Release Flow`](DEVELOPMENT.md#release-flow). Flip to `"private": false` + add a changeset only when the package is ready (README written, API stable).
3. Update sibling docs in the same PR — partial updates strand the unedited siblings (sub-class d drift class).

**Cross-refs**: [`docs/DA-REVIEW.md §Cross-doc consistency sweep`](DA-REVIEW.md#cross-doc-consistency-sweep) (synonym-variant + sibling-sweep), [`docs/ARCHITECTURE.md`](ARCHITECTURE.md), [`docs/decisions/PACKAGE-EVOLUTION.md`](decisions/PACKAGE-EVOLUTION.md).

---

### §2 — Adding, removing, or renaming an env var or pipeline label

**When**: introducing a new env var or label, deprecating an existing one, or changing default values.

**Affected files**:

- **Observed** (union of PRs #398/#400 diffs):
  - `.changeset/{name}.md` (patch bump for affected packages)
  - `docs/guides/CONFIGURATION.md`
  - `docs/roles/PLANNER.md`
  - `packages/plan/src/workflows/plan.md`
  - `packages/terminal/src/roles/setup/workflows/scaffold.md`
  - `packages/terminal/src/roles/setup/workflows/init.md` (PR #398 prompt-fix)
  - `packages/terminal/src/roles/setup/workflows/settings.md` (PR #398 UI fix)
- **Derived**:
  - `packages/core/src/schemas/env.ts` (schema layer)
  - `docs/TECHNICAL-REFERENCE.md`
  - `packages/brief/src/workflows/brief.md` (board branches)
  - fallback-behavior tests (`packages/dev/src/lifecycle/fetch-ticket/fetch-ticket.test.ts`, `packages/core/src/board/detect-board.test.ts`)
  - deprecation table at [`docs/guides/CONFIGURATION.md §Deprecated label vars`](guides/CONFIGURATION.md#deprecated-label-vars)

**Protocol**:

1. Verify canonical resolution at the source: `packages/dev/src/lifecycle/fetch-ticket/fetch-ticket.ts` (or equivalent resolver). The schema-pair (TS resolver ↔ docs prose) must agree on primary, fallback, and default semantics.
2. If deprecating: keep the legacy var as a fallback; cite the PR where the new var was introduced; document the historical default in the all-env-vars table's Default column.
3. Add a patch changeset for any package where shipped MD content (`packages/*/src/**/*.md`) changes — the workflow files ship inside the published package.

**Cross-refs**: [`docs/guides/CONFIGURATION.md`](guides/CONFIGURATION.md), [`docs/DA-REVIEW.md §Cross-doc consistency sweep`](DA-REVIEW.md#cross-doc-consistency-sweep), §9 below for deprecation specifics.

---

### §3 — Adding a new board adapter

**When**: introducing support for a new board type (Jira/GitHub/Linear/Shortcut/Notion/AzDO + new platforms).

**Affected files** (Derived only — no recent PR evidence, **lower-confidence; refine at first real trigger**):

- `docs/CONVENTIONS.md §Board Implementation Patterns`
- `docs/guides/CONFIGURATION.md` detection-marker table
- `docs/roles/PLANNER.md` planning-queue-filters table
- `packages/core/src/board/{board}/` (new directory — adapter, schemas, tests)
- `packages/brief/src/workflows/brief.md` (new board branch in instructions)
- `packages/plan/src/workflows/plan.md` (new board branch)
- integration tests under `packages/terminal/test/e2e/`

**Protocol**:

1. Read [`docs/CONVENTIONS.md §Board Implementation Patterns`](CONVENTIONS.md) before scaffolding; reuse `Cached<T>`, schema-validate all responses, header builders.
2. Add detection-marker entry to [`docs/guides/CONFIGURATION.md` Local mode table](guides/CONFIGURATION.md#local-mode-no-board).
3. Mirror the `brief.md` + `plan.md` board branches from an existing similar-shape adapter (Jira if status-based; GitHub if label-based).

**Cross-refs**: [`docs/CONVENTIONS.md`](CONVENTIONS.md), [`packages/core/src/board/`](../packages/core/src/board/) (existing patterns).

---

### §4 — Adding a new subagent

**When**: introducing a new `.claude/agents/{agent}.md` definition.

**Affected files**:

- **Observed** (Phase 6.2 `copilot-surrogate` addition):
  - `.claude/agents/{agent}.md` (the agent definition itself)
  - `docs/DEVELOPMENT.md §Post-PR flow` (or other relevant section for trigger rule)
- **Derived**:
  - `CLAUDE.md` (if a new user-facing trigger phrase is added)
  - `.github/copilot-instructions.md`
  - `docs/DA-REVIEW.md` (if the agent affects review discipline)
  - `docs/SELF-REVIEW.md` (if it affects self-review)

**Protocol**:

1. Define the agent's trigger conditions in `docs/DEVELOPMENT.md` (or DA-REVIEW.md if review-related), not in the agent file alone — agents are dispatched by Claude reading rules in policy docs.
2. Match the trigger style used by existing agents (`da-review`, `spec-grill`, `copilot-surrogate`): clear before/after wording, file-path globs where applicable.

**Cross-refs**: [`.claude/agents/da-review.md`](../.claude/agents/da-review.md), [`.claude/agents/spec-grill.md`](../.claude/agents/spec-grill.md), [`.claude/agents/copilot-surrogate.md`](../.claude/agents/copilot-surrogate.md).

---

### §5 — Changing a review rule or discipline

**When**: codifying a new review rule, modifying an existing one, or changing reviewer discipline (DA, self, surrogate, Copilot).

**Affected files**:

- **Observed** (subset of PR #396 matching this scenario — PR #396 also co-mingled a §1 sibling-sweep adding 5 architectural-doc files; [PR #403](https://github.com/Pushedskydiver/chief-clancy/pull/403) adds the REVIEW-PATTERNS.md fold-incompleteness entry):
  - `docs/DA-REVIEW.md` (rule body)
  - `docs/DEVELOPMENT.md` (Review Gate or Post-PR flow)
  - `docs/SELF-REVIEW.md` (companion-rule symmetry)
  - `.claude/agents/da-review.md` (if agent behavior changes)
  - `docs/REVIEW-PATTERNS.md` (when the rule body itself comes from an observed pattern; cited evidence: PR #403, fold-incompleteness pattern from Sessions 131-132)
- **Derived**:
  - `CLAUDE.md` (if a CLAUDE-surface rule)
  - `.github/copilot-instructions.md`
  - `.claude/agents/copilot-surrogate.md` (if surrogate behavior affected)
  - `docs/RATIONALIZATIONS.md` (if countering a rationalization)

**Protocol**:

1. Follow §7 below — rule changes are spec-grill territory, not direct edit.
2. Apply the rule to its own PR (rule-self-apply discipline, n=6 cumulative per recent sessions). Catch yourself violating the rule you're codifying — that's the strongest test.
3. SELF-REVIEW companion-clause symmetry: if DA-REVIEW gets a sub-class added, mirror the count in SELF-REVIEW.

**Cross-refs**: §7 below, [`docs/DA-REVIEW.md`](DA-REVIEW.md), [`docs/SELF-REVIEW.md`](SELF-REVIEW.md), [`docs/REVIEW-PATTERNS.md`](REVIEW-PATTERNS.md).

---

## Meta scenarios

### §6 — Before opening any PR

**When**: about to push a branch + run `gh pr create`.

**Protocol** (ordered per `CLAUDE.md:74` "architectural → DA (subagent) → self → PR" and `docs/DEVELOPMENT.md §Review Gate` "DA → Self-Review → Copilot"):

1. **DA review in-chat** — dispatch `@agent-da-review` per [`.claude/agents/da-review.md`](../.claude/agents/da-review.md). DA reports findings as tool result; do NOT post to PR (PR doesn't exist yet anyway).
2. Fold DA findings via soft-reset-to-fold if MATERIAL or BLOCKING.
3. Self-review per [`docs/SELF-REVIEW.md`](SELF-REVIEW.md).
4. Run pre-push quality suite: `pnpm test && pnpm lint && pnpm typecheck && pnpm format:check && pnpm knip && pnpm publint && pnpm attw`.
5. Push + `gh pr create` with appropriate type label + package labels per [`CLAUDE.md`](../CLAUDE.md) PR workflow section.
6. Surrogate dispatch per [`docs/DEVELOPMENT.md §Post-PR flow §Copilot-surrogate dispatch`](DEVELOPMENT.md#post-pr-flow): mandatory if commit type `fix(docs)` / `fix(decisions)`; Copilot-unreachable fallback otherwise.
7. Claude composes + posts the audit comment on the PR **before merge** per [`docs/DEVELOPMENT.md §Post-PR flow`](DEVELOPMENT.md#post-pr-flow) "Dispatch timing + audit-trail discipline" — the comment is the audit trail, not in-chat consumption (`.claude/agents/copilot-surrogate.md` — Claude owns posting, not the agent).
8. Walk auto-merge gates per [`docs/DEVELOPMENT.md §Auto-merge criteria`](DEVELOPMENT.md#auto-merge-criteria); merge if clean, surface to Alex if any gate/exception fires.

**Cross-refs**: [`CLAUDE.md`](../CLAUDE.md) Process directives "Review order: architectural → DA (subagent) → self → PR. Never skip or reorder.", [`docs/DA-REVIEW.md §Reporting channel`](DA-REVIEW.md#reporting-channel--in-chat-only-not-pr-comments) (in-chat-only discipline), [`docs/DEVELOPMENT.md §Review Gate`](DEVELOPMENT.md#review-gate--da--self-review--copilot), [`docs/DEVELOPMENT.md §Post-PR flow`](DEVELOPMENT.md#post-pr-flow).

---

### §7 — Proposing a new rule, policy-doc edit, or new doc category

**When**: introducing a new rule into a policy doc, modifying an existing rule's wording, or adding a new doc surface (e.g., this INDEX.md is itself a §7 instance).

**Protocol** (ordered):

1. **Draft a spec at `.claude/research/{topic}/spec.md`** — local only per `.gitignore`; not a PR.
2. **Two-phase spec-grill** per [`.claude/agents/spec-grill.md`](../.claude/agents/spec-grill.md):
   - **Discovery (R1..R_n-1)** — iterate until findings converge to nits per [`docs/DEVELOPMENT.md §Two-phase grill discipline`](DEVELOPMENT.md#two-phase-grill-discipline). Multiple discovery rounds may be needed if BLOCKING findings surface.
   - **Verification (R_n)** — confirm-or-disprove brief on the final spec state.
3. DA pre-PR-open in-chat per §6 above.
4. Open PR with appropriate commit type:
   - `📝 docs` if adding/modifying docs surface (NOT `feat(docs)` — `docs` is a top-level type per [`docs/GIT.md`](GIT.md)).
   - `fix(docs)` only if fixing observed drift (triggers mandatory surrogate per `docs/DEVELOPMENT.md §Post-PR flow`).
5. Surrogate dispatch + audit comment per §6.
6. **Apply the rule to the PR codifying it** (rule-self-apply discipline) — strongest test.
7. Blast-radius edits → Alex-merge per §8.

**Cross-refs**: [`.claude/agents/spec-grill.md`](../.claude/agents/spec-grill.md), [`docs/DEVELOPMENT.md §Two-phase grill discipline`](DEVELOPMENT.md#two-phase-grill-discipline), [`docs/GIT.md §Section headers`](GIT.md).

---

### §8 — Editing a blast-radius doc

**When**: editing any path on the blast-radius list — these trigger Alex-handoff per [`docs/DEVELOPMENT.md §Auto-merge criteria §Exceptions`](DEVELOPMENT.md#auto-merge-criteria) + `.github/CODEOWNERS:10-35`.

**Blast-radius paths** (re-verify on load — primary sources are authoritative):

- **Policy docs**: `/CLAUDE.md`, `/docs/DEVELOPMENT.md`, `/docs/DA-REVIEW.md`, `/docs/SELF-REVIEW.md`, `/docs/CONVENTIONS.md`, `/docs/RATIONALIZATIONS.md`, `/docs/GIT.md`, `/docs/TESTING.md`
- **GitHub infra**: `/.github/workflows/**`, `/.github/actions/**`, `/.github/instructions/**`, `/.github/copilot-instructions.md`, `/.github/CODEOWNERS`
- **Repo-root config**: `/package.json`, `/pnpm-workspace.yaml`, `/pnpm-lock.yaml`, `/tsconfig.base.json`, `/.changeset/config.json`
- **Per-package publish surface**: `/packages/*/package.json`, `/packages/*/tsconfig.json`

**Protocol**:

1. **Re-verify on load** — primary sources can shift; do not recall from memory. Read [`docs/DEVELOPMENT.md:508-512`](DEVELOPMENT.md#auto-merge-criteria) and `.github/CODEOWNERS:10-35` directly.
2. If editing → cannot use `gh pr merge --auto`. Surface to Alex with one-line summary of what changed and why.
3. Post-merge release flow may still fire — see §10.

**Note**: trigger-rule scope (when to consult INDEX) is broader than blast-radius (when Alex must merge). Editing `docs/GLOSSARY.md` triggers INDEX consultation but is auto-merge-eligible. Editing `/.github/workflows/release.yml` is blast-radius but NOT INDEX-routed (workflows are infra, not prose). Two distinct overlapping sets, different intents.

**Cross-refs**: [`docs/DEVELOPMENT.md §Auto-merge criteria`](DEVELOPMENT.md#auto-merge-criteria), [`.github/CODEOWNERS`](../.github/CODEOWNERS).

---

### §9 — Deprecating an identifier

**When**: deprecating an env var, label, config key, file path, or other named identifier.

**Protocol**:

1. **Sibling-sweep with synonym-variant expansion** per [`docs/DA-REVIEW.md §Cross-doc consistency sweep (d)`](DA-REVIEW.md#cross-doc-consistency-sweep): grep the whole repo for the identifier, including:
   - Arrow form (e.g., `A ← B`)
   - Phrase form (e.g., `A depends on B`)
   - Alias names (e.g., `chief-clancy` vs `wrapper`)
2. Add the deprecated identifier to the relevant deprecation table (e.g., [`docs/guides/CONFIGURATION.md §Deprecated label vars`](guides/CONFIGURATION.md#deprecated-label-vars)).
3. **Keep fallback-behavior tests** — deprecated identifiers should still work as fallbacks. Verify in `packages/dev/src/lifecycle/fetch-ticket/fetch-ticket.test.ts` or equivalent.
4. Add a migration note in the changeset describing the deprecation + recommended replacement.
5. Document the historical default (if any) in the all-env-vars table's Default column — deprecated vars retain their documented historical defaults for legacy-user reference.

**Evidence**:

- PR #388 — `← wrapper` synonym miss (caught by author's post-DA grep, not DA itself)
- PR #393 — `← core, scan` arrow-form miss (caught by DA pass-0)
- PR #398 — duplicate `CLANCY_LABEL_PLAN` prompt
- PR #400 — `needs-refinement` deprecation drift across 3 surfaces (closed via 2-pass soft-reset-to-fold)

**Cross-refs**: [`docs/DA-REVIEW.md §Cross-doc consistency sweep`](DA-REVIEW.md#cross-doc-consistency-sweep), §2 above for env-var-specific sibling lists.

---

### §10 — Post-merge release pipeline monitoring

**When**: after `gh pr merge` of any PR in the current session containing a `.changeset/*.md` file.

**Why**: changesets/action runs in dual mode — pending changesets create a "📦 chore: version packages" PR; merge of that PR triggers `pnpm changeset publish` + GitHub Releases. Pipeline observed n=1 skipped on a recent release PR (#401 merged without Claude checking the downstream publish state); codifying this scenario closes the gap.

**Protocol** (run before closing the task):

1. **Verify release.yml ran green**:

   ```
   gh run list --workflow=release.yml --limit 1
   ```

   Expect `completed success`. If `in_progress`, surface to Alex and recommend re-check later.

2. **Confirm version PR exists** if the merged PR contained changesets:

   ```
   gh pr list --search '"chore: version packages"' --state open --limit 1
   ```

   Expect the auto-generated version PR with the bumps your changeset declared.

3. **Spot-check version PR diff** — confirm declared bumps match what changesets/action computed.

4. **After Alex merges the version PR** (Alex-merge per [`docs/DEVELOPMENT.md §Auto-merge criteria §Exceptions`](DEVELOPMENT.md#auto-merge-criteria) Release PR rule):
   - Verify second `release.yml` run completes green: `gh run list --workflow=release.yml --limit 1`.
   - Confirm npm publish succeeded: `npm view @chief-clancy/{pkg} version`.
   - Check `gh release list --limit 3` — should show new entries per published package.

**Edge cases**:

- **New package with `"private": true`** (per [`docs/DEVELOPMENT.md:432`](DEVELOPMENT.md#release-flow)): changesets/action skips publish until flipped. If you scaffolded a new package, verify `"private": false` is set before expecting a publish event.
- **`NPM_TOKEN` rotation**: publish would silently fail from Claude's view (no PR signal; only visible in Actions logs).
- **`.changeset/config.json` `ignore` list**: currently empty; packages added there won't publish.

**Cross-refs**: [`docs/DEVELOPMENT.md §Release Flow`](DEVELOPMENT.md#release-flow), [`.github/workflows/release.yml`](../.github/workflows/release.yml), [`scripts/group-changelog.ts`](../scripts/group-changelog.ts), [`docs/GIT.md §Changelog Format`](GIT.md).

---

## Updates to this doc

- **New scenario added at n=3 occurrences**: when a drift class surfaces in 3 separate sessions, codify as a new INDEX scenario via §7 protocol (rule-of-three).
- **Existing scenario refined**: when a Derived entry is touched by a real PR, promote to Observed + cite the PR; when an Observed list grows stale, sibling-sweep catches via [`docs/DA-REVIEW.md §Cross-doc consistency sweep (d)`](DA-REVIEW.md#cross-doc-consistency-sweep).
- **Pure-Derived re-evaluation**: scenarios with zero Observed evidence (currently §3, §4) get re-evaluated after 5 sessions OR first real scenario trigger, whichever first. Cull at 10 sessions if still zero-Observed.
