/* --- 4. Layout / scale-to-fit -------------------------------------------- */
import { HIT_FLOOR, HIT_FLOOR_DESKTOP, KB_HIDE_SLOP, LIST_PANEL_FRAC, NOTE_MIN_W, PANE_W, REF_W, REF_H, anchorEls, el, BAND_GAP, BAND_LINE, BAND_TOP, LOT_FLOOR, LOT_HEAD, LOT_MAX_FRAC, clamp, noteRec, state } from './state.js';
import { lotEls, noteEls, updateLinks } from './render.js';
import { selected, updateSelectionUI } from './interactions.js';

/* --- Legacy-frame adoption (B93) ------------------------------------------
   One-time boot migration: a note without `rh` (authored before B32) is
   written onto the single B64 min-k path by adopting the frame it already
   renders in — the same fold rebaseNote performs at every grab.

   Render-silence — why P3 (positions are permanent, PRD §1.2) holds. The
   migration writes exactly what the note renders: x and size on the width
   ratio LOGICAL_W/(rw‖900), y through clamp(y·(LOGICAL_H/LEGACY_H), 0,
   LOGICAL_H − HIT_FLOOR), and stamps rw = LOGICAL_W, rh = LOGICAL_H, after
   which noteK ≡ 1 and the single path renders the stored values verbatim. The
   ratios agree by construction: on mobile LEGACY_H = 900·vh/vw, so the legacy
   y-ratio LOGICAL_H/LEGACY_H = vw/900 — precisely the width ratio — and
   min(LOGICAL_W/rw, LOGICAL_H/LEGACY_H) picks that same value; on wide
   LEGACY_H = LOGICAL_H, the ratio is 1, and B20's min-anchored renderScale
   keeps the note where it rendered. The scale fold mirrors rebaseNote:
   effScale before = (scale‖1)·widthRatio = scale after. The stored-y clause
   of B21/B32 ("never mutated") is waived for THIS write alone (B93).

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

// Module-scope layout state: the logical coordinate space's own variables and
// the squeeze pair. Written only from this region's layout math.
export let LOGICAL_W = REF_W;                // mobile: = vw, the sheet is the viewport (B32); wide: derived per layout (B20)
export let LOGICAL_H = REF_H;                // responsive: recomputed each layout to fill the viewport
export let LEGACY_H = REF_H;                 // the pre-B32 frame height on this device. Read ONLY
                                     // by migrateLegacyBoards (B93).
export let renderScale = 1;
let offX = 0, offY = 0;
export let calSqueeze = false;
let paneCollapsed = false;   // the All-Boards rail's collapsed face (B118)
const frameUi = {
  LOGICAL_W_TRUE: null,               // set only while squeezed

  /* Frame-reflow hook: applyFrame may need the surface renderers to re-run
     after a frame change. The renderers live in boards, and geometry must not
     import boards (cycle), so boards registers a callback here at init.
     Single writer, module-local. */
  frameReflow: null,
};
export function onFrameReflow(fn) { frameUi.frameReflow = fn; }


/* CAL_RAIL_W (B99): the collapsed calendar rail's unscaled width, reserved
   from the frame on wide at ALL times — the rail is standing furniture, the
   room's third column, so its width is removed exactly as the left rail's is,
   before any squeeze math. While the panel is expanded (calSqueeze)
   CAL_PANEL_W takes the rail's place — the panel expands FROM the rail, it
   doesn't add to it. */
const CAL_RAIL_W = 40;               // the collapsed rail (B99: 40px, right edge)
const CAL_PANEL_W = 320;             // unscaled CSS px the panel takes
export function applyLayout(vw, vh) {
  if (deferLayoutIfEditing()) return true;    // never move the board under a focused editor (B28)
  // The environment pass hands in the viewport IT read, so this frame and the
  // tier the pass applied come from one read of the room. A bare applyLayout()
  // (boot, the font swap's re-measure, the deferred frame landing on focusout)
  // still reads the live viewport.
  computeFrame(vw ?? window.innerWidth, vh ?? window.innerHeight);
  applyFrame();
  return false;                               // applied: nothing is held (B152's landing reads this)
}

/* The scale-to-fit half of applyLayout: chooses the frame. applyFrame
   publishes it. */
