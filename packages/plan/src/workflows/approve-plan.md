# Clancy Approve Plan Workflow

## Overview

Approve a Clancy implementation plan. Behaviour depends on the install context:

- **Standalone mode** (no `.clancy/.env`): write a local `.clancy/plans/{stem}.approved` marker file with the plan's SHA-256 and approval timestamp. The marker is the gate any plan-implementing tool checks before applying changes (a dedicated `/clancy:implement-from` slash command is deferred until `@chief-clancy/dev` is extracted; users in the meantime ask Claude Code to apply the plan via natural-language instruction or install the full pipeline)
- **Standalone+board mode** (`.clancy/.env` present, no full pipeline): with a board ticket key, run the existing comment-to-description transport flow; with a plan-file stem, write the local marker and optionally push it to the source board ticket as a comment
- **Terminal mode** (full pipeline installed): existing behaviour — promote an approved plan from a ticket comment to the ticket description and transition the ticket to the implementation queue

---

## Step 1 — Preflight checks

### 1. Detect installation context

Check for `.clancy/.env`:

- **Absent** → **standalone mode**. No board credentials. Board ticket arguments are blocked; only plan-file stems are accepted
- **Present** → continue to `.clancy/clancy-implement.js` check below

If `.clancy/.env` is present, check for `.clancy/clancy-implement.js`:

- **Present** → **terminal mode**. Full Clancy pipeline installed
- **Absent** → **standalone+board mode**. Board credentials available via `/clancy:board-setup`. Board ticket arguments work via the existing transport flow. Plan-file stems write the local marker

### 2. Terminal-mode preflight (skip in standalone mode and standalone+board mode)

If in **terminal mode** (`.clancy/.env` present AND `.clancy/clancy-implement.js` present):

a. Source `.clancy/.env` and check board credentials are present.

b. Check `CLANCY_ROLES` includes `planner` (or env var is unset, which indicates a global install where all roles are available). If `CLANCY_ROLES` is set but does not include `planner`:

```
The Planner role is not enabled. Add "planner" to CLANCY_ROLES in .clancy/.env or run /clancy:settings.
```

Stop.

### 3. Standalone-mode preflight (only in standalone mode)

If in **standalone mode** (no `.clancy/.env`), check that `.clancy/plans/` exists. If not:

```
No local plans found. Run /clancy:plan --from .clancy/briefs/<brief>.md first.
```

Stop.

### 4. Standalone+board preflight (only in standalone+board mode)

If in **standalone+board mode**, source `.clancy/.env` for board credentials. Both plan-file stems and board ticket arguments are valid in this mode — Step 2 routes between them.

---

## Step 2 — Resolve target

The argument can be either a **plan-file stem** (e.g. `add-dark-mode-2`, matching a file at `.clancy/plans/{stem}.md`) or a **board ticket key** (e.g. `PROJ-123`, `#42`). Resolution depends on the installation mode detected in Step 1.

### Standalone mode

In standalone mode, the argument must be a plan-file stem. Board ticket keys are not valid here because there are no board credentials.

**With argument:** look up `.clancy/plans/{arg}.md`. If the file does not exist:

```
Plan file not found: .clancy/plans/{arg}.md. Plan stems include the row number (e.g. `add-dark-mode-2`). Run /clancy:plan --list to see available plans.
```

Stop. Do not attempt to interpret the argument as a ticket key in standalone mode.

**No argument:** auto-select the oldest unapproved local plan.

1. Scan `.clancy/plans/` for `.md` files
2. **Filter to plan files only**: a file qualifies as a plan if it contains the literal heading `## Clancy Implementation Plan` (the marker written by Step 4f / 5a of `plan.md`). Files without this heading are scratch / notes / drafts and are silently skipped — they are not approvable
3. For each remaining file, check whether a sibling `.approved` marker exists at the same path with the `.approved` suffix. The unapproved set is qualifying files with no sibling marker
4. Sort the unapproved set by the `**Planned:**` header date (ascending). Tie-break by Plan ID (alphabetical ascending). Files with a missing or unparseable `**Planned:**` date sort **last** (after all dated plans), then by Plan ID alphabetically among themselves. Mirrors `plan.md` Step 8 inventory's deterministic ordering

If the unapproved set is empty:

```
No local plans awaiting approval. Run /clancy:plan --from .clancy/briefs/<brief>.md first, or all existing plans are already approved.
```

