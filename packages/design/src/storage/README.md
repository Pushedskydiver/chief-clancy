# `storage`

Per-session persistence for the design canvas. One module per file in the session directory — each a thin pair of read/write functions over `node:fs/promises`, with no shared runtime state — plus two pure helpers that touch no disk.

The session layout these modules implement is §2.8 of `.claude/research/phase-f-design-system/ui-vision-spec.md`, and the file↔slice ownership is its §3.0 matrix. That spec is **gitignored** — it is the authority for every `§` reference below, but it is not in the repository, so those citations resolve only where a working copy exists. This README is the implementation-side map of how the modules relate to **each other**.

## Why this file exists

The modules make the same handful of choices differently, and the differences are deliberate: one appends where another overwrites, one guards a filename by charset where another can only guard by containment. Explaining a choice usually means contrasting it with a sibling — so those contrasts kept getting written into module headers, most of them describing several of the others.

That does not hold up. A sentence in `approve.ts` about how `variants.ts` writes is falsified by editing `variants.ts`, and nothing in the toolchain notices: no tool here verifies comment _content_, and the one rule that could bound their volume, `max-lines`, is configured `skipComments: true` — `approve.ts` counted 54 lines against a limit of 300 while carrying a 169-line header. Comment share across this directory climbed at every A-phase slice, and the A5 review found defects only in prose, never in the executable lines.

So: **a module header describes that module's own contract. Facts spanning modules live here.** The test is whether a sentence can be falsified by editing a different file. If it can, it belongs in this file, where there is one copy to keep true instead of four.

## The modules

| file                    | session path                | spec                                                                    |
| ----------------------- | --------------------------- | ----------------------------------------------------------------------- |
| `chat.ts`               | `chat.jsonl`                | global conversation, append-only                                        |
| `threads.ts`            | `threads/{threadId}.jsonl`  | per-element thread, append-only                                         |
| `elements.ts`           | `elements/{slot}.json`      | per-element mutable state                                               |
| `variants.ts`           | `variants/{variantId}.html` | rendered variant body                                                   |
| `approve.ts`            | `approved/{slot}`           | accept marker                                                           |
| `body-normalisation.ts` | —                           | pure; the `[threadId] slot ` prefix rule between chat and thread bodies |
| `fs-errors.ts`          | —                           | pure; narrows `unknown` to an errno-bearing error                       |
| `comments.ts`           | `comments.jsonl`            | **superseded** by `chat.ts` + `threads.ts`; see below                   |

`comments.ts` has no importer but its own test, so it is deletable on its own. What pins the pair's removal to B2 is `schemas/comment.ts`, which `generate/regenerate.ts` still imports — the two come out together when that migrates. The distinction matters: the schema's importer is the constraint, the module's bundling is a decision.

## Write discipline

Three shapes, picked by what the file _is_ rather than by preference.

- **Append** — `chat.ts`, `threads.ts`, `comments.ts`. Accumulating history; a line once written is never revised.
- **Overwrite** — `elements.ts`, `approve.ts`. Current state, replaced wholesale on change. `elements/{slot}.json` is the element's live state; `approved/{slot}` holds whichever variant is accepted _at a time_ (§2.8), so re-accepting after a fresh round replaces it.
- **Write-once** — `variants.ts`, via an exclusive `wx` create. A variant body is generated once and never mutated, and a locked variant carries into the next round keeping both id and body (§2.6), so a second write under a live id is an id collision rather than an update. It throws instead.

**Do not carry one shape's reflex into another.** Write-once is right for a body and wrong for an accept pointer; overwrite is right for a marker and would silently swap a locked variant's body underneath every `elements/{slot}.json` pointer still naming it.

The four writers that take a per-file key share one signature — `(sessionDir, key, payload)`: `elements.ts`, `threads.ts`, `variants.ts`, `approve.ts`. The two that write a single per-session file take `(sessionDir, payload)` instead: `chat.ts`, `comments.ts`.

## Guard shape

Every module that interpolates a caller-supplied **key** into a path guards it, in one of two ways, and the choice is forced by the key's shape. `sessionDir` is the exception and is guarded nowhere — see below.

