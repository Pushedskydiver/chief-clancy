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

| PR        | Scope                                                                                          | Status     | Link                                                            |
| --------- | ---------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| PR-1      | CLAUDE.md philosophy correction (citation + Pattern-D triggers)                                | ✅ merged  | [#295](https://github.com/Pushedskydiver/chief-clancy/pull/295) |
| PR0       | This file — promotion-plan pointer + checklist                                                 | ✅ merged  | [#296](https://github.com/Pushedskydiver/chief-clancy/pull/296) |
| PR1       | Glossary additions (Spec grilling, boundary terms, public-API reconciliation)                  | ✅ merged  | [#298](https://github.com/Pushedskydiver/chief-clancy/pull/298) |
| PR2       | `CONVENTIONS.md` — Rule 12 error-handling tagged-union                                         | ✅ merged  | [#300](https://github.com/Pushedskydiver/chief-clancy/pull/300) |
| PR3       | `DEVELOPMENT.md` — Process rules + State-surface ownership (depends on PR-1)                   | ✅ merged  | [#301](https://github.com/Pushedskydiver/chief-clancy/pull/301) |
| PR4       | `core` exports tightening (0.1.x → 0.2.0 semver break + README + wrapper changesets)           | 🔄 open    | [#tbd](#)                                                       |
| _Barrier_ | Folder refactor — first-of-kind P3 supervised (Alex-initiated)                                 | ☐ pending  | —                                                               |
| PR5       | `CONVENTIONS.md` — Rule 7 + Rule 11 bundled rewrite (after barrier)                            | ☐ pending  | —                                                               |
| PR6       | `SELF-REVIEW.md` + `DA-REVIEW.md` — line-items per promoted rule                               | ☐ pending  | —                                                               |
| PR7       | Notes-file deletion (**deferred post-Phase-5** — snippet rules 1-6, 8-10, 13 ship there first) | ☐ deferred | —                                                               |

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

## Grilling cadence

Per Decision 4: one master grill on the plan (complete — `notes.md`
iteration log v1→v7) + **light per-PR grill** on each draft before it
opens ("does this PR match the plan and the rule text?"). Every grill
round through v7 found real defects, and the author's stopping-claim
was wrong on 3 rounds in a row — per-PR light-grilling is load-bearing,
not theatre.
