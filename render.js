/* --- 6. Rendering -------------------------------------------------------- */
import { COPY, GLYPH, TB_ROW_H, anchorEls, calKey, el, noteRec, state, uuid } from './state.js';
import { idbGet, idbGetAll, idbPut, saveNow, scheduleSave } from './persistence.js';
import { applyLayout, applyNoteWidth, effScale, LOGICAL_H, noteK, placeNote, renderX, renderY, setHitInset } from './geometry.js';
import { clearSelection, commitAction, completeNote, copyText, deleteNotes, hideToast, isEditing, multiSel } from './interactions.js';
import { restoreNote, selected, selectedNoteIds, setSelectedNotesHighlight, setSelectedNotesState, showNotice, showUndo, toggleHighlight } from './interactions.js';
import { syncBoardActions } from './menus.js';
import { catOf } from './boards.js';

// Element caches (render-owned): every note/lot element lookup in the app
// routes through these Maps. Declared at the region header so the render
// module owns them and every other region imports the binding.
export const noteEls = new Map();           // note.id -> element
export const lotEls = new Map();            // lotItem.id -> element

/* B8 at rest, not only at blur: "no empty frames ever exist" (PRD §6.2). The
   blur discard covers a frame the user abandons; it cannot cover one whose
   editor never took focus, because no blur ever comes. Any such husk already
   in storage is swept the next time its board is drawn (B31). Rendering is
   the right layer: it is the one choke point every board passes through, and
   it rebuilds the frames anyway. */
