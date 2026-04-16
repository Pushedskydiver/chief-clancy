---
'@chief-clancy/dev': minor
'@chief-clancy/core': patch
---

Rename `compute*` and `attempt*` functions per verb vocabulary convention.

**Breaking (dev):** `computeTicketBranch` → `ticketBranch`, `computeTargetBranch` → `targetBranch`, `attemptPrCreation` → `createPr`. Internal: `computeDeliveryOutcome` → `deliveryOutcome`, `computeDrift` → `drift`.

**Internal (core):** `attemptFetch` → `fetchLoop` (private, not exported).
