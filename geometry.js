/* --- 4. Layout / scale-to-fit -------------------------------------------- */
import { HIT_FLOOR, HIT_FLOOR_DESKTOP, KB_HIDE_SLOP, LIST_PANEL_FRAC, NOTE_MIN_W, PANE_W, REF_W, REF_H, anchorEls, el, BAND_GAP, BAND_LINE, BAND_TOP, LOT_FLOOR, LOT_HEAD, LOT_MAX_FRAC, clamp, noteRec, state } from './state.js';
import { lotEls, noteEls, updateLinks } from './render.js';
import { selected, updateSelectionUI } from './interactions.js';

/* --- Legacy-frame adoption (B93) ------------------------------------------
   One-time boot migration: a note without `rh` (pre-B32) adopts the frame it
   already renders in, the same fold rebaseNote performs at every grab.

   Render-silence (P3, PRD §1.2): x and size take the width ratio
   LOGICAL_W/(rw‖900), y goes through clamp(y·(LOGICAL_H/LEGACY_H), 0,
   LOGICAL_H − HIT_FLOOR), and rw/rh are stamped to the live frame, so noteK ≡ 1
   afterwards. The ratios agree by construction: on mobile LEGACY_H = 900·vh/vw
   so the y-ratio equals the width ratio vw/900 and min(LOGICAL_W/rw,
   LOGICAL_H/LEGACY_H) picks it; on wide LEGACY_H = LOGICAL_H and B20's
   min-anchored renderScale keeps the note put. The scale fold
   mirrors rebaseNote (effScale before = (scale‖1)·widthRatio = scale after).
   B21/B32's "stored y never mutated" is waived for THIS
   write alone (B93).

   writeRecord is injected by boot so geometry has no persistence dependency. */
export async function migrateLegacyBoards(all, writeRecord) {
  const adopt = (n) => {
    const wRatio = LOGICAL_W / (n.rw || REF_W);
    return {
      ...n,
      x: n.x * wRatio,
      y: clamp(n.y * (LOGICAL_H / LEGACY_H), 0, Math.max(0, LOGICAL_H - HIT_FLOOR)),
      scale: (n.scale || 1) * wRatio,
      rw: LOGICAL_W,
      rh: LOGICAL_H,
    };
  };
  let adopted = 0;
  for (const rec of all) {
    if (!Array.isArray(rec.notes)) continue;
    const legacy = rec.notes.filter((n) => n && !Number.isFinite(n.rh));
    if (!legacy.length) continue;
    rec.notes = rec.notes.map((n) => (n && !Number.isFinite(n.rh)) ? adopt(n) : n);
    await writeRecord(rec);
    adopted += legacy.length;
  }
  return adopted;
}

// Module-scope layout state, written only from this region's layout math.
export let LOGICAL_W = REF_W;        // mobile: = vw (B32); wide: derived (B20)
export let LOGICAL_H = REF_H;                // responsive: recomputed each layout to fill the viewport
// The pre-B32 frame height; read ONLY by migrateLegacyBoards (B93).
export let LEGACY_H = REF_H;
export let renderScale = 1;
let offX = 0, offY = 0;
export let calSqueeze = false;
let paneCollapsed = false;   // the All-Boards rail's collapsed face (B118)
const frameUi = {
  LOGICAL_W_TRUE: null,               // set only while squeezed

  /* Frame-reflow hook, registered by boards at init: geometry must not import
     boards (cycle). */
  frameReflow: null,
};
export function onFrameReflow(fn) { frameUi.frameReflow = fn; }


/* CAL_RAIL_W (B99): the collapsed calendar rail's unscaled width, reserved
   from the wide frame at ALL times, before any squeeze math. While expanded
   (calSqueeze) CAL_PANEL_W replaces it; it does not add to it. */
const CAL_RAIL_W = 40;               // the collapsed rail (B99)
const CAL_PANEL_W = 320;             // unscaled CSS px the panel takes
export function applyLayout(vw, vh) {
  if (deferLayoutIfEditing()) return true;    // never move the board under a focused editor (B28)
  // The environment pass passes the viewport it read, so frame and tier come
  // from one read; a bare applyLayout() reads the live viewport.
  computeFrame(vw ?? window.innerWidth, vh ?? window.innerHeight);
  applyFrame();
  return false;                      // applied: nothing held (B152)
}

