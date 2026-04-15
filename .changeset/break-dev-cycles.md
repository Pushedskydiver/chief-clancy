---
'@chief-clancy/dev': patch
---

Break two pre-existing madge cycles in `packages/dev/src` via shared-module extracts. Extract `resolveBuildLabel` + `DEFAULT_BUILD_LABEL` to `dep-factory/build-label.ts`; extract `PlatformReworkHandlers` + `ReworkCtx` to `lifecycle/rework/rework-types.ts`. No runtime behaviour change.
