/* --- 7. Gesture recognizer ----------------------------------------------- */
// issue #182 module wiring — native ESM, no bundler (AGENTS.md).
import { ACTION_DELAY, CE, COPY, DBLCLICK_MS, LEAVE_MS, LONGPRESS_MS, MAX_SCALE, MIN_SCALE, MOVE_THRESHOLD } from './state.js';
import { NOTE_MIN_W, TOAST_HIDE_MS, UNDO_MS, el, state, uuid } from './state.js';
import { saveNow, scheduleSave } from './persistence.js';
import { LOGICAL_H, LOGICAL_W, applyLayout, applyNoteWidth, caretToEnd, effScale, noteMaxW, placeCaretAtPoint } from './geometry.js';
import { rebaseNote, renderX, renderY, setHitInset, toLogical, updateBoardGeometry } from './geometry.js';
import { applyCompleteA11y, boardLinks, clearLink, linkSource, lotEls, makeLotEl, makeNoteEl, noteEls } from './render.js';
import { reflectToolbarFlip, removeLinksForNote, runNoteToolbarAction, syncViewTitle, toggleLink, updateLinks, updateNoteToolbar } from './render.js';
import { menuOpen, menuReturnFocus, openMenuFor } from './menus.js';
import { renderPane, updateActiveCardTitle, writeThroughRequirements } from './boards.js';

// One recognizer over the board. Targets: note | anchor | lot-item | lot | canvas.
export const pointers = new Map();          // pointerId -> {x,y,startX,startY}
export let g = null;                        // active gesture context

/* The anchors and, since B91, notes carry a long-press menu (mobile) — the
   anchor's is the board's own menu (All boards · Export, B84/B75); the note's is
   a single item, Link (issue #142). Notes had lost their long-press menu when
   they gained the on-select toolbar (B84); B91 revives it as the home for
   inter-note RELATIONAL actions (Link), kept distinct from the toolbar's per-note
   STATE actions (Complete/Highlight/Copy/Delete) — so the two planes don't
   compete. Desktop reaches the note's Link menu by right-click instead (its own
   contextmenu listener, §10); the lot's mobile item menu is still gone (accepted
   gap — desktop lot rows keep their inline actions). The creation surfaces —
   bare canvas and the lot background — carry no menu: they have no item to act
   on, so no timer is armed and the press stays a pending tap (hold as long as
   you like on empty paper and the release still captures a note; B5). */
const HAS_MENU = new Set(['note']);   // anchors lost theirs to B92 (issue #140)

function classifyTarget(target) {
  // Selection chrome first: action buttons (notes and lot rows share .sel-btn),
  // then the resize frame — both must win over the elements beneath them.
  const selBtn = target.closest('.sel-btn');
  if (selBtn) return { type: 'sel-btn', node: selBtn };
  if (target.closest('#selection')) return { type: 'sel-frame', node: selUi.selEl };
  // The board-action row (B83) needs no branch here: its tabs are native
  // buttons and onPointerDown returns before classify runs for anything inside
  // #board-actions (the #lot-menu passthrough's precedent), so the recognizer
  // never sees them and their own clicks fire.
  // The note's own action toolbar (B84): setPointerCapture retargets the native
  // click, so — exactly like .sel-btn above — the recognizer must claim these
  // buttons before the press falls through to the note beneath them.
  const tbBtn = target.closest('.note-tb-btn');
  if (tbBtn) return { type: 'note-tb-btn', node: tbBtn };
  const note = target.closest('.note');
  if (note) return { type: 'note', node: note };
  const lotItem = target.closest('.lot-item');
  if (lotItem) return { type: 'lot-item', node: lotItem };
  const anchor = target.closest('.anchor');
  if (anchor) return { type: 'anchor', node: anchor };
  if (target.closest('#lot')) return { type: 'lot', node: el.lot };
  return { type: 'canvas', node: el.board };
}


/* Presses the gesture recognizer must not own (early-return guards of
   onPointerDown, verbatim): the one-press menu dismissal (B30), the native
   buttons of the All-Boards grid and the board-action tabs (issue #112/B74,
   #126/B83), secondary/middle buttons (issue #55), and text editing. */
function pressIsInert(e) {
  if (state.swallowTap) { state.swallowTap = false; return true; }  // this press only dismissed a menu (B30)
  // The All-Boards grid (issue #112 / B74) is drawn inside #lot, so its presses
  // bubble here — but it is a menu, not the board: let its buttons receive their
  // own native clicks rather than the recognizer swallowing them as lot capture.
  if (e.target.closest('#lot-menu')) return true;
  // The board-action tabs (issue #126, B83) are native buttons too: the same
  // passthrough lets their clicks fire (All Boards / Export) with no gesture
  // armed and no preventDefault, so no note is captured under them. Presses on
  // the row's pointer-events:none frame never reach here (they hit the canvas
  // behind it), so only a real tab press returns — bare canvas still captures.
  if (e.target.closest('#board-actions')) return true;
  // Secondary/middle presses are inert to the recognizer (issue #55): a
  // right-click must reach the contextmenu listener with no gesture context
  // armed, or the press underneath the menu would drag/select/create. The
  // preventDefault stops the press from natively focusing a tabindexed note —
  // focusin's Tab-selects rule would collapse a multi-selection before the
  // contextmenu listener could act on it. contextmenu still fires: it is not
  // a compatibility mouse event, so canceling pointerdown leaves it alone.
  if (e.button !== 0) { e.preventDefault(); return true; }
  return isEditing(e.target);                      // let text editing receive taps/caret
}

function onPointerDown(e) {
  if (pressIsInert(e)) return;
  // Past that guard the recognizer owns this press outright, so the browser's
  // compatibility mouse events are suppressed at their source (B27). They are
  // dispatched after pointerup and, because setPointerCapture retargets them
  // to #board — which cannot hold focus — their default action pulls focus out
  // of the editor the tap just opened. The note is then empty on blur and B8
  // discards it: the tap that appeared to do nothing. Every focus and caret
  // placement on this path is explicit, so nothing is lost by suppressing them.
  e.preventDefault();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY });

  // Second pointer on a note in progress → pinch — but never on a group drag
  // (issue #55): scaling is single-selection only, and startPinch knows one
  // note. The extra pointer is simply ignored and the group drag continues
  // under the first (a touchscreen laptop can be desktop-mode, B19).
  if (pointers.size === 2 && g && g.target.type === 'note' && !g.group) {
    startPinch();
    return;
  }
  if (pointers.size > 1) return;                   // ignore extra pointers otherwise

  const target = classifyTarget(e.target);
  g = {
    target, pointerId: e.pointerId,
    startX: e.clientX, startY: e.clientY,
    shift: e.shiftKey,                             // multi-select modifier (issue #55)
    mode: 'pending', longPressed: false, moved: false,
    note: target.type === 'note' ? state.current.notes.find(n => n.id === target.node.dataset.id) : null,
  };
  // Resize is single-selection only, by design (issue #55): with two or more
  // selected the CSS hides the grip, and this guard keeps the gesture honest
  // even if a stray hit reaches the frame.
  if (state.isDesktop && target.type === 'sel-frame' && selected && selected.kind === 'note' &&
      multiSel.size <= 1) {
    startResize(e);
  }
  try { el.board.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }

  if (!state.isDesktop && HAS_MENU.has(target.type)) {   // desktop removes click-and-hold entirely (issue #4)
    g.longPressTimer = setTimeout(() => {
      if (!g || g.mode !== 'pending' || g.moved) return;
      g.longPressed = true;
      if (navigator.vibrate) navigator.vibrate(10);
      openMenuFor(target, g.startX, g.startY);
    }, LONGPRESS_MS);
  }
}

