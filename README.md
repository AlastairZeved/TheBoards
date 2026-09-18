# Zeved Boards

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

[Task tracking, creative ideation.

Zeved Boards is a spatial, offline-first to-do app that works like a digital sketchbook. It's designed for people who think by placing ideas in physical space, spatial reasoners, neurodivergent minds, or anyone else who needs to see their thoughts laid out and reorganizable visually. Where bullet lists fails, bring a board.

It is also deliberately small. The app is five files of vanilla
HTML/CSS/JavaScript with no frameworks, no build step, no package manager, and
no backend. All data lives on-device in browser cache storage; nothing is sent anywhere,
ever.

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
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

## Security

Zeved Boards is client-only. There is no backend, no account, no sync, no
analytics, and no network call anywhere in the app. Board data lives in the
browser's storage itself and never leaves the device; the only ways data leaves are
the exports you download yourself (a per-board PDF or a whole-library JSON
backup under **Export**).

## Background

This app started in a sketchbook, at a time when I wasn't physically able to use any screens. I still needed my to do list, my thoughts, my ideas; but a notepad just wasn't cutting it. Instead I just drew two lines and a title, then drew a box around the title. Then I'd write something on it, anywhere, and just draw a box around it to isolate it, to give the thought its own visual space. When I wasn't paying attention, it became my daily driver. The spatial-first organization is wonderful, but so is the simplicity. From thought to 'paper', I just open the app and it's already on the board waiting for me to tap anywhere on it and start typing. No pre-organizing, labeling, tagging, navigating to the right folder - just open, tap, type.

The design draws on gestalt principles (Prägnanz in particular) and on
Miller's working-memory research — a bounded page you can see all of, rather
than an infinite canvas you have to navigate. For other tools like this, the wonderful community sits over at the Malleable Systems Collective.

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
and your way to move a library between devices; **Import** it when needed.

### Dependencies

None. No frameworks, no bundler, no package manager, no
runtime dependencies. Fonts (Montserrat Alternates) are self-hosted in
`fonts/`, and the PDF exporter is hand-rolled in `export.js` rather than pulled
from a library.

## Usage

Everything happens on the one canvas; there is nothing behind it. Nothing
scrolls: the board is one bounded sheet, and if it's full, it's full — that
boundary is the point.

Every board has the same four permanent regions: **Title**, **Components**,
**Requirements**, and the **Parking Lot**. The Parking Lot is where I park a question - something blocking progress on the board. Requirements are calendar events for that day if there are any and 2-way syncs to the calendar view for the daily to-do boards, otherwise use Components/Requirements as you wish. 

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

Equally binding is what the app refuses to build: accounts, sync, sharing,
tags, folders, search, filters, rich text, images, snapping, reminders, due
dates, streaks, an infinite canvas, settings, and a theme switch. Each refusal
is argued in the PRD's out-of-scope table — boundedness is the feature, and a
framework or a backend would change what the product is.

## Maintainers

- [AlastairZeved](https://github.com/AlastairZeved) — design, product, and
  direction.

## Contributing

Questions and proposals go to
[the GitHub issues](https://github.com/AlastairZeved/TheBoards/issues) — that
is also where design questions are settled: a ruling made on an issue
describes itself in the issue thread and lands in `DECISIONS.md`.

Pull requests are accepted. Requirements:ghjb

- **Behavior changes resolve against the governing records.** A PR that changes
  gesture, layout, band/lot, menu, or routing behavior without a `B<n>` entry
  will be asked to add one.
- **All four test suites must pass**, and a change that pins what a suite
  asserts rewrites that assertion deliberately — say so in the commit message.
- **Commit subjects are short, imperative, and describe the outcome**, with
  the driving issue number(s) in parentheses, e.g.
  `Wrap note text at the sheet's right edge (issue #53)`.
- The service worker's `CACHE` string is bumped on every shipped change to
  `app.js` or `styles.css`.

## License

[MIT](LICENSE) © AlastairZeved.

Zeved Boards is released under the MIT License — the full text is in
[`LICENSE`](LICENSE). The name Zeved Boards, the design, and the governing
records remain the work of their author.

[Back to top](#theboards)
