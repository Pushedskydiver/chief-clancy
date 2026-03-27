# Clancy Approve Brief Workflow

## Overview

Approve a reviewed strategic brief by creating child tickets on the board, linking dependencies, and posting a tracking summary on the parent ticket. Tickets are created sequentially in topological (dependency) order. Partial failures stop immediately — re-run to resume.

---

## Step 1 — Preflight checks

1. Check `.clancy/` exists and `.clancy/.env` is present. If not:

   ```
   .clancy/ not found. Run /clancy:init to set up Clancy first.
   ```

   Stop.

2. Source `.clancy/.env` and check board credentials are present.

3. Check `CLANCY_ROLES` includes `strategist` (or env var is unset, which indicates a global install where all roles are available). If `CLANCY_ROLES` is set but does not include `strategist`:

   ```
   The Strategist role is not enabled. Add "strategist" to CLANCY_ROLES in .clancy/.env or run /clancy:settings.
   ```

   Stop.

4. Branch freshness check:

   ```bash
   git fetch origin
   ```

   Compare HEAD with `origin/$CLANCY_BASE_BRANCH`. If behind:

   **AFK mode** (`--afk` flag or `CLANCY_MODE=afk`): auto-pull without prompting.

   **Interactive mode:**

   ```
   Behind by N commits. [1] Pull latest  [2] Continue  [3] Abort
   ```

---

## Step 2 — Load brief

Scan `.clancy/briefs/` for unapproved files — `.md` files WITHOUT a corresponding `.md.approved` marker file.

### Selection logic

Parse the argument (if any) against the unapproved list:

**No argument + 0 unapproved briefs:**

```
No unapproved briefs found. Run /clancy:brief to generate one.
```

Stop.

**No argument + 1 unapproved brief:**
Auto-select the single brief. Continue.

**No argument + 2+ unapproved briefs:**
Display numbered list:

```
Multiple unapproved briefs found:

  [1] {slug-a} ({date}) — {N} tickets — Source: {source}
  [2] {slug-b} ({date}) — {N} tickets — Source: {source}

Which brief to approve? [1-N]
```

**Argument is a positive integer (e.g. `2`):**
Select the Nth unapproved brief by index. If out of range: `Index out of range.` Stop.

**Argument matches a ticket identifier (`#\d+`, `[A-Z]+-\d+`, bare number for Azure DevOps, `[A-Za-z]{1,5}-\d+`/bare number for Shortcut, or UUID/`notion-XXXXXXXX` for Notion):**
Scan unapproved brief files for a `**Source:**` line containing the identifier. If 0 matches: show available briefs and stop. If 1 match: load it. If 2+ matches: show numbered list and ask.

**Argument is other text:**
Match by slug (filename contains the argument). If 0 matches: `No brief matching "{arg}" found.` Stop. If 1 match: load it. If 2+ matches: list and ask.

### Already-approved guard

After loading, verify the `.md.approved` marker does not exist. If it does:

```
Brief "{slug}" is already approved. No action needed.
```

Stop.

---

## Step 3 — Parse decomposition table

Read the `## Ticket Decomposition` table from the brief file. Extract each row:

| Column         | Field                            |
| -------------- | -------------------------------- |
| `#`            | Sequence number                  |
| `Title`        | Ticket title                     |
| `Description`  | 1-2 sentence description         |
| `Size`         | S / M / L                        |
| `Dependencies` | References like `#1`, `#3`       |
| `Mode`         | AFK or HITL                      |
| `Ticket`       | Board key (if partially created) |

### Validation

- **0 tickets:** `No tickets found in the decomposition table. Add at least one ticket to the brief before approving.` Stop.
- **>10 tickets:** Warn: `Brief has {N} tickets (max recommended: 10). Large decompositions may indicate the idea should be split further.` Continue — advisory only.
- **Tickets already in Ticket column:** These were created in a prior partial run. Mark them for skipping during creation.
- **Circular dependencies:** Run cycle detection on the dependency graph. If a cycle exists: `Circular dependency detected between #{N} and #{M}. Edit the brief to resolve, then re-run.` Stop.

### Topological sort

Order tickets by their dependency graph so blockers are created before dependents. This ensures blocking relationships can be linked immediately after creation.

---

## Step 4 — Confirm with user

Display the ticket list in dependency order:

```
Clancy — Approve Brief

Brief: {slug}
Parent: {ticket key or "none (standalone)"}

Tickets to create (dependency order):
  #1  [S] [AFK]  Title — No deps
  #2  [M] [HITL] Title — No deps
  #3  [M] [AFK]  Title — After #2
  #4  [S] [AFK]  Title — After #1, #3

Labels: {list of labels to apply}
Issue type: {type} (Jira only)
AFK-ready: {X} | Needs human: {Y}

Create {N} tickets? [Y/n]
```

**AFK mode:** If running in AFK mode (`--afk` flag OR `CLANCY_MODE=afk`), skip the confirmation prompt and auto-confirm. Display the ticket list for logging purposes but proceed without waiting for input.

If user declines (interactive only): `Cancelled. No changes made.` Stop.

---

## Step 4a — Dry-run check

If `--dry-run` flag is set:

```
Dry run complete. No tickets created.
```

Stop. No API calls beyond preflight.

---

## Step 5 — Resolve parent

The parent ticket is where child tickets are linked. Determine the parent from one of these sources (in priority order):

### Source 1 — Board-sourced brief

If the brief's `**Source:**` line contains a board ticket identifier (e.g. `[#50]`, `[PROJ-200]`, `[ENG-42]`), that ticket is the parent. Fetch it to validate:

#### GitHub

```bash
curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/$GITHUB_REPO/issues/$PARENT_NUMBER"
```

Check: `pull_request` present? -> `Parent #{N} is a PR, not an issue.` Stop. `state == "closed"`? -> Warn, ask `[y/N]`.

#### Jira

```bash
curl -s \
  -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -H "Accept: application/json" \
  "$JIRA_BASE_URL/rest/api/3/issue/$PARENT_KEY?fields=summary,status,issuetype,priority"
```

Check: `status.statusCategory.key == "done"`? -> Warn, ask `[y/N]`. Note if `issuetype.name == "Epic"` (ideal case for parent linking).

