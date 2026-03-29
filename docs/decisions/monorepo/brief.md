# Brief: Monorepo — `@chief-clancy` workspace

**Status:** Approved
**Prerequisite:** v0.8.24 shipped
**Type:** Architecture
**Date:** 2026-03-23

---

## Problem

Clancy is a single npm package (`chief-clancy`) that bundles board intelligence, ticket lifecycle, slash commands, hooks, and agent prompts into one artifact. The internal module structure has grown organically — board logic lives in `src/scripts/board/`, shared utilities in `src/scripts/shared/`, types are scattered across `src/types/` and inline definitions. There is no formal public API boundary.

This creates three problems:

1. **No reuse path.** The MCP server and conversational chat interface (both planned) need board intelligence without terminal machinery. Today, that means importing the entire package or duplicating logic.
2. **No enforced architecture.** Nothing prevents a board module from importing a CLI utility, or a phase from reaching into the installer. Dependencies are implicit, not declared.
3. **Accumulated debt.** The codebase has grown through 22 point releases of feature work. Some modules would benefit from being rewritten with stricter quality standards rather than incrementally patched.

---

## Proposed solution

Build a fresh monorepo from scratch. Set up all tooling, standards, and infrastructure before writing any application code. Then bring modules over from the existing Clancy codebase one at a time, rewriting where quality or clarity can be improved.

This is not a migration — it is a rebuild with the existing codebase as reference material. Every module gets inspected and either carried over (if it meets the new standards) or rewritten (if it can be simpler, clearer, or better structured). There is no rush.

---

## Packages

| Workspace               | npm name                 | Purpose                                                                                                          |
| ----------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `packages/core`         | `@chief-clancy/core`     | Board type, factory, 6 board implementations, schemas, types, ticket lifecycle, phase pipeline, shared utilities |
| `packages/terminal`     | `@chief-clancy/terminal` | Installer, slash commands, hooks, AFK runner, agents, Claude CLI bridge, prompt builder, notifications           |
| `packages/chief-clancy` | `chief-clancy`           | Thin bin wrapper — `npx chief-clancy` delegates to `@chief-clancy/terminal`                                      |
| `packages/chat`         | `@chief-clancy/chat`     | Future — MCP server, Chat SDK bot. Not built until demand exists.                                                |

---

## Toolchain

| Tool                                    | Purpose                                                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **pnpm**                                | Package manager — strict dependency isolation, `workspace:*` protocol, fixes existing npm CI bug with platform-specific optional deps. Turborepo's recommended PM. |
| **Turborepo**                           | Build orchestration — topological build order (`^build` dependency syntax), caching, parallel execution. One `turbo.json` file.                                    |
| **@changesets/cli**                     | Versioning — cross-package version bumps, changelog generation, publish coordination.                                                                              |
| **Vitest**                              | Testing — root workspace config with per-package `defineProject`. Existing framework, no change.                                                                   |
| **eslint (flat config)**                | Single root config. Plugins: `@typescript-eslint`, `prettier`, `functional`, `sonarjs`, `boundaries`.                                                              |
| **@ianvs/prettier-plugin-sort-imports** | Import ordering — type imports first, then built-ins, then third-party, then workspace, then local.                                                                |
| **knip**                                | Dead code detection — unused files, exports, dependencies.                                                                                                         |
| **publint**                             | Package.json validation — export conditions, missing files, dual-package hazard.                                                                                   |
| **@arethetypeswrong/cli**               | TypeScript resolution validation — CJS/ESM module mode correctness.                                                                                                |
| **fast-check**                          | Property-based testing for pure utility functions.                                                                                                                 |

---

## Code quality standards

### Complexity limits (eslint)

| Rule                           | Limit                      | Rationale                                                                        |
| ------------------------------ | -------------------------- | -------------------------------------------------------------------------------- |
| `complexity` (cyclomatic)      | 10                         | NIST standard. Forces extraction of complex logic.                               |
| `sonarjs/cognitive-complexity` | 15                         | Penalises nesting over flat branching. More forgiving for early-return patterns. |
| `max-lines-per-function`       | 50 (skip blanks/comments)  | Forces decomposition. If a function needs 51 lines, it's doing two things.       |
| `max-lines` (per file)         | 300 (skip blanks/comments) | Keeps modules focused.                                                           |
| `max-params`                   | 3                          | Forces options objects. Self-documenting call sites.                             |
| `max-depth`                    | 3                          | No deep nesting. Forces early returns and extraction.                            |

### Functional rules (eslint-plugin-functional)

