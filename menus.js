/* --- 10. Long-press menu ------------------------------------------------- */
import { COPY, GLYPH, el, histPush, noteRec, state } from './state.js';
import { beginLink, completeSurfaced, copyNoteTexts, linkSource, surfacedMap } from './render.js';
import { commitAction, editNoteTitle, isEditing } from './interactions.js';
import { exportAllJson, exportBoardPdf, importBoardsJson } from './export.js';
import { goToList, listOpen, lotMenuOpen, returnToBoard, showCal, swapBoard } from './boards.js';

export let menuOpen = false;
let menuKeyHandler = null, menuOutsideHandler = null;
export let menuReturnFocus = false;         // true only inside closeMenu's synchronous focus return

/* A note's menu carries Copy, Title and Link; a surfaced echo has its own
   Complete / Go to Board menu. Anchors (B92) and the lot carry none. */
export function openMenuFor(target, clientX, clientY) {
  if (target.type !== 'note') return;   // anchors (B92), lot and canvas have no menu
  const id = target.node.dataset.id;
  const note = noteRec(id);
  // A surfaced echo (B109): its record lives on the source board, so Complete
  // here completes THERE, Go to Board takes swapBoard (B9). No Link: it arms
  // against state.current's notes and would strand on a record not there.
  const surf = !note && surfacedMap.get(id);
  const items = [];
  if (surf) {
    items.push({ label: COPY.complete, glyph: GLYPH.complete, action: () => completeSurfaced(id) });
    items.push({ label: COPY.gotoBoard, glyph: GLYPH.boards, action: () => swapBoard(surf.boardId) });
    buildMenu(items, clientX, clientY);
    return;
  }
  if (!note) return;                    // a stale id (the record was discarded mid-press)
  // Copy (B114), first: the note's own state act before the relational acts
  // (B109's Complete-first precedent). Not raw: a copy is a consequence, so
  // it commits under buildMenu's drop-guard; copyNoteTexts joins a live
  // multi-selection primary-first.
  items.push({ label: COPY.copy, glyph: GLYPH.copy, action: () => copyNoteTexts(id) });
  // Title (B120): wears the act it will perform (B43/B71), Add or Edit.
  // Edit-entry is navigation, so it runs raw (B81), like Link.
  items.push({ label: note.title ? COPY.editTitle : COPY.addTitle,
               glyph: GLYPH.title, action: () => editNoteTitle(target.node), raw: true });
  // Link (B91) arms link mode; the next note tapped is connected (handleTap's
  // linkSource branch). Raw (B81): arming is navigation, not a consequence.
  items.push({ label: COPY.link, glyph: GLYPH.link, action: () => beginLink(id), raw: true });
  buildMenu(items, clientX, clientY);
}

/* The board-action row (B83): four tabs on mobile (B95); wide hides All and
   Calendar (B119, B99). Flat tabs above the Parking Lot that state their own
   act; anchors carry no menu (B92). */

/* Fill a tab with its drawn mark (UIUX §13.3) and label. Built once at boot;
   syncBoardActions restates only the label. */
export function fillBoardAction(btn, glyph, label) {
  const g = document.createElement('span');
  g.className = 'glyph'; g.setAttribute('aria-hidden', 'true'); g.innerHTML = glyph;
  const l = document.createElement('span'); l.className = 'label'; l.textContent = label;
  btn.append(g, l);
}
/* The toggle wears the act it will perform (B43/B71): "All" on the board
   (B95), "This board" (B83) while the All-Boards surface is up (mobile
   lot-grid or drilled list). One mark (GLYPH.boards); only the label flips,
   so state is never colour (UIUX §1). Called from renderBoard and every
   list-state transition. */
export function syncBoardActions() {
  const away = listOpen || lotMenuOpen;
  const l = el.actionBoards.querySelector('.label');
  if (l) l.textContent = away ? COPY.thisBoard : COPY.calBoardTab;
}

