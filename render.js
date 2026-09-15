/* --- 6. Rendering -------------------------------------------------------- */
// issue #182 module wiring — native ESM, no bundler (AGENTS.md).
import { COPY, GLYPH, anchorEls, calKey, el, state, uuid } from './state.js';
import { idbGet, idbGetAll, idbPut, saveNow, scheduleSave } from './persistence.js';
import { applyLayout, applyNoteWidth, effScale, renderX, renderY, setHitInset } from './geometry.js';
import { clearSelection, commitAction, completeNote, copyText, deleteNotes, hideToast, isEditing, multiSel } from './interactions.js';
import { restoreNote, selected, selectedNoteIds, setSelectedNotesHighlight, setSelectedNotesState, showNotice, showUndo, toggleHighlight } from './interactions.js';
import { syncBoardActions } from './menus.js';
import { catOf } from './boards.js';

// Element caches (render-owned, issue #182): every note/lot element lookup in
// the app routes through these Maps. Declared at the region header so the
// render module owns them and every other region imports the binding.
export const noteEls = new Map();           // note.id -> element
export const lotEls = new Map();            // lotItem.id -> element

/* B8 at rest, not only at blur: "no empty frames ever exist" (PRD §6.2). The
   blur discard covers a frame the user abandons; it cannot cover one whose
   editor never took focus, because no blur ever comes. Any such husk already
   in storage is swept the next time its board is drawn, so old data heals
   itself on first sight and the bug leaves nothing behind (B31). Rendering is
   the right layer: it is the one choke point every board passes through, and
   it rebuilds the frames anyway. */
function sanitizeBoard(board) {
  /* The sweep must not eat what an open editor is still writing (issue #145
     baseline prerequisite; review-2026-08-31.md finding #1). renderBoard runs
     on flows that can land inside the 300ms save debounce — a board swap, a
     rail re-read, a visibility flip — and a record whose text still lives only
     in its DOM node reads as a whitespace husk from stale `current`. Skip the
     record whose editor is open this render; the sweep is per-render, so the
     husk (if it survives blur) is swept on the next one. Same id for notes and
     lot rows: both records carry `id`. */
  const editingId = (() => {
    const ed = document.activeElement;
    if (!isEditing(ed)) return null;
    const host = ed.closest('.note, .lot-item');
    return host && host.dataset.id ? host.dataset.id : null;
  })();
  const keep = r => (r.text || '').trim().length > 0 || r.id === editingId;
  const n = board.notes.length, l = board.parkingLot.length;
  board.notes = board.notes.filter(keep);
  board.parkingLot = board.parkingLot.filter(keep);
  // A note swept here (an empty husk) takes its links with it (issue #142, B91).
  const linksChanged = pruneLinks(board);
  return board.notes.length !== n || board.parkingLot.length !== l || linksChanged;
}

/* The ladder rotates with the board type (issue #96 / B67). This attribute is
   the whole of what app.js says about colour: styles.css rebinds the ladder's
   token names under #board[data-cat=...], so every layer that draws the board
   picks up the new hue through the var() it already reads. No hex belongs
   here (UIUX §2.2 is the rendering authority). catOf() is the read-site
   default, so a record without a category renders as a Note board — the same
   bucket the list files it in, which is the agreement the card preview
   depends on. Both call sites have already established `current`. */
export function applyBoardCat() {
  el.board.dataset.cat = catOf(state.current);
}

/* The tab/OS-window title follows the view (issue #148 item 2). Chrome only —
   nothing on the canvas reads or renders it; the views themselves stay exactly
   as UIUX §10/§6 draw them. Board view shows the board's own title text (the
   anchor's copy, 'What's up?' when untitled — the same rule renderBoard
   applies to the anchor); the picker and a drilled category name themselves. */
export function syncViewTitle() {
  const s = history.state;
  if (s && s.v === 'cat') document.title = `${COPY['cat' + s.cat[0].toUpperCase() + s.cat.slice(1)] || s.cat} · To-Do Boards`;
  else if (s && s.v === 'list') document.title = `All boards · To-Do Boards`;
  else {
    const titled = state.current && !!(state.current.title && state.current.title.trim().length);
    document.title = titled ? `${state.current.title} · To-Do Boards` : 'To-Do Boards';
  }
}

