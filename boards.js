/* --- 11. Board list + routing -------------------------------------------- */
import {
  BOARD_CATS, CAT_SEC_GAP, CE, COPY, GRID_ORDER, GLYPH, LEAVE_MS,
  LIST_CARD_COLS, LIST_CARD_H, LIST_CAT_ROW, LONGPRESS_MS, MOVE_THRESHOLD,
  PANE_CAT_HEAD, PANE_PAGER_H, PANE_ROW_GAP, SWAP_MS, boardsOf, calBoardOf,
  calDayName, calEventsOf, calKey, calMD, calWindow, catOf, el, EMBED,
  ensureLinkedBoard, eventsOf, histPush, isSquare, live, makeDayNoteRecord,
  mirrorLine, mirrorSquaresOf, newBoardRecord, pad2, squareFromEvent, squareOrder,
  squareText, squaresOf, state, syncMirror,
} from './state.js';
import { cancelPendingSave, flushSave, idbDelete, idbGet, idbGetAll, idbPut, persist, saveNow, scheduleSave } from './persistence.js';
import { caretToEnd, hitInset, onFrameReflow, setCalSqueeze, setPaneCollapsed } from './geometry.js';
import { applyBoardCat, linkedDate, LINKED_TITLE, renderBoard, seatAllNotes, syncViewTitle } from './render.js';
import { commitAction, hideToast, leave, showUndo, undoTimer } from './interactions.js';
import { buildMenu, closeMenu, menuPoint, syncBoardActions } from './menus.js';
import { exportBoardPdf } from './export.js';

/* Two-level navigation (B74). `listOpen` covers both levels; `catView` is the
   drilled category (level 2) or null at the picker (level 1); `lotMenuOpen`
   is mobile only (the picker is the lot turned into a grid). History carries
   {v:'list'} / {v:'cat',cat} so back goes drill -> picker -> board (B9). */
export let listOpen = false;
export let catView = null;
export let lotMenuOpen = false;

// Creation order, newest first; the id tiebreak keeps equal-millisecond
// creates stable. Only catOrder's final tiebreak (B69), not a listing order.
const boardOrder = (a, b) => (b.createdAt - a.createdAt) ||
  (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

// Shared card content: title, then a "Last Updated" line on every card (B82;
// hidden on the mobile drilled row, B140), read from updatedAt (floored to
// createdAt). Both skins share this shape.
function fillRowContent(node, b) {
  node.textContent = '';
  const titled = !!(b.title && b.title.trim().length);
  const title = document.createElement('span'); title.className = 'row-title';
  // The title is the pinned NAME plus .row-title-date, which CSS hides on the
  // mobile drilled row (B140): a colon-joined pair clips at <=360px, so the
  // date rides .row-date (LIST_CARD_H stays 76).
  if (b.cal) {
    title.textContent = LINKED_TITLE;
    const td = document.createElement('span'); td.className = 'row-title-date';
    td.textContent = ': ' + linkedDate(b.cal);
    title.appendChild(td);
  }
  else if (titled) title.textContent = b.title;
  else { title.textContent = COPY.untitled; title.classList.add('untitled'); }
  node.appendChild(title);
  const date = document.createElement('span'); date.className = 'row-date';
  // The stamp gets its own span so mobile CSS can hide it (a text node can't
  // be); no middot, which would dangle once hidden.
  if (b.cal) {
    const bd = document.createElement('span'); bd.className = 'row-board-date';
    bd.textContent = linkedDate(b.cal);
    date.appendChild(bd);
  }
  const lu = document.createElement('span'); lu.className = 'row-last-updated';
  lu.textContent = COPY.lastUpdated + formatMDY(b.updatedAt || b.createdAt);
  date.appendChild(lu);
  node.appendChild(date);
  // Calendar mark (UIUX §13.3): aria-hidden; the link is identity, not action.
  if (b.cal) {
    const mark = document.createElement('span');
    mark.className = 'row-cal-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.innerHTML = GLYPH.calendar;
    node.appendChild(mark);
  }
}

/* Category lists, order and fallback live in state.js; only the copy map is
   here. */
export { BOARD_CATS, GRID_ORDER, catOf, calMD, calDayName, eventsOf };
const CAT_COPY = { todo: 'catTodo', idea: 'catIdea', unsorted: 'catUnsorted', learning: 'catLearning' };
/* In-category order is last touch, newest first (B69): the later of updatedAt
   (saveNow) and catStamp (drop/create), floored at createdAt. Read-site
   defaulted (B21), so no migration. boardOrder makes the sort total, or cards
   could swap slots between renders. */
const touchedAt = (b) =>
  Math.max(b.updatedAt || 0, b.catStamp || 0, b.createdAt || 0);
export const catOrder = (a, b) => (touchedAt(b) - touchedAt(a)) || boardOrder(a, b);

/* Overflow turns pages, never scrolls. Page state is per-category and shared
   by rail and list (never on screen together); each render clamps it.
   catCap / catFilled are the last render's budget and fill; applyLayout
   compares both. */
const boardUi = {
  catPage: Object.fromEntries(BOARD_CATS.map((cat) => [cat, 0])),
  catCap: 0,                           // 0 = never rendered; the capacity check waits
  catFilled: 0,                        // populated sections the last render measured
  catOpen: null,                       // B137: tablet accordion's open category
};
let dragCancel = null;                       // live card-drag teardown, if any

/* The per-page card budget, measured, never a constant (B42, B68). `filled` =
   drawn sections holding a board (empty ones collapse to their head, B68);
   `drawn` = sections on the surface (four on the rail, 1 on a drill, B74). */
export function catPageCap(filled, drawn) {
  // Measure the surface showing: wide (tablet too, B96) is #pane-cards, else
  // #list-rows. A hidden host (clientHeight 0) is never a measuring surface.
  const wide = state.isWide;
  const host = wide ? el.paneCards : el.listRows;
  if (!host) return 1;
  const total = drawn || BOARD_CATS.length;
  const head = wide ? PANE_CAT_HEAD : LIST_CAT_ROW;
  const pager = wide ? PANE_PAGER_H : LIST_CAT_ROW;
  const n = Math.max(1, Math.min(total, filled | 0));
  // Content box, not clientHeight: the list's bottom padding sits inside it and
  // is most of a card.
  const cs = getComputedStyle(host);
  const avail = host.clientHeight
    - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
    - CAT_SEC_GAP * (total - 1)
    - head * (total - n);                      // collapsed: head row only
  // Whole rows per populated section (head above, pager below, B63). The pager
  // slot is reserved even when hidden, so the budget can't flap between one and
  // many pages. Capacity = rows x columns, so the pager counts cards (B42).
  // Both surfaces budget against the one B82 card height.
  const rowH = LIST_CARD_H;
  const rows = Math.max(1, Math.floor((avail / n - head - pager) / (rowH + PANE_ROW_GAP)));
  return rows * (wide ? 1 : LIST_CARD_COLS);
}

/* One section, both surfaces: head, add, cards, pager. Only `makeCard`
   differs. */
function makeCatSection(cat, boards, cap, makeCard) {
  const pages = Math.max(1, Math.ceil(boards.length / cap));
  boardUi.catPage[cat] = Math.max(0, Math.min(boardUi.catPage[cat], pages - 1));
  const page = boardUi.catPage[cat];

  const sec = document.createElement('div');
  sec.className = 'board-cat'; sec.dataset.cat = cat;
  // Empty section collapses to its head row (B68); the .board-cat rect stays
  // the drop hit-test target.
  if (!boards.length) sec.classList.add('empty');
  // B137: tablet rail is a one-open accordion; .folded rides B68's collapse.
  const folded = state.isWide && !state.isDesktop && boardUi.catOpen !== cat;
  if (folded) sec.classList.add('folded');
  sec.setAttribute('role', 'group');
  // The page indicator is aria-hidden, so the group label carries the page.
  const name = COPY[CAT_COPY[cat]];
  sec.setAttribute('aria-label',
    pages > 1 ? name + ', page ' + (page + 1) + ' of ' + pages : name);

  // Visual only: the group's aria-label already names the section.
  const head = document.createElement('div');
  head.className = 'cat-head'; head.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.textContent = name;
  head.appendChild(label);
  sec.appendChild(head);

  // B137: on the tablet accordion the head row is the toggle. Raw nav (B81).
  if (state.isWide && !state.isDesktop) {
    head.removeAttribute('aria-hidden');       // a real toggle here
    head.setAttribute('role', 'button');
    head.setAttribute('tabindex', '0');
    head.setAttribute('aria-expanded', String(!folded));
    head.classList.add('cat-fold');
    const toggle = async () => {
      boardUi.catOpen = boardUi.catOpen === cat ? null : cat;
      boardUi.catPage[cat] = 0;
      await renderPane();
      const again = el.paneCards.querySelector('.board-cat[data-cat="' + cat + '"] .cat-fold');
      if (again) again.focus();                // as goCatPage
    };
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  }

  // The create control (B63) is a sibling of the head, never a child: .cat-head
  // is aria-hidden. Its name is generic; the group's aria-label names it.
  const add = document.createElement('button');
  add.type = 'button'; add.className = 'primary-btn cat-add';
  add.textContent = COPY.catNew;
  add.addEventListener('click', () => commitAction(() => newBoardIn(cat)));
  sec.appendChild(add);

  const cards = document.createElement('div');
  cards.className = 'cat-cards'; cards.setAttribute('role', 'list');
  for (const b of boards.slice(page * cap, (page + 1) * cap))
    cards.appendChild(makeCard(b));
  sec.appendChild(cards);

  // n/m sits between the arrows; one page hides the whole pager (UIUX §10).
  const pager = document.createElement('div');
  pager.className = 'cat-pager'; pager.hidden = pages === 1 || folded;
  pager.appendChild(makePagerBtn('pageFirst', page === 0, () => goCatPage(cat, 0, 'pageFirst')));
  pager.appendChild(makePagerBtn('pagePrev', page === 0, () => goCatPage(cat, page - 1, 'pagePrev')));
  const ind = document.createElement('span');
  ind.className = 'cat-pages'; ind.setAttribute('aria-hidden', 'true');
  ind.textContent = (page + 1) + '/' + pages;
  pager.appendChild(ind);
  pager.appendChild(makePagerBtn('pageNext', page === pages - 1, () => goCatPage(cat, page + 1, 'pageNext')));
  pager.appendChild(makePagerBtn('pageLast', page === pages - 1, () => goCatPage(cat, pages - 1, 'pageLast')));
  sec.appendChild(pager);

  return sec;
}

/* Inert navigation (B22): commits nothing. The render replaces the clicked
   button, so focus moves to its successor or nearest enabled sibling. */
async function goCatPage(cat, p, key) {
  boardUi.catPage[cat] = p;
  // Page the visible surface; the rail behind an open drill is occluded.
  if (listOpen) await renderCat(cat); else await renderPane();
  const host = listOpen ? el.listRows : el.paneCards;
  const sec = host && host.querySelector('.board-cat[data-cat="' + cat + '"]');
  if (!sec) return;
  let b = sec.querySelector('.pager-btn[aria-label="' + COPY[key] + '"]');
  if (b && b.disabled) b = sec.querySelector('.pager-btn:enabled');
  if (b) b.focus();
}

function makePagerBtn(key, disabled, go) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'pager-btn';
  b.setAttribute('aria-label', COPY[key]);
  b.disabled = disabled;
  const g = document.createElement('span');
  g.setAttribute('aria-hidden', 'true'); g.innerHTML = GLYPH[key];   // UIUX §13.3
  b.appendChild(g);
  b.addEventListener('click', go);
  return b;
}

