import { ACTION_DELAY, DESKTOP_MQ, EMBED, EMBED_MODE, TABLET_MQ, boardsOf, calKey, el, newBoardRecord, newCalEvent, readTier, state } from './state.js';
import { idbDelete, idbGet, idbGetAll, idbPut, persist } from './persistence.js';
import { LOGICAL_H, LOGICAL_W, applyLayout, calSqueeze, inEnvironmentPass, lotH, migrateLegacyBoards, onViewportResize, renderX } from './geometry.js';
import { linkSource, noteEls, registerRender, renderBoard, updateLinks } from './render.js';
import { cancelGesture, clearSelection, commitAction, deleteNote, engaged, g, hideToast, leave, pointers, registerInteractions, selected } from './interactions.js';
import { closeMenu, registerMenus } from './menus.js';
import { EXPORT_GEO, buildBoardPdf, exportBoardPdf, exportNoteBox, pdfTextW } from './export.js';
import { catOf, catOrder, catPageCap, catView, checkDayRoll, drillCat, goToList, hideCalRail, listOpen, lotMenuOpen, openBoardObj, registerBoards, renderCal, renderPane, returnToBoard, showCalRail, swapBoard, collapsePane, tearDownCal } from './boards.js';

/* --- B125 frame-guard -----------------------------------------------------
   Framed only by its own origin or https://alastairzeved.com. Runs before
   boot(): on denial the document is blanked and the module aborts, so no
   IndexedDB is opened. ancestorOrigins is Chromium-only; browsers without it
   default-ALLOW (B125, a recorded ruling). Compare exact origins, never a
   string prefix. */
function frameGuard() {
  if (window.top === window.self) return;                 // not framed: inert
  const origins = window.location.ancestorOrigins;        // DOMTokenList, Chromium only
  if (!origins || origins.length === 0) return;           // B125: no API → default-allow
  const allowed = ['https://alastairzeved.com', window.location.origin];
  for (let i = 0; i < origins.length; i++) {
    if (allowed.indexOf(origins[i]) !== -1) return;       // exact origin match
  }
  document.documentElement.textContent = '';              // blank, no redirect
  throw new Error('frame-guard: framing origin not allowed (B125)');
}

/* --- Trusted Types default policy ------------------------------------------
   index.html's CSP requires Trusted Types for 'script', so DOM sinks throw
   without a Trusted* value. The only HTML sink input is developer-owned GLYPH
   SVG and the only script-URL sink is the 'sw.js' registration; the identity
   policy passes both, so no user-data path is touched. Created before boot():
   its first render is the first sink write, and module imports evaluate
   without writing any sink. Engines without Trusted Types ignore the
   directive; the guard makes this a no-op there. */
if (window.trustedTypes) {
  try {
    window.trustedTypes.createPolicy('default', {
      createHTML: (s) => s,        // identity: only GLYPH reaches an HTML sink
      createScriptURL: (s) => s,   // identity: only the 'sw.js' registration
    });
  } catch (_) { /* a default policy already exists: it governs, evaluation continues */ }
}
frameGuard();

/* ONE environment pass. The resize listeners and MQ changes are triggers
   only: each schedules this pass, and all of a fold's triggers coalesce onto
   one animation frame. The pass reads the environment once and derives tier
   and frame from that read, so the frame is never computed against a stale
   tier: engines fire window.resize, visualViewport.resize and the MQ change in
   no fixed order (Gecko flushes MQ on layout, bugzilla 1451717). A pass that
   finds neither tier nor viewport changed does nothing. B103: width is the
   classifier, foldable APIs are not read. */
let envRaf = 0;
let lastEnv = null;                     // the environment the last pass applied
function scheduleEnvironment() {
  if (envRaf) return;                   // three triggers, one pass
  envRaf = requestAnimationFrame(() => { envRaf = 0; applyEnvironment(); });
}
function applyEnvironment() {
  const vw = window.innerWidth, vh = window.innerHeight;
  // B124 embed: a forced view pins the tier (the MQ listeners are not
  // registered under EMBED_MODE, so this covers the resize path only).
  const { desktop, tablet, wide } = readTier();   // one derivation, boot or flip
  const tierChanged = wide !== state.isWide;
  // B152: a focusout hold armed the pass. The keyboard-up resizes were
  // consumed by the editing guard, so the retraction can read unchanged
  // against lastEnv and still owe the held frame one application.
  const changed = !lastEnv || tierChanged || vw !== lastEnv.vw || vh !== lastEnv.vh ||
                  state.editVP.holdPending;
  state.editVP.holdPending = false;
  lastEnv = { vw, vh, wide };
  if (!changed) return;
  inEnvironmentPass(true);
  try {
    if (tierChanged) applyTier({ desktop, tablet, wide });
    // B152: an application discharges the focusout hold; no stale baseline
    // may outlive it (a later edit in a smaller room must re-baseline).
    if (!applyLayout(vw, vh)) { state.editVP.deferred = false; state.editVP.startH = 0; }
  } finally {
    inEnvironmentPass(false);
  }
}

