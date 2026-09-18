# Regression tests

Dev-only tooling. **The app itself still has no dependencies and no build step** —
nothing here is served, bundled, or shipped to the device.

Four scripts: three drive a real Chromium through Playwright and assert the
behaviour of the gesture recognizer, the capture path, the layout guard, and
delivery; `tokens.js` needs no browser at all:

| Script | Covers |
|---|---|
| `tokens.js` | The design contract: `UIUX §2`'s tables recomputed from the shipped hexes — plain Node, no browser |
| `mobile.js` | Touch capture (§D of `docs/DECISIONS.md`): instant note creation, focus and caret, long-press on bare paper, touch slop, empty-frame sweeps, the keyboard-resize guard, menu dismissal, board-row export. Plus band/lot geometry (B32–B36), including the free canvas on a short sheet and `EXPORT_GEO`'s agreement with the `--band-h` ceiling. And the list view's categories (B44): touch-drag between sections, the pager, and all three readings of a press |
| `desktop.js` | Desktop grammar (B19–B26): instant capture and instant action commit (B81), click-to-select, double-click edit, rail create/swap, right-click menu, drag, PDF export (B34) — menu order, byte-accurate xref, and that a completed item's text is absent from the file. Plus the Copy selection button (B43) and the rail's categories, drag, and pager (B42) |
| `sw-update.js` | **Delivery** (B36): that a shipped `styles.css`/`app.js` change actually reaches an installed PWA rather than sitting behind a stale service-worker cache |

Taps are dispatched as genuine touch events over CDP rather than synthesised
clicks, because the bug they exist to catch lived in the browser's
touch-to-mouse compatibility events (B27b) — synthetic clicks would not see it.

## Running

```
python3 -m http.server 8000        # serve the repo root
npm install playwright             # somewhere on NODE_PATH; not committed
node test/tokens.js                # no server, no browser
node test/mobile.js
node test/desktop.js
node test/sw-update.js             # serves its own throwaway copy; no server needed
node test/morning.js               # B108 morning lifecycle (needs the server)
node test/future-event.js          # B131 future-dated events (needs the server)
```

All suites exit non-zero on failure. The four CI suites (tokens, mobile,
desktop, sw-update) run in CI (`.github/workflows/ci.yml`); the behavioral
suites — boot-order, carried, day-roll, embed, frame-guard, month, morning,
reminder, future-event — run locally/QA against the server.

- `BOARDS_URL` overrides the served URL (default `http://localhost:8000/index.html`).
- `CHROMIUM_PATH` points at a specific Chromium binary; otherwise Playwright's own
  download is used.

- `SW_TEST_PORT` moves `sw-update.js`'s throwaway server off `8199`. It serves its
  own mutable copy of the app rather than the repo root, because it has to change
  files under a live service worker.

Run against the commit *before* the §D fixes and the mobile suite reproduces the
original capture-session failure in full, including the `TypeError` from a
long-press on empty canvas and the sheet collapsing mid-edit. That is what these
assertions are pinned to — keep them honest by checking they can still fail.

`sw-update.js` builds that discipline in: step 2 *requires* the bug to reproduce
before step 3 is allowed to demonstrate the fix. If a change ever makes step 2
pass cleanly, the harness has stopped exercising the service worker and the suite
is lying rather than passing — B36 exists because a green suite and a correct
stylesheet coexisted with a user looking at neither.
