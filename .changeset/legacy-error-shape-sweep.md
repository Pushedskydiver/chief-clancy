---
'@chief-clancy/dev': minor
---

Complete the tagged-error-shape sweep — the 4 peer sites deferred from the pipeline sweep in 0.8.0 (tracked by the `TODO(legacy-error-shape-sweep)` anchor at `execute/single.ts`) are now migrated to the house `{ kind: 'unknown'; message: string }` shape per `docs/CONVENTIONS.md` §Error Handling.

**Breaking (pre-1.0 minor):** four public-API-adjacent surfaces change shape on the failure branch:

- `ReadinessFlagsResult.error` — the failure branch of `parseReadinessFlags`'s return type changes from `error: string` to `error: { kind: 'unknown'; message: string }`. `parseReadinessFlags` is re-exported from `@chief-clancy/dev`.
- `GateFailed.error` — the failure branch of `runReadinessGate`'s return type changes from `error?: string` to `error?: { kind: 'unknown'; message: string }`. `runReadinessGate` is re-exported from `@chief-clancy/dev`.
- `SingleTicketDeps.readinessGate` — the injected readiness-gate function's return type (a structurally-duplicated `GateResult` in `execute/single.ts`) gets the same shape change. `SingleTicketDeps` is re-exported from `@chief-clancy/dev`.
- `PreflightResult` — migrated to a discriminated union matching `PreflightCheckResult` (the pipeline-phase alias) exactly: `{ ok: true; warning?; env? } | { ok: false; error: { kind; message }; warning? }`. `runPreflight` is re-exported from `@chief-clancy/dev` (the return type is observable via inference).

**Consumer cascades (internal):** `execute/single.ts`'s `checkReadiness` extracts `.message` at two call sites that previously assigned the bare-string error directly into `PipelineResult.error` (a display-only boundary surface that stays `string`).

**Simplification:** `runPreflightTagged` adapter in `dep-factory/local-wiring.ts` is deleted — once `PreflightResult` itself is the tagged shape, the translation layer is unnecessary. `wirePreflight` calls `runPreflight` directly.

**Scope closed:** the `TODO(legacy-error-shape-sweep)` anchor at `execute/single.ts` is removed. No further error-shape migrations are tracked.
