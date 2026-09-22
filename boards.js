/* --- 11. Board list + routing -------------------------------------------- */
// issue #182 module wiring — native ESM, no bundler (AGENTS.md).
import { CAT_SEC_GAP, CE, COPY, GLYPH, LEAVE_MS, LIST_CARD_COLS, LIST_CARD_H, LIST_CAT_ROW } from './state.js';
import { LONGPRESS_MS, MOVE_THRESHOLD, PANE_CAT_HEAD, PANE_PAGER_H, PANE_ROW_GAP, SWAP_MS, calBoardOf } from './state.js';
import { calEventsOf, calKey, calWindow, el, ensureLinkedBoard, EMBED, histPush, newBoardRecord, newCalEvent, state } from './state.js';
import { syncMirror, mirrorEventsOf } from './state.js';
import { flushSave, idbDelete, idbGet, idbGetAll, idbPut, persist, saveNow, saveTimer, scheduleSave } from './persistence.js';
import { caretToEnd, hitInset, onFrameReflow, setCalSqueeze, setPaneCollapsed } from './geometry.js';
import { applyBoardCat, renderBoard, syncViewTitle } from './render.js';
import { commitAction, g, hideToast, leave, showUndo, undoTimer } from './interactions.js';
import { buildMenu, closeMenu, syncBoardActions } from './menus.js';
import { exportAllJson, exportBoardPdf, exportCalPdf } from './export.js';

/* Two-level navigation since issue #112 / B74. `listOpen` is true for either
   level; `catView` names the drilled category (level 2) or is null at the
   picker (level 1); `lotMenuOpen` is true only on mobile, where the level-1
   picker is the Parking Lot turned into the grid rather than a screen of its
   own. History carries {v:'list'} for the picker and {v:'cat',cat} for a drill,
   so the OS back gesture returns drill -> picker -> board (B9, never shadowed). */
export let listOpen = false;
export let catView = null;
export let lotMenuOpen = false;

