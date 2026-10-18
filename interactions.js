/* --- 7. Gesture recognizer ----------------------------------------------- */
import { ACTION_DELAY, CE, clamp, COPY, COPY_NOTICE_MS, DBLCLICK_MS, LEAVE_MS, LONGPRESS_MS, MAX_SCALE, MIN_SCALE, MOVE_THRESHOLD, noteRec, lotRec } from './state.js';
import { NOTE_BOTTOM_PAD, NOTE_MIN_W, TOAST_HIDE_MS, UNDO_MS, anchorEls, el, makeRecord, state, uuid, KB_HIDE_SLOP } from './state.js';
import { saveNow, scheduleSave } from './persistence.js';
import { LOGICAL_H, LOGICAL_W, applyLayout, applyNoteWidth, caretToEnd, effScale, noteMaxW, placeCaretAtPoint } from './geometry.js';
import { rebaseNote, renderX, renderY, setHitInset, toLogical, updateBoardGeometry } from './geometry.js';
import { applyCompleteA11y, clearLink, linkSource, lotEls, makeLotEl, makeNoteEl, noteEls } from './render.js';
import { paintRequirementsRead } from './render.js';
import { runClockAction } from './render.js';
import { reflectToolbarSeat, removeLinksFor, seatGroup, runNoteToolbarAction, setCarriedUi, setReminderUi, syncViewTitle, toggleLink, updateLinks, updateNoteToolbar, ensureNoteTitleEl } from './render.js';
import { menuOpen, menuReturnFocus, openMenuFor } from './menus.js';
import { renderCal, renderPane, updateActiveCardTitle, writeThroughRequirements } from './boards.js';

// One recognizer over the board. Targets: note | anchor | lot-item | lot | canvas.
export const pointers = new Map();          // pointerId -> {x,y,startX,startY}
export let g = null;                        // active gesture context

/* Notes open a menu by mobile long-press or desktop right-click (Copy, Title,
   Link). Anchors carry no menu (B92); the lot and canvas arm none. */
const HAS_MENU = new Set(['note']);

function classifyTarget(target, press) {
  // Selection chrome first: .sel-btn (notes and lot rows), then the resize
  // frame; both must win over the elements beneath them.
  const selBtn = target.closest('.sel-btn');
  if (selBtn) return { type: 'sel-btn', node: selBtn };
  if (target.closest('#selection')) return { type: 'sel-frame', node: selEl };
  // #board-actions (B83) never reaches here: pressIsInert passes it through.
  // Note toolbar (B84): setPointerCapture retargets the native click, so claim
  // these buttons like .sel-btn. The clock tab wears BOTH classes, so test it
  // first (registerRender's keyboard path does the same).
  const clockBtn = target.closest('.note-clock');   // reminder toggle (B109)
  const tbBtn = target.closest('.note-tb-btn');
  if (clockBtn || tbBtn) {
    // Chrome's touch-target slop retargets a press on the note's last text
    // line to the NEAREST row tab, reaching past any CSS collar. So the collar
    // law (B139) is held here, where the real coordinates are known: a press
    // above the tab's collar top is on the note.
    const btn = clockBtn || tbBtn;
    const r = btn.getBoundingClientRect();
    const cs = getComputedStyle(btn, '::before');
    const collarTop = r.top + (cs.top === 'auto' ? 0 : parseFloat(cs.top) || 0);
    if (press && press.clientY < collarTop - 0.5) {
      const note = btn.closest('.note');
      if (note) return { type: 'note', node: note };
    }
    if (clockBtn) return { type: 'note-clock', node: clockBtn };
    return { type: 'note-tb-btn', node: tbBtn };
  }
  const note = target.closest('.note');
  if (note) return { type: 'note', node: note };
  const lotItem = target.closest('.lot-item');
  if (lotItem) return { type: 'lot-item', node: lotItem };
  const anchor = target.closest('.anchor');
  if (anchor) return { type: 'anchor', node: anchor };
  if (target.closest('#lot')) return { type: 'lot', node: el.lot };
  return { type: 'canvas', node: el.board };
}


/* Presses the recognizer must not own (onPointerDown's early returns): menu
   dismissal (B30), native buttons in the All-Boards grid and board-action tabs
   (B74, B83), non-primary buttons, and text editing. */
function pressIsInert(e) {
  if (state.swallowTap) { state.swallowTap = false; return true; }
  // The All-Boards grid (B74) lives inside #lot, so its presses bubble here;
  // let its buttons get their native clicks.
  if (e.target.closest('#lot-menu')) return true;
  // Board-action tabs (B83): same passthrough, no gesture armed and no
  // preventDefault. The row's pointer-events:none frame never reaches here, so
  // bare canvas still captures.
  if (e.target.closest('#board-actions')) return true;
  // Secondary/middle presses: a right-click must reach the contextmenu listener
  // with no gesture armed. preventDefault stops the native focus of a
  // tabindexed note, whose focusin Tab-selects rule would collapse a
  // multi-selection before contextmenu acts. contextmenu still fires (it is not
  // a compat mouse event).
  if (e.button !== 0) { e.preventDefault(); return true; }
  return isEditing(e.target);                      // let text editing receive taps/caret
}

