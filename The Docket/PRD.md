# PRD.md — Zeved Boards

**Status:** v1 of the specification, written after the MVP. The app was built
first; this document reconstructs its product rules from the working code and
`DECISIONS.md`, and adds §9, which states the design system's position for v2.

**How to read this with the other records.** `DECISIONS.md` is the binding,
cumulative record of every UI/interaction ruling (A1, B1–B170+), each resolved
against the principles in §1 below. Where this document and `DECISIONS.md`
disagree, **`DECISIONS.md` wins** — it is the later, issue-tied ruling, and
several of its entries deliberately supersede earlier positions stated here.
This document exists to say what the app *is* and what it is *for*, so that a
new ruling has something to resolve against.

`UIUX.md` is the third record and the **rendering authority** (`DECISIONS.md`):
it holds every value the app draws with. This document holds positions; where a
value appears here it is quoted from `UIUX.md`, never authored here. §9.3 maps
the two, and §10 states the boundary.

Sections are numbered to match the citations already in `app.js`, `styles.css`,
`sw.js` and `DECISIONS.md`.

---

## §1 Principles

Five product principles. Every ruling in `DECISIONS.md` resolves against these.

1. **Capture precedes structure.** A thought must reach the page in the time it
   takes to type it. Nothing — no mode, no dialog, no picker, no animation, no
   400ms window — may stand between the intent to write and the caret.
2. **Relationships are asserted, not inferred.** The app never groups, tags,
   links, sorts or suggests. Meaning is expressed by where a thing sits and how
   big it is, and only the person putting it there decides that.
3. **Positions are permanent.** A committed position is data. Layout changes —
   rotation, resize, a different device, a new build — render stored coordinates
   differently; they never rewrite them.
4. **Zero cognitive tax.** The interface asks nothing. No settings, no accounts,
   no sync state, no onboarding, no empty states to interpret.
5. **Work performed stays visible.** Completing something does not remove it.
   The scratch-out is the record that the work happened.

And the governing design law, which §9 implements:

> **If you have to think about the interface, it failed. Every pixel earns its
> place.**

### §1.1 Emotional identity

The five principles say what the app *does*. This says what it should *feel*
like, and it is equally binding on §9.

**Peaceful Fondness.** The board should feel like a place you are glad to
return to. Not productive-anxious, not gamified, not neutral-corporate.

**Imagery:** calm water — beaches, rivers, brooks — at depth and at dusk, not
noon glare. That is why the palette (§9.2, `UIUX §2.1`) is dark, and that is
deliberate. Deep water is peaceful; a bright white productivity surface is not.
The page reads top to bottom as one scene — water closing each end of the
sheet, the deep between (B58) — and **the note is the one lit thing on the
deep.**

**Personality:** quiet, exact, unhurried, completely uninterested in your
attention.

This identity does **not** license decoration. §1's law still holds: every pixel
earns its place. Peace is produced by restraint, depth and consistency, not by
ornament. Where §9 adds something, it is because that thing does a job.

**The one exception, bounded (B104):** reminders are a tap, not a nag. A clock
icon toggles on a note card; the active clock glows and the card surfaces to
that morning's To-Do board. No time picker, no pop-up, no due-time stored
anywhere, nothing pushes — the board still asks nothing; it only remembers
where the person put the clock.

### §1.2 Design principles, numbered

The five principles of §1, named for citation — `P1`…`P5` — each with the
violation that would break it:

| # | Principle | Example violation |
|---|---|---|
| P1 | **Capture precedes structure** | Any mode, dialog, picker or delay between the intent to write and the caret |
| P2 | **Relationships are asserted, not inferred** | Auto-grouping, tag suggestions, snapping, alignment guides, sorting by anything the person did not choose |
| P3 | **Positions are permanent — a committed position is data** | Re-clamping notes on resize; rewriting stored `x`/`y` because the viewport changed |
| P4 | **Zero cognitive tax** | Settings, accounts, sync state, onboarding, a theme switch |
| P5 | **Work performed stays visible** | Completion that deletes, hides, archives or moves an item out of its place |

### §1.3 What would feel wrong

If v2 ships with any of these it has failed, regardless of technical correctness:

- A **loading state, spinner or skeleton** anywhere. The device is the only copy.
- **Anything that congratulates the person.** Completing something is a record,
  not an achievement.
