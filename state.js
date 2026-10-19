/* ============================================================================
   Zeved Boards — state.js
   Owns: graph root, imports nothing — constants and pure utilities (`clamp`),
   copy, GLYPH, DOM plumbing (`el`/`anchorEls`), MQ consts, the shared `state`
   carrier, calendar data helpers. Module map: CLAUDE.md.
   Comments state the rule that holds now and cite B<n> / UIUX §x; engine
   quirks and ordering constraints stay; how a value got there lives only in
   The Docket/DECISIONS.md (AGENTS.md).
   ========================================================================== */


/* --- 1. Constants & copy ------------------------------------------------- */
export const NOTE_MIN_W = 132;       // min width (UIUX §4.5, B84): seats the
                                     // 4-button toolbar. Also the noteMaxW
                                     // wrap-cap floor, .note-text min-width
                                     // and drag/resize floor, so no note is
                                     // ever narrower than its own row.
export const MIN_SCALE = 0.5, MAX_SCALE = 2.0;
/* The toolbar row's seat (B86): painted height 32 plus the 12 downward hit
   collar; UIUX §4.5's 44px. reflectToolbarSeat's raise relies on it (B139). */
export const TB_ROW_H = 44;
/* createNote keeps a new note's y this far above the sheet's bottom edge, so
   the frame's border never sits flush on it. */
export const NOTE_BOTTOM_PAD = 4;
export const MOVE_THRESHOLD = 16;           // px before a drag begins / long-press cancels (B29)
export const KB_HIDE_SLOP = 120;            // visual-viewport growth (px) that reads as the soft
                                     // keyboard retracting, not URL-bar/inset jitter (B80)
export const LONGPRESS_MS = 500;
export const HIT_FLOOR = 44;                // px physical (PRD §5.3, UIUX §6) — mobile
export const HIT_FLOOR_DESKTOP = 24;        // WCAG 2.5.8 AA; a 44px collar swallows dismiss clicks
export const PANE_W = 300;                  // CSS px; unscaled width of the desktop board rail
export const PANE_CAT_HEAD = 32;            // .cat-head/.cat-add row, desktop
export const PANE_PAGER_H = 32;             // .cat-pager row, desktop
// Mobile spends a head row and a pager row per section (B63). Each is
// HIT_FLOOR exactly, the 44px control IS the row (B68), so catPageCap()'s
// budget stays exact.
export const LIST_CAT_ROW = 44;             // .board-cat head/pager rows, mobile
// Two gaps (B68): card to card, and section to section (CAT_SEC_GAP).
export const PANE_ROW_GAP = 4;              // .cat-cards grid gap
// Cards per row in the drilled list (B82); the rail stays at one (PANE_W 300).
export const LIST_CARD_COLS = 3;            // = .cat-cards grid-template-columns (mobile; the rail is one)
// Both card kinds carry the two-line title and stamp (B82); catPageCap()
// budgets BOTH surfaces against this height.
export const LIST_CARD_H = 76;              // = .pane-card height and html:not(.desktop) .board-row height in styles.css
// The drilled list is a third of the viewport (B82, UIUX §10), measured from
// window.innerHeight (stable while the soft keyboard is up, B28): no `vh` in
// the CSS (B32).
export const LIST_PANEL_FRAC = 1 / 3;
export const CAT_SEC_GAP = 8;               // #list-rows / #pane-cards flex gap
export const DBLCLICK_MS = 350;             // second click on a selected item within this = edit
// Paired with UIUX §8 and moving together (PRD §9.5): the 200ms set and the
// 260ms board swap.
export const SWAP_MS = 260;                 // board-swap crossfade; sequenced by timeout
export const SAVE_DEBOUNCE = 300;
export const UNDO_MS = 5000;
export const LEAVE_MS = 200;
export const TOAST_HIDE_MS = 210;           // just past the toast's 200ms fade before hidden lands
/* The copy notice's window (UIUX §9, B176): shorter than UNDO_MS on purpose,
   a copy has nothing to undo. */
export const COPY_NOTICE_MS = 1500;
export const ACTION_DELAY = 400;            // re-fire drop-guard: a consequence commits now, a second tap inside is dropped (B81)
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const REF_W = 900, REF_H = 1000;
export const pad2 = (n) => String(n).padStart(2, '0');

