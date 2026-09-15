# TheBoards

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

Task tracking, creative ideation.

TheBoards is a spatial, offline-first to-do PWA built cognitive-first — for
spatial reasoners and neurodivergent minds, and for anyone who thinks by
putting things where they can see them. It is one fixed, bounded page where
any thought becomes a framed, movable, scalable note the instant it is typed.
There are no folders, no tags, no forms, no settings, and no modes: structure
is asserted *after* capture, by where a note sits and how big it is — and only
the person who put it there decided that.

It is also deliberately small. The app is five files of vanilla
HTML/CSS/JavaScript with no frameworks, no build step, no package manager, and
no backend. All data lives on-device in IndexedDB; nothing is sent anywhere,
ever. This is not an accident of scope — it is the product's stated hard law
(see [Design Philosophy](#design-philosophy)).

Because the interface is opinionated to an unusual degree, this repository is
governed the way a small product is, not the way a library is: three documents
under `docs/` outrank code comments and define what the app is, what it
renders, and every interaction ruling ever made. A new contributor should read
[The Governing Records](#the-governing-records) before proposing a change to
behavior.

## Table of Contents

- [Security](#security)
- [Background](#background)
- [Install](#install)
  - [Dependencies](#dependencies)
- [Usage](#usage)
  - [On touch](#on-touch)
  - [With a mouse and keyboard](#with-a-mouse-and-keyboard)
  - [Boards, categories, and the calendar](#boards-categories-and-the-calendar)
- [Design Philosophy](#design-philosophy)
- [Project Structure](#project-structure)
- [The Governing Records](#the-governing-records)
- [Testing](#testing)
- [Maintainers](#maintainers)
- [Thanks](#thanks)
- [Contributing](#contributing)
- [License](#license)

## Security

TheBoards is client-only. There is no backend, no account, no sync, no
analytics, and no network call anywhere in the app. Board data lives in the
browser's IndexedDB and never leaves the device; the only ways data leaves are
the exports you trigger yourself (a per-board PDF or a whole-library JSON
backup under **Export**).

If you find a security issue, please open a
[GitHub Security Advisory](https://github.com/AlastairZeved/TheBoards/security/advisories/new)
rather than a public issue, so it can be assessed before details are public.
Include steps to reproduce and the affected version — the `sw.js` `CACHE`
string, e.g. `todo-boards-v48`.

## Background

This app started in a sketchbook. When a thought arrived, it got written down
and a square was drawn around it — not to decorate it, but to isolate it. A
boxed thought is a thought you can *see*, separate from every other thought
making noise for attention. The real shift came when all of those squares
lived on one page together: thoughts stopped rolling around in my head and
started sitting somewhere I could look at, point at, move, and make bigger or
smaller. The page held them so my head didn't have to.

TheBoards is that sketchbook, kept honest. Tap the canvas and a framed note
appears under your fingers — the square draws itself the moment you type.
Place is structure. Size is priority. Nothing else is required of you.

The product exists for one person on their own device. There is no second
user, no team, no sharing model, and no plan to add one. It deliberately does
not decide what kind of tool it is: task tracking, creative ideation,
note-taking, problem-solving — one surface, no modes. A board is whatever the
person puts on it.

The design draws on gestalt principles (Prägnanz in particular) and on
Miller's working-memory research — a bounded page you can see all of, rather
than an infinite canvas you have to navigate. The project's thinking sits in
the same current as the malleable-software community; see the
[Malleable Systems Collective](https://malleable.systems/).

## Install

**Use it directly** — the app is deployed on GitHub Pages:
<https://alastairzeved.github.io/TheBoards/>

Open it in a browser, or install it as an app (browser menu → *Install app* /
*Add to Home Screen*) for the standalone, fully offline experience.

**Run it yourself** — clone or download this repository and serve the folder;
there is nothing to build:

```sh
git clone https://github.com/AlastairZeved/TheBoards.git
cd TheBoards
python3 -m http.server 8000   # then visit http://localhost:8000
```

Any static file server works; the app is served as-is. The app is split into
native ES modules (`app.js` imports `state.js`, `persistence.js`,
`geometry.js`, `render.js`, `interactions.js`, `menus.js`, `export.js`,
`boards.js`) — so it must be served over HTTP(S), not opened as a local
`file://` (browsers block module imports on the file protocol).

Data is per-device by design. The JSON export under **Export** is your backup
and your way to move a library between devices; **Import** restores it.

### Dependencies

The shipped app has none — no frameworks, no bundler, no package manager, no
runtime dependencies. Fonts (Montserrat Alternates) are self-hosted in
`fonts/`, and the PDF exporter is hand-rolled in `export.js` rather than pulled
from a library.

The regression suite (dev-only, never shipped) needs Node and Playwright:

```sh
npm install playwright   # somewhere on NODE_PATH; not committed, no package.json
```

## Usage

Everything happens on the one canvas; there is nothing behind it. Nothing
scrolls: the board is one bounded sheet, and if it's full, it's full — that
boundary is the point.

Every board has the same four permanent regions: **Title**, **Components**,
**Requirements**, and the **Parking Lot**. The Parking Lot holds plain stacked
lines for the small thoughts that don't need a frame yet — tap the lot, type,
done. The free canvas above the lot is where notes live.

A 68-second product showcase lives at [`product_showcase`](product_showcase)
in this repository.

### On touch

- **Tap** empty canvas → a note appears in edit mode with the caret placed.
  The frame draws itself on the first character; no empty frame ever exists.
- **Drag** to move a note (free overlap, no snapping). **Pinch** to scale it.
- **Tap a note once** to select it — its own small toolbar appears on the
  frame (Complete · Copy · Link · Delete). **Tap again to edit.**
- **Long-press** for the note menu, including **Link** (then tap another note
  to connect the two) and **Highlight**.
- **Delete is undoable for 5 seconds** — an undo toast appears; a completed
  note is scratched out, not removed. The scratch-out stays: it is the record
  that the work happened.
- The **board-action tabs** hover above the Parking Lot: **All boards**
  (the 2×2 board picker — the OS back gesture returns you), **Export**
  (PDF of this board · JSON backup of every board), **Import** (restore a
  backup), and **All** (opens the calendar).

### With a mouse and keyboard

When a fine pointer is present and the window is ≥ 1024 px, the same board
speaks mouse-and-keyboard: **click** to select (the toolbar appears under the
note), **drag the frame edge** to resize, **double-click** to edit, **Esc** to
deselect, **Delete** to remove, **shift-click** to select several notes at
once, and **right-click** for the note menu. A **board rail** on the left
holds every category with every board, so there is no "all boards" step — the
boards are already visible. Capability, not width, decides: tablets keep the
touch grammar; a device is classified by width (≥ 744 px takes the tablet
arrangement), never by orientation.

### Boards, categories, and the calendar

Boards live in four categories — To Do, Ideas, Notes, Learning — created with
**New board** from the rail or the board picker. On wide screens a standing
**calendar rail** on the right edge expands into a Calendar Board: day cards
whose lines are edited in place, linked to their boards. On phones the
calendar is a full-screen view from the action row, with the back gesture
returning you.

## Design Philosophy

The design is opinionated about cognition, and it states its own rules in
[`docs/PRD.md`](docs/PRD.md) — every change to the interface is resolved
against them. Five product principles govern every ruling in the repository:

1. **Capture precedes structure.** A thought must reach the page in the time
   it takes to type it. Nothing — no mode, no dialog, no picker, no animation
   — may stand between the intent to write and the caret.
2. **Relationships are asserted, not inferred.** The app never groups, tags,
   sorts, or suggests. Where a note sits and how big it is *is* the meaning,
   and only the person who put it there decided that.
3. **Positions are permanent.** A committed position is data. Rotating the
   phone, resizing the window, opening the board on another device — these
   render stored coordinates differently; they never rewrite them.
4. **Zero cognitive tax.** The interface asks nothing. No settings, no
   accounts, no onboarding, no empty states to interpret, no dialogs.
   Everything that can be acted on is visible at once.
5. **Work performed stays visible.** Completing something scratches it out; it
   does not vanish.

And the governing design law, which the design system implements:

> **If you have to think about the interface, it failed. Every pixel earns its
> place.**

The emotional register is **Peaceful Fondness** — calm water at depth and at
dusk, a dark, quiet page rather than a bright productivity surface. It should
feel like a place you are glad to return to, not a tool you owe something to.

Equally binding is what the app refuses to build: accounts, sync, sharing,
tags, folders, search, filters, rich text, images, snapping, reminders, due
dates, streaks, an infinite canvas, settings, and a theme switch. Each refusal
is argued in the PRD's out-of-scope table — boundedness is the feature, and a
framework or a backend would change what the product is.

## Project Structure

| File | Role |
|---|---|
| `index.html` | App shell: board view, list view, board-action tabs, menu, toast |
| `styles.css` | Design tokens (dark-only), board geometry, note component; sectioned to match `docs/UIUX.md` |
| `app.js` | Persistence, layout/scale-to-fit, gesture recognizer, editing/drag/pinch, undo, PDF export, board list + routing, boot — 12 numbered sections, mapped in the header comment |
| `manifest.json` · `sw.js` | PWA manifest + stale-while-revalidate offline service worker |
| `icons/` | App icons and the favicon set, generated by `icons/make-icons.js` |
| `fonts/` | Montserrat Alternates 400/600/800, self-hosted woff2 |
| `docs/` | The governing records: `PRD.md`, `UIUX.md`, `DECISIONS.md`, plus mockups, proofs, and point-in-time plans |
| `test/` | Four regression scripts (dev-only; see [`test/README.md`](test/README.md)) |
| `.github/workflows/` | CI, plus the Pages deploy that asserts the deployed `sw.js` is this commit's |

Three architectural facts explain most of the code:

- **One logical page, one render scale.** The whole board is a fixed logical
  coordinate space rendered via a single `transform: scale()`. Note positions
  are stored in that space; viewport changes are a frame, never a write.
- **A single custom gesture recognizer** drives tap-to-capture, drag-to-move,
  pinch-to-scale, and the desktop grammar alike — there is no separate desktop
  code path; a live `matchMedia` switch branches inline.
- **IndexedDB is the only persistence**, written through a debounced save
  queue. There is no server round-trip anywhere in the app.

## The Governing Records

The product, design, and decision records under `docs/` are the real
specification. Code comments cite them; where a code comment and a record
disagree, the record wins.

| File | Answers | Wins on | Cited as |
|---|---|---|---|
| [`docs/PRD.md`](docs/PRD.md) | what the app is, who it is for, why | product intent | `PRD §x` |
| [`docs/UIUX.md`](docs/UIUX.md) | what it renders, and in what values | **rendering** | `UIUX §x` |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | every UI/interaction ruling, in order, with its reason | the later ruling always wins | `B<n>` |

`UIUX.md` is the rendering authority: every hex, contrast ratio, size, radius,
duration, threshold, and ARIA contract lives there and nowhere else.
`DECISIONS.md` is the binding, cumulative record of every ruling — numbered
`B1` through the current build, each tied to an issue and resolved against the
five principles above; later entries explicitly supersede earlier ones. (The
band geometry alone has been ruled on five times.) The HTML mockups under
`docs/mockups/` are a fourth record: drawn specs, not decoration.

If you want to change behavior, the expectations are simple:

- **Grep `DECISIONS.md` first.** A prior ruling has very likely already
  addressed the area you're about to change — often to forbid exactly that.
- **Cite with the document prefix** (`UIUX §3.3`, not bare `§3.3`) — the
  numbering spaces overlap between records.
- **A behavior change ships with its ruling**: a new `B<n>` entry in
  `DECISIONS.md`, plus the UIUX/PRD section edits it names, in the same PR.
- **Bump the `sw.js` `CACHE` version** on every shipped change — it is the one
  string that says which build is live, and the test suite pins it.

## Maintainers

- [AlastairZeved](https://github.com/AlastairZeved) — design, product, and
  direction.

## Contributing

Questions and proposals go to
[the GitHub issues](https://github.com/AlastairZeved/TheBoards/issues) — that
is also where design questions are settled: a ruling made on an issue
describes itself in the issue thread and lands in `DECISIONS.md`.

Pull requests are accepted. Requirements:ghjb

- **Behavior changes resolve against the governing records.** Read
  [The Governing Records](#the-governing-records) first; a PR that changes
  gesture, layout, band/lot, menu, or routing behavior without a `B<n>` entry
  will be asked to add one.
- **All four test suites must pass**, and a change that pins what a suite
  asserts rewrites that assertion deliberately — say so in the commit message.
- **Commit subjects are short, imperative, and describe the outcome**, with
  the driving issue number(s) in parentheses, e.g.
  `Wrap note text at the sheet's right edge (issue #53)`.
- The service worker's `CACHE` string is bumped on every shipped change to
  `app.js` or `styles.css`.

Security issues do not go through public issues or PRs — please open a
[GitHub Security Advisory](https://github.com/AlastairZeved/TheBoards/security/advisories/new)
instead (see [Security](#security)).

## License

[MIT](LICENSE) © AlastairZeved.

TheBoards is released under the MIT License — the full text is in
[`LICENSE`](LICENSE). The name TheBoards, the design, and the governing
records remain the work of their author; if you build on either, an issue
saying so is always appreciated.

[Back to top](#theboards)
