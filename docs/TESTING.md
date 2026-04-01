# Testing

Clancy uses a 3-layer QA architecture across three packages: unit tests (core, terminal, brief), integration tests (terminal), and E2E tests (terminal). All layers use Vitest.

## Quick reference

```bash
pnpm test                        # All unit tests (core + terminal, via Turbo)
pnpm typecheck                   # tsc --noEmit (both packages)
pnpm lint                        # ESLint (both packages)

# Per-package
cd packages/core && pnpm test                    # Core unit tests
cd packages/terminal && pnpm test                # Terminal unit tests
cd packages/terminal && pnpm test:e2e            # E2E tests (real APIs)
cd packages/terminal && pnpm test:e2e "github"   # E2E for a single board

# Coverage
pnpm vitest run --coverage       # Unit tests with coverage report (80% threshold)
```

---

## Layer 1: Unit tests

Module-level tests with `vi.mock()`. Co-located with source files in both packages.

### How to run

```bash
pnpm test                                            # all unit tests
pnpm vitest run packages/core/src/board              # subset by path
pnpm vitest run packages/terminal/src/installer      # subset by path
```

### File structure

Tests are co-located: `<name>/<name>.ts` + `<name>/<name>.test.ts`.

```
packages/core/src/
├── board/
│   ├── github/github.test.ts             — GitHub Issues API
│   ├── jira/jira.test.ts                 — Jira REST API
│   ├── linear/linear.test.ts             — Linear GraphQL API
│   ├── shortcut/shortcut.test.ts         — Shortcut REST API
│   ├── notion/notion.test.ts             — Notion REST API
│   ├── azdo/azdo.test.ts                 — Azure DevOps WIQL API
│   └── factory/factory.test.ts           — Board factory
├── dev/
│   ├── pipeline/phases/                  — Per-phase tests
│   └── lifecycle/                        — Per-module tests (lock, deliver, rework, etc.)
├── shared/                               — cache, env-parser, git-ops, http, remote
└── schemas/                              — Zod schema validation tests

packages/terminal/src/
├── installer/                            — install, file-ops, hook-installer, manifest, prompts, role-filter
├── runner/                               — autopilot, implement, cli-bridge, prompt-builder, session-report
└── hooks/                                — credential-guard, branch-guard, context-monitor, etc.
```

### How they work

- Each test file mocks its module's external dependencies via `vi.mock()`
- Board module tests validate API response parsing, ticket extraction, and error handling using inline mock data
- Pipeline phase tests mock the `RunContext` and verify phase behaviour
- No network calls, no filesystem side effects (except installer tests which use temp dirs)

### Property-based testing