- A **settings screen.** Even one toggle. P4 is not "few settings"; it is none.
- The board feeling **bright, clinical, or like a productivity SaaS**.
- **Decoration that does no job** — a gradient, a radius, an animation present
  because interfaces have those. (The board's field passes this test by encoding
  depth — `UIUX §2.8`; a gradient with no such claim does not.)
- Notes that **move themselves.**
- An **empty board that looks broken.** A blank page is the correct state of a
  blank page.



### §1.4 Taste decisions

| Decision | Choice | Rationale |
|---|---|---|
| Theme | **Dark only.** The light/dark pair (B16) is retired | P4 forbids the setting; a theme is a question the app must not ask |
| The note's colour | The brightest surface on the page (B58) | It is the only thing the person *placed*; with the sand retired, the claim needs no scoping |
| Destructive colour | `--danger` is the only warm hue (B58) | Everything the app draws is cool water or the deep, except the one thing that destroys |
| Symbols | **Drawn, not typed** (`UIUX §13.3`) | A symbol asked to render identically everywhere in one voice is not text |
| The page's edge | **Closed by its sections** (B58) — water at both ends, and the deep needs no falloff | The sheet fills the viewport on every path; the two water sections are what bound the page's reading, and a near-black canvas has nothing darker to fall to |
| Export | **Paper-light, always** | It is a reference sheet *for paper* |
| Motion | A closed set of five transitions. It does not grow | Nothing else has earned its place |

---

## §2 Users and scope

### §2.1 Who it is for

One person, on their own device, capturing their own thinking. There is no
second user, no team, no sharing model, and no plan to add one.

The app deliberately does not decide what kind of tool it is. Task tracking,
creative ideation, note-taking, problem-solving — one surface, no modes. A board
is whatever the person puts on it.

### §2.2 In scope

A fixed, bounded page where any thought becomes a framed, movable, scalable note
the instant it is typed; structure asserted after capture by position and size;
permanent named regions for a title, components, requirements and a parking lot;
completion as a visible scratch-out; multiple boards; and a PDF export.

### §2.3 Out of scope, and why

| Not built | Reason |
|---|---|
| Accounts, sync, sharing, collaboration | P4. There is no backend (§3.2) and adding one changes what the product is. |
| Tags, folders, search, filters, auto-grouping | P2. Every one of these infers a relationship the person did not assert. |
| Rich text, images, attachments, drawing | The data model is plain strings (§4.1). B3 enforces this at the paste boundary. |
| Snapping, alignment guides, auto-layout | P2 and P3. Notes overlap freely; the person places them. |
| Due dates with time logic, push notifications, in-app notification banners, email, SMS, any outbound message system, streaks, recurring reminders | P4 and §3.2. The board makes no demands and sends nothing — there is no backend to send from. Clock-toggle reminders and the day's To-Do surface are the bounded exception (B104). The recurring-reminders strip was removed by B145; its records remain and render as blocks in the new calendar section, not as calendar events. |
| Infinite canvas, pan, zoom | §5.1. Boundedness is the feature — a page you can see all of. |
| A framework, bundler, package manager, dependency | §3.3. |
| Settings, preferences, a theme switch | P4. §9 is one identity, not a choice to make. |

### §2.4 Success

The app succeeds if a thought reaches the page faster than the person can
second-guess it, and if opening a board weeks later still shows the same
arrangement they left. Everything else is secondary.

### §2.5 Deferred, with reason

These are real and are **not** abandoned. They are separate changes, and pinning
them to the design system would gate a palette on unrelated work.

| Deferred | Why it is not here |
|---|---|
| **The fold/rotate arrangement bug — issues #65, #75** | **Shipped — ruled B64.** The similarity transform landed as its own ruling, its own branch and its own PR, exactly as scoped here: one ratio `min(LOGICAL_W/rw, LOGICAL_H/rh)` for both axes and for size, superseding B40's anisotropic mapping and B21's width-only multiplier (`UIUX §11`) |
| **PDF font embedding** | ~150KB per exported file, in the most intricate code in the app, so that a printed reference sheet matches the app's typography. Worth doing; not worth blocking a recolor on. The export keeps base-14 Helvetica and stays correct. |
| **Board categories on mobile** | **Already shipped** — PR #79, issue #74, ruled B44 |

---

## §3 Platform