function onPointerMove(e) {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX; p.y = e.clientY;

  if (g && g.mode === 'pinch') { updatePinch(); return; }
  if (g && g.mode === 'resize') { if (g.pointerId === e.pointerId) updateResize(e); return; }
  if (!g || g.pointerId !== e.pointerId) return;

  const dx = e.clientX - g.startX, dy = e.clientY - g.startY;
  if (!g.moved && Math.hypot(dx, dy) >= MOVE_THRESHOLD) {
    g.moved = true;
    clearTimeout(g.longPressTimer);
    if (g.target.type === 'note' && !g.longPressed) startDrag();
    else g.mode = 'cancelled';                      // canvas/anchor/lot don't drag; board never pans
  }
  if (g.mode === 'drag') updateDrag(e);
}

function onPointerUp(e) {
  pointers.delete(e.pointerId);
  if (!g) return;

  if (g.mode === 'pinch') {
    if (pointers.size < 2) endPinch();
    return;
  }
  if (g.pointerId !== e.pointerId) return;
  clearTimeout(g.longPressTimer);

  if (g.mode === 'drag') { endDrag(); }
  else if (g.mode === 'resize') { endResize(); }
  else if (g.mode === 'pending' && !g.longPressed && !g.moved) { handleTap(g.target, e.clientX, e.clientY, g.shift); }
  g = null;
}

/* Teardown for a mode flip (issue #182, B'): the entry's media-query listener
   used to cancel an in-flight gesture inline by writing `g` directly. A module
   split cannot write an imported bare `let` (imported bindings are read-only),
   so the one cross-module write of `g` moves here, where `g` lives. The entry
   calls cancelGesture() instead. Same behavior, same order: kill the long-press
   timer, drop the gesture. */
export function cancelGesture() {
  if (g) { clearTimeout(g.longPressTimer); g = null; }
}

/* --- 8. Editing, drag, pinch, z-order ------------------------------------ */
/* Editing means an editor that actually holds focus, not merely one wearing the
   attribute. The attribute alone can outlive its edit — a focus() the browser
   refused never fires focusout, so nothing strips it — and an unfocused husk
   answering yes here would swallow every pointerdown over it at source: an
   invisible dead patch of paper. Requiring focus makes such a node an ordinary
   note again, which the next tap focuses and the following blur discards. */
export function isEditing(node) {
  const ed = node.closest && node.closest('[contenteditable]');
  return !!(ed && document.activeElement === ed);
}

/* Commit an open editor before a tap acts on an item (issue #54): the
   recognizer suppressed the native blur (B27), so the commit is explicit.
   Returns true when the tap is spent — it landed on the edited element's own
   hit collar, where the click only dismisses (edit and selection are mutually
   exclusive, B22). One helper, one rule, every item branch. */
function commitOpenEditor(node) {
  const a = document.activeElement;
  if (!isEditing(a)) return false;
  const own = !!(node && node.contains(a));
  a.blur();
  return own;
}

/* A consequence commits on release, with no latency (B81). What survives from
   B18's window is only its drop-guard: the action runs now, and a second tap
   inside the guard is dropped, not queued — an impatient double-tap must not
   delete twice or complete-then-uncomplete. First tap wins (B18d, kept). The
   instant result is its own acknowledgment; there is nothing to fill for 400ms,
   so B18a/b's `.tapped` beat and B18c's ghost are retired. Navigation (menu
   open, swap, edit-entry) and capture self-heal, so they take no guard at all —
   they call their work directly. */
const actionUi = { pendingAction: null };

export function commitAction(fn) {
  if (actionUi.pendingAction) return;
  fn();
  actionUi.pendingAction = setTimeout(() => { actionUi.pendingAction = null; }, ACTION_DELAY);
}

/* No blanket actionUi.pendingAction guard here (issue #13): commitAction carries its own
   drop-guard, so B18(d) holds exactly where a consequence fires — while inert
   taps (select, deselect) and navigation stay live regardless. */
function handleTap(target, x, y, shift) {
  // Pending link (issue #142, B91) consumes any tap while a source is armed —
  // see resolvePendingLink below. The tap must not select, edit or create
  // underneath it.
  if (resolvePendingLink(target)) return;
  switch (target.type) {
    case 'sel-btn': tapLotButton(target); break;
    case 'note-tb-btn': tapNoteToolbar(target); break;   // B84 (keyboard path too, below)
    case 'sel-frame': break;           // a motionless click on the ring does nothing
    case 'canvas': tapCanvas(x, y); break;
    case 'lot': tapLot(x, y); break;
    case 'note': tapNote(target, x, y, shift); break;
    case 'lot-item': tapLotItem(target, x, y); break;
    case 'anchor': tapAnchor(target, x, y); break;       // edit-entry is instant on both (B27, B81)
  }
}

/* B91 pending-link pre-check (issue #142): while a source note is armed, the
   next tap resolves it — a DIFFERENT note is linked, or unlinked if the pair
   is already linked (toggle). Anything else — empty canvas, the lot, an
   anchor, the source note itself — cancels. Either way the tap is CONSUMED
   (returns true), so no note is created, selected or edited underneath. The
   write is a consequence, so it and its mode-exit run together inside
   commitAction's drop-guard (B81); the cancel commits nothing, so it runs raw. */
function resolvePendingLink(target) {
  if (linkSource === null) return false;
  const src = linkSource;
  if (target.type === 'note' && target.node.dataset.id !== src) {
    const dst = target.node.dataset.id;
    commitAction(() => { toggleLink(src, dst); clearLink(); });
  } else {
    clearLink();
  }
  return true;
}

/* Lot rows only now (B84): notes act through their own top-edge toolbar
   (tapNoteToolbar). Every button commits on release through the B81
   drop-guard; Copy of a completed row is allowed — the record still holds
   the text (issue #59). */
function tapLotButton(target) {
  const lotRow = target.node.closest('.lot-item');
  if (!lotRow) return;
  const isDel = target.node.classList.contains('sel-delete');
  const isCopy = target.node.classList.contains('sel-copy');
  commitAction(() => {
    const item = state.current.parkingLot.find(i => i.id === lotRow.dataset.id);
    if (!item) return;
    if (isCopy) copyText(item.text);
    else if (isDel) { clearSelection(); deleteLot(lotRow); }
    else {
      if (item.state === 'complete') restoreLot(lotRow); else completeLot(lotRow);
      updateSelectionUI();
    }
  });
}

function tapNoteToolbar(target) {
  runNoteToolbarAction(target.node);
}

/* Creation surface (issues #12/#41/#54). Guard order is load-bearing:
   click-away-while-editing FIRST, then the selected check (#54). */
function tapCanvas(x, y) {
  // Click-away while editing commits and only dismisses (issue #54). This
  // guard is mode-independent and must come BEFORE the selected check:
  // while editing nothing is selected (edit paths clear selection first),
  // and the recognizer suppressed the native blur (B27), so without it a
  // desktop click fell through and created a note on top of the dismissal.
  // The NEXT click creates.
  if (isEditing(document.activeElement)) { document.activeElement.blur(); return; }
  // Creation surfaces deselect first (issue #12 desktop / #41 mobile):
  // with a selection active a tap only dismisses; capture is only primary
  // when nothing is selected or being edited.
  if (state.isDesktop && selected) { clearSelection(); return; }
  if (!state.isDesktop && engaged) { clearEngaged(); return; }   // mobile: tap-away deselects; a further tap creates (issue #136, B90)
  createNote(x, y);                // capture is instant on both (B27, B81)
}

/* Creation surface, same #54 law as tapCanvas (see above). */
function tapLot(x, y) {
  if (isEditing(document.activeElement)) { document.activeElement.blur(); return; }
  if (state.isDesktop && selected) { clearSelection(); return; }   // creation surface too
  if (!state.isDesktop && engaged) { clearEngaged(); return; }   // mobile: tap-away deselects (issue #136, B90)
  createLotItem();                 // capture is instant on both (B27, B81)
}