/* Where a context menu opens. A keyboard summon (Shift+F10) fires
   `contextmenu` at 0,0 with no pointer, so fall back to the target's centre,
   where a right-click would land. Shared by the note, rail-card and
   drilled-row summons (the latter two in boards.js). */
export function menuPoint(ev, node) {
  if (ev.clientX || ev.clientY) return { x: ev.clientX, y: ev.clientY };
  const r = node.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function buildMenu(items, clientX, clientY) {
  closeMenu();
  el.menu.textContent = '';
  const buttons = [];
  for (const it of items) {
    if (it.sep) { const s = document.createElement('div'); s.className = 'sep'; el.menu.appendChild(s); continue; }
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    if (it.danger) b.className = 'danger';
    // Drawn marks (UIUX §13.3): GLYPH holds app-owned SVG markup, not text.
    const g1 = document.createElement('span'); g1.className = 'glyph'; g1.setAttribute('aria-hidden', 'true'); g1.innerHTML = it.glyph;
    const lb = document.createElement('span'); lb.textContent = it.label;
    b.appendChild(g1); b.appendChild(lb);
    // Closes and acts on release under a drop-guard so a double-tap fires
    // once. A `raw` item (Link, Title) skips it: entering those modes is
    // navigation (B81), and holding the 400ms guard would drop a quick tap on
    // the link target.
    b.addEventListener('click', () => {
      if (it.raw) { closeMenu(); it.action(); }
      else commitAction(() => { closeMenu(); it.action(); });
    });
    el.menu.appendChild(b); buttons.push(b);
  }
  el.menu.hidden = false;
  // Position adjacent to the press point, flipped to stay on-viewport.
  const mw = el.menu.offsetWidth, mh = el.menu.offsetHeight;
  const vw = window.innerWidth, vh = window.innerHeight, pad = 8;
  let x = clientX, y = clientY + 8;
  if (x + mw > vw - pad) x = clientX - mw;
  if (x < pad) x = pad;
  if (y + mh > vh - pad) y = clientY - mh - 8;
  if (y < pad) y = pad;
  el.menu.style.left = x + 'px';
  el.menu.style.top = y + 'px';
  requestAnimationFrame(() => el.menu.classList.add('show'));
  menuOpen = true;
  if (buttons[0]) buttons[0].focus();

  menuKeyHandler = (ev) => {
    // Escape pops the menu ONLY (B91): stopPropagation keeps it from the
    // desktop keydown grammar, which would also clear a live selection (a
    // note's Link menu can open over one).
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeMenu(); }
    else if (ev.key === 'Tab') {                        // trap focus while open
      ev.preventDefault();
      const i = buttons.indexOf(document.activeElement);
      const next = ev.shiftKey ? (i <= 0 ? buttons.length - 1 : i - 1) : (i + 1) % buttons.length;
      buttons[next].focus();
    } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      const i = Math.max(0, buttons.indexOf(document.activeElement));
      const next = ev.key === 'ArrowDown' ? (i + 1) % buttons.length : (i <= 0 ? buttons.length - 1 : i - 1);
      buttons[next].focus();
    }
  };
  document.addEventListener('keydown', menuKeyHandler, true);
  // Dismissal is inert (B30): capture phase, so the closing press doesn't
  // reach the recognizer and capture a note on the paper under the menu.
  menuOutsideHandler = (ev) => {
    if (el.menu.contains(ev.target)) return;
    if (el.board.contains(ev.target)) {
      state.swallowTap = true;
      setTimeout(() => { state.swallowTap = false; }, 0);   // never outlives this press
    }
    closeMenu();
  };
  setTimeout(() => document.addEventListener('pointerdown', menuOutsideHandler, true), 0);
}

export function closeMenu() {
  if (!menuOpen && el.menu.hidden) return;
  el.menu.classList.remove('show');
  el.menu.hidden = true;
  menuOpen = false;
  if (menuKeyHandler) document.removeEventListener('keydown', menuKeyHandler, true);
  if (menuOutsideHandler) document.removeEventListener('pointerdown', menuOutsideHandler, true);
  menuKeyHandler = menuOutsideHandler = null;
  if (state.menuInvoker) {
    const m = state.menuInvoker; state.menuInvoker = null;
    // focus() dispatches focusin synchronously; the flag scopes the
    // multi-selection exemption to exactly this call.
    menuReturnFocus = true; m.focus(); menuReturnFocus = false;
  }
}


