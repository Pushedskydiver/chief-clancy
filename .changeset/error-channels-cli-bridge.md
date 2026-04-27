---
'@chief-clancy/dev': minor
'@chief-clancy/terminal': minor
---

`invokeClaudeSession` switches to async streaming spawn and returns
`Promise<{ ok, stderr }>` with the trailing 4096-char tail of captured
stderr (UTF-16 code units, not bytes — for ASCII the two are equivalent).
`invokeClaudePrint` adds `stderr` to its existing `{ stdout, ok }` return.
A new `StreamingSpawnFn` type + `streamingSpawn` field on
`buildPipelineDeps` opts let the terminal entrypoint inject a real-Node
streaming spawn (via `child_process.spawn`) that tees child stdout/stderr
live to the operator while accumulating buffers for downstream phases to
surface failure context. PR-2 will widen the invoke phase consumer to
forward the captured stderr through the tagged-error union.