#### Linear

```graphql
query {
  issues(filter: { identifier: { eq: "$PARENT_KEY" } }) {
    nodes {
      id
      identifier
      title
      state {
        type
      }
      team {
        id
        key
      }
      children {
        nodes {
          id
          identifier
          title
        }
      }
    }
  }
}
```

Check: `state.type == "completed"` or `"canceled"`? -> Warn, ask `[y/N]`. `team.id != LINEAR_TEAM_ID`? -> Warn about cross-team children, ask `[Y/n]`.

#### Azure DevOps

```bash
curl -s \
  -u ":$AZDO_PAT" \
  -H "Accept: application/json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$PARENT_ID?\$expand=relations&api-version=7.1"
```

Check: `fields["System.State"]` is `Done`/`Closed`/`Resolved`? -> Warn, ask `[y/N]`. Check `relations` for existing children (type `System.LinkTypes.Hierarchy-Forward`).

#### Shortcut

If the parent is a Shortcut epic, fetch it:

```bash
curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  "https://api.app.shortcut.com/api/v3/epics/$EPIC_ID"
```

Check: `completed` or `archived`? -> Warn, ask `[y/N]`. Fetch epic stories via `GET /api/v3/epics/$EPIC_ID/stories` to check for existing children.

If the parent is a story (not an epic), fetch it:

```bash
curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  "https://api.app.shortcut.com/api/v3/stories/$STORY_ID"
```

Check: `completed` or `archived`? -> Warn, ask `[y/N]`. Check `story_links` for existing children.

#### Notion

```bash
curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  "https://api.notion.com/v1/pages/$PAGE_ID"
```

Check: `archived` is `true`? -> Warn, ask `[y/N]`. Check `relation` properties for existing child pages.

**Notion limitation:** Notion does not have a native parent-child hierarchy like other boards. Parent relationships are modelled via `relation` properties in the database. If no relation property is configured, children are standalone pages in the same database.

### Source 2 — `--epic` flag

If `--epic` is provided (e.g. `--epic PROJ-200`, `--epic #100`, `--epic ENG-42`, `--epic SC-123`, `--epic notion-XXXXXXXX`), validate the target using the same checks as Source 1. If not found or is Done: stop.

Note: `--epic` is ignored for board-sourced briefs (the source ticket IS the parent).

### Source 3 — `CLANCY_BRIEF_EPIC` default

If no board source and no `--epic` flag, check `.clancy/.env` for `CLANCY_BRIEF_EPIC`. If set, validate and use it as the parent.

### Source 4 — No parent (standalone)

If none of the above apply:

```
No parent specified. Tickets will be created as standalone.
Use --epic {KEY} to attach to a parent.
```

Continue — omit parent fields from creation payloads. No tracking comment will be posted.

---

## Step 6 — Look up queue state / labels

Platform-specific pre-creation lookups.

### GitHub

**Pipeline label for children — this is mandatory, always apply a pipeline label to every child ticket.** Determine which label to use:

- `--skip-plan` flag → use `CLANCY_LABEL_BUILD` from `.clancy/.env` if set, otherwise `clancy:build`
- Planner role enabled (`CLANCY_ROLES` includes `planner`) → use `CLANCY_LABEL_PLAN` from `.clancy/.env` if set, otherwise `clancy:plan`
- Planner role NOT enabled → use `CLANCY_LABEL_BUILD` from `.clancy/.env` if set, otherwise `clancy:build`
  Ensure the label exists on the board (create it if missing), then add it to each child ticket.

**Labels to apply per ticket:**

- The pipeline label determined above (`CLANCY_LABEL_PLAN` or `CLANCY_LABEL_BUILD`) — replaces `CLANCY_LABEL` on children
- `component:{CLANCY_COMPONENT}` (if `CLANCY_COMPONENT` set)
- `size:{S|M|L}` — from decomposition table
- `clancy:afk` or `clancy:hitl` — from Mode column

Note: `CLANCY_LABEL` is NOT applied to child tickets when pipeline labels are active. The pipeline label (`clancy:plan` or `clancy:build`) serves as the queue identifier.

**Label pre-creation:** For each unique label, attempt to create it on the repo. If it already exists, GitHub returns 422 — ignore that error. If 403 (no admin access), note the label as unavailable.

```bash
curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Content-Type: application/json" \
  -X POST \
  "https://api.github.com/repos/$GITHUB_REPO/labels" \
  -d '{"name": "$LABEL_NAME", "color": "d4c5f9"}'
```

If label creation fails with 403: warn, continue without that label.

**Resolve username** for assignee:

```bash
curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/user"
```

Cache the `login` field for all ticket creations.

### Jira

**Validate issue type exists in project:**

```bash
curl -s \
  -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -H "Accept: application/json" \
  "$JIRA_BASE_URL/rest/api/3/issue/createmeta/$JIRA_PROJECT_KEY/issuetypes"
```

Look for `CLANCY_BRIEF_ISSUE_TYPE` (default: `Task`). If not found:

```
Issue type "{type}" not available in project {PROJ}. Available types: {list}.
Set CLANCY_BRIEF_ISSUE_TYPE in .clancy/.env.
```

Stop.

**Pipeline label for children — mandatory, same logic as GitHub.** Use `CLANCY_LABEL_PLAN` or `CLANCY_LABEL_BUILD` from `.clancy/.env` (defaults: `clancy:plan` / `clancy:build`). Always apply to every child ticket.

**Labels:** Jira auto-creates labels — no pre-creation needed. Apply: the pipeline label determined above, `clancy:afk` or `clancy:hitl`. `CLANCY_LABEL` is NOT applied to children when pipeline labels are active.

**Components:** If `CLANCY_COMPONENT` is set, it maps to the Jira `components` field.

**Priority:** Inherit from parent ticket if available. Otherwise omit (Jira uses project default).

### Linear

**Look up backlog state UUID:**

```graphql
query {
  workflowStates(
    filter: { team: { id: { eq: "$LINEAR_TEAM_ID" } }, type: { eq: "backlog" } }
  ) {
    nodes {
      id
      name
    }
  }
}
```

