# Clancy Approve Plan Workflow

## Overview

Promote an approved Clancy plan from a ticket comment to the ticket description. The plan is appended below the existing description, never replacing it. After promotion, the ticket is transitioned to the implementation queue.

---

## Step 1 — Preflight checks

1. Check `.clancy/` exists and `.clancy/.env` is present. If not:

   ```
   .clancy/ not found. Run /clancy:init to set up Clancy first.
   ```

   Stop.

2. Source `.clancy/.env` and check board credentials are present.

---

## Step 2 — Parse argument / Resolve ticket

### If no argument provided:

1. Scan `.clancy/progress.txt` for entries matching `| PLAN |` or `| REVISED |` that have no subsequent `| APPROVE_PLAN |` for the same key.
2. Sort by timestamp ascending (oldest first).
3. If 0 found:
   ```
   No planned tickets awaiting approval. Run /clancy:plan first.
   ```
   Stop.
4. If 1+ found, auto-select the oldest. Show:
   ```
   Auto-selected [{KEY}] {Title} (planned {date}). Promote this plan? [Y/n]
   ```
   To resolve the title, fetch the ticket from the board:
   - **GitHub:** `GET /repos/$GITHUB_REPO/issues/$ISSUE_NUMBER` → use `.title`
   - **Jira:** `GET $JIRA_BASE_URL/rest/api/3/issue/$KEY?fields=summary` → use `.fields.summary`
   - **Linear:** `issues(filter: { identifier: { eq: "$KEY" } }) { nodes { title } }` → use `nodes[0].title`
   - **Azure DevOps:** `GET https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$ID?fields=System.Title&api-version=7.1` → use `.fields["System.Title"]`
   - **Shortcut:** `GET https://api.app.shortcut.com/api/v3/stories/$STORY_ID` → use `.name`
   - **Notion:** `GET https://api.notion.com/v1/pages/$PAGE_ID` → extract title from the `title` type property in `properties`
     If fetching fails, show the key without a title: `Auto-selected [{KEY}] (planned {date}). Promote? [Y/n]`
5. If user declines:
   ```
   Cancelled.
   ```
   Stop.
6. Note that the user has already confirmed — set a flag to skip the Step 4 confirmation.

### If argument provided:

Validate the key format per board (case-insensitive):

- **GitHub:** `#\d+` or bare number
- **Jira:** `[A-Za-z][A-Za-z0-9]+-\d+` (e.g. `PROJ-123` or `proj-123`)
- **Linear:** `[A-Za-z]{1,10}-\d+` (e.g. `ENG-42` or `eng-42`)
- **Azure DevOps:** `\d+` (bare number, e.g. `42` — work item IDs are always numeric)
- **Shortcut:** `[A-Za-z]{1,5}-\d+` or bare number (e.g. `SC-123` or `123` — Shortcut story IDs are numeric, prefixed identifiers are optional)
- **Notion:** UUID format (`[a-f0-9]{32}` or with dashes) or `notion-[a-f0-9]{8}` short key

If invalid format:

```
Invalid ticket key: {input}. Expected format: {board-specific example}.
```

Stop.

Proceed with that key.

---

## Step 3 — Fetch the plan comment

Detect board from `.clancy/.env` and fetch comments for the specified ticket.

### Jira

```bash
RESPONSE=$(curl -s \
  -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -H "Accept: application/json" \
  "$JIRA_BASE_URL/rest/api/3/issue/$TICKET_KEY/comment")
```

Search for the most recent comment containing an ADF heading node with text `Clancy Implementation Plan`. **Capture the comment `id`** for later editing in Step 5b.

### GitHub

First, determine the issue number from the ticket key (strip the `#` prefix if present):

```bash
RESPONSE=$(curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/$GITHUB_REPO/issues/$ISSUE_NUMBER/comments?per_page=100")
```

Search for the most recent comment body containing `## Clancy Implementation Plan`. **Capture the comment `id`** for later editing in Step 5b.

### Linear

Use the filter-based query (preferred over `issueSearch`):