/* A re-render rebuilds a focused .cat-add; both renderers refocus its
   successor, as goCatPage does. */
function focusedCatAdd() {
  const a = document.activeElement;
  return a && a.classList && a.classList.contains('cat-add')
    ? a.closest('.board-cat').dataset.cat : null;
}
function refocusCatAdd(host, cat) {
  const b = cat && host.querySelector('.board-cat[data-cat="' + cat + '"] .cat-add');
  if (b) b.focus();
}

/* A drop writes category + catStamp (= moved-to-top). Whole-record puts (B13)
   split the write: the open board mutates `current` and saves now (a snapshot
   put would lose live edits); any other board is fetched fresh (idbGet
   answers with its queued unsaved copy if it has one, and the put supersedes
   that save, issue #473), so a board deleted mid-drag isn't resurrected. */
async function dropBoardCard(b, cat) {
  boardUi.catPage[cat] = 0;                    // the dropped card lands first
  if (state.current && state.current.id === b.id) {
    state.current.category = cat;
    state.current.catStamp = Date.now();
    applyBoardCat();                   // B67
    saveNow();
  } else {
    const rec = await idbGet(b.id);
    if (rec) { rec.category = cat; rec.catStamp = Date.now(); await idbPut(rec); }
  }
  if (state.isWide) renderPane(); else renderListSurface();
}

/* The single re-render entry for the list overlay (B74): a drilled category
   redraws; the level-1 picker is the static lot-grid (B100, openLotMenu), so
   there is nothing to rebuild. */
export async function renderListSurface() {
  if (!listOpen) return;
  if (catView) { await renderCat(catView); return; }
}

/* One drilled category (B74): the rail's section, alone, so catPageCap gets
   drawn=1. Buckets the open board from memory, as renderPane does. */
async function renderCat(cat) {
  const all = await idbGetAll();
  const boards = all
    .map(live)
    .filter(b => catOf(b) === cat);
  boardUi.catFilled = 1;
  boardUi.catCap = catPageCap(1, 1);
  const focusCat = focusedCatAdd();
  el.listView.classList.remove('picker');
  el.listRows.setAttribute('role', 'list');
  el.listRows.textContent = '';
  el.listRows.appendChild(
    makeCatSection(cat, boards.sort(catOrder), boardUi.catCap, makeListRow));
  refocusCatAdd(el.listRows, focusCat);
}

/* The lot-grid's four category buttons in GRID_ORDER (B100, B119), named as the
   section heads are. data-cat gives the tray the board type's hue (B72/B67). */
