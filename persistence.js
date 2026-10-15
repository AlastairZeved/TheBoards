/* --- 2. IndexedDB persistence -------------------------------------------- */
// issue #182 module wiring — native ESM, no bundler (AGENTS.md).
import { SAVE_DEBOUNCE, EMBED, state } from './state.js';
import { hideSaveError, showSaveError } from './interactions.js';

// B124 embed: a throwaway namespace wiped before every open — the visitor's
// real `boards-db` is never touched by the embed (separate name, not a rename).
// B136 (issue #280) retires the wipe-at-boot clause: the embed's namespace
// persists exactly like the plain app. The separate name itself survives.
const DB_NAME = EMBED ? 'boards-db-embed' : 'boards-db', STORE = 'boards';

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
let dbPromise;
function db() {
  if (!dbPromise) dbPromise = openDB();
  return dbPromise;
}

function withStore(mode, operation) {
  return db().then((database) => new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, mode);
    const result = operation(tx.objectStore(STORE));
    if (mode === 'readonly') {
      result.onsuccess = () => resolve(result.result);
      result.onerror = () => reject(result.error);
    } else {
      // A write succeeds with its transaction; the request value is unused.
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }
  }));
}
export async function idbGetAll() { return withStore('readonly', (store) => store.getAll()); }
export async function idbPut(rec) { return withStore('readwrite', (store) => store.put(rec)); }

export async function idbDelete(id) { return withStore('readwrite', (store) => store.delete(id)); }
export async function idbGet(id) { return withStore('readonly', (store) => store.get(id)); }

/* --- 3. State + save queue ----------------------------------------------- */
// Single-flight persist with exponential backoff; capture is never blocked.
let saveTimer = null, persisting = false, dirtyAgain = false, retryDelay = 1000;
export function scheduleSave() { state.dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, SAVE_DEBOUNCE); }
export function cancelPendingSave() { clearTimeout(saveTimer); }
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
