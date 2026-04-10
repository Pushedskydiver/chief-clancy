# Board Setup Workflow

## Overview

Configure board credentials so `/clancy:dev` can fetch tickets and execute them. This workflow collects the minimum credentials needed for board access — no pipeline configuration, no role settings, no iteration limits.

Credentials are stored in `.clancy/.env` in the current project directory. They are per-project, not global.

---

## Step 1 — Preflight checks

### 1. Check for full pipeline

Check if `.clancy/clancy-implement.js` exists in the project root.

If present, the full Clancy pipeline is installed. Show:

```
Full Clancy pipeline detected. Use /clancy:settings to manage board credentials.
```

Stop. Do not proceed with standalone board setup.

### 2. Check for existing credentials

Check if `.clancy/.env` exists and contains board credentials (any of: `JIRA_BASE_URL`, `GITHUB_TOKEN`, `LINEAR_API_KEY`, `SHORTCUT_API_TOKEN`, `NOTION_TOKEN`, `AZDO_ORG`, `AZDO_PAT`, `AZDO_PROJECT`).

If board credentials are found, show:

```
Existing board credentials found in .clancy/.env.

[1] Reconfigure (replace current board)
[2] Cancel
```

If [2]: stop.
If [1]: continue to Step 2. The existing `.clancy/.env` will be updated (board-specific vars replaced, other vars preserved).

If `.clancy/.env` does not exist, or exists but has no board credentials: continue to Step 2.

---

## Step 2 — Board selection

Output:

```
Which board are you using?

[1] Jira
[2] GitHub Issues
[3] Linear
[4] Shortcut
[5] Notion
[6] Azure DevOps
[7] My board isn't listed
```

If the user selects [7], show:

```
Clancy currently supports Jira, GitHub Issues, Linear, Shortcut, Notion, and Azure DevOps.

Your board isn't supported yet — open an issue:
  github.com/Pushedskydiver/chief-clancy/issues

/clancy:dev requires a supported board for ticket fetching.
For the full pipeline with all boards: npx chief-clancy
```

Stop.

---

## Step 3 — Credential collection

Ask each question individually and wait for an answer before moving to the next.

### Jira

1. `What's your Jira base URL? (e.g. https://your-org.atlassian.net)`
2. `What's your Jira project key? (e.g. PROJ)`
3. `What email address do you use to log in to Atlassian?`
4. `Paste your Jira API token: (create one at id.atlassian.com/manage-profile/security/api-tokens)`

Store as `JIRA_BASE_URL`, `JIRA_PROJECT_KEY`, `JIRA_USER`, `JIRA_API_TOKEN`.

### GitHub Issues

1. `What's your GitHub repo? (owner/name, e.g. acme/my-app)`
2. `Paste your GitHub personal access token: (needs repo scope)`

Store as `GITHUB_REPO`, `GITHUB_TOKEN`.

After collecting credentials, show:

```
Note: Clancy only picks up GitHub Issues that have the "clancy" label applied.
Add this label to any issue you want Clancy to execute.
```

### Linear

1. `Paste your Linear API key: (create one at linear.app/settings/api)`
2. After verifying the API key (Step 4), auto-detect teams by querying `{ teams { nodes { id name } } }`.
   - If exactly 1 team: use it automatically. Show `Using team: {name} ({id})`.
   - If 2+ teams: show a numbered list and let the user pick.
   - If the query fails or returns no teams: fall back to asking manually: `What's your Linear team ID? (find it at linear.app/settings/teams — click your team, copy the ID from the URL)`

Store as `LINEAR_API_KEY`, `LINEAR_TEAM_ID`.

### Shortcut

1. `Paste your Shortcut API token: (create one at app.shortcut.com/settings/account/api-tokens)`

Store as `SHORTCUT_API_TOKEN`.

### Notion

1. `Paste your Notion integration token: (create one at notion.so/my-integrations)`
2. `What's your Notion database ID? (the 32-character hex string in your database URL)`

Store as `NOTION_TOKEN`, `NOTION_DATABASE_ID`.

### Azure DevOps

1. `What's your Azure DevOps organisation name? (e.g. your-org)`
2. `What's your Azure DevOps project name?`
3. `Paste your Azure DevOps personal access token: (needs Work Items Read & Write scope)`

Store as `AZDO_ORG`, `AZDO_PROJECT`, `AZDO_PAT`.

---

## Step 4 — Credential verification

After collecting all credentials for the chosen board, verify the connection before writing them.

### Jira

Call `GET {JIRA_BASE_URL}/rest/api/3/project/{JIRA_PROJECT_KEY}` with basic auth (`{JIRA_USER}:{JIRA_API_TOKEN}` base64-encoded in the `Authorization: Basic` header).

On success (HTTP 200):

```
✅ Jira connected — project {JIRA_PROJECT_KEY} reachable.
```

### GitHub Issues

Call `GET https://api.github.com/repos/{GITHUB_REPO}` with `Authorization: Bearer {GITHUB_TOKEN}` and `X-GitHub-Api-Version: 2022-11-28`.

On success (HTTP 200):

```
✅ GitHub connected — {GITHUB_REPO} reachable.
```

### Linear

Call `POST https://api.linear.app/graphql` with `Authorization: {LINEAR_API_KEY}` (no Bearer prefix) and body `{"query": "{ viewer { id name } }"}`.

On success (HTTP 200 with `data.viewer`):

```
✅ Linear connected — {viewer.name}.
```

### Shortcut

Call `GET https://api.app.shortcut.com/api/v3/member-info` with `Shortcut-Token: {SHORTCUT_API_TOKEN}`.

On success (HTTP 200):