Tests that handle string parsing, formatting, or validation use [fast-check](https://github.com/dubzzz/fast-check) for property-based testing. This covers edge cases that hand-written examples miss.

Used in: lifecycle modules (rework, pr-creation, format, feasibility), schema tests, git-ops, remote, hooks (branch-guard, credential-guard), runner (autopilot, session-report, prompt-builder).

### Adding unit tests

1. Create the module with a co-located `<name>.test.ts`
2. Test pure functions directly, mock side effects
3. Use `fast-check` for string parsers and formatters
4. Follow existing patterns in the relevant package

---

## Layer 2: E2E tests

Real APIs, real git operations, real ticket creation. Tests exercise the full pipeline against production board APIs with Claude simulated.

### How to run

```bash
cd packages/terminal
pnpm test:e2e                              # all boards (needs all credentials)
pnpm test:e2e "pipeline/github-pipeline"   # single board
pnpm test:e2e "schema/schema-validation"   # schema validation
pnpm exec tsx test/e2e/helpers/gc/gc.ts    # orphan ticket cleanup
```

### File structure

```
packages/terminal/
├── vitest.config.e2e.ts              — 60s timeout, sequential, no retry
└── test/e2e/
    ├── pipeline/
│   ├── github-pipeline.e2e.ts    — GitHub Issues E2E
│   ├── jira-pipeline.e2e.ts      — Jira E2E
│   ├── linear-pipeline.e2e.ts    — Linear E2E
│   ├── shortcut-pipeline.e2e.ts  — Shortcut E2E
│   ├── notion-pipeline.e2e.ts    — Notion E2E
│   └── azdo-pipeline.e2e.ts      — Azure DevOps E2E
    ├── schema/
    │   └── schema-validation.e2e.ts  — live API schema validation
    └── helpers/
        ├── env.ts                    — credential loading (.env.e2e or process.env)
        ├── ticket-factory/           — real API ticket creation (all boards)
        ├── cleanup/                  — ticket/PR/branch cleanup per board
        ├── gc/                       — orphan cleanup ([QA] tickets >24h old)
        ├── jira-auth.ts              — Base64 Basic auth for Jira
        └── azdo-auth.ts              — Base64 Basic auth for Azure DevOps
```

### How they work

1. **Ticket factory** creates a real ticket on the board API (labelled `clancy:build`, assigned to authenticated user)
2. **Temp repo** is created with a real git remote pointing to the GitHub sandbox repo
3. **Claude simulator** writes a dummy file and commits
4. **Pipeline** runs with real board API, real git push, simulated Claude
5. **Assertions** verify: feature branch created, progress.txt updated, PR exists on GitHub
6. **Cleanup** runs in `afterAll`: close PR -> delete branch -> close/delete ticket -> remove temp repo
7. **Orphan GC** catches tickets from crashed/timed-out runs (titles contain `[QA]`, >24h old)

### Credential setup

Copy `.env.e2e.example` (repo root) to `.env.e2e` and fill in real values. Tests skip automatically if credentials are missing for a board.

| Board        | Required secrets                               |
| ------------ | ---------------------------------------------- |
| GitHub       | `GITHUB_TOKEN`, `GITHUB_REPO`                  |
| Jira         | `JIRA_BASE_URL`, `JIRA_USER`, `JIRA_API_TOKEN` |
| Linear       | `LINEAR_API_KEY`, `LINEAR_TEAM_ID`             |
| Shortcut     | `SHORTCUT_TOKEN`                               |
| Notion       | `NOTION_TOKEN`, `NOTION_DATABASE_ID`           |
| Azure DevOps | `AZURE_ORG`, `AZURE_PROJECT`, `AZURE_PAT`      |

### CI schedule

E2E tests run via GitHub Actions (`.github/workflows/e2e.yml`):

- **Weekly:** Monday 6am UTC (all boards)
- **Manual dispatch:** select a single board or all
- **GC job** runs first (cleans orphans across all boards)
- **Per-board matrix** with `fail-fast: false` and 30min timeout

### No retry policy

E2E tests do not retry because they create real external resources (tickets, PRs, branches). Retries would leak earlier-attempt resources. The GC script handles orphan cleanup instead.

---

## Vitest configuration

### Root config (`vitest.config.ts`)

Manages both packages with coverage thresholds:

```
80% minimum for statements, branches, functions, and lines
```

### Per-package configs

Each package has its own `vitest.config.ts` for `pnpm test` within the package. The E2E config (`vitest.config.e2e.ts`) uses:

- `fileParallelism: false` — sequential execution (tests use `process.chdir` and real filesystem)
- `testTimeout: 60_000` — real API calls need longer timeouts
- `retry: 0` — no retries (prevents resource leaks)

---

## Contributor requirements

### All PRs must pass CI

```bash
pnpm test && pnpm lint && pnpm typecheck && pnpm format:check && pnpm knip && pnpm publint && pnpm attw
```

### PRs adding new modules must include

- Co-located unit tests for all exported functions
- Minimum scenarios: happy path, error/edge cases
- Property-based tests for string parsers and formatters

---

## See also

- [CONVENTIONS.md](CONVENTIONS.md) — code conventions, naming patterns, TypeScript rules
- [ARCHITECTURE.md](ARCHITECTURE.md) — system architecture and module map
- [DA-REVIEW.md](DA-REVIEW.md) — review checklist (includes test coverage requirements)
