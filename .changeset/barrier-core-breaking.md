---
'@chief-clancy/core': major
---

Barrier-Core: flatten single-impl wrappers and delete fan-out barrels

All internal `index.ts` barrels under `core/src/{types,schemas,shared,board}/` have been deleted (38 total). Single-impl wrapper folders have been flattened (33 total — `X/X.ts` lifted to parent as `X.ts`). Consumers that previously imported from a barrel path (`@chief-clancy/core/types/index.js`, `@chief-clancy/core/schemas/index.js`, `@chief-clancy/core/shared/<p>/index.js`, `@chief-clancy/core/board/<provider>/index.js`, etc.) must now import from the declaration file directly.

**Migration guide:**

- `@chief-clancy/core/types/index.js` → `@chief-clancy/core/types/board.js` | `/types/remote.js` | `/types/progress.js` (per symbol).
- `@chief-clancy/core/schemas/index.js` → `@chief-clancy/core/schemas/env.js` | `/schemas/<provider>.js` | `/schemas/azdo/azdo.js` (per symbol).
- `@chief-clancy/core/shared/<wrapper>/index.js` (env-parser, cache, git-ops, git-token, label-helpers, remote) → `@chief-clancy/core/shared/<wrapper>.js`.
- `@chief-clancy/core/shared/http/index.js` → `@chief-clancy/core/shared/http/fetch-and-parse.js` | `/ping-endpoint.js` | `/retry-fetch.js` (per symbol).
- `@chief-clancy/core/board/index.js` → `@chief-clancy/core/board/detect-board.js`.
- `@chief-clancy/core/board/<provider>/index.js` → `@chief-clancy/core/board/<provider>/<provider>-board.js` + `.../relations.js` (per symbol). Labels were never exposed via the provider barrel — consumers needing label helpers import them directly from `.../labels.js` (covered by the bullet below).
- `@chief-clancy/core/board/factory/index.js` → `@chief-clancy/core/board/factory.js`.
- `@chief-clancy/core/board/<provider>/{api,labels,relations}/index.js` → `.../<kind>.js` (flat) for github/jira/linear/shortcut. For azdo/notion `api/`, the folder remains multi-content: import from `api.js` or `helpers.js` directly.

The `package.json` `exports` map is unchanged — the wildcard patterns (`./types/*.js`, `./schemas/*.js`, `./shared/*.js`, `./board/*.js`) still cover every resolvable path. Only the internal structure within each subtree changed.

Consumers using the package root (`@chief-clancy/core`) are unaffected — `src/index.ts` still exports the same public symbols; it now sources them from declaration files directly.