export function renderBoard() {
  clearSelection();                  // note DOM is about to be rebuilt
  applyBoardCat();
  if (sanitizeBoard(state.current)) scheduleSave();
  syncViewTitle();
  // Anchors.
  for (const key of ['title', 'components', 'requirements']) {
    const node = anchorEls[key];
    node.textContent = state.current[key] || '';
    node.classList.toggle('filled', !!(state.current[key] && state.current[key].length));
  }
  // Notes (array order = z-order; DOM order mirrors it).
  noteEls.forEach(n => n.remove()); noteEls.clear();
  for (const note of state.current.notes) el.board.appendChild(makeNoteEl(note));
  hydrateSurfaced();                  // reminder echoes on today's To Do (B109)
  // Parking Lot.
  el.lotItems.textContent = ''; lotEls.clear();
  for (const item of state.current.parkingLot) el.lotItems.appendChild(makeLotEl(item));
  syncBoardActions();                // the toggle reads All boards on a drawn board (B83)
  applyLayout();
}

export function makeNoteEl(note) {
  const node = document.createElement('div');
  // .on-light: the ink pole flips at the note's boundary (UIUX §2.3), and the
  // scratch-out inside strikes in the note's own dark ink.
  node.className = 'note on-light' + (note.state === 'complete' ? ' complete' : '')
    + (note.highlighted ? ' highlight' : '');   // B71: an amber wash, toggled per note
  node.dataset.id = note.id;
  node.setAttribute('tabindex', '0');
  applyNoteWidth(node, note);                               // wrap at the sheet edge (issue #53)
  node.style.left = renderX(note) + 'px';
  node.style.top = renderY(note) + 'px';
  node.style.transform = 'scale(' + effScale(note) + ')';   // the similarity (B64)

  const text = document.createElement('div');
  text.className = 'note-text';
  text.setAttribute('role', 'textbox');
  text.setAttribute('aria-multiline', 'true');
  text.textContent = note.text;

  const scratch = document.createElement('div');
  scratch.className = 'note-scratch';
  scratch.setAttribute('aria-hidden', 'true');

  node.appendChild(text); node.appendChild(scratch);
  node.appendChild(makeClockBtn(note));                      // the reminder toggle (B109)
  setReminderUi(node, note);                                 // class + aria follow the record
  setCarriedUi(node, note);                                  // the carried status shadow (B110)
  node.appendChild(makeNoteToolbar(note));                   // the on-select action row (B84)
  applyCompleteA11y(node, note.state === 'complete');
  reflectToolbarFlip(node, note);                            // above the note, or below near the sheet top
  noteEls.set(note.id, node);
  requestAnimationFrame(() => setHitInset(node, note));
  return node;
}

/* --- 6.4 The reminder clock (issue #169, B104/B109) ----------------------- */

/* The clock toggle, bottom-right of every note card: one tap sets or clears
   the reminder (B104) — no picker, no dialog, no time. Off the record stays
   lean: clearing DELETES the key (B21's absence-is-off idiom), so a legacy
   note and a cleared one are the same shape. */
function makeClockBtn(note) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'note-clock';
  b.innerHTML = GLYPH.clock;                 // SVG is already aria-hidden
  return b;
}

/* The clock's look follows the record (aria carries the state too — never
   colour alone, UIUX §1). Called from the render paths and the toggle. */
export function setReminderUi(node, note) {
  node.classList.toggle('reminder', !!note.reminder);
  const b = node.querySelector('.note-clock');
  if (b) {
    b.setAttribute('aria-label', note.reminder ? COPY.unremind : COPY.remind);
    b.setAttribute('aria-pressed', String(!!note.reminder));
  }
}

/* The carried indicator's look follows the record (B110): the class is B108's
   `carriedOn` field's shadow — recomputed at render from the field against the
   today key, never stored style state. Complete wins (B108's completion law
   clears the field; a completed note never glows even if a legacy record kept
   the field). Called from the render paths and from setNoteState, so
   completion and restoration recompute it in place. */
export function setCarriedUi(node, note) {
  node.classList.toggle('carried',
    note.state !== 'complete' && !!note.carriedOn && note.carriedOn === calKey(new Date()));
}

/* One clock activation, from a pointer tap or the keyboard: commit on release
   through the B81 drop-guard, exactly like the toolbar's tabs. On this board's
   own note the record is `state.current`'s; on a surfaced echo it lives on the
   source board, and the toggle writes there and recomputes the surfacing. */
