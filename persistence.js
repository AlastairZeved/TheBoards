/* --- 2. IndexedDB persistence -------------------------------------------- */
// issue #182 module wiring — native ESM, no bundler (AGENTS.md).
import { HIT_FLOOR, SAVE_DEBOUNCE, EMBED, state } from './state.js';
import { LEGACY_H, LOGICAL_H, LOGICAL_W } from './geometry.js';
import { clamp, hideSaveError, showSaveError } from './interactions.js';

// B124 embed: a throwaway namespace wiped before every open — the visitor's
// real `boards-db` is never touched by the embed (separate name, not a rename).
const DB_NAME = EMBED ? 'boards-db-embed' : 'boards-db', STORE = 'boards';

function openDB() {
  return new Promise((resolve, reject) => {
    const open = () => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    };
    if (!EMBED) { open(); return; }
    // Embed wipe-at-boot: every reload is a clean slate. onblocked still opens —
    // a stale tab holding the old DB must not wedge the fresh one.
    const del = indexedDB.deleteDatabase(DB_NAME);
    del.onsuccess = del.onerror = del.onblocked = open;
  });
}
const dbPromise = openDB();

export async function idbGetAll() {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const rq = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}
export async function idbPut(rec) {
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
export async function migrateLegacyBoards(all) {
  const adopt = (n) => {
    const wRatio = LOGICAL_W / (n.rw || 900);             // B32's legacy width ratio
    return {                                              // renderY's legacy branch,
      ...n,                                               // verbatim, incl. the clamp
      x: n.x * wRatio,                                    // that is what renders today
      y: clamp(n.y * (LOGICAL_H / LEGACY_H),
               0, Math.max(0, LOGICAL_H - HIT_FLOOR)),
      scale: (n.scale || 1) * wRatio,                     // rebaseNote's fold (B40/B64)
      rw: LOGICAL_W,
      rh: LOGICAL_H,                                      // noteK ≡ 1 for this note, forever
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
export async function idbDelete(id) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export async function idbGet(id) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const rq = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}

/* --- 3. State + save queue ----------------------------------------------- */
// Shared mutable state carrier (issue #182, B' ruling): only globals WRITTEN
// from more than one future module live here, so a module split can safely
// cross-module-write them (a bare imported `let` is read-only in ESM). The
// container is never reassigned and never destructured into locals; live-binding
// reads of state.<member> are legal from any module. Membership derived from a
// writers-map grep of the unsplit file; all other module-scope lets stay loose
// in their owning module.

/* The category is written, not defaulted (B67, extending B63's rule to the one
   creation path that predates it): since the ladder rotates with the type, an
   unwritten category is no longer invisible — it renders. A fresh install's
   board would open violet on an app named for its To-Do boards. `newBoardIn`
   overwrites this with the section the board is made in; the two empty-database
   paths (`ensureCurrentValid`, `boot`) are the ones this is for. Legacy pre-#58
   records still carry no category and still read as Note Boards — that is B21's
   read-site idiom, and changing it would cost a migration and a version bump. */

// Single-flight persist with exponential backoff; capture is never blocked.
export let saveTimer = null, persisting = false, dirtyAgain = false, retryDelay = 1000;
export function scheduleSave() { state.dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, SAVE_DEBOUNCE); }
export function saveNow() {
  clearTimeout(saveTimer);
  if (!state.current) return;
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
export function flushSave() {
  clearTimeout(saveTimer);
  if (!state.current) return;
  if (state.dirty) stampUpdated();
  persist();
}
/* The stamp is the whole of B69's order key. It deliberately does NOT turn the
   card's section back to page 1: a save renders nothing, and B42's page state
   exists so a re-render keeps the reader's place. An edit can therefore leave
   the open board's card on a page the reader is not looking at — as paging
   away already could — until they turn to page 1 and find it at the front. */
function stampUpdated() {
  state.current.updatedAt = Date.now();
  state.dirty = false;
}
export function persist() {
  if (!state.current) return;
  if (persisting) { dirtyAgain = true; return; }
  persisting = true;
  const snapshot = state.current;
  idbPut(snapshot).then(() => {
    persisting = false; retryDelay = 1000; hideSaveError();
    if (dirtyAgain) { dirtyAgain = false; persist(); }
  }).catch(() => {
    persisting = false; showSaveError();
    setTimeout(persist, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 16000);
  });
}