/* Board categories: the stacked order is the source for every derived
   collection. The 2x2 picker reads clockwise, so GRID_ORDER swaps the bottom
   pair; unknown categories default to Notes. */
export const BOARD_CATS = ['todo', 'unsorted', 'learning', 'idea'];
export const GRID_ORDER = [BOARD_CATS[0], BOARD_CATS[1], BOARD_CATS[3], BOARD_CATS[2]];
export const catOf = (board) => BOARD_CATS.includes(board.category) ? board.category : BOARD_CATS[1];

export const COPY = {
  // "All boards" (B43): "Boards" alone would read as a category label. This
  // key is the only place the word is written (B66).
  complete: 'Complete', restore: 'Restore', delete: 'Delete', boards: 'All boards',
  // The board-action toggle's other face (B83): the label states the act it
  // performs (B43/B71 grammar), so no aria-pressed rides alongside it.
  thisBoard: 'This board',
  // Multi-selection labels say "all", not a count (every member wears a ring).
  completeAll: 'Complete all', restoreAll: 'Restore all', deleteAll: 'Delete all',
  // Highlight (B71): the label states the act it will perform (B43 grammar).
  highlight: 'Highlight', unhighlight: 'Remove highlight',
  highlightAll: 'Highlight all', unhighlightAll: 'Remove highlights',
  deleted: 'Deleted', undo: 'Undo',
  copy: 'Copy', copied: 'Copied', copyError: 'Couldn’t copy.',
  // The note's Title (B120): Add when none, Edit when one exists (B43/B71).
  addTitle: 'Add Title', editTitle: 'Edit Title',
  // Note linking (B91). The hint shows while the mode is armed; linked/unlinked
  // caption the 5s undo toast (re-linking a linked pair removes it).
  link: 'Link',
  // The clock toggle's two faces (B109), Highlight grammar (B43/B71).
  remind: 'Remind me', unremind: 'Remove reminder',
  // Surfaced cards' menu (B109).
  gotoBoard: 'Go to Board',
  linkHintTap: 'Tap another note to link',
  linkHintClick: 'Click another note to link',
  linked: 'Linked', unlinked: 'Unlinked',
  // Export is a CHOICE (B92): the tab opens PDF · JSON; JSON is the
  // whole-library backup.
  export: 'Export',
  exportPdf: 'PDF',
  exportJson: 'JSON',
  exportError: 'Couldn’t export.',
  exportLossy: 'Some characters aren’t in the PDF font.',
  // Import (B92): the third board-level tab.
  import: 'Import',
  importError: 'Couldn’t import that file.',
  imported: 'Boards imported',
  saveError: 'Couldn’t save — retrying.',
  untitled: 'What’s up?',
  // "Last Updated" on every board card (B82): the record's updatedAt (B69),
  // rendered MM/DD/YY by formatMDY (UIUX §10).
  lastUpdated: 'Last Updated: ',
  // The four categories. "unsorted" is renamed at the label only; its storage
  // key stays 'unsorted' (B63). No redundant "Boards" in the names (B78).
  // catNew is generic: the enclosing group's aria-label disambiguates.
  catTodo: 'To Do', catIdea: 'Ideas', catUnsorted: 'Notes',
  catLearning: 'Learning',               // the fourth category (B74)
  catNew: 'New board',
  pageFirst: 'First page', pagePrev: 'Previous page',
  pageNext: 'Next page', pageLast: 'Last page',
  // The calendar (B95). The tab reads "All" (R7.2) so four tabs fit a phone;
  // its toggle face mirrors B83.
  calBoardTab: 'All', calendar: 'Calendar',
  // The calendar's exit control (B151): both rails' way off reads `Go Back`, no
  // arrow glyph. The `paneCollapse` key and `#pane-collapse` id keep the
  // `Collapse` name; only the value changed.
  calToday: 'Today', calBack: 'Go Back',
  paneCollapse: 'Go Back',   // the expanded All-Boards rail's way off (B118, B151)
  // A day card's header: "Today" then the long date; future days read
  // weekday + MM/DD.
  calTitle: 'Calendar Board',
  /* Calendar aria-labels, so no surface of the calendar carries a bare string.
     The pager words keep their trailing space: the date is appended verbatim
     ("Previous 10/17 notes"). */
  calAddNote: 'Add a note',
  calPagerPrev: 'Previous ', calPagerNext: 'Next ', calPagerUnit: ' notes',
  calMonthPrev: 'Previous month', calMonthNext: 'Next month',
  calHasEvents: ', has events',
  deleteBoard: 'Delete board',
  /* The PDF's section words (UIUX §15); a completed item keeps its place in
     the order but exports as the one line pdfCompleted (B34). */
  pdfComponents: 'Components', pdfRequirements: 'Requirements',
  pdfParkingLot: 'Parking Lot', pdfCompleted: '— completed —',
};
/* Marks are drawn, not typed (UIUX §13.3, B50): inline currentColor SVG, since
   a typed symbol falls back to a different platform glyph on Android, iOS and
   Windows. A mark unreadable at 16px is redrawn, not swapped back to a code
   point. */