function computeFrame(vw, vh) {
  if (state.isWide) {
    // Wide (B20; desktop and tablet, B96): the rail takes PANE_W unscaled; the
    // sheet fills the rest. Min-anchored scale — neither logical dimension ever
    // drops below the 900×1000 reference, so mobile-placed notes always fit and
    // the top furniture (~880 units) never collides, at any window shape.
    // The calendar squeeze (R6): while the calendar panel is open the panel's
    // width is removed here, exactly as the left rail's is — the frame narrows,
    // the arrangement maps as a figure (B64), nothing is written. Per B99 the
    // collapsed rail's 40px is reserved whether or not the panel is open;
    // expanded, the panel takes the rail's place and its full width replaces
    // the 40.
    const calW = calSqueeze ? CAL_PANEL_W : CAL_RAIL_W;
    // B118: the left rail collapses to the calendar rail's own 40px — one
    // rail-width law, two rails — and the sheet fills what it frees.
    const paneW = paneCollapsed ? CAL_RAIL_W : PANE_W;
    renderScale = Math.min(vh / REF_H, (vw - paneW - calW) / REF_W);
    LOGICAL_H = vh / renderScale;
    LOGICAL_W = (vw - paneW - calW) / renderScale;
    frameUi.LOGICAL_W_TRUE = (calSqueeze || paneCollapsed)
      ? (vw - PANE_W - CAL_RAIL_W) / renderScale   // the resting frame the board returns to
      : null;
    offX = paneW;
    offY = 0;
    LEGACY_H = LOGICAL_H;            // wide geometry is unchanged by B32
  } else {
    // Mobile (B32): the sheet IS the viewport at scale 1 — uniform by
    // construction, so no letterbox and no distortion, and every declared px
    // is a real px.
    LOGICAL_W = vw;
    LOGICAL_H = vh;
    renderScale = 1;
    offX = 0;
    offY = 0;
    LEGACY_H = REF_W * vh / vw;      // the pre-B32 frame height here (B93)
  }
}

/* The application half of applyLayout: publish the frame computeFrame chose —
   the board's CSS vars, the sections' re-measure, each note's render
   coordinates, the links, and the registered reflow hook. */
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
  // which measures #list-rows inside it. Below desktop the CSS pins #list-view to
  // this; on desktop the value is unused (the overlay stays inset:0).
  el.listView.style.setProperty('--list-panel-h', listPanelH() + 'px');
  // Re-derive each note's on-sheet x, y AND size (one similarity ratio per
  // note, B64) and its decoupled hit area (physical size changed). The wrap
  // cap needs no re-derive here: (rw − x)/scale reads stored fields only, so
  // no layout change can move it (B64's restatement of B39) — it is written
  // at creation (makeNoteEl) and by the gestures that change its inputs
  // (rebaseNote, applyNoteScale, the drag).
  noteEls.forEach((node, id) => {
    const note = noteRec(id);
    if (note) {
      placeNote(node, note);
      setHitInset(node, note);
    }
  });
  if (selected) updateSelectionUI();
  updateLinks();                     // links ride the notes' new geometry (B91)
  // Capacity check: the per-page card budget is measured from the surface's
  // height, so a resize that changes it must re-render and re-paginate. The
  // re-render belongs to the BOARDS module (it owns the surface state), so
  // applyLayout fires a hook the boards register() fills in — this breaks the
  // geometry <-> boards import cycle at the root.
  if (frameUi.frameReflow) frameUi.frameReflow();
}

/* The Android soft keyboard opening fires a viewport resize (B28). The mobile
   sheet's height tracks the viewport, so recomputing there drags the page out
   from under the note being written and clips it off the bottom — the next tap
   lands on bare canvas, blurs the (now invisible) editor, and B8 discards the
   empty frame, which drops the keyboard, which resizes again. That is the
   flap. While an editor inside the board holds focus the layout is held still
   and the deferral remembered, so a genuine rotation or fold mid-edit is
   postponed rather than lost: commit-on-blur re-applies it. Desktop has no
   soft keyboard and is left unguarded (B19).

   The guard also protects stored geometry. y is frame-relative (B32), so an
   unguarded keyboard resize would move every note on screen — and a gesture
   grabbing one while the keyboard is up would rebase it, writing rh = the
   shrunken height into storage permanently. With one shared k (B64) a
   keyboard-shrunken height would also shrink x and SIZE: the whole board would
   flinch at every keyboard. This deferral is the only thing standing between
   the soft keyboard and all of that. Do not weaken it. */