/* The tier half of a pass: flags, html arrangement classes, flip teardown.
   Never lays out itself: the pass applies one frame after it returns, so a
   flip whose collapsePane changes the rail width still costs one application
   (inEnvironmentPass keeps the rail setters from laying out underneath). */
function setTierClasses({ desktop, tablet, wide }) {
  state.isDesktop = desktop;
  state.isWide = wide;
  document.documentElement.classList.toggle('desktop', desktop);
  document.documentElement.classList.toggle('tablet', tablet);
  // `wide` gates the rail and calendar-panel arrangement in CSS (B96).
  document.documentElement.classList.toggle('wide', wide);
}
function applyTier(tier) {
  setTierClasses(tier);
  // Teardown: nothing half-finished survives the flip.
  clearSelection();
  closeMenu();
  cancelGesture();
  pointers.clear();
  if (state.isWide && listOpen) returnToBoard();  // pops the whole list nav
                                                  // (B9; a drill is two deep)
  // B99: the rail survives every flip; only the mobile screen state and the
  // wide EXPANDED panel tear down (its squeeze must lift so the frame re-reads
  // the rail's 40px). A flip to wide re-enters through showCalRail below.
  if (state.calOpen || state.calExpanded) {
    tearDownCal({ popHistory: true });
  }
  // A fold under a focused editor flips the tier but holds the frame (applying
  // would move the board out from under the caret): applyLayout defers
  // (geometry.js:deferLayoutIfEditing) and the held frame lands on focusout
  // (interactions.js:onFocusOut).
  if (state.isWide) {
    collapsePane();                  // B118: re-enter wide collapsed
    renderPane();
    showCalRail();                   // B99: re-rendered on every flip to wide
  } else {
    hideCalRail();
  }
}
if (!EMBED_MODE) {                    // B124: a forced view is never re-applied
  DESKTOP_MQ.addEventListener('change', scheduleEnvironment);
  TABLET_MQ.addEventListener('change', scheduleEnvironment);
}

function applyInitialMode() {
  setTierClasses(readTier());
}

/* --- 12. Boot + service worker ------------------------------------------- */
// onViewportResize owns the keyboard laws (B28/B80, fold guard) and returns
// true when it consumed the event; anything else schedules the pass.
function onResize() {
  if (onViewportResize()) return;
  scheduleEnvironment();
}
window.addEventListener('resize', onResize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

/* Sections are sized by their type (B37/B47) and the faces are font-display:
   swap (B50), so boot measures the fallback. Re-measure once when the real
   faces land, or a re-wrapped title leaves a control off its compartment
   edge. */
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => applyLayout());

async function boot() {
  // Boot-order guard: each marker is emitted synchronously right before the
  // step it names, ahead of any await, so the observable order cannot race
  // awaited work. Imports hoist, so no boot step may run at an imported
  // module's top level; test/boot-order.js pins the markers.
  applyInitialMode();               // html classes before first render
  // B118: wide boots with the rail collapsed BEFORE any layout, migration or
  // render reads the frame (setPaneCollapsed skips its layout while
  // state.current is null; boot:layout computes the collapsed frame).
  if (state.isWide) collapsePane();
  registerRender();                 // toolbar keydown
  registerInteractions();           // pointer/focus/keydown/input listeners
  registerMenus();                  // board-action row fill + click/contextmenu listeners
  registerBoards();                 // calendar + popstate listeners
  console.debug('boot:layout');
  applyLayout();                 // B93: sets LEGACY_H before migration reads it
  console.debug('boot:idb');
  const all = await idbGetAll();
  console.debug('boot:migrate');
  const adopted = await migrateLegacyBoards(all, idbPut);   // B93: straight to
                                                    // IDB, nothing open yet
  let board;
  // Events share the boards store (B105) and have no `updatedAt`, so reducing
  // the raw store could boot an event and crash renderBoard: open the
  // most-recent BOARD, one with a title (B112).
  const boards = boardsOf(all);
  if (!boards.length) { board = newBoardRecord(); await idbPut(board); }
  else { board = boards.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a)); }  // launch → most recent
  console.debug('boot:open');
  openBoardObj(board);
  console.debug('boot:pane-rail');
  if (state.isWide) renderPane();
  // B99: the rail renders at boot on wide. has-cal-rail gates its CSS so the
  // section is never a 40px sliver where the feature isn't armed.
  if (state.isWide) {
    showCalRail();
  }
  // Morning landing (B105, B107, B108): opens today's linked To-Do board.
  checkDayRoll();
}
boot();

