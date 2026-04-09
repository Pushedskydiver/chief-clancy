# Clancy Implement-From Workflow

You are running `/clancy:implement-from`. This is the local-loop counterpart to terminal's `/clancy:implement`. It reads a local plan file from `.clancy/plans/`, verifies it was approved (via the SHA-256 marker `/clancy:approve-plan` writes), parses the plan's structured sections, and applies the changes.

This command is **completely separate** from terminal's `/clancy:implement`:

- **No board ticket.** Plan stems, not ticket keys
- **No lock file.** Standalone implement does not create the board-ticket lock file terminal's verification gate watches for; the Stop hook will not fire for `/clancy:implement-from`. This is correct — local implement is explicitly outside the verification-gate lifecycle
- **No pipeline phases.** No `lockCheck`, `preflight`, `branchSetup`, `transition`, `invoke`, `deliver`, `cleanup`. Just: gate → parse → write code → log
- **No board API calls.** No comments, no status transitions, no PR creation

Use `/clancy:implement` (terminal) for the board-driven flow. Use `/clancy:implement-from` (this workflow) for the local flow.

---

## Step 1 — Preflight

Detect the install context. The detection is identical to `/clancy:plan` and `/clancy:approve-plan`, but every state behaves the same way for `/clancy:implement-from` — there is no mode-specific branching below this step. The detection is documented here so the user sees a familiar header and so future modes (e.g. board push of completion comments) have a place to hook in.

1. Check if `.clancy/.env` exists in the current working directory
   - **Absent** → **standalone mode** (no board credentials)
   - **Present**, and `.clancy/clancy-implement.js` is also present → **terminal mode** (full pipeline available, but `/clancy:implement-from` does not use it)
   - **Present**, but `.clancy/clancy-implement.js` is absent → **standalone+board mode**
2. Print the detected mode for visibility:

   ```
   Clancy Implement-From
   ================================================================
   Mode: {standalone | standalone+board | terminal}
   ```

3. **Terminal-mode preflight:** in terminal mode only, check `CLANCY_ROLES` for the `planner` role (skip in standalone mode and standalone+board mode — `CLANCY_ROLES` is a terminal concern). If `CLANCY_ROLES` is set and does not include `planner`, stop with: `Planner role not enabled. Add 'planner' to CLANCY_ROLES in .clancy/.env or unset CLANCY_ROLES.`
4. Check that `.clancy/plans/` exists. If absent, stop with:

   ```
   No plans directory found at .clancy/plans/
   Run /clancy:plan --from .clancy/briefs/{brief}.md to create your first plan.
   ```

---

## Step 2 — Resolve the argument

`/clancy:implement-from` accepts a single positional argument in two forms. The path form takes precedence on collision.

### 2.0 — Argument validation (run before path/stem branching)

Reject arguments that cannot resolve to a plan file inside `.clancy/plans/`:

- **Empty or whitespace-only argument** → treat as no argument (Step 2.3)
- **Absolute path** (starts with `/` on Unix or matches `^[A-Z]:[\\/]` on Windows) → reject:

  ```
  Absolute paths are not supported: {arg}
  /clancy:implement-from resolves plans relative to .clancy/plans/ in the current working directory.
  Use a stem (e.g. add-dark-mode-2) or a relative path (.clancy/plans/add-dark-mode-2.md).
  ```

