/* --- 10. Long-press menu ------------------------------------------------- */
// issue #182 module wiring — native ESM, no bundler (AGENTS.md).
import { COPY, GLYPH, el, state } from './state.js';
import { beginLink, linkSource } from './render.js';
import { commitAction, g, isEditing } from './interactions.js';
import { exportAllJson, exportBoardPdf, importBoardsJson } from './export.js';
import { goToList, listOpen, lotMenuOpen, returnToBoard, showCal } from './boards.js';

export let menuOpen = false, menuKeyHandler = null, menuOutsideHandler = null;
export let menuReturnFocus = false;         // true only inside closeMenu's synchronous focus return

/* One menu opens here now (B91): a note's single Link item. The anchor's own
   menu (All boards · Export) is gone (issue #140, B92) — both of its actions
   had long since been declared on the board-action row (B83), and the row is
   now the only route to them: a hidden menu whose every item sits on a visible
   tab one gesture away is chrome without a job. The lot still has none. All
   items are non-destructive, so no separator — same rule as everywhere else. */
export function openMenuFor(target, clientX, clientY) {
  if (target.type !== 'note') return;   // anchors lost their menu (B92); lot / canvas have none
  // A note's one relational action (issue #142, B91): Link arms link mode, then
  // the next note tapped is connected (handleTap's linkSource branch). beginLink
  // runs inside buildMenu's commitAction wrapper — arming is idempotent, fine.
  const id = target.node.dataset.id;
  buildMenu([{ label: COPY.link, glyph: GLYPH.link, action: () => beginLink(id), raw: true }], clientX, clientY);
}

/* The board-action row (issue #126, B83; three tabs since issue #140, B92): the
   board-level actions declared as flat tabs above the Parking Lot instead of
   hidden behind a gesture. This is the door B65 opened with the `Menu` handle,
   re-homed onto controls that state their own act. The anchor long-press /
   right-click menu is gone entirely (B92): every item it carried sits on a
   visible tab, so the hidden route was chrome without a job. */

/* Fill a tab with its drawn mark (UIUX §13.3) and label. Built once at boot;
   the toggle only restates its label text afterwards (syncBoardActions). */
export function fillBoardAction(btn, glyph, label) {
  const g = document.createElement('span');
  g.className = 'glyph'; g.setAttribute('aria-hidden', 'true'); g.innerHTML = glyph;
  const l = document.createElement('span'); l.className = 'label'; l.textContent = label;
  btn.append(g, l);
}
/* The calendar's R1 top row (issue #156, B98): the same fill, the same family.
   Back wears its own page-turn mark (GLYPH.calBack — drawn for B95's R1 and
   wired here for the first time); All Boards and Export wear the same marks
   as their board-row siblings, because they are the same acts. Filling at
   boot is what makes the row controls at all — the issue's "untappable /
   invisible" report was three empty <button>s rendering as blank squares. */

/* The toggle wears the act it will perform (B43/B71's grammar, not a fixed
   noun): on the board it offers All boards; while the All-Boards surface is up
   — the desktop list overlay, or the mobile lot-grid — it offers the way back
   to this one. One mark (GLYPH.boards, the boards domain), the label alone
   flips, so state is never colour (UIUX §1). Called from renderBoard and every
   list-state transition. R7.2's re-grammar shortens the resting label to "All"
   (the four-tab row's fit); the toggle's other face keeps the full "This
   board" — the one word that states the return, unchanged from B83. */
export function syncBoardActions() {
  const away = listOpen || lotMenuOpen;
  const l = el.actionBoards.querySelector('.label');
  if (l) l.textContent = away ? COPY.thisBoard : COPY.calBoardTab;
}

/* All Boards is pure navigation: it commits nothing a stray tap could
   duplicate, so it runs raw, no commitAction (B81). goToList opens the list /
   lot-grid; returnToBoard pops back however deep. */
/* Export is now a CHOICE (issue #140, B92): the tab opens the app's one menu
   species — buildMenu, the same popup the note's Link item wears, anchored at
   the pressed tab — with PDF · JSON as its two leaves. The choice itself is
   navigation ("to what?"), so it runs raw; each LEAF commits (a file leaves
   the device) and takes the drop-guard itself, exactly where the anchor menu's
   Export item and the old tab used to hold it (B81). PDF reads `current`, the
   one board you're looking at (issue #43); JSON backs up every board.
   Anchored at the button, not the pointer: the menu is the tab's own next
   state, not a context menu that happens to be nearby. */
/* Import commits too — boards can be overwritten — so its one step (opening
   the file dialog) runs under the same drop-guard. The dialog itself is the
   hidden input's mechanism (issue #140): the visible control is the tab, the
   platform's own picker does the choosing, and nothing is named twice. The
   input is reset before each open so picking the SAME file twice still fires
   change — a browser fires it only when the value changes. */

/* Calendar (issue #145): the fourth board-level tab. Navigation, like All
   boards — it commits nothing a stray tap could duplicate (B81), so it runs
   raw. The calendar view is a third screen, so it pushes its own history
   state { v: 'cal' }: the OS back gesture returns from it (B9, unshadowed),
   and its OWN Back button is the always-visible route (R1). */
