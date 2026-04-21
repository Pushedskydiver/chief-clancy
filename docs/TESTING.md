# Testing

Clancy uses a 2-layer QA architecture: unit tests (co-located across five packages — core, terminal, brief, plan, dev) and E2E tests (terminal). Both layers use Vitest.

## Quick reference

```bash
pnpm test                        # All unit tests (via Turbo, for every package with a `test` script)
pnpm typecheck                   # tsc --noEmit (all packages)
pnpm lint                        # ESLint (all packages)

# Per-package (any of core, terminal, brief, plan, dev)
cd packages/<name> && pnpm test                  # One package's unit tests
cd packages/terminal && pnpm test:e2e            # E2E tests (real APIs — terminal only)
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
pnpm vitest run packages/core/src/board              # subset by path (core)
pnpm vitest run packages/dev/src/lifecycle           # subset by path (dev)
pnpm vitest run packages/terminal/src/installer      # subset by path (terminal)
```

### File structure

Tests are co-located: `<name>.test.ts` sits next to `<name>.ts`. When a module warrants its own directory (e.g. `board/github/`), the same sibling pattern applies inside.

```
packages/core/src/
├── board/                  — per-board adapters (github, jira, linear, shortcut, notion, azdo) + factory + detect-board
├── shared/                 — cache, env-parser, git-ops, git-token, http, label-helpers, remote
├── schemas/                — Zod schemas + per-board validation tests
└── types/                  — shared types (Ticket, PipelineDeps, ProgressStage, etc.)

packages/dev/src/
├── pipeline/               — pipeline runner + per-phase modules
├── lifecycle/              — per-phase lifecycle modules
├── agents/                 — agent invocation + rubric loading
├── artifacts/              — artifact writers
├── commands/ + workflows/  — Clancy `/dev` command + workflow prompts
├── dep-factory/            — dependency construction for the pipeline runner
├── execute/                — single-ticket executor
├── entrypoints/            — CLI bridges
├── installer/              — dev-package installer
├── cli-bridge.ts, esbuild.runtime.ts, notify.ts, prompt-builder.ts, queue.ts, stop-condition.ts
└── types/                  — dev-internal types

packages/terminal/src/
├── installer/              — terminal-installer surface
├── runner/                 — autopilot + session-report + implement/ + runtime shims
├── hooks/                  — Clancy hooks (one subdirectory per hook)
├── agents/, roles/, templates/, entrypoints/, shared/  — prompt + template assets

packages/brief/src/ + packages/plan/src/
└── agents/, commands/, installer/, workflows/  — prompt-shipping packages with thin installer tests

packages/scan/src/
└── agents/, commands/, workflows/              — prompts-only (no unit tests)
```

### How they work

- Each test file mocks its module's external dependencies via `vi.mock()`
- Board module tests validate API response parsing, ticket extraction, and error handling using inline mock data
- Pipeline phase tests mock the `RunContext` and verify phase behaviour
- No network calls, no filesystem side effects (except installer tests which use temp dirs)

### Property-based testing