/* Region init: registerMenus is called from boot(); no load-time work. */
export function registerMenus() {
  fillBoardAction(el.actionBoards, GLYPH.boards, COPY.calBoardTab);
  fillBoardAction(el.actionExport, GLYPH.export, COPY.export);
  fillBoardAction(el.actionImport, GLYPH.import, COPY.import);
  fillBoardAction(el.actionCalendar, GLYPH.calendar, COPY.calendar);

  /* Calendar exit row (B98, B151): `Go Back`, text alone; filling it at boot
     makes the empty button operable. */
  fillBoardAction(el.calBack, '', COPY.calBack);
  // Today wears no mark (B148): text-only, so its glyph span is empty.
  fillBoardAction(el.calToday, '', COPY.calToday);
  fillBoardAction(el.paneCollapse, '', COPY.paneCollapse);

  /* All Boards is pure navigation: raw, without commitAction (B81). goToList
     opens the list / lot-grid; returnToBoard pops back however deep. */
  el.actionBoards.addEventListener('click', () => {
    if (listOpen || lotMenuOpen) returnToBoard();
    else goToList();
  });

  /* Export is a choice (B92): the tab opens the app's one menu species at the
     pressed tab, PDF and JSON as leaves. The choice is navigation; each
     file-producing leaf takes the drop-guard (B81). */
  el.actionExport.addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    buildMenu([
      { label: COPY.exportPdf, glyph: GLYPH.export, action: () => exportBoardPdf(state.current) },
      { label: COPY.exportJson, glyph: GLYPH.boards, action: exportAllJson },
    ], r.left, r.bottom);
  });

  /* Import opens the file picker via the hidden input, reset first so choosing
     the same file fires `change` again. */
  el.actionImport.addEventListener('click', () => {
    commitAction(() => {
      el.importFile.value = '';
      el.importFile.click();
    });
  });
  el.importFile.addEventListener('change', () => {
    const file = el.importFile.files && el.importFile.files[0];
    if (file) importBoardsJson(file);
  });

  /* Calendar is the fourth mobile tab (B95); it commits nothing. Wide enters
     through the standing rail (B99). */
  el.actionCalendar.addEventListener('click', () => {
    if (state.calOpen) return;
    // Mobile pushes its own history state so the OS back gesture returns (B9);
    // Go Back is the in-view route (B151).
    if (state.isWide) { showCal(); return; }
    histPush({ v: 'cal' });            // B124 embed: replaceState — no parent-history entries
    showCal();
  });

  /* The tabs are focusable inside #board but the desktop keyboard grammar
     keys off `selected`, not focus: swallow these keys on the row so Delete
     can't reach a selected note. Enter's first press still clicks; preventing
     repeats stops a held key re-firing. */
  el.boardActions.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== 'Delete' && e.key !== 'Backspace') return;
    e.stopPropagation();
    if (e.repeat) e.preventDefault();
  });

  /* Desktop right-click opens the note menu; anchors, canvas, lot rows and
     editing notes keep the native menu. */
  el.board.addEventListener('contextmenu', (ev) => {
    if (!state.isDesktop) return;                           // off desktop, long-press arms Link
    if (linkSource) { ev.preventDefault(); return; }  // already arming: left-click a note to finish
    const noteNode = ev.target.closest('.note');
    if (!noteNode || isEditing(ev.target)) return;    // non-note / text edit keeps the native menu
    ev.preventDefault();
    const { x, y } = menuPoint(ev, noteNode);
    // No menuInvoker: closeMenu's focus return would run the focusin
    // Tab-selects rule and stray-select the source note.
    openMenuFor({ type: 'note', node: noteNode }, x, y);
  });
}