// Creation order, newest first, with an id tiebreak so equal-millisecond
// creates can't reorder between renders (issue #14). Since issue #97 this is
// no longer what orders a listing — catOrder sorts by last touch, and B69
// supersedes B24's immutable-slot clause — but it stays catOrder's final
// tiebreak, which is what keeps that sort a total order. boot() and
// ensureCurrentValid() read updatedAt for a different job and are untouched:
// updatedAt selects which board to open (continuity), not where its card sits.
const boardOrder = (a, b) => (b.createdAt - a.createdAt) ||
  (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

// Shared row/card content: the title (or untitled placeholder), then a
// "Last Updated" line on EVERY card (B82, issue #125) — where before only an
// untitled card carried a bare creation date. The date is the record's own
// updatedAt (floored to createdAt for a record that predates the stamp), so no
// new field persists (B69 already writes updatedAt on every committing action).
// One shape, both skins: styles.css lays the line inline on the rail, and
// bottom-right under a two-line title on the mobile drilled-list card.
function fillRowContent(node, b) {
  node.textContent = '';
  const titled = !!(b.title && b.title.trim().length);
  const title = document.createElement('span'); title.className = 'row-title';
  title.textContent = titled ? b.title : COPY.untitled;
  if (!titled) title.classList.add('untitled');
  node.appendChild(title);
  const date = document.createElement('span'); date.className = 'row-date';
  date.textContent = COPY.lastUpdated + formatMDY(b.updatedAt || b.createdAt);
  node.appendChild(date);
  // The calendar mark (issue #145, R5): a linked board announces its link
  // where its name is read — far right on the card, on both surfaces the
  // card renders (the desktop rail and the All-Boards views). Drawn, not
  // typed (§13.3): the same mark the Calendar tab wears. State is never
  // colour alone; this is a mark, not a state — aria-hidden because the
  // link is identity, not an action the card offers.
  if (b.cal) {
    const mark = document.createElement('span');
    mark.className = 'row-cal-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.innerHTML = GLYPH.calendar;
    node.appendChild(mark);
  }
}

/* The three categories (issue #58 / B42, extended to the list view by issue #74
   / B44): To-Do, Idea, Note — one third each, top to bottom, on whichever
   surface is showing. Category is read-site defaulted, the B21 idiom: a record
   without one IS the third bucket (storage key 'unsorted'; B63 renamed only
   its label), so pre-#58 boards need no migration and no DB version bump.
   Since B63 every new board writes its category (+ catStamp) explicitly at
   creation — the read-site default now covers only the legacy records. */
/* Four categories since issue #112 / B74 — To Do, Notes, Learning, Ideas, in
   that stacked order (the rail, the drilled list, and the All-Boards picker all
   read it top to bottom). Learning is the one genuinely new bucket (pale pink,
   §2.2.2 / B74); "unsorted" keeps its storage key and "Note Boards" label
   (B63). catOf() stays a read-site default — a record whose category is none of
   the three named buckets IS 'unsorted' (B21's idiom, unchanged). */
export const BOARD_CATS = ['todo', 'unsorted', 'learning', 'idea'];
const CAT_COPY = { todo: 'catTodo', idea: 'catIdea', unsorted: 'catUnsorted', learning: 'catLearning' };
export const catOf = (b) =>
  (b.category === 'todo' || b.category === 'idea' || b.category === 'learning')
    ? b.category : 'unsorted';
/* The mobile All-Boards grid is a 2x2 whose clockwise reading from the top-left
   must be To Do, Notes, Learning, Ideas (issue #112). A row-major 2-col grid
   fills TL, TR, BL, BR — so clockwise is TL, TR, BR, BL, and the DOM order that
   lands Learning at BR and Ideas at BL is [todo, unsorted, idea, learning].
   The stacked order (BOARD_CATS) and this grid order genuinely differ: a column
   reads top-to-bottom, a 2x2 reads clockwise. */
export const GRID_ORDER = ['todo', 'unsorted', 'idea', 'learning'];
/* In-category order is last touch, newest first (issue #97 / B69, superseding
   B24's immutable slot): a board you just edited comes back to the top of its
   section. Two writes are a touch and both have a claim on the first slot —
   updatedAt, stamped by saveNow() on every committing action, and catStamp,
   stamped by a drop or a create (= moved-to-top) — so the key is whichever
   happened later, with createdAt as the floor. Read-site defaulted, the B21
   idiom (catOf's pattern): a record missing either field orders by what it
   does have, so nothing migrates and no DB version moves. boardOrder closes
   it, leaving no tie unresolved — the sort must be total or a card could
   change slots between two renders of the same data. */
const touchedAt = (b) =>
  Math.max(b.updatedAt || 0, b.catStamp || 0, b.createdAt || 0);
export const catOrder = (a, b) => (touchedAt(b) - touchedAt(a)) || boardOrder(a, b);

/* Pagination (issue #58): overflow turns pages, never scrolls. Page state is
   per-category and module-level so a re-render keeps the reader's place, and
   it is shared by the rail and the list because the two are never on screen at
   once (a flip's tier teardown pops the list state on the way to desktop) — each renderer
   clamps every render, so a differing capacity heals itself. boardUi.catCap is the
   budget the last render used, and boardUi.catFilled the fill state it measured
   against — applyLayout compares both. */
const boardUi = {
  catPage: { todo: 0, idea: 0, unsorted: 0, learning: 0 },
  catCap: 0,                           // 0 = never rendered; the capacity check waits
  catFilled: 0,                        // populated sections the last render measured
  catOpen: null,                       // B137: the tablet accordion's one expanded category (session state, not persisted)
};
const dragUi = {
  dragCancel: null,                    // the live card-drag's teardown, if one is mid-flight
};

/* The per-page card budget, measured — never a constant (B42, restated B68).
   `filled` is how many of the drawn sections hold at least one board: an empty
   section collapses to its head row alone (B68), so the cards and pager slots
   it is not using come back to the sections that have something to show.
   `drawn` is how many sections are on the surface — BOARD_CATS.length for the
   desktop rail (all four stacked), 1 for a single-category drill screen (issue
   #112 / B74): the drill shows one category alone, so it must not subtract the
   furniture of three sections that are not there. */
export function catPageCap(filled, drawn) {
  // Branch on the surface ACTUALLY SHOWING (#286 defect fix, #281's one-read-
  // per-surface discipline): wide renders the 300px pane — on tablet too
  // (B96) — so wide measures #pane-cards; only a non-wide surface shows
  // #list-rows. The old `state.isDesktop` grammar axis measured the retired
  // hidden #list-rows on tablet (clientHeight 0), clamping the rail to the
  // mobile drill's 3-column count. A hidden host is never a measuring surface.
  const wide = state.isWide;
  const host = wide ? el.paneCards : el.listRows;
  if (!host) return 1;
  const total = drawn || BOARD_CATS.length;
  const head = wide ? PANE_CAT_HEAD : LIST_CAT_ROW;
  const pager = wide ? PANE_PAGER_H : LIST_CAT_ROW;
  const n = Math.max(1, Math.min(total, filled | 0));
  // The content box, not clientHeight: the list's own bottom padding sits
  // inside clientHeight and outside the flex line, and at B68's row heights
  // that 12px is most of a card. Measure what the sections actually get.
  const cs = getComputedStyle(host);
  const avail = host.clientHeight
    - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
    - CAT_SEC_GAP * (total - 1)                // every drawn section: the gaps all stand
    - head * (total - n);                      // a collapsed section still keeps its head row
  // A populated section's share, minus its own furniture, in whole rows. Both
  // surfaces stack the head row above the cards and the pager row below (B63
  // unmerges B44's strip). The pager's slot is reserved even when a single page
  // hides it, so the budget cannot flap between one- and many-page states.
  // Rows are what the height buys; columns are what a row holds. Capacity is
  // their product, so the pager still counts cards and B42's law is untouched.
  // The mobile list card is taller than the §6 floor (B82: two title lines +
  // the Last Updated line), and since issue #254 the rail card wears the same
  // B82 shape — so both surfaces budget against the one 76px row height.
  const rowH = LIST_CARD_H;
  const rows = Math.max(1, Math.floor((avail / n - head - pager) / (rowH + PANE_ROW_GAP)));
  return rows * (wide ? 1 : LIST_CARD_COLS);
}

/* One section, both surfaces: head, add, cards, pager — the same four children
   everywhere, so the two skins are a CSS grid decision and not a second DOM
   shape. `makeCard` is what differs (a rail card or a list row). */
function makeCatSection(cat, boards, cap, makeCard) {
  const pages = Math.max(1, Math.ceil(boards.length / cap));
  boardUi.catPage[cat] = Math.max(0, Math.min(boardUi.catPage[cat], pages - 1));
  const page = boardUi.catPage[cat];

  const sec = document.createElement('div');
  sec.className = 'board-cat'; sec.dataset.cat = cat;
  // A section with nothing in it collapses to its head row (B68, superseding
  // B44's two empty thirds): the label and its own New board control stay —
  // it is still a place to create in, and that row is still the .board-cat
  // rect the drop hit-test finds — and only the cards and pager slots go back
  // to the populated sections.
  if (!boards.length) sec.classList.add('empty');
  // B137: on tablet the rail is a one-open accordion — every section but the
  // open one folds to its head row (the same reclaim B68's empty collapse
  // makes, so .folded rides that machinery), all folded on load. The mobile
  // drill never runs on wide, so this branch is the tablet pane alone.
  const folded = state.isWide && !state.isDesktop && boardUi.catOpen !== cat;
  if (folded) sec.classList.add('folded');
  sec.setAttribute('role', 'group');
  // Page state rides the group label — the visual indicator is aria-hidden and
  // a rebuilt node can't announce, so this is where AT hears the page.
  const name = COPY[CAT_COPY[cat]];
  sec.setAttribute('aria-label',
    pages > 1 ? name + ', page ' + (page + 1) + ' of ' + pages : name);

  // Visual head only — the group's aria-label already says it (the band-label
  // pattern), so AT doesn't hear every section twice.
  const head = document.createElement('div');
  head.className = 'cat-head'; head.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.textContent = name;
  head.appendChild(label);
  sec.appendChild(head);

  // B137: the tablet accordion's toggle IS the head row — one tap expands
  // (collapsing the open one), tapping the open head folds it. Raw
  // navigation, no commit (B81). On desktop/mobile the head stays inert.
  if (state.isWide && !state.isDesktop) {
    head.removeAttribute('aria-hidden');       // it is a real toggle here, AT hears it
    head.setAttribute('role', 'button');
    head.setAttribute('tabindex', '0');
    head.setAttribute('aria-expanded', String(!folded));
    head.classList.add('cat-fold');
    const toggle = async () => {
      boardUi.catOpen = boardUi.catOpen === cat ? null : cat;
      boardUi.catPage[cat] = 0;
      await renderPane();
      const again = el.paneCards.querySelector('.board-cat[data-cat="' + cat + '"] .cat-fold');
      if (again) again.focus();                // goCatPage's stance: re-render ≠ lost focus
    };
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  }

  // The category's own create control (issue #88 / B63): a grid sibling of
  // the head, never a child — .cat-head is aria-hidden, and a button inside
  // it would be unreachable to AT. Its name is generic three times over, like
  // the pager's: the group's aria-label says which section it makes boards in.
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

  // The n/m indicator sits between ‹ and › rather than beside the label: it
  // states which page the arrows are on, so it belongs with them — and one
  // page then says nothing (§10's law) through the pager's own `hidden`,
  // rather than through a second guard that has to agree with it.
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

/* Inert navigation, like selection (B22): a page turn commits nothing, so
   B18's window does not apply — the pager responds on the click. The render
   replaces the clicked button, so focus is put back on its successor (or the
   nearest enabled sibling) — a keyboard reader pages without re-tabbing. */
async function goCatPage(cat, p, key) {
  boardUi.catPage[cat] = p;
  // Page the surface that is actually showing this category: the drilled screen
  // (#list-rows, either platform) when the list overlay is open, else the
  // desktop rail (#pane-cards). Paging the hidden rail behind an open drill
  // would move focus onto an occluded button (issue #112 review).
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
  g.setAttribute('aria-hidden', 'true'); g.innerHTML = GLYPH[key];   // drawn mark (UIUX §13.3)
  b.appendChild(g);
  b.addEventListener('click', go);
  return b;
}

/* A re-render rebuilds every node — including a focused .cat-add, which lives
   inside the rebuilt host unlike the retired global buttons. Both renderers
   put focus back on its successor, goCatPage's stance exactly: a keyboard
   user creates (and rides the follow-up re-render) without re-tabbing. */
function focusedCatAdd() {
  const a = document.activeElement;
  return a && a.classList && a.classList.contains('cat-add')
    ? a.closest('.board-cat').dataset.cat : null;
}
function refocusCatAdd(host, cat) {
  const b = cat && host.querySelector('.board-cat[data-cat="' + cat + '"] .cat-add');
  if (b) b.focus();
}

/* The drop writes category + catStamp = Date.now() — which IS moved-to-top,
   by the sort key. Whole-record puts (B13) make the write site two-headed:
   the open board mutates `current` and saves now (putting any snapshot would
   lose live edits); any other board is fetched fresh and put directly — the
   debounced persist can't clobber a record it never holds, and a fresh get
   can't resurrect a board deleted mid-drag. */
async function dropBoardCard(b, cat) {
  boardUi.catPage[cat] = 0;                    // the dropped card lands first — show it
  if (state.current && state.current.id === b.id) {
    state.current.category = cat;
    state.current.catStamp = Date.now();
    applyBoardCat();                   // the open board's ladder rotates with it (B67)
    saveNow();
  } else {
    const rec = await idbGet(b.id);
    if (rec) { rec.category = cat; rec.catStamp = Date.now(); await idbPut(rec); }
  }
  if (state.isWide) renderPane(); else renderListSurface();
}

/* Since issue #112 / B74 the All-Boards menu is a category PICKER, and the
   boards live on their own per-category screens reached by drilling into a
   picker button. renderListSurface() draws whatever #list-rows is currently
   showing (the picker's four category buttons, or one drilled category's
   boards) — the single site the re-render callers (a delete, a page turn, a
   capacity change) go through, so they don't each have to know the level.
   The level-1 picker is not #list-rows at all on any surface (B100): it is
   the Parking Lot turned into the grid (openLotMenu), which is static
   furniture with no board data to rebuild, so renderListSurface has nothing
   to do there. */
export async function renderListSurface() {
  if (!listOpen) return;
  if (catView) { await renderCat(catView); return; }
  // Level 1 is the lot-grid (B100): static furniture with no board data to
  // rebuild, so renderListSurface has nothing to do there — on any surface.
}

/* One drilled category on its own screen (issue #112 / B74): the same section
   the rail draws (head, New board, cards, pager), but alone, so catPageCap is
   told exactly one section is drawn and the whole screen height is its budget.
   The open board buckets from memory, not the snapshot, for renderPane's
   reason: `current` is authoritative for it. */
async function renderCat(cat) {
  const all = await idbGetAll();
  const boards = all
    .map(b => (state.current && b.id === state.current.id) ? state.current : b)
    .filter(b => catOf(b) === cat);
  boardUi.catFilled = 1;
  boardUi.catCap = catPageCap(1, 1);                  // one section drawn: it takes the whole surface
  const focusCat = focusedCatAdd();
  el.listView.classList.remove('picker');
  el.listRows.setAttribute('role', 'list');   // a list of board rows (restored from the picker's menu)
  el.listRows.textContent = '';
  el.listRows.appendChild(
    makeCatSection(cat, boards.sort(catOrder), boardUi.catCap, makeListRow));
  refocusCatAdd(el.listRows, focusCat);
}

/* The drilled category's rows are built by makeCatSection/makeListRow below.
   (The level-1 picker's own fill was buildCatButtons into #list-rows until
   B100 retired it — the lot-grid's fill is the same buildCatButtons.) */

/* The four category buttons, in the 2x2 clockwise order (GRID_ORDER). Fill the
   mobile/tablet lot-grid (B100: the one picker), so every picker surface reads
   as one menu in one nomenclature — each button names its section exactly as
   the section head does ("To-Do Boards", "Note Boards", "Learning Boards",
   "Idea Boards"). data-cat carries the family so the tray wears the board
   type's hue (B72/B67). */
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
  // Since issue #112 / B74 the drilled category screen is a desktop surface too.
  // Mobile summons the row menu by long-press (attachBoardCardGestures); desktop
  // reaches the same Export/Delete menu by right-click, exactly as the rail card
  // does (makePaneRow), so a board can be exported or deleted from the drill.
  card.addEventListener('contextmenu', (ev) => {
    if (!state.isDesktop) return;              // mobile keeps its native context menu; the hold is the path
    ev.preventDefault();
    let x = ev.clientX, y = ev.clientY;
    if (!x && !y) {                      // Shift+F10 fires contextmenu at 0,0
      const r = card.getBoundingClientRect();
      x = r.left + r.width / 2; y = r.top + r.height / 2;
    }
    state.menuInvoker = card;                  // focus returns to the card on close
    openBoardRowMenu(row, b, x, y);
  });
  return row;
}

export function formatDate(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
// The card's "Last Updated" stamp reads MM/DD/YY (B82, issue #125, UIUX §10):
// zero-padded month and day, a two-digit year, compact enough for the narrow
// three-across card. Local time, like formatDate. formatDate itself stays the
// PDF export's long form (§10.5) — this is a second formatter, not a change.
function formatMDY(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return p(d.getMonth() + 1) + '/' + p(d.getDate()) + '/' + p(d.getFullYear() % 100);
}

/* One gesture law for a board card, on either surface (issue #74 / B44).
   Pointer-based, never native HTML5 DnD — that fights the cards' button
   semantics and paints its own ghost. Movement past MOVE_THRESHOLD turns the
   press into a drag: the origin row dims in place, a fixed clone rides the
   pointer, and the category under it frames itself in --accent-page — where
   the board will land. A motionless release is the old tap (open, or swap);
   a motionless mobile *hold* is the board's menu, which movement cancels.

   Mobile can afford move-to-drag only because the list pages instead of
   scrolling: there is no vertical pan left for the gesture to be confused
   with. See B44. */
function attachBoardCardGestures(card, row, b, opts) {
  let down = false, dragging = false, longed = false, t = null;
  let sx = 0, sy = 0, gx = 0, gy = 0;
  let ghost = null, over = null;
  const clearDrag = () => {
    clearTimeout(t);
    if (ghost) { ghost.remove(); ghost = null; }
    row.classList.remove('card-dragging');
    if (over) { over.classList.remove('drop-target'); over = null; }
    dragUi.dragCancel = null;
  };
  card.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;        // right-click stays the contextmenu path
    down = true; dragging = false; longed = false;
    sx = e.clientX; sy = e.clientY;
    const r = card.getBoundingClientRect();
    gx = sx - r.left; gy = sy - r.top; // grab point, so the ghost doesn't jump
    card.setPointerCapture(e.pointerId);
    // Mobile summons the board menu by hold; desktop reaches the same menu by
    // right-click, on the card's own contextmenu listener (B24).
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
      // Register the teardown: a re-render mid-drag destroys this card and its
      // capture, so the render must be able to cancel the gesture.
      dragUi.dragCancel = () => { down = false; dragging = false; clearDrag(); };
      row.classList.add('card-dragging');
      // The same "the gesture just changed mode" signal the hold gives.
      if (!state.isDesktop && navigator.vibrate) navigator.vibrate(10);
      ghost = card.cloneNode(true);
      ghost.classList.add('card-drag-ghost');
      // The ghost is fixed to the viewport off document.body, which takes it
      // out of its section's [data-cat] token scope — so it carries the scope
      // with it (B67). Without this the card lifts off green and turns blue
      // mid-drag, because .board-row/.pane-card's water would resolve against
      // :root. The attribute is the same one styles.css binds the ladder on.
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
    // A drop is a completed gesture like endDrag — saved immediately.
    // Releasing over the section the card already lives in is a change of
    // mind, not a move: no write, no reorder-to-top, no page reset.
    if (target && target !== catOf(b)) dropBoardCard(b, target);
    else if (!spent && opts.onTap) opts.onTap();   // swap commits a view, not a consequence — instant (B81)
  });
  card.addEventListener('pointercancel', () => { down = false; dragging = false; clearDrag(); });
}
// Order (A1 / UIUX §7): non-destructive first, destructive last, hairline
// between. One call site, so this lights up on both the mobile long-press and
// the desktop right-click.
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
  // On desktop the board view has no list screen to heal a dead `current` on
  // return, so heal it now, or the next interaction dereferences current.notes
  // (review finding 2). This holds whether the delete came from the rail or the
  // desktop drilled-category overlay.
  if (state.isDesktop && wasCurrent) await ensureCurrentValid();
  if (listOpen) {
    // Re-paginate the visible list overlay (the drill, either platform, or the
    // desktop picker). The row's own leave() plays first, so a delete on a full
    // page pulls the next board up instead of leaving a hole (issue #74). The
    // rail behind a desktop drill is hidden — rendering it here would leave the
    // visible drill with the hole (issue #112 review).
    setTimeout(renderListSurface, LEAVE_MS);
  } else if (state.isWide) {
    renderPane();
  }
  showUndo(async () => {
    await idbPut(snapshot);
    // Restore into the visible surface: the open list overlay (drill/picker,
    // either platform), else the desktop rail — reopening the board there if it
    // was the one showing (issue #112 review).
    if (listOpen) { renderListSurface(); return; }
    if (state.isWide) { if (wasCurrent) swapBoard(snapshot.id); else renderPane(); }
  }, 'board');
}

