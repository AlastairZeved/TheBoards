/* --- 6. Rendering -------------------------------------------------------- */
import { COPY, GLYPH, TB_ROW_H, anchorEls, calKey, el, noteRec, state, uuid } from './state.js';
import { idbGet, idbGetAll, idbPut, saveNow, scheduleSave } from './persistence.js';
import { applyLayout, applyNoteWidth, effScale, LOGICAL_H, noteK, placeNote, renderX, renderY, setHitInset } from './geometry.js';
import { clearSelection, commitAction, completeNote, copyText, deleteNotes, hideToast, isEditing, multiSel } from './interactions.js';
import { restoreNote, selected, selectedNoteIds, setSelectedNotesHighlight, setSelectedNotesState, showNotice, showUndo, toggleHighlight } from './interactions.js';
import { syncBoardActions } from './menus.js';
import { catOf } from './boards.js';

// Element caches (render-owned): every note/lot element lookup routes here.
export const noteEls = new Map();           // note.id -> element
export const lotEls = new Map();            // lotItem.id -> element

/* B8 at rest, not only at blur (PRD §6.2): a frame whose editor never took
   focus never blurs, so husks already in storage are swept when their board
   is next drawn (B31). */
function sanitizeBoard(board) {
  /* Skip the record whose editor is open: renderBoard can run inside the 300ms
     save debounce, when its text lives only in the DOM node and reads as a
     whitespace husk from stale `current`. Notes and lot rows carry `id`. */
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
  // A note swept here (an empty husk) takes its links with it (B91).
  const linksChanged = pruneLinks(board);
  return board.notes.length !== n || board.parkingLot.length !== l || linksChanged;
}

/* The ladder rotates with the board type (B67): styles.css rebinds the token
   names under #board[data-cat=...], so this attribute is all render.js says
   about colour (no hex here, UIUX §2.2). catOf() defaults a record without a
   category to Note, the bucket the list files it in. */
export function applyBoardCat() {
  el.board.dataset.cat = catOf(state.current);
  /* B130: #pane sits outside #board's scope, so it carries its own data-cat;
     the ladder binds by direct id+attribute, so a child's never re-scopes. */
  el.pane.dataset.cat = catOf(state.current);
}

/* B133: the linked To-Do board's title seat is the day's, generated HERE at
   render and never stored (the stored `title` is ignored): the pinned name
   plus the board's `cal` date as MM/DD/YY beneath it. */
// Exported for boards.js: the card's title seat reads the same pair.
export const LINKED_TITLE = "Today's To Do";
export const linkedDate = (calKey) => {
  const p = calKey.split('-');                       // [YYYY, MM, DD]
  return p[1] + '/' + p[2] + '/' + p[0].slice(2);
};

/* The tab/OS-window title follows the view; chrome only. Board view shows the
   anchor's copy ('What's up?' when untitled); the picker and a drilled
   category name themselves. */
export function syncViewTitle() {
  const s = history.state;
  if (s && s.v === 'cat') document.title = `${COPY['cat' + s.cat[0].toUpperCase() + s.cat.slice(1)] || s.cat} · Zeved Boards`;
  else if (s && s.v === 'list') document.title = `All boards · Zeved Boards`;
  else {
    // B133: on a linked board the anchor's copy is the pinned name.
    const name = state.current && state.current.cal ? LINKED_TITLE
      : (state.current && state.current.title && state.current.title.trim()) || null;
    document.title = name ? `${name} · Zeved Boards` : 'Zeved Boards';
  }
}

/* ONLY the linked To Do board's MIRRORED Requirements lines render in read
   state as square blocks (B163; one-line chips on the phone tier, B164), in
   the calendar ladder's orange (.req-squares/.req-square, UIUX §2.2.2). The
   span is mirrorEventsOf's (state.js): the first `calReq` lines are the
   mirror's, the rest is the reader's hand and stays plain pre-wrap text. No
   `calReq` (never synced) renders no squares; syncMirror writes it on its
   first run and the next render converges (B21's read-site default).

   READ-state only: the string stays the single source of truth. The
   `.req-mirrored` flag lets enableEditing (interactions.js) restore plain
   \n-text before focus lands, so commitAnchor's plain-text read stays true. */
