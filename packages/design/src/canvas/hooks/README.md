# `canvas/hooks`

Custom React hooks consumed by canvas components. Each hook is one file using the `use*` prefix; hooks live here rather than next to their consumer because hook contracts (return shapes, dependency signatures) outlive any single component and are likely to be shared.

For testing posture, folder-promotion thresholds, and the full UI conventions, see `docs/CONVENTIONS.md §UI components`. In short: integration-cover-first via the consumer; promote to a dedicated `renderHook`-based unit test only when the hook gains behaviour not covered by any consumer's render path.