/* Desktop: click selects (inert, instant); a second click within the pairing
   window edits with the caret at the end (issue #4); shift-click toggles
   multi-selection (issue #55). Mobile: two-tap grammar (issue #136, B90) —
   a first tap ENGAGES (toolbar shows, no keyboard, no write, B22); a second
   tap on the already-engaged active note EDITS, synchronously inside
   pointerup so the keyboard rises (B27a), caret at the END. A completed
   note never edits (§4.3), so it only ever engages. */
function tapNote(target, x, y, shift) {
  const node = target.node;
  const note = state.current.notes.find(n => n.id === node.dataset.id);
  if (!note) return;
  if (state.isDesktop) {
    // An open editor commits before the click acts (issue #54); on the
    // edited note's own collar the click only dismisses.
    if (commitOpenEditor(node)) return;
    // Shift-click toggles multi-selection membership (issue #55) and
    // never pairs into the double-click window.
    if (shift) {
      toggleInSelection(note.id);
      tapUi.lastTap = { key: null, t: 0 };
      return;
    }
    // Click selects (instant, inert); a second click within the pairing
    // window edits with the caret at the end (issue #4). Completed notes
    // never edit — same guard as the mobile tap path.
    const key = 'note:' + note.id, now = Date.now();
    if (selected && selected.kind === 'note' && selected.id === note.id &&
        tapUi.lastTap.key === key && now - tapUi.lastTap.t < DBLCLICK_MS) {
      tapUi.lastTap = { key: null, t: 0 };
      if (note.state === 'active') {
        clearSelection();
        surfaceNote(node);
        editText(node.querySelector('.note-text'));   // no coords → caret at end
      }
    } else {
      selectNote(note.id);
      tapUi.lastTap = { key, t: now };
    }
    return;
  }
  // Mobile two-tap grammar (issue #136, B90): a first tap ENGAGES the note —
  // its toolbar shows (via the `.engaged` class), with no focus, no keyboard,
  // and no write (B22, so no surfaceNote on this tap). A second tap on the
  // already-engaged active note EDITS it, synchronously inside pointerup so the
  // keyboard rises (B27a), caret at the END (no coords → caretToEnd, overriding
  // B14 on mobile; the desktop precedent is B26). A completed note never edits
  // (§4.3), so it only ever engages.
  if (isEditing(document.activeElement)) document.activeElement.blur();
  if (note.state === 'active' && engaged === note.id) {
    clearEngaged();
    surfaceNote(node);                                      // editing raises it (B27)
    editText(node.querySelector('.note-text'));             // no coords → caret at end
  } else {
    setEngaged(node);
  }
}

/* Same #54 commit-first guard as the note branch. Lot rows stay
   single-select (issue #55) — no shift path here, by design. */
function tapLotItem(target, x, y) {
  const node = target.node;
  const item = state.current.parkingLot.find(i => i.id === node.dataset.id);
  if (!item) return;
  if (state.isDesktop) {
    if (commitOpenEditor(node)) return;
    const key = 'lot:' + item.id, now = Date.now();
    if (selected && selected.kind === 'lot' && selected.id === item.id &&
        tapUi.lastTap.key === key && now - tapUi.lastTap.t < DBLCLICK_MS) {
      tapUi.lastTap = { key: null, t: 0 };
      if (item.state === 'active') {
        clearSelection();
        editText(node.querySelector('.lot-text'));    // no coords → caret at end
      }
    } else {
      selectLot(item.id);
      tapUi.lastTap = { key, t: now };
    }
    return;
  }
  if (item.state === 'active') editText(node.querySelector('.lot-text'), x, y);  // B27
}

function tapAnchor(target, x, y) {
  editText(target.node, x, y);      // edit-entry is instant on both (B27, B81)
}

/* Enter inline edit on any editable text node. The Requirements anchor's
   pre-edit text is snapshotted here — the single funnel every edit entry
   (tap and focusin alike) passes through — because the live onInput path
   overwrites state.current on every keystroke and the write-through commit
   (B106) needs the text the reader started from to tell a deleted span line
   from an edited one. */
let reqBefore = null;
function enableEditing(textNode) {
  if (textNode.classList && textNode.classList.contains('anchor') &&
      textNode.dataset.anchor === 'requirements') {
    reqBefore = state.current.requirements || '';
  }
  textNode.setAttribute('contenteditable', CE);
}
function disableEditing(textNode) {
  textNode.removeAttribute('contenteditable');
}
function editText(textNode, clientX, clientY) {
  enableEditing(textNode);
  textNode.focus();
  if (clientX != null) placeCaretAtPoint(textNode, clientX, clientY);
  else caretToEnd(textNode);
}

/* Create a note in edit mode at the tapped point (PRD §6.2).

   The focus check closes B8's one gap (B31). Commit-on-blur is what discards
   an empty frame, and blur presupposes focus: if focus is refused the frame
   never commits, never discards, and persists as a husk that is invisible
   (.note-text:empty) yet keeps its 44 px hit collar. Creation therefore
   verifies its own premise in the same breath. It is a no-op whenever focus
   lands, which — since the whole capture path now runs inside the gesture
   (B27) — is the ordinary case. */
function createNote(clientX, clientY) {
  const pt = toLogical(clientX, clientY);
  // x is floored NOTE_MIN_W back from the right edge (B84): a new note is at
  // least a toolbar wide, so its left edge must leave that much room or the
  // frame would spill off the sheet. y keeps its 4px keep-on-page clamp.
  const note = { id: uuid(), text: '', x: clamp(pt.x, 0, Math.max(0, LOGICAL_W - NOTE_MIN_W)),
                 y: clamp(pt.y, 0, LOGICAL_H - 4), rw: LOGICAL_W, rh: LOGICAL_H,
                 scale: 1.0, state: 'active' };
  state.current.notes.push(note);                          // top of z-order
  const node = makeNoteEl(note);
  el.board.appendChild(node);
  const text = node.querySelector('.note-text');
  enableEditing(text); text.focus(); caretToEnd(text);
  if (document.activeElement !== text) removeNoteSilently(note, node);
}

function createLotItem() {
  const item = { id: uuid(), text: '', state: 'active' };
  state.current.parkingLot.push(item);
  const node = makeLotEl(item);
  el.lotItems.appendChild(node);
  updateBoardGeometry();               // the shelf follows its rows (UIUX §3.2)
  const text = node.querySelector('.lot-text');
  enableEditing(text); text.focus(); caretToEnd(text);
  if (document.activeElement !== text) removeLotSilently(item, node);
}

/* Commit-on-blur for every editable region; empty new notes/items are discarded. */

/* Keyboard/AT users focus a region → enter edit. The pointer path owns taps, so
   auto-edit only when no pointer gesture is in control (otherwise a tabindexed
   note would open the keyboard on pointerdown before drag/long-press resolve). */

/* Desktop keyboard (additive, issue #4 "mnk"): inert while the menu is open —
   menuKeyHandler owns Escape/Tab/arrows there, and Delete must not destroy the
   selection underneath an open menu (issue #10). */

/* Live growth = capture feedback; debounced persistence (PRD §4 writes). */

