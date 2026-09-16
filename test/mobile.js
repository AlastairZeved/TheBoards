const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.BOARDS_URL || 'http://localhost:8000/index.html';
// Point at a specific Chromium with CHROMIUM_PATH; otherwise Playwright's own.
const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? (pass++, console.log('  PASS ' + n)) : (fail++, console.log('  FAIL ' + n + (extra ? ' :: ' + extra : ''))); };

// B108's morning landing owns boot: every load lands on today's linked board.
// reopen() puts the board under test back on the sheet after a reload — by id
// (a board that was already open) or by title (a seeded fixture, which boot's
// old most-recent rule used to open on its own).
async function reopen(page, idOrTitle) {
  await page.reload();
  await page.waitForTimeout(600);
  await page.evaluate(async (k) => {
    if (state.current && (state.current.id === k || state.current.title === k)) return;
    const b = (await idbGetAll()).find(r => r.title !== undefined && (r.id === k || r.title === k));
    if (b) swapBoard(b.id);
  }, idOrTitle);
  await page.waitForTimeout(700);          // SWAP_MS + render
}


async function newMobilePage(browser, viewport = { width: 384, height: 846 }) {
  const ctx = await browser.newContext({
    viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => !!document.querySelector('#board'));
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}

// A real touch tap through CDP Input domain (Playwright's touchscreen.tap issues
// touch events that the browser translates to pointer events).
async function tap(page, x, y, holdMs = 30) {
  const c = await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(holdMs);
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await c.detach();
}
async function tapWithMove(page, x, y, dx, dy) {
  const c = await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(20);
  await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx, y: y + dy }] });
  await page.waitForTimeout(20);
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await c.detach();
}

// Press and drag, stopping WITH THE FINGER STILL DOWN so the caller can assert
// mid-drag state (the landing frame, the ghost). Returns the live CDP session:
// the caller sends touchEnd and detaches. Stepped so the move crosses
// MOVE_THRESHOLD, and quick enough to stay inside LONGPRESS_MS.
async function touchDragTo(page, from, to, steps = 8) {
  const c = await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  await page.waitForTimeout(20);
  for (let i = 1; i <= steps; i++) {
    await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
      x: from.x + (to.x - from.x) * i / steps,
      y: from.y + (to.y - from.y) * i / steps,
    }] });
    await page.waitForTimeout(15);
  }
  // Settle before the caller reads the DOM. Input.dispatchTouchEvent resolves
  // when the event is DISPATCHED, not when the recognizer's handler has run and
  // painted its consequence — so a drop-target assertion straight off the last
  // move is a race the CI runner loses under load. The desktop twin already
  // waits 60ms at exactly this point; this is the same wait, in the helper, so
  // every caller gets it.
  await page.waitForTimeout(60);
  return c;
}

const noteCount = page => page.evaluate(() => document.querySelectorAll('.note').length);
const activeIsNoteText = page => page.evaluate(() =>
  !!document.activeElement && document.activeElement.classList.contains('note-text'));

// Since issue #112 / B74 the mobile All-Boards menu is the Parking Lot turned
// into a 2x2 category grid (the picker), and each category's boards live on
// their own drilled screen (#list-view). openCat opens a category's screen the
// way a tap through the picker would — goToList raises the picker, drillCat
// pushes the category. The two-level history means the board is two pops away.
async function openCat(page, cat) {
  await page.evaluate((c) => { if (!listOpen) goToList(); drillCat(c); }, cat);
  await page.waitForTimeout(300);
}