async function openBoardById(id) {
  finalizeItemUndo();                                   // see swapBoard (finding 1)
  flushSave();                                          // the mobile twin of swapBoard's
                                                        // flush: one law, two skins (B69)
  const rec = await idbGet(id);
  if (!rec) return;
  state.current = rec;
  returnToBoard();                                      // pop the nav stack → board (B9)
}

/* Pop the list nav back to the board, however deep (issue #112 / B74). A board
   is opened from a drilled category (level 2, {v:'cat'}), so both its own state
   and the picker's below it come off in one go — history.go(-2) fires a single
   popstate with the board's null state. A one-level open (a guard for the
   picker, though it holds no boards) pops once. B9 is untouched: this is the
   back gesture's own machinery, never a shadow of it.

   `history.go` is async and NOT idempotent: two calls before its popstate lands
   pop twice, and the second pop takes the board's own entry — out of the app.
   `goToList` guards its twin with a synchronous `listOpen` check, but `listOpen`
   is not cleared until this pop's popstate runs, so a re-entrancy flag is what
   makes the "This board" toggle (mobile, where the tab is not blurred) safe
   against a fast double-tap (B83). Cleared on the next popstate, when the nav
   this began has landed. */
export let popping = false;
export function returnToBoard() {
  if (popping) return;
  // B124 embed: nothing was pushed, so there is nothing to pop — land on the
  // board directly (exactly what the popstate handler would do) instead of
  // popping the parent page's session history.
  if (EMBED) { showBoardFromList(); return; }
  popping = true;
  const depth = (history.state && history.state.v === 'cat') ? 2 : 1;
  history.go(-depth);
}

