# `storage`

Per-session persistence for the design canvas. One module per file in the session directory, each a thin pair of read/write functions over `node:fs/promises` with no shared runtime state.

The session layout these modules implement is `ui-vision-spec.md` §2.8, and the file↔slice ownership is its §3.0 matrix. Those are the authority; this README is the implementation-side map of how the modules relate to **each other**.

## Why this file exists

The modules make the same handful of choices differently, and the differences are deliberate: one appends where another overwrites, one guards a filename by charset where another can only guard by containment. Explaining a choice usually means contrasting it with a sibling — so those contrasts kept getting written into module headers, five vantage points each describing the other four.

That does not hold up. A sentence in `approve.ts` about how `variants.ts` writes is falsified by editing `variants.ts`, and nothing in the toolchain notices: `tsc`, vitest, knip and publint do not read comments, and `max-lines` is configured `skipComments: true`. Across five slices the comment share of these modules climbed monotonically, and every finding in the A5 review — 39 across five rounds — was in prose rather than code.

So: **a module header describes that module's own contract. Facts spanning modules live here.** The test is whether a sentence can be falsified by editing a different file. If it can, it belongs in this file, where there is one copy to keep true instead of four.

## The modules

| file                    | session path                | spec                                                                                                                              |
| ----------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `chat.ts`               | `chat.jsonl`                | global conversation, append-only                                                                                                  |
| `threads.ts`            | `threads/{threadId}.jsonl`  | per-element thread, append-only                                                                                                   |
| `elements.ts`           | `elements/{slot}.json`      | per-element mutable state                                                                                                         |
| `variants.ts`           | `variants/{variantId}.html` | rendered variant body                                                                                                             |
| `approve.ts`            | `approved/{slot}`           | accept marker                                                                                                                     |
| `body-normalisation.ts` | —                           | pure; the `[threadId] slot ` prefix rule between chat and thread bodies                                                           |
| `fs-errors.ts`          | —                           | pure; narrows `unknown` to an errno-bearing error                                                                                 |
| `comments.ts`           | `comments.jsonl`            | **superseded** by `chat.ts` + `threads.ts`; deleted at B2 with `schemas/comment.ts`, which `generate/regenerate.ts` still imports |

## Write discipline

Three shapes, picked by what the file _is_ rather than by preference.

- **Append** — `chat.ts`, `threads.ts`, `comments.ts`. Accumulating history; a line once written is never revised.
- **Overwrite** — `elements.ts`, `approve.ts`. Current state, replaced wholesale on change. `elements/{slot}.json` is the element's live state; `approved/{slot}` holds whichever variant is accepted _at a time_ (§2.8), so re-accepting after a fresh round replaces it.
- **Write-once** — `variants.ts`, via an exclusive `wx` create. A variant body is generated once and never mutated, and a locked variant carries into the next round keeping both id and body (§2.6), so a second write under a live id is an id collision rather than an update. It throws instead.

**Do not carry one shape's reflex into another.** Write-once is right for a body and wrong for an accept pointer; overwrite is right for a marker and would silently swap a locked variant's body underneath every `elements/{slot}.json` pointer still naming it.

## Guard shape

Every module that interpolates a caller-supplied value into a path guards it, in one of two ways, and the choice is forced by where the value comes from.

- **Charset** — `threads.ts` (`threadId`), `variants.ts` (`variantId`), both `/^[A-Za-z0-9_-]+$/`. Available because these are _minted_ ids. `variantId` needs it most: `generate/single.ts` scrapes it from raw model output with regexes admitting every byte but `"` and `>`.
- **Containment** — `elements.ts` and `approve.ts`, both on `slot`. A stable-selector key like `h1.header` cannot be held to an id charset, so the resolved path is tested instead.

**The two containment guards are not ordered, and this is load-bearing.** Measured both directions:

| slot                          | `approve.ts`       | `elements.ts`                                 |
| ----------------------------- | ------------------ | --------------------------------------------- |
| `sub/slot`, `a[href="/docs"]` | rejects            | admits, nesting under a created subdirectory  |
| `''`                          | rejects            | admits, flat as `elements/.json`              |
| `..foo`, `...`                | admits (contained) | rejects, via a `startsWith('..')` prefix test |