### §3.1 Devices

A PWA, installable to the home screen, running standalone and fully offline.

Mobile is the primary path — geometry (§5.2), the touch floor (§5.3) and
capture (§6.2) are specified for touch first, with desktop an explicit second
grammar (§5.4). Foldables are first-class: a Z Fold's unfolded cover lands in the
tablet arrangement on its width alone (B103), which is why the sheet is
viewport-derived (B32). The installed mobile surface is portrait-locked (B141) —
the manifest declares `orientation: "portrait"`, so a phone never enters a
landscape arrangement.

### §3.2 Offline and storage

There is no backend, no network call, and no server round-trip anywhere in the
app. All data is client-side in IndexedDB (§4). The service worker precaches the
whole shell, so a cold launch in airplane mode is indistinguishable from an
online one.

The consequence must be stated plainly: **the device is the only live copy.**
PDF and JSON export (§7) are the two ways to take data out of the app.

### §3.3 Build constraints

Vanilla HTML/CSS/JS. No frameworks, no build step, no package manager, no
dependencies, no backend. The shell is `index.html`, `styles.css`, `app.js`,
`manifest.json`, `sw.js`, plus the modules `state.js`, `persistence.js`,
`geometry.js`, `render.js`, `interactions.js`, `menus.js`, `export.js`, and
`boards.js`.

This is a hard constraint, not a preference. It is why the PDF exporter is
hand-rolled (§7), why the icons come from a dependency-free PNG writer (B1), why
fonts are self-hosted rather than pulled from a CDN (§9.2), and why anything
requiring a compile step must instead be computed once and committed as a
literal.

---

## §4 Data model and writes

### §4.1 Records

A board:

```
{ id, createdAt, updatedAt, title, components, requirements,
  notes[], parkingLot[], category, catStamp }
```

A note: `{ id, text, x, y, rw, rh, scale, state }`
A parking-lot item: `{ id, text, state }`