/* The scale-to-fit half of applyLayout: chooses the frame. applyFrame
   publishes it. */
function computeFrame(vw, vh) {
  if (state.isWide) {
    // Wide (B20, B96): the rail takes PANE_W unscaled, the sheet the rest.
    // Min-anchored scale: neither logical dimension drops below the 900×1000
    // reference, so mobile-placed notes always fit and the top furniture
    // (~880 units) never collides.
    // Calendar squeeze (R6): the open panel's width is removed like the left
    // rail's; nothing is written (B64). B99's 40px is reserved either way.
    const calW = calSqueeze ? CAL_PANEL_W : CAL_RAIL_W;
    // B118: the collapsed left rail is the calendar rail's own 40px.
    const paneW = paneCollapsed ? CAL_RAIL_W : PANE_W;
    renderScale = Math.min(vh / REF_H, (vw - paneW - calW) / REF_W);
    LOGICAL_H = vh / renderScale;
    LOGICAL_W = (vw - paneW - calW) / renderScale;
    frameUi.LOGICAL_W_TRUE = (calSqueeze || paneCollapsed)
      ? (vw - PANE_W - CAL_RAIL_W) / renderScale   // the resting frame
      : null;
    offX = paneW;
    offY = 0;
    LEGACY_H = LOGICAL_H;
  } else {
    // Mobile (B32): the sheet IS the viewport at scale 1.
    LOGICAL_W = vw;
    LOGICAL_H = vh;
    renderScale = 1;
    offX = 0;
    offY = 0;
    LEGACY_H = REF_W * vh / vw;      // (B93)
  }
}

/* The application half of applyLayout: publish the frame computeFrame chose. */
function applyFrame() {
  el.board.style.setProperty('--logical-w', LOGICAL_W + 'px');
  el.board.style.setProperty('--logical-h', LOGICAL_H + 'px');
  el.board.style.setProperty('--rs', renderScale);
  el.board.style.setProperty('--offx', offX + 'px');
  el.board.style.setProperty('--offy', offY + 'px');
  // Both sections size to their content (B47); a width change re-wraps them.
  updateBoardGeometry();
  // The list panel's height (B82): set BEFORE the capacity check below, which
  // measures #list-rows inside it. Unused on desktop (overlay stays inset:0).
  el.listView.style.setProperty('--list-panel-h', listPanelH() + 'px');
  // Re-derive each note's x, y and size (B64) and its hit area. The wrap cap
  // reads stored fields only, so no layout change moves it (B64/B39); it is
  // written at creation (makeNoteEl) and by every gesture that changes x,
  // scale or rw (rebaseNote, applyNoteScale, the drag): each must re-assert.
  noteEls.forEach((node, id) => {
    const note = noteRec(id);
    if (note) {
      placeNote(node, note);
      setHitInset(node, note);
    }
  });
  if (selected) updateSelectionUI();
  updateLinks();                     // (B91)
  // The per-page card budget is measured from the surface's height, so a
  // resize must re-render and re-paginate; boards owns that, via this hook.
  if (frameUi.frameReflow) frameUi.frameReflow();
}

/* B28's soft-keyboard deferral, one shared decision. The Android keyboard fires
   a viewport resize and the mobile sheet's height tracks the viewport, so
   recomputing would drag the page out from under the note being written; the
   next tap would blur the invisible editor, B8 would discard the empty frame,
   the keyboard would drop and resize again (the flap). It would also corrupt
   state: with one shared k (B64) a shrunken height would shrink x and SIZE at
   render time, and y is frame-relative (B32), so a grab under it would rebase
   and write the shrunken rh into storage permanently. So while an editor inside
   the board holds focus a layout change is REMEMBERED, never applied; a real
   rotation or fold is postponed, and the held frame lands on focusout
   (interactions.js:onFocusOut). Every layout path routes through applyLayout,
   so the guard lives there. Desktop has no soft keyboard and is unguarded
   (B19). Do not weaken it. */
