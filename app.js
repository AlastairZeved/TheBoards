/* ============================================================================
   To-Do Boards — app.js  (vanilla, no dependencies, no build step)

   Sections:
     1. Constants & copy
     2. IndexedDB persistence
     3. State + save queue
     4. Layout / scale-to-fit (PRD §5, UIUX §3/§11)
     5. Coordinate + caret helpers
     6. Note / anchor / lot rendering
     7. Gesture recognizer (UIUX §5)
     8. Editing, drag, pinch, z-order (PRD §6.2/§6.3)
     9. Complete / restore / delete + Undo toast (PRD §6.4/§6.6, UIUX §9)
    10. Long-press menu (UIUX §7)
    10.5 PDF export (issue #43)
    10.6 JSON backup: export all, import merged (issue #140, B92)
    11. Board list + routing (PRD §6.7, UIUX §10)
    12. Boot + service worker
   ========================================================================== */

'use strict';

/* --- 1. Constants & copy ------------------------------------------------- */
/* The frame the render math reads and writes: one object (issue #176).
   LOGICAL_W/H/LEGACY_H carry their B32/B20 comments below; the media-query
   booleans are assigned where the MQs are declared (original order kept). */
const viewState = {
  LOGICAL_W: 900,                    // mobile: = vw, the sheet is the viewport (B32); desktop: derived per layout (B20)
  LOGICAL_H: 1000,                   // responsive: recomputed each layout to fill the viewport
  LEGACY_H: 1000,                    // the LOGICAL_H the pre-B32 build would have produced
  renderScale: 1,
  offX: 0,
  offY: 0,
  layoutDeferred: false,
  editVVFloor: Infinity,
  calSqueeze: false,
  LOGICAL_W_TRUE: null,              // set only while squeezed
  isTablet: false,                   // assigned where TABLET_MQ is declared, as before
  isDesktop: false,                  // assigned where DESKTOP_MQ is declared, as before
  isWide: false,                     // desktop ∪ tablet — the arrangement tier
};
                                     // on this device. Read ONLY by migrateLegacyBoards
                                     // (B93): the render path no longer branches on it —
                                     // boot adopts every rh-less note onto the single
                                     // B64 path before first paint.
const NOTE_MIN_W = 132;              // real minimum rendered note width (UIUX §4.5, B84):
                                     // wide enough to seat the 4-button on-select toolbar.
                                     // One number does three jobs — the wrap-cap floor
                                     // (noteMaxW), the CSS min-width on .note-text, and the
                                     // drag/resize width floor — so a note can never be sized
                                     // narrower than its own row (issue #126 pt 4.1).
const MIN_SCALE = 0.5, MAX_SCALE = 2.0;
const MOVE_THRESHOLD = 16;           // px before a drag begins / long-press cancels (B29)
const KB_HIDE_SLOP = 120;            // visual-viewport growth (px) that reads as the soft
                                     // keyboard retracting, not URL-bar/inset jitter (B80, issue #119)
const LONGPRESS_MS = 500;
const HIT_FLOOR = 44;                // px physical (PRD §5.3, UIUX §6) — mobile
const HIT_FLOOR_DESKTOP = 24;        // WCAG 2.5.8 AA; a 44px collar swallows dismiss clicks (issue #12)
const PANE_W = 300;                  // CSS px; unscaled width of the desktop board rail
const PANE_CAT_HEAD = 32;            // .cat-head/.cat-add row, desktop (issue #88)
const PANE_PAGER_H = 32;             // .cat-pager row, desktop (issue #58)
// Mobile spends two of these rows per section (B63): the head row — label
// left, the category's own New board control right — above the cards, and the
// pager row below them. B68 takes the row down to HIT_FLOOR exactly — the
// 44px control IS the row — and the card down with it, because the fourth
// card issue #97 asks for is bought out of exactly this furniture. The
// constant covers the whole row, so catPageCap()'s budget stays exact.
const LIST_CAT_ROW = 44;             // .board-cat head/pager rows, mobile (issues #74, #88, #97)
const PANE_ROW_H = 44;               // .pane-card / .board-row min-height — §6's floor, not below it
// Two gaps, because they say two things (B68): card to card inside a section,
// and section to section. The first tightens to buy the fourth card; the
// second is what keeps three categories reading as three, and it holds at 8.
const PANE_ROW_GAP = 4;              // .cat-cards grid gap
// Cards to a row in the drilled list (B70 put two; B82 takes it to three,
// issue #125). The mobile drill is now a slide-up panel a third of the viewport
// tall (B82), so the horizontal axis buys back the density the shorter panel
// gives up. The rail stays at one — PANE_W is 300, two would be narrower than
// the titles they name.
const LIST_CARD_COLS = 3;            // = .cat-cards grid-template-columns (mobile; the rail is one)
// The mobile drilled-list card carries a two-line title and a "Last Updated"
// line (B82, issue #125), so it stands taller than the §6 touch floor the rail
// card holds to: catPageCap() budgets the drilled list against this, the rail
// against PANE_ROW_H.
const LIST_CARD_H = 76;              // = html:not(.desktop) .board-row height in styles.css
// The drilled list rises to a third of the viewport, the board still behind it
// (B82, UIUX §10). Measured from window.innerHeight in JS — the stable measure
// while the soft keyboard is up (B28) — so no `vh` enters the CSS (B32).
const LIST_PANEL_FRAC = 1 / 3;
const CAT_SEC_GAP = 8;               // #list-rows / #pane-cards flex gap
const DBLCLICK_MS = 350;             // second click on a selected item within this = edit
// Three durations paired to styles.css §8 values — they move together
// (PRD §9.5): the 200ms set and the 260ms board swap, on §8's one curve.
const SWAP_MS = 260;                 // board-swap crossfade; sequenced by timeout (§8-safe)
const SAVE_DEBOUNCE = 300;
const UNDO_MS = 5000;
const LEAVE_MS = 200;
const TOAST_HIDE_MS = 210;           // just past the toast's 200ms fade before hidden lands
const ACTION_DELAY = 400;            // re-fire drop-guard: a consequence commits now, a second tap inside is dropped (B81)

const COPY = {
  // "All boards" (issue #60): the menu item is a destination, and "Boards"
  // alone read as a category label. One key renames every menu site at once
  // — and it is now the only place the word is written: B43's exception for
  // the #list-title page heading is gone with the heading itself (B66).
  complete: 'Complete', restore: 'Restore', delete: 'Delete', boards: 'All boards',
  // The board-action toggle's other face (issue #126, B83): when the All-Boards
  // surface is showing, the same tab states the act that returns you — "This
  // board", the scope-antonym of "All boards". The label states the act it
  // performs, the Complete/Restore and Highlight grammar (B43/B71), so no
  // aria-pressed rides alongside it.
  thisBoard: 'This board',
  // Plural labels for a multi-selection (issue #55): the count is visible on
  // the board itself — every member wears a ring — so the label says "all",
  // not a number the user would have to reconcile.
  completeAll: 'Complete all', restoreAll: 'Restore all', deleteAll: 'Delete all',
  // Highlight (issue #105, B71): a toggle whose label states the act it will
  // perform — the Complete/Restore grammar (B43), not a fixed noun. Plural
  // forms mirror the "all" convention above for a multi-selection.
  highlight: 'Highlight', unhighlight: 'Remove highlight',
  highlightAll: 'Highlight all', unhighlightAll: 'Remove highlights',
  deleted: 'Deleted', undo: 'Undo',
  copy: 'Copy', copied: 'Copied', copyError: 'Couldn’t copy.',
  // Note linking (issue #142, B91): a relationship the user asserts between two
  // notes by connecting them — long-press/right-click a note → Link → the next
  // note tapped. The hint states the act while the mode is armed; linked/unlinked
  // caption the 5s undo toast (re-linking an already-linked pair removes it).
  link: 'Link',
  linkHintTap: 'Tap another note to link',
  linkHintClick: 'Click another note to link',
  linked: 'Linked', unlinked: 'Unlinked',
  // Export is a CHOICE since issue #140 / B92 — the tab opens PDF · JSON — so
  // the old "there is exactly one export" argument is retired with the anchor
  // menu that carried it. The leaves keep the menu's one-word grammar: PDF is
  // the sheet the board-card menu shares, JSON is the whole-library backup.
  export: 'Export',
  exportPdf: 'PDF',
  exportJson: 'JSON',
  exportError: 'Couldn’t export.',
  exportLossy: 'Some characters aren’t in the PDF font.',
  // Import (issue #140 / B92): the third board-level tab. The file dialog it
  // opens is the hidden input's mechanism; these words state the act.
  import: 'Import',
  importError: 'Couldn’t import that file.',
  imported: 'Boards imported',
  saveError: 'Couldn’t save — retrying.',
  untitled: 'What’s up?',
  // "Last Updated" on every board card (issue #125 / B82): read from the record's
  // own updatedAt — already stamped on every committing action (B69), so nothing
  // new persists. The date renders MM/DD/YY (formatMDY), stated in UIUX §10.
  lastUpdated: 'Last Updated: ',
  // The four categories (issue #58; #112 added Learning). "unsorted" is renamed
  // at the label only — its storage key stays 'unsorted' (B63). catNew is generic
  // on purpose: the enclosing group's aria-label disambiguates the four, the same
  // way it disambiguates the pager's twelve.
  // The names are the owner's own quoted words with no redundant "Boards" (issue
  // #112 / B78) — every entry in a list of board categories would end in it. One
  // source feeds all: makeCatSection's head/aria-label and the picker/grid tiles.
  catTodo: 'To Do', catIdea: 'Ideas', catUnsorted: 'Notes',
  catLearning: 'Learning',               // the fourth category (issue #112, B74)
  catNew: 'New board',
  pageFirst: 'First page', pagePrev: 'Previous page',
  pageNext: 'Next page', pageLast: 'Last page',
  // The calendar (issue #145). The re-grammared tab label (R7.2 — "All", the
  // short form, is what lets four tabs fit a phone: measured 346px of 390/360).
  // The tab's toggle face mirrors B83's grammar: on the board it offers the
  // calendar; while the calendar is showing, the day-stack's Back states the
  // return, and the tab is not visible there.
  calBoardTab: 'All', calendar: 'Calendar',
  calToday: 'Today', calBack: 'Back', calAllBoards: 'All Boards', calExport: 'Export',
  // A day card's header: "Today" then the long date; the future days read
  // weekday + MM/DD (the mockups' own voice).
  calTitle: 'Calendar Board',
};
/* The marks are drawn, not typed (UIUX §13.3, B50): inline SVG in
   currentColor, at the note's own stroke weight and corner radius, so the
   icon set is literally in the same hand as the board. A typed symbol falls
   back to whatever the platform supplies — Android, iOS and Windows drawing
   the app's marks in three different voices — which is the objection this
   file already raised against 🗑 alone, multiplied by six.

   Semantics carried forward unchanged: export is "out of the app, down to
   the device", not a borrowed browser-download arrow; copy is "this, again,
   elsewhere" — two frames, one content; guillemets read as "page", not
   "play". Drawn whole, guillemets included: one voice beats one saved path.
   Impermanent — a mark that proves unreadable at 16px is redrawn, not
   swapped back to a code point. */
