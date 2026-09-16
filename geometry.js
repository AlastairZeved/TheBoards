/* --- 4. Layout / scale-to-fit -------------------------------------------- */
// issue #182 module wiring — native ESM, no bundler (AGENTS.md).
import { HIT_FLOOR, HIT_FLOOR_DESKTOP, KB_HIDE_SLOP, LIST_PANEL_FRAC, NOTE_MIN_W, PANE_W, anchorEls, el, BAND_GAP, BAND_LINE, BAND_TOP, LOT_FLOOR, LOT_HEAD, LOT_MAX_FRAC, LOT_ROW } from './state.js';
import { state } from './state.js';
import { lotEls, noteEls, updateLinks } from './render.js';
import { selected, updateSelectionUI } from './interactions.js';

// The frame/geometry module's module-scope state (issue #182): the logical
// coordinate space's own variables + the squeeze pair. Written only from this
// region's layout math (the writers-map grep: every write-site is geometry).
export let LOGICAL_W = 900;                 // mobile: = vw, the sheet is the viewport (B32); desktop: derived per layout (B20)
export let LOGICAL_H = 1000;                // responsive: recomputed each layout to fill the viewport
export let LEGACY_H = 1000;                 // the LOGICAL_H the pre-B32 build would have produced
                                     // on this device. Read ONLY by migrateLegacyBoards
                                     // (B93): the render path no longer branches on it —
                                     // boot adopts every rh-less note onto the single
                                     // B64 path before first paint.
export let renderScale = 1, offX = 0, offY = 0;
export let calSqueeze = false;
export let paneCollapsed = false;   // the All-Boards rail's collapsed face (issue #211, B118)
const frameUi = {
  LOGICAL_W_TRUE: null,               // set only while squeezed

  /* Frame-reflow hook (issue #182): applyLayout may need the surface
     renderers to re-run after a frame change. The renderers live in boards,
     and geometry must not import boards (cycle), so boards registers a
     callback here at init. Single writer, module-local. */
  frameReflow: null,
};
export function onFrameReflow(fn) { frameUi.frameReflow = fn; }


/* CAL_RAIL_W (issue #158, B99): the collapsed calendar rail's unscaled width,
   reserved from the frame on wide at ALL times — the rail is standing
   furniture (mockup 6), the room's third column, so its width is removed
   exactly as the left rail's is, before any squeeze math. While the panel is
   expanded (calSqueeze) CAL_PANEL_W takes the rail's place — the panel
   expands FROM the rail, it doesn't add to it. */
const CAL_RAIL_W = 40;               // the collapsed rail (mockup 6: 40px, right edge)
export function applyLayout() {
  computeFrame(window.innerWidth, window.innerHeight);
  applyFrame();
}

/* Split (issue #176): applyLayout's two natural halves — the scale-to-fit math
   that chooses the frame, and the DOM application that publishes it — are now
   helpers called in the original order. Extraction only: the bodies are
   applyLayout's, verbatim. */
function computeFrame(vw, vh) {
  if (state.isWide) {
    // Wide (B20): the rail takes PANE_W unscaled; the sheet fills the rest.
    // Desktop reached it via B19's MQ; tablet joins by width alone (B96, issue
    // #155 — the unfolded Z Fold 7). Min-anchored scale — neither logical
    // dimension ever drops below the
    // 900×1000 reference, so mobile-placed notes always fit and the top
    // furniture (~880 units) never collides, at any window shape.
    // The calendar squeeze (R6): while the calendar panel is open the panel's
    // width is removed here, exactly as the left rail's is — the frame narrows,
    // the arrangement maps as a figure (B64), nothing is written. B99 (issue
    // #158): the collapsed rail's 40px is reserved whether or not the panel
    // is open — the standing rail IS the reservation; expanded, the panel
    // takes the rail's place and its full width replaces the 40.
    const calW = calSqueeze ? CAL_PANEL_W : CAL_RAIL_W;
    // B118 (issue #211): the left rail collapses to the calendar rail's own
    // 40px — one rail-width law, two rails — and the sheet fills what it frees.
    const paneW = paneCollapsed ? CAL_RAIL_W : PANE_W;
    renderScale = Math.min(vh / 1000, (vw - paneW - calW) / 900);
    LOGICAL_H = vh / renderScale;
    LOGICAL_W = (vw - paneW - calW) / renderScale;
    frameUi.LOGICAL_W_TRUE = (calSqueeze || paneCollapsed)
      ? (vw - PANE_W - CAL_RAIL_W) / renderScale   // the resting frame the board returns to
      : null;
    offX = paneW;
    offY = 0;
    LEGACY_H = LOGICAL_H;            // desktop geometry is unchanged by B32
  } else {
    // Mobile (B32, overrides B17): the sheet IS the viewport. B17's fill still
    // holds — a scale of 1 is uniform by construction, so no letterbox and no
    // distortion — but every declared px is now a real px, which is the whole
    // point: at 900-and-scale the furniture rendered at ~45% and was unreadable.
    LOGICAL_W = vw;
    LOGICAL_H = vh;
    renderScale = 1;
    offX = 0;
    offY = 0;
    LEGACY_H = 900 * vh / vw;        // the height B17 would have produced here
  }
}

