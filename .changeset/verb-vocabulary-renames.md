---
'@chief-clancy/dev': minor
'@chief-clancy/core': patch
---

Rename `compute*` and `attempt*` functions per verb vocabulary convention.

**Breaking (dev):** `computeTicketBranch` → `ticketBranch`, `computeTargetBranch` → `targetBranch`, `computeDeliveryOutcome` → `deliveryOutcome`, `attemptPrCreation` → `createPr`. Internal `computeDrift` → `drift`.

**Internal (core):** `attemptFetch` → `fetchLoop` (private, not exported).