function onPointerDown(e) {
  if (pressIsInert(e)) return;
  // The recognizer owns this press, so suppress the compat mouse events at
  // source (B27): setPointerCapture retargets them to #board, which can't hold
  // focus, so their default action blurs the editor the tap just opened and B8
  // discards the empty note. All focus and caret placement here is explicit.
  e.preventDefault();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY });

  // Second pointer on a note → pinch, never on a group drag (scaling is
  // single-selection only): the extra pointer is ignored (a touchscreen laptop
  // can be desktop-mode, B19).
  if (pointers.size === 2 && g && g.target.type === 'note' && !g.group) {
    startPinch();
    return;
  }
  if (pointers.size > 1) return;                   // ignore extra pointers otherwise

  const target = classifyTarget(e.target, e);
  g = {
    target, pointerId: e.pointerId,
    startX: e.clientX, startY: e.clientY,
    shift: e.shiftKey,                             // multi-select modifier
    mode: 'pending', longPressed: false, moved: false,
    note: target.type === 'note' ? noteRec(target.node.dataset.id) : null,
  };
  // Resize is single-selection only: the CSS hides the grip with 2+ selected;
  // this guard covers a stray hit on the frame.
  if (state.isDesktop && target.type === 'sel-frame' && selected && selected.kind === 'note' &&
      multiSel.size <= 1) {
    startResize(e);
  }
  try { el.board.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }

  if (!state.isDesktop && HAS_MENU.has(target.type)) {   // desktop has no click-and-hold
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

/* Mode-flip teardown (called from the entry's media-query listener). An
   imported bare `let` is read-only, so the cross-module write of `g` lives
   here. */
export function cancelGesture() {
  if (g) { clearTimeout(g.longPressTimer); g = null; }
}

/* --- 8. Editing, drag, pinch, z-order ------------------------------------ */
/* Editing = an editor that actually holds focus, not just the attribute: it
   can outlive a refused focus() (no focusout strips it), and an unfocused
   husk answering yes would swallow every pointerdown over it. */
export function isEditing(node) {
  const ed = node.closest && node.closest('[contenteditable]');
  return !!(ed && document.activeElement === ed);
}

/* Commit an open editor before a tap acts (the recognizer suppressed the
   native blur, B27). Returns true when the tap is spent: it hit the edited
   element's own collar and only dismisses (edit and selection are exclusive,
   B22). */
function commitOpenEditor(node) {
  const a = document.activeElement;
  if (!isEditing(a)) return false;
  const own = !!(node && node.contains(a));
  a.blur();
  return own;
}

/* Consequences commit on release (B81) behind B18's drop-guard: a second tap
   inside it is dropped, not queued, so a double-tap can't delete twice or
   complete-then-uncomplete (B18d). Navigation (menu open, swap, edit-entry)
   commits nothing a stray tap could duplicate, and capture self-heals (B8),
   so neither takes the guard. */
let pendingAction = null;

export function commitAction(fn) {
  if (pendingAction) return;
  fn();
  pendingAction = setTimeout(() => { pendingAction = null; }, ACTION_DELAY);
}

/* No blanket pendingAction guard here: commitAction guards where a
   consequence fires (B18d); inert taps and navigation stay live. */
function handleTap(target, x, y, shift) {
  // A pending link (B91) consumes any tap: nothing may select, edit or create
  // underneath it.
  if (resolvePendingLink(target)) return;
  switch (target.type) {
    case 'sel-btn': tapLotButton(target); break;
    case 'note-tb-btn': runNoteToolbarAction(target.node); break;   // B84 (keyboard path too, below)
    case 'note-clock': runClockAction(target.node); break;   // the reminder toggle (B109)
    case 'sel-frame': break;           // a motionless click on the ring does nothing
    case 'canvas': tapCanvas(x, y); break;
    case 'lot': tapLot(x, y); break;
    case 'note': tapNote(target, shift); break;
    case 'lot-item': tapLotItem(target, x, y); break;
    case 'anchor': tapAnchor(target, x, y); break;       // edit-entry is instant on both (B27, B81)
  }
}

/* Pending-link pre-check (B91): the next tap resolves an armed source. A
   DIFFERENT note toggles the link; anything else (canvas, lot, anchor, the
   source itself) cancels. Either way the tap is consumed. The write and the
   mode-exit run together in commitAction's drop-guard (B81); cancel commits
   nothing, so it runs raw. */
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

/* Lot rows only (B84): notes act through their own toolbar
   (runNoteToolbarAction). Buttons commit on release via B81's drop-guard; Copy
   works on completed rows. */
function tapLotButton(target) {
  const lotRow = target.node.closest('.lot-item');
  if (!lotRow) return;
  const isDel = target.node.classList.contains('sel-delete');
  const isCopy = target.node.classList.contains('sel-copy');
  commitAction(() => {
    const item = lotRec(lotRow.dataset.id);
    if (!item) return;
    if (isCopy) copyText(item.text);
    else if (isDel) { clearSelection(); deleteLot(lotRow); }
    else {
      if (item.state === 'complete') restoreLot(lotRow); else completeLot(lotRow);
      updateSelectionUI();
    }
  });
}

/* Creation surface. Guard order is load-bearing: click-away-while-editing
   FIRST, then the selected check. */
function tapCanvas(x, y) {
  // Click-away while editing only dismisses. Must precede the selected check:
  // nothing is selected while editing, and the suppressed native blur (B27)
  // would otherwise let the click create a note over the dismissal.
  if (isEditing(document.activeElement)) { document.activeElement.blur(); return; }
  // A tap with a selection active only dismisses.
  if (state.isDesktop && selected) { clearSelection(); return; }
  if (!state.isDesktop && engaged) { clearEngaged(); return; }   // mobile: tap-away deselects; a further tap creates (B90)
  createNote(x, y);                // capture is instant on both (B27, B81)
}

/* Creation surface, same law as tapCanvas (see above). */
function tapLot(x, y) {
  if (isEditing(document.activeElement)) { document.activeElement.blur(); return; }
  if (state.isDesktop && selected) { clearSelection(); return; }   // creation surface too
  if (!state.isDesktop && engaged) { clearEngaged(); return; }   // mobile: tap-away deselects (B90)
  createLotItem();                 // capture is instant on both (B27, B81)
}

/* Desktop select-then-edit: a click selects; a second click on the
   ALREADY-SELECTED item inside the pairing window runs `edit`. The key carries
   the kind, so a note click never pairs with an earlier lot-row click. */
function pairOrSelect(kind, id, edit) {
  const key = kind + ':' + id, now = Date.now();
  if (selected && selected.kind === kind && selected.id === id &&
      lastTap.key === key && now - lastTap.t < DBLCLICK_MS) {
    lastTap = { key: null, t: 0 };
    edit();
    return;
  }
  if (kind === 'note') selectNote(id); else selectLot(id);
  lastTap = { key, t: now };
}

/* The pair's second click: drop the selection (B22), then editText with no
   coordinates (caret at end, B26). A note is raised as it opens (B27). */
function editNote(node) {
  clearSelection();
  surfaceNote(node);
  editText(node.querySelector('.note-text'));
}
function editLot(node) {
  clearSelection();
  editText(node.querySelector('.lot-text'));
}

/* Desktop: click selects, a second click within the pairing window edits (caret
   at end), shift-click toggles multi-selection. Mobile two-tap grammar (B90):
   first tap ENGAGES (toolbar, no keyboard, no write, B22); a second tap on the
   engaged active note EDITS synchronously inside pointerup so the keyboard
   rises (B27a). A completed note only engages (UIUX §4.2). */
function tapNote(target, shift) {
  const node = target.node;
  const note = noteRec(node.dataset.id);
  if (!note) return;
  if (state.isDesktop) {
    if (commitOpenEditor(node)) return;
    // Shift-click toggles multi-selection and never pairs.
    if (shift) {
      toggleInSelection(note.id);
      lastTap = { key: null, t: 0 };
      return;
    }
    // Click selects; a second click in the window edits. Completed notes never
    // edit.
    pairOrSelect('note', note.id, () => { if (note.state === 'active') editNote(node); });
    return;
  }
  // Mobile two-tap grammar (B90), see the header. Caret at the END, overriding
  // B14 here (desktop precedent B26); no surfaceNote on the engaging tap (B22).
  if (isEditing(document.activeElement)) document.activeElement.blur();
  if (note.state === 'active' && engaged === note.id) {
    clearEngaged();
    surfaceNote(node);
    editText(node.querySelector('.note-text'));
  } else {
    setEngaged(node);
  }
}

/* Same commit-first guard as the note branch; lot rows stay single-select. */
function tapLotItem(target, x, y) {
  const node = target.node;
  const item = lotRec(node.dataset.id);
  if (!item) return;
  if (state.isDesktop) {
    if (commitOpenEditor(node)) return;
    pairOrSelect('lot', item.id, () => { if (item.state === 'active') editLot(node); });
    return;
  }
  if (item.state === 'active') editText(node.querySelector('.lot-text'), x, y);  // B27
}

function tapAnchor(target, x, y) {
  editText(target.node, x, y);      // edit-entry is instant on both (B27, B81)
}

/* Enter inline edit on any editable text node. The Requirements anchor's
   pre-edit text is snapshotted here, the one funnel every edit entry (tap and
   focusin) passes through: onInput overwrites state.current per keystroke, and
   the write-through commit (B106) needs the starting text to tell a deleted
   span line from an edited one. */
let reqBefore = null;
function enableEditing(textNode) {
  // B133: a linked To-Do board's title is generated: no editor, no write-back.
  // Guarded at the one funnel so tap and focusin both honour it.
  if (textNode.dataset && textNode.dataset.anchor === 'title' &&
      state.current && state.current.cal) return false;
  if (textNode.classList && textNode.classList.contains('anchor') &&
      textNode.dataset.anchor === 'requirements') {
    reqBefore = state.current.requirements || '';
    /* The read state shows the mirror's span lines as squares; the editor edits
       the STRING, so restore plain \n-text before focus (reqBefore is already
       snapshotted). The contenteditable guard stops the second funnel pass
       (focusin after the tap's focus()) from wiping the live editor. */
    if (textNode.classList.contains('req-mirrored') &&
        textNode.getAttribute('contenteditable') !== CE) {
      textNode.classList.remove('req-mirrored');
      textNode.textContent = state.current.requirements || '';
    }
  }
  textNode.setAttribute('contenteditable', CE);
  return true;
}
function disableEditing(textNode) {
  textNode.removeAttribute('contenteditable');
}
function editText(textNode, clientX, clientY) {
  if (!enableEditing(textNode)) return;   // a pinned title takes no editor (B133)
  textNode.focus();
  if (clientX != null) placeCaretAtPoint(textNode, clientX, clientY);
  else caretToEnd(textNode);
}

/* Create a note in edit mode at the tapped point (PRD §6.2). The focus check
   closes B8's one gap (B31): a refused focus never blurs, so the empty frame
   would never discard and persists as an invisible husk (.note-text:empty)
   with a live 44 px hit collar. */
function createNote(clientX, clientY) {
  const pt = toLogical(clientX, clientY);
  // x is floored NOTE_MIN_W back from the right edge (B84) so a toolbar-wide
  // note can't spill off the sheet; y keeps its 4px keep-on-page clamp.
  const note = makeRecord('note', { id: uuid(), text: '', x: clamp(pt.x, 0, Math.max(0, LOGICAL_W - NOTE_MIN_W)),
    y: clamp(pt.y, 0, LOGICAL_H - NOTE_BOTTOM_PAD), rw: LOGICAL_W, rh: LOGICAL_H, scale: 1.0, state: 'active' },
    { logicalW: LOGICAL_W, logicalH: LOGICAL_H });
  state.current.notes.push(note);                          // top of z-order
  const node = makeNoteEl(note);
  el.board.appendChild(node);
  const text = node.querySelector('.note-text');
  enableEditing(text); text.focus(); caretToEnd(text);
  if (document.activeElement !== text) removeNoteSilently(note, node);
}

function createLotItem() {
  const item = makeRecord('lot', { id: uuid(), text: '', state: 'active' });
  state.current.parkingLot.push(item);
  const node = makeLotEl(item);
  el.lotItems.appendChild(node);
  updateBoardGeometry();               // the shelf follows its rows (UIUX §3.2)
  const text = node.querySelector('.lot-text');
  enableEditing(text); text.focus(); caretToEnd(text);
  if (document.activeElement !== text) removeLotSilently(item, node);
}

function commitNote(node) {
  const note = noteRec(node.dataset.id);
  if (!note) return;
  note.text = node.querySelector('.note-text').textContent;
  if (note.text.trim().length === 0) { removeNoteSilently(note, node); return; }  // no empty frames ever
  saveNow();
}
/* The Title's commit (B120): the text's commit-on-blur path (B81 family). An
   emptied title deletes the key (B21: absence is off) and removes the tab. */
function commitNoteTitle(node) {
  const note = noteRec(node.dataset.id);
  if (!note) return;
  const tab = node.querySelector('.note-title');
  if (!tab) return;
  const v = tab.textContent.replace(/\n/g, '').trim();
  if (v) { note.title = v; tab.textContent = v; }
  else { delete note.title; tab.remove(); }
  saveNow();
}
/* Menu's Add/Edit Title (B120): create the empty tab if absent, cursor in with
   the keyboard up. Edit-entry is navigation (no drop-guard) and raises the
   note (B27). */
export function editNoteTitle(node) {
  const note = noteRec(node.dataset.id);
  if (!note) return;
  const tab = ensureNoteTitleEl(node);
  surfaceNote(node);
  enableEditing(tab);
  tab.focus();
  caretToEnd(tab);
}
function removeNoteSilently(note, node) {
  if (selected && selected.kind === 'note' && selected.id === note.id) clearSelection();
  else dropFromSelection(note.id);     // set hygiene for a non-primary member
  const i = state.current.notes.indexOf(note);
  if (i >= 0) state.current.notes.splice(i, 1);
  node.remove(); noteEls.delete(note.id);
  // A husk discard takes its links (B8, B91). Silent: no Undo.
  if (removeLinksFor(new Set([note.id])).length) updateLinks();
  saveNow();
}
function commitLot(node) {
  const item = lotRec(node.dataset.id);
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
    // Reverse mirror (B106): this commit IS the write-through. A calendar face
    // already on screen would read the stale mirror, so repaint once after the
    // async write settles, only if a face is shown (a hidden mobile calendar
    // must not pay for a repaint hideCal supersedes).
    writeThroughRequirements(state.current, reqBefore).then(() => {
      if (state.calOpen || state.calExpanded) renderCal();
      /* Blur restores the mirror's squares from the settled store. The
         plain-text read above ran first, so the commit saw the \n-string.
         Re-measure geometry AFTER the repaint: squares change the anchor's
         height and the band follows (B47, bandRuleY reads scrollHeight). */
      paintRequirementsRead(anchorEls.requirements, state.current);
      updateBoardGeometry();
    });
    reqBefore = null;
  }
  updateBoardGeometry();      // the band follows its zones (B47), the handle its card (B65)
  saveNow();
}