export function runClockAction(btn) {
  const node = btn.closest('.note');
  if (!node) return;
  if (isEditing(document.activeElement)) { document.activeElement.blur(); return; }
  const id = node.dataset.id;
  const local = state.current.notes.find(n => n.id === id);
  commitAction(() => {
    if (local) {
      if (local.reminder) delete local.reminder; else local.reminder = true;
      setReminderUi(node, local);
      saveNow();
    } else {
      toggleSurfacedReminder(id);
    }
  });
}

/* --- 6.5 Surfaced reminder cards (issue #169, B109) -----------------------
   A note with `reminder` set on ANY board other than today's linked To-Do
   renders an ECHO of itself there — one source of truth (the record never
   leaves its board; nothing is copied, so nothing can diverge), computed at
   render time like sanitizeBoard's sweep. The echo wears the source board's
   note hue (data-src-cat rebinds --note, the ladder's own discipline). The
   surfacing set is ACTIVE reminder notes: completing one anywhere unsurfaces
   it, and the same is true of clearing its clock. */

export const surfacedMap = new Map();      // note.id -> { boardId } — the echoes on screen
let surfacedToken = 0;                     // stale-async guard across re-renders

export function clearSurfaced() {
  surfacedMap.clear();
  for (const n of [...el.board.querySelectorAll('.note.surfaced')]) n.remove();
}

function makeSurfacedEl(note, srcBoard) {
  const node = document.createElement('div');
  // .surfaced: the echo — inert to tap/drag/edit (interactions.js finds no
  // record here), reachable by long-press/right-click for its two menu acts.
  node.className = 'note on-light surfaced reminder';
  node.dataset.id = note.id;
  node.dataset.srcBoard = srcBoard.id;
  node.dataset.srcCat = catOf(srcBoard);
  node.setAttribute('tabindex', '0');
  applyNoteWidth(node, note);
  node.style.left = renderX(note) + 'px';
  node.style.top = renderY(note) + 'px';
  node.style.transform = 'scale(' + effScale(note) + ')';

  const text = document.createElement('div');
  text.className = 'note-text';
  text.textContent = note.text;

  const scratch = document.createElement('div');
  scratch.className = 'note-scratch';
  scratch.setAttribute('aria-hidden', 'true');

  node.appendChild(text); node.appendChild(scratch);
  const clock = makeClockBtn(note);
  clock.setAttribute('aria-label', COPY.unremind);
  clock.setAttribute('aria-pressed', 'true');
  node.appendChild(clock);
  return node;
}

function hydrateSurfaced() {
  const token = ++surfacedToken;
  const board = state.current;
  if (!board || !board.cal || board.cal !== calKey(new Date())) { clearSurfaced(); return; }
  idbGetAll().then((all) => {
    if (token !== surfacedToken || state.current !== board) return;
    clearSurfaced();
    for (const b of all) {
      if (typeof b.title !== 'string') continue;           // event records ride the store
      if (b.id === board.id || b.cal === board.cal) continue;
      for (const n of (b.notes || [])) {
        if (!n.reminder || n.state === 'complete') continue;
        surfacedMap.set(n.id, { boardId: b.id });
        el.board.appendChild(makeSurfacedEl(n, b));
      }
    }
  });
}

/* The two acts a surfaced card's menu carries (B109). Both write the SOURCE
   record through idbGet — the echo holds no state of its own — then re-render
   today's board, which recomputes the surfacing set. Completing clears a
   carriedOn marker under the same law as setNoteState (B108). */
export async function completeSurfaced(id) {
  const surf = surfacedMap.get(id);
  if (!surf) return;
  const rec = await idbGet(surf.boardId);
  const n = rec && (rec.notes || []).find(m => m.id === id);
  if (!n || n.state === 'complete') return;
  n.state = 'complete';
  if (n.carriedOn) delete n.carriedOn;
  await idbPut(rec);
  renderBoard();
}

async function toggleSurfacedReminder(id) {
  const surf = surfacedMap.get(id);
  if (!surf) return;
  const rec = await idbGet(surf.boardId);
  const n = rec && (rec.notes || []).find(m => m.id === id);
  if (!n) return;
  if (n.reminder) delete n.reminder; else n.reminder = true;
  await idbPut(rec);
  renderBoard();                        // clock-off unsurfaces; nothing to re-add
}

