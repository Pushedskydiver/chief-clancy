---
'@chief-clancy/terminal': patch
'chief-clancy': patch
---

Replace detached child process in check-update hook with synchronous npm check. The detached spawn caused Claude Code to report "SessionStart:startup hook error". Now reuses the existing `fetchLatestVersion` and `buildUpdateCache` pure functions instead of duplicating logic in an inline child script.
