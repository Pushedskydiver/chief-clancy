---
'@chief-clancy/terminal': patch
---

Break the last pre-existing madge cycle in `packages/terminal/src` by extracting `InstallSources` + `BUNDLE_SCRIPTS` from `installer/install/install.ts` to a new `installer/install/install-shared.ts`. `InstallSources` added to the public type surface. No runtime behaviour change.