function commitNote(node) {
  const note = state.current.notes.find(n => n.id === node.dataset.id);
  if (!note) return;
  note.text = node.querySelector('.note-text').textContent;
  if (note.text.trim().length === 0) { removeNoteSilently(note, node); return; }  // no empty frames ever
  saveNow();
}
function removeNoteSilently(note, node) {
  if (selected && selected.kind === 'note' && selected.id === note.id) clearSelection();
  else dropFromSelection(note.id);     // set hygiene for a non-primary member (issue #55)
  const i = state.current.notes.indexOf(note);
  if (i >= 0) state.current.notes.splice(i, 1);
  node.remove(); noteEls.delete(note.id);
  // A husk discard takes its links with it — emptying a note deletes it (B8), and
  // deleting a note deletes its links (issue #142, B91). Silent, so no Undo.
  if (removeLinksForNote(note.id).length) updateLinks();
  saveNow();
}
function commitLot(node) {
  const item = state.current.parkingLot.find(i => i.id === node.dataset.id);
  if (!item) return;
  item.text = node.querySelector('.lot-text').textContent;
  if (item.text.trim().length === 0) { removeLotSilently(item, node); return; }
  saveNow();
}
function removeLotSilently(item, node) {
  if (selected && selected.kind === 'lot' && selected.id === item.id) clearSelection();
  const i = state.current.parkingLot.indexOf(item);
  if (i >= 0) state.current.parkingLot.splice(i, 1);
  node.remove(); lotEls.delete(item.id);
  updateBoardGeometry();               // the shelf follows its rows (UIUX §3.2)
  saveNow();
}
function commitAnchor(node) {
  state.current[node.dataset.anchor] = node.textContent;
  node.classList.toggle('filled', !!node.textContent.length);
  if (state.isDesktop && node.dataset.anchor === 'title') renderPane(); // reconcile the date line
  if (node.dataset.anchor === 'requirements' && state.current.cal) {
    // The mirror's reverse direction (issue #154, B106): this commit IS the
    // write-through — not a timeout beside it (B81's commit-on-release).
    writeThroughRequirements(state.current, reqBefore);
    reqBefore = null;
  }
  updateBoardGeometry();      // the band follows its zones (B47), the handle its card (B65)
  saveNow();
}

/* Drag (PRD §6.3): free overlap, no snap, clamp to page bounds only. */

/* Group drag (issue #55): grabbing a MEMBER of a multi-selection moves every
   member by the same delta. Only the grabbed note surfaces (in startDrag) —
   the others keep their z-order; every member wears .pressed. Grabbing a
   non-member falls through to the single path, which collapses the set
   (selectNote below) — today's behavior. */
function collectGroupMembers(note, startLogical) {
  g.group = [];
  for (const id of selectedNoteIds()) {
    const n = state.current.notes.find(m => m.id === id);
    const memberNode = noteEls.get(id);
    if (!n || !memberNode) continue;
    // Per-member rebase — the one licensed grab-time write (B21), which
    // with B40 also folds each member's scale multiplier; visually silent.
    rebaseNote(n);
    const fw = memberNode.offsetWidth * n.scale, fh = memberNode.offsetHeight * n.scale;
    g.group.push({
      note: n, node: memberNode, x0: n.x, y0: n.y,
      // Per-member bounds, widened to admit the grab position exactly as
      // the single path below (B40). Members hitting different clamps can
      // compress the group's relative geometry at the sheet edge — accepted
      // (B41): the alternative is a note the group can never park flush.
      minX: Math.min(0, n.x), maxX: Math.max(n.x, Math.max(0, LOGICAL_W - fw)),
      minY: Math.min(0, n.y), maxY: Math.max(n.y, Math.max(0, LOGICAL_H - fh)),
    });
    memberNode.classList.add('pressed');
  }
  g.groupX0 = startLogical.x; g.groupY0 = startLogical.y;
  setSelectionHidden(true);
}

function startDrag() {
  if (linkSource !== null) clearLink();   // dragging a note exits link mode (issue #142, B91)
  g.mode = 'drag';
  g.target.node.classList.add('pressed');
  surfaceNote(g.target.node);
  const note = g.note;
  const startLogical = toLogical(g.startX, g.startY);
  // Group drag (issue #55): grabbing a MEMBER of a multi-selection moves every
  // member by the same delta. Only the grabbed note surfaces (above) — the
  // others keep their z-order; every member wears .pressed. Grabbing a
  // non-member falls through to the single path, which collapses the set
  // (selectNote below) — today's behavior.
  if (state.isDesktop && multiSel.size > 1 && multiSel.has(note.id)) {
    collectGroupMembers(note, startLogical);
    return;
  }
  rebaseNote(note);                  // grab math runs in current-frame units (issue #15)
  if (state.isDesktop) { selectNote(note.id); setSelectionHidden(true); }
  g.grabDX = startLogical.x - note.x;
  g.grabDY = startLogical.y - note.y;
  // Outer x range, fixed once and widened to include the grab position (B40):
  // a cross-frame note can arrive bigger than the sheet or past its edge, and
  // a plain [0, max(0, sheet − foot)] range would teleport it on the first
  // move — the visually-silent-grab promise broken by its own clamp. Since
  // issue #53 the footprint can change mid-drag (moving right tightens the
  // edge cap and the text rewraps narrower and taller), so the x bound admits
  // the narrowest the note can become — the NOTE_MIN_W floor, or its whole
  // footprint if that is already narrower — and y takes no fixed upper bound
  // at all: settleDragFoot derives it per move from the measured height, less
  // dragOverY, the bottom overhang the grab itself admitted.
  const node = g.target.node;
  const footW = node.offsetWidth * note.scale, footH = node.offsetHeight * note.scale;
  g.dragMinX = Math.min(0, note.x);
  g.dragMaxX = Math.max(note.x,
    Math.max(0, LOGICAL_W - Math.min(footW, NOTE_MIN_W * note.scale)));
  g.dragMinY = Math.min(0, note.y);
  g.dragOverY = Math.max(0, note.y + footH - LOGICAL_H);
  // Reflow-guard caches (issue #53): the cap the node is wearing right now
  // (the grab rebase re-asserted it — under B64's min-k the rebase can widen
  // the cap, so rebaseNote writes the var before anything here measures) and
  // the size measured under it. settleDragFoot skips the layout-forcing
  // write+read while these prove the cap cannot bind.
  g.dragCap = noteMaxW(note);
  g.dragW = node.offsetWidth;
  g.dragH = node.offsetHeight;
}

/* Shared tail of every drag move and the drop (issue #53): cap at the current
   x, measure the rewrapped footprint, keep it on the sheet.
   - x: a rewrapped foot that still overhangs means the cap was floored at
     NOTE_MIN_W, so pulling x back to the edge leaves the applied cap exact
     (max(NOTE_MIN_W, foot/scale) = NOTE_MIN_W) — the narrower-cap → rewrap →
     smaller-foot loop converges in this one pass, at worst at
     x = LOGICAL_W − NOTE_MIN_W·scale (the note is rebased: effScale ≡ scale).
   - y: the rewrap changes the HEIGHT too, so the bottom bound comes from the
     live measure — plus dragOverY, so an oversized cross-frame arrival (B40)
     keeps its admitted overhang instead of teleporting; only overhang this
     drag's own rewrap creates is pulled back onto the sheet.
   The var write + offsetWidth read force a synchronous layout on a path that
   runs per pointermove, so both are skipped while the cap provably cannot
   bind: the note sits at its natural width below the applied cap, and the new
   cap stays at or above that width. The drop passes force — the committed
   note must wear the exact cap, never the guard's stale one. */
function settleDragFoot(note, node, force) {
  const cap = noteMaxW(note);
  if (force || g.dragW > g.dragCap - 1 || cap < g.dragW) {
    applyNoteWidth(node, note);
    g.dragCap = cap;
    g.dragW = node.offsetWidth;
    g.dragH = node.offsetHeight;
  }
  const footW = g.dragW * note.scale, footH = g.dragH * note.scale;
  if (note.x + footW > LOGICAL_W) note.x = Math.max(g.dragMinX, LOGICAL_W - footW);
  note.y = Math.min(note.y, Math.max(g.dragMinY, LOGICAL_H - footH + g.dragOverY));
  node.style.left = note.x + 'px';
  node.style.top = note.y + 'px';
  updateLinks();                     // a dragged note's links follow it live (B91)
}