- **Path traversal** (contains `..` as a path segment, contains a null byte, or — for the bare-stem form — contains `/` or `\`) → reject:

  ```
  Invalid argument: {arg}
  Plan stems and paths must not contain '..', '/', or '\' (except for the literal '.clancy/plans/' prefix).
  Run /clancy:plan --list to see available plans.
  ```

These rejections fire **before** the path/stem branch below so an absolute path or a `..`-containing stem never reaches the filesystem read.

### 2.1 — Path form

If the argument starts with the literal prefix `.clancy/plans/`, treat it as an explicit path. Examples: `.clancy/plans/add-dark-mode-2.md`, `.clancy/plans/add-dark-mode-2`. Strip a trailing `.md` if present to derive `{stem}`. The stem must not contain `/` after the `.clancy/plans/` prefix is removed (i.e. nested subdirectories under `.clancy/plans/` are not supported). Verify the file exists at `.clancy/plans/{stem}.md`. If absent:

```
Plan file not found: .clancy/plans/{stem}.md
Run /clancy:plan --list to see available plans.
```

### 2.2 — Bare-stem form

Otherwise treat the argument as a plan stem. The stem must not end in `.md` (a `.md` suffix means the user typed a path-shaped argument that did not start with `.clancy/plans/` — reject and tell them to use the path form). Resolve against `.clancy/plans/{arg}.md`. If absent:

```
Plan file not found: .clancy/plans/{arg}.md
Plan stems include the row number (e.g. add-dark-mode-2 for row 2).
Run /clancy:plan --list to see available plans.
```

### 2.3 — No argument

If no argument was provided (or the argument was empty after Step 2.0's whitespace check), stop with:

```
Usage: /clancy:implement-from {plan-file-path-or-stem}
Run /clancy:plan --list to see available plans.
```

After resolution, you have a verified `{stem}` (filename minus `.md`) and a verified plan-file path `.clancy/plans/{stem}.md`. Both are used by every step below. All file reads under `/clancy:implement-from` resolve against the current working directory's `.clancy/plans/` — there is no global plans directory, no symlink following, and no path-traversal escape from the project root.

---

## Step 3 — Approval gate

This is the load-bearing step. Approval is the only safeguard between "plan generated" and "code changes applied". Warnings scroll past in non-interactive runs, so the gate is a hard block, not a warning.

### 3.1 — `--bypass-approval` short-circuit

If `--bypass-approval` was passed, skip the rest of Step 3 entirely. Print a loud warning and continue:

```
⚠ Approval gate bypassed (--bypass-approval).
  This plan has not been verified against its .approved marker.
  Re-run /clancy:approve-plan {stem} after implementation if you want a clean audit trail.
```

Then jump to Step 4. The bypass flag does not write anything to the marker — it only opts out of the read.

**`--afk` does NOT imply `--bypass-approval`.** Even when running unattended with `--afk`, you must pass `--bypass-approval` explicitly to skip the gate. The reason: warnings scroll past in non-interactive runs, and approval is the only thing between "plan generated" and "code changes applied". Forcing an explicit opt-out makes the bypass auditable in shell history and CI logs.

### 3.2 — Read the sibling marker

Check whether `.clancy/plans/{stem}.approved` exists.

**Marker absent → block:**

```
Plan not approved: {stem}
Marker missing: .clancy/plans/{stem}.approved

Run /clancy:approve-plan {stem} first to approve this plan.
(Or pass --bypass-approval to skip the gate — not recommended.)
```

Log entry: `YYYY-MM-DD HH:MM | {stem} | LOCAL_BLOCKED | not approved`

Stop. Do not proceed to Step 4.

### 3.3 — Parse the marker

The marker body is two `key=value` lines (written by `/clancy:approve-plan` Step 4a):

```
sha256={64-char lowercase hex}
approved_at={ISO 8601 UTC timestamp}
```

Parse with a tolerant `^(sha256|approved_at)=(.+)$` regex per line. The `sha256` value must be exactly 64 lowercase hex characters (`/^[0-9a-f]{64}$/`). The `approved_at` value must parse as a valid ISO 8601 timestamp.

**Marker malformed → block** (point at the same delete-and-recreate remediation as drift, but log a distinct token so an `--afk` user grepping `.clancy/progress.txt` can tell the two cases apart):

```
Plan marker malformed: .clancy/plans/{stem}.approved
The marker exists but its sha256= line is missing, non-hex, or wrong length.
This is NOT the same as a sha mismatch — your plan file may be unchanged.

To re-approve:
  1. Delete .clancy/plans/{stem}.approved manually
  2. Run /clancy:approve-plan {stem}
```

Log entry: `YYYY-MM-DD HH:MM | {stem} | LOCAL_BLOCKED | malformed marker`

The malformed-marker token is distinct from `sha mismatch` (Step 3.5) so a user reading `.clancy/progress.txt` after an `--afk` run can tell whether they need to look for plan-file edits (drift) or just delete the marker (malformed). Step 8 of `plan.md` (PR 7c, extended in PR 8.1) folds both cases into `Stale (re-approve)` in the inventory display because the user-facing remediation is identical, but the log token preserves the distinction.

Stop. Do not proceed to Step 4.

### 3.4 — Hash the current plan file

Compute the SHA-256 of the plan file the **same way** `/clancy:approve-plan` Step 4a does, byte-for-byte identical:

**Order of operations** (do these in order, exactly):

1. Read the plan file at `.clancy/plans/{stem}.md` from disk into memory as bytes.
2. Compute the SHA-256 hash of those bytes — no normalisation (no line-ending fix, no trailing-whitespace strip, no BOM removal). Hex-encode lowercase.

The `.approved` file is **never** included in the hash — only `.clancy/plans/{stem}.md` is hashed, and only its on-disk byte content at the moment of step 1. This is the inverse of `/clancy:approve-plan`'s hash and must produce identical bytes for an unchanged plan file.

### 3.5 — Compare and verdict

Compare the freshly-computed hash to the marker's `sha256` value (lowercase string equality, 64 chars).

**Match → proceed.** Print a one-line confirmation and continue to Step 4:

```
✓ Plan approved (sha256={first 12 hex of marker}, approved {approved_at})
```

**Mismatch → block** (the plan file was edited after approval):

```
Plan changed since approval: {stem}
Marker sha256: {first 12 hex of marker}
Current sha256: {first 12 hex of current}

The plan file was edited after /clancy:approve-plan recorded the marker.
To re-approve:
  1. Delete .clancy/plans/{stem}.approved manually
  2. Run /clancy:approve-plan {stem}
```

Log entry: `YYYY-MM-DD HH:MM | {stem} | LOCAL_BLOCKED | sha mismatch`

Stop. Do not proceed to Step 4.

---

## Step 4 — Parse the plan

Read `.clancy/plans/{stem}.md` and extract the structured sections. Every field below is required (the plan format is locked by `/clancy:plan` Step 5a). Fail loud on missing sections rather than guessing — a malformed plan is a sign the file was hand-edited in a way that probably also drifted the SHA, and the user should notice.

### 4.1 — Header fields

Extract the local plan header lines (the block at the top of the file written by `/clancy:plan` Step 5a):

- **`**Source:**`** — the source field from the brief (board ticket key, inline-quoted idea, or file path)
- **`**Brief:**`** — the brief filename relative to `.clancy/briefs/`
- **`**Row:**`** — the decomposition row line. Format: `**Row:** #N — Title` where the separator is an em-dash (U+2014), en-dash (U+2013), or hyphen (`-`). Tolerant regex: `^\*\*Row:\*\*\s*#(\d+)\s*[—–-]\s*(.+)$`. Capture the row number and the title separately
- **`**Planned:**`** — the YYYY-MM-DD planned date

Record these for the run summary in Step 6. If `**Row:**` is missing, treat the plan as a single-unit plan (no row number); the implement loop does not depend on the row number being present.

### 4.2 — `### Affected Files` table

Locate the `### Affected Files` section. The body is the row-per-file markdown table `/clancy:plan` Step 5a writes — three columns, one row per affected file:

```
| File                    | Change Type | Description               |
| ----------------------- | ----------- | ------------------------- |
| `src/path/file.ts`      | Modify      | {What changes and why}    |
| `src/path/new-file.ts`  | Create      | {What this new file does} |
| `src/path/file.test.ts` | Modify      | {What changes and why}    |
```

Parse every data row (skip the header row and the `---` separator row). For each row:

1. Read the **`File`** column. The cell typically contains a backtick-wrapped path (`` `src/path/file.ts` ``); strip the backticks to recover the bare path string.
2. Read the **`Change Type`** column. The cell value is `Modify`, `Create`, or `Delete` (case-insensitive match — the writer is title-case but tolerate lowercase or upper-case in case the plan was hand-edited).
3. Bucket the path into one of three lists by change type: `modify[]`, `create[]`, or `delete[]`. Reject any other change-type value with a fail-loud error pointing at the bad row.

The total `N` for the log token (Step 6) is `modify.length + create.length + delete.length`.

**If `### Affected Files` is missing, its table body is empty, or every data row has an unrecognised `Change Type` → fail loud:**

```
Plan has no Affected Files section: {stem}
Cannot implement without an explicit file list.
The plan file may be malformed or hand-edited. Re-run /clancy:plan --from {brief} {row}
to regenerate, or delete the plan and re-plan.
```

Stop. The Affected Files table is the central input — without it there is nothing to act on, even if every other section is present. The section checks in Step 4.6 below are equally required but they augment the file list rather than replace it. A plan with no usable file list is not implementable, even with `--bypass-approval`.

### 4.3 — `### Test Strategy` checklist

Locate the `### Test Strategy` section. The body is a markdown checklist (`- [ ] item` lines). Parse each line as a test action item. The items describe what to test and the order to write tests in (vertical TDD slices — one test → implement → next test).

### 4.4 — `### Acceptance Criteria` checklist

Locate the `### Acceptance Criteria` section. The body is a markdown checklist (`- [ ] item` lines). Parse each line as an acceptance criterion. These are the conditions the implementation must satisfy before the run is considered complete.

### 4.5 — `### Implementation Approach` paragraph

Locate the `### Implementation Approach` section. The body is free-form prose describing the order of operations, design decisions, and any tricky bits the planner identified during exploration. Read it in full before writing any code.

### 4.6 — Required-section invariant

`/clancy:plan` Step 5a writes all four sections (`### Affected Files`, `### Implementation Approach`, `### Test Strategy`, `### Acceptance Criteria`) for every plan it generates. A plan missing any of them is hand-edited and probably also drifted from its `.approved` SHA — but a `--bypass-approval` run could still try to implement it.

Fail loud if any of `### Test Strategy`, `### Acceptance Criteria`, or `### Implementation Approach` is missing or has an empty body, with the same shape as the Affected Files error:

```
Plan is missing required section: ### {SectionName} ({stem})
/clancy:plan writes all four structured sections for every generated plan.
The plan file may be malformed or hand-edited. Re-run /clancy:plan --from {brief} {row}
to regenerate, or delete the plan and re-plan.
```

Stop. There is no `--force` escape hatch for missing sections — if the user genuinely wants to implement against a partial plan, they should fill in the missing sections by hand and re-approve. **`--bypass-approval` does NOT bypass these section checks** — it only opts out of the SHA-256 marker comparison in Step 3. The plan-format checks in Step 4 fire regardless, because a plan missing required sections is not implementable in any sense; the bypass flag is about provenance, not structure.

---

## Step 5 — Implement the plan

Apply the changes the plan describes. This is the actual code-writing step.

### 5.1 — Read every Modify-row file for context

Before writing any code, read every file in the `modify[]` list end-to-end. The plan was generated against the current state of these files; you need the same context to make compatible edits. For large files (>500 lines), focus on the regions the plan's Implementation Approach calls out.

### 5.2 — Write tests first per Test Strategy

Follow the project's TDD convention: vertical slices, one test → implement → next test. Never write all tests first. For each item in the Test Strategy checklist:

1. Write the test (red)
2. Implement the minimum code to make it pass (green)
3. Move to the next test

### 5.3 — Follow the Implementation Approach

The Implementation Approach paragraph is the planner's recommended order of operations. Follow it unless you discover during implementation that a different order produces a smaller or cleaner diff. Do not refactor surrounding code that the plan did not call out — see the project's "no scope creep" rule.

### 5.4 — Satisfy each Acceptance Criterion

After each implementation slice, check the acceptance criteria checklist. The run is not complete until every criterion is satisfied. If a criterion turns out to be wrong or impossible mid-implementation, stop and report — do not silently skip it.

### 5.5 — Do NOT touch board APIs

This is a local-only command. Do not post comments, transition tickets, swap labels, or open PRs. The only filesystem writes Step 5 makes are the code changes the plan describes. The only metadata writes are Step 6's log entry.

---

## Step 6 — Log the run

Append a single line to `.clancy/progress.txt` after Step 5 completes. The format mirrors `LOCAL_PLAN`, `LOCAL_REVISED`, and `LOCAL_APPROVE_PLAN` (pipe-delimited, four fields):

**Success:**

```
YYYY-MM-DD HH:MM | {stem} | LOCAL_IMPLEMENT | {N} files
```

Where `{N}` is the total file count from Step 4.2 (`modify + create + delete`).

**Bypass (when `--bypass-approval` was passed and the gate was skipped):**

```
YYYY-MM-DD HH:MM | {stem} | LOCAL_BYPASS | {N} files
```

The `LOCAL_BYPASS` token is written **instead of** `LOCAL_IMPLEMENT`, not in addition to it. Step 8 of `plan.md` (the inventory's `Implemented` state, wired in PR 8.1) treats `LOCAL_BYPASS` the same as `LOCAL_IMPLEMENT` for inventory display — bypass is still an implementation event, just one without an approval audit trail.

**Blocked (no marker):**

```
YYYY-MM-DD HH:MM | {stem} | LOCAL_BLOCKED | not approved
```

**Blocked (malformed marker):**

```
YYYY-MM-DD HH:MM | {stem} | LOCAL_BLOCKED | malformed marker
```

**Blocked (sha mismatch — plan file edited after approval):**

```
YYYY-MM-DD HH:MM | {stem} | LOCAL_BLOCKED | sha mismatch
```

The blocked log entries are written from Step 3, not Step 6 — they fire on the gate failure, before Step 4 ever runs. Step 6 only writes on successful or bypassed completion. The three blocked tokens (`not approved`, `malformed marker`, `sha mismatch`) are all subtypes of `LOCAL_BLOCKED` so a user grepping for `LOCAL_BLOCKED` sees every block, but the qualifier is distinct so they can tell the cases apart.

After logging, print a summary:

```
✓ Implemented: {stem}
  Source: {Source}
  Brief:  {Brief}
  Row:    {Row}
  Files:  {N} ({modify.length} modified, {create.length} created, {delete.length} deleted)

Next: review the diff, run your test suite, and commit when satisfied.
```

The summary does not advance any board state, does not open a PR, and does not commit the changes. Local implement is deliberately commit-free — the user reviews and commits manually.

---

## Notes

- This command does NOT post anything to a board, even in standalone+board or terminal mode. Board push of completion comments is explicitly deferred (possible follow-up)
- This command does NOT run tests automatically after editing — running tests is the user's responsibility (a hard test gate would drag test-runner detection into the workflow). The Test Strategy checklist guides what to test; the user runs the suite
- This command does NOT commit the changes. Local implement is review-then-commit-manually by design
- The terminal verification gate (Stop hook) does not fire for `/clancy:implement-from` because no board-ticket lock file is created. This is correct — local implement is outside the verification-gate lifecycle. Use `/clancy:implement` (terminal) for the board-driven flow with the verification gate
- `--bypass-approval` is required even with `--afk`. The two flags compose but neither implies the other: `--afk` opts out of confirmations, `--bypass-approval` opts out of the approval gate
- Multi-row batch implement-from is not supported. Implement one plan at a time. (Possible follow-up: a `--list` flag for `/clancy:implement-from` parity with `/clancy:plan --list`, and a `--dry-run` flag to preview Affected Files without writing code)