/* The note's action toolbar (B84, issue #126, UIUX §4.5/§14): four flat tabs on
   the note's top edge — Complete/Restore · Highlight · Copy · Delete, in the
   menu's B43 order, Delete last in --danger. It is a CHILD of the note, so it
   scales with it (never wider than the note it belongs to) and rides the board's
   renderScale like every other mark. It is drawn always but shown only on
   select/focus (CSS); routed through the recognizer, not native clicks (B84,
   like .sel-btn). The marks are GLYPH's own drawn SVG (UIUX §13.3), each SVG
   aria-hidden with the label on the button for AT. */
function makeNoteToolbar(note) {
  const bar = document.createElement('div');
  bar.className = 'note-toolbar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Note actions');
  const mk = (cls, glyph, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    // .on-light rebinds the ink to --ink-dark on the --frame fill (band-label's
    // pairing, B76); note-tb-btn is the recognizer-routing hook (classifyTarget).
    b.className = 'note-tb-btn on-light ' + cls;
    b.innerHTML = glyph;                       // GLYPH SVG is already aria-hidden
    b.setAttribute('aria-label', label);
    bar.appendChild(b);
    return b;
  };
  const done = note.state === 'complete';
  mk('note-tb-complete', done ? GLYPH.restore : GLYPH.complete, done ? COPY.restore : COPY.complete);
  mk('note-tb-highlight', GLYPH.highlight, note.highlighted ? COPY.unhighlight : COPY.highlight);
  mk('note-tb-copy', GLYPH.copy, COPY.copy);
  mk('note-tb-delete', GLYPH.delete, COPY.delete);           // destructive, last (UIUX §7)
  return bar;
}

/* The Complete tab flips its mark (check ⇄ undo) and label with the note's state;
   the Highlight tab flips only its label — its "on" look is CSS off .note.highlight,
   and the real signal is the note's own amber wash (never colour alone, UIUX §1). */
export function updateNoteToolbar(node, note) {
  const comp = node.querySelector('.note-tb-complete');
  if (comp) {
    const done = note.state === 'complete';
    comp.innerHTML = done ? GLYPH.restore : GLYPH.complete;
    comp.setAttribute('aria-label', done ? COPY.restore : COPY.complete);
  }
  const hl = node.querySelector('.note-tb-highlight');
  if (hl) hl.setAttribute('aria-label', note.highlighted ? COPY.unhighlight : COPY.highlight);
}

/* The row hangs above the note's top edge; a note near the sheet top has no room
   there, so it flips to sit just inside the top edge instead (UIUX §4.5). The row
   is a note child, so its board-logical height scales with the note (effScale) —
   the threshold does too. renderY is stable across fold/renderScale. */
const TB_ROW_H = 32;                  // ~the row's own height at scale 1, no gap — flush on-edge (issue #133, B87)
export function reflectToolbarFlip(node, note) {
  node.classList.toggle('tb-flip', renderY(note) < TB_ROW_H * effScale(note));
}

/* One toolbar action, from a pointer tap (handleTap) or the keyboard (below).
   Commits on release through the B81 drop-guard. Acts on the whole multi-
   selection when this note is the desktop primary of one, else on this note
   alone — mobile has no selection, so it is always the single note. */
export function runNoteToolbarAction(btn) {
  const noteNode = btn.closest('.note');
  if (!noteNode) return;
  const note = state.current.notes.find(n => n.id === noteNode.dataset.id);
  if (!note) return;
  const editingHere = () =>
    isEditing(document.activeElement) && noteNode.contains(document.activeElement);
  commitAction(() => {
    const inMulti = selected && selected.kind === 'note' &&
                    multiSel.size > 1 && multiSel.has(note.id);
    const ids = inMulti ? selectedNoteIds() : [note.id];
    if (btn.classList.contains('note-tb-copy')) {
      // note.text is live off every keystroke (the input handler), so Copy needs
      // no blur — it copies the current text and leaves the note engaged.
      copyText(ids.map(id => {
        const n = state.current.notes.find(m => m.id === id);
        return n ? n.text : '';
      }).join('\n'));
    } else if (btn.classList.contains('note-tb-delete')) {
      if (editingHere()) document.activeElement.blur();   // no dangling editor in the leaving node
      deleteNotes(ids);                                   // one commit → one Undo
    } else if (btn.classList.contains('note-tb-highlight')) {
      // The wash leaves the text editable, so Highlight keeps the note engaged
      // too (mobile can toggle it twice without re-tapping).
      if (inMulti) setSelectedNotesHighlight(!note.highlighted);
      else toggleHighlight(noteNode);                     // primary keys the direction
    } else {                                              // complete / restore
      // #54's law: completing buries the text (§4.3), so an open editor on this
      // note commits first — the veil never falls over a live caret.
      if (editingHere()) document.activeElement.blur();
      if (inMulti) setSelectedNotesState(note.state === 'complete');
      else if (note.state === 'complete') restoreNote(noteNode); else completeNote(noteNode);
    }
  });
}