export function openBoardObj(board) {
  state.current = board;
  renderBoard();
}

/* Creation lives in the categories (issue #88 / B63): each section's own New
   board control writes the category it sits in — explicitly, 'unsorted'
   included (dropBoardCard's precedent; catOf stays a read-site default) — and
   stamps catStamp so the new board lands first, like a drop. The board opens
   at once, on either surface: a control that made something you then had to
   go find would tax the very moment it exists to serve. */
export async function newBoardIn(cat) {
  finalizeItemUndo();                                   // see swapBoard (finding 1)
  flushSave();                                          // stamp any pending edit BEFORE the
                                                        // new board's own, so B63's "lands
                                                        // first" holds under B69's order
  const board = newBoardRecord();
  board.category = cat;
  board.catStamp = Date.now();                          // lands first by catOrder, like a drop
  await idbPut(board);
  boardUi.catPage[cat] = 0;                                     // the new card's page — show it
  // The branch is the routing invariant, not the mode: history.back() is only
  // lawful while the list's pushed state is still on the stack. An OS back
  // gesture or a mode flip clears listOpen before this fires — then the swap
  // opens the board without popping an entry the
  // list no longer owns (B9 untouched; the swap's renderPane no-ops off-desktop).
  if (!listOpen) { swapBoard(board.id); return; }
  state.current = board;
  returnToBoard();                                      // page-turn back to the board (B9)
}

/* --- 11.5 Desktop board pane (issues #9 / #10 / #14) ---------------------- */
export let swapping = false;                // async re-entrancy guard beyond the commit drop-guard

/* A pending note/lot Undo splices into whatever board is `current` at undo
   time — switching boards would resurrect it onto the wrong board. Board
   swaps finalize it (the delete is already persisted). Board-scoped Undo is
   cross-board-safe and survives. (Review finding 1.) */
function finalizeItemUndo() {
  if (el.toast.dataset.scope === 'item') { clearTimeout(undoTimer); hideToast(); }
}

export async function swapBoard(id) {
  if (swapping) return;
  if (state.current && state.current.id === id) return;
  finalizeItemUndo();
  swapping = true;
  flushSave();                        // persist() snapshots `current` synchronously — safe
  const rec = await idbGet(id);
  if (!rec) { swapping = false; renderPane(); return; }
  el.board.classList.add('swapping');
  setTimeout(() => {                  // setTimeout, not transitionend: the reduced-motion
    state.current = rec;                    // kill-switch zeroes transitions (§8)
    renderBoard();
    renderPane();
    el.board.classList.remove('swapping');
    swapping = false;
  }, SWAP_MS);
}

/* The rail renders the shared three sections (§11): same law, same paging,
   same drag, same head/add/cards/pager grid as the mobile list (B63) — the
   rail's skin only tightens the row heights and the control's label. */
export async function renderPane() {
  if (!state.isWide || !el.paneCards) return;   // wide: the rail exists on tablet too (B96)
  // A re-render tears the captured card out from under a live drag — pointerup
  // would never arrive, stranding the fixed ghost on screen. Cancel it first.
  if (dragUi.dragCancel) dragUi.dragCancel();
  const all = await idbGetAll();
  const buckets = { todo: [], idea: [], unsorted: [], learning: [] };
  // The open board buckets from memory, not the snapshot: `current` is
  // authoritative for it (the export takes the same stance), and a drop's
  // write can still be behind the debounced persist when this getAll runs.
  for (const b of all) {
    const rec = (state.current && b.id === state.current.id) ? state.current : b;
    buckets[catOf(rec)].push(rec);
  }
  boardUi.catFilled = BOARD_CATS.filter(c => buckets[c].length).length;
  // B137: the tablet rail is a one-open accordion — only the expanded section
  // shows cards, so its budget is one populated section's share of the pane
  // (the three folded heads reclaim theirs). Desktop keeps all four expanded.
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
    // Deletion path (a), issue #10: a permanent control on the open board's
    // card only — deleting keeps the board's contents in front of you.
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'pane-del';
    del.setAttribute('aria-label', 'Delete board');
    del.innerHTML = GLYPH.delete;                    // drawn mark (UIUX §13.3)
    del.addEventListener('click', () => commitAction(() => deleteBoard(b.id, row)));
    row.appendChild(del);
  }
  // Pointer path (issue #58): press-and-move past MOVE_THRESHOLD drags the
  // card between categories; a motionless release keeps the old click
  // behavior (inactive → swap). Replaces the bare `click`
  // listener so a drag's release can't also swap boards. The active card
  // drags like any other, but has nothing to swap to.
  attachBoardCardGestures(card, row, b, {
    container: el.paneCards, onTap: isActive ? null : () => swapBoard(b.id),
  });
  // Keyboard activation still arrives as a `click` with no pointer sequence
  // (detail 0) — the swap stays reachable without a mouse.
  if (!isActive) card.addEventListener('click', (ev) => {
    if (ev.detail === 0) swapBoard(b.id);   // navigation — instant, no guard (B81)
  });
  // Deletion path (b), issue #10: right-click any card → the board menu
  // (Export, then Delete). The one summoning gesture "remove click-and-hold"
  // doesn't touch, and it collides with nothing else in the app.
  card.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();              // scoped to the card; elsewhere stays native
    let x = ev.clientX, y = ev.clientY;
    if (!x && !y) {                   // Shift+F10 fires contextmenu at 0,0
      const r = card.getBoundingClientRect();
      x = r.left + r.width / 2; y = r.top + r.height / 2;
    }
    state.menuInvoker = card;               // focus returns to the card on close
    openBoardRowMenu(row, b, x, y);
  });
  return row;
}

/* Live title (issue #14): the active card updates in place per keystroke; a
   full renderPane on commit reconciles the untitled date line. */
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
  // B100 (issue #157): the picker is the lot-grid on every surface that has
  // the tab (mobile and tablet — desktop's tab is retired, the rail is its
  // all-boards surface). The grid opens over the lot without occluding the
  // tab, so its focus is not stranded and is kept.
  histPush({ v: 'list' });             // B124 embed: replaceState — no parent-history entries
  showList();
}
/* Level 1 — the All-Boards picker (issue #112 / B74; issue #157 / B100): the
   Parking Lot turned into the 2x2 grid on mobile AND tablet, drawn over the
   lot at its current height (openLotMenu), leaving the board and its
   parking-lot data untouched beneath. Desktop has no picker and no #list-view
   at level 1: its All-boards tab is retired (B100) — the left rail (B24)
   already lists every category with every board. */