/* The application half (issue #176): publish the frame computeFrame chose —
   the board's CSS vars, the sections' re-measure, each note's render
   coordinates, the links, and the two registered hooks. */
function applyFrame() {
  el.board.style.setProperty('--logical-w', LOGICAL_W + 'px');
  el.board.style.setProperty('--logical-h', LOGICAL_H + 'px');
  el.board.style.setProperty('--rs', renderScale);
  el.board.style.setProperty('--offx', offX + 'px');
  el.board.style.setProperty('--offy', offY + 'px');
  // Both sections size to their content (B47): the band re-measures because a
  // width change re-wraps the zone anchors, the lot because rows may re-cap.
  updateBoardGeometry();
  // The drilled-list panel's height (B82): set BEFORE the capacity check below,
  // which measures #list-rows inside it. On mobile the CSS pins #list-view to
  // this; on desktop the value is unused (the overlay stays inset:0).
  el.listView.style.setProperty('--list-panel-h', listPanelH() + 'px');
  // Re-derive each note's on-sheet x, y AND size (one similarity ratio per
  // note, B64) and its decoupled hit area (physical size changed). The wrap
  // cap needs no re-derive here: (rw − x)/scale reads stored fields only, so
  // no layout change can move it (B64's restatement of B39) — it is written
  // at creation (makeNoteEl) and by the gestures that change its inputs
  // (rebaseNote, applyNoteScale, the drag).
  noteEls.forEach((node, id) => {
    const note = state.current && state.current.notes.find(n => n.id === id);
    if (note) {
      node.style.left = renderX(note) + 'px';
      node.style.top = renderY(note) + 'px';
      node.style.transform = 'scale(' + effScale(note) + ')';
      setHitInset(node, note);
    }
  });
  if (selected) updateSelectionUI();
  updateLinks();                     // links ride the notes' new geometry (B91)
  // Capacity check (issue #58): the per-page card budget is measured from
  // the surface's height, so a resize that changes it must re-render and
  // re-paginate. The re-render belongs to the BOARDS module (it owns the
  // surface state), so applyLayout fires a hook the boards register() fills
  // in — this breaks the geometry <-> boards import cycle at the root (#182).
  if (frameUi.frameReflow) frameUi.frameReflow();
  // No letterbox now: the toast sits 12px above the screen's bottom edge.
  document.documentElement.style.setProperty('--toast-bottom', '12px');
}

/* The Android soft keyboard opening fires a viewport resize. Under B17 the
   mobile sheet's height tracks vh, so recomputing there drags the page out
   from under the note being written and clips it off the bottom — the next tap
   lands on bare canvas, blurs the (now invisible) editor, and B8 discards the
   empty frame, which drops the keyboard, which resizes again. That is the
   flap. While an editor inside the board holds focus the layout is held still
   and the deferral remembered, so a genuine rotation or fold mid-edit is
   postponed rather than lost: commit-on-blur re-applies it. Desktop geometry
   (B20) has no soft keyboard and is left unguarded.

   Under B32 the guard earns a second job. The proportional collapse is the same
   (846 → 450 is the same ratio as B17's 1983 → 1055), but y is now frame-
   relative, so an unguarded keyboard resize would move every note on screen —
   and a gesture grabbing one while the keyboard is up would rebase it, writing
   rh = the shrunken height into storage permanently. Under B64 it earns a
   third: one shared k means a keyboard-shrunken height now shrinks x and SIZE
   too — the whole board would flinch at every keyboard. This deferral is the
   only thing standing between the soft keyboard and all of that. Do not
   weaken it. */