Use `nodes[0].id`. If empty, fall back to `triage` type, then `unstarted`, then any first state. If truly nothing found, warn and use the team default.

**Look up label UUIDs:**

```graphql
query {
  team(id: "$LINEAR_TEAM_ID") {
    labels {
      nodes {
        id
        name
      }
    }
  }
}
```

**Pipeline label for children — mandatory, same logic as GitHub/Jira.** Use `CLANCY_LABEL_PLAN` or `CLANCY_LABEL_BUILD` from `.clancy/.env` (defaults: `clancy:plan` / `clancy:build`). Always apply to every child ticket.

For each required label (the pipeline label, `component:{CLANCY_COMPONENT}`, `clancy:afk`, `clancy:hitl`): search by exact name. `CLANCY_LABEL` is NOT applied to children when pipeline labels are active. If not found in team labels, check workspace labels:

```graphql
query {
  issueLabels(filter: { name: { eq: "$LABEL_NAME" } }) {
    nodes {
      id
      name
    }
  }
}
```

If still not found, auto-create at team level:

```graphql
mutation {
  issueLabelCreate(input: { teamId: "$LINEAR_TEAM_ID", name: "$LABEL_NAME" }) {
    success
    issueLabel {
      id
      name
    }
  }
}
```

On failure to create label: warn, continue without it.

### Azure DevOps

**Work item type:** Azure DevOps uses configurable work item types. Use `CLANCY_BRIEF_ISSUE_TYPE` (default: `Task`). Validate by fetching available types:

```bash
curl -s \
  -u ":$AZDO_PAT" \
  -H "Accept: application/json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitemtypes?api-version=7.1"
```

If the specified type is not found, stop with the available types listed.

**Pipeline tag for children — mandatory, same logic as other boards.** Use `CLANCY_LABEL_PLAN` or `CLANCY_LABEL_BUILD` from `.clancy/.env` (defaults: `clancy:plan` / `clancy:build`). Tags are applied via the `System.Tags` field (semicolon-delimited).

**Tags:** Azure DevOps auto-creates tags — no pre-creation needed. Apply: the pipeline tag, `clancy:afk` or `clancy:hitl`. `CLANCY_LABEL` is NOT applied to children when pipeline tags are active.

**Resolve authenticated user** for assignment:

```bash
curl -s \
  -u ":$AZDO_PAT" \
  -H "Accept: application/json" \
  "https://dev.azure.com/$AZDO_ORG/_apis/connectionData"
```

Use `authenticatedUser.providerDisplayName` for the `System.AssignedTo` field.

### Shortcut

**Story type:** Shortcut creates stories by default. Use `story_type` field if needed (`feature`, `bug`, `chore` — default: `feature`).

**Pipeline label for children — mandatory, same logic as other boards.** Use `CLANCY_LABEL_PLAN` or `CLANCY_LABEL_BUILD` from `.clancy/.env` (defaults: `clancy:plan` / `clancy:build`).

**Labels:** Resolve label IDs via `GET /api/v3/labels`. If the required label does not exist, create it:

```bash
curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST \
  "https://api.app.shortcut.com/api/v3/labels" \
  -d '{"name": "$LABEL_NAME", "color": "#d4c5f9"}'
```

On failure to create label: warn, continue without it. Apply: the pipeline label, `clancy:afk` or `clancy:hitl`. `CLANCY_LABEL` is NOT applied to children when pipeline labels are active.

**Resolve current member** for assignment:

```bash
curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  "https://api.app.shortcut.com/api/v3/member-info"
```

Use `id` as the `owner_ids` value for story creation.

### Notion

**Pipeline label for children — mandatory, same logic as other boards.** Use `CLANCY_LABEL_PLAN` or `CLANCY_LABEL_BUILD` from `.clancy/.env` (defaults: `clancy:plan` / `clancy:build`). Labels are applied via multi-select properties.

**Labels:** Notion auto-creates multi-select options when first used — no pre-creation needed. Apply: the pipeline label, `clancy:afk` or `clancy:hitl`. `CLANCY_LABEL` is NOT applied to children when pipeline labels are active.

Use `CLANCY_NOTION_LABELS` to specify which multi-select property holds labels (configurable per database).

**Assignee:** Use `CLANCY_NOTION_ASSIGNEE` property name. Resolve the current user via the Notion API:

```bash
curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  "https://api.notion.com/v1/users/me"
```

Use `id` for the people property value.

**Status:** Resolve the backlog status value from `CLANCY_PLAN_STATUS` (default: `Backlog`). Use `CLANCY_NOTION_STATUS` for the status property name.

---

## Step 6a — Pre-creation race check

Create the `.approved` marker file with exclusive create (O_EXCL) to prevent concurrent approval:

```
Marker path: .clancy/briefs/{filename}.approved
```

If the file already exists (`EEXIST`):

```
Brief is being approved by another process.
```

Stop.

If creation succeeds: the marker acts as a lock. **If ticket creation fails later, delete this marker** (partial failure = not approved).

---

## Step 7 — Create child tickets

Create tickets **sequentially** in topological (dependency) order. Wait **500ms** between each creation to respect rate limits.

For each ticket in dependency order:

1. **Check if already created:** If the Ticket column has a value from a prior partial run, skip this ticket. Display: `[{i}/{N}] skip {KEY} — already exists`

2. **Build the creation payload** (platform-specific — see below).

3. **Send the API request.**

4. **On success:** Record the created key/number. Map the decomposition `#N` to the board key for dependency linking. Display: `[{i}/{N}] + {KEY} — {Title} [{Mode}]`

5. **On failure:** STOP immediately. Do NOT attempt remaining tickets. See partial failure handling in Step 10.

6. **Wait 500ms** before the next creation.

### GitHub — POST /repos/{owner}/{repo}/issues

```bash
curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Content-Type: application/json" \
  -X POST \
  "https://api.github.com/repos/$GITHUB_REPO/issues" \
  -d '{
    "title": "{ticket title}",
    "body": "Epic: #{parent_number}\n\n## {Title}\n\n{Description}\n\n---\n\n**Parent:** #{parent_number}\n**Brief:** {slug}\n**Size:** {S|M|L}\n\n### Dependencies\n\n{Depends on #NN lines or None}\n\n---\n\n*Created by Clancy from strategic brief.*",
    "labels": ["{PIPELINE_LABEL}", "size:{size}", "clancy:{mode}", ...],
    "assignees": ["{resolved_username}"]
  }'
```

