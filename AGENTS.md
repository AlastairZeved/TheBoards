# AGENTS.md

Guidance for any AI coding agent working in this repository (Hermes, Claude
Code, Codex, Cursor, …). Humans should read [README.md](README.md) and the
governing records instead.

## What this is

Zezed Boards — a spatial, offline-first PWA. A fixed, bounded page where any
thought becomes a framed, movable, scalable note the instant it is typed;
structure is asserted *after* capture, by where a note sits and how big it is.
Vanilla HTML/CSS/JS. **No frameworks, no build step, no package manager, no
dependencies, no backend.** All data lives client-side in IndexedDB. Keep it
that way — do not introduce a bundler, a framework, or a server unless the
user explicitly asks for one.

## Read before you change anything

Three documents under `docs/` outrank code comments **and this file**:

| File | Answers | Wins on | Cited as |
|---|---|---|---|
| `docs/PRD.md` | what the app is, who it is for, why | product intent | `PRD §x` |
| `docs/UIUX.md` | what it renders, and in what values | **rendering** | `UIUX §x` |
| `docs/DECISIONS.md` | every UI/interaction ruling, in order | the later ruling wins | `B<n>` |

**Grep `DECISIONS.md` first.** A prior ruling has very likely already answered
your question — often to forbid exactly what you're about to do (the band
geometry alone has been ruled on five times: B33 → B35 → B36 → B37 → B38, with
B47 and B50 reopening it). A PR that changes gesture, layout, band/lot, menu,
or routing behavior without a `B<n>` entry will be asked to add one.

**Cite with the document prefix** (`UIUX §3.3`, not bare `§3.3`) — the
numbering spaces overlap between records, and even within `styles.css`.

`UIUX.md` is the rendering authority: every hex, contrast ratio, size, radius,
duration, threshold, and ARIA contract lives there and nowhere else. The
design system's rendered reference is `docs/proofs/proof-10-the-second-swap.html`
(B58) — read the render before re-deriving the design from prose.

## Commands

Serve and open:
```
python3 -m http.server 8000   # then visit http://localhost:8000
```

Run the regression suite (dev-only; not shipped; no test runner/framework —
whole files only, each is one linear scenario):
```
npm install playwright        # onto NODE_PATH; not committed, no package.json
node test/tokens.js           # design contract: UIUX §2 recomputed from shipped hexes (no browser)
node test/mobile.js           # touch capture (§D of DECISIONS), band/lot (B32–36), list view (B44)
node test/desktop.js          # desktop grammar (B19–26, B81), rail (B42), Copy (B43), PDF export (B34)
node test/sw-update.js        # delivery (B36); serves its own throwaway copy on port 8199
```

Env overrides: `BOARDS_URL` (default `http://localhost:8000/index.html`),
`CHROMIUM_PATH`, `SW_TEST_PORT`. There is no lint/build/typecheck command —
the project has none.

## Architecture: facts that explain most of `app.js`

1. **One logical page, one render scale.** The board is a fixed logical
   coordinate space rendered via a single `transform: scale()`
   (`renderScale`/`offX`/`offY`). Positions are stored in that space and
   converted with `toLogical`/`renderX`/`renderY` — never read
   `clientX`/`clientY` directly against note geometry. Viewport changes are a
   frame, never a write (positions are permanent, PRD principle 3).
2. **A single custom gesture recognizer** (`onPointerDown`/`Move`/`Up`, §7)
   drives tap-to-capture, drag, pinch, and the desktop grammar alike; a live
   `matchMedia` switch (`isDesktop`) branches inline. There is no separate
   desktop code path. Read the header comment's 12-section map before
   searching blind in the 130KB file.
3. **IndexedDB is the only persistence** (`boards-db`/`boards`), through a
   debounced save queue (`scheduleSave`/`saveNow`). No server round-trip
   anywhere.
4. **Actions commit on release, guarded against re-fire** (B18 → B81): every
   committing consequence runs through `commitAction()`, which briefly drops a
   second tap. Any new interactive consequence goes through it, not a bespoke
   timeout. Navigation and capture commit nothing a stray tap could duplicate.
5. **Undo is a 5s toast** (`showUndo`/`UNDO_MS`) restoring exact prior state;
   a new destructive action finalizes the prior undo.
6. **PDF export is hand-rolled** (§10.5, no library) reusing the same
   `EXPORT_GEO`/`exportX`/`exportY` math that mirrors the on-screen render.
   The screen/PDF geometry duplication is deliberate until issue #175 rules
   on a single source of truth — do not opportunistically "fix" it.
   (Module-scope state is known, queued debt: issue #176 — do not grow it.)
7. **Routing uses the History API** (`pushState`/`popstate`) so the OS back
   gesture works (B9) — never intercept or shadow it.

`app.js` and `styles.css` are sectioned against `UIUX.md`'s numbering: every
top-level `§` marker in `styles.css` is a UIUX section number, and its header
block is that document's table of contents.

## Shipping discipline (every `app.js`/`styles.css` change)

Bump `sw.js`'s `CACHE` constant (`zeved-boards-v<N>`) — it is the one string
that says which build is live. `test/sw-update.js` pins it, and
`.github/workflows/pages.yml` curls the deployed `sw.js` to assert it matches
the commit: a silent deploy failure is treated as a shipped bug, not a
non-event. Docs-only changes deliberately do not redeploy
(`paths-ignore: '**/*.md'`).

Test taps are dispatched as genuine touch events over CDP, not synthesized
clicks, because the bug class these suites exist to catch lived in the
browser's touch-to-mouse compatibility events (B27b) — keep them that way.

## Commits and PRs

- Subject: short, imperative, the outcome, with driving issue refs —
  `Wrap note text at the sheet's right edge (issue #53)`.
- All four suites pass. A change that pins what a suite asserts rewrites that
  assertion deliberately — say so in the commit message.
- A behavior change ships with its ruling: a new `B<n>` entry in
  `DECISIONS.md` (append-only — supersede, never edit away), plus the
  `UIUX.md`/`PRD.md` section edits it names, in the same PR.
- Work generally traces to a GitHub issue; check for one before assuming a
  change is unscoped.
- Security issues → GitHub Security Advisory, never a public issue.

## Never do (product law)

No accounts, sync, sharing, tags, folders, search, filters, rich text, images,
snapping, reminders, due dates, streaks, infinite canvas, settings, or theme
switch. Dark-only (B16 retired). No backend, bundler, framework, or
`package.json`. Each refusal is argued in `PRD.md`'s out-of-scope table —
boundedness is the feature. If a request collides with this list, the answer
is a PRD amendment and an owner ruling first, not code.

## Never do (record law — issue #207)

`docs/DECISIONS.md` is law, and law is stated by the owner, never authored by
an agent. Agents transcribe owner decisions; they do not make them. Every
entry in DECISIONS.md must carry a `Source:` line quoting the owner's
statement verbatim (issue, PR comment, or chat quote the owner confirmed)
with a link to it. An entry without a source line is not law — it is an agent
invention and any QA pass may delete it on sight. Agents never author, amend,
or supersede rulings except to transcribe an owner statement.
