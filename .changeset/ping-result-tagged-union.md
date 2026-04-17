---
'@chief-clancy/core': major
'@chief-clancy/dev': patch
'@chief-clancy/terminal': patch
---

**BREAKING** — `PingResult` in `@chief-clancy/core/types/board.js` is now a proper discriminated union:

```ts
// Before
type PingResult = { ok: boolean; error?: string };

// After
type PingResult =
  | { ok: true }
  | { ok: false; error: { kind: 'unknown'; message: string } };
```

Per CONVENTIONS.md §Error Handling — the `error` channel is a tagged discriminated union (house shape: `{ ok: false, error: { kind: '<tag>', ...context } }`), ergonomically close to a bare string but on a typed chassis for future widening (`kind: 'auth'`, `kind: 'network'`, etc.) without string parsing.

Consumers must read `result.error.message` where they previously read `result.error`. `pingEndpoint` and all 6 board adapters (github, jira, linear, notion, azdo, shortcut) updated. Dev's `preflight-phase.ts` cascade updated. ~20 test assertion sites migrated to `toMatchObject({ error: { kind: 'unknown', message: expect.stringContaining(...) } })`.
