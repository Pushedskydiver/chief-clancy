---
'@chief-clancy/brief': patch
'@chief-clancy/plan': patch
'@chief-clancy/dev': patch
'@chief-clancy/terminal': patch
'chief-clancy': patch
---

Cross-package uninstall commands. Each standalone package now ships its own uninstall (`/clancy:uninstall-brief`, `/clancy:uninstall-plan`, `/clancy:uninstall-dev`). Terminal's uninstall renamed to `/clancy:uninstall-terminal` with package-aware detection — checks VERSION markers before removing shared files, preserves other packages' commands and workflows.
