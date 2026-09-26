# DECISIONS.md — Zeved Boards v1

Where `PRD.md` / `UIUX.md` make a decision, it is followed exactly. This file
records only (a) the one place the two documents conflict internally, and
(b) choices the specs leave silent, each resolved by the **product principles
in PRD §1** (capture precedes structure · relationships asserted not inferred ·
positions permanent · zero cognitive tax · work performed stays visible) and the
**governing design law in UIUX §1/§6** (if you have to think about the
interface, it failed; every pixel earns its place). No principle-resolvable
question was escalated.

---

> ## The specification now exists. This file is unchanged by that.
>
> A1 and B1–B44 below were ruled against a `PRD.md` / `UIUX.md` pair that did not
> exist at the time. Both documents now do. **This remains the decision record:**
> new rulings continue here as `B45`+, citing `UIUX §x` where the rendering detail
> lives. A specification and a decision log answer different questions, and only
> one of them records what has already been tried.
>
> | Question | Authority |
> |---|---|
> | What v2 must be | `PRD.md` |
> | How it renders and behaves under the hand | `UIUX.md` (wins on any rendering question — see A1) |
> | Why the app does what it does, and what has already been tried | **this file** |
>
> **Append only.** An entry is superseded by a later ruling, never edited away.
> What v2's design system overturns, by number:
>
> - **B16** (the light/dark palette pair) — retired. v2 is dark-only; `PRD §1.5`,
>   `UIUX §2.1`.
> - **The `--line` mid-grey introduced with B15/B16** — deleted. It was specified
>   against surfaces it is not drawn on (1.64:1 on the sheet it rules across);
>   `UIUX §2.3`, `§2.5`.
>
> **B40's accepted anisotropy** ("when the two ratios diverge, vertical clearances
> can still shift") and **B21's width-only multiplier**: issues #65 and #75 are the
> argument against them — superseded by B64.
>
> Everything else here stands. In particular the B33 → B35 → B36 → B37 → B38 band
> chain is **unchanged and still authoritative** — `UIUX §13.2` adds a measurement
> gate in front of it, because a new typeface changes the type and the band is
> sized by the type it holds.
>
> **Grep this file before changing gesture, layout, band/lot or menu behaviour.**
> A prior fix in that area very likely already ruled out the approach you are
> about to take.

---

## A. Resolved internal conflict

### A1. Long-press menu order
PRD §6.6 lists the active-item menu as **“Complete · Delete · Boards.”**
UIUX §7 explicitly names that order *wrong* and mandates the destructive action
**last**: **Complete/Restore · Boards · Delete**, with Delete in `--danger`
separated by a hairline.

**Decision:** follow UIUX §7. It is the rendering authority, it resolves the
conflict *in the document itself* (calling the alternative ordering out by
name), and Delete-last is the safer, convention-correct placement for a
destructive action. Implemented in `app.js › openMenuFor`. Not escalated,
because the spec resolves its own conflict.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## B. Silent choices (resolved by the principles)

### B1. Icons — artwork & generation
The specs require 192/512 + maskable icons from the token set but don't specify
artwork. **Decision:** the icon *is* the product's identity motif — a near-square
`--ink` note-frame on `--paper` with two ink “text” lines and a short scratch
stroke (the completion texture). Identity from structure, not costume (UIUX §1).
Generated once by a dependency-free Node script (`node:zlib` PNG encoder) so the
deliverables stay static and buildless; the maskable variant keeps the motif
inside the ~80% safe zone with paper bleeding to the edges.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B2. `contenteditable` is toggled on only while editing
Notes/anchors/lot lines are made `contenteditable` on entering edit and reverted
on blur, rather than being permanently editable. **Why:** permanent
`contenteditable` fights the gesture recognizer — a tap would focus and open the
keyboard on `pointerdown`, before drag vs. long-press can be distinguished,
breaking capture-vs-manipulate. Toggling gives the recognizer full control
(zero cognitive tax) while keyboard/AT users still enter edit via `focusin`.
`role="textbox"` + `aria-multiline` are always present for AT (UIUX §12).

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B3. `contenteditable="plaintext-only"`
Editable regions use `plaintext-only` (the primary device is Chromium/Samsung
Internet), with a runtime feature-check falling back to `"true"` where
unsupported. **Why:** the data model is plain strings; rich markup from paste
would be un-representable and off-model. Text capture never breaks either way.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B4. Pinch origin & drift
UIUX §4.1 requires `transform-origin: top-left` (so stored `x,y` stays truthful);
§5 also says the note is “position-compensated so it doesn't drift.” **Decision:**
top-left origin throughout — under it the top-left corner is the fixed anchor, so
there is no drift to compensate; the two requirements coincide. The only
position adjustment on pinch is re-clamping into the page when a grown footprint
would cross the boundary (the only constraint §6.3 allows).

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B5. Tap recognition upper bound
UIUX §5 defines Tap as `<250 ms` and Long-press as `500 ms`, leaving 250–500 ms
undefined. **Decision:** any release **before** the 500 ms long-press fires, with
movement < 10 px, commits as a tap. A slow, deliberate press that isn't a
long-press should still act (zero cognitive tax) rather than do nothing.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B6. Parking Lot uses block flow, not the absolute canvas
Lot items are stacked in normal document flow inside `#lot-items`. This is **not**
the §14 “no flow container” regression: that rule protects the *free canvas*,
where position permanence lives. Lot items have **no `x/y`** in the data model
(PRD §4) — they are ordered lines by definition (PRD §6.5), so flow is the
correct, faithful layout. Notes on the canvas remain strictly absolutely
positioned.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B7. Decoupled 44 px hit floor
Each note carries a computed `--hit` inset on a transparent `::before` expander,
sized so `inset · scale · renderScale ≥ 44 px` physical, recomputed on
scale/edit/resize. **Why:** honors Fitts / PRD §5.3 without altering the visual
frame — hit area is generous, never pixel-perfect to visual bounds (UIUX §6).

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B8. Empty-frame discard uses `trim()`
A note/lot line committed with only whitespace is discarded, not just one with
literal zero length. **Why:** “no empty frames ever exist” (PRD §6.2) — a
whitespace-only frame reads as empty. Tap-empty always creates a note (§6.2), so
a transient empty editor may exist *while editing*; it vanishes on blur.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B9. Navigation & OS back via the History API
Opening the board list `pushState`s a `{v:'list'}` entry; selecting a row or
“New board” calls `history.back()`; `popstate` drives the view. **Why:** UIUX §10
demands the OS/browser back action is *never intercepted or disabled* — this
makes back return to the board naturally, with no interception, and keeps the
board (not the list) as the app's resting state.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B10. Empty-database first launch
PRD §8.1/§6.7 assume a board exists at launch but don't say what a truly empty
install shows. **Decision:** create and open one blank board (four anchors). The
desk always shows a working page (UIUX §1); the list is never the landing view.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B11. Manifest `orientation` + colors
`orientation: "any"`, `theme_color`/`background_color` = `--paper` (`#EEEBEF`).
**Why:** the Z Fold's inner and cover displays must both be first-class (PRD §3)
and survive fold/unfold, so orientation is not locked; paper is the surface the
user should perceive as the app, including the launch splash. `theme-color` is
also set per-scheme in `index.html` so the system UI matches the active theme.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B12. Browser pinch-zoom disabled (`touch-action: none`, `user-scalable=no`)
**Why:** the board explicitly never pans or zooms (PRD §5.1); a two-finger pinch
is reserved for scaling the *note*. Letting the browser also pinch-zoom would
make the note-scale gesture ambiguous. The app provides its own uniform
scale-to-fit, so native zoom is redundant here. This is a deliberate,
spec-driven trade, scoped to this fixed-page tool.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B13. Persistence timing & resilience
Keystrokes debounce at 300 ms; blur, drag-end, pinch-end, complete/restore,
delete, and z-order changes commit immediately; `updatedAt` refreshes on every
write (PRD §4). Writes go through a single-flight queue with exponential backoff;
on failure the polite `role="status"` toast “Couldn’t save — retrying.” shows and
auto-retries, and never blocks capture (UIUX §12) — a pending Undo toast is never
clobbered by it.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B14. Caret at the tapped point
Editing places the caret at the touch point via `caretRangeFromPoint` /
`caretPositionFromPoint`, falling back to end-of-text. Serves “edit at tap point”
(UIUX §5) directly.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B15. Focus-ring color follows the palette
With the "Aubergine on Mist" palette (B16), `--focus-ring` is retuned into the
family — muted indigo `#4A4E82` (light) and `#A0A2D8` (dark, a new override the
old blue didn't need). It stays a 2 px ring at 2 px offset (non-color-alone), so
robustness comes from geometry, not hue; the retune only keeps the indicator in
the same low-chroma world as the poles (light ring 6.6:1 on paper, dark 7.4:1).

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B16. Palette — "Aubergine on Mist"
The token set is retuned from a warm paper/ink to a muted-plum pairing: poles
`--paper #EEEBEF` / `--ink #221C24` (light) and `#1A161C` / `#E6E1E8` (dark), with
every derived token (`--ink-shadow`, `--letterbox`, `--surface-raised`, `--hairline`)
and accent (`--danger`, `--accent-restore`, `--focus-ring`) regenerated from those
poles. **Why:** the choice follows the two-axis brief — *sharply contrasted* (ink/paper
14.1:1 light, 13.9:1 dark: past AAA, short of the harsh 21:1) but *not brightly sharp*
(pole chroma ≤ 0.018 OKLCH, off the vivid axis). This is a re-interrogation of an
impermanent value choice, not costume: the system stays a single near-monochrome value
scale generated from two poles (UIUX §1 "identity from structure"). `--ink-rgb` stays
channel-synced to `--ink` for the scratch-out text. Icons (B1) regenerated in the new
poles to keep the installed-app identity in sync.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B17. Layout — "grow the canvas" fill replaces the letterbox
B11/B12 framed the page as a fixed 900×1000 sheet shown with a *contain* fit
(`Math.min`), which left `--letterbox` bands on any device whose aspect isn't 0.9 —
on a tall phone, thick dark bands top and bottom. **Decision:** the sheet now fills the
screen edge-to-edge on every device. `LOGICAL_W` stays a fixed 900-unit width reference;
`LOGICAL_H` is recomputed each layout as `LOGICAL_W · vh/vw`, so `vw/LOGICAL_W === vh/LOGICAL_H`
and a single **uniform** `renderScale = vw/LOGICAL_W` fills both axes with `offX = offY = 0`.
**Why this fill, not the others:** uniform scale is preserved, so note frames stay square
(B1 identity motif) and the decoupled 44 px hit math (B7, `renderScale`-based) stays
exact — a *cover*/crop fit would cut off edge furniture and an axis-decoupled *stretch*
would distort both. The extra height is honest canvas; furniture pinned to the top (title,
Components, Required) is unchanged and the Parking Lot re-pins to the true bottom
(`#lot { bottom: 16px }`, same 16 px gap it had at the old 1000-unit bottom). `--letterbox`
survives only as the pre-paint background and is no longer visible in normal use.

**Tradeoff (kept faithful to "positions permanent," PRD §1):** when the page *shrinks*
(e.g. portrait→landscape) a note committed lower on the taller page keeps its truthful
`y` rather than being reflowed — existing notes are **not** re-clamped on resize (that
would silently move committed work). Notes are still clamped into the current page at
creation/drag/pinch, so new placement always lands on-page, and off-page notes reappear
when the device returns to a taller orientation. This favors the primary portrait / Z Fold use.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B18. The 400 ms action window is acknowledged, not idle
Every click interaction now commits **400 ms** after release rather than on the same
frame (`ACTION_DELAY`, `app.js › delayAction`). The literal instruction — put 400 ms
between click and action — is followed exactly; what the specs leave silent is what
happens *during* it, and four choices resolve that:

**a. The window is filled, not empty.** 400 ms of nothing is indistinguishable from a
dropped tap, and a user who has to wonder whether their tap landed has been made to
think about the interface (UIUX §1). So the tapped thing responds immediately and the
action lands as the response releases. The delay is a beat, not lag. This is the whole
justification for the feature having a visual dimension at all: without it the change
satisfies the instruction and fails the law.

**b. Content thickens; controls fill.** The acknowledgment is the system's existing
press language, not a new one. Notes reuse `.pressed` verbatim (§4.2) — the same 3 px
weight the note already shows when picked up for a drag, padding-compensated so nothing
reflows; anchors and lot lines take the same weight in their own idiom. Notes are
deliberately **never** filled: a filled note is the completion scratch-out (§4.3), and an
acknowledgment that reads as "completed" would be a lie for 400 ms. Furniture and
controls have no such collision, so they fill with their own ink and drain their label to
`--paper` — every fill pairs a token with `--paper`, so light and dark invert correctly by
construction rather than by a second rule.

**c. Empty canvas gets a ghost.** A tap on bare paper has no element to acknowledge, so
the frame it is about to produce is drawn first at `--ink-shadow` weight (`.tap-ghost`),
sized to the 44 px hit floor, and replaced by the real note when the window closes. The
B1 motif before it has content — the promise of the frame, then the frame.

**d. Taps inside an open window are dropped, not queued.** One action is in flight at a
time. Queueing would make an impatient double-tap create two notes or delete twice, which
is worse than the delay it is reacting to. First tap wins.

**Measured from release, not press,** because a click is complete at release. Combined
with B5 (a slow press up to 500 ms still commits as a tap) the worst case is ~900 ms from
touch to action; the common case is ~400 ms.

**Not delayed, because they are not clicks:** long-press menu *opening*, drag drop, pinch
end, and the `focusin` edit path for keyboard/AT users. Keyboard activation of a menu item
*is* delayed — it routes through the same `click` listener, correctly.

**Amended by B27** (mobile capture left the window; B18c's ghost is desktop-only). The
clause below is the amendment working as written, not a repeal: the structure held and only
the scope moved.

**Impermanence:** 400 ms is a felt value, given not derived. It should be re-interrogated
on the device rather than defended — the structure above holds at any duration, and only
the number would move. The acknowledgment is instant (no transition), so the mandatory
`prefers-reduced-motion` kill-switch (§8) has nothing to remove and the delay survives it
intact — correctly, since reduced-motion is about vestibular safety, not about timing.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## C. Desktop mode (issue #4; decisions ruled in issues #8–#16, specs in PRs #28–#35)

### B19. Desktop-mode detection
A session is desktop iff `matchMedia('(min-width: 1024px) and (hover: hover) and
(pointer: fine)')` matches, re-evaluated live on `change`. One `isDesktop` flag + one
`desktop` class on `<html>` are the single source of truth; CSS gates on the class and
never restates the query. Primary-input capability — not width, not UA — excludes
tablets (iPadOS reports coarse/none even with a trackpad; a stylus is `any-pointer`,
so an S Pen Z Fold stays mobile). Width is the reverse backstop and guarantees room for
the 300 px rail. The exclusion is derived, not quoted: desktop's hover-dependent grammar
would strictly reduce a touch-only device, while mobile mode costs it nothing. Mode
flips tear down live state (selection, menu, a pushed list entry via `history.back()`
so B9 holds, half-finished gestures). No persistence, no override.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B20. Desktop geometry — min-anchored axis inversion beside an unscaled rail
`renderScale = min(vh/1000, (vw − 300)/900)`; `LOGICAL_H = vh/renderScale`;
`LOGICAL_W = (vw − 300)/renderScale`; `offX = 300` (the rail is unscaled chrome; the
sheet fills the rest — `--offx` already flows through `toLogical` and the board
transform, so stored coordinates stay sheet-relative with no per-note math). Uniform
scale (no distortion), both axes fill exactly, and **neither logical dimension ever
drops below the 900×1000 reference** — mobile-placed notes always fit and the top
furniture never collides, at any window shape. The extra width is the issue's new note
surface. Mobile's B17 branch is untouched; the furniture CSS became width-agnostic
(`right:24`, `left:24;right:24`, `calc(50% − 200px)`) — arithmetically identical at 900.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B21. Cross-device note `x` — scaled, not clamped, not fixed (overrides the B17 default)
Desktop's variable `LOGICAL_W` lets a note's `x` exceed a phone's 900-unit sheet. Ruling
(issue #15): positions render **proportionally** in both directions. Each note carries
`rw`, the `LOGICAL_W` in effect when `x` was last written (`createNote`/drag/pinch/
resize); rendering computes `renderX = x · (LOGICAL_W / (rw ‖ 900))` for CSS `left`,
leaving stored `x` untouched — a viewport change never mutates data. Gestures rebase
(`x = renderX; rw = LOGICAL_W`) at grab, which is visually silent by definition, so all
grab math runs in current-frame units unchanged. Legacy notes read as `rw = 900` — true
by construction, so there is no migration. `y` needs none of this (`LOGICAL_H ≥ 1000`
everywhere); the Parking Lot has no `x`/`y`.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B22. Desktop selection is instant, inert state; B18 governs actions
Click selects; the selection (and its dismissal, and the second-click edit entry) is
**instant and opens no `delayAction` window** — B18's window acknowledges a
*consequence*, and selection commits nothing. (Confirming mechanics: the drop-guard
would swallow the second click of every double-click, so delayed selection is also
impossible.) `handleTap`'s blanket drop-guard moved into the branches that fire
actions, preserving B18(d) exactly where it does work. Complete/Restore/Delete, board
create/swap/delete, and creation keep the 400 ms window. Deselecting does not cancel a
pending action (Undo is the cancellation path); selecting never calls `surfaceNote`
(it would write — the overlay renders above every note regardless). The selection
chrome is one overlay in board space: it inherits `renderScale`, never `note.scale`,
and its buttons are recognizer-routed because `setPointerCapture` retargets native
clicks inside `#board`. Frame-drag resize shares pinch's scale/clamp/hit math.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B23. Creation surfaces deselect first; the hit floor is 24 px on desktop
With a selection active, a click on a creation surface (empty canvas *or* the lot
background — one rule) only deselects; with none, capture runs exactly as on mobile.
The ordinary capture loop never pays the extra click — edit and selection are mutually
exclusive and commit-on-blur doesn't reselect. So near-miss dismissals don't land in an
invisible hit collar and reselect (or re-edit) the note, `HIT_FLOOR` drops 44 → 24 px
on desktop only — WCAG 2.5.8 AA, the pointer-agnostic floor; B7's 44 px (2.5.5 AAA,
fingertip) stands untouched on mobile.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B24. The board rail replaces the list view on desktop
A full-height sunken rail (`--pane`, slightly darker paper, inset shadow — embedded,
not floating) at a fixed 300 CSS px. Cards are compact (56 px, ~40ch) and ordered by
one shared comparator: `createdAt` desc + `id` tiebreak — immutable, so a card's slot
never moves (the same claim as positions-permanent); `boot()`/`ensureCurrentValid()`
keep `updatedAt` deliberately (`updatedAt` selects *continuity*, `createdAt` orders
*space* — do not "fix" this). When boards overflow the rail, the bottom edge says so
in the §10 truncation idiom; otherwise it says nothing. Card click swaps the board in
place — **no history push**, so B9's popstate flow is bypassed, never touched — behind
a 150 ms crossfade sequenced by `setTimeout` (reduced-motion zeroes transitions, so
`transitionend` would never fire). Create is the same filled primary control as the
list view (shared class; its own listener — the mobile path ends in `history.back()`).
Delete has two paths, neither hover: a permanent control on the **active card only**
(deleting keeps the board's contents in front of you), and **right-click any card** →
the existing one-item danger menu — the one summoning gesture "remove click-and-hold"
doesn't touch. Both land in `deleteBoard` → 400 ms window → 5 s Undo; deleting the
open board heals `current` immediately via `ensureCurrentValid()` (no list screen will).
Consequence: the menu *can* open on desktop, so the desktop keyboard handler is inert
while `menuOpen`.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B25. Parking Lot on desktop
Same select grammar as notes (click selects, double-click edits, Complete/Restore +
Delete; no resize — they are not frames). The selected row draws a frame: an explicit,
narrow override of §4.4's "never framed," scoped to desktop + selected + one row,
drawn with `outline` (no padding to absorb a border shift) in `--ink` (selection ≠
edit, which keeps `--focus-ring`). Buttons sit inline at the row's right edge —
`#lot-items` is `overflow: hidden`, so below-the-row controls would clip on exactly
the last, most actionable row. The lot grows to 210 px (`34 + 4·44`, four rows) out of
the desktop canvas; mobile keeps 128 px. Notes committed near the sheet bottom may
overlap the taller lot; they render above it (z-order) and are not moved — B17.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B26. Desktop caret and Undo scope
Double-click (and Enter on a selection) enters edit with the caret at the **end** —
issue #4's explicit instruction, a desktop-only override of B14's caret-at-tap-point,
which stands on mobile. A pending **note/lot** Undo is finalized on any board switch:
its callback splices into whatever board is `current` at undo time, so switching would
resurrect the item onto the wrong board (a pre-existing mobile bug the always-visible
rail turns into a one-click accident). Board-delete Undo is cross-board-safe and
survives switches — the toast now carries a scope for exactly this distinction.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## D. Capture reliability on the device (the note-creation tap issue)

Evidence: a screen recording of a real capture session on the Z Fold (Samsung Internet).
Sixteen seconds of tapping bare paper to start a note. Most taps did nothing at all; the
few that landed opened an editor and a keyboard that immediately closed again, and the
keyboard flapped up and down for the rest of the session. **Not one note survived.**

That is the whole product failing at its first principle — *capture precedes structure*
(PRD §1). Everything below descends from it. Four independent suppressors were stacked on
the same gesture and each one alone was enough to lose a tap; the entries are separated
because the fixes are separable, not because the causes were.

### B27. Mobile capture is instant, and the recognizer suppresses the browser's compatibility mouse events

Two changes, one cause: **`focus()` must run inside the gesture that asked for it.**

**a. Capture leaves B18's window.** Creating a note or a lot line, and entering edit on
either, now happen synchronously in `pointerup` on mobile. B18's 400 ms beat stays on every
action that *consequences* something — Complete/Restore, Delete, menu items, Undo, board
create/swap/delete. This is B22's line ("B18's window acknowledges a *consequence*"),
extended from desktop selection to mobile capture by the same reasoning: creating a note
commits nothing, destroys nothing, and can be undone by walking away from it. B18's own
impermanence clause asked for exactly this re-interrogation *on the device*, and the video
is it — so this is the mechanism working, not an exception to it.

The functional half is decisive: a browser raises the soft keyboard for a programmatic
`focus()` only while it can attribute it to user activation, and `setTimeout(…, 400)` is
outside that. Every mobile focus in the app was reached through `delayAction`'s timer, so
the keyboard raise was never guaranteed — it was luck.

The formal half is the stronger claim, and it stands on its own: **the editor appearing
with a live caret is a better acknowledgment than the ghost that preceded it.** B18c
invented `.tap-ghost` because empty canvas had no element to acknowledge — the promise of
the frame, then the frame. Once the frame itself can arrive instantly, the promise is a
stand-in for something no longer absent, and the interface is asking to be thought about
(UIUX §1) for 400 ms. So the ghost is not deleted, it is **scoped to desktop**, where the
window it fills still exists. B18c is narrowed, not repealed.

**b. Compatibility mouse events are suppressed at `pointerdown`.** This was the largest
single cause of the dropped taps and the one the code's own comments had already half
found. A touch tap fires `pointerup`, then the browser synthesizes `mousedown`/`mouseup`/
`click`; `setPointerCapture` retargets those to `#board`, which cannot hold focus, so their
default action pulled focus straight back out of the editor the tap had just opened. The
note was then empty at blur and B8 correctly destroyed it. **The bug wore the costume of
the fix**: a tap that worked perfectly, undone one event later, looked exactly like a tap
that never registered. Measured in the browser, a plain tap lost its note about as often as
it kept it, and any finger movement at all made it near-certain.

Past the `isEditing` guard the recognizer owns the press outright and places every caret
and focus explicitly, so `preventDefault()` there removes only duplicates. It is *not*
called on the editing path, where the native caret is exactly what should run.

**Consequence, deliberately accepted:** B18(d) ("first tap wins") no longer applies to
capture, because it no longer needs to. An impatient double-tap creates a note, then a
second — and creating the second blurs the first, which is empty, which B8 discards. One
note survives, at the last point tapped. The guard that existed to prevent a double-create
is not weakened; it is made unnecessary by a mechanism already in the system.

**Impermanence:** the 400 ms itself is untouched and still felt-not-derived. If it is ever
re-interrogated to zero, this entry collapses into it and B18c's ghost goes with it.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B28. The sheet holds still while a note is being written

`interactive-widget=resizes-visual` in the viewport meta, **plus** a JS guard that skips
mobile re-layout while a `contenteditable` inside `#board` holds focus, with the skipped
layout re-applied on `focusout`.

**Why both.** Under B17 the mobile sheet's height *is* the viewport (`LOGICAL_H = 900·vh/vw`),
which was the right call for filling the screen and the wrong one to leave unguarded when
something else can change `vh` — and on Android the soft keyboard does exactly that. The
sheet collapsed to roughly half its height the instant the keyboard opened (measured:
1983 → 1055 units), a note committed low on the page fell outside it, and
`#board-view { overflow: hidden }` clipped it away while it still held focus. The user's
next tap therefore landed on bare canvas, blurred an editor they could no longer see, and
B8 discarded the empty note — dropping the keyboard, resizing again, and starting over.
**That loop is the flapping in the video**, and it is not a keyboard bug: it is B17
faithfully doing its job on a viewport that had stopped meaning what B17 assumed.

The meta directive is the correct fix and states the intent declaratively — the keyboard
should resize the *visual* viewport, not the layout one. It is Chromium-only, and Samsung
Internet is Chromium with a lag and its own keyboard/insets layer, so it is treated as the
primary fix and assumed to be possibly ignored. The guard is what makes the claim true
everywhere, including a browser that has never heard of the directive.

Deferring rather than discarding matters: a rotation or a fold *during* an edit is a real
layout change with no second resize coming after blur, so the guard remembers it and
`focusout` applies it. B17's "committed notes are never re-clamped on resize" is untouched
and now easier to hold — mid-edit there is no longer a resize to re-clamp against.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B29. Touch slop 10 px → 16 px

B5 quotes "<10 px" from UIUX §5. On a 7.6-inch foldable held one-handed, a fingertip rolls
further than 10 CSS px during an ordinary tap, and every such tap was cancelled outright
(`g.mode = 'cancelled'`) with no feedback of any kind. 16 px recovers them and is still far
short of any intentional drag. Same license B18 grants itself: a felt value, re-interrogated
against the device rather than defended from the page it was written on. The constant is
shared by drag-start, long-press-cancel and list rows, so the recognizer stays coherent at
one number rather than three.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B30. A long-press on a creation surface captures; dismissing a menu does not

**Long-press.** No long-press timer is armed over bare canvas or the lot background, so the
release commits as the tap it always was. Previously the timer fired, vibrated, and threw
a `TypeError` inside `openMenuFor` — canvas and lot pass `#board`/`#lot` as the target node
and neither carries a `dataset.id`, so the record lookup returned `undefined`. Worse than
the crash: `g.longPressed` was set *before* the throw, which suppressed the release. Every
press held past 500 ms on empty paper produced a buzz and nothing else — and holding a
moment too long is entirely ordinary on a phone. This is B5 one step further out: a
deliberate press that isn't a long-press must still act, and so must one that *is* a
long-press over a surface with nothing to open. Boards is unaffected; it lives on the
anchor menus. `openMenuFor` also returns early on a missing record now, so no future caller
can reproduce the crash.

**Dismissal.** The `pointerdown` that closes an open menu is inert — it no longer also
creates a note on the paper the menu was covering. Dismissal is a retraction, not a choice
of what was underneath.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B31. No empty frame outlives its editor

B8 ("no empty frames ever exist") was enforced only at blur, and blur presupposes focus. A
frame whose editor never received focus never blurred, so it was never discarded: it stayed
in the model, invisible (`.note-text:empty` is fully transparent), and kept its 44 px hit
collar (B7). Any later tap inside that collar hit the `isEditing` early-return and died
silently. **Failed taps left landmines, so the flakiness compounded the longer the user
tried** — which is precisely the shape of the video, worsening over sixteen seconds.

Three closures, at three different layers, deliberately:

- **`isEditing` now requires real focus**, not just the attribute. An attribute can outlive
  its edit; focus cannot. A husk is therefore an ordinary note again — the next tap focuses
  it and the following blur discards it, so the app heals on contact.
- **Creation verifies its own premise**: if `focus()` did not land, the frame is removed in
  the same breath. Cheap, and a no-op now that capture runs in-gesture (B27).
- **Every render sweeps the board** of whitespace-only notes and lot lines. B8 at rest
  rather than only at blur — so data written by the *old* code cleans itself up the first
  time it is drawn and this bug leaves nothing behind.

**Not fixed by saving on creation**, which was the tempting one-liner: writing an empty
frame to disk is the exact thing B8 forbids. A note earns persistence with its first
character. The real hole — an empty frame swept to disk by some unrelated `saveNow()` —
is closed by the sweep, which is the right layer for it.

**Verification.** 35 mobile and 26 desktop checks drive a real browser (touch events via
CDP, mobile emulation) and cover every claim above; run against the pre-fix commit they
reproduce the video's symptoms exactly, including the `TypeError` and the mid-edit sheet
collapse. They are the standing regression net for anything that touches the recognizer.
The device remains the only authority on B28's directive.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## E. Mobile legibility (issue #37)

### B32. The mobile sheet is 1:1 with the viewport (overrides B17, and B21's `y` clause)
B17 kept the phone on a fixed 900-unit sheet scaled to fit, which on a ~400 px phone means
`renderScale ≈ 0.45`: 24 px of title reached the screen as 10 px, the Components/Required
labels as 6 px, and the 128 px Parking Lot as ~55 px — about one row. The sections were never
resizable and are not made so here; they were literals being shrunk. **Decision:** on mobile
`LOGICAL_W = vw`, `LOGICAL_H = vh`, `renderScale = 1`. The sheet *is* the viewport, every
declared px is a real px, and B17's claim survives intact — a scale of 1 is uniform by
construction, so there is still no letterbox and no distortion.

The three-across top furniture (Components · Title · Required) is preserved exactly. It could
no longer be written as px against a known 900 sheet, so its mobile rules are restated as the
fractions they always were — 24/900 = 2.6667 %, 216/900 = 24 %, 400/900 = 44.4444 % — which is
identical geometry at 900 units and the same layout at any width. Desktop keeps fixed px
(`html.desktop` overrides): its `LOGICAL_W` is derived per layout (B20), so percentages there
would drift with the window shape. The Parking Lot takes desktop's 210 px (`34 + 4·44`) in
both modes, so four rows are visible everywhere.

B21 ruled that `y` needed no counterpart to `rw` because `LOGICAL_H ≥ 1000` everywhere. At 1:1
the mobile height is `vh`, so that premise is false and every note now carries `rh` beside
`rw`, written at exactly the same call sites (`createNote`, and `rebaseNote` at drag/pinch/
resize grab) and read by `renderY`. Notes written before B32 have no `rh`, and unlike `rw`'s
legacy 900 it cannot be recovered — the old mobile height was device-dependent (~1700–2000) —
so they are mapped through the height the previous build would have produced on *this* device
(`LEGACY_H`) and clamped into the page **at render time only**. Stored `y` is never mutated, so
B17's "committed positions are permanent, never re-clamped on resize" holds; the clamp exists
solely so a note authored on the old ~2000-unit sheet stays reachable rather than clipped off a
page that — unlike a rotation — will never be that tall again. The clamp is scoped to the
legacy branch: applied to live notes it would fight `createNote`'s own bottom clamp and
`rebaseNote` would write the pulled-up value back, which is the silent mutation B21 forbids.

Two consequences carried with it. The 405 px note cap (45 % of the old sheet, PRD §6.2) becomes
a width-relative `--note-max-w` set in `applyLayout`, because at 1:1 a fixed 405 px is ~98 % of
a phone — no cap at all, and the spatial board would collapse into one column. The decoupled
44 px hit floor (B7) needs no change at all: it was always parameterised on `renderScale`, and
at 1 it simply meets the floor with real geometry instead of a ~100-unit invisible collar. B28's
keyboard deferral is untouched and now load-bearing in a second way — an unguarded resize would
move every note, and a gesture during one would bake a keyboard-shrunken `rh` into storage.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B33. The top band is drawn furniture, not a by-product of content (issue #38)
Three symptoms, one cause: the title card had no frame, there was no rule under Components /
Requirements, and both headers vanished the moment text was typed. The anchors' only rule was
`border-bottom` gated on `.filled`/`:focus`, and their only label was a `::before` fed from
`data-placeholder` — so *what this section is* (permanent) was carried by the same element as
*this section is empty* (transient), and inherited its transience. A blank board drew nothing;
a filled board lost its headers. The Parking Lot had the right shape all along (`#lot-rule` /
`#lot-header` / `#lot-items`); the band never got it.

**Ruling:** the band is furniture and draws unconditionally. One `#band-rule` across the sheet at
`y=200`, at `#lot-rule`'s weight and gutter. Each side is a `.band-zone` holding its anchor and a
permanent `.band-label` pinned to the rule and hugging the card — right-aligned left of it,
left-aligned right of it. The card is a 4-sided frame, always drawn, `--paper`-filled, `top:24`
to `252`: it **overhangs the rule and occludes it** rather than the rule crossing it, which is
the whole spatial idea — the line was drawn across the page and the card landed on top of it.
Geometry is the issue's wireframe measured against the 900×1000 reference sheet: rule `y=200`,
card 220 wide (24.4444%) and 228 tall, the 1.26 overhang ratio it draws.

Three consequences worth naming. **The card is the one always-drawn frame** — a deliberate
exception to §6.2 "no empty frames", which exists to keep the *free canvas* clean; the card is
permanent furniture, and the reference draws it on a blank board. **The title sets at the header
size** (15/600, not 24/700): the card carries the hierarchy now, and at 24px a 220-wide card
broke titles mid-word on a phone sheet — the wireframe sets them identically for exactly this
reason. **The rule does not thicken on tap.** B18(b) still holds, but in each anchor's own idiom
— the side anchors grow a 3px baseline, the card thickens its frame like a pressed note, both
padding-compensated. The rule belongs to both zones at once, so thickening it could not say which
one was tapped; `#lot-rule` can, because it belongs to one.

`.band-zone` is `pointer-events:none` with the anchor `auto`, so `classifyTarget`'s
`closest('.anchor')` is untouched and the rest of the band stays bare canvas — which is where the
reference puts notes. No `app.js` change; `.filled` keeps its one remaining job, the card's
placeholder. Not changed, and inconsistent with the reference until it is: `#lot-header` sits
*below* its rule where the wireframe puts it above.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## F. Export (issue #43)

### B34. The exporter is hand-rolled, and it draws the reference sheet
Boards only left the device as screenshots. Issue #43 asks for a `.pdf` on the board-card menu.

**Why no library.** jsPDF plus html2canvas is ~550 KB of vendored code, two new `ASSETS` entries in
`sw.js`, and a false sentence in the README's first paragraph. PDF is a text format and the base-14
fonts need no embedding, so the whole exporter is ~430 lines in `app.js` §10.5. B1 already settled
the precedent — the icons come out of a dependency-free PNG encoder — and the app still has no
frameworks, no build step and no dependencies. It also keeps the promise the PWA is built on: the
export works with the aeroplane switch on, because nothing is fetched.

**The frame is 900×1000, not the device.** `LOGICAL_W`/`LOGICAL_H` are viewport-derived (B20, B32),
so exporting against them would make one board a different document on a phone than on a desktop.
`exportX`/`exportY` are `renderX`/`renderY` with the reference sheet substituted for the viewport,
so the export inherits issue #15 and B32 rather than re-deriving them, and B21 holds: stored `x`/`y`
are read, never written. A pre-`rh` note keeps B32's admission that its authoring height cannot be
recovered — it maps through `LEGACY_H` and is clamped onto the page at export time only.

Reading, not writing, is the rule for the whole action. Records reach the menu straight from
`idbGetAll()` and have never passed through `renderBoard`'s sweep, so the export re-runs B8/B31's
`trim()` filter **on a copy**: a whitespace husk would otherwise export as an empty framed box, and
filtering in place would be a silent mutation of live state. For the open board the export reads
`current` rather than the rail's closure, because saves are debounced and the card's snapshot can be
several keystrokes behind what the user is looking at.

**Four medium decisions.**

*Two pages, A4 portrait.* Page one is the sheet — the thing the screenshot was standing in for —
scaled 0.581 and centred. Page two is the same board as prose, so the file is searchable and
readable without decoding a diagram. A4 because a board is 0.9 wide-to-tall and A4 is 0.707: some
page is left over either way, and a standard size prints anywhere without a dialog.

*Paper edge to edge, always light.* `styles.css` §1 names paper tone as part of the identity
alongside the frame and the scratch-out, so both pages are filled with `--paper` rather than the
sheet floating on white — B17 and B32 spent two rulings deleting the letterbox and this is not the
place to bring it back. Dark mode does not travel: it is an accommodation for an emissive display,
and `--paper` at `#1A161C` prints as a slab of near-black.

*Helvetica, not embedded.* "Identity comes from structure, never costume" (`styles.css` §1). The
structure is exact; the costume changes. The honest cost, stated rather than hidden: the browser
measures in `system-ui` and the viewer sets in Helvetica, so wrap points and a note's `max-content`
box width can differ by a line. **Positions do not** — those come from the record. A base-14 font
also cannot say CJK or emoji; those characters export as `?` and the substitution raises a toast,
because §10's law is that truncation is always indicated and a silently mangled line is truncation.

*The scratch-out destroys the text in the new medium too.* `styles.css` §4.3 says the mark is such
that "no screenshot/zoom recovers it." The obvious port — draw the text, hatch over it — yields a
PDF that `pdftotext` reads back verbatim, breaking that promise while looking identical. **A
completed note or lot line emits no text object at all**: frame, paper, hatch. `opacity: 0.97` goes
with it, since its job was to let a hair of the 40 %-ink text show through and there is now nothing
underneath; the ink is mixed down against paper instead, which saves an `/ExtGState`. The
interrogation produced a simplification, and the promise is a test rather than a claim.

**Two smaller notes.** The item needed no `styles.css` change — it speaks the existing menu language
(`#menu button`, `.glyph`, `.sep`) — which is the evidence the design was right. And the writer emits
no dates, so an unchanged board exports byte-identically twice running; the test asserts it.

**Export lives on the board menu, not only the board-card menu.** The issue's own wording — "long
tap on mobile, right click board card on desktop" — describes one function reached two ways, and on
mobile the board itself is reachable before its card is: long-pressing the title, Components, or
Requirements already opened `[Boards]` (`openMenuFor`'s anchor branch), so exporting the board on
screen required leaving it for the list first. That menu now reads `[Export, Boards]`. Desktop has
no matching gap — right-click already reaches the active card directly in the rail — so this is
mobile-only, gated the same way the anchor menu itself is (`!isDesktop`, B23/issue #4).

*Impermanent.* Split §10.5 into its own file once `app.js` passes ~2,200 lines or a second consumer
appears — it costs a `<script>` tag, an `ASSETS` entry, and a row in the README's Files table today,
which is why it has not been done yet. `Export` becomes a submenu with `PDF` as the leaf the moment
a second format exists. The hatch is inline ruled lines; past ~1 MB the order is a Form XObject,
then `/FlateDecode` — noting the latter makes the build async and breaks the plaintext assertions.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## G. Band and lot proportions

### B35. B32 preserved the fractions, not the proportions they were chosen for (supersedes B33's card width; overrides the four-row lot)
Two complaints, one cause. The Parking Lot ate a quarter of a phone sheet, and the title card was a
portrait stamp taller than it was wide — the exact opposite of what a title card is. Both numbers
were correct once, against the 900×1000 reference sheet, and neither was re-derived when B32 made
the mobile sheet 1:1 with the viewport. B32 restated the horizontal geometry "as the fractions
[it] always [was] — 24/900 = 2.6667 %, 216/900 = 24 %" and called that "identical geometry at 900
units and the same layout at any width." The first half is true; the second is not. `220/900` is
24.4444 % of *any* width, so on a 384-unit phone the card renders 93.9 px wide. The fraction
survived; the proportion it encoded did not.

The narrowness had already extracted a price. `styles.css` demoted the title from 24 px to 15 px —
the section headers' own size — because "at 24px the 220-wide card broke titles mid-word on a phone
sheet." That is the card losing an argument with the type it exists to hold.

**Ruling.** The card is **340/900 = 37.7778 %** (280..620 on the reference sheet), landscape at
1.5:1 rather than portrait at 0.96:1. Both side zones absorb it evenly, 308 → 248. The Parking Lot
is **166 px = 34 header + 3·44**, one row down from four: the section holds two or three questions
at most and is often unused, so the fourth row was canvas the board never got back. `#lot-items` is
`overflow:hidden`, so that height *is* the visible row budget — a fourth item still exists in the
record and still exports, it is simply not drawn.

**The band's edges are now derived, not restated.** B33 wrote the card's right edge as the literal
`62.2222 %` in three rules, and `#zone-components` reached the card's *left* edge only because
`100 − 62.2222 = 37.7778` — a dependency on the card being centred that nothing named and no test
guarded, so widening the card by hand would have desynchronised one column and not the other.
`#board` now declares `--gutter`, `--card-gap`, `--card-w`, `--card-l`; the rule, both zones, the
card and the lot read them. Desktop's five px overrides collapse to two inputs
(`--gutter: 24px; --card-w: 340px`) and every edge follows.

**The headers moved below the rule, and the card is why.** B33 pinned them above the rule hugging
the card, which worked while the card was 220 wide. It does not survive 340: the columns drop to
~101 px on a 384-unit sheet, and "Components"/"Requirements" are single words that cannot wrap.
Nor can alignment rescue them — CSS puts overflow at the line box's *end* edge whatever
`text-align` says, so a right-aligned "Requirements" still runs off the sheet rather than back onto
it. The first attempt floored `--card-w` to protect the columns instead; the arithmetic killed it,
since a floor wide enough for the widest `system-ui` (~118 px, measured) leaves a phone card of
~100 px — narrower than the one the change exists to widen.

So the card took the width and the labels took the space that was actually free: `top: calc(100% +
58px)` puts them at y=258, 6 px below the card's 252, mirroring the 6 px they used to keep above
the rule. Each is `width: max-content` pinned to its outer gutter (`left: 0` / `right: 0`), so the
box is the word and any spill runs *inward*, under the card's bottom edge, where the canvas is
empty. This also settles the inconsistency B33 left standing: the band now reads rule-then-header,
the same way `#lot-rule` / `#lot-header` always has. Two consequences: the anchor gets its whole
176 px back (the exporter's clip at the label is gone with it), and a below-rule label sits in
canvas territory where `.band-zone`'s `pointer-events: none` lets a tap fall through and create a
note under it — the same way the rule itself behaves. `test/mobile.js` pins all of it: the labels
clear the card, are not clipped, and stay inside the gutters.

*Known, not fixed.* The band's vertical geometry is fixed px (rule at 200, card 24..252) while its
horizontal geometry is a fraction of the viewport, so the card is landscape at 1.49:1 on the
reference sheet and on desktop, but 145×228 — still portrait — on a 384-unit phone. A landscape
card there needs a card wider than 176 units (46 % of the sheet, leaving 79 px columns) or the rule
moved up. Both are band-height decisions, not card-width ones.

*Not reopened.* The title's 15 px. A 340-wide card removes the constraint that forced the demotion,
but restoring 24 px is its own call about hierarchy and has not been made.

*Impermanent.* `EXPORT_GEO` in `app.js` restates all of this a second time against the 900-unit
export sheet, because the exporter cannot read computed CSS from a board it never renders. Four
values moved here that a shared constants module would have moved once.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions) B35 is superseded — ratified as historical record, per the ruling.

### B36. A shipped change reached `main` and never reached the device (supersedes B35's "known, not fixed")

B35 shipped correct CSS that nobody could see. `sw.js` carries a version-stamped cache and the
instruction, on its own line 3, to *bump on every shipped `app.js`/`styles.css` change*. The fetch
handler was unconditionally cache-first — return the hit, and only touch the network when there
isn't one — and a service worker re-installs only when **its own bytes** change. So a missed bump
was not a delayed update, it was a permanent one. B35 (`9ace6d6`) and the export follow-up
(`072a15e`) both landed without a bump: an installed app was pinned to `825a006` and would have
stayed there forever.

This is worth stating plainly because the failure was not in the code that was written, it was in
what "done" was taken to mean. The suites asserted the stylesheet was correct — it was — and the
correct stylesheet sat behind a cache nobody had invalidated. **Asserting the source is not
asserting delivery.** `test/sw-update.js` now asserts delivery: it installs the old worker, warms
its cache, changes `styles.css` *without* touching `sw.js` and requires the page to stay stale
(the bug, reproduced — if that step ever passes clean the harness has stopped exercising the
worker), then ships the bumped worker and requires the change to land within two launches.

Two changes, and only the first is load-bearing:

**The cache is `v5`.** That is the fix. Everything else is insurance.

**The fetch handler is stale-while-revalidate.** Still cache-first — a warm hit is returned without
waiting on the network, so offline behaviour and cold-start latency are exactly as before — but the
fetch now runs *alongside* the hit rather than only in its absence, and overwrites the entry. A
missed bump now costs one stale launch instead of everything after it. The bump discipline stays:
it is what makes an update land on the *next* launch rather than the one after. Cost is one
background request per asset per launch when online, which for eight small static files is not a
consideration. A caveat worth recording: an outgoing worker keeps serving the page until the new
one claims it, and its runtime-cache path can re-create the very entry `activate` just deleted, so
a dead `v4` may briefly outlive its own eviction. Nothing reads it once `v5` controls.

**And the band's vertical geometry is now a fraction of the sheet**, which is B35's *known, not
fixed* paragraph, fixed. The two axes had been treated differently for no reason anyone chose:
horizontal was a fraction of the viewport (B32/B35), vertical was flat px. So `252` of card plus
`182` of lot was `434 px` of furniture on *any* sheet — over 60 % of a short window, which is why
the card rendered portrait there and why B35's 44 px barely registered.

```
--band-h:   clamp(132px, 0.2 * var(--logical-h, 1000px), 200px);
--overhang: calc(0.26 * var(--band-h));      /* B33's 1.26 ratio, kept proportional */
```

Four literals become four derivations — `#band-rule`'s `top`, `.band-zone`'s `height`,
`#anchor-title`'s `min-height`, `.band-label`'s offset — and each reduces to today's value at the
`200px` ceiling, so the reference sheet is untouched *by construction* rather than by inspection.
Desktop is untouched for free: B20's min-anchored scale keeps `LOGICAL_H ≥ 1000`, so desktop always
hits the ceiling and `test/desktop.js` passes unchanged. `EXPORT_GEO` needs no edit for the same
reason, and `test/mobile.js` now pins it to the ceiling so the two cannot drift apart silently.

Free canvas, mobile, between the card's bottom and the lot's top:

| sheet | before B35 | after B35 | now |
|---|---|---|---|
| 384×846 (phone) | 43.5 % | 48.7 % | **53.3 %** |
| 1000×715 | 33.1 % | 39.3 % | **49.3 %** |
| 800×600 | 20.3 % | 27.7 % | **42.0 %** |

*Derived from `--logical-h`, not a percentage.* A custom property substitutes as raw tokens, so a
`%` inside `--band-h` would resolve against each **use site's** containing block — and
`.band-label` sits inside `.band-zone`, whose height is itself derived from `--band-h`. The px form
resolves identically everywhere. This is the kind of thing that would have shipped looking correct
on the one viewport anybody checked.

*Known, not fixed.* The phone card is 145×189 (0.77:1) — squarer than B35's 145×228, still not
landscape. It only turns landscape at the `132px` floor. So the floor, not the fraction, is the
number to argue about if a landscape card on a phone matters more than band height. Nobody has
made that call.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions) B36 is superseded — ratified as historical record, per the ruling.

### B37. The band is sized by the type it holds, not by the sheet (supersedes B36's band paragraph; overrides B35's three-row lot on a phone)

Issue #49, with two pictures: the app on the device, and the paper board it exists to reproduce.
Measured off both, as a percentage of sheet height —

| edge | the paper board | the app | now |
|---|---|---|---|
| title card top | 1.9 % | 3.1 % | 1.9 % |
| **band rule** | **5.2 %** | **19.9 %** | **6.5 %** |
| title card bottom | 7.8 % | 24.9 % | 11.1 % |
| headers | 5.4–7.4 % | 26.7–27.8 % | 11.9–14.6 % |
| Parking Lot rule | 79.8 % | 75.3 % | 81.3 % |

(the app column is the reporter's own 414×737 sheet, read off the screenshot in the issue.)

B36 made the band's vertical geometry a fraction of `--logical-h` so that both axes would be
fractions of the sheet. Symmetry was the wrong argument. **Across is a fraction of the sheet
because it holds the sheet's own divisions; down is set by the type.** B32 made the mobile sheet
1:1 with the viewport, so `renderScale` is 1 and the title stays 15 px however tall the sheet is —
only the box around it grew. At `0.2 × 737` that box is a rule at 147 and a card running to 185:
a quarter of a phone spent framing two lines of text, which is the whole of issue #49.

Three complaints, one cause. *"Far too large vertically"* is the 25 %. The *"giant gap at the
top"* is B33's overhang: the card ran `24 → 1.26 × --band-h`, so 123 px of it sat above the rule
and 39 below — the rule at 76 % of the way down a box it is supposed to cross. The paper board
draws the rule through the card's **midpoint**. And *"the headers no longer align with the
borders"* follows from both: `.band-label` is pinned under the card, and the card's bottom had
moved a quarter of the way down the sheet, so the headers floated ~120 px clear of the rule they
belong to.

**Ruling.** The card is its content box, and the band is the card:

```
--band-top: 14px;                                         /* card + zone top */
--card-h:   68px;      /* 2 x (15px x 1.3) + 2 x 12 padding + 2 x 2 border */
--rule-y:   calc(var(--band-top) + var(--card-h) / 2);    /* the rule crosses the middle */
```

Fixed units, identical on every sheet — desktop scales the whole sheet uniformly (B20), so a
proportion held in logical px is held on screen too. Four derivations collapse to three, and
`--overhang` is deleted: the 1.26 ratio was a way of saying "the card hangs below the rule", and a
card centred on the rule says it better. `.band-zone` becomes the card's own box, so
`.band-label`'s offset is a plain `calc(100% + 6px)`.

**Two lines, not one, and the labels follow the card past them.** A phone card is ~145 units wide;
one line is not the common case and three is not rare — the reporter's own title, "LinkedIn
Learnings To Do", takes three. `min-height` already grew the card, but the labels did not go with
it, and `.band-label` is `width: max-content` spilling *inward* by design (B35), so "Requirements"
ran under the card's frame. `applyLayout` now republishes the card's rendered height as
`--card-actual-h` and `.band-zone` reads it, the same way it republishes `--note-max-w`; the input
handler calls it again as the title is typed. `test/mobile.js` [9c] pins it, and fails without it.

**The lot's budget is whole rows.** `166 = 34 + 3·44` is 18 % of the 1000-unit reference sheet and
a quarter of a 737-unit phone — the same fraction-versus-proportion error, in the section B35
already shortened once. It cannot simply scale: rows are 44 px hit targets and `#lot-items` clips,
so a proportional height draws a row cut off at the knees. So the budget steps by whole rows —
three above 900 units, two below — chosen in `applyLayout` because CSS cannot step a length. A row
past the budget still exists, still saves and still exports; it is simply not drawn (B35). Desktop
keeps three: B20 pins `LOGICAL_H ≥ 1000`.

**The exporter drops its zone clip.** `EXPORT_GEO` follows the CSS (`ruleY: 48`, `bandTop`/
`cardTop: 14`, `cardMinH: 68`) and `bandH` is gone with the clip it fed. Against a 176-unit zone
that clip bit at nine lines and nobody met it; against 68 it would bite at three, silently cutting
anchor text the board still shows. The screen sets no `overflow` there, so neither does the export
(B34). The exported label now hangs off the *measured* card height for the same reason the screen's
does.

**And `test/mobile.js` [11c] reads the board instead of a copy of the stylesheet.** B36's version
resolved a hand-copied clamp string in a throwaway probe, so it could only ever catch `EXPORT_GEO`
drifting from that copy — never from the CSS. It now measures the live `#band-rule`, `#anchor-title`
and `.band-label` and requires `EXPORT_GEO` to agree.

Free canvas, mobile, between the card's bottom and the lot's top — the same measure B36's table uses:

| sheet | after B35 | after B36 | now |
|---|---|---|---|
| 414×737 (the phone in #49) | — | 50.1 % | **70.1 %** |
| 384×846 | 48.7 % | 53.3 % | **74.0 %** |
| 1000×715 | 39.3 % | 49.3 % | **69.2 %** |
| 800×600 | — | — | **63.3 %** |

*Settled, at last.* B35's *known, not fixed* asked for "a card wider than 176 units **or the rule
moved up**", and B36 took neither — it scaled the rule instead, which is what put it at 147 on a
phone. This moves it up. The phone card is 145×68, landscape at 2.1:1.

*Not reopened.* The title's 15 px, and `--card-w`'s 37.7778 %. The complaint was vertical and the
horizontal geometry is doing its job.

*Impermanent, still.* `EXPORT_GEO` remains a second copy of this geometry. [11c] now pins it to the
rendered board rather than to a literal, which is as close to one source as two files get without
a shared module.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B38. The band reads rule → header → content, and the card is a compartment (issues #51, #52)

Two complaints, one cause each, both in the top band. **#52 — the title card's frame.**
`#anchor-title` drew a 4-sided 2px border at `top: 14px`: a second top edge 14 px below the sheet's
own, orphaning a strip of paper between them. **#51 — the section headers.** The band read
content → rule → header: the anchor text sat at `y=14..82`, *above* the rule at `y=48`, and the
label at `y=88`, below it — the exact inverse of `#lot-rule` / `#lot-header` / `#lot-items`, which
has read rule → header → content since day one. B35 claimed to have fixed this — "the band now
reads rule-then-header, the same way `#lot-rule` / `#lot-header` always has" — and delivered half
of it: it moved the label below the card and left the anchor exactly where it always was, above
the rule. The order stayed inverted, and that inversion is both of #51's symptoms. The three
screenshots on the two issues, unread when PR #62 proposed this plan (the environment's proxy
blocked `user-attachments`), were fetched and read this session before implementing: the visible
gap between the rule and the header labels, and a reference photo of a physical note card with no
top edge and its side lines run past where the text starts, both confirm the plan's reading. No
contradiction — the pictures agree with the text.

**Ruling: the card is a compartment, and the band adopts the lot's own grammar.**

```
compartment top:     14 -> 0    (the sheet's own edge is the fourth side)
band rule:            48 -> 48   (unchanged)
compartment bottom:   82 -> 82   (unchanged)
header label top:     88 -> 56   (= rule + 8, #lot-header's own offset)
header label size:  15px -> 12px
anchor text top:      14 -> 82   (= rule + 34, #lot-items' own offset)
```

`#anchor-title` draws three sides, not four (`border-top: 0`), starting at the sheet's own top
edge; its top padding absorbs `--band-top` plus the 2px border no longer drawn, so the type lands
on the same pixel it always did (content box 28..68, centred on the rule at 48). Consequence worth
naming: the compartment's shoulders — the strip that used to be orphaned paper above the frame —
are now part of the title's hit area, so a tap there focuses the title instead of dropping a note
behind the frame: a misfire nobody had filed, fixed by the same geometry that fixes #52. The tapped
state (`#anchor-title.tapped`) sets `border-width: 0 3px 3px` rather than a flat `3px`, so pressing
the compartment does not resurrect the top border this ruling just removed — no test catches that
one; it only shows up during the 400 ms action window.

`.band-zone` moves from being the card's own box to being the rule's: `top: var(--rule-y); height:
0`, its children absolutely positioned off that edge rather than the zone measuring anything.
`.band-label` is `top: 8px` and `.band-zone .anchor` is `top: 34px` — `#lot-header` and
`#lot-items`'s own offsets, read literally rather than approximated. Mirrored alignment (`left: 0`
/ `right: 0`) is untouched, per the owner's ruling that it was already correct.

**The header shrinks to fit its column; the label is nomenclature, not a size claim.** The owner's
words, verbatim: *"Header is nomenclature of function, not definitive of size requirements. Reduce
the font size of requirements and components so they fit within their quadrant, on either side of
the title box, anchored horizontally to the border line of their quadrants."* 12 px is not a taste
— it is the largest whole pixel size that clears `--card-w`'s existing 100 px floor: B35 measured
the widest system-ui "Requirements" at ~118 px at 15 px/600, which scales to 94.4 px at 12 px
(5.6 % slack) and 102.3 px at 13 px (fails). Consequence: the 100 px floor is now load-bearing in a
second way, and the two — floor and label size — must move together if either changes again.

**`--card-actual-h` and `syncCardHeight()` are deleted.** B37 added them for one job: republishing
the card's rendered height so `.band-zone`'s labels would grow with a wrapped title. The labels no
longer hang off the card, so there is nothing left to synchronise — a CSS var, a JS function and a
per-keystroke `offsetHeight` read removed because the geometry got simpler, not because it stopped
mattering.

**The exporter draws the same three sides.** `frameOpenTop` fills a plain rect, then strokes a
single path — down the left, across the bottom, back up the right — inset by half the border width
on the three drawn sides only, the same half-width correction `frame` already makes for a CSS
border drawn inside its box. The compartment's 2 px corner radius is dropped in the export: at the
page's 0.581 A4 scale it is ~1 pt, and a three-segment path is more honest about which sides exist
than rounding a corner that is not drawn. `EXPORT_GEO`'s `cardTop`/`cardMinH`/`cardPadTop` restate
the compartment and `zoneHeaderY`/`zoneItemsY` restate the band's new offsets — [11c] measures the
live board and requires all of them to agree.

**`sw.js` is `v7`.** Non-optional, per B36: a correct stylesheet that never reaches an installed
device is not a fix.

*Known, not fixed.* `#lot-header` stays at 15 px, so the board now names its sections at two
different sizes. The lot header has the full sheet width and is under no pressure to shrink;
unifying the two sizes is a hierarchy call nobody has made.

*Impermanent, still.* `EXPORT_GEO` remains a second copy of this geometry. [11c] pins it to the
rendered board rather than to a literal, which is as close to one source as two files get without
a shared module.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## H. Note width (issue #53)

### B39. A note wraps at the sheet's right edge, not at a predetermined width (resolves B40's cap residue)

The bug report: neither desktop nor mobile text frames should have predefined widths — the
max width is the width of the entire board, and only a line that would exceed the board's
right edge wraps. The cap in force was a number: 405 on desktop, 45% of the sheet on mobile
(`noteMaxW()`, published once per layout on `#board`). Both were readings of PRD §6.2's "45%
of board width" against frames that no longer exist for every note — the cap was frame-blind,
which is B40's *known, not fixed* paragraph.

**Ruling.** A note's max-width is the remaining distance to the sheet's right edge, in the
note's own unscaled units, floored so an edge-adjacent note stays a usable column:

```
noteMaxW(note) = max(NOTE_MIN_W, (LOGICAL_W − renderX(note)) / effScale(note))
NOTE_MIN_W = 60          /* ~3 chars at 17px + 28px of padding and border */
```

which reduces to `(rw − x)/scale` in authored units — **frame-invariant**: the same note
wraps at the same point on every device, and a grab's rebase (B21/B40) cannot rewrap it,
because the fold leaves that ratio unchanged. The var moves from `#board` to each `.note`
(custom properties inherit; `.note-text` reads it as before, fallback `none`), set by
`applyNoteWidth` in `makeNoteEl`, in `applyLayout`'s per-note loop (before `setHitInset`,
which measures the offsetWidth the cap changes), in `applyNoteScale` (scale changes the
unscaled cap), and live in `updateDrag`.

**The cap is live during a drag.** Dragging a note rightward tightens its cap and the text
rewraps narrower as it goes; the smaller footprint frees more x, and the loop converges in a
single pass per move — an overhanging rewrapped foot means the cap was floored, and pulling
x back to the edge leaves the applied cap exact — at worst at `x = LOGICAL_W −
NOTE_MIN_W·scale`. The rewrap changes the *height* too, so the drag's bottom bound is live
as well (`settleDragFoot`): derived per move from the measured foot, plus the overhang the
grab itself admitted — B40's oversized cross-frame arrival never teleports, and only
overhang the drag's own rewrap creates is pulled back onto the sheet. The per-move measure
is reflow-guarded: the width write and `offsetWidth` read are skipped while the cap provably
cannot bind (the note at natural width, the cap at or above it), and the drop forces one
exact settle before `saveNow`. Legal under B17/B21: the re-clamp runs inside the gesture,
which owns its writes; outside a gesture stored x/y are untouched, and a note that used to
wrap at 405/45% simply rewraps wider and flatter where it stands — intended, shipped.

**The export mirrors the law, mandatorily.** `exportNoteBox` wraps at `max(NOTE_MIN_W,
(EXPORT_W − exportX)/((scale ‖ 1)·exportMult))` — the same `(rw − x)/scale`, resolved
against the 900 frame — replacing B40's authoring-frame cap (`min(405, 0.45·rw)`), and
`EXPORT_GEO.noteMaxW` is gone. Screen wrap width ≡ export wrap width in authored units,
which resolves B40's known-not-fixed cap paragraph outright: no double-shrink on a
narrowing phone, and a cap-hitting cross-frame note can no longer disagree between the
desktop screen and the PDF. `test/desktop.js` [D17] and `test/mobile.js` [18] pin the
equality; [D8] and mobile [11] now assert edge-wrap where they asserted the numbers.

**Costs.** A note created at the right edge is born a NOTE_MIN_W column — the floor is the
price of never refusing capture there. A note's wrap width now depends on where it sits, so
dragging changes its shape; that is the feature. And the one-column collapse the 45% cap
existed to prevent (B32) is now the author's own choice to make — a note only spans the
sheet if its text is long and its x is 0.

*Known, not fixed.* The law binds x. Vertically, typing can still grow a note past the
sheet's bottom (the input path has never clamped position, and B17 wants it that way), and
a cross-frame arrival keeps whatever bottom overhang it arrived with — only a drag's own
rewrap is pulled back. `NOTE_MIN_W` is a felt value — re-interrogate it on the device, like
B18's 400ms.

Supersedes PRD §6.2's 45% cap as read by B32 ("--note-max-w set in applyLayout" — the
per-note var is the pattern now) and B40's exportNoteBox cap; B40 is annotated in place.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## I. Homothetic note rendering (issue #57)

### B40. Notes render homothetically: position's law applied to size (extends B21/B32)

The bug: resizing a desktop window slid constant-size notes into each other, and the PDF —
a fixed 900×1000 frame — showed the same collisions. B21 maps `x` proportionally
(`renderX = x · LOGICAL_W/rw`) and B32 gave `y` the mirror law against `rh`, but a note's
*visual* size stayed constant in logical px, so positions tracked the frame while sizes did
not, and relative geometry was not preserved across viewport changes.

**Ruling.** The law the position already obeys is applied to the scale: `noteMult =
LOGICAL_W / (rw ‖ 900)` — renderX's own ratio — and a note draws at `effScale = scale ·
noteMult`. Along x, position ×k and width ×k together preserve horizontal overlap *exactly*
for any change of sheet width: the viewport resizes and the notes resize at the same ratio,
which is issue #57's instruction verbatim. Desktop's geometry (B20) has two regimes and both
cooperate: width-limited windows pin `LOGICAL_W ≡ 900` (the multiplier never moves), and
height-limited windows pin `LOGICAL_H ≡ 1000` so *only* width varies — the reported case,
where preservation is exact.

At grab, `rebaseNote` folds the multiplier into the stored scale (`scale *= mult`, alongside
the existing `x`/`y`/`rw`/`rh` rebase). Visually silent by construction — `effScale` before
equals `scale` after — and mult ≡ 1 from then on, so every gesture (drag footprints, pinch,
frame-drag resize) runs in current-frame units unmodified. A folded scale may legitimately
leave [0.5, 2.0], so the pinch/resize clamps widen to include the start value
(`gestureScale`: `clamp(start·f, min(MIN_SCALE, start), max(MAX_SCALE, start))`, one helper
shared by both per B22): an out-of-range note never jumps at gesture start, and can always be
scaled back into the authored range but never further out. The footprint clamps get the same
treatment, because a folded note can be bigger than the sheet and the old
`[0, max(0, sheet − foot)]` range then degenerates to `[0, 0]` — a corner pin. The drag range
is fixed at grab and widened to admit the grab position (silence again), and
`applyNoteScale`'s re-clamp becomes `min`/`max` of the same pair — sheet-inside-note where
note-inside-sheet is impossible; for any fitting note both are byte-for-byte the old bounds.
The multiplier itself is never clamped — MIN/MAX_SCALE bound the *authored* scale at gesture
time, not the frame mapping. The export applies the same law against its own sheet
(`exportMult = EXPORT_W / (rw ‖ 900)`), which is the downstream fix: screen and PDF now share
one law, where before the PDF drew every note at authored size regardless of the frame it was
written in. `exportNoteBox` wraps at the *authoring* frame's width cap
(`min(405, 0.45·rw)` — 45% of a mobile sheet, the literal 405 on desktop, selected without a
mode flag because B20 pins desktop `rw ≥ 900`): wrapped at the literal 405, a phone-authored
note would re-wrap wide and, under `exportMult`, run off the export sheet. `effScale` and the
fold guard a missing legacy `scale` with `‖ 1`, as the exporter always has — a drag must not
write `NaN` into storage.

Costs. A note authored on a wide desktop frame arrives small on a phone (and a phone note
large on desktop) — that is the point, but cross-device notes no longer land at "their" size;
the decoupled hit floor (B7) is what keeps a shrunken note tappable. Stored `scale` is no
longer confined to [0.5, 2.0] after a cross-frame grab; every read site outside the widened
clamps was checked and none assumes the range.

*Known, not fixed.* Size rides the x-ratio while y rides the height ratio (B32), so when the
two diverge — an aspect-ratio change — vertical clearances can still shift: a note may close
on or open from the one below it even though horizontal geometry holds. Accepted: mapping y
by the x-ratio instead would push notes off the bottom of a shorter sheet and demand exactly
the re-clamps B17/B21 forbid. And the *screen's* width cap is still frame-blind — a note
holding `--note-max-w` loses width twice on a narrowing phone (once as the cap tightens, once
from the multiplier), and a phone note re-wraps at desktop's 405 and can overhang the sheet
there, which is why the footprint clamps above had to learn the oversized case. The cap is a
later unit's subject and is untouched here; until it lands, a cap-hitting cross-frame note is
the one place the desktop screen and the PDF still disagree — the PDF draws the authored
proportions.

*[The width-cap clauses above are resolved by B39 (issue #53): the cap is now per-note and
frame-invariant — `(rw − x)/scale` — and the export shares it. The y/aspect clause stands.]*

B21's grab-time rebase (`x = renderX; rw = LOGICAL_W`) now folds scale as well; B22's
"frame-drag resize shares pinch's scale/clamp/hit math" still holds — the two clamps widened
together.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## J. Desktop dismissal and multi-selection (issues #54, #55)

### B41. Click-away while editing commits and dismisses, never creates; shift-click herds notes

**#54.** The desktop `canvas`/`lot` tap guarded on `selected` alone, but while EDITING nothing
is selected (edit paths clear selection first) and the recognizer's `isEditing` early-out tests
the *clicked* target, not the active editor — so a click on bare paper mid-edit sailed past the
guard, `preventDefault` had already suppressed the native blur (B27), and the tap fell into the
ghost + `createNote` path: dismissal and creation on the same click. Ruling: a mode-independent
`isEditing(document.activeElement) → blur` guard sits ABOVE the `selected` check in both
creation-surface cases — the blur runs the commit-on-blur path, the click is spent on
dismissing, and the NEXT click creates (ghost + B18 window), which is desktop parity with #41's
mobile rule. The desktop `note`/`lot-item` branches commit an open editor the same way before
selecting; on the edited note's own hit collar the click only dismisses, because edit and
selection are mutually exclusive (B22).

**#55.** Desktop notes gain shift-click multi-selection; **lot rows stay single-select by
design** — a lot line is a list entry, not a spatial object worth herding. `selected` remains
the sole PRIMARY, so every existing `selected &&` guard is untouched; a module-level `multiSel`
set holds member ids and is empty (today's behavior, bit-for-bit) or size ≥ 2 and containing
the primary. The primary wears the one `#selection` overlay; every other member wears
`.multi-selected`, a CSS outline that rides the node itself — zero JS positioning. With two or
more selected the overlay hides its edges and handles: **resize is single-selection only**.
Shift-click toggles membership (adding makes the clicked note primary; removing the primary
promotes another member; the last removal clears) and never pairs into the double-click window;
a plain click collapses to single. Group drag: grabbing a member moves every member by one
delta — per-member `rebaseNote` at grab (B21's licensed write, folding each member's scale per
B40), per-member bounds widened to admit the grab position, `.pressed` on all, `surfaceNote`
only on the grabbed one, one `saveNow` at drop. Members hitting different clamps can compress
the group's relative geometry at the sheet edge — accepted; the alternative is a group that can
never park flush. Right-click (the recognizer now ignores non-primary buttons outright) opens
the selection's own menu via the delegated board `contextmenu` listener: Complete all — Restore
all only when EVERY member is complete — then the hairline, then Delete all in `--danger`
(UIUX §7); singular labels at size 1; empty canvas and active editors keep the browser's native
menu. The sel-actions row acts on the whole selection: Complete/Restore keyed off the primary
applied to all, Copy joins every text primary-first with newlines, Delete routes through the
new `deleteNotes` — one B18 window, one save, ONE Undo that re-inserts every note at its
original index and restores DOM order. `clearSelection` strips rings and set together, so
`applyMode`'s teardown and `renderBoard`'s rebuild stay one call; note-removal paths drop ids
from the set, and a set of one collapses back to a plain single selection.
`test/desktop.js` [D18] pins the dismiss-then-create sequence; [D19] pins rings, hidden
handles, the shared drag delta, the menu shape, and the batch Undo round-trip.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## K. The desktop rail's categories (issue #58)

### B42. The rail sorts into To-Do / Idea / Unsorted, and each section pages (supersedes B24's overflow ellipsis)
The desktop rail splits into three equal sections — To-Do Boards, Idea Boards, Unsorted
Boards, top to bottom. A board carries `category` and `catStamp`, both read-site
defaulted (the B21 idiom — no migration, no DB version bump): a record without a
category *is* Unsorted, so every pre-#58 board and every new board lands there by
writing nothing. In-category order is `(catStamp ‖ createdAt)` desc with B24's
immutable comparator as tiebreak. A pointer-drag moves a card between sections —
pointer-based like the list rows, because native HTML5 DnD fights the cards' button
semantics and paints its own ghost — and the section under the cursor frames itself in
`--accent-page`: where the board will land. Release writes `category` +
`catStamp = Date.now()`, which *is* moved-to-top by the sort key. The drop is a
completed gesture like a note drag: saved immediately, no B18 window. Whole-record
puts (B13) make the write site two-headed — the open board mutates `current` +
`saveNow()` (putting any snapshot would lose live edits); any other board is fetched
fresh and put directly (the debounced persist can't clobber a record it never holds).
Overflow **pages** instead of scrolling: each section clips to a per-page card budget
measured from the rail's height (re-derived on resize), and «‹›» pager buttons —
muted blue `--accent-page` paired with `--paper`, the sel-btn construction so both
themes invert ≥ AA, behind a neutral `--ink-shadow` border — turn pages instantly,
like all navigation (B22: B18 governs consequences, and a page turn commits nothing).
Page state is per-category, clamped every render, reset to the first page on a drop
into the section; a single page hides its pager and indicator (§10: no state, no
statement). B24's "when boards overflow the rail, the bottom edge says so"
(`#pane-more`'s ellipsis) is **superseded** — pagination states the same truth and
makes it actionable.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## L. The menus: All boards, and Copy (issues #59, #60)

### B43. Every menu says "All boards", and every item offers Copy (issues #59, #60; supersedes A1's item order)

**"Boards" → "All boards".** The menu item is a destination, and beside Complete and Delete the
bare word read as a category label for the things on the board (issue #60). The rename is the one
`COPY.boards` key, so every menu site changes together — the item menu and the anchor's
Export · All boards. The `#list-title` page heading still says "Boards": it is not a menu, it
names the page you are standing on, and that is the one place the old word was right.

**Copy is an action on the record, not the DOM.** `copyText()` writes the item's `.text` field —
plain text by construction, the data model has never held anything else (B3) — through
`navigator.clipboard.writeText`, falling back to a throwaway textarea + `execCommand('copy')`
where the async API is missing or rejects. The textarea must opt back into `user-select: text`
(the body forbids selection, so `select()` would otherwise grab nothing), sits off-viewport, and
is removed in `finally`. Success shows a short "Copied" notice; failure shows "Couldn't copy." for
longer, because the notice is the only evidence anything went wrong — and `showNotice` already
refuses to clobber a pending undo. Copying a completed item is allowed: the scratch-out withholds
the text from the screen and the export (§4.3), but the record still holds it, and Copy reads the
record.

**The item menu reorders: All boards · Complete/Restore · Copy · Delete.** A1 led with Complete on
the reading that the likeliest action goes first. With four items the menu now reads navigation
first, then the item's own actions in rising severity — change state, read out, destroy. That
supersedes A1's Complete-first placement; UIUX §7's actual law — destructive last, in `--danger`,
behind the hairline — holds unchanged, and `test/mobile.js` [8] pins the new order. The anchor
menu stays Export · All boards: two non-destructive items, no separator, same as everywhere else.

**Desktop selection shows Complete · Copy · Delete.** The new `.sel-copy` rests in plain ink — the
accent fills mark state changes, and Copy changes nothing — and drains on tap like its siblings.
It runs through `delayAction` like every action (B18 uniform): a clipboard write has no visible
result of its own, so the drain is the acknowledgment. Lot rows carry the same inline button, and
all of it routes through the recognizer, not native `click` — setPointerCapture retargets clicks,
the constraint B22 already records. `.sel-actions` centres its flex row under the note, so the
third button arrives centred and equally spaced for free; `test/desktop.js` [D15] pins the order,
the empty B18 window, and the clipboard round-trip.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## M. The board list's categories (issue #74)

### B44. The list view is the rail's twin: same categories, same paging, and the scroll it gave up buys the drag (extends B42 to mobile; supersedes B24's flat list)
Issue #58 sorted the desktop rail into To-Do / Idea / Unsorted with a pointer-drag between
sections and per-category pagination (B42). Mobile kept the pre-#58 screen — one flat,
scrolling list ordered by `createdAt` — so the same records told two different stories
depending on which device you picked up. Categorization is a property of the board, not of
the surface reading it; issue #74 makes the list say what the rail says.

**One law, two skins.** Everything B42 ruled is now surface-neutral and lives beside
`boardOrder` in §11, not inside the rail's §11.5: `BOARD_CATS`, `CAT_COPY`, `catOf`,
`catOrder`, the `catPage`/`catCap` pagination state, `catPageCap`, `makeCatSection`,
`goCatPage`, `makePagerBtn`, `dropBoardCard`. `renderPane` and `renderList` are now the same
function with a different card-maker, and both emit the identical section — head, cards,
pager — so what differs between phone and rail is CSS and nothing else. That is the same
stance the app already took on the recognizer: one code path, `isDesktop` branching inline.
The read-site default holds unchanged (B21's idiom): a record with no `category` **is**
Unsorted, so nothing was migrated and no DB version moved. `catPage` is shared by both
surfaces rather than duplicated, because they are never on screen together — `applyMode`
pops the list state on the flip to desktop — and each render clamps, so a differing
per-page budget heals itself instead of stranding a reader past the end.

**The list stops scrolling, and that is what pays for the drag.** B42's "overflow pages,
never scrolls" arrives on mobile as the removal of the one thing that made a drag ambiguous
there. With `#list-view` at `touch-action: none` (the board's own stance, B12) there is no
vertical pan for a press-and-move to be confused with, so the drag needs no long-press to
arm it: movement past `MOVE_THRESHOLD` is the whole discriminator, exactly as on the rail
and on the board itself. The press therefore has three readings and they do not overlap —
**move** drags the card to a category, **hold** opens the board's Export · Delete menu
(B43/A1 untouched, and movement cancels the timer per B29), **release** opens the board
through B18's window. Drag start vibrates like the hold does: both are the moment the
gesture changed meaning. The drop itself is a completed gesture like `endDrag` — written
immediately, no B18 window — and releasing over the section the card already lives in is a
change of mind, not a move: no write, no reorder, no page reset.

**Three equal sections, and the furniture pays for the boards.** The rail spends 56px per
section on furniture (a 24px head above the cards, a 32px pager below). On a 384×846 phone
that leaves two cards per page. Mobile therefore merges the head and the pager onto one
48px strip — the same three DOM children, laid out by a grid instead of a column — and gets
three. The pager's buttons meet the 44px touch floor rather than the rail's B23 24px, and
share their borders in the seam `.pane-del` already uses: four separate squares at that size
crowd "Unsorted Boards" off its own strip, and one segmented control reads as one control.
The `n/m` indicator moved from beside the label to between `‹` and `›` on **both** surfaces:
it states which page the arrows are on, so it travels with them, and §10's "one page says
nothing" then falls out of the pager's own `hidden` instead of a second guard that has to
agree with it.

**Consequences taken deliberately.** Three sections are always drawn, so a phone holding one
board shows two empty thirds — a category you cannot see is a category you cannot drop into,
and the drop targets are the feature. The capacity check in `applyLayout` grew a mobile arm,
so a rotation re-paginates; `showList` now reveals the view *before* rendering, because
`catPageCap` measures `#list-rows` and a `hidden` element measures zero; and `deleteBoard`
re-renders the list after the row's `leave`, because a paged section must pull the next board
up where the flat list could simply close the gap. `test/mobile.js` [19] pins the header
order, the untouched-storage default, the touch-drag (landing frame, ghost, the write, and
that it neither opened nor switched a board), all three readings of the press, the pager,
the 44px floor, and the two assertions the whole ruling rests on — neither the category nor
the screen may scroll.

**Not ruled here.** Dismissing an open menu is inert only where the press lands on `#board`
(B30's `swallowTap`), so a dismiss onto a board card still opens that board. That predates
categories — the flat list behaved the same way — and is left as it is rather than widened
inside this issue.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## N. The v2 design system (PRs #76–#81; proof sheets 1–7)

### B45. v2 is the design system, and the specification is sized to the change (supersedes the draft that retired this file)

**A specification describes what is changing, not what already runs.** The first v2 draft ran to
1,707 lines of `PRD.md`: 87 numbered requirements, of which 64 restated behaviour that already
ships and is already recorded here, in this file, with the reasoning intact. A second copy with
nothing keeping it honest is the same defect as the five unsynchronised colour sync points it
correctly identifies — a value restated in places that cannot see each other — and the copy was
twenty times the size. It also carried sections that existed only because the scaffold had them:
an API contract that says "N/A", a dependency list that says "None", a tech stack that says
"None", a project structure for five files, and a commands section duplicating `CLAUDE.md`, which
is the file a session loads automatically. `PRD.md` is now §1–§8 and one appendix: the taste
layer, scope, the data model, the constraints, eighteen design-system requirements, how they are
verified, the risks, and the citation table. Everything cut is either in this file, in `UIUX.md`,
or in `CLAUDE.md` already.

**This file stays the decision record.** The draft retired it — "for v2, decisions live in
`PRD.md` and `UIUX.md`, not in a `B44+` here" — on the reasoning that two records can disagree.
The reasoning is sound and the conclusion is backwards: a specification says what must be true,
a decision log says what was tried and rejected, and it is the second that stops a future session
re-proposing an approach that has already regressed the band four times. B44 was ruled and merged
to `main` eleven minutes before that sentence was written, which is the practical answer to
whether the record had stopped being needed. New rulings continue here, citing `UIUX §x` where
the rendering detail lives rather than restating it.

**Three things are separated out of this release, and none is abandoned.** The fold/rotate
arrangement bug (issues #65, #75) is the highest-value change outstanding and has nothing to do
with colour; it needs its own ruling because the similarity transform supersedes B40 and B21, and
gating it behind a palette serves neither. PDF font embedding is ~150KB per exported file in the
most intricate code in the app, bought for typographic consistency on a printed sheet. Mobile
board categories were specified as v2 scope after B44 had already shipped them. What remains is
one coherent change: the app gets an identity, and nothing it does changes.

**The design work itself is kept whole**, because it is the release. `UIUX.md` §2's ladder, the
per-surface ink rebinding, the edge rule and its twelve adjacencies, and the two-tone focus ring
were recomputed independently and every published ratio reproduces. They also caught three real
defects in the draft that preceded them — a rule at 1.64:1 on the surface it crosses, a border at
1.00:1 on its own ground, and two accents tabulated below AA as text without being flagged. That
is the work; the rest was scaffolding around it. One arithmetic slip is corrected in passing:
`UIUX §13.3` said eight of ten marks fall back to a platform font. Four of the ten are guillemets
and plausibly in a Latin subset; six fall back.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B46. The surfaces take the scene: seven proof rounds land deep dusk (supersedes B16's poles and the flat sheet; B18's letter bends, its job does not)

The palette was not argued into place; it was rendered into place. Seven proof-sheet
rounds ran outside the repo — full-board specimens against the live geometry — and the
final one is committed at `proofs/proof-7-a-well-swapped.html`, carrying its own
verification table. Round 1's teal ladder, which PRs #76–#80 spent a day documenting
against each other, was "wrong in almost every value" by round 7. The settled system is
`UIUX §2.2`: **the band `#020812` is the deepest surface on the page** — sheet 7's one
change was exchanging the band's and card's fills, so the furniture recedes below the
title it frames and the card separates by its border alone — the sheet is a three-stop
water field with an edge falloff and dither (`UIUX §2.8`), the Parking Lot is warm sand
with weather (`UIUX §2.9`), and the note is `#a0d4da` behind its 2px ink frame.

Two claims died on the way and are reworded rather than defended. *"The note is the
brightest surface in the app"* is false against the sand; the claim is now scoped to
where it is true — brightest **on the water** (`PRD §1.4`, `UIUX §2.2`). *"One warm
hue"* gains a word: one warm **accent** — sand is ground, not signal (`UIUX §2.6`).

B18's grammar keeps its job with one word of its letter bent: acknowledgment is still
thickening for content and fill for controls, and completion is still texture. The
resting note now carries a fill, which B18(b) read as forbidden — but what that ruling
was protecting was the 400ms window's honesty: a fill *as acknowledgment* would be
indistinguishable from the completion mark. A resting fill is neither a state change
nor a mark, the pressed state still thickens (2px → 3px), and the scratch-out is still
ink texture at ≥90% coverage. Nothing in the window lies.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B47. The band is a section above its rule, and both ends of the sheet close the same way (supersedes B35/B38's gutter-inset rule and B37's fixed budget; keeps B37's law and B38's compartment)

Reading down: **content, then its header sitting on the rule, then the rule as the
band's bottom edge** — which makes the band the exact mirror of the Parking Lot: one
section closing each end of the sheet, free canvas between (`UIUX §3.1`). Both rules
run the full width. The band sizes to its tallest zone from a two-line floor — 87px at
the floor, 106px at three lines — the same law the lot has always used for its rows;
the lot itself goes full-bleed with its content on the gutter and keeps B37's
viewport-derived budget as a **ceiling** only (`UIUX §3.2`).

B37's deeper law — *across is a fraction of the sheet; down is set by the type* —
survives intact and is what makes the sizing work. What dies is the fixed
`--rule-y: 48` and the gutter-inset rule. B38's compartment is untouched: it overhangs
the band by 22px, occludes the rule, and draws three sides with the sheet's own top
edge as the fourth. `EXPORT_GEO` and the geometry assertions in `test/mobile.js` /
`test/desktop.js` move **with this ruling when it ships, not before** (`UIUX §16.3`).

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B48. The light theme is retired, not made optional (supersedes B16; halves B11; hardens B34's export palette)

Dark-only, because `PRD §1.2`'s P4 forbids the question a theme asks. The whole light
`:root` and the `prefers-color-scheme: dark` block are **removed, not overridden**
(`UIUX §2.1`). B11 splits down the middle: its orientation half stands; its colour half
collapses — the two per-scheme `theme-color` metas become one value, and
`manifest.json`'s pair follows. B34's *"paper edge to edge, always light"* already
ruled that the export ignores the screen; with one dark theme that hardens from a
preference into a necessity — `PDF_PAPER` / `PDF_INK` / `PDF_SHADE` stop being
derivable from `:root` and become the export's own named palette (`UIUX §15`). The
`icons/` motif regenerates from the new poles, as B16 regenerated it under B1.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B49. The note takes its colour, and the radius moves to 3 (extends B39/B40's homothetic reading; the ring re-derives to 4)

The note rests as `--note` behind its 2px ink frame at radius **3px**. The
counterargument is recorded because it was good: an earlier draft held the radius at 2
on the ground that the radius set is three steps — 2 drawn, 3 the selection ring, 8
elevated transient — and the ring is 3 *because* it sits 1px outside a 2px note. The
rendered proofs overruled it: at 3px the note still reads as drawn at every scale it
can take (`NOTE_MIN_W = 60` under the uniform scale keeps it near-square — the B39/B40
constraint), and the ring re-derives to 4 by the same 1px-outside law.
`EXPORT_GEO.radius` mirrors the move by hand (`UIUX §16`).

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B50. One typeface, self-hosted; the marks are drawn, not typed

**Montserrat Alternates**, 400/600/800, Latin-subset woff2 — committed in `fonts/`
(extracted from proof sheet 7's embedded faces), declared and cached only when the
system ships (`UIUX §13.1`). The re-measurement B37 makes mandatory — the band is sized
by the type it holds — is discharged in `UIUX §13.2`: every figure clears, and the
measurement surfaces one question this ruling deliberately leaves open: on the new face
13px, not 12px, is the largest whole pixel at which the widest label fits the 100px
column, so B38's own rule returns a different answer than the stylesheet. Decide it;
don't inherit it.

The ten menu glyphs are **retired as type and redrawn as inline SVG** in the note's own
stroke weight and corner radius (`UIUX §13.3`). Six of the ten fall back to platform
fonts under any Latin face — the objection `app.js` already applies to `🗑` alone,
multiplied by six. A symbol asked to render identically everywhere in one voice is not
text; type is the wrong medium for that job.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B51. Three records, one home per value (supersedes B45's document-shape clause)

B45 sized the specification to the change, and half of that ruling stands: restating
shipped behaviour as numbered requirements was the defect that sank the 1,707-line
draft. But its shape clause — *"`PRD.md` is now §1–§8 and one appendix"* — is
superseded, because the cut also destroyed the verified §1–§8 product reconstruction
that ~20 `PRD §x` citations in the code and in this file resolve against. The
consolidated shape: **`PRD.md`** restores the reconstruction and holds positions only
(`PRD §9`; the boundary in `PRD §10`); **`UIUX.md`** holds every enumerable value,
once; **this file** stays the record. A value with two homes has no home — the v2
attempt proved it by desynchronising `PRD.md` and `UIUX.md` inside a single PR. The
four overlapping v2 PRs collapse into one, and the proof sheets gain a committed
reference (`proofs/`) so the next session reads the render rather than
re-deriving the design from rival documents.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B52. The room joins the water: chrome takes the band's value, and the accents re-derive into the settled families (supersedes the round-1 chrome and accent values; discharges `UIUX §16.1`'s "largest open gap")

`--chrome` — the ground under the menu, the toast, the board list and the
desktop rail — and the three accents were the last round-1 teal survivors,
tuned against a palette that no longer exists. Round 8 re-derived them the way
rounds 1–7 settled everything else: by rendering, against every floor in
`UIUX §2.3.1`–`§2.3.2`, `§2.5` and `§2.6`, each ratio printed against the worst
extreme of its range.

**Chrome proposes no new hex.** A third hue family needs a third job chrome
does not have (`UIUX §2.2.1`, rule 2), and a new *rung* lost before rendering:
chrome touches neither the band nor the card — the menu and the toast float on
elevation, the list replaces the page, the rail sits beside it — so an eighth
value would be a rung with no adjacency to earn it, a pixel that cannot name
its job (`UIUX §1`). Of the two recessed values that exist, the card's
`#08152c` was rendered and rejected: legal, but every separation lands at
exactly 3.01 — the floor with nothing to spare, on a full-height seam — and
the menu stops reading as summoned, reading instead as the compartment,
detached. **The band's `#020812` wins**: the room behind the page is the sky,
every surface on the page stays lifted above it, and the margins are real —
seam 3.32, rail card 3.32, hairline 3.52 (`UIUX §2.2`, `§2.6`). `UIUX §2.5`'s
0.40 hairline alpha survives unchanged, and `§2.7`'s ring gains the chrome row
its table never had.

**The accents move into families the scene kept.** Round 1's `#B7E3E1` and
`#6E9C9A` were hue 177° — the retired teal's kin, relatives of nothing left on
the page. `--accent-restore #b6dee2` is the note's own hue and saturation
lifted 74 → 80, the derivation `--frame` used on the band: what restores is
kin to what returns. `--accent-page #6d9cb0` is the field's hue at the old
value's depth: the accent about boards, cut from the board's own water.
`--danger` was re-derived and the derivation did not move it — every floor
clears with room, hue 14° keeps its distance from the sand it is never
adjacent to, and it stays the only saturated warm — so `#E2A08C` holds,
**re-chosen rather than inherited**.

The counterargument is recorded because it was good: the note's exact
`#a0d4da` as the restore accent — the undo toast offering literally the note
back. Rejected on `UIUX §1`: a Complete button in the note's own fill and
frame is a control wearing content's identity, and structure-not-costume cuts
both ways. A second consequence is accepted rather than hidden: a summoned
Complete fill (0.677) can outshine the note (0.596) while selection chrome is
up, exactly as the menu can shadow it — transient surfaces are above the page,
not part of the scene, so `PRD §9.2`'s brightest-on-the-water claim is
untouched. One question surfaced by the verification is recorded in
`UIUX §16.1` rather than ruled: the Delete fill/border handover on the field
dips to ~2.99 over a narrow reach of the fall — a `UIUX §14` construction
question, not an accent value.

**Provenance.** Proof sheet 8, "The Room Behind the Page", rendered the
candidates, the rejections and the maths, and was ruled **not committed** —
its derivations live in this entry and in `UIUX.md`'s restated tables. Proof
sheet 9, "A Well, Furnished", renders the ratified system whole, with nothing
beside it, and is committed at `proofs/proof-9-a-well-furnished.html` as
the rendered reference alongside sheet 7.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B53. The strike and its burial are one decision: 0.62 over 0.12 (supersedes `UIUX §4.3`'s 0.97/0.40 letter; keeps its law)

The scratch-out's three stroke families at 0.97 were tuned when the completed
thing sat on a mid ground; on the 0.66-luminance sand the union read as a slab
— `UIUX §16.1` carried the complaint three times unruled. The repair axis is
the one `UIUX §2.3` already sanctions — one ink per surface, expressed at a
weight — so the geometry never moved: same three families, ≥90% coverage
(93.6%, measured by rasterising the sheet's own pattern), radius tracking the
note's.

Rendering then forced a second value to move with the first, which prose alone
would have missed. The 0.40-ink burial was calibrated for a near-opaque veil:
at 0.97 the strokes crush what is under them, and the burial only had to kill
the 10% showing in the gaps. Thin the veil and the words come back *through*
the strokes — at 0.62 over 0.40 both rendered specimen lines read at 1.3× —
breaking the invariant P5 rides on: the strike is the record that work
happened (`PRD §1`), and the content under it is destroyed, on screen as B34
made it in the bytes. So the veil and the burial move together: **0.62 over
0.12**. The strike composites to 4.53 / 4.71 / 4.35 against the note, the
shelf's base and its darkest wisp — a mark everywhere, above the 3:1 floor its
worst ground demands (0.45 dies there at 2.76 and was rejected on the math
before taste voted) — and the buried text lands at 1.28:1: a smudge that still
says *something was here*, with the words gone at any zoom the app can
produce.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B54. The band label takes the pixel back: 13px (supersedes B38's 12px letter; keeps B38's rule and B37's law)

B38 chose 12px as "the largest whole px at which the widest measured
*Requirements* fits the 100px column" — measured in `system-ui`, a face the
app no longer speaks. In Montserrat Alternates the same word sets 95.2px at
13px (`hmtx` upper bound; 96px browser-rendered), so B38's own rule applied to
the committed face returns 13, and `UIUX §13.2`'s open question closes the way
B50 asked: decided, not inherited. The band is sized by the type it holds
(B37), so the formula's label term moves 15.6 → 16.9 and the band grows by
exactly the pixel the label takes — 88 at the floor, 107 at three lines
(`UIUX §3.1`). The counterargument was real: nothing is broken at 12, and the
headroom is harmless. Rejected because keeping it inherits a dead face's
measurement into a face that has already paid the pixel back — and the label
is the smallest text on the page, read at arm's length on the primary device.
Both sizes were rendered side by side at the committed geometry in round 8;
sheet 9 renders 13 in place. `test/mobile.js`'s band-geometry assertions move
with this ruling when it ships, not before (`UIUX §16.3`; B47's clause
unchanged).

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## O. The recolor ships (PR #86; the shipped round)

### B55. The platform edge wears the sky: one theme-color, #020812 (completes B48's collapse; extends B52 off the page)

B48 collapsed the two per-scheme `theme-color` metas to one and ordered
`manifest.json`'s pair to follow, but no ruling named the value — B11's colour
half died without a successor. The candidates were rendered as launch frames
and put to Rob beside the alternative (`--card`'s `#08152c`): **the sky wins,
`#020812`**. The reasoning is B52's, carried one surface further out: the room
behind the page is the sky, and the OS chrome around the app — the splash
frame, the status bar's tint, the task-switcher edge — *is* the room behind
the page. Everything the app draws stays lifted above what the platform draws
around it. One meta, `background_color` and `theme_color` all read `--chrome`'s
value; `test/tokens.js` holds the three in agreement and requires the value to
be a declared token. Ruled by Rob against the rendered pair on the shipped
round's review sheet.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B56. The icon grounds the note on the water (B1's motif under B48's regeneration)

B48 ordered the `icons/` motif regenerated from the new poles, as B16
regenerated it under B1. The motif never moved — the near-square note-frame,
two text lines, the completion stroke; identity from structure, not costume —
and the question was its ground. Rendered both ways at 192/512/maskable and
put to Rob: **the field's own fall wins** over the quieter `#020812`. The
launcher is where the identity claim meets the person first, and the claim is
B46's — on the water, the note is the brightest thing there is. A sky ground
renders a note in a void; the water renders the product. The generator is
committed this time (`icons/make-icons.js`, dependency-free `node:zlib`,
`--ground=sky` kept as a flag), so the next regeneration edits a script
rather than reverse-engineering three PNGs. Ruled by Rob on the shipped
round's review sheet.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B57. The cover screen keeps its three lot rows: the ceiling re-derives under full bleed (amends B37's threshold as kept by B47; ratifies the sheets' 166)

Implementation surfaced a genuine conflict between the records. B47 kept
B37's viewport-derived budget as the lot's ceiling, and B37's letter steps it
at 900 units — two rows below — which caps the 846-unit cover screen at 122
with a third item saved but not drawn. Both ratified sheets disagree: proof
sheets 7 **and** 9 draw exactly that viewport with three rows at 166, and
sheet 9's own footer says what it renders is what ships. Put to Rob rendered
both ways rather than decided silently: **the sheets win — three rows on the
cover screen.**

The repair is a re-instantiation, not a new law. B37's bound was always
proportional — it accepted `182/900 = 20.2%` of the sheet, measured with the
16px bottom margin the lot then carried. B47's full bleed killed that margin,
so three rows now cost 166, and B37's own arithmetic returns a new threshold:
`166 × 900 / 182 = 821`. **Three rows hold from 821 units and two below** —
the 846 cover screen draws three (19.6% of the sheet, *less* than B37
accepted), the short windows in `test/mobile.js` [11b] (715, 600) keep two,
and desktop keeps three exactly as before (B20 pins ≥1000). The ceiling's
values stay 2 and 3; nothing opens toward four. `LOT_3ROW_MIN_H` moves
900 → 821 with the derivation at its declaration, `EXPORT_GEO`'s 1000-unit
sheet is untouched, and `test/mobile.js` [11d] pins the ratified case: three
items at 384×846 draw 166 to the sheet's bottom edge. Ruled by Rob on the
shipped round's review sheet.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## P. The second swap (the ruled what-if; proof sheet 10)

### B58. The scene inverts: the canvas takes the deep, the sections take the water (supersedes B46's surface assignment; keeps every geometry ruling; inverts §2.5's rule clause; retires the sand)

Rob saw the shipped v2 on the final-gate sheet, asked for one throwaway
render — the band's dark and the board's water exchanged, the lot joining
the water — and ruled on the render: **this is the one.** The scene
reads water closing each end of the sheet, the deep between, and the
note as the one lit thing on the deep. Ruled the way every scene
decision before it was ruled: from a render, not prose; the ratified
reference is `proofs/proof-10-the-second-swap.html`.

**No value moved; every surface did.** The palette is unchanged — the
swap trades grounds, and the token names follow the surfaces so they do
not lie (`UIUX §16.2`'s discipline): `--band` → `--deep`, the field's
stops → `--water-*`. The sand family had no surface left to ground and
is retired entirely — lot to the water, primary to `--accent-page`
(B59); the six superseded hexes, recorded here as B52's precedent has
it: base `#e3d2b5`, run `#eaddc7` → `#dbc7a3`, wisps
`#d7b7ad`/`#bec3bb`/`#d4bfa0`. The retirement returns two claims B46
had to qualify to their original,
unqualified form: **the note is the brightest surface on the page**
(12.36:1 over the deep, the strongest it has ever read), and
**`--danger` is the only warm hue in the application**.

**The maths inverted one law's letter.** The band's water darkens into
its rule, meeting the deep at 1.58:1 — under `UIUX §2.5`'s 3:1 fill
floor — so the `--frame` rule the recolor called "not load-bearing" now
carries that seam (5.95:1 on the deep, 3.77:1 on the water's darkest
stop). The lot's seam is the water's lightest stop against the deep,
3.32:1: fill separates, and its rule stays a section mark. B53's
scratch pair proved pole-independent: the lot's strike flips to light
ink and still clears the mark floor at every stop (3.19/4.08/5.47),
the burial still a smudge (1.29). The radial falloff's sheet-bound job
died with the water canvas — a near-black ground has nothing darker to
fall to — and the falloff survives only inside the sections, where the
water still ramps. The dither stays: anti-banding over the sections'
ramps, ratified grain over the deep.

**Sequencing, ruled by Rob:** the finished recolor landed first
(PR #86, merged on his word), and the swap ships as its own release —
each release matches its own paperwork, and the record stays honest
about the order in which the design was found.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B59. The primary takes the accent about boards (supersedes §14's sand fill; completes the sand's retirement)

The `New board` button wore `--sand-base` because the shelf was sand
and the control that makes shelf-space wore the shelf's material. B58
took the reasoning's ground away. Rendered both ways on the swapped
rail and put to Rob: **`--accent-page` wins** over keeping the sand as
a control-only warm. The derivation was already in the record —
`--accent-page` is "the accent about boards, cut from the board's own
water" (B52) — and New board is the accent-about-boards job itself.
6.72:1 on chrome, 6.44:1 under its `--ink-dark` label; the tapped
drain becomes the accent as text on a near-black ground, exactly
§2.6's placement. With the sand gone nowhere survives it, and the
application's one warm hue is the destructive one.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B60. The icon follows the note's ground: the deep (supersedes B56)

B56 ruled "the note on the water" when the note lived on the water.
Nineteen minutes of shipped v2 later, B58 moved the note's ground to
the deep, and the icon's claim pointed at the wrong surface. Re-put to
Rob with both renders — the water kept, or the canvas matched — and
**the deep wins**: the launcher shows exactly what the app opens onto,
the pale note blazing on the near-black at 12.36:1. The generator's
default flips (`icons/make-icons.js --ground=deep`; the water stays a
flag), and the three PNGs regenerate. B56's water render remains in
the record as the shipped v2 icon it briefly was.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B61. Both ends close with the same line: the lot's rule takes --frame (supersedes §2.5's "shelf's own ink" clause; completes §3.1's idiom)

§3.1 has said since B47 that the two ends of the sheet close the same
way — yet the recolor drew the band's rule in `--frame` and the lot's
in its surface ink, an asymmetry the sand's on-light context excused.
The swap removed the excuse: both sections are water now. Rendered
both ways and put to Rob: **`--frame` at both ends.** One line, one
idiom, and the lawfulness is already proven — the band's rule carries
its seam at 5.95/3.77 (B58), and the lot's, a section mark over a
3.32:1 fill separation, wears the same line without an obligation to
carry.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## Q. The note's text is centered (issue #82)

### B62. A note centres its text in its own frame (extends UIUX §4; leaves B39's width law untouched)

The report: text notes left-align their text; it should be centred with
respect to the note's own frame. Ruled for centring against `UIUX §1`'s
law: the note is a framed object on a sheet, not a document. The frame is
the unit of reading — it earns itself on the first character (B8/B31) and
its border is the only thing separating two overlapping notes (`UIUX §2.5`)
— and glyphs hugging the left edge of a wrapped frame leave the right side
carrying nothing, pixels that stopped earning their place the moment a
line broke early. Centred, the frame and its words share one axis, the way
the title compartment and the band's nomenclature already read.

**One declaration: `text-align: center` on `.note-text`** — the value
lives in `UIUX §4`, the rendering authority. The live editor is
`.note-text` itself (`contenteditable` is set on the node; there is no
overlay element), so rest and edit render identically and typing is
centred from the first character.

**B39 is not disturbed.** Alignment moves glyphs, not the box: the note
stays `width: max-content` capped at the sheet's right edge, and
`text-align` changes no dimension of that box — the wrap cap,
`setHitInset`'s 44px collar, the drag bounds and every stored `x`/`y`
measure exactly as before. A single-line note shrink-wraps to its own
text and centres invisibly; the change is legible wherever a line falls
short of the box's widest — a cap-wrapped note's soft lines, or a short
hard line beside a longer one in a shrink-wrapped note.

**The export moves with the screen, mandatorily** (B34, and B39's own
mirror clause): `exportBoardPage`'s note loop passes `'center'` to the
same `lines()` primitive the band labels and the title compartment
already use, measured over `exportNoteBox`'s content width — the exact
analogue of the CSS content box — so the PDF's inset is the screen's
inset by construction, with one divergence closed rather than copied:
`pre-wrap` hangs a line's preserved trailing spaces, so `lines()`
measures centring against the line sans trailing spaces — counting them
would shift glyphs the screen does not shift. Page 2+ stays left-aligned
prose: B34 made it a searchable document, and a document reads from its
margin.

**The rendered record keeps its dates.** Proof sheet 10 (B58) still
draws its cap-wrapped note left-aligned and stays as ratified — a
pre-B62 render the way sheets 7 and 9 are pre-swap renders, B58's own
precedent. For the note's alignment, the render to trust is the shipped
app, v12 on.

**Scope: the note component only.** `.lot-text` rows and the band's
anchors stay left-aligned — the lot is a list read top-to-bottom down one
edge (`UIUX §3.2`), and the anchors' content hangs from the band's top
against its zone (B47); different objects, different reading.
`#anchor-title` and `.band-label` were already centred.

Pinned per `UIUX §16.3`: mobile [18b] and desktop [D17b] assert the
computed style on `.note-text`, and [D17b] parses page 1's content stream
to prove a deliberately short line inside a cap-wide note draws with its
`Tm` x operand inset from the note's left content edge — centred in the
file, not just in the DOM.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)
## R. Creation moves into the categories (issue #88)

### B63. Every category makes its own boards, and the pager steps below the cards (supersedes B44's merged strip and its three-per-page clause; supersedes B24's and B44's create-to-Unsorted flows; supersedes §14's "single primary control" claim; renames Unsorted's label only)

Issue #88 names the tax: the app sorts boards into categories, yet the one
control that makes a board stood outside them all — a global `New board` on
the list header and another on the rail — so every created board landed in
Unsorted and its categorization became a second, separate act. Capture
precedes structure, but creation *is* capture here, and the category the
user is looking at when they reach for the control is structure they have
already asserted. Making them re-state it with a drag is cognitive tax.

**Each section carries its own control, and it writes what it sits in.**
`makeCatSection` emits a fourth child — a `.primary-btn.cat-add` between
the head and the cards, on both surfaces, no `isDesktop` branch — and its
`newBoardIn(cat)` writes `category` explicitly (`'unsorted'` included,
`dropBoardCard`'s precedent; `catOf` stays a read-site default and no
record migrates) plus `catStamp`, so the new card lands first exactly as a
drop does. The board **opens at once** — `swapBoard` on desktop, the B9
page-turn on mobile — because a control that made something you then had
to go find would tax the very moment it exists to serve. The tap runs
through `delayAction` (B18: acknowledged, not idle), and the globals are
**removed, not duplicated**: `#new-board` and `#pane-new` are gone, and
§14's "the app's single primary control" claim goes with them — the
primary species survives, one per section, its construction unchanged.

**The section restacks as one grid on both surfaces.** Head row — label
left, control right, one box height — then cards, then the pager on its
own row **below the cards, centred**. The issue's word ("centered") wins
over the mockups' right-leaning pager: the mockups relocate the control
and grow the header, which is what they were drawn for; the text states
the pager's position outright. The header takes one new display step to
hold the row — **24px**, recorded in `UIUX §13.1` — keeping B44's
uppercase and letter-spacing; the control's own label steps to 14px so
the longest name still fits whole at B32's 384px floor. **The rail
measures out of the step:** at 24px `TO-DO BOARDS` sets 215px, and the
rail's 276px cannot hold that beside any legible control — so the rail's
header takes the scale's existing top step, 18px, rather than crowding
the category name off its own row (the refusal B44 already made when
four pager squares crowded `Unsorted Boards` off its strip). One new
step on the scale, not two: the rail adds none. Rows are 48px on mobile
(the control at §6's 44px floor) and 32px on desktop, where the
control's label steps down to 13px so a 300px rail holds both boxes.

**The capacity consequence is owned here.** Two 44px-floor furniture rows
where B44's merged strip spent one leave a 384×846 phone **two cards per
page**, not B44's three — that clause is superseded, deliberately: the
rows bought a create control per category and a header that reads at
arm's length, and overflow was already paged, so the third card costs a
page-turn, not a scroll. Desktop stays at three — retiring `#pane-new`
pays for its taller head row. `test/mobile.js` [19]'s no-overflow /
no-scroll pair still binds.

**The control's name is generic on purpose.** Three buttons all read
`New board`; each is a grid *sibling* of the aria-hidden `.cat-head`
(a button inside it would be unreachable to AT), so the enclosing group's
`aria-label` — the category, with its page state — disambiguates them,
exactly as it already disambiguates the pager's twelve arrows. **The
rename is the label alone:** `COPY.catUnsorted` becomes `Note Boards`;
the storage key `'unsorted'`, `BOARD_CATS`, `catOf`, `data-cat` and the
buckets are untouched (B21/B42/B44's read-site idiom — no migration).

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## S. The similarity transform (issues #65, #75)

### B64. One ratio maps x, y and size: the arrangement travels as a figure (supersedes B40's mapping clause and B21's width-only multiplier; B32's legacy rescue, B39, and B40's widened gesture clamps stand)

The bug, twice reported: fold or unfold a Z Fold, or rotate any phone, and the
board comes back with its arrangement mangled. The cause was in the record all
along — B21 maps `x` by `LOGICAL_W/rw`, B32 maps `y` by `LOGICAL_H/rh`, and B40
sizes on the width ratio alone, naming the consequence and accepting it: "when
the two ratios diverge, vertical clearances can still shift." An aspect change
is precisely the two ratios diverging, so every fold sheared the one thing PRD
§2.4 says must survive — "opening a board weeks later still shows the same
arrangement they left." Positions permanent means the *arrangement*, not three
coordinates that happen to agree only on the device that wrote them.

**Ruling.** One uniform ratio per note,

```
k = min(LOGICAL_W / (rw ‖ 900), LOGICAL_H / rh)
```

maps `x`, `y` **and** size (`renderX = x·k`, `renderY = y·k`, `effScale =
scale·k`). A single ratio on both axes and the size is a similarity transform:
pairwise angles and distance ratios are preserved, so the figure the author
left is the figure every device shows — smaller or larger, never sheared.
`min` gives containment **by construction**: `x ≤ rw ⇒ x·k ≤ LOGICAL_W`, and
the same for `y` against `rh` — which dissolves B40's stated objection to
mapping `y` by the x-ratio ("would push notes off the bottom of a shorter
sheet and demand exactly the re-clamps B17/B21 forbid") with zero re-clamps.
Stored geometry is still never touched by a viewport change; the entire law is
render-time, and the export applies it against its own sheet (`exportK`, the
same `min` over `EXPORT_W`/`EXPORT_H`) because the export mirrors the render
law mandatorily (B34, B39).

**Anchored top-left, and deliberately not centred — a ruled-out approach,
recorded.** With the height ratio binding, the figure occupies the sheet's
upper-left and the slack falls to the right/bottom as open canvas. Centring
the slack looks kinder and is impossible in principle: a centring offset is a
function of `rw`/`rh`, which each note carries *per authoring cohort* — notes
written on different frames would take different offsets, and a grabbed note
rebases to the live frame (offset 0) while its ungrabbed neighbours kept
theirs. Both re-shear exactly the arrangements this ruling exists to preserve.
The anchor is part of the law, not a default.

**The grab stays silent in position and size; the wrap cap rebinds, owned.**
`rebaseNote` folds `k` where it folded B40's width multiplier: `x = renderX;
y = renderY; scale·= k; rw = LOGICAL_W; rh = LOGICAL_H`. Silence is the same
proof as B40's: `effScale` before equals `scale` after, and once `rw`/`rh`
equal the live frame, `k ≡ 1`, so all gesture math runs in current-frame
units unmodified. B40's widened gesture clamps need no change and are kept —
a folded scale may still leave [MIN_SCALE, MAX_SCALE], merely by a smaller
factor than before. One thing the old rebase preserved, this one does not,
and it is chosen rather than suffered: with `rw·mult ≡ LOGICAL_W` the cap
`(rw − x)/scale` survived B40's rebase exactly, but under min-k
`rw = LOGICAL_W ≥ rw·k`, so a height-bound cross-frame grab can *widen* the
cap (never narrow it). That is B39's own live law — the cap is the distance
to the sheet the gesture is running on, and "a note simply rewraps wider and
flatter where it stands — intended, shipped" — surfacing at the pickup.
Keeping the authored cap instead (`rw = rw·k`) was considered and ruled out:
the drag would then wrap against a phantom edge at `rw·k`, short of the
sheet's true right edge, violating B39's headline. `rebaseNote` re-asserts
the width var on the element at the fold, so the DOM, the drag guard's
caches, and the record agree from the gesture's first frame — a stale cap
would otherwise hold the old wrap through the drag and snap it at the drop.

**`noteMaxW` is restated, not changed.** B39's law is `(rw − x)/scale` in
authored units; the shipped form `(LOGICAL_W − renderX)/effScale` was that
identity only while position and size shared the width ratio. Under min-k it
silently widens the cap whenever the height ratio binds — a cap-wide note
re-wraps across a fold, and the screen≡PDF wrap parity ([D17], mobile [18])
breaks. The cap now states the identity directly: `max(NOTE_MIN_W,
(rw ‖ 900 − x)/(scale ‖ 1))`, value-identical under the old law — and with
no frame constant left in it, `exportNoteBox` calls the screen's function
itself rather than restating it. Containment survives the restatement:
`renderX + cap·effScale = (x + (rw − x))·k = rw·k ≤ LOGICAL_W`.

**Legacy notes are untouched.** A pre-B32 note has no `rh`, its authoring
height is device-dependent and unrecoverable, and there is no second ratio to
take a `min` against. The entire legacy branch — width-ratio `x` and size,
`y` through `LEGACY_H`, the clamp at render time only — is B32's exact ruling
and stands verbatim.

**B28/B32's keyboard-resize deferral is now triply load-bearing.** It already
prevented the soft keyboard from moving every note (`y` is frame-relative) and
from baking a shrunken `rh` into storage at a mid-edit grab; under one shared
`k` an unguarded keyboard resize would now shrink `x` and *size* too — the
whole board would flinch at every keyboard. Do not weaken it.

**Costs, owned as B40 owned its own.** This deliberately changes how
cross-frame boards *look*, in both directions. A phone-authored board on a
1440×900 desktop rendered at B40's ~3.3× wide — and sheared; it now renders at
`min(lw/384, 1000/846) ≈ 1.18×` — compact, faithful, with the right and
bottom left as open canvas. A desktop-authored board on a phone renders small
(k ≈ 0.30 where B40 gave `y` 0.85), the arrangement gathered toward the
top-left; B7's decoupled 44 px hit collar is what keeps a shrunken note
tappable, exactly the job B40 assigned it. And where B40's width-only
multiplier related any two notes identically on every frame (`LOGICAL_W`
cancels in the ratio), min-k does not: a board whose notes carry *different*
authoring frames can relate its cohorts differently on different sheets —
including the PDF's — because each cohort's `min` may bind on a different
axis. Within one cohort, which is what an arrangement is, the figure is
exact; and any grab rebases toward one cohort. Faithful-but-small over
large-but-lying: the board is a *spatial* record, and a shear is a lie about
space. Pinned by `test/mobile.js` [12c] (shape held, size uniform, storage
untouched, round trip exact) and `test/desktop.js` [D13] (the silent grab
folds k); `UIUX §11` now states the law and `PRD §2.5`'s deferral row closes.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## T. The menu gets a door (issue #94)

### B65. The compartment names its own menu: a `Menu` handle on the title card (adds a door to the anchor menu of A1/B43; supersedes nothing — long-press and right-click are untouched)

The anchor menu — `Export · All boards` — was reachable only by a gesture
nothing on screen declared. On mobile that gesture is a 500ms long-press on
the title compartment; on desktop there is no gesture at all, because B19/issue
#4 removed click-and-hold and `contextmenu` routes notes alone, so the board's
own Export was reachable only by finding the same board's card in the rail and
right-clicking *that*. **Zero cognitive tax** does not survive an interface
whose only route to a feature is a gesture the interface never mentions. The
issue's own reasoning is the ruling: it "visually informs user that menu exists",
and it costs a click.

**Ruling.** A `Menu` control on the title compartment, opening the *same*
`openMenuFor({type:'anchor'})` menu, item for item. Both gesture paths stay —
issue #94 says so in as many words, and `test/mobile.js` [21] asserts the
long-press still opens it. The menu's contents do not change: A1's law and
B43's order are untouched, and the two-item exact match in [21]/[D21] is what
keeps a future hand from quietly making this control a third menu.

**A sibling, never a child.** `contenteditable` is toggled onto `#anchor-title`
itself (B2), so anything inside it would be edited along with the title — and
committed to `current.title`. The handle is a sibling positioned from the same
`--card-l`/`--card-w` geometry the compartment is, so B38's compartment and
B47's rule are arithmetically untouched: nothing measures the handle's box, and
[21] re-asserts `card.bottom === rule + 22` with the control in place.

**Where: the joint, not the interior.** "Bottom right of the title card" cannot
mean *inside* it. At B32's 384px floor the compartment is 145×110 and a
two-line title already reaches its bottom padding; a chip in the corner would
sit on the words. So the handle is **bisected by the card's bottom edge and
flush with its right one** — the joint where two of the card's three drawn
sides meet (B38: the sheet's own top edge is the fourth), thickened into
something to press. `--card` and `--deep` are 1.10:1 apart (`UIUX §2.5`), so the
ground under the chip is one value either way and the bisection is seamless.
It follows a title that grows past the floor: `--card-bottom` is the
compartment's measured height, set beside `--rule-y` in `updateBoardGeometry`,
which the title anchor now calls too — the title had no geometry consequence
before this and has one now. (The name is new; the retired `--card-h` of the
pre-B47 band is not resurrected, and `UIUX §16.3`'s note about it still reads
true.)

**What it is made of: `--frame`, filled.** A control inside a box that
otherwise holds *typed content* must not be able to read as content, which
rules out bare ink; and `--chrome` is the deep's own value, invisible on the
card. So the handle wears the line the compartment is drawn in — 5.70:1 under
its `--ink-dark` label, on a fill already published at 5.39:1 on the card
(`UIUX §2.5`) — and introduces **no new token**. Deliberately **not**
`--accent-page`: B59 gave that to the controls that *make* a board, and on
desktop this handle and the rail's `New board` are on screen together; two
identical chips doing different jobs would flatten the distinction B59 had just
drawn. `UIUX §14`'s shared tactile signature — 2px `--ink-dark` border, 0.4em
radius, offset shadow, press-translate — is carried whole, because §14's law is
*one signature, each species its own fill*.

**The floor, without growing the frame.** The visible chip is 32px, under
`UIUX §6`'s 44. That is B7's law, not an exception to it: the handle carries
the note's own decoupled `--hit` collar, and `setHitInset`'s arithmetic is now
a shared `hitInset(node, k)` with one caller per draw scale — so the target
clears 44px physical on touch and B23's 24px on desktop at *any* renderScale
(pinned at 0.56 in [D21], where the collar is doing the work). A chip large
enough to meet the floor by itself would not fit the compartment.

**And the collar obeys the same rule the chip does.** The note's collar is
symmetric; this one is not. The whole `2 × hit` is spent *downward*, onto the
deep, because upward is the title's own words — a symmetric collar reaches 22px
into the card, under the last line of a title long enough to have grown it, and
steals the tap that would place the caret there. Ruling the painted chip off
the words and then letting its hit area sit on them would be the same mistake
in an invisible layer.

**The type arrives late, so the geometry is re-measured when it does.** The
faces are `font-display: swap` (B50) and boot measures the fallback. Before
this ruling the drift was a rule a pixel out of place; now it is a control
visibly off the corner it is pinned to, so `document.fonts.ready` re-runs
`applyLayout` once. `--rule-y` gets the same correction for free.

**Through `delayAction`, like every control (B18).** The menu lands directly
under the finger; without the window the second half of an impatient double-tap
would land on a menu item. The `.tapped` fill is the acknowledgment, draining
to `--frame` on near-black exactly as `.primary-btn` does.

**Two paths in, one opener.** The recognizer owns pointers, so `classifyTarget`
gains a `title-menu` branch ahead of the anchor check — without it the sibling
falls through to `canvas` and the collar, which reaches past the card, drops a
note (B30's lesson about presses that land on furniture-adjacent paper). The
keyboard is the one path the recognizer cannot see, so `keydown` on Enter/Space
calls the same opener and `preventDefault`s the click the key would otherwise
synthesize: one opener, never two, and auto-repeat is dropped so a held key
cannot walk into the item `buildMenu` has just focused.

**A focused control owns its keys.** The handle also `stopPropagation`s
Delete/Backspace. It is the first focusable thing inside `#board` that is
neither an editor nor the selection, so B26's desktop grammar — Enter edits the
selection, Delete destroys it — would otherwise fire *through* a focused button
at an object the user is not looking at. The costs are not symmetric: swallowing
these keys here costs nothing, and not swallowing them can destroy a note.
Escape still passes through, because deselecting from anywhere is that grammar
working as intended.

`aria-haspopup="menu"` and a toggled `aria-expanded` say what the handle does;
focus returns to it on close via the existing `menuInvoker` — except into the
list, which is an overlay over the board, so `goToList` blurs the handle rather
than stranding a keyboard user on a control the list is covering.

**Impermanent in one respect, named here so it is not rediscovered:** the
handle is a *second door to one room*. The day the anchor menu grows a third
item, or a second control wants the same corner, this becomes a question about
what the compartment is for — not a question about this chip.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## U. The list opens onto the boards (issue #95)

### B66. The board list carries no page heading (supersedes B43's `#list-title` clause; B43's "All boards" rename stands)

Issue #95: the word `Boards` sat alone at the top of the list, one line above
three category heads that already read `TO-DO BOARDS`, `IDEA BOARDS`,
`NOTE BOARDS`. B43 kept it on the reading that it is not a menu — it names the
page you are standing on — and that reading was sound while the page below it
was B24's one flat, undivided list. B44 and B63 changed what is below it. The
screen now opens onto three labelled sections, so the heading is a fourth title
over three titles: **every pixel earns its place**, and that one does not. It
also answers a question nobody has by the time they can read it — the only way
onto this screen is choosing **All boards** — and restating the reader's own
last act is the same cognitive tax B63 named, charged at the top of the page.

**What goes, exactly.** `<header id="list-header">` and its only child
`<h1 id="list-title">Boards</h1>`, with their two rules in `styles.css §10`.
`#list-rows` is `#list-view`'s only child now and takes the whole height, and
the `app.js` and `UIUX §7` statements of the old rule go with them — a record
that keeps asserting a superseded clause is worse than no record. **B43's other
clause is untouched:** every menu still says `All boards` through the one
`COPY.boards` key. With the heading gone, that key is now the only place the
word is written at all — which is precisely what B43's exception was carved out
of.

**The page keeps its name where a name is still owed.** `#list-view` already
carries `aria-label="Boards"`, and nothing ever pointed an `aria-labelledby` at
the `h1`, so the region announces itself to a screen reader exactly as it did
before; each section's `role="group"` label (B44, with B63's page state) is
untouched. Removing a visible heading is not removing an accessible name.

**What it does cost, stated rather than left to be discovered:** the `h1` was
the app's only heading element, so a rotor's Headings list on this screen is now
empty. The structure is still announced — the region by its label, each section
by its group label — but it is no longer *jumpable* by heading. The fix would be
a real heading on each section, and B63 ruled the opposite for a reason that has
not changed: `.cat-head` is `aria-hidden` precisely so AT does not hear every
section twice, once from the group label and once from its own text. Re-opening
that inside an issue that asked for a deletion would be the wrong place; it is
recorded here so it is a known cost and not a silent one.

**The gutter closes at the top.** The header's 16px top padding was the only
thing between the first section's head row — a label and a 44px control — and
the top of the screen. `#list-rows` therefore goes from `0 12px 12px` to a
symmetric `12px`: the view's own gutter, one value on four sides, not a
reinstated header. The header spent 53px; 41px of it is returned, ~14px to each
section's cards row, where B63 left the slack. **The per-page budget does not
move:** a third card costs 64px, so `catPageCap()` still yields two on B32's
384×846 floor, and `test/mobile.js` [19]'s and [20]'s no-overflow / no-scroll
pairs — the assertions B44 rests its whole drag on — still bind.

**The 12px is a constant, and `env(safe-area-inset-top)` was considered and
declined.** Three reasons, in order of weight. The app declares
`apple-mobile-web-app-status-bar-style: default`, not `black-translucent`, so
iOS standalone starts the web view *below* the status bar and the top inset is
zero — `viewport-fit=cover` buys the landscape notch and the home indicator,
not a top overlay; Android standalone paints its own bar over `theme-color` the
same way. The app uses no `env()` anywhere, and one lone use is an idiom half
the codebase does not speak. And it would actively hurt where it claimed to
help: `catPageCap()` measures `clientHeight`, which *includes* padding, so an
inset would grow the measured budget by exactly the height it took away from the
flex line — an optimistic cap on the shortest screens, which is the overflow
B42 forbids. If the platform edge ever does need honouring, it is one ruling
for the whole app — the board's own 14px band label sits in the same zone —
and not a patch on this one rule.

**The dismiss target moves to furniture that is genuinely inert.**
`test/mobile.js` [19] tapped `#list-title` to dismiss an open board menu.
B30's `swallowTap` makes a dismissing press inert only where it lands on
`#board` — B44's "Not ruled here", still not ruled here — so the replacement
could not be a board card, and `.cat-add` and the pager are controls. It is a
`.cat-head`: aria-hidden furniture carrying no listener of its own, picked at
run time from whichever head the open menu is not covering.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## V. New background colours for the Idea and Note boards (issue #96)

### B67. A board type is a whole scene, not a rung: the ladder rotates with it (scopes UIUX §2.2.1 rule 1 to within a scene; extends UIUX §2.2 with §2.2.2; leaves B55's one platform edge and B58's scene untouched)

Rob: *"New background colors for just the idea boards and the note
boards. To do boards retain their ink well blue background. Idea boards
update to a deep hunter green with same stylization and graphic effects.
Note boards background color updates to a deep, light violet."*

Two screenshots came with the issue and could not be read from the
build environment, so the values were **derived rather than sampled** —
Rob's own call: rotate the shipped ladder in hue at matched lightness
and chroma. The hexes are in `UIUX §2.2.2`; this entry is why.

**What "matched" turned out to mean, precisely.** OKLCH lightness and
chroma and WCAG relative luminance cannot all be held across a hue
rotation — OKLab lightness and WCAG luminance are different functions of
the same colour. Only one can be pinned, and it has to be **luminance**,
because luminance is what every ratio in `UIUX §2` is computed from and
what `§2.2.1` rule 1 means by "one axis". So L and C became the aiming
coordinates, held as closely as 8-bit sRGB allows (L within 0.010, C
within 0.007), and luminance is exact to the 4dp the record prints.
`UIUX §2.2.2` prints the residuals rather than claiming they are zero.

**The rule this bends, said out loud.** `UIUX §2.2.1` rule 1 is "one
axis: luminance — nothing is distinguished from another surface by hue
alone." Taken flat, three coloured boards violate it. Taken as written,
it does not: the rule exists so that *reading the page* — card from
deep, water from canvas, note from ground — never depends on a channel
a person's eyes may not deliver. It governs **rungs within a scene**.
Board type is not a rung; it is the whole scene, every rung moving
together. So rule 1 gains the qualifier "within one scene," and the
distinction is made honest by construction rather than by exemption:
**every rung holds its To-Do luminance to the 4dp the record prints.**
The three ladders are the same ladder. Turn the hue off and they are
indistinguishable — which is exactly the property rule 1 protects.

**Where the gamut binds, recorded so it is not re-derived.** The Idea
card sits at `C = 0.043` against the blue's `0.050`, and the Idea deep at
`0.025` against `0.027`. Both are the **sRGB maximum** at that luminance
in that hue arc — checked by scanning every 8-bit triple, not estimated.
sRGB's blue primary is very dark, so a dark blue buys chroma almost free
by pushing `B`; green's primary carries 0.7152 of the luminance, so a
dark green must keep `G` small and its chroma is capped. A more
chromatic dark green card at that luminance **does not exist**.

**Rule 4 is satisfied, with the numbers.** Fourteen new values, each
one put through `§2.3.1`'s crossover and `§2.3.2`'s forbidden band
before it existed: all fourteen sit outside 0.163–0.196, every ground
below 0.1788 still takes `--ink-light`, every note above it still takes
`--ink-dark`. Necessarily so, since each sits at its To-Do rung's
luminance — which is the point of deriving them that way rather than
picking them.

**B52's precedent, met.** B52 rejected a hex that had not earned a job.
These have one, and it is a job no existing value could do: the app has
had three board categories since B42, and until now type drove **zero**
rendering — the category was a fact about the list, invisible the moment
you opened the board. A person with a to-do board and an idea board open
across two sessions had nothing on the page telling them which they were
in. The hue is the first thing the board itself says about what kind of
board it is, and it says it without a label, a badge or a legend —
`PRD §1.2`'s zero cognitive tax, and every pixel earning its place.

**Bound by rebinding, not by overriding — and that is the whole of
"same stylization and graphic effects."** The board is four layers: the
flat `var(--deep)` fill, the SVG turbulence dither, the band's radial
vignette over its three-stop fall, and the Parking Lot mirroring it.
All four read tokens through `var()`. Rebinding the token *names* under
`#board[data-cat=…]` carries the hue into all four at once. The
alternative considered and rejected — a new `--board-bg` token with
`#board`'s background pointed at it — would have recoloured the fill and
left blue furniture standing on a green ground, and it would also have
broken `test/tokens.js`'s assertion that the canvas is literally
`var(--deep)`.

**The list and rail cards rotate with their section.** `UIUX §10` calls
a card "a small rendering of what it names," and a card is drawn in the
water's upper fall — so once the water is per type, a blue card opening
a green board is the card lying about its board. The section *ground*
stays `--chrome`. The **drag ghost** is the one card that leaves its
section: it is fixed to the viewport off `document.body`, outside the
scope, so it carries the attribute itself and keeps its hue in the air.
A card that changed colour the moment you picked it up would be the same
lie, told during the one gesture that is *about* its category.

**A record with no category renders violet, and that is the coherent
answer.** `catOf()` is a read-site default and a record without a
category IS the third bucket (B21's idiom) — the list already files it
under Note Boards. Forking the default so the board rendered blue while
its card sat in the violet section would have reintroduced exactly the
lie the card preview removes. The consequence, owned: every pre-#58
legacy record opens violet, since it writes no category — and that is
correct, because the list has always filed it under Note Boards.

**The first-run board is the one exception, and it is seeded, not
defaulted.** `newBoardRecord()` wrote no category either, so a fresh
install of an app named for its To-Do boards opened violet — a default
that was invisible until this entry made the type render. It now writes
`category: 'todo'`. This extends B63's "every new board writes its
category at creation" to the one creation path that predates it: the
empty-database boot. `newBoardIn` overwrites the seed with the section
the board is made in, so the three callers stay coherent. Legacy records
are deliberately untouched — reclassifying them would mean a migration
and a DB version bump, and B21's read-site idiom exists to avoid exactly
that.

**Three things deliberately do not rotate.** `--chrome`, because there
is one room and it sits behind all three boards at once (B55's one
platform edge stands: `index.html`'s `theme-color` and the manifest's
two colours all still wear `#020812`, so **a green board's OS chrome is
the blue** — owned, not overlooked). The two **ink poles**, because ink
is per surface, not per app (`UIUX §2.3`) — and because rotating them
would move `§2.3.1`'s crossover and break `§2.7`'s ring, whose whole
claim is that the poles are complementary on every ground. The three
**accents**, because they live on chrome (`UIUX §2.6`).

**What actually moved, and what did not.** `§2.3`'s five ink pairings,
`§2.5`'s seven adjacencies, `§2.7`'s six ring rows and `§2.3.1`'s
crossover are functions of luminance alone, and no luminance moved:
every one of them reproduces on all three ladders, and `test/tokens.js`
now asserts each against all three with a single expected number. (The
sections' radial falloff is a second alpha composite whose luminance also
moves; no published ratio is computed from the vignetted ground, because
`§2.8` asserts every adjacency against the fall's declared stops. Said
out loud in `§4.3` so the next value derived from the band's real ground
is derived per ladder.) The
only **published** table that moves is `§4.3`'s scratch pair, because a
strike is an *alpha composite* — a function of the ground's three
channels, not of its luminance — so rotating the hue re-quantises the mix
at 8 bits. The six marks shift by at most 0.04, stated per ladder in
`§4.3` rather than averaged, and the law they serve is asserted separately so it cannot be
satisfied by editing a constant: every mark clears 3:1 on every stop of
every ladder, every burial stays a smudge. Reproducing all twenty-four
published numbers exactly was attempted first and is **not achievable at
8 bits** — the search is over-constrained — which is itself worth
recording, so the next agent does not spend the afternoon on it.

**Pinned.** `test/tokens.js` now parses the palette **per scope** rather
than flat, because a last-wins scan would read whichever ladder came
last in the file as if it were `:root`'s — and it asserts the rung
values, the shared luminances, that the two spellings of the darkest
stop agree (`--water-bot` / `--water-bot-a`), that `--chrome`, the poles
and the accents are *not* rebound, and that `app.js` sets the scope from
the record while carrying no hex of its own. `test/desktop.js` [D16]
adds the **rendered** pin, which is the one that matters: tokens.js
reads stylesheet text, and only a real browser can say the cascade
reaches the page — it asserts the computed fill, rule, card, band and
lot of an open Note board, its rail card's preview, the drag ghost
mid-flight, and that a swap to a To-Do board repaints the page blue and
the return swap repaints it violet. `proofs/proof-10-the-second-swap.html`
renders all three scenes side by side; nothing tests that file, so it
was updated in the same commit.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## W. Four cards a page (issue #97)

### B68. An empty category collapses to its head row, and the rows sit on the touch floor (supersedes B44's "two empty thirds" clause and B63's two-cards-per-page clause; B42's "measured, never a constant" law stands and is restated)

Issue #97 asks for four boards a page where the phone shows two. There is no
constant to change and there must not be: B42 made the budget a *measurement*
of the surface, and `catPageCap()` still divides real height by real rows —
a hard-coded four that clips off the bottom of a shorter phone would be a
regression wearing the issue's number. So the four had to be found in the
furniture, and the furniture had two things to give.

**An empty section gives back everything except its head row.** B44 drew three
equal sections always and named the cost outright — "a phone holding one board
shows two empty thirds" — for a reason that was right: *a category you cannot
see is a category you cannot drop into, and the drop targets are the feature.*
That reason buys the head row, not the empty thirds. A section holding nothing
now collapses to that row alone (`.board-cat.empty`): its label still names it,
its own `New board` control (B63) still creates in it, and the row is still a
`.board-cat` rect for the drop hit-test to find — 44px on mobile, `UIUX §6`'s
touch floor, and 32px on the rail, past B23's pointer floor. Every job B44's
clause was defending survives, and the cards and pager slots it was not using
go back to the sections with something to show. `catPageCap(filled)` reclaims
exactly what the CSS collapses, so the two cannot drift: the JS subtracts one
head row per empty section, the grid draws one head row per empty section.
`renderList`/`renderPane` count the populated buckets into `catFilled`, and
`applyLayout`'s resize check compares against that same fill state.

**And the rows come down to the floor, not through it.** `PANE_ROW_H` 56 → 44
and `LIST_CAT_ROW` 48 → 44: `UIUX §6`'s touch floor is the floor, and a card is
a tap target, so 44 is where this stops. The card still reads as a discrete
object with its own edge (B44's requirement, issue #74's whole point) — the
hairline and the water fill are what draw the edge, never the height. The
gap splits in two, because it was saying two things at once: `PANE_ROW_GAP`
4 between cards inside a section, `CAT_SEC_GAP` 8 between sections. Tightening
the first buys the card; holding the second is what keeps three categories
reading as three. `catPageCap()` also now measures the host's *content* box
rather than `clientHeight`, because `#list-rows`' own 12px bottom padding sits
inside `clientHeight` and outside the flex line — slack the old budget could
absorb and this one cannot.

**The honest numbers, stated rather than rounded up.** On a 384×846 phone
(`B32`'s floor viewport): **thirteen** cards a page with one category populated,
**six** with two, **three** with all three. These were measured on the merged
tree, not on this branch alone: B66 removed the list's page heading and gave
`#list-rows` a 12px top gutter in its place, which returns height this budget
then spends — one extra card in the one- and two-populated states. The
all-three number is unmoved. The issue's four is delivered in
the common case and beaten in the sparse one; with every category populated
the measurement says three and *the pager says so* — B42's law is that
overflow states itself, and a number that lied about the height would clip.
The rail gains a card too, 3 → 4 at 1440×900. B63's "two 44px-floor furniture
rows leave a 384×846 phone two cards per page, not B44's three" is superseded
by exactly the arithmetic that sentence performed, with tighter rows and a
collapse in it; the create control and the header step it bought are untouched.

**Two consequences, owned.** *The empty category's drop target shrinks* — from
roughly a third of the surface to one furniture row. It is still a target at
the app's own floor for one (`UIUX §6`), it is still where you are already
looking (its label and control are on that row), and the landing frame draws
`--accent-page` around it *before* release, so the gesture says where it will
land rather than leaving you to guess. The hit test stays strict rect
containment: a release in the gap between sections lands nowhere and the card
returns, which is B42/B44's existing law and the same answer a release outside
the list has always given. A nearest-section fallback was considered and left
alone — it would make every release a move, and "releasing over the section
the card already lives in is a change of mind, not a move" (B44) is the shape
that stance has to keep. *And the head row has no slack left*: the primary
species wears its signature outside its border box — the offset shadow, and
`§2.7`'s ring at `outline-offset: 2px` — so `.cat-add` takes `position:
relative` and paints above the cards track rather than under the first card.
Height was the thing being spent here; paint order costs nothing.

**Ruled out: reserving the pager's slot only where a section pages.** That is
the remaining 44px, and taking it would make capacity depend on whether a
pager is showing while the pager shows because of capacity — the flap the
reserved slot exists to prevent (B42) — and would leave sections on the same
screen with different budgets. The slot stays reserved.

`test/mobile.js` [21] pins the ruling at all four fill states — one, two and
three populated, and an app holding nothing: three sections always drawn and
named, every `New board` control at 44×44 whatever its section holds, no card
under the touch floor, four or more cards where the issue asks for them, a
collapsed section exactly one head row tall, creation still working *inside* a
collapsed category, and B44's load-bearing pair — no section overflows its
clip, the list itself never scrolls — under every one of them. [19]'s drop now
lands on a *collapsed* To-Do, which is the obligation this entry takes on.
[19]/[20] and `test/desktop.js` [D16]/[D20] reseed so the overflow the pager
exists to state still exists at the larger budget, each with an explicit
`pages >= 3` assertion so the seeds can never again go quietly vacuous.
`UIUX §10` carries the sizes.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## X. The board list reorders itself (issue #97)

### B69. A section orders by last touch, newest first (supersedes B24's `createdAt`-desc/immutable-slot clause, as carried forward by B42 and B44; leaves `boot()`/`ensureCurrentValid()` untouched)

Issue #97 asks for four boards a page, "organized by most recently updated".
The second clause is a reversal, not a refinement. B24 ruled the shared
comparator `createdAt` desc + `id` tiebreak — "immutable, so a card's slot
never moves" — and read that as §1.3, positions permanent, applied to card
order; B42 carried it into the rail's categories and B44 into the mobile
list, so the claim has been restated three times. The owner was asked and
chose `updatedAt`. **This entry overturns the ordering clause and nothing
else** — B24's rail, its 300px, its swap, its delete paths, its `HIT_FLOOR`
neighbour all stand.

**Positions permanent was the wrong principle to be spending here.** §1.3
protects what the user *placed*: a note's `x`/`y`, authored by hand and never
mutated by a layout change. Nobody places a board card. Its slot is computed,
it already moved on every create, and since B42 it moves on every drop between
sections. What the reader of a listing actually needs is the board they were
last in — and making them scan three sections and turn a page to find work
they closed a minute ago is the cognitive tax the principles at the top of this
file rank above a stable-looking slot. The listing is a **finding** surface; the board is the
spatial record.

**The key is last touch: `max(updatedAt, catStamp)`, floored at `createdAt`.**
Two writes are a touch and each has a genuine claim on the first slot.
`updatedAt` is stamped by `saveNow()` on every committing action — capture,
edit, move, complete, delete, z-order — and `catStamp` by a drop or a create,
which B42 and B63 defined *as* moved-to-top. Neither subsumes the other: a
drop onto a board you have not edited in a week writes no `updatedAt` (it is
a whole-record put on a record that is not `current`, B13's write path), and
an edit writes no `catStamp`. Taking the later of the two lets both claims
stand and lets the more recent one win, which is the only answer that reads
the same to the user under either verb. `createdAt` is the floor, so a board
that has been neither edited nor moved still sorts where it always did.

**Read-site defaulted, the B21 idiom — `catOf`'s pattern, one line above it.**
`touchedAt` ors each field to `0` before the `max`, so a record missing
`updatedAt` or `catStamp` orders by what it does have. Nothing migrates and no
DB version moves, exactly as B42 did for `category`/`catStamp`.

**B24's comparator survives as the tiebreak, and that is load-bearing.**
`boardOrder` still closes `catOrder`, so two boards touched in the same
millisecond fall to `createdAt` and then to `id` — a **total** order with no
tie left unresolved. Without it a sort could return either arrangement for
identical data, and `makeCatSection`'s page clamp would slice a different card
set on two renders of the same records. One comparator still serves both
surfaces (B44's one law, two skins): the rail and the list cannot disagree.

**`boot()` and `ensureCurrentValid()` are untouched, and B24's parenthesis
still holds there.** They read `updatedAt` to choose which board to *open* —
continuity — and that was never the question issue #97 asked. What changes is
only that `updatedAt` now also orders space; the two readings no longer
disagree, so the rail's first To-Do card and the board that opens at launch
tend to be the same board, which is the outcome the issue wanted.

**The listing re-sorts when it is *built*, not while you type.** No save
re-renders the rail or the list — `saveNow` writes, and the surface picks the
new order up the next time `renderPane`/`renderList` runs (a swap, a create, a
delete, opening the list, a mode flip, a reload). This is deliberate, not an
omission: the rail is on screen the whole time you are working, and a card that
slid to the top on a 300ms debounce, mid-keystroke, would be the jumping
interface B24 rightly feared. Mobile never notices — its list is built fresh
every time it opens, so it is always current.

**Leaving a board is not updating it: the flush stops stamping.** `swapBoard`
flushes the outgoing board before it loads the next, because B13's whole-record
put needs the live edits — and `saveNow()` stamped `updatedAt` unconditionally,
which under this order meant clicking card B sent **A**'s card to the top of its
section. Two things break there. Mobile's `openBoardById` does not flush at all,
so the same act would order the two surfaces differently — against B44's one
law, two skins, the very sharing this entry relies on. And `newBoardIn` stamps
the new board's `catStamp` *before* `swapBoard` runs, so the flush would outrank
it and B63's "the new card lands first" would quietly stop being true whenever
you created a board in the section the open one already sat in. So §3 splits the
write in two: `saveNow()` (a committing action — stamp, then persist) and
`flushSave()` (on the way out — persist always, stamp only if a debounced edit
is actually pending, tracked by one `dirty` flag `scheduleSave` sets). The write
itself is still unconditional, so nothing can be lost; only the claim "this was
updated" is now reserved for something the user actually did. `newBoardIn`
flushes first for the same reason, so the board it creates is always the later
stamp, and mobile's `openBoardById` flushes too — it is `swapBoard`'s twin, and
that is what makes the two surfaces agree rather than merely share a
comparator. `dirty` describes `current`, so it is cleared wherever `current` is
replaced: `ensureCurrentValid` drops the pending debounce of the board that
just went missing, or its timer would fire against the successor and stamp a
board nobody edited.

**The stamp does not turn the page, and that was the harder call.** An edit can
now move the open board's card off the page the reader is on — and the rail puts
its delete control on the active card alone (B24), so that control goes with it.
Resetting `catPage` from the save path would fix it in one line, and
`dropBoardCard`/`newBoardIn` set that same line already. **Refused**: those two
reset a page they are about to render in the same turn, and a save renders
nothing, so the reset would sit stored and fire later against a render the
reader cannot attribute to anything. B42 ruled page state exists *so a re-render
keeps the reader's place*; overturning that as a side effect of an ordering
change is not a trade this entry is allowed to make. Nothing becomes
unreachable: paging away already put the active card out of view, deleting a
board is also on B24's right-click-any-card path, and page 1 — where an edited
board now is — is one press away.

**The cost, owned.** A card's slot now moves when you edit the board — which
is precisely what B24 was protecting against. Open a board, type one note,
come back to the list, and it has jumped to the top of its section; a card you
had learned the position of is no longer there. On a paged section it can also
push the last card of a page onto the next one. That is accepted: the
reordering is *caused by the reader's own action*, immediately after it, and a
listing whose top is stale is the more expensive failure.

A smaller cost goes with it: `fillRowContent` still dates an **untitled** card
by `createdAt`, so a section can now read Aug 22 / Aug 10 / Aug 21 top to bottom
and the only visible date no longer explains the order. Left alone deliberately
— that date is there to tell two untitled boards apart, not to justify a slot,
and re-pointing it at last touch would make every untitled board say today.

Pinned by `test/mobile.js` [19] and `test/desktop.js` [D16] — a seeded board
edited through the app's own save path moves to its section's first slot, the
untouched cards keep their relative order, and a second render of the same
records is identical; [D16] also pins the flush (a swap leaves the outgoing
board's `updatedAt` alone), the page (a rebuild keeps the reader where they
turned to) and B63's create-beside-the-open-board. `UIUX §10` states the order,
`PRD §4.2` the flush, `PRD §6.7` the cost.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## Y. Two cards to a row (issue #97, reopened)

### B70. A row carries two cards: the list doubles sideways, since §6 closed the vertical (supersedes B68's per-page counts and UIUX §10's budget formula; keeps B68's collapse, its row heights and B42's measured-not-constant law)

Issue #97 asked to go from two boards a page to four. B68 delivered that by
collapsing empty categories and taking every row down to `UIUX §6`'s 44px
floor, and stated the honest consequence: with all three categories populated
a 384×846 phone showed **three**, because a fourth 44px row did not fit. Rob
saw the shipped screen and said so plainly — three visible, not the six he was
after, and asked why the cards were not split to fit them.

**The vertical axis was closed; the horizontal one was never asked.** Per
section the phone gives 268.7px: a 44px head row, a 44px pager row, and 180.7px
of cards. Every one of those numbers is already at the touch floor, so nothing
can be shaved — B68 was right that four rows do not fit. But a board card is a
*name*, and a name does not need the sheet's full width: at 384px the card for
`8/21` was a fifth of its own box, and the rest was ground. **The row carries
two cards.** Three rows of two is six boards in the 140px that three rows of
one spent on three — the same height, the same 44px targets, twice the boards.

**Measured, on the merged tree, at 384×846:** twenty-six cards with one
category populated, twelve with two, **six with all three** — exactly double
B68's thirteen / six / three, which is what a second column buys and no more.
The number the issue asked for is now cleared in every fill state rather than
only the sparse ones.

**Capacity stays measured** (B42, restated B68 and again here): rows are what
the height buys, columns are what a row holds, and the budget is their product.
Nothing here pins a constant — `catPageCap` still measures the surface, and the
pager still states what did not fit. `LIST_CARD_COLS` names the second column
in `app.js` and the `grid-template-columns` track names it in `styles.css`, the
same two-sided idiom `LIST_CAT_ROW` and `PANE_ROW_H` already use.

**The rail keeps one column.** `PANE_W` is 300px; halved, a desktop card would
be narrower than the titles it names, and the rail's problem was never density
— it holds four at 1440×900 and always could. `html.desktop` overrides the
track back to one, so the two skins stay one DOM shape (B44) and differ by a
CSS decision, as they already did.

**The cost, owned.** A half-width card truncates sooner: `LinkedIn Learnings
To Do` now ellipsizes where it did not. That is `UIUX §10`'s existing rule —
truncation is always indicated, never a hard cut — and the trade is deliberate:
a title you can read half of and reach in one screen beats a title you can read
all of on page two. The board's own title card is unaffected.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## Y. A note the user can mark (issue #105)

### B71. Highlight is a per-note appearance the user asserts — a new axis, the first the board has (does not supersede; adds `--highlight` alongside the §2.6 accents without touching them, and reconciles with UIUX §2.2's "the note is the brightest surface" and §2.6's "accents live on chrome")

Issue #105 asks for a **Highlight** item on a note's menu that washes the whole
note box in a contrasting bright colour and, chosen again, toggles back. Nothing
in the app had ruled on per-note appearance: every note surface is set by board
*type* (B67), never by the note, and the accents (§2.6, B52) are forbidden the
board surface — they signal the *app's* verbs on chrome. So this is a genuinely
new axis, and it needed a ruling before a colour landed on a note.

**Why it is not an accent, and why the chrome rule does not reach it.** An accent
names something the application does — Delete, Restore, the primary. A highlight
names something the *user* does to one note: it is emphasis they place, not state
the app reports. The rule that keeps accents off the board (they would compete
with the note for the eye) is exactly inverted here — the whole point is to make
one note louder than its neighbours, on the board, at the user's command. B52's
placement law is untouched; the highlight is simply a different kind of thing,
and §2.6.1 records it as its own row rather than a fourth accent.

**The value: `#F2D64B`, a warm amber.** The three note families are all cool
pastels (B67 — blue/green/violet). The one hue that reads as "marked" against
every one of them is a warm one, and the app already proved a single warm value
can live in a cool scene without breaking it (`--danger`, B58). The separation
is by **hue**, not luminance: the amber keeps the note's brightest-surface rung
(§2.2 — its luminance 0.675 sits a hair above `--note`'s 0.596), so a highlighted
note still reads as a note, only lit, and its dark ink holds at 13.27:1 on the
`.on-light` surface it already binds (§2.3). Unlike the ladder, `--highlight`
does **not** rotate with board type: an emphasis means the same thing on every
board, so it is one constant token — asserted app-level in `test/tokens.js`
beside the accents and the ink poles.

**The mechanism mirrors complete/restore.** A boolean `note.highlighted` rides
the same structured-clone write as every other note field (no DB version bump,
no migration — legacy notes read falsy, B21's read-site idiom); `makeNoteEl`
toggles a `.highlight` class on the `.note` wrapper; `.note.highlight .note-text`
swaps only the fill, leaving border and ink untouched. It honours §6.2's "no
empty frames" law — an empty highlighted note stays transparent until its first
character. Every existing primitive is reused: `delayAction` gates the menu item
(B18), the desktop path drives the same all-qualify flip as Complete on a
multi-selection (B43's grammar, issue #55), and the PDF export — faithful to
what is on screen (B34) — fills the highlighted note with a paper-light amber.

**The label states the act, not the state.** Following B43 / UIUX §7, the item
reads **Highlight** on a plain note and **Remove highlight** on a lit one (plural
**Highlight all** / **Remove highlights** for a desktop selection), never a fixed
noun that would leave the user to guess which way the toggle points. The value
itself lives in UIUX §2.6.1, as the rendering authority requires; this entry
records why the axis exists.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## Z. Barriers between the categories in the list (issue #107)

### B72. Each category section is a framed, tinted tray in its own family (supersedes, in part, B67's / UIUX §10's "the section's ground stays `--chrome` … three tones of card on one surface"; does not touch B55's one-room law)

Issue #107: on the All Boards menu "they all blend together and it's a big mess
of buttons." The three sections — To-Do / Idea / Note — were told apart only by
their cards' water hue and an uppercase text head, sitting on one uniform
`--chrome` ground with an 8px gap between them. B44 gave the gap the whole job of
separating a section from a section; the issue is the report that the gap alone
does not do it. So a section needs an edge of its own, and a barrier the eye
does not have to hunt for is exactly UIUX §1/§6's "every pixel earns its place"
being spent, not the tax it warns against.

**What draws the barrier — rungs, not new colour.** A section becomes a **tray**:
its family's `--card` rung as the ground and its family's `--frame` rung as a
**2px inset frame**, both already rotated per board type (B67, UIUX §2.2.2). No
value is invented — `--card` and `--frame` existed on every ladder and simply
had no render site in the list before; now they do. The card fill sits 3.01:1
above the `--card` tray and the frame reads 5.39:1 on it and 5.95:1 on the
chrome around it — all three already published in UIUX §2.5, because B67 pinned
luminance across the hue rotation. To-Do's tray is the quietest (its `--card` is
the chrome's own hue one step up, 1.10:1); there the **frame** carries the
separation, which is UIUX §2.5's own doctrine — the card's border separates, its
fill does not.

**Why this does not break B55's one room.** `--chrome` still does not rotate and
is not touched. Each tray is drawn *on top of* the one room, which still shows
through the list's 12px padding and the 8px gaps between sections — three
enclosed places within one room, not three rooms. What is superseded is narrower
and only B67-era prose: UIUX §10's "the section's ground stays `--chrome` … three
tones of card on one surface." The ground is now the family's, the frame is the
family's, and the room behind them is still the one blue chrome.

**Height-neutral by construction, so B42/B70's measured budget is untouched.**
`catPageCap()` measures only vertical space — the surface's content height less
padding, gaps and the fixed furniture rows. The barrier spends `background`, an
inset `outline` and `border-radius`, none of which change a box's height, and
the tray's horizontal breathing room lives on `.cat-cards` as `padding-inline`
(a `padding-block` there would silently shrink the cards track and clip a row).
Padding is kept off `.board-cat` itself so the New board control stays flush
with the section's right edge (the anchored-right assertion in
`test/mobile.js` / `test/desktop.js`). The frame is **inset** for the reason
`.drop-target` already is: the surface clips (pagination, not scroll), and an
outset outline would lose its side edges. During a card drag `.drop-target`
recolours the same outline to `--accent-page`, and the resting family frame
returns on release. One DOM shape, both surfaces (B44/B63): the base `.board-cat`
rule carries the tray to the mobile list and the desktop rail alike.

**The record.** The values live in UIUX §2.2.2's ladder table (unchanged) and
the render is described in UIUX §10; `test/tokens.js` now asserts each rotating
section carries its family's `--frame` and `--card`, beside the existing check
that its cards carry the family's water.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B73. The Parking Lot sizes to its measured content, not its item count (supersedes B37's whole-row budget and B47/B57's row-count ceiling for the lot; leaves the band's own content-sizing untouched)

Issue #106, with a screenshot: a lot item's text wraps to several lines and
the extra lines are **cut off** — the section stays the same height. "The
parking lot expands as more is added to it."

The lot's height was `34 + clamp(2, n, maxRows) × 44` — item **count** times a
fixed 44px row, capped at two or three rows (B37, re-instantiated under B47's
full bleed as B57's `LOGICAL_H ≥ 821` threshold). A row that wrapped to three
lines was still allotted 44px, and `#lot-items { overflow: hidden }` clipped
the rest. Meanwhile the band at the sheet's *other* end already sized to its
tallest zone's **measured** height (`bandRuleY`, scrollHeight); B47 said "both
ends of the sheet close the same way," but in code the lot alone stepped by
count. That asymmetry is the whole of the bug.

**Ruling — measure, don't count.** `lotH()` now sums each `.lot-item`'s
rendered `offsetHeight` (every row is content-sized: `min-height: 44`, growing
with its wrapped lines and never clipped itself — the clip lives on the
parent), floors at the two-row shelf, and publishes it as `--lot-h`:

```
lot-h = min( 34 + max(2 × 44, Σ rowHeightᵢ),  ⌈0.5 × logical-h⌉ )
```

Backward-compatible where it should be: an empty lot is still 122, single-line
rows are still 44 apiece, so the ratified count-based cases (empty 122;
three single lines 166, proof sheets 7/9) render pixel-for-pixel as before.
Behaviour changes only once content actually exceeds the old budget — a row
that wraps, or more rows than the old ceiling drew — which is exactly the
report. The `lot-text` input handler now calls `updateBoardGeometry()` too, so
the section grows *live* while typing, the same capture feedback the band's
`anchor` branch already gave (PRD §1: work performed stays visible).

**The ceiling loosens but survives (resolved with the reporter).** B37 capped
the lot so "a long lot cannot swallow the canvas"; that intent stands, but its
2–3 whole rows were what cut the wrapped text. The cap is now **half the
sheet** — generous enough that ordinary multi-line items are never clipped,
tight enough that a pathological lot still cannot eat the page. Content past
the cap is clipped by `#lot-items { overflow: hidden }` (it still exists,
still saves, still exports — B35's promise, kept). The lot is bottom-anchored,
so it grows *upward*; notes sit on the plane above it (z-2 over the furniture's
z-1), so a taller lot never hides a note.

**Screen and export follow one law, not one number (B34).** `exportLotH` sums
the same wrapped `rowH` the export's draw loop already computed per item, from
the two-row floor, capped at `0.5 × EXPORT_H`; `EXPORT_GEO.lotMaxRows` is
deleted with the count formula it fed. The draw loop's existing `clip()` keeps
the export's overflow behaviour matched to the screen's.

**The record.** The formula lives in UIUX §3.2 (rewritten); `styles.css`'s §3
comment and `app.js`'s `lotH`/`EXPORT_GEO` comments restate it. `test/mobile.js`
gains a scenario that a wrapped item grows the lot and is drawn unclipped, and
that a pathological lot is held at the half-sheet cap; the pre-existing
empty-floor (122) and three-row (166) assertions stand unchanged.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## AA. A fourth category, and the All-Boards menu becomes a picker (issue #112)

### B74. A fourth board type — Learning, pale rose — and "All boards" becomes a category picker whose boards drill to their own screens; on mobile the picker is the Parking Lot turned into a 2×2 grid (extends B67's ladder with a fourth scene; supersedes B44's stacked mobile list and its drag-between-categories; re-tunes B63's head sizes; keeps B42/B68/B70's measured budget, B9's back gesture, B72's tray idiom)

Rob (issue #112): *"Add a new board category in pale pink: Learning Boards …
All 4 board categories are the 'All Boards' menu, not the boards themselves.
Move the boards within each category to their own screens … On Mobile Only:
'All Boards' menu … turns the parking lot pane into the 'All Boards' menu …
The category buttons fill the Entire parking lot space in a 2x2 grid. From top
left going clockwise: 'To Do', 'Notes', 'learning', 'ideas'."*

Three coordinated parts, resolved against the four principles at the top of
this file (capture precedes structure · positions permanent · zero cognitive
tax · every pixel earns its place).

**Part 1 — the taxonomy is four, and Learning is a whole scene.** The app has
had three categories since B42; "Ideas" and "Notes" already existed (`idea`
and `unsorted`, the latter labelled "Note Boards" since B63), so **only
Learning is new**. `BOARD_CATS` becomes `['todo', 'unsorted', 'learning',
'idea']` — the stacked display order (rail, drill, picker) reading To Do,
Notes, Learning, Ideas. `catOf()` gains `learning` to its named set; a record
with no category is still `unsorted` (B21's read-site idiom, untouched, so no
migration and no DB version bump). Learning renders as a whole scene, not a
badge: a **pale rose ladder** derived exactly as B67 derived green and violet
— rotate the To-Do ladder in hue, pin every rung's WCAG luminance, aim OKLCH L
and C. The rose binds the gamut a little harder than green/violet (L within
0.013, C within 0.012, `UIUX §2.2.2`); its dark rungs additionally sit at
To-Do's *near-exact* raw luminance, because they anchor the 18.33:1 and
12.36:1 ratios whose 2dp value turns on the fourth decimal — and being
near-black they have no visible chroma to spend there. Every table in
`UIUX §2` reproduces on the Learning ladder, and `test/tokens.js` now asserts
all of them against four ladders, plus the `§4.3` strike marks per ladder. The
values are in `UIUX §2.2.2`; `styles.css` gains the `#board[data-cat="learning"]`
rung block and the `.board-cat`/`.card-drag-ghost[data-cat="learning"]` tray
blocks, mirroring B67's three.

**Part 2 — "All boards" is a picker, and boards live on drilled screens.**
Before, the list showed every category's boards at once. Now "All boards"
raises **four category buttons**, and choosing one opens **that category's own
screen** (`renderCat`, one section via the shared `makeCatSection`). Routing is
**two levels of History state** — `{v:'list'}` the picker, `{v:'cat',cat}` a
drill — so the OS back gesture returns drill → picker → board (B9, never
shadowed); opening a board pops the two levels in one `history.go(-depth)`.
This is *less* cognitive tax, not more: the picker names four kinds before it
shows a single card, and a drilled screen shows one kind at a time rather than
three sections competing for a short phone's height.

**Part 3 — on mobile the picker is the Parking Lot.** Rather than a screen of
its own, mobile turns the **Parking Lot region into a 2×2 grid** of the four
category buttons, at the lot's current height (expanded with it). The tension
resolved: `#lot` normally shows the *current board's* parking-lot items, and
that data must not be destroyed by a transient nav surface. So the grid is an
overlay (`#lot-menu`) drawn *over* the lot — `#lot.menu-open` hides the lot's
own rule/header/items (`display:none`, not removal), and dismissing the picker
returns the real lot intact. The grid order is **clockwise from the top-left:
To Do, Notes, Learning, Ideas**, which a row-major 2-col grid delivers from the
DOM order `[todo, unsorted, idea, learning]` (`GRID_ORDER`) — genuinely
different from the stacked `BOARD_CATS`, because a column reads top-to-bottom
and a 2×2 reads clockwise. The board's own gesture recognizer, which captures
`#lot`, is taught to ignore `#lot-menu` so the buttons receive native clicks.
Desktop is untouched by this part: it keeps its always-visible rail (now four
sections), and its "All boards" fills `#list-view` with the same four-button
picker. (Pointer, 2026-09-16: the rail's always-visible geometry is superseded
by B118 — issue #211 — collapsed by default on wide; B100 has since retired
this desktop picker clause.)

**One design language across all three surfaces.** A category button — a
mobile grid tile or a desktop picker tile — is B72's framed tinted tray made
into a button: the family's `--card` ground and `--frame` inset frame with the
name centred. So the picker tiles, the drilled section trays and the rail
sections are the same four families told apart by hue, exactly as the boards
are (B67/B72).

**The head sizes re-tune, by B63's own criterion.** "Learning Boards" is the
new longest name and would truncate beside the New board control in the 300px
rail. B63 already sized the head "so the header keeps its whole name beside the
control"; extending that to the fourth, longer name, the head steps down from
24/18px at `0.05em` to **21px mobile / 15px rail at `0.02em`** (`UIUX §13.1`,
§10). Nomenclature is untouched — every category stays "X Boards" — only the
type is re-tuned, which is the lever B63 itself used.

**What is superseded, and what stands.** B44's stacked mobile list and its
drag-between-categories are superseded: the mobile drill shows one category, so
re-filing there is by opening a board, and drag-between-categories now lives
only on the desktop rail (B67/B72, still tested in `test/desktop.js` [D16]).
B42/B68/B70's *measured, never a constant* budget stands and is restated:
`catPageCap` gains a `drawn` argument so a single-section drill is told one
section is present and takes the whole screen (~30 cards a phone), while the
rail still splits four ways. B9, B18, B22, B72 are all untouched.

**The record and the tests.** Values in `UIUX §2.2.2` (the ladder, four
columns) and `§4.3` (strike marks, four columns); the nav and the head re-tune
in `UIUX §10`/`§13.1`. `test/tokens.js` adds the Learning ladder as the fourth
witness. `test/mobile.js` [19]/[19b]/[19c] are rewritten to the picker + drill
model (the grid's order and touch floor, the drill's pager and last-touch
order, the two-level back gesture); [20]/[22] test per-category creation and
the measured single-category budget on the drilled screen. `test/desktop.js`
[D16]/[D20] gain the fourth section in the new order.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B75. The anchor menu leads with navigation: `All boards · Export` (issue #113; supersedes the `Export · All boards` order recorded in B43 and B65)

The title-card menu read top→bottom `Export · All boards`. That was the one
menu in the app whose navigation item sat *last*: B43 itself moved the item
menu to lead with **All boards** on the reasoning that a four-item menu "reads
navigation first, then the item's own actions in rising severity", yet the
anchor menu — reached by long-press (A1/B43), by the `Menu` handle, and by
right-click (B65) — kept the older order. Two non-destructive items owe no
separator and no severity ordering, but they do owe consistency: the same
first move should open every menu. **Zero cognitive tax** is served when the
route back to the list sits where the hand already expects it. The array in
`openMenuFor`'s `anchor` branch now lists `COPY.boards` first and
`COPY.export` second; the single path feeds all three entry points at once
(B65). This supersedes the "anchor menu stays Export · All boards" clause of
B43 and the `Export · All boards` description in B65 — the handle is still a
second door to one room, only the room's two items now read in the app's
uniform navigation-first order. `test/mobile.js` [16]/[21] and
`test/desktop.js` [D21] are updated to pin `All boards` then `Export`.

---

**Source:** issue #113 (owner): “When selecting the ‘menu’ button on the title card, the order from top to bottom should read: ‘All Boards’, ‘Export’” — https://github.com/AlastairZeved/TheBoards/issues/113
### B76. The section header hangs below the rule as a tab in the rule's own ink (issue #111; supersedes B47/B54's "label above the rule" and B54's band budget; keeps B47's full-width rule and content-sizing, and B37's law)

Issue #111: the two band headers — *Components* (left), *Requirements* (right) —
floated **above** the rule as bare type on the band's dark water. The request:
move each to sit **on / just below** its rule, keep it centred and anchored to
that same line, and give it a **tight box filled with the rule's own colour**,
positioned so the rule and the box's edge overlap and read as **one cohesive
unit**.

**Ruling — the header is a tab hanging off the rule, not a caption above it.**
The label's top edge lands on the rule (`top: 100%` inside the zone, whose
bottom edge *is* the rule) and the tab hangs down into the free canvas. It is
filled `--frame` — the rule's exact colour (§2.5, B61) — so the 1px full-width
rule reads as the tab's own top border and line + label are continuous. The tab
is `width: max-content`, `padding: 2px 6px`, `border-radius: 0 0 3px 3px` (only
the two corners that exist below the rule, mirroring the compartment's `0 0 3px
3px` at the sheet's top). The interrogation surfaced the bridge that decided the
species: the compartment's handle (B65) is already a `--frame`-filled box
*bisected by an edge* carrying `--ink-dark` at 5.70:1; this tab is the same
pairing at the band's own closing line, so the label rebinds its ink to
`--ink-dark` via `.on-light` and clears the same 5.70:1. The header is furniture,
quieter than the interactive handle, so the padding is half the handle's (6 vs
12px) — the value earns its place against the tightest real zone (the mobile
*Requirements* column) rather than being chosen to fill space.

**The band budget loses the label term.** Since the label no longer occupies any
height *above* the rule, `bandRuleY`'s `+ 16.9 + 10` (B54's label + its
clearance) leaves the formula: `rule-y = 14 + max(2, lines) × 19.5 + 8` — **61
at the two-line floor, 81 at three lines** (was 88 / 107). Content, then the gap,
then the rule; the label hangs below on the canvas. The band is *shorter*, so the
free canvas grows; the compartment's `rule-y + 22` overhang and its occlusion of
the rule are arithmetically untouched, and the side tabs sit clear of the centred
card by construction.

**Screen and export follow one law, not one number (B34).** On screen the rule
is the mid-light `--frame`, so the tab's ink is dark (`--ink-dark`). In the PDF
export the rule is `PDF_INK` — dark — so the export fills the tab `PDF_INK` and
**reverses** the label to the paper tone (`PDF_PAPER`): white-on-dark where the
screen is dark-on-light, each reading strongly on its own ground. `EXPORT_GEO`
drops `bandClear` from `exportRuleY` and gains `labelPadX`/`labelPadY`; the draw
loop paints a filled `PDF_INK` box at `ruleY` and centres the label in it.

**The record.** The tab's values live in UIUX §3.1 (rewritten) and its budget in
the same section; §13.2's B54 measurement is annotated as superseded. `styles.css`
§3 and `index.html`'s band comment restate the reading order; `app.js`'s
`bandRuleY`/`EXPORT_GEO`/`exportBoardPage` comments restate the formula. The band
geometry assertions move with this ruling: `test/desktop.js` [D8]'s rule-y floor
becomes 61, and `test/mobile.js` [9c]/[11c] assert the label's top edge overlaps
the rule (was: bottom 10px above it) and that the tab carries a `--frame` fill.

---

**Source:** issue #111 (owner): “move the titles for ‘Components’ and ‘Requirements’ to below the boundary lines of their sections … anchored to the same boundary line, just underneath the line instead of the top” — https://github.com/AlastairZeved/TheBoards/issues/111
### B77. A category tile/tray re-asserts its own rung — To-Do included (issue #112 follow-up; corrects B74's picker/tray colour, which left To-Do with no block of its own)

The All-Boards menu drew the To-Do tile in the *current board's* colour: pink
while a Learning board was open, violet on a Note board, never To-Do's blue. B74
gave `idea`/`unsorted`/`learning` their own `#board`-scope-free
`.board-cat`/`.cat-button[data-cat=…]` rungs but, on the reasoning that "To-Do is
:root," gave To-Do none — assuming the tile would take `:root`'s
`--card`/`--frame`/`--water-*`. It does not: the mobile grid is `#lot-menu`
*inside* `#board[data-cat=…]`, and CSS custom properties inherit from the nearest
ancestor that sets them, so a To-Do tile with no block of its own inherits the
surrounding board's rung, not `:root`'s. **Every category — To-Do included —
re-asserts its own rung** so a tile/tray/section keeps its family's hue in any
board's scope. To-Do's block repeats `:root`'s exact values (UIUX §2.2), so the
unscoped desktop render is unchanged; only the leaked contexts are corrected.
`test/mobile.js` [19] gains a guard: over a non-To-Do board, the To-Do tile's
resolved `--frame` is To-Do blue `#698ebf`.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B78. The board categories are named "To Do · Notes · Learning · Ideas" — no redundant "Boards" (issue #112; supersedes the "…Boards" labels of B63's "Note Boards" and B74's "Learning Boards" in the category-name context)

The All-Boards menu, the mobile grid, the drilled-screen header and the desktop
rail heads all name the four board categories. Every one of B74's labels ended in
"Boards" — "To-Do Boards", "Note Boards", "Learning Boards", "Idea Boards" — which
in a list of *board categories* says the noun four times over: **zero cognitive
tax** is not served by a word every entry shares. The names become the owner's own
quoted words: **To Do · Notes · Learning · Ideas**. One source carries them —
`COPY[CAT_COPY[cat]]`, read by `makeCatSection` (head + aria-label) and the
picker/grid tiles — so all four surfaces move together. The storage keys are
untouched (`unsorted` stays `unsorted`, B63's split of key from label stands); only
the displayed label changes. B74's head-size re-tune is kept — the shorter names
simply clear their controls with room to spare.

---

**Source:** issue #112 (owner): “The category buttons fill the Entire parking lot space in a 2x2 grid. From top left going clockwise: ‘To Do’, ‘Notes’, ‘learning’, ‘ideas’” — https://github.com/AlastairZeved/TheBoards/issues/112
### B79. An installed PWA asks for its own updates — `registration.update()` on load and on every foreground (issue #111 follow-up; makes the CACHE-bump discipline actually reach installed apps)

`sw.js`'s version-stamped `CACHE` is only half the contract: it decides *which*
build is live, but a browser still has to re-fetch `sw.js` to notice — and it
throttles that check hard, so an installed PWA can serve an old cache for up to a
day after a deploy. A real device hit exactly this (a Z Fold 7 kept showing the
pre-B76 band while desktop showed the current build), and the repo has shipped
changes before that never reached installed apps (CLAUDE.md's shipping note). The
registration used to `register('sw.js')` and stop there — it never asked for the
update — so nothing pulled the new worker in until the browser got around to it.
It now calls `registration.update()` on load and again on every `visibilitychange`
to `visible` (a relaunched home-screen PWA foregrounds; it does not do a fresh
load). That installs the new worker promptly; because `sw.js` already
`skipWaiting()`s + `clients.claim()`s and serves stale-while-revalidate, the new
bytes land on the **next launch** — a deploy now reaches the app within a launch
or two instead of never. No forced mid-session reload: the update arrives when the
app is next opened, never yanking the user mid-thought, and this keeps the app's
update path identical to the one `test/sw-update.js` already exercises (its step-3
comment names `register()`'s per-load `update()` as the mechanism under test —
this is the call that had been missing). Note: this cannot rescue a client already
stranded on an `update()`-less build — that needs a one-time cache clear; it
prevents the next stranding.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B80. Dismissing the mobile keyboard puts the note away (issue #119)

On mobile a note's selected/active state *is* its edit mode — the `.note-text`
`contenteditable` holds focus; there is no separate `selected` on mobile (that is
desktop's, §8.5). So finishing a thought and pressing the keyboard's own hide
control ought to end with the note put away, the way tapping bare canvas already
ends it (B41). It did not: the editor kept focus, so the note stayed live, and the
next tap anywhere was spent only committing/dismissing it (`handleTap`'s
`isEditing → blur → break`) — a dead first tap before any real action, the "requires
a tap before any other action" in the report. **Zero cognitive tax:** the interface
must never be thought about, and a note that will not let go until it is poked once
is exactly a thing thought about.

The fix lives where the keyboard is already seen — `onViewportResize`. B28 held the
sheet still while the keyboard is *up* (the viewport shrinks; relayout is deferred so
the sheet does not flap). B80 adds the other edge: while the same note holds focus,
a viewport that grows back is the keyboard *leaving*, and the note is blurred —
which runs the existing commit-on-blur `focusout` path (B41), committing the text,
deselecting, and landing the deferred layout in one motion. Open vs. dismiss is told
apart with no new event and no timer: the current edit's own floor — the smallest
visual-viewport height seen since focus (`editVVFloor`, reset to `Infinity` on
`focusout`) — only ever drops while the keyboard opens, so any growth past it by
`KB_HIDE_SLOP` (120 px, comfortably above URL-bar/inset jitter and far below any real
soft keyboard) is the retraction, and measuring against the fixed floor catches it
even when the browser animates the return in steps. B28's deferral is untouched and
still load-bearing; this reads the same signal for the departure B28 never handled.
Graceful on browsers without `visualViewport` (the guard falls back to `innerHeight`,
which a keyboard may not move, so the fix simply does not fire — same posture as B28's
own fallback). Desktop is unaffected: the whole branch is behind `!isDesktop`, and
desktop already deselects on Escape and click-away (§8.5, B41).

---

**Source:** issue #119 (owner): “When keyboard is put away, deselect active text note. Currently it remains selected and requires a tap before any other action which is incorrect” — https://github.com/AlastairZeved/TheBoards/issues/119
### B81. Actions commit on release, with no latency; only B18's drop-guard survives (supersedes B18's 400 ms window and its (a) fill / (b) controls-fill / (c) ghost; discharges B18's and B27's "impermanence" clauses by re-interrogating the number to zero; revises B22's and B27's "creation / swap / menu keep the window"; keeps B18(d) "first tap wins")

The task: drop the 400 ms `delayAction` latency. B18's own impermanence clause
asked for exactly this — "400 ms is a felt value, given not derived; re-interrogate
it on the device rather than defend it, the structure holds at any duration, and
only the number would move" — and B27's added, of mobile capture, "if it is ever
re-interrogated to zero, this entry collapses into it and B18c's ghost goes with
it." This is that re-interrogation, to zero, for every action at once. Zero
cognitive tax (the interface is never thought about) is served better by a result
that is simply *there* on release than by a 400 ms beat the user has to read as
"I was heard."

`delayAction(ackNode, fn)` — set a guard, wait `ACTION_DELAY`, then fill and run
`fn` — is replaced by `commitAction(fn)`: run `fn` now, then hold the guard for
`ACTION_DELAY`. The latency is gone; the acknowledgement is the instant result
itself (the note vanishes, the toast rises, the menu opens, Copy's row drains).

**(a) What the guard is for, and why it stays.** B18(d) stands: an impatient
double-tap must not delete twice or complete-then-uncomplete, and a phantom
compatibility event must not fire an action's evil twin. So a *consequence* —
Complete/Restore, Copy, Delete, Undo, a menu item, board create/delete — commits
at once and then holds `pendingAction` for `ACTION_DELAY` (400 ms, now purely a
re-fire guard, no longer a felt beat), dropping a second tap inside it. First tap
still wins; only the order of "act" and "wait" swapped — trailing edge to leading
edge.

**(b) Navigation and capture take no guard.** Opening a menu, swapping boards, and
entering an editor commit a *view*, not a consequence — the same "commits nothing"
that already put desktop selection (B22) and rail page-turns (B42) outside the
window, so a leading-edge guard here would only clip the very next tap on the
surface just revealed (a menu that opens instantly must not swallow the first tap
on its own item). Capture — a note or lot line — self-heals: creating a second
frame focuses its editor and blurs the first, which is empty, which B8 discards
(B27's argument, now true on desktop too). So all four run raw and instant, on
desktop as on mobile — collapsing B27a's desktop/mobile split and retiring B18c's
`.tap-ghost` with it.

**(c) The window's whole visual apparatus is retired.** With no 400 ms to fill,
B18(a)'s "fill the window, empty is a dropped tap" and B18(b)'s content-thickens /
controls-fill lose their subject. The `.tapped` weight on notes / anchors / lot
lines and the fill-or-drain on the menu, toast, board rows, the primary control,
the title handle, the selection buttons and the pane delete are all deleted, as is
the `.tap-ghost`. The drag / pinch `.pressed` weight (§4.2) is a different signal —
"I have this" while a gesture is live, not an action acknowledgement — and is
untouched.

**Accepted consequence, precedented by B27a.** With swap instant, a fast
double-tap on a board card can swap *and then* drop a stray empty note on the new
canvas; it self-heals on blur (B8), double-tapping a card is not a real gesture,
and masking it is not worth re-adding latency — exactly B27's "one note survives,
at the last point tapped," extended to the swap.

**The record.** The behaviour and the retirement live in UIUX §5's
"Acknowledgement" subsection (rewritten) and its token-migration table (the
tap-ghost's low-alpha line annotated retired). `sw.js`'s `CACHE` bumps to v31.
`styles.css`'s "Tap acknowledgment" section collapses to a one-line tombstone;
`app.js` replaces `delayAction` / `makeTapGhost` with `commitAction` and repoints
its call sites by the (a)/(b) split above. The tests that measured the window move
with the ruling: `test/desktop.js` [D2]/[D18] assert instant capture with no
ghost and the Complete / Copy cases assert the action lands at once; the menu,
cat-add and title-handle assertions drop `.tapped`; `test/mobile.js` does the same
for cat-add and the title handle; `test/tokens.js` drops the `.tapped` selectors
from its accent-on-chrome whitelist and pins v31.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B82. The drilled category is a panel that rises to a third of the viewport, three cards across, each a two-line title over a "Last Updated" stamp (issue #125; refines B74's full-screen mobile drill to a slide-up panel; supersedes B70's two-across for the mobile list, and B68's 44px height for the mobile drilled card only; keeps B42/B68/B74's measured budget, B9's back gesture, B28/B32's keyboard-safe layout, B24's setTimeout-sequenced teardown, the rail's own card untouched)

The task, issue #125: drilling "All boards → a category" should not replace the
board. Four changes, one panel.

**The panel.** B74 made the mobile drill a full-screen list on `--chrome`; it
hid the board whole. That reads against *work performed stays visible* (PRD §1):
the boards you are choosing between are siblings of the one you were just on, and
losing it to browse them is a cost. So the drilled category now **rises from the
Parking Lot to a third of the viewport** — the board stays visible above it,
the panel closing the sheet's bottom the way the Lot it rose from does. Its
height is `⌊window.innerHeight / 3⌋`, computed in JS and published as
`--list-panel-h` (the Lot's own `--lot-h` pattern), **never a CSS `vh`** — B28/B32
hold the mobile layout still under the soft keyboard by measuring
`window.innerHeight`, and a `vh` here would reintroduce exactly the viewport
coupling those rulings removed. The rise is the `#toast` `translateY` idiom
(parked at `translateY(100%)`, shown at `translateY(0)`) on §8's one
`cubic-bezier(0.22,0.61,0.36,1)` at 200ms; the global reduced-motion kill-switch
lands it instant, and the teardown is **setTimeout-sequenced, never
`transitionend`** (B24) — a re-open before the timer fires re-adds `.show` and
the guard leaves the panel up. Its top edge is the Lot's own `--frame` rule
(B61), rounded and on `--elevation` as the transient surface it is (§2.4).
**Desktop keeps the full-screen overlay** (B74's `#list-view`, `inset:0`): the
always-on rail already leaves the board reachable there, so the panel is the
phone's alone. (Pointer, 2026-09-16: B118 — issue #211 — makes the rail
collapsible on wide, collapsed by default; this rationale now reads subject to
B118.) The value lives in `UIUX §10`.

**Three across.** The shorter panel would show fewer boards than B74's full
screen, so the horizontal axis buys the density back: B70 halved the card to
two-across when §6's floor closed the vertical; B82 takes it to **three**, on
the same reasoning — a card names a board and does not need the sheet's width.
`LIST_CARD_COLS` = 3, `.cat-cards` three columns, mobile only (the rail stays
one — `PANE_W` is 300). Roughly six cards a page on a 384×846 phone (three
across, two rows) — the density traded for keeping the board in view.

**Two-line title.** At a third the width a one-line ellipsis cuts most titles at
a word or two, so the mobile card's title **clamps to two lines**
(`-webkit-line-clamp: 2`) and then indicates truncation with `…` — the first
place this app wraps a card title. `UIUX §10`'s "truncation always indicated"
is unbroken; the mark is the clamp's, not `text-overflow`'s.

**Last Updated.** Every card now carries a **`Last Updated: MM/DD/YY`** line
(zero-padded month and day, two-digit year — `formatMDY`, a second formatter
beside the PDF export's long `formatDate`), bottom-right under the title on the
mobile card and inline on the rail. The date is the record's own `updatedAt`,
which B69 already stamps on every committing action — so **nothing new
persists**, no DB version moves; where B74's card showed a bare creation date on
untitled boards alone, the stamp is now on every card, titled included. This
makes the card taller than §6's floor (`LIST_CARD_H` = 76px), so `catPageCap`
budgets the mobile panel against that height and the rail against its own 44px —
the one shared row-height constant splits in two. State is never colour alone
(§1): the title is the fill's own pole, the date its quieter sibling.

**The record.** The values live in `UIUX §10` (the third-viewport fraction, the
three-across count, the two-line clamp, the `MM/DD/YY` format, the 76px card).
`sw.js`'s `CACHE` bumps to **v32** (and `test/tokens.js` pins it). `app.js` gains
`LIST_CARD_H` / `LIST_PANEL_FRAC` / `listPanelH()` / `formatMDY()`, sets
`--list-panel-h` in `applyLayout`, splits `catPageCap`'s row height by surface,
puts the stamp on every card in `fillRowContent`, and slides the panel in
`showCat` / out through a new `hideListView` (used by `showBoardFromList` and the
drill→picker `popstate`). `styles.css` adds the mobile `#list-view` panel and its
`.show`, restacks the mobile `.board-row`, and takes `.cat-cards` to three
columns. `test/mobile.js` [19b]/[22] move to three-across and assert the panel's
third-height geometry, the board visible above it, and the `Last Updated` line;
the desktop drill and its tests are untouched.

## AB. The board's actions come out of hiding (issue #126)

**Source:** issue #125 (owner): “the menu should slide upwards from the parking lot to a third of the total viewport height to keep visibility of current board being viewed” — https://github.com/AlastairZeved/TheBoards/issues/125
### B83. All boards and Export become a flat-tab row above the Parking Lot (supersedes B65's `Menu` handle; re-homes the anchor menu's entry points onto declared controls; keeps the mobile anchor long-press and B75's item order)

**The principle: a declared control beats a hidden gesture, and a control that
names its act beats one that names a mechanism.** B65 already made half this
argument — the anchor menu (`All boards · Export`) was reachable only by a
gesture nothing on screen declared, so it added a `Menu` handle to the title
card. But the handle answered the gesture's invisibility with a control that
still said only *"Menu"* — the name of a mechanism, not of anything the reader
came to do — and put it in the compartment's bottom-right joint, a place found
by looking rather than by expecting. **Zero cognitive tax** is not paid by
trading an undeclared gesture for a declared riddle. Issue #126 asks for the
actions *themselves* to be present. The ruling puts them there.

**Ruling — two flat tabs, `All boards` and `Export`, hovering just above the
Parking Lot.** They are the mirror, at the sheet's other end, of the band's two
header tabs: one section of furniture closing each end of the sheet with a
labelled tab, the free canvas between. Each tab carries its drawn mark (§13.3,
`GLYPH.boards`/`GLYPH.export`) and its word, so it is recognised, not decoded.
On both platforms the row invokes the two actions directly; the popup menu is no
longer the only container they live in.

**Flat, not tactile — the interrogation, not a default (the owner's call).** The
obvious move was §14's tactile signature (offset shadow, press-translate) that
`New board`, the selection buttons and the retired handle all wear. It was
rejected on what the tabs *are*: **All boards** navigates and **Export** leaves
the device — neither acts on a note. §14's tactile family is the set of controls
that say *"I have your content"*; these two belong instead to the sheet's own
furniture, so they wear the band label's flat box (`--frame` fill, `--ink-dark`
via `.on-light`, 13px/600, `padding: 2px 6px`), not a raised chip. The one
change from the band tab is a **symmetric** `border-radius: 3px`: the band tab
rounds only its lower corners because it merges with the rule above it; this row
hangs beneath no rule, sitting 8px clear of the lot's top edge, so it reads
free-standing and rounds all four. `--frame` rotates with `#board[data-cat]`
(B67), so the row inside board scope takes the board's hue for free — no
re-assert needed, the leak B77 warned of runs the other way.

**The toggle states its act, not its state (B43/B71's grammar).** On the board
the first tab offers **All boards**; while the All-Boards surface is up — the
desktop list overlay, or the mobile lot-grid that draws over the Parking Lot
(B74) — the same tab offers **This board**, the scope-antonym that returns you.
One mark throughout (the boards domain), the label alone flips, so state is
never colour (§1) and no `aria-pressed` rides alongside a label that already
names the act. It is pure navigation, so it runs raw — `goToList` /
`returnToBoard`, no `commitAction` (B81). **Export** commits (a file leaves the
device), so it takes `commitAction`'s drop-guard, exactly the anchor menu's
Export item, and reads `current`, exactly that item's call site (issue #43).

**The recognizer never has to classify it.** The tabs are native `<button>`s;
`onPointerDown` returns for anything inside `#board-actions` before a gesture is
armed — the `#lot-menu` passthrough's own precedent (B74) — so their clicks fire
and no note is captured under them, and **no `classifyTarget` branch is added**
(the handle needed one; native buttons do not). The container is
`pointer-events: none`, a positioning frame exactly like a `.band-zone`, so a
press on bare canvas *beside* the tabs still reaches the recognizer and captures
a note; only the tabs are live.

**The touch floor, without growing the box (B7).** The flat tab is well under
§6's floor, so it carries the note's decoupled `--hit` collar, set on
`#board-actions` in `updateBoardGeometry` (the line the handle's own `--hit`
vacated) and measured off the row — its width spans the sheet, so only the
height term binds. The collar is **asymmetric, spent entirely upward** onto the
canvas, because downward is the Parking Lot's own furniture; where a note (`z-2`)
overlaps it the note wins, and a bare-canvas tap into it fires the tab — the same
reading B65's collar had, mirrored to the opposite edge. It is also focusable
inside `#board`, so it inherits the handle's keyboard guard: the row
`stopPropagation`s Delete/Backspace (and Enter, whose native default still fires
the tab's click) so the desktop grammar, which keys off `selected` alone, cannot
destroy the note underneath; Escape passes through.

**What is removed.** `#title-menu` entirely — its markup (`index.html`), its CSS
and `::before` collar (`styles.css §3`), and its handlers `openTitleMenu` /
`tapTitleMenu` / the keydown, its `classifyTarget` and `handleTap` branches, and
the `el.titleMenu` reads in `updateBoardGeometry`, `closeMenu` and `goToList`
(the last keeps B65's care — on desktop the list overlay occludes the row, so
focus on a tab is blurred there; on mobile the row stays visible above the grid,
so it is kept). The **mobile anchor long-press is untouched** (its removal, and
the note/lot long-press, belong to issue #125's unit); the desktop right-click on
notes and cards is untouched. With the handle gone, desktop loses nothing B65
gave it: the row is that platform's declared route to the two actions, where no
long-press is armed (B19) and `contextmenu` routes notes alone.

**The record.** The rendering values — placement, the flat-tab box, the collar
and the toggle — live in `UIUX §3.3` (new) and `§14` (the handle's fifth-species
block rewritten as the flat-tab species); `§6`'s asymmetric-collar example and
`§7`'s menu-door paragraph move to the row, and `§7`'s Anchor-menu row is
corrected to **All boards · Export** to match the shipped order (B75) the row
now shares. `sw.js`'s `CACHE` bumps to **v33** and `test/tokens.js` pins it.
`test/mobile.js` [21] and `test/desktop.js` [D21] are rewritten off the handle
onto the row — it clears the floor, opens the list, exports a PDF, and the old
`#title-menu` is asserted absent; [16]/[15] (the mobile anchor and board-row
menus) still assert their menus unchanged.

**Impermanent, named so it is not rediscovered.** The row is a home for exactly
two board-level actions. The day a third is asked for, or a note-level action
wants to sit beside them, this becomes a question about what the row is for —
not a question about where to wedge one more tab.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B84. A note wears its own action toolbar; the note long-press menu and the desktop right-click note menu are retired, and a note has a real minimum width (issue #126; supersedes the note branch of the long-press menu A1/B43 and its B71 Highlight item; supersedes the desktop right-click note menu of B22/issue #55; supersedes the `#selection` overlay's Complete·Copy·Delete of B22/issue #59; leaves the anchor board menu B75/B34, `buildMenu`/`closeMenu`/`#menu`, the lot's inline desktop actions B25, and the board-card menu B24 untouched)

The principle is **declared controls over hidden gestures**, resolved against
"capture precedes structure" and "zero cognitive tax" (PRD §1, UIUX §1). A note's
actions — Complete/Restore, Highlight, Copy, Delete — were reachable only by a
gesture with no visible affordance: a 500 ms long-press on mobile, a right-click on
desktop. Nothing on the note said they existed; a first-time hand had no way to find
them, and the long-press competed with the drag that moves a note. The actions now
live on a **row the note wears** — four flat tabs on its top edge, in the menu's B43
order (Complete/Restore · Highlight · Copy · Delete, Delete last in `--danger`) — so
the control is seen, not remembered.

**On select, not always-on** (the owner's call). An always-drawn row would tax every
note on the board with chrome that four of five notes are not being acted on; it is
drawn always but shown only when the note is *engaged* — selected on desktop (the
same `#selection` state, B22), focused on mobile (an active note by editing it, a
completed one by taking frame focus — either way `:focus-within`). One state raises
the resize frame and the row together; the same click that reveals the actions is the
one that was already selecting the note, so no step is added.

**Built into the note, so it belongs to the note.** The row is a child of the note
element (`makeNoteToolbar` in `makeNoteEl`), which means it scales with the note and
can never be wider than the note it acts on — the interrogation's "does the form
borrow from the function" answered by construction. Its buttons are routed through the
gesture recognizer, not native clicks, because `setPointerCapture` retargets a click
inside `#board` (the same reason `.sel-btn` is routed, B22): `classifyTarget` gains an
early `note-tb-btn` branch that claims them before the press reaches the note beneath.
State is never colour alone (UIUX §1): Complete flips its mark (check ⇄ undo) and
label; Highlight flips its label and shows an inset while the note wears the amber
wash, whose wash is the real signal; the row's job is to *trigger and name* the
completion veil and the highlight wash, not to be them.

**A real minimum width** (issue #126 pt 4.1). `NOTE_MIN_W` was only a wrap-cap floor
(60), not a rendered minimum — an empty or short note drew narrower than a toolbar,
with nowhere to seat the row. It is raised to **132** and made a true minimum: a CSS
`min-width` on a non-empty `.note-text`, the wrap-cap floor (`noteMaxW`), and the
drag/resize width floor all read the one number, so a note can never be *sized*
narrower than its own row. `createNote` floors the new note's `x` a toolbar-width back
from the right edge for the same reason. The empty-note rule (§6.2, no frame until the
first character) is kept coherent: the `min-width` and the row are both gated on
non-empty, so an empty note is still frameless, rowless and free to be its true width.

**What is removed, and what is deliberately not.** Gone: the note's long-press arming
(`HAS_MENU` keeps only `anchor`), the desktop note `contextmenu` listener, and
`openMenuFor`'s note/lot item branches — plus the `#selection` overlay's own
Complete·Copy·Delete, now redundant with the row. Kept whole: the anchor menu
(`All boards · Export`, B75/B34 — the board is still reachable by long-press before
its card is; mobile [16] proves it), the shared `buildMenu`/`closeMenu`/`#menu`, the
board-card delete menu (B24), and the desktop lot row's inline actions (B25). **Accepted
gap:** the lot's *mobile* item actions rode the same long-press menu and are not rebuilt
here (the owner scoped a lot toolbar out) — desktop lot rows keep theirs; a mobile lot
item can still be edited by tap, only not completed/copied/deleted until a lot toolbar
is a future unit.

**The record.** The rendered values — the row's tab metrics, the 132 minimum, the
12 px offset above the frame — live in `UIUX §4.5` and `§14`. `sw.js`'s `CACHE` bumps
to v34. The menu-driven tests move to the row: `test/mobile.js` [8]/[17]/[17b] drive
the on-select toolbar (genuine CDP touch, B27b) and assert a note long-press opens no
menu; `test/desktop.js`'s note-action, note-Copy and multi-select-menu blocks drive
the row (or the retained `#selection` frame) and assert a right-click opens no app
menu. The board-menu/export tests (mobile [15]/[16], desktop anchor/export) are
untouched and still pass.

**Source:** issue #126 (owner): “Add a horizontal row of small, pill shaped buttons, Above every new note created, anchored to the upper boundary edge of the note card … Button #1: Complete/restore … Button #2: highlight/de-highlight … Button #3, Copy … Button #4: delete” — https://github.com/AlastairZeved/TheBoards/issues/126
### B85. The Highlight and Copy tabs take fixed identity fills — amber and blue (issue #131; refines B84/UIUX §4.5, which filled all four tabs with `--frame` and told them apart by glyph; adds `--accent-copy`; leaves the highlight STATE — the B71 wash and its inset border — untouched)

Resolved against *zero cognitive tax* and *every pixel earns its place*. The note
toolbar (B84) told its four tabs apart by glyph alone — all on the one `--frame` fill,
save Delete's `--danger`. The owner asked for the Highlight tab yellow and the Copy tab
blue, so a hand finds each without reading the mark. Highlight reuses the existing amber
`--highlight` (§2.6.1, `#F2D64B`); Copy takes a new fixed blue `--accent-copy` `#698ebf`.
Both are **fixed** like `--danger` — they do not rotate with board type — so the fill is
button *identity* (which action), not board hue and not note state. That keeps *state is
never colour alone* (§1) intact: the note's Highlight STATE stays the amber wash plus the
inset border (B71), which the tab only triggers and names; the tab's own amber is chrome.
The owner accepted that on a To-Do board, where `--frame` is already `#698ebf`, Copy's
fixed blue equals the frame-filled Complete tab — the one board where the two blues meet.
Complete keeps `--frame`. Values in UIUX §2.6.1/§4.5; `sw.js` `CACHE` → v35.

**Source:** issue #131 (owner): “Change highlight buttons color to yellow / Change copy buttons color to blue” — https://github.com/AlastairZeved/TheBoards/issues/131
### B86. The note toolbar and board-action tabs grow to finger size (issue #132; re-tunes the tab metrics of B84/UIUX §4.5 and B83/UIUX §3.3; keeps §6's 44/24px hit floor and B7's decoupled `--hit` collar; stays within `NOTE_MIN_W`)

Resolved against *zero cognitive tax*. The flat tabs were sized to the band label they
borrow (`2px 6px`, a 16px mark), tighter than a fingertip wants. The note tabs grow to
`7px 6px` with an 18px mark; the board-action tabs to `8px 12px`, 14px text, a 16px mark.
The note row's width budget holds: `(18 + 12)×4 + 3×3 = 129 ≤ 132` (`NOTE_MIN_W`), so a
note is still at least a toolbar wide and never narrower. The 44px touch floor is met by
the decoupled `--hit` collar (B7), not the visible box, so growing the box only shrinks
the collar — on the note side the hand-tuned `::before` retunes to `top: -12px` for the
taller box; the board side's collar is JS-computed and adjusts itself. Values in UIUX
§3.3/§4.5; `CACHE` → v35.

**Source:** issue #132 (owner): “Make all buttons slightly larger to accommodate finger size. Includes note card buttons and menu buttons above parking lot” — https://github.com/AlastairZeved/TheBoards/issues/132
### B87. The note toolbar and board-action row anchor flush on the boundary edge — the gap is removed (issue #133; supersedes B84/UIUX §4.5's "12px above the note's top edge" and B83/UIUX §3.3's "8px clear of the lot's top edge, free-standing"; re-tunes `TB_ROW_H`)

Resolved against *every pixel earns its place*. Both rows hovered above their boundary
with a gap — the note toolbar 12px above the note's top edge, the board-action row 8px
above the lot. The owner reads the gap as detached; a row should sit ON the edge it
belongs to. The note toolbar drops to `bottom: 100%` (its bottom edge flush on the note's
top edge) and the board-action row to `bottom: var(--lot-h)` (flush on the lot's top
edge). The note's flip threshold `TB_ROW_H` follows the gapless row from 34 to 32, so a
note near the sheet top still flips its toolbar to just inside the edge. The tabs keep
their round corners; nothing merges with a rule. Values in UIUX §3.3/§4.5; `CACHE` → v35.

**Source:** issue #133 (owner): “Bring all menu buttons for note cards and parking lot Down so they sit directly on the upper boundary edge Of note card/parking lot” — https://github.com/AlastairZeved/TheBoards/issues/133

**Pointer, 2026-09-16:** B120 — issue #173 — supersedes this ruling's note-toolbar clause only: the row moves to the note's BOTTOM edge, flush as ruled, and the flip re-aims near-sheet-bottom. The board-action row's clause — flush on the lot's top edge — stands.
### B88. The note toolbar and board-action row left-anchor, not centred (issue #134; supersedes the centred cluster of B84/UIUX §4.5 and B83/UIUX §3.3)

Resolved against *every pixel earns its place*. Both rows were centred on their object.
The owner asked for them pinned to the far left, running rightward along the same top
edge, so the first tab always sits in the same place. The note toolbar drops
`left: 50%`/`translateX(-50%)` for `left: 0`; the board-action row drops
`justify-content: center` for `flex-start`. The note row's ≤129px width, left-anchored,
fits inside a 132px note (B86) — which is why B86 held the tab size under `NOTE_MIN_W`.
Values in UIUX §3.3/§4.5; `CACHE` → v35.

**Source:** issue #134 (owner): “Move all buttons to the far left Of note card and parking lot, not centered.” — https://github.com/AlastairZeved/TheBoards/issues/134

**Pointer, 2026-09-16:** B120 — issue #173 — supersedes this ruling's note-toolbar clause only: the row is now CENTRED on the note, anchored at its bottom edge. The board-action row's left-anchor stands.
### B89. The board-list category buttons take their board's water field as ground, not `--card` (issue #135; supersedes B74/UIUX §10's "the picker button is the `--card` tray, enlarged" for `.cat-button`; extends B77's per-family re-assertion to `.cat-button`'s `--water-*`)

Resolved against *every pixel earns its place*. The All-Boards picker tiles grounded in
the family's `--card` (near-black; To-Do's sits 1.10:1 above `--deep`), which the owner
reads as dull — the tile did not show its board's colour. A tile now grounds in the
family's water gradient `linear-gradient(180deg, var(--water-top), var(--water-mid))`, the
same fill the board's own list cards wear (`.board-row`/`.pane-card`), so a tile previews
its board; the `--frame` inset frame and the `:active` press-flip are unchanged. The
"deep blue/green" a person reads is this water field, not the near-black literal `--deep`.
Because the mobile 2×2 grid (`#lot-menu`) lives inside `#board[data-cat]`, a water token
read on `.cat-button` would inherit the open board's hue there and fall back to To-Do's on
the desktop picker (outside board scope) — so the four per-family `--water-*` blocks now
re-assert on `.cat-button[data-cat]` too, exactly the leak B77 closed for `--frame`/`--card`.
Scope is `.cat-button`; the section trays `.board-cat` keep `--card`. Values in UIUX
§2.2.2/§10; `CACHE` → v35.

**Source:** issue #135 (owner): “Use the board background color as the category buttons background color” — https://github.com/AlastairZeved/TheBoards/issues/135
### B90. Mobile — a first tap selects and reveals the note's toolbar with no keyboard, a second tap edits with the caret at the end (issue #136; supersedes B84's mobile "engaged = editing / `:focus-within`" reveal and, for a note edit, B14's caret-at-touch-point; adds the `.engaged` state; keeps B27a's synchronous focus, B81(b)'s raw edit-entry, B22's no-write-on-select)

Resolved against *capture precedes structure* and *zero cognitive tax*. On mobile,
engaging a note WAS editing it — one tap opened the keyboard, so a note could not be
selected (its toolbar shown) without editing, and the caret landed at the touch point.
Desktop already had the select-then-edit step via `selected`; mobile lacked it. A mobile
`engaged` id now adds `.note.engaged` on the first tap: the toolbar shows with no focus,
no keyboard and no write (B22 — the select tap must not `surfaceNote`, which saves). A
second tap on the engaged active note edits it, synchronously inside `pointerup` so the
keyboard rises (B27a), with the caret at the END (`editText` with no coordinates →
`caretToEnd`, as desktop's B26; a deliberate override of B14 for a mobile note edit).
Tapping empty canvas or the lot while a note is engaged deselects first and creates
nothing; a further empty tap then creates, so an empty-area tap with nothing engaged still
makes a note, unchanged. Edit-entry runs raw, not through `commitAction` (B81(b) —
entering an editor commits a view, not a consequence). A completed note only ever engages
(it never edits, §4.3). The engaged note rises in z-order like desktop selection; its id
clears on tap-away and on delete, and the now-orphaned `editNoteText` wrapper is retired.
Caret value in UIUX §5; `CACHE` → v35.

**Source:** issue #136 (owner): “tap a note once to select it and reveal buttons, tap a note a second time to edit it and open keyboard. Cursor placement is always at end of text.” — https://github.com/AlastairZeved/TheBoards/issues/136
### B91. Notes can be linked — a thin line the user draws between two notes, armed by a revived note long-press (mobile) / right-click (desktop) (issue #142; partially reverses B84's retirement of the note long-press/right-click menu, for a NEW relational plane only; extends B67's per-type `--frame`; keeps B84's toolbar for per-note state, B81's commit-on-release, B31/B8's husk sweep, UIUX §9's undo)

Resolved against **relationships asserted not inferred** (PRD §1) — the board's
first inter-note structure, and the first time it renders a relationship the user
*asserts* rather than one it infers. A link is a 1px `--frame` line between two
notes' centres; no label, no arrowhead — just the line the user drew on purpose,
below the notes, consistent with "structure is asserted by where things sit."

**How it is armed — and the B84 tension, owned.** The issue asks for *long-press a
note → Link → tap another note*. But B84 (issue #126) had **retired** the note
long-press menu on the principle *declared controls over hidden gestures*, moving a
note's actions onto its on-select toolbar; B84/#4 also removed the desktop note
right-click. The owner chose to revive the long-press exactly as the issue writes
it. B91 scopes that revival honestly: the revived menu is a **new plane — inter-note
RELATIONAL actions (Link)** — kept distinct from the toolbar's per-note **STATE
actions** (Complete/Highlight/Copy/Delete), so the two do not compete and B84's
discoverability win stands untouched for the state actions. Mobile arms Link by
long-press (`HAS_MENU` regains `note`); desktop by right-click (a fresh `contextmenu`
listener on `#board`, the parallel B84 removed) — one item each, `Link`. The revived
gesture is hidden, so it is *named twice*: the menu item says "Link", and a persistent
hint toast ("Tap/Click another note to link") states the mode while it is armed. The
next tap on a **different** note connects it (through `commitAction`, B81 — a
consequence); a tap on empty canvas / lot / anchor / the source, a drag, or Escape
cancels; arming itself runs raw (navigation, B81 — and a menu item may now opt out of
`buildMenu`'s drop-guard so a fast target tap inside the 400 ms window is not swallowed).

**Removing a link — toggle-to-unlink (the owner's call).** Starting a link between two
notes that are *already* linked removes their link instead of duplicating it. Same
gesture, no new affordance, and — since the line is `pointer-events:none` (it must be:
hit-testing is `target.closest()`-based, so a hittable line would steal a note's tap,
the issue's "links shouldn't intercept taps") — nothing to hit on the line itself.
Both directions offer the 5 s Undo (UIUX §9), captioned "Linked" / "Unlinked".

**Data & integrity.** A board record gains `links: []` — unordered `{id,a,b}` note-id
pairs. It persists with the whole record (`idbPut`), so no IndexedDB version bump; a
legacy board reads `links` through the B21 default. Deleting a note removes its links,
and the note's one Undo restores them with it (exact prior state, UIUX §9). A note
swept as an empty husk (B8/B31) drops its links in `sanitizeBoard`.

**Pointer, 2026-09-16:** B120 — issue #173 — extends this menu's item scope: the note
menu gains a second state act, "Add Title", arming the note's optional Title. The
relational Link plane and B114's Copy-first order stand.

**Render & export.** The line lives on one `<svg>` layer in `#board` space, a sibling
of the notes like `#selection`, so it rides the single render transform and its
endpoints are plain board-logical centres — recomputed on every path that moves a note
(drag, pinch, resize, relayout). Its z-order is the issue's "z-index: 1.5" made valid:
integer `z-index: 1` (below the z:2 notes) plus DOM order after the static furniture
(above the z:1 furniture), since fractional z-index is invalid CSS. The stroke is
`--frame`, so it rotates hue per board type for free (B67), kept a crisp 1px at any
render scale by `non-scaling-stroke`. The link travels into the PDF (page 1, under the
cards) as a neutral hairline, from the same export-geometry centres the notes use.

Rendered values (stroke, layer z-order, hint/menu copy, the `link` mark, PDF weight)
in UIUX §4.6/§13.3; `CACHE` → v36.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## AC. Export chooses, Import joins the row, the anchor menu retires (issue #140)

### B92. The board-action row grows a third tab, Import; Export opens a PDF · JSON choice menu; the anchor long-press/right-click menu is retired outright (issue #140; supersedes B83's "exactly two board-level actions" clause and the anchor-menu survival that B83/B84 carried forward from B75; leaves B75's board-card menu, B24's lot menu on desktop, and B91's note Link menu untouched)

**The principle: a hidden route whose every destination sits on a declared
control is chrome without a job.** B83 put `All boards` and `Export` on the
board-action row and left the anchor long-press/right-click menu standing
behind them — defensible then, because B75's anchor menu was the older
institution and nothing had replaced its *route*. Issue #140 asks the row to
grow, and in doing so names the end-state: with **Import** joining as a third
flat tab, every item the anchor menu ever carried (and its own two actions)
lives on a visible, labelled tab one glance away. The menu's remaining job was
to duplicate a door the reader is already standing in front of, invisibly. It
is retired outright — `HAS_MENU` drops `'anchor'`, `openMenuFor` answers
notes alone, and a long-press or right-click on an anchor/canvas/lot now does
what B5 already says an unfinished gesture does: nothing. The owner's
correction is recorded as the ruling: the row's tabs exist precisely so no
hidden menu is needed, and the leftover was an omission from B84's sweep, not
a live decision. **The note Link menu (B91) is untouched** — its item exists
nowhere else, so its hidden route is still the only route.

**Ruling — three flat tabs, `All boards` · `Export` · `Import`, and Export
opens a two-item choice.** Import takes the third position (right of Export,
issue's own words), the row's exact `.board-action` flat-tab species, the
`GLYPH.import` mark — the export arrow read the other way, arriving *into*
the tray, so the pair reads as one family with opposite directions — and the
same asymmetric `--hit` collar (the row's measurement in `updateBoardGeometry`
is unchanged; it reads the row's height, which three tabs of one species do
not alter).

**Export's tab becomes a choice, and the choice is navigation while the leaves
commit.** Pressing `Export` opens the app's ONE menu species — `buildMenu` /
`#menu`, the popup the note's Link item wears — anchored at the pressed tab
(the tab's own bounding box, not the pointer: the menu is the tab's next
state, not a context menu that happens to be nearby). Its two items are
**PDF** (leaf: `exportBoardPdf(current)`, issue #43's sheet of the board
you're looking at) and **JSON** (leaf: the whole-library backup below). The
B81 line runs through the middle: *choosing a format commits nothing a stray
tap could duplicate*, so the tab opens the menu raw; *a file leaving the
device is a consequence*, so each leaf runs under `commitAction`'s drop-guard
itself. The guard moves with the consequence rather than wrapping the chooser
— the same reading that lets `All boards` run raw. This is the day §10.5's
comment reserved for: "there is exactly one export, so 'to what?' has one
answer; the day a second format exists this has to become a submenu." The day
arrived; the submenu is the app's own menu species, no new pattern minted.

**JSON is a backup, not a print — full fidelity, nothing swept.** PDF is a
sheet ABOUT a board; JSON is the board itself. `exportAllJson` therefore
writes every record exactly as stored — `notes`, `parkingLot`, `links` (B91's
relational plane rides along), `category`, the stamps — under
`{ app: 'the-boards', version: 1, exportedAt, boards: [...] }`, to
`boards-backup-YYYY-MM-DD.json` through the existing `downloadBlob`. One
precondition: `flushSave()` first, because saves are debounced and
`idbGetAll()` alone could read the open board some keystrokes stale — the
same staleness `exportBoardPdf`'s `current` rule answers, one board wide. The
flush stamps `updatedAt` only if an edit is actually pending, so exporting
never reorders the list (B69's law, by flushSave's own reading).

**Import is the reverse door, and it trusts nothing.** The visible control is
the third tab; the platform file explorer is opened by a hidden
`<input type="file" accept=".json,application/json">` — the input is the
mechanism, never a second control (UIUX: the reader declares intent once, on
the tab). Import is a merge, by the owner's ruling: **a board whose `id`
already exists is overwritten by the file's copy; new ids are added**; boards
the file never mentions are untouched. This is a backup-restore in miniature —
the file is the truth for the ids it carries, the device keeps the rest. Every
imported record passes `normalizeImportedBoard`: fields coerced (not trusted —
a backup has been OUT of the device and may be hostile or hand-edited), ids
re-stamped when absent, unknown categories reading as the B21/B67 read-site
default, links kept only when both endpoints survived, and the **B8/B31 husk
sweep applied at the door** — a whitespace husk in the file never enters
storage at all, rather than waiting for renderBoard to heal it on first sight.
A file that will not parse, is not the app's shape, or yields no surviving
board shows `Couldn't import that file.` and writes nothing; a success shows
`Boards imported`. Import commits (boards can be overwritten), so opening the
dialog runs under `commitAction` too; the input is reset before each open so
choosing the same file twice still fires `change`.

**The row's own question, answered as B83 predicted.** B83 closed: "The row is
a home for exactly two board-level actions. The day a third is asked for…
this becomes a question about what the row is for." The answer is now on
record: the row is the home of *board-level* actions — acts on the library or
the sheet, never on a note — and Import qualifies as exactly PDF did. The
clause is superseded, the row's purpose stated in its place.

**What is removed.** The anchor branch of `openMenuFor`, the `'anchor'` entry
in `HAS_MENU`, and with them the last readers of the anchor-menu route. B75's
board-card menu (right-click a card in the rail, its own element) is untouched;
B24's lot menu is untouched; the note Link menu (B91) is untouched. Nothing
else loses a route: `All boards` has been a tab since B83, and Export remains
one — its tab now *choosing* before it acts.

**The record.** The rendering values — the three-tab row, the choice menu
anchored at the tab, the hidden import input — live in `UIUX §3.3` (updated)
and `§14`; `sw.js`'s `CACHE` bumps to **v37** and `test/tokens.js` pins it.
`test/tokens.js` gains asserts for the import mark, the new COPY strings, and
the retired anchor branch; the Playwright suites gain the Export choice menu,
a JSON round-trip (export → wipe storage → import → restored), the bad-file
path, and the anchor long-press/right-click asserting nothing opens.

**Source:** issue #140 (owner): “Clicking existing Export button above the parking lot should now open a menu with two options: ‘PDF’ & ‘JSON’. Add an ‘Import’ button to the right of the ‘Export’ button” — https://github.com/AlastairZeved/TheBoards/issues/140

**Pointer, 2026-09-16:** B123 — issue #231 — supersedes ONLY this ruling's JSON payload-shape clause: the backup payload becomes `version: 2` with the calendar event records in their own top-level `calendarEvents` array (`boards` carrying board records only), the importer normalizing by record type and v1 files still importing with their events salvaged. The three-tab row, the PDF · JSON choice menu, the `flushSave()` precondition, the retired anchor menu, and B92's merge-import ruling — extended to events unchanged — all stand.

### B93. Legacy-frame adoption — a one-time boot migration writes every pre-B32 note onto the single B64 path, retiring B32's two-path rescue (issue #141; waives B32/B21's "stored `y` is never mutated" for this one deliberate write alone — incidental clamps remain as forbidden as ever)

B32's admission — a pre-B32 note's authoring height is device-dependent and
unrecoverable, so its `y` maps through `LEGACY_H` and clamps at render time —
was correct, but it priced every future rendering change at two paths: `noteK`,
`renderY`, `exportK` and `exportY` each carried the branch, and #141 asks the
only question that ends the meter. The rescue exists to place the note where
the old build left it. That place is computable once, at boot — so compute it
once, write it down, and let the note live on the same path as everything else.

**The ruling.** `boot()` runs `applyLayout()` (which alone knows this device's
`LEGACY_H`) and then `migrateLegacyBoards()` over the full `idbGetAll()`
snapshot: every note lacking a finite `rh`, on every board, is adopted — `x`
and `scale` through the legacy width ratio (`LOGICAL_W/(rw ‖ 900)`), `y`
through `clamp(y · (LOGICAL_H/LEGACY_H), 0, LOGICAL_H − HIT_FLOOR)` (the old
render branch verbatim), `rw = LOGICAL_W`, `rh = LOGICAL_H`. Boards that
changed are written straight to IDB — nothing is open yet, so the debounced
save queue plays no part. Migration completes before first paint; the unified
path renders from frame one. The branch is then deleted from all four mapping
functions, and `LEGACY_H` survives only as the migration's input (read by
nothing else).

**Render-silence is the proof of P3, not a hope.** The two ratios agree by
construction: on mobile `LEGACY_H = 900·vh/vw`, so the legacy `y`-ratio
`LOGICAL_H/LEGACY_H` is exactly `vw/900` — the width ratio itself — and B64's
`min()` picks the very value the legacy branch used; on desktop
`LEGACY_H = LOGICAL_H`, the ratio is 1, which B20's min-anchored scale already
guaranteed. The scale fold mirrors `rebaseNote` (B40/B64): `effScale` before
equals `scale` after. A migrated note therefore renders at the same position
and size the moment after adoption as the moment before — the screen cannot
tell the migration happened, which is what "positions are permanent" demands.

**The waiver is narrow.** B21/B32's "stored `y` is never mutated" exists to
stop incidental clamps — a resize, a redraw — from silently moving notes. B93
is a deliberate, one-time, user-requested write (issue #141) of the exact
position the user has been seeing, recorded here so the clause's exception has
a name. Nothing else may write without a gesture owning it. `normalizeImportedBoard`
(B92) already stamps `rh`, so imported boards never meet the migration.

**Costs, owned as B32 and B64 owned theirs.** A legacy note adopted on one
device is thereafter an ordinary frame-stamped note: it maps as a figure under
B64 with every other note, its `rh` is this device's `LOGICAL_H` at adoption
time, and a *second* device's render of the same record is the B64 cross-frame
cost all modern notes already carry. The migration runs at every boot but is
idempotent — a second boot adopts nothing and writes nothing. The clamp now
runs once, inside the migration, where B32's scope warning (it would fight
`createNote`'s bottom clamp and be written back) is moot by construction.

**The record.** `sw.js`'s `CACHE` bumps to **v38**. `test/desktop.js` gains
`[D23]` — adoption values checked against the live frame, render position
recomputed from the legacy math, modern notes untouched, second boot a no-op;
`test/mobile.js`'s `[13]` swaps B32's "rescued, not mutated" contract for the
B93 contract (stored `y` becomes 640 at the 384×846 test viewport, exactly
where B32 drew it). `UIUX §11`'s legacy sentence now names the migration, not
the rescue.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B94. The favicon is B1's full motif, purpose-rasterized at 16/32/48 on the water; the tab title is chrome that names the current view (issue #148; leaves B1's icon motif, B58's ground, and UIUX §1's identity law untouched — the favicon is the identity re-derived for the one surface it had never been drawn for)

**The favicon.** Browsers were handed `icon-192.png` and squeezed it to 16px
themselves — identity by browser-side downsampling. The motif never changed:
`icons/make-icons.js` now also rasterizes B1's full note (frame, two text
bars, completion stroke) on the water fall at 16/32/48 — the settled tokens
at the sizes a tab actually draws — plus a root `favicon.ico` (a PNG-in-ICO
wrap of the 32) for browsers that ask blindly for it. Candidate directions
that removed the bars (B1-skeleton), enlarged the stroke alone, or floated a
chip on the deep were mocked at true size and set aside: at 16px the full
motif survives intact, so no mark needed to be sacrificed. The three shipped
icons are byte-identical before and after.

**The title.** `document.title` follows the view — the board's own title text
(the anchor's copy, bare `To-Do Boards` when untitled), `All boards ·` on the
picker, the category's own name on a drill — as browser and OS-window chrome
only. Nothing on the canvas renders or reads it; the views stay exactly as
UIUX §10/§6 draw them. It is a re-statement of where you are, not a new
surface: no tab bar, no header, no mode.

**The record.** `sw.js`'s `CACHE` bumps to **v39**; the favicon files join
`ASSETS`. `index.html` declares the three PNG sizes, the `.ico`, and
`humans.txt`; `robots.txt`/`sitemap.xml` state the one crawlable URL.
`syncViewTitle()` is the single writer, called from `renderBoard`,
`showList`, `showCat`, and the title anchor's input branch.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)


## AD. The rolling temporal calendar (issue #145)

### B95. The calendar is a third screen: a computed 7-day rolling window over linked To-Do boards, entered by the board-action row's fourth tab, exited by the R1 top row; the mobile tab row re-grammars to fit; the desktop panel squeezes the frame and grabs write the true frame (issue #145; the owner's R1–R7 solutions of 2026-09-01 are the ruling's substance; keeps B9's back-gesture law as a route among visible routes, B81's commit-on-release, B8/B31's husk discipline, B64's similarity mapping, B21's read-site defaulting, B42's pager species, §8's closed motion set — and waives nothing)

**The exits came first.** The gap audit's question — can you get off every
surface this feature adds? — is answered before the feature is drawn. R1:
the calendar carries a top row, Back · All Boards · Export, anchored left /
center / right, visible on every platform. Back pops the calendar's own
pushed History state — B9's route made visible, the gesture law never
demoted to the only law. All Boards pushes the picker above the calendar,
which compresses beneath it rather than being covered. R2: the Quickview
stretch arrow does not ship — an unruled surface with no way off is exactly
the shape this product forbids, so the surface does not exist.

**The window is computed, not stored.** R4: the 7-day stack (today + 6
future, no past cards — R7.4) is derived from today's date at render. No
midnight write, so B93's "nothing writes without a gesture owning it" needs
no waiver; no skip-forward problem, no undo firing to nobody at 12:00am, no
stored rolling array, and the database stays at version 1.

**The data model is the boards', extended at the read site.** R5: each date
with events links to an ordinary To-Do board — created on the date's first
event (the trigger), category todo, announced by the drawn calendar mark on
its card and in the All-Boards views. (B133 supersedes this clause's original
title format, `MM/DD/YY To Do`: the linked To-Do board's title is "Today's To
Do" with the date pinned beneath it. This clause's mirror and `cal` binding
are untouched.) The link is the
board's `cal` field; the mirror's line count is `calReq`; both ride B21's
read-site-default idiom, so no migration. The Requirements mirror has ONE
writer (`syncMirror`) and a self-recorded span: the span's lines are the
mirror's, everything after is the reader's own and survives every resync —
a deletion shrinks the events but never demotes an old mirror line to a
"hand" line. Deleting the linked board unlinks its date (events survive as
calendar data; the next event re-creates a board). Import coercion carries
`cal` (strict YYYY-MM-DD) and `calReq`, so a backup round-trips the link and
an old build reading a new backup simply ignores the extra fields.

**The row fits because its grammar says less.** R7.2: four tabs — All ·
Export · Import · Calendar — at 6px side padding and 6px gap. Measured, not
guessed: the natural grammar overflowed 390 and 360 viewports; the
re-grammar is 346px. Vertical padding is untouched, so B86's finger box and
§6's collar-height math hold; the resting toggle label reads "All" and its
engaged face keeps "This board" — the one word that states the return. The
combined Download fallback was retired unneeded.

**Desktop squeezes; grabs write the truth.** R6: the open panel takes 320
unscaled px and `applyLayout` removes that width from the frame — B20's own
mechanism, on the other edge. The arrangement maps as a figure (B64),
smaller and further left; overlap is accepted, the owner's word. Nothing is
stored while squeezed; `LOGICAL_W_TRUE` holds the frame the board returns
to, `toLogical` un-maps into it proportionally, and `rebaseNote` stamps
against it — the one licensed write lands the note permanently where the
user sees it land in the room the board returns to. On close the squeeze
lifts and the board renders exactly where it was — probed bit-identical.
Export reads storage, never the squeezed frame (R6's second clause).

**Device classes gain a tablet path, by width.** R3: `min-width: 984px` —
the unfolded Z Fold 7's CSS viewport — regardless of pointer; mouse
capability still overrides into desktop, whose own MQ is untouched. iPad
portrait reads as a cover-screen foldable (mobile); landscape clears 984
(tablet). The tablet calendar arrangement is the desktop's (rail → panel →
squeeze), so no viewport falls between grammars. `applyMode` closes the
panel on a capability flip and pops its history entry — nothing typed is
lost, because the calendar holds no drafts: its lines live in boards.

**Export.** R1's Export control opens B92's existing PDF · JSON choice; the
PDF leaf is a 7-day reference sheet drawn with the exporter's own
primitives — today marked, one line per event, completed events reading
"— completed —" (§7's bytes property). JSON is the unchanged whole-library
backup.

**The record.** `sw.js`'s `CACHE` bumps to **v40**; `test/tokens.js` pins it
and gains the calendar's contract asserts (window computed, mirror writer,
link coercion, squeeze state). `test/mobile.js` [21] and `test/desktop.js`
[D21] re-read the row as four tabs. `UIUX §3.3` (tab padding), §3.4 (new:
the calendar view), `§10` (the third screen), `PRD §4.1` (the extended
record shape) move with it.
## AE. The tablet tier (issue #155)

**Source:** issue #145 (owner, RTCB specification): “The Rolling Temporal Calendar Board (RTCB) introduces a 7-day rolling temporal view to TheBoards” — https://github.com/AlastairZeved/TheBoards/issues/145
### B96. Three device classes, two axes: capability keeps the grammar (B19 untouched), width gains a tablet tier — `min-width: 984px`, the unfolded Z Fold 7 — that joins a `wide` arrangement (desktop ∪ tablet: the rail, the calendar panel, the squeeze) without ever flipping the touch grammar; the tablet tier B95/R3 ruled is now shipped (issue #155; the owner's approval of the 2026-09-02 solutions comment is the ruling's substance; keeps B19's capability law, B20's wide geometry, B64's similarity mapping, B81's commit-on-release, B9's back-gesture law — and waives nothing)

**The classes, evaluated in order — no viewport falls between grammars:**

1. **Desktop** — B19's MQ, unchanged: `(min-width: 1024px) and (hover: hover)
   and (pointer: fine)`. The hover/fine grammar, the rail, the calendar panel.
2. **Tablet** — *not* desktop **and** `min-width: 984px` (the unfolded Z Fold
   7's CSS viewport), regardless of pointer. The desktop **arrangement** (rail
   → panel → squeeze) under the **touch grammar**: B19's own derivation
   carries over — the desktop hover grammar would strictly reduce a
   touch-only device, while the touch grammar costs a wide screen nothing
   except the calendar arrangement, which this tier restores. Mouse
   capability still overrides into desktop, whose MQ is untouched.
3. **Mobile** — everything else. iPad portrait (768–834) stays mobile; iPad
   landscape (≥1024, coarse) is tablet; the Fold 7 cover screen (~370) is
   mobile; unfolded it is tablet.

**Two axes, one flag pair.** Grammar is capability (B19); arrangement is
width. The code carries `isDesktop` (grammar, unchanged) plus `isTablet`,
composed into `isWide` — the single arrangement flag — and three classes on
`<html>`: `desktop` (grammar, as always), `tablet` (the new tier), `wide`
(every CSS rule that draws the rail or the picker overlay). No UA sniffing,
no orientation branch, no device list: width for room, capability for
grammar, nothing else. The #155 report — an unfolded Fold 7 showing the
calendar *button* — was this tier ruled by B95/R3 but never shipped; the fix
is the shipping.

**The flip.** `applyMode` runs on either MQ's `change` and applies the same
teardown B19 ruled: selection cleared, menu closed, a pushed list entry
popped (B9 intact), the calendar closed with its history entry popped when
the wide class is lost (nothing typed is lost — calendar lines live in
boards). Folding mid-session is a frame change plus an arrangement change,
never a data change.

**The record.** `sw.js`'s `CACHE` bumps to **v41**; `test/tokens.js` re-pins
it. `test/mobile.js` [11b]'s short-window case moves to 980px (just under
the boundary — it exists to pin the *mobile* sheet on a short window) and a
new [11b2] pins the tier itself: tablet classes without desktop, rail
present, `--offx` at 300, calendar docking as the 320px panel under
`squeeze`. `test/desktop.js` untouched (the desktop grammar and its MQ are
byte-identical). `UIUX §3.4`'s calendar note now states the mobile path as
`html:not(.wide)`.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)
## AF. Editable calendar events (issue #152)

### B97. An existing calendar event is editable in place: the line's own tap opens its existing editor — focused, caret always at the end of the text — inside the tap gesture; commit-on-blur writes the event and re-syncs the mirror; an empty commit discards; a second tap while editing cannot re-arm the editor (issue #152; keeps B95's calendar grammar untouched — no new surface, no mode, no control beyond the line itself; keeps B8's discard rule, B81's commit discipline via the re-arm guard, the mirror's one-writer law — and waives nothing)

**The bug was wiring, not the editor.** `makeCalDay` rendered existing events
as plain text — only the add flow ever opened the editor, on the line it had
just created. The editor itself already did everything the issue expects:
`focus()` inside the tap gesture (the keyboard opens), `caretToEnd` (the
cursor lands at the end of the text). The fix is one listener on each
rendered line that calls `startCalLineEdit(line, ev)`.

**Edit-entry runs raw; the commit is the blur.** Like note edit-entry, opening
the editor commits nothing a stray tap could duplicate, so it does not run
under `commitAction` — the blur is the committing consequence, and it already
writes the event record and re-syncs the linked board's mirror through
`syncDateMirror` (one writer, span-safe).

**The re-arm guard.** A tap on a line that is already editing returns early.
Without it, a second tap while editing would re-arm `startCalLineEdit` and
stack a second blur listener — a double commit. This is B81's concern in the
calendar's idiom.

**State is not text.** Editing a completed event touches text only: the
`complete` state and its strike survive the edit and the commit. Text and
state are independent fields on the event record.

**The record.** `sw.js`'s `CACHE` bumps to **v42**; `test/tokens.js` re-pins
it and gains the wiring contract asserts (tap opens the existing editor,
caret to end, re-arm guard). `test/mobile.js` [25] and `test/desktop.js`
[D24] prove the behavior through their real grammars: open → focused → caret
at end → edit → persist → mirror re-synced; [25] additionally pins the empty
commit's discard and the completed event's surviving strike.
`UIUX §3.4`'s Capture note now covers the existing line's editing contract.

**Source:** issue #152 (owner): “tapping an existing calendar event in calendar view should bring up keyboard to edit and place cursor at the end of the text” — https://github.com/AlastairZeved/TheBoards/issues/152
### B98. The calendar's R1 top row renders its acts and meets the touch floor: each button is filled — drawn mark + label, the row-control species' whole self — its visual frame clears the 44px floor as drawn, the §6 decoupled collar tops up the width where the row is tight, and hover, press, and keyboard focus are each stated (issue #156; keeps B95/R1's acts and anchors as amended by B124 (issue #237) — the row is Back alone — no new control, no grammar change; keeps §6/B7's collar law, B86's finger-size logic applied to the frame itself, §2.7/§8's closed motion and state set — and waives nothing)

**The defect was a row that never got dressed.** `index.html` declared the
three `#cal-top` buttons empty and the boot step that fills the board-action
row (`fillBoardAction`) was never run for them: they rendered as 12×16 blank
squares — the issue's "untappable, icons invisible" was one shipping defect
with three faces (unfilled, floor-less, stateless). Measured live before the
fix; `GLYPH.calBack` and its COPY strings had been drawn for B95/R1 and
shipped unused.

**The frame is the floor.** The owner's direction is explicit: the visual
button grows, not only the hit area. `.cal-act` now draws at
`padding: 14px 16px`, label 15px, mark 22px — ≈ 48px tall on touch, over
§6's floor as a *rendered* box, with the collar (JS `--hit` on `#cal-top`
from `renderCal()`, `k = 1` — the calendar is an unscaled surface) topping
up width where a 390px row is tight, spent upward into the row's own chrome
margin because downward is the day stack's furniture. Interaction states are
the board-action row's trio verbatim: hover brightness 1.1 (hover-capable
pointers only), active 0.92, §2.7's two-tone ring on `:focus-visible`. The
marks are the family's own: `GLYPH.calBack` (the page turn, wired at last),
`GLYPH.boards` and `GLYPH.export` shared with their board-row siblings —
same act, same mark, so the two rows read as one hand. **Amended by B124
(issue #237): the row is Back alone** — All Boards and Export leave the
calendar view and Back renders directly above the month view; the
fill / floor / state machinery above applies to the remaining button.

`test/mobile.js` [26] proves the row through the touch grammar: each button
carries glyph + label, each clears the floor as drawn, the mark is legible
at rest, `--hit` is set, and a tap in the collar above the frame fires Back.
`test/tokens.js` pins the fill, the frame values, the collar, and the state
trio in the shipped bytes.

## AG. The standing calendar rail (issue #158)

**Source:** issue #156 (owner): “Resize the three buttons at the top of the viewport in 7 day calendar view and follow best UIUX practices.” — https://github.com/AlastairZeved/TheBoards/issues/156
### B99. On wide screens the calendar is standing furniture, not a tab: a 40px rail pinned to the viewport's right edge — "Calendar Board" reading vertically, today's date, a lit dot — reserves its width from the frame at all times, one tap expands it into the R6 panel (320px, the board reflowing beside it), and the panel's Back collapses it; the Calendar tab retires on wide and the action row is three tabs there (issue #158; mockup 6 (`docs/mockups/rtcb-6-desktop-rail.html`) is the ruling's substance — the owner's three corrections of 2026-09-03: the button was the mobile species, wide always meant a rail, and opening it DOES reflow the board; keeps B95/R6's squeeze machinery untouched, B95/R7.2's mobile row, B9's back-gesture law as mobile's pushed route, B81's commit-on-release, B97's in-place editing, B98's R1 row — and waives nothing)

**The furniture law.** B95 recorded the calendar's wide entry as the action
row's fourth tab docking a panel — the R1–R7 prose — while mockup 6 drew the
wide species the owner always meant: a slim always-visible rail, the room's
third column (boards, board, calendar), that *expands*. The prose shipped;
the drawing didn't. The same failure shape as B96's unshipped tablet tier,
and the lesson generalizes: **a mockup committed beside a ruling is part of
the ruling** — diff the drawn geometry against the shipped DOM when planning
from either.

**The states are two, and the state flag is split.** Collapsed: the 40px rail
(`#cal-view.rail-open`, `#cal-rail` the face), `CAL_RAIL_W` reserved in
`applyLayout` whether or not the panel is ever opened — furniture takes its
width like the left rail does (B20's mechanism on the other edge), so the
frame reads `viewport − 300 − 40` from boot. Expanded: the panel swaps in
(`.panel`), `CAL_PANEL_W` replaces the 40, and B95/R6's squeeze machinery
runs exactly as built — `LOGICAL_W_TRUE` holds the rail-era frame,
`toLogical` un-maps a grab into it, `rebaseNote` stamps it, on collapse the
board renders where it was. The panel's **Back** is the collapse arrow (R1's
act re-homed, no new control); the rail commits nothing and pushes no
history — B9's route and `{v:'cal'}` belong to mobile's pushed full-screen
view alone. `calOpen` (the mobile screen) and `calExpanded` (the wide panel)
are separate flags: the rail must never enter the screen-grammar branches
(popstate's close-on-land, `applyMode`'s teardown) — a flag mistake there
swallows every back-landing into `hideCal` and breaks list navigation (found
by the suites, not by reading).

**The tab retires on wide only.** `html.wide #action-calendar { display:
none }` — the row is three tabs (All · Export · Import) where the rail stands,
four on mobile where the tab is the calendar's only door. B97's in-place
editing lives in the expanded panel unchanged; B98's R1 row and floor stand
as amended by B124 (issue #237) — the row is Back alone, above the month
view — and R1's Export no longer lives in the calendar.

**The record.** `sw.js`'s `CACHE` bumps to **v44**; `test/tokens.js` re-pins
it and gains the B99 block (rail face in the shipped HTML, boot rendering,
mockup-6 species, the 40px reservation, expand/collapse around the squeeze,
the wide tab's retirement, the raw navigation, the flag split).
`test/desktop.js` [D21] reads the row as wide's three tabs and pins the rail
at ≥24px; [D13]'s frame math takes the rail's 40 (1222.22 at 1440×900); [D24]
enters through the rail. `test/mobile.js` [11b2] proves the tablet path: tab
gone, rail present, tap expands to the 320px docked panel under the squeeze,
Back collapses to the 40px rail with the squeeze lifted. `UIUX §3.3` (the
three/four-tab grammar) and §3.4 (the rail) move with it.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

## AH. One picker, the Parking Lot — and desktop's All-boards tab retires (issue #157)

### B100. The All-boards picker is the Parking Lot turned into the 2×2 grid on every surface that has the tab — mobile and tablet; desktop's All-boards tab retires entirely, from the board's action row and from the calendar's R1 row alike, because the left rail (B24) already lists every category with every board; `#list-view`'s full-screen overlay face retires with them (issue #157; supersedes B74 Part 3's desktop clause, B83's wide All tab, B95/R1's wide calendar row, B82's desktop-overlay half, and B99's three-tab count; keeps B24's rail, B82's rising panel, B96's tiers, B9's back stack, B74's grid mechanics, B81's commit-on-release — and waives nothing)

**The owner's ruling, quoted and applied.** "All of them should be the
same. The boards category opens up the categories in the parking lot — not
the entire screen. Desktop mode should not have an 'all Boards' button at
all. They're already visible in the left rail." Three clauses, one stroke:

1. **One picker species.** `showList()` always raises the lot-grid
   (`openLotMenu()`); the `isWide` branch that gave desktop and tablet the
   full-screen `#list-view` picker is gone. Tablet — which the issue expected
   already worked, and which in fact had the bug — now gets the grid its
   issue text promised. `renderPicker()` is deleted; its four-button fill was
   always `buildCatButtons`, which the grid shares. `renderListSurface()`
   keeps only the drill rebuild: level 1 is static furniture with no board
   data, on every surface.
2. **Desktop has no All-boards control at all.** `html.desktop
   #action-boards` and `html.desktop #cal-boards` are `display:none` — the
   exact mechanism B99 used to retire the Calendar tab on wide. The left rail
   is desktop's all-boards surface: it already renders all four categories
   with every board (`renderPane`), paging overflow; a second door to the
   same room is not simplicity, it is a second thing to learn. The handlers
   guard too (`calBoards`' click returns on desktop) — a hidden control's
   handler must not act if reached. Wide's board row is **two tabs**
   (Export · Import); the calendar R1 row is **Back + Export** — which is
   what mockup 6 drew all along, so this clause also reconciles the build
   with its own drawing (`#cal-export` takes the right anchor
   `margin-left:auto` once the centred button is gone).

   **Pointer, 2026-09-16:** B118 — issue #211 — makes the rail collapsible
   on wide, collapsed by default; the rail remains desktop's all-boards
   surface, one tap away, and this entry's "already visible in the left
   rail" rationale reads subject to B118.
3. **The overlay retires on desktop only.** `#list-view` survives as the
   B82 mobile/tablet rising panel for drilled categories — B82's species
   split is untouched — but desktop can never show it: no tab pushes
   `{v:'list'}`, `applyMode` already tears list nav down on any flip to
   wide, and a stray list-state landing (restored old-build history) heals
   to the board in popstate rather than resurrecting a retired surface.
   `goToList()`'s desktop blur branch died with the overlay: the grid never
   occludes the tab, so focus is never stranded (B65/B83's care is
   moot at level 1 and the drill never opens on desktop).

**The back stack is unchanged** (B9): drill → picker → board, two pushed
levels, `returnToBoard`'s depth pop — all of it surface-agnostic already.
The recognizer's `#lot-menu` passthrough and `syncBoardActions`' toggle
already read `listOpen || lotMenuOpen`, so mobile's grammar carried to
tablet with zero new wiring — the fix was un-guarding, not building.

**Flags the owner settled on the record:** tablet KEEPS its All tab (its way
into the grid; the owner ruled the rail-and-tab redundancy a desktop-only
correction); Export KEEPS its place in wide's calendar row (mockup 6 drew
neither All nor Export; the owner named only All Boards).

**Pointer, 2026-09-16:** B119 — issue #212 — supersedes this paragraph's
tablet clause: the tablet All tab retires, the hide widens to `html.wide`,
and only mobile keeps the tab (its way into the lot-grid picker — there is
no rail below 744px). Export's place stands.

**The record.** `sw.js`'s `CACHE` bumps to **v45**; `test/tokens.js` re-pins
it. `test/desktop.js` [D21] reads wide's row as **two** tabs (Export ·
Import) with the All tab asserted `display:none`; its Delete/Enter focus
guards moved to the Export tab (the hidden tab cannot take focus);
[D22] is rewritten to the retirement contract: both buttons `display:none`,
`#list-view` and the grid closed, the rail listing all four categories with
the seeded 40 paging, and a stray `{v:'cat'}` landing healing to the
board. `test/mobile.js` [11b2] gains the tablet picker: the tab opens the
lot-grid, drilling rises the one-category panel, `history.go(-2)` returns
the real lot. `UIUX §3.3`'s picker sentence and §10's overlay inventory
state the retirement.

## AI. The foldable shape gate (issue #164)

**Source:** issue #157 (owner): “the Board Categories displays as a 2x2 button grid in the parking lot section as it does in tablet mode and mobile mode” — https://github.com/AlastairZeved/TheBoards/issues/157
### B101. The tablet tier's width gate grows a second leg — the foldable shape: `min-width: 840px` AND `max-aspect-ratio: 23/20` — because B96's 984px was calibrated believing it WAS the unfolded Z Fold 7's CSS viewport, and the device's real Samsung Browser viewport sits below it at common zoom levels, classifying the unfolded Fold mobile and rendering the full-screen calendar with no rail; the shape gate admits the unfolded inner display at every zoom and nothing else (issue #164; retunes B96's width rule, which stays for tablets and iPad landscape; keeps B96's device-class rulings — cover screen mobile, iPad portrait mobile, capability keeps the grammar — and waives nothing)

**The bug was a constant calibrated from the wrong number.** B96 recorded
`min-width: 984px` as "the unfolded Z Fold 7's CSS viewport" — but 984 was
never the device; the mockup (`rtcb-7`) drew the unfolded panel at
~906 CSS px (1812×2176 physical at 2×), and the owner's issue-#164
screenshots show 1968 *physical* px rendering the MOBILE layout — a CSS
viewport in the 900s. At default zoom the device reads ≈1092×1030; at −2 it
reads ≈904×846. Both are below 984, so the unfolded Fold ran the mobile
grammar: full-screen calendar, All-Boards tab, no rail, no lot-grid picker —
six days after v45 deployed (deploy verified live; the build was correct,
the classification was not).

**Why width alone cannot fix it.** Lowering B96's number would admit the
Fold's cover screen in landscape (~980×460 at default zoom — and wider at
smaller zooms, past 984's own floor), which B96 explicitly rules mobile.
The unfolded inner display is distinguished not by width but by SHAPE:
it is the only target that is simultaneously ≥840 CSS px wide (above iPad
portrait's 820, which stays mobile per B96) and square-ish — aspect ratio
≤ 23/20 (~1.15) — while every excluded shape is wide-flat (cover landscape
~2.1:1, [11b]'s short-wide window 1.37:1) or narrow-tall (iPad portrait
0.70). Both legs are DPR-invariant, so the gate holds at every zoom level;
extreme zooms (−4, ≈728 wide) read as phones by design — a trade accepted:
at that zoom the user has asked for phone-scale everything.

**No height leg.** With `min-width: 840px` the aspect ceiling already forces
height ≥ 730 — a `min-height` leg would be code that can never bind, and a
gate with a dead leg is a ruling waiting to be misread. The gate is two
predicates, both load-bearing.

**The full tablet path rides the classification.** Everything B96/B99/B100
gave the tier had shipped correctly and was simply never reached: the left
rail, the standing calendar rail (40px, expanding to the 320px panel under
the squeeze), the retired calendar tab, and B100's lot-grid picker with the
retired overlay. `applyMode`'s live `change` listener picks the flip up
without a reload.

**The record.** `sw.js`'s `CACHE` bumps to **v46**; `test/tokens.js` re-pins
it and asserts the two-leg MQ text. `test/mobile.js` [11b2] gains the real
device's zoom levels (904×846, 1092×1030, both through the full tablet path
to B100's lot-grid) and renames the tier block; [11b3] is new: thirteen
shape-edge cases pinning each gate leg (984/983 at cover height, 840/839,
the aspect edge 840×731/840×730, cover landscape, the [11b] window, iPad
portrait, the Fold in portrait orientation). [11b]'s 980×715 and the cover
screen's own asserts are the living proof the gate excludes them.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions) B101 is superseded — ratified as historical record, per the ruling.


## AJ. The update check can be pinned — updateViaCache and the build handshake (issue #164)

### B102. The service worker registers with `updateViaCache: 'none'`, and the app runs a build handshake 20s after launch — it fetches `sw.js` with `cache: 'reload'`, compares the served `todo-boards-v<N>` against its own stamped build, and on a second consecutive mismatch purges every `todo-boards-*` Cache-Storage entry, unregisters the worker, and reloads once (issue #164; the six-day, three-engine stall the issue exposed was the update CHECK being answered from a cache — skipWaiting, `reg.update()`, SWR and now `updateViaCache` all assume the ask reaches the server; the handshake is the layer that verifies it did; keeps B79's no-mid-session-reload law — the heal lands on the reload the handshake itself performs, between thoughts; keeps B21 — data is never touched: Cache Storage and IndexedDB are different stores, and the handshake never opens the latter — and waives nothing)

**Pointer, 2026-09-16:** B121 — issue #217 — renames the CACHE lineage this ruling describes: the CACHE constant is now `zeved-boards-v<N>`, and the self-heal's deletion filter keeps the retired `todo-boards-v*` prefix so pre-rename caches still clean up. The handshake mechanism itself stands.


**The failure no layer owned.** The user's devices (LibreWolf desktop, Samsung
Internet, IronFox — three engines, two platforms) rendered a pre-v44 shell for
six days while the deploy was verifiably live: all 15 `ASSETS` returned 200,
deployed bytes matched `origin/main`, every Pages run succeeded, and a fresh
Firefox profile got the current build from its very first load. The pinned
profiles, meanwhile, re-validated a stale answer. Every mechanism in the
update chain asks the server *through the browser's network stack* — the one
component that had provably gone wrong. `updateViaCache: 'none'` removes the
browser's own HTTP cache from the SW-script check; the handshake removes
trust in everything else on the path: it asks the network DIRECTLY
(`cache: 'reload'`) and compares answers.

**Two strikes.** One mismatch arms `boards-build-mismatch` in
`sessionStorage` (dies with the tab — no stale counter); the same wrong
answer twice in a row means it is not a fluke, and the self-heal runs. A
single captive-portal response or proxy error page cannot nuke a healthy
install; an unparseable `sw.js` is ignored, never acted on.

**Data is never touched — by construction.** The self-heal's only writes are
`caches.delete` on `todo-boards-v*` entries and `registrations.unregister()`.
Boards live in IndexedDB (`boards-db`), a different store the handshake
never opens, and B21's read-site defaulting means an old record renders
correctly under a new build regardless. The worst case is the app
re-downloading its own files.

**The record.** `sw.js`'s `CACHE` bumps to **v47**; `app.js` stamps
`OWN_BUILD = 'v47'` bump-adjacent to it — `test/tokens.js` pins both to the
same version on every shipped change, so a missed stamp fails the suite.
`test/sw-update.js`'s five scenarios are unchanged and green (the handshake
never fires when device matches deploy — its healthy path is a no-op); the
red→green proof lives in the issue: a Firefox profile pinned to a v43
worker with the new shell deployed records strike `v43`, heals on the
second load, reinstalls the true worker, and the seeded board survives.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)


## AK. Tablet mode is orientation-blind (issue #164, final ruling)

### B103. The tablet tier is ONE width floor — `min-width: 744px` — with no orientation or aspect term: unfolded foldables, iPads, and Android tablets take the tablet arrangement in PORTRAIT and landscape alike, and B96's cover-landscape-mobile ruling and B101's shape leg are superseded; width, not orientation, is the classifier (issue #164, the owner's ruling of 2026-09-09: "include unfolded foldables screens and iPads, as well as other tablets, to be included in tablet mode when in portrait mode — no longer exclusive to landscape mode"; supersedes B96's device-class widths and B101's shape gate; keeps B96's capability law — grammar is still pointer/hover, untouched; keeps B20/B32's arrangement machinery, B9, B81 — and waives nothing)

**The path here.** B96 gated tablet mode at 984px and landscape-only; the
unfolded Fold 7's real viewport (~904×846 at zoom −2) failed that floor and
ran the mobile grammar (#164). B101 added a foldable-shape leg (840 + aspect
≤ 23/20) — but the Fold in LANDSCAPE at further-reduced zoom reports shapes
like 910×820 whose aspect still clears 23/20 only barely, and the owner's
device still missed the gate. The owner then removed the dimension that was
causing every miss: orientation. "No longer exclusive to landscape."

**The law is now one number: 744 CSS px.** It is iPad mini portrait's width,
so every iPad (768/810/820/834/1024) and every Android tablet qualifies in
either orientation; unfolded foldables qualify at every practical zoom
(≈656–1092 wide — below 744 only at extreme zoom, where phone-scale
everything is what the zoom asked for); no phone (≤480) or cover-portrait
(366–380) can cross it. Consequences accepted openly: the cover screen in
LANDSCAPE (~980×460) now takes the tablet arrangement — it is a 980-wide
surface and width is the classifier; B32's 880-unit mobile furniture budget
no longer applies to it, the tablet arrangement's own budget governs. A
desktop window narrowed below 1024 was already tablet-arranged from 984
(B96); the floor just extends that working behavior down to 744.

**The record.** `sw.js`'s `CACHE` bumps to **v48**; `OWN_BUILD` re-stamps to
v48 with it. `test/tokens.js` pins the one-leg MQ text. `test/mobile.js`
[11b3]'s matrix is rewritten to the orientation-blind law (16 cases: Fold
landscape AND portrait at two zooms, iPad portrait 768/820/1024, Android
800×1280, the 744/743 floor edge, cover landscape now tablet, phones and
cover-portrait still mobile); [11b]'s short-window scenario moves below the
floor (720×540, 600×450 — the mobile sheet's law under test is unchanged,
its free-canvas floors re-measured at 60%/50% for the squat shapes).
`UIUX §3.4`/§10 tier notes move with it.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B104. Reminders arrive as a CLOCK TOGGLE, not a clock — one tap per note card sets or clears a reminder with no time picker, no pop-up and no due-time stored anywhere in the record; an active clock glows and surfaces its card to that morning's To-Do board, which is the EXISTING B95 per-date linked board (`ensureLinkedBoard`, title "Today's To Do" with the date pinned beneath it — B133 supersedes the original `MM/DD/YY To Do` format here) and not a new board species; status is BORDER + GLOW — red past due, yellow carried over — a separate semantic layer that never borrows the highlight layer (issue #169, the owner's v3 Reminders design of 2026-09-02; narrows PRD §2.3's out-of-scope row and amends PRD §1.4; keeps §1.4's no-demands law — the board still asks nothing, the person taps the clock, nothing pings or pushes; keeps B95's To-Do species and B21's defaulted-at-read-site idiom for any future record field; waives nothing, but two triggers are explicitly unresolved — see below)

**The rulings.** The reminder is a toggle: tap the clock on any note card and
it glows; the card then surfaces to the day's To-Do board; tap again and both
the glow and the surface go away. There is no "due by" field anywhere — that
overhead is what the feature exists to avoid. Today's To Do is the landing
page and holds manually-added notes, cards surfaced from any board by an
active clock, and the day's calendar events; surfaced cards keep their source
board's background colour, and "Go to Board" lives in their long-tap menu.
Carry-forward is spatial, not temporal: a fresh board each morning on first
load, carried items in the same positions, the calendar owns time and the
board owns none. Notifications are decided: an SMS end-of-day summary in a
conversational, self-compassionate tone plus a passive 2x2 home screen widget
carrying the same border + glow; push, in-app banners and email are hard-nos.

**The record.** PRD §2.3's row is narrowed, not deleted — due dates with time
logic, push notifications, in-app banners, email and streaks stay out;
clock-toggle reminders and the day's To-Do surface are the bounded exception
citing this ruling. PRD §1.4 gains the one bounded exception. §4.1 is
untouched: no record field is ruled here, and any reminder field follows
B21's defaulted-at-read-site idiom when its implementation card exists. This
fan-out's in-scope slices are #153 (launch behavior) and #154 (two-way
mirror); the clock toggle, carry-forward, status indicators, widget, SMS and
history rail are future cards.

**Unresolved, recorded as unresolved.** (1) The PAST DUE indicator is
specified as a red border + red glow but its trigger is undefined until a
later ruling — the clock toggle deliberately carries no time concept, so
nothing in the record can say "late"; the yellow carried-over state is
well-defined, the red one is a placeholder pending that ruling. (2) The SMS
summary is ruled adopted, but its delivery mechanism touches §3.2's no-
backend law and needs a separate owner ruling before any implementation card
exists. (3) Open questions stay open: recurring reminders, the month view,
the summary's exact text format, and the week-absent first-load edge case.

**Source:** issue #169 §1 (owner, v3 design of record): “Clock icon in the bottom-right of every note card on every board. Tapping the clock toggles it on/off — no pop-up, no time picker, no time logic whatsoever.” — https://github.com/AlastairZeved/TheBoards/issues/169
### B105. The day-roll launch: when the app boots, or the day rolls under an open app, and TODAY's date carries at least one calendar event, the app lands on that date's linked To-Do board — the B95 species R5 already fills with the day's events — via swapBoard's existing route, the Requirements mirror's creation-order lines already in place; with no events nothing is created and boot lands where it always has (issue #153's premise "check if today's date has any events. If it does, launch"; the check is keyed ONCE PER DAY: it runs at boot() and at renderCal() only when the today key changed since the last check — the open-app-past-midnight case — so it can never steal focus mid-interaction; the board's creation is a consequence and runs under commitAction's guard (B81) exactly as addCalEvent's R5 chain does, but the landing itself is the plain swapBoard route, raw navigation (B81's live navigation); keeps B95's board species and R5's creation-on-first-event, B9's History-API-only routes, B21's read-site defaulting; the empty-morning auto-create stays #169 carry-forward territory, not built here; waives nothing)

**Source:** issue #153 (owner): “Upon checking date and rolling calendar view to today’s view, also check if today’s date has any events. If it does, launch a new Today’s To Do” — https://github.com/AlastairZeved/TheBoards/issues/153
### B106. The mirror writes through both ways: a board-side edit of a Requirements line inside the mirror's span writes through to the event record it mirrors — mirrorEventsOf's positional law, span line i ↔ event i — and a board-side deletion of span lines deletes the mirrored events (event-deletion semantics, never demotion), the span shrinking to follow; lines after the span are hand lines this path never touches, and a board-side ADDITION lands after the span as a hand line, because insertion inside the span is positionally ambiguous and is not a supported gesture (issue #154; supersedes B95's one-writer law — each surface is now the writer for its own edits, converging through syncMirror/syncDateMirror with the self-recorded span (calReq) as arbiter; the write-through is part of the anchor's own commitAnchor commit under B81's commit-on-release, not a timeout beside it; no new storage, no schema change — events still ride the boards store; keeps B97's calendar-side in-place editing untouched, B8, B21's read-site defaulting, B81 — and waives nothing)

**The two directions of one law.** B95 ruled the mirror one-writer: the
calendar wrote, the board read. B97 made an event editable in place. #154
asks the reverse, and the answer is not a second writer but the same writer
wearing the other surface: whichever surface a person edits, that surface's
commit is the write, and the span bookkeeping (`calReq`) decides what the
write owns. Inside the span the edited surface is the word — the events or
lines re-derive from it — outside it nothing moves. A shrunken span is a
deletion (the events go with their lines, so a calendar event can never
survive as a ghost under a line the reader erased); a grown span is hand
lines, the reader's own, exactly as B95's span already treats them. The
positional mapping is the cost of the span being a count, not a join table —
an edit in the middle of the span re-writes every line after it from the
board's text, which is correct, because the board's text IS what the span
now says.

**Where the commit lives.** The board's Requirements anchor already commits
on blur through `commitAnchor` (B81's commit-on-release, issue #182's
regions); the write-through runs inside that commit, fire-and-forget like
every async consequence, and the resync runs `syncMirror` on the live board
record — the same record `saveNow` persists, so the two writes cannot
disagree. No timeout, no second commit path. The calendar-side direction
(B97's `startCalLineEdit` → `syncDateMirror`) is untouched.

**Source:** issue #154 (owner): “Requirements section today’s to do board should be linked to calendar view for today’s events and allow 2 way editing.” — https://github.com/AlastairZeved/TheBoards/issues/154
### B107. The end-of-day SMS summary is REMOVED — The Boards is a PWA with no backend (§3.2), and an outbound SMS requires a backend or an external outbound system, both hard-no product law; notifications reduce to the passive 2x2 home screen widget alone, which is itself ON HOLD pending a capability ruling (PWAs have no home-screen widget API, and faking one means shipping an installed app against the no-package law); the red past-due indicator is RETIRED as unsatisfiable — no time is stored anywhere in the record, so nothing can say "late" — and the carried-over yellow border + glow is the ONLY status state beyond normal/complete; the summary's tone/format question is retired with the SMS; the "Today's To Do History" rail is PENDING a separate owner ruling; and the boot landing is UNCONDITIONAL — every morning's first load auto-creates today's linked To-Do board even with zero events and boots onto it (issue #169, the owner's ruling of 2026-09-15, the comment of record on that issue; supersedes B105's events-exist-only landing condition and resolves B104's explicitly-unresolved past-due trigger by retiring it; keeps B105's once-per-day keyed mid-session day-roll check unchanged, B104's clock toggle and yellow carried state, §1.4's no-demands law, §3.2's no-backend law, B95's To-Do species; recurring reminders and the month view remain open; waives nothing)

**The rulings.** The SMS end-of-day summary is removed from the v3 design.
It was ruled adopted in B104 before anyone priced its delivery: sending an
SMS requires a backend or an external outbound system, and §2.3's
out-of-scope table already holds both as hard-no. With no summary there is
nothing to tune, so the summary's "conversational, self-compassionate"
tone-and-format question is retired with it. The red past-due indicator is
retired for the reason B104 recorded when it left the trigger open: the
clock toggle deliberately stores no time, so nothing in the record can say
"late". The carried-over yellow state (border + soft glow, never the
highlight layer) is the only status state beyond normal/complete. The 2x2
widget is on hold, not adopted: PWAs have no home-screen widget API on any
platform, and faking one means shipping an installed app, which collides
with the no-package law — the options (drop it, or accept the standing
calendar rail B99 as the at-a-glance surface) wait for a separate owner
capability ruling. The "Today's To Do History" rail, defined in B104 as the
summary's home on the board, is likewise pending a ruling — without a
summary it needs a new reason to exist (a retrospective of carried items?)
or it goes.

**The landing.** #169 already rules Today's To Do is the landing page — the
first thing the person sees. So each morning's first load auto-creates
today's linked board (the B95 species, `ensureLinkedBoard`, title "Today's To
Do" with the date pinned beneath it — B133 supersedes the original `MM/DD/YY To
Do` format) even with zero events, and boot lands on it. B105's
events-exist-only landing condition is superseded; B105's mid-session
day-roll check — keyed once per day at boot() and renderCal(), so it can
never steal focus mid-interaction — is kept unchanged.

**The record.** PRD §2.3's notifications row gains SMS and outbound message
systems and cites this ruling. Docs-only: no code, no `sw.js` CACHE bump,
no redeploy (`**/*.md` is already paths-ignored in the deploy workflow).
**Open, unchanged:** recurring reminders, the month view.

**Source:** owner ruling of record, 2026-09-15, comment on issue #169: “The end-of-day SMS summary is **removed** from the v3 design.” — https://github.com/AlastairZeved/TheBoards/issues/169#issuecomment-5686227320
### B108. The morning lifecycle: each morning's first load auto-creates today's linked To-Do board (the B95 species, `ensureLinkedBoard`, title "Today's To Do" with the date pinned beneath it — B133 supersedes the original `MM/DD/YY To Do` format here) even with zero events, boots onto it, and carries YESTERDAY's incomplete notes forward — a MOVE, not a copy: every note on yesterday's linked board whose state is not 'complete' moves onto today's board at its same logical x/y, and yesterday's board keeps its completed notes; the carried note's absence from yesterday's board is accepted because History is retrospective reference (no links, no navigation between the day boards); each carried note wears `carriedOn` = the carrying day's date key — the transient daily marker the carried indicator (link 4) styles off, self-clearing by date comparison with no cleanup pass, set again to each new today by each later carry, and CLEARED by completing the note; and a MANUALLY ADDED card on a linked To-Do board — `board.cal` set, no `carriedOn`; surfaced cards (the reminder pass, a later link) and carried cards don't get it — HAD the two re-homing options on its long-press/right-click menu ("Add to existing board", "Create new board with this as first card"), REMOVED IN FULL by B115, the owner's ruling on issue #205 — a manual add is not tied to any other board, and it never propagates to other boards (issue #169 §2; implements B107's unconditional landing; supersedes B105's events-exist-only MORNING condition — the boot path — while B105's mid-session day-roll under an open app stays exactly as shipped: the once-per-day keyed check still runs at boot() and renderCal() on today-key change, and the mid-session roll still navigates only when the day carries events and carries nothing forward; keeps B81's commit-on-release for the whole launch consequence chain, B9's History routes, B21's read-site defaulting for `carriedOn` (no schema change — the field is written when the carry writes the note), B95's To-Do species and R5's event-on-first-add, B106's mirror ownership of the Requirements section; waives nothing)

**The morning.** B107 ruled the landing unconditional; this builds it. The
once-per-day guard (`rollDay` in boards.js) already distinguished "a fresh
page load" from "the day changed under an open app" by construction — the
first check of a load IS boot's — so the morning branch is that first
check, and the mid-session branch keeps B105 verbatim: it navigates only
when the day carries events, creates nothing new (the board, if absent,
is created by the same `ensureLinkedBoard` chain as before), and carries
nothing forward. A page kept open past midnight gets its carry on the
next morning's first load. The morning work runs as one consequence
under `commitAction` (B81): ensure the board, carry yesterday's
incompletes, persist, sync the mirror (B106), then the plain `swapBoard`
landing.

**The carry.** MOVE, not copy — the owner's ruling on the chain card.
Positions are permanent (PRD principle 3), so the note's logical x/y ride
across unchanged; `carriedOn` rides on the note record with the day key of
the board it landed on, so the flag is always "this note was carried ONTO
this board today" — yesterday's board never needs to know a note left.
Completing the note (single toolbar, selection bulk — both route through
`setNoteState`) deletes the flag; restoring does not re-set it, because
the flag describes a carry, not incompleteness. The field is a read-site
default (B21): old records lack it, which is falsy.

**The manual add's way out — closed.** The two menu options this ruling
described — "Add to existing board" and "Create new board with this as
first card" — were never requested and are removed in full by B115, the
owner's ruling on issue #205. The manual add keeps the shipped menu set
minus those two options, stays non-propagating, and belongs to no other
board; the reminder pass and a later link remain the only ways a card
reaches a second board.

**The record.** `sw.js` CACHE bump v53→v54 ships it; test/tokens.js's two
build-pin assertions re-pin to v54 in the same PR. The day-roll suite's
"nothing created with 0 events" assertion is rewritten deliberately (the
AGENTS.md rule) — R2 of test/day-roll.js asserted B105's morning, which
B107 superseded; the new test/morning.js suite owns the B108 contract.
**Open, unchanged:** recurring reminders, the month view, the reminder
surfacing pass, the carried indicator's styling (it reads `carriedOn`).

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B109. The reminder pass: every note card carries a CLOCK TOGGLE bottom-right — one tap sets or clears the reminder (no picker, no dialog, no time concept anywhere in the record — the key is simply `reminder: true` or absent, B21's absence-is-off idiom), the active clock takes the `--reminder` fill with a bloom of the same token, and a reminder-active note SURFACES to today's linked To-Do board as a render-time ECHO — one source of truth, no copy records (issue #169 §2, the reminder pass B104 promised; keeps B104's clock-toggle ruling verbatim, B107's retirement of the red past-due state and of SMS, B81's commit-on-release for the tap, B9's plain swap route for navigation, §2's token discipline for the new colour; waives nothing)

**The rulings.** (1) The toggle: a drawn clock mark (`GLYPH.clock`, §13.3's
hand-rolled discipline — no icon library, the no-dependencies law) sits
bottom-right of every note card on every board, always visible; it is
classified by the recognizer before the note beneath it and commits through
`commitAction` exactly as the B84 toolbar tabs do, pointer and keyboard
alike. Clearing DELETES the key rather than writing `false`, so a legacy note
and a cleared one are the same shape and the record can never grow a time
field by accident. Active, the clock wears `--reminder` `#52c4e2` (UIUX
§2.6.2 — cool by law, the water's hue lifted bright, per-note like the
highlight wash, never board-rotating) plus a bloom of the same token; the
aria-label carries the toggle's face (`Remind me` ⇄ `Remove reminder`), never
colour alone (UIUX §1). An empty note keeps no frame (§6.2) and shows no
clock.

(2) The surfacing: a note with `reminder` set whose board is NOT today's
linked To-Do renders an echo of itself on today's board — computed at render
time (`hydrateSurfaced`, after the sync note pass, gated by a stale-async
token), never stored: no reference, no copy, no schema change. The echo is a
`.note.surfaced` element with the note's own id, text, scratch-out and clock,
wearing the SOURCE board's note hue via `data-src-cat` (the ladder's §2.2.2
rebinding discipline — the source hue B104 ruled). Surfacing set = ACTIVE
reminder notes on other boards: a reminder note on today's board itself just
glows; completing a note anywhere unsurfaces it; clearing the clock
unsurfaces it. The echo is inert to tap, drag, pinch and edit — the
recognizer finds no record in `state.current.notes` and the drag/pinch paths
guard on it — because an echo is a reference, not a second note. Its
long-press (mobile) / right-click (desktop) menu carries exactly two items:
**Complete** (writes the SOURCE record — `state` set, `carriedOn` cleared
under B108's law — then re-renders, unsurfacing) and **Go to Board** (the
plain `swapBoard` route, B9; the issue's own wording, verbatim). Link is not
on the echo's menu: it arms against `state.current`'s notes and would strand
on a record that is not there.

(3) Interactions that do NOT change: completing a reminder note on its own
board just completes it (nothing recreates it — recurring reminders stay
open, B104/B107); manual adds to a linked To-Do keep B108's menu untouched —
the clock works on them as on any note, and a manual add with a reminder set
is already home, so it surfaces nowhere.

**The record.** No schema change: `reminder` is written at the read-site
toggle (B21's idiom), `carriedOn` untouched. `sw.js` CACHE bump v54→v55 and
`app.js` OWN_BUILD v55 ship it; test/tokens.js re-pins both in the same PR
and gains §2.6.2's token checks. New test/reminder.js owns the B109 contract
(genuine CDP touch, B27b). Echoes are render-time references and do not
travel into the PDF export, which draws board records. **Open, unchanged:**
recurring reminders, the month view, the carried indicator's styling (link 5
reads `carriedOn`).

**Source:** issue #169 §1–§2 (owner, v3 design of record): “A note card with an active reminder is automatically surfaced to Today’s To Do board”; “Notes pulled from other boards retain their original background color as a visual reference to their source board.” — https://github.com/AlastairZeved/TheBoards/issues/169
### B110. The carried indicator: a note carried onto its board today wears B104's status layer — its frame takes `--carried` `#E1BE26` (UIUX §2.6.3) and a soft bloom of the same token, the yellow border + glow the owner's v3 design rules; never the whole-card fill (owner-rejected in #169 §3 as hyperbolic) and never the highlight layer; the trigger is B108's `carriedOn` read at render — the field equals the today key and nothing else — so the treatment is the field's shadow, recomputed at every render with no stored style state and no cleanup pass: a note carried on an earlier day and left where it landed renders plain by the date comparison alone, and completing the note clears the field under B108's law so the glow ends with it — complete treatment wins; the highlight wash (B71) and the carried frame are different layers that may sit on one card, the wash the fill and the status the frame, in the issue's priority order highlight → status → plain; a held note is §4.2's pressed and keeps the engaged look while it moves, the status returning on release (issue #169 §3, the carried-over indicator B104 promised and B107 made the only status state; keeps B108's `carriedOn` law verbatim — this change sets and clears NOTHING, it reads; keeps B107's red retirement, B104's never-the-highlight two-layer law, §2's token discipline for the new colour; waives nothing)

**The token.** The status yellow is the highlight's own amber family, hue held
(~49°) and dropped a rung: luminance 0.5297, below the wash's 0.6748 so
attention outranks status exactly as the issue orders it, above the ink
crossover (0.1788) so the card's dark ink stays correct through the frame, and
carrying `--ink-dark` at 10.62:1. One new warm note value joins the wash's —
the second a note can wear — while `--danger` stays the only warm ACCENT (§2.6;
the accents live on chrome, the wash and the glow on notes). Like the wash and
the reminder it does not rotate with the ladder; UIUX §2.6.3 owns the table,
§4.8 owns the drawn form, and test/tokens.js gains the §2.6.3 checks ([5d]),
its count moved with them.

**The drawn form and §1.** The bloom is the state's geometry — a `box-shadow`
of the token around the card's 2px frame — and the hue names which state wears
it, the same standing as the highlight wash (B71): a state with no control of
its own carries no aria lever, the record is the truth, and §4.2's states table
gains the row. §4.2's pressed keeps precedence over the status frame (the rule
order): a held card shows the engaged ink frame, the status returns on release.

**The record.** No schema change and no lifecycle change: `carriedOn` is
B108's, set by the carry and cleared by completion (B108's law, untouched);
render reads it against `calKey(new Date())` and the class is its shadow
(`setCarriedUi`, called from `makeNoteEl` and from `setNoteState`, which
recomputes it the moment completion or restoration happens — no re-render
dependency, no drift between record and look). `sw.js` CACHE bump v55→v56 and
`app.js` OWN_BUILD v56 ship it; test/tokens.js re-pins both in the same PR. New
test/carried.js owns the B110 contract (genuine CDP touch, B27b): carried
renders frame+bloom, plain renders plain, completing removes the glow in place,
highlight and carried coexist in their own layers, a stale `carriedOn` renders
plain. The widget carrying the same mechanic is DROPPED (the owner's post-B107
ruling — v3 notifications are none); no red status path anywhere in the diff —
B107's retirement holds. **Open, unchanged:** recurring reminders, the month
view.

**Source:** issue #169 §3 (owner, v3 design of record): “Adopted: Border + Soft Glow” with “Carried Over … Yellow border + yellow glow”; “Rejected: Red coloring of entire note card. This is overengineered, hyperbolic, and visually aggressive.” — https://github.com/AlastairZeved/TheBoards/issues/169
### B111. The "Today's To Do History" rail is KILLED — it existed to hold the end-of-day summary, the summary is gone (B107), and it gets no new job: Today's To Do is just the board, historical reference remains the past days' linked boards in the lists, and no rail and no new surface is built; and the 2x2 home screen widget is DROPPED — a PWA cannot render a home-screen widget on any platform, and the workarounds (an installed app, an APK) break the no-package and no-backend laws, so the at-a-glance surface is the app itself, via B107's unconditional morning landing, while the standing calendar rail (B99) remains what it already is — not a widget substitute, just itself; with both gone, v3 notifications are NONE — consistent with §1.4's no-demands law, nothing pushes and nothing sits outside the app, and the status-indicator glow (B110) lives only on the board (issue #169, the owner's follow-up ruling of 2026-09-15, the comment of record: https://github.com/AlastairZeved/TheBoards/issues/169#issuecomment-5686476517; supersedes B107's two pending clauses — the widget's ON-HOLD-pending-a-capability-ruling clause and the History rail's PENDING-a-separate-owner-ruling clause — by ruling both out outright, and B110's standing reference to the widget as dropped is confirmed rather than amended; keeps B107's SMS removal, red past-due retirement, carried-only status and unconditional morning landing, B110's border + glow grammar and every colour it pinned, B99's calendar rail untouched, B104's clock toggle, §1.4's no-demands law and §3.2's no-backend law; recurring reminders and the month view remain the only open questions; waives nothing)

**The rulings.** The "Today's To Do History" rail is killed. B104 defined it
as the summary's home on the board — a thin rail above the row of buttons —
and B107 left it pending a separate owner ruling once the summary was
removed. The owner's ruling removes it: no summary, no new job, no rail.
Today's To Do is just the board. Historical reference is already served by
the past days' linked boards sitting in the lists — no rail, no new surface,
and B9's History routes stay the only way back to a day.

**The widget.** The 2x2 home screen widget is dropped. A PWA cannot render a
home-screen widget on any platform, and the workarounds — an installed app
or an APK — collide with the no-package and no-backend laws (§2.3, §3.2).
The at-a-glance surface is the app itself: boot lands on today's To-Do board
every morning (B107's unconditional landing, shipped as B108). The standing
calendar rail (B99) remains what it already is — not a widget substitute,
just itself. The consequence is stated plainly: v3 notifications are NONE.
Nothing pushes, nothing sits outside the app, and the status glow (B110)
lives only on the board.

**The record.** PRD §2.3's notifications row is amended: the widget clause
("notifications reduce to the 2x2 widget, itself pending a capability
ruling") is resolved to dropped — nothing pushes, nothing sits outside the
app. B107's two pending clauses are superseded by this entry by number, not
edited in place. Docs-only: no code, no `sw.js` CACHE bump, no redeploy
(`**/*.md` is already paths-ignored in the deploy workflow). **Open,
unchanged:** recurring reminders, the month view.

**Source:** owner ruling of record, 2026-09-15, comment on issue #169: “The ‘Today’s To Do History’ rail is killed.” / “The 2x2 home screen widget is dropped.” — https://github.com/AlastairZeved/TheBoards/issues/169#issuecomment-5686476517
### B112. Boot opens a BOARD: the most-recent pick — at launch in `app.js` and in `boards.js`' `ensureCurrentValid` — filters `title !== undefined` before the reduce, because events ride the boards store (B105) with no `updatedAt`, `undefined > anything` is false, and an unfiltered reduce over the raw store returns its first record verbatim: a store whose lowest uuid is an event record booted that event as the board and crashed `renderBoard`'s `sanitizeBoard` before the rail, the checkDayRoll, or anything else — found as a CI desktop-suite flake (D25, runs 35031082327 / 35019985397) that reproduced 4-of-4 deterministically once seeded event-first, the app-crash root cause the test's timing narrative had been covering; the pick is now the most-recent record that HAS a title, in both sites, the same guard twice because they are the same reduce (issue: the D25 CI-flake investigation; keeps B108's bootstrap intent — launch lands the board the user last touched, the pick's purpose is untouched and an events-first store simply has no candidate, so the empty-store branch creates a fresh board as it already did; keeps B21's read-site defaulting — the rule is computed at the read, no stored flag, and an old event record renders correctly as an event wherever it is actually opened; keeps B105's event records verbatim — nothing gains a title, nothing gains an `updatedAt`, the guard is the read-site's, not the record's; waives nothing)

**The record.** No schema change, no lifecycle change: the filter is two
lines at the shared reduce in each caller, and the empty-filtered branch
falls through to the same `newBoardRecord()` path the empty store always
took. `sw.js` CACHE bump v56→v57 and `app.js` OWN_BUILD v57 ship it;
test/tokens.js re-pins both in the same PR (deliberate rewrite of the pin
strings, same assertions). test/desktop.js's D25 — the test that caught it —
seeds a single clean linked pair with createdAt-ordered events and waits on
the landed state, so an event-first regression fails loud instead of
racing. **Open, unchanged:** recurring reminders, the month view.

---

**Source:** owner bulk ratification, 2026-09-16 — https://github.com/AlastairZeved/TheBoards/pull/209#issuecomment-5700847803 ("all 89 entries ... APPROVED as law", no exceptions)

### B113. Recurring reminders are RULED OUT — the reminder shipped in B108/B109 is the complete feature: a reminder is set once by the clock toggle and completing the note completes it — nothing reschedules it, nothing recreates it, and re-tapping the clock is the only way a reminder returns; and the month view is not undecided either — it is DEFERRED to issue #191 ("New component: month view calendar in Calendar view"), parked behind issue #170 (the calendar card size reduction), pointed elsewhere rather than left open (issue #169, the owner's ruling of record of 2026-09-15, the comment: https://github.com/AlastairZeved/TheBoards/issues/169#issuecomment-5691814223, on the now-closed issue; supersedes B104's explicitly-open clause on recurring reminders and the month view and the "recurring reminders and the month view remain open" / "Open, unchanged" clauses of B107, B108, B109, B110, B111 and B112 — by number, not edited in place; keeps B104's no-time-stored law — a recurring schedule needs dates and the record carries none — B109's toggle-and-echo mechanism verbatim, B108's completion of the note as the reminder's end; waives nothing)

**The ruling.** Recurring reminders are out. B104 recorded them as explicitly
undecided, alongside the month view, in the same breath as the reminder
itself; the owner's 2026-09-15 ruling on #169 closes the question: no
recurring reminders. The clock toggle sets or clears, the reminder surfaces
the note to that morning's To-Do board, and completing the note is the end of
it — a completed reminder is complete. The only return path is the person's
own tap on the clock.

**Why the no-time law already decided it.** A recurring reminder is a
schedule, and a schedule needs dates; B104 ruled that no time concept lives
anywhere in the record (`reminder: true` or absent, B21's absence-is-off
idiom). Recurrence would either smuggle dates into the record or need a
second surface to manage them — both collide with the ruling the reminder
was built under. Ruling it out is the consistent reading, not a new law.

**The month view.** Not open, and not dead: deferred to #191, parked behind
#170 (the calendar card size reduction). #191's body is intentionally empty
for the owner to fill in later — the decision of record is the deferral
itself, and this entry only points at it.

**The record.** PRD §2.3's reminders row is amended to name recurring
reminders as out of scope. Docs-only: no code, no `sw.js` CACHE bump, no
redeploy (`**/*.md` is paths-ignored in the deploy workflow). B104's open
list is closed by the rulings since: the past-due trigger retired (B107),
the summary's text format retired with the SMS (B107), the week-absent
first-load case built in B108's unconditional landing, recurring reminders
ruled out here, and the month view pointed at #191 rather than left open.

**Source:** owner ruling of record, 2026-09-15, comment on issue #169: “Recurring reminders: NO.” / “Month view: deferred, not dead.” — https://github.com/AlastairZeved/TheBoards/issues/169#issuecomment-5691814223
### B114. Copy re-homes from the note's on-select toolbar to the note's long-press/right-click menu — the toolbar becomes three tabs, Complete · Highlight · Delete, and `--accent-copy` retires with its tab (issue #171, the owner's ruling of record; supersedes B84's Complete·Copy·Delete-on-toolbar clause and B85's `--accent-copy` fixed-blue identity clause; narrows B91's menu scope from relational-only to one state act leading one relational act; keeps B84's on-select toolbar and its on-select reveal, B86's tab metrics, B87/B88's anchoring, B90's mobile first-tap select, B91's Link armament verbatim, B109's echo surfacing, §1's state-is-never-colour-alone; waives nothing)

**The ruling.** Copy moves off the note's on-select toolbar into the note's
long-press (mobile) / right-click (desktop) menu (`openMenuFor`). The toolbar
is three tabs from here on — **Complete · Highlight · Delete**, order
otherwise unchanged, Delete still last in `--danger` — and Copy is the menu's
**first item**, before Link. Precedent is the echo menu (B109), which leads
with Complete: a state act on the note itself comes before the relational
act, because the menu is opened *on* a note and the note's own state is the
closer hand. The item is `GLYPH.copy` labelled `COPY.copy`, a real button
like every menu item, so keyboard access survives the move — the toolbar's
keyboard route keeps working through the surviving three tabs, and Copy's
keyboard access is the menu's own focusable item.

**Semantics move verbatim, they do not shrink.** The menu's Copy is exactly
the toolbar's copy branch (`runNoteToolbarAction`): tapped on a single note
it copies that note's text; where the desktop multi-select grammar reaches
the menu (multiSel active, the tapped note in the selection), it copies the
**joined text of the whole selection, primary first, one `\n` between**. No
blur-first dance, no new state — the same `copyText` of the same live
`note.text`.

**Echoes get no Copy.** B109's surfaced echoes keep their menu as it is —
Complete and Go to Board only. An echo is a render-time reference; its record
lives on the source board, outside `state.current`, the same stranding that
already keeps Link off the echo menu. The toolbar change retires the Copy tab
on every note that renders one, echo or not, so no path serves a Copy of a
record the board does not hold.

**`--accent-copy` retires with its tab.** The token (§2.6.1, `#698ebf`, B85)
had exactly one consumer, `.note-tb-copy`; both die with the toolbar change.
The Highlight tab keeps B85's amber identity fill — B85's identity-fill
principle survives for Highlight, only its blue half is superseded. The
token-suite expected count moves with the token; the implementation card
declares before/after numbers. `NOTE_MIN_W`'s toolbar budget recomputes for
three tabs; the minimum itself stays.

**Why the record changes shape without breaking B84.** B84 moved a note's
actions out of a hidden gesture onto a declared row, and B114 moves one of
the four back — but Copy was always the odd one out: a read-only act, no
note state it flips, nothing to see afterwards (the copied toast is its whole
afterimage). Complete, Highlight and Delete each change the note and earn the
always-reachable row; Copy is an act *on* the text, and the menu — now a
superset of its B91 self — is where acts that don't wear state belong. B91's
revived menu was scoped to relational actions so it would not compete with
the toolbar; with Copy as a menu resident, B91's scope narrows: the note
menu carries one state act leading one relational act, and the toolbar keeps
the state acts that wear state.

**The record.** Rendered values — the three-tab row, the menu item's
position, the multi-select semantics, the echo exclusion, the retired
token — live in `UIUX §2.6.1`, `§4.5`, `§4.7` and `§7`. Docs-only on this
card: the styles.css token/rule removal, the `runNoteToolbarAction` copy
branch's move, and the `sw.js` CACHE bump are the implementation card's
work, gated behind this card's merge. Cited: issue #171 (Spatial Reasoning
Fix), the owner's ruling of record.

**Source:** issue #171 (owner): “I keep long tapping notes and looking for the copy button instinctually, so better just move it there instead of fighting the app.” — https://github.com/AlastairZeved/TheBoards/issues/171
### B115. The two re-homing menu options are REMOVED in full — "Add to existing board" and "Create new board with this as first card", the pair B108 gave the manually added card on a linked To-Do board, were never requested and leave no trace of their addition: the long-press/right-click menu of a manual add is the shipped set minus those two options, and no buildMenu leaf, board chooser, or second picker surface exists for re-homing a manual add (issue #205, the owner's ruling of record: https://github.com/AlastairZeved/TheBoards/issues/205; supersedes ONLY the re-homing clause of B108 — the morning lifecycle itself is untouched: `ensureLinkedBoard`, the carry-forward MOVE with its same logical x/y, and `carriedOn` all stay exactly as shipped; the manual add stays non-propagating — the note exists once, on the day board it was typed onto, and the reminder pass and a later link remain the only ways a card reaches a second board; keeps B108's manual-add definition — `board.cal` set, no `carriedOn`, surfaced cards and carried cards don't get it, B114's menu armament, B91's menu as narrowed by B114, B109's echo surfacing, §1's state-is-never-colour-alone; waives nothing)

**Source:** issue #205 (owner): “Immediately remove them and leave no trace of their addition. Scope creep will not be tolerated.” — https://github.com/AlastairZeved/TheBoards/issues/205

### B116. The app's declared identity is the single string "TheBoards" — manifest.json `name` becomes "TheBoards" and every user-visible identity surface (document title, runtime document.title templates, PDF Producer, file/doc headers) carries that one string; `"short_name"` stays "Boards" — the owner's ruling of record: https://github.com/AlastairZeved/TheBoards/issues/195 (feature copy is untouched: "To-Do Boards" as a board-section name alongside Note/Learning/Idea Boards is section naming, not app identity; the already-generated `.desktop` launcher on an installed machine keeps its old `Name=` until the app is removed and reinstalled — expected, not a regression)

**Source:** issue #195 (owner): “The identity should be one string.” and on short_name: “keep or retire short_name (ruling needed — launcher truncation on narrow panels argues for keeping it).” — https://github.com/AlastairZeved/TheBoards/issues/195

**Pointer, 2026-09-16:** B121 — issue #217 — supersedes this ruling's identity string only: the app's declared identity is now "Zeved Boards", and the service-worker CACHE lineage `todo-boards-v*` retires with it. The `short_name` "Boards" clause and the section-naming carve-out stand.

### B117. The Calendar view gets its own color palette — the fifth binding of the luminance-pinned ladder, rotated to orange — the same eight rungs (`--deep`, `--card`, `--water-top`, `--water-mid`, `--water-bot`, `--water-bot-a`, `--frame`, `--note`) bound on `#cal-view` the way To-Do binds on `:root`, every rung reproducing the To-Do rung's WCAG relative luminance to the 4dp UIUX §2.2 prints and its 2dp ink ratios, the arc narrowed to ~47°–66° so the view reads as one hue (issue #168, the owner's ruling of record: https://github.com/AlastairZeved/TheBoards/issues/168; keeps B67/B74's ladder law — hue is the only free axis, luminance is the pinned coordinate, the binding is a rebinding of the token names and never a background override, and `--chrome`, the ink poles and the accents do not rotate; the calendar is a body-level section and nothing inside it carries `data-cat`, so the rebinding re-scopes exactly the calendar chrome — rail, R1 row, day cards, month view — and linked boards opened from a day card keep their own category scopes; residuals recorded in UIUX §2.2.2, the suite now parses `#cal-view` as a fifth scope and runs every §2 table against all five ladders; waives nothing)

**Source:** issue #168 (owner): “The Calendar should have its own color palette that matches the luminescence and palettes for each category The Boards but The Calendar will use Orange.” — https://github.com/AlastairZeved/TheBoards/issues/168

### B118. The board rail is collapsible furniture on wide: it ships COLLAPSED — a 40px face mirroring B99's calendar rail at the viewport's left edge — one tap expands it into B24's 300px pane, and an arrow control collapses it back (issue #211, the owner's ruling of record: https://github.com/AlastairZeved/TheBoards/issues/211; supersedes ONLY B24's geometry/presence clause — the pane at "a fixed 300 CSS px", always present; keeps B24's sunken-pane identity (`--pane`, inset shadow — embedded, not floating), its card grammar, its comparator as carried forward by B69, swap-in-place with no history push, its create/delete paths, its 150ms crossfade and setTimeout-sequenced teardown, and keeps B100's rail-is-desktop's-all-boards-surface clause — the rail still names every category with every board, from behind its face until expanded; the collapsed-by-default state is the owner's session ruling of 2026-09-16; wide is B96's tier as retuned by B103 — desktop ∪ tablet; this record rules the collapse grammar and the collapsed-by-default state and nothing further about the collapsed face's contents — no B99 mechanic beyond the expand/collapse grammar issue #211 names is carried to the pane by this entry; waives nothing)

**Source:** issue #211 (owner): “New behavior: 'All Boards' menu on the left side of the viewport functions just like the 'Calendar' rail on the right side of the viewport by being tappable to expand with an arrow button to collapse.” — https://github.com/AlastairZeved/TheBoards/issues/211; collapsed-by-default: owner session ruling, 2026-09-16: “Starts collapsed like the Calendar rail — true mirror: two 40px rails, board fills the viewport, tap the rail to expand.”

### B119. The All tab retires on tablet too: the tab's hide widens from `html.desktop` to `html.wide` — desktop ∪ tablet — the left board rail is the one All-Boards surface on wide, and the calendar panel's All Boards control retires on tablet the same way it retired on desktop; the lot-grid picker survives mobile-only (issue #212, the owner's ruling of record: https://github.com/AlastairZeved/TheBoards/issues/212#issuecomment-5703415803; supersedes ONLY B100's tablet clause — "Mobile and tablet keep the tab: it is their only way into the lot-grid picker" — and B100's flag paragraph's tablet-keeps-its-All-tab ruling; keeps B100's desktop retirement exactly as ruled and its rail-is-desktop's-all-boards-surface clause, now read on wide; keeps B74's picker mechanics for mobile — below 744px there is no left rail, so the tab stays mobile's entry into the grid — B82's rising drill, B9's back stack, B96's tiers and B103's floor — and waives nothing)

**Source:** issue #212 (owner), 2026-09-16: "Yes it dies in tablet arrangement too. If there is a left rail already showing the all boards menu then there's no reason for it to exist as an all button in the parking lot too." — https://github.com/AlastairZeved/TheBoards/issues/212#issuecomment-5703415803

**The ruling, applied.** One sentence kills the tablet carve-out. B96 put
the pane in the tablet arrangement, so on tablet the rail is already
showing the all-boards menu — the tab is the second door B100 closed on
desktop, and the correction is the same one, one tier wider. Four
consequences, no more:

1. **The hide widens.** The All tab's retirement selector moves from
   `html.desktop` to `html.wide` (B96's tier as retuned by B103: desktop
   ∪ tablet). The left board rail is the one All-Boards surface on wide —
   on tablet from behind B118's collapsed face, one tap away, exactly as
   on desktop. Wide's board row is **two tabs** (Export · Import), mobile
   keeps its four.
2. **The calendar's second door closes with it.** The expanded panel's
   All Boards control (`#cal-boards`, guarded `isDesktop` since B100)
   retires on tablet the same way — the guard widens to `isWide` — or it
   would become the second door the ruling just closed. The panel's row
   stays **Back + Export** on wide.
3. **The picker is mobile-only.** B74's lot-grid picker survives below
   744px: mobile has no left rail, so the tab stays mobile's only entry
   into the grid. B74 stands for mobile; B100's carve-out dies in its
   tablet clause only.
4. **Mobile behavior otherwise untouched.** The four-tab row, the grid,
   the drill, the back stack — nothing mobile reads changes.

### B120. Note cards gain an optional single-line Title — a header-style tab peeking from behind the card's top-left corner, armed from the note menu's "Add Title" item — and the note toolbar moves to the note's bottom edge, centred on the card (issue #173, the owner's ruling of record: https://github.com/AlastairZeved/TheBoards/issues/173; supersedes ONLY B87's note-toolbar edge clause — the row flush on the note's TOP edge — and B88's note-toolbar anchor clause — the row left-anchored far left; keeps B87's board-action-row clause and B88's board-row left-anchor in full — the lot's row does not move; keeps B84's on-select toolbar and its on-select reveal, B86's tab metrics, B87's gapless-edge principle and `TB_ROW_H` flip grammar, B90's mobile select-then-edit, B91's revived note menu as narrowed by B114 — Copy first, Link after — and §1's state-is-never-colour-alone; the optional title field is a plain board-record field read through the B21 default, the idiom B91's `links` ride; waives nothing)

**Source:** issue #173 (owner): “What is it: A Title that is displayed at the top left of the note card and looks like a note popping up from behind it with header-style title. How does user access feature: Long press/right click note card to access menu, menu item "Add Title". Expected Behavior: Note card appears in the top left of the note card with a cursor and keyboard displays, ready to type the title. Downstream ripples: Currently there is a button row anchored to the top left of note cards. Move this to the bottom of the note card and center the buttons to the note card instead of anchoring them left.” — https://github.com/AlastairZeved/TheBoards/issues/173

**The ruling.** Two moves, and nothing past the issue's own text:

1. **The Title.** A note gains an optional single-line Title, rendered as a
   header-style tab peeking out from behind the card's top-left corner — a
   note slid up from behind, its header showing. It is armed from the note's
   long-press/right-click menu, a new **"Add Title"** item beside Copy and
   Link: B91's revived menu, as B114 narrowed it, grows a second kind of
   act, and the menu is no longer Copy + Link alone. Choosing it puts the
   cursor in the title with the keyboard ready, exactly as the issue's
   expected behavior writes it. An empty title renders nothing — no tab, no
   frame, no reserved space. The optional field persists with the record
   and reads through the B21 default. Everything the issue does not name
   about the title — its width behaviour against the card, its edit and
   clear paths, its render in the PDF — is implementation detail for the
   build card, not law; this record rules only what the issue's text
   carries.

2. **The toolbar moves.** The note's on-select button row — Complete ·
   Highlight · Delete (B114's three tabs) — leaves the note's top edge for
   the **bottom edge, centred on the card**: the toolbar's `bottom: 100%`
   (B87) and `left: 0` (B88) give way to a bottom-edge, centred anchor, and
   the row keeps every other property it has — a scaling child of the note
   (never wider than it), shown on select/focus, hidden on empty notes, the
   §8 fade, the 44px hit targets, B86's metrics. B87's gapless principle
   survives the move — the row sits flush ON the note's bottom edge, no gap
   below — and B88's board-action row is untouched: the lot's row stays
   flush on the lot's top edge, left-anchored. The flip grammar
   (`reflectToolbarFlip`, `TB_ROW_H`) re-reads for the new edge: the
   near-sheet-top case becomes near-sheet-bottom, the same one flip,
   re-aimed. B120 supersedes the two clauses and nothing else.

**The record.** Docs-only on this card — the styles.css rules that carry
the superseded citations (`.note-toolbar { left: 0; bottom: 100% }`, with
the B88/B87 comments), the title render and the menu item, and the `sw.js`
CACHE bump are the implementation card's work, gated behind this card's
merge. No CACHE bump here.

**Pointer audit:** dated one-line pointers added at B87, B88, B91's arm
paragraph, and UIUX §4.5 (twice) and §7.

### B121. The app's declared identity is the single string "Zeved Boards" — every user-visible and project-facing surface carries it: manifest.json `name`, index.html `<title>`, the three runtime document.title templates, the PDF Producer, the file/doc headers, and README/AGENTS/humans/robots/sitemap/SECURITY — and no trace of "TheBoards" remains on live surfaces; the service-worker CACHE renames `todo-boards-v*` → `zeved-boards-v*` with a paired version bump (shipped bytes changed) and the build handshake in lockstep, the self-heal's deletion filter widened to both prefixes so old caches still clean up on activate; the storage keys never rename — IndexedDB `boards-db` and its `boards` store keep their names, renaming would orphan every user's boards — the data-loss exception to "no trace"; feature copy stays untouched — "To-Do Boards" as a board-section name alongside Note/Learning/Idea Boards is section naming, not app identity (issue #217, the owner's ruling of record: https://github.com/AlastairZeved/TheBoards/issues/217; supersedes B116's identity-string clause — "TheBoards"; keeps B116's `short_name` clause and its section-naming carve-out, B21's storage-key law and every storage key it protects, §3.2's no-backend law; the repo and Pages URLs keep their current spelling until the owner renames the repo manually AFTER this PR merges, per the issue's note; waives nothing)

**Source:** issue #217 (owner): "Full renaming to Zeved Boards. No trace of TheBoards should exist in codebase or read.me anymore. Zeved Boards v1.0 baby!" and: "the Repo will be renamed by me manually AFTER this PR is merged, not before." — https://github.com/AlastairZeved/TheBoards/issues/217

**The ruling.** The identity is one string again, renamed. What the grep may
still find is exhaustively classified: DECISIONS.md's verbatim quotes and the
dated pointers (owner-provenance records), the dated artifacts in
docs/plans/ and docs/review-2026-08-31.md and docs/mockups/favicon/ (records,
not live surfaces), and the literal repo/Pages URLs (they redirect after the
manual repo rename; pointing them at the new name now would 404 this PR's own
CI). The old cache prefix survives in exactly two places, both deliberate:
app.js's self-heal filter (so pre-rename caches still delete on the
mismatch path) and sw-update's fixture of the retired worker. Storage keys
are law: `boards-db`/`boards` outlive every rename.

**Pointer, 2026-09-17:** the owner's rebrand (chat ruling, PR #234) fixes the
brand spelling everywhere a string can carry it: the identity is "Zeved
Boards" and the CACHE lineage stays `zeved-boards-v*`, with `todo-boards-v*`
as the sole retired prefix in the self-heal's deletion filter. The
`short_name` "Boards", the storage keys `boards-db`/`boards` and the
section-naming carve-out all stand.

### B122. The brand spelling everywhere a string can carry it is "Zeved Boards" — the owner's ruling (issue #217, chat 2026-09-17) fixes the identity and the CACHE lineage `zeved-boards-v<N>` with a paired version bump (shipped bytes changed) and the build handshake in lockstep — the same mechanics B121 already defined — and the retired prefix `todo-boards-v*` stays in the self-heal's deletion filter so devices that cached under the pre-rename name clean up on activate; nothing else in B121 changes — the identity "Zeved Boards", `short_name` "Boards", the storage keys `boards-db`/`boards` and the section-naming carve-out all stand as ruled (issue #217, the owner's ruling of record: https://github.com/AlastairZeved/TheBoards/issues/217#issuecomment-5706480994; supersedes ONLY B121's CACHE-lineage clause — the interim spelling and its both-prefixes filter; keeps B121's version-bump-and-handshake law for the rename itself, B121's identity/`short_name`/storage-key/section-naming clauses verbatim, B116's `short_name` clause and its section-naming carve-out as B121 kept them, B21's storage-key law, §3.2's no-backend law; the PRD's CACHE-lineage prose and the sw.js bump are the implementation card's work, gated behind this ruling's merge; waives nothing)

**Source:** issue #217 (owner ruling of record, comment 5706480994, owner chat ruling; spelling normalized at the owner's direction, 2026-09-17 — no misspelling remains in this repo) — https://github.com/AlastairZeved/TheBoards/issues/217#issuecomment-5706480994

**The ruling.** One letter, one namespace. A spelling once written into a
ruling is a spelling a future grep inherits, so the record carries the
owner's brand spelling in the normalized form. The self-heal carries a
retired prefix for the same reason it always has: a device that cached under
the pre-rename name must delete on the mismatch path. Nothing else in B121
is disturbed: the identity stands, the storage keys stand, and the
implementation card's diff is the CACHE name, the bump, and the filter —
nothing more.

### B123. The JSON backup payload is `{ app: 'the-boards', version: 2, exportedAt, boards: [...], calendarEvents: [...] }` — board records and calendar event records exported as what they are, the importer normalizing by record type, v1 files still importing with their events salvaged (issue #231, the owner's ruling of record: https://github.com/AlastairZeved/TheBoards/issues/231#issuecomment-5707263908; supersedes ONLY B92's payload-shape clause — `{ app: 'the-boards', version: 1, exportedAt, boards: [...] }` and the mixed-array export it produced; keeps B92's three-tab row and PDF · JSON choice menu untouched, B92's `flushSave()` precondition, B92's merge-import ruling extended to events unchanged, B21's storage-key law, §3.2's no-backend law; the exporter/importer diff is the implementation card's work, gated behind this ruling's merge; waives nothing)

**Source:** issue #231 (owner ruling of record, comment 5707263908, owner chat ruling transcribed verbatim): "Fan it out" — https://github.com/AlastairZeved/TheBoards/issues/231#issuecomment-5707263908

**The ruling.** The IndexedDB store `boards` holds two record types and always
has — board records and calendar event records (`{id, date, text, state,
createdAt}`, written into the same store by `addCalEvent`) — and B92's payload
shape called them one thing. Issue #231's audit priced the lie: `exportAllJson`
dumps `idbGetAll()` raw into `payload.boards`, so the events ride in an array
labeled `boards`, and `normalizeImportedBoard` then normalizes each one to
nothing and drops it — restoring a backup silently amputated the calendar, on
the one operation whose purpose is not losing data. The record corrects the
label, not the storage: **the payload names the two record types what they
are.** `exportAllJson` writes `{ app: 'the-boards', version: 2, exportedAt,
boards: [...], calendarEvents: [...] }` — board records and event records each
exported verbatim as stored, no invented fields, and §10.6's full-fidelity
claim ("nothing is projected, nothing is swept") true of both types for the
first time. B92's precondition stands unchanged: `flushSave()` first — the
debounced-save staleness it answers applies to events exactly as to boards.

**The importer normalizes by record type, and v1 files are salvaged.** A v2
file reads `calendarEvents` directly. A v1 file — every backup already on
someone's disk, including issue #231's reporter's 2026-09-16 file — carries
the old mixed array, and `eventsOf` (boards.js, the existing named filter; the
de-facto `b.title !== undefined` type test given a name, shared by importer
and exporter as the issue directs) separates the flat event records from the
boards before normalization. No v1 backup becomes unrestorable; the read-site
defaulting idiom (PRD §4.1) applied to the store's second record type. Events
enter storage through the same door boards do: coerced, not trusted — a backup
has been OUT of the device — ids re-stamped when absent, the B8/B31 husk sweep
at the door.

**Merge-import semantics extend to events unchanged — B92's ruling, extended,
not replaced.** An event whose `id` already exists is overwritten by the
file's copy; new ids are added; every event the file never mentions the device
keeps. The file is the truth for the ids it carries; the device keeps the
rest — the same sentence B92 wrote for boards, now true of both record types.

**What is kept.** B92's control chrome stands untouched — the three-tab row,
Export's PDF · JSON choice menu, the retired anchor menu. B21's storage-key
law stands: no key or store renames, the fix is a payload shape, not a
migration. B92's merge-import ruling stands, extended to the new array.

**The record.** Docs-only on this card — the exporter/importer diff (the
payload version, the `calendarEvents` array, the type-aware normalize, the
named `eventsOf` predicate shared by exporter and importer) is the
implementation card's work, gated behind this ruling's merge. No CACHE bump
here.### B124. The calendar view's R1 top row is Back alone, and Back renders directly above the month view — All Boards and Export leave the calendar (issue #237, the owner's ruling of record: https://github.com/AlastairZeved/TheBoards/issues/237; supersedes ONLY B95/R1's top-row clause — "Back · All Boards · Export, anchored left / center / right" — and the three-button-row passages of B98 and B99 that depend on it; keeps R1's visible-way-off principle — Back alone satisfies it in the calendar view, as the issue's own text states — and B9's back-gesture law, B98's fill / floor / state machinery for the remaining button, B99's rail and panel states, B95's window / data / squeeze / tablet machinery, B119's wide All-Boards carve-out, §3.2's no-backend law; waives nothing)

**Source:** issue #237 (owner, ruling of record), owner statement transcribed
verbatim: "Calendar view: remove Export and All Boards buttons, move Back
above the month view" — https://github.com/AlastairZeved/TheBoards/issues/237

**The owner's issue text, verbatim:**

> In the calendar view (mobile, full-screen):
>
> **Remove**
> - The **All Boards** button (grid icon)
> - The **Export** button (download icon)
>
> Both are circled in the attached screenshot. Only **Back** should remain from the R1 top row.
>
> **Move**
> - The **Back** button should sit directly **above the month view** (the September 2026 strip at the bottom of the screenshot), per the arrow in the screenshot — not anchored at the top of the day list.
>
> **Touchpoints (from a quick grep, verify before working):**
> - `boards.js` — top-row wiring: `el.calBack` (~line 1358), `el.calExport` (~line 1383), R1 row described ~line 810
> - `index.html` — the buttons' markup / labels
>
> R1 says every surface has a visible way off — Back alone satisfies that in the calendar view; Export remains reachable elsewhere and All Boards remains reachable via the picker/rail.

**The ruling.** B95/R1 drew the calendar's exit row as three acts anchored
left / center / right, and B98 dressed all three. The owner now rules the
row down to one: **Back alone**, and Back moves from the top of the day list
to sit **directly above the month view**. R1's principle — every surface has
a visible way off — is untouched; the issue itself states that Back alone
satisfies it in the calendar view. All Boards and Export leave the calendar
view, and the issue's own text records where they remain reachable: Export
elsewhere, All Boards via the picker/rail.

**What is kept.** B95's calendar machinery — the computed window, the linked
To-Do boards, the squeeze, the tablet path — stands unchanged; only the row's
membership and Back's position are ruled. B98's fill / floor / state law
applies to the surviving button. B99's rail and panel states stand; the
panel's Back is the same collapse act. B119's wide All-Boards carve-out is
untouched — the left board rail remains the All-Boards surface on wide.

**The record.** Docs-only on this card — the markup, wiring, and layout diff
(the two buttons' removal, Back's re-anchor above the month view) is the
implementation card's work, gated behind this ruling's merge. No CACHE bump
here.

### B124. The site's fake static to-do board is removed entirely and replaced with a working embed of Zeved Boards — a real instance that allows note creation, resizing, drag, and the calendar, the whole thing — with a two-button toggle centered at the top of the embed space ("desktop" / "mobile") that switches the presentation between desktop and mobile views as a forced VIEW, not device detection; no persistence is required for the embed because, as the owner put it, it is just for visitors to get to try out the boards before going to the PWA; and in the mobile view the caption text "Tap the page. Type. A square draws itself around it." moves to the right side with the mobile board on the left to accommodate the viewport-size difference (Zezed site issue #2, the owner's ruling of record: https://github.com/AlastairZeved/AlastairZeved/issues/2; keeps B21's storage-key law and §3.2's no-backend law — the embed is the deployed app, not a re-implementation; waives nothing)

**Source:** issue #2 (owner ruling of record, owner chat transcribed verbatim): "Currently, there is a large to do board component in the middle of the site but it's not an accurate to do board at all. I need it removed entirely and instead I need a working version of the Zeved Boards embedded in that space. A two button switch toggle should be at the center top of the space with 'desktop' and 'mobile' as the toggles to switch the view between desktop Zeved Boards and mobile Zeved Boards views in the space. It should be a working embed that allows note creations and resizing and the calendar, the whole thing. Does it need to have storage of the notes at all since it's just for visitors to get to try out the boards before going to the PWA. For the mobile view, the description text 'Tap the page. Type....' move it to the right side with the mobile Zeved boards on the left side to accommodate the viewport size difference layouts." — https://github.com/AlastairZeved/AlastairZeved/issues/2

**The ruling.** Three owner words do the work here. (a) "A two button switch
toggle ... to switch the view between desktop Zeved Boards and mobile Zeved
Boards views" — the embed's desktop/mobile toggle is a forced presentation
override: the app's `isDesktop` matchMedia branch (AGENTS.md §2) is rendered
per the toggle's choice regardless of the visitor's actual viewport, which is
detection-subversion by explicit instruction, not a new detection path. (b)
"Does it need to have storage of the notes at all since it's just for visitors
to get to try out the boards before going to the PWA" — a question whose own
answer rules it: for a try-before-you-install demo, storage is not needed, so
the embed runs on throwaway storage wiped on every load and never touches the
visitor's real `boards-db` (B21's storage-key law keeps the real namespace
protected; a shared namespace would collide with the PWA's boards and lie
against the site copy below the embed that promises everything stays on the
device). (c) "It should be a working embed ... the whole thing" — working
means the real app, note creation, resizing, drag, and the calendar included;
the fake static board is removed with no decorative remnant. In the mobile
view the caption sits to the right of the mobile board, per the owner's
layout sentence.

**Implementation consequences (derivations, not new owner words).** Clause
(b) and the app's routing law together forbid history writes in embed mode:
routing uses pushState/popstate so the OS back gesture works (B9), and an
iframe's pushState lands in the visitor's joint session history, stealing
their back gesture — so embed mode must run with history writes suppressed,
which is a direct consequence of the owner's try-out purpose plus B9, not a
separate ruling. The embed mechanism itself (iframe at the deployed Pages
build vs. same files in the space), the throwaway-storage mechanism
(in-memory vs. a throwaway IndexedDB namespace), and the `isDesktop` override
plumbing are the implementation card's work, gated behind this ruling's merge.

**The record.** Docs-only on this card. No CACHE bump: docs-only changes do
not redeploy (`paths-ignore: '**/*.md'`).


### B125. The app's framing is restricted to `https://alastairzeved.com` (plus same-origin embedding) by a JS frame-guard that blanks the page on denial — provisional, accepted as a ceiling pending a host that can send real response headers (Zezed site issue #5, the owner's ruling of record: https://github.com/AlastairZeved/AlastairZeved/issues/5#issuecomment-5720520836; keeps §3.2's no-backend law — the guard is client-side JS, not a proxy or new host; waives nothing)

**Source:** issue #5 comment 5720520836 (owner ruling of record, transcribed verbatim): "fan out fixes for #4 and #5 as well as a one-line frame-ancestors 'self' https://alastairzeved.com on the app side with QA checks behind each update." — https://github.com/AlastairZeved/AlastairZeved/issues/5#issuecomment-5720520836

**The ruling.** The owner's sentence names the policy: the app may be framed
only by `https://alastairzeved.com` (the exact origin — scheme plus host, no
path) and by same-origin embedding; the allow-list is exactly that. Denial
blanks the document — no content rendered, no interaction — it does not
redirect. The guard runs at boot, before first paint of interactive UI, and is
inert when not embedded (`window.top === window.self` → no-op).

**Delivery constraint (recorded, part of the ruling).** The app hosts on
GitHub Pages, which cannot send custom response headers, and `frame-ancestors`
is ignored inside a `<meta>` CSP — so the owner chose a JS frame-guard
(`window.location.ancestorOrigins`: allow `https://alastairzeved.com` plus
same-origin, blank the page otherwise) as the PROVISIONAL mechanism, explicitly
accepted as a CEILING pending a host with real header support, where the
one-line `frame-ancestors 'self' https://alastairzeved.com` header replaces it.
In browsers that cannot expose the embedding origin (Safari, Firefox —
`ancestorOrigins` is Chromium-only) the guard default-ALLOWS so the site's demo
embed keeps working; that default-allow is part of the ruling, not a worker
shortcut.

**Implementation consequences (derivations, not new owner words).** QA checks
sit behind each update to the guard, per the ruling's own clause. The exact
blanking mechanism (document body clearing vs. `document.write` of an empty
document) and guard placement in boot order are the implementation card's work,
gated behind this ruling's merge.

**The record.** Docs-only on this card. No CACHE bump: docs-only changes do
not redeploy (`paths-ignore: '**/*.md'`).

### B126. The reminder clock moves INTO the note's action toolbar as the Remind tab — fourth tab between Highlight and Delete (issue #240, the owner's verbatim chat directive of 2026-09-17; supersedes ONLY B109's corner-placement clause — bottom-right of every note card — and the same clause in UIUX §4.7, plus UIUX §4.5's "three actions" text; keeps B104's clock-toggle ruling verbatim — one tap, no picker, no dialog, no time stored — B109's --reminder fill + glow and echo surfacing, B114's three-tab row it extends, B86's tab metrics, §1's state-is-never-colour-alone; waives nothing)

**Source:** https://github.com/AlastairZeved/TheBoards/issues/240 (owner chat directive, 2026-09-17), transcribed verbatim: "For repo AlastairZeved/TheBoards it looks like the reminder icon overlaps the text of the note card, whether it's turned on and glowing or not, which is not acceptable. Best solution: move the icon to the row of buttons of the note card, between the highlight and delete buttons. — Ripples: adjust the minimum size of note cards to accommodate a fourth button. — make the background of the button pink and match a purple already in palette from the palette used for notes boards."

**The ruling.** The clock tab leaves the card's bottom-right corner and joins the
on-select row as Complete · Highlight · **Remind** · Delete (Delete stays last in
`--danger`). The tab keeps the `note-clock` class alongside `note-tb-btn`, so the
toggle route (interactions.js) and the glow selector `.note.reminder .note-clock`
hold with zero rewiring. Resting, the tab is its normal `--frame` ground with the
clock glyph — it is a tab now, not a floating ink mark, and must read as a button
whether or not the reminder is on. Active, it takes the pink identity fill and a
glow bloom of the same hue. aria keeps COPY.remind/COPY.unremind and aria-pressed
(never colour alone, UIUX §1). The `.note-text:empty ~ .note-clock` sibling guard
dies with the move: an empty note shows no frame and no row (§6.2), which carries
the guard's job.

**The pink.** `#e6c2c9` — the Learning ladder's `--note` rung (styles.css:156),
the exact luminance match (0.5962, 4dp) of the Note Boards violet `#cec6ed` the
directive names, in the same idiom as Highlight's fixed amber fill (B85): fill +
glyph say WHICH action, never colour alone. Ink-dark on it is 11.84:1.

**NOTE_MIN_W, re-derived.** B86's tab metrics (18px glyph + 2×6px padding) make a
tab 30px wide; four tabs + three 3px gaps = 129px. B84's 132 was derived for a
four-tab row (B114's Copy removal never lowered it), so the same derivation
returns the established floor with 3px slack: **132 stands** — one number, three
jobs (CSS min-width, wrap-cap floor, drag/resize floor), unchanged.

**The echo (B109).** The surfaced echo carries the Remind tab on its own one-tab
row, shown always — the echo engages like no other note, and the corner clock it
replaced was always visible. Tapping it there still writes the SOURCE record.

**The record.** `sw.js` CACHE and `OWN_BUILD` bump together (shipped bytes
changed): v76 → v77. Test-tree edits: `test/tokens.js` (8b four-tab assertion,
v77 pins), `test/reminder.js` (guard assertion inverted; taps engage the note
first — the row is select-only), `test/desktop.js` (D15 four-tab labels),
`test/mobile.js` ([8] four-tab labels).

---

### B127. The note toolbar's four tab fills share ONE luminance rung — the note rung 0.5962 (issue #241, the owner's verbatim chat directive of 2026-09-17; supersedes ONLY the tab-fill luminance aspects of UIUX §2.6's identity-fill table rows, §2.6.1's B85 tab sentence and §4.5's CSS snippet — the highlight WASH (§2.6.1) and the reminder note-state glow (§2.6.2) keep their own rungs: this ruling governs the toolbar row's chrome, not the note states; keeps B67's per-type rotation for the Complete tab, B85's fill-names-the-action idiom, B86's tab metrics, B126's Remind placement and pink; waives nothing)

**Source:** https://github.com/AlastairZeved/TheBoards/issues/241 (owner chat directive, 2026-09-17), transcribed verbatim: "Consistency check: - adjust the colors of the other buttons to match luminescence of design palettes with appropriate contrast for viewing the icon outline above it. Out of scope for current issue, log as a separate issue."

**The plain reading (the code-facing contract — quote this sentence, not the
owner's prose).** All four note-toolbar tab fills — Complete · Highlight ·
Remind · Delete — share ONE luminance rung: the note rung **0.5962** (4dp), the
same rung the Remind pink `#e6c2c9` already carries (B126). Each fill keeps its
own hue family; the icon outline on every fill is `--ink-dark`.

**The knock-on: the fills become their own tokens.** The current fills serve
double duty and stop: `--frame` is the card border/rules token (B61), the
Highlight wash `--highlight` is the note's per-note state surface (§2.6.1, rung
0.675), and `--danger` is the menu text and the `.sel-btn` fill (§2.6) as well
as the Delete tab. The four tab fills move to dedicated tokens —
`--tab-complete`, `--tab-highlight`, `--tab-remind`, `--tab-delete` — each held
to the shared rung:

- `--tab-complete` keeps B67's per-type rotation, now at the shared rung
  instead of the frame hue.
- `--tab-highlight` stays in the amber family, dropped from the wash's 0.675
  to the shared rung; the WASH on the note itself is untouched (§2.6.1).
- `--tab-remind` is the pink `#e6c2c9` (B126) — the rung's reference value;
  the note-state `--reminder` token and its glow (§2.6.2) are untouched.
- `--tab-delete` stays in the warm danger family, moved to the shared rung.

The exact hexes for the three not-yet-derived fills land with the
implementation PR (which carries the `test/tokens.js` pin and a sw.js bump);
this entry and UIUX §2.6.4 fix the contract they must satisfy.

### B128. The collapsed calendar rail hides its inner furniture — the month view (issue #191's component) is display:none whenever the rail is collapsed (issue #248, the owner's verbatim chat report of 2026-09-17; supersedes NOTHING — no prior ruling ever placed the month view inside the collapsed face; this record closes the gap B118's collapse grammar left: the collapsed-hide selector `#cal-view.rail-open #cal-top, #cal-view.rail-open #cal-stack` predated issue #191's month view and never grew a `#cal-month` clause when the component landed; keeps B99's rail grammar — the collapsed face is the 40px `#cal-rail` strip alone, expand/collapse in-room (B81), the expanded panel keeps its full face including the month view — B118/B119's wide/tablet tiers (the rule rides `html.wide`, both bands), B124's Back-above-the-month-view order, §3.5's month-view component itself; waives nothing)

**Source:** https://github.com/AlastairZeved/TheBoards/issues/248 (owner chat report, 2026-09-17), transcribed verbatim: "Found a bug in calendar rail when in tablet mode: the month view is creeping into the rail and needs to be fixed. Month view should not be visible when rail is collapsed."

**The ruling.** The collapsed rail's face is the 40px strip and nothing else:
whatever rides `#cal-view` beside it — the R1 row, the 7-day stack, and now
issue #191's month view — is `display:none` under `#cal-view.rail-open`. The
month view returned to the tree after #191 landed inside the section whose
collapsed-hide selector predated it; the selector simply grows its third
clause. The expanded panel is untouched: expand the rail and the month view
renders as §3.5 built it.

### B129. The All-Boards rail card restacks: the title leads and the Last Updated stamp drops to a mini bottom-right line, with left padding before the title text and the section header cleared off the tray's frame (issue #254; extends B82's card shape from the mobile drilled list to the rail — supersedes the single-line-inline clause of B82's rail carve-out only; keeps B82's stamp content, B69's updatedAt source, B72's tray frame, §6's floors elsewhere; waives nothing)

**Source:** https://github.com/AlastairZeved/TheBoards/issues/254 ("Desktop & Tablet Modes: header text in the "All Boards" menu is too tight and losing legibility on the left side."), transcribed verbatim: "Increase the padding on the left side of the component before the title text begins. Additionally, reduce the size of the "Last updated" text to a mini size, anchored to the bottom right of the board's title card.This should make room for the title of each board's card to display. Currently only the "Last updated" text appears and no titles of any boards are legible."

**The ruling.** On the rail the board card gives up B82's single-line skin:
inline at the card's right, the `Last Updated` stamp starved the title to
ellipsis — the screenshot shows cards reading as a date alone. The rail card
takes the drilled-list card's shape: the title first (two lines, then `…`), the
stamp mini at the card's bottom-right, and room on the left before the title
text begins. The section header gets the same room: its label no longer sits
flush against the tray's inset frame, which read as a clipped left edge on all
four categories. The calendar mark, a third child the column skin would wrap
onto its own line, anchors to the card's top-right corner. The card stands 76px
on every surface and `catPageCap` budgets each against it.

### B130. The All-Boards rail adopts the Calendar rail's grammar in full — border line, centered title text, the dot beside the title — and recolors to the current board category's ladder (issue #249, the owner's verbatim chat directive of 2026-09-17; extends B99's rail grammar from the calendar seat to the boards seat — the two rails are one component in two seats, mirrored sides, not two styles; supersedes NOTHING — no prior ruling ever dressed the collapsed pane face differently than B118's plain vertical name; keeps B118/B119's collapse machinery on wide (desktop ∪ tablet, both bands) with the DRESS independent of collapse state — checked collapsed and expanded; keeps B67/§2.2.2's ladder rotation bound by re-binding token names, never by overriding a background, and B55's law that --chrome does not rotate: the collapsed face reads var(--card)/var(--frame), so it takes the ladder's hue with the board it stands on; waives nothing)

**Source:** issue #249, the owner's directive (chat 2026-09-17), transcribed verbatim: "The left rail doesn't match the formatting or layout of the right rail. The color is fine, but it needs a border line like the right rail, text centered and a little dot next to the title like the right rail. They should look like their the same rail, but the 'All Boards' rail should be a recolor to the palette of whatever board category is currently being viewed (blue for to do boards, purple for note boards, etc.) ... This fix applies to both desktop and tablet mode though."

**The ruling.** The collapsed All-Boards face takes B99's dress on the mirrored
side: a 2px border line against the sheet, the name reading vertically between
the same dot-above-title rhythm (`--cal-rail`'s 10px gap), centered on both
axes as the face already is. The face is one instance of the rail, so its
paper and its border are the same rungs the calendar seat reads — `--card`
and `--frame` — and the ladder rotates under `#pane[data-cat=...]` by
re-binding the token names (UIUX §2.2.2's law: `applyBoardCat` mirrors the
board's own attribute onto `#pane`; a child's `data-cat` — the tray's
`.cat-button`s — never re-scopes the pane, the binding is by direct
id+attribute). No new hex anywhere: the token suite's ladder tables are
untouched, the selectors simply gained the pane scope.

### B131. A future-dated calendar event creates NO board — the event record is the only stored thing; the linked board is derived state that materializes on its date via the morning lifecycle (issue #250, the owner's verbatim chat report of 2026-09-17; supersedes NOTHING — no prior ruling ever addressed when a linked board comes into existence relative to its date; keeps B108's morning lifecycle — first load of a day ensures today's linked board and carries forward — as the sole materialization mechanism, B107's unconditional landing, R5's mirror and B106's span law unchanged for same-day events, §1's state-is-never-style and B21's absence-is-off idiom; waives nothing)

**Source:** issue #250, the owner's report (chat 2026-09-17), transcribed verbatim: "Currently, if I record an event in the calendar for a date in the future, that board is created immediately and viewable from the menu. Boards for future dates should not be visible or accessible until the date of the board. Not sure how to fix properly, either create the board upon event creation and store it hidden until the appropriate date is 'today' OR don't create the board upon event creation and instead create it when the date is 'today' so there are never any future dated boards. Or maybe a third option, we're looking to keep this simplified though and storage of hidden boards seems against design philosophy."; and issue #250, the recommendation comment, transcribed verbatim: "## Recommendation: Option 2 — never create the board; the event record is the only stored thing

**Why.** The calendar event is already the source of truth for "a board is wanted on date X". The linked board is derived state — exactly the relationship B109's echo machinery already rules: compute at render/boot time from one source of truth, never store a copy. Option 1 (create + hidden flag) stores a copy AND adds a second field (`hidden: true`) whose only job is to mask a premature creation — new state that can drift: the event moves to another date and the hidden board is orphaned; the event is deleted and the hidden board is an empty ghost; "hidden until" needs a reveal check in the menu, the picker, the rail, and the PDF export, four guards for one mistake. Option 2's whole diff is one comparison. Storage of hidden boards is exactly what you smelled — against §1's state-is-never-style and B21's absence-is-off idiom: a board that does not exist yet is a board you never have to hide.

**The fix (small):**

1. In `addCalEvent`, skip `ensureLinkedBoard` when `dateKey > calKey(new Date())` — store the event record only. ~2 lines.
2. In `launchTodayBoard`'s morning path, after `ensureLinkedBoard(boards, today)`, sync `calReq` from the events that exist for today (the same first-sync `addCalEvent` does for same-day events). The morning lifecycle already exists (B108) — the board materializes on its date with no new mechanism.
3. **Migration for the future boards already created:** a one-time boot sweep deletes linked boards with `cal > today` and zero notes. They are derived empty state, nothing to preserve — deleting is the migration.

**What does NOT change:** the calendar itself still renders future events (they live in the events store, untouched); tapping a future day in the calendar shows the event editor, not a board; `carriedOn`, `calReq`, and the morning landing are untouched.

**Edge to state in the ruling:** an event recorded for TODAY during the day works exactly as now (`dateKey == today` is not future). And a future date that never gets opened still materializes the morning the date arrives — `launchTodayBoard` runs on first load of every day, B108's unconditional landing.

One comparison, one morning sync, one delete sweep. Nothing hidden, nothing stored early."

**The ruling.** `addCalEvent` stores the event record alone when the date is in
the future — one comparison, no board record, nothing for the menu to hide. The
board materializes the morning its date arrives, where B108's machinery already
lives: `launchTodayBoard`'s morning path gives the materialized board the same
first-sync `calReq` (the span is the events it already had) and a one-time boot
sweep deletes the linked boards the pre-fix build left behind for future dates —
derived empty state, deleted, their event records surviving untouched in the
store. Tapping a future day still shows the event editor, not a board.

### B132. The reminder glow moves to the note card — a soft yellow bloom on the card's frame; the Remind tab never blooms (issue #270, the owner's verbatim ruling of record from issue #240 comment 5718587081; supersedes ONLY B126's active-tab glow clause — the pink identity fill "plus a glow bloom of the same hue" — and the same clause in UIUX §2.6.2/§4.7; keeps B126's Remind tab placement and pink fill, B127's tab-fill rung, B104's one-tap clock toggle and border+bloom grammar, B110's carried-status pattern the card glow copies, B21's absence-is-off idiom, §1's state-is-never-colour-alone; waives nothing)

*(Landed as B128 in PR #271; renumbered B132 — B128 was already taken by the calendar-rail ruling, issue #248. Content and Source line unchanged.)*

**Source:** https://github.com/AlastairZeved/TheBoards/issues/240#issuecomment-5718587081 (owner comment, 2026-09-17), transcribed verbatim: "One more comment to add about the movement of the reminder button, an unaccounted for ripple: when reminder is tapped and turned on, the note card itself gets a soft yellow glow, not the button. The yellow should match the luminescence of the palette so as to not be distracting, but guides the eye still. Tapping to turn the reminder off removes the glow."

**The record repair.** B126 transcribed the tab-move directive but then
attributed to the owner a pink **glow** the owner never ruled — the verbatim
text above says the glow is the card's, in yellow. That attribution was an
agent invention and is hereby superseded, not edited away: B126 stands for the
tab's placement and its pink identity fill; the glow carrier (card, not
button) and the glow hue (yellow, not pink) follow the owner's words above.

**The ruling.** With the reminder active, the note card itself wears a soft
yellow bloom on its frame — B104's border + bloom grammar, the exact pattern
the carried status uses (§4.8, B110): `.note.reminder .note-text` takes the
`--reminder-glow` border and a soft bloom of the same token. The active Remind
tab keeps its legible pink fill (`--tab-remind`, B127) and its aria state
(`Remind me` ⇄ `Remove reminder`, aria-pressed) but takes **no bloom** — no
`box-shadow` on `.note-clock`. Tapping the reminder off deletes the key (B21)
and the glow goes with it; the `.reminder` class is the record's shadow,
recomputed at render (`setReminderUi`), and excludes completed notes — a
completed note never glows, the same guard `setCarriedUi` applies.

**The yellow.** Derived exactly the way `--carried` was derived (§2.6.3): the
carried amber's hue held (OKLCH h ≈ 94.7°) while the luminance drops a full
rung, 0.5297 → **0.3847**, giving `#c6a400` — a rung below the carried status,
so the reminded card guides the eye without shouting, matching the palette's
luminescence as the ruling asks. Above the ink crossover: 7.98:1 on
`--ink-dark`. It does not rotate with board type (same law as `--carried`).
The new token `--reminder-glow` enters styles.css `:root`; the pink `--reminder`
stays declared for the B126/B127 record but never blooms.

**The record.** Shipped bytes changed (styles.css, render.js): `sw.js` CACHE
bumps v86 → v87 with app.js `OWN_BUILD` v86 → v87. Test-tree edits: `test/tokens.js` — the
§[5d]-area reminder assertions rewritten (tab fill pinned with NO box-shadow;
card-frame bloom pinned on `.note.reminder .note-text`; `--reminder-glow`
value, non-rotation, and 7.98:1 contrast pinned), `test/reminder.js` — the
glow assertion moves from the tab to the card frame and a completed-never-glow
assertion is added. Both rewrites are declared here per AGENTS.md.

**The echo.** A surfaced **echo** card wears the same frame bloom as its source
while the reminder is on — it is the same reminder, the same glow; the echo is
the note card's own anatomy (§4.7), and `render.js:218` already gives it the
`.reminder` class, so `.note.reminder .note-text`'s border + bloom applies to
it unchanged. Recorded here so no later agent "fixes" the echo into not
blooming.

**Source:** https://github.com/AlastairZeved/TheBoards/issues/270#issuecomment-5734213339 (owner clarification, desktop chat 2026-09-18), transcribed verbatim: "Obviously a surfaced card carries the same bloom if the fucking reminder is tapped on."

### B133. The linked To-Do board's title is "Today's To Do", pinned, with the date pinned beneath it — the `MM/DD To Do` format is retired for that species alone (issue #273, the owner's verbatim ruling of record, the resolution comment of 2026-09-18; supersedes ONLY the title clause of B95/R5 — `titled MM/DD/YY To Do` — and only for the linked-To-Do-board species, `board.cal` set: the rest of B95/R5 stands untouched, the per-date mirror, the `cal` binding and the Requirements two-way sync; keeps B95's To-Do board species, B104's clock toggle and border+bloom grammar, B107's unconditional landing, B108's morning lifecycle and carry-forward, B95/B106's one mirror writer, B21's read-site defaulting, B9's History routes, B78's category names; waives nothing)

**Source:** https://github.com/AlastairZeved/TheBoards/issues/273#issuecomment-5734212139 (owner, desktop chat 2026-09-18), transcribed verbatim: "Today's To Do and the date are pinned. Today's To Do ONLY applies to the To Do board generated each day when it loads required section's calendar events that are 2 way synced. This is a to do board, Today's To Do board. Why would the other boards get a fucking to do board? stupid question."

**The ruling.** On the linked To-Do board — `board.cal` set, the daily board
`ensureLinkedBoard` creates and the Requirements mirror syncs the section's
two-way-synced calendar events into — the title reads **"Today's To Do"**, and
the board's date renders as its own line **beneath** it, in the board's
existing `MM/DD/YY` reading of its date key. Both are **pinned**: generated,
never user-editable. The date is not the title and not a second title — it is
the date line under it.

**The species, only.** This is the daily linked To-Do board's alone. A category
board (To Do · Notes · Learning · Ideas, B78) and every other board keep their
own title, and none of them gets a pinned `Today's` label or a generated date
line. The owner's words: "Why would the other boards get a fucking to do
board?"

**The date key stays the day identity everywhere else.** The board's `cal` date
key remains what it already is — the day identity the lists, the calendar and
the rails read (B95/R5, B107, B108, B131). The date line on the board is what
carries the day *there*; no later card duplicates a date into the rails or the
lists.

**The record.** Docs-only: no `state.js`/`render.js`/`styles.css` change, no
`sw.js` CACHE bump, no redeploy (`**/*.md` is already paths-ignored in the
deploy workflow). `state.js:315`'s `CAL_TITLE_SUFFIX` and `ensureLinkedBoard`
(`state.js:369-380`) still ship the superseded `MM/DD/YY To Do` format — the
title + date line are a later implementation card on issue #273.

**Superseded passages, normalized** (record law: the old title claim is
superseded and named, never left standing as the record):

1. B95/R5's "The data model is the boards', extended at the read site" — the
   clause `titled MM/DD/YY To Do` now states the new title + date line and
   names the format it superseded.
2. B104's heading — the parenthetical `title "MM/DD/YY To Do"` replaced.
3. B107's "The landing." — the same clause replaced.
4. B108's heading — the same clause replaced.

No other passage states the linked board's generated title: the sweep of
`docs/DECISIONS.md`, `docs/UIUX.md` and `docs/PRD.md` found none.

### B134. The calendar view's exit control is **Collapse**, anchored left at the very bottom of the view BELOW the month view, reading `Collapse ▶` — label first, arrow after it, pointing right — and the All-Boards pane's collapse control moves to the pane's bottom-right corner wearing the same grammar (issue #259, the owner's ruling of record: https://github.com/AlastairZeved/TheBoards/issues/259; supersedes ONLY the placement / label / arrow clauses named below — B95/R1's top-row seat and its left anchor for the calendar's exit control, B98's "the row is Back alone" row spec, B99's "the panel's Back collapses it", B118's pane-collapse placement and left-pointing arrow, and B124's "Back renders directly above the month view" with its DOM order stack → top → month and the wide `order: -1` row-on-top rule; keeps B124's row-membership ruling — the calendar view's row is ONE control, All Boards and Export stay out — B95/R1's visible-way-off principle, B98's fill / floor / state machinery for that control, B99's rail and panel states, B118's collapse grammar and collapsed-by-default state, B95's window / data / squeeze / tablet machinery, §6/B7's collar law, B81's commit-on-release and raw navigation, B9's History routes; waives nothing)

**Source:** issue #259 (owner, ruling of record), transcribed verbatim: "Calendar rail (all modes) — Change the text of the "back" button to **"Collapse"**. Move it to the very bottom of the calendar view, below the month view, anchored to the left. Flip the arrow so it faces **right**, and swap sides with the text so it reads **`Collapse ->`**. Move the month view above the button — they swap places. / All Boards menu (all modes) — Move the **"Collapse"** button to the very bottom right of the menu. Redo its arrow so it matches the calendar rail's collapse button (arrow on the right, pointing right)." — https://github.com/AlastairZeved/TheBoards/issues/259 (the owner's annotated screenshot rides as the issue's comment 5723896587). The owner's own section heads — "Calendar rail (all modes)" and "All Boards menu (all modes)" — are the ruling's scope: this applies in **every** arrangement, mobile and wide, not to one tier.

**The control is named for what it does, not for where you came from.** "Back" described the route; the act is the collapse of the calendar view, and the label now says so. On the calendar the exit control reads **Collapse** — the same word the All-Boards pane's control already carries (`COPY.paneCollapse`, state.js:156) — and the string `COPY.calBack: 'Back'` (state.js:155) retires with the old grammar. The act it performs does not change: it is still the calendar's visible way off, and it still pops the view's own pushed History state (`goCalBack`), B9's route made visible. This is a rename, a relocation and an arrow flip — nothing else; see "Navigation semantics do not change" below.

**The seat is the bottom-left of the view, below the month view.** The calendar's exit control leaves the top row's seat entirely and renders at the **very bottom of the calendar view, anchored left**, with the **month view above it** — the two swap places. The old seat's upper-left anchor and B124's "directly above the month view" both retire with it: above the month view is now the month view's own boundary, and the bottom edge of the view is the exit's. DOM order follows the ruling rather than fighting it: stack → month → collapse control, and the wide-only `#cal-view.rail-open #cal-top { order: -1; }` rule (styles.css:2054), which existed to keep the row on top in the expanded panel, **retires** — the control sits at the bottom in every mode, mobile and wide alike. `index.html`'s shipped order (`#cal-stack` → `#cal-top` → `#cal-month`, index.html:175–179) is the implementation card's to reorder; the ruling fixes where the control renders, and it renders last.

**The mark points right and renders after the label.** The arrow flips to face **right** and swaps sides with the text: the control reads **`Collapse ▶`** — label, then mark. `GLYPH.calBack` (state.js:212) is the left-facing page-turn pair drawn for the retired grammar and is replaced by a right-facing mark; the button's reading order in markup follows the visual order, so the label leads. This is the one grammar both collapse controls wear — the pane's takes it too, below.

**The All-Boards pane's collapse control takes the same grammar at the opposite corner.** On wide the expanded pane's collapse control — already labeled **Collapse** — moves to the **very bottom right of the menu**, its arrow redrawn to match the calendar's: **pointing right, rendered after the label** (`Collapse ▶`). It leaves its shipped seat: `#pane-collapse { align-self: flex-start; }` (styles.css:1542) put it top-left, and `GLYPH.paneCollapse` (state.js:216) draws the left chevron — both retire. B118's collapse grammar itself is untouched: one tap on the collapsed face expands the pane, the control collapses it back, the pane ships collapsed by default, and the control remains the pane's alone (the pane still has no Back, index.html:54). The two rails are one component in two seats (B130); after this ruling their collapse controls are one component in two corners — top-left's arrow and the bottom-right's are the same act and now the same drawing.

**Navigation semantics do not change.** The calendar's control still pops the pushed history state (`goCalBack`) and the pane's still collapses the rail without a history write (B81: navigation runs raw). Nothing about routing, the back-gesture law (B9), the fill / floor / state machinery (B98), the rail and panel states (B99), or the pane's collapse machinery (B118) is amended here. The relocation is spatial and nominal; the acts are exactly what they were.

**Where the collar survives, it spends away from the month view.** The §6 decoupled collar on the calendar's control (`--hit` on the control's row, set at render) may be kept, but at the bottom of the view it **spends edge-ward and downward — never upward**: the month view now sits directly above the control, and an upward collar would reach into the month grid and steal its taps. B98's "spent upward, into the row's chrome margin" clause was written for a row at the top of the view and is superseded by this seat; the collar's law itself (§6/B7 — the hit area expands, the visual frame does not) stands.

**Superseded clauses, named** (record law: every clause this ruling narrows is named here, never left standing as the record):

1. **B95/R1's top-row seat.** "the calendar carries a top row, Back · All Boards · Export, anchored left / center / right, visible on every platform. Back pops the calendar's own pushed History state" — the exit control's seat and its left anchor. The membership clause is already B124's (one control); the seat is now the view's bottom edge, and the control's name is Collapse.
2. **B98's row spec.** The heading's "keeps B95/R1's acts and anchors as amended by B124 (issue #237) — the row is Back alone — no new control, no grammar change" and the body's "**Amended by B124 (issue #237): the row is Back alone** — All Boards and Export leave the calendar view and Back renders directly above the month view; the fill / floor / state machinery above applies to the remaining button" — the row is **Collapse** alone at the bottom of the view, below the month view. Everything else B98 rules — the filled species, the frame as the floor, `padding: 14px 16px` / label 15px / mark 22px, the collar, the hover / active / `:focus-visible` trio — applies to the surviving control unchanged.
3. **B99's "the panel's Back collapses it".** The wide rail grammar's naming of the panel's collapse act: the panel's control is **Collapse**, and it renders at the bottom-left of the panel below the month view. B99's rail geometry, the 40px face, the 320px panel, the squeeze and the tap-to-expand all stand.
4. **B118's pane-collapse placement and arrow.** The pane's collapse control sat top-left (`#pane-collapse { align-self: flex-start; }`, styles.css:1542) with a left-pointing chevron (`GLYPH.paneCollapse`, state.js:216); it now sits at the **bottom-right of the expanded pane** with the calendar's right-pointing mark after its label. B118's collapse grammar, the collapsed-by-default state, the 40px face, the 300px pane and the mirror-of-B99 identity are untouched.
5. **B124's placement clause and its order machinery.** "Back renders directly above the month view" and the DOM order it produced — stack → top → month, with `#cal-view.rail-open #cal-top { order: -1; }` (styles.css:2054) keeping the row on top on wide — retire: the month view renders above the control, the control renders last, and the wide-only `order: -1` rule is removed rather than retuned. B124's row-membership ruling — Back alone, All Boards and Export out of the calendar view — stands, read with the new name.

**The record.** Docs-only on this card: `state.js`'s `COPY.calBack` / `GLYPH.calBack` / `GLYPH.paneCollapse`, `index.html`'s DOM order and `styles.css`'s `#cal-top` seat, `#pane-collapse` alignment and the `order: -1` rule still ship the superseded grammar — the rename, the relocation, the arrow flip and the collar's re-direction are a later implementation card's work on issue #259, gated behind this ruling's merge. No CACHE bump (docs-only: `**/*.md` is paths-ignored in the deploy workflow, so nothing redeploys).

### B135. The All-Boards pane's collapse control reads `◀ Collapse` — a left-pointing chevron BEFORE the label, the exact mirror of the calendar's `Collapse ▶` (issue #279, the owner's ruling of record: https://github.com/AlastairZeved/TheBoards/issues/279; supersedes ONLY B134's pane-collapse grammar clause — the All-Boards pane's control "wearing the same grammar (label first, arrow after it, pointing right)", and with it that control's arrow side, arrow direction and glyph drawing; keeps B134's bottom-right seat for the pane's control, and B134 in full everywhere else — every calendar clause, the calendar's `Collapse ▶` at the view's bottom-left included, stands untouched and correct — and keeps B118's collapse grammar and collapsed-by-default state, B99's rail geometry and squeeze, B130's one-component-two-seats identity of the two rails, the label text `Collapse`, the aria-label "Collapse the boards rail", B124's one-control row, §6/B7's collar law, B81's commit-on-release and raw navigation, B9's History routes; waives nothing)

**Source:** issue #279 (owner, ruling of record), transcribed verbatim, the owner's Telegram report of 2026-09-21: "it's the collapse button not menu button" / "it should be the reverse of the calendar button because the rail collapses left, not right" / "the all boards collapse button should be '<- Collapse'" — https://github.com/AlastairZeved/TheBoards/issues/279. The owner's own phrasing — "the all boards collapse button" — is the ruling's scope: the **All-Boards pane's** collapse control alone, in every arrangement (mobile and wide), not the calendar's.

**The mark leads the label, pointing left.** On the expanded pane the collapse control reads **`◀ Collapse`** — the chevron first, the label after it. Two things change together against B134's grammar: the **side** the mark renders on (left of the label, not right of it) and the **direction** it points (left, not right). Neither change alone is the ruling; the control is the mirror image of the calendar's.

**The mirror is the point: this rail collapses left.** The All-Boards rail sits on the sheet's left edge and its pane collapses leftward; the calendar's rail sits on the right edge and its panel collapses rightward, which is why its control reads `Collapse ▶` (B134). One act in two seats, drawn mirrored — the same one-component-two-seats identity B130 gives the two rails. The mark therefore points the way the pane travels and leads the label the way the reading order travels.

**Rejected — `Collapse ◀`.** Keeping the mark on the label's right and flipping only its direction is **rejected**: the owner flagged the arrow's **side** as wrong as well as its direction, and the ruling's own words put the mark first. The superseded grammar's mark stays where it is on the calendar's control and nowhere else.

**The calendar's control is untouched.** `#cal-back` keeps **`Collapse ▶`** — label first, the mark after it, pointing right, anchored left at the very bottom of the calendar view below the month view. The shared `.cal-act` grammar is not flipped for both controls; `#pane-collapse` is the one that changes, and its bottom-right seat, its label text and its aria-label stay exactly as B134 left them.

**The record.** Docs-only on this card: `state.js`'s `GLYPH.paneCollapse` (the right chevron `M6.5 3.5L11 8l-4.5 4.5`) and the fill order that renders label-then-mark still ship the superseded grammar — the mirrored glyph (the left chevron `M9.5 3.5L5 8l4.5 4.5`) and the arrow-first rendering scoped to `#pane-collapse` alone are a later implementation card's work on issue #279, gated behind this ruling's merge. No CACHE bump (docs-only: `**/*.md` is paths-ignored in the deploy workflow, so nothing redeploys).

### B136. The embed's database is never wiped at boot — B124's "throwaway namespace wiped before every open" clause is retired, and the embed persists exactly like the plain app (issue #280, the owner's ruling of record: https://github.com/AlastairZeved/TheBoards/issues/280#issuecomment-5777418703; supersedes ONLY B124's wipe-at-boot clause — the `persistence.js` boot-time `indexedDB.deleteDatabase("boards-db-embed")` before anything loads; keeps B124's embed keying — the `?embed=1` URL parameter and the separate `boards-db-embed` namespace — B21's storage-key law, §3.2's no-backend law; the persistence.js diff is the implementation card's work, gated behind this ruling's merge; waives nothing)

**Source:** issue #280 (owner, ruling of record, comment 5777418703), the owner's chat ruling of 2026-09-22 transcribed verbatim: "**B — remove the wipe entirely; embeds persist like the real app.**" — with the comment's plain reading quoted in full below — https://github.com/AlastairZeved/TheBoards/issues/280#issuecomment-5777418703

**The owner's ruling of record, verbatim (issue #280 comment 5777418703):**

> ## Owner ruling of record (2026-09-22, chat)
>
> > **B — remove the wipe entirely; embeds persist like the real app.**
>
> Plain reading (the law the code must satisfy):
>
> - `openDB()` never calls `indexedDB.deleteDatabase()` — the wipe-at-boot block is deleted outright.
> - Embed mode keeps its own namespace (`boards-db-embed`) but persists across reloads like `boards-db`. There is no throwaway behavior left anywhere.
> - **B124 is superseded in the clause that mandates the wipe.** B124's "throwaway namespace wiped before every open" is retired as written; this comment is the ruling of record and the docs amendment cites it. The embed-keying mechanism itself (URL param, separate DB name) survives.
> - Knock-on, accepted by the owner: a visitor who opens an embed URL now accumulates persistent demo data on that URL, exactly like the plain app. No protection is added — that is the point of B.
>
> Fan-out: docs amendment (B124 supersede) → impl → QA → Cleaner, serial.

**The ruling.** B124 asked whether the embed needed storage at all, and the `EMBED` branch of `persistence.js`'s `openDB()` answered by deleting `boards-db-embed` at every page open — the throwaway namespace wiped before every open, the clause this ruling retires. The owner's ruling is B: **`openDB()` never calls `indexedDB.deleteDatabase()`** — the wipe-at-boot block is deleted outright — and embed mode keeps its own namespace (`boards-db-embed`) but **persists across reloads like `boards-db`**. There is no throwaway behavior left anywhere: any `?embed=1` URL survives reloads exactly as the plain PWA does.

**What is kept.** Only the wipe is superseded. The embed-keying mechanism itself survives — the `?embed=1` URL parameter and the separate `boards-db-embed` database name — so embed mode remains a distinct surface; it simply persists now. B21's storage-key law stands: no key or store renames, the `boards-db-embed` name is kept by design. §3.2's no-backend law stands: the fix is client-side IndexedDB behavior, nothing server-shaped. The knock-on the owner accepted explicitly in the ruling: a visitor who opens an embed URL now accumulates persistent demo data on that URL, exactly like the plain app — no protection is added, that is the point of B.

**The record.** Docs-only on this card — the `persistence.js` diff that deletes the boot-time `deleteDatabase` block and the throwaway behavior it guaranteed is the implementation card's work on issue #280, gated behind this ruling's merge. No CACHE bump (docs-only: `**/*.md` is paths-ignored in the deploy workflow, so nothing redeploys).

### B137. On tablet, the expanded board rail is a one-open accordion: all four category sections render collapsed by default, exactly one expands at a time (expanding a section collapses the open one; tapping an open head collapses it), and the expanded section shows its boards before a page turn — ~7 at the 904×846 fold against 76px rows, an expectation QA verifies headlessly, never a pin — inside the standing ONE column at `PANE_W = 300`, with no geometry-law change (issue #286, the owner's ruling of record: https://github.com/AlastairZeved/TheBoards/issues/286#issuecomment-5777483083; supersedes ONLY B118's expanded-rail interaction on tablet — B118's wide-rail read as it left it, an expand that opens the 300px pane to its sections' boards all at once; keeps B118's collapse grammar in full — the 40px collapsed face, collapsed-by-default, one tap to expand, the arrow control to collapse back, the 300px pane at PANE_W 300, the mirror-of-B99 identity — B96's tablet tier, B100/B119's rail-is-the-All-Boards-surface-on-wide clause, B74's four-category taxonomy, B42's rows×cols capacity law ("measured, never a constant") untouched, B44/B68's capacity discipline, B81's commit-on-release, B9's back stack; desktop rail and the mobile 3-column drill are untouched — this ruling is tablet-scoped; the catPageCap surface-branch fix ships in the same change but needs no new ruling — it is a defect fix under #281's one-read-per-surface discipline, not a design ruling; waives nothing)

**Source:** issue #286 (owner, ruling of record, comment 5777483083), the owner's chat ruling of 2026-09-22 transcribed verbatim: "**C — collapsed sections, keep 1 column: one category open at a time shows ~7 boards; the rest show just their headers. Like mobile's one-category drill. Keeps all geometry law, changes the interaction.**" — with the comment's plain reading quoted in full below — https://github.com/AlastairZeved/TheBoards/issues/286#issuecomment-5777483083

**The owner's ruling of record, verbatim (issue #286 comment 5777483083):**

> ## Owner ruling of record (2026-09-22, chat) — tablet rail density
>
> > **C — collapsed sections, keep 1 column: one category open at a time shows ~7 boards; the rest show just their headers. Like mobile's one-category drill. Keeps all geometry law, changes the interaction.**
>
> Plain reading (the law the code must satisfy):
>
> - The tablet All-Boards rail keeps **one column at `PANE_W = 300`** — no geometry law changes. The two-column options are rejected; "narrower than the titles they name" stands.
> - On tablet, all four category sections render **collapsed by default**: exactly **one category expanded at a time** (radio behavior — expanding a section collapses the currently open one). Tapping an open section's head collapses it.
> - The expanded category shows its boards before a page turn (~7 at a 904×846 fold against 76px rows, derived from #286's measured 758px pane — QA verifies the real count headlessly; the number is an expectation, not a pin).
> - **Desktop rail and the mobile 3-column drill are untouched** — this ruling is tablet-scoped.
> - The **measurement defect ships in the same change regardless**: `catPageCap` must branch on the surface actually showing (wide ⇒ `#pane-cards`, 1 col; else ⇒ `#list-rows`, 3 cols), per the one-read-per-surface discipline of #281. A hidden host is never a measuring surface.
> - Knock-on: B118's expanded-rail interaction is amended for the tablet default (all-collapsed start). B42's rows×cols capacity law is untouched.
>
> Fan-out: docs amendment (new B<n>) → impl (accordion + catPageCap fix) → QA → Cleaner, serial, gated behind the #280 chain's pin files.
>

**The ruling.** The tablet's 300px pane fell into a density gap B118 never had to price: the rail expanded into the same one-column list the desktop pane shows, and at 76px rows a 904×846 tablet fold fits fewer boards than the list wants to page. The owner rules the density on the interaction side, not the geometry side — **option C**: the tablet rail becomes a one-open accordion. All four category sections render **collapsed by default**; exactly **one category expands at a time**, radio behavior (expanding a section collapses the currently open one, and tapping an open section's head collapses it) — the pattern the mobile drill already teaches. The expanded section shows its boards before a page turn, ~7 at the 904×846 fold against 76px rows (derived from #286's measured 758px pane); QA verifies the real count headlessly, and the number stays an expectation, not a pin — B42's "measured, never a constant" law still prices the shipped capacity. The two-column options are rejected on the same ground this record keeps: "narrower than the titles they name" stands.

**What is kept.** This is B118's tablet interaction amended, nothing else. The collapse grammar survives whole on tablet — the 40px face, collapsed-by-default, one tap to expand, the arrow control to collapse back, the 300px pane at PANE_W 300, the mirror-of-B99 identity — and B118's desktop rail is untouched: this ruling is **tablet-scoped**. B42's rows×cols capacity law is untouched (the accordion reuses the section-collapse the rail already budgets, per B42/B44/B68), B96's tablet tier and B100/B119's rail-is-the-All-Boards-surface-on-wide clause stand (tablet reads its All-Boards surface from behind the collapsed face, as B119 ruled), and B74's four-category taxonomy is the accordion's four sections. The mechanical `catPageCap` defect — it measures the retired `#list-rows` host on tablet and clamps to the mobile drill's 3-column count — rides in the same change as a **defect fix** under #281's one-read-per-surface discipline (a hidden host is never a measuring surface); it needs no new ruling and is recorded here only so the impl card knows the record does not forbid it.

**The record.** Docs-only on this card — the accordion (collapsed-by-default start, one-open radio behavior, tap-to-collapse) and the `catPageCap` surface-branch fix are a later implementation card's work on issue #286, gated behind this ruling's merge. No CACHE bump (docs-only: `**/*.md` is paths-ignored in the deploy workflow, so nothing redeploys).

### B138. The Recurring Reminders strip component of issue #295 is IN SCOPE — a strip in the top space reserved by #293, chips reading title + next occurrence, an orange plus add control, page-left / page-right paging, and persistence of the reminder records; the firing/notification mechanics stay OUT of scope (issue #295, the owner's ruling of record: https://github.com/AlastairZeved/TheBoards/issues/295#issuecomment-5826290712; supersedes ONLY B113's recurring-reminders clause — by number, not edited in place — and only for this component's scope: strip + chips + add control + pager + persistence of the reminder records; everything else B113 rides on stands: the clock-toggle reminder of B108/B109 remains the complete reminder mechanism — nothing reschedules it, nothing recreates it, re-tapping the clock is the only return path; B104's no-time-stored law is narrowed only to the extent this component persists reminder schedule data — chips read "title + next occurrence" — B104's clock-toggle mechanism untouched; B113's month-view deferral clause is moot — the month view shipped as #191; the firing/notification mechanics and edit/delete tap behavior on chips are pending a further ruling; waives nothing)

**Source:** issue #295 (owner, ruling of record, comment 5826290712), the owner's chat ruling of 2026-09-24, the comment transcribed verbatim in full below — https://github.com/AlastairZeved/TheBoards/issues/295#issuecomment-5826290712

**The owner's ruling of record, verbatim (issue #295 comment 5826290712):**

> ## Owner ruling of record (2026-09-24): B113 superseded for the Recurring Reminders component
>
> **Ruling (from Rob, chat ruling confirmed 2026-09-24):** the Recurring Reminders strip component as specified in this issue is IN SCOPE. B113's recurring-reminders clause is superseded by this ruling, cited by URL here. The strip is a separate, explicit component with its own persistence — the firing/notification mechanics stay OUT of scope (the issue says so verbatim).
>
> **Knock-on consequences encoded per the orchestration law:**
> - B113's recurring-reminders ban is superseded **only** for this component's scope: stripe + chips + add control + pager + persistence of the reminder records. Everything else B113 rides on stands: the clock-toggle reminder (B108/B109) remains the complete reminder mechanism — nothing reschedules it, nothing recreates it, re-tapping the clock is the only return path.
> - B104's no-time-stored law is narrowed only to the extent this component persists reminder schedule data (chips read 'title + next occurrence'). B104's clock-toggle mechanism remains untouched.
> - The month-view deferral clause of B113 is moot — the month view shipped as #191.
> - Pending a further ruling: firing mechanics, edit/delete tap behavior on chips (explicitly out of scope here).
>
> Docs-first chain follows: PRD + DECISIONS amendment (verbatim transcription of this ruling with Source: this comment) → impl → QA → Cleaner. No code before the amendment ships.

**The ruling.** The Recurring Reminders strip is in. Issue #295 specifies it:
the component lives in the empty space at the top of the calendar view — the
whitespace reserved by #293 — reads left to right as one horizontal strip,
chips carry title + next occurrence and nothing else, an orange plus block
adds a reminder, overflow pages by page-left / page-right buttons rather than
scrolling or swiping, and the reminder records persist. B113 recorded
recurring reminders as out; the owner's 2026-09-24 chat ruling, transcribed
above, reopens that question for exactly this component and nothing else.

**What is kept.** B113 is amended, not deleted — its recurring-reminders
clause is superseded by number for this component's scope, and everything
else it ruled stands. The clock-toggle reminder (B108/B109) remains the
complete reminder mechanism: nothing reschedules it, nothing recreates it,
re-tapping the clock is the only return path. B104's no-time-stored law is
narrowed only to the extent this component persists reminder schedule data
(chips read "title + next occurrence"); B104's clock-toggle mechanism is
untouched. B113's month-view deferral clause is moot — the month view shipped
as #191. AGENTS.md's never-do "reminders" line is untouched; this record
follows B104's clock-toggle precedent — the bounded exception lives in the
PRD's out-of-scope table row and this ruling, not in an edit to that line.
Firing mechanics and edit/delete tap behavior on chips are pending a further
ruling.

**The record.** Docs-only on this card — the component (strip + chips + add
control + pager + persistence) is a later implementation card's work on issue
#295, gated behind this ruling's merge. No CACHE bump (docs-only: `**/*.md`
is paths-ignored in the deploy workflow, so nothing redeploys).

### B139. The note action row sits below the note card, horizontally centred, the tops of the buttons anchored to the card's bottom edge — and it never paints over the note's own text, in any state, at any viewport (issue #298, the owner's ruling of record: https://github.com/AlastairZeved/TheBoards/issues/298#issuecomment-5843023803; supersedes ONLY B120's near-sheet-bottom re-aim destination clause — the closing clause of issue #173's ruling whose recorded re-aim destination is the row sitting INSIDE the card, over the note's own text; keeps B120's bottom-edge + centred placement in full, B120's standing supersession of B88's left-anchor clause, B87's gapless-edge principle, B86's tab metrics, B84's on-select toolbar and its on-select reveal, B90's mobile select-then-edit; waives nothing)

**Source:** issue #298 (owner, ruling of record, comment 5843023803), the owner's words transcribed verbatim from the reporter's screenshot: "Why are the buttons in front of notes now? Proper placement is below the note, centered, tops of buttons anchored to the bottom of the note card." — with the comment's plain reading quoted in full below — https://github.com/AlastairZeved/TheBoards/issues/298#issuecomment-5843023803

**The owner's ruling of record, verbatim (issue #298 comment 5843023803):**

> ## Ruling of record — the owner's words (transcribed from the reporter's screenshot, issue #298)
>
> > "Why are the buttons in front of notes now? Proper placement is below the note, centered, tops of buttons anchored to the bottom of the note card."
>
> Plain reading, encoded by the orchestrator (not invented by a worker):
>
> - The action row belongs **below** the note card. Never on top of the note's own text — in any state, at any viewport.
> - The row is **horizontally centred** on the card.
> - The **tops of the buttons are anchored to the card's bottom edge** — flush, no gap, no overlap.

**The ruling.** The owner saw the buttons in front of a note and ruled the placement in one sentence: the action row sits **below** the note card, **horizontally centred** on the card, the **tops of the buttons anchored to the card's bottom edge** — flush, no gap, no overlap — and it **never paints over the note's own text, in any state, at any viewport**. The mechanical record behind it: `styles.css` §4.5 `.note-toolbar` (`top: 100%; left: 50%; transform: translateX(-50%)`) is correct for the normal state — flush below, centred — and the **only** rule on main that paints the row over the note's own text is the `.tb-flip` re-aim, `.note.tb-flip .note-toolbar { top: auto; bottom: 0; }`, set by `reflectToolbarFlip()` (render.js:394). That re-aim is B120's closing clause: the flip grammar re-read for the bottom edge, the near-sheet-bottom case whose recorded destination is the row sitting *inside* the card. That destination clause, and only that clause, is superseded: inside the card is never a lawful destination, near the sheet bottom or anywhere else. How the near-sheet-bottom constraint is then satisfied is the implementation card's work, not this record's — the owner ruled the placement, not the mechanism.

**What is kept.** Everything else B120 ruled stands. The row's bottom-edge, centred placement stands — this ruling reaffirms it in the owner's own words, it does not move the row again. B120's standing supersession of B88's left-anchor clause stands — the row is not re-anchored left. B87's gapless-edge principle stands — tops of the buttons anchored to the card's bottom edge, no gap, is the same flush law read on the owner's sentence. B86's tab metrics, B84's on-select toolbar and its on-select reveal, and B90's mobile select-then-edit all stand untouched. B120 is amended in one clause, not re-opened; B87, B88, B84, B86, B90 are not touched at all.

**The record.** Docs-only on this card — the `styles.css` / `render.js` change that removes the inside-the-card destination is the implementation card's work on issue #298, gated behind this ruling's merge. The comment of record also leaves an open root-cause question for that card: in the reporter's screenshot the note is NOT near the sheet bottom — another note sits below it on the same canvas — so a genuine "no room below" flip should not have engaged; the impl card must instrument and determine what put the row inside that card and fix the shared site, not the one note. No CACHE bump, no OWN_BUILD bump (docs-only: `**/*.md` is paths-ignored in the deploy workflow, so nothing redeploys).
