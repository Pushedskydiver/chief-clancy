---
'@chief-clancy/dev': minor
'@chief-clancy/terminal': patch
---

Migrate `PipelineDeps` inline error contracts to the tagged `{ kind: 'unknown'; message: string }` house shape per `docs/CONVENTIONS.md` §Error Handling. Completes the sweep started by the `branchSetup` migration in PR-I.

**Breaking (pre-1.0 minor):** `PipelineDeps` is re-exported from `@chief-clancy/dev`'s public surface, so consumers who type against `PipelineDeps.preflight` / `PipelineDeps.ticketFetch` on the failure branch will see a shape change from `{ error?: string }` to `{ error: { kind: 'unknown'; message: string } }` (preflight) or `{ error?: { kind: 'unknown'; message: string } }` (ticketFetch).

**Changes:**

- `PipelineDeps.preflight` — migrated to tagged `{ ok: true; warning? } | { ok: false; error: { kind; message }; warning? }`. `PreflightPhaseResult` + `PreflightCheckResult` in `pipeline/phases/preflight-phase.ts` also migrated. `wirePreflight` adapts the legacy `runPreflight` (`lifecycle/preflight/preflight.ts`) to the tagged shape via a `runPreflightTagged` helper — the legacy file itself is untouched and slated for a follow-up peer sweep.
- `PipelineDeps.ticketFetch` — migrated to tagged shape. The `TicketFetchResult` phase alias itself has no `error` field; errors originate only in dep-factory's `runTicketFetch` wrapper via `localTicketSeed`, which now forwards the tagged `seed.error` directly.
- `PipelineDeps.feasibility` / `invoke` / `deliver` — dropped dead `error?: string` fields. The phase-impls never populated them (`FeasibilityPhaseResult`, `makeInvokePhase` return type, `DeliverPhaseResult` all have no `error` field), so the three `.error` reads in `run-pipeline.ts` always evaluated to `undefined`. No phase-impl changes; whether to plumb real error channels through these three phases is a separate design decision deferred to a future workstream.

**Remaining legacy sites (follow-up sweep):** 4 `error: string` sites on execute/lifecycle paths — `execute/single.ts` `GateResult`, `execute/readiness/readiness-gate.ts` `GateFailed`, `execute/flags/readiness-flags.ts` readiness-flags literal, `lifecycle/preflight/preflight.ts` `PreflightResult`. Tracked by the new `TODO(legacy-error-shape-sweep)` anchor at `execute/single.ts`.

**Follow-up bug fix (same sweep):** Copilot flagged that `wirePreflight` was adapting a git-only `ExecGit` into `PreflightDeps.exec` (an arbitrary-binary executor) — so binary probes like `claude --version` became `git claude --version` and failed unconditionally. Fix threads a separate `execCmd: ExecCmd` dep through `DepFactoryOpts`/`wirePreflight`/terminal's pipeline-wiring; new `makeExecCmd` adapters in both `dev/entrypoints/adapters.ts` and `terminal/entrypoints/implement.ts` spawn arbitrary binaries correctly. `ExecCmd` is now re-exported from `@chief-clancy/dev` for terminal's consumption. **Terminal consumers of `buildPipelineDeps` must pass `execCmd`** (internal to this monorepo — no external `terminal` consumers exist).