function buildCatButtons(host) {
  for (const cat of GRID_ORDER) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cat-button'; b.dataset.cat = cat;
    b.setAttribute('role', 'menuitem');
    b.textContent = COPY[CAT_COPY[cat]];
    b.addEventListener('click', () => drillCat(cat));
    host.appendChild(b);
  }
}

function makeListRow(b) {
  const row = document.createElement('div');
  row.className = 'board-row-wrap'; row.setAttribute('role', 'listitem');
  const card = document.createElement('button');
  card.type = 'button'; card.className = 'board-row'; card.dataset.id = b.id;
  fillRowContent(card, b);
  row.appendChild(card);
  attachBoardCardGestures(card, row, b,
    { container: el.listRows, onTap: () => openBoardById(b.id) });
  // Desktop reaches the row menu by right-click, as makePaneRow does.
  card.addEventListener('contextmenu', (ev) => {
    if (!state.isDesktop) return;      // off desktop, the hold is the path
    ev.preventDefault();
    const { x, y } = menuPoint(ev, card);
    state.menuInvoker = card;
    openBoardRowMenu(row, b, x, y);
  });
  return row;
}

export function formatDate(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
// MM/DD/YY local time (B82, UIUX §10); formatDate is export.js's long form.
function formatMDY(ms) {
  const d = new Date(ms);
  return pad2(d.getMonth() + 1) + '/' + pad2(d.getDate()) + '/' + pad2(d.getFullYear() % 100);
}

/* One gesture law for a board card (B44). Pointer-based, never native DnD.
   Movement past MOVE_THRESHOLD drags (fixed clone, category under it frames
   itself); a motionless release is a tap; a mobile hold is the menu, which
   movement cancels. Move-to-drag is safe on mobile: lists page, not scroll. */
function attachBoardCardGestures(card, row, b, opts) {
  let down = false, dragging = false, longed = false, t = null;
  let sx = 0, sy = 0, gx = 0, gy = 0;
  let ghost = null, over = null;
  const clearDrag = () => {
    clearTimeout(t);
    if (ghost) { ghost.remove(); ghost = null; }
    row.classList.remove('card-dragging');
    if (over) { over.classList.remove('drop-target'); over = null; }
    dragCancel = null;
  };
  card.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;        // right-click stays the contextmenu path
    down = true; dragging = false; longed = false;
    sx = e.clientX; sy = e.clientY;
    const r = card.getBoundingClientRect();
    gx = sx - r.left; gy = sy - r.top; // grab point, so the ghost doesn't jump
    card.setPointerCapture(e.pointerId);
    // Desktop uses the contextmenu listener instead (B24).
    if (!state.isDesktop) t = setTimeout(() => {
      longed = true;
      if (navigator.vibrate) navigator.vibrate(10);
      openBoardRowMenu(row, b, sx, sy);
    }, LONGPRESS_MS);
  });
  card.addEventListener('pointermove', (e) => {
    if (!down || longed) return;       // the menu is up: this press is spent
    if (!dragging) {
      if (Math.hypot(e.clientX - sx, e.clientY - sy) < MOVE_THRESHOLD) return;
      dragging = true;
      clearTimeout(t);                 // movement cancels the long-press (B29)
      // A re-render mid-drag destroys the card and its capture; it must be
      // able to cancel.
      dragCancel = () => { down = false; dragging = false; clearDrag(); };
      row.classList.add('card-dragging');
      if (!state.isDesktop && navigator.vibrate) navigator.vibrate(10);
      ghost = card.cloneNode(true);
      ghost.classList.add('card-drag-ghost');
      // The ghost sits on document.body, outside its section's [data-cat] token
      // scope, so it carries the scope itself (B67).
      ghost.dataset.cat = catOf(b);
      const r = card.getBoundingClientRect();
      ghost.style.width = r.width + 'px'; ghost.style.height = r.height + 'px';
      document.body.appendChild(ghost);
    }
    ghost.style.left = (e.clientX - gx) + 'px';
    ghost.style.top = (e.clientY - gy) + 'px';
    let hit = null;
    for (const c of opts.container.querySelectorAll('.board-cat')) {
      const r = c.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right &&
          e.clientY >= r.top && e.clientY <= r.bottom) { hit = c; break; }
    }
    if (over !== hit) {
      if (over) over.classList.remove('drop-target');
      over = hit;
      if (over) over.classList.add('drop-target');
    }
  });
  card.addEventListener('pointerup', () => {
    if (!down) return;
    down = false;
    const target = dragging && over ? over.dataset.cat : null;
    const spent = dragging || longed;  // a drag or a menu consumed this press
    dragging = false;
    clearDrag();
    // Dropping on the card's own section is no move: no write, no reorder.
    if (target && target !== catOf(b)) dropBoardCard(b, target);
    else if (!spent && opts.onTap) opts.onTap();   // swap: instant (B81)
  });
  card.addEventListener('pointercancel', () => { down = false; dragging = false; clearDrag(); });
}
// Order (A1 / UIUX §7): non-destructive first, destructive last.
function openBoardRowMenu(row, board, x, y) {
  buildMenu([
    { label: COPY.export, glyph: GLYPH.export, action: () => exportBoardPdf(board) },
    { sep: true },
    { label: COPY.delete, glyph: GLYPH.delete, danger: true, action: () => deleteBoard(board.id, row) },
  ], x, y);
}

async function deleteBoard(id, row) {
  const snapshot = await idbGet(id);
  await idbDelete(id);
  if (row) leave(row, () => row.remove());
  const wasCurrent = state.current && state.current.id === id;
  if (wasCurrent) state.current = null;                      // guard invalid current on return
  // Desktop has no list screen to heal a dead `current` on return; heal it now.
  if (state.isDesktop && wasCurrent) await ensureCurrentValid();
  if (listOpen) {
    // After the row's leave(), so the next board pulls up; the rail behind a
    // drill is hidden.
    setTimeout(renderListSurface, LEAVE_MS);
  } else if (state.isWide) {
    renderPane();
  }
  showUndo(async () => {
    await idbPut(snapshot);
    // Restore into the visible surface, reopening the board if it was current.
    if (listOpen) { renderListSurface(); return; }
    if (state.isWide) { if (wasCurrent) swapBoard(snapshot.id); else renderPane(); }
  }, 'board');
}

async function openBoardById(id) {
  finalizeItemUndo();
  flushSave();                                          // as swapBoard (B69)
  const rec = await idbGet(id);
  if (!rec) return;
  state.current = rec;
  returnToBoard();                                      // B9
}

/* Pop the list nav back to the board (B74): history.go(-2) from a drill, one
   pop otherwise (B9).

   `history.go` is async and NOT idempotent: a second call before the popstate
   lands pops the board's own entry, out of the app. `listOpen` clears only on
   that popstate, so this flag guards a fast double-tap on "This board" (B83).
   Cleared on the next popstate. */