/* Keyboard operability (UIUX §12/§4.5): the pointer path routes through the
   recognizer (setPointerCapture retargets native clicks), so a keyboard Enter/
   Space on a focused tab is the ONE activation the recognizer never sees. This
   handles it, and stopPropagation keeps it off the desktop note grammar below —
   without it, Enter on a selected note's tab would ALSO edit the note. The tabs
   are the keyboard route to Complete/Highlight/Copy the removed note menu used
   to be (B84). */

export function makeLotEl(item) {
  const node = document.createElement('div');
  node.className = 'lot-item' + (item.state === 'complete' ? ' complete' : '');
  node.dataset.id = item.id;
  node.setAttribute('tabindex', '0');

  const text = document.createElement('div');
  text.className = 'lot-text';
  text.setAttribute('role', 'textbox');
  text.setAttribute('aria-multiline', 'true');
  text.textContent = item.text;

  const scratch = document.createElement('div');
  scratch.className = 'lot-scratch';
  scratch.setAttribute('aria-hidden', 'true');

  node.appendChild(text); node.appendChild(scratch);
  applyCompleteA11y(node, item.state === 'complete');
  lotEls.set(item.id, node);
  return node;
}

export function applyCompleteA11y(node, complete) {
  const text = node.firstChild;
  if (complete) {
    node.setAttribute('aria-label', 'completed note');
    text.setAttribute('aria-hidden', 'true');
  } else {
    node.removeAttribute('aria-label');
    text.removeAttribute('aria-hidden');
  }
}

/* --- 6.6 Note links (issue #142, B91) ------------------------------------
   A relationship the user ASSERTS between two notes — the board's first
   inter-note structure, resolved against "relationships asserted not inferred"
   (PRD §1). Stored per board as unordered {id,a,b} pairs; drawn as a 1px
   --frame SVG line between the two notes' centres, BELOW the notes (the layer
   is pointer-events:none, so it never intercepts a tap). Long-press (mobile) or
   right-click (desktop) a note → Link → the next note tapped is connected; a tap
   on an already-linked note removes that link (toggle, B91). Deleting a note
   removes its links, and note-undo restores them (deleteNotes). */

// The source note while a link is being armed (its id, or null). Modeled on the
// mobile `engaged` idiom (B90): a single-id transient mode, cleared on resolve,
// cancel, a drag, Escape, and any selection change / board swap (clearSelection).
export let linkSource = null;

export const boardLinks = () => (state.current && state.current.links) || [];   // B21 read-default for legacy boards
const findLink = (a, b) =>
  boardLinks().find(l => (l.a === a && l.b === b) || (l.a === b && l.b === a));

/* Create the link, or remove it if the pair is already linked (B91 toggle-to-
   unlink). A committing consequence — the caller wraps it in commitAction so a
   double-tap can't double-fire — and either direction offers a 5s Undo, the
   app's one reversal idiom (UIUX §9). The Undo closures read current.links
   directly, exactly as deleteNotes reads current.notes (same board-binding). */
export function toggleLink(a, b) {
  if (!state.current || a === b) return;
  if (!state.current.links) state.current.links = [];
  const existing = findLink(a, b);
  if (existing) {
    state.current.links = state.current.links.filter(l => l !== existing);
    saveNow(); updateLinks();
    showUndo(() => { state.current.links.push(existing); saveNow(); updateLinks(); }, 'item', COPY.unlinked);
  } else {
    const link = { id: uuid(), a, b };
    state.current.links.push(link);
    saveNow(); updateLinks();
    showUndo(() => { state.current.links = boardLinks().filter(l => l.id !== link.id); saveNow(); updateLinks(); }, 'item', COPY.linked);
  }
}