Stop. If non-empty, auto-select the first entry. Confirm with the user (skipped in `--afk` mode):

```
Auto-selected {stem} (planned {date}). Approve this plan? [Y/n]
```

If declined: `Cancelled.` Stop.

### Standalone+board and terminal modes

In these modes the argument may be either a plan-file stem or a board ticket key. **Try plan-file lookup first (does `.clancy/plans/{arg}.md` exist?)**, then fall back to ticket-key validation. The plan stem wins over ticket key on collision (e.g. if `PROJ-123.md` exists in `.clancy/plans/` AND `PROJ-123` is a valid ticket key, the plan stem wins). Document the collision rule explicitly so users are not surprised.

**With argument that resolves to a plan file:** continue to Step 4 (Confirm), then Step 4a (Write local marker). The board push offer for plan-file-stem mode is deferred to a future PR — for now the local marker is the only side effect.

**With argument that does not resolve to a plan file:** validate as a ticket key per the board configured in `.clancy/.env` (case-insensitive):

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

If valid: proceed with that key. The board transport flow runs (Steps 3-7 below).

**No argument:**

- **Standalone+board and terminal:** scan `.clancy/progress.txt` for entries matching `| PLAN |` or `| REVISED |` that have no subsequent `| APPROVE_PLAN |` for the same key. Sort by timestamp ascending (oldest first).
- If 0 found:
  ```
  No planned tickets awaiting approval. Run /clancy:plan first.
  ```
  Stop.
- If 1+ found, auto-select the oldest. Show:
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
- If user declines:
  ```
  Cancelled.
  ```
  Stop.
- Note that the user has already confirmed — set a flag to skip the Step 4 confirmation.

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

For **plan-file stem mode** (Step 2 resolved the argument to a local plan file), the summary shows the plan stem instead of `[{KEY}] {Title}`:

```
Clancy — Approve Plan (local)

{stem}
Size: {S/M/L} | {N} affected files
Planned: {date from plan}

Approve this plan? [Y/n]
```

After confirmation in plan-file stem mode, jump to Step 4a (local marker write). For board ticket key mode, continue to Step 5 below.

---

## Step 4a — Write local marker

Run this step instead of Steps 5, 5b, 6 when the resolved argument was a plan-file stem (standalone mode, or standalone+board / terminal mode where Step 2 found a matching plan file). Write a `.clancy/plans/{stem}.approved` marker that gates plan implementation (see "Marker is the gate for future implementation tooling" below for the deferral context).

### Compute the SHA-256

**Order of operations** (do these in order, exactly):

1. Read the plan file at `.clancy/plans/{stem}.md` from disk into memory as bytes.
2. Compute the SHA-256 hash of those bytes — no normalisation (no line-ending fix, no trailing-whitespace strip, no BOM removal). Hex-encode lowercase.
3. **Then** (only after the hash is computed) open the `.approved` marker for exclusive create as described below.

The `.approved` file is **never** included in the hash — only `.clancy/plans/{stem}.md` is hashed, and only its on-disk byte content at the moment of step 1. The marker is designed so a future implementer (deferred to `@chief-clancy/dev`) can re-read the same plan file, hash it the same way, and compare to the `sha256=` value stored in the marker. Until that consumer ships, the gate is enforced manually: a user (or Claude Code via natural-language instruction) reads the marker, hashes the plan file, and refuses to apply the plan on mismatch. Any divergence (re-edit, line-ending change, trailing whitespace tweak) is detectable.

### Write the marker file with O_EXCL

Open `.clancy/plans/{stem}.approved` for **exclusive create** (Node `fs.openSync(path, 'wx')`, equivalent to `open(2)` with `O_EXCL`). Write the marker body as plain text:

```
sha256={hex sha256 of the plan file at approval time}
approved_at={ISO 8601 UTC timestamp, e.g. 2026-04-08T22:30:00Z}
```

Two `key=value` lines, each terminated with `\n`. No JSON, no extra whitespace, no comments. A future implementer (deferred to `@chief-clancy/dev`) will parse this with a tolerant `^(sha256|approved_at)=(.+)$` regex per line. Until that consumer ships, the format is also human-readable for ad-hoc verification.

### Handle EEXIST (already-approved)

If the exclusive create fails with `EEXIST`, the marker already exists — the plan was previously approved. **The next step depends on whether `--push` was passed.** Check the flag first; the stop branch only applies when `--push` is absent.