/* B28's deferral, as one shared decision: while an editor inside the board
   holds focus a layout change is REMEMBERED, never applied — the held frame
   lands on focusout (interactions.js:onFocusOut). Every layout path routes
   through applyLayout, so the guard lives there rather than in each caller:
   the environment pass (a fold, a resize), a flip's squeeze/collapse
   (setCalSqueeze/setPaneCollapsed). Desktop has no soft keyboard and is left
   unguarded. */
export function deferLayoutIfEditing() {
  if (state.isDesktop || !editingInBoard()) return false;
  state.editVP.deferred = true;
  return true;
}

/* While a consolidated environment pass is in flight the squeeze/collapse
   setters must not lay out on their own — the pass applies ONE frame once the
   new tier and the rail width the flip changes are both in place. Standalone
   calls (the pane's collapse control, the calendar rail) still lay out. */
let envPass = false;
export function inEnvironmentPass(on) { envPass = on; }

function editingInBoard() {
  const a = document.activeElement;
  return !!(a && a.hasAttribute && a.hasAttribute('contenteditable') && el.board.contains(a));
}

/* The keyboard's arrival is deferred so the sheet holds still (B28); its
   departure PUTS THE NOTE AWAY (B80). The visual viewport shrinks as the
   keyboard opens and grows back as it retracts, so the same edit's own floor —
   the smallest height seen since focus — tells the two apart: any growth past
   it by KB_HIDE_SLOP is the keyboard leaving while the note still holds focus,
   and blur() runs the commit-on-blur path (focusout) that commits, deselects,
   and lands the deferred layout. state.editVP.floor only ever drops within an
   edit (reset to Infinity on focusout), so retraction measured against it
   crosses the threshold even when the browser animates the return in steps.

   A FOLD grows the visual viewport exactly as the keyboard's retraction does,
   so the height delta alone is not sufficient and the blur is gated on the
   retraction being real: the viewport's WIDTH is unchanged by this resize (a
   fold always changes width — that is what a fold is; the keyboard never does)
   and, where the engine reports it (Chromium/Android: navigator.virtualKeyboard),
   the virtual keyboard is not still up. Either leg
   failing means "not a retraction": defer, never blur. The comparison is
   against the width of the PREVIOUS resize of this edit, not against the
   floor's — folding back lands on the cover width the keyboard was up at, so a
   floor-relative compare would read the fold-back as a retraction.
   state.editVP.width is cleared with the floor on focusout so an edit never
   inherits the last one's width. */
function keyboardStillUp() {
  const vk = navigator.virtualKeyboard;
  return !!(vk && vk.boundingRect && vk.boundingRect.height > 0);
}

/* The resize TRIGGER: this owns the keyboard laws above and reports whether it
   CONSUMED the resize — a consumed resize holds the frame itself
   (state.editVP.deferred) or blurs, and never schedules a pass; anything else
   (desktop, or no editor in the board) is handed to the environment pass. */
