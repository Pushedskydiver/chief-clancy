# Clancy Update Dev Workflow

## Overview

Check for updates to `@chief-clancy/dev`, display what's new, and install the latest version. Does **not** touch hooks, `settings.json`, `CLAUDE.md`, `.gitignore`, `.prettierignore`, or `.clancy/.env`.

---

## Step 1 — Read installed version

`VERSION.dev` lives at `.clancy/VERSION.dev` (always at project root), regardless of whether commands were installed globally or locally. To detect a global install, check for `~/.claude/commands/clancy/dev.md`.

| Scenario                                  | Action                                |
| ----------------------------------------- | ------------------------------------- |
| VERSION.dev exists + global dev.md exists | Use VERSION.dev for comparison        |
| VERSION.dev exists + no global dev.md     | Use VERSION.dev for comparison        |
| No VERSION.dev + global dev.md exists     | Cannot determine installed version \* |
| Neither VERSION.dev nor global dev.md     | Print the message below and **stop**  |

\* If only global `dev.md` exists without `.clancy/VERSION.dev`, print:

```
Clancy Dev is installed globally but VERSION.dev is missing.
Run `npx -y @chief-clancy/dev@latest --global` to update.
```

Stop.

**If not installed at all:**

```
Clancy Dev is not installed. Run `npx @chief-clancy/dev` first.
```

---

## Step 2 — Check npm for latest version

```bash
npm view @chief-clancy/dev version 2>/dev/null
```

Use a 5-second timeout. If the command fails (network error, timeout, npm unavailable):

```
Couldn't check for updates (offline or npm unavailable).

To update manually: npx -y @chief-clancy/dev@latest [--local/--global]
```

Use the flag matching the install location detected in Step 1 (`--local` for project-local only, `--global` for global-only). If both locations were found, show both commands.

Stop.

---

## Step 3 — Compare versions

Trim both strings and strip any leading `v` prefix before comparing.

**If installed == latest:**

```
🚨 Clancy Dev — Update
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
# Tag: @chief-clancy/dev@0.3.5 → URL-encoded: %40chief-clancy%2Fdev%400.3.5
curl -sf "https://api.github.com/repos/Pushedskydiver/chief-clancy/releases/tags/%40chief-clancy%2Fdev%40{latest}"
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

| Marker file                            | Package  |
| -------------------------------------- | -------- |
| `<base>/commands/clancy/VERSION.brief` | brief    |
| `<base>/commands/clancy/VERSION.plan`  | plan     |
| `<base>/commands/clancy/VERSION`       | terminal |

Where `<base>` is `.claude` (local) or `~/.claude` (global).

### 4a — Terminal coexistence advisory

If terminal's `VERSION` marker exists:

```
⚠️  Terminal pipeline detected (VERSION marker found).
    Terminal manages shared files (board-setup, scan agents, etc.).
    Consider using /clancy:update-terminal to update everything together.
    Proceeding will update dev-specific files and overwrite shared scan files.
    Note: terminal's file manifest will become stale — the next /clancy:update-terminal
    may prompt about "modified files". This is expected and safe to confirm.
```

### 4b — Other standalone advisory

If other standalone packages are installed (brief or plan) but terminal is NOT installed:

```
ℹ️  Other Clancy packages detected: {list}.
    Shared files (board-setup, scan agents, map-codebase, update-docs) will be
    overwritten with this package's bundled versions.
```

This is informational only — no block.

---

## Step 5 — Detect install mode

Determine the install scope based on Step 1 detection:

| Scenario                                  | Mode    |
| ----------------------------------------- | ------- |
| VERSION.dev exists + global dev.md exists | `both`  |
| VERSION.dev exists + no global dev.md     | `local` |

For `both`: update will run twice — once with `--local`, once with `--global`.

Note: the `global`-only case (no VERSION.dev + global dev.md) is handled in Step 1 with a separate message and stop.

---

## Step 6 — Confirm

Display the update summary and ask for confirmation:

```
🚨 Clancy Dev — Update
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Installed:** {installed}
**Latest:** {latest}

This will run the dev installer which overwrites:
- Commands in <base>/commands/clancy/
- Workflows in <base>/clancy/workflows/
- Agents in <base>/clancy/agents/
- Runtime bundles: clancy-dev.js, clancy-dev-autopilot.js at .clancy/

Proceed with update? (yes / no)
```

- `no` → print "Update cancelled." and stop
- `yes` → proceed to Step 7

**AFK mode:** If `--afk` flag is passed, skip the confirmation and proceed automatically.

---

## Step 7 — Run update

Run the installer using the detected mode from Step 5. The `@latest` suffix is mandatory to bypass npx cache:

| Mode    | Command(s)                                     |
| ------- | ---------------------------------------------- |
| `local` | `npx -y @chief-clancy/dev@latest --local`      |
| `both`  | Run both `--local` and `--global` sequentially |

The dev installer always writes bundles to `.clancy/` regardless of mode (always project-scoped).

---

## Step 8 — Verify

Re-read `.clancy/VERSION.dev`.

**If the version is unchanged** (same as the old installed version):

```
⚠️  Update may not have taken effect. Try again in a minute (npm CDN cache).
```

Print only the warning above and **stop** — do not show the Step 9 success message.

For `both` mode, also verify that `~/.claude/commands/clancy/dev.md` was updated (check file modification time or content).

**If the version changed**, proceed to Step 9.

---

## Step 9 — Final message

Only shown when Step 8 confirms the version actually changed:

```
✅ @chief-clancy/dev updated: v{old} → v{new}

"Dispatch updated, back on patrol." — Start a new Claude Code session to pick up the updated commands.
```

---

## Hard constraints

- **Never touch hooks, `settings.json`, `CLAUDE.md`, `.gitignore`, `.prettierignore`, or `.clancy/.env`** — those belong to the full pipeline
- **`@latest` suffix on npx is mandatory** — bypasses npx cache
- **Changelog fetched from GitHub releases API** — best-effort, skip on failure
- **The workflow does NOT delete files** — only overwrites via the installer
- **URL-encode the release tag** — `@` → `%40`, `/` → `%2F`
- **VERSION.dev is always at `.clancy/VERSION.dev`** — not in commands/clancy/