function sanitizeBoard(board) {
  /* The sweep must not eat what an open editor is still writing. renderBoard
     runs on flows that can land inside the 300ms save debounce — a board swap,
     a rail re-read, a visibility flip — and a record whose text still lives
     only in its DOM node reads as a whitespace husk from stale `current`. Skip
     the record whose editor is open this render; the sweep is per-render, so
     the husk (if it survives blur) is swept on the next one. Same id for notes
     and lot rows: both records carry `id`. */
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

/* The ladder rotates with the board type (B67). This attribute is the whole of
   what render.js says about colour: styles.css rebinds the ladder's token
   names under #board[data-cat=...], so every layer that draws the board picks
   up the new hue through the var() it already reads. No hex belongs here
   (UIUX §2.2 is the rendering authority). catOf() is the read-site default, so a
   record without a category renders as a Note board — the same bucket the list
   files it in, which is the agreement the card preview depends on. Both call
   sites have already established `current`. */
export function applyBoardCat() {
  el.board.dataset.cat = catOf(state.current);
  /* B130: the All-Boards rail wears the same ladder as the board it stands on.
     #pane sits outside #board's scope, so it carries its own data-cat —
     styles.css rebinds the same rungs under #pane[data-cat=...]. The rail's
     own children (.cat-button/.board-cat) carry data-cat too, but the ladder
     binds by direct id+attribute, so a child's attribute never re-scopes the
     pane. */
  el.pane.dataset.cat = catOf(state.current);
}

/* B133: the linked To-Do board's own title seat is the day's, not the
   reader's. The name is the pinned string and the board's date rides on a line
   beneath it, both generated HERE at render — never stored, so the board's
   stored `title` is simply ignored at this seat. The date reads MM/DD/YY
   straight off the board's `cal` key (zero-padded month/day, the year's last
   pair). Every other board keeps its ordinary editable title. */
// Exported for boards.js: the card's title seat reads the same pinned name +
// date pair — one authority, no second string or formatter.
export const LINKED_TITLE = "Today's To Do";
export const linkedDate = (calKey) => {
  const p = calKey.split('-');                       // [YYYY, MM, DD]
  return p[1] + '/' + p[2] + '/' + p[0].slice(2);
};

/* The tab/OS-window title follows the view. Chrome only — nothing on the
   canvas reads or renders it; the views themselves stay exactly as specified
   in UIUX §10. Board view shows the board's own title text (the anchor's copy,
   'What's up?' when untitled — the same rule renderBoard applies to the
   anchor); the picker and a drilled category name themselves. */
export function syncViewTitle() {
  const s = history.state;
  if (s && s.v === 'cat') document.title = `${COPY['cat' + s.cat[0].toUpperCase() + s.cat.slice(1)] || s.cat} · Zeved Boards`;
  else if (s && s.v === 'list') document.title = `All boards · Zeved Boards`;
  else {
    // B133: the tab carries the anchor's copy — on a linked board that copy is
    // the pinned name, not the stored title.
    const name = state.current && state.current.cal ? LINKED_TITLE
      : (state.current && state.current.title && state.current.title.trim()) || null;
    document.title = name ? `${name} · Zeved Boards` : 'Zeved Boards';
  }
}

/* ONLY the linked To Do board's MIRRORED Requirements lines render in read
   state as square blocks (B163; the phone tier draws each as a one-line chip,
   B164) — the calendar's .cal-note species, board-scoped
   (.req-squares/.req-square, UIUX §2.2.2) — in the calendar ladder's own
   orange, deliberately apart from this board's blue. The span is
   mirrorEventsOf's own law (state.js): the first `calReq` lines are the
   mirror's, everything after them is the reader's hand and stays plain
   pre-wrap text. A board that has never synced carries no `calReq`, and
   `typeof !== 'number'` renders no squares — safe, because syncMirror writes
   the span on its first run and the next render converges (B21's
   read-site-default idiom, no migration). Non-linked boards have no span and
   are untouched by this function entirely.

   The string stays the single source of truth: this is READ-state rendering
   only. The `.req-mirrored` flag it leaves on the anchor is what lets
   enableEditing (interactions.js, the one edit funnel) restore the plain
   \n-text mode before focus lands, so the editing grammar is unchanged — one
   contenteditable anchor — and commitAnchor's plain-text read stays true. */
export function paintRequirementsRead(node, board) {
  const lines = (board.requirements || '').length ? board.requirements.split('\n') : [];
  // A live editor takes the plain paint: no path renders squares under a
  // focused anchor today (every gesture/navigation path blurs and commits
  // first), but if one ever does, the next onInput would write the squares'
  // concatenated text into the string the mirror's diff reads — this
  // guard makes that invariant structural, not incidental. A negative calReq
  // (only a hand-edited import can carry one; export.js admits any finite
  // number) is clamped with it, so the read paint degrades to exactly the
  // plain paint instead of dropping leading lines.
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
  // The hand lines ride AFTER the grid in the anchor's own pre-wrap grammar:
  // the grid is block-level, so they land beneath the squares, \n and all.
  const hand = lines.slice(span);
  if (hand.length) node.appendChild(document.createTextNode(hand.join('\n')));
}

export function renderBoard() {
  clearSelection();                  // note DOM is about to be rebuilt
  applyBoardCat();
  if (sanitizeBoard(state.current)) scheduleSave();
  syncViewTitle();
  // Anchors.
  const linked = !!state.current.cal;
  for (const key of ['title', 'components', 'requirements']) {
    const node = anchorEls[key];
    // B133: the linked board's title seat is generated (pinned name + date
    // line), and takes no editor — so it is not a textbox: no role, no
    // tabindex, no contenteditable. Restored on every other board, because the
    // same element serves both (a swap re-renders it).
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
    // The Requirements anchor's READ state is the mirror's squares on a
    // linked board (paintRequirementsRead above); the .filled flag still reads
    // the string, because squares or not it is the same one string that is
    // filled or empty.
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
  syncBoardActions();                // the toggle reads All boards on a drawn board (B83)
  applyLayout();
}

/* The text a note (or a lot row) carries, and the scratch-out that strikes
   through it when the item completes (UIUX §4.3): two children, one factory,
   for the three species that wear them — a note, a surfaced echo, and a lot
   row — so `.note-text`/`.note-scratch` and `.lot-text`/`.lot-scratch` are
   built in exactly one place.

   `editable` is the one thing that differs, and it is the surfaced echo's: a
   real note's text IS an editor, so it carries role=textbox and
   aria-multiline (UIUX §12), while the echo is inert to tap/drag/edit (B109)
   — it renders the source note's words and takes no role at all. */
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
  // .on-light: the ink pole flips at the note's boundary (UIUX §2.3), and the
  // scratch-out inside strikes in the note's own dark ink.
  node.className = 'note on-light' + (note.state === 'complete' ? ' complete' : '')
    + (note.highlighted ? ' highlight' : '');   // B71: an amber wash, toggled per note
  node.dataset.id = note.id;
  node.setAttribute('tabindex', '0');
  applyNoteWidth(node, note);                               // wrap at the sheet edge
  placeNote(node, note);                                    // left / top / the similarity (B64)

  makeBody(node, 'note', note.text, true);
  renderNoteTitle(node, note);                               // the Title tab (B120) — absent when empty
  setCarriedUi(node, note);                                  // the carried status shadow (B110)
  node.appendChild(makeNoteToolbar(note));                   // the on-select action row (B84), Remind included
  setReminderUi(node, note);                                 // class + aria follow the record (needs the row in place)
  applyCompleteA11y(node, note.state === 'complete');
  // Both reads need layout, so they run once the node is in the DOM (the same
  // frame as the caller's appendChild): the hit collar measures, and the flip
  // measures the note's bottom for the row's near-sheet-bottom flip (B120).
  requestAnimationFrame(() => { setHitInset(node, note); reflectToolbarSeat(node, note); });
  noteEls.set(note.id, node);
  return node;
}

/* --- 6.4 The reminder toggle (B104/B109) ---------------------------------- */

/* The clock toggle is the toolbar's third tab: one tap sets or clears the
   reminder (B104) — no picker, no dialog, no time. Off the record stays lean:
   clearing DELETES the key (B21's absence-is-off idiom), so a legacy note and
   a cleared one are the same shape. makeNoteToolbar draws the tab with the
   .note-clock class, which the toggle path (interactions.js) and the glow
   selector (.note.reminder .note-clock) key on. */

/* The clock's look follows the record (aria carries the state too — never
   colour alone, UIUX §1). Called from the render paths and the toggle. The
   .reminder CLASS also drives the card-frame glow (B132), so it excludes
   completed notes — the same guard setCarriedUi applies: a completed note
   never glows even if a legacy record kept the key (the aria state still
   reads the record). */
export function setReminderUi(node, note) {
  node.classList.toggle('reminder', note.state !== 'complete' && !!note.reminder);
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

/* The clock's one write (B104): the reminder key is SET or DELETED — never
   falsed, so a cleared note and a legacy note that never carried one are the
   same shape (B21's absence-is-off idiom). One definition for the two toggles
   that write it: this board's own note (below) and a surfaced echo's, whose
   clock writes the same field on the same source record. */
function toggleReminder(rec) {
  if (rec.reminder) delete rec.reminder; else rec.reminder = true;
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
  const local = noteRec(id);
  commitAction(() => {
    if (local) {
      toggleReminder(local);
      setReminderUi(node, local);
      saveNow();
    } else {
      // Surfaced echo: immediately update its UI for instant feedback (glow off),
      // then persist the change on the source board and re-render.
      setReminderUi(node, { reminder: false, state: 'active' });
      toggleSurfacedReminder(id);
    }
  });
}

/* --- 6.5 Surfaced reminder cards (B109) -----------------------------------
   A note with `reminder` set on ANY board other than today's linked To-Do
   renders an ECHO of itself there — one source of truth (the record never
   leaves its board; nothing is copied, so nothing can diverge), computed at
   render time like sanitizeBoard's sweep. The echo wears the source board's
   note hue (data-src-cat rebinds --note, the ladder's own discipline). The
   surfacing set is ACTIVE reminder notes: completing one anywhere unsurfaces
   it, and the same is true of clearing its clock. */

export const surfacedMap = new Map();      // note.id -> { boardId, note } — the echoes on screen
let surfacedToken = 0;                     // stale-async guard across re-renders

function clearSurfaced() {
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
  placeNote(node, note);

  makeBody(node, 'note', note.text, false);      // inert: no textbox role, no editor (B109)
  /* B109's echo carries the Remind tab on its own one-tab row: the echo is
     inert to tap/drag/edit, but the clock's recognizer route writes the SOURCE
     record through (toggleSurfacedReminder). aria mirrors the source record —
     an active reminder always reads "Remove reminder". */
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
      if (typeof b.title !== 'string') continue;           // event records ride the store
      if (b.id === board.id || b.cal === board.cal) continue;
      for (const n of (b.notes || [])) {
        if (!n.reminder || n.state === 'complete') continue;
        surfacedMap.set(n.id, { boardId: b.id, note: n });
        el.board.appendChild(makeSurfacedEl(n, b));
      }
    }
  });
}