**If `--push` IS set (retry path):** the user is re-running approve-plan to retry a previously failed board push. Step 4a **does not stop**. Instead:

1. The marker is **not re-written** — the existing `.clancy/plans/{stem}.approved` file stays in place, byte-for-byte unchanged. The original `sha256=` and `approved_at=` values from the first approval are preserved.
2. **Skip Step 4b entirely.** The brief marker was already updated on the original approval; there is no work for 4b to do on a retry.
3. **Fall through directly to Step 4c.** The retry path enters Step 4c with the same gate evaluation as a fresh approval (board credentials must be present, Source must be readable from the plan file or `--ticket` override must be supplied).

This is the **only** mechanism to re-attempt a failed push. There is no `--push-only` flag and no marker-deletion workflow. The contract is: a Step 4c push failure leaves the marker in place (see Step 4c push-failure section), and a `--push` re-run honours that marker by skipping Step 4a's write and Step 4b's brief update, going straight to 4c. The retry preserves the original approval timestamp — auditing tools see one approval row in `.clancy/progress.txt`, even if 4c was attempted multiple times.

**If `--push` is NOT set:** stop with:

```
Plan already approved: {stem}
Marker: .clancy/plans/{stem}.approved

To re-approve (e.g. after revising the plan):
  Delete .clancy/plans/{stem}.approved manually, then re-run /clancy:approve-plan {stem}
```

A `--fresh` flag for `/clancy:approve-plan` is not implemented in this release. Manual deletion is the supported re-approval path.

### Marker is the gate for future implementation tooling

The `.approved` marker is designed as the gate that any plan-implementing tool checks before applying changes. The conceptual flow: read the marker, hash the current plan file, compare to the stored `sha256`. Match → proceed; mismatch → block with a "plan changed since approval" error. This is why the SHA must be computed over the plan file content (not just touched as an empty file).

A dedicated `/clancy:implement-from` slash command is **deferred** until `@chief-clancy/dev` is extracted (the slash command is convenience, not capability — Claude Code can already do the SHA gate + structured plan parse via natural-language instruction). In the meantime, users apply approved plans by:

1. Asking Claude Code to read the plan file directly: `Implement .clancy/plans/{stem}.md, verifying the .approved marker's sha256 first`
2. Installing the full Clancy pipeline (`npx chief-clancy`) for the board-driven flow

### After writing the marker

After the marker is written successfully, update the source brief file's marker comment (Step 4b below), then continue to Step 4c (Optional board push). Step 4c is best-effort and gated on board credentials being present — when the gate fails it skips silently and the flow continues to Step 7. Steps 5, 5b, and 6 (board ticket-key transport) are skipped entirely in plan-file stem mode regardless of whether Step 4c runs.

---

## Step 4b — Update brief marker (best-effort)

After Step 4a writes the local plan marker, update the source brief file's planned-rows marker so `/clancy:plan --list` and the brief's display logic know which rows have been approved. This step is best-effort: any failure here logs a warning but does NOT roll back the `.clancy/plans/{stem}.approved` marker.

### Resolve the source brief filename

Read the plan file at `.clancy/plans/{stem}.md` and extract the `**Brief:**` header line (e.g. `**Brief:** 2026-04-01-add-dark-mode.md`). The value is the brief filename relative to `.clancy/briefs/`. If the line is absent or empty, warn and skip the rest of Step 4b:

```
⚠ Plan {stem} has no **Brief:** header — cannot update brief marker. Continuing without brief update.
```

### Resolve the row number

Extract the row number from the plan file's `**Row:**` header line (e.g. `**Row:** #2 — Add toggle component`). The number after `#` and before the em-dash (U+2014, U+2013, or hyphen) is the row. If absent, warn and skip Step 4b.

### Find and update the marker

Open `.clancy/briefs/{brief-filename}` and find the marker comment matching this tolerant regex (line-anchored, allows missing-or-present `approved:` prefix, allows arbitrary whitespace):

```
^<!--\s*(?:approved:([\d,]*)\s+)?planned:([\d,]+)\s*-->\s*$
```

This matches all of:

- `<!-- planned:1,2,3 -->` (no approved prefix — earlier marker shape)
- `<!-- approved:1 planned:1,2,3 -->` (with the approved prefix)
- `<!-- approved: planned:1,2,3 -->` (empty approved list — should not happen but handle gracefully)
- `<!--planned:1,2,3-->` (no surrounding spaces — hand-edited)

