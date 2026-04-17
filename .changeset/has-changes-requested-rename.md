---
'@chief-clancy/core': major
'@chief-clancy/dev': patch
---

**BREAKING** — `PrReviewState.changesRequested` in `@chief-clancy/core/types/remote.js` is renamed to `PrReviewState.hasChangesRequested` per CONVENTIONS.md §Code Style Rule 13 (boolean naming: `is*/has*/can*/should*` prefix). Reads as a question at call sites (`if (reviewState?.hasChangesRequested)`).

12 consumer sites migrated across `@chief-clancy/dev` (6 source: `rework.ts`, `github.ts`, `azdo.ts`, `gitlab.ts`, `bitbucket/server.ts`, `bitbucket/cloud.ts`; 6 test files). An internal `ReviewCheckResult.changesRequested` in `github.ts` (mirrors the GitHub API's `CHANGES_REQUESTED` state) was renamed alongside for local consistency.

Paired with the `PingResult` tagged-union change — both land on the same `core@2.0.0` major release (batched via changesets).