/* A surfaced echo's SOURCE record, read fresh out of the store — the echo
   holds no state of its own (B109), so both of its acts resolve the same pair
   before they write: the board record and the note inside it. Null when the
   echo has left the screen or its source record has left the store. */
async function surfacedRecord(id) {
  const surf = surfacedMap.get(id);
  if (!surf) return null;
  const rec = await idbGet(surf.boardId);
  const note = rec && (rec.notes || []).find((m) => m.id === id);
  return note ? { rec, note } : null;
}

/* The two acts a surfaced card's menu carries (B109). Both write the SOURCE
   record through — then re-render today's board, which recomputes the
   surfacing set. Completing clears a carriedOn marker under the same law as
   setNoteState (B108). */
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
  renderBoard();                        // clock-off unsurfaces; nothing to re-add
}

/* The note's action toolbar (B84, UIUX §4.5 / UIUX §14): flat tabs on the
   note's bottom edge — Complete/Restore · Highlight · Remind · Delete, Delete
   last in --danger. It is a CHILD of the note, so it scales with it (never
   wider than the note it belongs to) and rides the board's renderScale like
   every other mark. It is drawn always but shown only on select/focus (CSS);
   routed through the recognizer, not native clicks (B84, like .sel-btn). The
   marks are GLYPH's own drawn SVG (UIUX §13.3), each SVG aria-hidden with the
   label on the button for AT. */
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
  const clock = mk('note-clock', GLYPH.clock, note.reminder ? COPY.unremind : COPY.remind);
  clock.setAttribute('aria-pressed', String(!!note.reminder));   // setReminderUi keeps this mirrored
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