export function deferLayoutIfEditing() {
  if (state.isDesktop || !editingInBoard()) return false;
  state.editVP.deferred = true;
  return true;
}

/* While an environment pass is in flight the squeeze/collapse setters must not
   lay out on their own: the pass applies ONE frame once the new tier and rail
   width are both in place. Standalone calls still lay out. */
let envPass = false;
export function inEnvironmentPass(on) { envPass = on; }

function editingInBoard() {
  const a = document.activeElement;
  return !!(a && a.hasAttribute && a.hasAttribute('contenteditable') && el.board.contains(a));
}

/* The keyboard's arrival is deferred (B28); its departure PUTS THE NOTE AWAY
   (B80). The visual viewport shrinks as the keyboard opens, so growth past the
   edit's own floor (smallest height since focus) by KB_HIDE_SLOP means the
   keyboard is leaving while the note holds focus: blur() runs commit-on-blur
   (focusout), which commits, deselects and lands the deferred layout. The
   floor only drops within an edit (reset to Infinity on focusout), so this
   holds even when the browser animates the return in steps.

   A FOLD also grows the visual viewport, so the blur is gated on the width
   being unchanged by this resize (a fold always changes it, the keyboard never
   does) and, where reported (Chromium/Android: navigator.virtualKeyboard), the
   keyboard not still up. Either leg failing means defer, never blur. Width is
   compared to the PREVIOUS resize's, not the floor's: folding back lands on
   the cover width the keyboard was up at and would read as a retraction.
   editVP.width is cleared with the floor on focusout. */
function keyboardStillUp() {
  const vk = navigator.virtualKeyboard;
  return !!(vk && vk.boundingRect && vk.boundingRect.height > 0);
}

/* The resize TRIGGER: reports whether it CONSUMED the resize (held the frame
   via editVP.deferred, or blurred); a consumed resize never schedules a pass.
   Anything else goes to the environment pass. */
export function onViewportResize() {
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  if (!state.isDesktop && editingInBoard()) {
    const w = vv ? vv.width : window.innerWidth;
    // Two listeners (window + visualViewport) carry ONE change; a repeated size
    // must not read as a retraction and blur the editor.
    if (w === state.editVP.width && h === state.editVP.height) return true;
    const widthMoved = w !== state.editVP.width;   // a fold, never a keyboard
    state.editVP.width = w;
    state.editVP.height = h;
    if (h <= state.editVP.floor) { state.editVP.floor = h; state.editVP.deferred = true; return true; }
    if (h > state.editVP.floor + KB_HIDE_SLOP && !widthMoved && !keyboardStillUp()) {
      document.activeElement.blur(); return true;
    }
    state.editVP.deferred = true; return true;   // sub-threshold jitter, or a fold: keep holding
  }
  return false;
}

/* --- 5. Coordinate + caret helpers --------------------------------------- */
export const toLogical = (clientX, clientY) => {
  const x = (clientX - offX) / renderScale;
  const y = (clientY - offY) / renderScale;
  // Squeeze (R6 clause 1): un-map x proportionally into the TRUE frame (the
  // one the board returns to on close), so a grab's rebaseNote (B21's licensed
  // write) stamps coordinates that survive the squeeze lifting. y is untouched.
  return { x: frameUi.LOGICAL_W_TRUE ? x * (frameUi.LOGICAL_W_TRUE / LOGICAL_W) : x, y };
};

/* The calendar squeeze (R6): with the panel open on wide, the sheet lays out
   with the panel's width removed, as B20 does for the left rail. Every k
   changes with the frame (B64), so nothing is written (P3: the squeeze is a
   frame, not an edit). frameUi.LOGICAL_W_TRUE holds the TRUE frame while
   squeezed; toLogical un-maps into it, so rebaseNote stamps rw/rh = the true
   frame (R6 clause 1). Export reads storage and ignores the squeeze (R6 clause
   2). Overlap during the squeeze is accepted (R6). */
export function setCalSqueeze(on) {
  if (calSqueeze === on) return;
  calSqueeze = on;
  if (state.current && !envPass) applyLayout();
}

