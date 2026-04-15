# Promotion plan — readability rework (v7)

**Ephemeral.** Tracks the in-flight promotion of readability rules + meta
decisions from `.claude/research/readability/notes.md` into the
load-bearing repo docs. **Deleted once PR6 lands** (last rule-promotion
PR in this series). Notes-file deletion is separately deferred to
post-Phase-5 (PR7).

## Source of truth

Full plan — PR sequence, exact line numbers, verbatim replacement text,
dependency chains, rationale — lives in
`.claude/research/readability/notes.md` under the
**"Promotion plan v7 (Session 81, Decision 8, post-grill-v6)"**
section. That notes file exists only in a local Claude Code workspace
and is not tracked in this repository (`.claude/` is gitignored). Per
Decision 5 anti-duplication, this file **does not copy plan content**
— it points and tracks status.

## Merge status

| PR        | Scope                                                                                                     | Status     | Link                                                            |
| --------- | --------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| PR-1      | CLAUDE.md philosophy correction (citation + Pattern-D triggers)                                           | ✅ merged  | [#295](https://github.com/Pushedskydiver/chief-clancy/pull/295) |
| PR0       | This file — promotion-plan pointer + checklist                                                            | ✅ merged  | [#296](https://github.com/Pushedskydiver/chief-clancy/pull/296) |
| PR1       | Glossary additions (Spec grilling, boundary terms, public-API reconciliation)                             | ✅ merged  | [#298](https://github.com/Pushedskydiver/chief-clancy/pull/298) |
| PR2       | `CONVENTIONS.md` — Rule 12 error-handling tagged-union                                                    | ✅ merged  | [#300](https://github.com/Pushedskydiver/chief-clancy/pull/300) |
| PR3       | `DEVELOPMENT.md` — Process rules + State-surface ownership (depends on PR-1)                              | ✅ merged  | [#301](https://github.com/Pushedskydiver/chief-clancy/pull/301) |
| PR4       | `core` exports tightening (0.1.x → 0.2.0 semver break + README + wrapper changesets)                      | ✅ merged  | [#302](https://github.com/Pushedskydiver/chief-clancy/pull/302) |
| _Barrier_ | Folder refactor — first-of-kind P3 supervised (Alex-initiated)                                            | ✅ merged  | [#305](https://github.com/Pushedskydiver/chief-clancy/pull/305) |
| PR5       | `CONVENTIONS.md` — Rule 7 + Rule 11 bundled rewrite (after barrier)                                       | ✅ merged  | [#306](https://github.com/Pushedskydiver/chief-clancy/pull/306) |
| PR6       | `SELF-REVIEW.md` + `DA-REVIEW.md` — line-items per promoted rule (+ cross-section-consistency; see below) | ☐ pending  | —                                                               |
| PR7       | Notes-file deletion (**deferred post-Phase-5** — snippet rules 1-6, 8-10, 13 ship there first)            | ☐ deferred | —                                                               |

## Per-PR housekeeping checklist

Include in every PR in this series:

- [ ] Update `PROGRESS.md` session log
- [ ] Update `MEMORY.md` pointer(s) if content moved
- [ ] Glossary back-refs from any new sections
- [ ] Changeset entry if package surface touched
- [ ] Delete / update superseded content in source notes
- [ ] Cross-reference update in `CLAUDE.md` if a new doc section warrants an explicit Pattern-D trigger
- [ ] Update the merge-status table above

## Concurrent-modification embargo

While this series is in flight, **pause**:

- Phase 5 rule promotion (snippet rules 1-6, 8-10, 13)
- Unrelated `CONVENTIONS.md` edits (PR2 and PR5 both touch it)
- Unrelated `DEVELOPMENT.md` edits (PR3 touches it)
- `MEMORY.md` content audit (flagged as separate workstream in PR-1)

Rebases for unrelated work are accepted. The embargo is explicit so the
blocking scope is visible.

## PR6 scope additions (from PR5 review findings)

In addition to the original PR6 scope (per-rule line-items in SELF-REVIEW.md + DA-REVIEW.md), PR5's review cycle surfaced a cross-section internal-consistency gap that self-review + per-commit DA + final-verification DA all missed. Copilot caught 10 findings across three rounds, 8 of them the same class: **absolute phrases introduced in one section of a diff that contradict another section of the same diff, OR pre-existing stale content adjacent to an edit**. Four were internal contradictions within PR5's own prose ("no central barrel to alias in" vs Rule 7's package-entry category; "no module-barrel tier" vs core's wildcard barrels; "every package's src/index.ts" vs bin-only/content-only packages; "two reasons" for folder existence vs five-row table including Boundary folder). Two were downstream-implication misses (GLOSSARY Public-API row describing Rule 11 as "looser" after Rule 11 tightened; options-object threshold drift in copilot-instructions).

Add to PR6:

**SELF-REVIEW.md — new bullet under `## Consistency`:**

> - When a diff adds OR modifies more than one section of a single doc, re-read each new/edited passage against every other new/edited passage in the same diff. Absolute phrases (“no X exists,” “X is the only Y,” “every package,” “for one of N reasons”) introduced in one section frequently contradict another section. Grep the diff for absolute claims and trace each against the rest of the diff. Separately, for any edit that introduces adjacent supersession footnotes on a block of pre-existing rules, audit the entire block for drift — don’t footnote one bullet and leave neighbours stale. _Caught by Copilot: PR #306 — 8 of 10 findings were this class._

**DA-REVIEW.md — new `### Multi-section internal-consistency pass` subsection under `## Required disciplines`:**

> - **Multi-section doc PRs: cross-section internal-consistency pass.** After verifying each individual claim, re-read the diff top-to-bottom and flag any absolute statement that conflicts with a claim elsewhere in the same diff. Per-commit verification catches mechanical errors; this is a distinct pass for logical self-contradiction. Rule 7 + Rule 11 in PR5 produced 4 mutual-contradiction misses at the per-commit DA stage because each rule was drafted without re-reading the other's prose.

Scope: these are additive bullets; no existing line-items need rewording. Estimated 2 lines of diff each.

## Grilling cadence

Per Decision 4: one master grill on the plan (complete — `notes.md`
iteration log v1→v7) + **light per-PR grill** on each draft before it
opens ("does this PR match the plan and the rule text?"). Every grill
round through v7 found real defects, and the author's stopping-claim
was wrong on 3 rounds in a row — per-PR light-grilling is load-bearing,
not theatre.