// Drop links referencing an id (a deleted note); returns the removed links so a
// caller's Undo can restore them (exact prior state, UIUX §9).
export function removeLinksForNote(id) {
  if (!state.current || !state.current.links || !state.current.links.length) return [];
  const removed = state.current.links.filter(l => l.a === id || l.b === id);
  if (removed.length) state.current.links = state.current.links.filter(l => l.a !== id && l.b !== id);
  return removed;
}

// Drop links whose endpoints no longer exist (a swept husk, B31/B8). Called from
// sanitizeBoard; returns whether anything changed so the board re-saves.
function pruneLinks(board) {
  if (!board.links || !board.links.length) return false;
  const ids = new Set(board.notes.map(n => n.id));
  const before = board.links.length;
  board.links = board.links.filter(l => ids.has(l.a) && ids.has(l.b));
  return board.links.length !== before;
}

/* Arming the mode is navigation — it commits nothing a stray tap could
   duplicate (B81) — so it runs raw (and, from a menu item, is already inside
   commitAction). A persistent hint states the act; clearLink retracts it. */
export function beginLink(id) {
  linkSource = id;
  showNotice(state.isDesktop ? COPY.linkHintClick : COPY.linkHintTap, 'link');
}
export function clearLink() {
  if (linkSource === null) return;
  linkSource = null;
  if (el.toast.dataset.mode === 'link') hideToast();
}

/* The link layer: one <svg> in board space, a sibling of the notes like
   #selection, so it rides #board's translate+scale and needs no screen-space
   math. pointer-events:none (CSS) — hit-testing is target.closest()-based, so a
   hittable line would steal note taps. z-index:1 (CSS): below the z:2 notes, and
   — appended after the static furniture — above the z:1 furniture, the valid-
   integer realization of the issue's "z-index: 1.5" (B91). */
const SVGNS = 'http://www.w3.org/2000/svg';
const renderUi = { linkLayer: null };
const linkLineEls = new Map();       // link.id -> <line>
function ensureLinkLayer() {
  if (renderUi.linkLayer) return;
  renderUi.linkLayer = document.createElementNS(SVGNS, 'svg');
  renderUi.linkLayer.id = 'link-layer';
  renderUi.linkLayer.setAttribute('aria-hidden', 'true');
  el.board.appendChild(renderUi.linkLayer);
}
// A note's centre in current board-logical px — the same math updateSelectionUI
// uses (renderX + offsetWidth·effScale/2), read from the live DOM node.
function noteCenter(note, node) {
  return { x: renderX(note) + node.offsetWidth * effScale(note) / 2,
           y: renderY(note) + node.offsetHeight * effScale(note) / 2 };
}
/* Redraw every link line from the notes' current geometry. Called from every
   site that moves a note (applyLayout, the drag/pinch/resize tails) and after
   any link add/remove. A missing endpoint is skipped, not drawn — dangling-safe
   until sanitizeBoard prunes it. Cheap no-op on a board that has never linked. */
export function updateLinks() {
  const links = boardLinks();
  if (!links.length && !renderUi.linkLayer) return;
  ensureLinkLayer();
  const live = new Set();
  for (const link of links) {
    const na = state.current.notes.find(n => n.id === link.a);
    const nb = state.current.notes.find(n => n.id === link.b);
    const ea = noteEls.get(link.a), eb = noteEls.get(link.b);
    if (!na || !nb || !ea || !eb) continue;
    const ca = noteCenter(na, ea), cb = noteCenter(nb, eb);
    let line = linkLineEls.get(link.id);
    if (!line) {
      line = document.createElementNS(SVGNS, 'line');
      linkLineEls.set(link.id, line);
      renderUi.linkLayer.appendChild(line);
    }
    line.setAttribute('x1', ca.x); line.setAttribute('y1', ca.y);
    line.setAttribute('x2', cb.x); line.setAttribute('y2', cb.y);
    live.add(link.id);
  }
  for (const [id, line] of linkLineEls) {
    if (!live.has(id)) { line.remove(); linkLineEls.delete(id); }
  }
}


/* Region init (issue #182): top-level side effects, explicit register()
   call from boot() — no module does load-time work. */
export function registerRender() {
  el.board.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    const clock = e.target.closest && e.target.closest('.note-clock');
    if (clock) {                    // the clock's keyboard route, beside the tabs' (B109)
      e.preventDefault();
      e.stopPropagation();
      runClockAction(clock);
      return;
    }
    const btn = e.target.closest && e.target.closest('.note-tb-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    runNoteToolbarAction(btn);
  });
}