If no marker line matches, warn and skip — do not synthesise a marker. The brief should already have one written by `/clancy:plan --from`.

**Reversed-order markers** (`<!-- planned:1,2 approved:1 -->` — `planned:` first, `approved:` second) do NOT match this regex and fall through to the warn-and-skip branch. The canonical ordering is enforced on every write, so a brief that drifts into reversed order requires manual correction. If you see the warning "no marker found" but the brief clearly has a marker, check the order — `approved:` must come before `planned:`.

**Code-fence false positives:** the regex is line-anchored but does NOT track fenced-code-block context. If a brief file embeds an example marker inside a triple-backtick block (e.g. documentation about how markers work), the regex may match the example. The first match wins, so authors should keep the real marker as the first marker line in the file. The `## Feedback` detector in `plan.md` Step 3a uses code-fence-aware parsing for the same reason — apply that pattern manually if a brief becomes complex enough to need it.

If a marker matches, parse the existing `approved:` and `planned:` row lists. Add the current row number to the `approved:` list (deduped, sorted ascending). Reconstruct the marker with the canonical ordering: `approved:` first, `planned:` second, single space between fields and inside the comment. Example:

- Before: `<!-- planned:1,2,3 -->`, current row = `2`
- After: `<!-- approved:2 planned:1,2,3 -->`
- Before: `<!-- approved:1 planned:1,2,3 -->`, current row = `2`
- After: `<!-- approved:1,2 planned:1,2,3 -->`

Write the updated brief file back. The read-modify-write is not concurrency-safe — running multiple `/clancy:approve-plan` commands against the same brief in parallel may produce duplicate or missing entries. Single-user local flow is assumed (mirrors the concurrency note in [`plan.md` Step 3a](./plan.md)).

### Best-effort failure handling

If any step in 4b fails (file not found, marker not found, write error, regex mismatch), log a warning but do NOT roll back the `.clancy/plans/{stem}.approved` marker. The local marker is the source of truth — the brief marker is metadata for display and `/clancy:plan --list`. Example warning:

```
⚠ Failed to update brief marker for {stem}: {reason}
The plan is still approved. The .clancy/plans/{stem}.approved marker is in place.
You can manually update .clancy/briefs/{brief}.md if needed.
```

After Step 4b completes (successfully or with a warning), continue to Step 4c (Optional board push). Step 4c is best-effort and gated on board credentials being present — when the gate fails it skips silently and the flow continues to Step 7. Steps 5, 5b, and 6 (the board ticket-key transport flow) remain unreachable in plan-file stem mode regardless of whether Step 4c runs.

---

## Step 4c — Optional board push (best-effort)

In standalone+board mode (board credentials present alongside a local plan-file stem approval), offer to push the approved plan to the source board ticket as a comment. This closes the "I have credentials and I want both modes" UX cliff: the user gets the local marker AND the board comment in one approval.

### Run conditions (both must be true)

Step 4c runs only when **both** of these gates pass:

1. **Step 4a wrote a marker successfully.** If Step 4a stopped on `EEXIST` (already-approved) without `--push`, or if the resolved argument was a board ticket key (which routes through Steps 5/5b/6 instead), Step 4c does not run. The retry path — `EEXIST` with `--push` set — falls through to Step 4c instead of stopping (see Step 4a's `--push` retry branch above).
2. **Board credentials are available.** Detect by reading `.clancy/.env` and confirming the configured board's credential variables are present (the same detection used by Step 1's three-state preflight). If `.clancy/.env` is absent or no board is configured, Step 4c is skipped.

If either gate fails, **skip Step 4c silently** and continue to Step 7 (Confirm and log). "Silently" means no warning, no log token, no stdout note — the absence of board credentials is the standalone-mode default, not an error condition. Subsequent slices add explicit log tokens for the conditions that DO warrant user-visible output (no pushable Source field, push failure, `--afk` without `--push`, etc.).

### Best-effort semantics

Step 4c is **best-effort** and never rolls back the local marker. The `.clancy/plans/{stem}.approved` marker written in Step 4a is the source of truth for "this plan was approved" — a board push failure does not unwind it. Local state is authoritative; the board comment is a convenience surface. Subsequent slices wire the failure-logging and retry-command details.

### Read the Source field from the plan file