export let popping = false;
export function returnToBoard() {
  if (popping) return;
  // B124 embed: nothing was pushed; popping would hit the parent's history.
  if (EMBED) { showBoardFromList(); return; }
  popping = true;
  const depth = (history.state && history.state.v === 'cat') ? 2 : 1;
  history.go(-depth);
}

export function openBoardObj(board) {
  state.current = board;
  renderBoard();
}

/* B63: writes the section's category explicitly ('unsorted' included; catOf
   stays a read-site default) and stamps catStamp so the board lands first. */
export async function newBoardIn(cat) {
  finalizeItemUndo();
  flushSave();            // BEFORE the new board's stamp: lands first (B63, B69)
  const board = newBoardRecord();
  board.category = cat;
  board.catStamp = Date.now();
  await idbPut(board);
  boardUi.catPage[cat] = 0;
  // Pop only while the list's pushed state is still on the stack: a back
  // gesture or mode flip clears listOpen first (B9).
  if (!listOpen) { swapBoard(board.id); return; }
  state.current = board;
  returnToBoard();
}

/* --- 11.5 Desktop board pane ------------------------------------------- */
export let swapping = false;                // async re-entrancy guard

/* A pending note/lot Undo splices into the then-current board, so a board swap
   finalizes it. Board-scoped Undo survives. */
function finalizeItemUndo() {
  if (el.toast.dataset.scope === 'item') { clearTimeout(undoTimer); hideToast(); }
}

export async function swapBoard(id) {
  if (swapping) return;
  if (state.current && state.current.id === id) return;
  finalizeItemUndo();
  swapping = true;
  flushSave();                        // persist() snapshots `current` synchronously
  const rec = await idbGet(id);
  if (!rec) { swapping = false; renderPane(); return; }
  el.board.classList.add('swapping');
  // not transitionend: reduced motion zeroes transitions, so it never fires
  // (UIUX §8)
  setTimeout(() => {
    state.current = rec;
    renderBoard();
    renderPane();
    el.board.classList.remove('swapping');
    swapping = false;
  }, SWAP_MS);
}

/* The rail: the same four categories as the mobile list (UIUX §10). */
export async function renderPane() {
  if (!state.isWide || !el.paneCards) return;   // B96
  // Cancel first: the re-render kills the captured card, so pointerup would
  // never come and the ghost would strand.
  if (dragCancel) dragCancel();
  const all = await idbGetAll();
  const buckets = Object.fromEntries(BOARD_CATS.map((cat) => [cat, []]));
  // The open board buckets from memory: `current` is authoritative, and its
  // write may still be behind the debounced persist.
  for (const b of all) {
    const rec = live(b);
    buckets[catOf(rec)].push(rec);
  }
  boardUi.catFilled = BOARD_CATS.filter(c => buckets[c].length).length;
  // B137: tablet shows cards in one section only; desktop keeps all four open.
  const accordion = state.isWide && !state.isDesktop;
  boardUi.catCap = catPageCap(accordion ? 1 : boardUi.catFilled);
  const focusCat = focusedCatAdd();
  el.paneCards.textContent = '';
  for (const cat of BOARD_CATS)
    el.paneCards.appendChild(
      makeCatSection(cat, buckets[cat].sort(catOrder), boardUi.catCap, makePaneRow));
  refocusCatAdd(el.paneCards, focusCat);
}

function makePaneRow(b) {
  const row = document.createElement('div');
  row.className = 'pane-row'; row.setAttribute('role', 'listitem');
  const card = document.createElement('button');
  card.type = 'button'; card.className = 'pane-card'; card.dataset.id = b.id;
  fillRowContent(card, b);
  row.appendChild(card);
  const isActive = state.current && b.id === state.current.id;
  if (isActive) {
    card.classList.add('active');
    // Deletion path (a): a permanent control on the open board's card only.
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'pane-del';
    del.setAttribute('aria-label', COPY.deleteBoard);
    del.innerHTML = GLYPH.delete;                    // UIUX §13.3
    del.addEventListener('click', () => commitAction(() => deleteBoard(b.id, row)));
    row.appendChild(del);
  }
  // Pointer path, not a bare `click`: a drag's release would also swap boards.
  attachBoardCardGestures(card, row, b, {
    container: el.paneCards, onTap: isActive ? null : () => swapBoard(b.id),
  });
  // Keyboard activation is a `click` with detail 0.
  if (!isActive) card.addEventListener('click', (ev) => {
    if (ev.detail === 0) swapBoard(b.id);   // B81
  });
  // Deletion path (b): right-click any card.
  card.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    const { x, y } = menuPoint(ev, card);
    state.menuInvoker = card;               // focus returns here on close
    openBoardRowMenu(row, b, x, y);
  });
  return row;
}

/* Per-keystroke title update; renderPane on commit reconciles the date line. */
export function updateActiveCardTitle() {
  const card = el.paneCards && el.paneCards.querySelector('.pane-card.active');
  if (!card || !state.current) return;
  const titleEl = card.querySelector('.row-title');
  if (!titleEl) return;
  const titled = !!(state.current.title && state.current.title.trim().length);
  titleEl.textContent = titled ? state.current.title : COPY.untitled;
  titleEl.classList.toggle('untitled', !titled);
}

export function goToList() {
  if (listOpen) return;
  // B100/B119: the picker is the mobile lot-grid; wide has none.
  histPush({ v: 'list' });             // B124 embed: replaceState
  showList();
}
/* Level 1 picker (B74, B100, B119): the lot turned into a 2x2 grid on mobile
   only; the board and its lot data stay untouched beneath. */
function showList() {
  listOpen = true;
  catView = null;
  syncViewTitle();
  syncBoardActions();                 // B83: the tab flips to "This board"
  openLotMenu();
}
/* Level 2: a picker button opens its category's screen. Inert nav (B22). */
export function drillCat(cat) {
  histPush({ v: 'cat', cat });         // B124 embed: replaceState
  showCat(cat);
}
async function showCat(cat) {
  listOpen = true;
  catView = cat;
  syncViewTitle();
  closeLotMenu();                     // B100
  el.listView.classList.remove('show'); // mobile: start below the fold
  el.listView.hidden = false;
  await renderCat(cat);                // measure the panel BEFORE the rise
  // The rise (B82, UIUX §8): one rAF so the below-the-fold frame paints before
  // .show; the guard skips a navigation superseded meanwhile.
  requestAnimationFrame(() => {
    if (listOpen && catView === cat) el.listView.classList.add('show');
  });
}
/* Mobile only (B74, B119): an overlay over #lot at its --lot-h. It never
   touches current.parkingLot; the lot data is only hidden. */
