---
'@chief-clancy/dev': patch
'@chief-clancy/terminal': patch
---

Extract four compound boolean conditions into named constants per CONVENTIONS.md §Code Style "Name compound boolean conditions". `shouldBranchFromEpic` helper in `branch-setup.ts` replaces two duplicate uses of `hasParent && !skipEpicBranch`. Named `const`s replace inline three-part `instanceof`/`'code' in err` checks in `session-report.ts` (ENOENT) and `lock.ts` (EPERM), and the 4-part hours/minutes range check in `queue.ts`.