function updateDrag(e) {
  const pt = toLogical(e.clientX, e.clientY);
  if (g.group) {
    // One delta for the whole group, clamped per member (issue #55).
    const dx = pt.x - g.groupX0, dy = pt.y - g.groupY0;
    for (const m of g.group) {
      m.note.x = clamp(m.x0 + dx, m.minX, m.maxX);
      m.note.y = clamp(m.y0 + dy, m.minY, m.maxY);
      m.node.style.left = m.note.x + 'px';
      m.node.style.top = m.note.y + 'px';
    }
    updateLinks();                   // group members' links follow too (B91)
    return;
  }
  const note = g.note, node = g.target.node;
  note.x = clamp(pt.x - g.grabDX, g.dragMinX, g.dragMaxX);
  note.y = Math.max(g.dragMinY, pt.y - g.grabDY);   // upper bound lives in the settle
  settleDragFoot(note, node, false);
}
function endDrag() {
  if (g.group) {
    // One write for the whole group (issue #55). The drag held grab-time
    // bounds, so no member overhangs; at the drop each settles onto the exact
    // cap for its resting x (issue #53) — never tighter than what the clamp
    // admitted, so nothing jumps, and a leftward member may re-widen.
    for (const m of g.group) {
      applyNoteWidth(m.node, m.note);
      setHitInset(m.node, m.note);
      m.node.classList.remove('pressed');
    }
    g.target.node.classList.remove('pressed');
    saveNow();
    updateLinks();                   // final settle: links land on the dropped notes (B91)
    if (state.isDesktop) updateSelectionUI();
    return;
  }
  const note = g.note, node = g.target.node;
  // One final, forced settle at the resting x before the write. Legal under
  // B17: the re-clamp runs inside the gesture, which owns its writes — B17
  // forbids viewport re-clamps of committed positions only.
  settleDragFoot(note, node, true);
  setHitInset(node, note);           // the drag can have rewrapped the note (issue #53)
  node.classList.remove('pressed');
  saveNow();
  reflectToolbarFlip(node, note);    // a drop near the sheet top flips the row (B84)
  if (state.isDesktop) updateSelectionUI();  // reposition + unhide at the drop point
}

/* Pinch (PRD §6.3 / UIUX §5): transform scale only, clamp 0.5–2.0 (bounds
   widen to admit a folded cross-frame scale, B40), transform-origin top-left
   so stored x,y stays truthful and the note doesn't drift; re-clamp position
   if the grown footprint exits the page. */
function startPinch() {
  clearTimeout(g.longPressTimer);
  if (g.mode === 'drag') g.target.node.classList.remove('pressed');
  const pts = [...pointers.values()];
  g.mode = 'pinch';
  rebaseNote(g.note);                // grab math runs in current-frame units (issue #15)
  g.startDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
  g.startScale = g.note.scale;
  g.target.node.classList.add('pressed');
}
/* Shared tail of pinch and the desktop frame-drag resize: apply the clamped
   scale, re-clamp the footprint into the page, refresh the hit area. The note
   was rebased at grab, so note.x is current-frame and needs no renderX here. */
function applyNoteScale(note, node, scale) {
  note.scale = scale;
  node.style.transform = 'scale(' + scale + ')';
  // Scale changes the unscaled cap — (LOGICAL_W − x)/scale — so re-derive the
  // width var before offsetWidth is read (issue #53): growing a note near the
  // edge rewraps its text narrower instead of pushing it off the sheet.
  applyNoteWidth(node, note);
  const footW = node.offsetWidth * scale, footH = node.offsetHeight * scale;
  // A footprint can exceed the sheet only via a folded cross-frame scale
  // (B40); there the old [0, max(0, sheet − foot)] range degenerates to [0,0]
  // and pins the note to the corner. Min/max of the same pair inverts the
  // constraint instead — sheet-inside-note where note-inside-sheet is
  // impossible. For a fitting note this is the old clamp unchanged.
  note.x = clamp(note.x, Math.min(0, LOGICAL_W - footW), Math.max(0, LOGICAL_W - footW));
  note.y = clamp(note.y, Math.min(0, LOGICAL_H - footH), Math.max(0, LOGICAL_H - footH));
  node.style.left = note.x + 'px';
  node.style.top = note.y + 'px';
  setHitInset(node, note);
  updateLinks();                     // a scaled note's links track its new centre (B91)
}

/* The widened gesture clamp (issue #57, B40): bounds admit the start value, so
   a folded cross-frame scale outside [MIN_SCALE, MAX_SCALE] never snaps at
   gesture start — yet it can always be scaled back into the authored range,
   and never further out. Shared by pinch and frame-drag resize (B22). */
const gestureScale = (start, f) =>
  clamp(start * f, Math.min(MIN_SCALE, start), Math.max(MAX_SCALE, start));

function updatePinch() {
  const pts = [...pointers.values()];
  if (pts.length < 2) return;
  const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  applyNoteScale(g.note, g.target.node, gestureScale(g.startScale, dist / g.startDist));
}
function endPinch() {
  if (g) { g.target.node.classList.remove('pressed'); saveNow(); }
  g = null;
}

