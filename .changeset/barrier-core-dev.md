---
'@chief-clancy/dev': patch
---

Internal: rewrite deep-path imports to `@chief-clancy/core` per Barrier-Core

Updates all `@chief-clancy/core/<subpath>/index.js` imports to resolve against declaration files directly, following the core 0.3.0 deletion of internal barrels. No behaviour change for `@chief-clancy/dev` consumers.
