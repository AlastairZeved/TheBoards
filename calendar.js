/* --- 11.6 The rolling temporal calendar (issue #145) ----------------------
   The third screen uses a rolling 30-day window computed at render (issue #398).
   Events mirror into their linked To-Do boards (state.js §1.7). Go Back is the
   visible mobile exit (B134/B151) and pops the history entry (B9); Today is the
   second row control (B148), while All Boards and Export remain elsewhere.
   The stack scrolls vertically on overflow (issue #391, B161), while the view
   itself remains a bounded page.

   Module split (issue #433): boards.js owns §11 (board list + routing); this
   module owns §11.6 (calendar). boards.js imports showCal/hideCal from here for
   its popstate branch — a legal ESM cycle, cross-module bindings read inside
   function bodies (CLAUDE.md). This module imports closeLotMenu, hideListView,
   listOpen, catView and swapBoard from boards.js. */
import {
  el, EMBED, state, COPY, CE, CALKEY_DATE,
  calDayName, calMD, calKey, calEventsOf, calWindow,
  boardsOf, calBoardOf, eventsOf, makeDayNoteRecord, mirrorEventsOf,
  syncMirror, ensureLinkedBoard,
} from './state.js';
import { flushSave, idbDelete, idbGetAll, idbPut, scheduleSave } from './persistence.js';
import { caretToEnd, hitInset, setCalSqueeze } from './geometry.js';
import { renderBoard } from './render.js';
import { commitAction } from './interactions.js';
import { syncBoardActions } from './menus.js';
import { closeLotMenu, hideListView, leaveListState, listOpen, catView, swapBoard } from './boards.js';

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
   aperture). Tapping it expands the panel, which squeezes the board beside it,
   and the panel's own Go Back control (B134, issue #259; B151,
   issue #353) returns the rail. The rail commits
   nothing (B81: navigation runs raw); no history is pushed on wide, and the
   rail stays outside the screen-grammar branches for a pushed calendar view. */
function renderCalRail() {
  if (!state.isWide) return;
  el.calView.hidden = false;          // the rail is standing furniture: never hidden on wide
  const today = new Date();
  el.calRail.querySelector('.cdate').textContent =
    calDayName(today).slice(0, 3) + ' ' + calMD(today);
  // The dot is the aperture (mockup 6): lit iff today carries events.
  flushSave();
  idbGetAll().then((all) => {
    const lit = calEventsOf(eventsOf(all), calKey(today)).length > 0;
    el.calRail.querySelector('.cdot').classList.toggle('lit', lit);
  });
}

export function showCalRail() {
  leaveListState();                   // close the lot menu, hide the list view, reset the flags
  el.calView.hidden = false;
  el.calView.classList.add('rail-open');
  el.calView.classList.remove('panel');
  setCalSqueeze(false);               // collapsed: the 40px reservation only
  el.calRail.hidden = false;
  el.calRail.setAttribute('aria-expanded', 'false');
  renderCalRail();
}

export function expandCalRail() {
  el.calView.classList.remove('rail-open');
  el.calView.classList.add('panel');
  el.calRail.hidden = true;
  el.calRail.setAttribute('aria-expanded', 'true');
  state.calExpanded = true;                 // the screen-grammar state rides the PANEL, not the rail
  setCalSqueeze(true);                // the board reflows beside the panel
  renderCal();                        // the expanded face: the rolling 30-day stack
}

function collapseCalRail() {
  el.calView.classList.add('rail-open');
  el.calView.classList.remove('panel');
  el.calRail.hidden = false;
  el.calRail.setAttribute('aria-expanded', 'false');
  state.calExpanded = false;
  setCalSqueeze(false);               // the squeeze lifts; the board returns
  renderCalRail();
}

export function showCal() {
  // Wide enters through the standing rail (B99); mobile keeps the pushed
  // full-screen view (B95's mobile path, unchanged).
  if (state.isWide) { showCalRail(); return; }
  state.calOpen = true;
  leaveListState();                   // close the lot menu, hide the list view, reset the flags
  // The squeeze is the desktop/tablet arrangement: the panel takes
  // real width beside the board; on mobile the calendar is the full screen.
  el.calView.classList.toggle('panel', state.isWide);
  setCalSqueeze(state.isWide);
  renderCal();
}

