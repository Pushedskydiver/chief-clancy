---
'@chief-clancy/core': major
'@chief-clancy/dev': patch
---

**BREAKING** — `PrCreationFailure` in `@chief-clancy/core/types/remote.js` now carries a tagged error channel per CONVENTIONS.md §Error Handling:

```ts
// Before
type PrCreationFailure = {
  ok: false;
  error: string;
  alreadyExists?: boolean;
};

// After
type PrCreationFailure = {
  ok: false;
  error: { kind: 'unknown'; message: string };
  alreadyExists?: boolean;
};
```

Ergonomically close to a bare string but on a typed chassis — future widening adds variants (`kind: 'network'`, `kind: 'auth'`) without string parsing. Consumers must read `result.error.message` where they previously read `result.error`. `postPullRequest` helper (the single source of failure construction for all 5 git-host paths: github, gitlab, azdo, bitbucket cloud, bitbucket server) + `deliveryOutcome` consumer updated. ~10 test assertion sites migrated.

Semver: `major` (3.0.0 → 4.0.0). The Session 96 plan originally called for patch scoped to "2.0.x" under the assumption that PR-G + PR-G2 + PR-H would all batch into a single 2.0.0. Since PR-G and PR-G2 shipped as separate majors (2.0.0 and 3.0.0 respectively), PR-H's public-type shape change is its own breaking release — consistent with the precedents already set.
