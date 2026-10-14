# CLAUDE.md

Read [AGENTS.md](AGENTS.md) before changing anything — it is the single source
of agent guidance in this repository, for every agent (Claude Code, Hermes,
Codex, Cursor, …).

## Source layout (issue #182 — native ES modules, no bundler)

`app.js` is the module entry (boot + service worker + the test-observability
bridge). The app's code is split into eight dependency-region modules:

| File | Owns (AGENTS.md's section map) |
|---|---|
| `state.js` | graph root, imports nothing — constants, copy, GLYPH, DOM plumbing (`el`/`anchorEls`), MQ consts, the shared `state` carrier, calendar data helpers |
| `persistence.js` | §2 IndexedDB + §3 save queue |
| `geometry.js` | §4 layout/scale-to-fit + §5 coordinate/caret helpers |
| `render.js` | §6 note/anchor/lot rendering + §6.6 links |
| `interactions.js` | §7 gesture recognizer + §8 edit/drag/pinch + §9 complete/undo/toast |
| `menus.js` | §10 long-press menu + board-action row |
| `export.js` | §10.5 PDF + §10.6 JSON backup/import |
| `boards.js` | §11 board list + routing + §11.6 calendar |

Import graph note: several modules import each other (interactions ↔ render,
boards ↔ export, etc.). These are legal ESM cycles. Cross-module bindings are
used inside function bodies; reads of `state.js` constants at module evaluation
are also safe (`persistence.js:11`, `export.js:367`). `persistence.js:24`
opens IndexedDB at load time; that existing side effect is tracked separately.
`boot()`'s register calls (plus `test/boot-order.js`) pin the load order, and
each region exposes a `register*()` called from `boot()`.

`test/` suites are black-box by ruling (issue #182): they drive the page
through Playwright and read source text. Module internals reach the suites
via `app.js`'s window bridge (live getters, after boot).