/* Z-order: last-touched note to the top (end of array + end of DOM). */
function surfaceNote(node) {
  const id = node.dataset.id;
  const note = state.current.notes.find(n => n.id === id);
  if (!note) return;
  const i = state.current.notes.indexOf(note);
  if (i === state.current.notes.length - 1) { return; }    // already on top
  state.current.notes.splice(i, 1); state.current.notes.push(note);
  el.board.appendChild(node);                         // move to top of DOM among notes
  saveNow();
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* --- 8.5 Desktop selection (issues #12/#13, #4 select-then-act) -----------
   One selected thing at a time — a note or a Parking Lot line. Selection is
   inert, reversible state: it commits nothing, so it is instant and opens no
   acknowledged window (B18 governs actions). It never calls surfaceNote — that
   would write, and the overlay renders above every note regardless.
   Notes wear a #selection overlay — the resize frame only now (ring + edges +
   handles, B84) — a sibling of the notes in board space: it inherits renderScale
   but never note.scale, so the frame stays constant-weight at any note size.
   The note's actions live on its own top-edge toolbar (makeNoteToolbar), shown
   by this same select state; its buttons are routed through the recognizer —
   setPointerCapture retargets click, so native listeners inside #board are
   unreliable by construction. */
export let selected = null;                 // { kind: 'note'|'lot', id }
const tapUi = { lastTap: { key: null, t: 0 } };   // double-click pairing across taps
const selUi = { selEl: null };        // the resize-frame overlay (ring + edges + handles); actions live on the note's toolbar (B84)
// Mobile-only "engaged" note (issue #136, B90): the note whose toolbar is shown
// after a first tap — WITHOUT a keyboard. It is the select step desktop already
// has via `selected`, which mobile lacked (there, engaging a note WAS editing it).
// A second tap on the engaged active note edits it. No focus and no write (B22):
// the toolbar is revealed by a `.engaged` class, not by :focus-within.
export let engaged = null;                   // id of the mobile-engaged note, or null
function setEngaged(node) {
  const prev = el.board && el.board.querySelector('.note.engaged');
  if (prev) prev.classList.remove('engaged');
  engaged = node.dataset.id;
  node.classList.add('engaged');
}
function clearEngaged() {
  const prev = el.board && el.board.querySelector('.note.engaged');
  if (prev) prev.classList.remove('engaged');
  engaged = null;
}

/* Multi-selection (issue #55, B41): desktop NOTES only — lot rows stay
   single-select by design (their inline buttons live on the row, and a lot
   line is a list entry, not a spatial object worth herding). `selected` stays
   the PRIMARY — every existing `selected &&` guard is untouched — and this set
   holds the member ids when two or more notes are selected. Invariant: the set
   is empty (today's single selection, bit-for-bit) or has size ≥ 2 and
   contains the primary. The primary wears the one #selection overlay; every
   other member wears .multi-selected, whose CSS outline tracks the node with
   zero JS positioning. */
export const multiSel = new Set();

// The selection as an id array, primary first — the order bulk actions run in.
export function selectedNoteIds() {
  if (!selected || selected.kind !== 'note') return [];
  const ids = [selected.id];
  for (const id of multiSel) if (id !== selected.id) ids.push(id);
  return ids;
}

/* Shift-click semantics (issue #55): toggle membership. Adding makes the
   clicked note the primary; removing the primary promotes another member;
   removing the last member clears. A set that would end at size 1 collapses
   back to a plain single selection, keeping the invariant. */
function toggleInSelection(id) {
  if (!noteEls.get(id)) return;
  if (!selected || selected.kind !== 'note') { selectNote(id); return; }
  const members = new Set(multiSel.size ? multiSel : [selected.id]);
  let primary;
  if (members.has(id)) {
    members.delete(id);
    if (!members.size) { clearSelection(); return; }
    primary = selected.id === id ? members.values().next().value : selected.id;
  } else {
    members.add(id);
    primary = id;                      // the note just added leads
  }
  clearSelection();                    // strips rings, overlay, and the set
  selectNote(primary);                 // the one overlay, on the primary
  if (members.size > 1) {
    for (const m of members) {
      multiSel.add(m);
      if (m !== primary) {
        const node = noteEls.get(m);
        if (node) node.classList.add('multi-selected');
      }
    }
    updateSelectionUI();               // picks up the `multi` class
  }
}

/* Note-removal hygiene (issue #55): a non-primary member that leaves the board
   leaves the set (the primary's removal routes through clearSelection). A set
   of one collapses back to a plain single selection. */
function dropFromSelection(id) {
  if (!multiSel.delete(id)) return;
  const node = noteEls.get(id);
  if (node) node.classList.remove('multi-selected');
  if (multiSel.size === 1) multiSel.clear();
  if (selUi.selEl) selUi.selEl.classList.toggle('multi', multiSel.size > 1);
}

function ensureSelectionEl() {
  if (selUi.selEl) return;
  selUi.selEl = document.createElement('div');
  selUi.selEl.id = 'selection';
  // The outline is visual only; hit-testing lives in four edge bands + the
  // corner handles, so the note's interior stays clickable for the second
  // click of a double-click (a parent's hit area can't be carved out).
  const ring = document.createElement('div');
  ring.className = 'sel-ring';
  selUi.selEl.appendChild(ring);
  for (const side of ['n', 's', 'w', 'e']) {
    const b = document.createElement('div');
    b.className = 'sel-edge ' + side;
    selUi.selEl.appendChild(b);
  }
  for (const corner of ['tl', 'tr', 'bl', 'br']) {
    const h = document.createElement('div');
    h.className = 'sel-handle ' + corner;
    h.setAttribute('aria-hidden', 'true');
    selUi.selEl.appendChild(h);
  }
  // The overlay is the resize frame only now (B84): the ring, four edge bands
  // and four corner handles. A selected note's actions moved onto its own
  // top-edge toolbar (makeNoteToolbar), so the overlay no longer carries
  // Complete/Copy/Delete buttons.
}

function selectNote(id) {
  // Re-selecting the primary is a no-op only while the selection is single: a
  // plain click on the primary of a multi-selection collapses it (issue #55).
  if (selected && selected.kind === 'note' && selected.id === id && multiSel.size === 0) {
    updateSelectionUI(); return;
  }
  clearSelection();
  const node = noteEls.get(id);
  if (!node) return;
  selected = { kind: 'note', id };
  node.classList.add('selected');
  ensureSelectionEl();
  el.board.appendChild(selUi.selEl);
  updateSelectionUI();
}

function selectLot(id) {
  if (selected && selected.kind === 'lot' && selected.id === id) return;
  clearSelection();
  const node = lotEls.get(id);
  if (!node) return;
  selected = { kind: 'lot', id };
  node.classList.add('selected');
  // Lot rows keep their buttons inline at the right edge (#lot-items clips
  // below-the-row placement on the last visible row) — issue #11.
  const act = document.createElement('span');
  act.className = 'lot-actions';
  const p = document.createElement('button');
  p.type = 'button'; p.className = 'sel-btn sel-complete';
  const c = document.createElement('button');
  c.type = 'button'; c.className = 'sel-btn sel-copy';
  c.textContent = COPY.copy;                     // lot rows copy too (issue #59)
  const d = document.createElement('button');
  d.type = 'button'; d.className = 'sel-btn sel-delete';
  d.textContent = COPY.delete;
  act.appendChild(p); act.appendChild(c); act.appendChild(d);
  node.appendChild(act);
  updateSelectionUI();
}

export function clearSelection() {
  if (linkSource !== null) clearLink();   // a board swap / new selection ends link mode (B91)
  // Rings first: the whole set goes when the selection goes (issue #55) —
  // applyMode's teardown and renderBoard's rebuild both land here.
  if (multiSel.size) {
    for (const id of multiSel) {
      const node = noteEls.get(id);
      if (node) node.classList.remove('multi-selected');
    }
    multiSel.clear();
  }
  if (!selected) return;
  if (selected.kind === 'note') {
    const node = noteEls.get(selected.id);
    if (node) node.classList.remove('selected');
    if (selUi.selEl) selUi.selEl.remove();
  } else {
    const node = lotEls.get(selected.id);
    if (node) {
      node.classList.remove('selected');
      const act = node.querySelector('.lot-actions');
      if (act) act.remove();
    }
  }
  selected = null;
}

function setSelectionHidden(hidden) {  // drag/resize in flight: chrome steps aside
  if (selUi.selEl) selUi.selEl.classList.toggle('hidden', hidden);
}

export function updateSelectionUI() {
  if (!selected || !state.current) return;
  if (selected.kind === 'note') {
    const note = state.current.notes.find(n => n.id === selected.id);
    const node = noteEls.get(selected.id);
    if (!note || !node || !selUi.selEl) return;
    const w = node.offsetWidth * effScale(note), h = node.offsetHeight * effScale(note);
    selUi.selEl.style.left = renderX(note) + 'px';
    const top = renderY(note);
    selUi.selEl.style.top = top + 'px';
    selUi.selEl.style.width = w + 'px';
    selUi.selEl.style.height = h + 'px';
    // The note's own toolbar carries the labels now (B84): re-derive its
    // Complete/Highlight marks and its above/below flip for the current geometry
    // (a drag or resize can have moved the note toward the sheet top).
    updateNoteToolbar(node, note);
    reflectToolbarFlip(node, note);
    // Two or more selected: the overlay drops its resize grip (edges +
    // handles, hidden in CSS) — resize is single-selection only (issue #55).
    selUi.selEl.classList.toggle('multi', multiSel.size > 1);
    setSelectionHidden(false);
  } else {
    const node = lotEls.get(selected.id);
    const item = state.current.parkingLot.find(i => i.id === selected.id);
    if (!node || !item) return;
    const p = node.querySelector('.sel-complete');
    if (p) p.textContent = item.state === 'complete' ? COPY.restore : COPY.complete;
  }
}

/* Frame-drag resize (issue #4): scale from the pointer's distance to the
   note's fixed top-left origin — same clamp, re-clamp, and hit math as pinch. */
function startResize(e) {
  const note = state.current.notes.find(n => n.id === selected.id);
  const node = noteEls.get(selected.id);
  if (!note || !node) { g.mode = 'cancelled'; return; }
  rebaseNote(note);                  // grab math runs in current-frame units (issue #15)
  g.mode = 'resize';
  g.note = note;
  g.target = { type: 'note', node };
  g.originX = note.x; g.originY = note.y;
  const pt = toLogical(e.clientX, e.clientY);
  g.grabDist = Math.hypot(pt.x - g.originX, pt.y - g.originY) || 1;
  g.startScale = note.scale;
  node.classList.add('pressed');
  setSelectionHidden(true);
}
function updateResize(e) {
  const pt = toLogical(e.clientX, e.clientY);
  const dist = Math.hypot(pt.x - g.originX, pt.y - g.originY);
  applyNoteScale(g.note, g.target.node, gestureScale(g.startScale, dist / g.grabDist));
}
function endResize() {
  g.target.node.classList.remove('pressed');
  saveNow();
  updateSelectionUI();               // reposition + unhide at the new footprint
}

/* --- 9. Complete / restore / delete + Undo toast ------------------------- */
// State + presentation together, no write: the single-note wrappers below add
// their own saveNow, the bulk path (issue #55) saves once for the whole set.
function setNoteState(node, complete) {
  const note = state.current.notes.find(n => n.id === node.dataset.id);
  if (!note) return;                   // a blank note the pre-act blur just discarded (B84/B8)
  note.state = complete ? 'complete' : 'active';
  node.classList.toggle('complete', complete);
  applyCompleteA11y(node, complete);
  updateNoteToolbar(node, note);       // Complete ⇄ Restore mark/label (B84)
}
export function completeNote(node) { setNoteState(node, true); saveNow(); }
export function restoreNote(node) { setNoteState(node, false); saveNow(); }
// Highlight (issue #105, B71): an appearance axis, not a status — so no
// applyCompleteA11y here; the amber wash is decorative and reads truthily off
// note.highlighted (legacy notes lack the field, which is falsy — B21's idiom).
function setNoteHighlight(node, on) {
  const note = state.current.notes.find(n => n.id === node.dataset.id);
  if (!note) return;                   // discarded blank note (B84/B8) — nothing to wash
  note.highlighted = on;
  node.classList.toggle('highlight', on);
  updateNoteToolbar(node, note);       // Highlight ⇄ Remove highlight label (B84)
}
export function toggleHighlight(node) {
  const note = state.current.notes.find(n => n.id === node.dataset.id);
  if (!note) return;
  setNoteHighlight(node, !note.highlighted); saveNow();
}
function completeLot(node) {
  const item = state.current.parkingLot.find(i => i.id === node.dataset.id);
  item.state = 'complete'; node.classList.add('complete');
  applyCompleteA11y(node, true); saveNow();
}
function restoreLot(node) {
  const item = state.current.parkingLot.find(i => i.id === node.dataset.id);
  item.state = 'active'; node.classList.remove('complete');
  applyCompleteA11y(node, false); saveNow();
}

// One id through the batch path (issue #55): same snapshot, same splice, same
// index-restoring Undo — one implementation to keep honest.
export function deleteNote(node) { deleteNotes([node.dataset.id]); }
function deleteLot(node) {
  if (selected && selected.kind === 'lot' && selected.id === node.dataset.id) clearSelection();
  const item = state.current.parkingLot.find(i => i.id === node.dataset.id);
  const index = state.current.parkingLot.indexOf(item);
  const snapshot = JSON.parse(JSON.stringify(item));
  state.current.parkingLot.splice(index, 1);
  leave(node, () => { node.remove(); lotEls.delete(item.id); updateBoardGeometry(); });
  saveNow();
  showUndo(() => {
    state.current.parkingLot.splice(index, 0, snapshot);
    const newNode = makeLotEl(snapshot);
    const ref = el.lotItems.children[index] || null;
    el.lotItems.insertBefore(newNode, ref);
    updateBoardGeometry();             // the restored row regrows the shelf (UIUX §3.2)
    saveNow();
  });
}
/* Bulk delete with ONE Undo (issue #55): the whole selection leaves in one
   commit, one save, one toast — and the Undo re-inserts every note at its
   original index and restores DOM order, so a delete-all + undo is a no-op.
   Snapshots are taken ascending so re-inserting ascending lands each index
   exactly. deleteNote is a one-id call through this same path, so single and
   batch deletes cannot diverge. */
export function deleteNotes(ids) {
  const wanted = new Set(ids);
  const snap = [];
  state.current.notes.forEach((n, i) => {
    if (wanted.has(n.id)) snap.push({ note: JSON.parse(JSON.stringify(n)), index: i });
  });
  if (!snap.length) return;
  // The deleted notes take their links with them (issue #142, B91). Capture them
  // FIRST so the one Undo restores exact prior state — the notes AND their
  // relationships (UIUX §9) — then drop them from the live board.
  const removedLinks = boardLinks().filter(l => wanted.has(l.a) || wanted.has(l.b));
  if (removedLinks.length) state.current.links = state.current.links.filter(l => !wanted.has(l.a) && !wanted.has(l.b));
  clearSelection();
  if (engaged && wanted.has(engaged)) clearEngaged();   // the engaged note is leaving (issue #136, B90)
  for (let i = snap.length - 1; i >= 0; i--) {       // descending: indices stay valid
    const s = snap[i];
    state.current.notes.splice(s.index, 1);
    const node = noteEls.get(s.note.id);
    if (node) leave(node, () => { node.remove(); noteEls.delete(s.note.id); });
  }
  if (removedLinks.length) updateLinks();            // drop the lines to the leaving notes
  saveNow();
  showUndo(() => {
    for (const s of snap) {                          // ascending: exact z-order back
      state.current.notes.splice(s.index, 0, s.note);
      el.board.appendChild(makeNoteEl(s.note));
    }
    reorderNotesDOM();
    if (removedLinks.length) {                       // relationships come back with the notes
      if (!state.current.links) state.current.links = [];
      for (const l of removedLinks) state.current.links.push(l);
      updateLinks();
    }
    saveNow();
  });
}

/* Complete or restore every selected note in one pass (issue #55). The caller
   picks the direction — the sel-btn keys off the PRIMARY's state, the context
   menu off the whole set — and each member is SET, not toggled, so a mixed
   selection lands uniform. One save for the whole action, like endDrag and
   deleteNotes. */
export function setSelectedNotesState(restore) {
  for (const id of selectedNoteIds()) {
    const node = noteEls.get(id);
    if (node) setNoteState(node, !restore);
  }
  saveNow();
  updateSelectionUI();
}

/* Highlight/unhighlight every selected note in one pass (issue #105, B71). Like
   the state path, each member is SET (not toggled) so a mixed selection lands
   uniform; the context menu decides the direction off the whole set. */
export function setSelectedNotesHighlight(on) {
  for (const id of selectedNoteIds()) {
    const node = noteEls.get(id);
    if (node) setNoteHighlight(node, on);
  }
  saveNow();
  updateSelectionUI();
}

// Rebuild note DOM order to match array order (used after undo-insert).
function reorderNotesDOM() {
  for (const note of state.current.notes) {
    const node = noteEls.get(note.id);
    if (node) el.board.appendChild(node);
  }
}
export function leave(node, done) {
  node.classList.add('leaving');
  setTimeout(done, LEAVE_MS);
}

/* Undo toast (UIUX §9): 5s, restores exact state; a new delete finalizes prior. */
export let undoTimer = null;
export function showUndo(undoFn, scope, label) {
  clearTimeout(undoTimer);
  el.toast.dataset.mode = 'undo';                      // capture priority over save-error
  el.toast.dataset.scope = scope || 'item';            // 'item' undo is current-bound (finding 1)
  el.toast.textContent = '';
  // The caption defaults to "Deleted"; link create/toggle pass "Linked"/"Unlinked" (B91).
  const msg = document.createElement('span'); msg.className = 'msg'; msg.textContent = label || COPY.deleted;
  const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = COPY.undo;
  // Clear the finalize timer on the click itself, not at the end of the action
  // window, so a late Undo (≈4.6s+) can't be finalized out from under it.
  btn.addEventListener('click', () => {
    clearTimeout(undoTimer);
    commitAction(() => { hideToast(); undoFn(); });
  });
  el.toast.appendChild(msg); el.toast.appendChild(btn);
  el.toast.hidden = false;
  requestAnimationFrame(() => el.toast.classList.add('show'));
  undoTimer = setTimeout(hideToast, UNDO_MS);          // timeout finalizes the delete
}
export function hideToast() {
  delete el.toast.dataset.mode;
  delete el.toast.dataset.scope;
  delete el.toast.dataset.seq;
  el.toast.classList.remove('show');
  setTimeout(() => { if (!el.toast.classList.contains('show')) el.toast.hidden = true; }, TOAST_HIDE_MS);
}
/* A message with no action. `save` is persistent (hideSaveError clears it when
   the write lands); `export` and `copy` carry a ttl, because nothing later will
   come along to retract them. */
const noticeUi = { noticeSeq: 0 };
export function showNotice(text, mode, ttl) {
  if (el.toast.dataset.mode === 'undo') return;        // never clobber a pending undo
  // Each notice stamps the toast; the ttl timer only hides its own stamp. A
  // mode check alone let a stale timer hide a newer same-mode notice early —
  // copying two items inside 1.5s (issue #59) is how that became observable.
  const seq = String(++noticeUi.noticeSeq);
  el.toast.dataset.mode = mode;
  el.toast.dataset.seq = seq;
  el.toast.textContent = '';
  const msg = document.createElement('span'); msg.className = 'msg'; msg.textContent = text;
  el.toast.appendChild(msg);
  el.toast.hidden = false;
  requestAnimationFrame(() => el.toast.classList.add('show'));
  if (ttl) setTimeout(() => {
    if (el.toast.dataset.mode === mode && el.toast.dataset.seq === seq) hideToast();
  }, ttl);
}
export function showSaveError() {
  // A retrying save re-announces itself on every attempt, so it can afford to
  // wait behind a notice that will time out; the reverse is not true.
  if (el.toast.dataset.mode === 'export') return;
  showNotice(COPY.saveError, 'save');
}
export function hideSaveError() {
  if (el.toast.dataset.mode === 'save') { delete el.toast.dataset.mode; hideToast(); }
}

/* Copy an item's plain text — the record field, never the DOM (issue #59).
   clipboard.writeText is the real API; where it's missing or rejects (insecure
   origin, permission policy) fall back to the execCommand route through a
   throwaway textarea. Success gets a short notice; failure gets a longer one,
   because it is the only evidence anything went wrong. */
export function copyText(text) {
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    // The body forbids selection, so the textarea must opt back in or select()
    // grabs nothing and execCommand copies nothing. Off-viewport, not hidden:
    // a display:none control cannot hold a selection either.
    ta.style.cssText =
      'position:fixed;top:0;left:-9999px;user-select:text;-webkit-user-select:text;';
    let done = false;
    try {
      document.body.appendChild(ta);
      ta.select();
      done = document.execCommand('copy');
    } catch (err) { /* done stays false */ }
    finally { ta.remove(); }
    if (done) showNotice(COPY.copied, 'copy', 1500);
    else showNotice(COPY.copyError, 'copy', UNDO_MS);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showNotice(COPY.copied, 'copy', 1500), fallback);
  } else fallback();
}


