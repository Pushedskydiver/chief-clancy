---
'@chief-clancy/terminal': patch
---

Fix `/clancy:update-terminal` workflow: fetch changelog from the GitHub
releases API (URL-encoded `chief-clancy@{version}` tag) instead of the
non-existent repo-root `CHANGELOG.md` (changesets emits per-package
CHANGELOGs, never a root one — the previous fetch always 404'd). Also
restructures the update notice prose into unified replaces/preserves
lists so the "two `.clancy/` files will be replaced" footnote no longer
appears to take back the "your project files are preserved" promise.