```
✅ Shortcut connected.
```

### Notion

Call `GET https://api.notion.com/v1/databases/{NOTION_DATABASE_ID}` with `Authorization: Bearer {NOTION_TOKEN}` and `Notion-Version: 2022-06-28`.

On success (HTTP 200):

```
✅ Notion connected — database reachable.
```

### Azure DevOps

Call `GET https://dev.azure.com/{AZDO_ORG}/{AZDO_PROJECT}/_apis/wit/workitemtypes?api-version=7.1` with basic auth (empty user, `AZDO_PAT` as password).

On success (HTTP 200):

```
✅ Azure DevOps connected — {AZDO_PROJECT} reachable.
```

### On failure (any board)

```
❌ Couldn't connect to {board} (HTTP {status}).
Check your credentials.

[1] Re-enter credentials
[2] Skip verification (save anyway)
[3] Cancel
```

If [1]: go back to Step 3 for that board.
If [2]: save the unverified credentials and continue to Step 5.
If [3]: stop without saving.

Never silently continue with unverified credentials — the user must explicitly choose.

---

## Step 5 — Detect base branch

Auto-detect the default branch:

```bash
BASE_BRANCH_REF="$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null)"
echo "${BASE_BRANCH_REF#refs/remotes/origin/}"
```

If detection succeeds and the branch is `main` or `master`: use it silently. Store as `CLANCY_BASE_BRANCH`.

If detection fails or returns an unexpected branch name, ask:

```
What's your base branch? [main]
```

---

## Step 6 — Write credentials

### Create directory

Create `.clancy/` directory if it does not exist.

### Write `.clancy/.env`

If `.clancy/.env` already exists (reconfigure path from Step 1, or exists with no board credentials):

- Preserve all existing lines (comments, blank lines, non-board vars)
- Remove any existing board-specific env vars for ALL boards (not just the new one). Board vars to remove:
  - Jira: `JIRA_BASE_URL`, `JIRA_PROJECT_KEY`, `JIRA_USER`, `JIRA_API_TOKEN`, `CLANCY_JQL_STATUS`, `CLANCY_JQL_SPRINT`
  - GitHub: `GITHUB_REPO`, `GITHUB_TOKEN`
  - Linear: `LINEAR_API_KEY`, `LINEAR_TEAM_ID`
  - Shortcut: `SHORTCUT_API_TOKEN`, `SHORTCUT_WORKFLOW`
  - Notion: `NOTION_TOKEN`, `NOTION_DATABASE_ID`, `CLANCY_NOTION_STATUS`, `CLANCY_NOTION_ASSIGNEE`, `CLANCY_NOTION_LABELS`, `CLANCY_NOTION_PARENT`, `CLANCY_NOTION_TODO`
  - Azure DevOps: `AZDO_ORG`, `AZDO_PROJECT`, `AZDO_PAT`, `CLANCY_AZDO_WIT`, `CLANCY_AZDO_STATUS`
- Preserve all other lines (comments, blank lines, non-board vars like `CLANCY_BASE_BRANCH`)
- Append the new board's credentials at the end
- Update `CLANCY_BASE_BRANCH` if it exists, or append it

If `.clancy/.env` does not exist, write a new file:

```
# Clancy — Board credentials
# Configured by @chief-clancy/dev
# Do not commit this file to version control.

{BOARD_CREDENTIALS}

CLANCY_BASE_BRANCH={branch}
```

Where `{BOARD_CREDENTIALS}` is the board-specific key=value pairs collected in Step 3. Wrap values containing spaces in double quotes.

### Check .gitignore

Check if `.gitignore` exists and contains `.clancy/.env` (or a pattern that covers it, like `.clancy/` or `*.env`).

If not covered, show:

```
⚠️  Add .clancy/.env to your .gitignore to keep credentials out of version control:

  echo '.clancy/.env' >> .gitignore
```

---

## Step 7 — Completion

Show the board-specific success message:

### Jira

```
Board credentials configured for Jira ({JIRA_PROJECT_KEY}).

You can now execute Jira tickets:
  /clancy:dev PROJ-123

Credentials are stored in .clancy/.env (this project only).
To reconfigure: /clancy:board-setup
For the full pipeline: npx chief-clancy
```

### GitHub Issues

```
Board credentials configured for GitHub Issues ({GITHUB_REPO}).

You can now execute GitHub issues:
  /clancy:dev #42

Credentials are stored in .clancy/.env (this project only).
To reconfigure: /clancy:board-setup
For the full pipeline: npx chief-clancy
```

### Linear

```
Board credentials configured for Linear.

You can now execute Linear issues:
  /clancy:dev ENG-42

Credentials are stored in .clancy/.env (this project only).
To reconfigure: /clancy:board-setup
For the full pipeline: npx chief-clancy
```

### Shortcut

```
Board credentials configured for Shortcut.

You can now execute Shortcut stories:
  /clancy:dev SC-123

Credentials are stored in .clancy/.env (this project only).
To reconfigure: /clancy:board-setup
For the full pipeline: npx chief-clancy
```

### Notion

```
Board credentials configured for Notion.

You can now execute Notion pages:
  /clancy:dev notion-XXXXXXXX

Credentials are stored in .clancy/.env (this project only).
To reconfigure: /clancy:board-setup
For the full pipeline: npx chief-clancy
```

### Azure DevOps

```
Board credentials configured for Azure DevOps ({AZDO_PROJECT}).

You can now execute Azure DevOps work items:
  /clancy:dev 42

Credentials are stored in .clancy/.env (this project only).
To reconfigure: /clancy:board-setup
For the full pipeline: npx chief-clancy
```