/* Region init (issue #182): top-level side effects, explicit register()
   call from boot() — no module does load-time work. The document-level
   listeners below are lifted verbatim into named handlers; registerInteractions
   keeps them registered in the original order (board pointer handlers first). */

function onFocusOut(e) {
  const t = e.target;
  if (!t.hasAttribute || !t.hasAttribute('contenteditable')) return;
  disableEditing(t);
  if (t.classList.contains('note-text')) commitNote(t.closest('.note'));
  else if (t.classList.contains('lot-text')) commitLot(t.closest('.lot-item'));
  else if (t.classList.contains('anchor')) commitAnchor(t);
  state.editVVFloor = Infinity;   // next edit measures its own keyboard-up floor (B80)
  // A viewport change held back during the edit lands now that nothing is at
  // stake — the keyboard's own retraction resize would repeat it, but a
  // rotation or fold has no such second chance.
  if (state.layoutDeferred) { state.layoutDeferred = false; requestAnimationFrame(applyLayout); }
}

function onFocusIn(e) {
  if (pointers.size) return;
  const t = e.target;
  if (!t.classList) return;
  if (t.classList.contains('anchor') && !t.hasAttribute('contenteditable')) {
    enableEditing(t);
  } else if (t.classList.contains('note')) {
    const note = state.current && state.current.notes.find(n => n.id === t.dataset.id);
    if (!note) return;
    if (state.isDesktop) {
      // Tab selects; Enter edits (issue #13) — EXCEPT the menu's own focus
      // return (issue #55): closeMenu hands focus back to the right-clicked
      // member, and that hand-back must not collapse the multi-selection the
      // menu just acted on. A real Tab onto a member still selects it, so
      // keyboard focus and selection never diverge outside that one call.
      if (!(menuReturnFocus && multiSel.size > 1 && multiSel.has(note.id))) selectNote(note.id);
      return;
    }
    if (note.state === 'active') editText(t.querySelector('.note-text'));
  } else if (t.classList.contains('lot-item')) {
    const item = state.current && state.current.parkingLot.find(i => i.id === t.dataset.id);
    if (!item) return;
    if (state.isDesktop) { selectLot(item.id); return; }
    if (item.state === 'active') editText(t.querySelector('.lot-text'));
  }
}