const MARK = (w, d) =>
  `<svg width="${w}" height="${w}" viewBox="0 0 16 16" fill="none" stroke="currentColor" ` +
  `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const GLYPH = {
  complete: MARK(16, '<path d="M2.5 9l4 4L13.5 3.5"/>'),
  restore:  MARK(16, '<path d="M1.5 2.5v4h4"/><path d="M2.3 10a6 6 0 1 0 1.4-6.2L1.5 6.5"/>'),
  boards:   MARK(16, '<rect x="1.5" y="1.5" width="13" height="13" rx="2"/><path d="M8 1.5V14.5M1.5 8H14.5"/>'),
  export:   MARK(16, '<path d="M8 1.5V9M5 6.5L8 9.5 11 6.5"/><path d="M2 12.5h12"/>'),
  // Import (issue #140 / B92): the export mark read the other way — the arrow
  // comes DOWN INTO the tray. Same voice, same hand, so the pair reads as one
  // family pointing opposite directions, and the import tab is never mistaken
  // for a second export.
  import:   MARK(16, '<path d="M8 9.5V1.5M5 6.5L8 9.5 11 6.5"/><path d="M2 12.5h12"/>'),
  copy:     MARK(16, '<path d="M3 10.5V3.5a2 2 0 0 1 2-2h7"/><rect x="5.5" y="5.5" width="9" height="9" rx="2"/>'),
  // A marker pen laid over its stroke (issue #105): the broad nib at top-right,
  // the drawn line it leaves below — "colour is laid onto this", in the board's
  // own hand. Redrawn, not code-point-swapped, if it fails to read at 16px.
  highlight: MARK(16, '<path d="M9.5 2.5l4 4-6 6-4 1 1-4z"/><path d="M2 14.5h6"/>'),
  // Two nodes joined by a line (issue #142, B91): the mark IS the thing it makes —
  // a connection between two notes, no arrowhead, in the board's own hand.
  link:     MARK(16, '<circle cx="4" cy="12" r="1.6"/><circle cx="12" cy="4" r="1.6"/><path d="M5.3 10.7l5.4-5.4"/>'),
  delete:   MARK(16, '<path d="M2 4.5h12M5.5 4.5V3a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 10.5 3v1.5M3.8 4.5l.6 8.6a1.5 1.5 0 0 0 1.5 1.4h4.2a1.5 1.5 0 0 0 1.5-1.4l.6-8.6"/>'),
  pageFirst: MARK(14, '<path d="M12.5 2.5L7 8l5.5 5.5"/><path d="M8 2.5L2.5 8 8 13.5"/>'),
  pagePrev:  MARK(14, '<path d="M10 2.5L4.5 8 10 13.5"/>'),
  pageNext:  MARK(14, '<path d="M6 2.5L11.5 8 6 13.5"/>'),
  pageLast:  MARK(14, '<path d="M3.5 2.5L9 8l-5.5 5.5"/><path d="M8 2.5L13.5 8 8 13.5"/>'),
  // The calendar (issue #145): the mockup's own mark — a framed page with a
  // hanging rail — drawn in the app's hand. Back reads as the mirrored page
  // pair (a page turn back), the same "page" semantics as the pager's marks.
  calendar:  MARK(16, '<rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6.5h12M5.5 1.5V4M10.5 1.5V4"/>'),
  calBack:   MARK(16, '<path d="M9.5 3.5L5 8l4.5 4.5"/><path d="M5 8h6.5"/>'),
};

// contenteditable mode: prefer plaintext-only (Chromium/Samsung Internet — the
// Z Fold target); fall back to "true" where unsupported so text still captures.
const CE = (() => {
  const d = document.createElement('div');
  try { d.contentEditable = 'plaintext-only'; } catch (e) { /* older engines throw */ }
  return d.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true';
})();

/* --- 1.5 Desktop mode (B19) ----------------------------------------------
   A session is desktop iff the primary pointer is fine and can hover AND the
   window is wide enough for the rail. Capability — not width, not UA — is what
   excludes tablets: iPadOS reports coarse/none even with a trackpad. One flag +
   one class are the single source of truth; CSS gates on html.desktop only. */
/* Tablet (B96, issue #155; retuned by B101, re-retuned by B103, issue #164):
   ONE leg — `min-width: 744px` — orientation-blind. B96 gated tablet mode at
   984 and called it landscape-only; B101 added a foldable-shape leg (840 +
   aspect ≤ 23/20) after the unfolded Fold 7's real viewport (~904×846 at
   zoom −2) failed the 984 floor in landscape. The owner's final ruling
   (#164, 2026-09-09) removes orientation from the law entirely: "include
   unfolded foldables, iPads, and other tablets in tablet mode in PORTRAIT —
   no longer exclusive to landscape." The gate is therefore just a width
   floor at 744 CSS px — iPad mini portrait's width (744), so every iPad
   (768/810/820/834/1024) and every Android tablet (≥712, typically 800)
   qualifies in EITHER orientation, unfolded foldables qualify at every zoom
   (≈656–1092 wide; below 744 only at extreme zoom, where phone-scale
   everything is what the zoom asked for), and no phone or fold cover screen
   in portrait (366–480) can cross it. B96's cover-landscape-mobile ruling
   and B101's aspect leg are superseded: a 980×460 cover in landscape takes
   the tablet arrangement (300px rail + sheet) — it is a 980-wide surface,
   and the owner has ruled width, not orientation, the classifier. Desktop
   windows narrower than 744 stay mobile-arranged exactly as they do today
   below 984 (B20/B96 already put 984–1023 mouse windows in the tablet
   arrangement; this extends the same, working behavior). */
const TABLET_MQ = window.matchMedia('(min-width: 744px)');
viewState.isTablet = TABLET_MQ.matches;         // evaluated at load, like isDesktop below

const DESKTOP_MQ = window.matchMedia(
  '(min-width: 1024px) and (hover: hover) and (pointer: fine)');
viewState.isDesktop = DESKTOP_MQ.matches;
viewState.isWide = viewState.isDesktop || viewState.isTablet;   // desktop ∪ tablet — the arrangement tier
document.documentElement.classList.toggle('desktop', viewState.isDesktop);
document.documentElement.classList.toggle('tablet', viewState.isTablet);
document.documentElement.classList.toggle('wide', viewState.isWide);

function applyMode() {
  viewState.isDesktop = DESKTOP_MQ.matches;
  viewState.isTablet = !viewState.isDesktop && TABLET_MQ.matches;
  viewState.isWide = viewState.isDesktop || viewState.isTablet;
  document.documentElement.classList.toggle('desktop', viewState.isDesktop);
  // The wide class is the CSS arrangement gate — every `html.desktop` rule
  // that draws the rail or the picker overlay is a wide rule now (B96).
  document.documentElement.classList.toggle('tablet', viewState.isTablet);
  document.documentElement.classList.toggle('wide', viewState.isWide);
  // Teardown: nothing half-finished survives the flip.
  clearSelection();
  closeMenu();
  if (interactionState.g) { clearTimeout(interactionState.g.longPressTimer); interactionState.g = null; }
  pointers.clear();
  if (viewState.isWide && menuUiState.listOpen) returnToBoard();  // pop the whole list nav → board (B9 intact;
                                               // a drill is two levels deep, B74)
  // The calendar across the flip (issue #145): the panel arrangement belongs
  // to the wide grammar, so a flip while it is open closes it and pops its
  // history entry (nothing typed is lost — calendar lines live in linked
  // boards, not in the view). A flip TO a wide class re-enters via the tab.
  // B99 (issue #158): on wide the calendar is FURNITURE — the rail survives
  // every flip; only the mobile screen state and the wide EXPANDED panel
  // tear down (the expanded panel's squeeze must lift so the frame re-reads
  // the rail's 40px). Mobile, closed, hides the view outright as before.
  if (menuUiState.calOpen || menuUiState.calExpanded) {
    menuUiState.calOpen = false;
    menuUiState.calExpanded = false;
    el.calView.hidden = true;
    el.calView.classList.remove('rail-open', 'panel');
    el.calRail.hidden = true;
    setCalSqueeze(false);
    if (history.state && history.state.v === 'cal') history.back();
  }
  applyLayout();
  if (viewState.isWide) {
    renderPane();
    showCalRail();                   // the rail re-renders on every flip to wide (B99)
  } else {
    document.documentElement.classList.remove('has-cal-rail');
  }
}
DESKTOP_MQ.addEventListener('change', applyMode);
TABLET_MQ.addEventListener('change', applyMode);

const uuid = () =>
  (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      }));

/* --- 1.7 The rolling temporal calendar (RTCB, issue #145) -----------------

   The calendar is not a record of its own — it is a VIEW over the To-Do
   boards (R5). Each date that carries at least one event is linked to an
   ordinary To-Do board, created on the date's first event, titled
   "MM/DD To Do" (the MM/DD of the date it serves), and the mirror is
   bidirectional into that board's Requirements section: one line per event,
   reading exactly as written in the calendar. The link is recorded on the
   DATE, not on the board: `cal` (the date key) lives on the board record,
   added at the read site (B21's idiom — no DB version bump; PRD §4.1).

   Line identity (the ruling's mechanics): a Requirements line corresponds
   to an event iff it was written by the mirror. Identity is positional in
   the mirror's own order — the mirror knows the events for a date and
   rewrites its lines wholesale on any change, so a hand-typed line is any
   line outside the mirror's count. Hand lines are ordinary Requirements
   text: they render, save, and are invisible to the mirror. Reordering is
   presentation-only (the calendar reads events by identity, not position).
   Deleting the linked board unlinks its date — the events survive as
   calendar data (they live on the event records below) and the next event
   added to that date re-creates a board. No blocking, no orphan.

   The 7-day window is COMPUTED at render from today's date (R4): no stored
   rolling array, no midnight write, no skip-forward problem, no undo
   question — and the DB stays at version 1. An event is stored on its date
   record: { id, date: 'YYYY-MM-DD', text, state } — plain strings, the
   §4.1 shape. */

const CAL_TITLE_SUFFIX = ' To Do';
/* Date keys are local-time YYYY-MM-DD. formatMDY stays the card stamp's
   formatter (§10); these two are the calendar's own — key for storage and
   linking, long form for a day card's header. */
function calKey(d) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function calKeyOf(dateKey) { return dateKey; }   // identity — reads clear at call sites

/* The 7 rolling days: today + 6 future, today first (R7.4 — no past cards;
   mockup 6's "yesterday deepest" line is dead). Each entry is
   { key, date: Date, today: bool }. */
function calWindow() {
  const days = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    days.push({ key: calKey(d), date: d, today: i === 0 });
  }
  return days;
}

/* One event record. Plain strings + a state, the §4.1 shape; `date` is the
   calendar link (calKey form) and `createdAt` the mirror's order key — the
   positional identity the Requirements mirror rewrites around. */
function newCalEvent(dateKey, text) {
  return { id: uuid(), date: dateKey, text: text || '', state: 'active',
           createdAt: Date.now() };
}

/* The linked board for a date, if it exists. The link is the board's `cal`
   field (added at the read site — B21's idiom), so finding it is a scan of
   the snapshot the caller already holds. `current` is authoritative for
   itself (renderPane's stance). */
function calBoardOf(all, dateKey) {
  for (const b of all) {
    const rec = (current && b.id === current.id) ? current : b;
    if (rec.cal === dateKey) return rec;
  }
  return null;
}

/* The date's events, oldest first (creation order = the mirror's line order). */
function calEventsOf(events, dateKey) {
  return events.filter(e => e.date === dateKey)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || (a.id < b.id ? -1 : 1));
}

/* Ensure a date's linked To-Do board exists; create it on the date's first
   event (R5). Returns the board record (existing or new, already in `all`).
   The new board writes category + calStamp explicitly (B63/B69) and lands
   first in its section, like a drop. Creating a board is a consequence
   (records are written), so every caller wraps this in commitAction. */
function ensureLinkedBoard(all, dateKey) {
  let board = calBoardOf(all, dateKey);
  if (board) return { board, created: false };
  board = newBoardRecord();
  // "MM/DD To Do" (R5): MM and DD straight from the date key, 2-digit year's
  // last pair follows formatMDY's reading. Zero-padded like the card stamp.
  const p = dateKey.split('-');                       // [YYYY, MM, DD]
  board.title = p[1] + '/' + p[2] + '/' + dateKey.slice(2, 4) + CAL_TITLE_SUFFIX;
  board.cal = dateKey;
  all.push(board);
  return { board, created: true };
}

/* The Requirements mirror (R5): rewrite the linked board's Requirements so
   the mirror's lines read exactly as the calendar's events do, preserving
   every hand-typed line. The mirror's span is SELF-RECORDED: `calReq` on the
   board (read-site defaulted, B21's idiom) counts the lines the mirror last
   wrote, so a deletion shrinks the events but not the span — an old mirror
   line can never be demoted to a "hand" line by an event's removal. The
   span's lines are rewritten wholesale in event order; everything after
   them is the reader's own and is carried through untouched. Editing either
   side lands here — one writer, so the two surfaces can never disagree.

   Requirements is one plain string (PRD §4.1): lines are \n-separated. */
function syncMirror(board, events) {
  const lines = (board.requirements || '').length
    ? board.requirements.split('\n') : [];
  const span = typeof board.calReq === 'number'
    ? board.calReq
    : Math.min(lines.length, events.length);   // first sync on a legacy pair
  const hand = lines.slice(span);              // lines the reader wrote
  const mirrored = events.map(e => e.text);
  const next = mirrored.concat(hand).join('\n');
  board.calReq = mirrored.length;              // the span moves to the new write
  if (next !== (board.requirements || '')) {
    board.requirements = next;
    return true;
  }
  return false;
}

/* Read the mirror back: the events a board's Requirements implies, by
   position (the first lines are the mirror's). Used when the READER edits a
   line — the edit writes through to the event record it mirrors. */
function mirrorEventsOf(board, events) {
  const lines = (board.requirements || '').length
    ? board.requirements.split('\n') : [];
  if (!board.cal) return [];
  const mine = calEventsOf(events, board.cal);
  const span = typeof board.calReq === 'number'
    ? Math.min(board.calReq, lines.length) : mine.length;
  return lines.slice(0, span)
    .map((text, i) => ({ event: mine[i], text }))     // event may be undefined
    .filter(m => m.event);
}

/* --- 2. IndexedDB persistence -------------------------------------------- */
const DB_NAME = 'boards-db', STORE = 'boards';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const dbPromise = openDB();

async function idbGetAll() {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const rq = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}
async function idbPut(rec) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/* --- Legacy-frame adoption (B93, issue #141) ------------------------------
   The one-time migration that collapses B32's two-path rendering. Notes
   authored before B32 carry no `rh`; B32 mapped their `y` through LEGACY_H —
   the height the pre-B32 build would have produced on this device — and
   clamped into the page at render time only, while every note since runs
   B64's single min-k path. Two paths forever means every future rendering
   change pays for both, so at boot each legacy note is written onto the
   single path by adopting the frame it already renders in — the same
   rebaseNote performs at every grab.

   Render-silence — why P3 (positions are permanent, PRD §3) holds. What the
   note renders today is: x and size on the width ratio LOGICAL_W/(rw‖900),
   y through clamp(y·(LOGICAL_H/LEGACY_H), 0, LOGICAL_H − HIT_FLOOR). The
   migration writes exactly those values into storage and stamps
   rw = LOGICAL_W, rh = LEGACY_H's frame height (LOGICAL_H), after which
   noteK ≡ 1 and the single path renders the stored values verbatim. The
   ratios agree by construction: on mobile LEGACY_H = 900·vh/vw, so the
   legacy y-ratio LOGICAL_H/LEGACY_H = vw/900 — precisely the width ratio —
   and min(LOGICAL_W/rw, LOGICAL_H/LEGACY_H) picks that same value; on
   desktop LEGACY_H = LOGICAL_H, the ratio is 1, and B20's min-anchored
   renderScale keeps the note where it rendered. The scale fold mirrors
   rebaseNote: effScale before = (scale‖1)·widthRatio = scale after. The
   stored-y clause of B21/B32 ("never mutated") is waived for THIS write
   alone — it existed to stop incidental clamps from silently moving notes;
   this is a deliberate, user-visible-identical adoption requested by
   issue #141, recorded as B93. */
async function migrateLegacyBoards(all) {
  const adopt = (n) => {
    const wRatio = viewState.LOGICAL_W / (n.rw || 900);             // B32's legacy width ratio
    return {                                              // renderY's legacy branch,
      ...n,                                               // verbatim, incl. the clamp
      x: n.x * wRatio,                                    // that is what renders today
      y: clamp(n.y * (viewState.LOGICAL_H / viewState.LEGACY_H),
               0, Math.max(0, viewState.LOGICAL_H - HIT_FLOOR)),
      scale: (n.scale || 1) * wRatio,                     // rebaseNote's fold (B40/B64)
      rw: viewState.LOGICAL_W,
      rh: viewState.LOGICAL_H,                                      // noteK ≡ 1 for this note, forever
    };
  };
  let adopted = 0;
  for (const rec of all) {
    if (!Array.isArray(rec.notes)) continue;
    const legacy = rec.notes.filter((n) => n && !Number.isFinite(n.rh));
    if (!legacy.length) continue;
    rec.notes = rec.notes.map((n) => (n && !Number.isFinite(n.rh)) ? adopt(n) : n);
    await idbPut(rec);                    // direct, not scheduleSave: boot owns the
    adopted += legacy.length;             // store — nothing is open or debounced yet
  }
  return adopted;
}
async function idbDelete(id) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet(id) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const rq = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}

/* --- 3. State + save queue ----------------------------------------------- */
let current = null;                  // the open board record (in memory)

const noteEls = new Map();           // note.id -> element
const lotEls = new Map();            // lotItem.id -> element

const el = {
  board: document.getElementById('board'),
  boardView: document.getElementById('board-view'),
  lotItems: document.getElementById('lot-items'),
  lot: document.getElementById('lot'),
  lotMenu: document.getElementById('lot-menu'),       // mobile All-Boards grid (B74)
  listView: document.getElementById('list-view'),
  listRows: document.getElementById('list-rows'),
  menu: document.getElementById('menu'),
  toast: document.getElementById('toast'),
  pane: document.getElementById('pane'),
  paneCards: document.getElementById('pane-cards'),
  boardActions: document.getElementById('board-actions'),   // the board-action row (B83)
  actionBoards: document.getElementById('action-boards'),   // All Boards ⇄ This board toggle
  actionExport: document.getElementById('action-export'),   // Export this board (PDF · JSON, B92)
  actionImport: document.getElementById('action-import'),   // Import a JSON backup (issue #140, B92)
  importFile: document.getElementById('import-file'),       // the import tab's file dialog
  calView: document.getElementById('cal-view'),             // calendar screen (issue #145)
  calRail: document.getElementById('cal-rail'),             // the standing rail face (issue #158, B99)
  calStack: document.getElementById('cal-stack'),
  calTop: document.getElementById('cal-top'),
  calBack: document.getElementById('cal-back'),
  calBoards: document.getElementById('cal-boards'),
  calExport: document.getElementById('cal-export'),
  actionCalendar: document.getElementById('action-calendar'), // 4th board-action tab (R7.2)
};
const anchorEls = {
  title: document.getElementById('anchor-title'),
  components: document.getElementById('anchor-components'),
  requirements: document.getElementById('anchor-requirements'),
};

/* The category is written, not defaulted (B67, extending B63's rule to the one
   creation path that predates it): since the ladder rotates with the type, an
   unwritten category is no longer invisible — it renders. A fresh install's
   board would open violet on an app named for its To-Do boards. `newBoardIn`
   overwrites this with the section the board is made in; the two empty-database
   paths (`ensureCurrentValid`, `boot`) are the ones this is for. Legacy pre-#58
   records still carry no category and still read as Note Boards — that is B21's
   read-site idiom, and changing it would cost a migration and a version bump. */
function newBoardRecord() {
  const now = Date.now();
  return { id: uuid(), createdAt: now, updatedAt: now, category: 'todo',
           title: '', requirements: '', components: '', notes: [], parkingLot: [], links: [] };
}

// Single-flight persist with exponential backoff; capture is never blocked.
let saveTimer = null, persisting = false, dirtyAgain = false, retryDelay = 1000;
let dirty = false;                   // `current` holds an edit the debounce hasn't written
function scheduleSave() { dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, SAVE_DEBOUNCE); }
function saveNow() {
  clearTimeout(saveTimer);
  if (!current) return;
  stampUpdated();
  persist();
}
/* Flush on the way OUT of a board (swapBoard, openBoardById, newBoardIn): the
   pending edit is written, but `updatedAt` is stamped only if there was one. Leaving a board is
   not updating it — and since B69 orders every listing by that stamp, an
   unconditional stamp here would send the card you just LEFT to the top of its
   section on desktop, while mobile (which never flushes) left it where it was:
   one law, two skins, disagreeing. It would also outrank a board created in
   that same moment, undoing B63's "the new card lands first". */
function flushSave() {
  clearTimeout(saveTimer);
  if (!current) return;
  if (dirty) stampUpdated();
  persist();
}
/* The stamp is the whole of B69's order key. It deliberately does NOT turn the
   card's section back to page 1: a save renders nothing, and B42's page state
   exists so a re-render keeps the reader's place. An edit can therefore leave
   the open board's card on a page the reader is not looking at — as paging
   away already could — until they turn to page 1 and find it at the front. */
function stampUpdated() {
  current.updatedAt = Date.now();
  dirty = false;
}
function persist() {
  if (!current) return;
  if (persisting) { dirtyAgain = true; return; }
  persisting = true;
  const snapshot = current;
  idbPut(snapshot).then(() => {
    persisting = false; retryDelay = 1000; hideSaveError();
    if (dirtyAgain) { dirtyAgain = false; persist(); }
  }).catch(() => {
    persisting = false; showSaveError();
    setTimeout(persist, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 16000);
  });
}

/* --- 4. Layout / scale-to-fit -------------------------------------------- */
/* CAL_RAIL_W (issue #158, B99): the collapsed calendar rail's unscaled width,
   reserved from the frame on wide at ALL times — the rail is standing
   furniture (mockup 6), the room's third column, so its width is removed
   exactly as the left rail's is, before any squeeze math. While the panel is
   expanded (calSqueeze) CAL_PANEL_W takes the rail's place — the panel
   expands FROM the rail, it doesn't add to it. */
const CAL_RAIL_W = 40;               // the collapsed rail (mockup 6: 40px, right edge)
function applyWideLayout(vw, vh) {
  if (!viewState.isWide) return;
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
    const calW = viewState.calSqueeze ? CAL_PANEL_W : CAL_RAIL_W;
    viewState.renderScale = Math.min(vh / 1000, (vw - PANE_W - calW) / 900);
    viewState.LOGICAL_H = vh / viewState.renderScale;
    viewState.LOGICAL_W = (vw - PANE_W - calW) / viewState.renderScale;
    viewState.LOGICAL_W_TRUE = viewState.calSqueeze
      ? (vw - PANE_W - CAL_RAIL_W) / viewState.renderScale   // the frame the board returns to on collapse
      : null;
    viewState.offX = PANE_W;
    viewState.offY = 0;
    viewState.LEGACY_H = viewState.LOGICAL_H;            // desktop geometry is unchanged by B32
}

function applyMobileLayout(vw, vh) {
  if (viewState.isWide) return;
  {
    // Mobile (B32, overrides B17): the sheet IS the viewport. B17's fill still
    // holds — a scale of 1 is uniform by construction, so no letterbox and no
    // distortion — but every declared px is now a real px, which is the whole
    // point: at 900-and-scale the furniture rendered at ~45% and was unreadable.
    viewState.LOGICAL_W = vw;
    viewState.LOGICAL_H = vh;
    viewState.renderScale = 1;
    viewState.offX = 0;
    viewState.offY = 0;
    viewState.LEGACY_H = 900 * vh / vw;        // the height B17 would have produced here
  }
}

function checkListCapacity() {
  if (menuUiState.catCap && catPageCap(menuUiState.catFilled, menuUiState.catView ? 1 : undefined) !== menuUiState.catCap) {
    // Re-paginate the surface that is showing: the open list overlay (drill or
    // desktop picker) first, else the desktop rail behind it (issue #112 review).
    if (menuUiState.listOpen) renderListSurface();
    else if (viewState.isWide && el.paneCards) renderPane();
  }
}

function repositionNotes() {
  noteEls.forEach((node, id) => {
    const note = current && current.notes.find(n => n.id === id);
    if (note) {
      node.style.left = renderX(note) + 'px';
      node.style.top = renderY(note) + 'px';
      node.style.transform = 'scale(' + effScale(note) + ')';
      setHitInset(node, note);
    }
  });
  if (interactionState.selected) updateSelectionUI();
  updateLinks();                     // links ride the notes' new geometry (B91)
}

function applyFrameCss() {
  el.board.style.setProperty('--logical-w', viewState.LOGICAL_W + 'px');
  el.board.style.setProperty('--logical-h', viewState.LOGICAL_H + 'px');
  el.board.style.setProperty('--rs', viewState.renderScale);
  el.board.style.setProperty('--offx', viewState.offX + 'px');
  el.board.style.setProperty('--offy', viewState.offY + 'px');
}

function applyLayout() {
  const vw = window.innerWidth, vh = window.innerHeight;
  if (viewState.isWide) applyWideLayout(vw, vh);
  else applyMobileLayout(vw, vh);
  applyFrameCss();
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
  repositionNotes();
  // Capacity check (issue #58, replacing the #pane-more overflow check B42
  // supersedes): the per-page card budget is measured from the surface's
  // height, so a resize that changes it must re-render — and re-paginate.
  // catCap is 0 until the first render, so boot's renderBoard → applyLayout
  // chain doesn't draw the rail twice back to back. Off-desktop the same
  // check covers a rotation while the list is open (issue #74).
  checkListCapacity();
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
function onViewportResize() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  if (!viewState.isDesktop && editingInBoard()) {
    if (h <= viewState.editVVFloor) { viewState.editVVFloor = h; viewState.layoutDeferred = true; return; }
    if (h > viewState.editVVFloor + KB_HIDE_SLOP) { document.activeElement.blur(); return; }
    viewState.layoutDeferred = true; return;   // sub-threshold jitter: keep holding
  }
  applyLayout();
}

/* --- 5. Coordinate + caret helpers --------------------------------------- */
const toLogical = (clientX, clientY) => {
  const x = (clientX - viewState.offX) / viewState.renderScale;
  const y = (clientY - viewState.offY) / viewState.renderScale;
  // The calendar squeeze (R6 clause 1): while the panel is open the frame is
  // narrowed, so a raw read would write squeezed-frame coordinates that shift
  // when the squeeze lifts. Un-map proportionally into the TRUE frame —
  // the frame the board returns to on close — so a grab's rebaseNote (the one
  // licensed write, B21) stamps where the user sees the note land in the room
  // it returns to. y is untouched (the squeeze is horizontal).
  return { x: viewState.LOGICAL_W_TRUE ? x * (viewState.LOGICAL_W_TRUE / viewState.LOGICAL_W) : x, y };
};

/* The calendar squeeze (R6): when the calendar panel is open on desktop or
   tablet, the sheet is laid out with the panel's width removed from the
   viewport — the SAME mechanism B20 already uses for the left rail, on the
   right edge now. Every note's k changes with the frame, so the whole
   arrangement renders smaller and further left, exactly as B64's similarity
   law maps a frame change; nothing is written (P3 — the squeeze is a frame,
   not an edit). The TRUE frame is kept in LOGICAL_W_TRUE while squeezed, and
   toLogical un-maps a drag's client point into it proportionally, so a
   grabbed note's rebaseNote writes TRUE-frame coordinates stamped rw/rh =
   the true frame (the inverse-transform write, R6's first clause) — the note
   lands permanently where the user sees it land, in the room the board
   returns to when the panel closes. On close the squeeze lifts and the
   board renders exactly where it was. Export ignores the squeeze entirely
   (exportX/exportY read storage; R6's second clause). Overlap during the
   squeeze is accepted (R6, the owner's word) — no auto-untangling. */
const CAL_PANEL_W = 320;             // unscaled CSS px the panel takes (mockup 6's ~⅓)

function setCalSqueeze(on) {
  if (viewState.calSqueeze === on) return;
  viewState.calSqueeze = on;
  if (current) applyLayout();
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
const noteKFor = (n, frameW, frameH) =>
  Math.min(frameW / (n.rw || 900), frameH / n.rh);

const noteK = (note) => noteKFor(note, viewState.LOGICAL_W, viewState.LOGICAL_H);
const renderX  = (note) => note.x * noteK(note);
const effScale = (note) => (note.scale || 1) * noteK(note);
const renderY  = (note) => note.y * noteK(note);

function rebaseNote(note) {
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
  note.rw = viewState.LOGICAL_W_TRUE || viewState.LOGICAL_W;
  note.rh = viewState.LOGICAL_H;
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
const noteMaxW = (note) =>
  Math.max(NOTE_MIN_W, ((note.rw || 900) - note.x) / (note.scale || 1));

/* The cap lives on the NOTE element (custom properties inherit, so .note-text
   keeps reading the var). Set it BEFORE anything measures offsetWidth — the
   cap changes what offsetWidth reports (setHitInset's constraint, B7). */
function applyNoteWidth(node, note) {
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
const BAND_TOP = 14, BAND_LINE = 19.5, BAND_GAP = 8;
/* The band's law as one pure function of its line count (B47): both the
   render path (bandRuleY) and the export path (exportRuleY) close at
   band-top + lines × line-height + gap. The line count itself is each
   frame's own measure — the screen reads the DOM, the export wraps text on
   its own sheet (B34) — so only this formula is shared. */
const bandRuleYFor = (lines) => Math.round(BAND_TOP + lines * BAND_LINE + BAND_GAP);
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
const LOT_HEAD = 34, LOT_ROW = 44, LOT_FLOOR = 2 * LOT_ROW, LOT_MAX_FRAC = 0.5;
const lotH = () => {
  let sum = 0;
  for (const node of lotEls.values()) sum += node.offsetHeight;
  return Math.min(
    LOT_HEAD + Math.max(LOT_FLOOR, Math.round(sum)),
    Math.round(viewState.LOGICAL_H * LOT_MAX_FRAC)
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
function updateBoardGeometry() {
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
  el.boardActions.style.setProperty('--hit', (hitInset(el.boardActions, viewState.renderScale) + 0.5) + 'px');
}

/* §6/B7's law is not the note's alone: any board-space target expands its hit
   area to the floor without growing its visual frame. `k` is what the element
   draws at — one arithmetic, both callers. */
function hitInset(node, k) {
  const physW = node.offsetWidth * k, physH = node.offsetHeight * k;   // logical x draw scale
  const floor = viewState.isDesktop ? HIT_FLOOR_DESKTOP : HIT_FLOOR;
  return Math.max(0, (floor - physW) / 2, (floor - physH) / 2) / (k || 1);
}

function setHitInset(node, note) {
  // effScale x renderScale is what the note draws at (issue #57).
  node.style.setProperty('--hit', hitInset(node, effScale(note) * viewState.renderScale) + 'px');
}

function placeCaretAtPoint(node, clientX, clientY) {
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
function caretToEnd(node) {
  const sel = window.getSelection(), r = document.createRange();
  r.selectNodeContents(node); r.collapse(false);
  sel.removeAllRanges(); sel.addRange(r);
}

/* --- 6. Rendering -------------------------------------------------------- */

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
function applyBoardCat() {
  el.board.dataset.cat = catOf(current);
}

/* The tab/OS-window title follows the view (issue #148 item 2). Chrome only —
   nothing on the canvas reads or renders it; the views themselves stay exactly
   as UIUX §10/§6 draw them. Board view shows the board's own title text (the
   anchor's copy, 'What's up?' when untitled — the same rule renderBoard
   applies to the anchor); the picker and a drilled category name themselves. */
function syncViewTitle() {
  const s = history.state;
  if (s && s.v === 'cat') document.title = `${COPY['cat' + s.cat[0].toUpperCase() + s.cat.slice(1)] || s.cat} · To-Do Boards`;
  else if (s && s.v === 'list') document.title = `All boards · To-Do Boards`;
  else {
    const titled = current && !!(current.title && current.title.trim().length);
    document.title = titled ? `${current.title} · To-Do Boards` : 'To-Do Boards';
  }
}

function renderBoard() {
  clearSelection();                  // note DOM is about to be rebuilt
  applyBoardCat();
  if (sanitizeBoard(current)) scheduleSave();
  syncViewTitle();
  // Anchors.
  for (const key of ['title', 'components', 'requirements']) {
    const node = anchorEls[key];
    node.textContent = current[key] || '';
    node.classList.toggle('filled', !!(current[key] && current[key].length));
  }
  // Notes (array order = z-order; DOM order mirrors it).
  noteEls.forEach(n => n.remove()); noteEls.clear();
  for (const note of current.notes) el.board.appendChild(makeNoteEl(note));
  // Parking Lot.
  el.lotItems.textContent = ''; lotEls.clear();
  for (const item of current.parkingLot) el.lotItems.appendChild(makeLotEl(item));
  syncBoardActions();                // the toggle reads All boards on a drawn board (B83)
  applyLayout();
}

function makeNoteEl(note) {
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
  node.appendChild(makeNoteToolbar(note));                   // the on-select action row (B84)
  applyCompleteA11y(node, note.state === 'complete');
  reflectToolbarFlip(node, note);                            // above the note, or below near the sheet top
  noteEls.set(note.id, node);
  requestAnimationFrame(() => setHitInset(node, note));
  return node;
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
function updateNoteToolbar(node, note) {
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
function reflectToolbarFlip(node, note) {
  node.classList.toggle('tb-flip', renderY(note) < TB_ROW_H * effScale(note));
}

/* One toolbar action, from a pointer tap (handleTap) or the keyboard (below).
   Commits on release through the B81 drop-guard. Acts on the whole multi-
   selection when this note is the desktop primary of one, else on this note
   alone — mobile has no selection, so it is always the single note. */
function runNoteToolbarAction(btn) {
  const noteNode = btn.closest('.note');
  if (!noteNode) return;
  const note = current.notes.find(n => n.id === noteNode.dataset.id);
  if (!note) return;
  const editingHere = () =>
    isEditing(document.activeElement) && noteNode.contains(document.activeElement);
  commitAction(() => {
    const inMulti = interactionState.selected && interactionState.selected.kind === 'note' &&
                    multiSel.size > 1 && multiSel.has(note.id);
    const ids = inMulti ? selectedNoteIds() : [note.id];
    if (btn.classList.contains('note-tb-copy')) {
      // note.text is live off every keystroke (the input handler), so Copy needs
      // no blur — it copies the current text and leaves the note engaged.
      copyText(ids.map(id => {
        const n = current.notes.find(m => m.id === id);
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
el.board.addEventListener('keydown', (e) => {
  const btn = e.target.closest && e.target.closest('.note-tb-btn');
  if (!btn) return;
  if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
  e.preventDefault();
  e.stopPropagation();
  runNoteToolbarAction(btn);
});

function makeLotEl(item) {
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

function applyCompleteA11y(node, complete) {
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
/* The live interaction plane — gesture context, selection, link arming, and
   the async re-entrancy guards — grouped as one state object (issue #176). */
const interactionState = {
  linkSource: null,
  linkLayer: null,
  g: null,                           // active gesture context
  swallowTap: false,                 // the pointerdown that dismissed a menu is inert (B30)
  pendingAction: null,
  selected: null,                    // { kind: 'note'|'lot', id }
  lastTap: { key: null, t: 0 },      // double-click pairing across taps
  selEl: null,                       // the resize-frame overlay (ring + edges + handles); actions live on the note's toolbar (B84)
  engaged: null,                     // id of the mobile-engaged note, or null
  dragCancel: null,                  // the live card-drag's teardown, if one is mid-flight
  popping: false,
  swapping: false,                   // async re-entrancy guard beyond the commit drop-guard
};

const boardLinks = () => (current && current.links) || [];   // B21 read-default for legacy boards
const findLink = (a, b) =>
  boardLinks().find(l => (l.a === a && l.b === b) || (l.a === b && l.b === a));

/* Create the link, or remove it if the pair is already linked (B91 toggle-to-
   unlink). A committing consequence — the caller wraps it in commitAction so a
   double-tap can't double-fire — and either direction offers a 5s Undo, the
   app's one reversal idiom (UIUX §9). The Undo closures read current.links
   directly, exactly as deleteNotes reads current.notes (same board-binding). */
function toggleLink(a, b) {
  if (!current || a === b) return;
  if (!current.links) current.links = [];
  const existing = findLink(a, b);
  if (existing) {
    current.links = current.links.filter(l => l !== existing);
    saveNow(); updateLinks();
    showUndo(() => { current.links.push(existing); saveNow(); updateLinks(); }, 'item', COPY.unlinked);
  } else {
    const link = { id: uuid(), a, b };
    current.links.push(link);
    saveNow(); updateLinks();
    showUndo(() => { current.links = boardLinks().filter(l => l.id !== link.id); saveNow(); updateLinks(); }, 'item', COPY.linked);
  }
}

// Drop links referencing an id (a deleted note); returns the removed links so a
// caller's Undo can restore them (exact prior state, UIUX §9).
function removeLinksForNote(id) {
  if (!current || !current.links || !current.links.length) return [];
  const removed = current.links.filter(l => l.a === id || l.b === id);
  if (removed.length) current.links = current.links.filter(l => l.a !== id && l.b !== id);
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
function beginLink(id) {
  interactionState.linkSource = id;
  showNotice(viewState.isDesktop ? COPY.linkHintClick : COPY.linkHintTap, 'link');
}
function clearLink() {
  if (interactionState.linkSource === null) return;
  interactionState.linkSource = null;
  if (el.toast.dataset.mode === 'link') hideToast();
}

/* The link layer: one <svg> in board space, a sibling of the notes like
   #selection, so it rides #board's translate+scale and needs no screen-space
   math. pointer-events:none (CSS) — hit-testing is target.closest()-based, so a
   hittable line would steal note taps. z-index:1 (CSS): below the z:2 notes, and
   — appended after the static furniture — above the z:1 furniture, the valid-
   integer realization of the issue's "z-index: 1.5" (B91). */
const SVGNS = 'http://www.w3.org/2000/svg';
const linkLineEls = new Map();       // link.id -> <line>
function ensureLinkLayer() {
  if (interactionState.linkLayer) return;
  interactionState.linkLayer = document.createElementNS(SVGNS, 'svg');
  interactionState.linkLayer.id = 'link-layer';
  interactionState.linkLayer.setAttribute('aria-hidden', 'true');
  el.board.appendChild(interactionState.linkLayer);
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
function updateLinks() {
  const links = boardLinks();
  if (!links.length && !interactionState.linkLayer) return;
  ensureLinkLayer();
  const live = new Set();
  for (const link of links) {
    const na = current.notes.find(n => n.id === link.a);
    const nb = current.notes.find(n => n.id === link.b);
    const ea = noteEls.get(link.a), eb = noteEls.get(link.b);
    if (!na || !nb || !ea || !eb) continue;
    const ca = noteCenter(na, ea), cb = noteCenter(nb, eb);
    let line = linkLineEls.get(link.id);
    if (!line) {
      line = document.createElementNS(SVGNS, 'line');
      linkLineEls.set(link.id, line);
      interactionState.linkLayer.appendChild(line);
    }
    line.setAttribute('x1', ca.x); line.setAttribute('y1', ca.y);
    line.setAttribute('x2', cb.x); line.setAttribute('y2', cb.y);
    live.add(link.id);
  }
  for (const [id, line] of linkLineEls) {
    if (!live.has(id)) { line.remove(); linkLineEls.delete(id); }
  }
}

/* --- 7. Gesture recognizer ----------------------------------------------- */
// One recognizer over the board. Targets: note | anchor | lot-item | lot | canvas.
const pointers = new Map();          // pointerId -> {x,y,startX,startY}

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
  if (target.closest('#selection')) return { type: 'sel-frame', node: interactionState.selEl };
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

el.board.addEventListener('pointerdown', onPointerDown);

function onPointerDown(e) {
  if (interactionState.swallowTap) { interactionState.swallowTap = false; return; }  // this press only dismissed a menu (B30)
  // The All-Boards grid (issue #112 / B74) is drawn inside #lot, so its presses
  // bubble here — but it is a menu, not the board: let its buttons receive their
  // own native clicks rather than the recognizer swallowing them as lot capture.
  if (e.target.closest('#lot-menu')) return;
  // The board-action tabs (issue #126, B83) are native buttons too: the same
  // passthrough lets their clicks fire (All Boards / Export) with no gesture
  // armed and no preventDefault, so no note is captured under them. Presses on
  // the row's pointer-events:none frame never reach here (they hit the canvas
  // behind it), so only a real tab press returns — bare canvas still captures.
  if (e.target.closest('#board-actions')) return;
  // Secondary/middle presses are inert to the recognizer (issue #55): a
  // right-click must reach the contextmenu listener with no gesture context
  // armed, or the press underneath the menu would drag/select/create. The
  // preventDefault stops the press from natively focusing a tabindexed note —
  // focusin's Tab-selects rule would collapse a multi-selection before the
  // contextmenu listener could act on it. contextmenu still fires: it is not
  // a compatibility mouse event, so canceling pointerdown leaves it alone.
  if (e.button !== 0) { e.preventDefault(); return; }
  if (isEditing(e.target)) return;                 // let text editing receive taps/caret
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
  if (pointers.size === 2 && interactionState.g && interactionState.g.target.type === 'note' && !interactionState.g.group) {
    startPinch();
    return;
  }
  if (pointers.size > 1) return;                   // ignore extra pointers otherwise

  const target = classifyTarget(e.target);
  interactionState.g = {
    target, pointerId: e.pointerId,
    startX: e.clientX, startY: e.clientY,
    shift: e.shiftKey,                             // multi-select modifier (issue #55)
    mode: 'pending', longPressed: false, moved: false,
    note: target.type === 'note' ? current.notes.find(n => n.id === target.node.dataset.id) : null,
  };
  // Resize is single-selection only, by design (issue #55): with two or more
  // selected the CSS hides the grip, and this guard keeps the gesture honest
  // even if a stray hit reaches the frame.
  if (viewState.isDesktop && target.type === 'sel-frame' && interactionState.selected && interactionState.selected.kind === 'note' &&
      multiSel.size <= 1) {
    startResize(e);
  }
  try { el.board.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }

  if (!viewState.isDesktop && HAS_MENU.has(target.type)) {   // desktop removes click-and-hold entirely (issue #4)
    interactionState.g.longPressTimer = setTimeout(() => {
      if (!interactionState.g || interactionState.g.mode !== 'pending' || interactionState.g.moved) return;
      interactionState.g.longPressed = true;
      if (navigator.vibrate) navigator.vibrate(10);
      openMenuFor(target, interactionState.g.startX, interactionState.g.startY);
    }, LONGPRESS_MS);
  }
}

el.board.addEventListener('pointermove', onPointerMove);
function onPointerMove(e) {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX; p.y = e.clientY;

  if (interactionState.g && interactionState.g.mode === 'pinch') { updatePinch(); return; }
  if (interactionState.g && interactionState.g.mode === 'resize') { if (interactionState.g.pointerId === e.pointerId) updateResize(e); return; }
  if (!interactionState.g || interactionState.g.pointerId !== e.pointerId) return;

  const dx = e.clientX - interactionState.g.startX, dy = e.clientY - interactionState.g.startY;
  if (!interactionState.g.moved && Math.hypot(dx, dy) >= MOVE_THRESHOLD) {
    interactionState.g.moved = true;
    clearTimeout(interactionState.g.longPressTimer);
    if (interactionState.g.target.type === 'note' && !interactionState.g.longPressed) startDrag();
    else interactionState.g.mode = 'cancelled';                      // canvas/anchor/lot don't drag; board never pans
  }
  if (interactionState.g.mode === 'drag') updateDrag(e);
}

el.board.addEventListener('pointerup', onPointerUp);
el.board.addEventListener('pointercancel', onPointerUp);
function onPointerUp(e) {
  pointers.delete(e.pointerId);
  if (!interactionState.g) return;

  if (interactionState.g.mode === 'pinch') {
    if (pointers.size < 2) endPinch();
    return;
  }
  if (interactionState.g.pointerId !== e.pointerId) return;
  clearTimeout(interactionState.g.longPressTimer);

  if (interactionState.g.mode === 'drag') { endDrag(); }
  else if (interactionState.g.mode === 'resize') { endResize(); }
  else if (interactionState.g.mode === 'pending' && !interactionState.g.longPressed && !interactionState.g.moved) { handleTap(interactionState.g.target, e.clientX, e.clientY, interactionState.g.shift); }
  interactionState.g = null;
}

/* --- 8. Editing, drag, pinch, z-order ------------------------------------ */
/* Editing means an editor that actually holds focus, not merely one wearing the
   attribute. The attribute alone can outlive its edit — a focus() the browser
   refused never fires focusout, so nothing strips it — and an unfocused husk
   answering yes here would swallow every pointerdown over it at source: an
   invisible dead patch of paper. Requiring focus makes such a node an ordinary
   note again, which the next tap focuses and the following blur discards. */
function isEditing(node) {
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

function commitAction(fn) {
  if (interactionState.pendingAction) return;
  fn();
  interactionState.pendingAction = setTimeout(() => { interactionState.pendingAction = null; }, ACTION_DELAY);
}

/* No blanket pendingAction guard here (issue #13): commitAction carries its own
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
  if (interactionState.linkSource === null) return false;
  const src = interactionState.linkSource;
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
    const item = current.parkingLot.find(i => i.id === lotRow.dataset.id);
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
  if (viewState.isDesktop && interactionState.selected) { clearSelection(); return; }
  if (!viewState.isDesktop && interactionState.engaged) { clearEngaged(); return; }   // mobile: tap-away deselects; a further tap creates (issue #136, B90)
  createNote(x, y);                // capture is instant on both (B27, B81)
}

/* Creation surface, same #54 law as tapCanvas (see above). */
function tapLot(x, y) {
  if (isEditing(document.activeElement)) { document.activeElement.blur(); return; }
  if (viewState.isDesktop && interactionState.selected) { clearSelection(); return; }   // creation surface too
  if (!viewState.isDesktop && interactionState.engaged) { clearEngaged(); return; }   // mobile: tap-away deselects (issue #136, B90)
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
  const note = current.notes.find(n => n.id === node.dataset.id);
  if (!note) return;
  if (viewState.isDesktop) {
    // An open editor commits before the click acts (issue #54); on the
    // edited note's own collar the click only dismisses.
    if (commitOpenEditor(node)) return;
    // Shift-click toggles multi-selection membership (issue #55) and
    // never pairs into the double-click window.
    if (shift) {
      toggleInSelection(note.id);
      interactionState.lastTap = { key: null, t: 0 };
      return;
    }
    // Click selects (instant, inert); a second click within the pairing
    // window edits with the caret at the end (issue #4). Completed notes
    // never edit — same guard as the mobile tap path.
    const key = 'note:' + note.id, now = Date.now();
    if (interactionState.selected && interactionState.selected.kind === 'note' && interactionState.selected.id === note.id &&
        interactionState.lastTap.key === key && now - interactionState.lastTap.t < DBLCLICK_MS) {
      interactionState.lastTap = { key: null, t: 0 };
      if (note.state === 'active') {
        clearSelection();
        surfaceNote(node);
        editText(node.querySelector('.note-text'));   // no coords → caret at end
      }
    } else {
      selectNote(note.id);
      interactionState.lastTap = { key, t: now };
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
  if (note.state === 'active' && interactionState.engaged === note.id) {
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
  const item = current.parkingLot.find(i => i.id === node.dataset.id);
  if (!item) return;
  if (viewState.isDesktop) {
    if (commitOpenEditor(node)) return;
    const key = 'lot:' + item.id, now = Date.now();
    if (interactionState.selected && interactionState.selected.kind === 'lot' && interactionState.selected.id === item.id &&
        interactionState.lastTap.key === key && now - interactionState.lastTap.t < DBLCLICK_MS) {
      interactionState.lastTap = { key: null, t: 0 };
      if (item.state === 'active') {
        clearSelection();
        editText(node.querySelector('.lot-text'));    // no coords → caret at end
      }
    } else {
      selectLot(item.id);
      interactionState.lastTap = { key, t: now };
    }
    return;
  }
  if (item.state === 'active') editText(node.querySelector('.lot-text'), x, y);  // B27
}

function tapAnchor(target, x, y) {
  editText(target.node, x, y);      // edit-entry is instant on both (B27, B81)
}

/* Enter inline edit on any editable text node. */
function enableEditing(textNode) {
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
  const note = { id: uuid(), text: '', x: clamp(pt.x, 0, Math.max(0, viewState.LOGICAL_W - NOTE_MIN_W)),
                 y: clamp(pt.y, 0, viewState.LOGICAL_H - 4), rw: viewState.LOGICAL_W, rh: viewState.LOGICAL_H,
                 scale: 1.0, state: 'active' };
  current.notes.push(note);                          // top of z-order
  const node = makeNoteEl(note);
  el.board.appendChild(node);
  const text = node.querySelector('.note-text');
  enableEditing(text); text.focus(); caretToEnd(text);
  if (document.activeElement !== text) removeNoteSilently(note, node);
}

function createLotItem() {
  const item = { id: uuid(), text: '', state: 'active' };
  current.parkingLot.push(item);
  const node = makeLotEl(item);
  el.lotItems.appendChild(node);
  updateBoardGeometry();               // the shelf follows its rows (UIUX §3.2)
  const text = node.querySelector('.lot-text');
  enableEditing(text); text.focus(); caretToEnd(text);
  if (document.activeElement !== text) removeLotSilently(item, node);
}

/* Commit-on-blur for every editable region; empty new notes/items are discarded. */
function onEditFocusOut(e) {
  const t = e.target;
  if (!t.hasAttribute || !t.hasAttribute('contenteditable')) return;
  disableEditing(t);
  if (t.classList.contains('note-text')) commitNote(t.closest('.note'));
  else if (t.classList.contains('lot-text')) commitLot(t.closest('.lot-item'));
  else if (t.classList.contains('anchor')) commitAnchor(t);
  viewState.editVVFloor = Infinity;   // next edit measures its own keyboard-up floor (B80)
  // A viewport change held back during the edit lands now that nothing is at
  // stake — the keyboard's own retraction resize would repeat it, but a
  // rotation or fold has no such second chance.
  if (viewState.layoutDeferred) { viewState.layoutDeferred = false; requestAnimationFrame(applyLayout); }
}
document.addEventListener('focusout', onEditFocusOut);

/* Keyboard/AT users focus a region → enter edit. The pointer path owns taps, so
   auto-edit only when no pointer gesture is in control (otherwise a tabindexed
   note would open the keyboard on pointerdown before drag/long-press resolve). */
function onEditFocusIn(e) {
  if (pointers.size) return;
  const t = e.target;
  if (!t.classList) return;
  if (t.classList.contains('anchor') && !t.hasAttribute('contenteditable')) {
    enableEditing(t);
  } else if (t.classList.contains('note')) {
    const note = current && current.notes.find(n => n.id === t.dataset.id);
    if (!note) return;
    if (viewState.isDesktop) {
      // Tab selects; Enter edits (issue #13) — EXCEPT the menu's own focus
      // return (issue #55): closeMenu hands focus back to the right-clicked
      // member, and that hand-back must not collapse the multi-selection the
      // menu just acted on. A real Tab onto a member still selects it, so
      // keyboard focus and selection never diverge outside that one call.
      if (!(menuUiState.menuReturnFocus && multiSel.size > 1 && multiSel.has(note.id))) selectNote(note.id);
      return;
    }
    if (note.state === 'active') editText(t.querySelector('.note-text'));
  } else if (t.classList.contains('lot-item')) {
    const item = current && current.parkingLot.find(i => i.id === t.dataset.id);
    if (!item) return;
    if (viewState.isDesktop) { selectLot(item.id); return; }
    if (item.state === 'active') editText(t.querySelector('.lot-text'));
  }
}
document.addEventListener('focusin', onEditFocusIn);

/* Desktop keyboard (additive, issue #4 "mnk"): inert while the menu is open —
   menuKeyHandler owns Escape/Tab/arrows there, and Delete must not destroy the
   selection underneath an open menu (issue #10). */
function onDesktopKeydown(e) {
  if (!viewState.isDesktop || menuUiState.menuOpen) return;
  // While a link is armed, Escape cancels it and every other key is inert (B91) —
  // no selection exists to Delete/Enter into, and this must win over the grammar.
  if (interactionState.linkSource !== null) { if (e.key === 'Escape') clearLink(); return; }
  const editing = isEditing(document.activeElement);
  if (e.key === 'Escape') {
    if (editing) { document.activeElement.blur(); }    // commit-on-blur path runs
    else if (interactionState.selected) clearSelection();
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && interactionState.selected && !editing) {
    e.preventDefault();
    // A multi-selection deletes as one batch with one Undo (issue #55).
    if (interactionState.selected.kind === 'note' && multiSel.size > 1) { deleteNotes(selectedNoteIds()); return; }
    const s = interactionState.selected;
    clearSelection();
    if (s.kind === 'note') { const n = noteEls.get(s.id); if (n) deleteNote(n); }
    else { const n = lotEls.get(s.id); if (n) deleteLot(n); }
  } else if (e.key === 'Enter' && interactionState.selected && !editing) {
    e.preventDefault();
    const s = interactionState.selected;
    if (s.kind === 'note') {
      const rec = current.notes.find(n => n.id === s.id);
      const n = noteEls.get(s.id);
      if (rec && n && rec.state === 'active') {
        clearSelection(); surfaceNote(n); editText(n.querySelector('.note-text'));
      }
    } else {
      const rec = current.parkingLot.find(i => i.id === s.id);
      const n = lotEls.get(s.id);
      if (rec && n && rec.state === 'active') {
        clearSelection(); editText(n.querySelector('.lot-text'));
      }
    }
  }
}
document.addEventListener('keydown', onDesktopKeydown);

/* Live growth = capture feedback; debounced persistence (PRD §4 writes). */
function onLiveEditInput(e) {
  const t = e.target;
  if (t.classList.contains('note-text')) {
    const note = current.notes.find(n => n.id === t.closest('.note').dataset.id);
    if (note) { note.text = t.textContent; setHitInset(t.closest('.note'), note); scheduleSave(); }
  } else if (t.classList.contains('lot-text')) {
    const item = current.parkingLot.find(i => i.id === t.closest('.lot-item').dataset.id);
    // The lot sizes to its rendered rows, live (issue #106, B73) — the same
    // capture feedback the band's anchor branch below already gives.
    if (item) { item.text = t.textContent; updateBoardGeometry(); scheduleSave(); }
  } else if (t.classList.contains('anchor')) {
    current[t.dataset.anchor] = t.textContent;
    t.classList.toggle('filled', !!t.textContent.length);
    if (t.dataset.anchor === 'title' && viewState.isDesktop) updateActiveCardTitle();
    if (t.dataset.anchor === 'title') syncViewTitle();   // the tab carries the board's name, live (issue #148 item 2)
    // The band sizes to its tallest zone, live (B47) — and the title now has a
    // geometry consequence of its own: the compartment's handle rides its
    // bottom edge, so a title that grows past the floor moves it (B65). One
    // call covers both; it is a no-op for whichever of the two did not change.
    updateBoardGeometry();
    scheduleSave();
  }
}
el.board.addEventListener('input', onLiveEditInput);

function commitNote(node) {
  const note = current.notes.find(n => n.id === node.dataset.id);
  if (!note) return;
  note.text = node.querySelector('.note-text').textContent;
  if (note.text.trim().length === 0) { removeNoteSilently(note, node); return; }  // no empty frames ever
  saveNow();
}
function removeNoteSilently(note, node) {
  if (interactionState.selected && interactionState.selected.kind === 'note' && interactionState.selected.id === note.id) clearSelection();
  else dropFromSelection(note.id);     // set hygiene for a non-primary member (issue #55)
  const i = current.notes.indexOf(note);
  if (i >= 0) current.notes.splice(i, 1);
  node.remove(); noteEls.delete(note.id);
  // A husk discard takes its links with it — emptying a note deletes it (B8), and
  // deleting a note deletes its links (issue #142, B91). Silent, so no Undo.
  if (removeLinksForNote(note.id).length) updateLinks();
  saveNow();
}
function commitLot(node) {
  const item = current.parkingLot.find(i => i.id === node.dataset.id);
  if (!item) return;
  item.text = node.querySelector('.lot-text').textContent;
  if (item.text.trim().length === 0) { removeLotSilently(item, node); return; }
  saveNow();
}
function removeLotSilently(item, node) {
  if (interactionState.selected && interactionState.selected.kind === 'lot' && interactionState.selected.id === item.id) clearSelection();
  const i = current.parkingLot.indexOf(item);
  if (i >= 0) current.parkingLot.splice(i, 1);
  node.remove(); lotEls.delete(item.id);
  updateBoardGeometry();               // the shelf follows its rows (UIUX §3.2)
  saveNow();
}
function commitAnchor(node) {
  current[node.dataset.anchor] = node.textContent;
  node.classList.toggle('filled', !!node.textContent.length);
  if (viewState.isDesktop && node.dataset.anchor === 'title') renderPane(); // reconcile the date line
  updateBoardGeometry();      // the band follows its zones (B47), the handle its card (B65)
  saveNow();
}

/* Drag (PRD §6.3): free overlap, no snap, clamp to page bounds only. */
function startDrag() {
  if (interactionState.linkSource !== null) clearLink();   // dragging a note exits link mode (issue #142, B91)
  interactionState.g.mode = 'drag';
  interactionState.g.target.node.classList.add('pressed');
  surfaceNote(interactionState.g.target.node);
  const note = interactionState.g.note;
  const startLogical = toLogical(interactionState.g.startX, interactionState.g.startY);
  // Group drag (issue #55): grabbing a MEMBER of a multi-selection moves every
  // member by the same delta. Only the grabbed note surfaces (above) — the
  // others keep their z-order; every member wears .pressed. Grabbing a
  // non-member falls through to the single path, which collapses the set
  // (selectNote below) — today's behavior.
  if (viewState.isDesktop && multiSel.size > 1 && multiSel.has(note.id)) {
    interactionState.g.group = [];
    for (const id of selectedNoteIds()) {
      const n = current.notes.find(m => m.id === id);
      const memberNode = noteEls.get(id);
      if (!n || !memberNode) continue;
      // Per-member rebase — the one licensed grab-time write (B21), which
      // with B40 also folds each member's scale multiplier; visually silent.
      rebaseNote(n);
      const fw = memberNode.offsetWidth * n.scale, fh = memberNode.offsetHeight * n.scale;
      interactionState.g.group.push({
        note: n, node: memberNode, x0: n.x, y0: n.y,
        // Per-member bounds, widened to admit the grab position exactly as
        // the single path below (B40). Members hitting different clamps can
        // compress the group's relative geometry at the sheet edge — accepted
        // (B41): the alternative is a note the group can never park flush.
        minX: Math.min(0, n.x), maxX: Math.max(n.x, Math.max(0, viewState.LOGICAL_W - fw)),
        minY: Math.min(0, n.y), maxY: Math.max(n.y, Math.max(0, viewState.LOGICAL_H - fh)),
      });
      memberNode.classList.add('pressed');
    }
    interactionState.g.groupX0 = startLogical.x; interactionState.g.groupY0 = startLogical.y;
    setSelectionHidden(true);
    return;
  }
  rebaseNote(note);                  // grab math runs in current-frame units (issue #15)
  if (viewState.isDesktop) { selectNote(note.id); setSelectionHidden(true); }
  interactionState.g.grabDX = startLogical.x - note.x;
  interactionState.g.grabDY = startLogical.y - note.y;
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
  const node = interactionState.g.target.node;
  const footW = node.offsetWidth * note.scale, footH = node.offsetHeight * note.scale;
  interactionState.g.dragMinX = Math.min(0, note.x);
  interactionState.g.dragMaxX = Math.max(note.x,
    Math.max(0, viewState.LOGICAL_W - Math.min(footW, NOTE_MIN_W * note.scale)));
  interactionState.g.dragMinY = Math.min(0, note.y);
  interactionState.g.dragOverY = Math.max(0, note.y + footH - viewState.LOGICAL_H);
  // Reflow-guard caches (issue #53): the cap the node is wearing right now
  // (the grab rebase re-asserted it — under B64's min-k the rebase can widen
  // the cap, so rebaseNote writes the var before anything here measures) and
  // the size measured under it. settleDragFoot skips the layout-forcing
  // write+read while these prove the cap cannot bind.
  interactionState.g.dragCap = noteMaxW(note);
  interactionState.g.dragW = node.offsetWidth;
  interactionState.g.dragH = node.offsetHeight;
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
  if (force || interactionState.g.dragW > interactionState.g.dragCap - 1 || cap < interactionState.g.dragW) {
    applyNoteWidth(node, note);
    interactionState.g.dragCap = cap;
    interactionState.g.dragW = node.offsetWidth;
    interactionState.g.dragH = node.offsetHeight;
  }
  const footW = interactionState.g.dragW * note.scale, footH = interactionState.g.dragH * note.scale;
  if (note.x + footW > viewState.LOGICAL_W) note.x = Math.max(interactionState.g.dragMinX, viewState.LOGICAL_W - footW);
  note.y = Math.min(note.y, Math.max(interactionState.g.dragMinY, viewState.LOGICAL_H - footH + interactionState.g.dragOverY));
  node.style.left = note.x + 'px';
  node.style.top = note.y + 'px';
  updateLinks();                     // a dragged note's links follow it live (B91)
}

function updateDrag(e) {
  const pt = toLogical(e.clientX, e.clientY);
  if (interactionState.g.group) {
    // One delta for the whole group, clamped per member (issue #55).
    const dx = pt.x - interactionState.g.groupX0, dy = pt.y - interactionState.g.groupY0;
    for (const m of interactionState.g.group) {
      m.note.x = clamp(m.x0 + dx, m.minX, m.maxX);
      m.note.y = clamp(m.y0 + dy, m.minY, m.maxY);
      m.node.style.left = m.note.x + 'px';
      m.node.style.top = m.note.y + 'px';
    }
    updateLinks();                   // group members' links follow too (B91)
    return;
  }
  const note = interactionState.g.note, node = interactionState.g.target.node;
  note.x = clamp(pt.x - interactionState.g.grabDX, interactionState.g.dragMinX, interactionState.g.dragMaxX);
  note.y = Math.max(interactionState.g.dragMinY, pt.y - interactionState.g.grabDY);   // upper bound lives in the settle
  settleDragFoot(note, node, false);
}
function endDrag() {
  if (interactionState.g.group) {
    // One write for the whole group (issue #55). The drag held grab-time
    // bounds, so no member overhangs; at the drop each settles onto the exact
    // cap for its resting x (issue #53) — never tighter than what the clamp
    // admitted, so nothing jumps, and a leftward member may re-widen.
    for (const m of interactionState.g.group) {
      applyNoteWidth(m.node, m.note);
      setHitInset(m.node, m.note);
      m.node.classList.remove('pressed');
    }
    interactionState.g.target.node.classList.remove('pressed');
    saveNow();
    updateLinks();                   // final settle: links land on the dropped notes (B91)
    if (viewState.isDesktop) updateSelectionUI();
    return;
  }
  const note = interactionState.g.note, node = interactionState.g.target.node;
  // One final, forced settle at the resting x before the write. Legal under
  // B17: the re-clamp runs inside the gesture, which owns its writes — B17
  // forbids viewport re-clamps of committed positions only.
  settleDragFoot(note, node, true);
  setHitInset(node, note);           // the drag can have rewrapped the note (issue #53)
  node.classList.remove('pressed');
  saveNow();
  reflectToolbarFlip(node, note);    // a drop near the sheet top flips the row (B84)
  if (viewState.isDesktop) updateSelectionUI();  // reposition + unhide at the drop point
}

/* Pinch (PRD §6.3 / UIUX §5): transform scale only, clamp 0.5–2.0 (bounds
   widen to admit a folded cross-frame scale, B40), transform-origin top-left
   so stored x,y stays truthful and the note doesn't drift; re-clamp position
   if the grown footprint exits the page. */
function startPinch() {
  clearTimeout(interactionState.g.longPressTimer);
  if (interactionState.g.mode === 'drag') interactionState.g.target.node.classList.remove('pressed');
  const pts = [...pointers.values()];
  interactionState.g.mode = 'pinch';
  rebaseNote(interactionState.g.note);                // grab math runs in current-frame units (issue #15)
  interactionState.g.startDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
  interactionState.g.startScale = interactionState.g.note.scale;
  interactionState.g.target.node.classList.add('pressed');
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
  note.x = clamp(note.x, Math.min(0, viewState.LOGICAL_W - footW), Math.max(0, viewState.LOGICAL_W - footW));
  note.y = clamp(note.y, Math.min(0, viewState.LOGICAL_H - footH), Math.max(0, viewState.LOGICAL_H - footH));
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
  applyNoteScale(interactionState.g.note, interactionState.g.target.node, gestureScale(interactionState.g.startScale, dist / interactionState.g.startDist));
}
function endPinch() {
  if (interactionState.g) { interactionState.g.target.node.classList.remove('pressed'); saveNow(); }
  interactionState.g = null;
}

/* Z-order: last-touched note to the top (end of array + end of DOM). */
function surfaceNote(node) {
  const id = node.dataset.id;
  const note = current.notes.find(n => n.id === id);
  if (!note) return;
  const i = current.notes.indexOf(note);
  if (i === current.notes.length - 1) { return; }    // already on top
  current.notes.splice(i, 1); current.notes.push(note);
  el.board.appendChild(node);                         // move to top of DOM among notes
  saveNow();
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

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
// Mobile-only "engaged" note (issue #136, B90): the note whose toolbar is shown
// after a first tap — WITHOUT a keyboard. It is the select step desktop already
// has via `selected`, which mobile lacked (there, engaging a note WAS editing it).
// A second tap on the engaged active note edits it. No focus and no write (B22):
// the toolbar is revealed by a `.engaged` class, not by :focus-within.
function setEngaged(node) {
  const prev = el.board && el.board.querySelector('.note.engaged');
  if (prev) prev.classList.remove('engaged');
  interactionState.engaged = node.dataset.id;
  node.classList.add('engaged');
}
function clearEngaged() {
  const prev = el.board && el.board.querySelector('.note.engaged');
  if (prev) prev.classList.remove('engaged');
  interactionState.engaged = null;
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
const multiSel = new Set();

// The selection as an id array, primary first — the order bulk actions run in.
function selectedNoteIds() {
  if (!interactionState.selected || interactionState.selected.kind !== 'note') return [];
  const ids = [interactionState.selected.id];
  for (const id of multiSel) if (id !== interactionState.selected.id) ids.push(id);
  return ids;
}

/* Shift-click semantics (issue #55): toggle membership. Adding makes the
   clicked note the primary; removing the primary promotes another member;
   removing the last member clears. A set that would end at size 1 collapses
   back to a plain single selection, keeping the invariant. */
function toggleInSelection(id) {
  if (!noteEls.get(id)) return;
  if (!interactionState.selected || interactionState.selected.kind !== 'note') { selectNote(id); return; }
  const members = new Set(multiSel.size ? multiSel : [interactionState.selected.id]);
  let primary;
  if (members.has(id)) {
    members.delete(id);
    if (!members.size) { clearSelection(); return; }
    primary = interactionState.selected.id === id ? members.values().next().value : interactionState.selected.id;
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
  if (interactionState.selEl) interactionState.selEl.classList.toggle('multi', multiSel.size > 1);
}

function ensureSelectionEl() {
  if (interactionState.selEl) return;
  interactionState.selEl = document.createElement('div');
  interactionState.selEl.id = 'selection';
  // The outline is visual only; hit-testing lives in four edge bands + the
  // corner handles, so the note's interior stays clickable for the second
  // click of a double-click (a parent's hit area can't be carved out).
  const ring = document.createElement('div');
  ring.className = 'sel-ring';
  interactionState.selEl.appendChild(ring);
  for (const side of ['n', 's', 'w', 'e']) {
    const b = document.createElement('div');
    b.className = 'sel-edge ' + side;
    interactionState.selEl.appendChild(b);
  }
  for (const corner of ['tl', 'tr', 'bl', 'br']) {
    const h = document.createElement('div');
    h.className = 'sel-handle ' + corner;
    h.setAttribute('aria-hidden', 'true');
    interactionState.selEl.appendChild(h);
  }
  // The overlay is the resize frame only now (B84): the ring, four edge bands
  // and four corner handles. A selected note's actions moved onto its own
  // top-edge toolbar (makeNoteToolbar), so the overlay no longer carries
  // Complete/Copy/Delete buttons.
}

function selectNote(id) {
  // Re-selecting the primary is a no-op only while the selection is single: a
  // plain click on the primary of a multi-selection collapses it (issue #55).
  if (interactionState.selected && interactionState.selected.kind === 'note' && interactionState.selected.id === id && multiSel.size === 0) {
    updateSelectionUI(); return;
  }
  clearSelection();
  const node = noteEls.get(id);
  if (!node) return;
  interactionState.selected = { kind: 'note', id };
  node.classList.add('selected');
  ensureSelectionEl();
  el.board.appendChild(interactionState.selEl);
  updateSelectionUI();
}

function selectLot(id) {
  if (interactionState.selected && interactionState.selected.kind === 'lot' && interactionState.selected.id === id) return;
  clearSelection();
  const node = lotEls.get(id);
  if (!node) return;
  interactionState.selected = { kind: 'lot', id };
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

function clearSelection() {
  if (interactionState.linkSource !== null) clearLink();   // a board swap / new selection ends link mode (B91)
  // Rings first: the whole set goes when the selection goes (issue #55) —
  // applyMode's teardown and renderBoard's rebuild both land here.
  if (multiSel.size) {
    for (const id of multiSel) {
      const node = noteEls.get(id);
      if (node) node.classList.remove('multi-selected');
    }
    multiSel.clear();
  }
  if (!interactionState.selected) return;
  if (interactionState.selected.kind === 'note') {
    const node = noteEls.get(interactionState.selected.id);
    if (node) node.classList.remove('selected');
    if (interactionState.selEl) interactionState.selEl.remove();
  } else {
    const node = lotEls.get(interactionState.selected.id);
    if (node) {
      node.classList.remove('selected');
      const act = node.querySelector('.lot-actions');
      if (act) act.remove();
    }
  }
  interactionState.selected = null;
}

function setSelectionHidden(hidden) {  // drag/resize in flight: chrome steps aside
  if (interactionState.selEl) interactionState.selEl.classList.toggle('hidden', hidden);
}

function updateSelectionUI() {
  if (!interactionState.selected || !current) return;
  if (interactionState.selected.kind === 'note') {
    const note = current.notes.find(n => n.id === interactionState.selected.id);
    const node = noteEls.get(interactionState.selected.id);
    if (!note || !node || !interactionState.selEl) return;
    const w = node.offsetWidth * effScale(note), h = node.offsetHeight * effScale(note);
    interactionState.selEl.style.left = renderX(note) + 'px';
    const top = renderY(note);
    interactionState.selEl.style.top = top + 'px';
    interactionState.selEl.style.width = w + 'px';
    interactionState.selEl.style.height = h + 'px';
    // The note's own toolbar carries the labels now (B84): re-derive its
    // Complete/Highlight marks and its above/below flip for the current geometry
    // (a drag or resize can have moved the note toward the sheet top).
    updateNoteToolbar(node, note);
    reflectToolbarFlip(node, note);
    // Two or more selected: the overlay drops its resize grip (edges +
    // handles, hidden in CSS) — resize is single-selection only (issue #55).
    interactionState.selEl.classList.toggle('multi', multiSel.size > 1);
    setSelectionHidden(false);
  } else {
    const node = lotEls.get(interactionState.selected.id);
    const item = current.parkingLot.find(i => i.id === interactionState.selected.id);
    if (!node || !item) return;
    const p = node.querySelector('.sel-complete');
    if (p) p.textContent = item.state === 'complete' ? COPY.restore : COPY.complete;
  }
}

/* Frame-drag resize (issue #4): scale from the pointer's distance to the
   note's fixed top-left origin — same clamp, re-clamp, and hit math as pinch. */
function startResize(e) {
  const note = current.notes.find(n => n.id === interactionState.selected.id);
  const node = noteEls.get(interactionState.selected.id);
  if (!note || !node) { interactionState.g.mode = 'cancelled'; return; }
  rebaseNote(note);                  // grab math runs in current-frame units (issue #15)
  interactionState.g.mode = 'resize';
  interactionState.g.note = note;
  interactionState.g.target = { type: 'note', node };
  interactionState.g.originX = note.x; interactionState.g.originY = note.y;
  const pt = toLogical(e.clientX, e.clientY);
  interactionState.g.grabDist = Math.hypot(pt.x - interactionState.g.originX, pt.y - interactionState.g.originY) || 1;
  interactionState.g.startScale = note.scale;
  node.classList.add('pressed');
  setSelectionHidden(true);
}
function updateResize(e) {
  const pt = toLogical(e.clientX, e.clientY);
  const dist = Math.hypot(pt.x - interactionState.g.originX, pt.y - interactionState.g.originY);
  applyNoteScale(interactionState.g.note, interactionState.g.target.node, gestureScale(interactionState.g.startScale, dist / interactionState.g.grabDist));
}
function endResize() {
  interactionState.g.target.node.classList.remove('pressed');
  saveNow();
  updateSelectionUI();               // reposition + unhide at the new footprint
}

/* --- 9. Complete / restore / delete + Undo toast ------------------------- */
// State + presentation together, no write: the single-note wrappers below add
// their own saveNow, the bulk path (issue #55) saves once for the whole set.
function setNoteState(node, complete) {
  const note = current.notes.find(n => n.id === node.dataset.id);
  if (!note) return;                   // a blank note the pre-act blur just discarded (B84/B8)
  note.state = complete ? 'complete' : 'active';
  node.classList.toggle('complete', complete);
  applyCompleteA11y(node, complete);
  updateNoteToolbar(node, note);       // Complete ⇄ Restore mark/label (B84)
}
function completeNote(node) { setNoteState(node, true); saveNow(); }
function restoreNote(node) { setNoteState(node, false); saveNow(); }
// Highlight (issue #105, B71): an appearance axis, not a status — so no
// applyCompleteA11y here; the amber wash is decorative and reads truthily off
// note.highlighted (legacy notes lack the field, which is falsy — B21's idiom).
function setNoteHighlight(node, on) {
  const note = current.notes.find(n => n.id === node.dataset.id);
  if (!note) return;                   // discarded blank note (B84/B8) — nothing to wash
  note.highlighted = on;
  node.classList.toggle('highlight', on);
  updateNoteToolbar(node, note);       // Highlight ⇄ Remove highlight label (B84)
}
function toggleHighlight(node) {
  const note = current.notes.find(n => n.id === node.dataset.id);
  if (!note) return;
  setNoteHighlight(node, !note.highlighted); saveNow();
}
function completeLot(node) {
  const item = current.parkingLot.find(i => i.id === node.dataset.id);
  item.state = 'complete'; node.classList.add('complete');
  applyCompleteA11y(node, true); saveNow();
}
function restoreLot(node) {
  const item = current.parkingLot.find(i => i.id === node.dataset.id);
  item.state = 'active'; node.classList.remove('complete');
  applyCompleteA11y(node, false); saveNow();
}

// One id through the batch path (issue #55): same snapshot, same splice, same
// index-restoring Undo — one implementation to keep honest.
function deleteNote(node) { deleteNotes([node.dataset.id]); }
function deleteLot(node) {
  if (interactionState.selected && interactionState.selected.kind === 'lot' && interactionState.selected.id === node.dataset.id) clearSelection();
  const item = current.parkingLot.find(i => i.id === node.dataset.id);
  const index = current.parkingLot.indexOf(item);
  const snapshot = JSON.parse(JSON.stringify(item));
  current.parkingLot.splice(index, 1);
  leave(node, () => { node.remove(); lotEls.delete(item.id); updateBoardGeometry(); });
  saveNow();
  showUndo(() => {
    current.parkingLot.splice(index, 0, snapshot);
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
function deleteNotes(ids) {
  const wanted = new Set(ids);
  const snap = [];
  current.notes.forEach((n, i) => {
    if (wanted.has(n.id)) snap.push({ note: JSON.parse(JSON.stringify(n)), index: i });
  });
  if (!snap.length) return;
  // The deleted notes take their links with them (issue #142, B91). Capture them
  // FIRST so the one Undo restores exact prior state — the notes AND their
  // relationships (UIUX §9) — then drop them from the live board.
  const removedLinks = boardLinks().filter(l => wanted.has(l.a) || wanted.has(l.b));
  if (removedLinks.length) current.links = current.links.filter(l => !wanted.has(l.a) && !wanted.has(l.b));
  clearSelection();
  if (interactionState.engaged && wanted.has(interactionState.engaged)) clearEngaged();   // the engaged note is leaving (issue #136, B90)
  for (let i = snap.length - 1; i >= 0; i--) {       // descending: indices stay valid
    const s = snap[i];
    current.notes.splice(s.index, 1);
    const node = noteEls.get(s.note.id);
    if (node) leave(node, () => { node.remove(); noteEls.delete(s.note.id); });
  }
  if (removedLinks.length) updateLinks();            // drop the lines to the leaving notes
  saveNow();
  showUndo(() => {
    for (const s of snap) {                          // ascending: exact z-order back
      current.notes.splice(s.index, 0, s.note);
      el.board.appendChild(makeNoteEl(s.note));
    }
    reorderNotesDOM();
    if (removedLinks.length) {                       // relationships come back with the notes
      if (!current.links) current.links = [];
      for (const l of removedLinks) current.links.push(l);
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
function setSelectedNotesState(restore) {
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
function setSelectedNotesHighlight(on) {
  for (const id of selectedNoteIds()) {
    const node = noteEls.get(id);
    if (node) setNoteHighlight(node, on);
  }
  saveNow();
  updateSelectionUI();
}

// Rebuild note DOM order to match array order (used after undo-insert).
function reorderNotesDOM() {
  for (const note of current.notes) {
    const node = noteEls.get(note.id);
    if (node) el.board.appendChild(node);
  }
}
function leave(node, done) {
  node.classList.add('leaving');
  setTimeout(done, LEAVE_MS);
}

/* Undo toast (UIUX §9): 5s, restores exact state; a new delete finalizes prior. */
/* Menu, list, category, calendar, and toast UI flags — one state object
   (issue #176). Members keep their original declaration comments. */
const menuUiState = {
  undoTimer: null,
  noticeSeq: 0,
  menuOpen: false,
  menuKeyHandler: null,
  menuOutsideHandler: null,
  menuInvoker: null,                 // desktop contextmenu: focus returns here on close
  menuReturnFocus: false,            // true only inside closeMenu's synchronous focus return
  pdfLossy: false,
  listOpen: false,
  catView: null,
  lotMenuOpen: false,
  catPage: { todo: 0, idea: 0, unsorted: 0, learning: 0 },
  catCap: 0,                         // 0 = never rendered; the capacity check waits
  catFilled: 0,                      // populated sections the last render measured
  calOpen: false,                    // the MOBILE full-screen calendar (B95's third screen)
  calExpanded: false,                // wide's expanded panel (B99) — rail-up is not "open"
};
function showUndo(undoFn, scope, label) {
  clearTimeout(menuUiState.undoTimer);
  el.toast.dataset.mode = 'undo';                      // capture priority over save-error
  el.toast.dataset.scope = scope || 'item';            // 'item' undo is current-bound (finding 1)
  el.toast.textContent = '';
  // The caption defaults to "Deleted"; link create/toggle pass "Linked"/"Unlinked" (B91).
  const msg = document.createElement('span'); msg.className = 'msg'; msg.textContent = label || COPY.deleted;
  const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = COPY.undo;
  // Clear the finalize timer on the click itself, not at the end of the action
  // window, so a late Undo (≈4.6s+) can't be finalized out from under it.
  btn.addEventListener('click', () => {
    clearTimeout(menuUiState.undoTimer);
    commitAction(() => { hideToast(); undoFn(); });
  });
  el.toast.appendChild(msg); el.toast.appendChild(btn);
  el.toast.hidden = false;
  requestAnimationFrame(() => el.toast.classList.add('show'));
  menuUiState.undoTimer = setTimeout(hideToast, UNDO_MS);          // timeout finalizes the delete
}
function hideToast() {
  delete el.toast.dataset.mode;
  delete el.toast.dataset.scope;
  delete el.toast.dataset.seq;
  el.toast.classList.remove('show');
  setTimeout(() => { if (!el.toast.classList.contains('show')) el.toast.hidden = true; }, TOAST_HIDE_MS);
}
/* A message with no action. `save` is persistent (hideSaveError clears it when
   the write lands); `export` and `copy` carry a ttl, because nothing later will
   come along to retract them. */
function showNotice(text, mode, ttl) {
  if (el.toast.dataset.mode === 'undo') return;        // never clobber a pending undo
  // Each notice stamps the toast; the ttl timer only hides its own stamp. A
  // mode check alone let a stale timer hide a newer same-mode notice early —
  // copying two items inside 1.5s (issue #59) is how that became observable.
  const seq = String(++menuUiState.noticeSeq);
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
function showSaveError() {
  // A retrying save re-announces itself on every attempt, so it can afford to
  // wait behind a notice that will time out; the reverse is not true.
  if (el.toast.dataset.mode === 'export') return;
  showNotice(COPY.saveError, 'save');
}
function hideSaveError() {
  if (el.toast.dataset.mode === 'save') { delete el.toast.dataset.mode; hideToast(); }
}

/* Copy an item's plain text — the record field, never the DOM (issue #59).
   clipboard.writeText is the real API; where it's missing or rejects (insecure
   origin, permission policy) fall back to the execCommand route through a
   throwaway textarea. Success gets a short notice; failure gets a longer one,
   because it is the only evidence anything went wrong. */
function copyText(text) {
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

/* --- 10. Long-press menu ------------------------------------------------- */

/* One menu opens here now (B91): a note's single Link item. The anchor's own
   menu (All boards · Export) is gone (issue #140, B92) — both of its actions
   had long since been declared on the board-action row (B83), and the row is
   now the only route to them: a hidden menu whose every item sits on a visible
   tab one gesture away is chrome without a job. The lot still has none. All
   items are non-destructive, so no separator — same rule as everywhere else. */
function openMenuFor(target, clientX, clientY) {
  if (target.type !== 'note') return;   // anchors lost their menu (B92); lot / canvas have none
  // A note's one relational action (issue #142, B91): Link arms link mode, then
  // the next note tapped is connected (handleTap's linkSource branch). beginLink
  // runs inside buildMenu's commitAction wrapper — arming is idempotent, fine.
  const id = target.node.dataset.id;
  buildMenu([{ label: COPY.link, glyph: GLYPH.link, action: () => beginLink(id), raw: true }], clientX, clientY);
}

/* The board-action row (issue #126, B83; three tabs since issue #140, B92): the
   board-level actions declared as flat tabs above the Parking Lot instead of
   hidden behind a gesture. This is the door B65 opened with the `Menu` handle,
   re-homed onto controls that state their own act. The anchor long-press /
   right-click menu is gone entirely (B92): every item it carried sits on a
   visible tab, so the hidden route was chrome without a job. */

/* Fill a tab with its drawn mark (UIUX §13.3) and label. Built once at boot;
   the toggle only restates its label text afterwards (syncBoardActions). */
function fillBoardAction(btn, glyph, label) {
  const g = document.createElement('span');
  g.className = 'glyph'; g.setAttribute('aria-hidden', 'true'); g.innerHTML = glyph;
  const l = document.createElement('span'); l.className = 'label'; l.textContent = label;
  btn.append(g, l);
}
fillBoardAction(el.actionBoards, GLYPH.boards, COPY.calBoardTab);
fillBoardAction(el.actionExport, GLYPH.export, COPY.export);
fillBoardAction(el.actionImport, GLYPH.import, COPY.import);
fillBoardAction(el.actionCalendar, GLYPH.calendar, COPY.calendar);
/* The calendar's R1 top row (issue #156, B98): the same fill, the same family.
   Back wears its own page-turn mark (GLYPH.calBack — drawn for B95's R1 and
   wired here for the first time); All Boards and Export wear the same marks
   as their board-row siblings, because they are the same acts. Filling at
   boot is what makes the row controls at all — the issue's "untappable /
   invisible" report was three empty <button>s rendering as blank squares. */
fillBoardAction(el.calBack, GLYPH.calBack, COPY.calBack);
fillBoardAction(el.calBoards, GLYPH.boards, COPY.calAllBoards);
fillBoardAction(el.calExport, GLYPH.export, COPY.calExport);

/* The toggle wears the act it will perform (B43/B71's grammar, not a fixed
   noun): on the board it offers All boards; while the All-Boards surface is up
   — the desktop list overlay, or the mobile lot-grid — it offers the way back
   to this one. One mark (GLYPH.boards, the boards domain), the label alone
   flips, so state is never colour (UIUX §1). Called from renderBoard and every
   list-state transition. R7.2's re-grammar shortens the resting label to "All"
   (the four-tab row's fit); the toggle's other face keeps the full "This
   board" — the one word that states the return, unchanged from B83. */
function syncBoardActions() {
  const away = menuUiState.listOpen || menuUiState.lotMenuOpen;
  const l = el.actionBoards.querySelector('.label');
  if (l) l.textContent = away ? COPY.thisBoard : COPY.calBoardTab;
}

/* All Boards is pure navigation: it commits nothing a stray tap could
   duplicate, so it runs raw, no commitAction (B81). goToList opens the list /
   lot-grid; returnToBoard pops back however deep. */
el.actionBoards.addEventListener('click', () => {
  if (menuUiState.listOpen || menuUiState.lotMenuOpen) returnToBoard();
  else goToList();
});
/* Export is now a CHOICE (issue #140, B92): the tab opens the app's one menu
   species — buildMenu, the same popup the note's Link item wears, anchored at
   the pressed tab — with PDF · JSON as its two leaves. The choice itself is
   navigation ("to what?"), so it runs raw; each LEAF commits (a file leaves
   the device) and takes the drop-guard itself, exactly where the anchor menu's
   Export item and the old tab used to hold it (B81). PDF reads `current`, the
   one board you're looking at (issue #43); JSON backs up every board.
   Anchored at the button, not the pointer: the menu is the tab's own next
   state, not a context menu that happens to be nearby. */
el.actionExport.addEventListener('click', (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  buildMenu([
    { label: COPY.exportPdf, glyph: GLYPH.export, action: () => commitAction(() => exportBoardPdf(current)) },
    { label: COPY.exportJson, glyph: GLYPH.boards, action: () => commitAction(exportAllJson) },
  ], r.left, r.bottom);
});
/* Import commits too — boards can be overwritten — so its one step (opening
   the file dialog) runs under the same drop-guard. The dialog itself is the
   hidden input's mechanism (issue #140): the visible control is the tab, the
   platform's own picker does the choosing, and nothing is named twice. The
   input is reset before each open so picking the SAME file twice still fires
   change — a browser fires it only when the value changes. */
el.actionImport.addEventListener('click', () => {
  commitAction(() => {
    el.importFile.value = '';
    el.importFile.click();
  });
});
el.importFile.addEventListener('change', () => {
  const file = el.importFile.files && el.importFile.files[0];
  if (file) importBoardsJson(file);
});

/* Calendar (issue #145): the fourth board-level tab. Navigation, like All
   boards — it commits nothing a stray tap could duplicate (B81), so it runs
   raw. The calendar view is a third screen, so it pushes its own history
   state { v: 'cal' }: the OS back gesture returns from it (B9, unshadowed),
   and its OWN Back button is the always-visible route (R1). */
el.actionCalendar.addEventListener('click', () => {
  if (menuUiState.calOpen) return;
  // The rail is wide's entry (B99); the tab is mobile's and pushes its own
  // history state { v: 'cal' }: the OS back gesture returns from it (B9,
  // unshadowed), and its OWN Back button is the always-visible route (R1).
  if (viewState.isWide) { showCal(); return; }
  history.pushState({ v: 'cal' }, '');
  showCal();
});
/* The tabs are focusable things inside #board, and the desktop keyboard grammar
   (Enter edits the selection, Delete destroys it) listens on document and keys
   off `selected` alone, not focus — so a tab focused over a selected note would
   otherwise let Delete reach that note. The row swallows the grammar's keys;
   Enter's native default (the first press) still fires the tab's own click, and
   Escape passes through so deselect-from-anywhere still works. This is B65's
   guard, re-homed — including its auto-repeat drop: the native click fires per
   Enter keydown, so a held key would fire the tab's action (an export!) over
   and over, since commitAction only rate-limits to ACTION_DELAY. preventDefault
   on the repeats suppresses the synthesized click, so a held Enter acts once. */
el.boardActions.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== 'Delete' && e.key !== 'Backspace') return;
  e.stopPropagation();
  if (e.repeat) e.preventDefault();
});

/* Desktop right-click on a note opens its Link menu (issue #142, B91) — the
   desktop parallel to the mobile long-press, and the note's one relational
   action. B84 had removed the note's desktop contextmenu (its Complete/Copy/
   Delete moved to the on-select toolbar); B91 re-adds one scoped to a single
   Link item. A right-click on the canvas, an anchor, the lot, or an editing note
   still falls through to the browser's own menu, as before; the board card's own
   contextmenu listener (its delete menu, B24) is a different element, untouched. */
el.board.addEventListener('contextmenu', (ev) => {
  if (!viewState.isDesktop) return;                           // mobile arms Link by long-press
  if (interactionState.linkSource) { ev.preventDefault(); return; }  // already arming: left-click a note to finish
  const noteNode = ev.target.closest('.note');
  if (!noteNode || isEditing(ev.target)) return;    // non-note / text edit keeps the native menu
  ev.preventDefault();
  let x = ev.clientX, y = ev.clientY;
  if (!x && !y) {                                   // Shift+F10 fires contextmenu at 0,0
    const r = noteNode.getBoundingClientRect();
    x = r.left + r.width / 2; y = r.top + r.height / 2;
  }
  // No menuInvoker: closeMenu's focus-return would run the focusin Tab-selects
  // rule (issue #55) and stray-select the source note. The mouse user finishes
  // the link by clicking the target, so no focus return is needed.
  openMenuFor({ type: 'note', node: noteNode }, x, y);
});

function buildMenuButtons(items) {
  const buttons = [];
  for (const it of items) {
    if (it.sep) { const s = document.createElement('div'); s.className = 'sep'; el.menu.appendChild(s); continue; }
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    if (it.danger) b.className = 'danger';
    // Drawn marks (UIUX §13.3): GLYPH holds app-owned SVG markup, not text.
    const g1 = document.createElement('span'); g1.className = 'glyph'; g1.setAttribute('aria-hidden', 'true'); g1.innerHTML = it.glyph;
    const lb = document.createElement('span'); lb.textContent = it.label;
    b.appendChild(g1); b.appendChild(lb);
    // The menu closes and acts on release, with a drop-guard so a double-tap
    // fires once. One site covers every menu action, board rows included — except
    // an item flagged `raw` (Link, B91): arming a mode is navigation, not a
    // consequence (B81), so it must NOT hold the 400ms guard, or a quick tap on
    // the link target inside that window would be dropped by the same guard.
    b.addEventListener('click', () => {
      if (it.raw) { closeMenu(); it.action(); }
      else commitAction(() => { closeMenu(); it.action(); });
    });
    el.menu.appendChild(b); buttons.push(b);
  }
  return buttons;
}

function buildMenu(items, clientX, clientY) {
  closeMenu();
  el.menu.textContent = '';
  const buttons = buildMenuButtons(items);
  el.menu.hidden = false;
  // Position adjacent to the press point, flipped to stay on-viewport.
  const mw = el.menu.offsetWidth, mh = el.menu.offsetHeight;
  const vw = window.innerWidth, vh = window.innerHeight, pad = 8;
  let x = clientX, y = clientY + 8;
  if (x + mw > vw - pad) x = clientX - mw;
  if (x < pad) x = pad;
  if (y + mh > vh - pad) y = clientY - mh - 8;
  if (y < pad) y = pad;
  el.menu.style.left = x + 'px';
  el.menu.style.top = y + 'px';
  requestAnimationFrame(() => el.menu.classList.add('show'));
  menuUiState.menuOpen = true;
  if (buttons[0]) buttons[0].focus();

  attachMenuKeyNav(buttons);
  attachMenuOutsideDismiss();
}

function attachMenuKeyNav(buttons) {
  menuUiState.menuKeyHandler = (ev) => {
    // Escape pops the menu ONLY (B91): stopPropagation keeps it from reaching the
    // desktop keydown grammar underneath, which — now that a note's Link menu can
    // open over a live selection — would otherwise also clear that selection.
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeMenu(); }
    else if (ev.key === 'Tab') {                        // trap focus while open
      ev.preventDefault();
      const i = buttons.indexOf(document.activeElement);
      const next = ev.shiftKey ? (i <= 0 ? buttons.length - 1 : i - 1) : (i + 1) % buttons.length;
      buttons[next].focus();
    } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      const i = Math.max(0, buttons.indexOf(document.activeElement));
      const next = ev.key === 'ArrowDown' ? (i + 1) % buttons.length : (i <= 0 ? buttons.length - 1 : i - 1);
      buttons[next].focus();
    }
  };
  document.addEventListener('keydown', menuUiState.menuKeyHandler, true);
}

/* Dismissal is inert (B30): this handler runs in the capture phase, so the
   very press that closes the menu would otherwise go on to reach the
   recognizer and capture a note on the paper the menu was covering. */
function attachMenuOutsideDismiss() {
  menuUiState.menuOutsideHandler = (ev) => {
    if (el.menu.contains(ev.target)) return;
    if (el.board.contains(ev.target)) {
      interactionState.swallowTap = true;
      setTimeout(() => { interactionState.swallowTap = false; }, 0);   // never outlives this press
    }
    closeMenu();
  };
  setTimeout(() => document.addEventListener('pointerdown', menuUiState.menuOutsideHandler, true), 0);
}

function closeMenu() {
  if (!menuUiState.menuOpen && el.menu.hidden) return;
  el.menu.classList.remove('show');
  el.menu.hidden = true;
  menuUiState.menuOpen = false;
  if (menuUiState.menuKeyHandler) document.removeEventListener('keydown', menuUiState.menuKeyHandler, true);
  if (menuUiState.menuOutsideHandler) document.removeEventListener('pointerdown', menuUiState.menuOutsideHandler, true);
  menuUiState.menuKeyHandler = menuUiState.menuOutsideHandler = null;
  returnMenuFocus();
}

function returnMenuFocus() {
  if (menuUiState.menuInvoker) {
    const m = menuUiState.menuInvoker; menuUiState.menuInvoker = null;
    // focus() dispatches focusin synchronously; the flag scopes the multi-
    // selection exemption to exactly this call (issue #55).
    menuUiState.menuReturnFocus = true; m.focus(); menuUiState.menuReturnFocus = false;
  }
}

/* --- 10.5 PDF export (issue #43) -----------------------------------------
   A board leaves the device as a .pdf, not a screenshot. PDF is a text format
   and the base-14 fonts need no embedding, so the whole exporter is written
   here rather than vendored: a library would be the app's first dependency and
   its first precache entry, and B1 already settled that this project hand-rolls
   its encoders (the icons come out of a dependency-free PNG writer).

   Two pages. Page 1 is the board itself — the same furniture and the same note
   positions, drawn as vectors, which is what the screenshot was standing in
   for. Page 2 is the text of the board, for search and for reading.

   Everything is drawn in ONE convention: origin top-left, y down, matching CSS
   and matching the stored coordinates. Each page opens with a y-flip so the
   numbers below transcribe straight out of styles.css. Text is the exception a
   flip creates — a mirrored CTM would mirror the glyphs — so every string sets
   its own `1 0 0 -1` text matrix, which cancels the flip and leaves the scale.
   ---------------------------------------------------------------------- */

const A4_W = 595.28, A4_H = 841.89;  // pt; the fit is one constant either way
const PDF_MARGIN = 36;
const PDF_ASC = 0.718, PDF_DESC = 0.207;   // Helvetica em box, for baselines

/* The export sheet is the 900x1000 REFERENCE frame, never the live
   LOGICAL_W/LOGICAL_H — those are viewport-derived (B20/B32), so exporting at
   them would make the same board a different document on every device. */
const EXPORT_W = 900, EXPORT_H = 1000;

/* The export's OWN named palette — paper-light, deliberately NOT derived from
   :root (UIUX §15, B48): the app is dark-only now, and a dark board prints as
   a slab of near-black that costs a cartridge to discover. The export is a
   reference sheet for paper, and paper is the ground it is designed against. */
const PDF_PAPER = [0.933, 0.922, 0.937];
const PDF_INK   = [0.133, 0.110, 0.141];
const PDF_SHADE = [0.514, 0.482, 0.533];
// The scratch-out at B53's 0.62 veil over paper; mixing it down beats carrying
// an ExtGState object just to say so. (The burial half of B53's pair has no
// print analogue: a completed item emits no text object at all — B34.)
const PDF_SCRATCH = PDF_INK.map((c, i) => c * 0.62 + PDF_PAPER[i] * 0.38);
// The highlight wash on paper (issue #105, B71): the screen's amber, toned down
// to a paper-light fill so a highlighted note prints as itself, not a slab of
// saturated ink — the same reasoning that keeps PDF_PAPER off :root.
const PDF_HILITE = [0.949, 0.847, 0.361];

/* Helvetica / Helvetica-Bold advance widths, WinAnsi 32..255, two base-36
   digits each. The PDF viewer sets in ITS Helvetica, not the browser's system
   font, so wrapping has to be measured against these and not against the DOM. */
const PDF_W_REG =
  '7q7q9vfgfgopij5b9999atg87q997q7qfgfgfgfgfgfgfgfgfgfg7q7qg8g8g8fgs7ijijk2k2ijgzlmk27qdwijfgn5k2lm' +
  'ijlmk2ijgzk2ijq8ijijgz7q7q7qd1fg99fgfgdwfgfg7qfgfg6666dw66n5fgfgfgfg99dw7qfgdwk2dwdwdw9a789ag800' +
  'fg0066fg99rsfgfg99rsij99rs00gz0000666699999qfgrs99rsdw99q800dwij7q99fgfgfgfg78fg99khaafgg899kh99' +
  'b4g8999999fgex7q9999a5fgn6n6n6gzijijijijijijrsk2ijijijij7q7q7q7qk2k2lmlmlmlmlmg8lmk2k2k2k2ijijgz' +
  'fgfgfgfgfgfgopdwfgfgfgfg7q7q7q7qfgfgfgfgfgfgfgg8gzfgfgfgfgdwfgdw';
const PDF_W_BOLD =
  '7q99d6fgfgopk26m9999atg87q997q7qfgfgfgfgfgfgfgfgfgfg9999g8g8g8gzr3k2k2k2k2ijgzlmk27qfgk2gzn5k2lm' +
  'ijlmk2ijgzk2ijq8ijijgz997q99g8fg99fggzfggzfg99gzgz7q7qfg7qopgzgzgzgzatfg99gzfglmfgfgdwat7satg800' +
  'fg007qfgdwrsfgfg99rsij99rs00gz00007q7qdwdw9qfgrs99rsfg99op00dwij7q99fgfgfgfg7sfg99khaafgg899kh99' +
  'b4g8999999gzfg7q9999a5fgn6n6n6gzk2k2k2k2k2k2rsk2ijijijij7q7q7q7qk2k2lmlmlmlmlmg8lmk2k2k2k2ijijgz' +
  'fgfgfgfgfgfgopfgfgfgfgfg7q7q7q7qgzgzgzgzgzgzgzg8gzgzgzgzgzfggzfg';

/* CP1252's own 0x80-0x9F block — the only codes whose Unicode is not their
   byte. The app's own copy lives here (’), so this is not a nicety. */
const PDF_CP1252 = {
  0x20AC: 128, 0x201A: 130, 0x0192: 131, 0x201E: 132, 0x2026: 133, 0x2020: 134,
  0x2021: 135, 0x02C6: 136, 0x2030: 137, 0x0160: 138, 0x2039: 139, 0x0152: 140,
  0x017D: 142, 0x2018: 145, 0x2019: 146, 0x201C: 147, 0x201D: 148, 0x2022: 149,
  0x2013: 150, 0x2014: 151, 0x02DC: 152, 0x2122: 153, 0x0161: 154, 0x203A: 155,
  0x0153: 156, 0x017E: 158, 0x0178: 159,
};

/* Unicode -> WinAnsi. A base-14 font cannot say CJK or emoji and embedding one
   that could would mean shipping a font file — the dependency this exporter
   exists to avoid. Those characters export as '?', and the substitution is
   reported rather than swallowed: §10's law is that truncation is always
   indicated, and a silently mangled line is truncation. See DECISIONS B34. */
function pdfCode(ch) {
  const u = ch.codePointAt(0);
  if (u === 9) return 32;                              // tab -> space
  if ((u >= 32 && u <= 126) || (u >= 160 && u <= 255)) return u;
  const m = PDF_CP1252[u];
  if (m !== undefined) return m;
  menuUiState.pdfLossy = true;
  return 63;
}
function pdfAdv(code, bold) {
  if (code < 32 || code > 255) return 0;
  const t = bold ? PDF_W_BOLD : PDF_W_REG, p = (code - 32) * 2;
  return parseInt(t.charAt(p) + t.charAt(p + 1), 36) || 0;
}
function pdfTextW(str, bold, size) {
  let u = 0;
  for (const ch of String(str)) u += pdfAdv(pdfCode(ch), bold);
  return u * size / 1000;
}

/* A PDF literal string. Escaping to octal above 126 keeps every byte we ever
   append <= 0x7F, which is what lets `String.length` stand in for byte length
   when the xref offsets are computed. */
function pdfStr(str) {
  let out = '(';
  for (const ch of String(str)) {
    const c = pdfCode(ch);
    if (c === 40 || c === 41 || c === 92) out += '\\' + String.fromCharCode(c);
    else if (c < 32 || c > 126) out += '\\' + ('00' + c.toString(8)).slice(-3);
    else out += String.fromCharCode(c);
  }
  return out + ')';
}

// Fixed-notation numbers: a PDF has no exponent syntax, and 1e-7 is a syntax
// error rather than a rounding difference.
function pdfNum(n) {
  if (!isFinite(n)) n = 0;
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

/* `white-space: pre-wrap` + `overflow-wrap: break-word`, measured in Helvetica.
   Hard breaks are honoured; a word wider than the box breaks mid-word rather
   than overflowing it, which is what keeps a note frame inside its edge cap
   (issue #53). */
function pdfWrap(str, bold, size, maxW) {
  const lines = [];
  if (!(maxW > 0)) return [String(str)];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (let word of para.split(' ')) {
      while (pdfTextW(word, bold, size) > maxW) {
        let cut = 1;
        while (cut < word.length && pdfTextW(word.slice(0, cut + 1), bold, size) <= maxW) cut++;
        if (line) { lines.push(line); line = ''; }
        lines.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      const trial = line ? line + ' ' + word : word;
      if (!line || pdfTextW(trial, bold, size) <= maxW) line = trial;
      else { lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}
// `width: max-content` — the widest hard line, i.e. what the box measures when
// nothing is allowed to soft-wrap. This is how a note frame shrink-wraps.
function pdfNaturalW(str, bold, size) {
  let w = 0;
  for (const para of String(str).split('\n')) w = Math.max(w, pdfTextW(para, bold, size));
  return w;
}
// Where a baseline sits inside a CSS line box of height `lh`.
function pdfBaseline(top, lh, size) {
  return top + (lh - size * (PDF_ASC + PDF_DESC)) / 2 + size * PDF_ASC;
}

/* ---- Content-stream builder --------------------------------------------
   Board coordinates in, operators out. Every method returns `p` so the
   drawing code below reads as a sequence rather than a pile of pushes. */
function pdfCanvas() {
  const ops = [];
  const p = {
    ops,
    raw(s) { ops.push(s); return p; },
    q() { return p.raw('q'); },
    Q() { return p.raw('Q'); },
    cm(a, b, c, d, e, f) {
      return p.raw([a, b, c, d, e, f].map(pdfNum).join(' ') + ' cm');
    },
    flip(h) { return p.cm(1, 0, 0, -1, 0, h); },       // top-left origin, y down
    fill(c) { return p.raw(c.map(pdfNum).join(' ') + ' rg'); },
    strokeColor(c) { return p.raw(c.map(pdfNum).join(' ') + ' RG'); },
    lineWidth(w) { return p.raw(pdfNum(w) + ' w'); },
    rect(x, y, w, h) {
      return p.raw([x, y, w, h].map(pdfNum).join(' ') + ' re');
    },
    line(x1, y1, x2, y2) {
      return p.raw(pdfNum(x1) + ' ' + pdfNum(y1) + ' m ' + pdfNum(x2) + ' ' + pdfNum(y2) + ' l');
    },
    // Rounded rect as a path; radius 2 everywhere, as everywhere in the CSS.
    rrect(x, y, w, h, r) {
      r = Math.max(0, Math.min(r, w / 2, h / 2));
      if (!r) return p.rect(x, y, w, h);
      const k = r * 0.5523, X = x + w, Y = y + h;
      const c = (x1, y1, x2, y2, x3, y3) =>
        p.raw([x1, y1, x2, y2, x3, y3].map(pdfNum).join(' ') + ' c');
      p.raw(pdfNum(x + r) + ' ' + pdfNum(y) + ' m');
      p.raw(pdfNum(X - r) + ' ' + pdfNum(y) + ' l');
      c(X - r + k, y, X, y + r - k, X, y + r);
      p.raw(pdfNum(X) + ' ' + pdfNum(Y - r) + ' l');
      c(X, Y - r + k, X - r + k, Y, X - r, Y);
      p.raw(pdfNum(x + r) + ' ' + pdfNum(Y) + ' l');
      c(x + r - k, Y, x, Y - r + k, x, Y - r);
      p.raw(pdfNum(x) + ' ' + pdfNum(y + r) + ' l');
      c(x, y + r - k, x + r - k, y, x + r, y);
      return p.raw('h');
    },
    clip() { return p.raw('W n'); },
    // A CSS border is drawn inside the box; a PDF stroke straddles the path.
    // Inset by half the width so a 2px frame lands where the browser puts it.
    frame(x, y, w, h, r, bw, bg) {
      if (bg) { p.fill(bg); p.rrect(x, y, w, h, r); p.raw('f'); }
      p.strokeColor(PDF_INK).lineWidth(bw);
      p.rrect(x + bw / 2, y + bw / 2, w - bw, h - bw, Math.max(0, r - bw / 2));
      return p.raw('S');
    },
    // The title compartment (B38, issue #52): the sheet's own top edge is its
    // fourth side, so only three are drawn — down the left, across the bottom,
    // back up the right, one path, inset by half the border width same as
    // `frame`. No radius: at the export's 0.581 A4 scale the 2px CSS corner is
    // ~1pt, and a three-segment path is honest about which sides exist.
    frameOpenTop(x, y, w, h, bw, bg) {
      if (bg) { p.fill(bg); p.rect(x, y, w, h); p.raw('f'); }
      p.strokeColor(PDF_INK).lineWidth(bw);
      const lx = x + bw / 2, rx = x + w - bw / 2, by = y + h - bw / 2;
      p.raw(pdfNum(lx) + ' ' + pdfNum(y) + ' m');
      p.raw(pdfNum(lx) + ' ' + pdfNum(by) + ' l');
      p.raw(pdfNum(rx) + ' ' + pdfNum(by) + ' l');
      p.raw(pdfNum(rx) + ' ' + pdfNum(y) + ' l');
      return p.raw('S');
    },
    /* One line of text on a baseline. The text matrix cancels the page flip;
       without it every glyph would render upside down. */
    text(str, x, baseline, size, bold, color) {
      if (!String(str).length) return p;
      p.fill(color || PDF_INK);
      p.raw('BT');
      p.raw('/' + (bold ? 'F2' : 'F1') + ' ' + pdfNum(size) + ' Tf');
      p.raw('1 0 0 -1 ' + pdfNum(x) + ' ' + pdfNum(baseline) + ' Tm');
      p.raw(pdfStr(str) + ' Tj');
      return p.raw('ET');
    },
    // align: 'left' | 'center' | 'right', measured in the box's own width.
    lines(arr, x, w, top, size, lh, bold, align, color) {
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i];
        if (!s.length) continue;
        let tx = x;
        // Centring measures the line sans trailing spaces: pre-wrap hangs
        // them on screen, so counting them would shift the export (B62).
        if (align === 'center') tx = x + (w - pdfTextW(s.replace(/ +$/, ''), bold, size)) / 2;
        else if (align === 'right') tx = x + w - pdfTextW(s, bold, size);
        p.text(s, tx, pdfBaseline(top + i * lh, lh, size), size, bold, color);
      }
      return p;
    },
    /* The scratch-out: the three repeating-linear-gradients of styles.css §4.3
       as three families of ruled lines. Clip first — this fills whatever the
       current clip allows. Angles are CSS's, and in a y-down space a positive
       angle rotates clockwise on screen, same as CSS reads them. */
    scratch(w, h) {
      const bands = [[8, 5, 8], [-14, 4, 7], [79, 3, 5]];
      const R = Math.hypot(w, h) / 2 + 4;
      p.strokeColor(PDF_SCRATCH);
      for (const [deg, thick, period] of bands) {
        const a = deg * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
        p.q().cm(cos, sin, -sin, cos, w / 2, h / 2).lineWidth(thick);
        for (let y = -R; y <= R; y += period) p.line(-R, y + thick / 2, R, y + thick / 2);
        p.raw('S').Q();
      }
      return p;
    },
    stream() { return ops.join('\n'); },
  };
  return p;
}

/* ---- Document assembly --------------------------------------------------
   Object numbers are fixed rather than allocated: catalog 1, pages 2, the two
   fonts 3 and 4, then page/content pairs from 5. Offsets are counted off the
   string as it grows, which is only sound because every byte appended is
   ASCII — pdfStr guarantees it for the one place user text gets in. */
function pdfAssemble(streams, title) {
  const n = streams.length;
  const kids = [];
  for (let i = 0; i < n; i++) kids.push((5 + i * 2) + ' 0 R');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count ' + n + ' /Kids [' + kids.join(' ') + '] >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  for (let i = 0; i < n; i++) {
    objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pdfNum(A4_W) + ' ' + pdfNum(A4_H) + ']' +
              ' /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >>' +
              ' /Contents ' + (6 + i * 2) + ' 0 R >>');
    objs.push('<< /Length ' + streams[i].length + ' >>\nstream\n' + streams[i] + '\nendstream');
  }
  // No dates in /Info: without them the same unchanged board exports to
  // byte-identical files, which is both a nice property and a cheap test.
  const infoNo = objs.length + 1;
  objs.push('<< /Title ' + pdfStr(title) + ' /Producer ' + pdfStr('To-Do Boards') + ' >>');

  let out = '%PDF-1.4\n';
  const offsets = [];
  for (let i = 0; i < objs.length; i++) {
    offsets.push(out.length);
    out += (i + 1) + ' 0 obj\n' + objs[i] + '\nendobj\n';
  }
  const startxref = out.length;
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
  for (const off of offsets) out += ('0000000000' + off).slice(-10) + ' 00000 n \n';
  out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info ' + infoNo + ' 0 R >>\n' +
         'startxref\n' + startxref + '\n%%EOF\n';

  // The offsets above are string indices. They are byte offsets only because
  // every byte we append is 7-bit — pdfStr octal-escapes the one path user text
  // takes in. Assert it rather than trust it: a stray non-ASCII character
  // shifts every entry and presents as "damaged file", which is a wretched bug
  // to find later.
  if (/[^\x00-\x7F]/.test(out)) throw new Error('pdf: non-ascii byte in stream');
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xFF;
  return bytes;
}

/* ---- Page 1: the board ---------------------------------------------------
   Geometry is styles.css read against the 900x1000 sheet: the 2.6667% gutter
   is 24, the card is 280..620 (37.7778%, B35), so the Components zone ends at
   272 and Requirements starts at 628 — the card's edges ±the 8px gap. Draw
   order is the stacking order — the card must cover the band rule (B33), and
   notes sit above every piece of furniture. */
const EXPORT_GEO = {
  gutter: 24,
  // B47's band formula, the same law the screen derives --rule-y from (the
  // shared bandRuleYFor, with B76's label moved below the rule so it no
  // longer budgets above it), resolved per record in exportRuleY() against
  // THIS sheet's zone widths. bandTop/bandGap stay literal here: the [11c]
  // tripwire recomputes the formula from EXPORT_GEO's own source terms, so
  // they are part of the test contract — they MUST equal BAND_TOP/BAND_GAP.
  bandTop: 14, bandGap: 8,
  compL: 24, compR: 272, reqL: 628, reqR: 876,
  // The compartment starts at the sheet's own top edge (B38, kept by B47) and
  // overhangs the rule by 22; cardPadTop is its top padding (band-top + 6).
  cardL: 280, cardW: 340, cardTop: 0, cardOverhang: 22, cardPad: 12, cardPadTop: 20,
  // Both sections size to their MEASURED content from a floor (UIUX
  // §3.1/§3.2, B73); the lot's ceiling is half the sheet, applied in
  // exportLotH — one law with the screen, the export's own number (B34).
  // lotHead/lotRow ARE the screen's LOT_HEAD/LOT_ROW — shared constants.
  lotHead: LOT_HEAD, lotRow: LOT_ROW, lotHeaderY: 8, lotItemsY: 34,
  headSize: 15, headLH: 19.5,          // title, anchor text, lot header
  labelSize: 13, labelLH: 16.9,        // the band's nomenclature (13 x 1.3, B54)
  labelPadX: 6, labelPadY: 2,          // the tab that frames it below the rule (B76)
  lotSize: 16, lotLH: 23.2,            // 16px / 1.45
  noteSize: 17, noteLH: 23.8,          // 17px / 1.4
  border: 2, radius: 3, notePadX: 12, notePadY: 10,   // radius mirrors B49 by hand
  linkWidth: 1.5,                      // the note-link hairline (issue #142, B91)
};

  // The band sizes to its tallest zone (B47), on the export's own frame: line
  // counts come from pdfWrap against the 248-unit zones — the same law as the
  // screen, not the same number, because the export is its own sheet (B34).
  // The rule-y formula itself is the shared bandRuleYFor (B47/B76).
function exportRuleY(rec) {
  const g = EXPORT_GEO;
  let lines = 2;
  for (const z of [{ text: rec.components, w: g.compR - g.compL },
                   { text: rec.requirements, w: g.reqR - g.reqL }]) {
    if (z.text) lines = Math.max(lines, pdfWrap(z.text, true, g.headSize, z.w).length);
  }
  return bandRuleYFor(lines);
}
const exportLotH = (rec) => {
  const g = EXPORT_GEO;
  // Sum the same wrapped row heights the draw loop uses, from the two-row
  // floor, capped at half the sheet (B73) — the screen's law on the export's
  // own frame (B34). The draw loop still clips the excess past the cap.
  let sum = 0;
  for (const item of rec.parkingLot || []) {
    const lines = pdfWrap(item.text, false, g.lotSize, EXPORT_W - 2 * g.gutter);
    sum += Math.max(g.lotRow, lines.length * g.lotLH + 4);
  }
  return Math.min(g.lotHead + Math.max(2 * g.lotRow, sum),
                  Math.round(EXPORT_H * LOT_MAX_FRAC));
};

// The similarity transform (B64), resolved against the export sheet instead
// of the viewport — exportK is the shared noteKFor with EXPORT_W/EXPORT_H
// standing in for the frame. One LAW shared with the screen, not one number:
// each frame takes its own min, so notes of one authoring cohort keep their
// figure exactly, while a mixed-cohort board can relate its cohorts
// differently here than on a given screen — inherent to min-k and owned in
// B64's costs. Stored x/y are read only — B21's "committed positions are
// permanent" is not ours to break. Legacy notes never reach here: B93's boot
// migration adopted every rh-less note onto the single min-k path before
// first paint, so the export reads the same unified geometry the screen
// renders (issue #141).
const exportK = (n) => noteKFor(n, EXPORT_W, EXPORT_H);
const exportX = (n) => n.x * exportK(n);
const exportY = (n) => n.y * exportK(n);

// Border box of a note, before its own scale — `width: max-content` capped at
// the export sheet's right edge, height from however many lines that width
// produces. The cap IS noteMaxW (issue #53, B39; B64): since the law became
// pure authored units — (rw − x)/scale, no frame constant left in it — the
// export calls the screen's own function rather than restating it, so the
// two wrap widths cannot drift apart by construction.
function exportNoteBox(note) {
  const g = EXPORT_GEO;
  const chrome = 2 * g.notePadX + 2 * g.border;
  const cap = noteMaxW(note);
  const maxContent = cap - chrome;
  // Floor the content box at the NOTE_MIN_W minimum the screen draws (B84), so a
  // short note exports the same width it renders — B34's on-screen fidelity. The
  // floor is ≤ maxContent because cap ≥ NOTE_MIN_W, and the text centres in the
  // wider box exactly as it does on screen (B62).
  const content = Math.max(NOTE_MIN_W - chrome,
    Math.min(pdfNaturalW(note.text, false, g.noteSize), maxContent));
  const lines = pdfWrap(note.text, false, g.noteSize, content);
  return {
    w: content + chrome,
    h: lines.length * g.noteLH + 2 * g.notePadY + 2 * g.border,
    content, lines,
  };
}

function exportBoardPage(rec) {
  const g = EXPORT_GEO;
  const scale = Math.min((A4_W - 2 * PDF_MARGIN) / EXPORT_W, (A4_H - 2 * PDF_MARGIN) / EXPORT_H);
  const mx = (A4_W - EXPORT_W * scale) / 2;
  const my = (A4_H - EXPORT_H * scale) / 2;   // centred: the sheet is squarer than A4
  const p = pdfCanvas();
  p.q().flip(A4_H);
  // Paper edge to edge, not a paper rectangle floating on white. Paper tone is
  // named in styles.css §1 as part of the identity, alongside the frame and the
  // scratch-out, and the margin is margin — not a desk. B17 and B32 spent two
  // rulings deleting the letterbox; this is not the place to reintroduce it.
  p.fill(PDF_PAPER).rect(0, 0, A4_W, A4_H).raw('f');
  p.cm(scale, 0, 0, scale, mx, my);
  p.fill(PDF_PAPER).rect(0, 0, EXPORT_W, EXPORT_H).raw('f');   // the sheet itself

  // The band reads content, then the rule as the band's bottom edge — full
  // width (B47) — with each header hanging just below the rule as a tab in the
  // rule's own ink (B76). The card draws last, on top of the rule.
  const ruleY = exportRuleY(rec);
  const zones = [
    { text: rec.components, label: 'Components', l: g.compL, r: g.compR },
    { text: rec.requirements, label: 'Requirements', l: g.reqL, r: g.reqR },
  ];
  for (const z of zones) {
    const w = z.r - z.l;
    if (z.text) {
      // Content hangs from the band's top (B47). Not clipped to the zone: on
      // screen the zone sets no overflow, so a long entry flows down over the
      // canvas, and the export draws what the screen draws (B34).
      p.lines(pdfWrap(z.text, true, g.headSize, w), z.l, w, g.bandTop,
              g.headSize, g.headLH, true, 'left');
    }
    // The header hangs below the rule as a tight tab in the rule's own ink
    // (B76): a filled PDF_INK box, top edge on the rule, centred in its zone.
    // The rule is dark here (unlike the mid-light --frame on screen), so the
    // label reverses to the paper tone rather than screen's --ink-dark.
    const labelW = pdfTextW(z.label, true, g.labelSize) + 2 * g.labelPadX;
    const boxX = z.l + (w - labelW) / 2;
    p.fill(PDF_INK).rect(boxX, ruleY, labelW, g.labelLH + 2 * g.labelPadY).raw('f');
    p.lines([z.label], boxX, labelW, ruleY + g.labelPadY,
            g.labelSize, g.labelLH, true, 'center', PDF_PAPER);
  }
  p.fill(PDF_INK).rect(0, ruleY, EXPORT_W, 1).raw('f');

  const title = rec.title || '';
  const cardContentW = g.cardW - 2 * g.cardPad - 2 * g.border;
  const titleLines = title ? pdfWrap(title, true, g.headSize, cardContentW) : [];
  // One border now, not two — the compartment's border-top is no longer drawn
  // (B38, issue #52). It overhangs the band's rule by 22 and occludes it (B47).
  const cardH = Math.max(ruleY + g.cardOverhang,
                         titleLines.length * g.headLH + g.cardPadTop + g.cardPad + g.border);
  p.frameOpenTop(g.cardL, g.cardTop, g.cardW, cardH, g.border, PDF_PAPER);
  if (titleLines.length) {
    // justify-content: center — the block is centred in the space between the
    // top padding and the bottom padding + border, then each line is centred
    // in the block.
    const blockH = titleLines.length * g.headLH;
    const top = g.cardPadTop + (cardH - g.cardPadTop - g.cardPad - g.border - blockH) / 2;
    p.lines(titleLines, g.cardL + g.border + g.cardPad, cardContentW, top,
            g.headSize, g.headLH, true, 'center');
  }

  // Parking Lot: full-bleed to the sheet's bottom with its content on the
  // gutter (UIUX §3.2), sized by its rows from the two-row floor. #lot-items
  // is overflow:hidden, so the export clips too — otherwise a long lot walks
  // off the bottom of the page.
  const lotH = exportLotH(rec);
  const lotTop = EXPORT_H - lotH;
  const lotW = EXPORT_W - 2 * g.gutter;
  p.fill(PDF_INK).rect(0, lotTop, EXPORT_W, 1).raw('f');       // full width (B47)
  p.lines(['Parking Lot'], g.gutter, lotW, lotTop + g.lotHeaderY,
          g.headSize, g.headLH, true, 'left');
  const itemsTop = lotTop + g.lotItemsY;
  const itemsH = lotH - g.lotItemsY;
  p.q().rect(g.gutter, itemsTop, lotW, itemsH).clip();
  let ly = itemsTop;
  for (const item of rec.parkingLot || []) {
    if (ly >= itemsTop + itemsH) break;
    const lines = pdfWrap(item.text, false, g.lotSize, lotW);
    const rowH = Math.max(g.lotRow, lines.length * g.lotLH + 4);
    if (item.state === 'complete') {
      // Hatching only. The words are not in the file at all, which is a
      // stronger promise than the screen's "no screenshot recovers it".
      p.q().rect(g.gutter, ly, lotW, rowH).clip()
        .cm(1, 0, 0, 1, g.gutter, ly).scratch(lotW, rowH).Q();
    } else {
      const top = ly + (rowH - lines.length * g.lotLH) / 2;
      p.lines(lines, g.gutter, lotW, top, g.lotSize, g.lotLH, false, 'left');
    }
    ly += rowH;
  }
  p.Q();

  // Links UNDER the notes (issue #142, B91): a thin line between two note centres,
  // drawn in sheet space (not the per-note transform), so it sits below the cards
  // it joins — the same z-order as the screen (the link layer is below notes). A
  // neutral hairline suits the export's paper/ink/shade palette better than a
  // board-hue line; a dangling link (endpoint gone) is skipped, as on screen.
  const noteCentre = (n) => {
    const box = exportNoteBox(n), s = (n.scale || 1) * exportK(n);
    return { x: exportX(n) + box.w * s / 2, y: exportY(n) + box.h * s / 2 };
  };
  for (const link of rec.links || []) {
    const na = (rec.notes || []).find(n => n.id === link.a);
    const nb = (rec.notes || []).find(n => n.id === link.b);
    if (!na || !nb) continue;
    const a = noteCentre(na), b = noteCentre(nb);
    p.q().strokeColor(PDF_SHADE).lineWidth(g.linkWidth).line(a.x, a.y, b.x, b.y).raw('S').Q();
  }

  // Notes last: array order is z-order, and DOM order mirrors it.
  for (const note of rec.notes || []) {
    const box = exportNoteBox(note);
    const s = (note.scale || 1) * exportK(note);      // the similarity (B64)
    // transform-origin: top left — translate to the note, then scale in place.
    p.q().cm(s, 0, 0, s, exportX(note), exportY(note));
    // A highlighted note fills amber, matching the screen; a completed one still
    // fills first, then the scratch draws over it (issue #105, B71).
    p.frame(0, 0, box.w, box.h, g.radius, g.border, note.highlighted ? PDF_HILITE : PDF_PAPER);
    if (note.state === 'complete') {
      p.q().rrect(0, 0, box.w, box.h, g.radius).clip().scratch(box.w, box.h).Q();
    } else {
      // Centred in the content box, as the screen draws it (issue #82, B62).
      p.lines(box.lines, g.border + g.notePadX, box.content, g.border + g.notePadY,
              g.noteSize, g.noteLH, false, 'center');
    }
    p.Q();
  }

  return p.Q().stream();
}

/* ---- Page 2+: the text ---------------------------------------------------
   The board again, as prose — so the file is searchable and readable at a
   glance. Completed items keep their place in the order but not their words. */
function exportTextPages(rec) {
  const L = PDF_MARGIN, R = A4_W - PDF_MARGIN, W = R - L;
  const BOTTOM = A4_H - PDF_MARGIN;
  const streams = [];
  let p = null, y = 0;

  const openPage = () => {
    p = pdfCanvas();
    p.q().flip(A4_H);
    p.fill(PDF_PAPER).rect(0, 0, A4_W, A4_H).raw('f');   // same paper as page 1
    y = PDF_MARGIN;
  };
  const closePage = () => { if (p) { streams.push(p.Q().stream()); p = null; } };
  const room = (h) => { if (y + h > BOTTOM) { closePage(); openPage(); } };

  const para = (str, size, lh, bold, color, indent) => {
    const x = L + (indent || 0);
    const w = W - (indent || 0);
    for (const line of pdfWrap(str, bold, size, w)) {
      room(lh);
      if (line.length) p.text(line, x, pdfBaseline(y, lh, size), size, bold, color);
      y += lh;
    }
  };
  const heading = (str) => {
    room(30);
    y += 12;
    para(str, 11, 15, true, PDF_INK);
    p.fill(PDF_SHADE).rect(L, y + 1, W, 0.5).raw('f');
    y += 6;
  };

  openPage();
  para(rec.title || COPY.untitled, 18, 24, true, PDF_INK);
  para(formatDate(rec.createdAt), 9, 13, false, PDF_SHADE);

  if (rec.components) { heading('COMPONENTS'); para(rec.components, 10, 14, false, PDF_INK); }
  if (rec.requirements) { heading('REQUIREMENTS'); para(rec.requirements, 10, 14, false, PDF_INK); }

  const bullets = (label, items) => {
    if (!items.length) return;
    heading(label);
    for (const it of items) {
      // A completed item keeps its place in the order but not its words —
      // the same promise the scratch-out makes on page 1.
      const done = it.state === 'complete';
      const color = done ? PDF_SHADE : PDF_INK;
      const lines = pdfWrap(done ? '— completed —' : it.text, false, 10, W - 14);
      room(14);                                  // keep the bullet with its first line
      p.text('•', L, pdfBaseline(y, 14, 10), 10, false, color);
      for (const line of lines) {
        room(14);
        if (line.length) p.text(line, L + 14, pdfBaseline(y, 14, 10), 10, false, color);
        y += 14;
      }
    }
  };
  bullets('NOTES', rec.notes || []);
  bullets('PARKING LOT', rec.parkingLot || []);

  closePage();
  return streams;
}

function buildBoardPdf(rec) {
  return pdfAssemble([exportBoardPage(rec)].concat(exportTextPages(rec)),
                     rec.title || COPY.untitled);
}

/* ---- The calendar's 7-day reference sheet (issue #145, R1's Export) ------
   One text page: the rolling week as it renders — today first, one line per
   event, completed events reading "— completed —" (§7's bytes property).
   Built from the same primitives as exportTextPages; reads STORAGE (the
   computed window, live events), never the squeezed frame (R6 clause 2). */
async function exportCalPdf() {
  try {
    flushSave();
    const all = await idbGetAll();
    const events = eventsOf(all);
    const L = PDF_MARGIN, R = A4_W - PDF_MARGIN, W = R - L;
    const stream = (() => {
      const p = pdfCanvas();
      p.q().flip(A4_H);
      p.fill(PDF_PAPER).rect(0, 0, A4_W, A4_H).raw('f');
      let y = PDF_MARGIN;
      const room = (h) => { if (y + h > A4_H - PDF_MARGIN) throw new Error('cal-pdf-overflow'); };
      const para = (str, size, lh, bold, color) => {
        for (const line of pdfWrap(str, bold, size, W)) {
          room(lh);
          if (line.length) p.text(line, L, pdfBaseline(y, lh, size), size, bold, color);
          y += lh;
        }
      };
      para(COPY.calTitle, 18, 24, true, PDF_INK);
      para(formatDate(Date.now()), 9, 13, false, PDF_SHADE);
      y += 6;
      for (const day of calWindow()) {
        room(30); y += 12;
        para((day.today ? COPY.calToday + ' — ' : '') +
          day.date.toLocaleDateString(undefined, { weekday: 'long' }) + ' ' + calMD(day.date),
          11, 15, true, PDF_INK);
        p.fill(PDF_SHADE).rect(L, y + 1, W, 0.5).raw('f');
        y += 6;
        const evs = calEventsOf(events, day.key);
        if (!evs.length) continue;
        for (const ev of evs) {
          const done = ev.state === 'complete';
          const color = done ? PDF_SHADE : PDF_INK;
          for (const line of pdfWrap(done ? '— completed —' : ev.text, false, 10, W - 14)) {
            room(14);
            if (line.length) p.text(line, L + 14, pdfBaseline(y, 14, 10), 10, false, color);
            y += 14;
          }
        }
      }
      return p.Q().stream();
    })();
    const bytes = pdfAssemble([stream], COPY.calTitle);
    const d = new Date();
    const pad = (n) => (n < 10 ? '0' : '') + n;
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }),
      'calendar-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '.pdf');
  } catch (e) {
    showNotice(COPY.exportError, 'export', UNDO_MS);
  }
}

/* ---- The menu action ---------------------------------------------------- */

// A filename someone can find later: the board's own words, then the day it
// started. An untitled board has no words, so the date carries it alone.
function pdfFilename(rec) {
  const slug = String(rec.title || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
    .replace(/-+$/, '');
  const d = new Date(rec.createdAt || Date.now());
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const stamp = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  return (slug || 'board') + '-' + stamp + '.pdf';
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Long enough for every engine to have started the write before the URL goes.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/* Export runs off the board RECORD, not the live DOM: the menu belongs to a
   board card, and the card is usually not the board that happens to be open.

   Which copy of the record, though. renderPane/renderList close over an
   idbGetAll() snapshot taken when the rail was drawn, so right-clicking the
   ACTIVE card after typing would export the board as it was some keystrokes
   ago. `current` is the one that is ahead of storage (saves are debounced by
   SAVE_DEBOUNCE), so it wins for the open board; every other card reads back
   from IndexedDB in case its snapshot has aged. */
async function exportBoardPdf(board) {
  try {
    const src = (current && current.id === board.id)
      ? current : ((await idbGet(board.id)) || board);
    // B8/B31's sweep on a COPY. Records reach the menu straight from
    // idbGetAll(), so they have never been through renderBoard's sanitize, and
    // a whitespace husk would export as an empty framed box. Copying rather
    // than filtering in place matters: `src` may be `current`, and mutating
    // live state from an export is exactly the silent write B21 forbids.
    const keep = (r) => (r.text || '').trim().length > 0;
    const rec = {
      title: src.title, requirements: src.requirements, components: src.components,
      createdAt: src.createdAt || board.createdAt,
      notes: (src.notes || []).filter(keep),
      parkingLot: (src.parkingLot || []).filter(keep),
    };
    menuUiState.pdfLossy = false;
    const bytes = buildBoardPdf(rec);
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), pdfFilename(rec));
    if (menuUiState.pdfLossy) showNotice(COPY.exportLossy, 'export', UNDO_MS);
  } catch (e) {
    showNotice(COPY.exportError, 'export', UNDO_MS);
  }
}

/* --- 10.6 JSON backup: export all, import merged (issue #140, B92) -------- */

/* The whole library leaves as one file. PDF is a sheet ABOUT a board; JSON is
   the board itself, so this is full fidelity: links (B91) ride along, nothing
   is projected onto paper, nothing is swept. flushSave() first — saves are
   debounced by SAVE_DEBOUNCE, so idbGetAll() alone could read the open board
   some keystrokes stale (the same staleness exportBoardPdf's `current` rule
   answers, one board wide). The stamp lands only if an edit is pending, so
   exporting does not reorder the list (B69's law, flushSave's own reading). */
async function exportAllJson() {
  try {
    flushSave();
    const boards = await idbGetAll();
    const payload = {
      app: 'the-boards',
      version: 1,
      exportedAt: new Date().toISOString(),
      boards,
    };
    const d = new Date();
    const pad = (n) => (n < 10 ? '0' : '') + n;
    const stamp = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    downloadBlob(new Blob([JSON.stringify(payload)], { type: 'application/json' }),
      'boards-backup-' + stamp + '.json');
  } catch (e) {
    showNotice(COPY.exportError, 'export', UNDO_MS);
  }
}

/* What a backup file may name as a board category. Anything else reads as the
   read-site default (B21/B67: 'unsorted') — a file from a future version with
   a fifth category must still import, landing where the list already files
   unknown cats, rather than being rejected wholesale. */
const IMPORT_CATS = new Set(['todo', 'idea', 'unsorted', 'learning']);

/* One imported board, normalized to this app's record shape. Every field is
   coerced, not trusted: a backup is data that has been OUT of the device, and
   the import must not hand a hostile or hand-edited file a live record. ids
   are re-stamped when absent or not strings, notes/lots/links are rebuilt
   field-by-field, and whitespace husks are swept HERE (the B8/B31 choke that
   renderBoard would otherwise apply on first sight — swept at the door, they
   never enter storage at all). Returns null for a board with no surviving
   content — an empty shell has nothing to restore. */
function normalizeImportedBoard(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const now = Date.now();
  const text = (v) => (typeof v === 'string' ? v : '');
  const keep = (r) => r.text.trim().length > 0;
  const notes = (Array.isArray(raw.notes) ? raw.notes : [])
    .map((n) => (n && typeof n === 'object') ? {
      id: typeof n.id === 'string' && n.id ? n.id : uuid(),
      text: text(n.text).trimEnd(),
      x: Number.isFinite(n.x) ? n.x : 0,
      y: Number.isFinite(n.y) ? n.y : 0,
      rw: Number.isFinite(n.rw) ? n.rw : viewState.LOGICAL_W,
      rh: Number.isFinite(n.rh) ? n.rh : viewState.LOGICAL_H,
      scale: Number.isFinite(n.scale) && n.scale > 0 ? n.scale : 1.0,
      state: n.state === 'complete' ? 'complete' : 'active',
      highlighted: n.highlighted === true,
    } : null)
    .filter((n) => n && keep(n));
  const parkingLot = (Array.isArray(raw.parkingLot) ? raw.parkingLot : [])
    .map((r) => (r && typeof r === 'object') ? {
      id: typeof r.id === 'string' && r.id ? r.id : uuid(),
      text: text(r.text).trimEnd(),
      state: r.state === 'complete' ? 'complete' : 'active',
    } : null)
    .filter((r) => r && keep(r));
  if (!notes.length && !parkingLot.length &&
      !text(raw.title).trim() && !text(raw.requirements).trim() && !text(raw.components).trim()) {
    return null;                       // nothing survived; nothing to restore
  }
  const noteIds = new Set(notes.map((n) => n.id));
  const links = (Array.isArray(raw.links) ? raw.links : [])
    .filter((l) => l && typeof l === 'object' &&
      typeof l.a === 'string' && typeof l.b === 'string' &&
      noteIds.has(l.a) && noteIds.has(l.b) && l.a !== l.b)
    .map((l) => ({ id: typeof l.id === 'string' && l.id ? l.id : uuid(), a: l.a, b: l.b }));
  const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : now;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uuid(),
    createdAt,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : createdAt,
    category: IMPORT_CATS.has(raw.category) ? raw.category : 'unsorted',
    title: text(raw.title),
    requirements: text(raw.requirements),
    components: text(raw.components),
    notes,
    parkingLot,
    links,
    // The calendar link (issue #145): coerced like every other field. cal must
    // be a YYYY-MM-DD key or the link is dropped; calReq rides only when finite.
    // An OLD build importing a NEW backup keeps these extra fields verbatim in
    // the payload object — read-site defaulting means it simply ignores them,
    // and a re-export carries them on (PRD §4.1's idiom, both directions).
    cal: /^\d{4}-\d{2}-\d{2}$/.test(raw.cal) ? raw.cal : undefined,
    calReq: Number.isFinite(raw.calReq) ? raw.calReq : undefined,
  };
}

/* Merge-import (the owner's ruling, issue #140): a board whose id already
   exists is OVERWRITTEN by the file's copy; new ids are ADDED. A backup-
   restore in miniature — the file's board is the truth for that id, the
   device keeps every board the file never mentions. Everything lands in
   storage first; only then does the visible surface re-read. If the open
   board was overwritten, renderBoard draws the file's copy; if it was not
   touched, current is still authoritative and nothing about it changes. */
async function importBoardsJson(file) {
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch (e) {
    showNotice(COPY.importError, 'import', UNDO_MS);
    return;
  }
  if (!payload || typeof payload !== 'object' || payload.app !== 'the-boards' ||
      !Array.isArray(payload.boards)) {
    showNotice(COPY.importError, 'import', UNDO_MS);
    return;
  }
  const incoming = payload.boards
    .map(normalizeImportedBoard)
    .filter(Boolean);
  if (!incoming.length) {
    showNotice(COPY.importError, 'import', UNDO_MS);
    return;
  }
  flushSave();                          // the debounce must not write over the import
  let overwrittenCurrent = false;
  for (const rec of incoming) {
    await idbPut(rec);
    if (current && rec.id === current.id) {
      current = rec;                    // the open board's new self is the file's copy
      overwrittenCurrent = true;
    }
  }
  if (overwrittenCurrent) {
    dirty = false;                      // current was replaced wholesale, exactly ensureCurrentValid's reading
    renderBoard();
  }
  if (menuUiState.listOpen) await renderListSurface();
  else if (viewState.isWide) renderPane();     // the rail re-reads; the sheet is already right
  showNotice(COPY.imported, 'import', UNDO_MS);
}

/* --- 11. Board list + routing -------------------------------------------- */
/* Two-level navigation since issue #112 / B74. `listOpen` is true for either
   level; `catView` names the drilled category (level 2) or is null at the
   picker (level 1); `lotMenuOpen` is true only on mobile, where the level-1
   picker is the Parking Lot turned into the grid rather than a screen of its
   own. History carries {v:'list'} for the picker and {v:'cat',cat} for a drill,
   so the OS back gesture returns drill -> picker -> board (B9, never shadowed). */

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
const BOARD_CATS = ['todo', 'unsorted', 'learning', 'idea'];
const CAT_COPY = { todo: 'catTodo', idea: 'catIdea', unsorted: 'catUnsorted', learning: 'catLearning' };
const catOf = (b) =>
  (b.category === 'todo' || b.category === 'idea' || b.category === 'learning')
    ? b.category : 'unsorted';
/* The mobile All-Boards grid is a 2x2 whose clockwise reading from the top-left
   must be To Do, Notes, Learning, Ideas (issue #112). A row-major 2-col grid
   fills TL, TR, BL, BR — so clockwise is TL, TR, BR, BL, and the DOM order that
   lands Learning at BR and Ideas at BL is [todo, unsorted, idea, learning].
   The stacked order (BOARD_CATS) and this grid order genuinely differ: a column
   reads top-to-bottom, a 2x2 reads clockwise. */
const GRID_ORDER = ['todo', 'unsorted', 'idea', 'learning'];
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
const catOrder = (a, b) => (touchedAt(b) - touchedAt(a)) || boardOrder(a, b);

/* Pagination (issue #58): overflow turns pages, never scrolls. Page state is
   per-category and module-level so a re-render keeps the reader's place, and
   it is shared by the rail and the list because the two are never on screen at
   once (applyMode pops the list state on the flip to desktop) — each renderer
   clamps every render, so a differing capacity heals itself. catCap is the
   budget the last render used, and catFilled the fill state it measured
   against — applyLayout compares both. */

/* The per-page card budget, measured — never a constant (B42, restated B68).
   `filled` is how many of the drawn sections hold at least one board: an empty
   section collapses to its head row alone (B68), so the cards and pager slots
   it is not using come back to the sections that have something to show.
   `drawn` is how many sections are on the surface — BOARD_CATS.length for the
   desktop rail (all four stacked), 1 for a single-category drill screen (issue
   #112 / B74): the drill shows one category alone, so it must not subtract the
   furniture of three sections that are not there. */
function catPageCap(filled, drawn) {
  const host = viewState.isDesktop ? el.paneCards : el.listRows;
  if (!host) return 1;
  const total = drawn || BOARD_CATS.length;
  const head = viewState.isDesktop ? PANE_CAT_HEAD : LIST_CAT_ROW;
  const pager = viewState.isDesktop ? PANE_PAGER_H : LIST_CAT_ROW;
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
  // The mobile list card is taller than the rail's (B82: two title lines + the
  // Last Updated line), so each surface budgets against its own row height.
  const rowH = viewState.isDesktop ? PANE_ROW_H : LIST_CARD_H;
  const rows = Math.max(1, Math.floor((avail / n - head - pager) / (rowH + PANE_ROW_GAP)));
  return rows * (viewState.isDesktop ? 1 : LIST_CARD_COLS);
}

/* One section, both surfaces: head, add, cards, pager — the same four children
   everywhere, so the two skins are a CSS grid decision and not a second DOM
   shape. `makeCard` is what differs (a rail card or a list row). */
function makeCatSection(cat, boards, cap, makeCard) {
  const pages = Math.max(1, Math.ceil(boards.length / cap));
  menuUiState.catPage[cat] = Math.max(0, Math.min(menuUiState.catPage[cat], pages - 1));
  const page = menuUiState.catPage[cat];

  const sec = document.createElement('div');
  sec.className = 'board-cat'; sec.dataset.cat = cat;
  // A section with nothing in it collapses to its head row (B68, superseding
  // B44's two empty thirds): the label and its own New board control stay —
  // it is still a place to create in, and that row is still the .board-cat
  // rect the drop hit-test finds — and only the cards and pager slots go back
  // to the populated sections.
  if (!boards.length) sec.classList.add('empty');
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
  pager.className = 'cat-pager'; pager.hidden = pages === 1;
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
  menuUiState.catPage[cat] = p;
  // Page the surface that is actually showing this category: the drilled screen
  // (#list-rows, either platform) when the list overlay is open, else the
  // desktop rail (#pane-cards). Paging the hidden rail behind an open drill
  // would move focus onto an occluded button (issue #112 review).
  if (menuUiState.listOpen) await renderCat(cat); else await renderPane();
  const host = menuUiState.listOpen ? el.listRows : el.paneCards;
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
  menuUiState.catPage[cat] = 0;                    // the dropped card lands first — show it
  if (current && current.id === b.id) {
    current.category = cat;
    current.catStamp = Date.now();
    applyBoardCat();                   // the open board's ladder rotates with it (B67)
    saveNow();
  } else {
    const rec = await idbGet(b.id);
    if (rec) { rec.category = cat; rec.catStamp = Date.now(); await idbPut(rec); }
  }
  if (viewState.isWide) renderPane(); else renderListSurface();
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
async function renderListSurface() {
  if (!menuUiState.listOpen) return;
  if (menuUiState.catView) { await renderCat(menuUiState.catView); return; }
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
    .map(b => (current && b.id === current.id) ? current : b)
    .filter(b => catOf(b) === cat);
  menuUiState.catFilled = 1;
  menuUiState.catCap = catPageCap(1, 1);                  // one section drawn: it takes the whole surface
  const focusCat = focusedCatAdd();
  el.listView.classList.remove('picker');
  el.listRows.setAttribute('role', 'list');   // a list of board rows (restored from the picker's menu)
  el.listRows.textContent = '';
  el.listRows.appendChild(
    makeCatSection(cat, boards.sort(catOrder), menuUiState.catCap, makeListRow));
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
    if (!viewState.isDesktop) return;              // mobile keeps its native context menu; the hold is the path
    ev.preventDefault();
    let x = ev.clientX, y = ev.clientY;
    if (!x && !y) {                      // Shift+F10 fires contextmenu at 0,0
      const r = card.getBoundingClientRect();
      x = r.left + r.width / 2; y = r.top + r.height / 2;
    }
    menuUiState.menuInvoker = card;                  // focus returns to the card on close
    openBoardRowMenu(row, b, x, y);
  });
  return row;
}

function formatDate(ms) {
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
    interactionState.dragCancel = null;
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
    if (!viewState.isDesktop) t = setTimeout(() => {
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
      interactionState.dragCancel = () => { down = false; dragging = false; clearDrag(); };
      row.classList.add('card-dragging');
      // The same "the gesture just changed mode" signal the hold gives.
      if (!viewState.isDesktop && navigator.vibrate) navigator.vibrate(10);
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
  const wasCurrent = current && current.id === id;
  if (wasCurrent) current = null;                      // guard invalid current on return
  // On desktop the board view has no list screen to heal a dead `current` on
  // return, so heal it now, or the next interaction dereferences current.notes
  // (review finding 2). This holds whether the delete came from the rail or the
  // desktop drilled-category overlay.
  if (viewState.isDesktop && wasCurrent) await ensureCurrentValid();
  if (menuUiState.listOpen) {
    // Re-paginate the visible list overlay (the drill, either platform, or the
    // desktop picker). The row's own leave() plays first, so a delete on a full
    // page pulls the next board up instead of leaving a hole (issue #74). The
    // rail behind a desktop drill is hidden — rendering it here would leave the
    // visible drill with the hole (issue #112 review).
    setTimeout(renderListSurface, LEAVE_MS);
  } else if (viewState.isWide) {
    renderPane();
  }
  showUndo(async () => {
    await idbPut(snapshot);
    // Restore into the visible surface: the open list overlay (drill/picker,
    // either platform), else the desktop rail — reopening the board there if it
    // was the one showing (issue #112 review).
    if (menuUiState.listOpen) { renderListSurface(); return; }
    if (viewState.isWide) { if (wasCurrent) swapBoard(snapshot.id); else renderPane(); }
  }, 'board');
}

async function openBoardById(id) {
  finalizeItemUndo();                                   // see swapBoard (finding 1)
  flushSave();                                          // the mobile twin of swapBoard's
                                                        // flush: one law, two skins (B69)
  const rec = await idbGet(id);
  if (!rec) return;
  current = rec;
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
function returnToBoard() {
  if (interactionState.popping) return;
  interactionState.popping = true;
  const depth = (history.state && history.state.v === 'cat') ? 2 : 1;
  history.go(-depth);
}

function openBoardObj(board) {
  current = board;
  renderBoard();
}

/* Creation lives in the categories (issue #88 / B63): each section's own New
   board control writes the category it sits in — explicitly, 'unsorted'
   included (dropBoardCard's precedent; catOf stays a read-site default) — and
   stamps catStamp so the new board lands first, like a drop. The board opens
   at once, on either surface: a control that made something you then had to
   go find would tax the very moment it exists to serve. */
async function newBoardIn(cat) {
  finalizeItemUndo();                                   // see swapBoard (finding 1)
  flushSave();                                          // stamp any pending edit BEFORE the
                                                        // new board's own, so B63's "lands
                                                        // first" holds under B69's order
  const board = newBoardRecord();
  board.category = cat;
  board.catStamp = Date.now();                          // lands first by catOrder, like a drop
  await idbPut(board);
  menuUiState.catPage[cat] = 0;                                     // the new card's page — show it
  // The branch is the routing invariant, not the mode: history.back() is only
  // lawful while the list's pushed state is still on the stack. An OS back
  // gesture or a mode flip clears listOpen before this fires — then the swap
  // opens the board without popping an entry the
  // list no longer owns (B9 untouched; the swap's renderPane no-ops off-desktop).
  if (!menuUiState.listOpen) { swapBoard(board.id); return; }
  current = board;
  returnToBoard();                                      // page-turn back to the board (B9)
}

/* --- 11.5 Desktop board pane (issues #9 / #10 / #14) ---------------------- */

/* A pending note/lot Undo splices into whatever board is `current` at undo
   time — switching boards would resurrect it onto the wrong board. Board
   swaps finalize it (the delete is already persisted). Board-scoped Undo is
   cross-board-safe and survives. (Review finding 1.) */
function finalizeItemUndo() {
  if (el.toast.dataset.scope === 'item') { clearTimeout(menuUiState.undoTimer); hideToast(); }
}

async function swapBoard(id) {
  if (interactionState.swapping) return;
  if (current && current.id === id) return;
  finalizeItemUndo();
  interactionState.swapping = true;
  flushSave();                        // persist() snapshots `current` synchronously — safe
  const rec = await idbGet(id);
  if (!rec) { interactionState.swapping = false; renderPane(); return; }
  el.board.classList.add('swapping');
  setTimeout(() => {                  // setTimeout, not transitionend: the reduced-motion
    current = rec;                    // kill-switch zeroes transitions (§8)
    renderBoard();
    renderPane();
    el.board.classList.remove('swapping');
    interactionState.swapping = false;
  }, SWAP_MS);
}

/* The rail renders the shared three sections (§11): same law, same paging,
   same drag, same head/add/cards/pager grid as the mobile list (B63) — the
   rail's skin only tightens the row heights and the control's label. */
async function renderPane() {
  if (!viewState.isWide || !el.paneCards) return;   // wide: the rail exists on tablet too (B96)
  // A re-render tears the captured card out from under a live drag — pointerup
  // would never arrive, stranding the fixed ghost on screen. Cancel it first.
  if (interactionState.dragCancel) interactionState.dragCancel();
  const all = await idbGetAll();
  const buckets = { todo: [], idea: [], unsorted: [], learning: [] };
  // The open board buckets from memory, not the snapshot: `current` is
  // authoritative for it (the export takes the same stance), and a drop's
  // write can still be behind the debounced persist when this getAll runs.
  for (const b of all) {
    const rec = (current && b.id === current.id) ? current : b;
    buckets[catOf(rec)].push(rec);
  }
  menuUiState.catFilled = BOARD_CATS.filter(c => buckets[c].length).length;
  menuUiState.catCap = catPageCap(menuUiState.catFilled);
  const focusCat = focusedCatAdd();
  el.paneCards.textContent = '';
  for (const cat of BOARD_CATS)
    el.paneCards.appendChild(
      makeCatSection(cat, buckets[cat].sort(catOrder), menuUiState.catCap, makePaneRow));
  refocusCatAdd(el.paneCards, focusCat);
}

function makePaneRow(b) {
  const row = document.createElement('div');
  row.className = 'pane-row'; row.setAttribute('role', 'listitem');
  const card = document.createElement('button');
  card.type = 'button'; card.className = 'pane-card'; card.dataset.id = b.id;
  fillRowContent(card, b);
  row.appendChild(card);
  const isActive = current && b.id === current.id;
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
    menuUiState.menuInvoker = card;               // focus returns to the card on close
    openBoardRowMenu(row, b, x, y);
  });
  return row;
}

/* Live title (issue #14): the active card updates in place per keystroke; a
   full renderPane on commit reconciles the untitled date line. */
function updateActiveCardTitle() {
  const card = el.paneCards && el.paneCards.querySelector('.pane-card.active');
  if (!card || !current) return;
  const titleEl = card.querySelector('.row-title');
  if (!titleEl) return;
  const titled = !!(current.title && current.title.trim().length);
  titleEl.textContent = titled ? current.title : COPY.untitled;
  titleEl.classList.toggle('untitled', !titled);
}

function goToList() {
  if (menuUiState.listOpen) return;
  // B100 (issue #157): the picker is the lot-grid on every surface that has
  // the tab (mobile and tablet — desktop's tab is retired, the rail is its
  // all-boards surface). The grid opens over the lot without occluding the
  // tab, so its focus is not stranded and is kept.
  history.pushState({ v: 'list' }, '');
  showList();
}
/* Level 1 — the All-Boards picker (issue #112 / B74; issue #157 / B100): the
   Parking Lot turned into the 2x2 grid on mobile AND tablet, drawn over the
   lot at its current height (openLotMenu), leaving the board and its
   parking-lot data untouched beneath. Desktop has no picker and no #list-view
   at level 1: its All-boards tab is retired (B100) — the left rail (B24)
   already lists every category with every board. */
function showList() {
  menuUiState.listOpen = true;
  menuUiState.catView = null;
  syncViewTitle();                    // the picker names itself (issue #148 item 2)
  syncBoardActions();                 // the tab stays visible above the grid — flip it to "This board" (B83)
  openLotMenu();
}
/* Drilling a picker button opens that category's own screen — level 2. It is a
   navigation, inert like the pager (B22), so no B18 window. The mobile grid is
   dismissed as the drill screen takes over; the board's real lot returns when
   the whole stack pops back. */
function drillCat(cat) {
  history.pushState({ v: 'cat', cat }, '');
  showCat(cat);
}
async function showCat(cat) {
  menuUiState.listOpen = true;
  menuUiState.catView = cat;
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
    if (menuUiState.listOpen && menuUiState.catView === cat) el.listView.classList.add('show');
  });
}
/* Mobile only: the Parking Lot becomes the All-Boards menu (issue #112 / B74).
   A transient overlay drawn over #lot at its current --lot-h — if the lot is
   expanded, so is the grid — filled by the four category buttons. It never
   touches current.parkingLot: the board's own lot data is only hidden, and it
   returns intact the moment the picker is dismissed. */
function openLotMenu() {
  menuUiState.lotMenuOpen = true;
  el.lotMenu.textContent = '';
  buildCatButtons(el.lotMenu);
  el.lotMenu.hidden = false;
  el.lot.classList.add('menu-open');   // hides the lot's own rule/header/items
}
function closeLotMenu() {
  if (!menuUiState.lotMenuOpen) return;
  menuUiState.lotMenuOpen = false;
  el.lotMenu.hidden = true;
  el.lotMenu.textContent = '';
  el.lot.classList.remove('menu-open');
}
async function ensureCurrentValid() {
  if (current) { const still = await idbGet(current.id); if (still) return; }
  // The board being replaced is gone from storage; drop its pending debounce
  // with it, or the timer would fire against its successor and stamp a board
  // nobody edited — which under B69 would move that card (§3's `dirty` rides
  // whatever `current` is, so it is cleared wherever `current` is replaced).
  clearTimeout(saveTimer); dirty = false;
  const all = await idbGetAll();
  current = all.length ? all.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a)) : newBoardRecord();
  if (!all.length) await idbPut(current);
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
  if (viewState.isWide) { el.listView.hidden = true; return; }
  setTimeout(() => {
    if (!el.listView.classList.contains('show')) el.listView.hidden = true;
  }, LEAVE_MS);
}
async function showBoardFromList() {
  menuUiState.listOpen = false;
  menuUiState.catView = null;
  closeLotMenu();                      // mobile: the grid steps aside, the real lot returns
  hideListView();                      // slide the drilled panel down, then hide (B82)
  if (!current) { await ensureCurrentValid(); }
  else { renderBoard(); }
  if (viewState.isWide) renderPane();         // a board opened from the #list-view drill lights its rail card
}

/* --- 11.6 The rolling temporal calendar (issue #145) ----------------------
   The third screen. The 7-day window is computed at render (R4) — today at
   the top, lit; the week receding below it. Each date with events mirrors
   into its linked To-Do board (§1.7). The top row (R1) is the screen's
   always-visible way off: Back (history.back(), B9's route made visible),
   All Boards (the picker, calendar shrinking to fit — R1), Export (B92's
   choice, PDF leaf = the 7-day reference sheet). The stack never scrolls —
   it is a bounded page like every other surface. */
                                     // the rail is furniture, so it must never enter the
                                     // screen-grammar branches (popstate's calOpen swallow,
                                     // applyMode's close, hideCal) that a pushed screen owns.

function goCalBack() {
  history.back();                      // pop {v:'cal'} → the board (B9's route, visible)
}

/* --- The standing rail (issue #158, B99) ----------------------------------
   Wide's calendar is FURNITURE, not navigation: the 40px rail renders at
   boot (and on every flip to wide), reading "Calendar Board" vertically with
   today's date and a lit dot when today carries events (the mockup's
   aperture). Tapping it expands the panel — the R6 squeeze, entered from the
   rail — and the panel's own Back (R1's first act, reused as the collapse
   arrow) returns the rail. The rail commits nothing (B81: navigation runs
   raw); no history is pushed on wide, the rail is never "off". */
function renderCalRail() {
  if (!viewState.isWide) return;
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

function showCalRail() {
  closeLotMenu();
  hideListView();
  menuUiState.listOpen = false; menuUiState.catView = null;
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
  menuUiState.calExpanded = true;                 // the screen-grammar state rides the PANEL, not the rail
  setCalSqueeze(true);                // the board reflows beside the panel (R6)
  renderCal();                        // the expanded face: the 7-day stack
}

function collapseCalRail() {
  el.calView.classList.add('rail-open');
  el.calView.classList.remove('panel');
  el.calRail.hidden = false;
  el.calRail.setAttribute('aria-expanded', 'false');
  menuUiState.calExpanded = false;
  setCalSqueeze(false);               // the squeeze lifts; the board returns (R6)
  renderCalRail();
}

function showCal() {
  // Wide enters through the standing rail (B99); mobile keeps the pushed
  // full-screen view (B95's mobile path, unchanged).
  if (viewState.isWide) { showCalRail(); return; }
  menuUiState.calOpen = true;
  closeLotMenu();
  hideListView();
  menuUiState.listOpen = false; menuUiState.catView = null;
  syncBoardActions();
  // The squeeze is the desktop/tablet arrangement (R3/R6): the panel takes
  // real width beside the board; on mobile the calendar is the full screen.
  el.calView.classList.toggle('panel', viewState.isWide);
  setCalSqueeze(viewState.isWide);
  renderCal();
}

/* The popstate branch: {v:'cal'} re-shows the calendar (an OS-forward onto
   it); leaving it lands on the board and restores the action row. */
function hideCal() {
  if (!menuUiState.calOpen && !menuUiState.calExpanded) return;
  menuUiState.calOpen = false;
  menuUiState.calExpanded = false;
  el.calView.hidden = !viewState.isWide;       // wide: the rail face remains (furniture, B99)
  el.calView.classList.remove('panel');   // the expanded face lifts
  el.calView.classList.toggle('rail-open', viewState.isWide);
  el.calRail.hidden = !viewState.isWide;
  setCalSqueeze(false);              // the squeeze lifts; the frame returns (R6)
  syncBoardActions();
  if (!viewState.isWide) renderBoard();
  else renderCalRail();
}

function calDayName(d) {
  return d.toLocaleDateString(undefined, { weekday: 'long' });
}
function calMD(d) {
  const p = (n) => String(n).padStart(2, '0');
  return p(d.getMonth() + 1) + '/' + p(d.getDate());
}

function makeCalDay(day, events, board) {
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
   1. the date's linked board is ensured (created on the first event),
   2. the event record is written to the store,
   3. the board's Requirements mirror is synced,
   4. both records persist, and the line appears in the day zone at once.
   Creating + writing are consequences (records change), so the whole step
   runs under commitAction's drop-guard (B81) — a double-tap adds one event.
   The line's editor opens on arrival: capture precedes structure, §1.1. */
async function addCalEvent(dateKey, zone) {
  commitAction(async () => {            // the guard arms synchronously (B81); the
                                        // work itself is fire-and-forget, like every
                                        // async consequence in this file

    flushSave();
    const all = await idbGetAll();
    const boards = all.filter(b => b.title !== undefined);
    const { board } = ensureLinkedBoard(boards, dateKey);
    const ev = newCalEvent(dateKey, '');
    if (board.calReq === undefined) {
      // First sync for this board: the span is the events it already had.
      board.calReq = calEventsOf(eventsOf(all), dateKey).length;
    }
    await idbPut(ev);
    await idbPut(board);
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
function startCalLineEdit(line, ev) {
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
async function syncDateMirror(dateKey) {
  const all = await idbGetAll();
  const boards = all.filter(b => b.title !== undefined);
  const board = calBoardOf(boards, dateKey);
  if (!board) return;
  if (syncMirror(board, calEventsOf(eventsOf(all), dateKey))) await idbPut(board);
}

/* Event records ride the boards store (one store, no schema bump); they are
   the records with a `date` and no `title`. Filtered once, at the read. */
function eventsOf(all) {
  return all.filter(r => typeof r.date === 'string' && typeof r.text === 'string' && r.title === undefined);
}

function renderCal() {
  el.calView.hidden = false;
  el.calStack.textContent = '';
  // §6/B7's collar on the R1 top row (issue #156, B98): the row's tabs draw
  // at the floor as visible frames now, and the collar tops up the width
  // where geometry is tight. The calendar is an unscaled surface, so the
  // draw scale k is 1 — the same arithmetic, one caller shape fewer than the
  // board row (no renderScale term). isDesktop inside hitInset picks the
  // 44px touch floor vs the 24px pointer floor, so B96's tablet tier
  // inherits the right one. Half-pixel headroom, per the board row's note.
  el.calTop.style.setProperty('--hit', (hitInset(el.calTop, 1) + 0.5) + 'px');
  const days = calWindow();
  renderCalDays(days);
}

function renderCalDays(days) {
  flushSave();
  idbGetAll().then((all) => {
    const events = eventsOf(all);      // event records ride the boards store (§1.7)
    for (const day of days) {
      const board = calBoardOf(all, day.key);
      const dayEvents = calEventsOf(events, day.key);
      el.calStack.appendChild(makeCalDay(day, dayEvents, board));
    }
  });
}

/* The top row's three acts (R1). Back pops the pushed state. All Boards opens
   the picker; the calendar shrinks to fit it rather than being overlaid (the
   B74 grid draws over the lot at its current height — same reading here, the
   calendar's stack compresses, nothing is covered). Export opens the B92
   choice menu anchored at the pressed control — PDF's leaf is the 7-day
   reference sheet (b8's exporter), JSON the whole-library backup. */
el.calBack.addEventListener('click', () => {
  // On wide, Back IS the collapse arrow (B99): the panel returns to the rail,
  // the squeeze lifts — no history to pop (the rail pushed none). On mobile,
  // Back pops the pushed {v:'cal'} state (B9's route, visible — R1).
  if (viewState.isWide && menuUiState.calExpanded) { collapseCalRail(); return; }
  goCalBack();
});
el.calRail.addEventListener('click', () => {
  // Furniture's one act: expand (B99). Pure navigation, no commit (B81).
  if (!viewState.isWide || menuUiState.calExpanded) return;
  expandCalRail();
});
el.calBoards.addEventListener('click', (e) => {
  if (viewState.isDesktop) return;               // B100: no All-Boards on desktop — the rail is the all-boards surface
  const r = e.currentTarget.getBoundingClientRect();
  history.pushState({ v: 'list' }, '');
  menuUiState.listOpen = true;
  showList();
});
el.calExport.addEventListener('click', (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  buildMenu([
    { label: COPY.exportPdf, glyph: GLYPH.export, action: () => commitAction(() => exportCalPdf()) },
    { label: COPY.exportJson, glyph: GLYPH.boards, action: () => commitAction(exportAllJson) },
  ], r.left, r.bottom);
});

/* The back gesture drives the three levels now (B9, never shadowed): {v:'cal'}
   the calendar, {v:'cat'} a drilled category, {v:'list'} the picker, no state
   the board. Popping from a drill to the picker re-opens it on the surface the
   mode uses — the mobile grid or the desktop screen. The calendar's own branch
   comes FIRST: it can sit beneath a list state (All Boards from the calendar),
   so the state alone decides, not calOpen — landing on a non-cal state while
   the calendar is open hides it (Back from the calendar, or the picker's
   return re-entering the board).
   drilled category, {v:'list'} the picker, no state the board. Popping from a
   drill to the picker re-opens it on the surface the mode uses — the mobile
   grid or the desktop screen. */
window.addEventListener('popstate', () => {
  interactionState.popping = false;                     // the nav returnToBoard began has landed (B83)
  closeMenu();
  const s = history.state;
  // B99: on wide the calendar is furniture — the rail never enters this
  // grammar (calOpen is mobile's screen flag). A stray {v:'cal'} landing on
  // wide collapses the panel (the mobile-era entry has no wide meaning);
  // mobile keeps its full-screen view.
  if (s && s.v === 'cal') { showCal(); }
  else if (menuUiState.calOpen || menuUiState.calExpanded) { hideCal(); }     // landing anywhere else closes the calendar first
  else if (s && s.v === 'cat') {
    if (viewState.isDesktop) { showBoardFromList(); }   // B100: desktop has no drill either — a stray landing (old-build history) heals to the board
    else { showCat(s.cat); }
  }
  else if (s && s.v === 'list') {
    if (viewState.isDesktop) { showBoardFromList(); }   // B100: desktop pushes no {v:'list'} — a stray landing (old-build history) heals to the board
    else { menuUiState.catView = null; hideListView(); showList(); }  // the drill's panel slides down as the grid returns (B82)
  }
  else { showBoardFromList(); }
});

/* --- 12. Boot + service worker ------------------------------------------- */
window.addEventListener('resize', onViewportResize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', onViewportResize);

/* Both sections are sized by the type they hold (B37/B47), and the type arrives
   late: the faces are font-display: swap (B50), so boot measures the fallback
   and the real metrics land afterwards with nothing watching. Until B65 the
   drift was invisible — a rule a pixel off. It is not any more: the handle is
   pinned to the compartment's measured bottom edge, and a title that re-wraps
   on the swap would leave a control floating off the corner it belongs to. One
   re-measure when the faces land; a browser without the API keeps boot's. */
if (document.fonts && document.fonts.ready) document.fonts.ready.then(applyLayout);

async function pickLaunchBoard(all) {
  if (!all.length) { const board = newBoardRecord(); await idbPut(board); return board; }
  return all.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));   // launch → most recent
}

async function boot() {
  applyLayout();                 // establishes LEGACY_H before the migration reads it —
                                 // the first applyLayout otherwise fires inside openBoardObj,
                                 // after storage is already being rendered (B93)
  const all = await idbGetAll();
  const adopted = await migrateLegacyBoards(all);   // B93: legacy notes onto the single path,
                                                    // written straight to IDB — nothing is
                                                    // open or debounced yet
  const board = await pickLaunchBoard(all);
  openBoardObj(board);
  if (viewState.isWide) renderPane();
  // The standing calendar rail (issue #158, B99): furniture renders at boot on
  // wide, no press required. The has-cal-rail class gates its CSS (the
  // section must not render as a 40px sliver where the feature isn't armed).
  // Mobile never sees it (its calendar stays the tab-driven full-screen view).
  if (viewState.isWide) {
    document.documentElement.classList.add('has-cal-rail');
    showCalRail();
  }
}
boot();

// Register the service worker at top level (not inside async boot, whose IDB
// awaits can resolve after 'load' has already fired — the listener would miss).
//
// Self-update (B79): a version-stamped cache only reaches an installed PWA if the
// browser actually re-fetches sw.js — and it throttles that check hard, so an app
// on the home screen can sit on an old build for up to a day (this stranded a real
// device). Registration never asked for the check; now it does. reg.update() on
// load and on every foreground (a relaunched PWA fires visibilitychange, not a
// fresh load) pulls the new worker in; sw.js already skipWaiting()s + claim()s and
// its stale-while-revalidate serves the new bytes on the next launch — so a deploy
// lands within a launch or two instead of never. No forced mid-session reload: the
// update arrives the next time the app opens, when the user expects it and never
// mid-thought (and it keeps the update path identical to test/sw-update.js's).
if ('serviceWorker' in navigator) {
  // B102 (issue #164 finding): the update check itself can be pinned. The
  // browser may serve sw.js from its own HTTP cache (Firefox honors the
  // script's max-age for SW script fetches; proxies on the path can do
  // worse), so reg.update() re-checks against a stale copy and — with SWR
  // returning the cached shell — an app can sit on an old build for days
  // across browsers that never share code. updateViaCache:'none' makes the
  // browser bypass its HTTP cache for the SW script ITSELF (the assets
  // still ride SWR), removing the one cache layer this code did not own.
  const register = () => navigator.serviceWorker.register('sw.js',
    { updateViaCache: 'none' }).then((reg) => {
    reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => {});
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
}

/* The build handshake (B102, issue #164's desktop half). Every layer above —
   skipWaiting, claim, reg.update(), SWR, updateViaCache — assumes the browser
   eventually ASKS the server whether anything changed. The one failure no
   layer here owns is the ask itself being answered from a cache: the user's
   devices sat on a v43 shell for six days across three engines while every
   server-side check showed v46 live — the update check was being answered
   from somewhere between the device and Pages. So the app verifies the
   contract DIRECTLY: it knows its own build (stamped bump-adjacent to
   sw.js's CACHE, the one string that names a build), fetches sw.js with
   cache:'reload' — browser cache AND SWR both bypassed; the network is the
   authority — and on the second consecutive mismatch deletes every
   todo-boards cache, unregisters the worker, and reloads once. Two strikes,
   so one bad response (a captive portal, a proxy error page) cannot nuke a
   healthy install; the sessionStorage counter dies with the tab. After the
   reload the freshly-registered worker reinstalls from the network (install
   IS addAll over the network) and the app is current whatever the in-between
   layer does. Runs 20s after launch — off the critical path, once per
   session, and only ever acts on device-vs-deploy disagreement. Offline it
   does nothing: there is no authority to compare against.

   DATA IS NEVER TOUCHED. The self-heal deletes Cache Storage entries (the
   `todo-boards-v*` copies of the app shell) and unregisters the worker —
   nothing else. The boards live in IndexedDB (`boards-db`), a different
   store the handshake never opens, and B21's read-site defaulting means an
   old record renders correctly under a new build anyway. Worst case is the
   app re-downloading its own five files; a board cannot be lost to this
   path by construction. */
const OWN_BUILD = 'v49';
if ('serviceWorker' in navigator && 'caches' in window) {
  const handshake = () => {
    fetch('sw.js', { cache: 'reload' }).then((res) => {
      if (!res.ok) return;
      return res.text().then((text) => {
        const m = text.match(/todo-boards-v(\d+)/);
        if (!m) return;                       // unparseable: never act blind
        const served = 'v' + m[1];
        if (served === OWN_BUILD) {
          sessionStorage.removeItem('boards-build-mismatch');
          return;                             // healthy: device matches deploy
        }
        const seen = sessionStorage.getItem('boards-build-mismatch');
        if (seen === served) {
          // twice in a row, same wrong answer: the caches are stale. Self-heal.
          caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k.startsWith('todo-boards-v'))
              .map((k) => caches.delete(k)))
          ).then(() => navigator.serviceWorker.getRegistration())
           .then((reg) => reg && reg.unregister())
           .then(() => location.reload());
        } else {
          sessionStorage.setItem('boards-build-mismatch', served);
        }
      });
    }).catch(() => {});                     // offline: nothing to compare, do nothing
  };
  setTimeout(handshake, 20000);
}
