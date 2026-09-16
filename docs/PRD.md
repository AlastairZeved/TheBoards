# PRD.md — TheBoards

**Status:** v1 of the specification, written after the MVP. The app was built
first; this document reconstructs its product rules from the working code and
`DECISIONS.md`, and adds §9, which states the design system's position for v2.

**How to read this with the other records.** `DECISIONS.md` is the binding,
cumulative record of every UI/interaction ruling (A1, B1–B43+), each resolved
against the principles in §1 below. Where this document and `DECISIONS.md`
disagree, **`DECISIONS.md` wins** — it is the later, issue-tied ruling, and
several of its entries deliberately supersede earlier positions stated here.
This document exists to say what the app *is* and what it is *for*, so that a
new ruling has something to resolve against.

`UIUX.md` is the third record and the **rendering authority** (`DECISIONS.md:22`):
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

The mental imagery is **calm water** — beaches, rivers, brooks. Note the
register carefully: this is water at depth and at dusk, not noon glare. The
palette (§9.2, `UIUX §2.1`) is dark, and that is deliberate. Deep water is peaceful; a
bright white productivity surface is not. The page reads top to bottom as one
scene — water closing each end of the sheet, the deep between (B58) — and
**the note is the one lit thing on the deep.**

This identity does **not** license decoration. §1's law still holds: every pixel
earns its place. Peace is produced by restraint, depth and consistency, not by
ornament. Where §9 adds something, it is because that thing does a job.

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

### §1.4 North star

- **Feel:** peaceful fondness. A place you are glad to return to.
- **Imagery:** calm water, at depth and at dusk, not noon glare. That is why the
  palette is dark. The page reads top to bottom as one scene — water closing
  each end of the sheet, the deep between (B58) — and **the note is the one
  lit thing on the deep.**
- **Personality:** quiet, exact, unhurried, completely uninterested in your
  attention.
- **What this does not license:** decoration. Peace comes from restraint, depth
  and consistency.
- **The one exception, bounded (B104):** reminders are a tap, not a nag. A
  clock icon toggles on a note card; the active clock glows and the card
  surfaces to that morning's To-Do board. No time picker, no pop-up, no
  due-time stored anywhere, nothing pushes — the board still asks nothing; it
  only remembers where the person put the clock.

### §1.5 Taste decisions

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
| Accounts, sync, sharing, collaboration | §1.4. There is no backend (§3.2) and adding one changes what the product is. |
| Tags, folders, search, filters, auto-grouping | §1.2. Every one of these infers a relationship the person did not assert. |
| Rich text, images, attachments, drawing | The data model is plain strings (§4.1). B3 enforces this at the paste boundary. |
| Snapping, alignment guides, auto-layout | §1.3 and §1.2. Notes overlap freely; the person places them. |
| Due dates with time logic, push notifications, in-app notification banners, email, SMS, any outbound message system, streaks, recurring reminders | §1.4 and §3.2. The board makes no demands and sends nothing — there is no backend to send from. Clock-toggle reminders and the day's To-Do surface are the bounded exception, ruled **B104** (issue #169) — a tap, a glow, and a card that shows up where the person already looks; no times are stored and nothing pushes. The end-of-day SMS summary is removed, ruled **B107**; the 2x2 home screen widget is dropped, ruled **B111** — nothing pushes, nothing sits outside the app (the "Today's To Do History" rail is killed by the same ruling, **B111**). Recurring reminders are ruled out, **B113** — the shipped reminder is the complete feature; a completed reminder is complete, and re-tapping the clock is the only return path (the month view is deferred to issue #191, parked behind #170) |
| Infinite canvas, pan, zoom | §5.1. Boundedness is the feature — a page you can see all of. |
| A framework, bundler, package manager, dependency | §3.3. |
| Settings, preferences, a theme switch | §1.4. §9 is one identity, not a choice to make. |

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
| **PDF font embedding** | ~150KB per exported file, in the most intricate code in the app, so that a printed reference sheet matches the app's typography. Worth doing; not worth blocking a recolor on. The export keeps base-14 Helvetica and stays correct (§9.5.2) |
| **Board categories on mobile** | **Already shipped** — PR #79, issue #74, ruled B44 |

---

## §3 Platform

### §3.1 Devices