function showList() {
  listOpen = true;
  catView = null;
  syncViewTitle();                    // the picker names itself (issue #148 item 2)
  syncBoardActions();                 // the tab stays visible above the grid — flip it to "This board" (B83)
  openLotMenu();
}
/* Drilling a picker button opens that category's own screen — level 2. It is a
   navigation, inert like the pager (B22), so no B18 window. The mobile grid is
   dismissed as the drill screen takes over; the board's real lot returns when
   the whole stack pops back. */
export function drillCat(cat) {
  histPush({ v: 'cat', cat });         // B124 embed: replaceState — no parent-history entries
  showCat(cat);
}
async function showCat(cat) {
  listOpen = true;
  catView = cat;
  syncViewTitle();                    // the drill names itself (issue #148 item 2)
  closeLotMenu();                     // B100: the drill is a screen; the grid steps aside, on every surface
  el.listView.classList.remove('show'); // mobile: start below the fold; inert on desktop
  el.listView.hidden = false;
  await renderCat(cat);                // measures the panel's real height BEFORE the rise
  // The rise (B82, issue #125): the #toast translateY idiom — one rAF so the
  // below-the-fold frame paints before .show flips it to translateY(0), on §8's
  // one 200ms curve. Reduced-motion kills the transition (styles.css §8), so it
  // lands instant. Desktop #list-view has no panel transform: .show is a no-op
  // there and the full-screen overlay is already shown. The guard skips a rise
  // whose navigation was superseded before the frame arrived.
  requestAnimationFrame(() => {
    if (listOpen && catView === cat) el.listView.classList.add('show');
  });
}
/* Mobile only: the Parking Lot becomes the All-Boards menu (issue #112 / B74).
   A transient overlay drawn over #lot at its current --lot-h — if the lot is
   expanded, so is the grid — filled by the four category buttons. It never
   touches current.parkingLot: the board's own lot data is only hidden, and it
   returns intact the moment the picker is dismissed. */
function openLotMenu() {
  lotMenuOpen = true;
  el.lotMenu.textContent = '';
  buildCatButtons(el.lotMenu);
  el.lotMenu.hidden = false;
  el.lot.classList.add('menu-open');   // hides the lot's own rule/header/items
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
  // The board being replaced is gone from storage; drop its pending debounce
  // with it, or the timer would fire against its successor and stamp a board
  // nobody edited — which under B69 would move that card (§3's `dirty` rides
  // whatever `current` is, so it is cleared wherever `current` is replaced).
  clearTimeout(saveTimer); state.dirty = false;
  const all = await idbGetAll();
  // Events ride the boards store (B105) with no `updatedAt` — same reduce
  // hazard as boot's most-recent pick: an event-first store would open an
  // event as the board. Current is a BOARD.
  const boards = all.filter(r => r.title !== undefined);
  state.current = boards.length ? boards.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a)) : newBoardRecord();
  if (!boards.length) await idbPut(state.current);
  renderBoard();
}
/* Put the #list-view away (B82, issue #125). Mobile slides the drilled panel
   back down and hides it once it has fallen — sequenced by setTimeout, never
   transitionend (B24): reduced-motion kills the transition and the hide still
   lands on the same clock, and a re-open before it fires re-adds .show so the
   guard leaves the panel up. Desktop hides its full-screen overlay at once —
   there is no panel to fall, and its own tests expect an instant hide. */
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
  closeLotMenu();                      // mobile: the grid steps aside, the real lot returns
  hideListView();                      // slide the drilled panel down, then hide (B82)
  if (!state.current) { await ensureCurrentValid(); }
  else { renderBoard(); }
  if (state.isWide) renderPane();         // a board opened from the #list-view drill lights its rail card
}

/* --- 11.6 The rolling temporal calendar (issue #145) ----------------------
   The third screen. The 7-day window is computed at render (R4) — today at
   the top, lit; the week receding below it. Each date with events mirrors
   into its linked To-Do board (§1.7). The exit row (R1) is the screen's
   always-visible way off: Collapse alone (renamed and reseated by B134,
   issue #259 — it renders LAST, at the view's bottom below the month view,
   reading `Collapse ▶`; it runs history.back(), B9's route made visible;
   B124 keeps the row to one control: All Boards via the picker/rail, Export
   elsewhere). The stack never scrolls — it is a bounded page like every
   other surface. */
                                   // the rail is furniture, so it must never enter the
                                   // screen-grammar branches (popstate's calOpen swallow,
                                   // the tier flip's close, hideCal) that a pushed screen owns.

export function goCalBack() {
  // B124 embed: nothing was pushed, so there is nothing to pop — close the
  // calendar directly (the popstate off-{v:'cal'} branch's act).
  if (EMBED) { hideCal(); return; }
  history.back();                      // pop {v:'cal'} → the board (B9's route, visible)
}

/* --- The standing rail (issue #158, B99) ----------------------------------
   Wide's calendar is FURNITURE, not navigation: the 40px rail renders at
   boot (and on every flip to wide), reading "Calendar Board" vertically with
   today's date and a lit dot when today carries events (the mockup's
   aperture). Tapping it expands the panel — the R6 squeeze, entered from the
   rail — and the panel's own Collapse control (R1's exit act, reused as the
   collapse arrow; B134, issue #259) returns the rail. The rail commits
   nothing (B81: navigation runs raw); no history is pushed on wide, the rail
   is never "off". */
export function renderCalRail() {
  if (!state.isWide) return;
  el.calView.hidden = false;          // the rail is standing furniture: never hidden on wide
  const today = new Date();
  const p = (n) => String(n).padStart(2, '0');
  el.calRail.querySelector('.cdate').textContent =
    calDayName(today).slice(0, 3) + ' ' + p(today.getMonth() + 1) + '/' + p(today.getDate());
  // The dot is the aperture (mockup 6): lit iff today carries events.
  flushSave();
  idbGetAll().then((all) => {
    const lit = calEventsOf(eventsOf(all), calKey(today)).length > 0;
    el.calRail.querySelector('.cdot').classList.toggle('lit', lit);
  });
}

export function showCalRail() {
  closeLotMenu();
  hideListView();
  listOpen = false; catView = null;
  syncBoardActions();
  el.calView.hidden = false;
  el.calView.classList.add('rail-open');
  el.calView.classList.remove('panel');
  setCalSqueeze(false);               // collapsed: the 40px reservation only
  el.calRail.hidden = false;
  el.calRail.setAttribute('aria-expanded', 'false');
  renderCalRail();
}

function expandCalRail() {
  el.calView.classList.remove('rail-open');
  el.calView.classList.add('panel');
  el.calRail.hidden = true;
  el.calRail.setAttribute('aria-expanded', 'true');
  state.calExpanded = true;                 // the screen-grammar state rides the PANEL, not the rail
  setCalSqueeze(true);                // the board reflows beside the panel (R6)
  renderCal();                        // the expanded face: the 7-day stack
}

function collapseCalRail() {
  el.calView.classList.add('rail-open');
  el.calView.classList.remove('panel');
  el.calRail.hidden = false;
  el.calRail.setAttribute('aria-expanded', 'false');
  state.calExpanded = false;
  setCalSqueeze(false);               // the squeeze lifts; the board returns (R6)
  renderCalRail();
}

/* --- 11.6 The collapsible All-Boards rail (issue #211, B118) ---------------
   The left rail mirrors B99's calendar-rail grammar: on wide it boots
   COLLAPSED to the 40px face (#pane-rail, the pane's own name reading
   vertically), one tap expands it to the 300px pane — renderPane's cards,
   unchanged — and the expanded pane's arrow (#pane-collapse) folds it back,
   seated at the pane's bottom-right corner since B134 (issue #259), arrow
   right. The arrow is the collapse affordance, the pane's Collapse-double
   (the pane has none of its own). Raw navigation both ways (B81/B24): no
   history is pushed, nothing is committed. The board reflows through the
   frame: the collapsed face frees the sheet, the expanded pane reserves it
   (R6's discipline, mirrored in setPaneCollapsed). */
