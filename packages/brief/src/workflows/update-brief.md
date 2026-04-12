# Clancy Update Brief Workflow

## Overview

Check for updates to `@chief-clancy/brief`, display what's new, and install the latest version. Does **not** touch hooks, `settings.json`, `CLAUDE.md`, `.gitignore`, `.prettierignore`, or the `.clancy/` folder.

---

## Step 1 — Read installed version

Check both locations for the `VERSION.brief` marker file:

- **Project-local:** `.claude/commands/clancy/VERSION.brief`
- **Global:** `~/.claude/commands/clancy/VERSION.brief`

Read whichever file(s) exist. The content is the installed version string (e.g. `0.3.5`).

| Scenario              | Action                                            |
| --------------------- | ------------------------------------------------- |
| Found in both         | Use the local version for comparison (local wins) |
| Found in project only | Use the project-local version                     |
| Found globally only   | Use the global version                            |
| Found in neither      | Print the message below and **stop**              |

**If not installed:**

```
Clancy Brief is not installed. Run `npx @chief-clancy/brief` first.
```

---

## Step 2 — Check npm for latest version

```bash
npm view @chief-clancy/brief version 2>/dev/null
```

Use a 5-second timeout. If the command fails (network error, timeout, npm unavailable):

```
Couldn't check for updates (offline or npm unavailable).

To update manually: npx -y @chief-clancy/brief@latest --local
```

Stop.

---

## Step 3 — Compare versions

Trim both strings and strip any leading `v` prefix before comparing.

**If installed == latest:**

```
🚨 Clancy Brief — Update
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Installed:** X.Y.Z
**Latest:** X.Y.Z

✅ Already up to date.
```

Stop.

---

## Step 3b — Fetch changelog (best-effort)

Fetch the GitHub release notes for the latest version. The tag contains `@` and `/` which must be URL-encoded:

```bash
# Tag: @chief-clancy/brief@0.3.5 → URL-encoded: %40chief-clancy%2Fbrief%400.3.5
curl -sf "https://api.github.com/repos/Pushedskydiver/chief-clancy/releases/tags/%40chief-clancy%2Fbrief%40{latest}"
```

Parse the `body` field from the JSON response.

**If the fetch succeeds**, display the release body between the version comparison and the confirmation prompt:

```
### What's New
────────────────────────────────────────────────────────────

{release body}

────────────────────────────────────────────────────────────
```

**If the fetch fails** (network error, 404, parse failure), skip the "What's New" section and show a link:

```
View changes at https://github.com/Pushedskydiver/chief-clancy/releases
```

---

## Step 4 — Detect other packages and show advisories

Check VERSION markers for other packages:

| Marker file                           | Package  |
| ------------------------------------- | -------- |
| `<base>/commands/clancy/VERSION.plan` | plan     |
| `<base>/commands/clancy/VERSION`      | terminal |
| `.clancy/VERSION.dev`                 | dev      |

Where `<base>` is `.claude` (local) or `~/.claude` (global), matching the detected install location.

**Note:** `VERSION.dev` is always at `.clancy/VERSION.dev` (project root), regardless of install location. If checking from a global-only install, check `.clancy/VERSION.dev` in the current working directory — if the file does not exist, treat dev as not installed.

### 4a — Terminal coexistence advisory

If terminal's `VERSION` marker exists:

```
⚠️  Terminal pipeline detected (VERSION marker found).
    Terminal manages shared files (board-setup, scan agents, etc.).
    Consider using /clancy:update-terminal to update everything together.
    Proceeding will update brief-specific files and overwrite shared scan files.
    Note: terminal's file manifest will become stale — the next /clancy:update-terminal
    may prompt about "modified files". This is expected and safe to confirm.
```

### 4b — Other standalone advisory

If other standalone packages are installed (plan or dev) but terminal is NOT installed:

```
ℹ️  Other Clancy packages detected: {list}.
    Shared files (board-setup, scan agents, map-codebase, update-docs) will be
    overwritten with this package's bundled versions.
```

This is informational only — no block.

---

## Step 5 — Detect install mode

Determine the install scope based on where `VERSION.brief` was found:

| Scenario              | Mode     |
| --------------------- | -------- |
| Found in both         | `both`   |
| Found in project only | `local`  |
| Found globally only   | `global` |

For `both`: update will run twice — once with `--local`, once with `--global`.

---

## Step 6 — Confirm

Display the update summary and ask for confirmation:

```
🚨 Clancy Brief — Update
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Installed:** {installed}
**Latest:** {latest}

This will run the brief installer which overwrites:
- Commands in <base>/commands/clancy/
- Workflows in <base>/clancy/workflows/
- Agents in <base>/clancy/agents/

Proceed with update? (yes / no)
```

- `no` → print "Update cancelled." and stop
- `yes` → proceed to Step 7

**AFK mode:** If `--afk` flag is passed, skip the confirmation and proceed automatically.

---

## Step 7 — Run update

Run the installer using the detected mode from Step 5. The `@latest` suffix is mandatory to bypass npx cache:

| Mode     | Command(s)                                     |
| -------- | ---------------------------------------------- |
| `local`  | `npx -y @chief-clancy/brief@latest --local`    |
| `global` | `npx -y @chief-clancy/brief@latest --global`   |
| `both`   | Run both `--local` and `--global` sequentially |

---

## Step 8 — Verify

Re-read the `VERSION.brief` marker from the same location(s) as Step 1.

**If the version is unchanged** (same as the old installed version):

```
⚠️  Update may not have taken effect. Try again in a minute (npm CDN cache).
```

---

## Step 9 — Final message

```
✅ @chief-clancy/brief updated: v{old} → v{new}

"The brief just got briefer." — Start a new Claude Code session to pick up the updated commands.
```

---

## Hard constraints

- **Never touch hooks, `settings.json`, `CLAUDE.md`, `.gitignore`, `.prettierignore`, or `.clancy/`** — those belong to the full pipeline
- **`@latest` suffix on npx is mandatory** — bypasses npx cache
- **Changelog fetched from GitHub releases API** — best-effort, skip on failure
- **The workflow does NOT delete files** — only overwrites via the installer
- **URL-encode the release tag** — `@` → `%40`, `/` → `%2F`
