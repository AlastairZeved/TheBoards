# Zeved Boards

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

[Task tracking, creative ideation.

A personal, offline, installable web app for notes and tasks that works like a sketchbook page. You tap anywhere on a bounded canvas, a note box appears, and you type. You can drag notes around, resize them, and connect them. The position and size of a note are the organization; no folders, tags, search, filters, or settings. 

Storage is local only through browser storage. Export/import of JSON for backups. Export to PDF (both spatially and list form) for sharing.  

Each board has four fixed areas: Title, Components, Requirements, and Parking Lot. Boards are grouped into To Do, Ideas, Notes, and Learning. On wide screens there’s also a calendar rail. For To Do Boards, Requirements is the only section with rules since it functions as a 2-way sync with the Calendar for any events on that day. 

It is also deliberately small. The app is five files of vanilla
HTML/CSS/JavaScript with no frameworks, no build step, no package manager, and
no backend. All data lives on-device in browser cache storage; nothing is sent anywhere,
ever.

## Why it exists:
Because most task apps force you to decide where something belongs before you’ve even written it down. This flips that: capture first, structure later by moving things around. It’s an external working memory. The page holds the thoughts so your head doesn’t have to. Whether you're in a hurry, just need to 'jot it down quick', or an outright fellow scatterbrain - capture first, organize second is the point. 

This is not for teams, shared projects, cross-device sync, heavy task management, or anyone who needs search across a large archive.

## Background

This app started in a sketchbook, at a time when I wasn't physically able to use any screens. I still needed my to do list, my thoughts, my ideas; but a notepad just wasn't cutting it. Instead I just drew two lines and a title, then drew a box around the title. Then I'd write something on it, anywhere, and just draw a box around it to isolate it, to give the thought its own visual space. When I wasn't paying attention, it became my daily driver. The spatial-first organization is wonderful, but so is the simplicity. From thought to 'paper', I just open the app and it's already on the board waiting for me to tap anywhere on it and start typing. No pre-organizing, labeling, tagging, navigating to the right folder - just open, tap, type.

The design draws on gestalt principles (Prägnanz in particular) and on
Miller's working-memory research — a bounded page you can see all of, rather
than an infinite canvas you have to navigate. For other tools like this, the wonderful community sits over at the Malleable Systems Collective.

#How to use it:

pen the GitHub Pages URL (https://alastairzeved.github.io/TheBoards/) and/or install it as a PWA from the website. 
Tap the empty canvas to create a note. 
Type. Drag to move, pinch to resize. 
Tap once to select, tap again to edit. 
Long-press or right-click for the note menu. Link notes by choosing Link and then tapping another note. 
Completing a note scratches it out instead of deleting it, and you get a 5-second undo. 
Export/import JSON is your backup and transfer method. 
On desktop, use the left rail to switch boards; on phone, the calendar becomes a full-screen view.

### Dependencies

None. No frameworks, no bundler, no package manager, no
runtime dependencies. Fonts (Montserrat Alternates) are self-hosted in
`fonts/`, and the PDF exporter is hand-rolled in `export.js` rather than pulled
from a library.

## Security

Zeved Boards is client-only. There is no backend, no account, no sync, no
analytics, and no network call anywhere in the app. Board data lives in the
browser's storage itself and never leaves the device; the only ways data leaves are
the exports you download yourself (a per-board PDF or a whole-library JSON
backup under **Export**).

## How to Use

Everything happens on the one canvas; there is nothing behind it. Nothing
scrolls: the board is one bounded sheet, and if it's full, it's full - that
boundary is the point.

Every board has the same four permanent regions: **Title**, **Components**,
**Requirements**, and the **Parking Lot**. The Parking Lot is where I park a question - something blocking progress on the board. Requirements are calendar events for that day if there are any and 2-way syncs to the calendar view for the daily to-do boards, otherwise use Components/Requirements as you wish. 

### Desktop, Tablet, Mobile

Three different modes to use with three different views - all spatial first, meaning everything you need is visually available to you in the field of vision at all times. Long tap/right click menu and the note card button row are the only menus without a visual access point, but hopefully they feel as intuitive to you as they do to me. 

Tablet mode is my favorite (tailored to work on foldables as tablets). 

### For Everything Else

Play around, discover it. Have fun taking notes.

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