const MARK = (w, d) =>
  `<svg width="${w}" height="${w}" viewBox="0 0 16 16" fill="none" stroke="currentColor" ` +
  `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const GLYPH = {
  complete: MARK(16, '<path d="M2.5 9l4 4L13.5 3.5"/>'),
  restore:  MARK(16, '<path d="M1.5 2.5v4h4"/><path d="M2.3 10a6 6 0 1 0 1.4-6.2L1.5 6.5"/>'),
  boards:   MARK(16, '<rect x="1.5" y="1.5" width="13" height="13" rx="2"/><path d="M8 1.5V14.5M1.5 8H14.5"/>'),
  export:   MARK(16, '<path d="M8 1.5V9M5 6.5L8 9.5 11 6.5"/><path d="M2 12.5h12"/>'),
  // Import (B92): the export mark reversed, the arrow comes DOWN INTO the tray.
  import:   MARK(16, '<path d="M8 9.5V1.5M5 6.5L8 9.5 11 6.5"/><path d="M2 12.5h12"/>'),
  copy:     MARK(16, '<path d="M3 10.5V3.5a2 2 0 0 1 2-2h7"/><rect x="5.5" y="5.5" width="9" height="9" rx="2"/>'),
  highlight: MARK(16, '<path d="M9.5 2.5l4 4-6 6-4 1 1-4z"/><path d="M2 14.5h6"/>'),
  title:    MARK(16, '<path d="M3 3.5h10M8 3.5v9"/>'),
  // Link (B91): two nodes joined by a line, no arrowhead.
  link:     MARK(16, '<circle cx="4" cy="12" r="1.6"/><circle cx="12" cy="4" r="1.6"/><path d="M5.3 10.7l5.4-5.4"/>'),
  delete:   MARK(16, '<path d="M2 4.5h12M5.5 4.5V3a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 10.5 3v1.5M3.8 4.5l.6 8.6a1.5 1.5 0 0 0 1.5 1.4h4.2a1.5 1.5 0 0 0 1.5-1.4l.6-8.6"/>'),
  pageFirst: MARK(14, '<path d="M12.5 2.5L7 8l5.5 5.5"/><path d="M8 2.5L2.5 8 8 13.5"/>'),
  pagePrev:  MARK(14, '<path d="M10 2.5L4.5 8 10 13.5"/>'),
  pageNext:  MARK(14, '<path d="M6 2.5L11.5 8 6 13.5"/>'),
  pageLast:  MARK(14, '<path d="M3.5 2.5L9 8l-5.5 5.5"/><path d="M8 2.5L13.5 8 8 13.5"/>'),
  calendar:  MARK(16, '<rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6.5h12M5.5 1.5V4M10.5 1.5V4"/>'),
  // The reminder clock (B104, B109): the hands carry no time meaning.
  clock:     MARK(16, '<circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/>'),
};

// contenteditable: plaintext-only (Chromium/Samsung Internet), else "true" so
// text still captures.
export const CE = (() => {
  const d = document.createElement('div');
  try { d.contentEditable = 'plaintext-only'; } catch (e) { /* older engines throw */ }
  return d.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true';
})();

/* --- 1.5 Desktop mode (B19) ----------------------------------------------
   Desktop iff the primary pointer is fine and can hover AND the window fits
   the rail. Capability, not width or UA, excludes tablets: iPadOS reports
   coarse/none even with a trackpad. CSS gates on html.desktop (touch/hover
   grammar) and html.wide (arrangement, B96). */
/* Tablet (B103): one leg, `min-width: 744px`, blind to orientation. 744 is
   iPad mini portrait's width, so every iPad and Android tablet qualifies in
   either orientation; no phone or fold cover in portrait (366-480) crosses
   it. A 980x460 landscape cover takes the tablet arrangement. */
export const TABLET_MQ = window.matchMedia('(min-width: 744px)');

export const DESKTOP_MQ = window.matchMedia(
  '(min-width: 1024px) and (hover: hover) and (pointer: fine)');

/* --- Embed mode (B124) ----------------------------------------------------
   ?embed=1&mode=desktop|mobile pins the arrangement tier; unknown or absent
   mode = natural matchMedia. Every mode read flows through these consts, the
   environment pass and state init, so no call site forks. */
const EMBED_PARAMS = new URLSearchParams(location.search);
export const EMBED = EMBED_PARAMS.get('embed') === '1';
export const EMBED_MODE = EMBED &&
  (EMBED_PARAMS.get('mode') === 'desktop' || EMBED_PARAMS.get('mode') === 'mobile')
  ? EMBED_PARAMS.get('mode') : null;
/* Embed never pushes history (B124): pushes become replaceState and pops are
   no-ops (see boards.js returnToBoard/goCalBack). */
export function histPush(s) { history[EMBED ? 'replaceState' : 'pushState'](s, ''); }
/* The one derivation of the tier: boot's state init and applyEnvironment must
   never disagree on `tablet` (`!desktop && TABLET_MQ.matches`, so a desktop is
   never also tablet). */
export function readTier() {
  const desktop = EMBED_MODE ? EMBED_MODE === 'desktop' : DESKTOP_MQ.matches;
  const tablet = EMBED_MODE ? false : !desktop && TABLET_MQ.matches;
  return { desktop, tablet, wide: EMBED_MODE ? EMBED_MODE === 'desktop' : desktop || tablet };
}
// Shared by geometry (screen) and export (PDF): BAND_* drive bandRuleY /
// bandRuleYFor, LOT_* the lot. They stay in the root: in geometry,
// EXPORT_GEO's top-level initializer would read them in the TDZ.
export const BAND_TOP = 14, BAND_LINE = 19.5, BAND_GAP = 8;
export const LOT_HEAD = 34, LOT_ROW = 44, LOT_FLOOR = 2 * LOT_ROW, LOT_MAX_FRAC = 0.5;

export const uuid = () =>
  (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      }));

/* Every persisted record shape: field -> coercer. Construction, PDF projection
   and backup import all use this table. */
export const CALKEY_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDateKey = (v) => typeof v === 'string' && CALKEY_DATE.test(v);
const isString = (v) => typeof v === 'string' ? v : '';
const isId = (v) => typeof v === 'string' && v ? v : uuid();
const isFiniteNumber = (v, fallback) => Number.isFinite(v) ? v : fallback;
const isState = (v) => v === 'complete' ? 'complete' : 'active';
export const RECORD_FIELDS = {
  board: {
    id: (v) => isId(v), createdAt: (v, r, c) => isFiniteNumber(v, c.now),
    updatedAt: (v, r, c) => isFiniteNumber(v, c.createdAt),
    title: isString, requirements: isString, components: isString,
    notes: (v) => Array.isArray(v) ? v : [],
    parkingLot: (v) => Array.isArray(v) ? v : [],
    links: (v) => Array.isArray(v) ? v : [],
    category: (v, r, c) => c.categories && c.categories.has(v) ? v : (c.defaultCategory || 'unsorted'),
    catStamp: (v) => Number.isFinite(v) ? v : undefined,
    cal: (v) => isDateKey(v) ? v : undefined,
    calReq: (v) => Number.isFinite(v) ? v : undefined,
  },
  note: {
    id: isId, text: (v) => isString(v).trimEnd(),
    x: (v) => isFiniteNumber(v, 0), y: (v) => isFiniteNumber(v, 0),
    rw: (v, r, c) => isFiniteNumber(v, c.logicalW), rh: (v, r, c) => isFiniteNumber(v, c.logicalH),
    scale: (v) => Number.isFinite(v) && v > 0 ? v : 1,
    state: isState, highlighted: (v) => v === true,
    title: isString, reminder: (v) => v === true,
    carriedOn: (v) => isDateKey(v) ? v : undefined,
  },
  lot: { id: isId, text: (v) => isString(v).trimEnd(), state: isState },
  event: {
    id: isId, date: (v) => isDateKey(v) ? v : undefined,
    text: (v) => isString(v).trim(), state: isState, time: isString,
    createdAt: (v, r, c) => isFiniteNumber(v, c.now),
  },
  dayNote: { id: isId, rem: isString, next: isString, day: (v) => isDateKey(v) ? v : undefined },
};
export function makeRecord(kind, raw = {}, context = {}) {
  const fields = RECORD_FIELDS[kind];
  if (!fields) throw new Error('Unknown record kind: ' + kind);
  const now = context.now === undefined ? Date.now() : context.now;
  const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : now;
  const ctx = { ...context, now, createdAt };
  return Object.fromEntries(Object.entries(fields).map(([key, coerce]) =>
    [key, coerce(raw[key], raw, ctx)]));
}
export function copyRecordFields(kind, raw) {
  const fields = RECORD_FIELDS[kind];
  if (!fields) throw new Error('Unknown record kind: ' + kind);
  return Object.fromEntries(Object.keys(fields).filter((key) => raw[key] !== undefined)
    .map((key) => [key, raw[key]]));
}

export const splitLines = (text) => text ? text.split('\n') : [];

export const makeDayNoteRecord = (day) => makeRecord('dayNote', {
  id: 'rem-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  rem: '', next: '', day,
});


/* --- 1.7 The rolling temporal calendar (B95) -----------------------------
   The calendar is a VIEW over the To-Do boards (R5), not a record of its own.
   A date links to an ordinary To-Do board by `cal` (the date key) on the board
   record, read-site defaulted (B21, no DB version bump; PRD §4.1). The date's
   day-note squares ARE its events (B179): the mirror writes one Requirements
   line per square, bidirectionally. The board itself materializes on its own
   morning (B108, B131), so a square dated ahead waits in the store.

   Line identity is positional in the mirror's own order (see syncMirror); a
   line outside the mirror's count is the reader's own and invisible to it.
   Squares keep id order (squareOrder). Deleting the linked board unlinks its
   date, no blocking, no orphan: the squares survive on their records.

   Rolling windows are COMPUTED at render from today: no array stored, no
   midnight write. A square is { id, rem, next, day: 'YYYY-MM-DD' } (PRD
   §4.1). */

const CAL_TITLE_SUFFIX = ' To Do';
/* Date keys are local-time YYYY-MM-DD; formatMDY stays the card stamp's
   formatter (UIUX §10). */
export function calKey(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

export const calMD = (d) => pad2(d.getMonth() + 1) + '/' + pad2(d.getDate());
export const calDayName = (d) => d.toLocaleDateString(undefined, { weekday: 'long' });

/* Consecutive local dates from `start` (today by default); `count` includes
   it. Entries are { key, date: Date, today: bool }, today decided by key. */
export function calWindow(count = 7, start = new Date()) {
  const days = [];
  const first = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const todayKey = calKey(new Date());
  for (let i = 0; i < count; i++) {
    const d = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i);
    const key = calKey(d);
    days.push({ key, date: d, today: key === todayKey });
  }
  return days;
}

/* One event record (PRD §4.1); the mirror reads squares, not events (B179).
   `time` (B142) is split OUT of `text`. */
export function newCalEvent(dateKey, text) {
  return makeRecord('event', { id: uuid(), date: dateKey, text: text || '', time: '', state: 'active' });
}

/* The linked board for a date, found by scanning the caller's snapshot for
   `cal`; `current` is authoritative for itself, hence live(). */
export function calBoardOf(all, dateKey) {
  for (const b of all) {
    const rec = live(b);
    if (rec.cal === dateKey) return rec;
  }
  return null;
}

/* Oldest first. */
export function calEventsOf(events, dateKey) {
  return events.filter(e => e.date === dateKey)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || (a.id < b.id ? -1 : 1));
}

export const boardsOf = (all) => all.filter((record) => record.title !== undefined);
export const eventsOf = (all) => all.filter((record) =>
  typeof record.date === 'string' && typeof record.text === 'string' && record.title === undefined);

/* The day-note squares (B179): records with `rem` and a `day` key. They read in
   id order, the store's key order, so the day cards and the Requirements chips
   share one order. */
export const isSquare = (r) =>
  typeof r.rem === 'string' && typeof r.day === 'string' && CALKEY_DATE.test(r.day);
export const squareOrder = (a, b) => (a.id < b.id ? -1 : 1);
export function squaresOf(all, dateKey) {
  return all.filter((r) => isSquare(r) && r.day === dateKey).sort(squareOrder);
}
// A square's text: `next`, unless it is a legacy calKey date.
export function squareText(r) {
  const n = typeof r.next === 'string' ? r.next : '';
  return CALKEY_DATE.test(n) ? '' : n;
}
// A square is one mirror line (B179): a run of CR/LF reads as one space.
export function mirrorLine(r) {
  return squareText(r).replace(/[\r\n]+/g, ' ');
}
/* An old event as the square it becomes (B179); null when its `date` is no
   calKey (no day card to land on). The id sorts before every app-made one
   ('rem-' + base-36 ms starts at 'm'): rem-0, the RAW createdAt in base 36
   padded to 9 (a missing one sorts first, as calEventsOf read it), then the
   event's id, so creation order survives and a re-conversion lands on the same
   record. Text stays untrimmed: a converted line equals its span line. */
export function squareFromEvent(ev) {
  if (!isDateKey(ev.date)) return null;
  return makeRecord('dayNote', {
    id: 'rem-0' + (Number.isFinite(ev.createdAt) ? Math.max(0, Math.floor(ev.createdAt)) : 0)
      .toString(36).padStart(9, '0') + '-' + ev.id,
    rem: '', next: typeof ev.text === 'string' ? ev.text : '', day: ev.date,
  });
}

/* Ensure a date's linked To-Do board exists (R5); returns it, already in
   `all`. Creating writes records, so every caller wraps this in
   commitAction. */
export function ensureLinkedBoard(all, dateKey) {
  let board = calBoardOf(all, dateKey);
  if (board) return { board, created: false };
  board = newBoardRecord();
  // "MM/DD/YY To Do" (R5), from the key with formatMDY's 2-digit year.
  const p = dateKey.split('-');                       // [YYYY, MM, DD]
  board.title = p[1] + '/' + p[2] + '/' + dateKey.slice(2, 4) + CAL_TITLE_SUFFIX;
  board.cal = dateKey;
  all.push(board);
  return { board, created: true };
}

/* The Requirements mirror (R5): rewrite the mirror's lines to the date's
   squares, keeping every hand-typed line. The span is SELF-RECORDED: `calReq`
   counts the lines the mirror last wrote, so deleting a square can never
   demote an old mirror line to a "hand" line. Span lines are rewritten
   wholesale in square order; the rest is the reader's, carried through. A
   board never synced has span 0: every line it holds is the reader's, and the
   squares land above them. Both surfaces land here to converge (B106); the
   span decides what a write owns, so they can never disagree. Requirements is
   one string, \n-separated (PRD §4.1). */
export function syncMirror(board, squares) {
  const lines = splitLines(board.requirements || '');
  const span = typeof board.calReq === 'number' ? board.calReq : 0;   // never synced: all hand
  const hand = lines.slice(span);              // lines the reader wrote
  const mirrored = squares.map(mirrorLine);
  const next = mirrored.concat(hand).join('\n');
  board.calReq = mirrored.length;              // the span moves to the new write
  if (next !== (board.requirements || '')) {
    board.requirements = next;
    return true;
  }
  return false;
}

/* Read the mirror back by position (the first lines are the mirror's), so a
   READER's line edit writes through to its square. */
export function mirrorSquaresOf(board, all) {
  const lines = splitLines(board.requirements || '');
  if (!board.cal) return [];
  const mine = squaresOf(all, board.cal);
  const span = typeof board.calReq === 'number' ? Math.min(board.calReq, lines.length) : 0;
  return lines.slice(0, span)
    .map((text, i) => ({ square: mine[i], text }))    // square may be undefined
    .filter(m => m.square);
}

// DOM plumbing: every surface the app draws into, shared by every module.
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
  paneRail: document.getElementById('pane-rail'),         // the collapsed All-Boards face (B118)
  paneCollapse: document.getElementById('pane-collapse'), // the expanded pane's Go Back control (B151)
  boardActions: document.getElementById('board-actions'),   // the board-action row (B83)
  actionBoards: document.getElementById('action-boards'),   // All Boards ⇄ This board toggle
  actionExport: document.getElementById('action-export'),   // Export this board (PDF · JSON, B92)
  actionImport: document.getElementById('action-import'),   // Import a JSON backup (B92)
  importFile: document.getElementById('import-file'),       // the import tab's file dialog
  calView: document.getElementById('cal-view'),             // calendar screen
  calRail: document.getElementById('cal-rail'),             // the standing rail face (B99)
  calBand: document.getElementById('cal-band'),             // header band (B157)
  calBandCard: document.getElementById('cal-band-card'),    // band title card (B157)
  calDayhead: document.getElementById('cal-dayhead'),       // the day head: the date alone
  calBandAdd: document.getElementById('cal-band-add'),      // today's "+", band right
  calTodayBoard: document.getElementById('cal-today-board'),// the Today board body
  calStack: document.getElementById('cal-stack'),
  calTop: document.getElementById('cal-top'),
  calBack: document.getElementById('cal-back'),
  calToday: document.getElementById('cal-today'),       // B148: the row's right anchor
  calMonth: document.getElementById('cal-month'),       // the month view's ground
  actionCalendar: document.getElementById('action-calendar'), // fourth board-action tab (B95)
};
export const anchorEls = {
  title: document.getElementById('anchor-title'),
  components: document.getElementById('anchor-components'),
  requirements: document.getElementById('anchor-requirements'),
};

/* Shared mutable state: globals written from more than one module live here,
   as a bare imported `let` is read-only in ESM. Never reassign or destructure
   the container; read members through `state`. */
const bootTier = readTier();    // seeds the arrangement flags from the one derivation
export const state = {
  current: null,          // the open board record (in memory)
  dirty: false,           // `current` holds an edit the debounce hasn't written
  // Arrangement tier: written by app.js's environment pass, read everywhere.
  isDesktop: bootTier.desktop,
  isWide: bootTier.wide,
  editVP: {
    floor: Infinity,       // smallest visual-viewport height seen this edit (keyboard fully up)
    width: 0,              // previous resize width; a fold changes width, the keyboard never does
    height: 0,             // paired with width so duplicate window/visualViewport events are inert
    startH: 0,             // layout-viewport height at edit start (B152); 0 = no baseline
    deferred: false,       // B28: a frame changed during editing and must land after the edit
    holdPending: false,    // B152: the restored room must land the held frame even if unchanged
  },
  menuInvoker: null,      // desktop contextmenu: focus returns here on close
  swallowTap: false,      // the pointerdown that dismissed a menu is inert (B30)
  calOpen: false,         // the MOBILE full-screen calendar (B95)
  calExpanded: false,     // wide's expanded panel (B99); rail alone is not open
};

/* Lookups against the open board; undefined on miss (Array.find). */
export const noteRec = (id) => state.current && state.current.notes.find((note) => note.id === id);
export const lotRec = (id) => state.current && state.current.parkingLot.find((item) => item.id === id);
export const live = (record) => state.current && record.id === state.current.id ? state.current : record;

/* New boards write their category (B63, B67) since the ladder rotates with
   board type. `newBoardIn` overrides the To-Do default with its section. */
export function newBoardRecord() {
  const now = Date.now();
  return makeRecord('board', { id: uuid(), createdAt: now, updatedAt: now, category: 'todo' },
    { now, defaultCategory: 'todo' });
}
