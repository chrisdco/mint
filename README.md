# mint — Sequence CRDT playground

Vanilla-JS, zero-dependency demo of a Logoot-inspired Sequence CRDT: two clients, offline partition simulation, op-log + fractional-ID visibility, strong eventual convergence.

Live: open `crdt-playground/index.html` in a browser (no build). Click **Run offline demo**: A goes offline, both type, reconnect → same text.

## Why this is interesting

Most collab demos hand-wave conflicts. This one makes them impossible by construction: every char gets a fractional ID `(digit, siteId)[]`, ordered lexicographically. Concurrent inserts at the same spot get distinct IDs and sort deterministically on every replica.

## Run

```
open crdt-playground/index.html
npm test   # 6 convergence tests, no deps (node --test)
```

## How it works

- `crdt-playground/crdt.js` — `SequenceCRDT`: `generateIdBetween / compareIds / localInsert / localDelete / remoteInsert / remoteDelete / findIndex`. Out-of-order deletes are buffered in `pendingDeletes`, not dropped.
- `crdt-playground/app.js` — `NetworkSimulator` (10ms delivery, per-client undelivered queue) + prefix/suffix diff per keystroke + sync-status / reset / scripted partition demo.
- Open `Internal CRDT State` to see IDs; `Operation Log` to see local vs remote ops.

## Limits (by design)

- Linear `findIndex` O(n) — fine for a playground, use Yjs/Automerge for real docs.
- Single contiguous edit per input event; no rich text / cursors.
- No persistence — refresh resets.

## Where this goes

Proved useful as reference for offline-first sync (`buds` location queue, `VimTex` Yjs presence). Not a Yjs competitor — keep it small and readable.
