# Progress

## Session 47 Summary

Phase 14 (wrapper & publish prep) and Phase 15 (publish) complete. All 3 packages published to npm. READMEs, CREDITS.md, CODE_OF_CONDUCT.md, and all docs written and verified against source code. Command rename applied (`once` → `implement`, `run` → `autopilot`).

**Blocker found:** `npx chief-clancy` fails at install because runtime bundles (`clancy-implement.js`, `clancy-autopilot.js`) don't exist yet. The esbuild config to build them hasn't been created. This is the next piece of work.

---

## Next: Runtime bundle build

### The problem

The installer copies two self-contained scripts to the user's `.clancy/` directory:

- `clancy-implement.js` — single-ticket runner
- `clancy-autopilot.js` — loop runner

These are referenced by `BUNDLE_SCRIPTS` in `packages/terminal/src/installer/install/install.ts`. The installer's `validateSources` function checks they exist at `dist/bundle/` before proceeding. They don't exist because there's no esbuild config to build them.

### Architecture

The bundles must be **completely self-contained** — zero npm dependencies. They run inside the user's project via `node .clancy/clancy-implement.js`, with no access to monorepo node_modules.

Each bundle needs:

- All terminal runner code (CLI bridge, dep factory, prompt builder, notifications, session report)
- All core code (board providers, pipeline phases, lifecycle modules, schemas, types)
- Zod (the `zod/mini` runtime validation)
- An entry point that wires real I/O (process.argv, spawnSync, fetch, fs) into the dependency injection container

### Reference

- Old repo esbuild config: `~/Desktop/alex/clancy/esbuild.config.js` (READ-ONLY reference)
- Existing hook bundler: `packages/terminal/src/hooks/esbuild.hooks.ts` (same pattern to follow)
- Dep factory (defines what deps are needed): `packages/terminal/src/runner/dep-factory/dep-factory.ts`
- Implement runner: `packages/terminal/src/runner/implement/implement.ts`
- Autopilot runner: `packages/terminal/src/runner/autopilot/autopilot.ts`
- Session report: `packages/terminal/src/runner/session-report/session-report.ts`

### Key decisions (already made)

- **Format: ESM** — matches old repo, installer writes `"type": "module"` to `.clancy/package.json`
- **Target: `node22`** — Node 22 is current LTS (through Oct 2027). Don't target node24 as many users won't have it.
- **Zod locale stubbing** — esbuild plugin strips ~243KB of unused locale files (same as old repo)
- **No circular deps** — core → zod, terminal → core. Safe to bundle together.
- **Build order:** tsc → tsc-alias → esbuild hooks → esbuild runtime bundles
- **Esbuild config location:** `src/runner/esbuild.runtime.ts` (compiled by tsc to `dist/runner/esbuild.runtime.js`, same pattern as hooks)

### DA review findings (must address)

1. **`runPipeline` import** — the implement entry point must import `runPipeline` from `@chief-clancy/core` and pass it to `runImplement` as `ImplementOpts.runPipeline`. The plan originally missed this.
2. **`ExecGit` adapter** — needs its own wrapper around `spawnSync('git', args, { encoding: 'utf8' })` with error handling on non-zero exit. Non-trivial glue code.
3. **Autopilot env vars** — `CLANCY_QUIET_START`, `CLANCY_QUIET_END`, `CLANCY_NOTIFY_WEBHOOK`, and `MAX_ITERATIONS` must come from `process.env` directly (NOT from `.clancy/.env`, which isn't loaded until preflight runs inside `runIteration`).
4. **Missing `renameSync`** — `QualityFs.rename` needs `renameSync` from `node:fs`. Add to the fs operations list.
5. **Autopilot entry point is substantial** — not "thin". Must wire: `maxIterations` parsing, `runIteration` closure (full `runImplement` call), `buildReport` via `generateSessionReport`, `sendNotification`, `sleep`, quiet hours, webhook URL.
6. **Entry points must NOT use `import.meta.url` for path resolution** — only for the main-guard pattern. All paths should use `process.cwd()`.

### PRs (small, sequential)

**PR 1a: Implement entry point**

- Create `packages/terminal/src/runner/implement/entrypoint.ts`
- Imports `runImplement` from `./implement.js`, `runPipeline` from `@chief-clancy/core`, `buildPipelineDeps` from `../dep-factory/`
- Builds all 5 FS adapters from real `node:fs`: `LockFs`, `ProgressFs`, `CostFs`, `QualityFs`, `EnvFileSystem`
  - Key fs operations: `readFileSync`, `writeFileSync`, `existsSync`, `mkdirSync`, `unlinkSync`, `appendFileSync`, `lstatSync`, `readdirSync`, `renameSync`
- Builds `ExecGit` adapter: wraps `spawnSync('git', args, { cwd, encoding: 'utf8' })`, throws on non-zero exit
- Reads `process.argv` for flags (`--dry-run`, `--skip-feasibility`)
- Sets `isAfk: false`
- Calls `runImplement` with full opts
- TDD: test the adapter functions in isolation

**PR 1b: Autopilot entry point**

- Create `packages/terminal/src/runner/autopilot/entrypoint.ts`
- Substantially more wiring than implement:
  - Parses `MAX_ITERATIONS` from `process.env` (default: 5)
  - Reads `CLANCY_QUIET_START`, `CLANCY_QUIET_END` from `process.env`
  - Reads `CLANCY_NOTIFY_WEBHOOK` from `process.env`
  - Builds `runIteration` closure — constructs a full `runImplement` call per iteration with `isAfk: true`
  - Builds `buildReport` via `generateSessionReport` (needs `ProgressFs`, `QualityFs`, `projectRoot`)
  - Builds `sendNotification` from `../notify/`
  - Builds `sleep` from `node:timers/promises`
- Calls `runAutopilot` with full opts
- TDD: test env var parsing, iteration wiring

**PR 2: Esbuild config**

- Create `packages/terminal/src/runner/esbuild.runtime.ts`
- Entry points: `dist/runner/implement/entrypoint.js` and `dist/runner/autopilot/entrypoint.js`
- Output: `dist/bundle/clancy-implement.js` and `dist/bundle/clancy-autopilot.js`
- Shared config: `bundle: true`, `platform: 'node'`, `format: 'esm'`, `target: 'node22'`, `minify: true`, `treeShaking: true`
- Include `stubZodLocales` plugin (same as old repo — intercepts `locales/index.js` from zod, replaces with empty export)
- Update terminal `package.json` build script to chain: `&& node dist/runner/esbuild.runtime.js`
- Test: bundles exist after build, are valid JS, can be loaded without errors

**PR 3: Smoke tests + publish**

- Add bundle existence tests (similar to `test/integration/hooks/bundle-smoke.test.ts`)
- Verify bundles load cleanly (`import()` without errors)
- Create changeset bumping terminal + chief-clancy
- Verify `npx chief-clancy` works end-to-end after publish

### Exit criteria

`npx chief-clancy` installs successfully, copies runtime bundles to `.clancy/`, and the user can run `/clancy:implement` via `node .clancy/clancy-implement.js`.
