/* ============================================================================
   Zezed Boards — app.js  (vanilla, no dependencies, no build step)

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
export const NOTE_MIN_W = 132;              // real minimum rendered note width (UIUX §4.5, B84):
                                     // wide enough to seat the 4-button on-select toolbar.
                                     // One number does three jobs — the wrap-cap floor
                                     // (noteMaxW), the CSS min-width on .note-text, and the
                                     // drag/resize width floor — so a note can never be sized
                                     // narrower than its own row (issue #126 pt 4.1).
export const MIN_SCALE = 0.5, MAX_SCALE = 2.0;
export const MOVE_THRESHOLD = 16;           // px before a drag begins / long-press cancels (B29)
export const KB_HIDE_SLOP = 120;            // visual-viewport growth (px) that reads as the soft
                                     // keyboard retracting, not URL-bar/inset jitter (B80, issue #119)
export const LONGPRESS_MS = 500;
export const HIT_FLOOR = 44;                // px physical (PRD §5.3, UIUX §6) — mobile
export const HIT_FLOOR_DESKTOP = 24;        // WCAG 2.5.8 AA; a 44px collar swallows dismiss clicks (issue #12)
export const PANE_W = 300;                  // CSS px; unscaled width of the desktop board rail
export const PANE_CAT_HEAD = 32;            // .cat-head/.cat-add row, desktop (issue #88)
export const PANE_PAGER_H = 32;             // .cat-pager row, desktop (issue #58)
// Mobile spends two of these rows per section (B63): the head row — label
// left, the category's own New board control right — above the cards, and the
// pager row below them. B68 takes the row down to HIT_FLOOR exactly — the
// 44px control IS the row — and the card down with it, because the fourth
// card issue #97 asks for is bought out of exactly this furniture. The
// constant covers the whole row, so catPageCap()'s budget stays exact.
export const LIST_CAT_ROW = 44;             // .board-cat head/pager rows, mobile (issues #74, #88, #97)
export const PANE_ROW_H = 44;               // .pane-card / .board-row min-height — §6's floor, not below it
// Two gaps, because they say two things (B68): card to card inside a section,
// and section to section. The first tightens to buy the fourth card; the
// second is what keeps three categories reading as three, and it holds at 8.
export const PANE_ROW_GAP = 4;              // .cat-cards grid gap
// Cards to a row in the drilled list (B70 put two; B82 takes it to three,
// issue #125). The mobile drill is now a slide-up panel a third of the viewport
// tall (B82), so the horizontal axis buys back the density the shorter panel
// gives up. The rail stays at one — PANE_W is 300, two would be narrower than
// the titles they name.
export const LIST_CARD_COLS = 3;            // = .cat-cards grid-template-columns (mobile; the rail is one)
// The mobile drilled-list card carries a two-line title and a "Last Updated"
// line (B82, issue #125), so it stands taller than the §6 touch floor the rail
// card holds to: catPageCap() budgets the drilled list against this, the rail
// against PANE_ROW_H.
export const LIST_CARD_H = 76;              // = html:not(.desktop) .board-row height in styles.css
// The drilled list rises to a third of the viewport, the board still behind it
// (B82, UIUX §10). Measured from window.innerHeight in JS — the stable measure
// while the soft keyboard is up (B28) — so no `vh` enters the CSS (B32).
export const LIST_PANEL_FRAC = 1 / 3;
export const CAT_SEC_GAP = 8;               // #list-rows / #pane-cards flex gap
export const DBLCLICK_MS = 350;             // second click on a selected item within this = edit
// Three durations paired to styles.css §8 values — they move together
// (PRD §9.5): the 200ms set and the 260ms board swap, on §8's one curve.
export const SWAP_MS = 260;                 // board-swap crossfade; sequenced by timeout (§8-safe)
export const SAVE_DEBOUNCE = 300;
export const UNDO_MS = 5000;
export const LEAVE_MS = 200;
export const TOAST_HIDE_MS = 210;           // just past the toast's 200ms fade before hidden lands
export const ACTION_DELAY = 400;            // re-fire drop-guard: a consequence commits now, a second tap inside is dropped (B81)

export const COPY = {
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
  // The note's Title (issue #173, B120): the toggle wears the act it will
  // perform (B43/B71) — Add when the note has none, Edit when one exists.
  addTitle: 'Add Title', editTitle: 'Edit Title',
  // Note linking (issue #142, B91): a relationship the user asserts between two
  // notes by connecting them — long-press/right-click a note → Link → the next
  // note tapped. The hint states the act while the mode is armed; linked/unlinked
  // caption the 5s undo toast (re-linking an already-linked pair removes it).
  link: 'Link',
  // The clock toggle's two faces (issue #169, B109), the Highlight grammar
  // (B43/B71): the label states the act it will perform.
  remind: 'Remind me', unremind: 'Remove reminder',
  // Surfaced cards' menu (issue #169, B109): the issue's own wording, verbatim.
  gotoBoard: 'Go to Board',
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
  paneCollapse: 'Collapse',   // the expanded All-Boards rail's arrow (issue #211, B118)
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
export const GLYPH = {
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
  // The Title (issue #173, B120): a header rule over a header line — the mark
  // of a heading, the thing the tab renders.
  title:    MARK(16, '<path d="M3 3.5h10M8 3.5v9"/>'),
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
  // The reminder clock (issue #169, B104/B109): a dial and its hands, drawn in
  // the app's own hand like every mark — one tap sets or clears (B104), no
  // time concept anywhere in it: the hands read ten past ten because a clock
  // glyph must, not because anything is scheduled.
  clock:     MARK(16, '<circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/>'),
  calBack:   MARK(16, '<path d="M9.5 3.5L5 8l4.5 4.5"/><path d="M5 8h6.5"/>'),
  // The pane's collapse arrow (issue #211, B118): the chevron alone — it does
  // not "go back" anywhere, it folds the rail, so it borrows nothing from the
  // page-turn pair.
  paneCollapse: MARK(16, '<path d="M9.5 3.5L5 8l4.5 4.5"/>'),
};

// contenteditable mode: prefer plaintext-only (Chromium/Samsung Internet — the
// Z Fold target); fall back to "true" where unsupported so text still captures.
export const CE = (() => {
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
export const TABLET_MQ = window.matchMedia('(min-width: 744px)');

export const DESKTOP_MQ = window.matchMedia(
  '(min-width: 1024px) and (hover: hover) and (pointer: fine)');
// Shared geometry constants (issue #182): BAND_TOP/LINE/GAP drive both the screen's
// bandRuleY (geometry) and the export's bandRuleYFor (export); LOT_HEAD/ROW/FLOOR/
// MAX_FRAC drive the lot on screen and in the PDF. Both modules read them, so they
// live in the root (evaluated first, in the module graph's order) — moving them down
// to geometry would put EXPORT_GEO's top-level initializer in the TDZ (the import
// would be read before geometry finished evaluating).
export const BAND_TOP = 14, BAND_LINE = 19.5, BAND_GAP = 8;
export const LOT_HEAD = 34, LOT_ROW = 44, LOT_FLOOR = 2 * LOT_ROW, LOT_MAX_FRAC = 0.5;

export const uuid = () =>
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
export function calKey(d) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function calKeyOf(dateKey) { return dateKey; }   // identity — reads clear at call sites

/* The 7 rolling days: today + 6 future, today first (R7.4 — no past cards;
   mockup 6's "yesterday deepest" line is dead). Each entry is
   { key, date: Date, today: bool }. */
