---
'@chief-clancy/dev': patch
---

Fix `postPullRequest` missing-field guard: `if (!parsed.url && !parsed.number)` → `||` so the failure branch triggers when EITHER the parsed URL OR the parsed number is falsy, not only when both are. Previously a partial parse (e.g. `{ ok: true, url: '', number: 42 }` or `{ ok: true, url: '...', number: 0 }`) would return a "success" with a broken PR reference. Error message updated from "missing URL and number" → "missing URL or number" to match. Added two tests covering the previously-silent one-of-two-missing cases. Caught by Copilot on PR-H #348 and deferred; now resolved.
