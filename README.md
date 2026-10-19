# Zeved Boards

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

A bounded page where a thought becomes a framed, movable, scalable note the
instant it is typed.

Zeved Boards is a personal, offline, installable web app for tasks, ideas and
notes that works like a sketchbook page. Tap anywhere on the page, a note
appears, and you type. Drag notes around, resize them, link them. Where a note
sits and how big it is *is* the organization: there are no folders, tags,
search, filters or settings.

Everything stays on your device. Nothing is sent anywhere.

**Open it:** <https://alastairzeved.github.io/TheBoards/>

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [Security](#security)
- [Design Philosophy](#design-philosophy)
- [Development](#development)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

## Background

Zeved Boards started in a sketchbook, at a time when its author couldn't use
screens at all. A to-do list, ideas and loose thoughts still needed somewhere
to live, and a plain notepad wasn't enough. So each page became the same
drawing: two lines and a title with a box around it. A thought went down
anywhere on the page and got a box of its own, giving it its own visual space.
That page quietly became a daily driver, and this app is that page.

Most task apps make you decide where something belongs before you've written
it down. This one reverses that: capture first, organize later by moving
things around. It is an external working memory. The page holds the thoughts
so your head doesn't have to, whether you're in a hurry, just need to jot
something down, or simply think in scattered pieces.

The design draws on gestalt principles (Prägnanz in particular) and on
Miller's working-memory research: one bounded page you can see all of at
once, rather than an infinite canvas you have to navigate.

It is not for teams, shared projects, syncing across devices, heavy project
management, or searching a large archive.

## Install

There is nothing to download or set up.

1. Open <https://alastairzeved.github.io/TheBoards/> in a browser.
2. Optionally, install it to your home screen or desktop with your browser's
   **Install** or **Add to Home Screen** option.

Once it has loaded once, it works fully offline. It updates itself in the
background when a new version is published, and your boards are never touched
by an update.

## Usage

### The page

Every board is one fixed page. It never scrolls, pans or zooms. If it's full,
it's full, and that boundary is the point.

Every board has four permanent areas:

| Area | What it is for |
|---|---|
| **Title** | The board's name, in the box at the top. |
| **Components** | The left side of the top band. Use it however you like. |
| **Requirements** | The right side of the top band. Use it however you like. |
| **Parking Lot** | Plain lines along the bottom, for questions that are blocking the board. Tap the empty lot to add one. |

Everything between the top band and the Parking Lot is open space for notes.

### Notes

| To… | On a phone or tablet | On a computer |
|---|---|---|
| Make a note | Tap empty space, then type | Click empty space, then type |
| Select a note | Tap it once | Click it once |
| Edit a note | Tap it again | Double-click it, or press Enter |
| Move a note | Drag it | Drag it |
| Resize a note | Pinch it with two fingers | Drag the frame around the selected note |
| Open the note menu | Press and hold | Right-click |

- **Selecting** a note shows its toolbar underneath it, with Complete and
  Delete among its buttons.
- **Completing** a note scratches it out instead of removing it, so the work
  you've done stays visible. **Restore** brings it back.
- **Deleting** something shows an **Undo** for five seconds.
- The **note menu** lets you copy a note, give it a small title, or **Link**
  it. To link, choose Link, then tap another note. Tap a linked note the same
  way to remove the link.

### Boards

Boards are sorted into four groups: **To Do**, **Notes**, **Learning** and
**Ideas**. Each group has its own **New board** button.

- **On a phone**, tap **All** to see your boards.
- **On a tablet or computer**, open the board rail on the left edge.

Each time you open the app, it opens today's To Do board, and any unfinished
notes from yesterday's are moved onto it. A calendar sits on the right edge on
a tablet or computer, and behind the **Calendar** tab on a phone.

The rest is there to discover.

### Backing up and sharing

Your device holds the only copy of your boards, so back them up.

- **Export → PDF** saves the current board as a printable reference sheet: a
  drawing of the page, followed by the board written out as text.
- **Export → JSON** saves a backup of every board.
- **Import** loads a JSON backup. Boards in the file replace their matching
  boards on this device, and everything else is left as it is.

## Security

Zeved Boards runs entirely in your browser. There is no server, no account, no
sync and no analytics. Your boards are stored in the browser's own database
(IndexedDB) on your device and are never sent anywhere. The only network
request the app makes is to its own site, to check for a newer version of
itself.

Your data leaves the device only when you export it yourself.

To report a security problem, open a private
[security advisory](https://github.com/AlastairZeved/TheBoards/security/advisories/new)
rather than a public issue. See [SECURITY.md](SECURITY.md).

## Design Philosophy

The app's rules are written down in [`The Docket/PRD.md`](The%20Docket/PRD.md),
and every change to the interface is decided against them. Five principles
govern every decision:

1. **Capture comes before structure.** A thought must reach the page in the
   time it takes to type it. Nothing, whether a mode, a dialog, a picker or an
   animation, may stand between wanting to write and the cursor.
2. **Relationships are stated, not guessed.** The app never groups, tags,
   sorts or suggests. Where a note sits and how big it is carries the
   meaning, and only the person who put it there decides that.
3. **Positions are permanent.** Where you put a note is data. Rotating a
   phone, resizing a window or opening the board on another screen changes
   how the page is drawn, never where the notes are.
4. **The interface asks nothing.** No settings, no accounts, no onboarding,
   no empty states to work out. Everything you can act on is visible at once.
5. **Finished work stays visible.** Completing something scratches it out. It
   does not disappear.

And the rule the design system serves:

> **If you have to think about the interface, it failed. Every pixel earns its
> place.**

Just as deliberate is what the app will not build: accounts, sync, sharing,
tags, folders, search, filters, rich text, images, snapping, due dates,
streaks, an infinite canvas, settings, or a light/dark switch. Each refusal is
argued in the PRD's out-of-scope table. Being bounded is the feature.

## Development

Zeved Boards is plain HTML, CSS and JavaScript. It has no framework, no build
step, no package manager, no dependencies and no backend. The fonts
(Montserrat Alternates) are stored in [`fonts/`](fonts/), and the PDF writer
is written by hand in [`export.js`](export.js) rather than taken from a
library.

### Run it locally

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

### Files

| File | Holds |
|---|---|
| `index.html`, `styles.css`, `manifest.json`, `sw.js` | The page, its styles, the install details and the offline service worker |
| `app.js` | Start-up |
| `state.js`, `persistence.js`, `geometry.js`, `render.js`, `interactions.js`, `menus.js`, `export.js`, `boards.js` | The app itself, split by job; [`CLAUDE.md`](CLAUDE.md) maps what each owns |
| `test/` | The regression tests (not shipped to devices) |
| `The Docket/` | The governing records, below |

### Governing records

Three documents in [`The Docket/`](The%20Docket/) outrank the code and its
comments:

| Document | Decides |
|---|---|
| [`PRD.md`](The%20Docket/PRD.md) | What the app is, who it is for, and why |
| [`UIUX.md`](The%20Docket/UIUX.md) | What it draws, down to every colour, size and timing |
| [`DECISIONS.md`](The%20Docket/DECISIONS.md) | Every design and interaction ruling, numbered `B<n>`, in order; a later ruling wins |

[`AGENTS.md`](AGENTS.md) is the working guide for AI coding agents.

### Tests

The tests drive the app in a real browser with
[Playwright](https://playwright.dev), installed only on the developer's
machine and never committed:

```sh
npm install playwright
node test/tokens.js
node test/mobile.js
```

[`test/README.md`](test/README.md) lists every suite, what it covers, and
which ones run automatically on each pull request.

## Maintainers

- [AlastairZeved](https://github.com/AlastairZeved): design, product and
  direction.

## Contributing

Questions and proposals go to
[GitHub issues](https://github.com/AlastairZeved/TheBoards/issues). That is
also where design questions are settled: the owner's ruling is made on the
issue and recorded in `DECISIONS.md`.

Pull requests are welcome. They must meet these requirements:

- **Behaviour changes come with a ruling.** A change to gestures, layout, the
  top band or Parking Lot, menus or navigation needs a `B<n>` entry in
  `DECISIONS.md`, recorded from the owner's own words.
- **The tests must pass.** Every suite that runs on pull requests must pass.
  If a change alters what a test checks, rewrite that check on purpose and say
  so in the commit message.
- **Commit subjects are short and describe the outcome**, with the issue
  number in brackets, e.g.
  `Wrap note text at the sheet's right edge (issue #53)`.
- **Shipped code changes bump the version.** Any change to `app.js`,
  `styles.css` or one of the eight modules bumps the `CACHE` version in
  `sw.js`, and `OWN_BUILD` in `app.js` must match it. The tests check this.

## License

[MIT](LICENSE) © AlastairZeved.

The name Zeved Boards, the design and the governing records remain the work of
their author.

[Back to top](#zeved-boards)