/* Test bridge: the black-box suites read page globals via page.evaluate and
   module scope does not leak to window, so the entry re-exposes the observable
   surface (no import-based test layer). Live getters, not snapshots (mutable
   lets are read at test time), published after boot() so the app is live;
   static, not eval(), which CSP forbids and which is itself an XSS sink. */
const SURFACE = {
  get ACTION_DELAY() { return ACTION_DELAY; },
  get EXPORT_GEO() { return EXPORT_GEO; },
  get exportBoardPdf() { return exportBoardPdf; },
  get LOGICAL_H() { return LOGICAL_H; },
  get LOGICAL_W() { return LOGICAL_W; },
  get buildBoardPdf() { return buildBoardPdf; },
  get calKey() { return calKey; },
  get calSqueeze() { return calSqueeze; },
  get catOf() { return catOf; },
  get catOrder() { return catOrder; },
  get catPageCap() { return catPageCap; },
  get catView() { return catView; },
  get commitAction() { return commitAction; },
  get deleteNote() { return deleteNote; },
  get drillCat() { return drillCat; },
  get el() { return el; },
  get engaged() { return engaged; },
  get exportNoteBox() { return exportNoteBox; },
  get g() { return g; },
  get goToList() { return goToList; },
  get hideToast() { return hideToast; },
  get idbDelete() { return idbDelete; },
  get idbGet() { return idbGet; },
  get idbGetAll() { return idbGetAll; },
  get idbPut() { return idbPut; },
  get leave() { return leave; },
  get linkSource() { return linkSource; },
  get listOpen() { return listOpen; },
  get lotH() { return lotH; },
  get lotMenuOpen() { return lotMenuOpen; },
  get newBoardRecord() { return newBoardRecord; },
  get newCalEvent() { return newCalEvent; },
  get noteEls() { return noteEls; },
  get pdfTextW() { return pdfTextW; },
  get persist() { return persist; },
  get renderBoard() { return renderBoard; },
  get renderCal() { return renderCal; },
  get renderPane() { return renderPane; },
  get renderX() { return renderX; },
  get returnToBoard() { return returnToBoard; },
  get selected() { return selected; },
  get state() { return state; },
  get swapBoard() { return swapBoard; },

  get updateLinks() { return updateLinks; }
};
Object.defineProperties(window, Object.getOwnPropertyDescriptors(SURFACE));


// Register at top level, not in async boot: its IDB awaits can resolve after
// 'load' has fired and the listener would miss.
//
// Self-update (B79): browsers throttle sw.js re-fetches hard (up to a day on a
// home-screen app), so reg.update() runs on load and on every foreground (a
// relaunched PWA fires visibilitychange, not load). No forced reload: the new
// bytes arrive the next launch (test/sw-update.js uses the same path).
if ('serviceWorker' in navigator) {
  // B102: Firefox honors the script's max-age for SW fetches, so reg.update()
  // could re-check a stale sw.js; updateViaCache:'none' bypasses the HTTP cache
  // for the script itself (assets still ride SWR).
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

/* Build handshake (B102): the layers above assume the browser's ask for a new
   sw.js reaches the server, but a cache between device and host can answer it.
   So the app compares OWN_BUILD (below; must match sw.js's CACHE suffix,
   test/tokens.js) with sw.js fetched via cache:'reload' (HTTP cache and SWR
   bypassed). On the second consecutive mismatch it deletes every
   zeved-boards-v* cache (and the retired todo-boards-v*), unregisters the
   worker and reloads once; install IS addAll over the network, so the new
   worker reinstalls current. Two strikes, so one bad response (captive
   portal, proxy error page) cannot nuke a healthy install; the sessionStorage
   marker dies with the tab. Runs 20s after launch, off the critical path.
   Offline it does nothing: no authority to compare against.

   DATA IS NEVER TOUCHED: it deletes only Cache Storage and unregisters the
   worker; boards live in IndexedDB, which the handshake never opens, and
   B21's read-site defaulting renders an old record under a new build. */
const HANDSHAKE_MS = 20000;
const OWN_BUILD = 'v162';
if ('serviceWorker' in navigator && 'caches' in window) {
  const handshake = () => {
    fetch('sw.js', { cache: 'reload' }).then((res) => {
      if (!res.ok) return;
      return res.text().then((text) => {
        const m = text.match(/zeved-boards-v(\d+)/);
        if (!m) return;                       // unparseable: never act blind
        const served = 'v' + m[1];
        if (served === OWN_BUILD) {
          sessionStorage.removeItem('boards-build-mismatch');
          return;                             // healthy: device matches deploy
        }
        const seen = sessionStorage.getItem('boards-build-mismatch');
        if (seen === served) {
          // twice in a row, same wrong answer: self-heal.
          caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k.startsWith('zeved-boards-v') || k.startsWith('todo-boards-v'))
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
  setTimeout(handshake, HANDSHAKE_MS);
}
