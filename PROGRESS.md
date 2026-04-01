# Progress

## Session 48 Summary

### Runtime bundles (complete)

All 4 PRs merged. `clancy-implement.js` (223KB) and `clancy-autopilot.js` (231KB) now built by esbuild with zod locale stubbing. Published as chief-clancy@0.9.2.

### Hook fixes (complete)

Three issues found and fixed during live testing:

- **#181** — PreToolUse hooks used wrong output format (`decision: "approve"` → `hookSpecificOutput.permissionDecision: "allow"`)
- **#182** — Missing `matcher: ""` field in settings.json hook entries, detached spawn in check-update causing SessionStart error, added version to statusline
- **#183** — Statusline showed 100% used at session start (`remaining_percentage: 0` treated as uninitialized)

Published as chief-clancy@0.9.5. Known issue: Claude Code bug [#34713](https://github.com/anthropics/claude-code/issues/34713) causes cosmetic "hook error" messages — not a Clancy bug.

Test counts: 1608 core, 804 terminal.

### Old repo references removed

All active docs (CLAUDE.md, DEVELOPMENT.md, SELF-REVIEW.md) updated to remove references to the old Clancy repo. Historical decision docs retain references for migration context.

### Package evolution planning (complete)

Revised the package evolution strategy based on a key insight: standalone packages (brief, plan, design) serve non-developer audiences — designers, PMs, founders — who don't need the full pipeline. See `docs/decisions/architecture/package-evolution.md` for the full plan.

---

## Next: Standalone package build

### Build order

1. **`@chief-clancy/brief`** — prove the standalone installer pattern
2. **`@chief-clancy/plan`** — same pattern as brief
3. **`@chief-clancy/design`** — same pattern + Stitch integration
4. **`@chief-clancy/dev`** — extract from core when chat arrives
5. **`@chief-clancy/cli`** — interactive wizard
6. **`@chief-clancy/chat`** — conversational interface (Slack/Teams)

### First: `@chief-clancy/brief`

Needs:
- New package at `packages/brief/`
- Lightweight installer (copy slash commands to `.claude/commands/clancy/`)
- `bin` entry so `npx @chief-clancy/brief` works
- Brief and approve-brief slash commands (move from terminal roles or copy)
- Brief storage in `.clancy/briefs/` (existing convention)
- No board dependency, no pipeline, no hooks