export function hideCal() {
  if (!state.calOpen && !state.calExpanded) return;
  state.calOpen = false;
  state.calExpanded = false;
  el.calView.hidden = !state.isWide;       // wide: the rail face remains (furniture, B99)
  el.calView.classList.remove('panel');   // the expanded face lifts
  el.calView.classList.toggle('rail-open', state.isWide);
  el.calRail.hidden = !state.isWide;
  setCalSqueeze(false);              // the squeeze lifts; the frame returns
  syncBoardActions();
  if (!state.isWide) renderBoard();
  else renderCalRail();
}

export function makeCalDay(day, dayNotes, board) {
  const card = document.createElement('div');
  // Issue #385 (B159): Saturday and Sunday cards carry the weekend class —
  // the Calendar palette and title-card squares. Issue #398 adds a distinct
  // Sunday marker for the divider; today's card never renders in the stack.
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
  // Issue #397 (B165): the day's "+" seats UNDER the day/date, in the card's
  // date compartment — no longer on the event bar's right-most side. The
  // .cal-add treatment (the 28px bounded box, B158's correction) stands; only
  // the seat moves. The freed row space holds the day's third square before
  // the pager. Issue #384's row-side seat ("+" rightmost) retires here —
  // renderCalDayNotes no longer builds an add button; today's own "+"
  // stays on the band (el.calBandAdd, B158's seat, untouched).
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'cal-add';
  add.setAttribute('aria-label', 'Add a note ' + calMD(day.date));
  add.textContent = '+';
  add.addEventListener('click', () => addCalNote(day.key));
  dc.append(add);
  // Issue #363: the day's own zone is its day-note squares — the calendar
  // events that used to render as text lines here no longer render at all;
  // the sync machinery keeps syncing, the card shows only the squares.
  const zone = document.createElement('div');
  zone.className = 'cal-notes on-dark';
  renderCalDayNotes(zone, day, dayNotes);
  card.append(dc, zone);
  return card;
}

/* Re-sync a date's whole mirror after any event write: the board's span is
   rewritten from the live event list (one writer). */
export async function syncDateMirror(dateKey) {
  const all = await idbGetAll();
  const boards = boardsOf(all);
  const board = calBoardOf(boards, dateKey);
  if (!board) return;
  if (syncMirror(board, calEventsOf(eventsOf(all), dateKey))) await idbPut(board);
}

/* The REVERSE direction of the retired calendar-side line editor (issue
   #154, B106): a board-side Requirements commit writes through to the event records the mirror's span
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

/* --- The day-roll launch (issue #153, B105) + the morning lifecycle (B108) --
   Each morning's first load, TODAY's linked To-Do board exists — created by
   `ensureLinkedBoard` even with zero events (B107's unconditional landing,
   superseding B105's events-exist-only morning condition) — and boot lands
   on it, carrying forward yesterday's incomplete notes (below). The check
   still runs ONCE PER DAY KEY: at boot, and at renderCal only when the
   today key changed since the last check (the open-past-midnight case) —
   never per render, so it cannot steal focus mid-interaction.
   B162 (issue #394) makes the MID-SESSION roll the full morning routine in
   both cases — the day's board is ensured, yesterday's incompletes carry,
   and the app lands on the new day, eventless or not — superseding
   B105/B108's "navigates only when the day carries events and carries
   nothing forward" mid-session clause; and the day key is STAMPED INSIDE
   the consequence, so a launch dropped by commitAction's guard (B81) is
   retried at the next check instead of losing the day. */
let rollDay = null;                     // the day key the roll check last ran for

export function checkDayRoll() {
  const today = calKey(new Date());
  if (rollDay === today) return;
  launchTodayBoard(today);
}