Since B95 (issue #145) a board record may also carry `cal` (the YYYY-MM-DD key
it serves as that day's To-Do board) and `calReq` (the count of Requirements
lines the calendar mirror last wrote — the span distinguishing the mirror's lines
from the reader's own). Both are added at the read site, defaulted when absent
(B21's idiom — no migration, no DB version move). Since B106 (issue #154) the
span arbitrates a two-way mirror: a board-side edit of a span line writes through
to the event it mirrors (span line i ↔ event i), a board-side deletion of span
lines deletes the mirrored events, and hand lines after the span are never
touched by either direction. Calendar events are records in the same store shaped
`{ id, date, text, state, createdAt }`, identified by carrying `date` and no
`title`; the 30-day window is computed from today's date at render, so no rolling
array is stored and midnight writes nothing.

Calendar day-notes are records shaped `{ id, rem, next, day }`, with ids
prefixed `rem-` and `day` holding the date key they belong to. They are a
separate record kind in the same store, not boards or calendar events.

`state` is `active` or `complete`. `text` is a plain string in every case.

Two structural facts carry product meaning:

- **A lot item has no `x`/`y`.** It is an ordered line, not a spatial object.
  This is why lot items live in block flow rather than on the absolute canvas
  (B6), why they are never framed (§6.5), and why they are not multi-selectable
  on desktop (B41) — herding is a spatial operation.
- **`rw`/`rh` are the reference frame a note was authored against**, not a
  position. They exist so P3 can be honoured across devices: stored `x`/`y`
  are never mutated, and rendering scales them from the authoring frame to the
  current one (B21, B32, B40).

New fields are **defaulted at the read site, never migrated** (B21's idiom,
reused by B42 for `category`/`catStamp`). A board written by an older build
opens correctly without being rewritten — which is P3 applied to the schema.

### §4.2 Writes

IndexedDB `boards-db` / store `boards` is the only persistence.

Keystrokes debounce at `SAVE_DEBOUNCE = 300ms`. Blur, drag-end, pinch-end,
complete, delete and z-order changes commit immediately. Writes go through a
single-flight queue with exponential backoff; a failure raises a polite
`role="status"` toast ("Couldn't save — retrying.") which never clobbers a
pending Undo (B13).

A committing write stamps `updatedAt`; the flush on the way **out** of a board
(a rail swap, opening another board from the list, a create) writes but stamps
only if an edit was actually pending.
Leaving a board is not updating it — and since B69 orders every board listing
by that stamp, the difference is now visible.

**A write may never block capture.** The save queue is behind the caret, always.

### §4.3 What earns persistence

A note or lot line earns persistence with its first real character. A frame
committed with only whitespace is discarded — `trim()`, not zero-length (B8) —
and this is enforced not only at blur but on **every render**, which sweeps
whitespace-only records (B31). The rule exists because failed taps were leaving
landmines that compounded into flakiness.

---

## §5 Layout, scale and touch

### §5.1 One logical page, one render scale

The board is one fixed logical coordinate space (`LOGICAL_W` × `LOGICAL_H`)
rendered through a single uniform `transform: scale()` (`renderScale`, `offX`,
`offY`); positions and sizes are stored in that space and converted with
`toLogical` / `renderX` / `renderY`. It never pans and never zooms — the
two-finger pinch belongs to the note (B12) — and because the scale is uniform, a
note's frame stays square and the hit-area maths in §5.3 stays exact.

### §5.2 The sheet's dimensions

Sheet dimensions, the render scale and the 900×1000 reference sheet are
`UIUX §3`. The live sheet is viewport-derived (B32) rather than B17's fixed-900
model, because a fixed sheet scaled down to a phone made the title illegible —
legibility beat abstraction; desktop's scale is rail-aware (B20).

**Committed notes are never re-clamped on resize** (B17, and P3). A rotation
or a window drag changes how a position renders, never what it is.

Cross-device rendering is **homothetic**: position's law applied to size.
`noteMult = LOGICAL_W / (rw ‖ 900)`, and a note's effective scale is
`scale × noteMult` (B21, B40). Resizing a window slides notes proportionally
rather than letting fixed-size notes collide.

### §5.3 The touch floor

The touch floor is `UIUX §6`: 44px physical on mobile (WCAG 2.5.5 AAA), 24px
on desktop (`HIT_FLOOR_DESKTOP`, B23).

Because notes scale, this cannot be a fixed padding. Each note carries a
computed `--hit` inset on a transparent `::before`, sized so that
`inset × scale × renderScale ≥ 44px` physical (B7). The hit area expands; the
visual frame does not.

### §5.4 Two grammars, one recognizer

`isDesktop` is a live `matchMedia` switch:
`(min-width: 1024px) and (hover: hover) and (pointer: fine)` (B19). It is a
**capability** test, not a width or UA test — which correctly keeps tablets in
touch mode, since desktop's hover grammar would strictly reduce a touch-only
device. There is no persistence and no manual override; a mode flip tears down
live state.

A single custom gesture recognizer (`onPointerDown`/`Move`/`Up`) drives both
grammars, branching on `isDesktop` inline. There is no separate desktop code
path.

| | Mobile | Desktop |
|---|---|---|
| Create | tap empty canvas | click empty canvas (nothing selected) |
| Select | — | click |
| Move | drag | drag |
| Scale | two-finger pinch | drag the selection frame |
| Edit | tap | double-click, or Enter |
| Menu | long-press (500ms) | right-click |
| Caret on edit | at the touch point (B14) | at the end (B26) |
| Boards | full-screen list (§6.7) | always-visible rail (§6.7) |

Gesture thresholds — the drag slop and the long-press beat — are `UIUX §5`
(B29 raised the slop after ordinary taps on a foldable cancelled themselves; B5
keeps a release under it a tap).

### §5.5 The soft keyboard

`interactive-widget=resizes-visual` plus a JS guard that skips mobile re-layout
while a `contenteditable` inside `#board` holds focus, re-applied on `focusout`
(B28). Without this the keyboard changed `vh`, collapsing the sheet mid-sentence
and clipping the note being written.

### §5.6 Actions are acknowledged, not idle

Every committing action lands the instant it is released — the result itself is
the acknowledgment, and B81 retired the beat that once stood between click and
action (B18). What survives is a re-fire guard: a *consequence* commits at once
and then briefly ignores a second tap, so an impatient double-tap is **dropped,
not doubled**, first tap wins. Navigation and capture commit nothing a stray tap
could duplicate, so they take no guard — the full set is `UIUX §5`. Any new
interactive consequence goes through `commitAction()`, not a bespoke timeout.

Three things are deliberately outside it. **Mobile capture** runs synchronously
in `pointerup` (B27): a browser raises the soft keyboard only inside user
activation, so P1 wins. **Desktop selection** opens no window (B22) — a delayed
selection would swallow every double-click. **Rail page turns** likewise commit
nothing (B42).

> B18's 400ms is marked *impermanent* — re-interrogating it is invited.

---

## §6 Surfaces

### §6.1 The anchors — permanent furniture

Four permanent regions exist on every board: **Title**, **Components**,
**Requirements** and the **Parking Lot**. They are always present, always in the
same place, and cannot be created, moved, resized or deleted.

They are furniture, not content. `contenteditable` is toggled on only while
editing (B2) so the gesture recognizer owns tap/drag/long-press without fighting
native focus, and it is `plaintext-only` where supported, falling back to `true`
(B3), because the data model is plain strings.

#### §6.1.1 The top band

The band is **drawn furniture, independent of content** (B33). It reads
**rule → header → content** — the same three-part split the Parking Lot has used
since day one, which is the point: one section grammar on the board (B38).

It comprises one `#band-rule` across the sheet; a permanent `.band-label` per
side zone naming what that zone is; and the **title compartment**, which
occludes the rule.

The title is a *compartment*, not a card: the sheet's own top edge is its fourth
side, so only three sides are drawn (B38). It is the **one deliberate exception**
to "no empty frames" (§6.2) — that rule protects the free canvas; the compartment
is permanent furniture and is always drawn.

Band geometry is sized **by the type it holds, not by the sheet** (B37, `UIUX
§3`). The rule crosses the compartment at its midpoint.

> The band has been ruled on five times: B33 → B35 → B36 → B37 → B38. B38 is
> current. Read that chain before changing band geometry — each ruling corrected
> a regression the previous one caused.

### §6.2 Notes — the atom

**A tap on empty canvas creates a note at the tapped point, in edit mode, with
the caret placed.** Instantly on mobile (§5.6, B27). This is P1 in one
sentence, and it is the single most important behaviour in the app.

**No empty frame ever exists.** The frame draws itself on the first character
and is transparent before it (§6.2's rule; enforced by B8 and B31). A note earns
its frame the way it earns persistence (§4.3).

A note wraps at **the sheet's right edge**, not at a predetermined width:
`noteMaxW = max(NOTE_MIN_W, (LOGICAL_W − renderX) / effScale)`, which reduces to
`(rw − x)/scale` in authored units and is therefore frame-invariant. The cap is
live during a drag, and the export mirrors the same law so a cap-hitting note
cannot disagree between screen and PDF (B39, superseding an earlier 45% cap).

`NOTE_MIN_W = 60` — roughly three characters at 17px plus box chrome. *Marked
impermanent in B39.*

### §6.3 Move, scale, stack

**Drag to move.** Free overlap, no snapping, no alignment guides (P2). The
only clamp is to the page bounds.

**Pinch to scale** on mobile, **drag the selection frame** on desktop — both
share the same maths. `MIN_SCALE = 0.5`, `MAX_SCALE = 2.0`, clamps widened to
admit an out-of-range starting scale (B40). `transform-origin` is top-left
throughout, so stored `x`/`y` stay truthful and there is no drift to compensate
(B4).

**Z-order is DOM order.** Touching or grabbing a note surfaces it. There is no
layer panel and no send-to-back.

On desktop, shift-click multi-selects notes; a group drag moves every member by
one delta; resize is single-selection only. Lot rows stay single-select — a lot
line is a list entry, not a spatial object worth herding (B41).

### §6.4 Complete — work performed stays visible

Completing does not delete and does not hide. It draws a **scratch-out** over
the item: three families of ruled strokes at ≥90% coverage, texture rather than
colour, plus the underlying text destroyed to 40% ink so no screenshot or zoom
recovers it.

This is P5. The item stays in place, at its size, in its arrangement — the
board still shows that the work was done and where it sat.

Completion is reversible (Restore). In the PDF export, a completed item is drawn
scratched out and **emits no text object at all** (§7) — the on-screen promise
becomes a testable property of the file.

### §6.5 The Parking Lot

A permanent region at the foot of the sheet for things that are not yet placed —
thoughts with no position.

Its items are **unframed stacked text lines**: the one place in the app where
text is never framed. That is the visual expression of §4.1's structural fact
that a lot item has no coordinates. They are ordered lines, so they live in
block flow, not the absolute canvas (B6).

Tapping the lot background creates a line. Height is a whole-row budget,
`34 + n × 44` — three rows on a tall sheet, two on a phone (B37). Rows past the
budget are clipped from view but **still exist, still save and still export**.

Desktop selection frames the selected row with an `outline` — an explicit,
narrow override of "lot lines are never framed," scoped to desktop and selected,
with action buttons inline at the row's right edge (B25).

### §6.6 The menu

Long-press (mobile) or right-click (desktop) on a note opens its menu for
**Copy · Add/Edit Title · Link** (B91, B114, B120); its state actions live on
the note's own toolbar (B84). A surfaced reminder echo instead offers
**Complete · Go to Board** (B109). Lot lines have no long-press menu; desktop
lot actions are inline (B25). The anchor menu is retired (B92): board actions
live on the flat-tab row above the Parking Lot — **All boards · Export ·
Import** (B83, B92) — and the title compartment's `Menu` control is
superseded by that row (B83). The rail card's menu offers **Export · Delete**.

Destructive actions remain last, in `--danger` and behind a hairline, never
distinguished by colour alone (`UIUX §1`, `UIUX §7`).

No long-press timer is armed over bare canvas or lot background — the release
still captures — and the `pointerdown` that dismisses an open menu is inert and
creates nothing, because dismissal is a retraction, not a choice of what was
underneath (B30).

#### §6.6.1 Undo

Delete is undoable for **5 seconds** (`UIUX §9`) via a toast that restores exact
prior state, including a note's original index in its collection. A batch delete
is **one**
window, one save and one Undo. A new destructive action finalizes or cancels the
prior undo. A pending note or lot Undo is finalized on any board switch; a
board-delete Undo is cross-board-safe and survives (B26).

### §6.7 Boards

Multiple boards; the board is the unit. An empty database creates and opens one
blank board — **the list is never the landing view** (B10), because the desk
always shows a working page.

**Mobile:** a slide-up panel, most recently updated first (B82). Routing uses the
History API (`pushState` / `popstate`) specifically so the OS back gesture
returns you to the board (B9). Back is never intercepted, shadowed or disabled.

**Desktop:** the list is replaced by a **rail** (B24), collapsed by default
(B118), sunken rather than floating, sitting outside `#board` so the gesture
recognizer never sees its events; its width and card grammar are `UIUX §10`.
Cards are compact.

Both surfaces order a section by **last touch, newest first** (B69, superseding
B24's immutable slot; the comparator is `UIUX §10`).
A card's slot therefore moves when you edit the board: P3 keeps *positions*
permanent, and a listing's order was never a position.

The rail sorts into four sections — **To-Do / Notes / Learning / Ideas** (B78;
the `unsorted` key is retained for Note, B63) — and a pointer-drag moves a card
between them, with the target section framing itself.
Each section carries its own **New board** control on its head row, and a board
created there is written into that category and opened (B63; the global create
controls are gone). Overflow **pages** rather than scrolling, and a single page
hides its own pager: no state, no statement (B42).

A rail board swap is a 150ms crossfade with **no history push** — B9 is bypassed,
not touched.

### §6.8 Offline

The service worker is cache-first with stale-while-revalidate: a warm hit never
waits on the network, so offline behaviour and cold-start latency are unchanged,
while the revalidation beside it makes the next launch current.

`CACHE` is version-stamped and `install` only re-runs when `sw.js`'s own bytes
change — §8.1's reason the cache name is the one string that says which build is
live.

---

## §7 Export

You can export a board as PDF or the whole library as JSON.

**Hand-rolled, no library** (B34) — §3.3 forbids the dependency, and a
hand-rolled writer works offline by construction.

Export produces **two A4 portrait pages**:

1. **The reference sheet**, drawn as vectors at the fixed 900×1000 geometry —
   never the live viewport — centred with a 36pt margin. The export reuses the
   screen's own laws (`exportX`/`exportY`/`exportMult` mirror
   `renderX`/`renderY`/`noteMult`, and `exportNoteBox` mirrors `noteMaxW`) so the
   PDF is geometrically faithful to what is on screen (B39, B40).
2. **The board as prose** — title, date, Components, Requirements, notes, lot.

Rules:

- **A completed item emits no text object at all.** It is drawn scratched out on
  page 1 and its words are absent from the file. §6.4's promise becomes a
  property of the bytes.
- **The export is always paper-light**, whatever the app looks like (§9.4). Its
  palette is named separately from the screen's in `UIUX §15`.
- Output is **byte-identical for an unchanged board** — which is what makes it
  testable.
- Non-Latin characters outside the font's encoding export as `?` and raise a
  toast saying so, rather than failing silently.
- Export is reachable from the board-action row and the rail card menu — the
  board you are looking at, or another board from the rail, without an anchor menu.

The whole-library JSON export uses payload version 2. It separates board
records, calendar events (`calendarEvents`) and calendar day-notes (`dayNotes`)
into their own arrays. Import recovers day-notes from older v2 JSON exports where
they were carried inside `boards`, and restores board `catStamp` values.

> B34 marks the `EXPORT_GEO` duplication *impermanent*: the exporter restates
> `styles.css`'s geometry by hand, and the split now lives in `export.js`
> (§10.5); resolving it fully is not this release.

---

## §8 Release

### §8.1 Shipping discipline

`sw.js`'s `CACHE` constant (`zeved-boards-v<N>`) is the one string that says which
build is live. **Bump it on every shipped change to `app.js`, `styles.css`, or
any precached asset.**

The worker re-installs only when its own bytes change. Stale-while-revalidate
(§6.8) means a missed bump costs one stale launch rather than every launch
after it — but it is a net, not a substitute (B36).

`.github/workflows/pages.yml` deploys the repo root as-is to GitHub Pages on push
to `main`, then curls the deployed `sw.js` and asserts it matches the commit. A
silent Pages failure is treated as a shipped bug, not a non-event — this
happened once, with two merges landing with no deploy at all.

> **Asserting the source is not asserting delivery.** (B36)

The fastest way to answer "did my change reach anyone":
`curl -s https://<pages-host>/sw.js | grep -E "(zeved-boards|todo-boards)-"`

For the live version, read `sw.js`'s `CACHE` alongside `app.js`'s `OWN_BUILD`;
both must match (B36). B38 records `v7` in the cache lineage.

### §8.2 Testing

The `test/` scripts are dev-only and run whole, without a test runner or
framework; browser suites drive real Chromium via Playwright, the tokens, records
and security suites are browserless, and the inventory with its CI column is
`test/README.md`. Mobile taps are dispatched as **genuine touch events**, not
synthesized clicks — a real bug lived specifically in the browser's touch-to-mouse
compatibility events (B27) — and `test/sw-update.js` exists because of B36: it
asserts a shipped change actually reaches an installed PWA.

> *A suite which cannot fail is lying.*

---

## §9 Design system

New in this document. §1–§8 describe an app that already works; §9 says what it
should look like and why. It implements §1.1 under §1's law.

**§9 holds positions; `UIUX.md` holds values.** That split is not a filing
convenience — `DECISIONS.md` calls `UIUX.md` "the rendering authority" and
resolved A1 by following `UIUX §7` over this document's §6.6. Design values
belong where the rendering authority can be cited against them. §9.3 is the map.

### §9.1 Position

> **Identity comes from structure — frame, scratch-out, surface tone — never
> costume.**

This predates §9 and survives it. §9 changes what the surfaces *are*; it does
not add ornament on top of them. **Where a value is decorative rather than
structural, it is wrong** — and that is the test `UIUX.md` applies to every
value it carries, including the note's new colour, which earns its place by
saying *what a note is* (the only thing the person made) rather than by looking
good.

### §9.2 What the design system decides

Positions, not values. The values are `UIUX.md`'s — see §9.3.

**Dark-only, and not a default with an escape hatch** (§1.4): P4 forbids the
setting, so there is nothing to escape *to*, and the light/dark pair driven by
`prefers-color-scheme` (B16) is retired. This is the identity: deep water, one
room, the note as the lit thing in it.

**Depth reads as literal darkness, and the page reads as one scene.** Surfaces
are ordered top to bottom — water closing the band, the deep through the
middle, water closing the Parking Lot (`UIUX §2.2`, B58). The canvas is the
deepest thing on the page because it is the ground everything the person makes
sits on. **The note is the brightest thing on the page**, without qualification
since B58 retired the sand: it is the only thing the person made, so a re-tune
that made some other mark brighter would be wrong even if every contrast ratio
still passed.

**One warm hue, and it is the destructive one** (§1.4): everything the app draws
is cool water or the deep — the sand left with B58 — except the one thing that
destroys. It need not shout; position and the hairline above it carry the
meaning (§6.6).

**One typeface, self-hosted, three weights** — Montserrat Alternates. A CDN font
is a network dependency (§3.3) and an uncacheable hole in an offline-first shell
(§3.2), so it ships from `fonts/`, subject to §8.1's bump when declared.

**Notes carry no shadow.** Elevation means "temporary, above the page", so it
belongs to summoned surfaces only. A note is *on* the page.

**Never colour alone.** Every state distinguished by colour is also
distinguished by geometry, position or texture.

### §9.3 Where the values live

Every enumerable value — hexes, ratios, sizes, durations, offsets, thresholds —
is in `UIUX.md`, which `DECISIONS.md` calls the rendering authority. This
document does not restate them. **A value with two homes has no home**, and this
repo has already had to arbitrate one document conflict (A1).

| Looking for | `UIUX.md` |
|---|---|
| the surface ladder and the law that generates it | §2.2 |
| the ink poles, the crossover, the forbidden band | §2.3 |
| elevation | §2.4 |
| edges, rules and hairlines | §2.5 |
| accents | §2.6 |
| the focus ring | §2.7 |
| the water's field — the fall, the sections' falloff, the dither | §2.8 |
| the sand's retirement | §2.9 |
| board geometry — sheet, band, lot, anchors | §3 |
| the note component, its states, its radius | §4 |
| gestures and thresholds | §5 |
| the touch floor | §6 |
| motion, and the JS durations paired to it | §8 |
| accessibility | §12 |
| typography, the size scale, marks | §13 |
| controls | §14 |
| the export's paper palette | §15 |
| retiring v1's thirteen tokens | §16.2 |

### §9.4 Where the identity does not reach

**The PDF export stays paper-light.** Dark `--board` prints as a slab of
near-black and costs a cartridge to discover. The export is a reference sheet
for paper, and paper is the ground it is designed against — so the ladder does
not apply to it, by intent rather than omission. The export's own palette is
named separately in `UIUX §15`, so retiring the light theme does not leave the
exporter's three colour constants pointing at tokens that no longer exist.

Montserrat Alternates **does** reach the export: the PDF embeds it, so the
document is typographically the app's even though it is not chromatically the
app's.

### §9.5 Implementation consequences

Standing law:
1. The five sync points (`UIUX §16`) stay in agreement (`styles.css :root`,
   `index.html` theme-color metas, `manifest.json` colors, `export.js`
   `PDF_PAPER`/`PDF_INK`/`PDF_SHADE`, `icons/` B1 motif).
2. `sw.js` precaches the self-hosted font files; `CACHE` bumps on shipped
   asset changes per §8.1.
3. The three JS duration constants are paired to CSS values (`UIUX §8`).

### §9.6 Verification

`test/tokens.js` asserts the ladder, dark-only, the five sync points, accent
placement, and self-hosting; the browser suites and their CI inventory live
in `test/README.md`.

### §9.7 Risks

Covered by standing rulings (B34, B37, B38, B47, B49); none block this release.


---

## §10 The boundary with `UIUX.md`

`UIUX.md` now exists, at the `§1`–`§12` numbering the codebase already cites and
that `styles.css:4-5` carries as its own header index (§13–§17 extend it for what
the citations never named). **Every `UIUX §x` citation resolves natively.** The
redirect table this section used to hold — mapping each citation into a §9
subsection — is gone with the reason for it.

The line between the two documents:

| | `PRD.md` | `UIUX.md` |
|---|---|---|
| Answers | what it is, who for, why | what it renders, and in what values |
| Contains | principles, scope, data model, behaviour, release | tokens, geometry, states, thresholds, timings, contrast |
| Wins on | product intent | rendering |
| Cited as | `PRD §x` | `UIUX §x` |

Both are bound by `DECISIONS.md`, which resolves what they leave silent and
supersedes them where a later ruling contradicts an earlier position.
`UIUX §17` mandates the document prefix on every new citation:
`styles.css` currently mixes bare `§6.1` (this document's anchors) with bare
`§6` (`UIUX`'s touch floor) in the same file.