function editingInBoard() {
  const a = document.activeElement;
  return !!(a && a.hasAttribute && a.hasAttribute('contenteditable') && el.board.contains(a));
}

/* The keyboard's arrival is deferred so the sheet holds still (B28); its
   departure PUTS THE NOTE AWAY (B80, issue #119). The visual viewport shrinks
   as the keyboard opens and grows back as it retracts, so the same edit's own
   floor — the smallest height seen since focus — tells the two apart: any
   growth past it by KB_HIDE_SLOP is the keyboard leaving while the note still
   holds focus, and blur() runs the commit-on-blur path (focusout) that commits,
   deselects, and lands the deferred layout. editVVFloor only ever drops within
   an edit (reset to Infinity on focusout), so retraction measured against it
   crosses the threshold even when the browser animates the return in steps. */
export function onViewportResize() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  if (!state.isDesktop && editingInBoard()) {
    if (h <= state.editVVFloor) { state.editVVFloor = h; state.layoutDeferred = true; return; }
    if (h > state.editVVFloor + KB_HIDE_SLOP) { document.activeElement.blur(); return; }
    state.layoutDeferred = true; return;   // sub-threshold jitter: keep holding
  }
  applyLayout();
}

/* --- 5. Coordinate + caret helpers --------------------------------------- */
export const toLogical = (clientX, clientY) => {
  const x = (clientX - offX) / renderScale;
  const y = (clientY - offY) / renderScale;
  // The calendar squeeze (R6 clause 1): while the panel is open the frame is
  // narrowed, so a raw read would write squeezed-frame coordinates that shift
  // when the squeeze lifts. Un-map proportionally into the TRUE frame —
  // the frame the board returns to on close — so a grab's rebaseNote (the one
  // licensed write, B21) stamps where the user sees the note land in the room
  // it returns to. y is untouched (the squeeze is horizontal).
  return { x: frameUi.LOGICAL_W_TRUE ? x * (frameUi.LOGICAL_W_TRUE / LOGICAL_W) : x, y };
};

/* The calendar squeeze (R6): when the calendar panel is open on desktop or
   tablet, the sheet is laid out with the panel's width removed from the
   viewport — the SAME mechanism B20 already uses for the left rail, on the
   right edge now. Every note's k changes with the frame, so the whole
   arrangement renders smaller and further left, exactly as B64's similarity
   law maps a frame change; nothing is written (P3 — the squeeze is a frame,
   not an edit). The TRUE frame is kept in frameUi.LOGICAL_W_TRUE while squeezed, and
   toLogical un-maps a drag's client point into it proportionally, so a
   grabbed note's rebaseNote writes TRUE-frame coordinates stamped rw/rh =
   the true frame (the inverse-transform write, R6's first clause) — the note
   lands permanently where the user sees it land, in the room the board
   returns to when the panel closes. On close the squeeze lifts and the
   board renders exactly where it was. Export ignores the squeeze entirely
   (exportX/exportY read storage; R6's second clause). Overlap during the
   squeeze is accepted (R6, the owner's word) — no auto-untangling. */
const CAL_PANEL_W = 320;             // unscaled CSS px the panel takes (mockup 6's ~⅓)

export function setCalSqueeze(on) {
  if (calSqueeze === on) return;
  calSqueeze = on;
  if (state.current) applyLayout();
}

/* B118 (issue #211): the pane's collapse is the same mechanism pointed the
   other way — the resting frame reserves PANE_W, the collapsed face reserves
   the rail-width law's 40. While collapsed, LOGICAL_W_TRUE holds the resting
   (expanded) frame, so toLogical/rebaseNote un-map a drag into the room the
   board returns to on expand — the R6 discipline, mirrored. */