The `Epic: #{parent_number}` line is always the FIRST line of the body — this enables cross-platform epic completion detection.

Dependencies in the body use resolved issue numbers: `Depends on #51` (not decomposition indices).

If no parent: omit `Epic:` and `Parent:` lines, omit `assignees` if not resolvable.

**On 422 (label validation error):** Retry without the invalid label(s). Warn: `Label "{name}" does not exist. Created issue without it.`

**On 429 (rate limited):** Check `X-RateLimit-Reset` header. Wait until reset, retry once. If still limited: stop, enter partial failure flow.

### Jira — POST /rest/api/3/issue

```bash
curl -s \
  -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -X POST \
  "$JIRA_BASE_URL/rest/api/3/issue" \
  -d '{
    "fields": {
      "project": { "key": "$JIRA_PROJECT_KEY" },
      "summary": "{ticket title}",
      "description": {
        "version": 1,
        "type": "doc",
        "content": [
          {
            "type": "paragraph",
            "content": [
              { "type": "text", "text": "Epic: {PARENT_KEY}\n\n{Description}" }
            ]
          }
        ]
      },
      "issuetype": { "name": "{CLANCY_BRIEF_ISSUE_TYPE or Task}" },
      "parent": { "key": "{PARENT_KEY}" },
      "labels": ["{PIPELINE_LABEL}", "clancy:{mode}"]
    }
  }'
```

**Conditional fields (include only when set):**

- `CLANCY_COMPONENT` -> `"components": [{ "name": "{value}" }]`
- Parent has priority -> `"priority": { "name": "{priority}" }`

**Parent field fallback (classic projects):**
If the API returns 400 with an error mentioning the `parent` field, retry with `customfield_10014` instead:

```json
"customfield_10014": "{PARENT_KEY}"
```

Cache which field works for the remaining tickets in this batch.

If both `parent` and `customfield_10014` fail:

```
Could not set parent. Continue creating tickets without parent? [y/N]
```

Default: N (stop). If Y: create remaining tickets without parent field.

**On 400 (component not found):** Retry without `components` field. Warn.

**On 429 (rate limited):** Honour `Retry-After` header. Wait, retry once. If still 429: stop, enter partial failure flow.

### Linear — issueCreate mutation

```graphql
mutation {
  issueCreate(
    input: {
      teamId: "$LINEAR_TEAM_ID"
      title: "{ticket title}"
      description: "Epic: {PARENT_IDENTIFIER}\n\n{Description}"
      parentId: "{PARENT_UUID}"
      stateId: "{BACKLOG_STATE_UUID}"
      labelIds: ["{label UUIDs}"]
      priority: 0
    }
  ) {
    success
    issue {
      id
      identifier
      title
      url
    }
  }
}
```

If no parent: omit `parentId`.

**On rate limit (RATELIMITED error code):** Wait 60s, retry once. If still limited: stop, enter partial failure flow.

### Azure DevOps — POST work item

```bash
curl -s \
  -u ":$AZDO_PAT" \
  -X POST \
  -H "Content-Type: application/json-patch+json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/\$${WORK_ITEM_TYPE}?api-version=7.1" \
  -d '[
    {"op": "add", "path": "/fields/System.Title", "value": "{ticket title}"},
    {"op": "add", "path": "/fields/System.Description", "value": "<h3>{Title}</h3><p>{Description as HTML}</p><hr><p><strong>Brief:</strong> {slug}</p><p><strong>Size:</strong> {S|M|L}</p>"},
    {"op": "add", "path": "/fields/System.Tags", "value": "{PIPELINE_TAG}; clancy:{mode}"},
    {"op": "add", "path": "/fields/System.AssignedTo", "value": "{resolved_user}"},
    {"op": "add", "path": "/relations/-", "value": {"rel": "System.LinkTypes.Hierarchy-Reverse", "url": "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$PARENT_ID"}}
  ]'
```

**Work item type:** Use `CLANCY_BRIEF_ISSUE_TYPE` (default: `Task`). The type is part of the URL path: `$${type}`.

**Parent linking:** Azure DevOps uses the `relations` array with `System.LinkTypes.Hierarchy-Reverse` to link children to parents. This is included in the creation payload as a relation add operation.

**Description:** Azure DevOps uses HTML. Convert the ticket description markdown to HTML.

If no parent: omit the `relations/-` operation from the JSON Patch array.

**On 400 (validation error):** Check if the work item type or a field is invalid. Warn with the specific error and stop.

**On 429 (rate limited):** Check `Retry-After` header. Wait, retry once. If still 429: stop, enter partial failure flow.

### Shortcut — POST story

```bash
curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST \
  "https://api.app.shortcut.com/api/v3/stories" \
  -d '{
    "name": "{ticket title}",
    "description": "Epic: {PARENT_KEY}\n\n{Description}\n\n---\n\n**Brief:** {slug}\n**Size:** {S|M|L}",
    "story_type": "feature",
    "labels": [{"name": "{PIPELINE_LABEL}"}, {"name": "clancy:{mode}"}],
    "owner_ids": ["{resolved_member_id}"],
    "epic_id": {EPIC_ID_or_null},
    "workflow_state_id": {BACKLOG_STATE_ID}
  }'
```

**Parent linking:** If the parent is a Shortcut epic, use the `epic_id` field. If the parent is a story, omit `epic_id` and link via `story_links` after creation (see Step 8).

**Description:** Shortcut uses markdown. The `Epic: {PARENT_KEY}` line is always the first line of the description.

**Workflow state:** Resolve the backlog state ID from the default workflow:

```bash
WORKFLOWS=$(curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  "https://api.app.shortcut.com/api/v3/workflows")
```

Find the state with `type: "backlog"` (or `"unstarted"` as fallback). Use its `id` for `workflow_state_id`.

If no parent: omit `epic_id` (or set to `null`).

**On 429 (rate limited):** Check `Retry-After` header. Wait, retry once. If still 429: stop, enter partial failure flow.