function onKeyDown(e) {
  if (!state.isDesktop || menuOpen) return;
  // While a link is armed, Escape cancels it and every other key is inert (B91) —
  // no selection exists to Delete/Enter into, and this must win over the grammar.
  if (linkSource !== null) { if (e.key === 'Escape') clearLink(); return; }
  const editing = isEditing(document.activeElement);
  if (e.key === 'Escape') {
    if (editing) { document.activeElement.blur(); }    // commit-on-blur path runs
    else if (selected) clearSelection();
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !editing) {
    e.preventDefault();
    // A multi-selection deletes as one batch with one Undo (issue #55).
    if (selected.kind === 'note' && multiSel.size > 1) { deleteNotes(selectedNoteIds()); return; }
    const s = selected;
    clearSelection();
    if (s.kind === 'note') { const n = noteEls.get(s.id); if (n) deleteNote(n); }
    else { const n = lotEls.get(s.id); if (n) deleteLot(n); }
  } else if (e.key === 'Enter' && selected && !editing) {
    e.preventDefault();
    const s = selected;
    if (s.kind === 'note') {
      const rec = state.current.notes.find(n => n.id === s.id);
      const n = noteEls.get(s.id);
      if (rec && n && rec.state === 'active') {
        clearSelection(); surfaceNote(n); editText(n.querySelector('.note-text'));
      }
    } else {
      const rec = state.current.parkingLot.find(i => i.id === s.id);
      const n = lotEls.get(s.id);
      if (rec && n && rec.state === 'active') {
        clearSelection(); editText(n.querySelector('.lot-text'));
      }
    }
  }
}

function onInput(e) {
  const t = e.target;
  if (t.classList.contains('note-text')) {
    const note = state.current.notes.find(n => n.id === t.closest('.note').dataset.id);
    if (note) { note.text = t.textContent; setHitInset(t.closest('.note'), note); scheduleSave(); }
  } else if (t.classList.contains('lot-text')) {
    const item = state.current.parkingLot.find(i => i.id === t.closest('.lot-item').dataset.id);
    // The lot sizes to its rendered rows, live (issue #106, B73) — the same
    // capture feedback the band's anchor branch below already gives.
    if (item) { item.text = t.textContent; updateBoardGeometry(); scheduleSave(); }
  } else if (t.classList.contains('anchor')) {
    state.current[t.dataset.anchor] = t.textContent;
    t.classList.toggle('filled', !!t.textContent.length);
    if (t.dataset.anchor === 'title' && state.isDesktop) updateActiveCardTitle();
    if (t.dataset.anchor === 'title') syncViewTitle();   // the tab carries the board's name, live (issue #148 item 2)
    // The band sizes to its tallest zone, live (B47) — and the title now has a
    // geometry consequence of its own: the compartment's handle rides its
    // bottom edge, so a title that grows past the floor moves it (B65). One
    // call covers both; it is a no-op for whichever of the two did not change.
    updateBoardGeometry();
    scheduleSave();
  }
}

export function registerInteractions() {
  el.board.addEventListener('pointerdown', onPointerDown);

  el.board.addEventListener('pointermove', onPointerMove);

  el.board.addEventListener('pointerup', onPointerUp);
  el.board.addEventListener('pointercancel', onPointerUp);

  document.addEventListener('focusout', onFocusOut);

  document.addEventListener('focusin', onFocusIn);

  document.addEventListener('keydown', onKeyDown);

  el.board.addEventListener('input', onInput);
}