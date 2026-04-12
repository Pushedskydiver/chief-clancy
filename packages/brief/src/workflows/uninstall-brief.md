# Clancy Uninstall Brief Workflow

## Overview

Remove the `@chief-clancy/brief` slash commands, workflows, and agents from the local project, globally, or both. Does **not** touch hooks, `settings.json`, `CLAUDE.md`, `.gitignore`, `.prettierignore`, or the `.clancy/` folder — those are the responsibility of `/clancy:uninstall` (full pipeline) or `/clancy:uninstall-terminal`.

---

## Step 1 — Detect install locations

Check both locations silently by looking for the `VERSION.brief` marker file:

- **Project-local:** `.claude/commands/clancy/VERSION.brief`
- **Global:** `~/.claude/commands/clancy/VERSION.brief`

| Scenario              | Action                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Found in both         | Ask: "Remove from project, globally, or both?" → `[1] Project only` `[2] Global only` `[3] Both` |
| Found in project only | Proceed with project removal                                                                     |
| Found globally only   | Proceed with global removal                                                                      |
| Found in neither      | Print "Clancy Brief not found in any location. Nothing to remove." and stop                      |

---

## Step 2 — Confirm before removing

Show exactly this message, filling in the detected location:

```
🚨 Clancy Brief — Uninstall
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This will remove Clancy Brief's commands, workflows, and agents from [location].
Continue? (yes / no)
```

- `no` → print "Nothing removed." and stop
- `yes` → proceed to Step 3

If "Both" was chosen in Step 1: confirm once for both, then remove from both locations.

---

## Step 3 — Detect other Clancy packages

For each location being removed, check whether any other Clancy package is still installed:

| Marker file                           | Package  |
| ------------------------------------- | -------- |
| `<base>/commands/clancy/VERSION.plan` | plan     |
| `<base>/commands/clancy/VERSION`      | terminal |
| `.clancy/VERSION.dev`                 | dev      |

Where `<base>` is `.claude` (local) or `~/.claude` (global).

**Note:** `VERSION.dev` is always at `.clancy/VERSION.dev` (project root), regardless of whether the current removal is local or global. If removing from the global location only, check `.clancy/VERSION.dev` in the current working directory — if the file does not exist, **assume dev may be installed elsewhere** and treat shared files as owned (keep them). The safe default is to keep shared files when the dev marker cannot be confirmed absent.

Record whether **any** other package is installed. This determines shared-file handling in Step 4.

---

## Step 4 — Remove files

For each location being removed, delete files in this order:

### 4a — Brief-exclusive files (always remove)

**Commands** (from `<base>/commands/clancy/`):

- `approve-brief.md`
- `brief.md`

**Workflows** (from `<base>/clancy/workflows/`):

- `approve-brief.md`
- `brief.md`

**Agents** (from `<base>/clancy/agents/`):

- `devils-advocate.md`

Delete each file. If a file does not exist, skip it silently.

### 4b — Shared files (only when no other package is installed)

If **no** other Clancy package was detected in Step 3, also remove:

**Commands** (from `<base>/commands/clancy/`):

- `board-setup.md`
- `map-codebase.md`
- `update-docs.md`

**Workflows** (from `<base>/clancy/workflows/`):

- `board-setup.md`
- `map-codebase.md`
- `update-docs.md`

**Agents** (from `<base>/clancy/agents/`):

- `arch-agent.md`
- `concerns-agent.md`
- `design-agent.md`
- `quality-agent.md`
- `tech-agent.md`

Delete each file. If a file does not exist, skip it silently.

If another package **is** installed, leave all shared files in place — the other package owns them.

### 4c — Uninstall command itself

Remove the uninstall command and workflow that are currently executing:

- `<base>/commands/clancy/uninstall-brief.md`
- `<base>/clancy/workflows/uninstall-brief.md`

### 4d — VERSION marker (always last)

Delete `<base>/commands/clancy/VERSION.brief`.

This file is deleted **last** so that a crash during removal leaves the marker in place, allowing the user to re-run the uninstall.

### 4e — Clean up empty directories

After all file deletions, check whether the following directories are now empty:

- `<base>/clancy/agents/`
- `<base>/clancy/workflows/`
- `<base>/clancy/`
- `<base>/commands/clancy/`

Remove each directory only if it is completely empty. Check in the order listed (children before parents).

---

## Step 5 — Final message

```
✅ Clancy Brief uninstalled from [location].

To reinstall: npx @chief-clancy/brief
```

---

## Hard constraints

- **Never touch hooks, `settings.json`, `CLAUDE.md`, `.gitignore`, `.prettierignore`, or `.clancy/`** — those belong to the full pipeline uninstaller
- **Never delete shared files when another package is installed** — check VERSION markers first
- **Delete `VERSION.brief` last** — crash recovery depends on the marker surviving partial removal
- **Skip missing files silently** — the user may have manually removed some files
- **Only remove empty directories** — never delete a directory that still contains files