/* B118: the pane's collapse mirrors the squeeze. While collapsed,
   LOGICAL_W_TRUE holds the resting (expanded) frame, so toLogical/rebaseNote
   un-map into it (R6). */
export function setPaneCollapsed(collapsed) {
  if (paneCollapsed === collapsed) return;
  paneCollapsed = collapsed;
  if (state.current && !envPass) applyLayout();
}

/* The similarity transform (B64), pure in the note and its frame. rw/rh are
   the LOGICAL_W/H the note's geometry was last written against; ONE ratio
   k = min(W/rw, H/rh) maps x, y and size together, so a fold maps the
   arrangement as a figure. min gives containment (x ≤ rw ⇒ x·k ≤ W) with zero
   re-clamps. The figure anchors top-left with NO centering offset: each note
   carries its own rw/rh, so centering would differ per cohort and re-shear
   the arrangement (a grabbed note rebases to offset 0, its siblings would
   keep a nonzero one). Slack falls right/bottom. Stored geometry is never
   mutated by a viewport change (B21/B32); only rebaseNote folds k into storage,
   at grab. k
   is never clamped: MIN/MAX_SCALE bound the authored scale at gesture time.

   Screen uses noteK (LOGICAL_W/H), export uses exportK (EXPORT_W/H): one law,
   not one number (B64). No note reaching here lacks rh: B93's boot migration
   adopts every rh-less note before first paint. */
export const noteKFor = (n, frameW, frameH) =>
  Math.min(frameW / (n.rw || REF_W), frameH / n.rh);

export const noteK = (note) => noteKFor(note, LOGICAL_W, LOGICAL_H);
export const renderX  = (note) => note.x * noteK(note);
export const effScale = (note) => (note.scale || 1) * noteK(note);
export const renderY  = (note) => note.y * noteK(note);

/* A note's on-sheet seat: left, top and the similarity's scale (B64). Shared
   by makeNoteEl, a surfaced echo, applyFrame and seatAllNotes. The drag and
   resize tails write raw note.x/note.y and do not call it. */
export function placeNote(node, note) {
  node.style.left = renderX(note) + 'px';
  node.style.top = renderY(note) + 'px';
  node.style.transform = 'scale(' + effScale(note) + ')';
}

export function rebaseNote(note) {
  // Fold k into the authored scale (B64): effScale before equals note.scale
  // after, so the grab is silent, and with k ≡ 1 every gesture runs in
  // current-frame units. The folded scale may leave [MIN_SCALE, MAX_SCALE];
  // the gesture clamps stay widened to admit it (B40).
  const m = noteK(note);
  note.x = renderX(note);
  note.y = renderY(note);
  note.scale = (note.scale || 1) * m;  // ‖1 mirrors effScale: no NaN stored
  // Squeeze (R6 clause 1): stamp the TRUE frame; toLogical already un-mapped
  // the drag's point into it.
  note.rw = frameUi.LOGICAL_W_TRUE || LOGICAL_W;
  note.rh = LOGICAL_H;
  // The wrap cap is deliberately NOT silent here (B64): when the height ratio
  // binds, rw = LOGICAL_W exceeds rw·k, so B39's (rw − x)/scale can WIDEN at
  // the grab (never narrow). Re-assert the var now so the element, the drag
  // guard's caches (g.dragCap/g.dragW measure after this) and the record agree
  // from the first frame; a stale DOM cap would snap the note wide at the drop.
  const node = noteEls.get(note.id);
  if (node) applyNoteWidth(node, note);
}

/* A note's text wraps only at the sheet's right edge (B39): (rw − x)/scale in
   authored units, stated directly (B64). Not (LOGICAL_W − renderX)/effScale,
   which would widen the cap whenever the height ratio binds and re-wrap a
   cap-wide note across a fold. Frame-invariant (same wrap on every device and
   in the PDF, where exportNoteBox calls this function); containment holds:
   renderX + cap·effScale = rw·k ≤ LOGICAL_W. Floored at NOTE_MIN_W so an
   edge-adjacent note stays a usable column. */
export const noteMaxW = (note) =>
  Math.max(NOTE_MIN_W, ((note.rw || REF_W) - note.x) / (note.scale || 1));

