---
'@chief-clancy/core': minor
---

**Breaking:** tighten `package.json` `exports` to four namespaced subdirectory wildcards.

The top-level `./*.js` wildcard export has been replaced with four explicit subpaths:

- `./types/*.js`
- `./schemas/*.js`
- `./shared/*.js`
- `./board/*.js`

Consumers may import from the package root (`@chief-clancy/core`) or any of the four subpaths above. Top-level deep imports like `@chief-clancy/core/foo.js` are no longer resolvable.

This is a breaking change under pre-1.0 semver — bumping `0.1.2 → 0.2.0`. The published 0.1.x range accidentally exposed every file under `dist/` via the top-level `./*.js` wildcard; 0.2.0 restricts the surface to the four intentional namespaces. In-repo consumers (`@chief-clancy/terminal`, `@chief-clancy/dev`) were already using the four subpaths exclusively; the narrowing makes the public API surface explicit for published consumers.

See `packages/core/README.md` for the full deep-import policy.