export function setPaneCollapsed(collapsed) {
  if (paneCollapsed === collapsed) return;
  paneCollapsed = collapsed;
  if (state.current) applyLayout();
}

/* The similarity transform (issues #65/#75, B64; supersedes B40's anisotropic
   mapping and B21's width-only multiplier). note.rw/note.rh record the
   LOGICAL_W/LOGICAL_H the note's geometry was last written against; ONE
   uniform ratio k — the smaller of the two frame ratios — maps x, y and size
   together, so a fold or rotation maps the arrangement as a figure: pairwise
   angles and distance ratios are preserved where two per-axis ratios sheared
   them apart the moment the aspect changed. min gives containment by
   construction (x ≤ rw ⇒ x·k ≤ LOGICAL_W; same for y) — B40's "pushed off
   the bottom" objection dissolves with zero re-clamps. The figure anchors
   top-left with NO centering offset: each note carries its own rw/rh, so a
   centering term would differ per authoring cohort, and a grabbed note
   rebases to offset 0 while ungrabbed siblings kept a nonzero one —
   centering would re-shear exactly the arrangements this law preserves.
   Slack falls to the right/bottom as open canvas. Stored geometry is never
   mutated by a viewport change (B17/B21/B32): render-time only, written back
   solely by the gestures that own writes (rebaseNote, at grab). k is never
   clamped — MIN/MAX_SCALE bound the *authored* scale at gesture time, not
   this frame mapping.

   B93 (issue #141) collapsed B32's two-path rescue: at boot, migrateLegacyBoards
   adopts every rh-less (pre-B32) note onto this single path by writing the
   position it already renders — x and size on the width ratio, y through
   LEGACY_H with the render-time clamp — into storage and stamping
   rw = LOGICAL_W, rh = LOGICAL_H, the same fold rebaseNote performs at every
   grab. After adoption noteK ≡ 1 and the stored values render verbatim, so
   P3 holds (render-silent). The clamp's old scope warning — it fought
   createNote's bottom clamp and would have been written back by rebaseNote —
   is moot: it now runs once, inside the migration, on the notes it is
   adopting. No note reaching this function lacks rh. */
/* The similarity transform (B64) as one pure function of the note and its
   frame — min(W/rw, H/rh), with each frame taking its own min so notes of
   one authoring cohort keep their figure exactly. The screen resolves it
   against LOGICAL_W/LOGICAL_H (noteK), the export against EXPORT_W/EXPORT_H
   (exportK): one LAW shared, not one number — a mixed-cohort board can
   relate its cohorts differently per frame, inherent to min-k and owned in
   B64's costs. Stored x/y are read only — B21's "committed positions are
   permanent" is not ours to break. Legacy notes never reach either path:
   B93's boot migration adopted every rh-less note onto the single min-k
   path before first paint (issue #141). */
export const noteKFor = (n, frameW, frameH) =>
  Math.min(frameW / (n.rw || 900), frameH / n.rh);

const noteK = (note) => noteKFor(note, LOGICAL_W, LOGICAL_H);
export const renderX  = (note) => note.x * noteK(note);
export const effScale = (note) => (note.scale || 1) * noteK(note);
export const renderY  = (note) => note.y * noteK(note);

export function rebaseNote(note) {
  // Fold the similarity ratio into the authored scale (B40's fold, on B64's
  // k): effScale before equals note.scale after, so the grab is silent in
  // position and size — and with k ≡ 1 once rw/rh equal the live frame,
  // every gesture (drag footprints, pinch and resize scaling) runs in
  // current-frame units unmodified. The folded scale may leave
  // [MIN_SCALE, MAX_SCALE]; the gesture clamps stay widened to admit it
  // (B40).
  const m = noteK(note);
  note.x = renderX(note);
  note.y = renderY(note);
  note.scale = (note.scale || 1) * m;  // ‖1 mirrors effScale: never fold NaN into storage
  // The calendar squeeze (R6 clause 1): while the panel is open, stamp the
  // grab against the TRUE frame — the one the board returns to on close —
  // so the note lands permanently where the user sees it land. (toLogical
  // has already un-mapped the drag's client point into true coordinates.)
  note.rw = frameUi.LOGICAL_W_TRUE || LOGICAL_W;
  note.rh = LOGICAL_H;
  // The wrap cap is NOT silent here, and that is deliberate (B64): under
  // min-k, rw = LOGICAL_W can exceed the old rw·k whenever the height ratio
  // binds, so (rw − x)/scale — B39's cap — can WIDEN at the grab (never
  // narrow: LOGICAL_W ≥ rw·k). The pickup rebinds the wrap to the live
  // sheet, which is B39's own "rewraps wider and flatter where it stands"
  // surfacing at the grab. Re-assert the var here so the element, the drag
  // guard's caches (g.dragCap/g.dragW measure after this), and the record
  // agree from the first frame of the gesture — a stale DOM cap would
  // otherwise snap the note wide at the drop instead.
  const node = noteEls.get(note.id);
  if (node) applyNoteWidth(node, note);
}