function openLotMenu() {
  lotMenuOpen = true;
  el.lotMenu.textContent = '';
  buildCatButtons(el.lotMenu);
  el.lotMenu.hidden = false;
  el.lot.classList.add('menu-open');
}
function closeLotMenu() {
  if (!lotMenuOpen) return;
  lotMenuOpen = false;
  el.lotMenu.hidden = true;
  el.lotMenu.textContent = '';
  el.lot.classList.remove('menu-open');
}
async function ensureCurrentValid() {
  if (state.current) { const still = await idbGet(state.current.id); if (still) return; }
  // Drop the dead board's pending debounce, or it would stamp its successor
  // and move that card (B69). `state.dirty` rides `current`: clear it (and
  // cancel the pending save) wherever `current` is replaced.
  cancelPendingSave(); state.dirty = false;
  const all = await idbGetAll();
  // Events share the store (B105) with no `updatedAt`; filter them or one
  // could open as the board.
  const boards = boardsOf(all);
  state.current = boards.length ? boards.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a)) : newBoardRecord();
  if (!boards.length) await idbPut(state.current);
  renderBoard();
}
/* B82: mobile slides the panel down, then hides it on a setTimeout, never
   transitionend (B24): reduced motion kills it and the hide must still land;
   a re-open re-adds .show, so the guard keeps it up.
   Wide hides at once (no panel to fall); the wide tests expect an instant
   hide. */
function hideListView() {
  el.listView.classList.remove('show');
  if (state.isWide) { el.listView.hidden = true; return; }
  setTimeout(() => {
    if (!el.listView.classList.contains('show')) el.listView.hidden = true;
  }, LEAVE_MS);
}
async function showBoardFromList() {
  listOpen = false;
  catView = null;
  closeLotMenu();
  hideListView();
  if (!state.current) { await ensureCurrentValid(); }
  else { renderBoard(); }
  if (state.isWide) renderPane();
}

/* --- 11.6 The rolling temporal calendar ------------------------------------
   A rolling 30-day window computed at render; events mirror into their linked
   To-Do boards (state.js §1.7). Go Back is the mobile exit (B134/B151, B9);
   Today is the second row control (B148). The stack scrolls on overflow; the
   view itself stays a bounded page (B161). */

export function goCalBack() {
  // B124 embed: nothing was pushed, so close directly.
  if (EMBED) { hideCal(); return; }
  history.back();                      // pop {v:'cal'} (B9)
}

/* --- The standing rail (B99) ----------------------------------------------
   Wide's calendar is furniture, not navigation: a 40px rail rendered at boot
   and on every flip to wide. Tapping expands the panel (squeezing the board);
   Go Back (B134, B151) returns the rail. No commit (B81), no history pushed. */
function renderCalRail() {
  if (!state.isWide) return;
  el.calView.hidden = false;
  const today = new Date();
  el.calRail.querySelector('.cdate').textContent =
    calDayName(today).slice(0, 3) + ' ' + calMD(today);
  flushSave();
  idbGetAll().then((all) => {
    const lit = calEventsOf(eventsOf(all), calKey(today)).length > 0;
    el.calRail.querySelector('.cdot').classList.toggle('lit', lit);
  });
}

export function showCalRail() {
  document.documentElement.classList.add('has-cal-rail');
  closeLotMenu();
  hideListView();
  listOpen = false; catView = null;
  syncBoardActions();
  el.calView.hidden = false;
  el.calView.classList.add('rail-open');
  el.calView.classList.remove('panel');
  setCalSqueeze(false);
  el.calRail.hidden = false;
  el.calRail.setAttribute('aria-expanded', 'false');
  renderCalRail();
}

export function hideCalRail() {
  document.documentElement.classList.remove('has-cal-rail');
  el.calView.hidden = true;
  el.calView.classList.remove('rail-open', 'panel');
  el.calRail.hidden = true;
}

function expandCalRail() {
  el.calView.classList.remove('rail-open');
  el.calView.classList.add('panel');
  el.calRail.hidden = true;
  el.calRail.setAttribute('aria-expanded', 'true');
  state.calExpanded = true;                 // state rides the PANEL, not the rail
  setCalSqueeze(true);
  renderCal();
}

function collapseCalRail() {
  el.calView.classList.add('rail-open');
  el.calView.classList.remove('panel');
  el.calRail.hidden = false;
  el.calRail.setAttribute('aria-expanded', 'false');
  state.calExpanded = false;
  setCalSqueeze(false);
  renderCalRail();
}

/* --- 11.6 The collapsible All-Boards rail (B118) ---------------------------
   Mirrors B99: on wide it boots collapsed to a 40px face (#pane-rail); a tap
   expands the 300px pane and #pane-collapse (B134, B151) folds it back. Raw
   navigation (B81/B24): no history, no commit. The frame reserves width via
   setPaneCollapsed. */
function expandPane() {
  el.pane.classList.remove('rail-open');
  el.paneRail.hidden = true;
  el.paneRail.setAttribute('aria-expanded', 'true');
  el.paneCollapse.hidden = false;
  setPaneCollapsed(false);
  renderPane();
}

export function collapsePane() {
  el.pane.classList.add('rail-open');
  el.paneRail.hidden = false;
  el.paneRail.setAttribute('aria-expanded', 'false');
  el.paneCollapse.hidden = true;
  setPaneCollapsed(true);
}

export function showCal() {
  // Wide uses the standing rail (B99); mobile the pushed full view (B95).
  if (state.isWide) { showCalRail(); return; }
  state.calOpen = true;
  closeLotMenu();
  hideListView();
  listOpen = false; catView = null;
  syncBoardActions();
  el.calView.classList.toggle('panel', state.isWide);
  setCalSqueeze(state.isWide);
  renderCal();
}

/* Closes the calendar state; hideCal restores the action row and board. */
export function tearDownCal({ popHistory = false } = {}) {
  if (!state.calOpen && !state.calExpanded) return false;
  state.calOpen = false;
  state.calExpanded = false;
  el.calView.hidden = !state.isWide;       // wide: the rail remains (B99)
  el.calView.classList.remove('panel');
  el.calView.classList.toggle('rail-open', state.isWide);
  el.calRail.hidden = !state.isWide;
  setCalSqueeze(false);
  if (popHistory && !EMBED && history.state && history.state.v === 'cal') history.back();
  return true;
}

function hideCal() {
  if (!tearDownCal()) return;
  syncBoardActions();
  if (!state.isWide) renderBoard();
  else renderCalRail();
}

export function makeCalDay(day, dayNotes, board) {
  const card = document.createElement('div');
  // Weekend cards get the weekend class (B159); Sundays also 'sunday' for the
  // divider. Today never renders in the stack.
  card.className = 'cal-day' + (day.today ? ' today'
    : (day.date.getDay() === 0 || day.date.getDay() === 6 ? ' weekend' : '')
      + (day.date.getDay() === 0 ? ' sunday' : '')
      + (dayNotes.length ? ' near' : ' far'));
  const dc = document.createElement('div');
  dc.className = 'cal-date on-dark';
  const d1 = document.createElement('div'); d1.className = 'cal-d1';
  d1.textContent = day.today ? COPY.calToday : calDayName(day.date);
  const d2 = document.createElement('div'); d2.className = 'cal-d2';
  d2.textContent = calMD(day.date);
  dc.append(d1, d2);
  // The day's "+" seats under the date (B165); today's is on the band (B158).
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'cal-add';
  add.setAttribute('aria-label', COPY.calAddNote + ' ' + calMD(day.date));
  add.textContent = '+';
  add.addEventListener('click', () => addCalNote(day.key));
  dc.append(add);
  const zone = document.createElement('div');
  zone.className = 'cal-notes on-dark';
  renderCalDayNotes(zone, day, dayNotes);
  card.append(dc, zone);
  return card;
}