export function paintRequirementsRead(node, board) {
  const lines = (board.requirements || '').length ? board.requirements.split('\n') : [];
  // A live editor takes the plain paint: squares under a focused anchor would
  // let the next onInput write their concatenated text into the string the
  // mirror diffs. A negative calReq (a hand-edited import; export.js admits
  // any finite number) is clamped to the plain paint, not dropped lines.
  const editing = node.hasAttribute && node.hasAttribute('contenteditable');
  const span = (!editing && board.cal && typeof board.calReq === 'number')
    ? Math.max(0, Math.min(board.calReq, lines.length)) : 0;
  node.classList.toggle('req-mirrored', span > 0);
  if (span === 0) {
    node.textContent = board.requirements || '';   // exactly the plain paint
    return;
  }
  node.textContent = '';
  const grid = document.createElement('div');
  grid.className = 'req-squares';                 // the wrapping read-state row
  for (let i = 0; i < span; i++) {
    const sq = document.createElement('div');     // one square per mirrored line
    sq.className = 'req-square';
    sq.textContent = lines[i];
    grid.appendChild(sq);
  }
  node.appendChild(grid);
  // The grid is block-level, so the hand lines land beneath the squares.
  const hand = lines.slice(span);
  if (hand.length) node.appendChild(document.createTextNode(hand.join('\n')));
}

export function renderBoard() {
  clearSelection();                  // the note DOM is rebuilt below
  applyBoardCat();
  if (sanitizeBoard(state.current)) scheduleSave();
  syncViewTitle();
  // Anchors.
  const linked = !!state.current.cal;
  for (const key of ['title', 'components', 'requirements']) {
    const node = anchorEls[key];
    // B133: the linked board's generated title seat takes no editor, so it is
    // no textbox. The same element serves every board; other branches restore.
    if (key === 'title' && linked) {
      node.textContent = '';
      const name = document.createElement('span');
      name.className = 'title-pinned'; name.textContent = LINKED_TITLE;
      const date = document.createElement('span');
      date.className = 'title-date'; date.textContent = linkedDate(state.current.cal);
      node.append(name, date);
      node.classList.add('filled');                  // no "What's up?" placeholder
      node.removeAttribute('role'); node.removeAttribute('aria-multiline');
      node.removeAttribute('tabindex'); node.removeAttribute('contenteditable');
      continue;
    }
    // .filled reads the string whether or not squares paint it.
    if (key === 'requirements') paintRequirementsRead(node, state.current);
    else node.textContent = state.current[key] || '';
    node.classList.toggle('filled', !!(state.current[key] && state.current[key].length));
    if (key === 'title') {
      node.setAttribute('role', 'textbox');
      node.setAttribute('aria-multiline', 'true');
      node.setAttribute('tabindex', '0');
    }
  }
  // Notes (array order = z-order; DOM order mirrors it).
  noteEls.forEach(n => n.remove()); noteEls.clear();
  for (const note of state.current.notes) el.board.appendChild(makeNoteEl(note));
  hydrateSurfaced();                  // reminder echoes on today's To Do (B109)
  // Parking Lot.
  el.lotItems.textContent = ''; lotEls.clear();
  for (const item of state.current.parkingLot) el.lotItems.appendChild(makeLotEl(item));
  syncBoardActions();                // (B83)
  applyLayout();
}

/* The text and scratch-out children (UIUX §4.3) shared by a note, a surfaced
   echo and a lot row. `editable` is false only for the echo, which is inert
   (B109) and takes no role; a real text IS an editor (role=textbox, §12). */
function makeBody(node, cls, text, editable) {
  const body = document.createElement('div');
  body.className = cls + '-text';
  if (editable) {
    body.setAttribute('role', 'textbox');
    body.setAttribute('aria-multiline', 'true');
  }
  body.textContent = text;

  const scratch = document.createElement('div');
  scratch.className = cls + '-scratch';
  scratch.setAttribute('aria-hidden', 'true');

  node.appendChild(body); node.appendChild(scratch);
}

export function makeNoteEl(note) {
  const node = document.createElement('div');
  // .on-light flips the ink pole at the note's boundary (UIUX §2.3).
  node.className = 'note on-light' + (note.state === 'complete' ? ' complete' : '')
    + (note.highlighted ? ' highlight' : '');   // B71
  node.dataset.id = note.id;
  node.setAttribute('tabindex', '0');
  applyNoteWidth(node, note);
  placeNote(node, note);

  makeBody(node, 'note', note.text, true);
  renderNoteTitle(node, note);                               // (B120)
  setCarriedUi(node, note);                                  // (B110)
  node.appendChild(makeNoteToolbar(note));                   // (B84)
  setReminderUi(node, note);                                 // needs the row in place
  applyCompleteA11y(node, note.state === 'complete');
  // Both measure layout, so wait for the caller's appendChild (B120).
  requestAnimationFrame(() => { setHitInset(node, note); reflectToolbarSeat(node, note); });
  noteEls.set(note.id, node);
  return node;
}

