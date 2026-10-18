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
const rawPut = (rec) => withStore('readwrite', (store) => store.put(rec));
/* Reads answer from the save queue first (§3): a board left while its save is
   failing reopens with the edits the store doesn't hold yet (issue #473). */
export async function idbGetAll() {
  const all = await withStore('readonly', (store) => store.getAll());
  const ahead = unsaved();
  if (!ahead.size) return all;
  const out = all.map((r) => ahead.get(r.id) || r);
  for (const [id, rec] of ahead) if (!all.some((r) => r.id === id)) out.push(rec);
  return out;
}
export async function idbGet(id) {
  const rec = await withStore('readonly', (store) => store.get(id));
  return unsaved().get(id) || rec;
}
/* A direct write or delete of a board supersedes its queued save, so a later
   retry can't write an older copy over it, or bring a deleted board back. A
   failed put hands the superseded save back to the queue. */
export async function idbPut(rec) {
  const prev = supersede(rec.id);
  try { return await rawPut(rec); } catch (e) { requeue(prev); throw e; }
}
export async function idbDelete(id) {
  supersede(id);
  return withStore('readwrite', (store) => store.delete(id));
}

/* --- 3. State + save queue ----------------------------------------------- */
// Single-flight persist with exponential backoff; capture is never blocked.
/* Failed-save backoff: 1s doubling to 16s; the retry is fire-and-forget. */
const RETRY_MS_MIN = 1000, RETRY_MS_MAX = 16000;
let saveTimer = null, retryTimer = null, retryDelay = RETRY_MS_MIN;
/* Each save carries the record it was issued for (issue #473): a retry, or a
   save queued behind an in-flight one, writes THAT board, never whichever
   board is open by then. One entry per board id, least recently saved
   first; `flight` is the put in progress, `dead` once a direct write or
   delete supersedes it. */
const queue = new Map();
let flight = null;
function unsaved() {
  const ahead = new Map();
  if (flight && !flight.dead) ahead.set(flight.rec.id, flight.rec);
  for (const [id, entry] of queue) ahead.set(id, entry.rec);
  return ahead;
}
function supersede(id) {
  const prev = queue.get(id) || (flight && !flight.dead && flight.rec.id === id ? flight : null);
  queue.delete(id);
  if (flight && flight.rec.id === id) flight.dead = true;
  return prev;
}
function requeue(entry) {
  if (!entry || queue.has(entry.rec.id)) return;   // a newer save of it is queued
  queue.set(entry.rec.id, { rec: entry.rec });
  if (!flight) { clearTimeout(retryTimer); retryTimer = setTimeout(drain, retryDelay); }
}
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
export function persist(rec = state.current) {
  if (!rec) return;
  queue.delete(rec.id);
  queue.set(rec.id, { rec });
  if (!flight) drain();
}
function drain() {
  clearTimeout(retryTimer);
  const entry = queue.values().next().value;
  // A direct write or delete can empty the queue under a pending retry:
  // nothing is left unsaved, so the notice goes.
  if (!entry) { hideSaveError(); return; }
  queue.delete(entry.rec.id);
  flight = entry;
  rawPut(entry.rec).then(() => {
    flight = null; retryDelay = RETRY_MS_MIN; hideSaveError();
    drain();
  }).catch(() => {
    flight = null;
    // Back in the queue unless a newer save, a direct write or a delete has
    // superseded it; a superseded failure is no unsaved work to announce.
    if (!entry.dead) {
      showSaveError();
      if (!queue.has(entry.rec.id)) queue.set(entry.rec.id, { rec: entry.rec });
    }
    clearTimeout(retryTimer);
    retryTimer = setTimeout(drain, retryDelay);
    retryDelay = Math.min(retryDelay * 2, RETRY_MS_MAX);
  });
}
