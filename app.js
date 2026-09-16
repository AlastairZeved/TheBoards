import { ACTION_DELAY, DESKTOP_MQ, LONGPRESS_MS, MOVE_THRESHOLD, TABLET_MQ, calKey, el, newBoardRecord, newCalEvent, state } from './state.js';
import { idbDelete, idbGet, idbGetAll, idbPut, migrateLegacyBoards, persist, saveNow } from './persistence.js';
import { LEGACY_H, LOGICAL_H, LOGICAL_W, applyLayout, calSqueeze, effScale, lotH, onViewportResize, rebaseNote, renderScale } from './geometry.js';
import { renderX, renderY, setCalSqueeze } from './geometry.js';
import { linkSource, noteEls, registerRender, renderBoard, updateLinks } from './render.js';
import { cancelGesture, clamp, clearSelection, commitAction, deleteNote, engaged, g, hideToast, leave, pointers } from './interactions.js';
import { registerInteractions, selected } from './interactions.js';
import { closeMenu, fillBoardAction, registerMenus } from './menus.js';
import { EXPORT_GEO, EXPORT_W, buildBoardPdf, exportBoardPdf, exportCalPdf, exportNoteBox, exportX, pdfTextW } from './export.js';
import { BOARD_CATS, GRID_ORDER, catOf, catOrder, catPageCap, catView, drillCat, goToList, listOpen, lotMenuOpen } from './boards.js';
import { checkDayRoll, makeCalDay, newBoardIn, openBoardObj, popping, registerBoards, renderCal, renderPane, returnToBoard, showCalRail, startCalLineEdit } from './boards.js';
import { swapBoard, swapping, syncDateMirror } from './boards.js';

// Test-observability bridge (issue #182): the black-box suites drive the page
// through page.evaluate, which reads page globals. Module scope does not leak
// to window, so the entry re-imports the observable surface and re-exposes it
// as live getters after boot(). Settled ruling: attach to window, no
// import-based test layer.

// issue #182 module wiring — native ESM, no bundler (AGENTS.md).

// The isTablet/isDesktop/isWide flags live on `state` (§3): applyMode writes
// them, every region reads them (issue #182, B' cross-module write).
// The initial html classes are applied by boot() via applyInitialMode — the
// flags live on `state`, so a load-time toggle here would hit the const's TDZ
// (state is declared at §3, after this block runs).

function applyMode() {
  state.isDesktop = DESKTOP_MQ.matches;
  state.isTablet = !state.isDesktop && TABLET_MQ.matches;
  state.isWide = state.isDesktop || state.isTablet;
  document.documentElement.classList.toggle('desktop', state.isDesktop);
  // The wide class is the CSS arrangement gate — every `html.desktop` rule
  // that draws the rail or the picker overlay is a wide rule now (B96).
  document.documentElement.classList.toggle('tablet', state.isTablet);
  document.documentElement.classList.toggle('wide', state.isWide);
  // Teardown: nothing half-finished survives the flip.
  clearSelection();
  closeMenu();
  cancelGesture();
  pointers.clear();
  if (state.isWide && listOpen) returnToBoard();  // pop the whole list nav → board (B9 intact;
                                                      // a drill is two levels deep, B74)
  // The calendar across the flip (issue #145): the panel arrangement belongs
  // to the wide grammar, so a flip while it is open closes it and pops its
  // history entry (nothing typed is lost — calendar lines live in linked
  // boards, not in the view). A flip TO a wide class re-enters via the tab.
  // B99 (issue #158): on wide the calendar is FURNITURE — the rail survives
  // every flip; only the mobile screen state and the wide EXPANDED panel
  // tear down (the expanded panel's squeeze must lift so the frame re-reads
  // the rail's 40px). Mobile, closed, hides the view outright as before.
  if (state.calOpen || state.calExpanded) {
    state.calOpen = false;
    state.calExpanded = false;
    el.calView.hidden = true;
    el.calView.classList.remove('rail-open', 'panel');
    el.calRail.hidden = true;
    setCalSqueeze(false);
    if (history.state && history.state.v === 'cal') history.back();
  }
  applyLayout();
  if (state.isWide) {
    renderPane();
    showCalRail();                   // the rail re-renders on every flip to wide (B99)
  } else {
    document.documentElement.classList.remove('has-cal-rail');
  }
}
DESKTOP_MQ.addEventListener('change', applyMode);
TABLET_MQ.addEventListener('change', applyMode);