/* Drag (PRD §6.3): free overlap, no snap, clamp to page bounds only. */

/* Group drag: grabbing a MEMBER of a multi-selection moves every member by the
   same delta; only the grabbed note surfaces (startDrag), every member wears
   .pressed. A non-member grab takes the single path and collapses the set. */
function collectGroupMembers(startLogical) {
  g.group = [];
  for (const id of selectedNoteIds()) {
    const n = noteRec(id);
    const memberNode = noteEls.get(id);
    if (!n || !memberNode) continue;
    // Per-member rebase: the one licensed grab-time write (B21; B40 folds scale
    // too); visually silent.
    rebaseNote(n);
    const fw = memberNode.offsetWidth * n.scale, fh = memberNode.offsetHeight * n.scale;
    g.group.push({
      note: n, node: memberNode, x0: n.x, y0: n.y,
      // Per-member bounds widened to admit the grab position, as in the single
      // path (B40). Differing clamps may compress the group at the sheet edge
      // (accepted, B41): the alternative is a note the group can never park
      // flush.
      minX: Math.min(0, n.x), maxX: Math.max(n.x, Math.max(0, LOGICAL_W - fw)),
      minY: Math.min(0, n.y), maxY: Math.max(n.y, Math.max(0, LOGICAL_H - fh)),
    });
    memberNode.classList.add('pressed');
  }
  g.groupX0 = startLogical.x; g.groupY0 = startLogical.y;
  setSelectionHidden(true);
}