(async () => {
  const browser = await chromium.launch({ ...launchOpts });

  // ---- 1. mobile mode is actually active -----------------------------------
  console.log('\n[1] Mobile mode detection');
  {
    const { ctx, page } = await newMobilePage(browser);
    const desktop = await page.evaluate(() => document.documentElement.classList.contains('desktop'));
    ok('isDesktop is false (mobile branch under test)', desktop === false, 'desktop=' + desktop);
    await ctx.close();
  }

  // ---- 2. tap creates a note INSTANTLY and focuses it -----------------------
  console.log('\n[2] Tap empty canvas -> instant note + focus (B27)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await tap(page, 200, 500);
    await page.waitForTimeout(50);           // capture is immediate — no window at all
    const n = await noteCount(page);
    ok('note exists within 50ms', n === 1, 'count=' + n);
    ok('.note-text has focus', await activeIsNoteText(page));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    // typing lands and survives a reload
    await page.keyboard.type('hello board');
    await tap(page, 200, 250);               // blur onto other paper
    await page.waitForTimeout(300);
    const cur = await page.evaluate(() => state.current.id);
    await reopen(page, cur);
    const txt = await page.evaluate(() => [...document.querySelectorAll('.note-text')].map(n => n.textContent));
    ok('text persisted across reload', txt.includes('hello board'), JSON.stringify(txt));
    await ctx.close();
  }

  // ---- 3. long press on empty canvas: no crash, note created ---------------
  console.log('\n[3] Long-press empty canvas (700ms) -> note, no crash');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await tap(page, 200, 500, 700);
    await page.waitForTimeout(100);
    const n = await noteCount(page);
    ok('exactly one note created', n === 1, 'count=' + n);
    ok('no page errors (was TypeError on rec.state)', errors.length === 0, errors.join(' | '));
    ok('no menu opened', await page.evaluate(() => document.querySelector('#menu').hidden !== false));
    await ctx.close();
  }

  // ---- 4. slop threshold ---------------------------------------------------
  console.log('\n[4] Touch slop (MOVE_THRESHOLD 16)');
  {
    const { ctx, page } = await newMobilePage(browser);
    await tapWithMove(page, 200, 500, 12, 0);
    await page.waitForTimeout(80);
    ok('12px roll still creates a note', (await noteCount(page)) === 1, 'count=' + await noteCount(page));
    await ctx.close();
  }
  {
    const { ctx, page } = await newMobilePage(browser);
    await tapWithMove(page, 200, 500, 40, 0);
    await page.waitForTimeout(80);
    ok('40px drag creates nothing', (await noteCount(page)) === 0, 'count=' + await noteCount(page));
    await ctx.close();
  }

  // ---- 5. rapid double tap -> second tap only dismisses (issue #41) --------
  console.log('\n[5] Impatient double-tap');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await tap(page, 150, 450);
    await tap(page, 250, 550);
    await page.waitForTimeout(150);
    const n = await noteCount(page);
    ok('the empty first note is discarded, no second one created', n === 0, 'count=' + n);
    ok('nothing holds focus (keyboard dismissed)', !(await activeIsNoteText(page)));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 6. landmine purge ---------------------------------------------------
  console.log('\n[6] Whitespace-only husk is swept and leaves no dead zone');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    // Seed a whitespace-only note directly into IDB, then reload.
    await page.evaluate(() => new Promise((res, rej) => {
      const rq = indexedDB.open('boards-db');
      rq.onsuccess = () => {
        const db = rq.result;
        const store = db.transaction('boards', 'readwrite').objectStore('boards');
        const all = store.getAll();
        all.onsuccess = () => {
          // B108's day board shares the store now; the husk belongs to the
          // plain board the pre-B108 boot opened (getAll is key-ordered, so
          // result[0] is ambiguous across the two).
          const b = all.result.find(r => !r.cal) || all.result[0];
          b.notes.push({ id: 'husk-1', text: '   ', x: 300, y: 500, rw: 900, rh: 1000, scale: 1, state: 'active' });
          const put = store.put(b);
          put.onsuccess = () => res(b.id);
          put.onerror = () => rej(put.error);
        };
        all.onerror = () => rej(all.error);
      };
      rq.onerror = () => rej(rq.error);
    }));
    // B8/B31's sweep heals a husk when its board is DRAWN — pre-B108 boot drew
    // it, B108's landing draws the day board, so reopen draws the plain board.
    await reopen(page, await page.evaluate(async () =>
      (await idbGetAll()).find(r => r.title !== undefined && !r.cal).id));
    await page.waitForTimeout(500);        // the sweep's debounced save
    const inDom = await page.evaluate(() => !!document.querySelector('[data-id="husk-1"]'));
    ok('husk absent from DOM after boot', inDom === false);
    const inData = await page.evaluate(() => new Promise(res => {
      const rq = indexedDB.open('boards-db');
      rq.onsuccess = () => {
        const all = rq.result.transaction('boards', 'readonly').objectStore('boards').getAll();
        all.onsuccess = () => res(all.result.some(b => b.notes.some(n => n.id === 'husk-1')));
      };
    }));
    ok('husk purged from storage', inData === false);
    // its former patch of paper is live again
    const before = await noteCount(page);
    // rw/rh 900x1000 -> css 300*384/900 = 128 , 500*846/1000 = 423 (B32 renderY)
    await tap(page, 128, 423);
    await page.waitForTimeout(80);
    ok('tap on its former location creates a note', (await noteCount(page)) === before + 1);
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 7. keyboard-shrink: layout held still while editing ----------------
  console.log('\n[7] Viewport shrink during edit (keyboard proxy)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    // Low on the sheet, where clipping bit — but above the lot, which occupies
    // y 724-846 at this viewport (full-bleed two-row floor, B47).
    await tap(page, 200, 560);
    await page.waitForTimeout(80);
    ok('note created low on the sheet', (await noteCount(page)) === 1);
    const before = await page.evaluate(() =>
      getComputedStyle(document.querySelector('#board')).getPropertyValue('--logical-h'));
    await page.setViewportSize({ width: 384, height: 450 });   // "keyboard up"
    await page.waitForTimeout(200);
    const during = await page.evaluate(() =>
      getComputedStyle(document.querySelector('#board')).getPropertyValue('--logical-h'));
    ok('--logical-h unchanged while editing', before === during, before + ' -> ' + during);
    ok('note still present', (await noteCount(page)) === 1);
    ok('editor still focused (no flap)', await activeIsNoteText(page));
    // blur -> deferred layout lands
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(200);
    const after = await page.evaluate(() =>
      getComputedStyle(document.querySelector('#board')).getPropertyValue('--logical-h'));
    ok('deferred layout applies after blur', after !== during, during + ' -> ' + after);
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 8. a note's actions live on its toolbar; long-press opens no menu ----
  console.log('\n[8] Mobile: first tap selects (toolbar, no keyboard), second tap edits at the end (B84, B90)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await tap(page, 200, 400);
    await page.waitForTimeout(60);
    await page.keyboard.type('real note');
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(200);
    const box = await page.evaluate(() => {
      const r = document.querySelector('.note').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    // On mobile the FIRST tap SELECTS a note — it reveals the toolbar with no
    // keyboard and no edit (B90). (A long-press now arms the note's Copy · Link
    // menu, B91/B114 — covered in [24]; here a short tap engages the note.)
    await tap(page, box.x, box.y);
    await page.waitForTimeout(200);
    // The engaged note shows its toolbar via the .engaged class, not by editing.
    const tb = await page.evaluate(() => {
      const note = document.querySelector('.note');
      const bar = note.querySelector('.note-toolbar');
      const btns = [...document.querySelectorAll('.note-tb-btn')];
      const bg = el => getComputedStyle(el).backgroundColor;
      return {
        engaged: note.classList.contains('engaged'),
        visible: bar ? getComputedStyle(bar).visibility === 'visible' : false,
        editing: document.activeElement === note.querySelector('.note-text'),
        labels: btns.map(b => b.getAttribute('aria-label')),
        lastIsDelete: btns.length ? btns[btns.length - 1].classList.contains('note-tb-delete') : false,
        deleteBg: document.querySelector('.note-tb-delete') ? bg(document.querySelector('.note-tb-delete')) : '',
        completeBg: document.querySelector('.note-tb-complete') ? bg(document.querySelector('.note-tb-complete')) : '',
        highlightBg: document.querySelector('.note-tb-highlight') ? bg(document.querySelector('.note-tb-highlight')) : '',
      };
    });
    ok('the first tap engages the note and shows its toolbar (B90)', tb.engaged && tb.visible, JSON.stringify(tb));
    ok('the first tap does not open the keyboard — no edit yet (B90)', !tb.editing);
    // B43 order on the row (B84); Copy re-homed to the long-press menu (B114):
    // Complete · Highlight · Delete.
    ok('toolbar is Complete · Highlight · Delete', tb.labels.length === 3 &&
       /Complete/.test(tb.labels[0]) && /Highlight/.test(tb.labels[1]) &&
       /Delete/.test(tb.labels[2]), JSON.stringify(tb.labels));
    ok('Delete is last and distinct — the --danger fill, not the frame fill',
       tb.lastIsDelete && tb.deleteBg !== tb.completeBg,
       JSON.stringify({ last: tb.lastIsDelete, del: tb.deleteBg, comp: tb.completeBg }));
    // Identity fill (B85): Highlight is a fixed amber — it does not rotate with
    // the board type the way Complete's --frame does. (Copy's fixed blue retired
    // with its tab — B114.)
    ok('Highlight wears the fixed amber fill (B85)', tb.highlightBg === 'rgb(242, 214, 75)', tb.highlightBg);
    const rot = await page.evaluate(() => {
      const board = document.getElementById('board');
      const prev = board.dataset.cat;
      board.dataset.cat = 'idea';            // a green board: --frame rotates, the identity fill does not
      const bg = s => getComputedStyle(document.querySelector(s)).backgroundColor;
      const out = { hi: bg('.note-tb-highlight'), comp: bg('.note-tb-complete') };
      board.dataset.cat = prev;
      return out;
    });
    ok('the identity fill stays fixed while Complete follows the board (B85)',
       rot.hi === 'rgb(242, 214, 75)' && rot.comp !== 'rgb(105, 142, 191)',
       JSON.stringify(rot));
    // Notes carry no Export (that is board-level, on the anchor menu).
    ok('the note toolbar has no Export', !tb.labels.some(l => /Export/i.test(l)), JSON.stringify(tb.labels));
    ok('the note survived, unduplicated', (await noteCount(page)) === 1, 'count=' + await noteCount(page));
    ok('no menu is open anywhere', await page.evaluate(() => document.querySelector('#menu').hidden !== false));

    // The SECOND tap on the engaged note edits it — keyboard up, caret at the END (B90).
    await tap(page, box.x, box.y);
    await page.waitForTimeout(120);
    ok('the second tap enters edit (keyboard up)', await activeIsNoteText(page));
    await page.keyboard.type('!');
    await page.waitForTimeout(80);
    ok('the caret lands at the end of the text (B90)',
       (await page.evaluate(() => document.querySelector('.note-text').textContent)) === 'real note!',
       await page.evaluate(() => document.querySelector('.note-text').textContent));

    // A whitespace-only note shows its row (it is :not(:empty)); Completing it
    // must not crash — the pre-act blur discards the blank note (B8) and the
    // guarded action no-ops on the vanished record (B84).
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.waitForTimeout(150);
    await tap(page, 300, 620);                            // a second note on clear canvas
    await page.waitForTimeout(80);
    await page.keyboard.type('   ');                      // whitespace only
    await page.waitForTimeout(120);
    const wcp = await page.evaluate(() => {
      const b = document.querySelector('.note:focus-within .note-tb-complete');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (wcp) { await tap(page, wcp.x, wcp.y); await page.waitForTimeout(250); }
    ok('Completing a whitespace note discards it without crashing (B84)',
       errors.length === 0 && (await noteCount(page)) === 1,
       'errors=[' + errors.join('|') + '] count=' + await noteCount(page));

    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 9. anchors + parking lot still capture ------------------------------
  console.log('\n[9] Anchor and Parking Lot capture');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    // B108 lands boot on today's linked board; this block renames whatever is
    // open, so it runs on a plain board (a linked board's title is the species).
    await page.evaluate(async () => {
      const b = (await idbGetAll()).find(r => r.title !== undefined && !r.cal);
      if (b && b.id !== state.current.id) swapBoard(b.id);
    });
    await page.waitForTimeout(500);
    const t = await page.evaluate(() => {
      const r = document.querySelector('#anchor-title').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await tap(page, t.x, t.y);
    await page.waitForTimeout(60);
    ok('anchor focused instantly', await page.evaluate(() =>
      document.activeElement && document.activeElement.classList.contains('anchor')));
    await page.keyboard.type('Board title');
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(150);
    const lot = await page.evaluate(() => {
      const r = document.querySelector('#lot').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height - 12 };
    });
    await tap(page, lot.x, lot.y);
    await page.waitForTimeout(60);
    ok('lot line focused instantly', await page.evaluate(() =>
      document.activeElement && document.activeElement.classList.contains('lot-text')));
    await page.keyboard.type('a lot line');
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(300);
    const cur = await page.evaluate(() => state.current.id);
    await reopen(page, cur);
    const state = await page.evaluate(() => ({
      title: document.querySelector('#anchor-title').textContent,
      lot: [...document.querySelectorAll('.lot-text')].map(n => n.textContent),
    }));
    ok('anchor text persisted', state.title === 'Board title', JSON.stringify(state));
    ok('lot line persisted', state.lot.includes('a lot line'), JSON.stringify(state));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 9b. section headers are permanent (B33, issue #38) ------------------
  console.log('\n[9b] Components/Requirements headers survive content');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    for (const [sel, text] of [['#anchor-components', 'widget'], ['#anchor-requirements', 'must ship']]) {
      const p = await page.evaluate(s => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, sel);
      await tap(page, p.x, p.y);
      await page.waitForTimeout(60);
      await page.keyboard.type(text);
      await page.evaluate(() => document.activeElement.blur());
      await page.waitForTimeout(150);
    }
    const labels = await page.evaluate(() => [...document.querySelectorAll('.band-label')].map(n => {
      const r = n.getBoundingClientRect();
      return { text: n.textContent, w: r.width, h: r.height };
    }));
    ok('both headers still rendered', labels.length === 2, JSON.stringify(labels));
    ok('headers still read Components / Requirements',
      labels.map(l => l.text).join('|') === 'Components|Requirements', JSON.stringify(labels));
    ok('headers still have a box', labels.every(l => l.w > 0 && l.h > 0), JSON.stringify(labels));
    ok('anchors captured the text', await page.evaluate(() =>
      document.querySelector('#anchor-components').textContent === 'widget' &&
      document.querySelector('#anchor-requirements').textContent === 'must ship'));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 9c. Headers no longer chase a grown title (B38, issue #51) ----------
  // The card is sized for two lines, and a phone card is ~145 units wide, so a
  // real title regularly takes three — "LinkedIn Learnings To Do" does, which
  // is the board in issue #49. B37 had the labels follow the card down so
  // "Requirements" (width: max-content, spilling inward by design since B35)
  // would not run under the card's frame — but that meant the band read
  // content → rule → header, which is both of #51's complaints. B38 pins the
  // labels under the rule instead, so a grown title must leave them exactly
  // where they were.
  console.log('\n[9c] A three-line title grows the card, not the headers');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    const p = await page.evaluate(() => {
      const r = document.querySelector('#anchor-title').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await tap(page, p.x, p.y);
    await page.waitForTimeout(60);
    // Issue #49's board plus a clause: the card's floor (rule-y + 22 = 83 on a
    // blank band, B76) covers a few lines, so growth needs a longer title.
    await page.keyboard.type('LinkedIn Learnings To Do Before The Quarterly Review Lands');
    await page.waitForTimeout(120);
    const g = await page.evaluate(() => {
      const b = document.querySelector('#board').getBoundingClientRect();
      const q = s => { const r = document.querySelector(s).getBoundingClientRect();
                       return { top: r.top - b.top, bottom: r.bottom - b.top, height: r.height,
                                left: r.left - b.left, right: r.right - b.left }; };
      const anchorBottom = Math.max(...[...document.querySelectorAll('.band-zone .anchor')]
        .map(n => n.getBoundingClientRect().bottom - b.top));
      return { sheetH: b.height, card: q('#anchor-title'), lot: q('#lot'), anchorBottom,
               rule: q('#band-rule'),
               compLabel: q('#zone-components .band-label'),
               reqLabel: q('#zone-requirements .band-label') };
    });
    // The card's floor is rule-y + 22 = 83 on a blank band (B76), so a short
    // title no longer exercises growth; the law under test is B38's, unchanged
    // — a grown title grows the card, never the headers.
    ok('the title grew the card past its minimum', g.card.height > g.rule.top + 22 + 1,
      JSON.stringify([g.card.height, g.rule.top]));
    ok('the headers hang on the rule, not chasing the grown card (B76)',
      Math.abs(g.compLabel.top - g.rule.top) < 1 &&
      Math.abs(g.reqLabel.top - g.rule.top) < 1,
      JSON.stringify([g.compLabel.top, g.reqLabel.top, g.rule.top]));
    ok('the headers still clear the compartment horizontally',
      g.compLabel.right <= g.card.left + 0.5 && g.reqLabel.left >= g.card.right - 0.5,
      JSON.stringify([g.compLabel.right, g.card.left, g.card.right, g.reqLabel.left]));
    // The grown card must not eat the board it sits on. The labels no longer
    // trail the lowest furniture (B38), so the floor is measured off the card
    // and the side anchors — whichever reaches further down.
    const free = (g.lot.top - Math.max(g.card.bottom, g.anchorBottom)) / g.sheetH;
    ok('free canvas is still >=64% of the sheet', free >= 0.64, (free * 100).toFixed(1) + '%');
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 10. sustained capture session: no lost taps -------------------------
  console.log('\n[10] Sustained capture (10 notes, mixed hold times)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    // Rows 120 apart so no tap lands on the ~42px note above it (at 1:1 a note
    // is its real size, not 43% of it), clear of the top furniture and of the
    // lot band (y 708-830, B37). The top band ends at the anchors' y=126 (B38),
    // so every row here is on bare canvas.
    const pts = [[80,180],[300,180],[80,300],[300,300],[80,420],[300,420],[80,540],[300,540],[190,360],[190,480]];
    for (let i = 0; i < pts.length; i++) {
      await tap(page, pts[i][0], pts[i][1], i % 3 === 0 ? 600 : 40);   // some are long-presses
      await page.waitForTimeout(40);
      await page.keyboard.type('n' + i);
      await page.waitForTimeout(30);
      // Tap away to dismiss before the next capture (issue #41): a tap onto a
      // new spot while this one is still focused now only deselects it.
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await page.waitForTimeout(20);
    }
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.waitForTimeout(400);
    const texts = await page.evaluate(() => [...document.querySelectorAll('.note-text')].map(n => n.textContent).sort());
    ok('all 10 taps captured a note', texts.length === 10, 'got ' + texts.length + ': ' + JSON.stringify(texts));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 11. 1:1 sheet geometry: the furniture is legible (B32, issue #37) ----
  console.log('\n[11] 1:1 sheet + furniture geometry (B32)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    const geo = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('#board'));
      const r = s => document.querySelector(s).getBoundingClientRect();
      const titleStyle = getComputedStyle(document.querySelector('#anchor-title'));
      return {
        rs: cs.getPropertyValue('--rs').trim(),
        lw: cs.getPropertyValue('--logical-w').trim(),
        lh: cs.getPropertyValue('--logical-h').trim(),
        titleFont: titleStyle.fontSize,
        compFont: getComputedStyle(document.querySelector('#anchor-components')).fontSize,
        title: r('#anchor-title'), comp: r('#anchor-components'),
        req: r('#anchor-requirements'), lot: r('#lot'), board: r('#board'),
        rule: r('#band-rule'),
        titleBorderTop: titleStyle.borderTopWidth, titleBorderLeft: titleStyle.borderLeftWidth,
        anchorBottom: Math.max(...[...document.querySelectorAll('.band-zone .anchor')]
          .map(n => n.getBoundingClientRect().bottom)),
      };
    });
    ok('renderScale is 1', geo.rs === '1', 'rs=' + geo.rs);
    ok('sheet width is the viewport', geo.lw === '384px', geo.lw);
    ok('sheet height is the viewport', geo.lh === '846px', geo.lh);
    // Declared sizes reach the screen, not ~43% of them. The title sets at the
    // header size now that the card carries the hierarchy (B33).
    ok('title renders at 15px', geo.titleFont === '15px', geo.titleFont);
    ok('Components renders at 15px', geo.compFont === '15px', geo.compFont);
    ok('title card is 37.7778% of the sheet', Math.abs(geo.title.width - 145.1) < 1, String(geo.title.width));
    ok('three-across header preserved',
      geo.comp.right <= geo.title.left && geo.title.right <= geo.req.left,
      JSON.stringify([geo.comp.right, geo.title.left, geo.title.right, geo.req.left]));
    // B47 reads the band content → rule; B76 hangs the header just BELOW the
    // rule as a tab in the rule's own ink (--frame) — its top edge lands on the
    // rule and the tab hangs down, at 13px/600 (B54).
    const labels = await page.evaluate(() => {
      const sheet = document.querySelector('#board').getBoundingClientRect();
      const card = document.querySelector('#anchor-title').getBoundingClientRect();
      const gut = document.querySelector('#band-rule').getBoundingClientRect();
      return [...document.querySelectorAll('.band-label')].map(n => {
        const r = n.getBoundingClientRect();
        return { text: n.textContent, top: r.top, bottom: r.bottom,
                 left: r.left, right: r.right,
                 zone: n.closest('.band-zone').id,
                 cardLeft: card.left, cardRight: card.right,
                 ruleTop: gut.top, gutL: gut.left, gutR: gut.right,
                 sheetR: sheet.right, clipped: n.scrollWidth > Math.ceil(r.width),
                 fontSize: getComputedStyle(n).fontSize,
                 bg: getComputedStyle(n).backgroundColor };
      });
    });
    ok('the tab hangs below the rule, top edge on it (B76)',
      labels.every(l => Math.abs(l.top - l.ruleTop) < 1),
      JSON.stringify(labels.map(l => [l.text, l.top, l.ruleTop])));
    ok('the tab is filled in the rule\'s own colour, --frame (B76)',
      labels.every(l => l.bg === 'rgb(105, 142, 191)'),
      JSON.stringify(labels.map(l => [l.text, l.bg])));
    ok('labels clear the compartment horizontally',
      labels.every(l => l.zone === 'zone-components'
        ? l.right <= l.cardLeft + 0.5 : l.left >= l.cardRight - 0.5),
      JSON.stringify(labels.map(l => [l.text, l.zone, l.left, l.right, l.cardLeft, l.cardRight])));
    ok('labels render at 13px (B54)', labels.every(l => l.fontSize === '13px'),
      JSON.stringify(labels.map(l => [l.text, l.fontSize])));
    ok('band labels are not clipped', labels.every(l => !l.clipped),
      JSON.stringify(labels.map(l => [l.text, l.clipped])));
    ok('band labels stay inside the gutters',
      labels.every(l => l.left >= l.gutL - 0.5 && l.right <= l.gutR + 0.5),
      JSON.stringify(labels.map(l => [l.text, l.left, l.right, l.gutL, l.gutR])));
    // B38 / issue #52: the band is drawn furniture. The compartment is framed
    // on three sides on a blank board — the sheet's own top edge is its
    // fourth — and it overhangs the rule so it occludes it.
    ok('title card is framed on three sides when empty',
      geo.titleBorderTop === '0px' && geo.titleBorderLeft === '2px',
      JSON.stringify([geo.titleBorderTop, geo.titleBorderLeft]));
    ok('the compartment reaches the sheets top edge',
      Math.abs(geo.title.top - geo.board.top) < 0.5,
      JSON.stringify([geo.title.top, geo.board.top]));
    ok('band rule is drawn on a blank board', geo.rule.width > 0 && geo.rule.height >= 1,
      JSON.stringify([geo.rule.width, geo.rule.height]));
    ok('card crosses the band rule', geo.title.bottom > geo.rule.top + 1,
      JSON.stringify([geo.title.bottom, geo.rule.top]));
    // The lot's height is its two-row FLOOR now, not a phone budget: empty,
    // one row and two rows all draw the same 122px shelf (B47, UIUX §3.2).
    ok('empty lot draws the two-row floor, 122px (B47)',
      Math.round(geo.lot.height) === 122, String(geo.lot.height));
    ok('lot is full-bleed to the sheet bottom (UIUX §3.2)',
      Math.round(geo.lot.bottom) === 846, String(geo.lot.bottom));
    // B47 without B54's label term (B76 moved the label below the rule): the
    // band sizes to its tallest zone from a two-line floor — 14 + 2 x 19.5 + 8
    // = 61 on a blank board.
    ok('band rule is at the two-line floor, 61 (B47/B76)',
      Math.abs(geo.rule.top - 61) < 1, String(geo.rule.top));
    // B38's compartment under B47's band: bounded by the sheet's own top
    // edge, overhanging the rule by 22 — 83 on a blank board.
    ok('the compartment bottom is at rule + 22 (B47)',
      Math.abs(geo.title.bottom - (geo.rule.top + 22)) < 1,
      JSON.stringify([geo.title.bottom, geo.rule.top]));
    // The headline number, and the thing issue #49 was actually about. Between
    // the band furniture and the lot — the lower of the compartment and the
    // side anchors, since B38 no longer trails the labels below both.
    {
      const free = (geo.lot.top - Math.max(geo.title.bottom, geo.anchorBottom)) / 846;
      ok('free canvas is >=68% of the sheet', free >= 0.68, (free * 100).toFixed(1) + '%');
    }
    // Issue #53 (B39): no 45% cap — a long line wraps only at the sheet's
    // right edge, spanning most of the viewport where 173px used to stop it.
    await tap(page, 24, 250);
    await page.waitForTimeout(60);
    await page.keyboard.type('The quick brown fox jumps over the lazy dog while the '
      + 'cat watches from the window and the dog barks at the mailman going past');
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(300);
    const wrap = await page.evaluate(() => {
      const n = document.querySelector('.note');
      return { right: n.getBoundingClientRect().right, w: n.offsetWidth };
    });
    ok('long note wraps at the sheet right edge (issue #53)',
       wrap.right <= 384 + 1, JSON.stringify(wrap));
    ok('and spans past the old 45% cap', wrap.w > 173, String(wrap.w));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 11b. The short-window case (B36, retuned by B37) ---------------------
  // The regression this exists for: on a short, wide window the furniture ate
  // the board. B36 made the band a fraction of --logical-h, which fixed the
  // short *window* and broke the tall *phone* (issue #49) — 0.2 of 737 is a
  // 147px rule. B37 makes it fixed units instead, so the floors here go up and
  // the rule must land at the same 48 at every sheet height.
  console.log('\n[11b] Free canvas survives a short sheet (B37)');
  // B103: 744+ is the tablet arrangement now, so this mobile-sheet scenario
  // moved below the floor — short, WIDE-BUT-NARROW windows that remain
  // mobile-arranged (720 and 600 wide). The law under test is unchanged:
  // on the mobile sheet the band rule sits at 61 at every sheet height.
  {
    for (const [w, h, floor] of [[720, 540, 0.60], [600, 450, 0.50]]) {
      const { ctx, page, errors } = await newMobilePage(browser, { width: w, height: h });
      const g = await page.evaluate(() => {
        const b = document.querySelector('#board').getBoundingClientRect();
        const q = s => { const r = document.querySelector(s).getBoundingClientRect();
                         return { top: r.top - b.top, bottom: r.bottom - b.top }; };
        return { desktop: document.documentElement.classList.contains('desktop'),
                 sheetH: b.height, card: q('#anchor-title'), lot: q('#lot'),
                 label: q('#zone-components .band-label'), rule: q('#band-rule') };
      });
      const free = g.lot.top - g.card.bottom;
      const tag = `${w}x${h}`;
      ok(`${tag} is mobile mode`, !g.desktop, String(g.desktop));
      ok(`${tag} free canvas is >=${floor * 100}% of the sheet`,
        free / g.sheetH >= floor, `${free.toFixed(1)}px of ${g.sheetH} = ${(100 * free / g.sheetH).toFixed(1)}%`);
      // The band is type-sized (B37's law through B47's formula), so it does
      // not move when the sheet does: the two-line floor is 61 everywhere (B76).
      ok(`${tag} band rule is still at the 61 floor (B47/B76)`,
        Math.abs(g.rule.top - 61) < 1, String(g.rule.top));
      // The clearances the band could break.
      ok(`${tag} card still crosses the rule`, g.card.bottom > g.rule.top + 1,
        JSON.stringify([g.card.bottom, g.rule.top]));
      ok(`${tag} tab hangs below the rule and clears the lot (B76)`,
        Math.abs(g.label.top - g.rule.top) < 1 && g.label.bottom <= g.lot.top,
        JSON.stringify([g.rule.top, g.label.top, g.label.bottom, g.lot.top]));
      ok(`${tag} no page errors`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
  }

  // ---- 11b2. The tablet tier (B96; shape gate retuned by B101, issue #164) --
  // The unfolded Z Fold 7 (coarse pointer) takes the wide
  // ARRANGEMENT — rail + calendar panel — under the touch GRAMMAR. Width
  // alone must not flip the grammar (B19's capability law stands): the
  // session is NOT desktop here, and the rail renders scaled, not at 1:1.
  // B101: the tier is caught by the FOLDABLE SHAPE gate (tall + wide +
  // square-ish), because the device's real viewport sits below B96's 984
  // width at common zoom levels — 904x846 and 1092x1030 are the same device
  // at two zoom levels, and both must be tablet. The boundary assert (983
  // mobile / 984 tablet) pins B96's width leg; [11b3] pins the shape gate's
  // edges.
  console.log('\n[11b2] Tablet tier: wide arrangement, touch grammar (B96)');
  {
    const { ctx, page, errors } = await newMobilePage(browser, { width: 984, height: 1450 });
    const g = await page.evaluate(() => ({
      tablet: document.documentElement.classList.contains('tablet'),
      wide: document.documentElement.classList.contains('wide'),
      desktop: document.documentElement.classList.contains('desktop'),
      paneW: document.getElementById('pane').getBoundingClientRect().width,
      offx: getComputedStyle(document.getElementById('board')).getPropertyValue('--offx').trim(),
    }));
    ok('984x1450 is tablet (html.tablet + html.wide, NOT html.desktop)',
      g.tablet && g.wide && !g.desktop, JSON.stringify(g));
    ok('the rail renders beside the sheet (wide arrangement, B118\'s collapsed face)',
      g.paneW === 40, String(g.paneW));
    ok('the sheet origin sits at the collapsed face (B118 offX)', g.offx === '40px', g.offx);
    await page.evaluate(() => document.getElementById('action-calendar').click());
    await page.waitForTimeout(500);
    // B99: the tab is hidden on wide; the standing rail is the entry. On a
    // tablet the tab click is a no-op guard — drive the rail itself.
    const tabGone = await page.evaluate(() =>
      getComputedStyle(document.getElementById('action-calendar')).display === 'none');
    const railThere = await page.evaluate(() => {
      const r = document.getElementById('cal-rail').getBoundingClientRect();
      return r.width >= 24 && r.x > 800;
    });
    ok('the tab is retired and the standing rail is wide\'s entry (B99)',
      tabGone && railThere, JSON.stringify({ tabGone, railThere }));
    await page.evaluate(() => document.getElementById('cal-rail').click());
    await page.waitForTimeout(500);
    const cal = await page.evaluate(() => ({
      panel: document.getElementById('cal-view').classList.contains('panel'),
      w: document.getElementById('cal-view').getBoundingClientRect().width,
      squeeze: typeof calSqueeze !== 'undefined' && calSqueeze,
    }));
    ok('the rail expands into the docked panel (B99 + the issue #155 arrangement)',
      cal.panel && cal.w === 320 && cal.squeeze, JSON.stringify(cal));
    await page.evaluate(() => document.getElementById('cal-back').click());
    await page.waitForTimeout(500);
    const back = await page.evaluate(() => ({
      railOpen: document.getElementById('cal-view').classList.contains('rail-open'),
      w: document.getElementById('cal-view').getBoundingClientRect().width,
      squeeze: typeof calSqueeze !== 'undefined' && calSqueeze,
    }));
    ok('Back collapses to the standing rail, squeeze lifted (B99)',
      back.railOpen && back.w === 40 && !back.squeeze, JSON.stringify(back));
    // B101 (issue #164): the shape gate catches the unfolded Fold at its real
    // zoom levels. 904x846 is the device at display zoom −2 (the owner's
    // screenshots' CSS size); 1092x1030 at default. Both must be tablet, and
    // the 904 session must render the FULL tablet path: rail, both retired
    // tabs (B119), the standing calendar rail.
    for (const [w, h] of [[904, 846], [1092, 1030]]) {
      const fold = await newMobilePage(browser, { width: w, height: h });
      const fg = await fold.page.evaluate(() => ({
        tablet: document.documentElement.classList.contains('tablet'),
        wide: document.documentElement.classList.contains('wide'),
        paneW: document.getElementById('pane').getBoundingClientRect().width,
        calTabGone: getComputedStyle(document.getElementById('action-calendar')).display === 'none',
        allTabGone: getComputedStyle(document.getElementById('action-boards')).display === 'none',
        calRailShown: !document.getElementById('cal-rail').hidden,
      }));
      ok(`${w}x${h} (unfolded Fold) is tablet: the ${Math.round(fg.paneW)}px collapsed face, calendar tab retired, All tab retired (B119, B118)`,
        fg.tablet && fg.wide && fg.paneW === 40 && fg.calTabGone && fg.allTabGone && fg.calRailShown,
        JSON.stringify(fg));
      // B119: the picker has no door on tablet — the tab is retired and the
      // calendar panel's #cal-boards is guarded inert on wide.
      await fold.page.evaluate(() => document.getElementById('cal-boards').click());
      await fold.page.waitForTimeout(300);
      const noDoor = await fold.page.evaluate(() => ({
        pickerClosed: document.getElementById('lot-menu').hidden &&
          !document.getElementById('lot').classList.contains('menu-open'),
        listView: document.getElementById('list-view').hidden,
      }));
      ok(`${w}x${h}: the picker has no door on tablet (B119) — #cal-boards is inert, #list-view stays dark`,
        noDoor.pickerClosed && noDoor.listView, JSON.stringify(noDoor));
      ok(`${w}x${h} no page errors`, fold.errors.length === 0, fold.errors.join(' | '));
      await fold.ctx.close();
    }

  // ---- 11b3. The orientation-blind width floor (B103, issue #164) -----------
  // B103: tablet mode is ONE width floor — 744 CSS px (iPad mini portrait) —
  // with no orientation or aspect term. Unfolded foldables in EITHER
  // orientation, every iPad and Android tablet in portrait AND landscape,
  // and (superseding B96) the cover screen in landscape all take the tablet
  // arrangement; phones and cover-portrait (366–480) cannot cross 744.
  console.log('\n[11b3] The orientation-blind floor: width 744+, any orientation (B103)');
  {
    const CASES = [
      // [w, h, expectTablet, why]
      [984, 715, true,  'B96 landscape width'],
      [904, 846, true,  'unfolded Fold landscape, zoom -2 (issue #164)'],
      [846, 904, true,  'unfolded Fold PORTRAIT (B103: orientation-blind)'],
      [1092, 1030, true, 'unfolded Fold landscape, default zoom'],
      [1030, 1092, true, 'unfolded Fold portrait, default zoom'],
      [820, 1180, true,  'iPad Air portrait (B96 said mobile; B103 supersedes)'],
      [1024, 1366, true, 'iPad Pro portrait'],
      [768, 1024, true,  'standard iPad portrait'],
      [744, 1134, true,  'iPad mini portrait — the floor edge itself'],
      [743, 1134, false, 'just under the floor stays mobile'],
      [800, 1280, true,  'Android tablet portrait'],
      [980, 460, true,   'cover screen landscape (B96 mobile ruling superseded by B103)'],
      [980, 715, true,   '[11b] short-wide window takes the tablet arrangement now'],
      [480, 1000, false, 'largest phones stay mobile'],
      [384, 846, false,  'a phone'],
      [366, 880, false,  'cover screen portrait'],
    ];
    for (const [w, h, wantTablet, why] of CASES) {
      const e = await newMobilePage(browser, { width: w, height: h });
      const got = await e.page.evaluate(() =>
        document.documentElement.classList.contains('tablet'));
      ok(`${w}x${h} -> ${wantTablet ? 'tablet' : 'mobile'} (${why})`,
        got === wantTablet, `got ${got ? 'tablet' : 'mobile'}`);
      await e.ctx.close();
    }
    ok('no page errors', errors.length === 0, errors.join(' | '));
  }

  // ---- 11b4. The picker has no door on tablet (B119, issue #212) -----------
  // Same 984x1450 session's next leg (the ctx is open until here): B119
  // (issue #212) retires the All tab on tablet and guards the calendar
  // panel's #cal-boards on wide — the picker has no door on tablet; the left
  // rail is the one All-Boards surface (B96/B118). The drill and back stack
  // the old B100 leg exercised live on mobile only ([19]).
  console.log('\n[11b4] The picker has no door on tablet (B119)');
  {
    const doorTab = await page.evaluate(() =>
      getComputedStyle(document.getElementById('action-boards')).display === 'none');
    await page.evaluate(() => document.getElementById('cal-boards').click());
    await page.waitForTimeout(300);
    const shut = await page.evaluate(() => ({
      pickerClosed: document.getElementById('lot-menu').hidden &&
        !document.getElementById('lot').classList.contains('menu-open'),
      listView: document.getElementById('list-view').hidden,
    }));
    ok('the All tab is display:none on tablet — no door on the board (B119)', doorTab);
    ok('#cal-boards is inert on tablet — the picker never opens, #list-view stays dark (B119)',
       shut.pickerClosed && shut.listView, JSON.stringify(shut));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  }
  // ---- 11c. EXPORT_GEO still draws what the board draws (B47/B54) -----------
  // The exporter cannot read computed CSS, so it restates the band a second
  // time and the two can drift. Since B47 the band is content-derived on both
  // sides from ONE formula — bandTop + max(2, lines) x headLH + bandGap (B76
  // dropped B54's labelLH + bandClear label term, the label now hanging below
  // the rule) — so the tripwire recomputes the formula from EXPORT_GEO's own
  // terms and requires the rendered blank board (both zones at the two-line
  // floor) to land on the same pixel.
  console.log('\n[11c] EXPORT_GEO matches what the board draws');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    const m = await page.evaluate(() => {
      const b = document.querySelector('#board').getBoundingClientRect();
      const q = s => { const r = document.querySelector(s).getBoundingClientRect();
                       return { top: r.top - b.top, bottom: r.bottom - b.top }; };
      return { rule: q('#band-rule'), card: q('#anchor-title'),
               label: q('#zone-components .band-label'),
               anchor: q('#zone-components .anchor'),
               labelFontSize: getComputedStyle(
                 document.querySelector('#zone-components .band-label')).fontSize };
    });
    // issue #182: EXPORT_GEO now lives in export.js — read the module, not the entry.
    const src = fs.readFileSync(__dirname + '/../export.js', 'utf8');
    const num = k => Number((src.match(new RegExp(k + ':\\s*(\\d+(?:\\.\\d+)?)')) || [])[1]);
    const [bandTop, bandGap, cardTop, cardOverhang, headLH, labelSize, labelLH, radius] =
      ['bandTop', 'bandGap', 'cardTop', 'cardOverhang',
       'headLH', 'labelSize', 'labelLH', 'radius'].map(num);
    const floorRuleY = Math.round(bandTop + 2 * headLH + bandGap);
    ok('EXPORT_GEO formula lands the rule where the board draws it (B47/B76)',
      floorRuleY === Math.round(m.rule.top), JSON.stringify([floorRuleY, m.rule.top]));
    ok('EXPORT_GEO cardTop is where the board draws the card',
      cardTop === Math.round(m.card.top), JSON.stringify([cardTop, m.card.top]));
    ok('EXPORT_GEO card bottom is the boards card bottom (rule + overhang)',
      floorRuleY + cardOverhang === Math.round(m.card.bottom),
      JSON.stringify([floorRuleY + cardOverhang, m.card.bottom]));
    // B76: the label hangs below the rule as a tab, its TOP edge on the rule.
    // The stylesheet says the same (.band-label's top: 100% inside the zone).
    ok('EXPORT_GEO lands the tab top on the rule where the board draws it (B76)',
      floorRuleY === Math.round(m.label.top),
      JSON.stringify([floorRuleY, m.label.top]));
    // Zone content hangs from the band's top at bandTop (B47); the stylesheet
    // says the same (.band-zone .anchor's top: var(--band-top)).
    ok('EXPORT_GEO bandTop agrees with the rendered anchor top',
      bandTop === Math.round(m.anchor.top), JSON.stringify([bandTop, m.anchor.top]));
    ok('EXPORT_GEO labelSize agrees with the rendered labels font-size (B54)',
      labelSize + 'px' === m.labelFontSize, JSON.stringify([labelSize, m.labelFontSize]));
    ok('EXPORT_GEO radius mirrors the notes 3px (B49)', radius === 3, String(radius));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 11d. The cover screen keeps its three lot rows (B57) -----------------
  // The ceiling re-derived under full bleed: B37's proportional bound with the
  // 16px margin gone returns 821, so 384x846 draws a three-item lot at
  // 34 + 3 x 44 = 166, to the sheet's bottom edge — exactly as proof sheets 7
  // and 9 render it. The short-window cases stay two rows ([11b]).
  console.log('\n[11d] Three lot items draw three rows on the cover screen (B57)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await page.evaluate(async () => {
      const rec = newBoardRecord();
      rec.title = 'Lot ceiling fixture';
      rec.parkingLot = [
        { id: 'l1', text: 'Measure the alcove', state: 'active' },
        { id: 'l2', text: 'Grout colour undecided', state: 'complete' },
        { id: 'l3', text: 'Tile samples from Dover St', state: 'active' },
      ];
      await idbPut(rec);
    });
    await reopen(page, 'Lot ceiling fixture');
    const g = await page.evaluate(() => {
      const b = document.querySelector('#board').getBoundingClientRect();
      const lot = document.querySelector('#lot').getBoundingClientRect();
      return { h: lot.height, bottom: lot.bottom - b.top,
               rows: document.querySelectorAll('.lot-item').length,
               thirdVisible: (() => {
                 const r = [...document.querySelectorAll('.lot-item')][2].getBoundingClientRect();
                 return r.bottom <= lot.bottom + 0.5;
               })() };
    });
    ok('three items grow the lot to 166 (B57)', Math.round(g.h) === 166, String(g.h));
    ok('the lot still ends at the sheet bottom', Math.round(g.bottom) === 846, String(g.bottom));
    ok('the third row is drawn, not clipped', g.rows === 3 && g.thirdVisible, JSON.stringify(g));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 11e. The lot grows to its MEASURED content, unclipped (issue #106, B73)
  // The old height was item COUNT x 44, so a row that wrapped to several lines
  // was allotted 44 and #lot-items clipped the rest. lotH() now sums the rows'
  // rendered heights from the two-row floor, so a wrapping item grows the lot
  // upward and is drawn whole — a CEILING of half the sheet still holds a
  // runaway lot off the canvas.
  console.log('\n[11e] The lot grows with wrapped content and caps at half the sheet (B73)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await page.evaluate(async () => {
      const rec = newBoardRecord();
      rec.title = 'Lot growth fixture';
      rec.parkingLot = [
        { id: 'w1', text: 'This is a deliberately long parking lot entry that will '
          + 'certainly wrap onto several separate lines within the gutter width '
          + 'of a phone sheet, and every one of them must stay visible.', state: 'active' },
        { id: 'w2', text: 'A short second row', state: 'active' },
      ];
      await idbPut(rec);
    });
    await reopen(page, 'Lot growth fixture');
    const g = await page.evaluate(() => {
      const b = document.querySelector('#board').getBoundingClientRect();
      const lot = document.querySelector('#lot').getBoundingClientRect();
      const items = [...document.querySelectorAll('.lot-item')];
      return {
        sheetH: b.height,
        lotH: lot.height,
        wraps: items[0].getBoundingClientRect().height > 44,
        // every row's bottom sits within the lot section — nothing is clipped
        allVisible: items.every(n => n.getBoundingClientRect().bottom <= lot.bottom + 0.5),
      };
    });
    ok('a wrapping item grows the lot past the two-row floor (122)',
      g.wraps && g.lotH > 122, JSON.stringify(g));
    ok('every row is drawn within the lot, unclipped', g.allVisible, JSON.stringify(g));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await page.evaluate(async () => {
      const rec = newBoardRecord();
      rec.title = 'Lot ceiling fixture';
      rec.parkingLot = Array.from({ length: 40 }, (_, i) => ({
        id: 'p' + i, text: 'Row ' + i + ' with enough text to occupy a full '
          + 'single line on the phone sheet gutter', state: 'active',
      }));
      await idbPut(rec);
    });
    await reopen(page, 'Lot ceiling fixture');
    const g = await page.evaluate(() => {
      const b = document.querySelector('#board').getBoundingClientRect();
      const lot = document.querySelector('#lot').getBoundingClientRect();
      return { cap: Math.round(b.height * 0.5), lotH: Math.round(lot.height) };
    });
    ok('a runaway lot is held at half the sheet (B73 ceiling)',
      Math.abs(g.lotH - g.cap) <= 1, JSON.stringify(g));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 12. rh keeps y portable across frames (B32) --------------------------
  console.log('\n[12] Note y is frame-relative (rh)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await tap(page, 200, 400);
    await page.waitForTimeout(60);
    await page.keyboard.type('portable');
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(200);
    const before = await page.evaluate(() => {
      const n = document.querySelector('.note').getBoundingClientRect();
      return { top: n.top, h: window.innerHeight };
    });
    await page.setViewportSize({ width: 384, height: 600 });   // not editing: layout applies
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => {
      const n = document.querySelector('.note').getBoundingClientRect();
      return { top: n.top, h: window.innerHeight };
    });
    ok('top stays proportional to the sheet',
      Math.abs(after.top / after.h - before.top / before.h) < 0.01,
      before.top + '/' + before.h + ' -> ' + after.top + '/' + after.h);
    ok('a resize does not rewrite rh', await page.evaluate(() => new Promise(res => {
      const rq = indexedDB.open('boards-db');
      rq.onsuccess = () => {
        const all = rq.result.transaction('boards', 'readonly').objectStore('boards').getAll();
        all.onsuccess = () => {
          const n = all.result.flatMap(b => b.notes).find(n => n.text === 'portable');
          res(!!n && n.rh === 846);          // the frame it was written in, not 600
        };
      };
    })));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 12b. note size is frame-relative too (issue #57, B40) ----------------
  // renderX's law applied to visual scale: shrinking the sheet shrinks the
  // note at the same ratio, so relative geometry survives the resize. Reading
  // is not writing (B21): with no grab there is no rebase, and the stored
  // scale stays exactly what the author set.
  console.log('\n[12b] Note size scales with the sheet width (homothetic, B40)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await tap(page, 150, 400);
    await page.waitForTimeout(60);
    await page.keyboard.type('hi');           // short: never meets --note-max-w
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(300);
    const before = await page.evaluate(() =>
      document.querySelector('.note').getBoundingClientRect().width);
    await page.setViewportSize({ width: 300, height: 846 });
    await page.waitForTimeout(200);
    const after = await page.evaluate(() =>
      document.querySelector('.note').getBoundingClientRect().width);
    ok('rendered width shrank by ~300/384',
      Math.abs(after / before - 300 / 384) < 0.02, before + ' -> ' + after);
    ok('stored scale unchanged — no grab, no write (B21)',
      await page.evaluate(() => new Promise(res => {
        const rq = indexedDB.open('boards-db');
        rq.onsuccess = () => {
          const all = rq.result.transaction('boards', 'readonly').objectStore('boards').getAll();
          all.onsuccess = () => {
            const n = all.result.flatMap(b => b.notes).find(n => n.text === 'hi');
            res(!!n && n.scale === 1 && n.rw === 384);
          };
        };
      })));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 12c. fold/rotate is a similarity (issues #65/#75, B64) ---------------
  // One uniform ratio k = min(LOGICAL_W/rw, LOGICAL_H/rh) maps x, y and size
  // together, so an aspect change maps the arrangement as a figure instead of
  // shearing it: pairwise angles hold, distances and sizes scale by the one k,
  // min keeps every note on the page, and reading is not writing (B21) — the
  // stored geometry never moves. Folding back is the inverse similarity, so
  // the round trip is exact.
  console.log('\n[12c] Fold/rotate is a similarity: shape held, size uniform, storage untouched, round trip exact (issues #65/#75, B64)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await page.evaluate(async () => {
      const rec = newBoardRecord();
      rec.title = 'Similarity fixture';
      // Three notes in an L on the 384x846 frame they were authored in.
      rec.notes = [
        { id: 's1', text: 'n1', x: 60,  y: 200, rw: 384, rh: 846, scale: 1, state: 'active' },
        { id: 's2', text: 'n2', x: 300, y: 200, rw: 384, rh: 846, scale: 1, state: 'active' },
        { id: 's3', text: 'n3', x: 60,  y: 700, rw: 384, rh: 846, scale: 1, state: 'active' },
      ];
      await idbPut(rec);
    });
    await reopen(page, 'Similarity fixture');
    const measure = () => page.evaluate(() => {
      const b = document.querySelector('#board').getBoundingClientRect();
      const out = { board: { left: b.left, top: b.top, right: b.right, bottom: b.bottom } };
      for (const id of ['s1', 's2', 's3']) {
        const r = document.querySelector('[data-id="' + id + '"]').getBoundingClientRect();
        out[id] = { cx: r.x + r.width / 2 - b.x, cy: r.y + r.height / 2 - b.y,
                    w: r.width, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      }
      return out;
    });
    const dist = (m, a, b) => Math.hypot(m[b].cx - m[a].cx, m[b].cy - m[a].cy);
    const ang = (m, a, b) => Math.atan2(m[b].cy - m[a].cy, m[b].cx - m[a].cx);
    const before = await measure();

    // The fold: 384x846 -> 846x384. k = min(846/384, 384/846) = 384/846.
    await page.setViewportSize({ width: 846, height: 384 });
    await page.waitForTimeout(250);
    const after = await measure();
    const k = 384 / 846;

    const pairs = [['s1', 's2'], ['s1', 's3'], ['s2', 's3']];
    const ratios = pairs.map(([a, b]) => dist(after, a, b) / dist(before, a, b));
    ok('all pairwise distances shrink by the one ratio k ≈ ' + k.toFixed(4),
      ratios.every(r => Math.abs(r / k - 1) < 0.01), JSON.stringify(ratios));
    const angles = [['s1', 's2'], ['s1', 's3']].map(([a, b]) =>
      Math.abs(ang(after, a, b) - ang(before, a, b)) * 180 / Math.PI);
    ok('the figure keeps its angles at n1 (±0.5°)',
      angles.every(d => d < 0.5), JSON.stringify(angles));
    const wRatios = ['s1', 's2', 's3'].map(id => after[id].w / before[id].w);
    ok('every note width scales by k (±2%), and equally',
      wRatios.every(r => Math.abs(r / k - 1) < 0.02) &&
      Math.max(...wRatios) - Math.min(...wRatios) < 0.01, JSON.stringify(wRatios));
    ok('every note stays inside the board (min gives containment)',
      ['s1', 's2', 's3'].every(id =>
        after[id].left >= after.board.left - 0.5 && after[id].top >= after.board.top - 0.5 &&
        after[id].right <= after.board.right + 0.5 && after[id].bottom <= after.board.bottom + 0.5),
      JSON.stringify(after));
    ok('stored geometry untouched — reading is not writing (B21)',
      await page.evaluate(() => new Promise(res => {
        const rq = indexedDB.open('boards-db');
        rq.onsuccess = () => {
          const all = rq.result.transaction('boards', 'readonly').objectStore('boards').getAll();
          all.onsuccess = () => {
            const ns = all.result.flatMap(b => b.notes);
            const want = { s1: [60, 200], s2: [300, 200], s3: [60, 700] };
            res(Object.entries(want).every(([id, [x, y]]) => {
              const n = ns.find(m => m.id === id);
              return !!n && n.x === x && n.y === y && n.scale === 1 && n.rw === 384 && n.rh === 846;
            }));
          };
        };
      })));

    // And back: the inverse similarity lands every centre where it began.
    await page.setViewportSize({ width: 384, height: 846 });
    await page.waitForTimeout(250);
    const back = await measure();
    ok('round trip is lossless (every centre within 0.5px)',
      ['s1', 's2', 's3'].every(id =>
        Math.abs(back[id].cx - before[id].cx) < 0.5 &&
        Math.abs(back[id].cy - before[id].cy) < 0.5),
      JSON.stringify({ s1: [before.s1.cx, back.s1.cx, before.s1.cy, back.s1.cy] }));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 13. pre-B32 notes stay reachable; B93 adopts them onto the single path
  console.log('\n[13] Legacy note (no rh) is adopted onto the single path (B93, issue #141)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await page.evaluate(() => new Promise((res, rej) => {
      const rq = indexedDB.open('boards-db');
      rq.onsuccess = () => {
        const store = rq.result.transaction('boards', 'readwrite').objectStore('boards');
        const all = store.getAll();
        all.onsuccess = () => {
          const b = all.result.find(r => !r.cal) || all.result[0];
          // Written on the old ~1983-unit mobile sheet: off the bottom of a 846 page.
          b.notes.push({ id: 'legacy-1', text: 'old', x: 300, y: 1500, rw: 900, scale: 1, state: 'active' });
          const put = store.put(b);
          put.onsuccess = () => res(); put.onerror = () => rej(put.error);
        };
      };
      rq.onerror = () => rej(rq.error);
    }));
    // The legacy note rides the first-run (plain) board, which is what the
    // pre-B108 boot opened — the day board owns boot's landing now (B108).
    await reopen(page, await page.evaluate(async () =>
      (await idbGetAll()).find(r => r.title !== undefined && !r.cal).id));
    // B93 adopts the note at boot: it writes the position the legacy branch
    // rendered — x on the width ratio (384/900), y through LEGACY_H
    // (900·846/384 = 1982.8125) with the clamp — and stamps rw/rh, the same
    // fold rebaseNote performs. Render-silent: 300·384/900 = 128 and
    // 1500·846/1982.8125 = 640 are exactly where B32 drew it (P3 holds);
    // the supersedence of B32's "stored y is never mutated" is the ruling.
    const top = await page.evaluate(() => {
      const n = document.querySelector('[data-id="legacy-1"]');
      return n ? n.getBoundingClientRect().top : null;
    });
    ok('legacy note renders on the sheet at the legacy position',
       top !== null && Math.abs(top - 640) < 0.5, String(top));
    ok('note adopted onto the single path — frame stamped, y written',
       await page.evaluate(() => new Promise(res => {
         const rq = indexedDB.open('boards-db');
         rq.onsuccess = () => {
           const all = rq.result.transaction('boards', 'readonly').objectStore('boards').getAll();
           all.onsuccess = () => {
             const n = all.result.flatMap(b => b.notes).find(n => n.id === 'legacy-1');
             const okRatio = (v, want) => Math.abs(v - want) < 1e-6;
             res(!!n && okRatio(n.x, 128) && okRatio(n.y, 640) &&
                 okRatio(n.scale, 384 / 900) && n.rw === 384 && n.rh === 846);
           };
         };
       })));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 14. tap away deselects; a further tap opens a new note (issue #41) --
  console.log('\n[14] Tap away from an editing note only deselects it');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await tap(page, 150, 300);
    await page.waitForTimeout(60);
    await page.keyboard.type('keep me');
    await tap(page, 150, 550);                 // tap away on bare canvas
    await page.waitForTimeout(150);
    ok('no phantom second note appears', (await noteCount(page)) === 1, 'count=' + await noteCount(page));
    ok('nothing holds focus (keyboard dismissed)', !(await activeIsNoteText(page)));
    const textAfterDismiss = await page.evaluate(() =>
      document.querySelector('.note-text').textContent);
    ok('the original note text is unchanged', textAfterDismiss === 'keep me', textAfterDismiss);
    await tap(page, 150, 550);                 // a further tap now creates a new note
    await page.waitForTimeout(60);
    ok('a second note is created on the next tap', (await noteCount(page)) === 2, 'count=' + await noteCount(page));
    ok('the new note holds focus', await activeIsNoteText(page));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 15. long-press a board row exports it (issue #43) -------------------
  console.log('\n[15] Long-press a board row offers Export');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await page.evaluate(async () => {
      const rec = newBoardRecord();
      rec.title = 'Pocket board';
      rec.notes = [
        { id: 'm1', text: 'TOUCHMARKER', x: 60, y: 300, rw: 900, rh: 1000, scale: 1, state: 'active' },
        { id: 'm2', text: 'TOUCHSECRET', x: 60, y: 450, rw: 900, rh: 1000, scale: 1, state: 'complete' },
      ];
      await idbPut(rec);
    });
    await reopen(page, 'Pocket board');
    // newBoardRecord() seeds 'todo' (B67), so the Pocket board is a To-Do board;
    // its row lives on the drilled To-Do screen (issue #112 / B74).
    await openCat(page, 'todo');

    const row = await page.evaluate(() => {
      const r = [...document.querySelectorAll('#list-rows .board-row')]
        .find(x => x.textContent.includes('Pocket board')).getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const before = await noteCount(page);
    await tap(page, row.x, row.y, 700);                  // long-press, not a tap
    await page.waitForTimeout(200);
    ok('menu opened on row long-press',
       await page.evaluate(() => document.querySelector('#menu').hidden === false));
    const shape = await page.evaluate(() => {
      const b = [...document.querySelectorAll('#menu button')];
      return { labels: b.map(x => x.textContent), danger: b.map(x => x.classList.contains('danger')) };
    });
    ok('row menu is Export then Delete', shape.labels.length === 2 &&
       /Export/.test(shape.labels[0]) && /Delete/.test(shape.labels[1]), JSON.stringify(shape.labels));
    ok('only Delete is danger', shape.danger[0] === false && shape.danger[1] === true);
    ok('the long-press did not also open the board',
       await page.evaluate(() => document.querySelector('#list-view').hidden === false));

    const btn = await page.evaluate(() => {
      const b = [...document.querySelectorAll('#menu button')].find(x => /Export/.test(x.textContent));
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const [dl] = await Promise.all([page.waitForEvent('download'), tap(page, btn.x, btn.y)]);
    const s = fs.readFileSync(await dl.path()).toString('latin1');
    ok('touch export produced a PDF', s.startsWith('%PDF-') && s.trimEnd().endsWith('%%EOF'));
    ok('filename is the board slug', /^pocket-board-\d{4}-\d{2}-\d{2}\.pdf$/.test(dl.suggestedFilename()),
       dl.suggestedFilename());
    ok('active note text is in the file', s.includes('(TOUCHMARKER)'));
    ok('completed note text is ABSENT', !s.includes('TOUCHSECRET'));
    ok('exporting created no notes', (await noteCount(page)) === before);
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 16. long-press an anchor opens no menu (B92, issue #140) ------------
  // The anchor menu (All boards · Export) is retired: both of its actions have
  // lived on the board-action row since B83, and B92 removes the hidden route
  // outright. A long press on an anchor is now a spent gesture — no menu, no
  // fallback; the row above the lot is the only route.
  console.log('\n[16] Long-press an anchor opens no menu (issue #140, B92)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    // B108 lands boot on today's linked board; this block renames whatever is
    // open, so it runs on a plain board (a linked board's title is the species).
    await page.evaluate(async () => {
      const b = (await idbGetAll()).find(r => r.title !== undefined && !r.cal);
      if (b && b.id !== state.current.id) swapBoard(b.id);
    });
    await page.waitForTimeout(500);
    const t = await page.evaluate(() => {
      const r = document.querySelector('#anchor-title').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await tap(page, t.x, t.y);
    await page.waitForTimeout(60);
    await page.keyboard.type('Board in hand');
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(150);
    const note = await page.evaluate(() => {
      const r = document.querySelector('#board').getBoundingClientRect();
      return { x: r.x + 80, y: r.y + 300 };
    });
    await tap(page, note.x, note.y);
    await page.waitForTimeout(60);
    await page.keyboard.type('ANCHORPATHMARKER');
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(200);

    await tap(page, t.x, t.y, 700);                       // long-press the title card
    await page.waitForTimeout(200);
    ok('long-press on an anchor opens no menu (B92)', await page.evaluate(() =>
      document.querySelector('#menu').hidden !== false));
    ok('the gesture spent itself on nothing: the board is unchanged',
       await page.evaluate(() =>
         document.querySelector('#anchor-title').textContent === 'Board in hand' &&
         [...document.querySelectorAll('.note-text')].some(n => n.textContent === 'ANCHORPATHMARKER')));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 17. Copy from the note's long-press menu (issue #59, B84; B114) -----
  console.log('\n[17] Menu Copy shows the Copied notice');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    await tap(page, 200, 400);
    await page.waitForTimeout(60);
    await page.keyboard.type('pocket text');
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(200);
    const box = await page.evaluate(() => {
      const r = document.querySelector('.note').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await tap(page, box.x, box.y, 700);                  // long-press → the note menu (B91; Copy first, B114)
    await page.waitForTimeout(200);
    const menu = await page.evaluate(() =>
      [...document.querySelectorAll('#menu button')].map(b => b.textContent.trim()));
    ok('the long-press menu offers Copy first', menu.length >= 2 && menu[0] === 'Copy',
       JSON.stringify(menu));
    if (menu[0] === 'Copy') {
      await page.evaluate(() =>
        [...document.querySelectorAll('#menu button')].find(b => b.textContent.trim() === 'Copy').click());
      await page.waitForTimeout(300);
      ok('Copied notice shows', await page.evaluate(() => {
        const t = document.querySelector('#toast');
        return t.classList.contains('show') && /Copied/.test(t.textContent);
      }));
      ok('the record text reached the clipboard', await page.evaluate(() =>
        navigator.clipboard.readText().then(t => t === 'pocket text', () => false)));
      ok('copying deleted nothing', (await noteCount(page)) === 1);
    }
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 17b. Toolbar Highlight washes the note, and the label flips (issue #105, B71, B84)
  console.log('\n[17b] Toolbar Highlight washes the note, and toggles back');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await tap(page, 200, 400);
    await page.waitForTimeout(60);
    await page.keyboard.type('mark me');
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(200);
    const box = await page.evaluate(() => {
      const r = document.querySelector('.note').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    // A drawn-fresh note is not highlighted.
    ok('a new note is not highlighted', await page.evaluate(() =>
      !document.querySelector('.note').classList.contains('highlight') && !state.current.notes[0].highlighted));

    // The Highlight tab keeps the note engaged (no blur), so it can be toggled
    // twice without re-tapping — spaced past the B81 re-fire guard.
    const hlBtn = () => page.evaluate(() => {
      const b = document.querySelector('.note-tb-highlight');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: b.getAttribute('aria-label') };
    });

    await tap(page, box.x, box.y);                       // engage → the toolbar shows
    await page.waitForTimeout(200);
    let hb = await hlBtn();
    ok('the toolbar offers Highlight', !!hb && /^Highlight$/.test(hb.label), hb && hb.label);
    await tap(page, hb.x, hb.y);
    await page.waitForTimeout(300);
    ok('the note gains the highlight class', await page.evaluate(() =>
      document.querySelector('.note').classList.contains('highlight')));
    ok('and the record carries highlighted', await page.evaluate(() => state.current.notes[0].highlighted === true));
    ok('the tab label flips to Remove highlight', (await hlBtn()).label === 'Remove highlight',
       (await hlBtn()).label);

    // Toggle back off (past the guard); the note is still engaged.
    await page.waitForTimeout(300);
    hb = await hlBtn();
    await tap(page, hb.x, hb.y);
    await page.waitForTimeout(300);
    ok('the wash toggles back off', await page.evaluate(() =>
      !document.querySelector('.note').classList.contains('highlight') && state.current.notes[0].highlighted === false));
    ok('highlighting deleted nothing', (await noteCount(page)) === 1);
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 18. screen wrap ≡ export wrap, in authored units (issue #53, B39) ---
  // One law, two resolutions: the screen caps at (LOGICAL_W − renderX)/eff,
  // exportNoteBox at (EXPORT_W − exportX)/(scale·exportMult) — both reduce to
  // (rw − x)/scale, so a cap-hitting note wraps at the same width on a phone
  // sheet and on the 900 export frame. This is the cross-frame agreement B40
  // left as "known, not fixed".
  console.log('\n[18] Screen and export share one wrap law (issue #53)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await tap(page, 100, 300);
    await page.waitForTimeout(60);
    await page.keyboard.type('a long line of perfectly ordinary words that has to wrap '
      + 'well before the right edge arrives because it just keeps going and going');
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const note = state.current.notes[state.current.notes.length - 1];
      const node = document.querySelector('[data-id="' + note.id + '"]');
      const box = exportNoteBox(note);
      return { screenW: node.offsetWidth, exportW: box.w,
               cap: (note.rw - note.x) / (note.scale || 1),
               x: note.x, rw: note.rw, lines: box.lines.length };
    });
    // Authored at x=100 on this 384 sheet: the cap is 284 authored units.
    ok('screen wrap width is the authored-unit cap (±1)',
       Math.abs(m.screenW - m.cap) <= 1, JSON.stringify(m));
    ok('export wrap width agrees with the screen (±1)',
       Math.abs(m.exportW - m.screenW) <= 1, JSON.stringify(m));
    ok('the exported note wraps to more than one line', m.lines > 1, String(m.lines));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 18b. the note's text is centred in its frame (issue #82, B62) ------
  // One declaration covers both renders: the live editor IS .note-text
  // (contenteditable on the node, no overlay), so editing and rest agree.
  console.log('\n[18b] Note text is centred, editing and at rest (issue #82)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await tap(page, 100, 300);
    await page.waitForTimeout(60);
    await page.keyboard.type('centred words');
    ok('the editor centres as it types', await page.evaluate(() =>
      document.activeElement.classList.contains('note-text') &&
      getComputedStyle(document.activeElement).textAlign === 'center'));
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(300);
    ok('the resting note stays centred', await page.evaluate(() =>
      getComputedStyle(document.querySelector('.note-text')).textAlign === 'center'));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 19. the All-Boards picker + per-category drill (issue #112, B74) -----
  // The list is no longer one screen of stacked sections. "All boards" raises a
  // PICKER — on mobile, the Parking Lot turned into a 2x2 category grid — and
  // each category's boards live on their own DRILLED screen. Drag-between-
  // categories left the mobile list with the unified view; it lives on the
  // desktop rail now (test/desktop.js [D16]). Everything here still rides genuine
  // touch events, never synthesized clicks (B27b).
  console.log('\n[19] The All-Boards picker and per-category drill (issue #112, B74)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    // Two genuine pre-#58 legacy records — no `category` at all. B67 seeds
    // newBoardRecord() 'todo', so these are stripped: this is about what a record
    // that NEVER had a category reads as, the half of B21's idiom B67 left alone.
    await page.evaluate(async () => {
      const mk = async (title, ageMs) => {
        const r = newBoardRecord();
        r.title = title;
        delete r.category;
        r.createdAt = r.updatedAt = Date.now() - ageMs;
        await idbPut(r);
      };
      await mk('Legacy one', 50000);
      await mk('Legacy two', 60000);
    });
    await reopen(page, 'Legacy one');

    // -- the picker is the lot-grid: four category tiles, clockwise -----------
    await page.evaluate(() => goToList());
    await page.waitForTimeout(200);
    const pick = await page.evaluate(() => {
      const menu = document.querySelector('#lot-menu');
      const btns = [...menu.querySelectorAll('.cat-button')];
      const boxes = btns.map(b => b.getBoundingClientRect());
      return {
        menuShown: !menu.hidden,
        listHidden: document.querySelector('#list-view').hidden,
        lotDataKept: document.querySelector('#lot-items') !== null,
        cats: btns.map(b => b.dataset.cat),
        labels: btns.map(b => b.textContent),
        cols: getComputedStyle(menu).gridTemplateColumns.split(' ').filter(Boolean).length,
        floor: Math.min(...boxes.map(r => Math.min(r.width, r.height))),
      };
    });
    ok('All boards raises the lot-grid, not the list screen',
       pick.menuShown && pick.listHidden);
    ok('the board\'s own Parking Lot data is untouched beneath it (B74)', pick.lotDataKept);
    ok('the grid is a 2x2 of four tiles', pick.cols === 2 && pick.cats.length === 4,
       JSON.stringify(pick.cats));
    // GRID_ORDER lays them row-major [todo, unsorted, idea, learning] so the
    // clockwise reading from the top-left is To Do, Notes, Learning, Ideas.
    ok('clockwise from top-left: To Do, Notes, Learning, Ideas',
       pick.cats.join(',') === 'todo,unsorted,idea,learning', JSON.stringify(pick.cats));
    ok('each tile names its category (short names, no redundant "Boards" — B78)',
       pick.labels.join('|') === 'To Do|Notes|Ideas|Learning',
       JSON.stringify(pick.labels));
    ok('the tiles clear the 44px touch floor (UIUX §6)', pick.floor >= 44, String(pick.floor));

    // The grid lives in #lot INSIDE #board, so a tile with no rung of its own
    // inherits the surrounding board's --frame. Force a Learning scope on the
    // board and the To-Do tile must still resolve to its own blue, not the
    // Learning rose (B77) — the bug this guards was pink/violet To-Do tiles.
    const leak = await page.evaluate(() => {
      const board = document.getElementById('board');
      const prev = board.dataset.cat;
      board.dataset.cat = 'learning';        // stand the grid over a Learning board
      const todoTile = document.querySelector('#lot-menu .cat-button[data-cat="todo"]');
      const cs = getComputedStyle(todoTile);
      const todoFrame = cs.getPropertyValue('--frame').trim().toLowerCase();
      const todoWater = cs.getPropertyValue('--water-top').trim().toLowerCase();
      const boardFrame = getComputedStyle(board).getPropertyValue('--frame').trim().toLowerCase();
      board.dataset.cat = prev;              // restore
      return { todoFrame, todoWater, boardFrame };
    });
    ok('the To-Do tile keeps its own blue rung under a Learning board scope (B77)',
       leak.todoFrame === '#698ebf' && leak.boardFrame === '#b57a9b', JSON.stringify(leak));
    // The tile's water ground is re-asserted per family too (B89), so a To-Do tile
    // shows To-Do water, not the surrounding Learning board's — the same leak, closed
    // for the new gradient ground of issue #135.
    ok('the To-Do tile keeps its own water ground under a Learning board scope (B89)',
       leak.todoWater === '#34697f', JSON.stringify(leak));

    // Tapping a tile drills into that category's own screen.
    const tile = await page.evaluate(() => {
      const b = [...document.querySelectorAll('#lot-menu .cat-button')].find(x => x.dataset.cat === 'unsorted');
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await tap(page, tile.x, tile.y);
    await page.waitForTimeout(300);
    ok('tapping Notes drills to its screen alone', await page.evaluate(() =>
      document.querySelector('#list-view').hidden === false &&
      document.querySelector('#lot-menu').hidden === true &&
      document.querySelectorAll('#list-rows .board-cat').length === 1 &&
      document.querySelector('#list-rows .board-cat').dataset.cat === 'unsorted'));
    ok('the drilled Notes screen holds the two legacy records', await page.evaluate(() =>
      document.querySelectorAll('.board-cat[data-cat="unsorted"] .board-row').length === 2));

    // Back returns picker <- drill, then board <- picker (B9, the OS back gesture).
    await page.evaluate(() => history.back());
    await page.waitForTimeout(250);
    ok('back returns from the drill to the picker', await page.evaluate(() =>
      document.querySelector('#lot-menu').hidden === false &&
      document.querySelector('#list-view').hidden === true));
    await page.evaluate(() => history.back());
    await page.waitForTimeout(250);
    ok('back again returns from the picker to the board', await page.evaluate(() =>
      document.querySelector('#lot-menu').hidden === true &&
      document.querySelector('#list-view').hidden === true && !listOpen));
    ok('and the board\'s real Parking Lot is back', await page.evaluate(() =>
      !document.querySelector('#lot').classList.contains('menu-open')));

    // -- the seeded board is in To-Do; the legacy two were never written (B21) --
    await openCat(page, 'todo');
    ok('the seeded first-run board sits in To-Do', await page.evaluate(() => {
      // B108's day board is a legitimate second To-Do row now; what this
      // asserts is that the boot-created first-run board is among them.
      const rows = [...document.querySelectorAll('.board-cat[data-cat="todo"] .board-row')];
      return rows.length >= 1 && rows.some(r => !/\/\d\d\/\d\d To Do$/.test(r.textContent));
    }));
    ok('nothing was written to file the legacy records (B21)', await page.evaluate(async () =>
      (await idbGetAll()).filter(b => b.category === undefined && b.catStamp === undefined).length === 2));

    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 19b. a drilled category pages its overflow, never scrolls (B44/B74) --
  console.log('\n[19b] A drilled category pages its overflow and never scrolls');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await page.evaluate(async () => {
      // A drilled category takes the WHOLE screen (issue #112 / B74), so its
      // per-page budget is several times the old stacked-section budget — seed
      // well past it to force the 3+ pages the pager assertions below need.
      for (let i = 0; i < 100; i++) {
        const r = newBoardRecord();
        r.title = 'Seed ' + i;
        r.category = 'unsorted';
        r.createdAt = r.updatedAt = Date.now() - (i + 2) * 100000;
        await idbPut(r);
      }
    });
    await page.reload();
    await page.waitForTimeout(500);
    await openCat(page, 'unsorted');

    const pg = await page.evaluate(async () => {
      const un = document.querySelector('.board-cat[data-cat="unsorted"]');
      const pager = un.querySelector('.cat-pager');
      const btns = [...pager.querySelectorAll('.pager-btn')];
      const all = await idbGetAll();
      const cards = un.querySelector('.cat-cards');
      return {
        onlyOne: document.querySelectorAll('#list-rows .board-cat').length === 1,
        visible: !pager.hidden,
        disabled: btns.map(b => b.disabled),
        labels: btns.map(b => b.getAttribute('aria-label')),
        ind: un.querySelector('.cat-pages').textContent,
        onPage: un.querySelectorAll('.board-row').length,
        total: all.filter(b => catOf(b) === 'unsorted').length,
        noScroll: cards.scrollHeight <= cards.clientHeight + 1,
        listNoScroll: (() => { const v = document.querySelector('#list-view'); return v.scrollHeight <= v.clientHeight + 1; })(),
        cols: getComputedStyle(cards).gridTemplateColumns.split(' ').filter(Boolean).length,
        floor: Math.min(...btns.map(b => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height))),
      };
    });
    ok('the drill shows exactly its one category', pg.onlyOne);
    ok('pager visible in Notes', pg.visible);
    ok('pager is first/prev/next/last', pg.labels.join(',') ===
       'First page,Previous page,Next page,Last page', pg.labels.join(','));
    ok('first/prev disabled on page 0; next/last enabled',
       pg.disabled[0] && pg.disabled[1] && !pg.disabled[2] && !pg.disabled[3], JSON.stringify(pg.disabled));
    const pages = Math.ceil(pg.total / pg.onPage);
    ok('indicator reads 1/' + pages, pg.ind === '1/' + pages,
       pg.ind + ' (total=' + pg.total + ' onPage=' + pg.onPage + ')');
    ok('the seed still overflows into 3+ pages', pages >= 3, 'pages=' + pages);
    // B82: the drilled panel is a third of the viewport, and a row carries three cards.
    ok('the cards track is three columns wide (B82)', pg.cols === 3, String(pg.cols));
    ok('the shown page does not overflow its clip', pg.noScroll);
    ok('the drill panel itself does not scroll', pg.listNoScroll);
    ok('pager buttons clear the 44px touch floor', pg.floor >= 44, String(pg.floor));

    // Page turns are inert navigation — instant, no 400ms window (B22).
    const tapPager = async (lbl) => {
      const b = await page.evaluate((l) => {
        const r = document.querySelector('.board-cat[data-cat="unsorted"] .pager-btn[aria-label="' + l + '"]').getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, lbl);
      await tap(page, b.x, b.y);
      await page.waitForTimeout(150);
    };
    const unState = () => page.evaluate(() => {
      const un = document.querySelector('.board-cat[data-cat="unsorted"]');
      const btn = (l) => un.querySelector('.pager-btn[aria-label="' + l + '"]');
      return { ind: un.querySelector('.cat-pages').textContent, first: un.querySelector('.board-row').dataset.id,
               nextOff: btn('Next page').disabled, lastOff: btn('Last page').disabled };
    });
    const p0 = await unState();
    await tapPager('Next page');
    let s = await unState();
    ok('next turns to page 2', s.ind === '2/' + pages && s.first !== p0.first, s.ind);
    await tapPager('Last page');
    s = await unState();
    ok('last jumps to the end, next/last disable', s.ind === pages + '/' + pages && s.nextOff && s.lastOff, s.ind);
    await tapPager('Previous page');
    s = await unState();
    ok('prev steps back', s.ind === (pages - 1) + '/' + pages, s.ind);
    await tapPager('First page');
    s = await unState();
    ok('first returns to page 1', s.ind === '1/' + pages && s.first === p0.first, s.ind);
    ok('a page turn opened no board', await page.evaluate(() =>
      document.querySelector('#list-view').hidden === false));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 19c. last touch orders a drilled category (issue #97, B69) ----------
  console.log('\n[19c] A board edited through the app returns to the top of its category (B69)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await page.evaluate(async () => {
      for (let i = 0; i < 6; i++) {
        const r = newBoardRecord();
        r.title = 'Order ' + i;
        r.category = 'unsorted';
        r.catStamp = r.createdAt = r.updatedAt = Date.now() - (i + 2) * 100000;
        await idbPut(r);
      }
    });
    await page.reload();
    await page.waitForTimeout(500);
    await openCat(page, 'unsorted');

    const unSorted = () => page.evaluate(async () => {
      const all = await idbGetAll();
      return all.map(b => (state.current && b.id === state.current.id) ? state.current : b)
                .filter(b => catOf(b) === 'unsorted').sort(catOrder).map(b => b.id);
    });
    const unShown = () => page.evaluate(() =>
      [...document.querySelectorAll('.board-cat[data-cat="unsorted"] .board-row')].map(c => c.dataset.id));
    const order0 = await unSorted();
    const shown0 = await unShown();
    // The SECOND card on the page — visible, and not already first.
    const target = shown0[1];
    ok('a non-first card is under test', !!target && target !== order0[0], String(target));
    const tbox = await page.evaluate((id) => {
      const r = document.querySelector('.board-row[data-id="' + id + '"]').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, target);
    await tap(page, tbox.x, tbox.y);
    await page.waitForTimeout(600);                     // past ACTION_DELAY; two pops → board
    ok('the second card opened its board', await page.evaluate(() => state.current.id) === target);
    ok('and the nav returned all the way to the board', await page.evaluate(() =>
      !listOpen && document.querySelector('#list-view').hidden === true &&
      document.querySelector('#lot-menu').hidden === true));
    // A genuine edit: capture a note and commit it — the commit's saveNow() stamps updatedAt.
    await tap(page, 200, 500);
    await page.waitForTimeout(80);
    await page.keyboard.type('touched');
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(400);
    await openCat(page, 'unsorted');
    const order1 = await unSorted();
    ok('the edited board is now first in its category', order1[0] === target,
       order1.join(',') + ' (edited ' + target + ')');
    ok('and its card is first on the page', (await unShown())[0] === target, (await unShown()).join(','));
    ok('the boards nobody touched keep their relative order',
       order1.filter(id => id !== target).join(',') === order0.filter(id => id !== target).join(','),
       order1.join(',') + ' vs ' + order0.join(','));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 20. per-category creation on the drilled screen (issue #88 / #112) --
  // Each category's own screen carries its New board control on the head row,
  // the pager below the cards, centred; the global buttons are gone. Creating
  // rides genuine touch events (B27b). Since issue #112 the control is measured
  // on the drilled screen, one category at a time, not on a stacked list.
  console.log('\n[20] Per-category New board on the drilled screen: head row, pager, create-in-category');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await page.evaluate(async () => {
      // Past the full-screen single-category budget (B74) so the pager row is
      // under test beneath the cards.
      for (let i = 0; i < 60; i++) {
        const r = newBoardRecord();
        r.title = 'Fill ' + i;
        r.category = 'unsorted';
        r.catStamp = r.createdAt = r.updatedAt = Date.now() - (i + 1) * 100000;
        await idbPut(r);
      }
    });
    await page.reload();
    await page.waitForTimeout(500);
    await openCat(page, 'unsorted');

    ok('the global New board buttons are gone', await page.evaluate(() =>
      !document.querySelector('#new-board') && !document.querySelector('#pane-new')));
    const geo = await page.evaluate(() => {
      const sec = document.querySelector('#list-rows .board-cat');
      const s = sec.getBoundingClientRect();
      const a = sec.querySelector('.cat-add').getBoundingClientRect();
      const h = sec.querySelector('.cat-head').getBoundingClientRect();
      const cards = sec.querySelector('.cat-cards');
      const pager = sec.querySelector('.cat-pager');
      const kids = pager && !pager.hidden ? [...pager.children].map(k => k.getBoundingClientRect()) : null;
      const span = sec.querySelector('.cat-head span');
      return {
        cat: sec.dataset.cat,
        addRight: Math.abs(a.right - s.right),
        headH: h.height, addH: a.height, addW: a.width,
        headOverflow: span.scrollWidth > span.clientWidth + 1,
        pagerVisible: !!kids,
        pagerBelow: kids ? pager.getBoundingClientRect().top >= cards.getBoundingClientRect().bottom : null,
        pagerCentre: kids ? Math.abs((Math.min(...kids.map(k => k.left)) + Math.max(...kids.map(k => k.right))) / 2 - (s.left + s.width / 2)) : null,
        clip: cards.scrollHeight <= cards.clientHeight + 1,
      };
    });
    ok('the New board control is anchored to the section\'s right edge (±1)',
       geo.addRight <= 1, String(geo.addRight));
    ok('the head row is one box: header height = button height',
       Math.abs(geo.headH - geo.addH) < 0.5, JSON.stringify([geo.headH, geo.addH]));
    ok('the control clears the 44px touch floor', geo.addH >= 44 && geo.addW >= 44,
       JSON.stringify([geo.addW, geo.addH]));
    ok('no header truncates beside its control', !geo.headOverflow, String(geo.headOverflow));
    ok('a visible pager is under test', geo.pagerVisible);
    ok('the pager sits below the cards', geo.pagerBelow);
    ok('and centres on its section (±1)', geo.pagerCentre <= 1, String(geo.pagerCentre));
    ok('the section does not overflow its clip', geo.clip);
    ok('the drill screen itself does not scroll', await page.evaluate(() => {
      const v = document.querySelector('#list-view');
      return v.scrollHeight <= v.clientHeight + 1;
    }));
    await ctx.close();
  }

  // The longest category name — "Learning" (B78 dropped the redundant "Boards")
  // — keeps its whole self beside the New board control on its own drilled screen.
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await page.evaluate(async () => {
      const r = newBoardRecord(); r.title = 'A learning board';
      r.category = 'learning'; r.catStamp = r.createdAt = r.updatedAt = Date.now();
      await idbPut(r);
    });
    await page.reload();
    await page.waitForTimeout(500);
    await openCat(page, 'learning');
    ok('"Learning" head does not truncate beside its control (B74/B78)',
       await page.evaluate(() => {
         const span = document.querySelector('#list-rows .board-cat[data-cat="learning"] .cat-head span');
         return span.textContent === 'Learning' && span.scrollWidth <= span.clientWidth + 1;
       }));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // Tap the drilled category's own New board control: it creates and opens the
  // board IN that category, instantly (B81).
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await page.reload();
    await page.waitForTimeout(400);
    await openCat(page, 'todo');
    const before = await page.evaluate(() => state.current.id);
    const btn = await page.evaluate(() => {
      const r = document.querySelector('.board-cat[data-cat="todo"] .cat-add').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await tap(page, btn.x, btn.y);
    await page.waitForTimeout(80);
    ok('no acknowledgment fill: the beat is retired (B81)',
       await page.evaluate(() => !document.querySelector('.cat-add.tapped')));
    await page.waitForTimeout(600);
    ok('it opened onto the new board', await page.evaluate(() =>
      document.querySelector('#list-view').hidden !== false && !listOpen));
    const rec = await page.evaluate(async () => {
      const all = await idbGetAll();
      const newest = all.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
      return { cat: newest.category, stamp: typeof newest.catStamp, opened: newest.id === state.current.id };
    });
    ok('the record is written into To-Do, stamped, and open',
       rec.cat === 'todo' && rec.stamp === 'number' && rec.opened, JSON.stringify(rec));
    ok('and it is a new board, not the one that was open',
       await page.evaluate(() => state.current.id) !== before);
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 21. the board-action row: All boards / Export, declared above the lot -
  console.log('\n[21] The board-action row above the Parking Lot (issue #126, B83)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    const geo = await page.evaluate(() => {
      const row = document.querySelector('#board-actions');
      const btns = [...row.querySelectorAll('.board-action')];
      const lot = document.querySelector('#lot').getBoundingClientRect();
      const rs = parseFloat(getComputedStyle(document.querySelector('#board'))
        .getPropertyValue('--rs')) || 1;
      const hit = parseFloat(getComputedStyle(row).getPropertyValue('--hit')) || 0;
      const collar = getComputedStyle(btns[0], '::before');
      const boards = btns[0].getBoundingClientRect(), exp = btns[1].getBoundingClientRect();
      return {
        gone: document.querySelector('#title-menu') === null,
        role: row.getAttribute('role'),
        labels: btns.map(b => b.querySelector('.label').textContent),
        hasGlyph: btns.every(b => !!b.querySelector('.glyph svg')),
        onLight: btns.every(b => b.classList.contains('on-light')),
        lotTop: lot.top, rowBottom: Math.max(boards.bottom, exp.bottom), rs, hit,
        collarTop: collar.top, collarBottom: collar.bottom,
        boards: { x: boards.x + boards.width / 2, y: boards.y + boards.height / 2,
                  w: boards.width, h: boards.height, top: boards.top },
        exp: { x: exp.x + exp.width / 2, y: exp.y + exp.height / 2, w: exp.width, h: exp.height },
      };
    });
    ok('the old #title-menu handle is gone', geo.gone);
    ok('the row is a labelled group of four tabs: All, Export, Import, Calendar (B92 re-grammared by #145 R7.2)',
       geo.role === 'group' && geo.labels.length === 4 &&
       /All/.test(geo.labels[0]) && /Export/.test(geo.labels[1]) &&
       /Import/.test(geo.labels[2]) && /Calendar/.test(geo.labels[3]), JSON.stringify(geo.labels));
    ok('each tab carries its drawn mark and rebinds ink via .on-light',
       geo.hasGlyph && geo.onLight);
    ok('the row sits above the lot\'s top edge', geo.rowBottom <= geo.lotTop + 0.5,
       JSON.stringify([geo.rowBottom, geo.lotTop]));
    // UIUX §6 / B7: the flat tab is under the floor; the collar clears it.
    ok('both tabs clear the 44px touch floor (width on their own, height via the collar)',
       geo.boards.w >= 44 && geo.exp.w >= 44 &&
       geo.boards.h + 2 * geo.hit * geo.rs >= 44 && geo.exp.h + 2 * geo.hit * geo.rs >= 44,
       JSON.stringify([geo.boards.w, geo.boards.h + 2 * geo.hit * geo.rs, geo.hit, geo.rs]));
    // The collar is asymmetric (B83): spent UPWARD, onto the canvas, away from
    // the lot below — the mirror of the handle's downward collar.
    ok('the collar reaches up, never down into the lot',
       geo.collarBottom === '0px' && parseFloat(geo.collarTop) <= 0,
       JSON.stringify([geo.collarTop, geo.collarBottom]));

    // Press the collar — above the tab, over bare canvas — so the passthrough,
    // not the painted box, is what is under test: it must fire the tab, not drop
    // a note (the reading B65's collar had, mirrored).
    const before = await noteCount(page);
    await tap(page, geo.boards.x, geo.boards.top - geo.hit * geo.rs);
    await page.waitForTimeout(200);
    const opened = await page.evaluate(() => ({
      grid: document.querySelector('#lot-menu').hidden === false,
      lotMenuOpen, listOpen,
      label: document.querySelector('#action-boards .label').textContent,
    }));
    ok('All boards raised the lot-grid — no note on the canvas beneath the collar',
       opened.grid && opened.lotMenuOpen && (await noteCount(page)) === before,
       JSON.stringify([opened.grid, opened.lotMenuOpen]));
    ok('and the tab flips its label to This board', /This board/.test(opened.label), opened.label);

    // The toggle's other face returns you, however the surface was raised.
    const back = await page.evaluate(() => {
      const r = document.querySelector('#action-boards').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await tap(page, back.x, back.y);
    await page.waitForTimeout(300);
    ok('This board returns to the board — grid gone, label back to All (R7.2\'s short form)',
       await page.evaluate(() => document.querySelector('#lot-menu').hidden === true &&
         !lotMenuOpen && !listOpen &&
         /^All$/.test(document.querySelector('#action-boards .label').textContent)));

    // history.go is async and not idempotent, so a re-entrant returnToBoard (a
    // fast double-tap of "This board", where the tab is not blurred on mobile)
    // would double-pop past the board and out of the app. The popping guard
    // drops the second call before the first pop's popstate lands (B83).
    await page.evaluate(() => goToList());
    await page.waitForTimeout(200);
    const pops = await page.evaluate(() => {
      let n = 0; const real = history.go.bind(history);
      history.go = (d) => { n++; real(d); };
      returnToBoard(); returnToBoard();            // the second must be dropped
      history.go = real;
      return n;
    });
    await page.waitForTimeout(300);
    ok('a re-entrant returnToBoard pops once, never past the board (B83)', pops === 1, String(pops));
    ok('and it landed back on the board', await page.evaluate(() =>
      !!document.querySelector('#board') && !listOpen && !lotMenuOpen));

    // Export is now a CHOICE (B92): the tab opens the PDF · JSON menu at the
    // tab, and the PDF leaf commits (a file leaves the device).
    const beforeExport = await noteCount(page);
    await tap(page, geo.exp.x, geo.exp.y);
    await page.waitForTimeout(250);
    const choice = await page.evaluate(() =>
      [...document.querySelectorAll('#menu button')].map(b => b.textContent));
    ok('the Export tab opened the PDF · JSON choice menu (B92)',
       choice.length === 2 && /PDF/.test(choice[0]) && /JSON/.test(choice[1]), JSON.stringify(choice));
    const pdfBtn = await page.evaluate(() => {
      const b = [...document.querySelectorAll('#menu button')].find(x => /PDF/.test(x.textContent));
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      tap(page, pdfBtn.x, pdfBtn.y),
    ]);
    const s = fs.readFileSync(await dl.path()).toString('latin1');
    ok('the choice menu PDF leaf produced a PDF', s.startsWith('%PDF-') && s.trimEnd().endsWith('%%EOF'));
    ok('exporting created no note under the tab', (await noteCount(page)) === beforeExport);

    // The anchor long-press menu is retired (B92): a long-press on the title
    // opens nothing — the row above the lot is the only route.
    const t = await page.evaluate(() => {
      const r = document.querySelector('#anchor-title').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + 24 };
    });
    await tap(page, t.x, t.y, 700);
    await page.waitForTimeout(200);
    ok('long-press on the title opens no menu (B92)',
       await page.evaluate(() => document.querySelector('#menu').hidden !== false));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 22. the drilled category's budget is measured, never a constant -----
  // A category on its own screen (issue #112 / B74) takes the whole surface —
  // catPageCap is told one section is drawn — so B42's "measured, never a
  // constant" law and B70's two-column row still hold, now per drill. An empty
  // category's drill keeps its head and its New board control, and never scrolls.
  console.log('\n[22] The drilled category takes the whole screen; its budget is measured (B42/B70/B74)');
  {
    // -- a full category: two columns, a measured page, honest pager, no scroll
    {
      const { ctx, page, errors } = await newMobilePage(browser);
      await page.evaluate(async () => {
        for (const b of await idbGetAll()) await idbDelete(b.id);
        // Past the full-screen single-category budget (B74), so the pager shows.
        for (let i = 0; i < 60; i++) {
          const r = newBoardRecord();
          r.title = 'Note ' + i;
          r.category = 'unsorted';
          r.catStamp = r.createdAt = r.updatedAt = Date.now() - (i + 1) * 100000;
          await idbPut(r);
        }
      });
      await page.reload();
      await page.waitForTimeout(500);
      await openCat(page, 'unsorted');
      const s = await page.evaluate(async () => {
        const sec = document.querySelector('#list-rows .board-cat');
        const cards = sec.querySelector('.cat-cards');
        const v = document.querySelector('#list-view');
        const all = await idbGetAll();
        const vr = v.getBoundingClientRect();
        const oneDate = sec.querySelector('.board-row .row-date');
        return {
          only: document.querySelectorAll('#list-rows .board-cat').length,
          cols: getComputedStyle(cards).gridTemplateColumns.split(' ').filter(Boolean).length,
          onPage: sec.querySelectorAll('.board-row').length,
          total: all.filter(b => catOf(b) === 'unsorted').length,
          ind: sec.querySelector('.cat-pager').hidden ? null : sec.querySelector('.cat-pages').textContent,
          cardFloor: Math.min(99, ...[...sec.querySelectorAll('.board-row')].map(c => c.getBoundingClientRect().height)),
          clip: cards.scrollHeight <= cards.clientHeight + 1,
          listNoScroll: v.scrollHeight <= v.clientHeight + 1,
          // The slide-up panel (B82): a bottom third of the viewport, the board
          // visible above it, risen to translateY(0) via .show.
          risen: v.classList.contains('show'),
          panelTop: Math.round(vr.top),
          panelBottom: Math.round(vr.bottom),
          panelH: Math.round(vr.height),
          vh: window.innerHeight,
          // Every card carries a "Last Updated: MM/DD/YY" line (B82).
          dateText: oneDate ? oneDate.textContent : null,
          dateCount: sec.querySelectorAll('.board-row .row-date').length,
        };
      });
      ok('the drill draws exactly one section', s.only === 1, String(s.only));
      ok('the cards track is three columns wide (B82)', s.cols === 3, String(s.cols));
      ok('no card is under the 44px touch floor (UIUX §6)', s.cardFloor >= 44, String(s.cardFloor));
      // The slide-up panel is a bottom third of the viewport, board still behind it (B82).
      ok('the drilled list rose to a bottom panel', s.risen && s.panelBottom >= s.vh - 1,
         JSON.stringify([s.risen, s.panelBottom, s.vh]));
      ok('the panel is about a third of the viewport, the board visible above',
         s.panelTop > s.vh * 0.5 && Math.abs(s.panelH - s.vh / 3) <= 8,
         JSON.stringify([s.panelTop, s.panelH, s.vh]));
      ok('every card carries a Last Updated MM/DD/YY line (B82)',
         s.dateCount === s.onPage && /^Last Updated: \d{2}\/\d{2}\/\d{2}$/.test(s.dateText || ''),
         JSON.stringify([s.dateCount, s.onPage, s.dateText]));
      ok('the third-of-the-viewport panel still clears several cards (B82)', s.onPage >= 6,
         JSON.stringify([s.onPage, s.total]));
      ok('the budget is measured, and the pager says so',
         s.ind === '1/' + Math.ceil(s.total / s.onPage), s.ind + ' onPage=' + s.onPage);
      ok('the section does not overflow its clip', s.clip);
      ok('the panel itself does not scroll', s.listNoScroll);
      // The board behind the risen panel is context, not a capture surface (B82):
      // a tap on the exposed sheet above the panel must not drop a note on it.
      const notesBefore = await page.evaluate(() => (state.current.notes || []).length);
      await tap(page, 190, 200);         // well above panelTop (~564): bare board
      await page.waitForTimeout(120);
      const inert = await page.evaluate(() => {
        const v = document.querySelector('#list-view');
        return { notes: (state.current.notes || []).length, shown: v.hidden === false && v.classList.contains('show') };
      });
      ok('a tap on the board behind the panel captures nothing (B82)',
         inert.notes === notesBefore && inert.shown, JSON.stringify([inert.notes, notesBefore, inert.shown]));
      ok('no page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // -- an empty category: head + New board survive, and nothing scrolls -----
    {
      const { ctx, page, errors } = await newMobilePage(browser);
      await page.reload();
      await page.waitForTimeout(400);
      await openCat(page, 'learning');   // nothing seeded here: an empty drill
      const s = await page.evaluate(() => {
        const sec = document.querySelector('#list-rows .board-cat');
        const v = document.querySelector('#list-view');
        const add = sec.querySelector('.cat-add').getBoundingClientRect();
        return {
          cat: sec.dataset.cat,
          label: sec.querySelector('.cat-head span').textContent,
          cards: sec.querySelectorAll('.board-row').length,
          addBox: [Math.round(add.width), Math.round(add.height)],
          listNoScroll: v.scrollHeight <= v.clientHeight + 1,
        };
      });
      ok('an empty category still names itself and offers New board',
         s.cat === 'learning' && s.label === 'Learning' &&
         s.addBox[0] >= 44 && s.addBox[1] >= 44, JSON.stringify(s));
      ok('an empty drill holds no cards and does not scroll',
         s.cards === 0 && s.listNoScroll, JSON.stringify([s.cards, s.listNoScroll]));

      // Creating in the empty drilled category still works and opens the board.
      const btn = await page.evaluate(() => {
        const r = document.querySelector('.board-cat[data-cat="learning"] .cat-add').getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      await tap(page, btn.x, btn.y);
      await page.waitForTimeout(600);
      ok('New board in an empty Learning drill creates there and opens it',
         await page.evaluate(async () => {
           const all = await idbGetAll();
           const newest = all.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
           return newest.category === 'learning' && newest.id === state.current.id &&
             document.getElementById('board').dataset.cat === 'learning';
         }));
      ok('no page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
  }

  // ---- 23. dismissing the keyboard puts the note away (issue #119, B80) -----
  // The keyboard-proxy of test [7], carried one step further: shrink is the
  // keyboard coming up (the sheet holds still, B28, focus kept); the grow BACK
  // is it going down while the note still holds focus, and the note must
  // deselect then — not sit half-live waiting for a throwaway tap.
  console.log('\n[23] Dismissing the mobile keyboard deselects the active note');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await tap(page, 200, 300);
    await page.waitForTimeout(60);
    await page.keyboard.type('put me away');
    await page.setViewportSize({ width: 384, height: 450 });   // keyboard up
    await page.waitForTimeout(200);
    ok('editor still focused while the keyboard is up (B28)', await activeIsNoteText(page));
    await page.setViewportSize({ width: 384, height: 846 });   // keyboard dismissed
    await page.waitForTimeout(200);
    ok('the note deselects on keyboard dismissal (#119)', !(await activeIsNoteText(page)));
    ok('the note survives — blur committed, not discarded', (await noteCount(page)) === 1,
       'count=' + await noteCount(page));
    ok('its text is unchanged', await page.evaluate(() =>
       document.querySelector('.note-text').textContent) === 'put me away');
    // The first tap after dismissal is a real action, not spent dismissing.
    await tap(page, 200, 560);
    await page.waitForTimeout(60);
    ok('the next tap creates a new note (no dead first tap)', (await noteCount(page)) === 2,
       'count=' + await noteCount(page));
    ok('the new note holds focus', await activeIsNoteText(page));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 24. Note linking (issue #142, B91) ----------------------------------
  // Long-press a note → its Copy · Link menu (B114) → tap Link → tap another
  // note draws a
  // --frame line between their centres, below the notes and click-through;
  // re-linking the pair removes it; a stray tap cancels; deleting a note prunes.
  console.log('\n[24] Note linking: long-press → Link → tap target (issue #142, B91)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    // B108 lands boot on today's linked board; the Link-only menu grammar
    // (B91) is a plain-board contract — manual adds on a linked board carry
    // the two re-homing options (B108). Run on a plain board.
    await page.evaluate(async () => {
      const b = (await idbGetAll()).find(r => r.title !== undefined && !r.cal);
      if (b && b.id !== state.current.id) swapBoard(b.id);
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      state.current.notes.length = 0; if (state.current.links) state.current.links.length = 0;
      state.current.notes.push({ id:'la', text:'Alpha', x:80,  y:250, rw:LOGICAL_W, rh:LOGICAL_H, scale:1, state:'active' });
      state.current.notes.push({ id:'lb', text:'Bravo', x:190, y:600, rw:LOGICAL_W, rh:LOGICAL_H, scale:1, state:'active' });
      renderBoard();
    });
    await page.waitForTimeout(120);
    const c = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.note')].map(n => {
      const r = n.getBoundingClientRect(); return [n.dataset.id, { x: r.x + r.width / 2, y: r.y + r.height / 2 }];
    })));
    const links = () => page.evaluate(() => (state.current.links || []).length);
    const lines = () => page.evaluate(() => document.querySelectorAll('#link-layer line').length);
    const chooseLink = () => page.evaluate(() =>
      [...document.querySelectorAll('#menu button')].find(b => /Link/.test(b.textContent)).click());

    // Long-press Alpha → its Copy · Link menu (Copy first, B114).
    await tap(page, c.la.x, c.la.y, 700);
    await page.waitForTimeout(120);
    ok('a note long-press opens a menu (B91)',
       await page.evaluate(() => document.querySelector('#menu').hidden === false));
    const items = await page.evaluate(() => [...document.querySelectorAll('#menu button')].map(b => b.textContent.trim()));
    ok('its items are Copy then Link', items.join('|') === 'Copy|Link', JSON.stringify(items));

    // Choose Link → the mode arms with a hint; tap Bravo → one link + one line.
    await chooseLink();
    await page.waitForTimeout(80);
    ok('Link arms the mode and shows a hint toast', await page.evaluate(() =>
      linkSource !== null && document.querySelector('#toast').dataset.mode === 'link'));
    await tap(page, c.lb.x, c.lb.y);
    await page.waitForTimeout(120);
    ok('tapping the second note creates one link', (await links()) === 1, 'links=' + await links());
    ok('and draws one line', (await lines()) === 1, 'lines=' + await lines());
    ok('the link records both note ids', await page.evaluate(() => {
      const l = state.current.links[0]; return (l.a === 'la' && l.b === 'lb') || (l.a === 'lb' && l.b === 'la');
    }));
    ok('link mode cleared after completing', await page.evaluate(() => linkSource === null));

    // The line sits BELOW notes, is --frame, non-scaling, and click-through.
    ok('the line is a non-scaling --frame stroke below notes, pointer-events:none',
       await page.evaluate(() => {
         const line = document.querySelector('#link-layer line');
         const layer = document.querySelector('#link-layer');
         const cs = getComputedStyle(line), ls = getComputedStyle(layer);
         const znote = Number(getComputedStyle(document.querySelector('.note')).zIndex);
         return ls.pointerEvents === 'none' &&
                cs.getPropertyValue('vector-effect') === 'non-scaling-stroke' &&
                Number(ls.zIndex) < znote;
       }));

    // Re-linking the same pair removes the link (toggle, B91). Wait out the
    // create's re-fire guard (ACTION_DELAY 400ms) first.
    await page.evaluate(() => hideToast());
    await page.waitForTimeout(450);
    await tap(page, c.la.x, c.la.y, 700);
    await page.waitForTimeout(100);
    await chooseLink();
    await page.waitForTimeout(80);
    await tap(page, c.lb.x, c.lb.y);
    await page.waitForTimeout(120);
    ok('re-linking the pair removes the link', (await links()) === 0, 'links=' + await links());
    ok('and its line', (await lines()) === 0, 'lines=' + await lines());

    // A tap on empty paper while armed cancels — and creates no note under it.
    await page.evaluate(() => hideToast());
    await page.waitForTimeout(450);
    await tap(page, c.la.x, c.la.y, 700);
    await page.waitForTimeout(100);
    await chooseLink();
    await page.waitForTimeout(80);
    ok('armed again', await page.evaluate(() => linkSource !== null));
    await tap(page, 40, 460);                              // empty paper between the notes
    await page.waitForTimeout(100);
    ok('an empty-paper tap cancels link mode', await page.evaluate(() => linkSource === null));
    ok('and creates no link', (await links()) === 0, 'links=' + await links());
    ok('and no stray note', (await noteCount(page)) === 2, 'count=' + await noteCount(page));

    // Deleting a linked note prunes its link (persist-level integrity, B91).
    await page.evaluate(() => { state.current.links = [{ id:'lk', a:'la', b:'lb' }]; updateLinks(); });
    ok('link re-seeded', (await links()) === 1);
    await page.evaluate(() => deleteNote(noteEls.get('la')));
    await page.waitForTimeout(150);
    ok('deleting a linked note drops its links', (await links()) === 0, 'links=' + await links());
    ok('and the line goes with it', (await lines()) === 0, 'lines=' + await lines());

    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  // ---- 25. an existing calendar event is editable in place (issue #152) ----
  // The bug: makeCalDay rendered existing events as inert text — only the add
  // flow ever opened the editor. The fix wires the line's own tap to its
  // existing editor (B97): tap an event -> contenteditable, focused, caret at
  // the END of the text (the issue's expected behavior), inside the tap
  // gesture. Commit-on-blur persists the event and re-syncs the mirror; an
  // empty commit discards (B8); a completed event stays completed.
  // Flows are separated because two taps inside the double-tap window make
  // Chromium word-select the now-editable line — native text behavior, not
  // the app's — so each flow opens its editor fresh.
  console.log('\n[25] Calendar: tap an existing event edits it in place (issue #152, B97)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    // Seed today's date with an event + its linked board, as R5 leaves them.
    const seeded = await page.evaluate(async () => {
      const key = calKey(new Date());
      const b = newBoardRecord();
      b.title = '09/02/26 To Do'; b.cal = key; b.calReq = 1;
      b.requirements = 'existing event line';
      const ev = newCalEvent(key, 'existing event line');
      await idbPut(b); await idbPut(ev);
      return { key, evId: ev.id };
    });
    await page.evaluate(() => document.getElementById('action-calendar').click());
    await page.waitForTimeout(400);
    const open = await page.evaluate(() => !document.getElementById('cal-view').hidden);
    ok('calendar opened with the seeded event rendered', open &&
      (await page.evaluate(() =>
        [...document.querySelectorAll('.cal-line')].some(l => l.textContent === 'existing event line'))));

    const calBlur = async () => tap(page, 200, 700);  // clear of today's card (flex 1.6, y 36..195)
    const tapLine = async (text) => {
      const p = await page.evaluate((t) => {
        const l = [...document.querySelectorAll('.cal-line')].find(l => l.textContent === t);
        const r = l.getBoundingClientRect();
        return { x: r.x + Math.min(20, r.width / 2), y: r.y + r.height / 2 };
      }, text);
      await tap(page, p.x, p.y);
    };
    const editLine = () => page.evaluate(() => {
      const l = [...document.querySelectorAll('.cal-line')]
        .find(l => l.hasAttribute('contenteditable'));
      return l ? { text: l.textContent, complete: l.classList.contains('complete') } : null;
    });

    // Flow 1: open, focus, caret at the END (the issue's expected behavior).
    await tapLine('existing event line');
    await page.waitForTimeout(80);
    const editing = await page.evaluate(() => {
      const l = [...document.querySelectorAll('.cal-line')]
        .find(l => l.hasAttribute('contenteditable'));
      if (!l) return null;
      return { isLine: l.textContent === 'existing event line',
               focused: document.activeElement === l };
    });
    ok('the tap opens the existing editor on the line', !!editing, 'none found');
    ok('the line has focus (keyboard opens, inside the gesture)',
      editing && editing.focused);
    // The caret-at-end contract is proven behaviorally (the B90 pattern):
    // typing a marker must append — an end-placed caret means the marker
    // lands after the existing text, never inside it.
    await page.keyboard.type('!');
    await page.waitForTimeout(80);
    ok('the caret sits at the end of the text (issue #152 expected behavior — typing appends)',
      (await editLine()).text === 'existing event line!');
    await calBlur();
    await page.waitForTimeout(400);

    // Flow 2: the re-arm guard. startCalLineEdit arms the blur commit, so a
    // second editor on the same line would DOUBLE-COMMIT the same event.
    // The guard must prevent that. Observable black-box: exactly one line
    // carries contenteditable across the second tap (issue #182 — module
    // scope no longer lets a test wrap the function itself).
    await tapLine('existing event line!');       // opens the editor (arm 1)
    await page.waitForTimeout(80);
    const armed1 = await page.evaluate(() =>
      document.querySelectorAll('.cal-line[contenteditable]').length);
    await tapLine('existing event line!');       // the second tap while editing
    await page.waitForTimeout(120);
    const armed2 = await page.evaluate(() =>
      document.querySelectorAll('.cal-line[contenteditable]').length);
    ok('a second tap while editing does not re-arm the editor (exactly one editor open)',
      armed1 === 1 && armed2 === 1, 'armed=' + armed1 + '->' + armed2);
    await calBlur();                             // close flow 2's editor
    await page.waitForTimeout(400);

    // Flow 3: type the edit, blur, read back what persisted (record + mirror).
    await tapLine('existing event line!');
    await page.waitForTimeout(80);
    await page.keyboard.type(' EDITED');
    await calBlur();
    await page.waitForTimeout(400);              // commit + debounced save
    const after = await page.evaluate(async (id) => {
      const all = await idbGetAll();
      const ev = all.find(r => r.id === id);
      const board = all.find(r => r.cal === calKey(new Date()));
      const lines = (board && board.requirements || '').split('\n');
      return { evText: ev && ev.text, state: ev && ev.state,
               mirrorFirst: lines[0], calReq: board && board.calReq };
    }, seeded.evId);
    ok('the edit persisted to the event record',
      after.evText === 'existing event line! EDITED', JSON.stringify(after));
    ok('the linked board mirror re-synced with the edit (one writer)',
      after.mirrorFirst === 'existing event line! EDITED' && after.calReq === 1,
      JSON.stringify(after));

    // Flow 4: empty commit discards (B8) — seed a second event, clear it, blur.
    const ev2 = await page.evaluate(async () => {
      const e = newCalEvent(calKey(new Date()), 'doomed');
      await idbPut(e);
      await syncDateMirror(calKey(new Date()));
      renderCal();
      await new Promise(r => setTimeout(r, 300));
      return e.id;
    });
    await page.waitForTimeout(200);
    await tapLine('doomed');
    await page.waitForTimeout(80);
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await calBlur();
    await page.waitForTimeout(400);
    const gone = await page.evaluate(async (id) => {
      const all = await idbGetAll();
      return { record: all.some(r => r.id === id),
               line: [...document.querySelectorAll('.cal-line')]
                 .some(l => l.textContent === 'doomed') };
    }, ev2);
    ok('an empty commit discards the event record and its line (B8)',
      !gone.record && !gone.line, JSON.stringify(gone));

    // Flow 5: a completed event stays completed through an edit (state and
    // text are independent — the strike survives editing). Flow 4's commit
    // re-synced the mirror and re-rendered the stack, so re-locate the line
    // after the fresh render before tapping.
    const ev3 = await page.evaluate(async () => {
      const e = newCalEvent(calKey(new Date()), 'struck line');
      e.state = 'complete';
      await idbPut(e);
      await syncDateMirror(calKey(new Date()));
      renderCal();
      await new Promise(r => setTimeout(r, 300));
      return e.id;
    });
    await page.waitForTimeout(200);
    await tapLine('struck line');
    await page.waitForTimeout(80);
    ok('a completed event keeps its strike while editing',
      (await editLine()).complete);
    await page.keyboard.type(' done');
    await calBlur();
    await page.waitForTimeout(400);
    const struckAfter = await page.evaluate(async (id) => {
      const ev = (await idbGetAll()).find(r => r.id === id);
      const l = [...document.querySelectorAll('.cal-line')]
        .find(l => l.textContent === 'struck line done');
      return { state: ev.state, stillStruck: l.classList.contains('complete') };
    }, ev3);
    ok('a completed event remains completed after its edit commits',
      struckAfter.state === 'complete' && struckAfter.stillStruck, JSON.stringify(struckAfter));

    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 25b. Non-today cards shrink to their text; the ground carries the month view (issue #170 + #191)
  // The law: a non-today day card is sized by its content — two lines of event
  // text read comfortably, nothing clipped — today keeps the stack's dominant
  // share (the 1.6 grow, its cap now against the shorter stack the month view
  // shares the ground with, issue #191).
  console.log('\n[25b] Calendar: non-today cards shrink; the ground carries the month view (issue #170 + #191)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await page.evaluate(async () => {
      const key = calKey(new Date());
      const b = newBoardRecord();
      b.title = '09/16/26 To Do'; b.cal = key; b.calReq = 1;
      b.requirements = 'a long event line that must wrap onto two comfortable lines';
      const ev = newCalEvent(key, 'a long event line that must wrap onto two comfortable lines');
      await idbPut(b); await idbPut(ev);
    });
    await page.evaluate(() => document.getElementById('action-calendar').click());
    await page.waitForTimeout(400);
    const g = await page.evaluate(() => {
      const stack = document.getElementById('cal-stack').getBoundingClientRect();
      const days = [...document.querySelectorAll('.cal-day')];
      const line = [...document.querySelectorAll('.cal-line')]
        .find(l => l.textContent === 'a long event line that must wrap onto two comfortable lines');
      return {
        today: +days[0].getBoundingClientRect().height.toFixed(1),
        others: days.slice(1).map(d => +d.getBoundingClientRect().height.toFixed(1)),
        lineHeight: +line.getBoundingClientRect().height.toFixed(1),
        bottomGap: +(stack.bottom - days[6].getBoundingClientRect().bottom).toFixed(1),
        month: (() => { const r = document.getElementById('cal-month').getBoundingClientRect();
                        return { top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), h: +r.height.toFixed(1) }; })(),
        stackBottom: +stack.bottom.toFixed(1),
        vh: window.innerHeight,
      };
    });
    ok('today stays the stack\'s dominant card (the 1.6 grow, capped by the stack the month view shares)', 
      g.today === Math.max(g.today, ...g.others) && g.today > 90, String(g.today));
    ok('a wrapping event renders two readable lines, unclipped',
      g.lineHeight >= 30 && g.lineHeight <= 38, String(g.lineHeight));
    ok('non-today cards shrink to their content (two lines + capture row)',
      g.others.every(h => h > 40 && h < 80), JSON.stringify(g.others));
    ok('the freed ground below the stack now carries the month view (issue #191)',
      g.bottomGap > 0 && g.month.h > 100 && g.month.top >= g.stackBottom - 1 && g.month.bottom <= g.vh,
      JSON.stringify(g));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 26. the calendar's R1 top row is filled and meets the floor (issue #156, B98) ----
  // The bug: the three #cal-top buttons shipped as EMPTY elements — fillBoardAction
  // was never run for them, so they rendered as 12x16 blank squares (the issue's
  // "untappable / icons invisible"). The fix fills them (glyph + label, the board
  // row's idiom), grows the visual frame to clear §6's 44px floor AS DRAWN, and
  // adds the §6 decoupled collar for width where the row is tight.
  console.log('\n[26] Calendar top row: filled, floor-clearing controls (issue #156, B98)');
  {
    const { ctx, page, errors } = await newMobilePage(browser);
    await page.evaluate(() => document.getElementById('action-calendar').click());
    await page.waitForTimeout(400);
    const geo = await page.evaluate(() => {
      const ids = ['cal-back', 'cal-boards', 'cal-export'];
      return ids.map((id) => {
        const b = document.getElementById(id);
        const r = b.getBoundingClientRect();
        return { id, w: r.width, h: r.height,
                 hasSvg: !!b.querySelector('svg'),
                 label: (b.querySelector('.label') || {}).textContent || '',
                 glyphW: b.querySelector('svg') ? b.querySelector('svg').getBoundingClientRect().width : 0 };
      });
    });
    for (const g of geo) {
      ok(`${g.id} renders a glyph and its label (the row states its acts)`,
        g.hasSvg && g.label.length > 0, JSON.stringify(g));
      ok(`${g.id} clears the 44px touch floor AS DRAWN (§6, B98)`,
        g.h >= 44 && g.w >= 44, `${g.w}x${g.h}`);
      ok(`${g.id}'s mark is legible at rest (22px glyph)`, g.glyphW >= 20, String(g.glyphW));
    }
    // The collar: --hit set on #cal-top; a tap ABOVE the visual box (inside the
    // collar, clear of the stack) still fires Back.
    const hit = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.getElementById('cal-top')).getPropertyValue('--hit')) || 0);
    ok('the R1 row carries its §6 hit collar (--hit set)', hit > 0, String(hit));
    const fired = await page.evaluate(() => {
      let n = 0;
      document.getElementById('cal-back').addEventListener('click', () => n++);
      const b = document.getElementById('cal-back');
      const r = b.getBoundingClientRect();
      const e = new MouseEvent('click', { bubbles: true,
        clientX: r.x + r.width / 2, clientY: r.y - 10 });   // 10px above the frame — collar territory
      b.dispatchEvent(e);
      return n;
    });
    ok('a tap in the collar above the visual frame fires Back', fired === 1, String(fired));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[27] Wide→narrow flip tears the calendar-rail furniture down (issue #219)');
  {
    const { ctx, page, errors } = await newMobilePage(browser, { width: 390, height: 846 });
    await page.setViewportSize({ width: 800, height: 846 });   // cross TABLET_MQ: tablet arrangement
    await page.waitForTimeout(400);
    ok('at 800 the rail is up (furniture, B99)', await page.evaluate(() => {
      const v = document.getElementById('cal-view'), r = document.getElementById('cal-rail');
      return !v.hidden && v.classList.contains('rail-open') && !r.hidden &&
        document.documentElement.classList.contains('has-cal-rail');
    }));
    await page.setViewportSize({ width: 390, height: 846 });   // the landscape→portrait round trip
    await page.waitForTimeout(400);
    ok('back at 390 the view is hidden by attribute', await page.evaluate(() =>
      document.getElementById('cal-view').hidden === true));
    ok('no rail-open class survives the flip', await page.evaluate(() =>
      !document.getElementById('cal-view').classList.contains('rail-open')));
    ok('the rail face is hidden', await page.evaluate(() =>
      document.getElementById('cal-rail').hidden === true));
    ok('the board is full-width again', await page.evaluate(() => {
      const b = document.getElementById('board').getBoundingClientRect();
      return Math.abs(b.width - 390) < 1 && Math.abs(b.left) < 1;
    }));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log('\n=== mobile: ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
})();