/* The row hangs below the note's bottom edge, centred (B120). The row is a
   note child, so its board-logical height scales with the note (effScale). If
   the row would extend past the sheet, the note itself is raised so the
   flush-below seat still fits. renderY is stable across fold/renderScale.
   Returns true when the note was raised (so callers can batch their save). */
export function reflectToolbarSeat(node, note, save = true) {
  const need = node.offsetHeight + TB_ROW_H * effScale(note); // card + row, logical
  const maxY = Math.max(0, LOGICAL_H - need);
  if (renderY(note) > maxY) {
    note.y = maxY / noteK(note);      // stored in board units so renderY(note) ≡ maxY
    node.style.top = maxY + 'px';
    if (save) saveNow();              // the raise is committed state, not a visual lie
    return true;
  }
  return false;
}

/* A frame change (viewport, fold, URL-bar show/hide) re-seats every note —
   the seat is a law of the current frame, never a stale verdict. Fired from
   boards' frameReflow hook after layout reflows. */
export function seatAllNotes() {
  if (!state.current) return;
  let raised = false;
  noteEls.forEach((node, id) => {
    const note = noteRec(id);
    if (note && reflectToolbarSeat(node, note, false)) raised = true;
  });
  // B170: echoes share their source note's geometry on every frame reflow;
  // this changes only the render-time reference, never the stored record.
  for (const node of el.board.querySelectorAll('.note.surfaced')) {
    const surfaced = surfacedMap.get(node.dataset.id);
    const note = surfaced && surfaced.note;
    if (!note) continue;
    placeNote(node, note);
  }
  if (raised) saveNow();              // one save for the whole pass, not one per note
}

/* The note's optional Title (B120): a header-style tab peeking from BEHIND the
   card's top-left corner. One element factory, two callers — the render path
   (the record already carries a title) and the menu's edit path (the tab is
   created empty for typing). It is a CHILD of the note, so it scales with it;
   z-index 0 keeps it above the note's hit collar but under the card body
   (.note-text, z-index 1), which covers the tab's tucked feet — the peek reads
   as a note slid up from behind. */
export function ensureNoteTitleEl(node) {
  let tab = node.querySelector('.note-title');
  if (tab) return tab;
  tab = document.createElement('div');
  tab.className = 'note-title';
  tab.addEventListener('keydown', (e) => {           // a single line: Enter commits
    if (e.key === 'Enter') { e.preventDefault(); tab.blur(); }
  });
  node.prepend(tab);                                 // before .note-text: the card body paints over it
  return tab;
}
/* The render path: an empty title (the B21 read-site default) renders nothing —
   no tab, no reserved space; a non-empty one renders (or updates) the tab. */
