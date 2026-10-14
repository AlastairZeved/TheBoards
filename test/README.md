# Regression tests

Dev-only tooling. **The app itself still has no dependencies and no build step** —
nothing here is served, bundled, or shipped to the device.

This table is the complete inventory of the 17 standalone scripts in `test/`.
The CI column identifies the suites `.github/workflows/ci.yml` runs on every
pull request and push to `main`; the other suites are available for local/QA
runs.

| Script | Covers | Runs in CI |
|---|---|---|
| `boot-order.js` | Preserves the ordered boot sequence across native-module imports | No |
| `carried.js` | Carried-note frame and glow on the current day | No |
| `day-roll.js` | Day-roll launch and retry behavior | No |
| `day-view-suffix.js` | Calendar day-note rendering, labels, pager, and day-view behavior | Yes |
| `desktop.js` | Desktop grammar, rail, actions, and PDF export | Yes |
| `embed.js` | Embed mode, persistence namespace, and history behavior | No |
| `frame-guard.js` | Allowed and denied iframe origins; starts its own parent-page server | No |
| `future-event.js` | Future-dated events and linked-board lifecycle | No |
| `mobile.js` | Touch capture, gesture, layout, list, and board behavior | Yes |
| `month.js` | Calendar month grid, navigation, and week selection | Yes |
| `morning.js` | Morning board creation, landing, and carry-forward | No |
| `overflow.js` | Narrow-embed overflow across mobile and desktop layouts | Yes |
| `records.js` | Append-only, unique, ascending `DECISIONS.md` numbering | Yes |
| `reminder.js` | Reminder toggle, glow, and surfaced echoes | No |
| `security.js` | Content Security Policy and absence of inline/eval execution surfaces | Yes |
| `sw-update.js` | Installed-PWA service-worker update delivery (serves a throwaway copy) | Yes |
| `tokens.js` | Design-token contract, asset precache, and build-stamp agreement | Yes |

Taps are dispatched as genuine touch events over CDP rather than synthesised
clicks, because the bug they exist to catch lived in the browser's
touch-to-mouse compatibility events (B27b) — synthetic clicks would not see it.

## Running

Serve the repository root when running browser suites that load the app from
`BOARDS_URL` (default `http://localhost:8000/index.html`):

```sh
python3 -m http.server 8000
npm install playwright             # somewhere on NODE_PATH; not committed
node test/tokens.js                # no server or browser
node test/records.js               # no server or browser
node test/security.js              # no server or browser
node test/mobile.js
node test/overflow.js
node test/desktop.js
node test/month.js
node test/day-view-suffix.js
node test/sw-update.js             # own throwaway copy; no repo-root server needed
node test/boot-order.js
node test/carried.js
node test/day-roll.js
node test/embed.js
node test/frame-guard.js
node test/future-event.js
node test/morning.js
node test/reminder.js
```

All suites exit non-zero on failure. `sw-update.js` serves its own mutable copy
of the app because it changes files under a live service worker.

- `BOARDS_URL` overrides the served URL (default `http://localhost:8000/index.html`).
- `CHROMIUM_PATH` points at a specific Chromium binary; otherwise Playwright's own
  download is used.
- `SW_TEST_PORT` moves `sw-update.js`'s throwaway server off `8199`.
- `FRAME_GUARD_PORT` moves `frame-guard.js`'s parent-page server off `9999`.

Run against the commit *before* the §D fixes and the mobile suite reproduces the
original capture-session failure in full, including the `TypeError` from a
long-press on empty canvas and the sheet collapsing mid-edit. That is what these
assertions are pinned to — keep them honest by checking they can still fail.

`sw-update.js` builds that discipline in: step 2 *requires* the bug to reproduce
before step 3 is allowed to demonstrate the fix. If a change ever makes step 2
pass cleanly, the harness has stopped exercising the service worker and the suite
is lying rather than passing — B36 exists because a green suite and a correct
stylesheet coexisted with a user looking at neither.