export function calWindow() {
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
export function newCalEvent(dateKey, text) {
  return { id: uuid(), date: dateKey, text: text || '', state: 'active',
           createdAt: Date.now() };
}

/* The linked board for a date, if it exists. The link is the board's `cal`
   field (added at the read site — B21's idiom), so finding it is a scan of
   the snapshot the caller already holds. `current` is authoritative for
   itself (renderPane's stance). */
export function calBoardOf(all, dateKey) {
  for (const b of all) {
    const rec = (state.current && b.id === state.current.id) ? state.current : b;
    if (rec.cal === dateKey) return rec;
  }
  return null;
}

/* The date's events, oldest first (creation order = the mirror's line order). */
export function calEventsOf(events, dateKey) {
  return events.filter(e => e.date === dateKey)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || (a.id < b.id ? -1 : 1));
}

/* Ensure a date's linked To-Do board exists; create it on the date's first
   event (R5). Returns the board record (existing or new, already in `all`).
   The new board writes category + calStamp explicitly (B63/B69) and lands
   first in its section, like a drop. Creating a board is a consequence
   (records are written), so every caller wraps this in commitAction. */
export function ensureLinkedBoard(all, dateKey) {
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
   them is the reader's own and is carried through untouched. Each surface
   writes its own edits and lands here to converge (B106) — the span decides
   what a write owns, so the two surfaces can never disagree.

   Requirements is one plain string (PRD §4.1): lines are \n-separated. */
export function syncMirror(board, events) {
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
export function mirrorEventsOf(board, events) {
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

// DOM plumbing (entry-owned, issue #182): every surface the app draws into.
// Used by every region via the shared binding; declared here in the entry
// region so the persistence cut below starts clean.
export const el = {
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
  paneRail: document.getElementById('pane-rail'),         // the collapsed All-Boards face (issue #211, B118)
  paneCollapse: document.getElementById('pane-collapse'), // the expanded pane's collapse arrow (B118)
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
  calMonth: document.getElementById('cal-month'),       // the month view's ground (issue #191)
  actionCalendar: document.getElementById('action-calendar'), // 4th board-action tab (R7.2)
};
export const anchorEls = {
  title: document.getElementById('anchor-title'),
  components: document.getElementById('anchor-components'),
  requirements: document.getElementById('anchor-requirements'),
};

/* The shared mutable state carrier (moved here at the cut, issue #182): the graph root imports nothing. */
export const state = {
  current: null,          // the open board record (in memory)
  dirty: false,           // `current` holds an edit the debounce hasn't written
  // Arrangement tier (issue #182, B'): applyMode (the entry's media-query
  // orchestrator) WRITES these and every region READS them — a cross-module
  // write, so they ride the carrier. A module entry cannot write an imported
  // bare `let` (imported bindings are read-only); state members it can.
  isTablet: TABLET_MQ.matches,    // evaluated at load, like isDesktop below
  isDesktop: DESKTOP_MQ.matches,
  isWide: DESKTOP_MQ.matches || TABLET_MQ.matches,  // desktop ∪ tablet — the arrangement tier
  editVVFloor: Infinity,  // smallest visual-viewport height seen this edit (keyboard fully up)
  layoutDeferred: false,
  menuInvoker: null,      // desktop contextmenu: focus returns here on close
  swallowTap: false,      // the pointerdown that dismissed a menu is inert (B30)
  calOpen: false,         // the MOBILE full-screen calendar (B95's third screen)
  calExpanded: false,     // wide's expanded panel (B99) — rail-up is not "open"
};

export function newBoardRecord() {
  const now = Date.now();
  return { id: uuid(), createdAt: now, updatedAt: now, category: 'todo',
           title: '', requirements: '', components: '', notes: [], parkingLot: [], links: [] };
}