/* The cap lives on the NOTE element (.note-text inherits it). Set it BEFORE
   anything measures offsetWidth: the cap changes what it reports (setHitInset,
   B7). */
export function applyNoteWidth(node, note) {
  node.style.setProperty('--note-max-w', noteMaxW(note) + 'px');
}

/* Both sheet ends are sized by content from a floor, in whole units (B47,
   UIUX §3.1 / UIUX §3.2); done here because CSS cannot step a length by lines
   or rows.

   The band closes at rule-y = BAND_TOP + max(2, lines) × BAND_LINE + BAND_GAP
   (61 at the two-line floor, 81 at three). The label hangs BELOW the rule as a
   tab (B76), so it budgets no height above it. Shared by bandRuleY (render)
   and exportRuleY (export); only the line count is each frame's own measure
   (screen reads the DOM, export wraps on its own sheet, B34). */
export const bandRuleYFor = (lines) => Math.round(BAND_TOP + lines * BAND_LINE + BAND_GAP);
function bandRuleY() {
  let lines = 2;                       // the two-line floor
  for (const key of ['components', 'requirements']) {
    const node = anchorEls[key];
    // The band anchor has no padding, so scrollHeight is whole line boxes.
    if (node) lines = Math.max(lines, Math.round(node.scrollHeight / BAND_LINE));
  }
  return bandRuleYFor(lines);
}

/* The Parking Lot's height is 34 + max(2 × 44, sum of the rows' offsetHeight)
   (UIUX §3.2, B73). Each .lot-item is content-sized and never clipped itself
   (the clip lives on #lot-items), so summing offsetHeight reads true content:
   wrapped lines are never cut off and the lot shrinks as well as grows. Empty,
   one row and two single lines draw the same two-row shelf. A ceiling of half
   the sheet keeps a runaway lot from swallowing the page; content past it is
   clipped. */
export const lotH = () => {
  let sum = 0;
  for (const node of lotEls.values()) sum += node.offsetHeight;
  return Math.min(
    LOT_HEAD + Math.max(LOT_FLOOR, Math.round(sum)),
    Math.round(LOGICAL_H * LOT_MAX_FRAC)
  );
};

/* The drilled list's panel rises to a third of the viewport (B82, UIUX §10),
   published as --list-panel-h off window.innerHeight, not CSS `vh`, so the
   soft keyboard (visual viewport only, B28) never moves it. Physical CSS px:
   #list-view is fixed OUTSIDE the scaled board, so no renderScale division. */
const listPanelH = () => Math.round(window.innerHeight * LIST_PANEL_FRAC);

/* The one site that sets both sections' geometry; call it wherever their
   content changes. The board-action row rides the lot's top edge (B83), so its
   hit collar is set here too: only renderScale moves its physical size. */
export function updateBoardGeometry() {
  el.board.style.setProperty('--rule-y', bandRuleY() + 'px');
  el.board.style.setProperty('--lot-h', lotH() + 'px');
  // offsetHeight, not the rect: transform-independent, so LOGICAL units.
  el.board.style.setProperty('--card-bottom', anchorEls.title.offsetHeight + 'px');
  // The row spans the sheet, so hitInset's width term is 0 and its height is
  // the tab's: the collar each tab needs to reach the floor (UIUX §6, B7).
  // The flat tab's box is fractional (~20.9) and offsetHeight can round it up
  // half a pixel, leaving the collar short of the floor; +0.5 covers that.
  el.boardActions.style.setProperty('--hit', (hitInset(el.boardActions, renderScale) + 0.5) + 'px');
}

/* UIUX §6/B7: any board-space target expands its hit area to the floor
   without growing its visual frame. `k` is what the element draws at. */
export function hitInset(node, k) {
  const physW = node.offsetWidth * k, physH = node.offsetHeight * k;   // logical x draw scale
  const floor = state.isDesktop ? HIT_FLOOR_DESKTOP : HIT_FLOOR;
  return Math.max(0, (floor - physW) / 2, (floor - physH) / 2) / (k || 1);
}

export function setHitInset(node, note) {
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
