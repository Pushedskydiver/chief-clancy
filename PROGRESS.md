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
- A thin entry point that wires real I/O (process.argv, spawnSync, fetch, fs) into the dependency injection container

### Reference

- Old repo esbuild config: `~/Desktop/alex/clancy/esbuild.config.js` (READ-ONLY reference)
- Existing hook bundler: `packages/terminal/src/hooks/esbuild.hooks.ts` (same pattern to follow)
- Dep factory (defines what deps are needed): `packages/terminal/src/runner/dep-factory/dep-factory.ts`
- Implement runner: `packages/terminal/src/runner/implement/implement.ts`
- Autopilot runner: `packages/terminal/src/runner/autopilot/autopilot.ts`

### Key decisions (already made)

- **Format: ESM** — Node 24+ native, matches old repo, installer writes `"type": "module"` to `.clancy/package.json`
- **Zod locale stubbing** — esbuild plugin strips ~243KB of unused locale files (same as old repo)
- **No circular deps** — core → zod, terminal → core. Safe to bundle together.
- **Build order:** tsc → tsc-alias → esbuild hooks → esbuild runtime bundles

### PRs (small, sequential)

**PR 1: Entry points** — Create the two entry point files that wire real dependencies

- Create `packages/terminal/src/runner/implement/entrypoint.ts`
- Create `packages/terminal/src/runner/autopilot/entrypoint.ts`
- Each imports from existing modules, creates real fs/git/spawn/fetch implementations, calls `runImplement`/`runAutopilot`
- Reference `dep-factory.ts` for the `DepFactoryOpts` shape — the entry points build these from real Node APIs
- Key deps to wire: `process.argv`, `process.cwd()`, `spawnSync`, `globalThis.fetch`, real `fs` operations (readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, appendFileSync, lstatSync, readdirSync)
- TDD: test that entry points export the expected function, mock I/O

**PR 2: Esbuild config** — Create the bundle build config

- Create `packages/terminal/esbuild.runtime.ts` (sits alongside source, runs post-tsc like hooks)
- Entry points: `dist/runner/implement/entrypoint.js` and `dist/runner/autopilot/entrypoint.js`
- Output: `dist/bundle/clancy-implement.js` and `dist/bundle/clancy-autopilot.js`
- Shared config: `bundle: true`, `platform: 'node'`, `format: 'esm'`, `target: 'node24'`, `minify: true`, `treeShaking: true`
- Include `stubZodLocales` plugin
- Update terminal `package.json` build script to chain: `&& node dist/runner/esbuild.runtime.js`
- Test: bundles exist after build, are valid JS, can be loaded without errors

**PR 3: Smoke tests** — Verify bundles work end-to-end

- Add bundle existence tests (similar to `test/integration/hooks/bundle-smoke.test.ts`)
- Verify bundles load cleanly (`import()` without errors)
- Verify `npx chief-clancy --local` completes without `validateSources` errors
- Update terminal `files` field if `dist/bundle/` isn't already included (it's under `dist/` so should be fine)

**PR 4: Publish** — Changeset + publish

- Create changeset bumping terminal (bundles are now included)
- Verify `npx chief-clancy` works end-to-end after publish

### Exit criteria

`npx chief-clancy` installs successfully, copies runtime bundles to `.clancy/`, and the user can run `/clancy:implement` via `node .clancy/clancy-implement.js`.
