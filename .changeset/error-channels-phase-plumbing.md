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

**`PR_CREATION_FAILED` status-set membership.** Added to `FAILED_STATUSES`
(operator-visible failure surface — counted in AFK session reports
alongside `PUSH_FAILED` / `SKIPPED` / `TIME_LIMIT`). Deliberately NOT
added to `DELIVERED_STATUSES`: the branch is on the remote, but classifying
it as already-delivered would let `resume.ts` skip the manual retry path,
defeating the operator-driven retry contract. NOT added to
`COMPLETED_STATUSES`: the work is not completed when PR creation fails.
`pr-retry` (which scans for `PUSHED`) does not auto-retry these — operator
intervention is the contract.

**Round-trip-safe parser.** `dev/lifecycle/progress.ts:VALID_STATUSES`
extended to include `PR_CREATION_FAILED` so `parseProgressFile` round-trips
the new entries (regression test added covering every literal in
`ProgressStatus`).