async function launchTodayBoard(today) {
  commitAction(async () => {            // creating the board is a consequence
                                        // (ensureLinkedBoard's contract, B81) —
                                        // same wrap as the retired event-add chain's
    // B162 (issue #394): the day is stamped HERE, inside the consequence —
    // not at the check. A stamp before this point was lost with a dropped
    // launch (commitAction's guard is a hard silent drop), and the
    // once-per-day guard then refused every later retry, stranding the day
    // until the OS restarted the page. Stamped here, a dropped launch
    // leaves the day unstamped and the next check retries it whole.
    // The stamp RESETS on a throw: an IDB rejection mid-consequence
    // (idbGetAll, the sweep's deletes, the carry's put) must not strand the
    // day either — rollDay returns to null so the next keyed check retries
    // the routine whole, the same promise the drop path makes.
    rollDay = today;
    // The guarded body: everything after the stamp, unwound on failure.
    try {
      // B131: the boot pick can BE a ghost (the most-recent record is often a
      // future board the pre-fix build created). Detach it BEFORE flushSave —
      // persist() early-returns on no current, so the ghost's snapshot never
      // lands behind the sweep's delete and resurrects it.
      if (state.current && state.current.cal > today &&
          !(state.current.notes || []).length) state.current = null;
      flushSave();
      const all = await idbGetAll();
      const boards = boardsOf(all);
      const { board } = ensureLinkedBoard(boards, today);
      // B162: this block is no longer the morning's alone — the mid-session
      // roll (the open-past-midnight case) runs the same routine: the mirror
      // span defaults, the B131 sweep, and the carry, then the landing below.
      // The old mid-session early-return for an eventless day is gone.
      if (board.calReq === undefined) {
        // B131 (issue #250): the first sync (the retired event-add's job) no longer does for a
        // future-dated event's board — the span is the events it already had.
        board.calReq = calEventsOf(eventsOf(all), today).length;
      }
      // B131 migration sweep: linked boards already created for future dates
      // by the pre-fix build are derived empty state — delete them once (the
      // event records survive; they live in the store separately).
      for (const b of boards.slice()) {
        // No current-board guard: the sweep runs before the landing swaps
        // current to today's board, and the most-recent pick could BE a ghost
        // — skipping it would defeat the sweep.
        if (b !== board && b.cal > today && !(b.notes || []).length) {
          boards.splice(boards.indexOf(b), 1);
          await idbDelete(b.id);
        }
      }
      await carryForward(boards, board, today);
      if (state.current && state.current.id === board.id) persist();
      else await idbPut(board);
      await syncDateMirror(today);
      // Step off the calendar first — mobile pops the pushed {v:'cal'} (B9),
      // wide collapses the expanded panel to its rail — then the plain swap.
      if (state.calOpen) goCalBack();
      else if (state.calExpanded) collapseCalRail();
      swapBoard(board.id);
    } catch (e) {
      rollDay = null;                 // un-stamp: the day is not yet served
      throw e;                        // fire-and-forget per file idiom — the
    }                                 // next keyed check retries it whole
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
  flushSave();
  idbGetAll().then(paintCal);
}

/* The expanded face's one painter, synchronous on a store read: the day
   cards (issue #363: each card is its day-note squares) and the month view.
   renderCal is its caller after the fetch; addCalNote paints directly so the
   new block is in the DOM the moment its editor arms — no race with the
   async fetch. */
function paintCal(all) {
  el.calStack.textContent = '';
  // Issue #343: the day head rode inside #cal-stack as its first child,
  // where the stack's bottom-anchor seated it directly above the day rows.
  // Issue #382 (B157): the head moved into the header band — a static child
  // of #cal-band-card in index.html, above the stack. Issue #384: the band
  // keeps B157's anatomy verbatim (bar, rule, overhanging card); today's day
  // card leaves the stack and becomes the deep-orange body BELOW the band
  // (#cal-today-board, renderCalToday), and the rolling window's future dates
  // render in the stack (issue #398: the next 30 days).
  renderCalDayhead();
  // UIUX §6/B7's collar on the exit row (issue #156, B98; retargeted by B134,
  // issue #259): the row's tab draws at the floor as a visible frame now, and
  // the collar tops up the width where geometry is tight — spent
  // edge-ward/downward since the row reseated at the view's bottom, never up
  // into the month view above it. The calendar is an unscaled surface, so the
  // draw scale k is 1 — the same arithmetic, one caller shape fewer than the
  // board row (no renderScale term). isDesktop inside hitInset picks the
  // 44px touch floor vs the 24px pointer floor, so B96's tablet tier
  // inherits the right one. Half-pixel headroom, per the board row's note.
  el.calTop.style.setProperty('--hit', (hitInset(el.calTop, 1) + 0.5) + 'px');
  const days = calWeekAnchor ? calWeekOf(calWeekAnchor) : calWindow(CAL_FUTURE_DAYS + 1);
  const events = eventsOf(all);      // event records ride the boards store (state.js §1.7)
  const notes = calNoteRecords(all); // the day-note records (issue #363: per day)
  const today = days.find((d) => d.today);
  if (today) renderCalToday(today, notes.filter((r) => r.day === today.key));
  for (const day of days) {
    if (day.today) continue;         // issue #384: today renders in the body below the band, not the stack
    const board = calBoardOf(all, day.key);
    el.calStack.appendChild(makeCalDay(day, notes.filter((r) => r.day === day.key), board));
  }
  renderCalMonth(new Set(events.map((e) => e.date)));
  seatCalAdds();                       // issue #384/#397: the band's "+" seat — the day "+" seats under the date, nothing to align
}

/* The band "+" seat (issue #384, the owner's corrections): the button is
   CENTERED in the band's right-of-card section. The card's width is
   max-content (B37), so the section's centre is measured, not guessed: one
   geometry read per paint sets the CSS var, and the CSS positions the box
   from it. Issue #397 (B165) retires the second half of this measurement —
   the day cards' push-over alignment (the retired row-side variable): the
   day "+" seats under the date now, in the compartment's own centred
   column, so nothing left to measure but the band. */
function seatCalAdds() {
  const band = el.calBand.getBoundingClientRect();
  const card = el.calBandCard.getBoundingClientRect();
  const mid = (card.right + band.right) / 2;           // the right-of-card section's centre, band-relative below
  el.calView.style.setProperty('--cal-add-x', (mid - band.left) + 'px');
}

/* --- The day-note squares (issue #363) -------------------------------------
   The top section (#cal-frame, #cal-notes, issues #329/#331/#336) is DELETED
   on every tier. Its stored records survive — the #323 disposition, nothing
   migrated, nothing stripped — and re-render as the one-zone deep-orange
   square blocks (issue #365) INSIDE each day card of the weekly stack: up to
   three squares per day, the card's own "+" to the right of the squares, and a ‹/› pager on the
   card when a day holds more than three.

   Per-day binding (the owner's ruling): the card's "+" writes a NEW `day`
   field on the record — the day card's calKey, written on add. A record
   without `day` (every record written before this ruling) has no day card to
   render on and stays unreachable, exactly as the retired `next`-occurrence
   value stayed stored-but-unread. CALENDAR EVENTS ARE NEVER READ HERE — the
   events keep syncing with the linked To-Do boards' Requirements (the mirror
   machinery untouched), they simply no longer render in the weekly stack:
   the card shows only the day-note squares. */
let calDayNotePage = {};             // per-day pager position: day.key -> page

const CAL_NOTE_PER_DAY = 3;          // the owner's cap: three squares per day
const CAL_FUTURE_DAYS = 30;          // issue #398: rolling stack beyond today's separate body

function calNoteRecords(all) {
  return all.filter((r) => typeof r.rem === 'string' && typeof r.day === 'string'
    && CALKEY_DATE.test(r.day));
}

// The record's body text: `next`, unless it is a legacy calKey date.
function calNoteBody(r) {
  const n = typeof r.next === 'string' ? r.next : '';
  return CALKEY_DATE.test(n) ? '' : n;
}

// The day-of-month ordinal suffix: 1st, 2nd, 3rd, 4th … 11th/12th/13th, 21st…
function calOrdinal(n) {
  const v = n % 100;
  return ['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th';
}

/* The day head (issues #341/#343, unchanged composition): today, weekday +
   month-day (no year) with the ordinal suffix as superscript. No add control. */
function renderCalDayhead() {
  const today = new Date();
  const head = el.calDayhead;
  // The head is a flex row (gap 6px) — the date and its suffix ride in ONE
  // span so they set as "3rd", not as two spaced flex items.
  const label = document.createElement('span');
  label.textContent =
    today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const sup = document.createElement('sup');
  sup.textContent = calOrdinal(today.getDate());
  label.appendChild(sup);
  head.textContent = '';
  head.appendChild(label);
}

/* One day card's notes zone (issue #363; one-zone squares per issue #365):
   the day's own records as square blocks — three shown (issue #397: the
   row's right end no longer seats the "+"; it sits under the date in
   makeCalDay, and the third square takes the space), the ‹/› pager on
   the card when a day holds more than three (the .mo-nav grammar; page
   state is per day, render-time only, nothing stored). Calendar events are
   never read here. No add button is built here — issue #384's band seat
   (today, el.calBandAdd) and issue #397's date-compartment seat (the six
   day cards, makeCalDay) own the adders now. */
const CAL_PAGER = { prev: '‹', next: '›' };

function renderCalDayNotes(zone, day, recs) {
  const row = document.createElement('div');
  row.className = 'cal-notes-row';
  const pages = Math.max(1, Math.ceil(recs.length / CAL_NOTE_PER_DAY));
  if (!calDayNotePage[day.key]) calDayNotePage[day.key] = 0;
  let page = Math.min(Math.max(calDayNotePage[day.key], 0), pages - 1);
  const hasPages = recs.length > CAL_NOTE_PER_DAY;
  const draw = () => {
    if (row.querySelector('[contenteditable]')) return;  // an edit is open — don't throw the typing away
    row.textContent = '';
    if (hasPages) {
      const prev = document.createElement('button');
      prev.type = 'button';
      prev.className = 'mo-nav cal-notes-nav';
      prev.setAttribute('aria-label', 'Previous ' + calMD(day.date) + ' notes');
      prev.textContent = CAL_PAGER.prev;
      prev.disabled = page <= 0;
      prev.hidden = page <= 0;
      prev.addEventListener('click', () => { page--; calDayNotePage[day.key] = page; draw(); });
      row.appendChild(prev);
    }
    const grid = document.createElement('div');
    grid.className = 'cal-notes-grid';
    grid.setAttribute('role', 'list');
    for (const r of recs.slice(page * CAL_NOTE_PER_DAY, page * CAL_NOTE_PER_DAY + CAL_NOTE_PER_DAY)) {
      grid.appendChild(makeCalNote(r));
    }
    row.appendChild(grid);
    if (hasPages) {
      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'mo-nav cal-notes-nav';
      next.setAttribute('aria-label', 'Next ' + calMD(day.date) + ' notes');
      next.textContent = CAL_PAGER.next;
      next.disabled = page >= pages - 1;
      next.hidden = page >= pages - 1;
      next.addEventListener('click', () => { page++; calDayNotePage[day.key] = page; draw(); });
      row.appendChild(next);
    }
    // Issue #397: no add button here — the day card's "+" seats under the
    // date in makeCalDay (the row's right end is the third square's now),
    // and today's "+" is the band's (el.calBandAdd, issue #384).
    zone.textContent = '';
    zone.appendChild(row);
  };
  draw();
}

/* Issue #384: the Today board body — today's day card leaves the weekly
   stack and becomes the full-width deep-orange body directly below the band
   (B157's band anatomy untouched: the bar keeps its water fall, the card
   keeps its centred seat and 22px overhang, which lands on this body's top —
   the card's own var(--card) fill, so card and body read as one board).
   The body's zone is the .cal-notes row grammar — today's squares at the day
   cards' own measure (the row is inset to the day card's date-compartment
   width, 84px + the shared 6px, so the squares sit exactly where a day
   card's squares sit), the ‹/› pager beyond three, and NO row "+": today's
   adder is seated on the band's right (seated above). Issue #397 changed
   nothing here — today's "+" keeps its B158 band seat. */
function renderCalToday(today, recs) {
  const add = el.calBandAdd;
  add.setAttribute('aria-label', 'Add a note ' + calMD(today.date));
  add.textContent = '+';
  add.onclick = () => addCalNote(today.key);
  const zone = document.createElement('div');
  zone.className = 'cal-notes on-dark';
  renderCalDayNotes(zone, today, recs);
  el.calTodayBoard.textContent = '';
  el.calTodayBoard.appendChild(zone);
}

/* Add a day note to a date (the one consequence, under commitAction's guard):
   the record is written with the NEW `day` field — the date's calKey, the
   per-day binding the squares render from — and its editor opens on arrival,
   the caret in the square's one zone (issue #365). The new record starts empty;
   only text entered in the square is written to it. */
async function addCalNote(dateKey) {
  commitAction(async () => {
    const rec = makeDayNoteRecord(dateKey);
    await idbPut(rec);
    const all = await idbGetAll();
    const recs = calNoteRecords(all).filter((r) => r.day === dateKey);
    const idx = recs.findIndex((r) => r.id === rec.id);
    calDayNotePage[dateKey] = Math.floor(Math.max(0, idx) / CAL_NOTE_PER_DAY);
    paintCal(all);                     // synchronous — the block is in the DOM now
    const block = [...document.querySelectorAll('.cal-notes-grid .cal-note')].find((b) => b.dataset.id === rec.id);
    if (block) startCalNoteEdit(block, rec);          // the caret starts in the square's one zone
  });
}

/* One square block: ONE zone now (issue #365) — the band is gone, the fill
   is one large body showing `next`. */
function makeCalNote(rec) {
  const block = document.createElement('div');
  block.className = 'cal-note';
  block.setAttribute('role', 'listitem');
  block.dataset.id = rec.id;
  const body = document.createElement('div');
  body.className = 'cal-note-text';
  body.textContent = calNoteBody(rec);
  block.append(body);
  // A tap opens the entry's editor in the square's one zone (issue #365;
  // the deferred re-assert lands the caret at the end whichever order the
  // native caret placement fires in, #304).
  block.addEventListener('click', (e) => {
    if (body.hasAttribute('contenteditable')) return;
    e.preventDefault();
    startCalNoteEdit(block, rec);
    setTimeout(() => caretToEnd(body), 0);
  });
  return block;
}

/* The one-zone editor (issue #365). The commit is the blur and writes `next`
   — `rem` is no longer rendered or edited and stays stored-but-unread (the
   #323 disposition). A commit that leaves both fields empty discards the
   record and the block (B8's rule: the frame must earn its keep). */
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
    if (!rec.rem && !next) {                        // B8: an empty commit discards
      await idbDelete(rec.id);
      block.remove();
      renderCal();
      return;
    }
    rec.next = next;
    await idbPut(rec);
    renderCal();
    scheduleSave();
  };
  block.addEventListener('focusout', (e) => {
    if (inside(e.relatedTarget)) return;
    commit();
  });
  body.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); body.blur(); }   // Enter ends the entry
  });
}