`approve.ts` is stricter about nesting because its filename has no extension (so a bare `..` escapes where `elements.ts`'s appended `.json` neutralises it) and because slice 22 iterates `approved/*`, where a nested marker would be invisible. `elements.ts` is stricter about leading dots because its prefix test over-matches contained names.

Neither is simply better. `a[href="/docs"]` is a plausible selector-derived key that one hard-fails and the other silently turns into a directory — the real fix belongs with the unresolved selector→slot mapping (rework plan, slice-16 sub-issue). Until then: **Phase C's accept action writes both files for one event, so a slot either guard rejects half-commits.** Validate once, before either write.

Note also that containment tests the _normalised_ path, so separators are rejected only where they survive normalisation — `a/../b` resolves onto slot `b` in both modules, and two distinct slot keys can alias onto one file.

## Read discipline

- **Strict, with a torn-tail exemption** — `chat.ts`, `threads.ts`. A crash can truncate the final line mid-write, so a _last_ line failing `JSON.parse` is dropped when the file does not end in a newline. Nothing else is forgiven: a line that parses as JSON but fails its schema is version skew or corruption, and throws even in the tail position. Forgiving it would make the newest message in every thread silently droppable — a user's comment vanishing from the regeneration context with no error anywhere.
- **Strict, whole-file** — `elements.ts`, `approve.ts`. No line framing, so no torn-tail case; a schema-invalid file throws.
- **Opaque** — `variants.ts`. An HTML body is markup, not a record, so there is nothing to validate against and no `schemas/` pair. A truncated write reads back as shorter markup and cannot be detected here.
- **Lenient** — `comments.ts`, superseded. It swallows every unparseable _and_ schema-invalid line. This is the behaviour the strict readers were written not to inherit.

A missing file is never an error: it means "nothing written yet" and reads as `[]`, `null`, or `null` depending on the module's shape. Other I/O failures (EACCES, EISDIR, ENOSPC) propagate. Because reads are strict, the appenders validate before writing — one bad line would otherwise poison a whole file.

## The clock

`ts` is caller-minted almost everywhere, and the exception is principled:

- A module **handed a finished record** takes `ts` on the record and stays clock-free — `elements.ts`, `threads.ts`, `chat.ts`.
- A module that **constructs its own record** owns the clock and takes `now?: Date` — `approve.ts` alone.

The reason is pairing. One user action writes a `chat.jsonl` line _and_ a `threads/*.jsonl` line, and the pair must carry the same `ts`; two modules each defaulting `now ?? new Date()` cannot guarantee that, whereas one caller-minted timestamp fanned out to both does by construction.

**This applies to accept as well**, which is easy to miss because `approve.ts` has a default. Accept writes two records for one event — the marker and `elements/{slot}.json`'s `accepted` pointer — so Phase C's accept action must pass `now` explicitly, with the same instant it writes into `elements.accepted`. The default is for a marker written on its own.

The action-layer caller that mints `ts` and fans it out does not exist yet; Phase C is where it lands. `threadId` is a mint point too, and must stay inside `/^[A-Za-z0-9_-]+$/`.

## Directories and failure windows

Modules whose file sits in a subdirectory create it (`threads.ts`, `elements.ts`, `variants.ts`, `approve.ts`); because the mkdir is recursive it will also materialise a missing `sessionDir`. Modules whose file sits directly in the session directory do not (`chat.ts`, `comments.ts`), so the caller owns that lifecycle and an ENOENT on the directory propagates rather than being papered over.

Known windows, none of them treated:

- **Overwrite** truncates before writing, so a crash mid-overwrite leaves a partial file that the strict read throws on rather than reporting as absent. Safe direction — state in doubt refuses to be read rather than silently reverting — but a previously written slot can become unreadable until rewritten. `elements.ts` and `approve.ts` share this.
- **Write-once** cleans up after a failure that follows its exclusive create, since write-once would otherwise make a truncated body permanent. Best-effort: a process killed between create and write, or a cleanup that itself fails, leaves residue that must be deleted by hand. A failure _preceding_ the `O_EXCL` check (fd exhaustion, measured with EMFILE) reports a non-EEXIST errno while a body exists, and the cleanup then deletes it — `open(path, 'wx')` would scope this provably.
- **Containment is lexical, not filesystem-level.** A symlink planted at a guarded path is followed by every plain write here. `variants.ts` is the exception, and only incidentally: `O_CREAT|O_EXCL` fails `EEXIST` on a symlink rather than following it.

## Not implemented

Two operations the spec calls for have no code yet. Both belong to `approve.ts` and wait on Phase C.

- **Un-accept** deletes `approved/{slot}` and clears `elements.accepted` to `null` (§2.6, and §3.0 as amended in Session 176). One action, both files — the same dual-write pairing accept has.
- **Listing** `approved/*` for slices 21/22. §3.0 permits a reader to read directly, so this is drift-prevention rather than ownership; its shape follows slice 21's undecided `--slot`-vs-walk-all CLI.