/* The initial html arrangement classes, applied by boot() — NOT at load time.
   The isX flags live on `state`, which is declared at §3; a load-time toggle
   here would hit the const's TDZ (this block runs before §3). Same values,
   applied before boot's first marker, so the painted classes land identically. */
function applyInitialMode() {
  document.documentElement.classList.toggle('desktop', state.isDesktop);
  document.documentElement.classList.toggle('tablet', state.isTablet);
  document.documentElement.classList.toggle('wide', state.isWide);
}

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

async function boot() {
  // Boot-order characterization guard (issue #182): one marker per step, emitted
  // SYNCHRONOUSLY immediately before the step it names — before any await, so the
  // observable order cannot race the awaited work. These are permanent: they are
  // the guard that makes the phase-2 module split verifiable (import hoisting must
  // never reorder boot), not scaffolding to strip. test/boot-order.js pins them.
  applyInitialMode();               // html arrangement classes (state is initialized)
  registerRender();                 // toolbar keydown
  registerInteractions();           // pointer/focus/keydown/input listeners
  registerMenus();                  // board-action row fill + click/contextmenu listeners
  registerBoards();                 // calendar + popstate listeners
  console.debug('boot:layout');
  applyLayout();                 // establishes LEGACY_H before the migration reads it —
                                 // the first applyLayout otherwise fires inside openBoardObj,
                                 // after storage is already being rendered (B93)
  console.debug('boot:idb');
  const all = await idbGetAll();
  console.debug('boot:migrate');
  const adopted = await migrateLegacyBoards(all);   // B93: legacy notes onto the single path,
                                                    // written straight to IDB — nothing is
                                                    // open or debounced yet
  let board;
  // Events ride the boards store (B105) with no `updatedAt` — `undefined >
  // anything` is false, so an unfiltered reduce over the raw store returns
  // its first record verbatim; a store whose lowest uuid is an event then
  // boots an event as the board (renderBoard's crash, seen in CI). Boot
  // opens a BOARD: the most-recent record that has a title.
  const boards = all.filter(r => r.title !== undefined);
  if (!boards.length) { board = newBoardRecord(); await idbPut(board); }
  else { board = boards.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a)); }  // launch → most recent
  console.debug('boot:open');
  openBoardObj(board);
  console.debug('boot:pane-rail');
  if (state.isWide) renderPane();
  // The standing calendar rail (issue #158, B99): furniture renders at boot on
  // wide, no press required. The has-cal-rail class gates its CSS (the
  // section must not render as a 40px sliver where the feature isn't armed).
  // Mobile never sees it (its calendar stays the tab-driven full-screen view).
  if (state.isWide) {
    document.documentElement.classList.add('has-cal-rail');
    showCalRail();
  }
  // The day-roll launch (issue #153, B105): if today carries events, the app
  // opens the day's linked To-Do board instead of the last-touched one.
  checkDayRoll();
}
boot();

/* Publish the observable surface to window for the black-box suites.
   Getters, not snapshots: a mutable let is read at test time, exactly like the
   classic-script global it replaces. Runs after boot() so the app is live. */
for (const n of ['ACTION_DELAY', 'BOARD_CATS', 'EXPORT_GEO', 'EXPORT_W', 'GRID_ORDER', 'exportBoardPdf', 'exportCalPdf', 'LEGACY_H', 'LOGICAL_H', 'LOGICAL_W', 'LONGPRESS_MS', 'MOVE_THRESHOLD', 'buildBoardPdf', 'calKey', 'calSqueeze', 'catOf', 'catOrder', 'catPageCap', 'catView', 'clamp', 'commitAction', 'deleteNote', 'drillCat', 'effScale', 'el', 'engaged', 'exportNoteBox', 'exportX', 'fillBoardAction', 'g', 'goToList', 'hideToast', 'idbDelete', 'idbGet', 'idbGetAll', 'idbPut', 'leave', 'linkSource', 'listOpen', 'lotH', 'lotMenuOpen', 'makeCalDay', 'newBoardIn', 'newBoardRecord', 'newCalEvent', 'noteEls', 'pdfTextW', 'persist', 'popping', 'rebaseNote', 'renderBoard', 'renderCal', 'renderPane', 'renderScale', 'renderX', 'renderY', 'returnToBoard', 'saveNow', 'selected', 'startCalLineEdit', 'state', 'swapBoard', 'swapping', 'syncDateMirror', 'updateLinks']) {
  Object.defineProperty(window, n, { get: () => eval(n), configurable: true });
}


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
const OWN_BUILD = 'v60';
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
