# `canvas/components`

Atomic Design layout. Components live under the level that matches their composition:

- **`atoms/`** — single-purpose UI primitives wrapping one native element (none yet; built from raw HTML primitives until a wrapper earns its weight).
- **`molecules/`** — small functional compositions, either of atoms or directly of HTML primitives (e.g. `CommentModal` — native `<dialog>` + `<textarea>`).
- **`organisms/`** — larger composite sections that own behaviour (none yet).

Each level is a grouping folder, not a one-file wrapper. Files at the same level stay flat within their atomic-level folder; promote to a sub-folder only when a concept genuinely splits into multiple co-located files (component + styles + child sub-components).

The canvas folder also has a sibling `hooks/` directory for custom React hooks the canvas components consume.