| Rule                   | Setting                                        | Notes                                                                         |
| ---------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| `no-let`               | error                                          | `const` everywhere. Disable per-line where genuinely needed.                  |
| `immutable-data`       | error (ignoreImmediateMutation, ignoreClasses) | No `obj.foo = bar`, no `arr.push()`. Spread/concat. Test files exempt.        |
| `prefer-readonly-type` | warn (allowLocalMutation)                      | Function params marked readonly. Gradual adoption.                            |
| `no-loop-statements`   | warn                                           | Prefer `.map()/.filter()`. Disable for orchestration where loops are clearer. |

### Architecture enforcement (eslint-plugin-boundaries)

| Rule                                       | Effect   |
| ------------------------------------------ | -------- |
| Core imports nothing from terminal or chat | Enforced |
| Terminal imports from core only            | Enforced |
| Chat imports from core only                | Enforced |
| No cross-imports between terminal and chat | Enforced |

### Import ordering (@ianvs/prettier-plugin-sort-imports)

```typescript
// 1. Type imports (from anywhere)
import type { Board } from '@chief-clancy/core';
import type { RequestInit } from 'node:http';

// 2. Node built-ins
import { resolve } from 'node:path';

// 3. Third-party
import { z } from 'zod/mini';

// 4. Workspace packages
import { createBoard } from '@chief-clancy/core';

// 5. Local
import { parseBranchName } from '../branch/branch.js';
import { ANSI } from './ansi.js';
```

Prettier config:

```json
{
  "plugins": ["@ianvs/prettier-plugin-sort-imports"],
  "importOrder": [
    "<TYPES>",
    "",
    "<BUILTIN_MODULES>",
    "",
    "<THIRD_PARTY_MODULES>",
    "",
    "^@chief-clancy/",
    "",
    "^[./]"
  ],
  "importOrderTypeScriptVersion": "5.9.3"
}
```

Enforced on save and pre-commit via prettier. Zero manual effort after setup.

### Code style standards

- **No `reduce()`.** Use explicit loops or `.map()/.filter()` chains. Readability over cleverness.
- **No long ternaries.** If it doesn't fit on one line, use `if/else` or extract a function.
- **No nested ternaries.** Ever.
- **JSDoc on all exported functions.** Description, `@param` for each parameter, `@returns`. Not on internal helpers where types make it obvious.
- **Explicit return types on exported functions.** TypeScript inference is for internal code, not public API.
- **No `any`.** Use `unknown` + type narrowing. `as` casts only where structurally justified with a comment explaining why.
- **Pure functions by default.** Side effects (HTTP, git, filesystem) isolated to boundary functions. Pure logic extracted into separate functions that take data in and return data out.
- **Dependency injection via function parameters** for I/O. Pass `fetch`, pass `exec` — don't import live implementations in pure logic modules.
- **Options objects for 3+ parameters.** Named properties, self-documenting call sites.
- **Max one level of function nesting.** No functions defined inside functions defined inside functions.

### Testing standards

- **Co-located tests** — `<name>/<name>.test.ts` next to source.
- **Unit tests for every exported function** — no exceptions.
- **Property-based tests** (fast-check) for parsers, serialisers, URL builders, string transformers.
- **Integration tests** for cross-module workflows (MSW-backed, in `packages/terminal/test/integration/`).
- **Coverage threshold: 80%** per package (statements, branches, functions, lines).
- **TDD for new logic.** When rewriting a module, write tests first against the desired interface, then implement.
- **Tests exempt from functional rules** — `immutable-data` off, `max-lines-per-function` off, `no-duplicate-string` off in test files.

---

## Versioning

| Package                  | Initial version | Rationale                                           |
| ------------------------ | --------------- | --------------------------------------------------- |
| `@chief-clancy/core`     | 0.1.0           | New package, proven code, unstable API surface.     |
| `@chief-clancy/terminal` | 0.1.0           | New package, proven code, unstable API surface.     |
| `chief-clancy` (wrapper) | 0.9.0           | Continues existing lineage, becomes thin re-export. |

Independent versioning. Coordinated v1.0.0 release when API surfaces are stable and validated by a second consumer (MCP server).

**No npm publishing until the monorepo reaches feature parity with current Clancy.** GitHub release tags only during development.

---

## Repository structure

