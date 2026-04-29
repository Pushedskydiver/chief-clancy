# Clancy Update Workflow

## Overview

Check for Clancy updates via npm, display changelog for versions between installed and latest, obtain user confirmation, and execute clean installation.

---

## Step 1 — Detect installed version

Determine whether Clancy is installed locally or globally by checking both locations:

```bash
LOCAL_VERSION_FILE="./.claude/commands/clancy/VERSION"
GLOBAL_VERSION_FILE="$HOME/.claude/commands/clancy/VERSION"

if [ -f "$LOCAL_VERSION_FILE" ] && grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' "$LOCAL_VERSION_FILE"; then
  INSTALLED=$(cat "$LOCAL_VERSION_FILE")
  INSTALL_TYPE="LOCAL"
elif [ -f "$GLOBAL_VERSION_FILE" ] && grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' "$GLOBAL_VERSION_FILE"; then
  INSTALLED=$(cat "$GLOBAL_VERSION_FILE")
  INSTALL_TYPE="GLOBAL"
else
  INSTALLED="unknown"
  INSTALL_TYPE="UNKNOWN"
fi

echo "$INSTALLED"
echo "$INSTALL_TYPE"
```

Parse output:

- First line = installed version (or "unknown")
- Second line = install type (LOCAL, GLOBAL, or UNKNOWN)

**If version is unknown:**

```
## Clancy Update

**Installed version:** Unknown

Your installation doesn't include version tracking.

Running fresh install...
```

Proceed to Step 4 (treat as version 0.0.0 for comparison).

---

## Step 2 — Check latest version

Check npm for the latest published version:

```bash
npm view chief-clancy version 2>/dev/null
```

**If npm check fails:**

```
Couldn't check for updates (offline or npm unavailable).

To update manually: `npx chief-clancy@latest`
```

Exit.

---

## Step 3 — Compare versions and confirm

Compare installed vs latest:

**If installed == latest:**

```
🚨 Clancy — Update
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Installed:** X.Y.Z
**Latest:** X.Y.Z

✅ You're already on the latest version. "Nothing to see here, folks."
```

Exit.

**If update available**, fetch the GitHub release notes for the latest version and show what's new BEFORE updating. The tag contains `@` which must be URL-encoded:

```bash
# Tag: chief-clancy@0.9.47 → URL-encoded: chief-clancy%400.9.47
curl -sf "https://api.github.com/repos/Pushedskydiver/chief-clancy/releases/tags/chief-clancy%40{latest}"
```

Parse the `body` field from the JSON response.

If the fetch fails (network error, 404, parse failure), skip the "What's New" section and show: `Could not fetch changelog. View changes at https://github.com/Pushedskydiver/chief-clancy/releases`

Display:

```
🚨 Clancy — Update
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Installed:** {installed}
**Latest:** {latest}

### What's New
────────────────────────────────────────────────────────────

{relevant CHANGELOG entries between installed and latest}

────────────────────────────────────────────────────────────

⚠️  **This update will replace:**
- `.claude/commands/clancy/` — slash commands
- `.claude/clancy/workflows/` — workflow files
- `.clancy/clancy-implement.js` and `.clancy/clancy-autopilot.js` — bundled runtime scripts
- `.clancy/version.json` and `.clancy/package.json` — runtime metadata

Modified files in `.claude/commands/clancy/` and `.claude/clancy/workflows/` are
automatically backed up to `.claude/clancy/local-patches/` before overwriting.

**This update may add missing defaults to:**
- `.clancy/.env` — appends pipeline label defaults if absent (see Step 4a)

**This update will not touch:**
- `.clancy/docs/`, `.clancy/progress.txt`
- `CLAUDE.md`
- Custom commands outside `commands/clancy/`
- Custom hooks
```

**AFK mode check:** If `--afk` flag is passed OR `CLANCY_MODE=afk` in `.clancy/.env`, **skip the confirmation and proceed automatically.** Do not prompt — auto-approve the update.

**Interactive mode:** Ask the user: **"Proceed with update?"** with options:

- "Yes, update now"
- "No, cancel"

**If user cancels:** Exit.

---

## Step 4 — Run the update

Run the installer using the detected install type from Step 1. Pass `--global` or `--local` so the installer runs non-interactively (no prompts):

- If `INSTALL_TYPE` is `LOCAL`: `npx -y chief-clancy@latest --local`
- If `INSTALL_TYPE` is `GLOBAL`: `npx -y chief-clancy@latest --global`
- If `INSTALL_TYPE` is `UNKNOWN`: `npx -y chief-clancy@latest` (falls back to interactive mode)

```bash
# Example for local install:
npx -y chief-clancy@latest --local

# Example for global install:
npx -y chief-clancy@latest --global
```

The `--global`/`--local` flags skip the interactive install-type prompt and auto-accept the overwrite confirmation.

This touches:

- `.claude/commands/clancy/` — slash commands (replaced)
- `.claude/clancy/workflows/` — workflow files (replaced)
- `.clancy/clancy-implement.js` and `.clancy/clancy-autopilot.js` — bundled runtime scripts (replaced)
- `.clancy/version.json` and `.clancy/package.json` — runtime metadata (replaced)

It never modifies:

- `.clancy/docs/` — codebase documentation
- `.clancy/progress.txt` — progress log
- `CLAUDE.md`

It may **append** to:

- `.clancy/.env` — adds missing env var defaults (see Step 4a)

---

## Step 4a — Backfill missing env var defaults

After the installer finishes, read `.clancy/.env` and check for missing pipeline label variables. These were introduced in v0.7.4 and won't exist in `.env` files from earlier installs.

**Check for and append if missing:**

```
# Pipeline labels (added in v0.7.4)
CLANCY_LABEL_BRIEF=clancy:brief
CLANCY_LABEL_PLAN=clancy:plan
CLANCY_LABEL_BUILD=clancy:build
```

For each variable:

1. Read `.clancy/.env` content
2. If the variable name does NOT appear anywhere in the file (not even commented out), append it with its default value
3. If the variable already exists (even with a different value), leave it untouched

Add a blank line and a `# Pipeline labels (added in v0.7.4)` comment header before the new variables, but only if at least one variable was added.

**Display what was added (if any):**

```
📋 Added missing env var defaults to .clancy/.env:
   CLANCY_LABEL_BRIEF=clancy:brief
   CLANCY_LABEL_PLAN=clancy:plan
   CLANCY_LABEL_BUILD=clancy:build

   Customise these via /clancy:settings → L1/L2/L3
```

If nothing was added, display nothing.

---

## Step 4b — Migration check (.clancy/ gitignore fold)

`.clancy/` is now gitignored entirely (covers credentials, generated docs, install bundles, version pin, and `.env.example` template). Projects init'd before this fold may still have tracked content under `.clancy/` and may not yet have the `.clancy/` line in `.gitignore`.

Detect partial-migration state:

1. Read the project's `.gitignore`. Set `gitignore_has_clancy = true` if a line exactly matching `.clancy/` is present (the legacy `.clancy/.env` line is NOT sufficient — it doesn't cover bundles, docs, version pin, or `.env.example`).
2. Run `git ls-files .clancy/ 2>/dev/null` and capture the output. Set `has_tracked = true` if any output is returned.
3. If `gitignore_has_clancy` is true AND `has_tracked` is false, skip silently — already migrated.
4. Otherwise, print a one-time advisory listing **only the commands the user needs**. Each command must stage its changes before the commit, so a `git add .gitignore` step is included whenever the gitignore branch fires:

   ```
   ℹ️  Migration: this project was init'd before .clancy/ became gitignored.
      To migrate, run:

   ```

   - If `has_tracked` is true: print `   git rm --cached -r .clancy/`
   - If `gitignore_has_clancy` is false, print BOTH lines (the append modifies `.gitignore` in-place; `git add` then stages it for the commit):
     - `   grep -qxF '.clancy/' .gitignore || echo '.clancy/' >> .gitignore`
     - `   git add .gitignore`
   - Then print the commit, branch-conditional on which conditions fired:
     - `has_tracked` true AND `gitignore_has_clancy` false: `   git commit -m "chore(clancy): gitignore .clancy/ — drop tracked artifacts"`
     - `has_tracked` true AND `gitignore_has_clancy` true: `   git commit -m "chore(clancy): drop tracked .clancy/ artifacts"`
     - `has_tracked` false AND `gitignore_has_clancy` false: `   git commit -m "chore(clancy): gitignore .clancy/"`

5. Do NOT execute the commands. Surface only — the user runs them when ready. Idempotent: stops printing once both conditions clear.

---

## Step 5 — Check for local patches

After the update completes, check if the installer backed up any locally modified files:

Check for `.claude/clancy/local-patches/backup-meta.json` (local install) or `~/.claude/clancy/local-patches/backup-meta.json` (global install).

**If patches were found:**

```
Local patches were backed up before the update.
Your modified files are in .claude/clancy/local-patches/

To review what changed:
  Compare each file in local-patches/ against its counterpart in
  .claude/commands/clancy/ or .claude/clancy/workflows/ and manually
  reapply any customisations you want to keep.

Backed up files:
{list from backup-meta.json}
```

**If no patches:** Continue normally (no message needed).

---

## Step 6 — Clear update cache and confirm

Clear the update check cache so the statusline indicator disappears:

```bash
rm -f "$HOME/.claude/cache/clancy-update-check.json"
rm -f "./.claude/cache/clancy-update-check.json"
```

Display completion message:

```
╔═══════════════════════════════════════════════════════════╗
║  ✅ Clancy Updated: v{old} → v{new}                     ║
╚═══════════════════════════════════════════════════════════╝

"New badge, same Chief." — Start a new Claude Code session to pick up the updated commands.

View full changelog: https://github.com/Pushedskydiver/chief-clancy/releases
```

### New role hints

After the completion message, check `.clancy/.env` for `CLANCY_ROLES` and display hints for any optional roles that are available but not enabled:

- If `CLANCY_ROLES` does not include `planner`:
  ```
  💡 Planner role available — refine vague tickets into structured plans.
     Run /clancy:settings to enable it.
  ```
- If `CLANCY_ROLES` does not include `strategist`:
  ```
  💡 Strategist role available — generate briefs, grill requirements, create tickets.
     Run /clancy:settings to enable it.
  ```
- If `CLANCY_ROLES` is not set at all (env var missing), show both hints.
- If all optional roles are already enabled, show nothing.

---

## Notes

- If the user installed globally, the update applies globally
- If the user installed locally, the update applies locally
- After updating, restart Claude Code for new commands to take effect
- New role hints are shown post-update so existing users discover features added in newer versions