Once both run-condition gates pass, **read the `**Source:**`header line directly from the local plan file at`.clancy/plans/{stem}.md`** (the same file Step 4a hashed and Step 4b read for the `**Brief:**` header). The plan file's header block — written by [`plan.md`](./plan.md) Step 5a — contains the brief's Source field value verbatim. Step 4c uses this header as the **single source of truth** for which board ticket (if any) the plan should be pushed to.

**Do NOT open the brief file** to look up Source in Step 4c. Step 4b already chases the brief filename out of the plan header to update its `planned:`/`approved:` row marker, but that second filesystem hop is unnecessary for Step 4c — the Source value Step 4b would find inside the brief is the same value already copied into the plan header. Reading from the plan file alone keeps Step 4c self-contained.

The line format is `**Source:** {value}` on a line by itself. Match it with a tolerant regex anchored to start-of-line, allowing arbitrary trailing whitespace:

```
^\*\*Source:\*\*\s+(.+?)\s*$
```

Capture group 1 is the raw Source value — the next sub-step parses it into one of the three brief Source formats (bracketed key, inline-quoted, file path).

### Handle a missing **Source:** header gracefully

If the plan file has **no `**Source:**` header line** (e.g. a hand-edited plan, or a plan generated before the Source header was added to the local plan template), Step 4c skips silently and continues to Step 7 — same semantics as the run-condition gates. No warning, no log token, no stdout note. The marker is still authoritative; the absence of a Source header just means there's no ticket to push to.

### Parse the Source value (three brief formats)

Brief writes the Source field in **one of three formats** (per [`packages/brief/src/workflows/brief.md` lines ~806-810](../../brief/src/workflows/brief.md)). Step 4c classifies the captured Source value into one of these three buckets:

1. **Bracketed key — pushable.** The Source value matches `^\[(#?\d+|[A-Z][A-Z0-9]*-\d+)\]\s+.+$` (e.g. `[#50] Redesign settings page`, `[PROJ-200] Add customer portal`, `[ENG-42] Add real-time notifications`). Extract the key from inside the brackets. **This is the only format that can be pushed to a board.** Continue to the key validation sub-step below.
2. **Inline-quoted text — no ticket.** The Source value matches `^"[^"]+"$` (e.g. `"Add dark mode support"`). The user gave brief a free-text idea instead of a board ticket reference. There is no ticket to push to.
3. **File path — no ticket.** The Source value matches anything else that is not a bracketed key (e.g. `docs/rfcs/auth-rework.md`). The user pointed brief at a local document. There is no ticket to push to.

The bracketed-key format is the **only** pushable Source format. Both inline-quoted and file-path formats route to the skip-no-ticket branch below.

### Skip-no-ticket branch (inline-quoted or file-path Source)

When the parsed Source falls into the inline-quoted or file-path bucket, Step 4c records the skip and continues to Step 7. Append a row to `.clancy/progress.txt`:

```
YYYY-MM-DD HH:MM | {stem} | BOARD_PUSH_SKIPPED_NO_TICKET | {source_format}
```

Where `{source_format}` is the literal string `inline-quoted` or `file-path` (lowercase, hyphenated). The row is written **after** the existing `LOCAL_APPROVE_PLAN | {stem} | sha256={...}` row from Step 7's local-mode log block — two rows total per approval, one for the marker write and one for the skip token.

In the local-mode success block (rendered by Step 7), surface the skip as a non-warning info line under the marker write success:

```
   Note: source is {source_format} — no pushable ticket. Local marker only.
```

This is informational, not an error. The plan IS approved; the absence of a board push is the expected outcome for non-bracketed Source values. After logging and surfacing the note, continue to Step 7 normally.

### Validate the extracted key against the configured board

When the parsed Source is the bracketed-key form (or when `--ticket {KEY}` was passed as an override — see the decision matrix below), the extracted `{KEY}` value must be validated against the **configured board's** key pattern **before any push attempt is made**. Validation happens here, not after the curl request — a malformed key should never reach the network.