```
chief-clancy/
  packages/
    core/
      src/
        board/             # Board type, factory, 6 implementations
          factory/
          jira/
          github/
          linear/
          shortcut/
          notion/
          azdo/
          board.ts         # Board interface
          index.ts         # Barrel export
        lifecycle/         # Ticket lifecycle modules
          fetch-ticket/
          deliver/
          rework/
          pr-creation/
          lock/
          cost/
          resume/
          quality/
          index.ts
        pipeline/          # Phase pipeline
          phases/          # 13 pure phases (invoke is terminal's responsibility)
          context/
          index.ts
        schemas/           # Zod validation
          env.ts
          jira.ts
          github.ts
          linear.ts
          shortcut.ts
          notion.ts
          azdo.ts
          index.ts
        types/             # Shared type definitions
          board.ts
          remote.ts
          index.ts
        shared/            # Pure utilities
          git-ops/
          env-parser/
          env-schema/
          branch/
          progress/
          format/
          remote/
          http/
          feasibility/
          pull-request/
          index.ts
        index.ts           # Package barrel export
      package.json
      tsconfig.json
      tsconfig.build.json
      vitest.config.ts
      CHANGELOG.md
    terminal/
      src/
        installer/         # install.ts, file-ops, hook-installer, manifest, prompts, ui
        roles/             # 5 roles (50+ .md files)
        afk/               # AFK runner + session reports
        agents/            # 7 agent prompts
        templates/         # CLAUDE.md template
        shared/            # Terminal-specific utilities
          claude-cli/
          prompt/
          notify/
          ansi/
        index.ts
      hooks/               # 9 pre-built CommonJS hooks
      test/
        integration/       # MSW-backed flow tests
      esbuild.config.js
      package.json
      tsconfig.json
      tsconfig.build.json
      vitest.config.ts
      CHANGELOG.md
    chief-clancy/          # Thin wrapper
      bin/
        clancy.js
      package.json
    chat/                  # Future — empty scaffold
      src/
        index.ts
      package.json
      tsconfig.json
  docs/                    # Project documentation
  turbo.json
  eslint.config.ts
  .prettierrc
  .editorconfig
  vitest.config.ts         # Root workspace config
  pnpm-workspace.yaml
  package.json             # Root (private, not published)
  tsconfig.json            # Base config (shared compiler options)
  knip.json
  CLAUDE.md
  README.md
```

---

## Build order

```
turbo.json:
  build: dependsOn ["^build"]  →  core builds first, terminal second
  test:  dependsOn ["^build"]  →  core's dist exists before terminal tests run
  lint:  no dependencies       →  runs in parallel
```

---

## CI pipeline

Two required status checks (preserving existing branch protection naming):

**"Unit tests"** — typecheck + lint + build + test (all packages)
**"Integration tests"** — depends on Unit tests, runs terminal integration suite

Plus non-blocking checks: knip (dead code), publint (package validation), attw (type resolution).

---

## Release workflow

- GitHub release tags only during development (no npm publish)
- Tag convention: `core@0.1.0`, `terminal@0.1.0`
- When ready for npm: Changesets handles the publish flow
- `chief-clancy` wrapper published last, depends on `@chief-clancy/terminal` being live

---

## Documentation migration

Every doc from the existing Clancy repo gets one of four treatments:

| Action                  | When                | What it means                                                                |
| ----------------------- | ------------------- | ---------------------------------------------------------------------------- |
| **Rewrite**             | Phase 1 or Phase 14 | Content is obsolete or fundamentally changed by the monorepo. Written fresh. |
| **Carry over + update** | Phase 14            | Core content is sound. Paths, commands, and tooling references updated.      |
| **Carry over + review** | Phase 14            | Content describes behaviour, not internals. Light review for accuracy.       |
| **Carry over as-is**    | Phase 1             | No changes needed. Historical or conceptual content.                         |

### Phase 1 docs (scaffold — guides every session from day one)

