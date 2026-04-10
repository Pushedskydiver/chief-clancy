---
'@chief-clancy/dev': minor
---

📦 chore(dev): scaffold @chief-clancy/dev package skeleton

Phase E PR 1 — initial empty scaffold for `@chief-clancy/dev`. Ships as `private: true` at version `0.0.0` per the standard practice for new packages (`feedback_private_until_ready.md`). Will be flipped to `private: false` and bumped to `0.1.0` in Phase E PR 13.5 once the executor surface is complete.

The skeleton includes:

- `package.json` mirroring the brief/plan structure (zero runtime deps, ESM, standard scripts)
- `tsconfig.json` extending the root with `~/d/*` path alias
- `tsconfig.build.json` for the build pipeline
- `vitest.config.ts` registering the `dev` test project
- `src/index.ts` exporting only `PACKAGE_NAME` (matches brief/plan template)
- `src/index.test.ts` asserting the export
- `README.md` describing the eventual surface

No source code is moved in this PR. The lifecycle and pipeline modules will be moved across PRs 2a/2b/2c (lifecycle) and 3a/3b (pipeline). See `docs/decisions/architecture/package-evolution.md` "Phase E — `@chief-clancy/dev` extraction decisions" for the full Phase E plan.