Detect the configured board by reading `.clancy/.env` (the same detection used by [Step 1's three-state preflight](#step-1--preflight-checks) and by Step 4c's credential gate above). This is a **single-board environment** — `.clancy/.env` configures exactly one board, and there is no cross-board disambiguation. Whichever board is configured, that board's regex is the only one Step 4c validates against.

Match the extracted `{KEY}` against the per-platform regex for the configured board:

| Platform     | Regex                             | Example keys               |
| ------------ | --------------------------------- | -------------------------- |
| Jira         | `^[A-Z][A-Z0-9]+-\d+$`            | `PROJ-200`, `ENG-42`       |
| GitHub       | `^#\d+$`                          | `#50`, `#1234`             |
| Linear       | `^[A-Z]+-\d+$`                    | `ENG-42`, `CORE-7`         |
| Azure DevOps | `^\d+$`                           | `12345`                    |
| Shortcut     | `^\d+$`                           | `8675`                     |
| Notion       | `^[0-9a-f]{32}$\|^[0-9a-f-]{36}$` | `abc123...` (32 or 36 hex) |

The six regexes are hard-coded inline above — there is no shared lookup table, and Step 4c does not consult any other workflow file for them. If a future board is added, this table is updated in the same PR.

### Hard-error on key/board mismatch

If the extracted `{KEY}` does not match the configured `{board}`'s regex, Step 4c **hard-errors before attempting any push**. There is no second-chance: Step 4c never attempts a different platform's regex, never retries against an alternate board, and never silently skips the push. The mismatch is a user-actionable error — either the Source field in the brief was malformed, or the `--ticket` override targeted the wrong board.

Display the error:

```
✗ Step 4c: extracted key `{KEY}` does not match the configured `{board}` key format.
  Expected pattern: {regex from the table above}
  Source value:     {raw Source line from the plan file}

The local marker is unchanged — your plan is still approved.
To retry with a corrected key:
  /clancy:approve-plan {stem} --push --ticket {CORRECT_KEY}
```

The local `.clancy/plans/{stem}.approved` marker **stays in place and is preserved**. Mismatch is a Step 4c failure, not a Step 4a failure — the marker write succeeded and the plan IS approved. The marker is authoritative; Step 4c never rolls back. After printing the error, append a row to `.clancy/progress.txt`:

```
YYYY-MM-DD HH:MM | {stem} | BOARD_PUSH_FAILED | key-mismatch:{KEY}
```

Then continue to Step 7 (Confirm and log) — the local-mode success block still renders for the marker write, with the mismatch error printed above it.

### Flags governing Step 4c

Step 4c introduces two new flags on `/clancy:approve-plan` (in addition to the existing `--afk`):

- **`--push`** — skip the interactive prompt and push immediately. Combined with `--afk`, this is the unattended-automation path.
- **`--ticket {KEY}`** — override the Source auto-detect from the plan file. The override `{KEY}` wins over auto-detect and is what gets validated against the configured board's regex (see "Validate the extracted key against the configured board" above). Use this when the brief Source field is missing, ambiguous, or points at the wrong ticket.

The default interactive prompt is `[y/N]` with **default No** — Step 4c never surprise-writes to a board. A user who hits Enter without typing accepts the default (no push) and the plan is approved as a local-only operation.

The prompt text:

```
Push approved plan to {KEY} as a comment? [y/N]
```

`{KEY}` is the resolved ticket key — either auto-detected from the plan file's `**Source:**` line or supplied by `--ticket`.

### Decision matrix

Step 4c's behaviour depends on three orthogonal axes: `--push`, `--afk`, and `--ticket`. The six meaningful cells:

| Cell                              | `--push` | `--afk` | `--ticket KEY` | Behaviour                                                                                       |
| --------------------------------- | -------- | ------- | -------------- | ----------------------------------------------------------------------------------------------- |
| **Interactive, no `--push`**      | no       | no      | no             | Auto-detect Source. Prompt `Push approved plan to {KEY} as a comment? [y/N]`. Default No.       |
| **Interactive + `--ticket` only** | no       | no      | yes            | Validate `KEY`. Prompt with the override `KEY`. Override wins over auto-detect. Default No.     |
| **Interactive + `--push`**        | yes      | no      | either         | Skip prompt, push immediately. `--ticket` (if present) overrides auto-detect; otherwise auto.   |
| **`--afk` without `--push`**      | no       | yes     | either         | Skip the push entirely. Log `LOCAL_ONLY` (see token below). `--ticket` is ignored in this cell. |
| **`--afk --push`**                | yes      | yes     | no             | Push without prompting. Auto-detect Source.                                                     |
| **`--afk --push --ticket KEY`**   | yes      | yes     | yes            | Push without prompting using the override `KEY`.                                                |

The `--afk` without `--push` cell logs a token to `.clancy/progress.txt` so the user can see in their audit trail that an unattended run deliberately stayed local-only:

```
YYYY-MM-DD HH:MM | {stem} | LOCAL_ONLY | afk-without-push
```

`--ticket` is **ignored** in the `--afk` without `--push` cell — there is no push attempted, so any override key has nothing to override. This is documented behaviour, not a silent quirk: the `--afk` mode's contract is "no surprises", and pushing because `--ticket` was set would surprise the user.

### Two prompts in non-`--afk` flow is intentional

In non-`--afk` mode, the user sees **two prompts** during a single approve invocation: [Step 4 — Confirm](#step-4--confirm) prompts to confirm the approval (a local commitment), and Step 4c prompts to confirm the board push (a visible-to-others publication). These are semantically distinct decisions and are intentionally kept as two separate prompts. Merging them into a single "approve and push?" prompt would conflate two different commitments and make it impossible to approve locally without also publishing.

<!-- DUPLICATED REGION: the bytes between the curl-blocks:approve-plan-push:start/end anchors below are byte-identical to the canonical source in plan.md Step 5b. A drift-prevention test (workflows.test.ts) byte-compares the two regions and fails on mismatch. Edit one — update the other in the same commit. -->
<!-- curl-blocks:approve-plan-push:start -->

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

<!-- curl-blocks:approve-plan-push:end -->

### Push success — log the second audit row

When the curl returns a 2xx response, the comment is live on the source ticket. Append a **second** row to `.clancy/progress.txt` immediately after the existing `LOCAL_APPROVE_PLAN | sha256={...}` row from Step 7's local-mode log block:

```
YYYY-MM-DD HH:MM | {stem} | LOCAL_APPROVE_PLAN_PUSH | {KEY}
```

Two rows total per successful approve+push: one for the marker write (`LOCAL_APPROVE_PLAN`) and one for the board push (`LOCAL_APPROVE_PLAN_PUSH`). The two-row layout is unambiguous and survives partial-failure replay better than extending the single row with a `pushed:{KEY}` field — a downstream audit grep that wants "approvals that were also pushed to a board" can simply look for the second token.

The success row uses the same `{stem} | TOKEN | {detail}` column convention as every other progress.txt row in the file ([`plan.md` Step 6](./plan.md) for the canonical convention).

After logging, surface the success in Step 7's local-mode block (the existing block already renders for the marker write — Step 4c's success path adds nothing extra to it on non-Notion platforms; the Notion-only flat-text note from Step 7 below renders only when the push target was Notion).

### Handling push failure (HTTP non-2xx, network, timeout, dns, auth)

The curl request can fail in several ways: an HTTP non-2xx response (4xx auth/permission, 5xx server), a network-layer failure (DNS, TCP timeout, connection refused), or a credential rejection. **All push failures are best-effort** — the local `.clancy/plans/{stem}.approved` marker stays in place and is preserved. The marker is authoritative; Step 4c never rolls back. A push failure is a Step 4c failure, not a Step 4a failure: the plan IS approved, the board comment just didn't land.

Classify the failure into one of two buckets when logging:

- **HTTP status code** — when the curl returned a non-2xx response code (e.g. `403`, `404`, `429`, `500`, `502`). Use the literal numeric status code.
- **Error class** — when the curl failed before getting an HTTP response back (transport-layer failure). Use one of the lowercase tokens: `network` (generic transport failure or connection refused), `timeout` (the request exceeded the timeout), `dns` (hostname resolution failed), or `auth` (the platform returned an explicit credential-rejection signal that isn't a clean HTTP status).

Display the error to the user with both the failure detail and the retry command:

```
✗ Step 4c: failed to push approved plan to {KEY} on {board}.
  Reason: {http_status_or_error_class}

The local marker is unchanged — your plan is still approved.
To retry the push:
  /clancy:approve-plan {stem} --push --ticket {KEY}
```

The retry command pattern is **exact** — `/clancy:approve-plan {stem} --push --ticket {KEY}` — so the user can copy-paste it without modification. The `--push` flag triggers the retry path (see Step 4a's `EEXIST + --push` fall-through above), and `--ticket {KEY}` re-supplies the resolved key in case the user is in a fresh shell where Source auto-detect would have to re-read the plan file.

Append a row to `.clancy/progress.txt`:

```
YYYY-MM-DD HH:MM | {stem} | BOARD_PUSH_FAILED | {http_status_or_error_class}
```

This is the same `BOARD_PUSH_FAILED` token used by the key-mismatch path above, with a different reason field. The two cases share the token because both represent "Step 4c tried to push and couldn't" — downstream tooling (Step 8 inventory, audit greps) treats them as a single failure category.

**Reason-field disambiguation contract.** The `BOARD_PUSH_FAILED` reason field is one of three disjoint shapes: a literal HTTP status code (`403`, `404`, `429`, `500`, ...), a lowercase error class from the closed set `network`/`timeout`/`dns`/`auth`, or the prefixed form `key-mismatch:{KEY}`. The `key-mismatch:` prefix is reserved — any future BOARD_PUSH_FAILED reason that introduces structured detail must use a similarly prefixed form (e.g. `rate-limit:60s`) so that downstream parsers can disambiguate by looking at the first token before any colon. HTTP status codes start with a digit and the error-class vocabulary is closed, so neither collides with a `letter:` prefix.

After printing the error and logging the row, continue to Step 7 (Confirm and log) — the local-mode success block still renders for the marker write, with the push-failure error printed above it. Push failure is **never** an exit-non-zero condition: the marker write succeeded, the audit trail captures the push failure, and the user has an actionable retry command.

After Step 4c completes (push attempted, push skipped, or gate failed), continue to Step 7 (Confirm and log).

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

**Mode gate (read first):** if Steps 4a/4b ran (the resolved argument was a plan-file stem), skip the entire "board-specific success message" and "board-mode progress.txt entry" blocks below and jump straight to the **Local mode (Step 4a / 4b path)** subsection further down. The board-success-message text only applies when Steps 5/5b/6 ran for a board ticket key. Do NOT render both — exactly one branch executes per approval.

On success in **board ticket mode**, display a board-specific message:

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

Append to `.clancy/progress.txt` for **board mode**:

```
YYYY-MM-DD HH:MM | {KEY} | APPROVE_PLAN | —
```

On board failure:

```
Failed to update description for [{KEY}]. Check your board permissions.
```

### Local mode (Step 4a / 4b path)

For **plan-file stem mode** (Step 4a wrote a `.approved` marker), display:

```
Clancy — Approve Plan (local)

✅ Approved {stem}
   Marker: .clancy/plans/{stem}.approved
   sha256: {first 12 hex chars}…

Next:
  • Ask Claude Code: "Implement .clancy/plans/{stem}.md (verify the .approved marker's sha256 first)"
  • Or run `npx chief-clancy` for the full board-driven pipeline

"Book 'em, Lou."
```

**Conditional Brief line:** if Step 4b actually resolved AND updated the brief marker (i.e. the `**Brief:**`/`**Row:**` headers were present, the marker regex matched, and the write succeeded), insert this line between `sha256:` and the blank line above `Next:`:

```
   Brief:  .clancy/briefs/{brief}.md (row #{N} marked approved)
```

Do NOT print the Brief line when Step 4b warned and skipped (missing headers, no matching marker, or write error). In that case, also print the warning that Step 4b emitted under the success block but do not change the exit status — the plan IS approved regardless of whether the brief marker was updated.

**Conditional Notion flat-text note:** when Step 4c successfully pushed to a Notion page (and **only** when the push target is Notion — not for the other five platforms), insert this informational line under the `Next:` block, after the existing bullets:

```
   Note: Notion comments render as flat text — the plan structure won't be styled.
```

This is a one-time heads-up so Notion users aren't surprised that headings, bullets, tables, and code formatting were stripped on the comment side. The plan content itself is intact in the Notion comment; only the markdown styling was flattened by Notion's `rich_text` model. The note does not render for Jira, GitHub, Linear, Azure DevOps, or Shortcut pushes — those platforms preserve the original markdown formatting (or the platform-specific format conversion documented in Step 4c's curl blocks).

Append to `.clancy/progress.txt`:

```
YYYY-MM-DD HH:MM | {stem} | LOCAL_APPROVE_PLAN | sha256={first 12 hex}
```

The `LOCAL_APPROVE_PLAN` token mirrors the `LOCAL_PLAN` / `LOCAL_REVISED` convention used by `/clancy:plan --from` (see [`plan.md` Step 6](./plan.md)). The token is for human audit only — any future plan-implementing tool reads the `.clancy/plans/{stem}.approved` marker directly rather than scanning `progress.txt` for approval state.

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