Tests that handle string parsing, formatting, or validation use [fast-check](https://github.com/dubzzz/fast-check) for property-based testing. This covers edge cases that hand-written examples miss.

Used across `core/shared` (env-parser, remote), `dev/lifecycle/*`, `dev/prompt-builder`, `dev/notify`, `terminal/hooks/*`, and `terminal/runner/session-report` — anywhere a test covers many input shapes for a parser, formatter, or validator. Grep `fast-check` for the current list.

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
    │   ├── github-pipeline.e2e.ts           — GitHub Issues E2E
    │   ├── jira-pipeline.e2e.ts             — Jira E2E
    │   ├── linear-pipeline.e2e.ts           — Linear E2E
    │   ├── shortcut-pipeline.e2e.ts         — Shortcut E2E
    │   ├── notion-pipeline.e2e.ts           — Notion E2E
    │   ├── azdo-pipeline.e2e.ts             — Azure DevOps E2E
    │   ├── local-lifecycle-contract.e2e.ts  — local-mode lifecycle contract
    │   ├── local-plan-pipeline.e2e.ts       — local-plan pipeline end-to-end
    │   └── pipeline-e2e-setup.ts            — shared pipeline fixture setup
    ├── schema/
    │   └── schema-validation.e2e.ts         — live API schema validation
    └── helpers/
        ├── env.ts                           — credential loading (.env.e2e or process.env)
        ├── ticket-factory/                  — real API ticket creation (all boards)
        ├── cleanup/                         — ticket/PR/branch cleanup per board
        ├── gc/                              — orphan cleanup ([QA] tickets >24h old)
        ├── jira-auth.ts                     — Base64 Basic auth for Jira
        ├── azdo-auth.ts                     — Base64 Basic auth for Azure DevOps
        ├── git-auth.ts                      — git HTTPS auth helper
        ├── fetch-timeout.ts                 — timeout wrapper for board API calls
        └── local-plan-setup.ts              — local-plan fixture scaffolding
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
- **Per-board matrix** with `fail-fast: false` (no per-job timeout set)

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

### Vitest alias gotcha

When aliasing package names in vitest configs, use **directory paths**, not file paths. Vite's alias system uses string prefix matching: if `@chief-clancy/core` maps to `../core/src/index.ts`, then `@chief-clancy/core/types/board.js` resolves to `../core/src/index.ts/types/board.js` (ENOTDIR). Map to the directory (`../core/src`) so subpath imports resolve correctly.

Any vitest config that transitively resolves `@chief-clancy/dev` source also needs a `~/d` alias — dev source uses `~/d/` path aliases internally.

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

## Writing good tests

The disciplines below are the difference between tests that catch bugs and tests that pass while production breaks. Adapted from Matt Pocock's [`tdd`](https://github.com/mattpocock/skills/tree/main/tdd) skill (which is the source of our tracer-bullet TDD pattern) and Addy Osmani's [`test-driven-development`](https://github.com/addyosmani/agent-skills/tree/main/skills/test-driven-development) skill.

### Test state, not interactions

Assert on the **outcome** of an operation, not on which methods were called internally. Tests that verify method-call sequences break when you refactor, even if the behaviour is unchanged.

```ts
// Good: tests what the function does (state-based)
it('returns tasks sorted by creation date, newest first', async () => {
  const tasks = await listTasks({ sortBy: 'createdAt', sortOrder: 'desc' });
  expect(tasks[0].createdAt.getTime()).toBeGreaterThan(
    tasks[1].createdAt.getTime(),
  );
});

// Bad: tests how the function works internally (interaction-based)
it('calls db.query with ORDER BY created_at DESC', async () => {
  await listTasks({ sortBy: 'createdAt', sortOrder: 'desc' });
  expect(db.query).toHaveBeenCalledWith(
    expect.stringContaining('ORDER BY created_at DESC'),
  );
});
```

**Carve-out — when interaction assertions ARE the right tool:** if the interaction itself is the behaviour being tested, an interaction assertion is correct. Examples:

- **File copy counts** — `brief-content.test.ts` asserts `toHaveBeenCalledTimes(5)` because "copies exactly 5 files" is the behaviour
- **Fetch URL assertions** — board adapter tests assert `fetch` was called with the right URL because "hits the right endpoint" is the contract
- **Idempotency** — asserting that an operation runs once not twice is an interaction assertion
- **Side-effect ordering** — asserting that A happened before B when both are observable side effects
- **Retry counts** — asserting that a flaky call was retried N times

Rule of thumb: prefer state assertions when state is observable. Use interaction assertions when the interaction IS the contract being tested. The 30+ existing test files in this codebase that use `toHaveBeenCalled*` mostly fall into the carve-out — don't reflexively rewrite them.

### Mock at system boundaries only

From Pocock's [`tdd/mocking.md`](https://github.com/mattpocock/skills/blob/main/tdd/mocking.md): mock at **system boundaries** only.

- **Mock:** external APIs (HTTP), file system (sometimes), time, randomness, databases (sometimes — prefer test DB)
- **Don't mock:** your own classes, internal collaborators, anything you control

This codebase uses **dependency injection of I/O functions** (pass `fetch`, pass `exec`, pass filesystem ops as function parameters) as the canonical way to make code testable. The DI pattern is the boundary — the test substitutes a fake implementation rather than mocking an internal collaborator. See [CONVENTIONS.md "Code Style"](CONVENTIONS.md#code-style) for the DI rule.

### SDK-style interfaces over generic fetchers

When designing the boundary, prefer specific functions for each external operation over one generic function with conditional logic:

```ts
// GOOD: each function is independently mockable, type-safe per endpoint
const api = {
  getUser: (id: string) => fetch(`/users/${id}`),
  getOrders: (userId: string) => fetch(`/users/${userId}/orders`),
  createOrder: (data: OrderInput) =>
    fetch('/orders', { method: 'POST', body: data }),
};

// BAD: mocking requires conditional logic inside the mock
const api = {
  fetch: (endpoint: string, options: RequestInit) => fetch(endpoint, options),
};
```

The SDK approach means each mock returns one specific shape, no conditional logic in test setup, and easier to see which endpoints a test exercises. This is how all the board adapters in `packages/core/src/board/` are structured — `getIssue`, `createIssue`, `addLabel`, etc, each its own function.

### Typed mock fetchers

Use `vi.fn<Fetcher>()` for mock fetchers in tests — not untyped `vi.fn()` or a plain `: Fetcher` annotation. `vi.fn<Fetcher>()` preserves both type-checking and mock interface properties without needing `vi.mocked()` wrappers at call sites.

```ts
// GOOD — typed, mockable, no cast needed
import type { Fetcher } from '@chief-clancy/core';

const mockFetch = vi.fn<Fetcher>();

// BAD — loses type safety
const mockFetch = vi.fn();

// BAD — loses mock interface
const mockFetch: Fetcher = async () => ({ ok: true }) as Response;
```

Fix typing findings in the same PR that surfaces them — don't defer.

### DAMP > DRY in tests

In production code, DRY (Don't Repeat Yourself) is usually right. In tests, **DAMP (Descriptive And Meaningful Phrases)** is better. A test should read like a specification — each test should tell a complete story without requiring the reader to trace through shared helpers.

```ts
// DAMP: each test is self-contained and readable
it('rejects tasks with empty titles', () => {
  const input = { title: '', assignee: 'user-1' };
  expect(() => createTask(input)).toThrow('Title is required');
});

it('trims whitespace from titles', () => {
  const input = { title: '  Buy groceries  ', assignee: 'user-1' };
  const task = createTask(input);
  expect(task.title).toBe('Buy groceries');
});
```

Duplication in tests is acceptable when it makes each test independently understandable. Shared `beforeEach` setup is fine for genuinely common state; shared input shapes that obscure what each test verifies are not.

### Tests describe behaviour through public interfaces

From Pocock's `tdd/SKILL.md`: tests should verify behaviour through **public interfaces**, not implementation details. A good test reads like a specification — `"user can checkout with valid cart"` tells you exactly what capability exists. These tests survive refactors because they don't care about internal structure.

The warning sign: your test breaks when you refactor, but behaviour hasn't changed. If you renamed an internal function and tests fail, those tests were testing implementation, not behaviour.

### The Durability rule

From Pocock's [`triage-issue`](https://github.com/mattpocock/skills/tree/main/triage-issue) skill: **only suggest tests and fixes that would survive radical codebase changes.** Tests should assert on observable outcomes (API responses, file system state, returned values, audit log entries), not internal state. Fixes should describe behaviours and contracts, not internal structure. A good test reads like a spec; a bad one reads like a diff.

### The Beyonce Rule

> If you liked it, you should have put a test on it.

Infrastructure changes, refactoring, and migrations are not responsible for catching your bugs — your tests are. If a change breaks your code and you didn't have a test for it, that's on you.

---

## Bug fixes — the Prove-It Pattern

When a bug is reported, **do not start by trying to fix it**. Start by writing a test that reproduces it. The test must FAIL with the current code. Then fix. The test passes — proving the fix works AND guarding against regression.

```
Bug report arrives
       │
       ▼
Write a test that demonstrates the bug
       │
       ▼
Test FAILS (confirming the bug exists)
       │
       ▼
Implement the fix
       │
       ▼
Test PASSES (proving the fix works)
       │
       ▼
Run full test suite (no regressions)
```

**This composes with tracer-bullet TDD, not against it.** When the behaviour under change is a bug, the first tracer bullet IS the reproduction test. The vertical-slice rule still applies: write ONE failing reproduction test, fix it, then move to the next slice if the bug has multiple facets. Don't write all the failure modes as tests at once — that's horizontal slicing.

Both Addy Osmani's `test-driven-development` skill and Matt Pocock's `triage-issue` skill independently converge on this pattern. Adopting it strongly.

---

## Test anti-patterns

| Anti-pattern                          | Problem                                                         | Fix                                                                                                                                |
| ------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Testing implementation details        | Tests break when refactoring even if behaviour is unchanged     | Test inputs and outputs, not internal structure. See "Test state, not interactions" above (with the carve-out).                    |
| Mocking internal collaborators        | Tests pass while production breaks; brittle to refactor         | Mock at system boundaries only. Use DI for internal collaborators.                                                                 |
| Flaky tests (timing, order-dependent) | Erode trust in the test suite                                   | Deterministic assertions, isolate test state, no shared state between tests                                                        |
| Snapshot abuse                        | Large snapshots nobody reviews; break on any change             | Use snapshots sparingly; review every snapshot diff                                                                                |
| No test isolation                     | Tests pass individually but fail together                       | Each test sets up and tears down its own state in `beforeEach`/`afterEach`                                                         |
| Tests that pass on first run          | May not be testing what you think they're testing               | Verify the test would FAIL if you broke the behaviour. The Prove-It Pattern enforces this for bug fixes.                           |
| Permissive regex assertions           | `\\?d` matches bare `d`, `[^\n]*` middles allow swapped content | Walk through the simplest wrong input. See [SELF-REVIEW.md "Test permissiveness audit"](SELF-REVIEW.md#test-permissiveness-audit). |
| Bug fixes without reproduction tests  | The fix has nothing guarding against the regression             | Apply the Prove-It Pattern — failing test BEFORE fix                                                                               |
| Skipping tests to make the suite pass | The bug is still there; you've just hidden it                   | Fix the test or fix the code. Never `.skip` to ship.                                                                               |

---

## Baseline test counts

For drift detection. Bump these when intentional growth lands.

| Package                  | Count | Notes                     |
| ------------------------ | ----- | ------------------------- |
| `@chief-clancy/core`     | 879   | Refreshed 2026-04-21      |
| `@chief-clancy/terminal` | 758   | Refreshed 2026-04-21      |
| `@chief-clancy/brief`    | 126   | Refreshed 2026-04-21      |
| `@chief-clancy/plan`     | 326   | Refreshed 2026-04-21      |
| `@chief-clancy/dev`      | 1210  | First baseline 2026-04-21 |

`@chief-clancy/scan` ships no unit tests (prompts-only — `src/{agents,commands,workflows}` only) and is excluded from this baseline.

Drift outside these baselines without an intentional change is a Red Flag — see [DA-REVIEW.md](DA-REVIEW.md#red-flags--stop-and-reassess).

---

## See also

- [CONVENTIONS.md](CONVENTIONS.md) — code conventions, naming patterns, TypeScript rules, DI pattern
- [ARCHITECTURE.md](ARCHITECTURE.md) — system architecture and module map
- [DA-REVIEW.md](DA-REVIEW.md) — review checklist (includes test coverage requirements + Required disciplines + Severity Labels)
- [SELF-REVIEW.md](SELF-REVIEW.md) — line-level review including Test permissiveness audit
- [DEVELOPMENT.md](DEVELOPMENT.md) — full review gate flow, Quality Gates, when tests are required
- [RATIONALIZATIONS.md](RATIONALIZATIONS.md) — anti-rationalization index, especially the [Test section](RATIONALIZATIONS.md#test)
