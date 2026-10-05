# TheBoards — Engine-Specific Compatibility Review (issue #360)

**Reviewer:** Stromboli (Hermes agent run)
**Date:** October 5, 2026
**Commit reviewed:** `b087e55` (main)
**Method:** all shipped source files read for engine-specific APIs, CSS
features, and viewport handling, cross-checked against `docs/DECISIONS.md`;
then exercised live in **Chromium 153, Firefox 155, WebKit (Safari 26-era)**
via Playwright — app boot, tap-to-capture + typing, desktop mouse drag, mobile
touch context, PDF export round-trip (bytes verified `%PDF-1.4` in all three),
IndexedDB presence, History API push/pop, clipboard, and CSS.supports probing.
Headless WebKit/Firefox covers desktop render paths; the mobile touch paths on
real Firefox Android / iOS Safari hardware remain unverified and are labeled
as such below.

---

## 1. Summary

The codebase is unusually engine-tolerant already. Two Firefox-aware hazards
are deliberately handled in-tree (do not re-fix):

- `app.js:54` — Gecko flushes `matchMedia` on layout in no fixed order; the
  `isDesktop` switch is written against that.
- `app.js:327` — Firefox may serve `sw.js` from its own HTTP cache; the update
  flow accounts for it.

B27/B27b suppress the touch-to-mouse compatibility events at source, which is
the classic cross-engine gesture break — and the pointer-event recognizer,
`setPointerCapture` on the board, `visualViewport`, History API routing,
IndexedDB, the hand-rolled PDF export, and clipboard (with its
`execCommand` fallback at `interactions.js:1289`) all behaved identically in
the three engines under test.

**One real finding survives the sweep** (below), and it is a *degradation
window*, not a hard break: every engine ships the B28 JS guard, but one of its
two legs is Chromium-only, so Firefox/WebKit run the keyboard heuristic
single-legged.

## 2. Finding — B28's keyboard guard loses a leg outside Chromium

**File:** `index.html:10` (viewport meta) · `geometry.js:209-212` (`keyboardStillUp`)
**Engines:** Firefox (Android), WebKit (iOS Safari) · **Severity:** degraded · **Confidence:** medium (mechanism verified; the corruption itself needs real-hardware reproduction)

Two Chromium-only facilities carry B28's "sheet holds still while the keyboard
is up" contract:

1. `index.html:10` sets `interactive-widget=resizes-visual`, which keeps
   `innerHeight` stable while the soft keyboard shows. **Verified live:**
   WebKit logs `Viewport argument key "interactive-widget" not recognized and
   ignored` at load; Gecko implements none of the keyword — on Firefox Android
   the keyboard resizes the *layout* viewport, so `innerHeight` shrinks
   mid-edit, exactly the pre-B28 condition.
2. `keyboardStillUp()` (`geometry.js:209-212`) reads
   `navigator.virtualKeyboard` — **verified live: present in Chromium, absent
   in Firefox and WebKit.** On those engines the function always returns
   `false`, i.e. "keyboard is down", so the second leg of the gate at
   `geometry.js:232`
   (`h > state.editVVFloor + KB_HIDE_SLOP && !widthMoved && !keyboardStillUp()`)
   passes unconditionally.

**Why it matters:** the height-growth blur is also the commit-on-blur path
(`geometry.js:233-236`: `document.activeElement.blur(); return true;` —
"keyboard left → commit-on-blur applies the held layout"). With the meta
ignored, a height-growth resize can arrive while the keyboard is still up
(browser UI bars collapsing, WebKit's keyboard-resize timing); on Firefox the
`virtualKeyboard` leg cannot veto it, so the deferred `applyLayout` can compute
`LOGICAL_H` at a keyboard-shrunken viewport and the commit writes that frame to
storage — the corruption `geometry.js:152-160` (B64) exists to prevent: "a
keyboard-shrunken height now shrinks x and SIZE too… written into storage
permanently."

On Chromium the pair makes this window safe; on Firefox/WebKit only the
floor/slop heuristic remains, and it *defers* rather than corrects.

**Recommended fix (does not weaken B28):** make the focusout re-application
engine-safe rather than widening the blur gate — in the deferred-layout apply
path, re-read the viewport and hold the frame if the current visual-viewport
height is still below the edit's floor (`state.editVVFloor`), applying only
when a resize at or above the floor arrives (the keyboard-closing resize).
Equivalently: on engines where `navigator.virtualKeyboard` is absent, treat
height-growth without a width change as "keyboard may still be up". The meta
line itself can stay — it is correct where it is honored.

**Verification gap (honest):** headless engines cannot show a soft keyboard.
The missing-leg behavior is verified live (meta warning, API absence); the
storage-corruption consequence is a code-path argument and needs one
real-device pass on Firefox Android and iOS Safari before it graduates from
medium confidence.

## 3. Ruled out (checked, no break found)

| Area | Check | Verdict |
|---|---|---|
| CSS prefixes | `-webkit-line-clamp` triplets all ship with `display:-webkit-box`; no orphaned prefixes | OK all engines |
| `:has()` | used once (`styles.css:1117`); supported in all three current engines | OK |
| Modern CSS | `color-mix`/`oklch`/`dvh`/`backdrop-filter`/`scrollbar-*`: either unused or supported everywhere | OK |
| JS APIs | `structuredClone`, `replaceAll`, `.at`, `ResizeObserver`, `visualViewport`, `inputmode`: present in all three | OK |
| `navigator.vibrate` | guarded by `if (navigator.vibrate)` (`interactions.js:148`) | OK (silent on iOS, by design) |
| Clipboard | `navigator.clipboard` with `execCommand` fallback (`interactions.js:1289`) | OK |
| PDF export | canvas → hand-rolled writer → blob download; verified byte-identical header in all three engines | OK |
| Gestures (desktop) | mouse drag moves a note identically in all three; pointer event streams equivalent | OK |
| Gestures (mobile) | touch paths can only be CDP-tested on Chromium; real-device Firefox Android/iOS Safari not exercised in this run | unverified, see §4 |
| Service worker | Firefox HTTP-cache hazard already handled in-tree (`app.js:327`) | OK |
| IndexedDB / History API | databases present, push/pop routes round-trip in all three | OK |

## 4. Follow-up

One follow-up issue is warranted: **"B28 keyboard guard: cover engines without
`navigator.virtualKeyboard`"** — carrying the §2 recommended fix and the
real-device verification steps (Firefox Android, iOS Safari: open a note, show
keyboard, collapse browser UI bar mid-edit, blur by tapping the canvas, and
check the stored frame's scale/position did not shrink). This review ships no
code changes by design (issue #360 asks for the audit).