/* --- 6.4 The reminder toggle (B104/B109) ---------------------------------- */

/* The clock toggle is the toolbar's third tab (B104): one tap sets or clears
   the reminder. Clearing DELETES the key (B21's absence-is-off idiom). The
   .note-clock class is the hook for the toggle path and the glow selector. */

/* The clock follows the record; aria carries the state too (UIUX §1). The
   .reminder CLASS also drives the card glow (B132), so it excludes completed
   notes, as setCarriedUi does; aria still reads the record. */
export function setReminderUi(node, note) {
  node.classList.toggle('reminder', note.state !== 'complete' && !!note.reminder);
  const b = node.querySelector('.note-clock');
  if (b) {
    b.setAttribute('aria-label', note.reminder ? COPY.unremind : COPY.remind);
    b.setAttribute('aria-pressed', String(!!note.reminder));
  }
}

/* The carried class is B108's `carriedOn` shadow, recomputed at render against
   today's key, never stored (B110). Complete wins (B108's completion law).
   Called from setNoteState too, so completion recomputes it in place. */
export function setCarriedUi(node, note) {
  node.classList.toggle('carried',
    note.state !== 'complete' && !!note.carriedOn && note.carriedOn === calKey(new Date()));
}

/* The clock's one write (B104): SET or DELETE, never falsed (B21). Shared by
   this board's note and a surfaced echo's, which writes its source record. */
function toggleReminder(rec) {
  if (rec.reminder) delete rec.reminder; else rec.reminder = true;
}

/* One clock activation (pointer tap or keyboard): commit on release through
   the B81 drop-guard. An echo's record lives on the source board, so the
   toggle writes there and recomputes the surfacing. */
export function runClockAction(btn) {
  const node = btn.closest('.note');
  if (!node) return;
  if (isEditing(document.activeElement)) { document.activeElement.blur(); return; }
  const id = node.dataset.id;
  const local = noteRec(id);
  commitAction(() => {
    if (local) {
      toggleReminder(local);
      setReminderUi(node, local);
      saveNow();
    } else {
      // Surfaced echo: glow off at once, then persist on the source board.
      setReminderUi(node, { reminder: false, state: 'active' });
      toggleSurfacedReminder(id);
    }
  });
}

/* --- 6.5 Surfaced reminder cards (B109) -----------------------------------
   A note with `reminder` set on any board other than today's linked To-Do
   renders an ECHO there, computed at render time: the record never leaves its
   board, so nothing can diverge. data-src-cat rebinds --note to the source
   hue. ACTIVE reminder notes surface; completing one or clearing its clock
   unsurfaces it. */

export const surfacedMap = new Map();      // note.id -> { boardId, note }
let surfacedToken = 0;                     // stale-async guard across re-renders

function clearSurfaced() {
  surfacedMap.clear();
  for (const n of [...el.board.querySelectorAll('.note.surfaced')]) n.remove();
}

function makeSurfacedEl(note, srcBoard) {
  const node = document.createElement('div');
  // Inert to tap/drag/edit (interactions.js finds no record here); long-press
  // or right-click reaches its two menu acts.
  node.className = 'note on-light surfaced reminder';
  node.dataset.id = note.id;
  node.dataset.srcBoard = srcBoard.id;
  node.dataset.srcCat = catOf(srcBoard);
  node.setAttribute('tabindex', '0');
  applyNoteWidth(node, note);
  placeNote(node, note);

  makeBody(node, 'note', note.text, false);
  /* The echo's one-tab row: the clock's recognizer route writes the SOURCE
     record (toggleSurfacedReminder). An active reminder always reads
     "Remove reminder". */
  const bar = document.createElement('div');
  bar.className = 'note-toolbar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Note actions');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'note-tb-btn on-light note-clock';
  b.innerHTML = GLYPH.clock;
  b.setAttribute('aria-label', COPY.unremind);
  b.setAttribute('aria-pressed', 'true');
  bar.appendChild(b);
  node.appendChild(bar);
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
      if (typeof b.title !== 'string') continue;           // skip event records
      if (b.id === board.id || b.cal === board.cal) continue;
      for (const n of (b.notes || [])) {
        if (!n.reminder || n.state === 'complete') continue;
        surfacedMap.set(n.id, { boardId: b.id, note: n });
        el.board.appendChild(makeSurfacedEl(n, b));
      }
    }
  });
}

