# Decision Documents

Design decisions for Clancy features — the "why" behind non-obvious choices. The code is the source of truth for "what" and "how."

## What belongs here

- **Briefs** (`brief.md`) — problem statement, success criteria, scope boundaries.
- **Design docs** (`design.md`) — architecture decisions, trade-offs, key choices.

## Lifecycle

1. **Before building:** Create brief and/or design doc
2. **During building:** Reference them
3. **After shipping:** Trim to decisions-only (~50 lines each). The code is the source of truth.

## Current documents

| Directory       | Document               | Purpose                                                                                       |
| --------------- | ---------------------- | --------------------------------------------------------------------------------------------- |
| `monorepo/`     | `brief.md`             | Monorepo rebuild — full brief with 15 phases, standards, PR breakdowns                        |
| `architecture/` | `package-evolution.md` | Package evolution strategy — v1 as core+terminal, internal capability boundaries, future plan |

## Related docs

- [Architecture](../ARCHITECTURE.md) — system architecture and module map
- [Roles](../roles/) — role overviews
- [Guides](../guides/) — configuration, security, troubleshooting
- [Glossary](../GLOSSARY.md) — terminology
