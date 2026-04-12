---
'@chief-clancy/brief': minor
'@chief-clancy/plan': minor
'@chief-clancy/dev': minor
'@chief-clancy/terminal': patch
'chief-clancy': patch
---

Add per-package update commands (`/clancy:update-brief`, `/clancy:update-plan`, `/clancy:update-dev`) and rename terminal's `/clancy:update` to `/clancy:update-terminal` with a thin redirect at the old location.

Each standalone update workflow: version detection via VERSION marker, npm latest check with 5s timeout, changelog from GitHub releases API (URL-encoded tags), terminal coexistence + standalone package advisories, install mode detection (local/global/both), `--afk` confirmation skip, `npx @latest` cache bypass, post-update verification.

Uninstall workflows updated to list update files for deletion. Installer file lists and printSuccess output updated across all packages.
