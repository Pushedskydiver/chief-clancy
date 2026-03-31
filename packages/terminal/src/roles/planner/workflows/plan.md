# Clancy Plan Workflow

## Overview

Fetch backlog tickets from the board, explore the codebase, and generate structured implementation plans. Plans are posted as comments on the ticket for human review. Does not implement anything — planning only.

---

## Step 1 — Preflight checks

1. Check `.clancy/` exists and `.clancy/.env` is present. If not:

   ```
   .clancy/ not found. Run /clancy:init to set up Clancy first.
   ```

   Stop.

2. Source `.clancy/.env` and check board credentials are present.

3. Check `CLANCY_ROLES` includes `planner` (or env var is unset, which indicates a global install where all roles are available). If `CLANCY_ROLES` is set but does not include `planner`:

   ```
   The Planner role is not enabled. Add "planner" to CLANCY_ROLES in .clancy/.env or run /clancy:settings.
   ```

   Stop.

4. Check `.clancy/docs/` — if the directory is empty or missing:

   **AFK mode** (`--afk` flag or `CLANCY_MODE=afk`): continue without prompting (log a warning).

   **Interactive mode:**

   ```
   ⚠️  No codebase documentation found in .clancy/docs/
   Plans will be less accurate without codebase context.
   Run /clancy:map-codebase first for better results.

   Continue anyway? [y/N]
   ```

   If the user declines, stop. If they confirm, continue without docs context.

5. Branch freshness check — run `git fetch origin` and compare the current HEAD with `origin/$CLANCY_BASE_BRANCH` (defaults to `main`). If the local branch is behind:

   **AFK mode** (`--afk` flag or `CLANCY_MODE=afk`): auto-pull without prompting. Run `git pull origin $CLANCY_BASE_BRANCH` and continue.

   **Interactive mode:**

   ```
   ⚠️  Your local branch is behind origin/{CLANCY_BASE_BRANCH} by {N} commit(s).

   [1] Pull latest
   [2] Continue anyway
   [3] Abort
   ```

   - [1] runs `git pull origin $CLANCY_BASE_BRANCH` and continues
   - [2] continues without pulling
   - [3] stops

---

## Step 2 — Parse arguments

Parse the arguments passed to the command:

- **No argument:** plan 1 ticket from the queue
- **Numeric argument** (e.g. `/clancy:plan 3`): plan up to N tickets from the queue, cap at 10
- **Specific ticket key:** plan a single ticket by key, with per-platform validation:
  - `#42` — valid for GitHub only. If board is Jira, Linear, or Shortcut: `The #N format is for GitHub Issues. Use a ticket key like PROJ-123.` Stop. If board is Azure DevOps: `The #N format is for GitHub Issues. Use a numeric work item ID (e.g. 42).` Stop. If board is Notion: `The #N format is for GitHub Issues. Use a Notion page UUID or notion-XXXXXXXX key.` Stop.
  - `PROJ-123` / `ENG-42` (letters-dash-number) — valid for Jira, Linear, and Shortcut. If board is GitHub: `Use #N format for GitHub Issues (e.g. #42).` Stop. If board is Azure DevOps: `Use a numeric work item ID for Azure DevOps (e.g. 42).` Stop. If board is Notion: `Use a Notion page UUID or notion-XXXXXXXX key.` Stop.
  - Bare integer — valid for Azure DevOps (work item ID) and GitHub (issue number). On Azure DevOps with value > 10: treat as a work item ID (no ambiguity — AzDo always uses numeric IDs). On GitHub with value > 10: ambiguous — ask:
  - Bare integer on GitHub (e.g. `/clancy:plan 42` where 42 > 10): ambiguous — ask:
    ```
    Did you mean issue #42 or batch mode (42 tickets)?
    [1] Plan issue #42
    [2] Plan 10 tickets (max batch)
    ```
- **`--fresh`:** discard any existing plan and start over from scratch. This is NOT re-plan with feedback — it ignores existing plans entirely.
- Arguments can appear in any order (e.g. `/clancy:plan --fresh PROJ-123` or `/clancy:plan PROJ-123 --fresh`)

If N > 10: `Maximum batch size is 10. Planning 10 tickets.`

If N >= 5: display a confirmation (skip in AFK mode — `--afk` flag or `CLANCY_MODE=afk`):

