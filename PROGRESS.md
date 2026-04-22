# Progress

Living state document for the Clancy monorepo. Records the current state, the phase ledger, and the next decision. Session-by-session detail lives in git history (each phase's PRs are tagged + commit messages reference them).

## Next workstreams (after Session 122)

Ordering updated 2026-04-22 (Session 122 — 1.d.ζ GIT.md §Changelog Format example separator drift shipped via [PR #382](https://github.com/Pushedskydiver/chief-clancy/pull/382) merged `84dc4e9`; 1.d.\* sub-series complete; 1.e + 1.f remain).

1. **Documentation drift follow-ups (items 1.a + 1.b + 1.c + 1.d.α + 1.d.β + 1.d.γ + 1.d.δ + self-ref-drift rule promotion + 1.d.ε + 1.d.ζ shipped).** Parallel audit of 14 root-level `docs/*.md` files from Session 111. Small drift already folded direct-to-main in commits `01c0036` / `7caa2b1` / `914ad7a` / `55da4e4`. **Session 112 shipped TESTING.md** as [PR #372](https://github.com/Pushedskydiver/chief-clancy/pull/372) (merged `937903c`). **Session 113 shipped DEVELOPMENT.md** as [PR #373](https://github.com/Pushedskydiver/chief-clancy/pull/373) (merged `803dfab`). **Session 114 shipped ARCHITECTURE.md** as [PR #374](https://github.com/Pushedskydiver/chief-clancy/pull/374) (merged `543a385`). **Session 115 shipped CONVENTIONS.md + copilot-instructions.md terminal row** as [PR #375](https://github.com/Pushedskydiver/chief-clancy/pull/375) (merged `85601a9`). **Session 116 shipped 1.d.α GIT.md `fix(docs)` predicate Rule 1** as [PR #376](https://github.com/Pushedskydiver/chief-clancy/pull/376) (merged `7289a0e`). **Session 117 shipped 1.d.β DEVELOPMENT.md §Post-PR flow surrogate-mandatory-on-drift-fix-PR dispatch rule** as [PR #377](https://github.com/Pushedskydiver/chief-clancy/pull/377) (merged `c1ece5b`). **Session 118 shipped 1.d.γ DEVELOPMENT.md §Two-phase grill discipline bundle + DA-REVIEW.md §Cross-doc consistency sweep bidirectional generalization + SELF-REVIEW companion fold** as [PR #378](https://github.com/Pushedskydiver/chief-clancy/pull/378) (merged `a5680f8`). **Session 119 shipped 1.d.δ GIT.md §Changelog Format observed-state rewrite + §Section headers 6→10 table expansion + 3-doc caller-claim fold** as [PR #379](https://github.com/Pushedskydiver/chief-clancy/pull/379) (merged `a108475`). **Session 120 shipped self-referential-drift rule promotion to `docs/DA-REVIEW.md §Claim-extraction pass`** as [PR #380](https://github.com/Pushedskydiver/chief-clancy/pull/380) (merged `e1340b1`). **Session 121 shipped 1.d.ε GIT.md §Rules bullet 1 rewrite to match observed changesets-generated entry format** as [PR #381](https://github.com/Pushedskydiver/chief-clancy/pull/381) (merged `74f6b02`). **Session 122 shipped 1.d.ζ GIT.md §Changelog Format example attribution separator fix (em-dash → hyphen)** as [PR #382](https://github.com/Pushedskydiver/chief-clancy/pull/382) (merged `84dc4e9`). **Remaining — one PR each, standard protocol (spec-grill → per-commit DA → final-verification DA → self-review → open PR → skip-Copilot-POST → surrogate → audit comment → Alex-merge when blast-radius fires):**
   - **e. GLOSSARY.md coverage gaps.** Copilot-surrogate / Copilot-unreachable-detection / dispatcher-prior-verification / preemptive-archival / protocol-scope-reframe-willingness — coined terms used in policy docs without glossary entries. Rule-addition (new content), not drift-fix. Needs Alex scope call on which terms earn permanent entries.
   - **f. (Out-of-original-scope, surfaced Session 112) TESTING.md Layer-2 integration-layer body section.** Opener at L3 says "3-layer" (accurate) but body has only `## Layer 1: Unit tests` + `## Layer 2: E2E tests` — no integration-layer section despite `packages/terminal/test/integration/` containing 10 tests (count corrected Session 116 per R1 B2). Content PR, not drift-fix. Queue behind (a)-(e).
   - Low-priority date-stamp sweeps on stale "Last reviewed" headers (CONVENTIONS, SELF-REVIEW, DA-REVIEW, RATIONALIZATIONS, REVIEW-PATTERNS) can batch as a single nit-sweep or fold into remaining PRs.
   - Ship order for remaining items (parallel-safe, disjoint files/sections): 1.e → 1.f.
2. **Phase 7 — Dependency automation.** **7.0 Audit + 7.1 Research + 7.2 Proposals all complete** (Session 111, continued past initial handoff). Artefacts: `.claude/research/dependency-automation/{audit,proposals}.md` (both gitignored). **Option A locked** per Alex Q1-Q5 answers (2026-04-21): Dependabot + `claude-code-action` triage + Dependabot Security Alerts fast-unblock. **Second reframe** named explicitly: audit.md's "visibility" → Alex-answer "delegation-with-escalation" (Claude owns routine dep work as companion; Alex owns design on majors). **4-sub-PR execution plan** locked: **7.3.α** security-alerts flip via `gh api` (no PR); **7.3.β** `.github/dependabot.yml` security-only + `gh label create dependabot-autoskip` prerequisite + 14-day validation window (stochastic-trigger fallback named); **7.3.γ** policy carve-out (`docs/DEVELOPMENT.md §Auto-merge criteria` + CODEOWNERS mirror + `.github/dependabot.yml` groups, `open-pull-requests-limit: 0` to close γ→δ ordering gap); **7.3.δ** `.github/workflows/dep-triage.yml` + atomic `limit: 0 → 5` flip. DA-waiver policy edit in γ (new conditional: bot-authored autoskip-labelled PRs satisfy DA gate via triage). Copilot-surrogate fall-through already live (PR-6.2.3). Phase 7 completion criteria: 90-day ≥80% auto-merge rate OR explicit why-not logged per exception. Phase 8 (autonomous major-version migration per Alex Q3) scoped as future, NOT a Phase 7 completion gate. **Starts after item 1 (doc-sweep follow-ups) ships.**
3. **Automated session handoff — AUDITED, DEFERRED.** 10/10 data points logged (Sessions 103-112); Session 113 audit at `.claude/research/session-handoff/audit-2026-04-21.md` (gitignored). Zero breaches: 0/10 unplanned compactions, all recorded handoff times ≈1 min, all recorded clarifying-question counts = 0. Substrate (Claude Code Routines + `PostCompact` hook) remains research preview with no measurable friction to address. **Next revisit triggers:** (i) any single early-trigger breach from §Measurement protocol (3+ unplanned compactions in 5 sessions / handoff >5min on 2+ sessions / 2+ clarifying-question sessions in a row), OR (ii) drift over a second 10-session window (Sessions 113-122): unplanned-compaction rate ≥2/10, handoff-cost median ≥8k tokens, or clarifying-question rate ≥1/10. Hygiene note from audit: backfill discipline for "time to first tool call" + "clarifying-question count" fields is inconsistent (4 of 7 measurable sessions left TBD); tightening backfill would strengthen future audits.
4. **Plumb real error channels through invoke/deliver/feasibility** — the open design question from Session 98.
5. **Phase F** — `@chief-clancy/design` (Stitch integration). Deferred pending Phase 7.
6. **Phase 6.2 optional follow-ons (deferred).** (c) §Claim-extraction bucket expansion — always audit kept prose on restructure PRs, even when Copilot reachable. Reconsider if future evidence shows reachable-but-Copilot-missed drift on main. (f) mechanical pre-commit grep-audit for link integrity + literal identifiers — narrow coverage (~1/4 Seed findings). Optional; not load-bearing.

**Policy-surface widening** (`.claude/agents/**`, `docs/decisions/**`, `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/**`, `.github/pull_request_template.md` → CODEOWNERS + §Auto-merge blast-radius exception list) is deliberately deferred. Revisit only if Phase 7.0 audit surfaces a concrete reason.

---

**Session 122 (2026-04-22) — Item 1.d.ζ GIT.md §Changelog Format example attribution separator drift shipped. [PR #382](https://github.com/Pushedskydiver/chief-clancy/pull/382) merged `84dc4e9` during handoff (γ.2 blast-radius — GIT.md on policy-doc list). Standard protocol: 2-round spec-grill (R1/R_n) + per-commit DA + final-verification DA + surrogate. Surrogate-on-drift-fix n=8 — **first clean 0-finding drift-fix dispatch** (all 13 factual claims CONFIRMED, 0 falsified, 3 UNCHECKED semantic, 7 schema-pairs coherent). Copilot UNREACHABLE n=14. Novel: clean-on-drift-fix surrogate novel n=1 (pattern shift from baseline 1-3 findings per dispatch post-#374); FVDA-FYI-acted-on novel n=1 (scope-label precedent catch on docs-only PR resolved pre-merge via `gh pr edit --remove-label`).**

**PR [#382](https://github.com/Pushedskydiver/chief-clancy/pull/382) shipped: 1 commit (`ef7115f`), 1 file (`docs/GIT.md`), +1/-1 LOC.** Single-codepoint edit on §Changelog Format fenced example (L214): em-dash `! —` between `Thanks [@author](…)!` attribution and body `**BREAKING**` becomes hyphen `! - ` to match the plugin-emitted separator. Second em-dash after `**BREAKING**` is preserved (author-written prose inside BREAKING marker, matches `packages/core/CHANGELOG.md:7` and 96 sibling entries byte-for-byte). Fix resolves pre-existing drift carry-forward from PR #381 surrogate Finding 1 + final-verification DA FYI. Load-bearing since PR #381 §Rules bullet 1 now anchors on the `` `Thanks [@author]!` `` attribution marker — the same section's example contradicted the separator the plugin produces.

**Review stack fired end-to-end across 5 rounds.** Spec-grill R1 (discovery): 0 BLOCKING + 0 MATERIAL + 1 LOW + 4 FYI/Nit/MC/record-only — **L1 folded** (dropped `@changesets/changelog-github` plugin-default claim as belt-and-braces; commit message now relies on pure 97/0 observed-state grep evidence per the discipline "observed state is the ground truth, don't cite external-tool semantics when you can show the tool's output"). R_n verification (confirm-or-disprove brief on 15 claims including two universal-quantifier hunts "no 4th entry category uses em-dash" + "no other `! —` attribution drift in repo prose"): **15/15 CONFIRMED**, 0 DISPROVED, 0 PARTIAL, 0 novel findings. Per-commit DA on `ef7115f`: READY TO MERGE, 0 findings, 8/8 commit-message claims verified against primary source (including `gh pr view 381 --comments` re-verification of carry-forward lineage per PR #380 self-referential-drift rule). Final-verification DA on PR diff: READY TO MERGE, 1 FYI on `core` scope label (docs-only PR shouldn't carry package scope label per `docs/GIT.md §PR labels` convention; precedent siblings PR #378/#379/#380/#381 carry no scope label). **Acted on FYI** — removed `core` label via `gh pr edit --remove-label` pre-audit-comment. Pre-push quality suite green (10/10 test + 5/5 lint + 10/10 typecheck + format:check/knip/publint/attw clean).

**Copilot UNREACHABLE — n=14 consecutive sessions (108-122).** Skipped `gh api requested_reviewers` POST per Session 117 directive. Surrogate dispatched mandatorily per `docs/DEVELOPMENT.md §Post-PR flow` drift-fix branch (commit `ef7115f` uses `🐛 fix(docs)`, codified rule from PR #377). Both triggers fired (mandatory-on-drift-fix + Copilot-UNREACHABLE fallback); single dispatch; mandatory trigger cited as primary in audit comment.

**Surrogate: 0 BLOCKING / 0 MATERIAL / 0 LOW / 0 FYI — CLEAN.** 13 factual claims extracted across `docs/GIT.md` at HEAD `ef7115f`; all 13 CONFIRMED against primary source; 0 falsified; 3 UNCHECKED disclosed (L195 `chief-clancy@0.9.42` version pin; L194 semver-semantics format claim; L68 historical/process). 7 schema-pair checks all CONFIRMED: plugin-template ↔ observed CHANGELOG state ↔ example; CATEGORIES array ↔ §Section headers; §Types ↔ §Section headers; three-package claim ↔ CHANGELOG_PATHS; §Rules bullet 1 ↔ example; §fix(docs) blast-radius list ↔ DEVELOPMENT.md blast-radius list. **Surrogate-on-drift-fix-PR n=8** — cumulative across 8 dispatches (PRs #372, #373, #374, #375, #376, #379, #381, #382): 19 MATERIAL + 7 LOW + 1 CLEAN. Audit-trail comment posted per contract with mandatory-on-drift-fix trigger cited as primary.

**Novel pattern — surrogate-clean-on-drift-fix, n=1.** First 0-finding surrogate dispatch on a drift-fix PR. Prior pattern baseline across 7 drift-fix dispatches was 1-3 findings per dispatch (minimum 2 LOW at #379, maximum 8 MATERIAL at #374 novel-n=1). PR #382's scope — single-codepoint edit on a fenced example inside an already-audited section (§Changelog Format was re-audited during PR #379 + PR #381) — saturated the evidence surface: no drift remaining for surrogate to catch because prior dispatches had exhausted the section. Hypothesis: clean drift-fix surrogates become probable when (a) scope is minimal (1-2 LOC), (b) surrounding section has been recently re-audited (<3 sessions), (c) the fix itself closes a carry-forward from a prior audit. Watch n=2 — likely scarce because clean-drift-fix requires both minimal scope AND recently-audited surroundings.

**Novel pattern — FVDA-FYI-acted-on, n=1.** Final-verification DA raised a scope-label FYI (docs-only PR carrying `core` package label inconsistent with `docs/GIT.md §PR labels` convention + precedent PRs #378/#379/#380/#381). Actioned pre-audit-comment via `gh pr edit --remove-label core`. Prior pattern: FVDA FYIs typically record-only. Session 122 treated the FYI as actionable-before-merge because the action was (a) non-destructive (label removal, not diff change), (b) closed a small hygiene delta against named precedent, (c) couldn't be self-corrected by Alex without slightly more effort. Watch n=2 — likely rare (FVDA FYIs usually surface genuinely no-action-required observations like paraphrase ambiguity or schema-pair notes).

**Rule-self-apply — n=4 unchanged.** PR #382 doesn't codify a rule, so no new self-apply data point. Counter stays at n=4 (Session 121 R_n tally-elision + prior Sessions 117/118/120 events).

**Apply-rule-to-own-spec pre-codification / post-codification — n=5 (extends Session 121 n=4).** Self-referential-drift rule (codified PR #380) continued as discipline throughout Session 122: commit message evidence clauses anchor by PR# + §section-name (no line-number citations to restructure-eligible policy docs); spec-grill R_n brief explicitly requires primary-source re-verification (not inherited summaries); per-commit DA re-verified the carry-forward lineage via `gh pr view 381 --comments` rather than trusting PROGRESS.md Session 121 meta-summary. Codified discipline holding.

**Three-options-with-rec — n=2 unchanged.** Session 122 was explicitly single-option (user directive: "No Alex scope call needed — single-option fix"); doesn't add data point. Counter stays at n=2.

**Novel-category-surfaced-by-R_n — novel n=1 unchanged.** R_n verification on PR #382 ran 2 universal-quantifier hunts (claims 7 + 15: "no 4th entry category uses em-dash", "no alternate separator variants exist"). Both returned CONFIRMED with scope qualifier (2 bare-prose legacy entries exist but lack `!` separator entirely — excluded by the §Rules `` `Thanks [@author]!` `` anchor). No new 4th category surfaced. Pattern holding but counter unchanged — no novel disclosure this PR.

**Grill-internal-inconsistency — novel n=1 unchanged.** R_n on PR #382 was internally consistent (table and narrative agreed on all 15 claims). Pattern holding but counter unchanged.

**Surrogate-fold scope-expansion — n=6 contained.** PR #382 surrogate returned 0 findings (no folds triggered). Pattern holding.

**No soft-reset-to-fold this PR.** Clean single-commit ship. Pattern streak remains paused at 6 consecutive sessions (115-120); Sessions 121 + 122 both shipped without requiring soft-reset. Resumes if future session applies.

**Novel-patterns-earned summary (Sessions 113-122 cumulative, for archival):**

| Pattern                                                 | n                      | First session | Latest         |
| ------------------------------------------------------- | ---------------------- | ------------- | -------------- |
| Surrogate-effectiveness on drift-fix PR                 | n=8                    | 112           | 122            |
| Surrogate-clean-on-drift-fix                            | n=1                    | 122           | —              |
| Surrogate-on-rule-addition                              | n=2                    | 118           | 120            |
| Self-referential drift (PROGRESS.md meta → rule body)   | n=3, codified          | 116           | 120 (codified) |
| Cross-doc caller-claim self-check                       | n=3, codified PR #378  | 112           | 115            |
| Exhaustive-grep grill short-circuit                     | n=2, codified PR #378  | 109           | 112            |
| Scope-split-on-R1-pushback                              | n=1                    | 116           | —              |
| Scope-reshape-on-R1-pushback (cross-doc generalization) | n=1                    | 118           | —              |
| Rule-self-apply catches on own PR                       | n=4                    | 117           | 121            |
| Apply-rule-to-own-spec pre/post-codification            | n=5                    | 119           | 122            |
| Three-options-with-rec scope-call shape                 | n=2                    | 119           | 121            |
| Grill-internal-inconsistency                            | n=1                    | 120           | —              |
| Novel-category-surfaced-by-R_n                          | n=1                    | 121           | —              |
| FVDA-FYI-acted-on                                       | n=1                    | 122           | —              |
| Soft-reset-to-fold                                      | 6 consecutive sessions | 115           | 120            |

**Meta-findings (carry-forward to Session 123+):**

- **1.d.\* sub-series COMPLETE.** All six drift-fix sub-items (1.d.α through 1.d.ζ) plus self-referential-drift rule promotion shipped. Remaining under item 1: 1.e GLOSSARY (needs Alex scope call) + 1.f TESTING.md Layer-2 body section (content PR).
- **Surrogate-clean-on-drift-fix — novel n=1.** Watch n=2. Hypothesis: probable when scope is minimal AND surrounding section recently re-audited.
- **FVDA-FYI-acted-on — novel n=1.** Watch n=2. Distinct from record-only FVDA FYIs. Trigger: non-destructive action that closes a hygiene delta against named precedent.
- **Rule-self-apply catches on own PR — n=4.** Unchanged this PR (PR #382 doesn't codify a rule). Watch n=5 on next rule-addition PR (likely 1.e GLOSSARY).
- **Apply-rule-to-own-spec pre/post-codification — n=5.** Codified discipline (PR #380) holding post-codification. Watch n=6.
- **Three-options-with-rec — n=2.** Watch n=3 (likely recurs on 1.e GLOSSARY — will need Alex scope call on which coined terms earn entries).
- **Novel-category-surfaced-by-R_n — novel n=1 unchanged.** Watch n=2.
- **Grill-internal-inconsistency — novel n=1 unchanged.** Watch n=2 before codifying.
- **Surrogate-on-drift-fix n=8.** Cumulative: 19 MATERIAL + 7 LOW + 1 CLEAN across 8 dispatches. First clean dispatch changes the baseline calibration.
- **Surrogate-fold scope-expansion — n=6 contained.** PR #382 at 0 surrogate findings; no folds triggered.
- **Copilot UNREACHABLE n=14.** Skip POST; surrogate primary.
- **§Archival maintenance preemptive-at-handoff — 20 consecutive applications** (Sessions 104-122). This handoff archives Session 118.
- **§Measurement protocol second-10-window data point 10 of 10 — FINAL POINT RECORDED.** Second revisit is now due per §Next workstreams item 3 trigger: "drift over a second 10-session window (Sessions 113-122): unplanned-compaction rate ≥2/10, handoff-cost median ≥8k tokens, or clarifying-question rate ≥1/10". Session 123 should run the second-10-window audit before starting new work.

**Session 122 handoff metrics.** (Data point 10 of 10 — final point of second revisit window.)

- Trigger: phase boundary (PR #382 opened + CI green + surrogate audit comment posted). Alex merged `84dc4e9` during handoff-draft; PROGRESS.md commit happened post-merge direct-to-main (rebased on merged main).
- Context at trigger: ≈55-60% of pre-compaction budget (manual estimate — moderate session: pre-spec grep verification + 2 spec-grill rounds (R1 + R_n) + per-commit DA + final-verification DA + surrogate dispatch + pre-push ×1 + audit comment + Session 118 archival + this handoff). Lighter than Session 121 due to narrower scope (1-codepoint fix, 2 grill rounds not 3, no soft-reset).
- Handoff turn cost: ≈6-8k tokens (this entry + Session 118 archive row + §Next workstreams rewrite + Session 123 loading instructions).
- Unplanned compaction: no.
- Time from "handoff now" decision to next-session first productive tool call: TBD (recorded by Session 123).
- `PROGRESS.md` quality signal: TBD (recorded by Session 123).

### Session 123 loading instructions

On load:

1. Read `PROGRESS.md` top-to-bottom (this Session 122 entry + §Next workstreams + detailed entries for Sessions 119-122; Session 118 now archived).
2. **No PR status check needed** — PR #382 already merged (`84dc4e9`); this handoff committed post-merge direct-to-main.
3. **FIRST ACTION: §Measurement protocol second-10-window audit.** Post-audit window Sessions 113-122 complete with data point 10 of 10 recorded. Per §Next workstreams item 3 trigger language, Session 123 should run the second-10-window audit before starting new work. Expected outcome: ZERO drift (session-by-session metrics across 113-122 show clean handoffs, no unplanned compactions recorded, no clarifying questions). If audit surfaces drift (unplanned-compaction rate ≥2/10, handoff-cost median ≥8k tokens, clarifying-question rate ≥1/10), revisit automated-handoff substrate; else note audit-clean and proceed.
4. **After audit, start item 1.e (GLOSSARY.md coverage gaps)** per §Next workstreams. **Alex scope call required on load** — this is rule-addition (new content), not drift-fix. Ask Alex: "Which coined terms earn permanent GLOSSARY entries?" Candidate terms per §Next workstreams: Copilot-surrogate / Copilot-unreachable-detection / dispatcher-prior-verification / preemptive-archival / protocol-scope-reframe-willingness. Option-set for Alex presentation: (a) all five; (b) narrow subset (only the most cross-referenced); (c) different framing (topic-grouped glossary sections vs flat list). Standard protocol once scoped (spec-grill R1→R_n → per-commit DA → final-verification DA → self-review → open PR → skip-Copilot-POST → surrogate (Copilot-unreachable fallback for rule-addition, not mandatory-on-drift-fix) → audit comment → Alex-merge).
5. **Ship order for remaining doc-sweep**: second-10-window audit (FIRST, must precede 1.e) → 1.e GLOSSARY (needs Alex scope call) → 1.f TESTING.md Layer-2 body section (content PR).
6. **After item 1 fully ships**, return to Phase 7 (§Next workstreams item 2). First action: 7.3.α Dependabot Security Alerts flip via `gh api` (two PUT calls; not a PR; Alex may need to run if token lacks admin scope). See `.claude/research/dependency-automation/proposals.md §7.3`.
7. **Carry-overs from Session 122:**
   - **Second-10-window audit DUE.** Sessions 113-122 complete; first action before any new work.
   - **1.d.\* sub-series COMPLETE.** No more drift-fix sub-items under 1.d. Next drift-fix candidates (named out-of-scope carry-forwards from prior PRs) listed below.
   - **Surrogate-clean-on-drift-fix — novel n=1.** Watch n=2.
   - **FVDA-FYI-acted-on — novel n=1.** Watch n=2.
   - **Rule-self-apply catches on own PR — n=4.** Watch n=5 on next rule-addition (likely 1.e).
   - **Apply-rule-to-own-spec pre/post-codification — n=5.** Watch n=6.
   - **Three-options-with-rec — n=2.** Watch n=3 (likely recurs on 1.e).
   - **Novel-category-surfaced-by-R_n — novel n=1 unchanged.** Watch n=2.
   - **Grill-internal-inconsistency — novel n=1 unchanged.** Watch n=2.
   - **Surrogate-on-drift-fix n=8.**
   - **Surrogate-fold scope-expansion — n=6 contained.**
   - **Copilot UNREACHABLE n=14.** Skip POST.
   - **§Archival maintenance preemptive-at-handoff — 20 consecutive applications.** Session 123's handoff should archive Session 119 preemptively if detail band grows back to N=5 (currently 119-122 = N=4 post-Session-118 archive).
   - **Soft-reset-to-fold pattern paused at 6 consecutive sessions.** Resumes if future session applies.
8. **If Alex redirects on load** (priority shift, new urgent ask), follow the redirect — §Next workstreams is a default, not a contract.

Named out-of-scope carry-forwards from prior PRs (candidates for future refresh PRs) — unchanged from Session 121:

- `.github/copilot-instructions.md:132` — claims "7 agent prompts" under `packages/terminal/src/agents/`; actual count is 2.
- `.github/copilot-instructions.md:23-24` — package-list drift (nonexistent chat, omits dev/scan).
- `README.md:299` — dependency-direction arrow chain transitive-only.
- `CONTRIBUTING.md:52-59` — "four packages" block substantially drifted (real count: 7).
- `docs/ARCHITECTURE.md:27` — dev-deps-on-scan claim vs eslint allow-list (scan is content-only). Verify during future ARCHITECTURE follow-up.
- `eslint.config.ts:53` — stale `chat` element (no on-disk package).

---

**Session 121 (2026-04-22) — Item 1.d.ε GIT.md §Rules bullet 1 rewrite to match observed changesets-generated entry format shipped. [PR #381](https://github.com/Pushedskydiver/chief-clancy/pull/381) merged `74f6b02` (γ.2 blast-radius — GIT.md on policy-doc list). Standard protocol: 3-round spec-grill (R1/R*n/R*{n+1}) + per-commit DA + final-verification DA + surrogate. Surrogate-on-drift-fix n=7 (1 LOW out-of-scope; carry-forward as 1.d.ζ: `docs/GIT.md:214` example em-dash separator). Copilot UNREACHABLE n=13. Novel: rule-self-apply catches on own PR n=4 (per-commit DA caught R_n tally-elision in commit-message, ephemeral-surface carve-out); novel-category-surfaced-by-R_n n=1 (confirm-or-disprove brief surfaced a 4th entry category of bare-prose legacy entries).**

**PR [#381](https://github.com/Pushedskydiver/chief-clancy/pull/381) shipped: 1 commit, 1 file (`docs/GIT.md`), +1/-1 LOC.** Rewrites §Changelog Format §Rules bullet 1 from the grep-falsified false claim ("Each entry starts with a **bold title** followed by a dash and description"; 0 matches for `^- \*\*[^*]+\*\*` across all 7 packages' CHANGELOGs) to a scope-qualified description: "In `Thanks [@author]!`-attributed entries, author-written content is the body after the attribution; prefix links and `Updated dependencies` cascade bullets are auto-generated by changesets". Alex locked option (a) rewrite-to-match-observed over (b) delete-as-aspirational-not-followed + (c) reframe-as-breaking-change-marker-guidance after honest evidence-based pushback (10/97 bodies use bold lead-ins; all 10 are `**BREAKING**`/`**Breaking:**` — breaking-change markers, not a title convention).

**Review stack fired end-to-end across 6 rounds.** Spec-grill R1 (discovery): 3 MATERIAL + 4 LOW + 3 Nit + 3 FYI + 3 MC — all folded. Key folds: **M1** (2/97 entries use commit-hash-only prefix — a literal-prefix rule would itself be grep-falsifiable) + **M2** (naming `@changesets/changelog-github` in the rule introduces a plugin-name identifier that §Changelog Format body opener at L205 doesn't prepare for) + **M3** (L214 example omits commit-hash slot; a rule declaring full prefix shape would contradict its own section's example). Fold shape: invert framing (describe author-controlled portion, not enumerate auto-generated slots). Spec-grill R*n (verification, confirm-or-disprove brief): 2 MATERIAL + 2 PARTIALLY-CONFIRMED + 2 LOW — **Claim 19 DISPROVED, novel 4th entry category surfaced** (bare-prose legacy entries at `packages/chief-clancy/CHANGELOG.md:314` + `packages/terminal/CHANGELOG.md:305`, 2 total, identical statusline-bugfix text predating or bypassing the changesets pipeline). Fold: add scope qualifier "In `Thanks [@author]!`-attributed entries" to honestly bound the rule (excludes category 4 by definition). Spec-grill R*{n+1} (fold verification): READY TO COMMIT, 0 novel findings. Per-commit DA on `d0d53c2`: READY TO MERGE with 1 LOW (commit-message R_n tally-elision "1 MATERIAL" vs actual "2 MATERIAL" per spec file — ephemeral-surface carve-out per DA-REVIEW.md:65, no fold) + 1 FYI (pre-existing L214 em-dash, out-of-scope). Final-verification DA on PR diff: READY TO MERGE, 0 novel findings. Pre-push quality suite green.

**Copilot UNREACHABLE — n=13 consecutive sessions (108-121).** Skipped `gh api requested_reviewers` POST per Session 117 directive. Surrogate dispatched mandatorily per `docs/DEVELOPMENT.md §Post-PR flow` drift-fix branch (commit `d0d53c2` uses `fix(docs)`, codified rule from PR #377). Both triggers fired (mandatory-on-drift-fix + Copilot-UNREACHABLE fallback); single dispatch; mandatory trigger cited in audit comment.

**Surrogate: 0 BLOCKING / 0 MATERIAL / 1 LOW (out-of-scope for PR diff).** 25 claims extracted across `docs/GIT.md` at HEAD; 20 verified; 1 falsified (Finding 1: `docs/GIT.md:214` example uses em-dash `! —` where actual CHANGELOGs use hyphen `! - ` — pre-existing from PR #379 1.d.δ, not touched by PR #381 diff); 4 UNCHECKED disclosed (prescriptive/semantic/historical). **Surrogate-on-drift-fix-PR n=7** (PR #372 + #373 + #374 + #375 + #376 + #379 + #381). Cumulative: 19 MATERIAL + 7 LOW across 7 dispatches. Audit-trail comment posted per contract.

**1.d.ζ new carry-forward.** Surrogate Finding 1 + final-verification DA FYI both flagged the `docs/GIT.md:214` example separator drift. The PR #381 rule makes it slightly more load-bearing since the new rule body now anchors on `` `Thanks [@author]!` `` as the attribution marker, while the same section's example simplifies both the separator (em-dash vs hyphen) and the prefix (omits commit-hash). Narrow one-character fix (`—` → `-`); blast-radius γ.2 → Alex-merge; no scope call needed (single-option fix). Added to §Next workstreams ship order 1.d.ζ → 1.e → 1.f.

**Rule-self-apply catches on own PR — n=4 (extends Session 120 n=3).** Per-commit DA on `d0d53c2` caught R_n tally-elision in the commit message ("1 MATERIAL" vs actual "2 MATERIAL" per spec file) — the class of self-referential drift codified in PR #380. DA correctly classified the finding as ephemeral-surface carve-out per DA-REVIEW.md:65; no fold applied. The pattern continues: every review round caught drift of its own rule class. Novel sub-class: drift inherited from spec-prose tallies into commit-message evidence clauses (distinct from Session 120's rule-body prose / DA cross-doc / final-verification DA ambiguity sub-classes). Watch n=5.

**Novel-category-surfaced-by-R_n — novel n=1.** Spec-grill R_n confirm-or-disprove brief surfaced a 4th entry category (bare-prose legacy entries, 2 total) that the spec + R1 discovery missed despite both having extensively enumerated "all entries across 7 packages". Operational implication: R_n's confirm-or-disprove shape is stronger than pure verification — actively hunts for missed categories in universal-quantifier claims. Insight: a grill's explicit "is there a 4th category?" probe is load-bearing distinct from R1's "verify these categories exist". Watch n=2.

**Three-options-with-rec — n=2 (extends Session 119 novel n=1).** Pre-spec I surfaced three discrete scope options: (a) rewrite-bullet-to-match-observed, (b) delete-bullet-as-aspirational, (c) reframe-bullet-as-author-guidance. Initial recommendation was (c); Alex accepted conditional on "strong real evidence"; on verification my 10/97 grep count disproved (c)'s premise (bold lead-ins are `**BREAKING**` markers only, not title conventions); revised recommendation to (a); Alex confirmed (a). Pattern shape: three-options-with-rec + evidence-verification-before-proceeding + honest-course-correction when evidence contradicts prior recommendation. Watch n=3.

**Apply-rule-to-own-spec pre-codification — n=3 (extends Session 120 n=2).** Self-referential-drift rule codified in PR #380 applied to Session 121's spec drafting: evidence citations anchored by PR# + §section-name + filesystem grep; commit message body avoids line-number references to restructure-eligible policy docs. First session post-codification — pattern continues as codified discipline. Watch n=4.

**No soft-reset-to-fold this PR.** Clean single-commit ship. Pattern streak pauses at 6 consecutive sessions (115-120). Resumes if next session applies the pattern again.

**Novel-patterns-earned summary (Sessions 113-121 cumulative, for archival):**

| Pattern                                                 | n                      | First session | Latest         |
| ------------------------------------------------------- | ---------------------- | ------------- | -------------- |
| Surrogate-effectiveness on drift-fix PR                 | n=7                    | 112           | 121            |
| Surrogate-on-rule-addition                              | n=2                    | 118           | 120            |
| Self-referential drift (PROGRESS.md meta → rule body)   | n=3, codified          | 116           | 120 (codified) |
| Cross-doc caller-claim self-check                       | n=3, codified PR #378  | 112           | 115            |
| Exhaustive-grep grill short-circuit                     | n=2, codified PR #378  | 109           | 112            |
| Scope-split-on-R1-pushback                              | n=1                    | 116           | —              |
| Scope-reshape-on-R1-pushback (cross-doc generalization) | n=1                    | 118           | —              |
| Rule-self-apply catches on own PR                       | n=4                    | 117           | 121            |
| Apply-rule-to-own-spec pre-codification                 | n=3                    | 119           | 121            |
| Three-options-with-rec scope-call shape                 | n=2                    | 119           | 121            |
| Grill-internal-inconsistency                            | n=1                    | 120           | —              |
| Novel-category-surfaced-by-R_n                          | n=1                    | 121           | —              |
| Soft-reset-to-fold                                      | 6 consecutive sessions | 115           | 120            |

**Meta-findings (carry-forward to Session 122+):**

- **1.d.ζ GIT.md:214 example separator drift — NEW CARRY-FORWARD.** Narrow one-character fix (`—` → `-`). Next in ship order; no scope call needed.
- **Rule-self-apply catches on own PR — n=4.** Novel sub-class (commit-message tally-elision caught by per-commit DA, ephemeral-surface carve-out). Watch n=5.
- **Novel-category-surfaced-by-R_n — novel n=1 (this session).** Watch n=2.
- **Three-options-with-rec — n=2.** Watch n=3 (likely recurs on 1.e GLOSSARY).
- **Apply-rule-to-own-spec pre-codification — n=3.** First session post-codification of the self-referential-drift rule. Watch n=4.
- **Grill-internal-inconsistency — novel n=1 unchanged.** Watch n=2 before codifying.
- **Surrogate-on-drift-fix n=7.** Drift-fix evidence base continues at baseline 1-3 findings per dispatch.
- **Surrogate-fold scope-expansion — n=6 contained.** PR #381 at 0 MATERIAL folds (Finding 1 is out-of-scope carry-forward). Pattern holding.
- **Copilot UNREACHABLE n=13.** Skip POST; surrogate primary.
- **§Archival maintenance preemptive-at-handoff — 19 consecutive applications** (Sessions 104-121). This handoff archives Session 117.
- **§Measurement protocol second-10-window data point 9 of 10** (per §Next workstreams item 3). Post-audit window Sessions 113-122. 1 more to second revisit.

**Session 121 handoff metrics.** (Data point 9 of second-10-window.)

- Trigger: phase boundary (PR #381 merged by Alex `74f6b02`; post-merge handoff commit direct-to-main).
- Context at trigger: ≈60-65% of pre-compaction budget (manual estimate — heavy session: pre-spec grep verification + 3 spec-grill rounds with 2 fold-iterations + per-commit DA + final-verification DA + surrogate dispatch + pre-push ×1 + audit comment + Session 117 archival + this handoff).
- Handoff turn cost: ≈6-8k tokens (this entry + Session 117 archive row + §Next workstreams rewrite + Session 122 loading instructions).
- Unplanned compaction: **output-token-limit hit once mid-handoff-draft** (recovered via smaller-pieces resumption; no context compaction, no clarifying questions).
- Time from "handoff now" decision to next-session first productive tool call: ≈1 min (Session 122 first productive tool calls were the grep-count verification + target-line Read + `git status` — all issued in parallel immediately after reading PROGRESS.md head).
- `PROGRESS.md` quality signal: clean. Session 122 loading instructions were complete and actionable; no clarifying questions needed; protocol steps proceeded without ambiguity.

### Session 122 loading instructions

On load:

1. Read `PROGRESS.md` top-to-bottom (this Session 121 entry + §Next workstreams + detailed entries for Sessions 118-121; Session 117 now archived).
2. **No PR status check needed** — PR #381 already merged (`74f6b02`); this handoff committed post-merge direct-to-main.
3. **Start on item 1.d.ζ** per §Next workstreams — `docs/GIT.md:214` example separator drift (em-dash `! —` → hyphen `! - ` to match the actual CHANGELOG separator; all 97 `Thanks`-attributed entries use hyphen). Narrow one-character `fix(docs)` drift-fix; predicate 1-3 pass; predicate 4 fails (GIT.md on blast-radius list) → Alex-merge PR flow. No scope call needed. Standard protocol (spec-grill R1→R_n → per-commit DA → final-verification DA → self-review → open PR → skip-Copilot-POST → surrogate mandatory-on-drift-fix → audit comment → Alex-merge).
4. **Ship order for remaining doc-sweep**: 1.d.ζ (NEXT, no scope call) → 1.e GLOSSARY (needs Alex scope call) → 1.f TESTING.md Layer-2 body section (content PR).
5. **After item 1 fully ships**, return to Phase 7 (§Next workstreams item 2). First action: 7.3.α Dependabot Security Alerts flip via `gh api` (two PUT calls; not a PR; Alex may need to run if token lacks admin scope). See `.claude/research/dependency-automation/proposals.md §7.3`.
6. **Carry-overs from Session 121:**
   - **1.d.ζ GIT.md:214 example separator drift — NEW, shipping next.**
   - **Rule-self-apply catches on own PR — n=4.** Watch n=5.
   - **Novel-category-surfaced-by-R_n — novel n=1.** Watch n=2.
   - **Three-options-with-rec — n=2.** Watch n=3 (likely recurs on 1.e GLOSSARY).
   - **Apply-rule-to-own-spec pre-codification — n=3** (first post-codification application). Watch n=4.
   - **Grill-internal-inconsistency — novel n=1 unchanged.** Watch n=2.
   - **Surrogate-on-drift-fix n=7.**
   - **Surrogate-fold scope-expansion — n=6 contained.**
   - **Copilot UNREACHABLE n=13.** Skip POST.
   - **§Archival maintenance preemptive-at-handoff — 19 consecutive applications.** Session 122's handoff should archive Session 118 preemptively if detail band grows to N=5 (currently 118-121 = N=4 post-Session-117 archive).
   - **§Measurement protocol second-10-window data point 9 recorded.** 1 more to second revisit.
   - **Soft-reset-to-fold pattern paused at 6 consecutive sessions.** Resumes if next session applies.
7. **If Alex redirects on load** (priority shift, new urgent ask), follow the redirect — §Next workstreams is a default, not a contract.

---

**Session 120 (2026-04-22) — Self-referential-drift rule promotion to `docs/DA-REVIEW.md §Claim-extraction pass` shipped. [PR #380](https://github.com/Pushedskydiver/chief-clancy/pull/380) merged `e1340b1` during handoff (γ.2 blast-radius — DA-REVIEW.md on policy-doc list). Standard protocol: 4-round spec-grill (R1/R2/R3/R_n) + per-commit DA ×2 + final-verification DA + soft-reset ×2 for M1 + FVDA-M1 folds. Surrogate-on-rule-addition n=2 (clean: 0 findings / 24 verified / 3 UNCHECKED). Copilot UNREACHABLE n=12 (unchanged — no new POST). Novel: rule-self-apply catches on own PR extends n=2 → n=3; grill-internal-inconsistency novel n=1 (R_n's table and narrative contradicted each other on the same claim).**

**PR [#380](https://github.com/Pushedskydiver/chief-clancy/pull/380) shipped: 1 commit (after 2 soft-resets), 1 file (`docs/DA-REVIEW.md`), +2/-0 LOC (one new paragraph of ~250 words).** Inserts a paragraph in `§Claim-extraction pass` immediately after the existing L63 "Scope includes the diff's own new prose" rule. The new rule specializes L63 to the class where rule-body claims cite compressed summaries — PROGRESS.md handoff entries, `docs/history/SESSIONS.md` archive rows, or meta-finding carry-forwards. Three failure modes named (quantifier miscount, severity-tally elision, line-number conflation) with primary-source verification protocols per class (filesystem grep / PR audit-trail comment / `git show <merge-sha>:<file>`). Cross-doc-citation discipline (prefer §section-name over line number) pointed at `SELF-REVIEW.md §Consistency` where it already lives — avoids duplicating per Per-commit-DA-M1. Scope explicit: rule bodies in policy docs + evidence clauses in spec drafts that feed them; ephemeral surfaces (commit messages, PR descriptions, handoff entries, archive rows) are exempt. Evidence: PR #376 R1 B2 + PR #377 surrogate F1 + PR #378 R\_{n+1}.

**Review stack fired end-to-end across 8 rounds (4 grill + 3 DA + surrogate).** Spec-grill R1 (discovery): 2 BLOCKING + 4 MATERIAL + 5 LOW + 4 Nit — all folded. R2 (discovery, BLOCKING rippled from R1): 1 BLOCKING + 3 MATERIAL + 4 LOW — **caught my R1 fold fabricating a "primary/secondary pair" narrative for Session 112 PROGRESS.md** (the rule-being-codified flagged its own PR exhibiting the drift class). R3 (discovery, BLOCKING rippled from R2): 1 MATERIAL + 3 LOW + 2 Nit — **caught "drifted from" wrong-verb attribution** (Session 112 authorship didn't drift; conflation happened downstream at inheritance). R_n (verification, confirm-or-disprove brief): 1 MATERIAL + 1 LOW + 2 FYI — **R_n table claimed "Sessions 113/114/115 zero hits" but narrative cited Session 113 L42 as the first conflation** (grill-internal-inconsistency novel n=1). Ground-truthed myself via `git show <sha>:PROGRESS.md | grep "CONVENTIONS.md:210"` against all Sessions 113-117: all five had the re-citation; R_n's table was wrong, narrative was right. Folded R_n's narrative finding (Session 113 = first narrative conflation, Sessions 114-117 = subsequent carry-forward) into v5. Per-commit DA on `c3803f3` (v5): **NEEDS FOLD, 1 MATERIAL** — cross-doc overlap with `SELF-REVIEW.md:112` line-number-citation rule. Soft-reset + re-commit as `c481534` applied Option b (dropped the duplicated sentence, pointed at `SELF-REVIEW.md §Consistency`). Per-commit DA on `c481534`: READY TO MERGE. Final-verification DA on PR diff: **NEEDS FOLD, 1 MATERIAL** — evidence #3's "Session 116 SESSIONS.md archive row" phrasing ambiguous (the row documents Session 112, archived during Session 116's handoff). Soft-reset + re-commit as `f93e88a` applied Option b (dropped SESSIONS.md clause, aligned with PROGRESS.md Session 118 L106 authoritative narrative naming Session 115's carry-over as direct inheritance source). Per-commit DA on `f93e88a`: READY TO MERGE. Pre-push quality suite green.

**Copilot UNREACHABLE — n=12 consecutive sessions (108-120).** Skipped the `gh api requested_reviewers` POST per Session 117 directive. Surrogate dispatched via Copilot-unreachable fallback branch (NOT mandatory-on-drift-fix — PR #380 uses `docs(DA-REVIEW)` commit type per GIT.md §Rules predicate 2 excluding rule-additions from `fix(docs)`).

**Surrogate: 0 findings (clean) — n=2 surrogate-on-rule-addition data point.** 24 claims extracted and verified at HEAD `f93e88a`; 0 falsified; 3 UNCHECKED disclosed (semantic / normative / prescriptive — not grep-falsifiable). Audit-trail comment posted per contract. Two-point pattern (PR #378 novel-n=1 + PR #380 n=2) suggests surrogate-on-rule-addition baseline is 0 findings when the pre-merge review stack (spec-grill ×4 + per-commit DA ×2 + final-verification DA) is effective. Distinct evidence base from drift-fix surrogate (n=6 with 19 MATERIAL + 6 LOW cumulative).

**Rule-self-apply catches on own PR — n=3 (novel extension from n=2).** Every review round on PR #380 found drift of the exact class the rule warns about, in the rule's own evidence clause:

- **R2** caught R1 fold fabricating "primary/secondary pair" narrative (BLOCKING).
- **R3** caught "drifted from" wrong-verb on Session 112 authorship (MATERIAL).
- **R_n narrative** caught carry-over chain mis-scope (MATERIAL; R_n's own table was itself internally inconsistent — see grill-internal-inconsistency below).
- **Per-commit DA** caught cross-doc overlap with SELF-REVIEW.md §Consistency (MATERIAL).
- **Final-verification DA** caught "Session 116 SESSIONS.md archive row" ambiguity (MATERIAL).

Five distinct self-apply catches within one PR's review stack. Pattern is maximally self-referential: the rule codifying self-referential drift catches itself at every review stage. Extends n=2 (Sessions 117, 118) → n=3.

**Grill-internal-inconsistency — novel n=1.** R_n verification returned a MATERIAL finding whose TABLE ("Session 113/114/115 zero hits") contradicted its own NARRATIVE ("Session 113 L42 says 'Session 112 n=1 was CONVENTIONS.md:210'"). The narrative was right (my ground-truth grep confirmed all 5 sessions re-cited). The grill itself exhibited the drift class it was verifying — summaries (the R_n table) lost context from the primary data (the narrative). Watch n=2. Insight: even adversarial grill output is a secondary source that compresses and can drift; primary source remains the repo state under `git show`, not the grill's summary table.

**Apply-rule-to-own-spec pre-codification — n=2 (extends Session 119 novel n=1).** Session 119 applied self-referential-drift rule-candidate preemptively to its commit-message drafting. Session 120 extended in R1 L2 fold (spec body cited evidence via PR# + round-identifier + merge-SHA anchors rather than line-number citations to restructure-eligible policy docs). Rule-candidate-pre-codification applied to spec-draft before the rule lands. Watch n=3.

**Soft-reset-to-fold pattern — 6 consecutive sessions (115-120).** Sessions 115/116/117/118/119/120 all applied soft-reset + re-commit to land DA / FVDA M1 folds atomically in a single commit rather than stacking fold-commits-on-top. Session 120 applied twice within the same PR (for M1 and FVDA-M1 folds). Pattern holding.

**Novel-patterns-earned summary (Sessions 113-120 cumulative, for archival):**

| Pattern                                                 | n                      | First session | Latest                     |
| ------------------------------------------------------- | ---------------------- | ------------- | -------------------------- |
| Surrogate-effectiveness on drift-fix PR                 | n=6                    | 112           | 119                        |
| Surrogate-on-rule-addition                              | n=2                    | 118           | 120                        |
| Self-referential drift (PROGRESS.md meta → rule body)   | n=3, codified          | 116           | 118 (codified Session 120) |
| Cross-doc caller-claim self-check                       | n=3, codified PR #378  | 112           | 115                        |
| Exhaustive-grep grill short-circuit                     | n=2, codified PR #378  | 109           | 112                        |
| Scope-split-on-R1-pushback                              | n=1                    | 116           | —                          |
| Scope-reshape-on-R1-pushback (cross-doc generalization) | n=1                    | 118           | —                          |
| Rule-self-apply catches on own PR                       | n=3                    | 117           | 120                        |
| Apply-rule-to-own-spec pre-codification                 | n=2                    | 119           | 120                        |
| Three-options-with-rec scope-call shape                 | n=1                    | 119           | —                          |
| Grill-internal-inconsistency                            | n=1                    | 120           | —                          |
| Soft-reset-to-fold                                      | 6 consecutive sessions | 115           | 120                        |

**Meta-findings (carry-forward to Session 121+):**

- **Self-referential drift rule — CODIFIED.** No longer a carry-forward; lives at `docs/DA-REVIEW.md §Claim-extraction pass` as of PR #380.
- **Rule-self-apply catches on own PR — n=3.** Watch for novel sub-classes; current evidence base covers rule-body prose, per-commit DA cross-doc, final-verification DA ambiguity. Additional sub-classes may surface.
- **Grill-internal-inconsistency — novel n=1.** Watch n=2 before codifying. Operational implication: when grill verification returns contradictory signals (table vs narrative), ground-truth against primary source rather than trusting either grill output.
- **Apply-rule-to-own-spec pre-codification — n=2.** Watch n=3.
- **Surrogate-on-rule-addition — n=2 clean.** Baseline pattern: 0 findings when pre-merge review stack is effective.
- **Surrogate-fold scope-expansion — n=5 contained** (drift-fix evidence base). PR #380 rule-addition contributes separately.
- **Copilot UNREACHABLE n=12.** Skip POST; surrogate primary.
- **§Archival maintenance preemptive-at-handoff — 18 consecutive applications** (Sessions 104-120). This handoff archives Session 116.
- **§Measurement protocol second-10-window data point 8 of 10** (per §Next workstreams item 3). Post-audit window Sessions 113-122. 2 more to second revisit.

**Session 120 handoff metrics.** (Data point 8 of second-10-window.)

- Trigger: phase boundary (PR #380 opened + CI green + surrogate audit posted; Alex-merge pending at handoff-draft time).
- Context at trigger: ≈65-70% of pre-compaction budget (manual estimate — very heavy session: 4 spec-grill rounds + 2 soft-resets + 3 DA dispatches + surrogate dispatch + pre-push ×1 + audit comment + Session 116 archival + this handoff).
- Handoff turn cost: ≈8-10k tokens (this entry + Session 116 archive row + §Next workstreams rewrite + Session 121 loading instructions + Session 120 table).
- Unplanned compaction: no.
- Time from "handoff now" decision to next-session first productive tool call: TBD (recorded by Session 121).
- `PROGRESS.md` quality signal: TBD (recorded by Session 121).

---

**Session 119 (2026-04-22) — Item 1.d.δ GIT.md §Changelog Format observed-state rewrite + §Section headers 6→10 table expansion shipped. [PR #379](https://github.com/Pushedskydiver/chief-clancy/pull/379) merged `a108475` post-handoff-draft (γ.2 blast-radius — GIT.md + DEVELOPMENT.md on list). Alex scope call: Option 3 locked (narrow drift-fix now; feature workstream to migrate changeset authoring to emit gitmoji + expand script to 7 packages deferred). MC2 sub-call: option (b) 6→10 table expansion over keep-at-6 or drop-table-entirely. Surrogate caught 2 LOW (§Rules bullet 1 kept-prose drift → 1.d.ε carry-forward; "parallel to" reader-precision → dismiss). Copilot UNREACHABLE n=12. Novel patterns: three-options-with-rec n=1 (scope-call presentation shape); self-referential-drift rule-candidate applied pre-codification (no line-number citations to restructure-eligible docs in own commit message).**

**PR [#379](https://github.com/Pushedskydiver/chief-clancy/pull/379) shipped: 1 commit, 4 files (`docs/GIT.md` + `docs/DEVELOPMENT.md` + `docs/TECHNICAL-REFERENCE.md` + `docs/VISUAL-ARCHITECTURE.md`), +23/-26 LOC net.** C1 (`1ab4958`) rewrites `docs/GIT.md §Changelog Format` from aspirational "each package uses gitmoji section headers" framing to observed "default changesets format + conditional regrouping (no-op today)" framing; replaces the 0.2.0 aspirational example with a `PrCreationFailure @ 4.0.0` representative observed bullet (drawn from `packages/core/CHANGELOG.md`); adds "no-op today" call-out with reasoning (3 of 7 packages in `CHANGELOG_PATHS`, gitmoji-prefix short-circuit at `hasCategorised`). Expands §Section headers table 6→10 rows for schema-pair parity with §Types commit-types table + `CATEGORIES` array in `scripts/group-changelog.ts` — closes an internal `docs/GIT.md` drift (10-row types vs 6-row headers) atomically alongside the caller-claim drift. Folds caller-claims in `docs/DEVELOPMENT.md §Release Flow` step 4 + `docs/TECHNICAL-REFERENCE.md §Publishing` bullet 3 + `docs/VISUAL-ARCHITECTURE.md` Changesets subgraph mermaid node label (cross-doc consistency sweep per PR #378 rule at `docs/DA-REVIEW.md §Cross-doc consistency sweep`).

**Alex scope call (Option 3) — three-options-with-rec n=1 novel.** Pre-spec I surfaced three discrete scope options: (1) fix docs to match current state (narrow `fix(docs)`), (2) fix code to match docs (feature PR: migrate changeset authoring to emit gitmoji + expand script to 7 packages), (3) scope-split (ship Option 1 now; queue Option 2 as separate feature workstream). I recommended (3) citing UX-design hidden work in Option 2 (how changeset entries acquire gitmoji prefixes — author convention vs wrapper vs derive-at-version-time), retroactive rewrite risk on published CHANGELOG artefacts (npm / GitHub release pages), schema-pair resolution overhead (6 vs 10 categories). Alex probed Option 2 ("I feel like option 2 is what should happen. What do you think?"); I pushed back honestly per feedback_honesty_first memory. Alex accepted Option 3 after pushback. MC2 sub-call: option (b) expand 6→10 rows for parity (vs (a) leave at 6 or (c) drop table entirely). Pattern shape: three-options-with-rec-and-evidence-based-pushback-tolerance. Watch n=2.

**Review stack fired end-to-end across 5 rounds.** Spec-grill R1 (discovery): 1 BLOCKING + 2 MATERIAL (post-retraction) + 4 LOW + 3 Nit + 3 MC + 2 FYI — all folded. Key folds: **B1** "F1 carry-forward list" framing dropped in favour of "PR #376 surrogate audit Finding 1" (single finding, not list — matches audit-comment label). **M2** explicitly scoped §Section headers H3 + §Rules subsection treatment in the spec body (kept §Section headers H3 name unchanged for anchor stability + added intro sentence above the table; §Rules kept unchanged pre-PR — though surrogate post-push caught this reading as too permissive). **M3** acknowledgement-reword on ARCHITECTURE.md:141 (tree annotation survives untouched). **L2** evidence citations dropped line numbers in favour of key names (`package.json scripts.version:ci` not `:23`) — applied self-referential-drift-n=3 candidate rule to own spec pre-codification. **L4** factual correction: §Types commit-types table actually has all 10 gitmoji (not 6); divergence is within GIT.md (10-row types vs 6-row headers), not script-vs-types — motivated Alex's choice of option (b). R_n verification: 2 MATERIAL (backticks stripped from Before/After strings in spec presentation vs HEAD had them + ARCHITECTURE.md R1-summary ambiguity). M1 folded directly into commit (backticks preserved); M2 was spec-bookkeeping clarification only. Per-commit DA on `1ab4958`: READY TO MERGE, 0 findings (15/15 ground-truth claims verified). Final-verification DA: READY TO MERGE with 2 FYI (row-order vs content match on §Types ↔ §Section headers; 3-package enumeration across GIT.md + DEVELOPMENT.md). Pre-push quality suite green.

**Copilot UNREACHABLE — n=12 consecutive sessions (108-119).** Skipped `gh api requested_reviewers` POST per Session 117 directive. Surrogate dispatched mandatorily per `docs/DEVELOPMENT.md §Post-PR flow` drift-fix branch (codified PR #377) — commit `1ab4958` uses `🐛 fix(docs)` type.

**Surrogate: 2 LOW / 0 MATERIAL / 0 BLOCKING findings.** **F1 LOW (carry-forward as 1.d.ε)**: `docs/GIT.md:238` §Rules bullet 1 "Each entry starts with a **bold title** followed by a dash and description" — observed format is PR-attribution (`- [#NNN] Thanks [@author]! - <body>`), not bold-title-prefix. `grep "^- \*\*[^*]+\*\*" packages/*/CHANGELOG.md` returns 0 matches; 95 matches for `^- \[#[0-9]+\]`. Bullet 1 misaligns with actual CHANGELOG content across all 7 packages. **F2 LOW (dismissed)**: "parallel to the commit types at §Types" reader-precision — §Section headers table row-order matches `CATEGORIES` array (Features first), not §Types row-order (feat first). Topic-parallel reading holds; row-parallel reading fails. Dismissed; natural English "parallel" satisfies topic-parallel. 14 claims extracted, 12 verified, 0 UNCHECKED.

**n=6 drift-fix surrogate effectiveness validated** (PR #372 + #373 + #374 + #375 + #376 + #379). Total: 19 MATERIAL + 6 LOW + 0 BLOCKING across 6 dispatches. PR #379's 2 LOW continues the pattern "1-3 kept-prose findings per dispatch post-#374 novel-n=1 (8 MATERIAL)".

**Surrogate-fold scope-expansion — n=5 contained.** PR #374 novel-n=1 (8 MATERIAL fold); PR #375/#376/#377/#379 all ≤1 MATERIAL fold. Five-point pattern reinforces "scope-expansion contained unless surrogate crosses MATERIAL threshold of ~5". No re-grill trigger fired this PR.

**Self-referential drift rule promotion — REMAINS n=3, still promotion-ready (not bundled).** No new n=4 catch this session (no PROGRESS.md meta-claim propagated into PR #379 rule body — PR #379 is pure drift-fix with no rule-body text). Applied the rule-candidate discipline pre-codification to own commit message: no line-number citations to restructure-eligible docs; all citations use §section-name format (`§Changelog Format`, `§Release Flow`, `§Types`, `§Cross-doc consistency sweep`). Target: `docs/DA-REVIEW.md §Claim-extraction pass`. Solo-PR recommended; bundling with 1.d.δ was rejected pre-grill per Session 116 "two unrelated things" R1-split precedent.

**Scope-reshape-on-R1-pushback — novel n=1 unchanged.** PR #379 R1 did not trigger scope-reshape; folds were scope-preserving (word tightening, line-number-to-key-name citation replacement, factual corrections).

**Apply-rule-to-own-spec pre-codification (novel dispatch).** Self-referential-drift rule-candidate (n=3, not yet codified) was applied to my own L2-fold decision (drop `package.json:23` line-number → `scripts.version:ci` key name) and to the commit-message drafting (no line-number citations to docs I'm editing). This is a distinct pattern from Session 117-118's "rule-being-codified catches its own PR" — here the rule-candidate-pre-codification catches drift preemptively in my own drafting. Novel shape; watch n=2.

**Meta-findings (carry-forward to Session 120+):**

- **Self-referential drift — n=3 still promotion-ready.** No new catches this session. Target `docs/DA-REVIEW.md §Claim-extraction pass`. **Solo-PR recommended for next session.**
- **Three-options-with-rec — novel n=1.** Scope-call presentation shape (3 options + recommendation + evidence-backed pushback tolerance). Watch n=2.
- **Apply-rule-to-own-spec pre-codification — novel n=1.** Distinct from rule-catches-own-codifying-PR pattern. Watch n=2.
- **Surrogate-on-rule-addition — novel n=1 unchanged.** Distinct evidence base from drift-fix surrogate (n=6).
- **Scope-reshape-on-R1-pushback — novel n=1 unchanged.** Cross-doc generalization class.
- **Rule-self-apply catches on own PR — n=2 unchanged.**
- **n=6 drift-fix surrogate effectiveness** updated; pattern continues.
- **Surrogate-fold scope-expansion — n=5 contained** (drift-fix evidence base grew by 1 this session).
- **Copilot UNREACHABLE n=12.** Skip POST; surrogate primary.
- **§Archival maintenance preemptive-at-handoff — 17 consecutive applications** (Sessions 104-119). This handoff archives Session 115.
- **§Measurement protocol second-10-window data point 7 of 10** (per §Next workstreams item 3). Post-audit window Sessions 113-122. 3 more to second revisit.

**Session 119 handoff metrics.** (Data point 7 of second-10-window.)

- Trigger: phase boundary (PR #379 opened + CI green + surrogate audit posted; Alex-merge pending at handoff-draft time). Alex merged `a108475` after the handoff-draft message; PROGRESS.md commit happened post-merge direct-to-main.
- Context at trigger: ≈55-60% of pre-compaction budget (manual estimate — 1 spec-draft + 2 spec-grill rounds + 1 per-commit DA + 1 final-verification DA + 1 surrogate dispatch + 1 branch commit + pre-push ×1 + audit comment + this handoff).
- Handoff turn cost: ≈6-8k tokens (this entry + Session 115 archive row + §Next workstreams rewrite + Session 120 loading instructions).
- Unplanned compaction: no.
- Time from "handoff now" decision to next-session first productive tool call: TBD (recorded by Session 120).
- `PROGRESS.md` quality signal: TBD (recorded by Session 120).

### Session 120 loading instructions

On load:

1. Read `PROGRESS.md` top-to-bottom (this Session 119 entry + §Next workstreams + detailed entries for Sessions 116-119).
2. **No PR status check needed** — PR #379 already merged; this handoff committed post-merge direct-to-main.
3. **Start on self-referential-drift rule promotion** as a solo atomic PR — n=3 remains promotion-ready per Session 118 meta-findings. Target `docs/DA-REVIEW.md §Claim-extraction pass`; body draft: "before citing a PROGRESS.md meta-summary in a rule-body quantifier or evidence clause, re-verify by grep against the primary source; replace line numbers with PR# + section name at any restructure-eligible target". Commit type `docs(DA-REVIEW)` (rule-addition, not drift-fix per `docs/GIT.md:30` predicate); surrogate dispatches via Copilot-unreachable fallback branch (not mandatory-on-drift-fix). Standard protocol (spec-grill R1→R_n → per-commit DA → final-verification DA → self-review → PR → skip-Copilot-POST → surrogate → audit comment → Alex-merge, blast-radius γ.2).
4. **Or** if Alex redirects, next candidate is **item 1.d.ε** (GIT.md §Rules bullet 1 kept-prose drift carry-forward from PR #379 surrogate Finding 1) — needs Alex scope call on rewrite-to-match-observed vs. delete-as-aspirational-not-followed vs. reframe-as-author-guidance-with-note-about-PR-attribution-prepending.
5. **Ship order for remaining doc-sweep**: self-referential-drift rule promotion (NEXT, solo atomic PR) → 1.d.ε (needs Alex scope call) → 1.e GLOSSARY (needs Alex scope call) → 1.f TESTING.md Layer-2 body.
6. **After item 1 fully ships**, return to Phase 7 (§Next workstreams item 2). First action: 7.3.α Dependabot Security Alerts flip via `gh api` (two PUT calls; not a PR; Alex may need to run if token lacks admin scope). See `.claude/research/dependency-automation/proposals.md §7.3`.
7. **Carry-overs from Session 119:**
   - **Self-referential drift — n=3 earned, promotion-ready.** Target `docs/DA-REVIEW.md §Claim-extraction pass`. Solo-PR recommended.
   - **Three-options-with-rec — novel n=1.** Scope-call presentation shape. Watch n=2.
   - **Apply-rule-to-own-spec pre-codification — novel n=1.** Watch n=2.
   - **Surrogate-on-rule-addition — novel n=1 unchanged.** Watch n=2.
   - **Scope-reshape-on-R1-pushback — novel n=1 unchanged.** Watch n=2.
   - **Rule-self-apply on own PR — n=2 unchanged.**
   - **Surrogate-fold scope-expansion — n=5 contained.**
   - **Copilot UNREACHABLE n=12.** Skip POST.
   - **§Archival maintenance preemptive-at-handoff — 17 consecutive applications.** Session 120's handoff should archive Session 116 preemptively if detail band grows to N=5 (currently 116-119 = N=4 post-Session-115 archive).
   - **§Measurement protocol second-10-window data point 7 recorded.** 3 more to second revisit. Drift-rate thresholds active.
8. **If Alex redirects on load** (priority shift, new urgent ask), follow the redirect — §Next workstreams is a default, not a contract.

---

**Session 118 (2026-04-22) — Item 1.d.γ DEVELOPMENT.md §Two-phase grill discipline companion rules + DA-REVIEW.md §Cross-doc consistency sweep bidirectional generalization + SELF-REVIEW companion fold shipped. [PR #378](https://github.com/Pushedskydiver/chief-clancy/pull/378) merged `a5680f8`. Strategic scope-reshape-on-R1-pushback novel n=1. Self-referential drift n=3 earned. Surrogate-on-rule-addition novel n=1 (0 findings). Copilot UNREACHABLE n=11.** Archived to [`docs/history/SESSIONS.md`](docs/history/SESSIONS.md); full retrospective in `git log -p PROGRESS.md`.

---

**Session 117 (2026-04-22) — Item 1.d.β DEVELOPMENT.md §Post-PR flow surrogate-mandatory-on-drift-fix-PR dispatch rule shipped. [PR #377](https://github.com/Pushedskydiver/chief-clancy/pull/377) merged `c1ece5b`. Surrogate-on-rule-promotion novel n=1. Self-referential drift n=2 recurrence. Copilot UNREACHABLE n=10.** Archived to [`docs/history/SESSIONS.md`](docs/history/SESSIONS.md); full retrospective in `git log -p PROGRESS.md`.

---

**Session 116 (2026-04-22) — Item 1.d.α GIT.md Rule 1 `fix(docs)` drift-fix 4-part predicate codification shipped. [PR #376](https://github.com/Pushedskydiver/chief-clancy/pull/376) merged `7289a0e`. Scope-split-on-R1-pushback novel n=1 (4-rule bundle → 1 rule; Rules 2/3/4 deferred to 1.d.β/γ). Surrogate-effectiveness n=5 earned. Copilot UNREACHABLE n=9.** Archived to [`docs/history/SESSIONS.md`](docs/history/SESSIONS.md); full retrospective in `git log -p PROGRESS.md`.

---

**Session 115 (2026-04-21) — Item 1.c CONVENTIONS.md + copilot-instructions.md terminal-row refresh shipped. [PR #375](https://github.com/Pushedskydiver/chief-clancy/pull/375) merged `85601a9`. Surrogate-effectiveness n=4 earned (3 MATERIAL + 1 LOW). Copilot UNREACHABLE n=8.** Archived to [`docs/history/SESSIONS.md`](docs/history/SESSIONS.md); full retrospective in `git log -p PROGRESS.md`.

---

**Session 114 (2026-04-21) — Item 1.b ARCHITECTURE.md second-audit fold shipped. [PR #374](https://github.com/Pushedskydiver/chief-clancy/pull/374) merged `543a385`. Surrogate-effectiveness n=3 earned. Copilot UNREACHABLE n=7; monthly-reset hypothesis DISPROVEN on ≥30-day window.** Archived to [`docs/history/SESSIONS.md`](docs/history/SESSIONS.md); full retrospective in `git log -p PROGRESS.md`.

---

**Session 113 (2026-04-21) — Two streams shipped. Automated-handoff audit DEFERRED (10/10 zero-breach data points) + doc-sweep item 1.a DEVELOPMENT.md shipped. [PR #373](https://github.com/Pushedskydiver/chief-clancy/pull/373) merged `803dfab`.** Archived to [`docs/history/SESSIONS.md`](docs/history/SESSIONS.md); full retrospective in `git log -p PROGRESS.md`.

---

**Session 112 (2026-04-21) — Doc-sweep item 1.a TESTING.md shipped. [PR #372](https://github.com/Pushedskydiver/chief-clancy/pull/372) merged `937903c`.** Archived to [`docs/history/SESSIONS.md`](docs/history/SESSIONS.md); full retrospective in `git log -p PROGRESS.md`.

---

**Session 111 (2026-04-20 → 2026-04-21) — Phase 7.0+7.1+7.2 complete (Option A locked via Dependabot + claude-code-action triage, 4-sub-PR execution plan α/β/γ/δ) + docs drift audit sweep (12 parallel audit agents on 14 files; 4 `fix(docs)` direct-to-main commits; 6 follow-up PRs queued).** Archived to [`docs/history/SESSIONS.md`](docs/history/SESSIONS.md); full retrospective in `git log -p PROGRESS.md`.

---

**Session 110 (2026-04-20) — Phase 6.2 complete. PR [#371](https://github.com/Pushedskydiver/chief-clancy/pull/371) shipped `copilot-surrogate` agent + §Post-PR flow fall-through protocol.** Archived to [`docs/history/SESSIONS.md`](docs/history/SESSIONS.md); full retrospective in `git log -p PROGRESS.md`.

---

## Session archive

Sessions 78-114 → see [`docs/history/SESSIONS.md`](docs/history/SESSIONS.md). Sessions 1-77 pre-date the per-session PROGRESS.md entry pattern; §Phase ledger below summarises that era by workstream (phase-indexed, not session-indexed); `git log -p PROGRESS.md` has the per-commit retrospective.

## Phase ledger

| Phase                                              | Status                 | Shipped       | Headline                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------- | ---------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** — Monorepo rebuild                           | ✅ done                | 2026-03-31    | Two packages (core + terminal), internal capability boundaries enforced by eslint-plugin-boundaries                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **B** — Plan extraction + local planning           | ✅ done                | (pre-Phase-C) | `@chief-clancy/plan` standalone, `--from <brief>` flow, local plans in `.clancy/plans/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **C** — Plan approval gate                         | ✅ done                | 2026-04-09    | SHA-256 `.approved` marker, standalone-aware Step 1, optional board push from approve-plan, PR 8 deferred to dev                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **D** — Brief absorbs approve-brief                | ✅ done                | 2026-04-09    | Strategist directory deleted, virtual-role transition, install-mode preflight, Step 6 label-decision preamble                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Docs lifecycle update**                          | ✅ done                | 2026-04-09    | RATIONALIZATIONS.md + DA-REVIEW Required disciplines + Severity Labels + Prove-It Pattern + Stop-the-Line + CLAUDE.md                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Post-research trim**                             | ✅ done                | 2026-04-09    | CLAUDE.md trimmed 10 → 4 bullets per AGENTS.md paper, CONVENTIONS.md "Output style" added per Brevity Constraints paper, GIT.md No --amend, memory pruned 8 files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **E** — `dev` extraction + AFK executor            | ✅ done                | 2026-04-12    | Standalone dev package with readiness gate, AFK loop, artifact writers, cross-package install/update/uninstall system                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Local-init-flow** — board-optional path          | ✅ done                | 2026-04-14    | Init board gate, settings/doctor/help/autopilot/status/review local-mode awareness, comprehensive docs sweep. PRs #288, #289, #290, #291. Batch mode filters by `.approved` existence; SHA verifier deferred                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Option A research** — pre-PR reviewer            | ✅ done (discontinued) | 2026-04-14    | Step 0 gate PASS (recall 65.7% on 35 retrieval-addressable tuples). Decision: DA-hardening only; Option A subagent cancelled. PR #293 (Claim-extraction pass) is the deliverable. Artefacts: `.claude/research/option-a/eval/step-0-results.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Readability rule promotion** (promotion-plan v7) | ✅ done                | 2026-04-15    | 14 PRs across Sessions 81-84: PR-1 CLAUDE.md philosophy + PR0 PROMOTION-PLAN pointer + PR1 glossary + PR2 Rule 12 + PR3 DEVELOPMENT process rules + PR4 core exports (0.2.0) + Barrier (#305, first-of-kind P3) + PR5 Rule 7/11 + PR5-housekeeping + PR6 SELF/DA line-items + PR6-housekeeping (delete PROMOTION-PLAN) + #297/#299 review-gate tightening spin-offs + PR #310 P3 promotion + PR #311 self-review scope. PR7 notes-file deletion deferred post-Phase-5.                                                                                                                                                                                                                                                                                                                                            |
| **P3 rule promotion**                              | ✅ done (partial)      | 2026-04-15    | Two-phase grill discipline codified in DEVELOPMENT.md §P1 (shared mechanism); P3 §Review discipline expanded with per-commit DA + final verification DA + cross-section-consistency trigger (PR #310). Execution-mechanics rules (madge cycle-baseline diff, name-collision audit, restart-from-manifest) deferred to post-Barrier-Core-run (n=2 validation). Iterative-DA-to-nit-floor and multi-PR coordination rules proposed and disproved with evidence — explicitly NOT promoted.                                                                                                                                                                                                                                                                                                                           |
| **Barrier-Core** — `core/` Rule 7 + 11 migration   | ✅ done                | 2026-04-15    | PR [#312](https://github.com/Pushedskydiver/chief-clancy/pull/312) + version-packages PR [#313](https://github.com/Pushedskydiver/chief-clancy/pull/313). `@chief-clancy/core@1.0.0` (first 1.0). 34 single-impl wrapper folders flattened, 38 internal barrels deleted; only `packages/core/src/index.ts` remains. 6 commits, 176 files, +451/-733. Per-commit DA zero-blocking; final verification DA READY TO MERGE; 1 Copilot prose-nit R1 (accepted) → clean R2.                                                                                                                                                                                                                                                                                                                                             |
| **Cycles-cleanup** — monorepo madge-clean          | ✅ done                | 2026-04-15    | PRs [#315](https://github.com/Pushedskydiver/chief-clancy/pull/315) + [#317](https://github.com/Pushedskydiver/chief-clancy/pull/317). 3 pre-existing madge cycles broken via minimum-scope shared-module extracts (`dep-factory/build-label.ts`, `lifecycle/rework/rework-types.ts`, `installer/install/install-shared.ts`). `@chief-clancy/dev@0.4.2`, `@chief-clancy/terminal@0.2.2`. Madge baseline 3 → 0; first-of-kind state — full monorepo now cycle-free.                                                                                                                                                                                                                                                                                                                                                |
| **§P3 execution-mechanics rules promotion**        | ✅ done                | 2026-04-15    | PR [#314](https://github.com/Pushedskydiver/chief-clancy/pull/314). Three rules moved from Barrier pilot notes into `docs/SELF-REVIEW.md` + `docs/DA-REVIEW.md` §Folder structure per `docs/DEVELOPMENT.md §P3`'s n=2 meta-criterion: §Flatten-boundary intra-wrapper grep (n=1; promoted on rule-emergence + clean-execution evidence), madge cycle-baseline diff (n=2), name-collision audit for bulk sed (n=2). Restart-from-manifest stays n=0. Two-phase grill on the spec; 2 Copilot rounds both accepted.                                                                                                                                                                                                                                                                                                  |
| **Conventions compliance sweep**                   | ✅ done                | 2026-04-17    | Session 95: partial sweep (Rules 1-6, 8-10, 13). Session 96: 6-round audit grilled to nit-floor. Session 97: 9-PR locked plan (PR-D through PR-K) executed end-to-end. Session 98: PR-β (#357) + PR-γ (#359) closed the error-handling migration thread. Net: `@chief-clancy/core` 1.0.1 → 4.0.0 (3 semver-majors across PingResult + `changesRequested` rename + PrCreationFailure tagged union), `@chief-clancy/dev` 0.5.0 → 0.9.0 (4 minors across dev-internal error shapes + parsePlanFile Result + PipelineDeps peer + legacy peer sites), `@chief-clancy/terminal` 0.2.2 → 0.3.0 (1 minor for execCmd surface). Only remaining error-handling thread: the open design question on whether invoke/deliver/feasibility should plumb real error channels — a design decision, deferred workstream if pursued. |
| **Phase 5** — snippet rules promotion              | ✅ done                | 2026-04-16    | 9 readability rules (1, 2, 3, 5, 6, 8, 9, 10, 13) promoted to `docs/CONVENTIONS.md` + review-gate docs + copilot-instructions via 11 near-per-rule sequential PRs (α through λ) across Sessions 89-93. **Rule 4 dropped** (deferred to judgment-rules workstream). **PR-γ infrastructure** (subagent doc-wiring). Rule 12 caught up in PR-λ. 19 Copilot findings total — all reader-precision/terminology on doc prose; the one code-only PR (PR-ι) had zero. Code renames (compute\*/attempt\*) deferred post-Phase-5.                                                                                                                                                                                                                                                                                           |

Detail for all phases lives in git history. Disciplines are documented in `docs/DEVELOPMENT.md`, `docs/DA-REVIEW.md`, `docs/TESTING.md`, `docs/CONVENTIONS.md`, and `docs/RATIONALIZATIONS.md`.

## Build order (remaining packages)

1. ~~`@chief-clancy/brief`~~ — done (Phase A)
2. ~~`@chief-clancy/plan`~~ — done (Phase B + C)
3. ~~`@chief-clancy/dev`~~ — done (Phase E)
4. `@chief-clancy/design` — Phase F (Stitch integration)
5. `@chief-clancy/cli` — interactive wizard
6. `@chief-clancy/chat` — conversational interface (Slack/Teams)

See [`docs/decisions/PACKAGE-EVOLUTION.md`](docs/decisions/PACKAGE-EVOLUTION.md) for the full rationale.

## Repo

https://github.com/Pushedskydiver/chief-clancy