export function onViewportResize() {
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  if (!state.isDesktop && editingInBoard()) {
    const w = vv ? vv.width : window.innerWidth;
    // Two listeners (window + visualViewport) carry ONE viewport change, so the
    // same size arriving twice is one change told twice — never a retraction.
    // Without this the repeat would read as the keyboard leaving and blur the
    // editor.
    if (w === state.editVP.width && h === state.editVP.height) return true;
    const widthMoved = w !== state.editVP.width;   // a width change is a fold, never a keyboard
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
  // The calendar squeeze (R6 clause 1): while the panel is open the frame is
  // narrowed, so a raw read would write squeezed-frame coordinates that shift
  // when the squeeze lifts. Un-map proportionally into the TRUE frame —
  // the frame the board returns to on close — so a grab's rebaseNote (the one
  // licensed write, B21) stamps where the user sees the note land in the room
  // it returns to. y is untouched (the squeeze is horizontal).
  return { x: frameUi.LOGICAL_W_TRUE ? x * (frameUi.LOGICAL_W_TRUE / LOGICAL_W) : x, y };
};

/* The calendar squeeze (R6): when the calendar panel is open on wide (desktop
   or tablet), the sheet is laid out with the panel's width removed from the
   viewport — the SAME mechanism B20 uses for the left rail, on the right edge.
   Every note's k changes with the frame, so the whole arrangement renders
   smaller and further left, exactly as B64's similarity law maps a frame
   change; nothing is written (P3 — the squeeze is a frame, not an edit). The
   TRUE frame is kept in frameUi.LOGICAL_W_TRUE while squeezed, and toLogical
   un-maps a drag's client point into it proportionally, so a grabbed note's
   rebaseNote writes TRUE-frame coordinates stamped rw/rh = the true frame (the
   inverse-transform write, R6's first clause) — the note lands permanently
   where the user sees it land, in the room the board returns to when the panel
   closes. On close the squeeze lifts and the board renders exactly where it
   was. Export ignores the squeeze entirely (exportX/exportY read storage; R6's
   second clause). Overlap during the squeeze is accepted (R6) — no
   auto-untangling. */
export function setCalSqueeze(on) {
  if (calSqueeze === on) return;
  calSqueeze = on;
  if (state.current && !envPass) applyLayout();
}

/* B118: the pane's collapse is the same mechanism pointed the other way — the
   resting frame reserves PANE_W, the collapsed face reserves the rail-width
   law's 40. While collapsed, LOGICAL_W_TRUE holds the resting (expanded)
   frame, so toLogical/rebaseNote un-map a drag into the room the board
   returns to on expand — the R6 discipline, mirrored. */
export function setPaneCollapsed(collapsed) {
  if (paneCollapsed === collapsed) return;
  paneCollapsed = collapsed;
  if (state.current && !envPass) applyLayout();
}

/* The similarity transform (B64) as one pure function of the note and its
   frame. note.rw/note.rh record the LOGICAL_W/LOGICAL_H the note's geometry
   was last written against; ONE uniform ratio k = min(W/rw, H/rh) maps x, y
   and size together, so a fold or rotation maps the arrangement as a figure:
   pairwise angles and distance ratios are preserved. min gives containment by
   construction (x ≤ rw ⇒ x·k ≤ W; same for y) with zero re-clamps. The figure
   anchors top-left with NO centering offset: each note carries its own rw/rh,
   so a centering term would differ per authoring cohort, and a grabbed note
   rebases to offset 0 while ungrabbed siblings kept a nonzero one — centering
   would re-shear exactly the arrangements this law preserves. Slack falls to
   the right/bottom as open canvas. Stored geometry is never mutated by a
   viewport change (B21/B32): render-time only, written back solely by the
   gestures that own writes (rebaseNote, at grab). k is never clamped —
   MIN/MAX_SCALE bound the *authored* scale at gesture time, not this frame
   mapping.

   The screen resolves it against LOGICAL_W/LOGICAL_H (noteK), the export
   against EXPORT_W/EXPORT_H (exportK): one LAW shared, not one number — a
   mixed-cohort board can relate its cohorts differently per frame, inherent to
   min-k (B64). No note reaching this function lacks rh: B93's boot migration
   adopts every rh-less (pre-B32) note onto this path before first paint. */
export const noteKFor = (n, frameW, frameH) =>
  Math.min(frameW / (n.rw || REF_W), frameH / n.rh);

export const noteK = (note) => noteKFor(note, LOGICAL_W, LOGICAL_H);
export const renderX  = (note) => note.x * noteK(note);
export const effScale = (note) => (note.scale || 1) * noteK(note);
export const renderY  = (note) => note.y * noteK(note);

/* A note's on-sheet seat — left, top, and the similarity's scale (B64). The
   one write the render paths (makeNoteEl, a surfaced echo), a frame change
   (applyFrame), and seatAllNotes make. The drag and resize tails write raw
   note.x/note.y and do not call it. Kept here, beside the three coordinates
   it writes, so no caller restates the transform. */
export function placeNote(node, note) {
  node.style.left = renderX(note) + 'px';
  node.style.top = renderY(note) + 'px';
  node.style.transform = 'scale(' + effScale(note) + ')';   // the similarity (B64)
}

export function rebaseNote(note) {
  // Fold the similarity ratio into the authored scale (B64): effScale before
  // equals note.scale after, so the grab is silent in position and size — and
  // with k ≡ 1 once rw/rh equal the live frame, every gesture (drag
  // footprints, pinch and resize scaling) runs in current-frame units
  // unmodified. The folded scale may leave [MIN_SCALE, MAX_SCALE]; the gesture
  // clamps stay widened to admit it (B40).
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
  // min-k, rw = LOGICAL_W can exceed the note's own rw·k whenever the height ratio
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

/* A note has no predetermined width (B39): its text wraps only at the sheet's
   right edge — (rw − x)/scale in authored units, stated directly (B64), not
   (LOGICAL_W − renderX)/effScale, which equals it only while position and size
   share the width ratio and would otherwise widen the cap whenever the height
   ratio binds, re-wrapping a cap-wide note across a fold. Frame-invariant:
   wrapping is identical on every device and in the PDF (exportNoteBox calls
   this very function), and containment still holds — renderX + cap·effScale =
   (x + (rw − x))·k = rw·k ≤ LOGICAL_W. Floored at NOTE_MIN_W so an
   edge-adjacent note stays a usable column rather than a zero-width sliver. */
export const noteMaxW = (note) =>
  Math.max(NOTE_MIN_W, ((note.rw || REF_W) - note.x) / (note.scale || 1));

/* The cap lives on the NOTE element (custom properties inherit, so .note-text
   keeps reading the var). Set it BEFORE anything measures offsetWidth — the
   cap changes what offsetWidth reports (setHitInset's constraint, B7). */
export function applyNoteWidth(node, note) {
  node.style.setProperty('--note-max-w', noteMaxW(note) + 'px');
}

/* Both ends of the sheet close the same way (B47, UIUX §3.1 / UIUX §3.2): a section
   sized by its content from a floor, whole units only, chosen here rather
   than in CSS because CSS cannot step a length by lines or rows.

   The band: rule-y = 14 + max(2, lines) x 19.5 + 8 — band-top, the tallest
   zone's line count at 15px/1.3, and the gap to the rule. The label budgets no
   height ABOVE the rule: it hangs BELOW the rule as a tab (B76), so the band
   closes at the content plus its gap. 61 at the two-line floor, 81 at three
   lines. */
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
   floor: 34 + max(2 x 44, sum of the rows' rendered heights) (UIUX §3.2, B73).
   Each .lot-item is content-sized (min-height 44, grows with wrapped text,
   never clipped itself — the clip lives on #lot-items), so summing their
   offsetHeight reads true content that both grows and shrinks; this is the
   lot's side of the same law the band already follows by scrollHeight
   (bandRuleY): measured, so wrapped lines are never cut off. Empty, one row
   and two single lines all draw the same two-row shelf — furniture, not a
   by-product of content. A canvas-protecting CEILING of half the sheet keeps a
   runaway lot from swallowing the page. Content past it is clipped. */
export const lotH = () => {
  let sum = 0;
  for (const node of lotEls.values()) sum += node.offsetHeight;
  return Math.min(
    LOT_HEAD + Math.max(LOT_FLOOR, Math.round(sum)),
    Math.round(LOGICAL_H * LOT_MAX_FRAC)
  );
};

/* The drilled list's slide-up panel rises to a third of the viewport, the board
   still behind it (B82, UIUX §10). Computed in JS and published as
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

/* UIUX §6/B7's law is not the note's alone: any board-space target expands its hit
   area to the floor without growing its visual frame. `k` is what the element
   draws at — one arithmetic, both callers. */
export function hitInset(node, k) {
  const physW = node.offsetWidth * k, physH = node.offsetHeight * k;   // logical x draw scale
  const floor = state.isDesktop ? HIT_FLOOR_DESKTOP : HIT_FLOOR;
  return Math.max(0, (floor - physW) / 2, (floor - physH) / 2) / (k || 1);
}

export function setHitInset(node, note) {
  // effScale x renderScale is what the note draws at.
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
