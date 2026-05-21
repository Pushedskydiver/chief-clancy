# `canvas/hooks`

Custom React hooks consumed by canvas components. Each hook is one file using the `use*` prefix; hooks live here rather than next to their consumer because hook contracts (return shapes, dependency signatures) outlive any single component and are likely to be shared.

Tests for hooks: prefer integration coverage through the consumer component (rendered via `@testing-library/react`) when the consumer is small and the contract is fully exercised by the consumer's tests. Add a dedicated `renderHook`-based unit test when the hook gains behaviour not covered by any consumer's render path (e.g. exposes setters, configuration knobs, or composes with other hooks).