function startDrag() {
  if (!g.note) { g.mode = 'cancelled'; return; }   // a surfaced echo is not draggable (B109)
  clearLink();                           // dragging a note exits link mode (B91)
  g.mode = 'drag';
  g.target.node.classList.add('pressed');
  surfaceNote(g.target.node);
  const note = g.note;
  const startLogical = toLogical(g.startX, g.startY);
  if (state.isDesktop && multiSel.size > 1 && multiSel.has(note.id)) {
    collectGroupMembers(startLogical);
    return;
  }
  rebaseNote(note);                  // grab math runs in current-frame units
  if (state.isDesktop) { selectNote(note.id); setSelectionHidden(true); }
  g.grabDX = startLogical.x - note.x;
  g.grabDY = startLogical.y - note.y;
  // Outer x range, fixed once and widened to admit the grab position (B40): a
  // cross-frame note can arrive past the sheet edge, and the plain range
  // [0, max(0, sheet - foot)] would teleport it on the first move. Moving
  // right tightens the cap and rewraps the text narrower and taller, so x
  // admits the narrowest the note can become (the NOTE_MIN_W floor, or its
  // whole footprint if narrower). y has no fixed upper bound: settleDragFoot
  // derives it per move, less dragOverY (the bottom overhang the grab
  // admitted).
  const node = g.target.node;
  const footW = node.offsetWidth * note.scale, footH = node.offsetHeight * note.scale;
  g.dragMinX = Math.min(0, note.x);
  g.dragMaxX = Math.max(note.x,
    Math.max(0, LOGICAL_W - Math.min(footW, NOTE_MIN_W * note.scale)));
  g.dragMinY = Math.min(0, note.y);
  g.dragOverY = Math.max(0, note.y + footH - LOGICAL_H);
  // Reflow-guard caches: the cap the node wears now (rebaseNote writes the var
  // first: B64's min-k can widen the cap) and the size measured under it.
  // settleDragFoot skips its layout-forcing write+read while they prove the cap
  // can't bind.
  g.dragCap = noteMaxW(note);
  g.dragW = node.offsetWidth;
  g.dragH = node.offsetHeight;
}

/* Shared tail of every drag move and the drop: cap at the current x, measure
   the rewrapped footprint, keep it on the sheet.
   - x: a still-overhanging foot means the cap is floored at NOTE_MIN_W, so
     pulling x back to the edge makes the cap exact; the cap->rewrap->
     smaller-foot cycle settles in one pass, at worst at
     x = LOGICAL_W - NOTE_MIN_W*scale (rebased: effScale == scale).
   - y: the rewrap changes the height, so the bound is the live measure plus
     dragOverY (B40), keeping the admitted overhang; only overhang this drag's
     own rewrap creates is pulled back.
   The var write + offsetWidth read force layout per pointermove, so they are
   skipped while the cap provably can't bind (natural width below the applied
   cap, new cap not below that width). The drop passes force: the committed
   note must wear the exact cap. */
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
    // One delta for the whole group, clamped per member.
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
    // One write for the group. Grab-time bounds mean no member overhangs; each
    // settles onto the exact cap for its resting x, never tighter than the
    // clamp admitted (nothing jumps; a leftward member may re-widen).
    for (const m of g.group) {
      applyNoteWidth(m.node, m.note);
      setHitInset(m.node, m.note);
      m.node.classList.remove('pressed');
    }
    g.target.node.classList.remove('pressed');
    seatGroup(g.group);              // a drop near the sheet bottom lifts the group so every row fits below (B139)
    saveNow();
    updateLinks();                   // final settle: links land on the dropped notes (B91)
    if (state.isDesktop) updateSelectionUI();
    return;
  }
  const note = g.note, node = g.target.node;
  // Final forced settle before the write. Legal under B17: the re-clamp runs
  // inside the gesture; B17 forbids viewport re-clamps of committed positions.
  settleDragFoot(note, node, true);
  setHitInset(node, note);           // the drag can have rewrapped the note
  node.classList.remove('pressed');
  saveNow();
  reflectToolbarSeat(node, note);    // a drop near the sheet bottom raises the note so the row fits below
  if (state.isDesktop) updateSelectionUI();  // reposition + unhide at the drop point
}