```
Planning {N} tickets — each requires codebase exploration. Continue? [Y/n]
```

---

## Step 3 — Fetch backlog tickets

Detect board from `.clancy/.env` and fetch tickets from the **planning queue** (different from the implementation queue used by `/clancy:implement`).

### Specific ticket key (if provided)

If a specific ticket key was parsed in Step 2, fetch that single ticket instead of the queue:

#### GitHub — Fetch specific issue

```bash
RESPONSE=$(curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/$GITHUB_REPO/issues/$ISSUE_NUMBER")
```

Validate the response:

- If `pull_request` field is present (not null): `#{N} is a PR, not an issue.` Stop.
- If `state` is `closed`: warn `Issue #${N} is closed. Plan anyway? [y/N]` (in AFK mode: skip this ticket — do not plan closed issues unattended)

#### Jira — Fetch specific ticket

```bash
RESPONSE=$(curl -s \
  -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -H "Accept: application/json" \
  "$JIRA_BASE_URL/rest/api/3/issue/$TICKET_KEY?fields=summary,description,issuelinks,parent,customfield_10014,comment,status,issuetype")
```

Validate the response:

- If `fields.status.statusCategory.key` is `done`: warn `Ticket is done. Plan anyway? [y/N]` (in AFK mode: skip this ticket)
- If `fields.issuetype.name` is `Epic`: note `This is an epic.` (continue normally)

#### Linear — Fetch specific issue

```graphql
query {
  issues(filter: { identifier: { eq: "$IDENTIFIER" } }) {
    nodes {
      id
      identifier
      title
      description
      state {
        type
        name
      }
      parent {
        identifier
        title
      }
      comments {
        nodes {
          id
          body
          createdAt
          user {
            id
          }
        }
      }
    }
  }
}
```

Validate the response:

- If `nodes` is empty: `Issue {KEY} not found on Linear.` Stop.
- If `state.type` is `completed`: warn `Issue is completed. Plan anyway? [y/N]` (in AFK mode: skip this ticket)
- If `state.type` is `canceled`: warn `Issue is canceled. Plan anyway? [y/N]` (in AFK mode: skip this ticket)

Then skip to Step 3b with this single ticket.

#### Azure DevOps — Fetch specific work item

```bash
RESPONSE=$(curl -s \
  -u ":$AZDO_PAT" \
  -H "Accept: application/json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$WORK_ITEM_ID?\$expand=relations&api-version=7.1")
```

Validate the response:

- If response contains `"message"` with `"does not exist"`: `Work item ${ID} not found.` Stop.
- If `fields["System.State"]` is a done/resolved state (e.g. `Done`, `Closed`, `Resolved`): warn `Work item is done. Plan anyway? [y/N]` (in AFK mode: skip this ticket)

To fetch comments (separate endpoint):

```bash
COMMENTS=$(curl -s \
  -u ":$AZDO_PAT" \
  -H "Accept: application/json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$WORK_ITEM_ID/comments?api-version=7.1-preview.4")
```

Map fields: title = `fields["System.Title"]`, description = `fields["System.Description"]` (HTML — strip tags for plan context), parent = check `relations` array for `System.LinkTypes.Hierarchy-Reverse` type.

Then skip to Step 3b with this single ticket.

#### Shortcut — Fetch specific story

```bash
RESPONSE=$(curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.app.shortcut.com/api/v3/stories/$STORY_ID")
```

Extract the story ID from the key (e.g. `SC-123` → `123`, or use the numeric portion). Validate the response:

- If response status is 404: `Story ${KEY} not found on Shortcut.` Stop.
- If `completed` is `true` or `archived` is `true`: warn `Story is completed/archived. Plan anyway? [y/N]` (in AFK mode: skip this ticket)

To fetch comments:

```bash
COMMENTS=$(curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  "https://api.app.shortcut.com/api/v3/stories/$STORY_ID/comments")
```

Map fields: title = `name`, description = `description` (markdown), parent = `epic_id` (fetch epic name via `GET /api/v3/epics/$EPIC_ID` if set).

Then skip to Step 3b with this single ticket.

#### Notion — Fetch specific page

Notion page IDs are UUIDs (32 hex chars, optionally with dashes). The key format in `.clancy/progress.txt` is `notion-{first 8 chars}` for brevity. To fetch, use the full page ID if available, or search the database.

