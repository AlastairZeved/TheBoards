/* --- 2. IndexedDB persistence -------------------------------------------- */
import { SAVE_DEBOUNCE, EMBED, state } from './state.js';
import { hideSaveError, showSaveError } from './interactions.js';

// B124 embed: its own namespace, so the visitor's real `boards-db` is never
// touched. B136: the embed's database is never wiped at boot; it persists
// exactly like the plain app.
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
/* Failed-save backoff: one second, doubled per failure, up to sixteen. Long
   enough that a transient IndexedDB refusal heals itself, capped so an
   unwritable device cannot spin on it; the retry is fire-and-forget, so
   nothing in the app waits behind it. */
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
/* Flush on the way OUT of a board (swapBoard, openBoardById, newBoardIn): the
   pending edit is written, but `updatedAt` is stamped only if there was one.
   Leaving a board is not updating it: B69 orders every listing by that stamp,
   so an unconditional stamp would float the card just left to the top of its
   section (mobile never flushes) and outrank a board created in the same
   moment (B63: the new card lands first). */
export function flushSave() {
  clearTimeout(saveTimer);
  if (!state.current) return;
  if (state.dirty) stampUpdated();
  persist();
}
/* The stamp is the whole of B69's order key. It does NOT turn the card's
   section back to page 1: a save renders nothing, and B42's page state keeps
   the reader's place across a re-render. The open board's card can therefore
   sit on a page the reader is not looking at until they turn to page 1. */
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
