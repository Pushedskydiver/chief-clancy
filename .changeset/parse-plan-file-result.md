---
'@chief-clancy/dev': minor
---

**BREAKING** — `parsePlanFile` in `@chief-clancy/dev` (re-exported from `src/index.ts`) now returns a tagged Result instead of throwing on malformed plan files:

```ts
// Before
const plan = parsePlanFile(content, slug); // throws on missing header

// After
const result = parsePlanFile(content, slug);
if (!result.ok) {
  // result.error.kind === 'unknown', result.error.message contains the detail
  return handleFailure(result.error.message);
}
const plan = result.plan;
```

Per CONVENTIONS.md §Error Handling — a malformed plan file is user-triggerable (the caller supplies `--from <plan-path>` pointing at `.clancy/plans/*.md`), so it's an expected-failure surface, not an invariant. Minor bump (pre-1.0 breaking) consistent with the PR-I precedent: return shapes of `src/index.ts`-exported functions are observable public contract.

Internal consumer `localTicketSeed` also migrated to return the tagged Result (with `fromPath` added to the error message for context) rather than re-throwing, so the failure propagates through the pipeline's existing `ticketFetch` Result channel with proper phase attribution. `dep-factory.ts`'s `ticketFetch` closure extracted to a named `runTicketFetch` helper to keep `wireTicketPhases` under the 50-line cap.