```bash
RESPONSE=$(curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  "https://api.notion.com/v1/pages/$PAGE_ID")
```

If the key is a short `notion-XXXXXXXX` format, query the database instead:

```bash
RESPONSE=$(curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -X POST \
  "https://api.notion.com/v1/databases/$NOTION_DATABASE_ID/query" \
  -d '{"page_size": 100}')
```

Then match pages by ID prefix.

Validate the response:

- If `archived` is `true`: warn `Page is archived. Plan anyway? [y/N]` (in AFK mode: skip)

To fetch comments (separate endpoint):

```bash
COMMENTS=$(curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  "https://api.notion.com/v1/comments?block_id=$PAGE_ID")
```

Map fields: title = extract from `properties` (find the `title` type property), description = fetch page content via `GET /v1/blocks/$PAGE_ID/children` (Notion stores content as blocks, not a single description field), parent = `parent.page_id` or `parent.database_id`.

**Notion limitation:** Page content is stored as blocks, not a single text field. Read all child blocks and concatenate their text content for plan context.

Then skip to Step 3b with this single ticket.

### Queue fetch (no specific key)

#### Jira

Build the JQL using planning-specific env vars:

- `CLANCY_PLAN_STATUS` defaults to `Backlog` if not set
- Sprint clause: include `AND sprint in openSprints()` if `CLANCY_JQL_SPRINT` is set
- Label clause: include `AND labels = "$CLANCY_LABEL_PLAN"` if `CLANCY_LABEL_PLAN` is set (falls back to `CLANCY_PLAN_LABEL` if `CLANCY_LABEL_PLAN` is not set). If neither is set, include `AND labels = "$CLANCY_LABEL"` if `CLANCY_LABEL` is set.

Full JQL: `project=$JIRA_PROJECT_KEY [AND sprint in openSprints()] [AND labels = "$CLANCY_LABEL_PLAN"] AND assignee=currentUser() AND status="$CLANCY_PLAN_STATUS" ORDER BY priority ASC`

```bash
RESPONSE=$(curl -s \
  -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  "$JIRA_BASE_URL/rest/api/3/search/jql" \
  -d '{"jql": "<jql as above>", "maxResults": <N>, "fields": ["summary", "description", "issuelinks", "parent", "customfield_10014", "comment"]}')
```

Note: include the `comment` field so we can check for existing plans and read feedback.

#### GitHub Issues