| Doc                     | Action                 | Notes                                                                                                                                                                                                      |
| ----------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CLAUDE.md**           | Rewrite                | Primary AI development interface. Monorepo paths, pnpm/turbo commands, quality standards, phase validation protocol, session pattern. Every session reads this first — it must be accurate from the start. |
| **docs/CONVENTIONS.md** | Rewrite                | Codifies all quality standards before any code is written: complexity limits, functional rules, import ordering, JSDoc requirements, pure function patterns, testing standards. The rulebook for every PR. |
| **docs/GLOSSARY.md**    | Carry over + additions | Existing terms still apply. Add: core, terminal, barrel export, workspace, phase validation, invoke strategy, dependency direction, changeset.                                                             |
| **docs/decisions/**     | Carry over as-is       | Full decision history from the old repo. Includes this monorepo brief.                                                                                                                                     |
| **docs/GIT.md**         | Carry over + update    | Branch strategy unchanged. Update: pnpm commands, changeset workflow, monorepo PR conventions.                                                                                                             |
| **docs/DEVELOPMENT.md** | Rewrite                | New development process: phase validation protocol, session pattern, DA reviews, changeset-based releases.                                                                                                 |

### Phase 14 docs (publish prep — describes what was built)

| Doc                                | Action              | Notes                                                                                                                                      |
| ---------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **docs/ARCHITECTURE.md**           | Rewrite             | Module map, function inventory, dependency graph, core→terminal boundary, barrel exports. Can only be accurate after all code is in place. |
| **docs/VISUAL-ARCHITECTURE.md**    | Rewrite             | Mermaid diagrams: package boundaries, build pipeline, monorepo structure.                                                                  |
| **docs/TESTING.md**                | Rewrite             | Per-package vitest configs, fast-check, TDD approach, coverage per package, final test counts.                                             |
| **docs/TECHNICAL-REFERENCE.md**    | Rewrite             | Board details, hook mechanics, delivery pipeline, build system — all with new paths and tooling.                                           |
| **docs/SELF-REVIEW.md**            | Carry over + update | Add: cross-package import checks, barrel export completeness, boundary violations, bundle verification.                                    |
| **docs/LIFECYCLE.md**              | Carry over + review | Describes user-facing ticket flow, not internals. Still accurate.                                                                          |
| **docs/COMPARISON.md**             | Carry over as-is    | Historical context. Still valid.                                                                                                           |
| **docs/roles/\*.md** (5 files)     | Carry over + review | Role descriptions are behavioural. Light review.                                                                                           |
| **docs/guides/CONFIGURATION.md**   | Carry over + update | Update install commands for pnpm. Env var reference unchanged.                                                                             |
| **docs/guides/SECURITY.md**        | Carry over + review | Security practices still apply. Review for monorepo concerns.                                                                              |
| **docs/guides/TROUBLESHOOTING.md** | Carry over + update | Add pnpm-specific and monorepo-specific failure modes.                                                                                     |

---

## Phase validation protocol

Before starting each phase:

1. Spin up **breakdown validator** and **DA** agents in parallel against the phase's PR list
2. Both agents read relevant source code from the existing Clancy codebase
3. Validator checks:
   - Is each PR truly single-responsibility? Could any be split further?
   - Are there hidden dependencies between PRs that aren't captured?
   - Are the exit criteria testable and specific enough?
   - What modules from the existing Clancy codebase need to be read to understand what's being brought over?
   - Are there edge cases or cross-cutting concerns that will surface mid-PR?
4. DA checks:
   - Is anything missing? Files, tests, config changes that need to happen but aren't listed?
   - Is the order right? Would a different PR sequence reduce rework?
   - Are we over-scoping or under-scoping any PR?
   - What's the most likely thing to go wrong in this phase?
5. Adjust the PR breakdown based on findings
6. Only begin implementation after both agents approve

This adds ~15-20 minutes per phase but prevents mid-phase surprises.

---

## Session pattern

Every new session follows this consistent pattern:

```
1. Read the brief + current phase status (PROGRESS.md)
2. Run phase validation (if starting a new phase)
3. Pick up the next PR
4. TDD: write tests → implement → lint → review
5. DA review of completed PR
6. Mark PR complete, update phase status
```

Sessions that need to hand off mid-phase leave a handoff prompt with:

- What was completed
- What's next
- Any decisions made or blockers hit

---

## Delivery phases

### Phase 0: Finish v0.8.24 _(current repo)_

Already scoped. Ship it.

---

### Phase 1: Scaffold _(new repo)_

| PR   | What                                                                                                                                                    | Exit criteria                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1.1  | Repo init: `pnpm init`, `pnpm-workspace.yaml`, root `package.json` (private), `.gitignore`, `.editorconfig`, `LICENSE`, `README.md`                     | `pnpm install` works                                           |
| 1.2  | Foundation docs: CLAUDE.md, docs/CONVENTIONS.md, docs/DEVELOPMENT.md, docs/GIT.md (updated), docs/GLOSSARY.md (updated), docs/decisions/ (carried over) | Docs are accurate, complete, and guide all subsequent sessions |
| 1.3  | TypeScript: root `tsconfig.json` (base config), `packages/core/tsconfig.json`, `packages/terminal/tsconfig.json`, hello-world `index.ts` in each        | `pnpm exec tsc --noEmit` passes                                |
| 1.4  | ESLint: root `eslint.config.ts` with ALL rules (complexity, functional, sonarjs, boundaries, import ordering). Verify against hello-world files.        | `pnpm lint` passes                                             |
| 1.5  | Prettier: `.prettierrc` with `@ianvs/prettier-plugin-sort-imports`, import ordering config                                                              | `pnpm format:check` passes                                     |
| 1.6  | Vitest: root `vitest.config.ts` (workspace), per-package `vitest.config.ts` (defineProject), one trivial test per package                               | `pnpm test` passes                                             |
| 1.7  | Turborepo: `turbo.json` with build/test/lint/typecheck tasks. Verify dependency ordering (core builds before terminal).                                 | `turbo build && turbo test` passes, caching works              |
| 1.8  | CI: GitHub Actions workflow. Two jobs matching existing names ("Unit tests", "Integration tests"). Branch protection ruleset.                           | CI green on main                                               |
| 1.9  | Quality tooling: knip, publint, attw as npm scripts + CI checks (non-blocking).                                                                         | `pnpm knip && pnpm publint` passes                             |
| 1.10 | Changesets: `.changeset/config.json`, independent versioning, changelog generation.                                                                     | `pnpm changeset` workflow works                                |

---

### Phase 2: Terminal — installer

| PR  | What                                                                                                      | Exit criteria                                             |
| --- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 2.1 | Installer entry point: `install.ts` — prompts, UI, banner. TDD.                                           | Installer runs, shows prompts, exits cleanly              |
| 2.2 | File operations: `file-ops/` — directory copying, symlink handling. TDD.                                  | Unit tests pass, files copy correctly                     |
| 2.3 | Manifest: `manifest/` — track modified files, backup/restore. TDD.                                        | Manifest tracks and restores files                        |
| 2.4 | Hook installer: `hook-installer/` — register hooks in Claude settings.json. TDD.                          | Hooks register correctly                                  |
| 2.5 | Role filter: `role-filter/` — copy role files based on CLANCY_ROLES config. TDD.                          | Roles filter correctly                                    |
| 2.6 | Integration: wire all installer sub-modules together. End-to-end installer test against a temp directory. | `npx @chief-clancy/terminal` installs into a test project |

---

### Phase 3: Terminal — roles & agents

| PR  | What                                                                                                                                           | Exit criteria                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 3.1 | Role markdown files: bring over all 5 roles (implementer, reviewer, planner, strategist, setup). Review each command for clarity and accuracy. | All `.md` files lint-clean, installer copies them |
| 3.2 | Agent prompts: bring over 7 agent `.md` files. Review for clarity.                                                                             | Agents install correctly                          |
| 3.3 | Templates: `CLAUDE.md` template. Update paths for monorepo structure.                                                                          | Template installs correctly                       |

---

### Phase 4: Core — types & schemas

| PR  | What                                                                                                                                                                                          | Exit criteria                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 4.1 | Shared types: `Board`, `FetchedTicket`, `RemoteInfo`, `GitPlatform`, `PrCreationResult`, `ProgressStatus`, status constants. Consolidate scattered definitions. JSDoc on every exported type. | Types compile, barrel export works                                 |
| 4.2 | Env schemas: Zod validation for all 6 board configs + `detectBoard()`. TDD.                                                                                                                   | Schema validation tests pass. Property-based tests for edge cases. |
| 4.3 | Board API schemas: Jira, GitHub, Linear, Shortcut, Notion, AzDo response schemas. TDD.                                                                                                        | All schemas validate against fixture data                          |

---

### Phase 5: Core — board _(one PR per board)_

| PR  | What                                                                                                             | Exit criteria                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 5.1 | Board interface + factory: `Board` type definition, `createBoard()` factory. TDD against the interface.          | Factory returns correct implementation per config                             |
| 5.2 | GitHub board: `github.ts` + `github-board.ts`. Rewrite with `fetchAndParse<T>()`. Pure functions extracted. TDD. | All GitHub board methods tested. Property-based tests for URL/query builders. |
| 5.3 | Jira board: same pattern.                                                                                        | All Jira board methods tested                                                 |
| 5.4 | Linear board: same pattern.                                                                                      | All Linear board methods tested                                               |
| 5.5 | Shortcut board: same pattern.                                                                                    | All Shortcut board methods tested                                             |
| 5.6 | Notion board: same pattern.                                                                                      | All Notion board methods tested                                               |
| 5.7 | Azure DevOps board: same pattern.                                                                                | All AzDo board methods tested                                                 |

---

### Phase 6: Core — shared utilities _(grouped by dependency)_

| PR   | What                                                                                                                                                               | Exit criteria                                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 6.1  | `http/`: `fetchAndParse<T>()`, `fetchWithTimeout`, ping, header builders. Pure where possible. TDD.                                                                | HTTP utilities tested. Property-based tests for header construction.     |
| 6.2  | `env-parser/`: parse `.env` files. Pure function. TDD.                                                                                                             | Parser handles all edge cases. Property-based tests for arbitrary input. |
| 6.3  | `env-schema/`: detect board from env vars, validate config. Depends on 6.2. TDD.                                                                                   | Board detection tested for all 6 boards + edge cases                     |
| 6.4  | `remote/`: parse git remote URLs, detect platform, build API base URLs. Pure functions. TDD.                                                                       | Property-based tests for arbitrary URLs                                  |
| 6.5  | `git-ops/`: git commands (branch, checkout, push, merge, diff). I/O boundary — inject exec. TDD.                                                                   | All git operations tested                                                |
| 6.6  | `branch/`: branch naming conventions. Pure functions. TDD.                                                                                                         | Property-based tests for name generation/parsing                         |
| 6.7  | `progress/`: progress file reader/writer. TDD.                                                                                                                     | Progress tracking tested                                                 |
| 6.8  | `format/`: duration formatting, other formatters. Pure functions. TDD.                                                                                             | Formatters tested                                                        |
| 6.9  | `feasibility/`: code review detection. TDD.                                                                                                                        | Feasibility checks tested                                                |
| 6.10 | `pull-request/`: PR body builders, platform-specific PR creation (GitHub, GitLab, Bitbucket), rework comment detection. One sub-PR per platform if too large. TDD. | PR creation tested for all platforms                                     |

---

### Phase 7: Core — lifecycle _(one PR per module)_

| PR  | What                                                                                                    | Exit criteria                           |
| --- | ------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 7.1 | `lock/`: acquire, release, stale detection. TDD.                                                        | Lock lifecycle tested                   |
| 7.2 | `cost/`: duration-based token cost estimation + costs.log writer. TDD.                                  | Cost calculation tested                 |
| 7.3 | `resume/`: crash recovery (resume detection, branch/ticket recovery). TDD.                              | Resume scenarios tested                 |
| 7.4 | `quality/`: quality metric tracking. TDD.                                                               | Quality tracking tested                 |
| 7.5 | `fetch-ticket/`: label resolution, blocker checking, AFK filtering. Depends on board + env-schema. TDD. | Ticket fetching tested for all 6 boards |
| 7.6 | `rework/`: PR comment parsing (inline + Rework: prefix, timestamp filtering). TDD.                      | Rework detection tested                 |
| 7.7 | `deliver/`: epic branch management, PR creation orchestration. Depends on pull-request + board. TDD.    | Delivery flow tested                    |
| 7.8 | `pr-creation/`: multi-platform PR creation coordination. Depends on deliver + pull-request. TDD.        | PR creation tested                      |

---

### Phase 8: Core — pipeline

| PR  | What                                                                              | Exit criteria                         |
| --- | --------------------------------------------------------------------------------- | ------------------------------------- |
| 8.1 | Pipeline context: `RunContext` type, phase types, invoke strategy interface. TDD. | Context creation tested               |
| 8.2 | Pure phases (batch 1): lock-check, preflight, epic-completion, pr-retry. TDD.     | 4 phases tested in isolation          |
| 8.3 | Pure phases (batch 2): rework-detection, ticket-fetch, dry-run, feasibility. TDD. | 4 phases tested                       |
| 8.4 | Pure phases (batch 3): branch-setup, transition, deliver, cost, cleanup. TDD.     | 5 phases tested                       |
| 8.5 | Pipeline orchestrator: wire all phases together, invoke callback injection. TDD.  | Full pipeline tested with mock invoke |

---

### Phase 9: Terminal — orchestrator

| PR  | What                                                                        | Exit criteria                                 |
| --- | --------------------------------------------------------------------------- | --------------------------------------------- |
| 9.1 | Claude CLI bridge: `invokeClaudePrint`, `invokeClaudeSync`. I/O boundary.   | CLI bridge tested                             |
| 9.2 | Prompt builder: construct Claude prompts (TDD blocks, board labels).        | Prompts build correctly                       |
| 9.3 | Notifications: desktop + Slack/Teams webhooks.                              | Notifications tested                          |
| 9.4 | ANSI utils: terminal colour codes.                                          | Colours render correctly                      |
| 9.5 | Once orchestrator: wire terminal to core pipeline. Provide invoke callback. | `/clancy:once` flow works end-to-end in tests |
| 9.6 | AFK runner: loop orchestration, quiet hours, session reports.               | AFK loop tested                               |

---

### Phase 10: Terminal — hooks

| PR   | What                                                           | Exit criteria                  |
| ---- | -------------------------------------------------------------- | ------------------------------ |
| 10.1 | Credential guard + branch guard hooks. Verify path references. | Hooks function in test project |
| 10.2 | Context monitor + post-compact hooks.                          | Hooks function                 |
| 10.3 | Statusline + check-update + notification hooks.                | Hooks function                 |
| 10.4 | Drift detector + verification gate hooks.                      | Hooks function                 |

---

### Phase 11: Integration tests

| PR   | What                                                                                   | Exit criteria        |
| ---- | -------------------------------------------------------------------------------------- | -------------------- |
| 11.1 | Test infrastructure: Claude simulator, temp repo helper, MSW setup, env fixtures.      | Infrastructure works |
| 11.2 | Implementer lifecycle tests: happy path + early exits (per board).                     | Core flows pass      |
| 11.3 | Board write operation tests: label CRUD, transitions (per board).                      | Write ops pass       |
| 11.4 | Advanced scenarios: blocked tickets, epic branches, stale locks, AFK resume.           | Edge cases pass      |
| 11.5 | Hook integration tests: credential guard, branch guard, context monitor, post-compact. | Hook tests pass      |
| 11.6 | Pipeline label transition tests: brief → plan → build lifecycle.                       | Label flow passes    |

---

### Phase 12: E2E / Smoke Tests

End-to-end tests that verify the full implement pipeline against real board APIs. Ported from old Clancy repo's `test/e2e/` infrastructure, adapted to the new monorepo's DI architecture.

| PR    | What                                                                                            | Exit criteria                  |
| ----- | ----------------------------------------------------------------------------------------------- | ------------------------------ |
| 12.1  | E2E scaffold: test location, vitest e2e config, `.env.e2e.example`, `fetch-timeout`, `git-auth` | Config runs, helpers compile   |
| 12.2  | Credential loader + auth helpers: `env.ts`, `azdo-auth.ts`, `jira-auth.ts`                      | Credentials load, skip works   |
| 12.3  | Ticket factory: `createTestTicket()` for 6 boards, `generateRunId()`                            | Tickets created on live boards |
| 12.4  | Cleanup helpers: `cleanupTicket()`, `cleanupPullRequest()`, `cleanupBranch()`                   | Resources cleaned up           |
| 12.5  | Garbage collector: orphan cleanup for stale `[QA]` tickets >24h                                 | Stale tickets removed          |
| 12.6  | GitHub e2e (tracer bullet): `runPipeline` + real GitHub fetcher + Claude simulator              | Full pipeline passes           |
| 12.7  | Jira e2e                                                                                        | Full pipeline passes           |
| 12.8  | Linear e2e (GraphQL)                                                                            | Full pipeline passes           |
| 12.9  | Shortcut e2e                                                                                    | Full pipeline passes           |
| 12.10 | Notion e2e                                                                                      | Full pipeline passes           |
| 12.11 | Azure DevOps e2e (WIQL)                                                                         | Full pipeline passes           |
| 12.12 | Live schema validation: auth-endpoint checks against Zod schemas                                | No schema drift                |
| 12.13 | CI workflow: weekly schedule, GC pre-step, board matrix, schema validation                      | Workflow runs green            |

---

### Phase 13: Bundle verification

| PR   | What                                                                                                                   | Exit criteria                |
| ---- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 13.1 | esbuild config: configure for cross-package resolution via pnpm symlinks. Build bundles.                               | Bundles build without errors |
| 13.2 | Bundle comparison: run current Clancy vs new monorepo bundles against same test scenarios. Verify identical behaviour. | Behaviour matches            |

---

### Phase 14: Wrapper & publish prep

| PR   | What                                                                                      | Exit criteria                                  |
| ---- | ----------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 14.1 | `chief-clancy` wrapper package: `bin/clancy.js`, `package.json`.                          | `npx chief-clancy` delegates to terminal       |
| 14.2 | Release workflow: GitHub Actions multi-package detection + publish. Tag conventions.      | Workflow triggers correctly on version bumps   |
| 14.3 | Doc rewrites: ARCHITECTURE.md, VISUAL-ARCHITECTURE.md, TESTING.md, TECHNICAL-REFERENCE.md | Docs accurately describe the built system      |
| 14.4 | Doc updates: SELF-REVIEW.md, LIFECYCLE.md, COMPARISON.md, roles/_.md, guides/_.md         | All docs reviewed, paths and commands accurate |

---

### Phase 15: Publish

| PR   | What                                                                                       | Exit criteria                                   |
| ---- | ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| 15.1 | Create `@chief-clancy` npm org. Publish all packages. Deprecate old `chief-clancy@<1.0.0`. | Packages live on npm. `npx chief-clancy` works. |

---

## Phase dependencies

```
Phase 0 (v0.8.24)
  └→ Phase 1 (scaffold)
       ├→ Phase 2 (terminal installer)
       │    └→ Phase 3 (roles & agents)
       │
       ├→ Phase 4 (core types & schemas)  ←── can parallel with 2-3
       │    ├→ Phase 5 (core board)
       │    └→ Phase 6 (core shared utils)  ←── can parallel with 5
       │         └→ Phase 7 (core lifecycle)  ←── depends on 5 + 6
       │              └→ Phase 8 (core pipeline)
       │
       └→ Phase 9 (terminal orchestrator)  ←── depends on 3 + 8
            └→ Phase 10 (terminal hooks)
                 └→ Phase 11 (integration tests)
                      └→ Phase 12 (e2e / smoke tests)
                           └→ Phase 13 (bundle verification)
                                └→ Phase 14 (wrapper & publish prep)
                                     └→ Phase 15 (publish)
```

---

## Effort estimate

| Phase                           | Estimate            |
| ------------------------------- | ------------------- |
| Phase 0 (v0.8.24)               | Already in progress |
| Phase 1 (scaffold)              | 2-3 days            |
| Phases 2-3 (terminal bootstrap) | 3-5 days            |
| Phase 4 (types/schemas)         | 2-3 days            |
| Phase 5 (board)                 | 5-7 days            |
| Phase 6 (shared utils)          | 3-5 days            |
| Phase 7 (lifecycle)             | 5-7 days            |
| Phase 8 (pipeline)              | 3-5 days            |
| Phase 9 (orchestrator)          | 3-5 days            |
| Phase 10 (hooks)                | 2-3 days            |
| Phase 11 (integration tests)    | 5-7 days            |
| Phase 12 (e2e / smoke tests)    | 5-7 days            |
| Phase 13 (bundle verification)  | 2-3 days            |
| Phases 14-15 (publish)          | 2-3 days            |
| **Total**                       | **~40-62 days**     |

Not a sprint. Each phase is independently shippable. Any phase can pause without leaving a broken state. ~65 PRs total, each small enough to review in one sitting.

---

## Risks

| Risk                                                                                          | Severity | Mitigation                                                                                            |
| --------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| **Scope creep during rewrite** — "while I'm here, let me also..."                             | High     | Each PR has explicit exit criteria. Phase validation catches scope inflation before work starts.      |
| **Lint rules too strict in practice** — `no-let` or max-params creates unreadable workarounds | Medium   | Phase 2 (first real code) is the proving ground. Rules adjusted based on real experience, not theory. |
| **esbuild + pnpm symlink interaction** — untested, could surprise                             | Medium   | Phase 13 is dedicated to bundle verification. Isolated from feature work.                             |
| **Motivation drift** — 35-55 days is a long time for infrastructure                           | Medium   | Each phase ships independently. Feature work (MCP server) can start after phase 9.                    |
| **Feature parity gap** — old Clancy keeps working while new one is incomplete                 | Low      | Old repo stays published. No deprecation until new monorepo reaches parity.                           |

---

## DA challenges addressed

| DA concern                         | Response                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "No user problem solved"           | Correct for day one. The rewrite is investment in codebase quality and architecture. Explicitly chosen trade-off.                                                  |
| "Premature core extraction"        | Mitigated by building terminal first (phases 2-3), then extracting core with evidence of what terminal actually imports.                                           |
| "10 new tools at once"             | Tools go in during phase 1 (scaffold), before any application code. Lint rules proven against real code in phase 2. Adjustable.                                    |
| "35-55 days"                       | Acknowledged. Phased delivery means any phase can pause. No half-broken state.                                                                                     |
| "Fresh repo is emotional"          | Acknowledged as a trade-off. Old repo archived, not deleted.                                                                                                       |
| "Functional rules friction"        | Phase 2 is the proving ground. Rules adjusted based on real experience. Test files exempt.                                                                         |
| "JSDoc on everything"              | Scoped to exported functions only. Internal helpers exempt where types make intent obvious.                                                                        |
| "Over-tooling for solo maintainer" | Each tool earns its place: pnpm fixes a real CI bug, Turborepo guarantees build order, boundaries enforces architecture. Tools that prove unnecessary get removed. |

---

## What Clancy gains

- Clean, enforced architecture — dependency direction is a lint rule, not a convention
- Every module rewritten or validated against strict quality standards
- Public API boundaries between core and terminal
- Foundation for MCP server and chat without duplication
- Consistent `@chief-clancy/*` namespace
- Modern toolchain replacing known-broken npm CI workarounds

## What Clancy loses

- Git blame history (fresh repo)
- PR discussion history (old repo stays archived, not deleted)
- Time that could go to features
- Simplicity of single-package publishing

---

## Reference: existing Clancy codebase

The old Clancy repo is the reference for all code being brought over. Key paths:

| Path                               | What                                            |
| ---------------------------------- | ----------------------------------------------- |
| `src/scripts/board/`               | Board type, factory, 6 board implementations    |
| `src/scripts/board/board.ts`       | Board interface definition                      |
| `src/scripts/board/factory/`       | createBoard factory                             |
| `src/scripts/once/`                | Phase pipeline, orchestrator, lifecycle modules |
| `src/scripts/once/phases/`         | 14 phases                                       |
| `src/scripts/once/context/`        | RunContext                                      |
| `src/scripts/shared/`              | Shared utilities (15+ modules)                  |
| `src/scripts/shared/pull-request/` | PR creation (GitHub, GitLab, Bitbucket)         |
| `src/scripts/shared/remote/`       | Git remote parsing                              |
| `src/schemas/`                     | Zod schemas (env, board APIs)                   |
| `src/types/`                       | Shared types (board, remote)                    |
| `src/installer/`                   | Installer modules                               |
| `src/roles/`                       | Slash commands (5 roles)                        |
| `src/agents/`                      | Agent prompts (7 agents)                        |
| `src/templates/`                   | CLAUDE.md template                              |
| `hooks/`                           | 9 pre-built CommonJS hooks                      |
| `src/scripts/afk/`                 | AFK runner                                      |
| `docs/`                            | All project documentation                       |
| `test/integration/`                | MSW-backed integration tests                    |
