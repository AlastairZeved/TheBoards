/* --- 2. IndexedDB persistence -------------------------------------------- */
import { SAVE_DEBOUNCE, EMBED, state } from './state.js';
import { hideSaveError, showSaveError } from './interactions.js';

// B124 embed: its own namespace, never the visitor's `boards-db`; B136: never
// wiped at boot.
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
/* Failed-save backoff: 1s doubling to 16s; the retry is fire-and-forget. */
const RETRY_MS_MIN = 1000, RETRY_MS_MAX = 16000;
let saveTimer = null, persisting = false, dirtyAgain = false, retryDelay = RETRY_MS_MIN;
export function scheduleSave() { state.dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, SAVE_DEBOUNCE); }
export function cancelPendingSave() { clearTimeout(saveTimer); }
export function saveNow() {
  clearTimeout(saveTimer);
  if (!state.current) return;
  stampUpdated();
  persist();
}
/* Flush on the way OUT of a board (swapBoard, openBoardById, newBoardIn):
   stamp `updatedAt` only if dirty. B69 orders listings by that stamp, so an
   unconditional stamp would float the card just left above a board created in
   the same moment (B63: the new card lands first). */
export function flushSave() {
  clearTimeout(saveTimer);
  if (!state.current) return;
  if (state.dirty) stampUpdated();
  persist();
}
/* The stamp is B69's order key. It does NOT reset the section to page 1 (a
   save renders nothing; B42 keeps the reader's place), so the open board's
   card may sit off the reader's page until they turn to page 1. */
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
    persisting = false; retryDelay = RETRY_MS_MIN; hideSaveError();
    if (dirtyAgain) { dirtyAgain = false; persist(); }
  }).catch(() => {
    persisting = false; showSaveError();
    setTimeout(persist, retryDelay);
    retryDelay = Math.min(retryDelay * 2, RETRY_MS_MAX);
  });
}
