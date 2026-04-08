# Progress

## Session 52 Summary

### @chief-clancy/plan Phase B — PRs 5a + 5b + 6a complete

**PR #200** — Add `--from` flag for local brief planning (PR 5a):

- `--from <path>` argument with file/brief validation, standalone guard bypass
- New Step 3a: gather from local brief (replaces Steps 3/3b/3c in `--from` mode)
- Step 5a: local plan output to `.clancy/plans/{slug}.md`
- Step 4/6/7 adaptations: slug identifiers, LOCAL_PLAN log entry
- Single-item planning (treats brief as one unit, no row selection)
- 32 new tests (44 → 76 plan)

**PR #201** — Add row selection + multi-row planning (PR 5b):

- Decomposition table parsing (malformed row handling, missing table fallback)
- `<!-- planned:1,2,3 -->` marker tracking in brief files
- `--from path N` row targeting + validation (positive integer, must exist)
- `--afk` multi-row loop (sequential planning of all unplanned rows)
- `--fresh` + `--afk` clears marker and re-plans all rows
- Plan filename: `{slug}-{row-number}.md` (row-aware)
- Plan header: `**Row:** #{N} — {title}`
- 24 new tests (76 → 100 plan)

**PR #202** — Add local plan feedback loop (PR 6a):

- `## Feedback` section detection in existing plan files (line-anchored, code-fence-aware)
- Multiple `## Feedback` sections concatenated in order
- `--fresh` takes precedence over feedback (discards it)
- Feedback lifecycle: revised plan overwrites file, audit trail in `### Changes From Previous Plan`
- Revision procedure: skip 4a/4b, reuse 4c-4e, regenerate 4f
- Row selection extended: `--afk` set = (unplanned rows) ∪ (rows with feedback)
- Default selection: first row with feedback if any, otherwise first unplanned row
- `LOCAL_REVISED` log entry
- 15 new tests (100 → 115 plan)

Test counts: 1608 core, 834 terminal, 51 brief, **115 plan**.

---

## Next: PR 6b — `--list` inventory + README

Plan doc: `.claude/plans/plan-package-extraction.md` (Phase B section)

- `--list` flag in command + workflow Step 2
- Plan inventory display: scan `.clancy/plans/`, parse plan headers, sort by date
- Show row, source, brief, planned date for each plan
- Update README with local planning workflow examples

After PR 6b: Phase C (PRs 7-8) — local approve + implement integration.

### Build order (remaining standalone packages)

1. ~~`@chief-clancy/brief`~~ — **done**
2. ~~`@chief-clancy/plan`~~ — Phase A done, Phase B in progress (PR 6b remaining)
3. `@chief-clancy/design` — same pattern + Stitch integration
4. `@chief-clancy/dev` — extract from core when chat arrives
5. `@chief-clancy/cli` — interactive wizard
6. `@chief-clancy/chat` — conversational interface (Slack/Teams)