/* Pinch (PRD §6.3 / UIUX §5): transform scale only, clamp 0.5-2.0 (bounds
   widen to admit a folded cross-frame scale, B40), origin top-left so stored
   x,y stay truthful; re-clamp position if the grown footprint exits the
   page. */
function startPinch() {
  if (!g.note) return;                 // a surfaced echo has no record to pinch (B109)
  clearTimeout(g.longPressTimer);
  if (g.mode === 'drag') g.target.node.classList.remove('pressed');
  const pts = [...pointers.values()];
  g.mode = 'pinch';
  rebaseNote(g.note);                // grab math runs in current-frame units
  g.startDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
  g.startScale = g.note.scale;
  g.target.node.classList.add('pressed');
}
/* Shared tail of pinch and desktop frame-drag resize: apply the clamped scale,
   re-clamp the footprint into the page, refresh the hit area. The note was
   rebased at grab, so note.x needs no renderX. */
function applyNoteScale(note, node, scale) {
  note.scale = scale;
  node.style.transform = 'scale(' + scale + ')';
  // Scale changes the unscaled cap, (rw - x)/scale (noteMaxW): re-derive the
  // width var before reading offsetWidth so growing near the edge rewraps
  // narrower.
  applyNoteWidth(node, note);
  const footW = node.offsetWidth * scale, footH = node.offsetHeight * scale;
  // A footprint can exceed the sheet only via a folded cross-frame scale
  // (B40); the plain [0, max(0, sheet - foot)] range would pin it to the
  // corner. Min/max of the same pair inverts the constraint (sheet inside
  // note); for a fitting note it reduces to the plain clamp.
  note.x = clamp(note.x, Math.min(0, LOGICAL_W - footW), Math.max(0, LOGICAL_W - footW));
  note.y = clamp(note.y, Math.min(0, LOGICAL_H - footH), Math.max(0, LOGICAL_H - footH));
  node.style.left = note.x + 'px';
  node.style.top = note.y + 'px';
  setHitInset(node, note);
  updateLinks();                     // a scaled note's links track its new centre (B91)
}

/* Widened gesture clamp (B40): bounds admit the start value, so a folded
   cross-frame scale outside [MIN_SCALE, MAX_SCALE] never snaps at gesture
   start but can never go further out of range. Shared by pinch and frame-drag
   resize (B22). */
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
  const note = noteRec(id);
  if (!note) return;
  const i = state.current.notes.indexOf(note);
  if (i === state.current.notes.length - 1) { return; }    // already on top
  state.current.notes.splice(i, 1); state.current.notes.push(note);
  el.board.appendChild(node);                         // move to top of DOM among notes
  saveNow();
}

/* --- 8.5 Desktop selection (select-then-act) ----------------------------
   One selected thing at a time (a note or a Parking Lot line). Selection is
   inert state, instant, no acknowledged window (B18 governs actions); it never
   calls surfaceNote (that writes; the overlay renders above every note).
   #selection is the resize frame only (B84), a sibling of the notes in board
   space: it inherits renderScale but never note.scale, so it stays
   constant-weight. Note actions live on the note's toolbar, routed through the
   recognizer: setPointerCapture retargets click, so native listeners inside
   #board are unreliable. */
export let selected = null;                 // { kind: 'note'|'lot', id }
let lastTap = { key: null, t: 0 };          // double-click pairing across taps
let selEl = null;                 // the resize-frame overlay
// Mobile "engaged" note (B90): its toolbar shows after a first tap via the
// `.engaged` class, with no focus, no keyboard, no write (B22). Mobile's
// counterpart of desktop `selected`; a second tap on it edits.
export let engaged = null;                   // id of the mobile-engaged note, or null
function setEngaged(node) {
  const prev = el.board.querySelector('.note.engaged');
  if (prev) prev.classList.remove('engaged');
  engaged = node.dataset.id;
  node.classList.add('engaged');
}
function clearEngaged() {
  const prev = el.board.querySelector('.note.engaged');
  if (prev) prev.classList.remove('engaged');
  engaged = null;
}

/* Multi-selection (B41): desktop NOTES only; lot rows stay single-select.
   `selected` stays the PRIMARY (every `selected &&` guard reads it alone); this
   set holds the member ids when 2+ notes are selected. Invariant: empty, or
   size >= 2 and containing the primary. The primary wears the one #selection
   overlay; other members wear .multi-selected (CSS outline, no JS
   positioning). */
export const multiSel = new Set();

// The selection as an id array, primary first — the order bulk actions run in.
export function selectedNoteIds() {
  if (!selected || selected.kind !== 'note') return [];
  const ids = [selected.id];
  for (const id of multiSel) if (id !== selected.id) ids.push(id);
  return ids;
}

/* Shift-click toggles membership. Adding makes the clicked note primary;
   removing the primary promotes another; removing the last clears. A set that
   would end at size 1 collapses to a single selection (the invariant). */
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

/* A non-primary member leaving the board leaves the set (the primary's removal
   goes through clearSelection); a set of one collapses. */
function dropFromSelection(id) {
  if (!multiSel.delete(id)) return;
  const node = noteEls.get(id);
  if (node) node.classList.remove('multi-selected');
  if (multiSel.size === 1) multiSel.clear();
  if (selEl) selEl.classList.toggle('multi', multiSel.size > 1);
}