/* A note has no predetermined width (issue #53, B39): its text wraps only at
   the sheet's right edge — (rw − x)/scale in authored units, stated directly
   (B64). The old form (LOGICAL_W − renderX)/effScale was that identity only
   while position and size shared the width ratio; under B64's min-k it would
   silently widen the cap whenever the height ratio binds, re-wrapping a
   cap-wide note across a fold. Frame-invariant: wrapping is identical on
   every device and in the PDF (exportNoteBox calls this very function), and
   containment still holds — renderX + cap·effScale =
   (x + (rw − x))·k = rw·k ≤ LOGICAL_W. Floored at NOTE_MIN_W so an
   edge-adjacent note stays a usable column rather than a zero-width sliver.
   The old 405/45% cap (PRD §6.2) is superseded. */
export const noteMaxW = (note) =>
  Math.max(NOTE_MIN_W, ((note.rw || 900) - note.x) / (note.scale || 1));

/* The cap lives on the NOTE element (custom properties inherit, so .note-text
   keeps reading the var). Set it BEFORE anything measures offsetWidth — the
   cap changes what offsetWidth reports (setHitInset's constraint, B7). */
export function applyNoteWidth(node, note) {
  node.style.setProperty('--note-max-w', noteMaxW(note) + 'px');
}

/* Both ends of the sheet close the same way (B47, UIUX §3.1/§3.2): a section
   sized by its content from a floor, whole units only, chosen here rather
   than in CSS because CSS cannot step a length by lines or rows.

   The band: rule-y = 14 + max(2, lines) x 19.5 + 8 — band-top, the tallest
   zone's line count at 15px/1.3, and the gap to the rule. The label no longer
   budgets any height ABOVE the rule: since B76 (issue #111) it hangs BELOW the
   rule as a tab, so the band closes at the content plus its gap. 61 at the
   two-line floor, 81 at three lines. */
/* The band's law as one pure function of its line count (B47): both the
   render path (bandRuleY) and the export path (exportRuleY) close at
   band-top + lines × line-height + gap. The line count itself is each
   frame's own measure — the screen reads the DOM, the export wraps text on
   its own sheet (B34) — so only this formula is shared. */
export const bandRuleYFor = (lines) => Math.round(BAND_TOP + lines * BAND_LINE + BAND_GAP);
function bandRuleY() {
  let lines = 2;                       // the two-line floor
  for (const key of ['components', 'requirements']) {
    const node = anchorEls[key];
    // scrollHeight is content + padding; the band anchor carries none, so it
    // reads as whole line boxes (min-height 44 keeps the floor's answer 2).
    if (node) lines = Math.max(lines, Math.round(node.scrollHeight / BAND_LINE));
  }
  return bandRuleYFor(lines);
}

/* The Parking Lot's height follows its MEASURED contents from a two-row
   floor: 34 + max(2 x 44, sum of the rows' rendered heights) (UIUX §3.2).
   Each .lot-item is content-sized (min-height 44, grows with wrapped text,
   never clipped itself — the clip lives on #lot-items), so summing their
   offsetHeight reads true content that both grows and shrinks; this is the
   lot's side of the same law the band already follows by scrollHeight
   (bandRuleY), closing the gap where the lot alone stepped by row COUNT and
   cut wrapped lines off (issue #106, B73). Empty, one row and two single
   lines all still draw the same two-row shelf — furniture, not a by-product
   of content. B37/B47/B57's whole-row budget and its row-count ceiling are
   superseded; a canvas-protecting CEILING survives as half the sheet, so a
   runaway lot cannot swallow the page. Content past it is clipped. */
