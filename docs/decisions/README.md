# Decision Documents

Design decisions for Clancy features — the "why" behind non-obvious choices. The code is the source of truth for "what" and "how."

## What belongs here

- **Briefs** — problem statement, success criteria, scope boundaries.
- **Design docs** — architecture decisions, trade-offs, key choices.

## Lifecycle

1. **Before building:** Create brief and/or design doc
2. **During building:** Reference them
3. **After shipping:** Trim to decisions-only (~50 lines each). The code is the source of truth.

## Current documents

Decision docs live at `docs/decisions/*.md` (ALLCAPS + flat, matching the top-level `docs/*.md` convention; `README.md` is the standard casing exception).

| Document               | Purpose                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `MONOREPO-REBUILD.md`  | Problem, proposed solution, packages, gains/losses                                                                             |
| `PACKAGE-EVOLUTION.md` | Target package map, dependency direction, extraction criteria, package-scope rules, local-ticket schema, move-first discipline |

## Related docs

- [Architecture](../ARCHITECTURE.md) — system architecture and module map
- [Roles](../roles/) — role overviews
- [Guides](../guides/) — configuration, security, troubleshooting
- [Glossary](../GLOSSARY.md) — terminology
