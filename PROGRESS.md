# Progress

Living state document for the Clancy monorepo. Records the current state, the phase ledger, and the next decision. Session-by-session detail lives in git history (each phase's PRs are tagged + commit messages reference them).

## Next workstreams (after Session 126)

Ordering updated 2026-04-23 (Session 126 — [PR #388](https://github.com/Pushedskydiver/chief-clancy/pull/388) + [PR #389](https://github.com/Pushedskydiver/chief-clancy/pull/389) both Alex-merged; addressed three named out-of-scope carry-forwards (copilot-instructions "7 agent prompts", stale `chat` references, package-list completeness) plus kept-prose cross-doc chain sweep across 5 sibling policy docs. Surrogate-protocol-failure **novel n=1** (timing + audit-comment both skipped on PR #388; Alex caught both sequentially). Kept-prose cross-doc drift pattern n=2 (extends PR #387 n=1; now promotion-ready). Dependabot β window still inactive at session close — 0 Dependabot PRs opened across Sessions 125-126 (3 days elapsed; Monday UTC tick 2026-04-27 still pending).

1. **Phase 7 — Dependency automation.** **7.3.α DONE** (Session 125: `PUT /vulnerability-alerts` + `PUT /automated-security-fixes` → 204/204; verification `GET /automated-security-fixes` → `{"enabled":true,"paused":false}`; git push surfaced `12 vulnerabilities on main (1 critical, 5 high, 5 moderate, 1 low)` — GHSA detection ACTIVE). **7.3.β DONE** (Session 125: [PR #385](https://github.com/Pushedskydiver/chief-clancy/pull/385) merged `bbed9cf` via auto-merge). **β validation window now OPEN** — 14-day minimum from 2026-04-23. Dependabot's first weekly tick is Monday UTC (2026-04-27); watch for security-update PR opens across the 12 known alerts. Two-page-disagreement on pnpm v10 security-update support will be resolved by the window's live-fire outcome: `/dependabot-options-reference` asserts `v9, v10 (version updates only)` qualifier; `/supported-ecosystems-and-repositories` asserts full support, no qualifier. Either outcome shapes γ's design. **7.3.γ NEXT** — policy carve-out PR (`docs/DEVELOPMENT.md §Auto-merge criteria` + `.github/CODEOWNERS` mirror + `.github/dependabot.yml` groups; `open-pull-requests-limit: 0` kept to close γ→δ ordering gap). γ is itself blast-radius (touches 2 policy docs + CODEOWNERS + `.github/dependabot.yml` which is currently NOT blast-radius but γ's policy-doc touch makes the PR Alex-merge regardless). **Trigger for γ**: either (a) β window elapses (≥14 days, 2026-05-07+) with live-fire evidence on pnpm-v10 question, OR (b) Dependabot opens ≥1 security-update PR during β validating the mechanism early. **7.3.δ FUTURE** — `.github/workflows/dep-triage.yml` + atomic `limit: 0 → 5` flip. DA-waiver policy edit in γ (bot-authored autoskip-labelled PRs satisfy DA gate via triage). Phase 7 completion criteria: 90-day ≥80% auto-merge rate OR explicit why-not logged per exception. Phase 8 (autonomous major-version migration per Alex Q3) scoped as future.
   - **12 vulnerabilities RESOLVED** (Session 125 [PR #386](https://github.com/Pushedskydiver/chief-clancy/pull/386), Alex-merged). 0 open / 15 fixed. Triage: `pnpm update -r` for picomatch (both v2+v4 auto-bumped) + `pnpm.overrides` for handlebars + direct devDep `vite: ^8.0.10` (peer-dep anchor). **Novel pnpm-overrides observation**: need direct-dep anchor for peer-dep-satisfied transitives — overrides alone don't take. β window still open; Dependabot's 2026-04-27 Monday UTC tick may still open PRs for already-resolved advisories (data point for pnpm v10 two-page-disagreement resolution).
   - **Option-2 carry-forward cleanup** — [PR #387](https://github.com/Pushedskydiver/chief-clancy/pull/387) Alex-merged removed stale `packages/chat/*` boundaries from `eslint.config.ts` + matching drift at `docs/CONVENTIONS.md:60,63`. Initially scoped eslint-only (auto-merge); final-verification DA + surrogate both caught the CONVENTIONS.md cross-doc drift; bundled the doc fix per DA Path 1 → Alex-handoff. Soft-reset-to-fold fold #4 this session.
2. **Documentation drift follow-ups — ITEM 1 FULLY COMPLETE (Sessions 112-124); follow-up carry-forward sweep extended Session 126.** 13 item-1 PRs shipped Sessions 112-124 (unchanged from Session 125). Session 126 addressed three named out-of-scope carry-forwards via two additional Alex-merged PRs: [PR #388](https://github.com/Pushedskydiver/chief-clancy/pull/388) (copilot-instructions.md package-list drift + stale `chat` reference + agent-count drift + CLAUDE.md cross-doc sync), [PR #389](https://github.com/Pushedskydiver/chief-clancy/pull/389) (kept-prose cross-doc sweep across `docs/ARCHITECTURE.md` + `docs/VISUAL-ARCHITECTURE.md` + `docs/SELF-REVIEW.md` + `docs/DEVELOPMENT.md` + `docs/DA-REVIEW.md` — fixing the 3-link chain + `← wrapper` synonym variant that PR #388's post-merge surrogate stranded).
   - **Remaining named out-of-scope carry-forwards** (each needs dedicated claim-extraction round):
     - `README.md:299` — dependency-direction arrow chain wording-delta vs the policy-doc family (README says "Brief and plan are standalone" + separate scan sentence; policy docs now say "Brief, plan, and scan are standalone" — both accurate, different decomposition).
     - `CONTRIBUTING.md:52-59` — "four packages" block drifted (real count 7); chain still uses `core ← terminal ← wrapper` 3-link form; belongs to the broader package-list rewrite, NOT the chain-sweep scope.
     - `docs/ARCHITECTURE.md:27` adjacent kept prose — `dev depends on core and scan` workspace-dep-layer-true but eslint-boundaries-import-scope false (scan is asset-only). Needs coordinated ARCHITECTURE + VISUAL-ARCHITECTURE symmetric precision rewrite.
   - **Queued follow-up (β from Session 123, optional, Alex-initiated only):** meta-question of whether `docs/GLOSSARY.md` should join the §Auto-merge blast-radius list at `docs/DEVELOPMENT.md §Auto-merge criteria` + `.github/CODEOWNERS §Policy surfaces` as a 9th policy doc. Unchanged from Session 124/125 queued state.
   - Low-priority date-stamp sweeps on stale "Last reviewed" headers (CONVENTIONS, SELF-REVIEW, DA-REVIEW, RATIONALIZATIONS, REVIEW-PATTERNS) can batch as a single nit-sweep or fold into remaining PRs.
3. **Automated session handoff — AUDITED TWICE, DEFERRED.** Second-10-window audit ran Session 123 at `.claude/research/session-handoff/audit-2026-04-23.md` (gitignored) across Sessions 113-122. Result: CLEAN — 0/10 unplanned compactions, handoff-cost median ≈7k tokens (under the 8k threshold; mean drifted +2.4k vs Window 1 due to heavier session complexity, legitimate), 0/2 measured clarifying-question rate. Novel friction class surfaced (output-token-limit mid-draft, n=1 Session 121) — logged but not substrate-adoption-motivating (Routine substrate runs in cloud with fresh context; it'd hit the same intra-turn output limit). First-window audit lives at `audit-2026-04-21.md`. Substrate (Claude Code Routines + `PostCompact` hook) remains research preview. **Next revisit triggers:** (i) any single early-trigger breach from §Measurement protocol (3+ unplanned compactions in 5 sessions / handoff >5min on 2+ sessions / 2+ clarifying-question sessions in a row), OR (ii) drift over a **third 10-session window (Sessions 123-132)**: unplanned-compaction rate ≥2/10, handoff-cost median ≥8k tokens (Window 2 median 7k; trend upward), or clarifying-question rate ≥1/10. Hygiene note persists: backfill discipline degraded (Window 1: 4/7 measurable left TBD; Window 2: 8/10 left TBD) — worth formalising into §Measurement protocol as a session-load step.
4. **Plumb real error channels through invoke/deliver/feasibility** — the open design question from Session 98.
5. **Phase F** — `@chief-clancy/design` (Stitch integration). Deferred pending Phase 7.
6. **Phase 6.2 optional follow-ons (deferred).** (c) §Claim-extraction bucket expansion — always audit kept prose on restructure PRs, even when Copilot reachable. Reconsider if future evidence shows reachable-but-Copilot-missed drift on main. (f) mechanical pre-commit grep-audit for link integrity + literal identifiers — narrow coverage (~1/4 Seed findings). Optional; not load-bearing.

**Policy-surface widening** (`.claude/agents/**`, `docs/decisions/**`, `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/**`, `.github/pull_request_template.md` → CODEOWNERS + §Auto-merge blast-radius exception list) is deliberately deferred. Revisit only if Phase 7.0 audit surfaces a concrete reason.

---

**Session 126 (2026-04-23 → 2026-04-24) — Two carry-forward-cleanup PRs shipped back-to-back.** [PR #388](https://github.com/Pushedskydiver/chief-clancy/pull/388) Alex-merged `cd2e3a2` (copilot-instructions.md + CLAUDE.md drift fix: 3 named out-of-scope carry-forwards closed — "7 agent prompts", stale `chat` refs, package-list completeness). [PR #389](https://github.com/Pushedskydiver/chief-clancy/pull/389) Alex-merged `f3772a8` (kept-prose cross-doc sweep across 5 sibling policy docs: ARCHITECTURE + VISUAL-ARCHITECTURE + SELF-REVIEW + DEVELOPMENT + DA-REVIEW — direct follow-up to PR #388's post-merge surrogate F6 MATERIAL + my own grep catch of the `← wrapper` synonym variant). Dependabot β window inactive — 0 Dependabot PRs across Sessions 125-126. **Two protocol failures on PR #388 (both caught by Alex sequentially, both corrected)**: (1) surrogate dispatched post-merge instead of pre-merge, (2) surrogate findings consumed in-chat rather than posted as PR audit comment. Both restored retroactively on PR #388; PR #389 followed the protocol correctly (surrogate pre-merge + audit comment posted). **Novel patterns: (1) Surrogate-protocol-failure novel n=1 — mechanical process skip, not a judgment error; reversal of pre-/post-merge order on first PR caused the audit-trail-skip on second. (2) Kept-prose cross-doc drift pattern n=2 — promotion-candidate (PR #387 n=1 → PR #388 F6 n=2; now meets n=2 watch threshold, ready for rule-body codification). (3) Synonym-variant grep gap novel n=1 — PR #388 surrogate anchored on `← chief-clancy` and missed `← wrapper`; my own sweep caught it. Candidate discipline bullet: synonym-variant expansion for named-edge grep sweeps.**

**PR [#388](https://github.com/Pushedskydiver/chief-clancy/pull/388) shipped: 1 commit (`ddaa11d` post-soft-reset-to-fold pass 1 from `f3fbc38`), 2 files (`.github/copilot-instructions.md` + `CLAUDE.md`), +5/-5 LOC.** DA pre-merge surfaced 2 MATERIAL: **M1** phrasing "no cross-package imports" literally false (brief/plan have `@chief-clancy/scan` as asset-bundle workspace dep, even though grep confirms zero TS imports) — narrowed to "no core/terminal deps" matching CLAUDE.md's established convention; **M2** edit introduced new cross-doc drift (CLAUDE.md:57 disagreed with updated copilot-instructions.md:26) — bundled CLAUDE.md into the PR. Soft-reset-to-fold pass 1; final-verification DA READY with 5/5 claims verified.

**PR [#389](https://github.com/Pushedskydiver/chief-clancy/pull/389) shipped: 1 commit (`446d7b0` post-soft-reset-to-fold pass 1 from `098c3c0`), 5 files, +7/-7 LOC.** Scope derived from PR #388's post-merge surrogate (F6 MATERIAL: 4 sibling policy docs stranded) plus my own exhaustive grep sweep which caught a 5th file (`docs/DA-REVIEW.md:163-164` via the `← wrapper` synonym the surrogate's regex missed; also a stale `chat` reference on the adjacent L164). DA pre-merge: 1 LOW (L164 enumeration asymmetric with L163 — omitted `chief-clancy`) → folded via soft-reset pass 1. Pre-merge surrogate (mandatory-on-drift-fix): 0 BLOCKING / 0 MATERIAL / 1 LOW (F2 out-of-scope kept prose on ARCHITECTURE.md:27 dev-deps-on-scan — already-logged carry-forward). Audit comment posted pre-merge correctly.

**Surrogate-protocol-failure — novel n=1.** Mechanical process failure: on PR #388 I dispatched the surrogate **after** Alex merged (post-merge instead of pre-merge per `docs/DEVELOPMENT.md §Post-PR flow` step 1 which fires during the review gate), AND I consumed the findings in-chat without posting the audit comment. Alex caught the audit-comment gap first ("Shouldn't the surrogate be done on the PR itself with an audit comment trail?") → I posted it retroactively. Alex then caught the timing gap separately on PR #389 ("Don't you need to run the surrogate on this PR now while it's open?") → I dispatched pre-merge and posted audit comment correctly on #389. Root cause: I was treating the surrogate as a Claude-side verification step rather than a PR-side review step; the former runs whenever I want, the latter has a protocol-mandated slot. Watch n=2 — if it recurs next session, promote to mechanical discipline bullet in `docs/DEVELOPMENT.md §Post-PR flow`.

**Kept-prose cross-doc drift pattern — n=2 (PROMOTION-CANDIDATE).** Session 125 PR #387 surfaced n=1 (`eslint.config.ts` cleanup stranded `docs/CONVENTIONS.md:60,63` kept prose; DA pre-merge caught it). Session 126 PR #388's post-merge surrogate surfaced n=2 (CLAUDE.md + copilot-instructions.md edit stranded the 3-link chain across 4 sibling policy docs; surrogate F6 MATERIAL). Pattern shape: source-of-truth edit silently invalidates unmodified prose in sibling docs that referenced the prior state — diff-scoped pre-merge reviewers systematically miss this class. Distinct from existing `§Cross-doc consistency sweep caller-claim` subclass (codified PR #378) which is about caller-claim self-check on restructure; this is about sibling-doc kept-prose invalidation after source-edit. Now at n=2 watch threshold — ready for rule-body codification proposal in a future rule-promotion PR. Candidate rule home: `docs/DA-REVIEW.md §Cross-doc consistency sweep` with a new subsection on "kept-prose-in-siblings check after source-of-truth edit".

**Synonym-variant grep gap — novel n=1.** PR #388's post-merge surrogate ran `grep -rn "core ← terminal ← chief-clancy"` and found 4 stranded docs. My own sweep added `grep -rn "core ← terminal ← wrapper"` (the `← wrapper` synonym per `eslint.config.ts:53` element type) and caught a 5th file (`docs/DA-REVIEW.md:163-164`). Pattern: named-edge claims can carry synonymous vertex labels across different authors/sessions; anchoring a sweep on one synonym misses the others. Watch n=2 before codifying. Candidate discipline: "when grep-sweeping a named-edge claim across docs, enumerate known synonyms (`chief-clancy` / `wrapper` / element-type-labels) and OR them into the pattern".

**Soft-reset-to-fold lifetime n=14 / 8 consecutive.** 2 passes this session (PR #388 pass 1 for M1+M2 fold; PR #389 pass 1 for L164 symmetry fold). Consecutive streak extends from 6 (Session 125) → 8 (Session 126). Session 125 was the 2-pass-in-one-PR first; Session 126 returned to 1-pass-per-PR discipline.

**Surrogate-on-drift-fix dispatches — n=9 + n=10 cumulative.** Session 126 dispatched the mandatory-drift-fix surrogate twice (PR #388 1 MATERIAL F6 + 0 BLOCKING; PR #389 0 BLOCKING / 0 MATERIAL / 1 LOW out-of-scope). Cumulative across 10 dispatches (Sessions 112, 113, 114, 115, 116, 122, 123, 124, 126×2): 20 MATERIAL + 7 LOW + 1 CLEAN + 1 MATERIAL (F6) + 1 LOW (F2). Pattern holding — surrogate continues to earn its cost as the kept-prose-drift catcher the pre-merge review stack systematically misses.

**Copilot UNREACHABLE — n=18 (Sessions 108-126).** Skip POST per Session 117 directive held both PRs. Surrogate dispatched as mandatory-on-drift-fix (primary trigger cited) + Copilot-unreachable fallback (secondary trigger). Single dispatch per PR.

**Three-options-with-rec — n=5 unchanged.** No scope calls raised Alex-facing options this session; PR scopes were self-selected + DA-corrected. Counter stays at 5.

**Loading-instruction-course-correction — n=2 unchanged.** Session 126's load accepted the Session 125 loading instructions verbatim (β window check + carry-forward task). No primary-source re-verification surfaced a course-correction.

**Grill-internal-inconsistency — n=2 unchanged.** No spec-grill dispatches this session (both PRs were small drift-fixes scoped for direct DA, not spec-grill).

**Novel-patterns-earned summary (Sessions 113-126 cumulative, for archival):**

| Pattern                                                 | n                                                 | First session | Latest         |
| ------------------------------------------------------- | ------------------------------------------------- | ------------- | -------------- |
| Surrogate-effectiveness on drift-fix PR                 | n=10 (2 this session; cumulative 20M+7L+1C+1M+1L) | 112           | 126            |
| Surrogate-clean-on-drift-fix                            | n=1                                               | 122           | —              |
| Surrogate-on-rule-addition                              | n=4 (baseline: 0B+1M+5L)                          | 118           | 124            |
| Surrogate-on-config-addition                            | n=1                                               | 125           | —              |
| Self-referential drift (PROGRESS.md meta → rule body)   | n=3, codified                                     | 116           | 120 (codified) |
| Cross-doc caller-claim self-check                       | n=3, codified PR #378                             | 112           | 115            |
| Kept-prose cross-doc drift (sibling invalidation)       | n=2 (PROMOTION-CANDIDATE)                         | 125           | 126            |
| Synonym-variant grep gap                                | n=1                                               | 126           | —              |
| Surrogate-protocol-failure (timing + audit-trail skip)  | n=1                                               | 126           | —              |
| Exhaustive-grep grill short-circuit                     | n=2, codified PR #378                             | 109           | 112            |
| Scope-split-on-R1-pushback                              | n=1                                               | 116           | —              |
| Scope-reshape-on-R1-pushback (cross-doc generalization) | n=1                                               | 118           | —              |
| Rule-self-apply catches on own PR                       | n=6                                               | 117           | 124            |
| Apply-rule-to-own-spec pre/post-codification            | n=7                                               | 119           | 124            |
| Three-options-with-rec scope-call shape                 | n=5                                               | 119           | 125            |
| Grill-internal-inconsistency                            | n=2 (promotion-candidate at n=3)                  | 120           | 123            |
| Novel-category-surfaced-by-R_n                          | n=1                                               | 121           | —              |
| FVDA-FYI-acted-on                                       | n=1                                               | 122           | —              |
| Loading-instruction course-correction                   | n=2                                               | 123           | 125            |
| First successful auto-merge                             | n=2                                               | 123           | 125            |
| Second-10-window audit CLEAN                            | n=1                                               | 123           | —              |
| Primary-source-page-disagreement                        | n=1                                               | 125           | —              |
| Soft-reset-to-fold                                      | n=14 lifetime; 8 consecutive                      | 115           | 126            |

**Meta-findings (carry-forward to Session 127+):**

- **Phase 7 β window OPEN — 0 Dependabot PRs across 3 days.** Monday UTC tick 2026-04-27 still pending. Per Session 125 trigger logic, γ unblocks when β window elapses (≥14 days, 2026-05-07+) OR earlier live-fire evidence from Dependabot activity.
- **Surrogate-protocol-failure novel n=1.** Watch n=2. Root cause captured: treat surrogate as PR-side review step with protocol-mandated slot (during review gate, before merge; audit comment IS the audit trail per `docs/DEVELOPMENT.md:450`), not as a Claude-side verification I can invoke whenever.
- **Kept-prose cross-doc drift pattern — n=2 PROMOTION-CANDIDATE.** Ready for rule-body codification at `docs/DA-REVIEW.md §Cross-doc consistency sweep` (new subsection on sibling-doc kept-prose invalidation after source-of-truth edit). Queue for a future rule-promotion PR — not urgent.
- **Synonym-variant grep gap — novel n=1.** Watch n=2. Candidate discipline: enumerate known synonyms when grep-sweeping a named-edge claim.
- **Soft-reset-to-fold — lifetime n=14 / 8 consecutive.** Streak held across 2 PRs this session.
- **Surrogate-on-drift-fix dispatches — n=10 cumulative.** 2 dispatches this session (1 MATERIAL F6 + 1 out-of-scope LOW). Pattern holding.
- **Copilot UNREACHABLE n=18.** Skip POST; surrogate primary.
- **§Archival maintenance preemptive-at-handoff — 24 consecutive applications** (Sessions 104-126). This handoff archives Session 122 (detail band was Sessions 122-125 = N=4; Session 126 addition pushes to N=5 → trigger fires).
- **§Measurement protocol third-10-window — data point 4 of 10** (Sessions 123-132).
- **Remaining named out-of-scope carry-forwards** (3 items): README.md:299 wording delta, CONTRIBUTING.md:52-59 "four packages", docs/ARCHITECTURE.md:27 dev-deps-on-scan. Each requires dedicated claim-extraction scope; none urgent.

**Session 126 handoff metrics.** (Data point 4 of third-10-window.)

- Trigger: phase boundary (PR #389 Alex-merged `f3772a8`; two PRs shipped back-to-back is a natural session close).
- Context at trigger: ≈65-75% of pre-compaction budget (manual estimate — heavy session: 2 PR cycles each with branch + edits + self-grep + DA + soft-reset-to-fold + push + PR open + audit comment; 2 surrogate dispatches; 2 protocol corrections surfaced by Alex; 2 retroactive audit comments; this handoff).
- Handoff turn cost: ≈14-18k tokens (this entry + Session 122 archive row + §Next workstreams updates + Session 127 loading instructions + Session 126 table).
- Unplanned compaction: no.
- Time from "handoff now" decision to next-session first productive tool call: TBD (recorded by Session 127).
- `PROGRESS.md` quality signal: TBD (recorded by Session 127).

### Session 127 loading instructions

On load:

1. Read `PROGRESS.md` top-to-bottom (this Session 126 entry + §Next workstreams + detailed entries for Sessions 123-126; Session 122 now archived).
2. **No PR status check needed** — PR #388 + #389 both Alex-merged (`cd2e3a2` + `f3772a8`); this handoff committed post-merge direct-to-main.
3. **Check Dependabot activity first.** β window still open. Run `gh pr list --author "dependabot[bot]" --state all --limit 10` to see if any security-advisory PRs have opened. As of Session 126 close: 0 PRs across 3 days (Sessions 125-126). Monday UTC tick 2026-04-27 is the next expected cadence.
4. **Decision point on load:** same branches as Session 126 load:
   - If Dependabot has opened ≥1 security-advisory PR during β: prioritise triaging. Route via existing blast-radius Alex-handoff. Note the fire as validating the pnpm v10 two-page-disagreement resolution (`/supported-ecosystems-and-repositories` wins). γ can then proceed.
   - If still no Dependabot activity: β window continues. Minimum window completion 2026-05-07 (14 days from 2026-04-23). γ doesn't ship until window elapses OR earlier live-fire evidence.
5. **If Alex directs a carry-forward task:** 3 remaining named out-of-scope items (README L299 wording delta, CONTRIBUTING L52-59 "four packages", ARCHITECTURE L27 dev-deps-on-scan). Each is a distinct claim-extraction scope — best as individual PRs.
6. **If γ is ready to ship:** follow `.claude/research/dependency-automation/proposals.md §7.3.γ`. γ is blast-radius → Alex-merge. Draft spec, spec-grill, DA, open PR, Alex-merge, surrogate.
7. **Protocol discipline reminders** (Session 126 earned):
   - **Surrogate is a PR-side review step, not Claude-side verification.** Dispatch during the review gate (after push, as part of `docs/DEVELOPMENT.md §Post-PR flow` step 1), NOT post-merge. For mandatory-on-drift-fix PRs (commit type `fix(docs)` / `fix(decisions)`), dispatch is required even when Copilot is UNREACHABLE.
   - **Post the surrogate audit comment on the PR.** Per `docs/DEVELOPMENT.md:450` — "the comment is the audit trail". Consuming findings in-chat without posting the audit comment skips the durable trail.
   - **Synonym-variant grep.** When sweeping a named-edge claim (e.g. dependency chain, import direction) across docs, enumerate known synonyms and OR them into the pattern. Session 126 caught one more file by adding `← wrapper` to the `← chief-clancy` sweep.
8. **Re-verify blast-radius status** at load for any file you plan to touch — loading-instruction-course-correction n=2 discipline still applies. Primary sources: `docs/DEVELOPMENT.md §Auto-merge criteria §Exceptions` (L499-503) + `.github/CODEOWNERS §Policy surfaces`.
9. **Carry-overs from Session 126:**
   - **Phase 7 β window still open through ≥2026-05-07.** 0 Dependabot PRs at session close.
   - **Surrogate-protocol-failure novel n=1.** Watch n=2.
   - **Kept-prose cross-doc drift — n=2 PROMOTION-CANDIDATE.** Ready for rule-body codification.
   - **Synonym-variant grep gap — novel n=1.** Watch n=2.
   - **Soft-reset-to-fold lifetime n=14 / 8 consecutive.**
   - **Surrogate-on-drift-fix dispatches — n=10 cumulative.**
   - **Three-options-with-rec — n=5 unchanged.**
   - **Loading-instruction-course-correction — n=2 unchanged.**
   - **Grill-internal-inconsistency — n=2 unchanged.**
   - **Copilot UNREACHABLE n=18.** Skip POST.
   - **§Archival maintenance — 24 consecutive applications.** Session 127 handoff archives Session 123 if detail band grows to N=5.
   - **§Measurement protocol third-10-window — data point 4 recorded** (Sessions 123-132).
10. **If Alex redirects on load** (priority shift, new urgent ask), follow the redirect — §Next workstreams is a default, not a contract.

Named out-of-scope carry-forwards from prior PRs (candidates for future refresh PRs) — trimmed this session (3 items resolved via PR #388 + #389):

- `README.md:299` — dependency-direction wording-delta (scan separated vs grouped).
- `CONTRIBUTING.md:52-59` — "four packages" block drifted (real count: 7).
- `docs/ARCHITECTURE.md:27` adjacent clause — `dev depends on core and scan` workspace-dep-true but eslint-boundaries-import-scope false.

_Resolved Session 126: `.github/copilot-instructions.md` L23-26 package-list drift + L132 "7 agent prompts" + stale `chat` reference (PR #388 + #389)._

---

**Session 125 (2026-04-23) — Phase 7 sub-steps 7.3.α + 7.3.β + 2 follow-up PRs (#386 vuln triage Alex-merged; #387 chat-cleanup Alex-merged) shipped. 7.3.α: `PUT /vulnerability-alerts` + `PUT /automated-security-fixes` both returned 204; repo-level GHSA detection now active; git-push at 7.3.β surfaced `12 vulnerabilities on main (1 critical, 5 high, 5 moderate, 1 low)`. 7.3.β: [PR #385](https://github.com/Pushedskydiver/chief-clancy/pull/385) merged `bbed9cf` via **auto-merge — novel n=2 end-to-end** (extends Session 123 n=1). Standard protocol with 2 soft-reset folds: R1 (5M/4L/2N/2FYI/1MC → folded) → R_n (0B/0M/4L → folded) → per-commit DA on `2966881` (READY + 2 MATERIAL, 1 LOW) → **soft-reset-to-fold pass 1** to `d4ba258` → final-verification DA on `d4ba258` (**NEEDS FIX: F1 retraction-of-real-annotation**; per-commit DA's "fabrication" catch had itself hit a different GitHub docs page) → **soft-reset-to-fold pass 2** to `4729fd3` → final-verification DA re-run on `4729fd3` (READY) → Copilot-unreachable-fallback surrogate (0 findings, clean schema-pair across 4 surfaces) → auto-merge. Copilot UNREACHABLE n=17. **Novel patterns: (1) Soft-reset-to-fold lifetime n=10 / 4 consecutive (Session 125 applied twice in one PR — first time a single PR has required two passes). (2) Loading-instruction-course-correction n=2 (extends Session 123 n=1) — Session 124 handoff + proposals.md framed `.github/dependabot.yml` as `/.github/**` blast-radius, primary-source re-verification showed specific-path-only list. (3) Primary-source-page-disagreement between two GitHub docs pages — novel n=1, pnpm v10 support claim; β is the live-fire test. (4) Surrogate-on-config-addition — novel n=1, new dispatch-class distinct from rule-addition + drift-fix branches. (5) Grill-internal-inconsistency stays at n=2 — per-commit DA's "0 fabrications" self-assessment catch collapsed to page-disagreement once cross-verified; half-correct, not fully-wrong. (6) Novel n=2 auto-merge confirms Session 123's substrate generalises to non-GLOSSARY.md non-blast-radius PRs.\*\*

**PR [#385](https://github.com/Pushedskydiver/chief-clancy/pull/385) shipped: 1 commit (`4729fd3` post-2-soft-resets from `2966881`), 1 file (`.github/dependabot.yml`), +11 LOC net-new.** Config is security-only: `open-pull-requests-limit: 0` disables version-update PRs; Dependabot's separate 10-open-PR internal limit for security-update PRs remains unaffected. `labels: [dependabot-autoskip]` prerequisite created this session via `gh label create dependabot-autoskip` (color `#e7f3e7`, description "Dependabot dep-bump carve-out; route through triage"). β validation window now open through 2026-05-07 minimum.

**7.3.α execution (not a PR).** Both endpoints accepted via `gh` CLI's `repo` scope (no `admin:repo` needed per `X-Accepted-Oauth-Scopes: repo` headers on both endpoints). State before flip: `/vulnerability-alerts` → 404; `/automated-security-fixes` → `{"enabled":false,"paused":false}`. State after: both 204/enabled. Companion prerequisite: `gh label create dependabot-autoskip` ran idempotently.

**Blast-radius re-verification caught a loading-instruction assumption (n=2 novel).** Session 124 handoff said "Alex-handoff via blast-radius (`/.github/**`)" for the β PR. Primary-source re-read at load showed `docs/DEVELOPMENT.md:500` blast-radius list is specific-path only — `/.github/workflows/**`, `/.github/actions/**`, `/.github/instructions/**`, `/.github/copilot-instructions.md`, `/.github/CODEOWNERS` — no wildcard. `.github/CODEOWNERS` mirrors exactly. `.github/dependabot.yml` is therefore NOT blast-radius. Surfaced to Alex with three-options-with-rec (a) auto-merge-eligible / (b) pre-β add to blast-radius list / (c) broader `/.github/**` glob; Alex locked (a) after honest-opinion pushback that the list's design pattern is "irreversible or hard-to-detect downstream failure modes" which `.github/dependabot.yml` doesn't fit (declarative config for third-party bot; can't bypass merge gates). Same mechanism as Session 123 n=1 on GLOSSARY.md; different doc. Watch n=3.

**Two soft-reset folds in one PR.** Pass 1 (`2966881` → `d4ba258`): per-commit DA caught 2 MATERIAL body-prose issues — F1 `+10 vs +11` miscount (real fabrication, R_n had compressed the count) + F2 pnpm "(version updates only)" claim (classified as fabrication by per-commit DA after WebFetching `/supported-ecosystems-and-repositories` which has no qualifier). I accepted both catches + retracted via soft-reset. Pass 2 (`d4ba258` → `4729fd3`): final-verification DA WebFetched `/dependabot-options-reference` and found the qualifier IS real there — F1 pass-1 retraction was itself wrong. Corrected framing from "retraction of fabrication" to "honest two-page-disagreement; β is live-fire test resolving the conflict". This repo runs `pnpm@10.32.1` so the qualifier's scope IS directly relevant. Soft-reset-to-fold lifetime n=10 / 4 consecutive (first time a single PR has required two passes).

**Grill-internal-inconsistency stayed at n=2 — promotion-candidate watch continues.** Per-commit DA's "0 fabrications" self-assessment catch collapsed to page-disagreement once cross-verified: the `+10 vs +11` miscount WAS a real fabrication (confirming partial self-contradiction), but the pnpm annotation was primary-source-accurate on one canonical page (not a true fabrication). Honest downgrade from "n=3 promotion threshold met" framing in pass-1 commit body to "stays at n=2" in pass-2 framing.

**Novel pattern: primary-source-page-disagreement n=1.** Two canonical GitHub Dependabot docs pages genuinely disagree on pnpm v9/v10 security-update support. Not a fabrication class — a multi-source-disagreement class. Grill + DA subagents can reach contradictory conclusions by fetching different canonical pages. Watch n=2 before codifying "WebFetch every relevant canonical page before accepting a negative claim" as a discipline bullet.

**Novel pattern: surrogate-on-config-addition n=1.** Distinct dispatch class from surrogate-on-rule-addition (Sessions 118/120/123/124 at cumulative n=4: 0B+1M+5L) and surrogate-on-drift-fix (Sessions 112-122 at n=8: 19M+7L+1 clean). Session 125's dispatch was on a config-file PR (not policy-doc drift, not rule promotion). Returned 0 findings. Watch n=2 before taxonomising the dispatch-class axis.

**Auto-merge substrate second end-to-end exercise — novel n=2.** Session 123's GLOSSARY.md (PR #383) was first-of-kind. Session 125's `.github/dependabot.yml` is second. Both non-blast-radius, both routed through the full gate sequence (CI + spec-grill + per-commit DA + final-verification DA + surrogate + stability window + `gh pr merge --squash --delete-branch`). Substrate generalises beyond doc-only PRs.

**Copilot UNREACHABLE — n=17 consecutive sessions (108-125).** Skipped POST per Session 117 directive. Surrogate dispatched via Copilot-unreachable fallback (NOT mandatory-on-drift-fix — commit type `chore(dependabot)`, not `fix(docs)`/`fix(decisions)`). Single dispatch; fallback cited as primary trigger in audit comment.

**Novel-patterns-earned summary (Sessions 113-125 cumulative, for archival):**

| Pattern                                                 | n                                                       | First session | Latest         |
| ------------------------------------------------------- | ------------------------------------------------------- | ------------- | -------------- |
| Surrogate-effectiveness on drift-fix PR                 | n=8                                                     | 112           | 122            |
| Surrogate-clean-on-drift-fix                            | n=1                                                     | 122           | —              |
| Surrogate-on-rule-addition                              | n=4 (baseline: 0B+1M+5L)                                | 118           | 124            |
| Surrogate-on-config-addition                            | n=1                                                     | 125           | —              |
| Self-referential drift (PROGRESS.md meta → rule body)   | n=3, codified                                           | 116           | 120 (codified) |
| Cross-doc caller-claim self-check                       | n=3, codified PR #378                                   | 112           | 115            |
| Exhaustive-grep grill short-circuit                     | n=2, codified PR #378                                   | 109           | 112            |
| Scope-split-on-R1-pushback                              | n=1                                                     | 116           | —              |
| Scope-reshape-on-R1-pushback (cross-doc generalization) | n=1                                                     | 118           | —              |
| Rule-self-apply catches on own PR                       | n=6                                                     | 117           | 124            |
| Apply-rule-to-own-spec pre/post-codification            | n=7                                                     | 119           | 124            |
| Three-options-with-rec scope-call shape                 | n=5                                                     | 119           | 125            |
| Grill-internal-inconsistency                            | n=2 (promotion-candidate at n=3; stayed at n=2 this PR) | 120           | 123            |
| Novel-category-surfaced-by-R_n                          | n=1                                                     | 121           | —              |
| FVDA-FYI-acted-on                                       | n=1                                                     | 122           | —              |
| Loading-instruction course-correction                   | n=2                                                     | 123           | 125            |
| First successful auto-merge                             | n=2                                                     | 123           | 125            |
| Second-10-window audit CLEAN                            | n=1                                                     | 123           | —              |
| Primary-source-page-disagreement                        | n=1                                                     | 125           | —              |
| Soft-reset-to-fold                                      | n=10 lifetime; 4 consecutive                            | 115           | 125            |

**Meta-findings (carry-forward to Session 126+):**

- **Phase 7 — 7.3.α + 7.3.β DONE.** β window open through 2026-05-07 minimum. Watch Dependabot security-advisory PRs at first Monday UTC tick (2026-04-27).
- **12 vulnerabilities on main — RESOLVED** Session 125 [PR #386](https://github.com/Pushedskydiver/chief-clancy/pull/386) (Alex-merged). 0 open / 15 fixed.
- **PR #387 (Alex-merged)** — stale `packages/chat/*` boundaries config removed from `eslint.config.ts` + matching cross-doc drift in `docs/CONVENTIONS.md:60,63`. DA-caught kept-prose drift; bundled via soft-reset fold #4 per DA Path 1 recommendation.
- **Novel n=2 auto-merge.** Substrate validated on non-GLOSSARY non-blast-radius PR (PR #385).
- **Soft-reset-to-fold n=12 / 6 consecutive.** Session 125 applied 4 times across 3 PRs (twice on #385, once on #386, once on #387). First 2-pass-in-one-PR application (#385).
- **Loading-instruction-course-correction n=2.** Watch n=3. Discipline: re-verify loading instructions against primary source on load.
- **Primary-source-page-disagreement — novel n=1** (PR #385). Watch n=2. Hypothesis: "WebFetch every relevant canonical page before accepting a negative claim" is a discipline-candidate.
- **Surrogate-on-config-variants — n=3** (#385 addition + #386 modification + #387 deletion). Cumulative: 0B / 1M / 1L / 1FYI. Watch whether pattern differentiates from rule-addition / drift-fix dispatches.
- **pnpm-overrides need direct-dep anchor for peer-dep-satisfied transitives — novel observation n=1** (PR #386). Empirical. Watch recurrence.
- **Kept-prose cross-doc drift caught by DA — n=1** (PR #387, `docs/CONVENTIONS.md:60,63` invalidated by `eslint.config.ts` cleanup). Distinct from `§Cross-doc consistency sweep` caller-claim subclass (which is already codified): this is "source-of-truth edit silently invalidates documentation that referenced the prior state". Watch n=2.
- **Grill-internal-inconsistency — n=2.** Promotion-candidate watch continues; Session 125's candidate instance collapsed to page-disagreement + partial-self-contradiction (not clean n=3).
- **Three-options-with-rec — n=5.** (Alex blast-radius scope call). Watch n=6.
- **Copilot UNREACHABLE n=17.** Skip POST; surrogate primary.
- **§Archival maintenance preemptive-at-handoff — 23 consecutive applications** (Sessions 104-125). This handoff archives Session 121.
- **§Measurement protocol third-10-window data point 3 of 10** (Sessions 123-132).
- **Queued follow-ups:**
  - (α) GLOSSARY.md on blast-radius list (Alex-initiated; unchanged from Session 124).
  - (β) Proposals.md §7.3.β line 101 was corrected in-place Session 125 (gitignored file, not a PR; `(+10 lines)` → `(+11 lines)` + auto-merge-eligible framing replaces `/.github/**` framing).

**Session 125 handoff metrics.** (Data point 3 of third-10-window.)

- Trigger: phase boundary (PR #385 auto-merged `bbed9cf`; release.yml in-progress no-op on skip-changeset).
- Context at trigger: ≈70-75% of pre-compaction budget (manual estimate — very heavy session: 7.3.α execution + three-options-with-rec scope call + label create + spec draft + 2 spec-grill rounds + 2 soft-reset folds + 3 full DA rounds + surrogate + WebFetch ×4 + force-push + audit comment + this handoff + Session 121 archival).
- Handoff turn cost: ≈12-14k tokens (Session 125 detail entry + Session 121 archive row + §Next workstreams full rewrite + Session 126 loading instructions).
- Unplanned compaction: no.
- Time from "handoff now" decision to next-session first productive tool call: TBD (recorded by Session 126).
- `PROGRESS.md` quality signal: TBD (recorded by Session 126).

### Session 126 loading instructions

On load:

1. Read `PROGRESS.md` top-to-bottom (this Session 125 entry + §Next workstreams + detailed entries for Sessions 122-125; Session 121 now archived).
2. **No PR status check needed** — PR #385 already auto-merged (`bbed9cf`); this handoff committed post-merge direct-to-main.
3. **Check Dependabot activity first.** β window is open. Run `gh pr list --author "dependabot[bot]" --state all --limit 10` to see if any security-advisory PRs have opened. Surface count + severity spread to Alex.
4. **Decision point on load:** if Dependabot has opened ≥1 security-advisory PR during β:
   - Prioritise triaging that PR (route via existing blast-radius Alex-handoff — γ's carve-out not yet landed).
   - β mechanism is validated (pnpm v10 security-update PRs DO fire); two-page-disagreement resolved toward `/supported-ecosystems-and-repositories`.
5. **If no Dependabot activity yet:** β window continues. Minimum window completion 2026-05-07 (14 days from 2026-04-23). γ doesn't ship until window elapses OR earlier live-fire evidence arrives.
6. **If γ is ready to ship:** follow `.claude/research/dependency-automation/proposals.md §7.3.γ`. γ is itself blast-radius (touches `docs/DEVELOPMENT.md` + `.github/CODEOWNERS` + `.github/dependabot.yml`) → Alex-merge regardless. Draft spec, spec-grill, DA, open PR, Alex-merge, surrogate.
7. **Re-verify blast-radius status** at load for any file you plan to touch — loading-instruction-course-correction n=2 discipline applies. Primary sources: `docs/DEVELOPMENT.md §Auto-merge criteria §Exceptions` + `.github/CODEOWNERS §Policy surfaces`.
8. **Carry-overs from Session 125:**
   - **Phase 7 — 7.3.α + 7.3.β DONE; β window open through ≥2026-05-07.**
   - **12 vulnerabilities RESOLVED via PR #386** (Alex-merged, 0 open now). Dependabot 2026-04-27 Monday UTC tick may still open PRs anyway for already-resolved advisories (data point for pnpm v10 two-page-disagreement resolution).
   - **Novel n=2 auto-merge** — substrate generalises. Future non-blast-radius PRs default to auto-merge.
   - **Soft-reset-to-fold n=12 / 6 consecutive.** Session 125 applied 4 times across 3 PRs.
   - **Loading-instruction-course-correction n=2.** Watch n=3.
   - **Primary-source-page-disagreement — novel n=1** (PR #385). Watch n=2.
   - **Surrogate-on-config-variants — n=3** (PR #385 addition + #386 modification + #387 deletion; cumulative 0B/1M/1L/1FYI). Watch.
   - **pnpm-overrides need direct-dep anchor for peer-dep-satisfied transitives** — novel n=1 (PR #386).
   - **Kept-prose cross-doc drift caught by DA** — n=1 (PR #387). Watch n=2.
   - **Grill-internal-inconsistency — n=2.** Promotion-candidate watch (Session 125 candidate collapsed).
   - **Three-options-with-rec — n=5.** Watch n=6.
   - **Copilot UNREACHABLE n=17.** Skip POST directive holds (Session 117).
   - **§Archival maintenance — 23 consecutive applications.** Session 126 handoff should archive Session 122 if detail band grows to N=5.
   - **§Measurement protocol third-10-window — data point 3 recorded.**
9. **If Alex redirects on load** (priority shift, new urgent ask), follow the redirect — §Next workstreams is a default, not a contract.

Named out-of-scope carry-forwards from prior PRs (candidates for future refresh PRs) — unchanged from Session 124:

- `.github/copilot-instructions.md` — "7 agent prompts" claim vs actual 2 under `packages/terminal/src/agents/`.
- `.github/copilot-instructions.md` — package-list drift (nonexistent chat, omits dev/scan).
- `README.md` L299 — dependency-direction arrow chain transitive-only.
- `CONTRIBUTING.md` L52-59 — "four packages" block drifted (real count: 7).
- `docs/ARCHITECTURE.md` L27 — dev-deps-on-scan claim vs eslint allow-list (scan is content-only). Verify during future ARCHITECTURE follow-up.

_Resolved Session 125: `eslint.config.ts` L53 stale `chat` element + `docs/CONVENTIONS.md:60,63` matching drift (PR #387 Alex-merged)._

---

**Session 124 (2026-04-23) — Item 1.f TESTING.md Layer-2 integration-layer body section shipped. [PR #384](https://github.com/Pushedskydiver/chief-clancy/pull/384) merged `98a621b` via Alex-merge (TESTING.md on §Auto-merge criteria blast-radius list per `docs/DEVELOPMENT.md §Auto-merge criteria §Exceptions` + `.github/CODEOWNERS §Policy surfaces`). Standard protocol: spec-grill R1 (3B/2M/5L/2N/2FYI/1MC, all folded) → R_n (18/18 CONFIRMED + 1 LOW cosmetic) → per-commit DA READY + final-verification DA READY (both 0 findings) → surrogate via Copilot-unreachable fallback (0B / 1M / 2L, all folded via soft-reset). Copilot UNREACHABLE n=16. Novel patterns: surrogate-on-rule-addition n=4 with FIRST MATERIAL (F1 "quality reports" over-claim — baseline recalibrated from n=3 0B+0M+3L to n=4 0B+1M+5L); soft-reset-to-fold lifetime n=8 (resumes consecutive counting after Session 123 single-session streak). **Item 1 — the 14-week documentation-drift follow-up workstream — is now FULLY COMPLETE** across 13 PRs (Sessions 112-124).**

**PR [#384](https://github.com/Pushedskydiver/chief-clancy/pull/384) shipped: 1 commit (`68a92a7` post-soft-reset from `39a045d`), 1 file (`docs/TESTING.md`), +53/-4 LOC.** Three edits: (a) new `## Layer 2: Integration tests` section body (47 lines: opener + §How to run + §File structure + §How they work + §Distinct from Layer 1 / Layer 3) inserted after the `---` separator at old-L93; (b) rename `## Layer 2: E2E tests` → `## Layer 3: E2E tests` honouring the opener's "3-layer" promise; (c) Quick-reference comment corrections at L8/L30/L33 ("All unit tests" → "All tests (unit + integration)" variants). Commit type `docs(TESTING)` rule-addition per `docs/GIT.md §Rules` bullet 2 predicate 2.

**Review stack fired end-to-end across 6 rounds + surrogate.** Spec-grill R1 (discovery): 3 BLOCKING + 2 MATERIAL + 5 LOW + 2 Nit + 2 FYI + 1 MC — all folded. Key folds: **B1** pipeline-count arithmetic "7 files" vs actual 8 in spec §Evidence — same class as PR #376 R1 B2 "11 vs 10" miscount (meta-ironic since spec's drift-surfacing origin is that same class); **B2** spec's `docs/TESTING.md:94` separator claim wrong (actual L93 — corrected with full line-map); **B3** insertion-geometry ambiguity (clarified "after `---` at L93, before header at L95"); **M1** scope expansion to include L8 Quick-reference comment fix (+1 LOC) — pre-existing "All unit tests" inaccuracy becomes active contradiction once Layer 2 lands; **M2** cross-file line-number citations in spec Evidence switched to section-name anchors. R_n (verification on 18 claims): 18/18 CONFIRMED + 1 LOW cosmetic (docblock line-range counting noise in author-controlled scratch, non-actionable). Per-commit DA on `39a045d`: READY TO MERGE + 0 findings + 2 non-actionable FYI; 15/15 enumerable claims verified. Final-verification DA: READY TO MERGE + 0 findings + 2 non-actionable FYI; 15/15 claims re-verified at HEAD.

**Copilot UNREACHABLE — n=16 consecutive sessions (108-124).** Detected via full two-signal protocol this session (my error — should have skipped POST per Session 117 directive). Signal (a): POST response body `"requested_reviewers":[]`. Signal (b): no `copilot_work_started` event in timeline within 5+ min (actual elapsed: 334s). Both fire → UNREACHABLE confirmed. Surrogate dispatched via Copilot-unreachable fallback (NOT mandatory-on-drift-fix — commit type is `docs(TESTING)` rule-addition).

**Surrogate: 0 BLOCKING / 1 MATERIAL / 2 LOW — all folded via soft-reset.** 32 claims extracted at HEAD `39a045d`; 30 verified; 1 falsified ("quality reports" in asserted side-effects list — grep of `github-happy-path.test.ts` confirmed no `expect(...)` on quality files; primary-source docblock L11 says "(branches, lock cleanup, progress entries)" verbatim); 2 reader-precision issues (F2 hooks file-tree annotation over-generalised beyond PreToolUse subset; F3 Layer 1 §How-to-run L30 comment drift parallel to the L8 fix I made). All three folded. Fold rationale: F1 aligned prose to docblock + added qualifying sentence about DI-wired-but-not-asserted `qualityFs`/`costFs`; F2 annotation narrowed to "PreToolUse subset verifies JSON decision output"; F3 closed SELF-REVIEW §Consistency L114 catch on "edits more than one section, re-read each against every other".

**Surrogate-on-rule-addition — n=4, BASELINE RECALIBRATED.** Cumulative across 4 dispatches (Sessions 118, 120, 123, 124): **0 BLOCKING + 1 MATERIAL + 5 LOW**. First MATERIAL on rule-addition surrogate. Hypothesis shift: prior 3-dispatch clean baseline (0B + 0M + 3L) was preliminary; larger-scope rule-addition PRs can surface factually falsifiable over-claims in rule-body prose that still slip past the pre-merge review stack. Watch n=5: if MATERIAL rate rises, surrogate is load-bearing for rule-addition PRs distinct from its drift-fix role. Distinct evidence base from drift-fix surrogate (n=8: 19 MATERIAL + 7 LOW + 1 CLEAN).

**Rule-self-apply catches on own PR — n=6 (extends Session 123 n=5).** Surrogate F3 catch is a direct self-apply of SELF-REVIEW §Consistency L114 ("when a diff modifies more than one section, re-read each new/edited passage against every other new/edited passage in the same diff") on my own PR: I corrected L8 Quick-reference comment but left the parallel L30 comment stale. Single distinct catch this session extends the baseline. Watch n=7.

**Soft-reset-to-fold — lifetime n=8 (resumes consecutive counting).** Session 123 established 1-consecutive; Session 124 applied soft-reset once (to fold F1/F2/F3 into the original commit atomically rather than stacking fold-commits) — consecutive streak now at 2. Lifetime cumulative: Sessions 115, 116, 117, 118, 119, 120, 123, 124.

**Three-options-with-rec — n=4 (extends Session 123 n=3).** Session 124 opened with three bundled scope calls (Q1 section naming + renumbering, Q2 body depth, Q3 file-tree exhaustiveness); all three with (a)/(b)/(c) options + explicit recommendation + rationale. Alex locked all-(a) with confidence qualifier. Bundled-scope-calls-per-PR is novel shape (2 in Session 123, 3 in Session 124). Watch n=5.

**Apply-rule-to-own-spec pre/post-codification — n=7 (extends Session 123 n=6).** Self-referential-drift rule (codified PR #380) continued as discipline: spec evidence cited PR# + §section-name; commit-message avoided cross-file line-number refs for restructure-eligible policy docs (though kept two `DEVELOPMENT.md:502` + `CODEOWNERS:31` metadata refs — noted in self-review as NOTICED BUT NOT TOUCHING since those blocks have been stable across 7 prior sessions).

**Grill-internal-inconsistency — n=2 unchanged.** R_n ran the hunt explicitly; returned only cosmetic docblock line-range noise in author-controlled scratch. No novel sub-class surfaced. Promotion-candidate still at n=2, awaiting n=3 for codification.

**Novel-patterns-earned summary (Sessions 113-124 cumulative, for archival):**

| Pattern                                                 | n                                                  | First session | Latest         |
| ------------------------------------------------------- | -------------------------------------------------- | ------------- | -------------- |
| Surrogate-effectiveness on drift-fix PR                 | n=8                                                | 112           | 122            |
| Surrogate-clean-on-drift-fix                            | n=1                                                | 122           | —              |
| Surrogate-on-rule-addition                              | n=4 (baseline recalibrated at n=4: first MATERIAL) | 118           | 124            |
| Self-referential drift (PROGRESS.md meta → rule body)   | n=3, codified                                      | 116           | 120 (codified) |
| Cross-doc caller-claim self-check                       | n=3, codified PR #378                              | 112           | 115            |
| Exhaustive-grep grill short-circuit                     | n=2, codified PR #378                              | 109           | 112            |
| Scope-split-on-R1-pushback                              | n=1                                                | 116           | —              |
| Scope-reshape-on-R1-pushback (cross-doc generalization) | n=1                                                | 118           | —              |
| Rule-self-apply catches on own PR                       | n=6                                                | 117           | 124            |
| Apply-rule-to-own-spec pre/post-codification            | n=7                                                | 119           | 124            |
| Three-options-with-rec scope-call shape                 | n=4                                                | 119           | 124            |
| Grill-internal-inconsistency                            | n=2 (promotion-candidate at n=3)                   | 120           | 123            |
| Novel-category-surfaced-by-R_n                          | n=1                                                | 121           | —              |
| FVDA-FYI-acted-on                                       | n=1                                                | 122           | —              |
| Loading-instruction course-correction                   | n=1                                                | 123           | —              |
| First successful auto-merge                             | n=1                                                | 123           | —              |
| Second-10-window audit CLEAN                            | n=1 (after Window 1 n=1)                           | 123           | —              |
| Soft-reset-to-fold                                      | n=8 lifetime; 2 consecutive                        | 115           | 124            |

**Meta-findings (carry-forward to Session 125+):**

- **Item 1 (doc-sweep follow-ups) FULLY COMPLETE.** 13 PRs shipped Sessions 112-124. 14-week carry-forward cleared.
- **Surrogate-on-rule-addition — n=4, baseline recalibrated.** FIRST MATERIAL dispatch (F1 "quality reports" over-claim). New baseline: 0B + 1M + 5L across 4 dispatches. Distinct evidence base from drift-fix (n=8: 19M + 7L + 1 clean). Watch n=5 for whether MATERIAL rate rises.
- **Rule-self-apply catches on own PR — n=6.** Watch n=7.
- **Apply-rule-to-own-spec pre/post-codification — n=7.** Codified discipline holding. Watch n=8.
- **Three-options-with-rec — n=4.** Multi-question-per-PR shape continuing (2 in Session 123, 3 in Session 124). Watch n=5.
- **Soft-reset-to-fold — lifetime n=8; 2 consecutive.** Streak resumed.
- **Grill-internal-inconsistency — n=2.** Promotion-candidate at n=3. Watch.
- **Copilot UNREACHABLE n=16.** Skip POST (Session 117 directive); I violated this Session 124 and re-confirmed detection fires. Surrogate via fallback remains primary.
- **§Archival maintenance preemptive-at-handoff — 22 consecutive applications** (Sessions 104-124). This handoff archives Session 120.
- **§Measurement protocol third-10-window data point 2 of 10** (Sessions 123-132).
- **Queued β follow-up:** GLOSSARY.md on blast-radius list. Alex-initiated.
- **Phase 7 — NEXT UP.** Starting with 7.3.α Dependabot Security Alerts flip via `gh api` (two PUT calls; not a PR; Alex may need to run if token lacks admin scope).

**Session 124 handoff metrics.** (Data point 2 of third-10-window.)

- Trigger: phase boundary (PR #384 merged by Alex `98a621b`; handoff commit direct-to-main post-merge).
- Context at trigger: ≈70-75% of pre-compaction budget (manual estimate — heavy session: blast-radius re-verification + 3 scope calls + spec draft + 2 spec-grill rounds with full fold + per-commit DA + final-verification DA + surrogate dispatch with MATERIAL fold + soft-reset + pre-push ×2 + Copilot-timeline wait + audit comment + Session 120 archival + this handoff).
- Handoff turn cost: ≈10-12k tokens (this entry + Session 120 archive row + §Next workstreams full reorder + Session 125 loading instructions + Session 124 table).
- Unplanned compaction: no.
- Time from "handoff now" decision to next-session first productive tool call: TBD (recorded by Session 125).
- `PROGRESS.md` quality signal: TBD (recorded by Session 125).

### Session 125 loading instructions

On load:

1. Read `PROGRESS.md` top-to-bottom (this Session 124 entry + §Next workstreams + detailed entries for Sessions 121-124; Session 120 now archived).
2. **No PR status check needed** — PR #384 already merged (`98a621b`); this handoff committed post-merge direct-to-main.
3. **Item 1 is FULLY COMPLETE.** 13 PRs shipped Sessions 112-124. Next workstream is Phase 7.
4. **Start on Phase 7 — first action: 7.3.α Dependabot Security Alerts flip.** Per `.claude/research/dependency-automation/proposals.md §7.3` (gitignored, readable locally). Two PUT calls via `gh api` — not a PR. **Alex may need to run these if token lacks admin scope** — surface that question up front. After 7.3.α, proceed to 7.3.β (first PR: `.github/dependabot.yml` security-only + `gh label create dependabot-autoskip` + 14-day validation window).
5. **Re-verify blast-radius status** at load for any file you plan to touch — loading-instruction-course-correction n=1 earned Session 123 still applicable. Primary sources: `docs/DEVELOPMENT.md §Auto-merge criteria §Exceptions` + `.github/CODEOWNERS §Policy surfaces`.
6. **Queued β follow-up (optional, Alex-initiated only):** GLOSSARY.md to blast-radius list. Not blocking Phase 7.
7. **Carry-overs from Session 124:**
   - **Item 1 — DONE.** 14-week carry-forward workstream complete.
   - **Surrogate-on-rule-addition — n=4 baseline recalibrated (first MATERIAL).** Watch n=5.
   - **Rule-self-apply catches on own PR — n=6.** Watch n=7.
   - **Apply-rule-to-own-spec — n=7.**
   - **Three-options-with-rec — n=4.** Multi-question-per-PR shape continues.
   - **Soft-reset-to-fold — lifetime n=8; 2 consecutive.**
   - **Grill-internal-inconsistency — n=2.** Promotion-candidate at n=3.
   - **Copilot UNREACHABLE n=16.** Skip POST per Session 117 directive (I violated this Session 124 — re-commit to the skip).
   - **§Archival maintenance preemptive-at-handoff — 22 consecutive applications.** Session 125's handoff should archive Session 121 if detail band grows to N=5.
   - **§Measurement protocol third-10-window — data point 2 of 10 logged this session.**
8. **If Alex redirects on load** (priority shift, new urgent ask), follow the redirect — §Next workstreams is a default, not a contract.

Named out-of-scope carry-forwards from prior PRs (candidates for future refresh PRs) — unchanged from Session 123:

- `.github/copilot-instructions.md` — "7 agent prompts" claim vs actual 2 under `packages/terminal/src/agents/`.
- `.github/copilot-instructions.md` — package-list drift (nonexistent chat, omits dev/scan).
- `README.md` L299 — dependency-direction arrow chain transitive-only.
- `CONTRIBUTING.md` L52-59 — "four packages" block drifted (real count: 7).
- `docs/ARCHITECTURE.md` L27 — dev-deps-on-scan claim vs eslint allow-list (scan is content-only). Verify during future ARCHITECTURE follow-up.
- `eslint.config.ts` L53 — stale `chat` element (no on-disk package).

---

**Session 123 (2026-04-23) — Item 1.e GLOSSARY.md §Review process section shipped (Copilot-surrogate + Copilot-unreachable detection entries, narrow subset per option b). [PR #383](https://github.com/Pushedskydiver/chief-clancy/pull/383) merged `be5d6de` — FIRST SUCCESSFUL AUTO-MERGE on this repo via the §Auto-merge criteria substrate. Also: second-10-window §Measurement protocol audit CLEAN (0/10 unplanned compactions, 7k median handoff cost, 0/2 measured clarifying-qs); audit file at `.claude/research/session-handoff/audit-2026-04-23.md`. Rule-self-apply n=5 (extends Session 121 n=4). Three-options-with-rec n=3 (extends Session 121 n=2, two scope calls in this PR). Soft-reset-to-fold resumes at n=7 after 2-session pause. Grill-internal-inconsistency n=2 (extends Session 120 novel n=1, promotion-candidate status). Copilot UNREACHABLE n=15. Surrogate-on-rule-addition n=3 (extends Session 120 n=2).**

**PR [#383](https://github.com/Pushedskydiver/chief-clancy/pull/383) shipped: 1 commit (`42a6c1a` post-soft-reset from `f51a368`), 1 file (`docs/GLOSSARY.md`), +7/-0 LOC.** Inserts a new `## Review process` section between §Pipeline Labels (L92) and §Reliability (L101) with two canonical-terminology entries — Copilot-surrogate (subagent contract + two-trigger structure + HEAD-scope read + three DA-REVIEW passes) + Copilot-unreachable detection (two-observable-signals-both-required protocol). Both entries anchor on mechanical invariants rather than ephemeral counts. Commit type `docs(GLOSSARY)`: new rule-addition per `docs/GIT.md §Rules` bullet 2 predicate 2 excluding "new rule additions, or rule-body rewrites" from the `fix(docs)` carve-out.

**First-of-kind auto-merge substrate validation.** `main` branch-protection verified absent (`gh api repos/.../branches/main/protection` → 404). GLOSSARY.md verified absent from both blast-radius surfaces (`docs/DEVELOPMENT.md:499-502` + `.github/CODEOWNERS:23-31`). All auto-merge gates green end-to-end: CI 5/5 SUCCESS + ≥30s stability + per-commit DA READY + final-verification DA READY (0 findings) + self-review + 10min Copilot hang fallback elapsed (UNREACHABLE n=15; POST skipped) + `docs` + `skip-changeset` labels + no blast-radius exception + no HITL trigger. `gh pr merge --squash --delete-branch` succeeded; release.yml completed clean (no changeset present → no-op). First end-to-end exercise of the §Auto-merge criteria substrate — previously aspirational infrastructure.

**Loading-instruction course-correction n=1 novel.** Session 122 handoff said "Alex-merge when blast-radius fires" for 1.e, but blast-radius verification found GLOSSARY.md NOT on the list. Surfaced to Alex at load time per Surface Assumptions discipline + honesty-first memory; Alex pivoted to treat this as an auto-merge test ("most recent PRs have been within the blast radius"). The pattern: loading-instructions can carry assumptions not verified against current primary-source state; re-verifying before committing protects against forward-propagation. Watch n=2.

**Two scope calls — three-options-with-rec n=3 (extends Session 121 n=2).** First call: which terms earn glossary entries — options (a) all 5 candidates / (b) narrow subset by cross-reference frequency / (c) topic-grouped sections. Recommended (b) on bimodal-distribution evidence (8/5/1/0/0 hits across 5 candidates; natural cut-point between 5+ and ≤1); Alex accepted with "strong evidence" qualifier. Second call: blast-radius treatment — options (α) ship narrow / (β) bundle GLOSSARY.md-to-blast-radius update / (γ) split. Recommended (γ) citing precedent (Session 116 scope-split-on-R1-pushback n=1 would extend) + self-containedness of α + auto-merge-test value as first non-blast-radius PR. Alex locked (γ) with the auto-merge-test framing.

**Review stack fired end-to-end across 5 rounds + surrogate.** Spec-grill R1 (discovery): 1 BLOCKING + 4 MATERIAL + 5 LOW + 4 Nit + 3 FYI + 3 MC — folded. Key folds: **B1** (Copilot-unreachable frequency claim `8 hits` disproven by grep — actual 6 hits; §Why re-derived against primary-source ground truth rather than relying on the original matching-too-broad grep that counted `UNREACHABLE` all-caps session-narrative tokens). **M1** dropped `(dial)` from Copilot-unreachable entry. **M3** corrected `docs/GIT.md §Rules bullet 1` → `bullet 2` attribution (the `fix(docs)` predicate is under bullet 2's carveout). **M4** restored "any commit in the PR uses" verbatim (spec had compressed to "any commit uses"). **MC2** added Strategist-placement alternative to §Placement rationale rejected-options list (role-scoped vs infrastructure-scoped distinction). R_n verification (confirm-or-disprove brief on 24 claims): **24/24 CONFIRMED** + 1 novel Nit (grill-internal-inconsistency on the spec's own LOC count — `~6-7` in §What-changes vs `≤5` in §Auto-merge path). Folded. Per-commit DA on `f51a368`: READY TO MERGE + 1 LOW (anchor-parity — only §Claim-extraction was linked; §Multi-section + §Schema-pair should be links too). Folded via soft-reset to `42a6c1a` for single-commit ship. Final-verification DA on PR diff: READY TO MERGE, 0 findings.

**Copilot UNREACHABLE — n=15 consecutive sessions (108-123).** Skipped `gh api requested_reviewers` POST per Session 117 directive. Surrogate dispatched via Copilot-unreachable fallback branch (NOT mandatory-on-drift-fix — commit type is `docs(GLOSSARY)` not `fix(docs)`/`fix(decisions)`).

**Surrogate: 0 BLOCKING / 0 MATERIAL / 3 LOW — all dismiss-with-evidence.** 34 claims extracted across `docs/GLOSSARY.md` at HEAD `42a6c1a`; 31 verified; 3 falsified (F1 revert carve-out elided from "any commit"; F2 scope-filter elided from "each file"; F3 prior-round-on-record branch read loosely by surrogate despite entry's "for no-prior-round PRs" scoping qualifier). All 3 dismissed: F1+F2 are summary compressions that match primary-source phrasing verbatim (glossary reproduces the agent-file and DEVELOPMENT.md:450 phrasing); F3 is surrogate-side misread of a restrictive scoping qualifier that is present. Schema-pair check between the two entries clean (detection fires → surrogate dispatches via fallback branch; both sides agree). **Surrogate-on-rule-addition n=3** (extends Session 120 n=2 + Session 118 novel n=1). Cumulative across 3 rule-addition dispatches: 0 BLOCKING + 0 MATERIAL + 3 LOW (all surface-level compression / reader-precision). Distinct evidence base from drift-fix surrogate (n=8 = 19 MATERIAL + 7 LOW + 1 CLEAN).

**Rule-self-apply — n=5 (extends Session 121 n=4).** Two distinct self-apply catches on this PR's review stack: **(1) R_n caught grill-internal-inconsistency on the spec's own LOC** (the exact class codified Session 120 novel n=1 — table-vs-narrative drift applied to a spec-metadata inconsistency) — ephemeral-surface per DA-REVIEW.md:65 but still a self-apply pattern of the rule being reviewed. **(2) Per-commit DA caught LOW 1 anchor-parity** — since the diff itself is codifying three DA-REVIEW passes as a linked triad in the glossary, the DA (whose discipline is anchor-integrity under §Cross-doc consistency sweep) caught the self-application failure where only the first of the three passes was linked. Both catches extend the n=4 baseline from Session 121; prior catches were R_n tally-elision (121), FVDA Session 116 ambiguity (120 final-DA), per-commit DA cross-doc overlap (120), and R_n narrative vs table (120). Watch n=6.

**Grill-internal-inconsistency — n=2 (extends Session 120 novel n=1).** R_n v2 caught LOC-count inconsistency between spec §What-changes ("~6-7 added") and §Auto-merge path ("≤5 LOC"). Same class as Session 120's R_n table-vs-narrative mismatch on carry-forward scope. Two independent data points across two independent rule-addition PRs; pattern is promotion-candidate at n=3 if a future PR surfaces a third instance. Watch for codification of "R_n discipline hunts for table-vs-narrative / spec-metadata-inconsistency as an explicit sub-class of §Multi-section internal-consistency pass".

**Apply-rule-to-own-spec pre/post-codification — n=6 (extends Session 122 n=5).** Self-referential-drift rule (codified PR #380) continued as discipline throughout Session 123: spec draft anchored citations by PR# + §section-name; commit message body avoids line-number citations to restructure-eligible policy docs (instead used `DEVELOPMENT.md §P1`, `§Post-PR flow`, `DA-REVIEW.md §Cross-doc consistency sweep` etc.); R_n explicitly required primary-source re-verification of B1's cross-reference frequency claim (which disproved the original matching-too-broad grep). Codified discipline holding at post-codification n=6.

**Soft-reset-to-fold — resumes at n=7 consecutive applications after 2-session pause.** Sessions 121 + 122 shipped clean single-commit without soft-reset. Session 123 applied soft-reset for LOW 1 (anchor-parity fold) to preserve single-commit-ship shape. Cumulative: Sessions 115, 116, 117, 118, 119, 120, 123 — the 2-session gap (121, 122) resets consecutive counting but the lifetime application count continues.

**Second-10-window §Measurement protocol audit — CLEAN.** Audit ran Session 123 first action per Session 122 trigger language across Sessions 113-122; results written to `.claude/research/session-handoff/audit-2026-04-23.md` (gitignored). Zero breaches: 0/10 unplanned compactions (Session 121's output-token-limit mid-draft is distinct — intra-turn output cutoff, not context compaction; substrate wouldn't catch it); handoff-cost median ≈7k tokens (under 8k threshold; mean +2.4k vs Window 1 tracks legitimate session-complexity rise); 0/2 measured clarifying-question rate. Substrate (Claude Code Routines + `PostCompact`) stays deferred. Backfill discipline degraded (Window 1: 4/7 TBD; Window 2: 8/10 TBD) — noted as session-load-step codification candidate. Novel friction class: output-token-limit mid-draft n=1 (Session 121, recovered via smaller-pieces draft resumption; does not motivate substrate adoption because Routines run in cloud with fresh context would hit the same intra-turn limit).

**Novel-patterns-earned summary (Sessions 113-123 cumulative, for archival):**

| Pattern                                                 | n                                                  | First session | Latest         |
| ------------------------------------------------------- | -------------------------------------------------- | ------------- | -------------- |
| Surrogate-effectiveness on drift-fix PR                 | n=8                                                | 112           | 122            |
| Surrogate-clean-on-drift-fix                            | n=1                                                | 122           | —              |
| Surrogate-on-rule-addition                              | n=3                                                | 118           | 123            |
| Self-referential drift (PROGRESS.md meta → rule body)   | n=3, codified                                      | 116           | 120 (codified) |
| Cross-doc caller-claim self-check                       | n=3, codified PR #378                              | 112           | 115            |
| Exhaustive-grep grill short-circuit                     | n=2, codified PR #378                              | 109           | 112            |
| Scope-split-on-R1-pushback                              | n=1                                                | 116           | —              |
| Scope-reshape-on-R1-pushback (cross-doc generalization) | n=1                                                | 118           | —              |
| Rule-self-apply catches on own PR                       | n=5                                                | 117           | 123            |
| Apply-rule-to-own-spec pre/post-codification            | n=6                                                | 119           | 123            |
| Three-options-with-rec scope-call shape                 | n=3                                                | 119           | 123            |
| Grill-internal-inconsistency                            | n=2 (promotion-candidate at n=3)                   | 120           | 123            |
| Novel-category-surfaced-by-R_n                          | n=1                                                | 121           | —              |
| FVDA-FYI-acted-on                                       | n=1                                                | 122           | —              |
| Loading-instruction course-correction                   | n=1                                                | 123           | —              |
| First successful auto-merge                             | n=1                                                | 123           | —              |
| Second-10-window audit CLEAN                            | n=1 (after Window 1 n=1)                           | 123           | —              |
| Soft-reset-to-fold                                      | n=7 lifetime; 1 consecutive (post-2-session-pause) | 115           | 123            |

**Meta-findings (carry-forward to Session 124+):**

- **1.e COMPLETE.** Only 1.f (TESTING.md Layer-2 integration-layer body section) remains under item 1.
- **First successful auto-merge on this repo — novel n=1.** Substrate proven end-to-end. Future non-blast-radius PRs can route through auto-merge by default.
- **Loading-instruction course-correction — novel n=1.** Watch n=2. Re-verify loading-instructions' assumptions (e.g., "blast-radius fires", "PR still open", "streak at N=...") against primary-source state on load.
- **Rule-self-apply catches on own PR — n=5.** Two distinct catches this session. Watch n=6.
- **Grill-internal-inconsistency — n=2.** Promotion-candidate at n=3. Watch n=3 on 1.f or next rule-addition PR.
- **Three-options-with-rec — n=3.** Watch n=4. Two scope calls per PR is novel for this pattern.
- **Apply-rule-to-own-spec pre/post-codification — n=6.** Codified discipline holding. Watch n=7.
- **Surrogate-on-rule-addition — n=3.** Cumulative 0 BLOCKING + 0 MATERIAL + 3 LOW (all compression/reader-precision). Baseline calibrated.
- **Soft-reset-to-fold — lifetime n=7; 1 consecutive post-pause.** Resumes counting; prior streak was 6 (115-120).
- **Copilot UNREACHABLE n=15.** Skip POST; surrogate primary.
- **§Archival maintenance preemptive-at-handoff — 21 consecutive applications** (Sessions 104-123). This handoff archives Session 119.
- **Second-10-window §Measurement protocol audit CLEAN.** Third window opens Sessions 123-132. Backfill discipline hygiene unresolved.
- **Queued follow-up (β):** Whether `docs/GLOSSARY.md` joins the §Auto-merge blast-radius list as 9th policy doc. Separate PR if pursued.

**Session 123 handoff metrics.** (Data point 1 of third-10-window, post-second-audit.)

- Trigger: phase boundary (PR #383 auto-merged `be5d6de` via `gh pr merge --squash --delete-branch`; release.yml clean).
- Context at trigger: ≈60-65% of pre-compaction budget (manual estimate — heavy session: second-10-window audit + 5-round review stack on 1.e spec + 2 scope calls + soft-reset + 10min Copilot-hang-fallback wait + auto-merge + archive + this handoff).
- Handoff turn cost: ≈9-11k tokens (this entry + Session 119 archive row + §Next workstreams rewrite + §Measurement protocol audit-result edit + Session 124 loading instructions).
- Unplanned compaction: no.
- Time from "handoff now" decision to next-session first productive tool call: TBD (recorded by Session 124).
- `PROGRESS.md` quality signal: TBD (recorded by Session 124).

_Session 124 loading instructions previously here are now superseded by the Session 125 loading instructions at the top of the document._

---

**Session 122 (2026-04-22) — Item 1.d.ζ GIT.md §Changelog Format example attribution separator drift shipped. [PR #382](https://github.com/Pushedskydiver/chief-clancy/pull/382) merged `84dc4e9`. Standard protocol: 2-round spec-grill + per-commit DA + final-verification DA + surrogate. Novel: surrogate-clean-on-drift-fix n=1 (first 0-finding drift-fix dispatch); FVDA-FYI-acted-on n=1 (scope-label precedent catch resolved pre-audit-comment). Copilot UNREACHABLE n=14.** Archived to [`docs/history/SESSIONS.md`](docs/history/SESSIONS.md); full retrospective in `git log -p PROGRESS.md`.

---

**Session 121 (2026-04-22) — Item 1.d.ε GIT.md §Rules bullet 1 rewrite to match observed changesets-generated entry format shipped. [PR #381](https://github.com/Pushedskydiver/chief-clancy/pull/381) merged `74f6b02`. 3-round spec-grill (R1/R*n/R*{n+1}) + per-commit DA + final-verification DA + surrogate (1 LOW out-of-scope, carry-forward as 1.d.ζ). Novel: rule-self-apply catches on own PR n=4; novel-category-surfaced-by-R_n n=1. Copilot UNREACHABLE n=13.** Archived to [`docs/history/SESSIONS.md`](docs/history/SESSIONS.md); full retrospective in `git log -p PROGRESS.md`.

---

**Session 120 (2026-04-22) — Self-referential-drift rule promotion to `docs/DA-REVIEW.md §Claim-extraction pass` shipped. [PR #380](https://github.com/Pushedskydiver/chief-clancy/pull/380) merged `e1340b1`. 4-round spec-grill (R1/R2/R3/R_n) + per-commit DA ×2 + final-verification DA + 2 soft-resets. Rule-self-apply catches on own PR n=3 (5 distinct catches in one PR's review stack). Grill-internal-inconsistency novel n=1. Surrogate-on-rule-addition n=2 (clean). Copilot UNREACHABLE n=12.** Archived to [`docs/history/SESSIONS.md`](docs/history/SESSIONS.md); full retrospective in `git log -p PROGRESS.md`.

---

**Session 119 (2026-04-22) — Item 1.d.δ GIT.md §Changelog Format observed-state rewrite + §Section headers 6→10 table expansion shipped. [PR #379](https://github.com/Pushedskydiver/chief-clancy/pull/379) merged `a108475`. Three-options-with-rec novel n=1 (scope-call presentation shape). Apply-rule-to-own-spec pre-codification novel n=1. Surrogate-effectiveness n=6. Copilot UNREACHABLE n=12.** Archived to [`docs/history/SESSIONS.md`](docs/history/SESSIONS.md); full retrospective in `git log -p PROGRESS.md`.

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