/* --- The month view (issue #191) ------------------------------------------
   A compact month grid in the viewport space #170 freed at the stack's
   bottom — no new rail, no new tab. Pure display: the only act a cell
   carries is the tap that swaps the week view to that date's week, run raw
   (navigation commits nothing, B81's rail precedent). Two anchors, both
   render-time state, nothing stored: the month on show
   (calMonthAnchor, starts at today's month) and the week the stack shows
   (calWeekAnchor — null means the shipped rolling 30-future-day window; a tap
   replaces it with the tapped date's Sunday-first week). */
let calMonthAnchor = null;
let calWeekAnchor = null;

const MO_WDS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/* The Sunday-first week containing `anchor`: seven consecutive days, today
   flagged by key comparison (the flag is computed, not positional — the
   tapped week usually does not contain today). */
function calWeekOf(anchor) {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - anchor.getDay());
  return calWindow(7, start);
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

export function registerCal() {
  el.calBack.addEventListener('click', () => {
    // On wide, Go Back IS the collapse act (B99, renamed by B134, B151): the
    // panel returns to the rail, the squeeze lifts — no history to pop (the
    // rail pushed none). On mobile, Go Back pops the pushed {v:'cal'} state
    // (B9's visible route).
    if (state.isWide && state.calExpanded) { collapseCalRail(); return; }
    goCalBack();
  });
  el.calToday.addEventListener('click', () => {
    // B148 (issue #342): Today resets both render-time anchors in one act —
    // `calMonthAnchor = null` puts the month view back on the current month
    // and `calWeekAnchor = null` returns the stack to its rolling 30-day
    // window — then re-renders. Issue #363: the day-note squares ride
    // the day cards renderCal re-draws, their per-day page positions
    // (calDayNotePage) unmodified.
    calMonthAnchor = null;
    calWeekAnchor = null;
    // Issue #363: the pager positions reset with the anchors — a reset to
    // "today" shows the squares' first page on every card.
    calDayNotePage = {};
    renderCal();
  });
  el.calRail.addEventListener('click', () => {
    // Furniture's one act: expand (B99). Pure navigation, no commit (B81).
    if (!state.isWide || state.calExpanded) return;
    expandCalRail();
  });
}