```graphql
query {
  issues(filter: { identifier: { eq: "$KEY" } }) {
    nodes {
      id
      identifier
      title
      description
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

If the filter-based query returns no results, fall back to `issueSearch`:

```graphql
query {
  issueSearch(query: "$IDENTIFIER", first: 5) {
    nodes {
      id
      identifier
      title
      description
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

**Important:** `issueSearch` is a fuzzy text search. After fetching results, verify the returned issue's `identifier` field exactly matches the provided key (case-insensitive). If no exact match is found in the results, report: `Issue {KEY} not found. Check the identifier and try again.`

Search the comments for the most recent one containing `## Clancy Implementation Plan`. **Capture the comment `id`** and the existing comment `body` for later editing in Step 5b. Also capture the issue's internal `id` (UUID) for transitions in Step 6.

### Azure DevOps

Fetch work item comments:

```bash
RESPONSE=$(curl -s \
  -u ":$AZDO_PAT" \
  -H "Accept: application/json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$WORK_ITEM_ID/comments?api-version=7.1-preview.4")
```

Search `comments` array for the most recent comment where the `text` field (HTML) contains `Clancy Implementation Plan` (as an `<h2>` heading or plain text). **Capture the comment `id`** for later editing in Step 5b. Also fetch the work item title and description:

```bash
WORK_ITEM=$(curl -s \
  -u ":$AZDO_PAT" \
  -H "Accept: application/json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$WORK_ITEM_ID?fields=System.Title,System.Description&api-version=7.1")
```

### Shortcut

Fetch story comments:

```bash
RESPONSE=$(curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  "https://api.app.shortcut.com/api/v3/stories/$STORY_ID/comments")
```

Search for the most recent comment where `text` contains `## Clancy Implementation Plan`. **Capture the comment `id`** for later editing in Step 5b. Also fetch the story for its title and description:

```bash
STORY=$(curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  "https://api.app.shortcut.com/api/v3/stories/$STORY_ID")
```

### Notion

Fetch page comments:

```bash
RESPONSE=$(curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  "https://api.notion.com/v1/comments?block_id=$PAGE_ID")
```

Search `results` array for the most recent comment where `rich_text` content contains `Clancy Implementation Plan`. **Capture the comment `id`** for later reference in Step 5b. Also fetch the page for its title and content:

```bash
PAGE=$(curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  "https://api.notion.com/v1/pages/$PAGE_ID")
```

**Notion limitation:** Comments use `rich_text` arrays. Search each comment's `rich_text[].text.content` for the plan marker.

If no plan comment is found:

```
No Clancy plan found for {KEY}. Run /clancy:plan first.
```

Stop.

---

## Step 3b — Check for existing plan in description

Before confirming, check if the ticket description already contains `## Clancy Implementation Plan`.

If it does:

```
This ticket's description already contains a Clancy plan.
Continuing will add a duplicate.

[1] Continue anyway
[2] Cancel
```

If the user picks [2], stop: `Cancelled. No changes made.`

---

## Step 4 — Confirm

**If the user already confirmed via auto-select in Step 2, SKIP this step entirely** (avoid double-confirmation).

**AFK mode:** If running in AFK mode (`--afk` flag or `CLANCY_MODE=afk`), skip the confirmation prompt and auto-confirm. Display the summary for logging purposes but proceed without waiting for input.

Display a summary and ask for confirmation:

```
Clancy — Approve Plan

[{KEY}] {Title}
Size: {S/M/L} | {N} affected files
Planned: {date from plan}

Promote this plan to the ticket description? [Y/n]
```

If the user declines (interactive only), stop:

```
Cancelled. No changes made.
```

---

## Step 5 — Update ticket description

Append the plan below the existing description with a separator. Never overwrite the original description.

The updated description follows this format:

```
{existing description}

---

{full plan content}
```

### Jira — PUT issue

Fetch the current description first:

```bash
CURRENT=$(curl -s \
  -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -H "Accept: application/json" \
  "$JIRA_BASE_URL/rest/api/3/issue/$TICKET_KEY?fields=description")
```

Merge the existing ADF description with a `rule` node (horizontal rule) and the plan content as new ADF nodes. Then update:

```bash
curl -s \
  -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -X PUT \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  "$JIRA_BASE_URL/rest/api/3/issue/$TICKET_KEY" \
  -d '{"fields": {"description": <merged ADF>}}'
```

If ADF construction fails for the plan content, wrap the plan in a `codeBlock` node as fallback.

### GitHub — PATCH issue

Fetch the current body:

```bash
CURRENT=$(curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/$GITHUB_REPO/issues/$ISSUE_NUMBER")
```

Append the plan:

```bash
curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -X PATCH \
  "https://api.github.com/repos/$GITHUB_REPO/issues/$ISSUE_NUMBER" \
  -d '{"body": "<existing body>\n\n---\n\n<plan>"}'
```

### Linear — issueUpdate mutation

Fetch the current description:

```graphql
query {
  issue(id: "$ISSUE_ID") {
    description
  }
}
```

Update with appended plan:

```graphql
mutation {
  issueUpdate(
    id: "$ISSUE_ID"
    input: { description: "<existing>\n\n---\n\n<plan>" }
  ) {
    success
  }
}
```

### Azure DevOps — PATCH work item

Fetch the current description:

```bash
CURRENT=$(curl -s \
  -u ":$AZDO_PAT" \
  -H "Accept: application/json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$WORK_ITEM_ID?fields=System.Description&api-version=7.1")
```

Azure DevOps descriptions are **HTML**. Append the plan (converted to HTML) with a horizontal rule separator:

```bash
curl -s \
  -u ":$AZDO_PAT" \
  -X PATCH \
  -H "Content-Type: application/json-patch+json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$WORK_ITEM_ID?api-version=7.1" \
  -d '[{"op": "replace", "path": "/fields/System.Description", "value": "<existing HTML>\n<hr>\n<plan as HTML>"}]'
```

Convert the plan markdown to HTML using the same conversion rules as Step 5 in plan.md (headings, lists, tables, bold, code → HTML equivalents). If HTML construction is too complex, wrap the plan in `<pre>` tags as fallback.

### Shortcut — PUT story

Fetch the current description:

```bash
CURRENT=$(curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  "https://api.app.shortcut.com/api/v3/stories/$STORY_ID")
```

Append the plan (Shortcut descriptions use markdown):

```bash
curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -X PUT \
  "https://api.app.shortcut.com/api/v3/stories/$STORY_ID" \
  -d '{"description": "<existing description>\n\n---\n\n<plan>"}'
```

### Notion — Append blocks to page

Notion page "descriptions" are stored as **child blocks**, not a single text property. To append the plan, add new blocks to the page:

```bash
curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -X PATCH \
  "https://api.notion.com/v1/blocks/$PAGE_ID/children" \
  -d '{"children": [
    {"type": "divider", "divider": {}},
    {"type": "heading_2", "heading_2": {"rich_text": [{"type": "text", "text": {"content": "Clancy Implementation Plan"}}]}},
    {"type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": "<plan section text>"}}]}}
  ]}'
```

Convert the plan into Notion block format:

- `## Heading` → `heading_2` block
- `### Heading` → `heading_3` block
- Plain text paragraphs → `paragraph` block
- `- bullet` → `bulleted_list_item` block
- `- [ ] checkbox` → `to_do` block
- Tables → not natively supported as blocks; use `paragraph` blocks with monospace formatting, or split into individual `paragraph` blocks per row
- Code blocks → `code` block with `language: "markdown"`

**Notion limitation:** Each `rich_text` block has a **2000-character limit**. Split long sections across multiple blocks. The `children` array can contain up to **100 blocks** per request — if the plan is very large, make multiple PATCH calls.

**Notion limitation:** Unlike other boards, this appends to the page body (not the description property). The plan content will appear at the bottom of the page, after existing content, separated by a divider.

---

## Step 5b — Edit plan comment (approval note)

After updating the description, edit the original plan comment to prepend an approval note. This is **best-effort** — warn on failure, continue.

### GitHub

```bash
curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Content-Type: application/json" \
  -X PATCH \
  "https://api.github.com/repos/$GITHUB_REPO/issues/comments/$COMMENT_ID" \
  -d '{"body": "> **Plan approved and promoted to description** -- {YYYY-MM-DD}\n\n{existing_comment_body}"}'
```

### Jira

```bash
curl -s \
  -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -X PUT \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  "$JIRA_BASE_URL/rest/api/3/issue/$TICKET_KEY/comment/$COMMENT_ID" \
  -d '{
    "body": {
      "version": 1,
      "type": "doc",
      "content": [
        {"type": "paragraph", "content": [
          {"type": "text", "text": "Plan approved and promoted to description -- {YYYY-MM-DD}.",
           "marks": [{"type": "strong"}]}
        ]},
        <...existing ADF content nodes...>
      ]
    }
  }'
```

### Linear

```graphql
mutation {
  commentUpdate(
    id: "$COMMENT_ID"
    input: {
      body: "> **Plan approved and promoted to description** -- {YYYY-MM-DD}\n\n{existing_comment_body}"
    }
  ) {
    success
  }
}
```

### Azure DevOps

```bash
curl -s \
  -u ":$AZDO_PAT" \
  -X PATCH \
  -H "Content-Type: application/json" \
  "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$WORK_ITEM_ID/comments/$COMMENT_ID?api-version=7.1-preview.4" \
  -d '{"text": "<p><strong>Plan approved and promoted to description -- {YYYY-MM-DD}.</strong></p><existing HTML comment>"}'
```

### Shortcut

```bash
curl -s \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -X PUT \
  "https://api.app.shortcut.com/api/v3/stories/$STORY_ID/comments/$COMMENT_ID" \
  -d '{"text": "> **Plan approved and promoted to description** -- {YYYY-MM-DD}\n\n{existing_comment_text}"}'
```

### Notion

**Notion limitation:** The Notion API does **not support editing comments**. There is no PATCH/PUT endpoint for comments. Instead, post a new comment with the approval note:

```bash
curl -s \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -X POST \
  "https://api.notion.com/v1/comments" \
  -d '{"parent": {"page_id": "$PAGE_ID"}, "rich_text": [{"type": "text", "text": {"content": "Plan approved and promoted to page content — {YYYY-MM-DD}."}, "annotations": {"bold": true}}]}'
```

This posts a new comment rather than editing the original plan comment. The approval note references the plan being promoted to the page body (not description, since Notion uses blocks).

On failure for any platform:

```
Could not update plan comment. The plan is still promoted to the description.
```

---

## Step 6 — Post-approval label transition

Transition the ticket from the planning queue to the implementation queue via pipeline labels. This is **best-effort** — warn on failure, continue.

**Crash safety:** Add the new label BEFORE removing the old one. A ticket briefly has two labels (harmless) rather than zero labels (ticket lost).

**This label transition is mandatory — always apply and remove.** Use `CLANCY_LABEL_BUILD` from `.clancy/.env` if set, otherwise `clancy:build`. Use `CLANCY_LABEL_PLAN` from `.clancy/.env` if set, otherwise `clancy:plan`. Ensure the build label exists on the board (create if missing), add it to the ticket, then remove the plan label.

**If build label creation fails** (GitHub/Linear/Shortcut require explicit creation): warn and **do not remove the plan label**. The ticket must keep at least one pipeline label — removing the plan label without a build label would orphan the ticket from both queues.

### GitHub

1. **Add build label** (ensure it exists first):

   ```bash
   # Ensure label exists (ignore 422 = already exists)
   curl -s \
     -H "Authorization: Bearer $GITHUB_TOKEN" \
     -H "Accept: application/vnd.github+json" \
     -H "X-GitHub-Api-Version: 2022-11-28" \
     -H "Content-Type: application/json" \
     -X POST \
     "https://api.github.com/repos/$GITHUB_REPO/labels" \
     -d '{"name": "$CLANCY_LABEL_BUILD", "color": "0075ca"}'

   # Add to issue
   curl -s \
     -H "Authorization: Bearer $GITHUB_TOKEN" \
     -H "Accept: application/vnd.github+json" \
     -H "X-GitHub-Api-Version: 2022-11-28" \
     -H "Content-Type: application/json" \
     -X POST \
     "https://api.github.com/repos/$GITHUB_REPO/issues/$ISSUE_NUMBER/labels" \
     -d '{"labels": ["$CLANCY_LABEL_BUILD"]}'
   ```

2. **Remove plan label:**
   ```bash
   curl -s \
     -H "Authorization: Bearer $GITHUB_TOKEN" \
     -H "Accept: application/vnd.github+json" \
     -H "X-GitHub-Api-Version: 2022-11-28" \
     -X DELETE \
     "https://api.github.com/repos/$GITHUB_REPO/issues/$ISSUE_NUMBER/labels/$(echo $CLANCY_LABEL_PLAN | jq -Rr @uri)"
   ```
   Ignore 404 (label not on issue).

### Jira

1. **Add build label** (Jira auto-creates labels):

   ```bash
   # Fetch current labels
   CURRENT_LABELS=$(curl -s \
     -u "$JIRA_USER:$JIRA_API_TOKEN" \
     -H "Accept: application/json" \
     "$JIRA_BASE_URL/rest/api/3/issue/$TICKET_KEY?fields=labels" | jq -r '.fields.labels')

   # Add build label
   UPDATED_LABELS=$(echo "$CURRENT_LABELS" | jq --arg build "$CLANCY_LABEL_BUILD" '. + [$build] | unique')

   curl -s \
     -u "$JIRA_USER:$JIRA_API_TOKEN" \
     -X PUT \
     -H "Content-Type: application/json" \
     "$JIRA_BASE_URL/rest/api/3/issue/$TICKET_KEY" \
     -d "{\"fields\": {\"labels\": $UPDATED_LABELS}}"
   ```

2. **Remove plan label:**

   ```bash
   # Re-fetch labels (may have changed), remove plan label
   CURRENT_LABELS=$(curl -s \
     -u "$JIRA_USER:$JIRA_API_TOKEN" \
     -H "Accept: application/json" \
     "$JIRA_BASE_URL/rest/api/3/issue/$TICKET_KEY?fields=labels" | jq -r '.fields.labels')

   UPDATED_LABELS=$(echo "$CURRENT_LABELS" | jq --arg plan "$CLANCY_LABEL_PLAN" '[.[] | select(. != $plan)]')

   curl -s \
     -u "$JIRA_USER:$JIRA_API_TOKEN" \
     -X PUT \
     -H "Content-Type: application/json" \
     "$JIRA_BASE_URL/rest/api/3/issue/$TICKET_KEY" \
     -d "{\"fields\": {\"labels\": $UPDATED_LABELS}}"
   ```

3. **Status transition** (only if `CLANCY_STATUS_PLANNED` is set — skip if unset):

   ```bash
   # Fetch transitions
   curl -s \
     -u "$JIRA_USER:$JIRA_API_TOKEN" \
     -H "Accept: application/json" \
     "$JIRA_BASE_URL/rest/api/3/issue/$TICKET_KEY/transitions"

   # Find matching transition and execute
   curl -s \
     -u "$JIRA_USER:$JIRA_API_TOKEN" \
     -X POST \
     -H "Content-Type: application/json" \
     "$JIRA_BASE_URL/rest/api/3/issue/$TICKET_KEY/transitions" \
     -d '{"transition": {"id": "$TRANSITION_ID"}}'
   ```

On failure:

```
Could not transition ticket. Move it manually to your implementation queue.
```

### Linear

1. **Add build label** (ensure it exists, then add):

   ```graphql
   # Ensure label exists — check team labels, workspace labels, create if missing
   mutation {
     issueLabelCreate(input: {
       teamId: "$LINEAR_TEAM_ID"
       name: "$CLANCY_LABEL_BUILD"
       color: "#0075ca"
     }) { success issueLabel { id } }
   }

   # Fetch current label IDs on the issue, add build label ID
   mutation {
     issueUpdate(
       id: "$ISSUE_UUID"
       input: { labelIds: [...currentLabelIds, buildLabelId] }
     ) { success }
   }
   ```

2. **Remove plan label:**

   ```graphql
   # Fetch current label IDs, filter out plan label ID
   mutation {
     issueUpdate(
       id: "$ISSUE_UUID"
       input: { labelIds: [currentLabelIds, without, planLabelId] }
     ) {
       success
     }
   }
   ```

3. **State transition** (always):

   ```graphql
   # Resolve "unstarted" state
   query {
     workflowStates(
       filter: {
         team: { id: { eq: "$LINEAR_TEAM_ID" } }
         type: { eq: "unstarted" }
       }
     ) {
       nodes {
         id
         name
       }
     }
   }

   # Transition
   mutation {
     issueUpdate(id: "$ISSUE_UUID", input: { stateId: "$UNSTARTED_STATE_ID" }) {
       success
     }
   }
   ```

   If no `unstarted` state found: warn, skip transition.

### Azure DevOps

Azure DevOps uses **tags** (semicolon-delimited string field) instead of labels, and **board columns/states** for transitions.

1. **Add build tag:**

   ```bash
   # Fetch current tags
   CURRENT=$(curl -s \
     -u ":$AZDO_PAT" \
     -H "Accept: application/json" \
     "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$WORK_ITEM_ID?fields=System.Tags&api-version=7.1")

   # Append build tag (semicolon-delimited)
   # If existing tags are "clancy:plan; bug-fix", new value is "clancy:plan; bug-fix; clancy:build"
   curl -s \
     -u ":$AZDO_PAT" \
     -X PATCH \
     -H "Content-Type: application/json-patch+json" \
     "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$WORK_ITEM_ID?api-version=7.1" \
     -d '[{"op": "replace", "path": "/fields/System.Tags", "value": "<existing tags>; $CLANCY_LABEL_BUILD"}]'
   ```

2. **Remove plan tag:**

   ```bash
   # Re-fetch tags, remove plan tag from the semicolon-delimited string
   # E.g., "clancy:plan; bug-fix; clancy:build" → "bug-fix; clancy:build"
   curl -s \
     -u ":$AZDO_PAT" \
     -X PATCH \
     -H "Content-Type: application/json-patch+json" \
     "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$WORK_ITEM_ID?api-version=7.1" \
     -d '[{"op": "replace", "path": "/fields/System.Tags", "value": "<tags without plan tag>"}]'
   ```

3. **State transition** (only if `CLANCY_STATUS_PLANNED` is set — skip if unset):

   ```bash
   curl -s \
     -u ":$AZDO_PAT" \
     -X PATCH \
     -H "Content-Type: application/json-patch+json" \
     "https://dev.azure.com/$AZDO_ORG/$AZDO_PROJECT/_apis/wit/workitems/$WORK_ITEM_ID?api-version=7.1" \
     -d '[{"op": "replace", "path": "/fields/System.State", "value": "$CLANCY_STATUS_PLANNED"}]'
   ```

### Shortcut

Shortcut uses **labels** and **workflow state transitions**.

1. **Add build label:**

   ```bash
   # Resolve build label ID (create if missing)
   LABELS=$(curl -s \
     -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
     "https://api.app.shortcut.com/api/v3/labels")

   # Find or create the build label, get its ID
   # Then add to story:
   curl -s \
     -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
     -H "Content-Type: application/json" \
     -X PUT \
     "https://api.app.shortcut.com/api/v3/stories/$STORY_ID" \
     -d '{"labels": [{"name": "$CLANCY_LABEL_BUILD"}, ...existing_labels]}'
   ```

2. **Remove plan label:**

   ```bash
   # Fetch current story labels, filter out plan label, update
   curl -s \
     -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
     -H "Content-Type: application/json" \
     -X PUT \
     "https://api.app.shortcut.com/api/v3/stories/$STORY_ID" \
     -d '{"labels": [labels_without_plan_label]}'
   ```

3. **Workflow state transition:**

   ```bash
   # Resolve the "Unstarted" or "Ready for Development" state ID from workflows
   WORKFLOWS=$(curl -s \
     -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
     "https://api.app.shortcut.com/api/v3/workflows")

   # Find state with type "unstarted", get its ID
   curl -s \
     -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
     -H "Content-Type: application/json" \
     -X PUT \
     "https://api.app.shortcut.com/api/v3/stories/$STORY_ID" \
     -d '{"workflow_state_id": $UNSTARTED_STATE_ID}'
   ```

   If no suitable state found: warn, skip transition.

### Notion

Notion uses **multi-select properties** for labels and **status properties** for transitions.

1. **Add build label** (add to multi-select property):

   ```bash
   # Fetch current page properties
   PAGE=$(curl -s \
     -H "Authorization: Bearer $NOTION_TOKEN" \
     -H "Notion-Version: 2022-06-28" \
     "https://api.notion.com/v1/pages/$PAGE_ID")

   # Update multi-select property to include build label
   curl -s \
     -H "Authorization: Bearer $NOTION_TOKEN" \
     -H "Notion-Version: 2022-06-28" \
     -X PATCH \
     "https://api.notion.com/v1/pages/$PAGE_ID" \
     -d '{"properties": {"$CLANCY_NOTION_LABELS": {"multi_select": [existing_options, {"name": "$CLANCY_LABEL_BUILD"}]}}}'
   ```

2. **Remove plan label** (update multi-select without plan label):

   ```bash
   curl -s \
     -H "Authorization: Bearer $NOTION_TOKEN" \
     -H "Notion-Version: 2022-06-28" \
     -X PATCH \
     "https://api.notion.com/v1/pages/$PAGE_ID" \
     -d '{"properties": {"$CLANCY_NOTION_LABELS": {"multi_select": [options_without_plan_label]}}}'
   ```

3. **Status transition** (only if `CLANCY_STATUS_PLANNED` is set):

   ```bash
   curl -s \
     -H "Authorization: Bearer $NOTION_TOKEN" \
     -H "Notion-Version: 2022-06-28" \
     -X PATCH \
     "https://api.notion.com/v1/pages/$PAGE_ID" \
     -d '{"properties": {"$CLANCY_NOTION_STATUS": {"status": {"name": "$CLANCY_STATUS_PLANNED"}}}}'
   ```

On failure:

```
Could not transition ticket. Move it manually to your implementation queue.
```

---

## Step 7 — Confirm and log

On success, display a board-specific message:

**GitHub:**

```
Plan promoted. Label swapped: {CLANCY_LABEL_PLAN} → {CLANCY_LABEL_BUILD}. Ready for /clancy:implement.

"Book 'em, Lou." — The ticket is ready for /clancy:implement.
```

**Jira (with transition):**

```
Plan promoted. Ticket transitioned to {CLANCY_STATUS_PLANNED}.

"Book 'em, Lou." -- The ticket is ready for /clancy:implement.
```

**Jira (no transition configured):**

```
Plan promoted. Move [{KEY}] to your implementation queue for /clancy:implement.

"Book 'em, Lou." -- The ticket is ready for /clancy:implement.
```

**Linear:**

```
Plan promoted. Moved to unstarted. Ready for /clancy:implement.

"Book 'em, Lou." -- The ticket is ready for /clancy:implement.
```

**Azure DevOps (with transition):**

```
Plan promoted. Work item transitioned to {CLANCY_STATUS_PLANNED}.

"Book 'em, Lou." -- The ticket is ready for /clancy:implement.
```

**Azure DevOps (no transition configured):**

```
Plan promoted. Move work item {ID} to your implementation queue for /clancy:implement.

"Book 'em, Lou." -- The ticket is ready for /clancy:implement.
```

**Shortcut:**

```
Plan promoted. Moved to unstarted. Ready for /clancy:implement.

"Book 'em, Lou." -- The ticket is ready for /clancy:implement.
```

**Notion (with transition):**

```
Plan promoted to page content. Status updated to {CLANCY_STATUS_PLANNED}.

"Book 'em, Lou." -- The ticket is ready for /clancy:implement.
```

**Notion (no transition configured):**

```
Plan promoted to page content. Move the page to your implementation queue for /clancy:implement.

"Book 'em, Lou." -- The ticket is ready for /clancy:implement.
```

Append to `.clancy/progress.txt`:

```
YYYY-MM-DD HH:MM | {KEY} | APPROVE_PLAN | —
```

On failure:

```
Failed to update description for [{KEY}]. Check your board permissions.
```

---

## Notes

- This command only appends -- it never overwrites the existing ticket description
- If the ticket has multiple plan comments, the most recent one is used
- The plan content is taken verbatim from the comment -- no regeneration
- Step 3b checks for existing plans in the description to prevent accidental duplication
- The ticket key is case-insensitive -- accept `PROJ-123`, `proj-123`, or `#123` (GitHub)
- Step 5b edits the plan comment with an approval note -- this is best-effort and does not block the workflow
- Step 6 transitions the ticket to the implementation queue -- this is best-effort and board-specific
- The `## Clancy Implementation Plan` marker in comments is used by both `/clancy:plan` (to detect existing plans) and `/clancy:approve-plan` (to find the plan to promote)
