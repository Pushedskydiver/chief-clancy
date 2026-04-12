# Clancy Uninstall Dev Workflow

## Overview

Remove the `@chief-clancy/dev` slash commands, workflows, agents, and runtime bundles from the local project, globally, or both. Does **not** touch hooks, `settings.json`, `CLAUDE.md`, `.gitignore`, `.prettierignore`, or board credentials (`.clancy/.env`) — those are the responsibility of `/clancy:uninstall` (full pipeline).

---

## Step 1 — Detect install locations

Check both locations silently by looking for the `VERSION.dev` marker file:

- **Project-local / both:** `.clancy/VERSION.dev` (always at project root)
- **Global commands:** `~/.claude/commands/clancy/dev.md`

`VERSION.dev` lives at `.clancy/VERSION.dev` regardless of whether commands were installed globally or locally. To detect a global install, check for `~/.claude/commands/clancy/dev.md` — if it exists alongside `.clancy/VERSION.dev`, the install spans both locations.

| Scenario                                  | Action                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| VERSION.dev exists + global dev.md exists | Ask: "Remove from project, globally, or both?" → `[1] Project only` `[2] Global only` `[3] Both` |
| VERSION.dev exists + no global dev.md     | Proceed with local removal                                                                       |
| No VERSION.dev + global dev.md exists     | Proceed with global removal only (bundles already absent)                                        |
| Neither VERSION.dev nor global dev.md     | Print "Clancy Dev not found in any location. Nothing to remove." and stop                        |

---

## Step 2 — Confirm before removing

Show exactly this message, filling in the detected location:

```
🚨 Clancy Dev — Uninstall
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This will remove Clancy Dev's commands, workflows, agents, and runtime bundles from [location].
Continue? (yes / no)
```

- `no` → print "Nothing removed." and stop
- `yes` → proceed to Step 3

If "Both" was chosen in Step 1: confirm once for both, then remove from both locations.

---

## Step 3 — Detect other Clancy packages

Check whether any other Clancy package is still installed:

| Marker file                               | Package  |
| ----------------------------------------- | -------- |
| `.claude/commands/clancy/VERSION.brief`   | brief    |
| `.claude/commands/clancy/VERSION.plan`    | plan     |
| `.claude/commands/clancy/VERSION`         | terminal |
| `~/.claude/commands/clancy/VERSION.brief` | brief    |
| `~/.claude/commands/clancy/VERSION.plan`  | plan     |
| `~/.claude/commands/clancy/VERSION`       | terminal |

Check both local and global locations for the other markers — if **any** marker exists in **either** location, treat shared files as owned.

Record whether **any** other package is installed. This determines shared-file handling in Step 4.

---

## Step 4 — Remove files

Delete files in this order, limited to the uninstall scope selected in Step 1:

### 4a — Dev-exclusive files

**Commands** (from `<base>/commands/clancy/` where `<base>` is `.claude` for local or `~/.claude` for global — remove from each selected command location):

- `dev.md`
- `dev-loop.md`
- `update-dev.md`

**Workflows** (from `<base>/clancy/workflows/` — remove from each selected workflow location):

- `dev.md`
- `dev-loop.md`
- `update-dev.md`

**Bundles** (from `.clancy/`) — remove only when the uninstall scope includes the project (`Project only` or `Both`):

- `clancy-dev.js`
- `clancy-dev-autopilot.js`

**Project metadata** (from `.clancy/`) — remove only when the uninstall scope includes the project (`Project only` or `Both`):

- `package.json` — only if no other Clancy package wrote it (check: if `.clancy/clancy-implement.js` exists, terminal owns `package.json` — leave it)

For a **Global only** uninstall, do **not** remove anything from `.clancy/` — leave project-local bundles, metadata, and `VERSION.dev` untouched.

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

Remove the uninstall command and workflow:

- `<base>/commands/clancy/uninstall-dev.md`
- `<base>/clancy/workflows/uninstall-dev.md`

### 4d — VERSION marker (always last, project scope only)

Delete `.clancy/VERSION.dev` — only when the uninstall scope includes the project (`Project only` or `Both`). For a **Global only** uninstall, leave `VERSION.dev` in place.

This file is deleted **last** so that a crash during removal leaves the marker in place, allowing the user to re-run the uninstall.

### 4e — Clean up empty directories

After all file deletions, check whether the following directories are now empty:

- `<base>/clancy/agents/`
- `<base>/clancy/workflows/`
- `<base>/clancy/`
- `<base>/commands/clancy/`

Remove each directory only if it is completely empty. Check in the order listed (children before parents).

**Do not remove `.clancy/`** even if it appears empty — it may contain `.env`, `docs/`, or other user data.

---

## Step 5 — Final message

```
✅ Clancy Dev uninstalled from [location].

To reinstall: npx @chief-clancy/dev
```

---

## Hard constraints

- **Never touch hooks, `settings.json`, `CLAUDE.md`, `.gitignore`, `.prettierignore`, or `.clancy/.env`** — those belong to the full pipeline uninstaller
- **Never delete shared files when another package is installed** — check VERSION markers first
- **Never remove the `.clancy/` directory** — it may contain credentials, docs, or terminal artifacts
- **Delete `VERSION.dev` last** — crash recovery depends on the marker surviving partial removal
- **Skip missing files silently** — the user may have manually removed some files
- **Only remove empty directories** — never delete a directory that still contains files
- **Check for `clancy-implement.js` before removing `package.json`** — terminal owns it when present
