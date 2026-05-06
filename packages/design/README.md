# @chief-clancy/design

**AI-design tool for Claude Code.**

> [!WARNING]
> Phase F — slice 1 (package scaffolding) only. The detection layer, variant
> generation, canvas server, and slash commands land in subsequent slices per
> `.claude/research/phase-f-design-system/path-b-local-spec.md`. The package
> is `private: true` until slice 29 ships v0.1.0.

## What it will do (v0.1)

- `clancy:design init` — greenfield grill writing starter `DESIGN.md` + `PRODUCT.md`
- `clancy:design document` — detect Tailwind / CSS vars / `tokens.json` / shadcn → write design docs
- `clancy:design canvas` — open a local canvas server (React 19 + Vite) for variant iteration with element-pick + inline comments
- `clancy:design write <variant-id>` — write an accepted variant to source
- `clancy:design handoff <ticket>` — bundle DESIGN.json + accepted variant + accessibility assertions for downstream pipeline

## Composition with Clancy (planned)

When v0.1 ships, standalone install (`npx @chief-clancy/design --local`) will
be the fast-path; the full pipeline (`npx chief-clancy`) will bundle the
Designer role alongside Brief / Plan / Dev. Same package source code, two
install paths. Slice 27 wires the bundled-mode integration; until then, the
package is `private: true` and no `npx` entry point is published.

## Part of the Clancy monorepo

- [`chief-clancy`](https://www.npmjs.com/package/chief-clancy) — full pipeline (install, configure, implement, autopilot)
- [`@chief-clancy/core`](https://www.npmjs.com/package/@chief-clancy/core) — board integrations, schemas, shared utilities
- [`@chief-clancy/terminal`](https://www.npmjs.com/package/@chief-clancy/terminal) — installer, slash commands, hooks, runners
- [`@chief-clancy/dev`](https://www.npmjs.com/package/@chief-clancy/dev) — standalone ticket executor
- [`@chief-clancy/scan`](https://www.npmjs.com/package/@chief-clancy/scan) — codebase scanning agents and workflows
- [`@chief-clancy/brief`](https://www.npmjs.com/package/@chief-clancy/brief) — strategic brief generator
- [`@chief-clancy/plan`](https://www.npmjs.com/package/@chief-clancy/plan) — implementation planner

## License

MIT — see [LICENSE](https://github.com/Pushedskydiver/chief-clancy/blob/main/LICENSE).