function renderNoteTitle(node, note) {
  const t = note.title || '';
  if (!t) { const tab = node.querySelector('.note-title'); if (tab) tab.remove(); return; }
  ensureNoteTitleEl(node).textContent = t;
}

/* The ids one note act runs on: the whole desktop multi-selection when this
   note is its PRIMARY, else this note alone. Mobile has no selection, so it is
   always the single note. One definition for Copy and for the toolbar's acts,
   so "which notes did that touch" cannot diverge between them. */
function actionNoteIds(id) {
  const inMulti = selected && selected.kind === 'note' &&
                  multiSel.size > 1 && multiSel.has(id);
  return inMulti ? selectedNoteIds() : [id];
}

/* Copy one note's text — or, where the desktop multi-selection reaches the
   menu, the whole selection's, primary first, one \n between (B114). One home
   for the act: the note menu's Copy item routes here, so the join expression
   has exactly one definition. note.text is live off every keystroke (the input
   handler), so Copy needs no blur — it copies the current text and leaves the
   note engaged. The caller supplies the commit (buildMenu's commitAction
   drop-guard). */
export function copyNoteTexts(anchorId) {
  const ids = actionNoteIds(anchorId);
  copyText(ids.map(id => {
    const n = noteRec(id);
    return n ? n.text : '';
  }).join('\n'));
}

/* One toolbar action, from a pointer tap (handleTap) or the keyboard (below).
   Commits on release through the B81 drop-guard. Acts on the whole multi-
   selection when this note is the desktop primary of one, else on this note
   alone — mobile has no selection, so it is always the single note. */
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
      if (editingHere()) document.activeElement.blur();   // no dangling editor in the leaving node
      deleteNotes(ids);                                   // one commit → one Undo
    } else if (btn.classList.contains('note-tb-highlight')) {
      // The wash leaves the text editable, so Highlight keeps the note engaged
      // too (mobile can toggle it twice without re-tapping).
      if (ids.length > 1) setSelectedNotesHighlight(!note.highlighted);
      else toggleHighlight(noteNode);                     // primary keys the direction
    } else {                                              // complete / restore
      // Completing buries the text (UIUX §4.3), so an open editor on this note
      // commits first — the veil never falls over a live caret.
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

// Drop links touching any of `ids` (a deleted note); returns the removed links
// so a caller's Undo can restore them (exact prior state, UIUX §9). One
// definition for the two sites that drop links — a note the pre-act blur just
// discarded, and a batch delete — so a Set of one is the same call as the
// whole selection's.
export function removeLinksFor(ids) {
  if (!state.current || !state.current.links || !state.current.links.length) return [];
  const removed = state.current.links.filter(l => ids.has(l.a) || ids.has(l.b));
  if (removed.length) state.current.links = state.current.links.filter(l => !ids.has(l.a) && !ids.has(l.b));
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
   math. pointer-events:none (CSS) — hit-testing is target.closest()-based, so
   a hittable line would steal note taps. z-index:1 (CSS): below the z:2 notes
   and, appended after the static furniture, above the z:1 furniture (B91). */
const SVGNS = 'http://www.w3.org/2000/svg';
let linkLayer = null;                  // the one <svg> the link lines ride in
const linkLineEls = new Map();       // link.id -> <line>
function ensureLinkLayer() {
  if (linkLayer) return;
  linkLayer = document.createElementNS(SVGNS, 'svg');
  linkLayer.id = 'link-layer';
  linkLayer.setAttribute('aria-hidden', 'true');
  el.board.appendChild(linkLayer);
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

/* Region init: the keydown listener is attached by registerRender(), called
   from boot() — no module does load-time work.

   Keyboard operability (UIUX §12 / UIUX §4.5): the pointer path routes through
   the recognizer (setPointerCapture retargets native clicks), so a keyboard
   Enter/Space on a focused tab is the ONE activation the recognizer never
   sees. This handles it, and stopPropagation keeps it off the desktop note
   grammar — without it, Enter on a selected note's tab would ALSO edit the
   note. The tabs are the keyboard route to Complete/Highlight (B84); Copy
   rides the menu's own focusable items (B114). */
export function registerRender() {
  el.board.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
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