- **Charset** — `threads.ts` (`threadId`), `variants.ts` (`variantId`), both `/^[A-Za-z0-9_-]+$/`. Chosen because containment alone is _insufficient_ here, not merely because a charset is available: containment silently normalises separators, so `x/../y` would alias onto thread or variant `y`, and `''` would open a real file named `.jsonl` / `.html`. A charset is imposable because both values are opaque single path segments. Note the two are not equally trusted: `threadId` is minted, which is why its module tolerates the charset still admitting the Win32 device names; `variantId` is scraped from raw model output and is the case the guard most needs to catch.
- **Containment** — `elements.ts` and `approve.ts`, both on `slot`. A stable-selector key like `h1.header` cannot be held to an id charset, so the resolved path is tested instead.

**The two containment guards are not ordered, and this is load-bearing.** Measured both directions:

| slot                          | `approve.ts`       | `elements.ts`                                 |
| ----------------------------- | ------------------ | --------------------------------------------- |
| `sub/slot`, `a[href="/docs"]` | rejects            | admits, nesting under a created subdirectory  |
| `''`                          | rejects            | admits, flat as `elements/.json`              |
| `..foo`, `...`                | admits (contained) | rejects, via a `startsWith('..')` prefix test |

`approve.ts` is stricter about nesting because its filename has no extension (so a bare `..` escapes where `elements.ts`'s appended `.json` neutralises it) and because slice 22 iterates `approved/*`, where a nested marker would be invisible. `elements.ts` is stricter about leading dots because its prefix test over-matches contained names.

Neither is simply better. `a[href="/docs"]` is a plausible selector-derived key that one hard-fails and the other silently turns into a directory — the real fix belongs with the unresolved selector→slot mapping (`ui-vision-rework-plan.md`, also gitignored, slice-16 sub-issue). Until then: **Phase C's accept action writes both files for one event, so a slot either guard rejects half-commits.** Validate once, before either write.

Note also that containment tests the _normalised_ path, so separators are rejected only where they survive normalisation — `a/../b` resolves onto slot `b` in both modules, and two distinct slot keys can alias onto one file.

## Read discipline

`threads/{threadId}.jsonl` is durable, not a derived view. `chat.jsonl` carries the same message text behind the `[threadId] slot ` tag, but not the `tag` / `textSnippet` / `status` anchor fields, so a thread rebuilt from chat alone loses its stale-anchor lifecycle state (§2.8 reconstruction note).

- **Strict, with a torn-tail exemption** — `chat.ts`, `threads.ts`. A crash can truncate the final line mid-write, so a _last_ line failing `JSON.parse` is dropped when the file does not end in a newline. Nothing else is forgiven: a line that parses as JSON but fails its schema is version skew or corruption, and throws even in the tail position. Empty lines are filtered first, since a complete file ends in a newline and would otherwise present an empty final row. (Empty, not blank: a whitespace-only line survives the filter and throws.) Forgiving it would make the newest message in every thread silently droppable — a user's comment vanishing from the regeneration context with no error anywhere.
- **Strict, whole-file** — `elements.ts`, `approve.ts`. No line framing, so no torn-tail case; a schema-invalid file throws.
- **Opaque** — `variants.ts`. An HTML body is markup, not a record, so there is nothing to validate against and no `schemas/` pair. A truncated write reads back as shorter markup and cannot be detected here.
- **Lenient** — `comments.ts`, superseded. It swallows every unparseable _and_ schema-invalid line. This is the behaviour the strict readers were written not to inherit.

A missing file is never an error: it means "nothing written yet" and reads as `[]` from the line-oriented readers, `null` from the single-record ones. Other I/O failures (EACCES, EISDIR, ENOSPC) propagate. Because their reads are strict, the strict-read appenders (`chat.ts`, `threads.ts`) validate before writing — one bad line would otherwise poison a whole file, and the static type does not cover a caller assembling a record from untyped input. `comments.ts` does not validate, which is of a piece with its lenient read.

## The clock

`ts` is caller-minted almost everywhere, and the exception is principled:

- A module **handed a finished record** takes `ts` on the record and stays clock-free — `threads.ts` and `chat.ts` on every line, `elements.ts` on the nested `accepted` pointer, which is the only `ts` its schema carries and is `null` until a variant is accepted.
- A module that **constructs its own record** owns the clock and takes `now?: Date` — `approve.ts` alone.

The reason is pairing. One user action writes a `chat.jsonl` line _and_ a `threads/*.jsonl` line, and the pair must carry the same `ts`; two modules each defaulting `now ?? new Date()` cannot guarantee that, whereas one caller-minted timestamp fanned out to both does by construction.

**This applies to accept as well**, which is easy to miss because `approve.ts` has a default. Accept writes two records for one event — the marker and `elements/{slot}.json`'s `accepted` pointer — so Phase C's accept action must pass `now` explicitly, with the same instant it writes into `elements.accepted`. The default is for a marker written on its own.

The action-layer caller that mints `ts` and fans it out does not exist yet; Phase C is where it lands. `threadId` is a mint point too, and must stay inside `/^[A-Za-z0-9_-]+$/`.

The other four modules are out of scope here: `variants.ts` stores a body with no timestamp at all, `comments.ts` is handed a record carrying its own `createdAt`, and the two pure modules touch neither clock nor disk.

## Directories and failure windows

**No module guards `sessionDir`.** The guards above cover the per-file key only — the slot, the thread id, the variant id. The session directory itself is interpolated raw by all six fs-touching modules, so **the caller must validate that `sessionDir` is within the canvas-session root before calling any of them.** Before this file existed the contract was stated only in `comments.ts`, which B2 deletes; it is recorded here so it outlives that module.

Modules whose file sits in a subdirectory create it (`threads.ts`, `elements.ts`, `variants.ts`, `approve.ts`); because the mkdir is recursive it will also materialise a missing `sessionDir`. Modules whose file sits directly in the session directory do not (`chat.ts`, `comments.ts`), so the caller owns that lifecycle and an ENOENT on the directory propagates rather than being papered over.

Known windows, none of them treated:

- **Overwrite** truncates before writing, so a crash mid-overwrite leaves a partial file that the strict read throws on rather than reporting as absent. Safe direction — state in doubt refuses to be read rather than silently reverting — but a previously written slot can become unreadable until rewritten. `elements.ts` and `approve.ts` share this.
- **Write-once** cleans up after a failure that follows its exclusive create, since write-once would otherwise make a truncated body permanent. Best-effort: a process killed between create and write, or a cleanup that itself fails, leaves residue that must be deleted by hand. A failure _preceding_ the `O_EXCL` check (fd exhaustion, measured with EMFILE) reports a non-EEXIST errno while a body exists, and the cleanup then deletes it — `open(path, 'wx')` would scope this provably.
- **Guards are lexical, not filesystem-level** — containment and charset alike. A symlink planted at a guarded path is followed by every plain write here. `variants.ts` is the exception, and only incidentally: `O_CREAT|O_EXCL` fails `EEXIST` on a symlink rather than following it.

## Not implemented

Two operations the spec calls for have no code yet, and they sit differently.

- **Un-accept** returns a slot to the unaccepted state (§2.6, and §3.0 as amended in Session 176). It is one action over two files, and they have different owners: deleting `approved/{slot}` is a write to `approve.ts`'s own file, so §3.0's exactly-one-writer-per-file rule puts that leg there; clearing `elements.accepted` to `null` is a write to `elements/{slot}.json`, whose physical writer is slice 18, so that leg rides `elements.ts`. Neither module owns both. It is the same split accept has, and it waits on the same Phase C action.
- **Listing** `approved/*` for slices 21 and 22 (22 iterates unconditionally; 21 offers a walk as the alternative to `--slot`). This is a _read_, and §3.0 permits a reader to read directly, so a primitive here would be drift-prevention rather than ownership. Neither slice is built — they are not part of the A/B/C rework phases at all — and the open questions are its return shape (slot names or parsed markers) and how it treats non-file and symlinked entries.