function ensureSelectionEl() {
  if (selEl) return;
  selEl = document.createElement('div');
  selEl.id = 'selection';
  // Outline is visual only; hit-testing is four edge bands + corner handles so
  // the interior stays clickable for a double-click's second click (a parent's
  // hit area can't be carved out).
  const ring = document.createElement('div');
  ring.className = 'sel-ring';
  selEl.appendChild(ring);
  for (const side of ['n', 's', 'w', 'e']) {
    const b = document.createElement('div');
    b.className = 'sel-edge ' + side;
    selEl.appendChild(b);
  }
  for (const corner of ['tl', 'tr', 'bl', 'br']) {
    const h = document.createElement('div');
    h.className = 'sel-handle ' + corner;
    h.setAttribute('aria-hidden', 'true');
    selEl.appendChild(h);
  }
}

function selectNote(id) {
  // Re-selecting the primary is a no-op only while single: a plain click on the
  // primary of a multi-selection collapses it.
  if (selected && selected.kind === 'note' && selected.id === id && multiSel.size === 0) {
    updateSelectionUI(); return;
  }
  clearSelection();
  const node = noteEls.get(id);
  if (!node) return;
  selected = { kind: 'note', id };
  node.classList.add('selected');
  ensureSelectionEl();
  el.board.appendChild(selEl);
  updateSelectionUI();
}

function selectLot(id) {
  if (selected && selected.kind === 'lot' && selected.id === id) return;
  clearSelection();
  const node = lotEls.get(id);
  if (!node) return;
  selected = { kind: 'lot', id };
  node.classList.add('selected');
  // Lot buttons stay inline: #lot-items clips below-row placement on the last
  // row.
  const act = document.createElement('span');
  act.className = 'lot-actions';
  const p = document.createElement('button');
  p.type = 'button'; p.className = 'sel-btn sel-complete';
  const c = document.createElement('button');
  c.type = 'button'; c.className = 'sel-btn sel-copy';
  c.textContent = COPY.copy;
  const d = document.createElement('button');
  d.type = 'button'; d.className = 'sel-btn sel-delete';
  d.textContent = COPY.delete;
  act.appendChild(p); act.appendChild(c); act.appendChild(d);
  node.appendChild(act);
  updateSelectionUI();
}

export function clearSelection() {
  clearLink();                       // a board swap / new selection ends link mode (B91)
  // Rings first: the whole set goes with the selection (tier teardown and
  // renderBoard's rebuild land here).
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
    if (selEl) selEl.remove();
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
  if (selEl) selEl.classList.toggle('hidden', hidden);
}

export function updateSelectionUI() {
  if (!selected || !state.current) return;
  if (selected.kind === 'note') {
    const note = noteRec(selected.id);
    const node = noteEls.get(selected.id);
    if (!note || !node || !selEl) return;
    const w = node.offsetWidth * effScale(note), h = node.offsetHeight * effScale(note);
    // Seat FIRST: the note can be raised for its row, and the box must wrap the
    // raised card, not the stored one.
    updateNoteToolbar(node, note);
    reflectToolbarSeat(node, note);
    selEl.style.left = renderX(note) + 'px';
    const top = renderY(note);
    selEl.style.top = top + 'px';
    selEl.style.width = w + 'px';
    selEl.style.height = h + 'px';
    // 'multi' hides the resize grip in CSS (resize is single-selection only).
    selEl.classList.toggle('multi', multiSel.size > 1);
    setSelectionHidden(false);
  } else {
    const node = lotEls.get(selected.id);
    const item = lotRec(selected.id);
    if (!node || !item) return;
    const p = node.querySelector('.sel-complete');
    if (p) p.textContent = item.state === 'complete' ? COPY.restore : COPY.complete;
  }
}

/* Frame-drag resize: scale from the pointer's distance to the note's fixed
   top-left origin; clamp, re-clamp and hit math as pinch. */
function startResize(e) {
  const note = noteRec(selected.id);
  const node = noteEls.get(selected.id);
  if (!note || !node) { g.mode = 'cancelled'; return; }
  rebaseNote(note);                  // grab math runs in current-frame units
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
  updateSelectionUI();
}

/* --- 9. Complete / restore / delete + Undo toast ------------------------- */
// State + presentation, no write: wrappers add saveNow; the bulk path saves
// once.
function setNoteState(node, complete) {
  const note = noteRec(node.dataset.id);
  if (!note) return;                   // a blank note the pre-act blur just discarded (B84/B8)
  note.state = complete ? 'complete' : 'active';
  if (complete && note.carriedOn) delete note.carriedOn;   // carried status ends at completion (B108)
  node.classList.toggle('complete', complete);
  setCarriedUi(node, note);            // the carried shadow follows the field (B110)
  setReminderUi(node, note);           // reminder glow follows completion guard (B132)
  applyCompleteA11y(node, complete);
  updateNoteToolbar(node, note);
}
export function completeNote(node) { setNoteState(node, true); saveNow(); }
export function restoreNote(node) { setNoteState(node, false); saveNow(); }
// Highlight (B71): an appearance axis, not a status, so no applyCompleteA11y;
// the wash is decorative and reads off note.highlighted (absent = falsy, B21).
function setNoteHighlight(node, on) {
  const note = noteRec(node.dataset.id);
  if (!note) return;                   // discarded blank note (B84/B8)
  note.highlighted = on;
  node.classList.toggle('highlight', on);
  updateNoteToolbar(node, note);
}
export function toggleHighlight(node) {
  const note = noteRec(node.dataset.id);
  if (!note) return;
  setNoteHighlight(node, !note.highlighted); saveNow();
}
/* State + presentation, no write: the wrappers below add saveNow. The
   missing-item guard mirrors setNoteState's: the pre-act blur (B8) may have
   discarded a blank row. */
function setLotState(node, complete) {
  const item = lotRec(node.dataset.id);
  if (!item) return;
  item.state = complete ? 'complete' : 'active';
  node.classList.toggle('complete', complete);
  applyCompleteA11y(node, complete);
}
function completeLot(node) { setLotState(node, true); saveNow(); }
function restoreLot(node) { setLotState(node, false); saveNow(); }