/* A surfaced echo's SOURCE record, read fresh from the store (the echo holds
   no state, B109): the board record and its note. Null when either is gone. */
async function surfacedRecord(id) {
  const surf = surfacedMap.get(id);
  if (!surf) return null;
  const rec = await idbGet(surf.boardId);
  const note = rec && (rec.notes || []).find((m) => m.id === id);
  return note ? { rec, note } : null;
}

/* The surfaced card's two menu acts (B109) write the SOURCE record, then
   re-render today's board to recompute the surfacing. Completing clears
   carriedOn as setNoteState does (B108). */
export async function completeSurfaced(id) {
  const src = await surfacedRecord(id);
  if (!src || src.note.state === 'complete') return;
  src.note.state = 'complete';
  if (src.note.carriedOn) delete src.note.carriedOn;
  await idbPut(src.rec);
  renderBoard();
}

async function toggleSurfacedReminder(id) {
  const src = await surfacedRecord(id);
  if (!src) return;
  toggleReminder(src.note);
  await idbPut(src.rec);
  renderBoard();
}

/* The note's action toolbar (B84, UIUX §4.5 / UIUX §14): flat tabs on the
   note's bottom edge, Delete last in --danger. A CHILD of the note, so it
   scales with it. Drawn always, shown on select/focus (CSS), routed through
   the recognizer, not native clicks (B84). Each GLYPH SVG is aria-hidden with
   the label on the button (UIUX §13.3). */
function makeNoteToolbar(note) {
  const bar = document.createElement('div');
  bar.className = 'note-toolbar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Note actions');
  const mk = (cls, glyph, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    // .on-light: --ink-dark on --frame (B76); note-tb-btn: classifyTarget hook.
    b.className = 'note-tb-btn on-light ' + cls;
    b.innerHTML = glyph;
    b.setAttribute('aria-label', label);
    bar.appendChild(b);
    return b;
  };
  const done = note.state === 'complete';
  mk('note-tb-complete', done ? GLYPH.restore : GLYPH.complete, done ? COPY.restore : COPY.complete);
  mk('note-tb-highlight', GLYPH.highlight, note.highlighted ? COPY.unhighlight : COPY.highlight);
  const clock = mk('note-clock', GLYPH.clock, note.reminder ? COPY.unremind : COPY.remind);
  clock.setAttribute('aria-pressed', String(!!note.reminder));   // setReminderUi mirrors it
  mk('note-tb-delete', GLYPH.delete, COPY.delete);           // last (UIUX §7)
  return bar;
}

/* Complete flips its mark and label with the note's state; Highlight flips
   only its label (its look is CSS off .note.highlight; never colour alone,
   UIUX §1). */
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

/* The row hangs below the note's bottom edge, centred (B120). It is a note
   child, so its logical height scales with effScale; if it would pass the
   sheet, the note is raised so the flush-below seat fits. Returns true when
   raised so callers can batch their save. */
export function reflectToolbarSeat(node, note, save = true) {
  const need = node.offsetHeight + TB_ROW_H * effScale(note); // card + row, logical
  const maxY = Math.max(0, LOGICAL_H - need);
  if (renderY(note) > maxY) {
    note.y = maxY / noteK(note);      // board units, so renderY(note) ≡ maxY
    node.style.top = maxY + 'px';
    if (save) saveNow();              // the raise is committed state
    return true;
  }
  return false;
}

/* A frame change re-seats every note (the seat is a law of the current frame);
   fired from boards' frameReflow hook after layout reflows. */
export function seatAllNotes() {
  if (!state.current) return;
  let raised = false;
  noteEls.forEach((node, id) => {
    const note = noteRec(id);
    if (note && reflectToolbarSeat(node, note, false)) raised = true;
  });
  // B170: echoes share their source note's geometry; render-time only.
  for (const node of el.board.querySelectorAll('.note.surfaced')) {
    const surfaced = surfacedMap.get(node.dataset.id);
    const note = surfaced && surfaced.note;
    if (!note) continue;
    placeNote(node, note);
  }
  if (raised) saveNow();              // one save for the whole pass
}

/* The note's optional Title (B120): a tab peeking from BEHIND the card's
   top-left corner, a child of the note. z-index 0 sits above the hit collar
   but under .note-text (z-index 1), which covers the tab's tucked feet. Shared
   by the render path and the menu's edit path (created empty for typing). */
