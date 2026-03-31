---
'@chief-clancy/terminal': patch
'chief-clancy': patch
---

Fix hook errors: add required `matcher` field to settings.json hook entries, replace detached child process in check-update with synchronous npm check (5s timeout), and show installed version in the statusline.