/* The tabs are focusable things inside #board, and the desktop keyboard grammar
   (Enter edits the selection, Delete destroys it) listens on document and keys
   off `selected` alone, not focus — so a tab focused over a selected note would
   otherwise let Delete reach that note. The row swallows the grammar's keys;
   Enter's native default (the first press) still fires the tab's own click, and
   Escape passes through so deselect-from-anywhere still works. This is B65's
   guard, re-homed — including its auto-repeat drop: the native click fires per
   Enter keydown, so a held key would fire the tab's action (an export!) over
   and over, since commitAction only rate-limits to ACTION_DELAY. preventDefault
   on the repeats suppresses the synthesized click, so a held Enter acts once. */

/* Desktop right-click on a note opens its Link menu (issue #142, B91) — the
   desktop parallel to the mobile long-press, and the note's one relational
   action. B84 had removed the note's desktop contextmenu (its Complete/Copy/
   Delete moved to the on-select toolbar); B91 re-adds one scoped to a single
   Link item. A right-click on the canvas, an anchor, the lot, or an editing note
   still falls through to the browser's own menu, as before; the board card's own
   contextmenu listener (its delete menu, B24) is a different element, untouched. */

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
    // The menu closes and acts on release, with a drop-guard so a double-tap
    // fires once. One site covers every menu action, board rows included — except
    // an item flagged `raw` (Link, B91): arming a mode is navigation, not a
    // consequence (B81), so it must NOT hold the 400ms guard, or a quick tap on
    // the link target inside that window would be dropped by the same guard.
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
    // Escape pops the menu ONLY (B91): stopPropagation keeps it from reaching the
    // desktop keydown grammar underneath, which — now that a note's Link menu can
    // open over a live selection — would otherwise also clear that selection.
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
  // Dismissal is inert (B30): this handler runs in the capture phase, so the
  // very press that closes the menu would otherwise go on to reach the
  // recognizer and capture a note on the paper the menu was covering.
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
    // focus() dispatches focusin synchronously; the flag scopes the multi-
    // selection exemption to exactly this call (issue #55).
    menuReturnFocus = true; m.focus(); menuReturnFocus = false;
  }
}


/* Region init (issue #182): top-level side effects, explicit register()
   call from boot() — no module does load-time work. */
export function registerMenus() {
  fillBoardAction(el.actionBoards, GLYPH.boards, COPY.calBoardTab);
  fillBoardAction(el.actionExport, GLYPH.export, COPY.export);
  fillBoardAction(el.actionImport, GLYPH.import, COPY.import);
  fillBoardAction(el.actionCalendar, GLYPH.calendar, COPY.calendar);

  fillBoardAction(el.calBack, GLYPH.calBack, COPY.calBack);
  fillBoardAction(el.calBoards, GLYPH.boards, COPY.calAllBoards);
  fillBoardAction(el.calExport, GLYPH.export, COPY.calExport);

  el.actionBoards.addEventListener('click', () => {
    if (listOpen || lotMenuOpen) returnToBoard();
    else goToList();
  });

  el.actionExport.addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    buildMenu([
      { label: COPY.exportPdf, glyph: GLYPH.export, action: () => commitAction(() => exportBoardPdf(state.current)) },
      { label: COPY.exportJson, glyph: GLYPH.boards, action: () => commitAction(exportAllJson) },
    ], r.left, r.bottom);
  });

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

  el.actionCalendar.addEventListener('click', () => {
    if (state.calOpen) return;
    // The rail is wide's entry (B99); the tab is mobile's and pushes its own
    // history state { v: 'cal' }: the OS back gesture returns from it (B9,
    // unshadowed), and its OWN Back button is the always-visible route (R1).
    if (state.isWide) { showCal(); return; }
    history.pushState({ v: 'cal' }, '');
    showCal();
  });

  el.boardActions.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== 'Delete' && e.key !== 'Backspace') return;
    e.stopPropagation();
    if (e.repeat) e.preventDefault();
  });

  el.board.addEventListener('contextmenu', (ev) => {
    if (!state.isDesktop) return;                           // mobile arms Link by long-press
    if (linkSource) { ev.preventDefault(); return; }  // already arming: left-click a note to finish
    const noteNode = ev.target.closest('.note');
    if (!noteNode || isEditing(ev.target)) return;    // non-note / text edit keeps the native menu
    ev.preventDefault();
    let x = ev.clientX, y = ev.clientY;
    if (!x && !y) {                                   // Shift+F10 fires contextmenu at 0,0
      const r = noteNode.getBoundingClientRect();
      x = r.left + r.width / 2; y = r.top + r.height / 2;
    }
    // No menuInvoker: closeMenu's focus-return would run the focusin Tab-selects
    // rule (issue #55) and stray-select the source note. The mouse user finishes
    // the link by clicking the target, so no focus return is needed.
    openMenuFor({ type: 'note', node: noteNode }, x, y);
  });
}