export function ensureNoteTitleEl(node) {
  let tab = node.querySelector('.note-title');
  if (tab) return tab;
  tab = document.createElement('div');
  tab.className = 'note-title';
  tab.addEventListener('keydown', (e) => {           // single line: Enter commits
    if (e.key === 'Enter') { e.preventDefault(); tab.blur(); }
  });
  node.prepend(tab);                                 // before .note-text (paint order)
  return tab;
}
/* An empty title (B21 read-site default) renders no tab, reserves no space. */
function renderNoteTitle(node, note) {
  const t = note.title || '';
  if (!t) { const tab = node.querySelector('.note-title'); if (tab) tab.remove(); return; }
  ensureNoteTitleEl(node).textContent = t;
}

/* The ids one note act runs on: the whole desktop multi-selection when this
   note is its PRIMARY, else this note alone (mobile has no selection). Shared
   by Copy and the toolbar so "which notes" cannot diverge. */
function actionNoteIds(id) {
  const inMulti = selected && selected.kind === 'note' &&
                  multiSel.size > 1 && multiSel.has(id);
  return inMulti ? selectedNoteIds() : [id];
}

/* Copy one note's text, or the whole desktop selection's, primary first, one
   \n between (B114). note.text is live off every keystroke, so Copy needs no
   blur and leaves the note engaged. The caller supplies the commit. */
export function copyNoteTexts(anchorId) {
  const ids = actionNoteIds(anchorId);
  copyText(ids.map(id => {
    const n = noteRec(id);
    return n ? n.text : '';
  }).join('\n'));
}

/* One toolbar action (tap via handleTap, or keyboard), committed on release
   through the B81 drop-guard. Acts on the whole multi-selection when this note
   is its desktop primary, else on this note alone. */
export function runNoteToolbarAction(btn) {
  const noteNode = btn.closest('.note');
  if (!noteNode) return;
  const note = noteRec(noteNode.dataset.id);
  if (!note) return;
  const editingHere = () =>
    isEditing(document.activeElement) && noteNode.contains(document.activeElement);
  commitAction(() => {
    const ids = actionNoteIds(note.id);
    if (btn.classList.contains('note-tb-delete')) {
      if (editingHere()) document.activeElement.blur();   // no editor in the leaving node
      deleteNotes(ids);                                   // one commit → one Undo
    } else if (btn.classList.contains('note-tb-highlight')) {
      // The wash leaves the text editable, so Highlight keeps the note engaged.
      if (ids.length > 1) setSelectedNotesHighlight(!note.highlighted);
      else toggleHighlight(noteNode);                     // primary keys the direction
    } else {                                              // complete / restore
      // Completing buries the text (UIUX §4.3): commit an open editor first.
      if (editingHere()) document.activeElement.blur();
      if (ids.length > 1) setSelectedNotesState(note.state === 'complete');
      else if (note.state === 'complete') restoreNote(noteNode); else completeNote(noteNode);
    }
  });
}

export function makeLotEl(item) {
  const node = document.createElement('div');
  node.className = 'lot-item' + (item.state === 'complete' ? ' complete' : '');
  node.dataset.id = item.id;
  node.setAttribute('tabindex', '0');

  makeBody(node, 'lot', item.text, true);
  applyCompleteA11y(node, item.state === 'complete');
  lotEls.set(item.id, node);
  return node;
}

export function applyCompleteA11y(node, complete) {
  const text = node.querySelector('.note-text, .lot-text');
  if (complete) {
    node.setAttribute('aria-label', 'completed note');
    text.setAttribute('aria-hidden', 'true');
  } else {
    node.removeAttribute('aria-label');
    text.removeAttribute('aria-hidden');
  }
}

/* --- 6.6 Note links (B91) ------------------------------------------------
   A relationship the user ASSERTS between two notes (PRD §1: asserted, not
   inferred), stored per board as unordered {id,a,b} pairs and drawn as a 1px
   --frame SVG line between the notes' centres, BELOW them (pointer-events:none
   so it never intercepts a tap). Link menu item → tap the next note connects;
   tapping a linked note unlinks (toggle). Deleting a note removes its links;
   note-undo restores them (deleteNotes). */

// The armed source note's id, or null: a single-id transient mode (the mobile
// `engaged` idiom, B90), cleared on resolve, cancel, drag, Escape, selection
// change or board swap (clearSelection).
export let linkSource = null;

export const boardLinks = () => (state.current && state.current.links) || [];   // B21
const findLink = (a, b) =>
  boardLinks().find(l => (l.a === a && l.b === b) || (l.a === b && l.b === a));