export function expandPane() {
  el.pane.classList.remove('rail-open');
  el.paneRail.hidden = true;
  el.paneRail.setAttribute('aria-expanded', 'true');
  el.paneCollapse.hidden = false;
  setPaneCollapsed(false);            // the frame re-reserves the pane's 300px
  renderPane();
}

export function collapsePane() {
  el.pane.classList.add('rail-open');
  el.paneRail.hidden = false;
  el.paneRail.setAttribute('aria-expanded', 'false');
  el.paneCollapse.hidden = true;
  setPaneCollapsed(true);             // the 40px face only; the board fills the freed width
}

export function showCal() {
  // Wide enters through the standing rail (B99); mobile keeps the pushed
  // full-screen view (B95's mobile path, unchanged).
  if (state.isWide) { showCalRail(); return; }
  state.calOpen = true;
  closeLotMenu();
  hideListView();
  listOpen = false; catView = null;
  syncBoardActions();
  // The squeeze is the desktop/tablet arrangement (R3/R6): the panel takes
  // real width beside the board; on mobile the calendar is the full screen.
  el.calView.classList.toggle('panel', state.isWide);
  setCalSqueeze(state.isWide);
  renderCal();
}

/* The popstate branch: {v:'cal'} re-shows the calendar (an OS-forward onto
   it); leaving it lands on the board and restores the action row. */
function hideCal() {
  if (!state.calOpen && !state.calExpanded) return;
  state.calOpen = false;
  state.calExpanded = false;
  el.calView.hidden = !state.isWide;       // wide: the rail face remains (furniture, B99)
  el.calView.classList.remove('panel');   // the expanded face lifts
  el.calView.classList.toggle('rail-open', state.isWide);
  el.calRail.hidden = !state.isWide;
  setCalSqueeze(false);              // the squeeze lifts; the frame returns (R6)
  syncBoardActions();
  if (!state.isWide) renderBoard();
  else renderCalRail();
}

function calDayName(d) {
  return d.toLocaleDateString(undefined, { weekday: 'long' });
}
export function calMD(d) {
  const p = (n) => String(n).padStart(2, '0');
  return p(d.getMonth() + 1) + '/' + p(d.getDate());
}

export function makeCalDay(day, events, board) {
  const card = document.createElement('div');
  card.className = 'cal-day' + (day.today ? ' today' : events.length ? ' near' : ' far');
  const dc = document.createElement('div');
  dc.className = 'cal-date on-dark';
  const d1 = document.createElement('div'); d1.className = 'cal-d1';
  d1.textContent = day.today ? COPY.calToday : calDayName(day.date);
  const d2 = document.createElement('div'); d2.className = 'cal-d2';
  d2.textContent = calMD(day.date);
  dc.append(d1, d2);
  const dl = document.createElement('div');
  dl.className = 'cal-lines on-dark';
  dl.setAttribute('role', 'list');
  for (const ev of events) {
    const line = document.createElement('div');
    line.className = 'cal-line' + (ev.state === 'complete' ? ' complete' : '');
    line.setAttribute('role', 'listitem');
    line.textContent = ev.text;
    // Existing events are editable in place (issue #152): the line IS the
    // control — a tap opens its existing editor, focused with the caret at
    // the end, inside the tap gesture. No new surface, no mode (B95 intact).
    // The native click's caret placement fires with the mouseup — on desktop
    // AFTER the click handler (caretToEnd wins); on touch the placement is
    // coalesced BEFORE the click dispatch (caretToEnd loses), and the caret
    // sits at the tap point — so the first typed characters splice mid-word
    // instead of appending (the bug class this issue reports). The deferred
    // re-assert runs after both orders and lands the caret at the end either
    // way. The guard keeps a second tap while editing from re-arming the
    // editor and double-committing (B81's concern). Edit-entry is navigation,
    // so it runs raw — the commit is the blur, which writes and re-syncs
    // itself.
    line.addEventListener('click', (e) => {
      if (line.hasAttribute('contenteditable')) return;
      e.preventDefault();
      startCalLineEdit(line, ev);
      setTimeout(() => caretToEnd(line), 0);
    });
    dl.appendChild(line);
  }
  // Capture lives on the day (PRD §6.2's grammar, calendar edition): the
  // zone's last row is the add control — tap and type, no dialogs, no pickers
  // (R5: adding an event is the trigger that creates the linked board, so the
  // control carries that consequence and runs under commitAction's guard).
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'cal-add';
  add.setAttribute('aria-label', 'Add event ' + calMD(day.date));
  add.textContent = '+';
  add.addEventListener('click', () => addCalEvent(day.key, dl));
  dl.appendChild(add);
  card.append(dc, dl);
  return card;
}

/* Add an event to a date (R5's whole chain, one consequence):
   1. the date's linked board is ensured (created on the first event) —
      UNLESS the date is in the future (B131): the event record is the only
      stored thing; the board materializes on its date via the morning
      lifecycle, which gives it the same first-sync calReq (launchTodayBoard),
   2. the event record is written to the store,
   3. the board's Requirements mirror is synced (same-day only, per 1),
   4. the records persist, and the line appears in the day zone at once.
   Creating + writing are consequences (records change), so the whole step
   runs under commitAction's drop-guard (B81) — a double-tap adds one event.
   The line's editor opens on arrival: capture precedes structure, §1.1. */
async function addCalEvent(dateKey, zone) {
  commitAction(async () => {            // the guard arms synchronously (B81); the
                                        // work itself is fire-and-forget, like every
                                        // async consequence in this file

    flushSave();
    const all = await idbGetAll();
    const ev = newCalEvent(dateKey, '');
    if (dateKey <= calKey(new Date())) {  // B131 (issue #250): a FUTURE-dated
                                          // event stores the event record
                                          // alone — its linked board is derived
                                          // state that materializes on its date
                                          // via the morning lifecycle, so
                                          // nothing future-dated ever enters
                                          // the boards store.
      const boards = all.filter(b => b.title !== undefined);
      const { board } = ensureLinkedBoard(boards, dateKey);
      if (board.calReq === undefined) {
        // First sync for this board: the span is the events it already had.
        board.calReq = calEventsOf(eventsOf(all), dateKey).length;
      }
      await idbPut(board);
    }
    await idbPut(ev);
    const line = document.createElement('div');
    line.className = 'cal-line';
    line.setAttribute('role', 'listitem');
    line.textContent = '';
    const old = zone.querySelector('.cal-add');
    zone.insertBefore(line, old);
    startCalLineEdit(line, ev);
  });
}

/* The event line's editor. Commit-on-blur writes the event text AND the
   linked board's mirror line together — one edit, both surfaces, the
   mirror's one-writer law. An empty commit discards (B8's rule: the frame
   must earn its keep), sweeping the event record with it. */
export function startCalLineEdit(line, ev) {
  line.setAttribute('contenteditable', CE);
  line.focus();
  caretToEnd(line);
  const commit = async () => {
    line.removeAttribute('contenteditable');
    const text = line.textContent.trim();
    if (!text) {                            // B8: a whitespace commit discards
      await idbDelete(ev.id);
      line.remove();
      await syncDateMirror(ev.date);
      return;
    }
    ev.text = text;
    await idbPut(ev);
    await syncDateMirror(ev.date);
    scheduleSave();
  };
  line.addEventListener('blur', commit, { once: true });
  line.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); line.blur(); }
  });
}

/* Re-sync a date's whole mirror after any event write: the board's span is
   rewritten from the live event list (one writer). */
export async function syncDateMirror(dateKey) {
  const all = await idbGetAll();
  const boards = all.filter(b => b.title !== undefined);
  const board = calBoardOf(boards, dateKey);
  if (!board) return;
  if (syncMirror(board, calEventsOf(eventsOf(all), dateKey))) await idbPut(board);
}

