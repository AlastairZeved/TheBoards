# Desktop Mode for TheBoards — Implementation Plan (Issue #4)

> **Renamed, 2026-09-16:** the app identity is now "Zeved Boards" (DECISIONS.md B121). This plan is a dated record; its period spelling of the identity is untouched.

> **Status: decisions resolved, implemented.** All nine flagged decisions were ruled on
> (issues #8–#16, companion specs in PRs #28–#35) and the implementation ships in this
> branch. Six defaults confirmed; three overridden: board create/delete (#10 — no
> hover-reveal: active-card control + right-click menu, filled New-board button),
> Parking Lot selected state (#11 — framed selected row, 210 px desktop lot), and
> cross-device positions (#15 — proportional `x` via a per-note `rw` reference width,
> replacing keep-truthful). The binding record is `DECISIONS.md` B19–B26; the section
> below is kept as the original decision framing for history.

## Context

TheBoards is a spatial, offline-first to-do PWA — vanilla HTML/CSS/JS, no build step — designed mobile-first (Samsung Z Fold primary). The whole app is one logical sheet (`LOGICAL_W = 900` fixed; height derived from viewport aspect; one uniform `renderScale`), driven by a touch gesture recognizer: tap to capture, drag to move, **pinch to scale**, **long-press for the Complete/Boards/Delete menu**. Issue #4 asks for a desktop (mouse-and-keyboard) mode: today a mouse user literally **cannot resize a note** (pinch is the only scale gesture), long-press-with-a-mouse is an alien gesture, and a 16:9 monitor renders the aspect-derived sheet as a squat, oversized page. The issue defines a select-then-act model for notes and an always-visible left board pane replacing the full-screen board list.

Binding constraints (from `DECISIONS.md` — PRD.md/UIUX.md are referenced but not in the repo):

- **B17 — positions permanent**: committed note positions are never re-clamped by layout changes.
- **B18 — the 400 ms acknowledged action window**: every click *action* commits 400 ms after release via `delayAction()`; taps inside an open window are dropped.
- **B9 — OS back is never intercepted**: list routing uses pushState/popstate; desktop must not disturb it.
- **§8 motion is a closed, justified set** with a global `prefers-reduced-motion` kill-switch.
- Both themes derive from the `--paper`/`--ink` poles. The muted red (`--danger`) and muted green (`--accent-restore`) the issue asks for **already exist as tokens**.
- Mobile must remain pixel-identical.

## Requirement → code mapping

| Issue requirement | Where it lands |
|---|---|
| Click note → select, not type | Selection state gating `handleTap`'s note branch (`app.js` §7/§8) |
| Drag outlined frame → scaled resize | New recognizer branch sharing pinch math (`note.scale`, 0.5–2.0 clamp, `setHitInset`) |
| Double-click → edit, caret at end | Recognizer tap-pairing + existing `editText` no-coords path (falls through to `caretToEnd`) |
| Remove click-and-hold menu | Gate `g.longPressTimer` + `attachRowGestures` long-press behind `!isDesktop`; menu stays for mobile |
| Complete/Delete buttons under selected note | New `#selection` overlay; actions reuse `completeNote`/`restoreNote`/`deleteNote` + `delayAction` |
| Muted red / muted green, contrasting text | Existing `--danger`/`--accent-restore` as fills paired with `--paper` text (contrast verified below) |
| Expand width, scale-to-fit, no distortion | Desktop branch in `applyLayout` — min-anchored uniform scale (below) |
| Right side = new note surface | Falls out of wider `LOGICAL_W`; all clamps already read `LOGICAL_W` (becomes `let`) |
| Left pane, darker, embedded/sunken | Unscaled fixed `<aside id="pane">`; `--offx` (already plumbed through `toLogical` + board transform) shifts the sheet right — zero per-note math changes |
| 5–6 compact cards, ~6–7 words wide, newest first | `renderPane()` reusing `renderList` row logic (`createdAt` desc, untitled + date fallback) |
| Click card → swap board, minimalist animation | `swapBoard(id)` — direct load + `renderBoard()`, no history push, ~150 ms crossfade added to §8 |

## Decisions — resolved (original framing below; rulings in issues #8–#16)

Resolutions: 1 → confirmed (#8). 2 → confirmed + rail-bottom overflow indicator (#9).
3 → **overridden**: filled New-board button; delete = active-card control + right-click
menu on any card (#10). 4 → confirmed + framed selected row + 210 px desktop lot (#11).
5 → confirmed, generalized to all creation surfaces, + 24 px desktop hit floor (#12).
6 → confirmed; edit entry instant too; drop-guard relocated (#13). 7 → confirmed +
`id` tiebreak + shared comparator (#14). 8 → **overridden**: proportional `x` via
per-note `rw` (#15, PR #35). 9 → confirmed (#16). Binding text: `DECISIONS.md` B19–B26.

These were the gaps, contradictions, and judgment calls the issue left open. Each carried a **recommended default**:

1. **Desktop detection** — *Default: `(min-width: 1024px) and (hover: hover) and (pointer: fine)` via `matchMedia`, live-switched.* Pointer capability (not width alone) excludes tablets, per "not including tablets." A touch-laptop with a mouse qualifies; an iPad Pro at 1366 px does not.
2. **Pane geometry** — the issue has an internal tension: "always-visible pane" implies full height, but "5–6 compact cards before scrolling" caps the visible list (compact cards on a full-height 1080p rail show 12+). *Default: full-height sunken rail, compact cards stacking from the top, scrolling only when boards outgrow it* — treating "5–6" as the expectation at typical board counts, not a hard cap.
3. **Board create/delete on desktop** — the issue is silent, yet both currently live in surfaces desktop removes (list-view button; long-press on rows). *Default: "New board" control at the top of the pane + hover-revealed delete per card, reusing the existing `deleteBoard` 5 s-undo flow.* Without these, desktop cannot create or remove boards at all.
4. **Parking Lot lines** — removing click-and-hold removes their **only** Complete/Delete path; the issue's frame model doesn't cover them (unframed flow lines). *Default: same select / double-click-edit grammar as notes (no resize), with buttons inline at the row's right edge* — `#lot-items` has `overflow: hidden`, so buttons-below would clip on the last row, and the right end of a full-width row is its natural action position.
5. **Canvas click while a note is selected** — tap-canvas-creates-a-note is the app's capture-first identity, but desktop users will click canvas to dismiss selections. *Default: click deselects when a selection is active; creates a note (existing ghost + 400 ms flow) only when nothing is selected.*
6. **Selection timing vs. B18** — *Default: selection/deselection is **instant**; Complete/Delete/board-swap/create keep the 400 ms window.* This is not merely taste: `delayAction` **drops** taps while a window is open, so a delayed selection would swallow the second click of every double-click — delayed selection and double-click-to-edit are mechanically incompatible. Recorded as a DECISIONS entry.
7. **"Most recent" ordering** — *Default: `createdAt` descending,* matching the existing list view and stable — `updatedAt` ordering would make the currently-edited board's card jump around inside an always-visible pane.
8. **Cross-device data consequence** — notes placed on desktop's wider canvas (x > 900) are **off-screen on a phone** until reopened on a wide viewport (invisible but preserved; they return intact). This follows B17 — the codebase already accepts the same tradeoff vertically for portrait↔landscape. *Default: keep truthful positions; documented, not "fixed."* (Desktop y stays ≤ ~1000, which always fits tall phone sheets, so only the x-axis is affected; the Parking Lot has no x/y and is fully portable.)
9. **Anchors (title/components/requirements)** — remain **direct-edit on click** (the issue: "title cards … remain a fixed component"). They can't move, resize, complete, or delete, so selection would be an empty state for them.

## Architecture (validated against the code by an independent review pass)

### Desktop detection
`matchMedia` → `isDesktop` flag + `desktop` class on `<html>` (single source of truth; CSS gates on the class, not duplicate media queries). Mode-flip teardown: clear selection, `closeMenu()`, **`history.back()` if `listOpen`** (routes through the existing `popstate` → `showBoardFromList()`, keeping B9 intact — merely hiding the list would leave a stale history entry that resurrects it on the next OS back), and null out `g`/`pointers`/long-press timers so a half-finished gesture can't fire in the wrong mode.

### Geometry — min-anchored axis inversion
Desktop branch of `applyLayout()` (mobile branch stays byte-for-byte):

```
renderScale = Math.min(vh / 1000, (vw − PANE_W) / 900)   // PANE_W = 300 CSS px
LOGICAL_H   = vh / renderScale                            // ≥ 1000
LOGICAL_W   = (vw − PANE_W) / renderScale                 // ≥ 900
offX = PANE_W; offY = 0
```

Uniform scale (no distortion), both axes fill exactly (no letterbox), and **neither logical dimension ever drops below the 900×1000 reference** — so mobile-placed notes always fit even in a narrow desktop window, and top furniture (216+400+216 + margins ≈ 880 units) never collides. On typical wide screens this degenerates to the pure `vh/1000` inversion, and the right side becomes the issue's "additional surface."

Wiring fixes this depends on: `applyLayout` currently hardcodes `--offx` to the literal `'0px'` and `#board` hardcodes `width: 900px` — both become variable (`--offx: offX`, `width: var(--logical-w, 900px)`); mobile writes the same `900px`/`0px` as today. `LOGICAL_W` becomes `let` (its clamp sites in `createNote`/`updateDrag`/`updatePinch`/`makeTapGhost` all read it). `toLogical()` already subtracts `offX`, so stored note x stays canvas-relative on both devices.

Furniture CSS becomes width-agnostic — **arithmetically identical at 900** (mobile pixel-safe): requirements `left:660` → `right:24` (900−660−216=24); lot `width:852` → `left:24; right:24`; title `left:250;width:400` → `left: calc(50% − 200px)` (center 450 = sheet center; `calc` over `translateX` to avoid a new stacking context). On desktop the title centers over the canvas, requirements pins to the true right edge, the lot spans the full width.

### Selection model
Single `#selection` overlay div appended to `#board` (z-index 3, above notes at 2) holding the outlined frame, corner handles, and the two buttons — positioned in logical units from the note's transform-independent footprint (`node.offsetWidth × note.scale`, the same math `updateDrag` uses). It inherits `renderScale` but **never** `note.scale`, so the selection chrome stays constant-weight at any note size. Counter-scaled children inside `.note` were rejected (per-note var threading + collision with the `::before` hit expander).

**Buttons must route through the recognizer, not native click listeners**: `onPointerDown` calls `el.board.setPointerCapture()`, which retargets `pointerup` (and the derived `click`) to `#board` — button listeners inside `#board` are unreliable by construction. `classifyTarget` gains `sel-btn` / `sel-frame` types (checked before `.note`); `handleTap` dispatches them.

Interaction: first click on a note → instant select; second click on the same note within ~350 ms → clear overlay, `editText` (no coords → `caretToEnd`). Drag still moves directly and selects. Edit and selection are mutually exclusive (focus ring is the edit affordance); commit-on-blur does not reselect. Completed notes: selectable, button 1 reads **Restore** (mirrors `openMenuFor`'s state branch), no edit on double-click (same `state === 'active'` guard as mobile). Keyboard/AT: desktop `focusin` branch selects instead of auto-editing (Enter edits); the existing `if (pointers.size) return` guard already keeps mouse clicks out of that path. Overlay reposition/clear hooks: `updateDrag`, resize, `input` (text growth), `applyLayout`, `renderBoard` (rebuilds notes → clear), `deleteNote`/`removeNoteSilently`.

### Resize
Pointerdown on `sel-frame` → `g.mode = 'resize'`: `scale = clamp(startScale · dist(pointer, note origin)/dist(grab, origin), 0.5, 2.0)` — top-left origin, so no drift (B4). Extract the shared tail of `updatePinch` (apply transform, re-clamp footprint into the page, `setHitInset`) into `applyNoteScale(note, node, scale)` used by pinch and resize; release follows the `endPinch` pattern (`saveNow`). `cursor: nwse-resize` on frame/handles.

### Action buttons — palette (verified contrast, WCAG)
Rest: `background`/`border` in the token, `color: var(--paper)` — the stylesheet's own law ("every fill pairs a token with `--paper`, so both themes invert by construction"):

| Pairing | Light | Dark |
|---|---|---|
| paper on `--danger` (Delete) | ≈ 6.6:1 | ≈ 8.4:1 |
| paper on `--accent-restore` (Complete/Restore) | ≈ 6.3:1 | ≈ 9.9:1 |

All ≥ AA. `.tapped` acknowledgment drains per the `#new-board` precedent (`background: var(--paper); color: <token>`; border keeps the token) — inverted pairs have identical ratios by symmetry. Both route through `delayAction` (B18 intact for actions).

### Board pane
`<aside id="pane">` as first child of `#board-view`, before `#board` — outside the board, so the recognizer never sees its events. `position:absolute; inset-block:0; left:0; width:300px; overflow-y:auto; overscroll-behavior:contain`; hidden unless `html.desktop`. New derived token `--pane` in both theme blocks (slightly darker than `--paper`: light ≈ `#E2DEE4`, dark ≈ `#141118`), sunken via inset box-shadow + `--hairline` right seam.

- **`openBoardById()` and `newBoard()` cannot be reused as-is** — both end in `history.back()` (mobile-list-shaped). Extract `swapBoard(id)`: `saveNow()` (safe — `persist()` snapshots `current` synchronously) → `idbGet` → `current = rec` → crossfaded `renderBoard()` → `renderPane()`. Desktop new-board = create + `idbPut` + same swap. No history push → mobile `popstate` handler untouched.
- **`deleteBoard()` needs a desktop wrapper**: (a) its undo callback calls `renderList()` — generalize to `refreshBoardsUI()` (list on mobile, pane on desktop); (b) deleting the *open* board sets `current = null` — on desktop the dead board would stay on screen and the next interaction dereferences `current.notes` → **crash**. After delete: if `current === null`, run the existing `ensureCurrentValid()` (picks most-recent-by-`updatedAt` or creates a blank) + `renderPane()`; undo restores the record and swaps back if it was open.
- Cards: shared row-content helper with `renderList` (title / `COPY.untitled` + `formatDate`), `createdAt` desc, `.active` mark by `current.id` (structural — ink weight, not color alone), hover/focus-within delete glyph, New-board control at top. Live title: the anchor `input` handler updates the active card's title span per keystroke (no full re-render); full `renderPane()` on boot/swap/new/delete/undo/title-commit.
- **Crossfade sequenced with `setTimeout`, not `transitionend`** — the reduced-motion kill-switch zeroes transitions and `transitionend` would never fire (the existing `leave()` helper already establishes the setTimeout pattern). ~150 ms, added to the §8 motion set with a DECISIONS entry. A `swapping` flag guards async re-entrancy beyond `delayAction`'s 400 ms window.

### Keyboard (additive — beyond the issue, flagged)
One desktop-gated `document` keydown: **Escape** = blur edit, else deselect; **Delete/Backspace** = delete selected **only when `!isEditing(document.activeElement)`** (otherwise typing backspace nukes the note under you); **Enter** = edit selected at end. No conflict with `menuKeyHandler` (menu never opens on desktop).

## Codebase review — breaks, gaps, and clashes found

1. **Cross-board Undo bug (pre-existing, desktop-amplified).** `deleteNote`/`deleteLot` undo callbacks splice into `current` *at undo time* — delete a note, switch boards within 5 s, tap Undo → the note resurrects **onto the wrong board**. The always-visible pane makes this a one-click accident. In scope: board swap (and mobile board-open) finalizes any pending Undo via `hideToast()` (the delete is already persisted).
2. **`deleteBoard` desktop crash + wrong-surface re-render** — see Board pane above.
3. **Hardcoded layout literals** — `--offx: '0px'` in `applyLayout` and `#board { width: 900px }` in CSS both contradict variable-width desktop; become vars (mobile values unchanged).
4. **`setPointerCapture` breaks native clicks inside `#board`** — selection buttons must be recognizer-routed (see Selection model).
5. **`focusin` auto-edit fights click-to-select** — resolved by the desktop branch; the pointer guard already isolates the keyboard path.
6. **`delayAction`'s drop-guard makes delayed selection impossible** — the mechanical forcing function behind flagged decision 6.
7. **Narrow desktop windows** — resolved structurally by the min-anchored scale formula (`LOGICAL_W` floors at 900; furniture never collides), rather than accepted as clipping.
8. **`history.back()` baked into `openBoardById`/`newBoard`** — desktop needs the extracted `swapBoard`; popstate flow untouched for mobile (B9).
9. **`sw.js` cache-first** — bump `CACHE` to `todo-boards-v3` or installed clients never receive the change.
10. **Mode flip edge cases** — stale list history entry (fix: `history.back()` on flip), half-finished gestures (fix: null recognizer state), mid-edit flips (safe: teardown never blurs, `focusout` commit still runs).
11. **No mobile regression surface**: the only change touching mobile rendering is the width-agnostic furniture refactor, equivalence-proven at 900 and screenshot-checked; every behavior change is `isDesktop`-gated; long-press gating is `!isDesktop`, never removal.

## Implementation steps (ordered for review)

1. **Furniture CSS made width-agnostic** (pure refactor, provably identical at 900) + `--logical-w`/`--offx` wiring in `applyLayout`. Screenshot-verify mobile.
2. **Mode module**: `PANE_W`, `isDesktop` matchMedia + `html.desktop`, `applyMode()` teardown (selection, menu, list-state pop, gesture nulling), long-press gating.
3. **Geometry**: `LOGICAL_W` → `let`; desktop `applyLayout` branch (min-anchored formula).
4. **Pane**: markup (`index.html`), `--pane` tokens + sunken styles, `renderPane()`/`swapBoard()`/`refreshBoardsUI()`/desktop new+delete wrappers, live-title hook, crossfade (+ §8 entry), Undo-finalize-on-swap (finding 1).
5. **Selection + buttons**: `#selection` overlay + styles, `classifyTarget` additions, `handleTap` desktop branches (instant select / tap-pairing edit / canvas deselect-first / `sel-btn` via `delayAction`), drag-selects, reposition/clear hooks, completed→Restore.
6. **Resize**: extract `applyNoteScale` from `updatePinch`; `resize` gesture branch; cursors.
7. **Lot lines + keyboard**: lot select + inline right-edge buttons; desktop `focusin` branch; Escape/Delete/Enter.
8. **Ship hygiene**: `sw.js` → v3; DECISIONS entries B19–B23 (detection + geometry + pane-replaces-list, instant selection vs B18, caret-at-end vs B14, motion additions, cross-device x tradeoff + lot-item resolution); README desktop section.

## Verification

`python3 -m http.server 8000`, exercise in Chromium (no test suite exists; verification is behavioral):

- **Desktop (≥1024 px, mouse)**: click-select vs double-click-edit (caret at end); frame-drag resize against the 0.5–2.0 clamp; Complete/Restore/Delete buttons incl. 5 s Undo; no menu on press-and-hold anywhere (notes, lot, anchors, pane cards); pane order/active mark/hover-delete/New board; swap crossfade; canvas deselect-then-create; lot-line select/complete/delete; Escape/Delete/Enter; both themes; `prefers-reduced-motion` (swap instant, still sequenced).
- **Narrow desktop window** (~1024×900): `LOGICAL_W` floors at 900 — no furniture collision, mobile-placed notes all visible.
- **Mobile emulation**: tap-create, drag, pinch, long-press menu, list view + OS back, B18 acknowledgments — pixel/behavior-identical; furniture unchanged at 900.
- **Mode flip**: cross 1024 px both directions mid-selection, mid-edit, and with the list open — clean teardown, no stuck gesture, no resurrected list on OS back.
- **Cross-device data**: notes on desktop's right expanse → mobile width (off-canvas but intact in IndexedDB) → widen (they return). Parking Lot fully portable.
- **Undo-across-boards**: delete a note, immediately swap boards → toast finalizes, no wrong-board resurrection.
- **Service worker**: v3 cache serves the new build after one reload cycle.