/* Create the link, or remove it if already linked (B91). A committing
   consequence: the caller wraps it in commitAction so a double-tap can't
   double-fire. Either direction offers a 5s Undo (UIUX §9), whose closures read
   current.links as deleteNotes reads current.notes. */
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

// Drop links touching `ids`; returns them for a caller's Undo (UIUX §9). Shared
// by the pre-act blur's discarded note and a batch delete.
export function removeLinksFor(ids) {
  if (!state.current || !state.current.links || !state.current.links.length) return [];
  const removed = state.current.links.filter(l => ids.has(l.a) || ids.has(l.b));
  if (removed.length) state.current.links = state.current.links.filter(l => !ids.has(l.a) && !ids.has(l.b));
  return removed;
}

// Drop links whose endpoints are gone (a swept husk, B31/B8); returns whether
// anything changed so sanitizeBoard's caller re-saves.
function pruneLinks(board) {
  if (!board.links || !board.links.length) return false;
  const ids = new Set(board.notes.map(n => n.id));
  const before = board.links.length;
  board.links = board.links.filter(l => ids.has(l.a) && ids.has(l.b));
  return board.links.length !== before;
}

/* Arming is navigation: it commits nothing a stray tap could duplicate (B81),
   so it runs raw. A persistent hint states the act; clearLink retracts it. */
export function beginLink(id) {
  linkSource = id;
  showNotice(state.isDesktop ? COPY.linkHintClick : COPY.linkHintTap, 'link');
}
export function clearLink() {
  if (linkSource === null) return;
  linkSource = null;
  if (el.toast.dataset.mode === 'link') hideToast();
}

/* The link layer: one <svg> in board space, sibling of the notes, so it rides
   #board's translate+scale. pointer-events:none (CSS): hit-testing is
   target.closest()-based, so a hittable line would steal note taps. z-index:1
   is below the z:2 notes and, appended after the furniture, above it (B91). */
const SVGNS = 'http://www.w3.org/2000/svg';
let linkLayer = null;
const linkLineEls = new Map();       // link.id -> <line>
function ensureLinkLayer() {
  if (linkLayer) return;
  linkLayer = document.createElementNS(SVGNS, 'svg');
  linkLayer.id = 'link-layer';
  linkLayer.setAttribute('aria-hidden', 'true');
  el.board.appendChild(linkLayer);
}
// A note's centre in board-logical px, as updateSelectionUI computes it.
function noteCenter(note, node) {
  return { x: renderX(note) + node.offsetWidth * effScale(note) / 2,
           y: renderY(note) + node.offsetHeight * effScale(note) / 2 };
}
/* Redraw every link line from the notes' current geometry: call from every
   site that moves a note and after any link add/remove. A missing endpoint is
   skipped (dangling-safe until sanitizeBoard prunes it). */
export function updateLinks() {
  const links = boardLinks();
  if (!links.length && !linkLayer) return;
  ensureLinkLayer();
  const live = new Set();
  for (const link of links) {
    const na = noteRec(link.a);
    const nb = noteRec(link.b);
    const ea = noteEls.get(link.a), eb = noteEls.get(link.b);
    if (!na || !nb || !ea || !eb) continue;
    const ca = noteCenter(na, ea), cb = noteCenter(nb, eb);
    let line = linkLineEls.get(link.id);
    if (!line) {
      line = document.createElementNS(SVGNS, 'line');
      linkLineEls.set(link.id, line);
      linkLayer.appendChild(line);
    }
    line.setAttribute('x1', ca.x); line.setAttribute('y1', ca.y);
    line.setAttribute('x2', cb.x); line.setAttribute('y2', cb.y);
    live.add(link.id);
  }
  for (const [id, line] of linkLineEls) {
    if (!live.has(id)) { line.remove(); linkLineEls.delete(id); }
  }
}

/* Region init: boot() calls registerRender(); no load-time work.

   Keyboard operability (UIUX §12 / UIUX §4.5): the recognizer captures the
   pointer path, so Enter/Space on a focused tab is the one activation it never
   sees. stopPropagation keeps it off the desktop note grammar, else Enter on a
   selected note's tab would ALSO edit the note. The tabs are the keyboard
   route to Complete/Highlight (B84); Copy rides the menu's focusable items
   (B114). */
export function registerRender() {
  el.board.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const clock = e.target.closest && e.target.closest('.note-clock');
    if (clock) {                    // (B109)
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