/* Re-sync a date's mirror after any square write (one writer). */
export async function syncDateMirror(dateKey) {
  const all = await idbGetAll();
  const boards = boardsOf(all);
  const board = calBoardOf(boards, dateKey);
  if (!board) return;
  if (syncMirror(board, squaresOf(all, dateKey))) await idbPut(board);
}

/* The reverse mirror (B106): a Requirements commit writes through to the
   squares. In the span the BOARD wins: span line i rewrites square i
   (mirrorSquaresOf), a deleted span line deletes its square (never demotes
   it), and hand lines after the span are never touched; nor is a square
   beyond the span (B179). Board-side additions land after the span as hand
   lines (insertion inside it is ambiguous, B106). syncMirror runs on the LIVE
   board object because the commit's saveNow races the same record.

   `before` is the pre-edit text (interactions.js): a prefix/suffix diff
   identifies a pure deletion, so a hand line never slides up into the span.
   Mixed edit/delete falls to the positional law. */
export async function writeThroughRequirements(board, before) {
  if (!board || !board.cal) return;
  const all = await idbGetAll();
  const lines = (board.requirements || '').length
    ? board.requirements.split('\n') : [];
  const span = typeof board.calReq === 'number' ? board.calReq : 0;   // never synced: all hand
  const mine = squaresOf(all, board.cal).slice(0, span);   // never beyond the span (B179)
  const o = (before || '').length ? before.split('\n') : [];
  let p = 0;   // common prefix — the lines both texts agree on, from the top
  while (p < o.length && p < lines.length && o[p] === lines[p]) p++;
  let s = 0;   // common suffix, never overlapping the prefix
  while (s < o.length - p && s < lines.length - p &&
         o[o.length - 1 - s] === lines[lines.length - 1 - s]) s++;
  if (o.length > lines.length && lines.length === p + s) {
    // Pure deletion: old lines [p, o.length - s) are gone.
    const lo = Math.min(p, span), hi = Math.min(o.length - s, span);
    for (let i = lo; i < hi && i < mine.length; i++) await idbDelete(mine[i].id);
    const kept = mine.filter((_, i) => i < p || i >= o.length - s);
    board.calReq = span - (hi - lo);         // the span follows its deletions
    syncMirror(board, kept);
    await idbPut(board);                     // always: saveNow raced the move
    return;
  }
  const keep = Math.min(span, lines.length);
  for (const { square, text } of mirrorSquaresOf(board, all)) {
    if (mirrorLine(square) !== text) { square.next = text; await idbPut(square); }
  }
  for (let i = keep; i < span && i < mine.length; i++) await idbDelete(mine[i].id);
  if (keep !== span) board.calReq = keep;    // span follows the deletion
  if (syncMirror(board, mine.slice(0, keep)) || keep !== span) {
    await idbPut(board);                     // saveNow raced the span move
  }
}

/* The event record retires (B179): each stored event becomes a square on its
   date (squareFromEvent), then its record goes. The put comes first and the
   id is deterministic, so an interrupted pass repeats onto the same record. An
   event with no calKey date has no card to land on and stays stored,
   unreachable. It runs before anything syncs a date's mirror (the launch, the
   backup import), or the date's old event lines, still inside the span, would
   be rewritten away. Returns the dates that gained a square. */
export async function convertLegacyEvents() {
  const days = new Set();
  for (const ev of eventsOf(await idbGetAll())) {
    const square = squareFromEvent(ev);
    if (!square) continue;
    await idbPut(square);
    await idbDelete(ev.id);
    days.add(square.day);
  }
  return [...days];
}

/* --- The day-roll launch (B105) + the morning lifecycle (B108) -------------
   Today's linked board exists even with zero events (B107, ensureLinkedBoard),
   boot lands on it, and yesterday's incomplete notes carry forward. The check
   runs once per day key (boot, and renderCal when the key changed), never per
   render, so it can't steal focus. A mid-session roll runs the full routine
   (B162). The key is stamped inside the consequence (see launchTodayBoard). */
let rollDay = null;                     // day key the roll last ran for

export function checkDayRoll() {
  const today = calKey(new Date());
  if (rollDay === today) return;
  launchTodayBoard(today);
}

async function launchTodayBoard(today) {
  commitAction(async () => {            // a consequence (B81)
    // B162: stamp HERE, not at the check: commitAction silently drops a guarded
    // launch, and an earlier stamp would refuse every retry. A throw un-stamps.
    rollDay = today;
    try {
      // B131: the boot pick can be a future ghost board. Detach it BEFORE
      // flushSave: persist() early-returns on no current, so the ghost's
      // snapshot can't land behind the sweep's delete and resurrect it.
      if (state.current && state.current.cal > today &&
          !(state.current.notes || []).length) state.current = null;
      flushSave();
      await convertLegacyEvents();      // B179: before anything reads the squares
      const all = await idbGetAll();
      const boards = boardsOf(all);
      const { board } = ensureLinkedBoard(boards, today);
      // B131 sweep: empty future-dated linked boards are derived state; the
      // squares survive.
      for (const b of boards.slice()) {
        // No current-board guard: current may be the ghost being swept.
        if (b !== board && b.cal > today && !(b.notes || []).length) {
          boards.splice(boards.indexOf(b), 1);
          await idbDelete(b.id);
        }
      }
      await carryForward(boards, board, today);
      if (state.current && state.current.id === board.id) persist();
      else await idbPut(board);
      await syncDateMirror(today);
      // B179: the sync rewrote the open board in place and swapBoard skips it.
      if (state.current && state.current.id === board.id) renderBoard();
      // Step off the calendar first (mobile pops {v:'cal'}, B9), then swap.
      if (state.calOpen) goCalBack();
      else if (state.calExpanded) collapseCalRail();
      swapBoard(board.id);
    } catch (e) {
      rollDay = null;   // un-stamp: the next check retries whole
      throw e;          // fire-and-forget, as elsewhere in this file
    }
  });
}

/* Carry-forward (B108): yesterday's incomplete notes MOVE (not copy) onto
   today's board at the same x/y, stamped `carriedOn` = today's key (compared
   by date, so no cleanup; interactions.js setNoteState clears it).
   Idempotent: a same-day reload finds nothing left to move. */
async function carryForward(boards, todayBoard, today) {
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yb = calBoardOf(boards, calKey(y));
  if (!yb || yb.id === todayBoard.id) return;
  const moving = (yb.notes || []).filter(n => n.state !== 'complete');
  if (!moving.length) return;
  for (const n of moving) { n.carriedOn = today; todayBoard.notes.push(n); }
  yb.notes = yb.notes.filter(n => n.state === 'complete');
  // yb may be state.current: persist it live, else write it now.
  if (state.current && yb.id === state.current.id) persist();
  else await idbPut(yb);
}

export function renderCal() {
  checkDayRoll();                // B105
  el.calView.hidden = false;
  flushSave();
  idbGetAll().then(paintCal);
}

