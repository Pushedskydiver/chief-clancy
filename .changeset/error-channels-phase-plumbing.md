---
'@chief-clancy/dev': minor
'@chief-clancy/terminal': patch
'@chief-clancy/core': patch
---

The `feasibility`, `invoke`, and `deliver` pipeline phases now return tagged
`{ ok: false, error: { kind, message } }` results, matching the shape
established for `preflight`, `ticketFetch`, and `branchSetup` in #357 / #359.

- **Feasibility** (`PipelineDeps.feasibility`): `{ ok: true; skipped: boolean }`
  on success; `{ ok: false; error: { kind: 'not-feasible' | 'check-failed';
message: string } }` on failure. The `check-failed` kind is shape parity —
  `checkFeasibility` remains fail-open at the lifecycle layer, so the variant
  is unreachable in practice.
- **Invoke** (`PipelineDeps.invoke`): consumes the captured stderr from
  PR-1's `invokeClaudeSession` and surfaces it as `error.message`. Falls
  back to `'Claude session exited non-zero (no stderr captured)'` when
  stderr is empty.
- **Deliver** (`PipelineDeps.deliver`): tagged `'push-failed'` when
  `pushBranch` returns false (generic message — capturing git stderr is
  deferred to a `pushBranch` upgrade). Tagged `'pr-creation-failed'` when
  push succeeds but the PR API call returned a tagged error (excludes
  the `alreadyExists` case).

The terminal display now surfaces `error.message` on aborted pipelines so
operators see why a phase halted.

**Behaviour change.** PR-creation failure (push succeeded, PR API failed)
now halts the deliver phase as `ok: false` and writes a new
`PR_CREATION_FAILED` progress status (additive enum on
`@chief-clancy/core`). Previously the failure was silently mapped to
`PUSHED` and the loop continued through `recordDelivery` / `cost` /
`cleanup`. The new failure branch correctly skips `recordDelivery`,
`removeBuildLabel`, `cost`, and `cleanup` for failed deliveries; the
autopilot loop continues to the next ticket per `stop-condition.ts`'s
`deliver`-non-fatal classification.

**Side-effects of the new `PR_CREATION_FAILED` status.** The enum is added
to the type union only — it is not yet a member of `DELIVERED_STATUSES`,
`COMPLETED_STATUSES`, or `FAILED_STATUSES`. Operator-visible via
PROGRESS.md and the new aborted-pipeline error display. `pr-retry` (which
scans for `PUSHED` entries) no longer auto-retries PR-creation-failed
deliveries — operator intervention is the new contract for that path.
Future refinement may classify `PR_CREATION_FAILED` into the existing sets
or update `pr-retry`'s scan to include it.