/* The REVERSE direction of startCalLineEdit (issue #154, B106): a board-side
   Requirements commit writes through to the event records the mirror's span
   mirrors, then resyncs. Within the span the BOARD is the word now — each
   span line rewrites its positional event (mirrorEventsOf's law, span line
   i ↔ event i), a deleted span line deletes its event (event-deletion
   semantics, never demotion), and lines after the span are hand lines this
   path never touches. Board-side additions land after the span as hand lines
   (insertion inside the span is ambiguous, B106). The resync runs syncMirror
   on the LIVE board object, not a fresh store read — the commit's own
   saveNow is racing the same record, and one object cannot disagree with
   itself. Fire-and-forget async, like every consequence in this file.

   `before` is the pre-edit text (snapshotted at edit entry, interactions.js):
   a plain-text anchor cannot say WHICH line was deleted, but a prefix/suffix
   diff can — a pure deletion (the middle collapsed to nothing) removes the
   deleted lines' events and never lets a hand line slide up into the span.
   Any mixed edit/delete falls to the positional law, which converges: the
   board's span text is the word, position by position. */
export async function writeThroughRequirements(board, before) {
  if (!board || !board.cal) return;
  const all = await idbGetAll();
  const mine = calEventsOf(eventsOf(all), board.cal);
  const lines = (board.requirements || '').length
    ? board.requirements.split('\n') : [];
  const span = typeof board.calReq === 'number'
    ? board.calReq
    : Math.min(lines.length, mine.length);   // first sync on a legacy pair
  const o = (before || '').length ? before.split('\n') : [];
  let p = 0;   // common prefix — the lines both texts agree on, from the top
  while (p < o.length && p < lines.length && o[p] === lines[p]) p++;
  let s = 0;   // common suffix — from the bottom, never overlapping the prefix
  while (s < o.length - p && s < lines.length - p &&
         o[o.length - 1 - s] === lines[lines.length - 1 - s]) s++;
  if (o.length > lines.length && lines.length === p + s) {
    // Pure deletion: old lines [p, o.length - s) are gone.
    const lo = Math.min(p, span), hi = Math.min(o.length - s, span);
    for (let i = lo; i < hi && i < mine.length; i++) await idbDelete(mine[i].id);
    const kept = mine.filter((_, i) => i < p || i >= o.length - s);
    board.calReq = span - (hi - lo);         // the span follows its deletions
    syncMirror(board, kept);
    await idbPut(board);                     // always: saveNow raced the span move
    return;
  }
  const keep = Math.min(span, lines.length);
  // Span-line edits: line i writes through to event i.
  for (const { event, text } of mirrorEventsOf(board, all)) {
    if (event.text !== text) { event.text = text; await idbPut(event); }
  }
  // A shrunken span deletes its surplus events.
  for (let i = keep; i < span && i < mine.length; i++) await idbDelete(mine[i].id);
  if (keep !== span) board.calReq = keep;    // the span follows the board's deletion
  if (syncMirror(board, mine.slice(0, keep)) || keep !== span) {
    await idbPut(board);                     // saveNow raced the span move
  }
}

/* Event records ride the boards store (one store, no schema bump); they are
   the records with a `date` and no `title`. Filtered once, at the read. */
export function eventsOf(all) {
  return all.filter(r => typeof r.date === 'string' && typeof r.text === 'string' && r.title === undefined);
}

/* --- The day-roll launch (issue #153, B105) + the morning lifecycle (B108) -
   Each morning's first load, TODAY's linked To-Do board exists — created by
   `ensureLinkedBoard` even with zero events (B107's unconditional landing,
   superseding B105's events-exist-only morning condition) — and boot lands
   on it, carrying forward yesterday's incomplete notes (below). The check
   still runs ONCE PER DAY KEY: at boot, and at renderCal only when the
   today key changed since the last check (the open-past-midnight case) —
   never per render, so it cannot steal focus mid-interaction. The
   MID-SESSION roll keeps B105 exactly as shipped: it navigates only when
   the day carries events and carries nothing forward; the morning work is
   boot's alone, keyed by the same once-per-day guard. */
let rollDay = null;                     // the day key the roll check last ran for

export function checkDayRoll() {
  const today = calKey(new Date());
  if (rollDay === today) return;
  const morning = rollDay === null;     // first check of a page load = boot's
  rollDay = today;
  launchTodayBoard(today, morning);
}

async function launchTodayBoard(today, morning) {
  commitAction(async () => {            // creating the board is a consequence
                                        // (ensureLinkedBoard's contract, B81) —
                                        // same wrap as addCalEvent's R5 chain
    // B131: the boot pick can BE a ghost (the most-recent record is often a
    // future board the pre-fix build created). Detach it BEFORE flushSave —
    // persist() early-returns on no current, so the ghost's snapshot never
    // lands behind the sweep's delete and resurrects it.
    if (state.current && state.current.cal > today &&
        !(state.current.notes || []).length) state.current = null;
    flushSave();
    const all = await idbGetAll();
    if (!morning && !calEventsOf(eventsOf(all), today).length) return;
    const boards = all.filter(b => b.title !== undefined);
    const { board } = ensureLinkedBoard(boards, today);
    if (morning) {
      if (board.calReq === undefined) {
        // B131 (issue #250): the first sync addCalEvent no longer does for a
        // future-dated event's board — the span is the events it already had.
        board.calReq = calEventsOf(eventsOf(all), today).length;
      }
      // B131 migration sweep: linked boards already created for future dates
      // by the pre-fix build are derived empty state — delete them once (the
      // event records survive; they live in the store separately).
      for (const b of boards.slice()) {
        // No current-board guard: at the morning boot the sweep runs before
        // the landing swaps current to today's board, and the most-recent
        // pick could BE a ghost — skipping it would defeat the sweep.
        if (b !== board && b.cal > today && !(b.notes || []).length) {
          boards.splice(boards.indexOf(b), 1);
          await idbDelete(b.id);
        }
      }
      await carryForward(boards, board, today);
    }
    if (state.current && state.current.id === board.id) persist();
    else await idbPut(board);
    await syncDateMirror(today);
    // Step off the calendar first — mobile pops the pushed {v:'cal'} (B9),
    // wide collapses the expanded panel to its rail — then the plain swap.
    if (state.calOpen) goCalBack();
    else if (state.calExpanded) collapseCalRail();
    swapBoard(board.id);
  });
}

/* Carry-forward (issue #169, B108): yesterday's linked board's INCOMPLETE
   notes MOVE onto today's board at their same logical x/y — MOVE, not copy
   (History is retrospective reference; the carried notes' absence from
   yesterday's board is the owner's accepted ruling). Each carried note
   wears `carriedOn` = today's date key: the daily marker the carried
   indicator reads (self-clearing by date comparison — no cleanup pass; the
   flag is set again, to the new today, by each later carry). Completing a
   note clears it (interactions.js setNoteState). Idempotent: a same-day
   reload finds yesterday's board already empty of incomplete notes. */
async function carryForward(boards, todayBoard, today) {
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yb = calBoardOf(boards, calKey(y));
  if (!yb || yb.id === todayBoard.id) return;
  const moving = (yb.notes || []).filter(n => n.state !== 'complete');
  if (!moving.length) return;
  for (const n of moving) { n.carriedOn = today; todayBoard.notes.push(n); }
  yb.notes = yb.notes.filter(n => n.state === 'complete');
  // yb may BE state.current (boot landed on it last session): mutate it
  // live and let swapBoard's flushSave persist it; otherwise write it now.
  if (state.current && yb.id === state.current.id) persist();
  else await idbPut(yb);
}

export function renderCal() {
  checkDayRoll();                // the day-roll launch (B105): once per day key
  el.calView.hidden = false;
  el.calStack.textContent = '';
  // §6/B7's collar on the exit row (issue #156, B98; retargeted by B134,
  // issue #259): the row's tab draws at the floor as a visible frame now, and
  // the collar tops up the width where geometry is tight — spent
  // edge-ward/downward since the row reseated at the view's bottom, never up
  // into the month view above it. The calendar is an unscaled surface, so the
  // draw scale k is 1 — the same arithmetic, one caller shape fewer than the
  // board row (no renderScale term). isDesktop inside hitInset picks the
  // 44px touch floor vs the 24px pointer floor, so B96's tablet tier
  // inherits the right one. Half-pixel headroom, per the board row's note.
  el.calTop.style.setProperty('--hit', (hitInset(el.calTop, 1) + 0.5) + 'px');
  const days = calWeekAnchor ? calWeekOf(calWeekAnchor) : calWindow();
  flushSave();
  idbGetAll().then((all) => {
    const events = eventsOf(all);      // event records ride the boards store (§1.7)
    for (const day of days) {
      const board = calBoardOf(all, day.key);
      const dayEvents = calEventsOf(events, day.key);
      el.calStack.appendChild(makeCalDay(day, dayEvents, board));
    }
    renderCalMonth(new Set(events.map((e) => e.date)));
  });
}