/* The expanded face's one painter, synchronous on a store read: addCalNote
   calls it directly so the new block is in the DOM when its editor arms. */
function paintCal(all) {
  el.calStack.textContent = '';
  // The day head is in the header band (B157); today's body sits below it
  // (renderCalToday, B158).
  renderCalDayhead();
  // UIUX §6/B7 collar on the exit row (B98, B134), spent edge-ward/downward.
  // The calendar is unscaled, so k is 1; +0.5 is the board row's headroom.
  el.calTop.style.setProperty('--hit', (hitInset(el.calTop, 1) + 0.5) + 'px');
  const days = calWeekAnchor ? calWeekOf(calWeekAnchor) : calWindow(CAL_FUTURE_DAYS + 1);
  const events = eventsOf(all);      // state.js §1.7
  const notes = calNoteRecords(all);
  const today = days.find((d) => d.today);
  if (today) renderCalToday(today, notes.filter((r) => r.day === today.key));
  for (const day of days) {
    if (day.today) continue;         // B158
    const board = calBoardOf(all, day.key);
    el.calStack.appendChild(makeCalDay(day, notes.filter((r) => r.day === day.key), board));
  }
  renderCalMonth(new Set(events.map((e) => e.date)));
  seatCalAdds();
}

/* Centres the band "+" in the right-of-card section (B158). The card is
   max-content wide (B37), so the centre is measured and set as a CSS var. */
function seatCalAdds() {
  const band = el.calBand.getBoundingClientRect();
  const card = el.calBandCard.getBoundingClientRect();
  const mid = (card.right + band.right) / 2;
  el.calView.style.setProperty('--cal-add-x', (mid - band.left) + 'px');
}

/* --- The day-note squares --------------------------------------------------
   Day-note records render as squares inside each day card, three per day with
   a pager beyond. The `day` field (the card's calKey) binds a record to a
   card; one without it stays stored but unreachable. A square is its date's
   event (B179): its commit syncs that date's Requirements mirror. */

let calDayNotePage = {};             // day.key -> page

const CAL_NOTE_PER_DAY = 3;
const CAL_FUTURE_DAYS = 30;

// Every square in id order: the day cards and the Requirements chips share it.
function calNoteRecords(all) {
  return all.filter(isSquare).sort(squareOrder);
}

function calOrdinal(n) {
  const v = n % 100;
  return ['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th';
}

/* The day head (B149): weekday + month-day, ordinal superscripted. */
function renderCalDayhead() {
  const today = new Date();
  const head = el.calDayhead;
  // One span: the head is a flex row, and two items would space "3" from "rd".
  const label = document.createElement('span');
  label.textContent =
    today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const sup = document.createElement('sup');
  sup.textContent = calOrdinal(today.getDate());
  label.appendChild(sup);
  head.textContent = '';
  head.appendChild(label);
}

const CAL_PAGER = { prev: '‹', next: '›' };

/* A calendar pager button (.mo-nav). `hideWhenOff` (day-notes pager only)
   hides an end that cannot page; the month head always has a month to go to. */
function calNavBtn(label, glyph, go, { hideWhenOff = false, off = false } = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = hideWhenOff ? 'mo-nav cal-notes-nav' : 'mo-nav';
  b.setAttribute('aria-label', label);
  b.textContent = glyph;
  if (hideWhenOff) { b.disabled = off; b.hidden = off; }
  b.addEventListener('click', go);
  return b;
}

function renderCalDayNotes(zone, day, recs) {
  const row = document.createElement('div');
  row.className = 'cal-notes-row';
  const pages = Math.max(1, Math.ceil(recs.length / CAL_NOTE_PER_DAY));
  if (!calDayNotePage[day.key]) calDayNotePage[day.key] = 0;
  let page = Math.min(Math.max(calDayNotePage[day.key], 0), pages - 1);
  const hasPages = recs.length > CAL_NOTE_PER_DAY;
  const draw = () => {
    if (row.querySelector('[contenteditable]')) return;  // keep an open edit
    row.textContent = '';
    if (hasPages) {
      row.appendChild(calNavBtn(COPY.calPagerPrev + calMD(day.date) + COPY.calPagerUnit,
        CAL_PAGER.prev, () => { page--; calDayNotePage[day.key] = page; draw(); },
        { hideWhenOff: true, off: page <= 0 }));
    }
    const grid = document.createElement('div');
    grid.className = 'cal-notes-grid';
    grid.setAttribute('role', 'list');
    for (const r of recs.slice(page * CAL_NOTE_PER_DAY, page * CAL_NOTE_PER_DAY + CAL_NOTE_PER_DAY)) {
      grid.appendChild(makeCalNote(r));
    }
    row.appendChild(grid);
    if (hasPages) {
      row.appendChild(calNavBtn(COPY.calPagerNext + calMD(day.date) + COPY.calPagerUnit,
        CAL_PAGER.next, () => { page++; calDayNotePage[day.key] = page; draw(); },
        { hideWhenOff: true, off: page >= pages - 1 }));
    }
    zone.textContent = '';
    zone.appendChild(row);
  };
  draw();
}

/* Today's body (B158, B157): the full-width body below the band, not in the
   stack. Its row is inset to the date-compartment width (84px + 6px) so the
   squares sit where a day card's do; no row "+", the band owns it. */
function renderCalToday(today, recs) {
  const add = el.calBandAdd;
  add.setAttribute('aria-label', COPY.calAddNote + ' ' + calMD(today.date));
  add.textContent = '+';
  add.onclick = () => addCalNote(today.key);
  const zone = document.createElement('div');
  zone.className = 'cal-notes on-dark';
  renderCalDayNotes(zone, today, recs);
  el.calTodayBoard.textContent = '';
  el.calTodayBoard.appendChild(zone);
}

/* Add a day note (a consequence, under commitAction's guard): written with
   its `day` key, empty, and its editor opens on arrival. */
async function addCalNote(dateKey) {
  commitAction(async () => {
    const rec = makeDayNoteRecord(dateKey);
    await idbPut(rec);
    const all = await idbGetAll();
    const recs = calNoteRecords(all).filter((r) => r.day === dateKey);
    const idx = recs.findIndex((r) => r.id === rec.id);
    calDayNotePage[dateKey] = Math.floor(Math.max(0, idx) / CAL_NOTE_PER_DAY);
    paintCal(all);
    const block = [...document.querySelectorAll('.cal-notes-grid .cal-note')].find((b) => b.dataset.id === rec.id);
    if (block) startCalNoteEdit(block, rec);
  });
}

/* One square block: one zone showing `next`. */
function makeCalNote(rec) {
  const block = document.createElement('div');
  block.className = 'cal-note';
  block.setAttribute('role', 'listitem');
  block.dataset.id = rec.id;
  const body = document.createElement('div');
  body.className = 'cal-note-text';
  body.textContent = squareText(rec);
  block.append(body);
  // The deferred caretToEnd wins whichever order native caret placement fires.
  block.addEventListener('click', (e) => {
    if (body.hasAttribute('contenteditable')) return;
    e.preventDefault();
    startCalNoteEdit(block, rec);
    setTimeout(() => caretToEnd(body), 0);
  });
  return block;
}

/* The calendar→board half of the mirror: after a square commit, a board whose
   Requirements anchor is ON SCREEN (the wide panel leaves it beside the
   calendar) repaints in place (B179). The guard is what is actually shown, not
   viewport width: the mobile push covers the board, and hideCal repaints on
   the way back. Through renderBoard(), never a direct anchor write, so the
   B133 pinned title and the 'filled' class survive. */
function repaintVisibleBoard() {
  if (state.calOpen && !state.isWide) return;   // the mobile push covers the board
  const anchor = document.getElementById('anchor-requirements');
  if (anchor && anchor.offsetParent !== null) renderBoard();
}

/* The commit is the blur and writes `next`; `rem` stays stored but unread.
   A commit leaving both empty discards the record (B8). Either way the date's
   mirror re-syncs and a board on screen repaints (B179). */
function startCalNoteEdit(block, rec) {
  const body = block.querySelector('.cal-note-text');
  body.setAttribute('contenteditable', CE);
  body.focus();
  caretToEnd(body);
  const inside = (n) => n && (n === body || block.contains(n));
  let committed = false;
  const commit = async () => {
    if (committed) return;
    committed = true;
    body.removeAttribute('contenteditable');
    const next = body.textContent.trim();
    if (!rec.rem && !next) {                        // B8
      await idbDelete(rec.id);
      block.remove();
      await syncDateMirror(rec.day);
      repaintVisibleBoard();
      renderCal();
      return;
    }
    rec.next = next;
    await idbPut(rec);
    await syncDateMirror(rec.day);
    repaintVisibleBoard();
    renderCal();
    scheduleSave();
  };
  block.addEventListener('focusout', (e) => {
    if (inside(e.relatedTarget)) return;
    commit();
  });
  body.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); body.blur(); }
  });
}