### Notion — POST page

```bash
curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -X POST \
  "https://api.notion.com/v1/pages" \
  -d '{
    "parent": {"database_id": "$NOTION_DATABASE_ID"},
    "properties": {
      "Name": {"title": [{"text": {"content": "{ticket title}"}}]},
      "$CLANCY_NOTION_STATUS": {"status": {"name": "$CLANCY_PLAN_STATUS"}},
      "$CLANCY_NOTION_LABELS": {"multi_select": [{"name": "{PIPELINE_LABEL}"}, {"name": "clancy:{mode}"}]},
      "$CLANCY_NOTION_ASSIGNEE": {"people": [{"id": "{resolved_user_id}"}]}
    }
  }'
```

After creation, append the description as page content blocks:

```bash
curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -X PATCH \
  "https://api.notion.com/v1/blocks/$NEW_PAGE_ID/children" \
  -d '{"children": [
    {"type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": "Epic: {PARENT_KEY}"}}]}},
    {"type": "divider", "divider": {}},
    {"type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": "{Description}"}}]}},
    {"type": "divider", "divider": {}},
    {"type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": "Brief: {slug}\nSize: {S|M|L}"}}]}}
  ]}'
```

**Parent linking:** If the parent is a Notion page with a `relation` property configured, update the relation on the child page to point to the parent. If no relation property: children are standalone pages in the same database.

**Notion limitation:** Page content is stored as blocks, not a description field. The `Epic: {PARENT_KEY}` line is the first block of every child page. Each `rich_text` block has a 2000-character limit — split longer descriptions across multiple blocks.

If no parent: omit the `Epic:` paragraph block and relation property.

**On 429 (rate limited):** Check `Retry-After` header. Wait, retry once. If still 429: stop, enter partial failure flow.

---

## Step 8 — Link dependencies

For each ticket with dependencies, create blocking relationships on the board. This is **best-effort** — warn on failure, do not stop.

Skip links involving uncreated tickets (from partial failures).

### GitHub

No separate API call needed. Dependencies are embedded in the issue body as `Depends on #{number}` text. GitHub auto-creates cross-references from the `#N` mentions.

### Jira — POST /rest/api/3/issueLink