/* --- The month view (issue #191) ------------------------------------------
   A compact month grid in the viewport space #170 freed at the stack's
   bottom — no new rail, no new tab. Pure display: the only act a cell
   carries is the tap that swaps the week view to that date's week, run raw
   (navigation commits nothing, B81's rail precedent). Two anchors, both
   render-time state, nothing stored (R4's law): the month on show
   (calMonthAnchor, starts at today's month) and the week the stack shows
   (calWeekAnchor — null means the shipped today+6 window; a tap replaces it
   with the tapped date's Sunday-first week). */
let calMonthAnchor = null;
let calWeekAnchor = null;

const MO_WDS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/* The Sunday-first week containing `anchor`: seven consecutive days, today
   flagged by key comparison (the flag is computed, not positional — the
   tapped week usually does not contain today). */
function calWeekOf(anchor) {
  const days = [];
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - anchor.getDay());
  const tk = calKey(new Date());
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    days.push({ key: calKey(d), date: d, today: calKey(d) === tk });
  }
  return days;
}

function renderCalMonth(evDays) {
  const now = new Date();
  const a = calMonthAnchor || now;
  el.calMonth.textContent = '';
  // The head: back one month (left), the label, forward one month (right).
  const head = document.createElement('div');
  head.className = 'mo-head';
  const label = document.createElement('div');
  label.className = 'mo-label';
  label.textContent = a.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'mo-nav';
  back.setAttribute('aria-label', 'Previous month');
  back.textContent = '‹';
  const fwd = back.cloneNode();
  fwd.setAttribute('aria-label', 'Next month');
  fwd.textContent = '›';
  const nav = (dy, dm) => () => {
    calMonthAnchor = new Date(a.getFullYear() + dy, a.getMonth() + dm, 1);
    renderCal();                       // re-fetches the events; the grid redraws
  };
  back.addEventListener('click', nav(0, -1));
  fwd.addEventListener('click', nav(0, 1));
  head.append(back, label, fwd);
  el.calMonth.appendChild(head);
  // The weekday letters, then the day grid: leading blanks to Sunday-align
  // the 1st; adjacent-month days are not drawn (the compact form, per the
  // issue's structure-only template).
  const grid = document.createElement('div');
  grid.className = 'mo-grid';
  for (const wd of MO_WDS) {
    const c = document.createElement('div');
    c.className = 'mo-wd';
    c.textContent = wd;
    grid.appendChild(c);
  }
  const tk = calKey(now);
  const wkKeys = new Set(calWeekOf(now).map((d) => d.key));   // the current week's band
  const lead = new Date(a.getFullYear(), a.getMonth(), 1).getDay();
  const nDays = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate();
  for (let i = 0; i < lead; i++) grid.appendChild(document.createElement('div'));
  for (let d = 1; d <= nDays; d++) {
    const date = new Date(a.getFullYear(), a.getMonth(), d);
    const key = calKey(date);
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'mo-cell'
      + (key === tk ? ' today' : '')                    // today wears the to-do boards' water blue
      + (wkKeys.has(key) ? ' wk' : '')                  // the pale band across the current week
      + (evDays.has(key) ? ' ev' : '');                 // one dot per event-bearing day
    cell.setAttribute('aria-label',
      date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
      + (evDays.has(key) ? ', has events' : ''));
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
      renderCal();                       // the week view swaps to the tapped week
    });
    grid.appendChild(cell);
  }
  el.calMonth.appendChild(grid);
}

/* The exit row's acts (R1; one control since B124, renamed Collapse by B134,
   issue #259). Collapse pops the pushed state. All Boards opens
   the picker; the calendar shrinks to fit it rather than being overlaid (the
   B74 grid draws over the lot at its current height — same reading here, the
   calendar's stack compresses, nothing is covered). Export opens the B92
   choice menu anchored at the pressed control — PDF's leaf is the 7-day
   reference sheet (b8's exporter), JSON the whole-library backup. */

/* The back gesture drives the three levels now (B9, never shadowed): {v:'cal'}
   the calendar, {v:'cat'} a drilled category, {v:'list'} the picker, no state
   the board. Popping from a drill to the picker re-opens it on the surface the
   mode uses — the mobile grid or the desktop screen. The calendar's own branch
   comes FIRST: it can sit beneath a list state (All Boards from the calendar),
   so the state alone decides, not calOpen — landing on a non-cal state while
   the calendar is open hides it (Collapse from the calendar, or the picker's
   return re-entering the board).
   drilled category, {v:'list'} the picker, no state the board. Popping from a
   drill to the picker re-opens it on the surface the mode uses — the mobile
   grid or the desktop screen. */


/* Region init (issue #182): top-level side effects, explicit register()
   call from boot() — no module does load-time work. */
export function registerBoards() {

  // Frame-reflow (issue #182): a frame change can change the per-page
  // card budget, so re-render and re-paginate the surface that is showing.
  // Registered here (boards owns the surface state); geometry fires the
  // hook from applyLayout without importing boards (cycle-break).
  onFrameReflow(() => {
    // B137: the tablet accordion budgets one expanded section, the same call
    // renderPane makes — the re-paginate hook must not measure a stale fill.
    const accordion = state.isWide && !state.isDesktop;
    if (boardUi.catCap && catPageCap(accordion ? 1 : boardUi.catFilled, catView ? 1 : undefined) !== boardUi.catCap) {
      if (listOpen) renderListSurface();
      else if (state.isWide && el.paneCards) renderPane();
    }
  });
  el.calBack.addEventListener('click', () => {
    // On wide, Collapse IS the collapse arrow (B99, renamed by B134): the
    // panel returns to the rail, the squeeze lifts — no history to pop (the
    // rail pushed none). On mobile, Collapse pops the pushed {v:'cal'} state
    // (B9's route, visible — R1).
    if (state.isWide && state.calExpanded) { collapseCalRail(); return; }
    goCalBack();
  });
  el.calRail.addEventListener('click', () => {
    // Furniture's one act: expand (B99). Pure navigation, no commit (B81).
    if (!state.isWide || state.calExpanded) return;
    expandCalRail();
  });
  el.paneRail.addEventListener('click', () => {
    // The face's one act: expand (B118). Raw navigation, no commit (B81).
    if (!state.isWide) return;
    expandPane();
  });
  el.paneCollapse.addEventListener('click', collapsePane);
  window.addEventListener('popstate', () => {
    popping = false;                     // the nav returnToBoard began has landed (B83)
    closeMenu();
    const s = history.state;
    // B99: on wide the calendar is furniture — the rail never enters this
    // grammar (calOpen is mobile's screen flag). A stray {v:'cal'} landing on
    // wide collapses the panel (the mobile-era entry has no wide meaning);
    // mobile keeps its full-screen view.
    if (s && s.v === 'cal') { showCal(); }
    else if (state.calOpen || state.calExpanded) { hideCal(); }     // landing anywhere else closes the calendar first
    else if (s && s.v === 'cat') {
      if (state.isDesktop) { showBoardFromList(); }   // B100: desktop has no drill either — a stray landing (old-build history) heals to the board
      else { showCat(s.cat); }
    }
    else if (s && s.v === 'list') {
      if (state.isDesktop) { showBoardFromList(); }   // B100: desktop pushes no {v:'list'} — a stray landing (old-build history) heals to the board
      else { catView = null; hideListView(); showList(); }  // the drill's panel slides down as the grid returns (B82)
    }
    else { showBoardFromList(); }
  });
}