// One id through the batch path: same snapshot, splice and index-restoring
// Undo, one implementation.
export function deleteNote(node) { deleteNotes([node.dataset.id]); }
function deleteLot(node) {
  if (selected && selected.kind === 'lot' && selected.id === node.dataset.id) clearSelection();
  const item = lotRec(node.dataset.id);
  const index = state.current.parkingLot.indexOf(item);
  const snapshot = JSON.parse(JSON.stringify(item));
  state.current.parkingLot.splice(index, 1);
  leave(node, () => { node.remove(); if (lotEls.get(item.id) === node) lotEls.delete(item.id); updateBoardGeometry(); });
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
/* Bulk delete with ONE Undo (one commit, save, toast). Snapshots are taken
   ascending so re-inserting ascending restores each index and z-order.
   deleteNote routes through here so single and batch can't diverge. */
export function deleteNotes(ids) {
  const wanted = new Set(ids);
  const snap = [];
  state.current.notes.forEach((n, i) => {
    if (wanted.has(n.id)) snap.push({ note: JSON.parse(JSON.stringify(n)), index: i });
  });
  if (!snap.length) return;
  // The deleted notes take their links (B91). Capture them FIRST so the one
  // Undo restores notes AND relationships (UIUX §9).
  const removedLinks = removeLinksFor(wanted);
  clearSelection();
  if (engaged && wanted.has(engaged)) clearEngaged();   // the engaged note is leaving (B90)
  for (let i = snap.length - 1; i >= 0; i--) {       // descending: indices stay valid
    const s = snap[i];
    state.current.notes.splice(s.index, 1);
    const node = noteEls.get(s.note.id);
    if (node) leave(node, () => { node.remove(); if (noteEls.get(s.note.id) === node) noteEls.delete(s.note.id); });
  }
  if (removedLinks.length) updateLinks();
  saveNow();
  showUndo(() => {
    for (const s of snap) {                          // ascending: exact z-order back
      state.current.notes.splice(s.index, 0, s.note);
      el.board.appendChild(makeNoteEl(s.note));
    }
    reorderNotesDOM();
    if (removedLinks.length) {
      if (!state.current.links) state.current.links = [];
      for (const l of removedLinks) state.current.links.push(l);
      updateLinks();
    }
    saveNow();
  });
}

/* Complete or restore every selected note. The note toolbar picks the direction
   from the primary's state and passes `restore`; each member is SET, not
   toggled, so a mixed selection lands uniform. One save, like endDrag and
   deleteNotes. */
export function setSelectedNotesState(restore) {
  for (const id of selectedNoteIds()) {
    const node = noteEls.get(id);
    if (node) setNoteState(node, !restore);
  }
  saveNow();
  updateSelectionUI();
}

/* Highlight/unhighlight every selected note (B71): SET, not toggled; the
   context menu picks the direction off the whole set. */
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
/* The toast's one opening: stamp `mode`, put `text` in a .msg span, raise it on
   the next frame (the #toast translateY idiom, UIUX §8). Both faces (notice
   and undo) open this way; undo then adds its button. */
function raiseToast(mode, text) {
  el.toast.dataset.mode = mode;
  el.toast.textContent = '';
  const msg = document.createElement('span'); msg.className = 'msg'; msg.textContent = text;
  el.toast.appendChild(msg);
  el.toast.hidden = false;
  requestAnimationFrame(() => el.toast.classList.add('show'));
}
export let undoTimer = null;
export function showUndo(undoFn, scope, label) {
  clearTimeout(undoTimer);
  el.toast.dataset.scope = scope || 'item';            // item Undo belongs to the current board
  // 'undo' outranks a save-error; the caption defaults to "Deleted", link
  // create/toggle pass "Linked"/"Unlinked" (B91).
  raiseToast('undo', label || COPY.deleted);
  const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = COPY.undo;
  // Clear the finalize timer only when the Undo commits, inside commitAction's
  // drop-guard (B81): a tap dropped within ACTION_DELAY must leave the timer
  // running so the toast still auto-hides at UNDO_MS. A late Undo that commits
  // clears on the click, so it can't be finalized out from under it.
  btn.addEventListener('click', () => {
    commitAction(() => { clearTimeout(undoTimer); hideToast(); undoFn(); });
  });
  el.toast.appendChild(btn);
  undoTimer = setTimeout(hideToast, UNDO_MS);          // timeout finalizes the delete
}
export function hideToast() {
  delete el.toast.dataset.mode;
  delete el.toast.dataset.scope;
  delete el.toast.dataset.seq;
  el.toast.classList.remove('show');
  setTimeout(() => { if (!el.toast.classList.contains('show')) el.toast.hidden = true; }, TOAST_HIDE_MS);
}
/* A message with no action. `save` persists until hideSaveError; `export` and
   `copy` carry a ttl, since nothing later retracts them. */
let noticeSeq = 0;
export function showNotice(text, mode, ttl) {
  if (el.toast.dataset.mode === 'undo') return;        // never clobber a pending undo
  // Each notice stamps the toast and its ttl timer hides only its own stamp; a
  // mode check alone lets a stale timer hide a newer same-mode notice early.
  const seq = String(++noticeSeq);
  raiseToast(mode, text);
  el.toast.dataset.seq = seq;
  if (ttl) setTimeout(() => {
    if (el.toast.dataset.mode === mode && el.toast.dataset.seq === seq) hideToast();
  }, ttl);
}
export function showSaveError() {
  // A retrying save re-announces every attempt, so it can wait behind a notice
  // that times out; the reverse is not true.
  if (el.toast.dataset.mode === 'export') return;
  showNotice(COPY.saveError, 'save');
}
export function hideSaveError() {
  if (el.toast.dataset.mode === 'save') hideToast();   // hideToast clears the mode
}

/* Copy an item's plain text (the record field, never the DOM). Where
   clipboard.writeText is missing or rejects (insecure origin, permission
   policy), fall back to execCommand via a throwaway textarea. Failure gets the
   longer notice: it is the only evidence anything went wrong. */
export function copyText(text) {
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    // The body forbids selection, so the textarea opts back in or select()
    // grabs nothing. Off-viewport, not display:none, which can't hold a
    // selection.
    ta.style.cssText =
      'position:fixed;top:0;left:-9999px;user-select:text;-webkit-user-select:text;';
    let done = false;
    try {
      document.body.appendChild(ta);
      ta.select();
      done = document.execCommand('copy');
    } catch (err) { /* done stays false */ }
    finally { ta.remove(); }
    if (done) showNotice(COPY.copied, 'copy', COPY_NOTICE_MS);
    else showNotice(COPY.copyError, 'copy', UNDO_MS);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showNotice(COPY.copied, 'copy', COPY_NOTICE_MS), fallback);
  } else fallback();
}


/* Region init: registerInteractions is called from boot(); no load-time work. */