A PWA, installable to the home screen, running standalone and fully offline.

Mobile-first, and mobile is the primary path — the geometry (§5.2), the touch
floor (§5.3) and the capture path (§6.2) are all specified for touch first, with
desktop as an explicit second grammar (§5.4). Foldables are first-class: both the
inner and cover displays of a Z Fold are supported, which is why the manifest
declares `orientation: "any"` (B11) and why the sheet is viewport-derived (B32).

### §3.2 Offline and storage

There is no backend, no network call, and no server round-trip anywhere in the
app. All data is client-side in IndexedDB (§4). The service worker precaches the
whole shell, so a cold launch in airplane mode is indistinguishable from an
online one.

The consequence must be stated plainly: **the device is the only copy.** The PDF
export (§7) is the only way data leaves the app.

### §3.3 Build constraints

Vanilla HTML/CSS/JS. No frameworks, no build step, no package manager, no
dependencies, no backend. Five files are the entire app: `index.html`,
`styles.css`, `app.js`, `manifest.json`, `sw.js`, plus `icons/` and `fonts/`
(committed; declared and cached only when the design system ships — §9.5).

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

Since B95 (issue #145) a board record may also carry `cal` (the YYYY-MM-DD
date key it serves as that day's To-Do board) and `calReq` (the count of
Requirements lines the calendar mirror last wrote — the span that
distinguishes the mirror's lines from the reader's own). Both are added at
the read site, defaulted when absent (B21's idiom — no migration, no DB
version move). Since B106 (issue #154) the span is the arbiter of a two-way
mirror: a board-side edit of a span line writes through to the event record
it mirrors (span line i ↔ event i), a board-side deletion of span lines
deletes the mirrored events, and hand lines after the span are never
touched by either direction. Calendar events are records in the same store
shaped
`{ id, date, text, state, createdAt }`, identified by carrying `date` and
no `title`; the 7-day window is computed from today's date at render, so no
rolling array is stored and midnight writes nothing.

`state` is `active` or `complete`. `text` is a plain string in every case.

Two structural facts carry product meaning:

- **A lot item has no `x`/`y`.** It is an ordered line, not a spatial object.
  This is why lot items live in block flow rather than on the absolute canvas
  (B6), why they are never framed (§6.5), and why they are not multi-selectable
  on desktop (B41) — herding is a spatial operation.
- **`rw`/`rh` are the reference frame a note was authored against**, not a
  position. They exist so §1.3 can be honoured across devices: stored `x`/`y`
  are never mutated, and rendering scales them from the authoring frame to the
  current one (B21, B32, B40).

New fields are **defaulted at the read site, never migrated** (B21's idiom,
reused by B42 for `category`/`catStamp`). A board written by an older build
opens correctly without being rewritten — which is §1.3 applied to the schema.

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

The board is a fixed, bounded logical coordinate space (`LOGICAL_W` ×
`LOGICAL_H`) rendered through a single `transform: scale()` (`renderScale`,
`offX`, `offY`). Note positions and sizes are stored in that logical space and
converted with `toLogical` / `renderX` / `renderY`.

The board never pans and never zooms. Browser pinch-zoom is disabled at the
platform level (`touch-action: none`, `user-scalable=no`) because the two-finger
pinch is reserved for scaling a note (B12).

Because the scale is *uniform*, a note's frame stays square and the hit-area
maths in §5.3 stays exact.

### §5.2 The sheet's dimensions

**Mobile (B32):** `LOGICAL_W = vw`, `LOGICAL_H = vh`, `renderScale = 1`. The
sheet *is* the viewport. This overrides the earlier fixed-900 model (B17)
because at `renderScale ≈ 0.45` a 24px title reached the screen as 10px —
legibility beat abstraction.

**Desktop (B20):** `renderScale = min(vh/1000, (vw − 300)/900)`,
`LOGICAL_H = vh/renderScale`, `LOGICAL_W = (vw − 300)/renderScale`, `offX = 300`
for the rail. Neither logical dimension ever drops below 900×1000.

**The reference sheet is 900×1000.** It is what the band and lot proportions are
derived against and what the export draws (§7) — distinct from the live
viewport-derived dimensions.

**Committed notes are never re-clamped on resize** (B17, and §1.3). A rotation
or a window drag changes how a position renders, never what it is.

Cross-device rendering is **homothetic**: position's law applied to size.
`noteMult = LOGICAL_W / (rw ‖ 900)`, and a note's effective scale is
`scale × noteMult` (B21, B40). Resizing a window slides notes proportionally
rather than letting fixed-size notes collide.

### §5.3 The touch floor

44 CSS px physical on mobile — the fingertip floor (WCAG 2.5.5 AAA).

Because notes scale, this cannot be a fixed padding. Each note carries a
computed `--hit` inset on a transparent `::before`, sized so that
`inset × scale × renderScale ≥ 44px` physical (B7). The hit area expands; the
visual frame does not.

On desktop the floor drops to 24px (`HIT_FLOOR_DESKTOP`), which is WCAG 2.5.8
AA and pointer-appropriate (B23). The 44px floor stands on touch.

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

`MOVE_THRESHOLD = 16px` of slop before a drag begins or a long-press cancels
(B29 — 10px was cancelling ordinary taps on a 7.6" foldable). `LONGPRESS_MS =
500`; any release before that with movement under threshold commits as a tap
(B5).

### §5.5 The soft keyboard

`interactive-widget=resizes-visual` plus a JS guard that skips mobile re-layout
while a `contenteditable` inside `#board` holds focus, re-applied on `focusout`
(B28). Without this the keyboard changed `vh`, collapsing the sheet mid-sentence
and clipping the note being written.

### §5.6 Actions are acknowledged, not idle

Every committing action — delete, complete, board create/swap/delete, note
creation — lands the instant it is released; the result itself is the
acknowledgment. There is no dead time to wonder about, and no filled window: the
400ms beat that once stood between click and action (B18) is gone (B81), because
a result that is simply *there* on release acknowledges better than a beat the
user has to read as "heard."

What survives is only a re-fire guard: a *consequence* (delete, complete, copy,
undo, a menu item, board create/delete) commits at once and then briefly ignores
a second tap, so an impatient double-tap is **dropped, not doubled** — first tap
wins. Navigation (opening a menu, swapping boards) and capture (a note or lot
line) commit nothing a stray tap could duplicate, so they run with no guard.

This is the shared primitive: any new interactive consequence goes through
`commitAction()` rather than a bespoke timeout.

Three things are deliberately outside it. **Mobile capture** runs synchronously
in `pointerup` (B27) — a browser raises the soft keyboard only inside user
activation, and a 400ms timeout is outside it, so §1.1 wins. **Desktop
selection** opens no window (B22): it commits nothing, and a delayed selection
would swallow every double-click. **Rail page turns** likewise commit nothing
(B42).

> B18's 400ms is explicitly marked *impermanent* — it is a felt value, and
> re-interrogating it is invited.

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

### §6.1.1 The top band

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

Band geometry is sized **by the type it holds, not by the sheet** (B37): across
is a fraction of the sheet, because it holds the sheet's own divisions; down is
set by the type. The rule crosses the compartment at its midpoint.

> The band has been ruled on five times: B33 → B35 → B36 → B37 → B38. B38 is
> current. Read that chain before changing band geometry — each ruling corrected
> a regression the previous one caused.

### §6.2 Notes — the atom

**A tap on empty canvas creates a note at the tapped point, in edit mode, with
the caret placed.** Instantly on mobile (§5.6, B27). This is §1.1 in one
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

**Drag to move.** Free overlap, no snapping, no alignment guides (§1.2). The
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

This is §1.5. The item stays in place, at its size, in its arrangement — the
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

Long-press (mobile) or right-click (desktop) on a note, lot line or anchor —
**and the title compartment carries a visible `Menu` control** that opens the
anchor menu directly (B65, issue #94). It replaces neither gesture; it is there
because a feature reachable only by an undeclared gesture is a cognitive tax the
product does not levy elsewhere. On desktop it is that menu's only route, since
click-and-hold was removed with B19. Its rendering is `UIUX §14`.

**Item menu:** All boards · Complete/Restore · Copy · Delete.
**Anchor menu:** Export · All boards.
**Board row / rail card menu:** Export · Delete.
**Desktop selection buttons:** Complete · Copy · Delete.

Ordering is navigation first, then the item's own actions in rising severity
(B43). The destructive action is **always last, in `--danger`, behind a
hairline** — and, per `UIUX §1`, never distinguished by colour alone. The
menu's geometry and the exhaustive list of its variants are `UIUX §7`.

Every menu says "All boards" — and since B66 removed the list view's page
heading, that is the only place the word is written.

No long-press timer is armed over bare canvas or lot background — the release
still captures — and the `pointerdown` that dismisses an open menu is inert and
creates nothing, because dismissal is a retraction, not a choice of what was
underneath (B30).

### §6.6.1 Undo

Delete is undoable for **5 seconds** via a toast that restores exact prior state,
including a note's original index in its collection. A batch delete is **one**
window, one save and one Undo. A new destructive action finalizes or cancels the
prior undo. A pending note or lot Undo is finalized on any board switch; a
board-delete Undo is cross-board-safe and survives (B26).

### §6.7 Boards

Multiple boards; the board is the unit. An empty database creates and opens one
blank board — **the list is never the landing view** (B10), because the desk
always shows a working page.

**Mobile:** a full-screen list, most recently updated first. Routing uses the
History API (`pushState` / `popstate`) specifically so the OS back gesture
returns you to the board (B9). Back is never intercepted, shadowed or disabled.

**Desktop:** the list is replaced by an always-visible 300px **rail** (B24),
sunken rather than floating, sitting outside `#board` so the gesture recognizer
never sees its events. Cards are compact.

Both surfaces order a section by **last touch, newest first** — the later of
`updatedAt` and `catStamp`, floored at `createdAt`, with `createdAt` desc + an
`id` tiebreak closing it (B69, superseding B24's immutable slot; `UIUX §10`).
A card's slot therefore moves when you edit the board: §1.3 keeps *positions*
permanent, and a listing's order was never a position.

The rail sorts into three sections — **To-Do / Idea / Note** (the third
renamed at the label only; its storage key remains `unsorted`, B63) — and a
pointer-drag moves a card between them, with the target section framing itself.
Each section carries its own **New board** control on its head row, and a board
created there is written into that category and opened (B63; the global create
controls are gone). Overflow **pages** rather than scrolling, and a single page
hides its own pager: no state, no statement (B42).

A rail board swap is a 150ms crossfade with **no history push** — B9 is bypassed,
not touched.

### §6.8 Offline

The service worker is cache-first with stale-while-revalidate. A warm hit is
returned without ever waiting on the network, so offline behaviour and
cold-start latency are unchanged, but the revalidation runs alongside the hit
and overwrites the entry — so the next launch is current.

`CACHE` is version-stamped and `install` only re-runs when `sw.js`'s own bytes
change. See §8.1: this makes the cache name the one string that says which build
is live.

---

## §7 Export

The only way data leaves the app.

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
- Export is reachable from the anchor menu, the board-row menu and the rail card
  menu — the board you are looking at, or any other, with no detour through the
  list.

> B34 marks the `EXPORT_GEO` duplication *impermanent*: the exporter restates
> `styles.css`'s geometry by hand, and splitting §10.5 into its own file is
> invited.

---

## §8 Release

### §8.1 Shipping discipline

`sw.js`'s `CACHE` constant (`todo-boards-v<N>`) is the one string that says which
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
`curl -s https://<pages-host>/sw.js | grep todo-boards-`

*Current state: `sw.js` reads `todo-boards-v8`, while B38 and `plans/TOP-BAND-PLAN.md`
both record `v7` as the last documented bump. The v8 bump has no DECISIONS entry.*

### §8.2 Testing

Three standalone Node scripts driving real Chromium via Playwright; no test
runner, no framework, not shipped. `test/mobile.js`, `test/desktop.js`,
`test/sw-update.js`. Each is one linear scenario and is run whole.

Mobile taps are dispatched as **genuine touch events**, not synthesized clicks,
because a real bug lived specifically in the browser's touch-to-mouse
compatibility events (B27) — test taps stay that way.

`test/sw-update.js` exists because of B36: it asserts that a shipped change
actually reaches an installed PWA.

> *A suite which cannot fail is lying.*

---

## §9 Design system

New in this document. §1–§8 describe an app that already works; §9 says what it
should look like and why. It implements §1.1 under §1's law.

**§9 holds positions; `UIUX.md` holds values.** That split is not a filing
convenience — `DECISIONS.md:22` calls `UIUX.md` "the rendering authority" and
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

**Dark-only, and not a default with an escape hatch.** §1.4 forbids the setting,
so there is nothing to escape *to*. The light/dark pair driven by
`prefers-color-scheme` (B16) is retired. This is the identity: deep water, one
room, the note as the lit thing in it.

**Depth reads as literal darkness, and the page reads as one scene.** Surfaces
are ordered top to bottom — water closing the band, the deep through the
middle, water closing the Parking Lot (`UIUX §2.2`, B58). The canvas is the
deepest thing on the page because it is the ground everything the person makes
sits on; the two sections are water because they are structure you read past,
closing the sheet's ends. **The note is the brightest thing on the page**,
without qualification since B58 retired the sand, because it is the only thing
the person made — if a re-tune ever made some other mark brighter than the
note, the identity would be wrong even if every contrast ratio still passed.

**One warm hue, and it is the destructive one.** Everything the app draws is
cool water or the deep — the sand left with B58 — except the one thing that
destroys. It need not shout — position and the hairline above it already
carry the meaning (§6.6).

**One typeface, self-hosted, three weights.** Montserrat Alternates. A CDN font
is a network dependency (§3.3) and an uncacheable hole in an offline-first shell
(§3.2), so it ships from `fonts/` — the three woff2 weights are committed
there — and is subject to §8.1's bump when declared.

**Notes carry no shadow.** Elevation means "temporary, above the page", so it
belongs to summoned surfaces only. A note is *on* the page.

**Never colour alone.** Every state distinguished by colour is also
distinguished by geometry, position or texture.

### §9.3 Where the values live

Every enumerable value — hexes, ratios, sizes, durations, offsets, thresholds —
is in `UIUX.md`, which `DECISIONS.md:22` calls the rendering authority. This
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
app's. See §9.5.2.

### §9.5 Implementation consequences

Named here so the follow-up work is scoped rather than discovered.

1. **Five sync points, none automated** — enumerated in `UIUX §16`.
   `styles.css :root`; `index.html`'s two `theme-color` metas; `manifest.json`'s
   `background_color` and `theme_color` (the format has no dark variant, so both
   become one dark value); `app.js`'s `PDF_PAPER` / `PDF_INK` / `PDF_SHADE`,
   which are hand-derived floats and do **not** follow the ladder (§9.4); and
   `icons/`, whose B1 motif is drawn in the poles and must be regenerated as B16
   regenerated it. Changing a token in one place silently desynchronises the
   others.
2. **PDF font embedding is the largest single item.** The exporter uses base-14
   Helvetica with hardcoded base-36 advance-width tables. Embedding requires:
   `.ttf` (not `woff2`) for `FontFile2`; a `/FontDescriptor`; a `/Widths` array
   with `/FirstChar`/`/LastChar`; real advances read from `hmtx`/`hhea`; and
   `PDF_ASC`/`PDF_DESC` re-derived from the font's own em box. The existing
   `/WinAnsiEncoding` + CP1252 layer is unaffected. With no build step (§3.3)
   there is no subsetter, so both weights embed whole — roughly 150KB per
   exported PDF. That cost is accepted deliberately.
3. **`EXPORT_GEO.radius` moves with the note: 3px.** An earlier draft held the
   note at 2px, arguing the radius set is three steps — 2 drawn, 3 the selection
   ring, 8 elevated transient — and the ring is 3 *because* it sits 1px outside
   a 2px note. The rendered proofs overruled it: at 3px the note still reads as
   drawn at every scale a note can take (`NOTE_MIN_W = 60` under
   `transform: scale()` keeps it near-square, `UIUX §4`), and the ring
   re-derives to 4px by the same 1px-outside law. The counterargument is
   recorded with the ruling (B49).
4. `sw.js` `ASSETS` gains the font files; `CACHE` bumps per §8.1.
5. The `prefers-color-scheme: dark` block and the entire light `:root` are
   removed, not overridden. `UIUX §16.2` gives every one of v1's thirteen tokens
   a fate, and `UIUX §2.3` the ground → ink binding for the 60 call sites the
   two retiring poles carry.
6. **The band's type metrics must be re-verified against the shipped font files**
   before release (`UIUX §13.2`). The band is sized by the type it holds (B37)
   and has been ruled on five times; `--card-h: 68px` and the 12px label's
   clearance of the 100px `--card-w` floor are both `system-ui` measurements.
7. **Three JS duration constants are paired to CSS values** and must move
   together (`UIUX §8`); nothing tests the pairing.

---

### §9.6 Verification

**A token test is written first.** `test/tokens.js` makes the design system
falsifiable before any of it is built, needs no browser, and is the only part
of the specification that cannot rot. It parses the shipped files and asserts:

- **The ladder and every published ratio** — parse `styles.css :root`, compute
  WCAG relative luminance, reproduce every table in `UIUX §2`. A pure function
  over constants.
- **Dark-only** — no `prefers-color-scheme` block survives in `styles.css`
  (§9.2; the light theme is removed, not overridden).
- **The five colour sync points agree** (§9.5) — parse `styles.css`,
  `index.html`, `manifest.json` and `app.js`; assert the colour literals agree
  with `:root`. The direct fix for the silent divergence those points have
  already exhibited once.
- **Accent placement** — assert the rule rather than each case: no accent
  appears as text on `--board`, `--shelf` or `--note` (`UIUX §2.6`).
- **Self-hosting** — `sw.js`'s `ASSETS` lists the font files; no CDN URL exists
  anywhere in the app.

The three browser suites remain the gate for everything they already pin. Two
of their assertion families move **only with the rulings that moved them**: the
band's geometry (the rule is now the band's bottom edge, and `--rule-y` is set
by the type it holds — B47) and the note's radius (B49). Updating those
assertions is part of implementing the ruling, not a test regression;
everything else in `test/mobile.js`, `test/desktop.js` and `test/sw-update.js`
must pass unchanged. `test/sw-update.js`'s `CARD_H_RE` reads `--card-h`
literally out of `styles.css`, so the token block keeps that declaration or the
regex moves in the same commit.

> **A suite which cannot fail is lying.** `sw-update.js`'s step 2 requires the
> bug to reproduce before step 3 demonstrates the fix. If step 2 ever passes
> cleanly, the harness has stopped exercising the service worker.

### §9.7 Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **The new typeface moves the band**, regressing the chain that has been ruled five times (B33 → B38) | High | High | `UIUX §13.2`'s measurements are a gate before shipping, and `test/mobile.js` asserts band geometry — a typeface that moves the band fails the suite, which is the correct outcome |
| R2 | **The five colour sync points diverge silently** | High, historically | Medium | `test/tokens.js` asserts their agreement (§9.6) |
| R3 | **`EXPORT_GEO` drifts from `styles.css`** as the design system lands | High | High | Assert screen/PDF *agreement* on an observable rather than comparing constants; `DECISIONS.md` marks the duplication impermanent three times (B34, B37, B38). Splitting the exporter out of `app.js` is the structural fix, and is not this release |
| R4 | **Drawn SVG marks read worse than glyphs at 16px** | Medium | Low | Impermanent (`UIUX §13.3`): a mark that fails is redrawn, not reverted to a code point |
| R5 | **Removing the light theme upsets a use case** — outdoors, bright light | Low | Medium | Accepted deliberately; P4 forbids the setting. Revisit from use, not from principle |
| R6 | **A missed `CACHE` bump** means the recolor never reaches the installed app | Medium | High | §8.1 is the ruling (B36), and `pages.yml` asserts the deployed `sw.js` matches the commit |


---

## §10 The boundary with `UIUX.md`

`UIUX.md` now exists, at the `§1`–`§12` numbering the codebase already cites
and that `styles.css:4-5` carries as its own header index (§13–§17 extend it
for what the citations never named). **Every
`UIUX §x` citation resolves natively.** The redirect table this section used to
hold — mapping each citation into a §9 subsection — is gone with the reason for
it.

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

Two `PRD §x` citations in the codebase point at superseded text:

- **`PRD §6.2`**'s predetermined width cap was superseded by B39 — a note wraps
  at the sheet's right edge (§6.2, `UIUX §4`).
- **`PRD §6.6`**'s menu ordering was superseded by A1 and then B43 (§6.6,
  `UIUX §7`).

Every other `PRD §x` citation resolves to its own number here.