/* --- The month view ---------------------------------------------------------
   A month grid at the stack's bottom; a cell tap swaps the stack to that
   date's Sunday-first week, raw (B81). Two render-time anchors, nothing
   stored: calMonthAnchor, and calWeekAnchor (null = the rolling window). */
let calMonthAnchor = null;
let calWeekAnchor = null;

const MO_WDS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/* The Sunday-first week containing `anchor`; today is flagged by key, since
   the tapped week usually lacks it. */
function calWeekOf(anchor) {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - anchor.getDay());
  return calWindow(7, start);
}

function renderCalMonth(evDays) {
  const now = new Date();
  const a = calMonthAnchor || now;
  el.calMonth.textContent = '';
  const head = document.createElement('div');
  head.className = 'mo-head';
  const label = document.createElement('div');
  label.className = 'mo-label';
  label.textContent = a.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const nav = (dy, dm) => () => {
    calMonthAnchor = new Date(a.getFullYear() + dy, a.getMonth() + dm, 1);
    renderCal();
  };
  const back = calNavBtn(COPY.calMonthPrev, CAL_PAGER.prev, nav(0, -1));
  const fwd = calNavBtn(COPY.calMonthNext, CAL_PAGER.next, nav(0, 1));
  head.append(back, label, fwd);
  el.calMonth.appendChild(head);
  // Leading blanks Sunday-align the 1st; adjacent-month days are not drawn.
  const grid = document.createElement('div');
  grid.className = 'mo-grid';
  for (const wd of MO_WDS) {
    const c = document.createElement('div');
    c.className = 'mo-wd';
    c.textContent = wd;
    grid.appendChild(c);
  }
  const tk = calKey(now);
  const wkKeys = new Set(calWeekOf(now).map((d) => d.key));
  const lead = new Date(a.getFullYear(), a.getMonth(), 1).getDay();
  const nDays = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate();
  for (let i = 0; i < lead; i++) grid.appendChild(document.createElement('div'));
  for (let d = 1; d <= nDays; d++) {
    const date = new Date(a.getFullYear(), a.getMonth(), d);
    const key = calKey(date);
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'mo-cell'
      + (key === tk ? ' today' : '')
      + (wkKeys.has(key) ? ' wk' : '')
      + (evDays.has(key) ? ' ev' : '');
    cell.setAttribute('aria-label',
      date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
      + (evDays.has(key) ? COPY.calHasEvents : ''));
    const n = document.createElement('span');
    n.textContent = d;
    cell.appendChild(n);
    if (evDays.has(key)) {
      const dot = document.createElement('span');
      dot.className = 'mo-dot';
      dot.setAttribute('aria-hidden', 'true');
      cell.appendChild(dot);
    }
    cell.addEventListener('click', () => {
      calWeekAnchor = date;
      renderCal();
    });
    grid.appendChild(cell);
  }
  el.calMonth.appendChild(grid);
}

/* Region init: called from boot(); no module does load-time work. */
export function registerBoards() {

  // A frame change can change the card budget, so re-paginate. geometry fires
  // this hook from applyLayout without importing boards (cycle-break).
  onFrameReflow(() => {
    seatAllNotes();
    // B137: budget as renderPane does, or the fill measured is stale.
    const accordion = state.isWide && !state.isDesktop;
    if (boardUi.catCap && catPageCap(accordion ? 1 : boardUi.catFilled, catView ? 1 : undefined) !== boardUi.catCap) {
      if (listOpen) renderListSurface();
      else if (state.isWide && el.paneCards) renderPane();
    }
  });
  el.calBack.addEventListener('click', () => {
    // Wide: Go Back is the collapse (B99, B134, B151), nothing to pop; mobile
    // pops {v:'cal'} (B9).
    if (state.isWide && state.calExpanded) { collapseCalRail(); return; }
    goCalBack();
  });
  el.calToday.addEventListener('click', () => {
    // B148: Today resets both anchors and the pager positions.
    calMonthAnchor = null;
    calWeekAnchor = null;
    calDayNotePage = {};
    renderCal();
  });
  el.calRail.addEventListener('click', () => {
    // B99, B81
    if (!state.isWide || state.calExpanded) return;
    expandCalRail();
  });
  el.paneRail.addEventListener('click', () => {
    // B118, B81
    if (!state.isWide) return;
    expandPane();
  });
  el.paneCollapse.addEventListener('click', collapsePane);
  // Back drives the calendar, drill, list and board states via History (B9).
  // The calendar is checked first: it can sit beneath the picker.
  window.addEventListener('popstate', () => {
    popping = false;                     // B83
    closeMenu();
    const s = history.state;
    // B99: on wide the rail never enters this grammar (calOpen is mobile's
    // flag); a stray {v:'cal'} there collapses the panel.
    if (s && s.v === 'cal') { showCal(); }
    else if (state.calOpen || state.calExpanded) { hideCal(); }
    else if (s && s.v === 'cat') {
      if (state.isDesktop) { showBoardFromList(); }   // B100: stray landing
      else { showCat(s.cat); }
    }
    else if (s && s.v === 'list') {
      if (state.isDesktop) { showBoardFromList(); }   // B100: as above
      else { catView = null; hideListView(); showList(); }  // B82
    }
    else { showBoardFromList(); }
  });
}