export const lotH = () => {
  let sum = 0;
  for (const node of lotEls.values()) sum += node.offsetHeight;
  return Math.min(
    LOT_HEAD + Math.max(LOT_FLOOR, Math.round(sum)),
    Math.round(LOGICAL_H * LOT_MAX_FRAC)
  );
};

/* The drilled list's slide-up panel rises to a third of the viewport, the board
   still behind it (B82, issue #125, UIUX §10). Computed in JS and published as
   --list-panel-h — the lot's own pattern — off window.innerHeight rather than a
   CSS `vh`, so the soft keyboard (which resizes only the visual viewport, B28)
   never moves it (B32's keyboard-safe discipline). Physical CSS px: the panel
   is #list-view, a fixed element OUTSIDE the scaled board, so it is not divided
   by renderScale. Desktop keeps the full-screen overlay and ignores this. */
const listPanelH = () => Math.round(window.innerHeight * LIST_PANEL_FRAC);

/* One site sets both sections' geometry, called wherever their content
   changes: layout, anchor input, and every lot insertion/removal. The
   board-action row rides the lot's top edge (B83), so its hit collar is set
   from here too — the flat tabs draw well under the touch floor, and only
   renderScale can move that physical size, which changes here on every layout. */
export function updateBoardGeometry() {
  el.board.style.setProperty('--rule-y', bandRuleY() + 'px');
  el.board.style.setProperty('--lot-h', lotH() + 'px');
  // offsetHeight, not the rect: it is transform-independent, so this is the
  // card's LOGICAL bottom edge on both paths (the rect would arrive scaled).
  el.board.style.setProperty('--card-bottom', anchorEls.title.offsetHeight + 'px');
  // The tabs' own frame is the band label's (B83); the note's decoupled collar
  // (UIUX §6, B7) is what clears the floor. Measured off the row — its width
  // spans the sheet so the width term is 0, its height is the tab's, so this is
  // the upward collar each tab needs to reach 44px on touch / 24px on desktop.
  // hitInset reads the row's INTEGER offsetHeight, but the flat tab's box is
  // fractional (13px × 1.3 + 2px padding ≈ 20.9), so offsetHeight can round it
  // up half a pixel and leave the collar a sub-pixel short of the floor: a
  // half-pixel of headroom keeps the rendered box at or above it.
  el.boardActions.style.setProperty('--hit', (hitInset(el.boardActions, renderScale) + 0.5) + 'px');
}

/* §6/B7's law is not the note's alone: any board-space target expands its hit
   area to the floor without growing its visual frame. `k` is what the element
   draws at — one arithmetic, both callers. */
export function hitInset(node, k) {
  const physW = node.offsetWidth * k, physH = node.offsetHeight * k;   // logical x draw scale
  const floor = state.isDesktop ? HIT_FLOOR_DESKTOP : HIT_FLOOR;
  return Math.max(0, (floor - physW) / 2, (floor - physH) / 2) / (k || 1);
}

export function setHitInset(node, note) {
  // effScale x renderScale is what the note draws at (issue #57).
  node.style.setProperty('--hit', hitInset(node, effScale(note) * renderScale) + 'px');
}

export function placeCaretAtPoint(node, clientX, clientY) {
  let range = null;
  if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(clientX, clientY);
  else if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(clientX, clientY);
    if (p) { range = document.createRange(); range.setStart(p.offsetNode, p.offset); range.collapse(true); }
  }
  const sel = window.getSelection();
  sel.removeAllRanges();
  if (range && node.contains(range.startContainer)) { sel.addRange(range); }
  else { const r = document.createRange(); r.selectNodeContents(node); r.collapse(false); sel.addRange(r); }
}
export function caretToEnd(node) {
  const sel = window.getSelection(), r = document.createRange();
  r.selectNodeContents(node); r.collapse(false);
  sel.removeAllRanges(); sel.addRange(r);
}