/* Commit-on-blur for every editable region; empty new notes/items are discarded. */
function onFocusOut(e) {
  const t = e.target;
  if (!t.hasAttribute || !t.hasAttribute('contenteditable')) return;
  disableEditing(t);
  if (t.classList.contains('note-text')) commitNote(t.closest('.note'));
  else if (t.classList.contains('note-title')) commitNoteTitle(t.closest('.note'));
  else if (t.classList.contains('lot-text')) commitLot(t.closest('.lot-item'));
  else if (t.classList.contains('anchor')) commitAnchor(t);
  state.editVP.floor = Infinity;   // next edit measures its own keyboard-up floor (B80)
  state.editVP.width = 0;          // ...and its own widths: never inherit the last edit's
  state.editVP.height = 0;
  // A viewport change held back during the edit lands now; a rotation or fold
  // has no second chance (the keyboard's retraction resize only repeats it).
  //
  // B152: without navigator.virtualKeyboard (Gecko, WebKit) the layout viewport
  // ITSELF shrinks under the keyboard (those engines ignore Chromium's
  // interactive-widget=resizes-visual), so blur-by-tap with the keyboard still
  // up would land the held frame against a shrunken innerHeight, the frame B64
  // keeps out of storage. The room is read against this edit's focus-in
  // baseline, so a fold (width change) and Chromium (innerHeight stays full)
  // fall through and blur-apply (B28/B80). When the gate holds the frame stays
  // deferred: the keyboard's retraction resize lands it through the
  // environment pass.
  const stillShrunken = state.editVP.startH && !state.isDesktop &&
    window.innerHeight < state.editVP.startH - KB_HIDE_SLOP;
  if (state.editVP.deferred && !stillShrunken) {
    state.editVP.deferred = false;
    requestAnimationFrame(() => applyLayout());
  }
  if (stillShrunken) {
    // arm the environment pass: the held frame must land even if the restored
    // viewport equals its lastEnv (B152)
    state.editVP.holdPending = true;
  } else {
    state.editVP.startH = 0;
  }
}

/* Keyboard/AT users focus a region → enter edit. The pointer path owns taps:
   auto-edit only when no gesture is in control, or a tabindexed note would open
   the keyboard on pointerdown before drag/long-press resolve. */
function onFocusIn(e) {
  // B152: the edit's layout-viewport baseline. Gecko/WebKit shrink innerHeight
  // under the keyboard (Chromium's resizes-visual doesn't), so blur with the
  // keyboard still up must be told from a restored room. The max stops a
  // keyboard already up when this edit began (held-frame chain, B152's focusout
  // gate) from re-baselining on its shrunken height.
  if (!state.isDesktop) state.editVP.startH = Math.max(state.editVP.startH, window.innerHeight);
  if (pointers.size) return;
  const t = e.target;
  if (!t.classList) return;
  if (t.classList.contains('anchor') && !t.hasAttribute('contenteditable')) {
    enableEditing(t);
  } else if (t.classList.contains('note')) {
    const note = noteRec(t.dataset.id);
    if (!note) return;
    if (state.isDesktop) {
      // Tab selects; Enter edits. Except closeMenu's focus return to the
      // right-clicked member: it must not collapse the multi-selection the menu
      // just acted on. A real Tab onto a member still selects it.
      if (!(menuReturnFocus && multiSel.size > 1 && multiSel.has(note.id))) selectNote(note.id);
      return;
    }
    if (note.state === 'active') editText(t.querySelector('.note-text'));
  } else if (t.classList.contains('lot-item')) {
    const item = lotRec(t.dataset.id);
    if (!item) return;
    if (state.isDesktop) { selectLot(item.id); return; }
    if (item.state === 'active') editText(t.querySelector('.lot-text'));
  }
}

/* Desktop keyboard: inert while the menu is open (menuKeyHandler owns its keys,
   and Delete must not destroy the selection under it). */
function onKeyDown(e) {
  if (!state.isDesktop || menuOpen) return;
  // While a link is armed (B91) Escape cancels and every other key is inert; no
  // selection exists to act on, and this must win over the grammar.
  if (linkSource !== null) { if (e.key === 'Escape') clearLink(); return; }
  const editing = isEditing(document.activeElement);
  if (e.key === 'Escape') {
    if (editing) { document.activeElement.blur(); }    // commit-on-blur path runs
    else if (selected) clearSelection();
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !editing) {
    e.preventDefault();
    if (selected.kind === 'note' && multiSel.size > 1) { deleteNotes(selectedNoteIds()); return; }
    const s = selected;
    clearSelection();
    if (s.kind === 'note') { const n = noteEls.get(s.id); if (n) deleteNote(n); }
    else { const n = lotEls.get(s.id); if (n) deleteLot(n); }
  } else if (e.key === 'Enter' && selected && !editing) {
    e.preventDefault();
    const s = selected;
    if (s.kind === 'note') {
      const rec = noteRec(s.id);
      const n = noteEls.get(s.id);
      if (rec && n && rec.state === 'active') {
        clearSelection(); surfaceNote(n); editText(n.querySelector('.note-text'));
      }
    } else {
      const rec = lotRec(s.id);
      const n = lotEls.get(s.id);
      if (rec && n && rec.state === 'active') {
        clearSelection(); editText(n.querySelector('.lot-text'));
      }
    }
  }
}

/* Live growth = capture feedback; debounced persistence (PRD §4 writes). */
function onInput(e) {
  const t = e.target;
  if (t.classList.contains('note-text')) {
    const note = noteRec(t.closest('.note').dataset.id);
    if (note) { note.text = t.textContent; setHitInset(t.closest('.note'), note); scheduleSave(); }
  } else if (t.classList.contains('lot-text')) {
    const item = lotRec(t.closest('.lot-item').dataset.id);
    // The lot sizes to its rendered rows, live (B73).
    if (item) { item.text = t.textContent; updateBoardGeometry(); scheduleSave(); }
  } else if (t.classList.contains('anchor')) {
    state.current[t.dataset.anchor] = t.textContent;
    t.classList.toggle('filled', !!t.textContent.length);
    if (t.dataset.anchor === 'title' && state.isDesktop) updateActiveCardTitle();
    if (t.dataset.anchor === 'title') syncViewTitle();   // the tab carries the board's name, live
    // Band sizes to its tallest zone, live (B47); the title also moves the
    // compartment handle on its bottom edge (B65). One call covers both.
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