First resolve the authenticated username (don't use `@me` — it breaks with fine-grained PATs):

```bash
GITHUB_USERNAME=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user | jq -r '.login')
```

Then fetch issues:

```bash
RESPONSE=$(curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/$GITHUB_REPO/issues?state=open&assignee=$GITHUB_USERNAME&labels=$CLANCY_LABEL_PLAN&per_page=<N>")
```

- `CLANCY_LABEL_PLAN` is the pipeline label for the planning queue (default: `clancy:plan`). Falls back to `CLANCY_PLAN_LABEL` if `CLANCY_LABEL_PLAN` is not set. If neither is set, defaults to `needs-refinement`.
- Filter out PRs (entries with `pull_request` key)
- For each issue, fetch comments: `GET /repos/$GITHUB_REPO/issues/{number}/comments`

#### Linear

Build the filter using `CLANCY_PLAN_STATE_TYPE` (defaults to `backlog` if not set). If `CLANCY_LABEL_PLAN` is set (falls back to `CLANCY_PLAN_LABEL`), add a label filter to the query:

```graphql
query {
  viewer {
    assignedIssues(
      filter: {
        state: { type: { eq: "$CLANCY_PLAN_STATE_TYPE" } }
        team: { id: { eq: "$LINEAR_TEAM_ID" } }
        labels: { name: { eq: "$CLANCY_LABEL_PLAN" } } # Only if CLANCY_LABEL_PLAN is set
      }
      first: $N
      orderBy: priority
    ) {
      nodes {
        id
        identifier
        title
        description
        parent {
          identifier
          title
        }
        comments {
          nodes {
            id
            body
            createdAt
            user {
              id
            }
          }
        }
      }
    }
  }
}
```

#### Azure DevOps

Build a WIQL query using planning-specific env vars:

- `CLANCY_PLAN_STATUS` defaults to `New` if not set (Azure DevOps uses `New`, `Active`, `Resolved`, `Closed`, `Removed`)
- Tag clause: include `AND [System.Tags] CONTAINS '$CLANCY_LABEL_PLAN'` if `CLANCY_LABEL_PLAN` is set (falls back to `CLANCY_PLAN_LABEL`). If neither is set, defaults to `clancy:plan`.
- Assigned to: `AND [System.AssignedTo] = @Me`

Full WIQL: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '$AZDO_PROJECT' AND [System.State] = '$CLANCY_PLAN_STATUS' [AND [System.Tags] CONTAINS '$CLANCY_LABEL_PLAN'] AND [System.AssignedTo] = @Me ORDER BY [Microsoft.VSTS.Common.Priority] ASC`

```bash
# Step 1: Run WIQL query to get work item IDs
WIQL_RESPONSE=$(curl -s \
  -u ":$AZDO_PAT" \
  -X POST \
  -H "Content-Type: application/json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/wiql?api-version=7.1" \
  -d '{"query": "<WIQL as above>"}')

# Step 2: Batch fetch work items (take first N IDs)
IDS=$(echo "$WIQL_RESPONSE" | jq -r '.workItems[0:N] | map(.id) | join(",")')

RESPONSE=$(curl -s \
  -u ":$AZDO_PAT" \
  -H "Accept: application/json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems?ids=$IDS&\$expand=relations&api-version=7.1")
```

Note: Azure DevOps comments are NOT included in work item responses. For each work item, fetch comments separately:

```bash
COMMENTS=$(curl -s \
  -u ":$AZDO_PAT" \
  -H "Accept: application/json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$ID/comments?api-version=7.1-preview.4")
```

Map fields: title = `fields["System.Title"]`, description = `fields["System.Description"]` (HTML), parent = relation with `System.LinkTypes.Hierarchy-Reverse` rel type, tags = `fields["System.Tags"]` (semicolon-delimited string).

#### Shortcut

Search for stories in the planning workflow state. Shortcut uses workflow states (not labels) for queue filtering, but labels can further narrow results.

- `SHORTCUT_WORKFLOW` — optional workflow ID. If not set, use the default workflow.
- `CLANCY_LABEL_PLAN` — optional label name to filter stories (falls back to `CLANCY_PLAN_LABEL`).

```bash
RESPONSE=$(curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST \
  "https://api.app.shortcut.com/api/v3/stories/search" \
  -d '{"owner_ids": ["<current member UUID>"], "workflow_state_types": ["backlog"], "page_size": <N>}')
```

To resolve the current member UUID:

```bash
MEMBER=$(curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  "https://api.app.shortcut.com/api/v3/member-info")
```

Use `MEMBER.id` as the owner filter. If `CLANCY_LABEL_PLAN` is set, add `"label_ids": [<label_id>]` to the search body (resolve label ID via `GET /api/v3/labels`).

For each story, fetch comments separately:

```bash
COMMENTS=$(curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  "https://api.app.shortcut.com/api/v3/stories/$STORY_ID/comments")
```

Map fields: title = `name`, description = `description` (markdown), parent = `epic_id` (resolve via `GET /api/v3/epics/$EPIC_ID`), labels = `labels[].name`.

#### Notion

Query the database with status and assignee filters:

- `CLANCY_NOTION_STATUS` — the status property name (configurable, defaults auto-detected from database schema)
- `CLANCY_PLAN_STATUS` — the status value to filter on (defaults to `Backlog` if not set)
- `CLANCY_NOTION_ASSIGNEE` — the assignee property name (configurable)
- `CLANCY_LABEL_PLAN` — optional label/tag to filter on (via multi-select property `CLANCY_NOTION_LABELS`)

```bash
RESPONSE=$(curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -X POST \
  "https://api.notion.com/v1/databases/$NOTION_DATABASE_ID/query" \
  -d '{"filter": {"and": [{"property": "$CLANCY_NOTION_STATUS", "status": {"equals": "$CLANCY_PLAN_STATUS"}}, ...]}, "page_size": <N>}')
```

Add assignee and label filters to the `and` array as needed. Notion filters use property-specific types (`status`, `people`, `multi_select`).

For each page, fetch comments separately:

```bash
COMMENTS=$(curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  "https://api.notion.com/v1/comments?block_id=$PAGE_ID")
```

Map fields: title = title property value, description = fetch child blocks via `GET /v1/blocks/$PAGE_ID/children` (concatenate text), parent = `parent.page_id`, labels = multi-select property values.

**Notion limitation:** Comments use `rich_text` format, not markdown. When scanning for `## Clancy Implementation Plan`, search for the text content within `rich_text` arrays.

If the API call fails (non-200 response or network error):

```
❌ Board API error: {HTTP status or error message}

Check your credentials in .clancy/.env or run /clancy:doctor to diagnose.
```

Stop.

If no tickets found:

```
🚨 Clancy — Plan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"Nothing to see here." — No backlog tickets to plan.
```

Then display board-specific guidance:

- **GitHub:** `For GitHub: planning uses the "$CLANCY_LABEL_PLAN" label (default: clancy:plan, fallback: $CLANCY_PLAN_LABEL or needs-refinement). Apply that label to issues you want planned.`
- **Jira:** `Check that CLANCY_PLAN_STATUS (currently: "$CLANCY_PLAN_STATUS") matches a status in your Jira project, and that tickets in that status are assigned to you.`
- **Linear:** `Check that CLANCY_PLAN_STATE_TYPE (currently: "$CLANCY_PLAN_STATE_TYPE") is a valid Linear state type (backlog, unstarted, started, completed, canceled, triage), and that tickets in that state are assigned to you in team $LINEAR_TEAM_ID.`
- **Azure DevOps:** `Check that CLANCY_PLAN_STATUS (currently: "${CLANCY_PLAN_STATUS || 'New'}") matches a state in your Azure DevOps project, and that work items in that state are assigned to you. Tag "${CLANCY_LABEL_PLAN || 'clancy:plan'}" must be applied.`
- **Shortcut:** `Check that your stories are in a "backlog" workflow state and assigned to you. If using CLANCY_LABEL_PLAN, ensure the label exists and is applied to stories you want planned.`
- **Notion:** `Check that pages in database $NOTION_DATABASE_ID have status "${CLANCY_PLAN_STATUS || 'Backlog'}" and are assigned to you. If using CLANCY_LABEL_PLAN, ensure the multi-select label is applied.`

Stop.

---

## Step 3b — Check for existing plans

For each ticket, scan its comments for the marker `## Clancy Implementation Plan`. Then apply the following logic:

| Condition                                         | Behaviour                                                                                                                                                   |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Has plan + feedback comments found after the plan | Revise: proceed to Step 3c to read feedback, then generate a revised plan                                                                                   |
| Has plan + `--fresh` flag                         | Discard existing plan, proceed to Step 4 (fresh plan from scratch)                                                                                          |
| Has plan + no feedback + no `--fresh`             | Stop for this ticket: `Already planned. Comment on the ticket to provide feedback, then re-run /clancy:plan {KEY} to revise. Or use --fresh to start over.` |
| No plan found                                     | Proceed to Step 4                                                                                                                                           |

Feedback detection: scan all comments posted AFTER the most recent `## Clancy Implementation Plan` comment. Exclude comments that are themselves Clancy-generated (contain `## Clancy Implementation Plan` or start with `Clancy skipped this ticket:`). All remaining comments are treated as feedback — regardless of author, since Clancy posts using the user's own credentials.

This is content-based filtering, not author-based. The user's own feedback comments must not be excluded.

---

## Step 3c — Read feedback comments

When revising a plan (auto-detected from feedback comments after the existing plan), read all comments posted AFTER the most recent `## Clancy Implementation Plan` comment.

Filter out Clancy-generated comments by content — exclude any comment that contains `## Clancy Implementation Plan` or starts with `Clancy skipped this ticket:`. These are Clancy's own outputs, not human feedback.

All other post-plan comments are treated as feedback regardless of author. This is critical because Clancy posts using the user's own credentials — author-based filtering would incorrectly exclude the user's own feedback.

No special syntax needed — users just comment normally on the ticket.

Pass this feedback to the plan generation step as additional context.

---

## Step 4 — For each ticket: Generate plan

Display the header:

```
🚨 Clancy — Plan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"Let me consult my crime files..." — Planning {N} ticket(s).
```

For each ticket, display a progress line when starting:

```
[{KEY}] {Title}
  Exploring codebase...
```

And when the plan is posted:

```
  ✅ Plan posted as comment.
```

For multi-ticket runs, this provides visibility into progress. `Ctrl+C` to stop early — completed plans are already posted.

### 4a. Quick feasibility scan

Before spending time exploring files, scan the ticket title and description for obvious non-codebase signals. Skip immediately if the ticket clearly requires work outside the codebase.

**Fail signals (skip immediately):**

- External platform references: "in Google Tag Manager", "in Salesforce", "in the AWS console", "in HubSpot", "in Jira admin"
- Human process steps: "get sign-off", "coordinate with", "schedule a meeting", "send an email to customers"
- Non-code deliverables: "write a runbook", "create a presentation", "update the wiki"
- Infrastructure ops: "rotate API keys in prod", "scale the fleet", "restart the service"

**STACK.md cross-reference:** If `.clancy/docs/STACK.md` exists, read it. If the ticket mentions a technology not listed in STACK.md, flag it as a concern (but do not skip — include a note in the plan's Risks section instead).

If infeasible:

```
⏭️  [{KEY}] {Title} — not a codebase change. Skipping.
   → {reason, e.g. "Ticket describes work in Google Tag Manager, not in the codebase."}
```

**Post skip comment to board:** Check `CLANCY_SKIP_COMMENTS` env var (default: `true`). If not `false`, post a brief comment on the ticket:

> Clancy skipped this ticket: {reason}
>
> This ticket appears to require work outside the codebase (e.g. {specific signal}). If this is incorrect, add more context to the ticket description and re-run `/clancy:plan`.

Use the same comment API patterns as Step 5 (plan posting). Best-effort — warn on failure, do not stop.

**Log SKIPPED entry:** Append to `.clancy/progress.txt`:

```
YYYY-MM-DD HH:MM | {KEY} | SKIPPED | {reason}
```

Continue to the next ticket. **Pass signals:** Anything mentioning code, components, features, bugs, UI, API, tests, refactoring, or lacking enough context to determine (benefit of the doubt).

### 4b. Check for previous implementation (QA return detection)

Check `.clancy/progress.txt` for any previous entry matching this ticket key that ends with `| DONE` (search for `| {KEY} |` on a line ending with `| DONE`). If found, the ticket was previously implemented by Clancy and has returned (likely from QA).

If detected:

- Flag as "Previously implemented — returned from QA"
- Read QA/review comments from the board (same mechanism as feedback loop in Step 3c)
- Focus the plan on what likely went wrong and what needs fixing

If no progress entry exists: treat as fresh.

### 4c. Read codebase context

If `.clancy/docs/` exists, read the following docs:

- `STACK.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `DESIGN-SYSTEM.md`, `ACCESSIBILITY.md`, `DEFINITION-OF-DONE.md`

These inform the plan's technical approach, affected files, and test plan.

### 4d. Figma design context (if applicable)

If the ticket description contains a Figma URL and `FIGMA_API_KEY` is configured in `.clancy/.env`, fetch design context using Clancy's existing Figma MCP integration (3 MCP calls: metadata, design context, screenshot). This informs the acceptance criteria and affected components in the plan.

If Figma URL is present but `FIGMA_API_KEY` is not configured: note in the plan — "Figma URL present but API key not configured. Run /clancy:settings to add it."

### 4e. Explore source files

Based on the ticket title AND description, explore the codebase to identify affected files.

**For S-sized tickets (simple/obvious scope):** Single-pass exploration — Glob and Read directly.

**For M/L-sized tickets (broad scope, multiple subsystems):** Spin up 2-3 parallel Explore subagents:

- **Agent 1:** Search for files matching ticket keywords, find existing implementations of similar features
- **Agent 2:** Identify related test files, check test patterns in affected areas
- **Agent 3:** (if UI ticket) Check component structure, design system usage, accessibility patterns

The size is estimated from the ticket title/description before exploration begins (rough heuristic). Subagents return their findings, which are merged into the plan.

### 4f. Generate plan

Write the plan in this exact template:

```markdown
## Clancy Implementation Plan

**Ticket:** [{KEY}] {Title}
**Planned:** {YYYY-MM-DD}

### Summary

{1-3 sentences: what this ticket asks for, why it matters, gaps filled}

### Affected Files

| File                    | Change Type | Description               |
| ----------------------- | ----------- | ------------------------- |
| `src/path/file.ts`      | Modify      | {What changes and why}    |
| `src/path/new-file.ts`  | Create      | {What this new file does} |
| `src/path/file.test.ts` | Modify      | {What changes and why}    |

### Implementation Approach

{2-4 sentences: implementation strategy, patterns, key decisions}

### Test Strategy

- [ ] {Specific test to write or verify}
- [ ] {Specific test to write or verify}

### Acceptance Criteria

- [ ] {Specific, testable criterion}
- [ ] {Specific, testable criterion}
- [ ] {Specific, testable criterion}

### Dependencies

{Blockers, prerequisites, external deps. "None" if clean.}

### Figma Link

{If a Figma URL was found in the ticket, include it here. Otherwise omit this section entirely.}

### Risks / Considerations

- {Specific risk or consideration and handling}
- {Specific risk or consideration and handling}

### Size Estimate

**{S / M / L}** — {Brief justification}

---

_Generated by [Clancy](https://github.com/Pushedskydiver/chief-clancy). To request changes: comment on this ticket, then re-run `/clancy:plan` to revise. To start over: `/clancy:plan --fresh`. To approve: `/clancy:approve-plan {KEY}`._
```

**If re-planning with feedback**, prepend a section before Summary:

```markdown
### Changes From Previous Plan

{What feedback was addressed and how the plan changed}
```

**Quality rules:**

- Acceptance criteria must be testable ("user can X", "system does Y"), never vague
- Affected files must be real files found during exploration, not guesses
- Risks / Considerations must be specific to this ticket, not generic
- Size: S (< 1 hour, few files), M (1-4 hours, moderate), L (4+ hours, significant)
- If affected files > 15: add a note "Consider splitting this ticket"
- If UI ticket without Figma URL: note in plan
- If ticket mentions tech not in STACK.md: note in Risks / Considerations

**Dependency detection:**

| Type                         | Detection                                                                                                                                                                                     | Action                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Blocked by another ticket    | Jira: issuelinks (type "Blocks"). GitHub: referenced issues. Linear: relations. Azure DevOps: relations (Dependency type). Shortcut: story_links (blocked type). Notion: relation properties. | List blocking tickets. Note "Complete {KEY} first."                                           |
| Depends on external API      | Mentioned in description or inferred from affected code                                                                                                                                       | If API exists with docs: include integration approach. If API doesn't exist: mark as blocked. |
| Depends on unfinished design | UI ticket with no Figma URL or design reference                                                                                                                                               | Note "Design dependency — no spec provided. Visual accuracy may vary."                        |
| Depends on library upgrade   | Ticket mentions upgrading a dependency                                                                                                                                                        | Include upgrade as prerequisite step. Note potential breaking changes.                        |
| Depends on infra in the repo | DB migrations, docker-compose, CI config                                                                                                                                                      | Include in affected files and plan normally.                                                  |

---

## Step 5 — Post plan as comment

### Jira — POST comment

```bash
curl -s \
  -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  "$JIRA_BASE_URL/rest/api/3/issue/$TICKET_KEY/comment" \
  -d '<ADF JSON body>'
```

Construct ADF (Atlassian Document Format) JSON for the comment body. Key mappings:

- `## Heading` → `heading` node (level 2)
- `### Heading` → `heading` node (level 3)
- `- bullet` → `bulletList > listItem > paragraph`
- `- [ ] checkbox` → `taskList > taskItem` (state: "TODO")
- `| table |` → `table > tableRow > tableCell`
- `**bold**` → marks: `[{ "type": "strong" }]`
- `` `code` `` → marks: `[{ "type": "code" }]`

If ADF construction is too complex for a particular element, fall back to wrapping that section in a code block (`codeBlock` node).

### GitHub — POST comment

```bash
curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -X POST \
  "https://api.github.com/repos/$GITHUB_REPO/issues/$ISSUE_NUMBER/comments" \
  -d '{"body": "<markdown plan>"}'
```

GitHub accepts Markdown directly — post the plan as-is.

### Linear — commentCreate mutation

```bash
curl -s \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  "https://api.linear.app/graphql" \
  -d '{"query": "mutation { commentCreate(input: { issueId: \"$ISSUE_ID\", body: \"<markdown plan>\" }) { success } }"}'
```

Linear accepts Markdown directly.

### Azure DevOps — POST comment

```bash
curl -s \
  -u ":$AZDO_PAT" \
  -X POST \
  -H "Content-Type: application/json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$WORK_ITEM_ID/comments?api-version=7.1-preview.4" \
  -d '{"text": "<html plan>"}'
```

Azure DevOps work item comments use **HTML**, not markdown. Convert the plan markdown to HTML:

- `## Heading` → `<h2>Heading</h2>`
- `### Heading` → `<h3>Heading</h3>`
- `- bullet` → `<ul><li>bullet</li></ul>`
- `- [ ] checkbox` → `<ul><li>☐ checkbox</li></ul>`
- `| table |` → `<table><tr><td>...</td></tr></table>`
- `**bold**` → `<strong>bold</strong>`
- `` `code` `` → `<code>code</code>`
- Newlines → `<br>` or `<p>` tags

If HTML construction is too complex for a particular element, wrap that section in `<pre>` tags as fallback.

### Shortcut — POST comment

```bash
curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST \
  "https://api.app.shortcut.com/api/v3/stories/$STORY_ID/comments" \
  -d '{"text": "<markdown plan>"}'
```

Shortcut accepts Markdown directly in comment text.

### Notion — POST comment

```bash
curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -X POST \
  "https://api.notion.com/v1/comments" \
  -d '{"parent": {"page_id": "$PAGE_ID"}, "rich_text": [{"type": "text", "text": {"content": "<plan text>"}}]}'
```

**Notion limitation:** Comments use `rich_text` blocks, not markdown. For the plan content, use a single `text` block with the full plan as plain text. Notion will render it without markdown formatting. For better readability, consider splitting the plan into multiple `rich_text` blocks (one per section) with `annotations` for bold headings.

**Notion limitation:** The `rich_text` array has a **2000-character limit per text block**. If the plan exceeds 2000 characters, split it across multiple `rich_text` blocks within the same comment (each block up to 2000 chars). The total comment can contain many blocks.

**On failure:** Print the plan to stdout and warn — do not lose the plan. The user can manually paste it.

```
⚠️  Failed to post comment for [{KEY}]. Plan printed above — paste it manually.
```

---

## Step 6 — Log

For each planned ticket, append to `.clancy/progress.txt` using the appropriate variant:

| Outcome                         | Log entry                                              |
| ------------------------------- | ------------------------------------------------------ |
| Normal                          | `YYYY-MM-DD HH:MM \| {KEY} \| PLAN \| {S/M/L}`         |
| Revised (re-plan with feedback) | `YYYY-MM-DD HH:MM \| {KEY} \| REVISED \| {S/M/L}`      |
| Comment post failed             | `YYYY-MM-DD HH:MM \| {KEY} \| POST_FAILED \| {reason}` |
| Skipped (infeasible)            | `YYYY-MM-DD HH:MM \| {KEY} \| SKIPPED \| {reason}`     |

---

## Step 7 — Summary

After all tickets are processed, display:

```
Planned {N} ticket(s):

  ✅ [{KEY1}] {Title} — M | 6 files | Comment posted
  ✅ [{KEY2}] {Title} — S | 2 files | Comment posted
  ⏭️  [{KEY3}] {Title} — already planned
  ⏭️  [{KEY4}] {Title} — not a codebase change

Plans written to your board. After review, run /clancy:approve-plan {KEY} to promote.

"Let me dust this for prints..."
```

---

## Notes

- This command does NOT implement anything — it generates plans only
- Plans are posted as comments, never overwriting the ticket description (that's `/clancy:approve-plan`)
- Re-running without `--fresh` auto-detects feedback: if feedback exists, revises; if no feedback, stops with guidance
- The `--fresh` flag discards the existing plan entirely and generates a new one from scratch
- The planning queue is separate from the implementation queue — they never compete for the same tickets
- All board API calls are best-effort — if a comment fails to post, print the plan to stdout as fallback
- When exploring the codebase, use Glob and Read for small tickets, parallel Explore subagents for larger ones
- The `## Clancy Implementation Plan` marker in comments is used by both `/clancy:plan` (to detect existing plans) and `/clancy:approve-plan` (to find the plan to promote)