For each dependency (e.g. ticket #3 depends on #2):

```bash
curl -s \
  -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -X POST \
  "$JIRA_BASE_URL/rest/api/3/issueLink" \
  -d '{
    "type": { "name": "Blocks" },
    "inwardIssue": { "key": "{BLOCKER_KEY}" },
    "outwardIssue": { "key": "{DEPENDENT_KEY}" }
  }'
```

`inwardIssue` = the blocker, `outwardIssue` = the dependent ticket.

Wait **200ms** between each link creation.

On failure: `Could not link {DEPENDENT} -> {BLOCKER} (dependency). Link manually if needed.`

### Linear — issueRelationCreate mutation

```graphql
mutation {
  issueRelationCreate(
    input: {
      issueId: "{DEPENDENT_UUID}"
      relatedIssueId: "{BLOCKER_UUID}"
      type: blockedBy
    }
  ) {
    success
  }
}
```

`issueId` = the dependent ticket, `relatedIssueId` = the blocker.

Wait **200ms** between each relation creation.

On failure: `Could not link {DEPENDENT} -> {BLOCKER}. Add manually in Linear.`

### Azure DevOps — PATCH work item (add relation)

For each dependency, add a `System.LinkTypes.Dependency-Reverse` relation (predecessor link):

```bash
curl -s \
  -u ":$AZDO_PAT" \
  -X PATCH \
  -H "Content-Type: application/json-patch+json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$DEPENDENT_ID?api-version=7.1" \
  -d '[{"op": "add", "path": "/relations/-", "value": {"rel": "System.LinkTypes.Dependency-Reverse", "url": "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$BLOCKER_ID", "attributes": {"comment": "Depends on #$BLOCKER_ID (from Clancy brief)"}}}]'
```

`System.LinkTypes.Dependency-Reverse` = "Predecessor" (blocker must finish before dependent can start).

Wait **200ms** between each link creation.

On failure: `Could not link {DEPENDENT} -> {BLOCKER}. Link manually in Azure DevOps.`

### Shortcut — POST story link

For each dependency (e.g. ticket #3 depends on #2), create a story link:

```bash
curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST \
  "https://api.app.shortcut.com/api/v3/story-links" \
  -d '{
    "subject_id": {BLOCKER_STORY_ID},
    "object_id": {DEPENDENT_STORY_ID},
    "verb": "blocks"
  }'
```

`subject_id` = the blocker story, `object_id` = the dependent story. The `verb: "blocks"` means "subject blocks object".

Wait **200ms** between each link creation.

On failure: `Could not link {DEPENDENT} -> {BLOCKER}. Link manually in Shortcut.`

### Notion — relation properties

Notion uses **relation properties** for dependencies between pages. If the database has a relation property configured for dependencies:

```bash
curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -X PATCH \
  "https://api.notion.com/v1/pages/$DEPENDENT_PAGE_ID" \
  -d '{"properties": {"$DEPENDENCY_RELATION_PROPERTY": {"relation": [{"id": "$BLOCKER_PAGE_ID"}, ...existing_relations]}}}'
```

**Notion limitation:** If no relation property is configured for dependencies, dependency linking is not possible via the API. In this case, add a `Depends on: notion-XXXXXXXX` line to the page content blocks instead (best-effort text reference).

Wait **200ms** between each relation update.

On failure: `Could not link {DEPENDENT} -> {BLOCKER}. Link manually in Notion.`

---

## Step 9 — Update brief file

After creating tickets, update the local brief file:

1. **Add ticket keys** to the `Ticket` column in the decomposition table:

   ```markdown
   | #   | Title                  | Description | Size | Dependencies | Mode | Ticket   |
   | --- | ---------------------- | ----------- | ---- | ------------ | ---- | -------- |
   | 1   | Set up route structure | ...         | S    | None         | AFK  | PROJ-201 |
   | 2   | SSO login flow         | ...         | M    | None         | HITL | PROJ-202 |
   ```

2. **Update status** from `Draft` to `Approved` (in the `**Status:**` line if present).

---

## Step 10 — Mark approved

Check whether all tickets were created successfully:

**All created:**

- The `.approved` marker file (created in Step 6a) stays in place.

**Partial failure (some tickets failed):**

- **DELETE** the `.approved` marker file. Partial failure = not approved.
- Update the brief file with the tickets that WERE created (Step 9 still applies).
- Display partial failure summary:

  ```
  Partial: {M} of {N} tickets created

    PROJ-201  [S] Set up route structure
    PROJ-202  [M] SSO login flow
    X  #3  Role-based access control — FAILED ({error})
    -  #4-#{N} not attempted

  Created tickets are live on the board. To complete:
    1. Fix the issue (check board status/permissions)
    2. Re-run /clancy:approve-brief to resume creating remaining tickets
  ```

- Log: `YYYY-MM-DD HH:MM | APPROVE_BRIEF | {slug} | PARTIAL — {M} of {N} created`
- Stop (do not post tracking comment for partial failures).

---

## Step 11 — Post tracking summary on parent

Only if a parent ticket exists AND all tickets were created successfully.

Post a comment on the parent ticket listing all created children.

### GitHub

```bash
curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Content-Type: application/json" \
  -X POST \
  "https://api.github.com/repos/$GITHUB_REPO/issues/$PARENT_NUMBER/comments" \
  -d '{"body": "<tracking comment markdown>"}'
```

### Jira

```bash
curl -s \
  -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -X POST \
  "$JIRA_BASE_URL/rest/api/3/issue/$PARENT_KEY/comment" \
  -d '{"body": { "version": 1, "type": "doc", "content": [/* ADF table */] }}'
```

### Linear

```graphql
mutation {
  commentCreate(
    input: { issueId: "$PARENT_UUID", body: "<tracking comment markdown>" }
  ) {
    success
  }
}
```

### Azure DevOps

```bash
curl -s \
  -u ":$AZDO_PAT" \
  -X POST \
  -H "Content-Type: application/json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$PARENT_ID/comments?api-version=7.1-preview.4" \
  -d '{"text": "<tracking comment as HTML>"}'
```

Convert the tracking comment markdown to HTML (table → `<table>`, headings → `<h2>`, etc.).

### Shortcut — POST comment on parent

If the parent is an epic:

```bash
curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST \
  "https://api.app.shortcut.com/api/v3/epics/$EPIC_ID/comments" \
  -d '{"text": "<tracking comment markdown>"}'
```

If the parent is a story:

```bash
curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST \
  "https://api.app.shortcut.com/api/v3/stories/$STORY_ID/comments" \
  -d '{"text": "<tracking comment markdown>"}'
```

Shortcut accepts Markdown directly in comment text.

### Notion — POST comment on parent

```bash
curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -X POST \
  "https://api.notion.com/v1/comments" \
  -d '{"parent": {"page_id": "$PARENT_PAGE_ID"}, "rich_text": [{"type": "text", "text": {"content": "<tracking comment text>"}}]}'
```

**Notion limitation:** Comments use `rich_text` blocks, not markdown. The `rich_text` array has a 2000-character limit per text block. Split the tracking table across multiple blocks if needed.

### Tracking comment format

```markdown
## Clancy — Approved Tickets

| #   | Ticket | Title   | Size | Mode |
| --- | ------ | ------- | ---- | ---- |
| 1   | {KEY}  | {Title} | S    | AFK  |
| 2   | {KEY}  | {Title} | M    | HITL |
| 3   | {KEY}  | {Title} | M    | AFK  |

Dependencies linked: {N}
Created by Clancy on {YYYY-MM-DD}.
```

**On failure:** Warn: `Could not post tracking summary on {PARENT}. Tickets are created regardless.` Continue — best-effort.

---

## Step 11a — Remove brief label from parent

Only if a parent ticket exists AND all tickets were created successfully. Remove the brief label from the parent ticket. Best-effort — warn on failure, never stop.

Use `CLANCY_LABEL_BRIEF` from `.clancy/.env` if set, otherwise `clancy:brief`.

### GitHub

```bash
curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -X DELETE \
  "https://api.github.com/repos/$GITHUB_REPO/issues/$PARENT_NUMBER/labels/$(echo $CLANCY_LABEL_BRIEF | jq -Rr @uri)"
```

Ignore 404 (label may not be present on the parent).

### Jira

```bash
CURRENT_LABELS=$(curl -s \
  -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -H "Accept: application/json" \
  "$JIRA_BASE_URL/rest/api/3/issue/$PARENT_KEY?fields=labels" | jq -r '.fields.labels')

UPDATED_LABELS=$(echo "$CURRENT_LABELS" | jq --arg brief "$CLANCY_LABEL_BRIEF" '[.[] | select(. != $brief)]')

curl -s \
  -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -X PUT \
  -H "Content-Type: application/json" \
  "$JIRA_BASE_URL/rest/api/3/issue/$PARENT_KEY" \
  -d "{\"fields\": {\"labels\": $UPDATED_LABELS}}"
```

### Linear

```graphql
# Fetch current label IDs on the parent issue
query {
  issues(filter: { identifier: { eq: "$PARENT_KEY" } }) {
    nodes {
      id
      labels {
        nodes {
          id
          name
        }
      }
    }
  }
}

# Filter out the brief label ID, then update with remaining labelIds
mutation {
  issueUpdate(
    id: "$PARENT_ISSUE_UUID"
    input: { labelIds: [currentLabelIds, without, briefLabelId] }
  ) {
    success
  }
}
```

### Azure DevOps

```bash
# Fetch current tags, remove brief tag from semicolon-delimited string
CURRENT=$(curl -s \
  -u ":$AZDO_PAT" \
  -H "Accept: application/json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$PARENT_ID?fields=System.Tags&api-version=7.1")

curl -s \
  -u ":$AZDO_PAT" \
  -X PATCH \
  -H "Content-Type: application/json-patch+json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$PARENT_ID?api-version=7.1" \
  -d '[{"op": "replace", "path": "/fields/System.Tags", "value": "<tags without brief tag>"}]'
```

### Shortcut

```bash
# Fetch current story/epic labels, filter out brief label, update
# For stories:
STORY=$(curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  "https://api.app.shortcut.com/api/v3/stories/$PARENT_STORY_ID")

# Remove brief label from labels array, then update:
curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -X PUT \
  "https://api.app.shortcut.com/api/v3/stories/$PARENT_STORY_ID" \
  -d '{"labels": [labels_without_brief_label]}'
```

For epics, use `GET /api/v3/epics/$EPIC_ID` and `PUT /api/v3/epics/$EPIC_ID` with the same label-filtering pattern.

### Notion

```bash
# Fetch current page properties, remove brief label from multi-select
PAGE=$(curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  "https://api.notion.com/v1/pages/$PARENT_PAGE_ID")

# Update multi-select property without brief label
curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -X PATCH \
  "https://api.notion.com/v1/pages/$PARENT_PAGE_ID" \
  -d '{"properties": {"$CLANCY_NOTION_LABELS": {"multi_select": [options_without_brief_label]}}}'
```

### On failure

```
⚠️  Could not remove brief label from {PARENT_KEY}. Remove it manually if needed.
```

Continue — do not stop.

---

## Step 11b — Add plan label to parent

Only if a parent ticket exists AND all tickets were created successfully. Add the plan label to the parent ticket so it enters the planning queue. Best-effort — warn on failure, never stop.

**Crash safety:** Step 11a removes the brief label and Step 11b adds the plan label. If Step 11b fails, the parent loses its pipeline label — warn the user to add it manually.

Use `CLANCY_LABEL_PLAN` from `.clancy/.env` if set, otherwise `clancy:plan`.

### GitHub

```bash
# Ensure plan label exists
curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -X POST \
  "https://api.github.com/repos/$GITHUB_REPO/labels" \
  -d "{\"name\": \"$CLANCY_LABEL_PLAN\", \"color\": \"0075ca\"}"
# Ignore 422 (label already exists)

# Add label to parent
curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -X POST \
  "https://api.github.com/repos/$GITHUB_REPO/issues/$PARENT_NUMBER/labels" \
  -d "{\"labels\": [\"$CLANCY_LABEL_PLAN\"]}"
```

### Jira

```bash
CURRENT_LABELS=$(curl -s \
  -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -H "Accept: application/json" \
  "$JIRA_BASE_URL/rest/api/3/issue/$PARENT_KEY?fields=labels" | jq -r '.fields.labels')

UPDATED_LABELS=$(echo "$CURRENT_LABELS" | jq --arg plan "$CLANCY_LABEL_PLAN" '. + [$plan] | unique')

curl -s \
  -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -X PUT \
  -H "Content-Type: application/json" \
  "$JIRA_BASE_URL/rest/api/3/issue/$PARENT_KEY" \
  -d "{\"fields\": {\"labels\": $UPDATED_LABELS}}"
```

### Linear

```graphql
# Ensure plan label exists — check team labels, workspace labels, create if missing
mutation {
  issueLabelCreate(input: {
    teamId: "$LINEAR_TEAM_ID"
    name: "$CLANCY_LABEL_PLAN"
    color: "#0075ca"
  }) { success issueLabel { id } }
}

# Fetch current label IDs on the parent, add plan label ID
mutation {
  issueUpdate(
    id: "$PARENT_ISSUE_UUID"
    input: { labelIds: [...currentLabelIds, planLabelId] }
  ) { success }
}
```

### Azure DevOps

```bash
# Fetch current tags, append plan tag
CURRENT=$(curl -s \
  -u ":$AZDO_PAT" \
  -H "Accept: application/json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$PARENT_ID?fields=System.Tags&api-version=7.1")

# Append plan tag to semicolon-delimited string
curl -s \
  -u ":$AZDO_PAT" \
  -X PATCH \
  -H "Content-Type: application/json-patch+json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$PARENT_ID?api-version=7.1" \
  -d '[{"op": "replace", "path": "/fields/System.Tags", "value": "<existing tags>; $CLANCY_LABEL_PLAN"}]'
```

### Shortcut

```bash
# Resolve plan label ID (create if missing)
LABELS=$(curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  "https://api.app.shortcut.com/api/v3/labels")

# Find or create the plan label, get its ID
# Then add to story (merge with existing labels):
curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -X PUT \
  "https://api.app.shortcut.com/api/v3/stories/$PARENT_STORY_ID" \
  -d '{"labels": [existing_labels_plus_plan_label]}'
```

For epics, use `GET /api/v3/epics/$EPIC_ID` and `PUT /api/v3/epics/$EPIC_ID` with the same label pattern.

### Notion

```bash
# Fetch current page properties, add plan label to multi-select
PAGE=$(curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  "https://api.notion.com/v1/pages/$PARENT_PAGE_ID")

# Update multi-select property with plan label added
curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -X PATCH \
  "https://api.notion.com/v1/pages/$PARENT_PAGE_ID" \
  -d '{"properties": {"$CLANCY_NOTION_LABELS": {"multi_select": [existing_options_plus_plan_label]}}}'
```

### On failure

If adding the plan label fails, **re-add the brief label** so the ticket isn't orphaned without any pipeline label. Use the same platform-specific API calls from Step 11a (but adding instead of removing). Then warn:

```
⚠️  Could not add plan label to {PARENT_KEY}. Re-added brief label as fallback.
     Add the plan label manually so the ticket enters the planning queue.
```

Continue — do not stop.

---

## Step 12 — Display summary

Show the final result:

```
{N} tickets created under {PARENT_KEY}

  {KEY}  [{Size}] [{Mode}] {Title}
  {KEY}  [{Size}] [{Mode}] {Title}
  {KEY}  [{Size}] [{Mode}] {Title}

Dependencies linked: {N}
AFK-ready: {X} | Needs human: {Y}
Epic branch: epic/{parent-key-lowercase}

Next: run /clancy:plan to generate implementation plans.

"We've got ourselves a case."
```

If no parent:

```
{N} standalone tickets created.
  ...
Next: run /clancy:plan to generate implementation plans.

"We've got ourselves a case."
```

---

## Step 13 — Log

Append to `.clancy/progress.txt`:

```
YYYY-MM-DD HH:MM | APPROVE_BRIEF | {slug} | {N} tickets created
```

---

## Error handling reference

### Rate limiting

| Platform     | Detection                        | Response                                   |
| ------------ | -------------------------------- | ------------------------------------------ |
| GitHub       | 403 + `X-RateLimit-Remaining: 0` | Wait until `X-RateLimit-Reset`, retry once |
| Jira         | 429 + `Retry-After` header       | Wait the specified seconds, retry once     |
| Linear       | `RATELIMITED` error code         | Wait 60s, retry once                       |
| Azure DevOps | 429 + `Retry-After` header       | Wait the specified seconds, retry once     |
| Shortcut     | 429 + `Retry-After` header       | Wait the specified seconds, retry once     |
| Notion       | 429 + `Retry-After` header       | Wait the specified seconds, retry once     |

If retry also fails: stop, enter partial failure flow.

### Auth failure mid-batch

If a 401/403 occurs during ticket creation (token expired or revoked after preflight):

```
Auth failed during ticket creation. {M} of {N} created before failure.
Check credentials and re-run to resume.
```

Enter partial failure flow (Step 10).

### Timeout

| Platform     | Timeout              |
| ------------ | -------------------- |
| GitHub       | 15s per API call     |
| Jira         | 30s per API call     |
| Linear       | 30s per GraphQL call |
| Azure DevOps | 30s per API call     |
| Shortcut     | 30s per API call     |
| Notion       | 30s per API call     |

On timeout: `Request timed out. Ticket may have been created server-side. Check board before re-run.` Enter partial failure flow.

### Duplicate guard (on resume)

When resuming from a partial failure, before creating each ticket check the brief's decomposition table for an existing Ticket column entry. Additionally, scan the board for existing children of the parent with matching titles (case-insensitive exact match):

#### Jira

```bash
curl -s \
  -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -X POST \
  "$JIRA_BASE_URL/rest/api/3/search/jql" \
  -d '{"jql": "parent = $PARENT_KEY", "maxResults": 50, "fields": ["summary"]}'
```

#### GitHub

```bash
curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/$GITHUB_REPO/issues?state=open&per_page=30"
```

Filter for issues containing `Epic: #{parent_number}` in the body.

#### Linear

```graphql
query {
  issues(filter: { identifier: { eq: "$PARENT_KEY" } }) {
    nodes {
      children {
        nodes {
          id
          identifier
          title
        }
      }
    }
  }
}
```

#### Azure DevOps

```bash
# Fetch parent work item relations to find existing children
curl -s \
  -u ":$AZDO_PAT" \
  -H "Accept: application/json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$PARENT_ID?\$expand=relations&api-version=7.1"
```

Filter `relations` array for entries with `rel: "System.LinkTypes.Hierarchy-Forward"`. Extract child work item IDs from relation URLs, batch fetch titles, and compare against proposed ticket titles (case-insensitive exact match).

#### Shortcut

If the parent is an epic, fetch its stories:

```bash
curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  "https://api.app.shortcut.com/api/v3/epics/$EPIC_ID/stories"
```

Compare story `name` fields against proposed ticket titles (case-insensitive exact match).

If the parent is a story, check `story_links` for related stories and compare titles.

#### Notion

If the parent page has a `relation` property for children, query related pages:

```bash
PAGE=$(curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  "https://api.notion.com/v1/pages/$PARENT_PAGE_ID")
```

Extract page IDs from the relation property, fetch each page's title, and compare against proposed ticket titles (case-insensitive exact match).

If no relation property is configured, query the database for pages with matching titles:

```bash
curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -X POST \
  "https://api.notion.com/v1/databases/$NOTION_DATABASE_ID/query" \
  -d '{"filter": {"property": "Name", "title": {"equals": "{ticket title}"}}}'
```

If matching children found:

```
{PARENT} already has children with similar titles:
  - {KEY}: "{Title}" (matches proposed ticket #{N})

This brief may have already been approved. Continue anyway? [y/N]
```

Default: N (don't create duplicates).

---

## Notes

- The `Epic: {key}` convention is always the first line of every child ticket description across all platforms — this enables cross-platform epic completion detection by `fetchChildrenStatus`
- Mode labels (`clancy:afk` / `clancy:hitl`) are used by `/clancy:run` to decide whether to pick up a ticket autonomously or skip it for human attention
- Jira ADF construction: if complex content fails, wrap in a `codeBlock` node as fallback (matches the pattern used by `/clancy:approve-plan`)
- The `.approved` marker filename is the full brief filename with `.approved` appended (e.g. `.clancy/briefs/2026-03-14-auth-rework.md.approved`)
- Tickets are created sequentially (not in parallel) to maintain dependency ordering and respect rate limits
- The 500ms delay between ticket creations is sufficient for all platforms under normal rate limit conditions
- Dependency links use "Blocks" for Jira, `blockedBy` for Linear, `System.LinkTypes.Dependency-Reverse` for Azure DevOps, `story_links` with `blocks` verb for Shortcut, `relation` properties for Notion, and body text cross-references for GitHub
- Labels on Jira, Azure DevOps, and Notion are auto-created by the platform; on GitHub they must be pre-created or the 422 fallback handles it; on Linear and Shortcut they are looked up and auto-created if missing
- Shortcut uses `Shortcut-Token` header (not `Authorization: Bearer`). API base: `https://api.app.shortcut.com/api/v3`. Stories use `name` (not `title`), descriptions use markdown, and parent linking uses `epic_id` for epic parents or `story_links` for story parents
- Notion uses `Authorization: Bearer $NOTION_TOKEN` and `Notion-Version: 2022-06-28` headers. API base: `https://api.notion.com/v1`. Comments use `rich_text` blocks (not markdown) with a 2000-character limit per text block. Page content is blocks (not a description field). Labels use multi-select properties. The API does not support editing comments (post new instead). Parent-child relationships use `relation` properties (not native hierarchy)
- Sprint/milestone assignment is deliberately not set — this is a team planning decision
- Linear `priority: 0` means "No priority" — the team triages after creation
- Jira priority is inherited from the parent if available; Linear and GitHub do not inherit priority
