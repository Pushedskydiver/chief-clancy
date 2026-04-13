# Clancy Status Workflow

## Overview

Read-only board check. Fetches the next 3 tickets Clancy would pick up and displays them. No side effects whatsoever — no git operations, no file writes, no ticket claiming.

---

## Step 1 — Preflight checks

1. Check `.clancy/` exists and `.clancy/.env` is present. If missing:

   ```
   Missing config. Run /clancy:init to set up Clancy.
   ```

   Stop.

2. Source `.clancy/.env` and detect which board is configured using the markers listed in Step 2 below.

3. If **no board markers are present** (local mode), skip to Step 2b — local plan inventory.

4. Otherwise, check that all required vars for the detected board are present. If any are missing:
   ```
   Missing credentials for {board}. Run /clancy:settings to fix, or edit .clancy/.env.
   ```
   Stop.

---

## Step 2 — Detect board and fetch tickets

Detect board from `.clancy/.env` using these markers:

- Jira: `JIRA_BASE_URL`
- GitHub Issues: `GITHUB_TOKEN` AND `GITHUB_REPO` (`GITHUB_TOKEN` alone is a git-host credential)
- Linear: `LINEAR_API_KEY`
- Shortcut: `SHORTCUT_API_TOKEN`
- Notion: `NOTION_TOKEN` AND `NOTION_DATABASE_ID`
- Azure DevOps: `AZDO_ORG` AND `AZDO_PROJECT`

Then fetch per the board-specific section below.

**Jira:**

Build the JQL string first using the same clauses as the once-runner:

- Sprint clause: include `AND sprint in openSprints()` if `CLANCY_JQL_SPRINT` is set
- Label clause: include `AND labels = "$CLANCY_LABEL_BUILD"` if `CLANCY_LABEL_BUILD` is set (falls back to `CLANCY_LABEL`)
- `CLANCY_JQL_STATUS` defaults to `To Do` if not set

Full JQL (with both optional clauses shown):
`project=$JIRA_PROJECT_KEY [AND sprint in openSprints()] [AND labels = "$CLANCY_LABEL_BUILD"] AND assignee=currentUser() AND status="$CLANCY_JQL_STATUS" ORDER BY priority ASC`

```bash
RESPONSE=$(curl -s \
  -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  "$JIRA_BASE_URL/rest/api/3/search/jql" \
  -d '{"jql": "<jql as above>", "maxResults": 3, "fields": ["summary", "parent", "customfield_10014", "status"]}')
```

**GitHub Issues:**
First resolve the authenticated username (don't use `@me` — it breaks with fine-grained PATs):

```bash
GITHUB_USERNAME=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user | jq -r '.login')
```

Then fetch issues:

```bash
RESPONSE=$(curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/$GITHUB_REPO/issues?state=open&assignee=$GITHUB_USERNAME&labels=$CLANCY_LABEL_BUILD&per_page=3")
# Filter out PRs (entries with pull_request key)
```

**Linear:**

Build the filter — `CLANCY_LABEL_BUILD` is optional (falls back to `CLANCY_LABEL`):

- Base filter: `state: { type: { eq: "unstarted" } }, team: { id: { eq: "$LINEAR_TEAM_ID" } }`
- If `CLANCY_LABEL_BUILD` is set (or `CLANCY_LABEL` fallback): add `labels: { name: { eq: "$CLANCY_LABEL_BUILD" } }` to the filter

```graphql
query {
  viewer {
    assignedIssues(
      filter: { state: { type: { eq: "unstarted" } }, team: { id: { eq: "$LINEAR_TEAM_ID" } } [, labels: { name: { eq: "$CLANCY_LABEL_BUILD" } }] }
      first: 3
      orderBy: priority
    ) {
      nodes { id identifier title parent { identifier title } }
    }
  }
}
```

---

## Step 2b — Local mode inventory (no board)

When no board is configured, gather a local snapshot:

1. **Plans:** list files in `.clancy/plans/` matching `*.md`. Record each plan's basename (without `.md`) and the first non-empty, non-heading line as a short summary (truncate to ~80 chars).
2. **Approved plans:** a plan is "approved" only when the sibling marker file `.clancy/plans/{plan-id}.approved` exists. Do not infer approval from plan front-matter, markdown headings, or any other content inside the `.md` file. Re-use the plan package's inventory logic if available — this must match the gate used by `/clancy:approve-plan` exactly. A malformed `.approved` marker (missing or non-hex `sha256=` line) is a `Stale (re-approve)` state — surface a count rather than inventing a verdict.
3. **Progress:** if `.clancy/progress.txt` exists, read the last 5 non-empty lines.
4. **Recent branches:** determine the configured base branch from `CLANCY_BASE_BRANCH` (defaulting to `main`). Run a git-only command such as `git for-each-ref --sort=-committerdate --count=6 --format='%(refname:short) %(committerdate:relative)' refs/heads`, then exclude the configured base branch in workflow logic before displaying up to 5 entries. Falls back to empty if not a git repo.

Display:

```
🚨 Clancy — Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Local mode — no board configured

Plans ({N} total, {M} approved, {S} stale):
  1. <plan-slug> — <summary line>
  2. <plan-slug> — <summary line>
  3. <plan-slug> — <summary line>
  …

Recent progress:
  <last 5 progress lines, most recent first>

Recent branches:
  <up to 5 recent branches with relative date>

"Let me check the dispatch..." — Run /clancy:implement --from .clancy/plans/<plan>.md to execute an approved plan.
```

If `.clancy/plans/` is missing or empty:

```
🚨 Clancy — Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Local mode — no board configured

No plans yet in .clancy/plans/.

"Quiet. Too quiet." — Run /clancy:brief then /clancy:plan --from to draft your first plan.
```

Skip Step 3 (board ticket display) when running Step 2b.

---

## Step 3 — Display

If tickets found, display:

```
🚨 Clancy — Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next up:

1. [{TICKET-KEY}] {Summary}
   Epic: {epic key} — {epic title}
   Status: {status}

2. [{TICKET-KEY}] {Summary}
   Epic: {epic key} — {epic title}
   Status: {status}

3. [{TICKET-KEY}] {Summary}
   Epic: {epic key} — {epic title}
   Status: {status}

"Let me check the dispatch..." — Run /clancy:implement to pick up #1, or /clancy:autopilot to process the queue.
```

If no tickets found:

```
🚨 Clancy — Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No tickets found in the current queue.

"Quiet. Too quiet." — Check your board or run /clancy:init to verify your config.
```

If API call fails, show the error clearly:

```
🚨 Clancy — Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ Board API error: {error message}

Tips:
- Check your credentials in .clancy/.env
- For Jira: ensure you have VPN access if required
- Run /clancy:init to reconfigure
```

---

## Notes

- Show up to 3 tickets. If only 1 or 2 are available, show those.
- Omit "Epic:" line if no epic/parent data is present for that ticket.
- This command is strictly read-only. No git ops, no file writes, no Claude invocation for analysis.
- The query used here must be identical to the one used by the once-runner — what status shows is exactly what run would pick up.
