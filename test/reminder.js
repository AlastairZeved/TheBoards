// The reminder pass (issue #169, B104/B109): the clock toggle on every note
// card, the glow, and the surfacing of reminder-active notes to today's linked
// To-Do board as render-time echoes. Black-box by ruling: seed through the
// window surface, reload, observe; taps are genuine CDP touch events (B27b).
const { chromium } = require('playwright');
const URL = process.env.BOARDS_URL || 'http://localhost:8000/index.html';
const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? (pass++, console.log('  PASS ' + n)) : (fail++, console.log('  FAIL ' + n + (extra ? ' :: ' + extra : ''))); };

// A real touch tap through CDP Input domain; holdMs > LONGPRESS_MS (500) makes
// it a long-press (the note menu, B91/B108/B109).
async function tap(page, x, y, holdMs = 30) {
  const c = await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(holdMs);
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await c.detach();
}

// A seed board: category + notes, one record write, most-recent stamp.
async function seedBoard(page, title, cat, notes) {
  return page.evaluate(({ title, cat, notes }) => {
    const b = newBoardRecord();
    b.title = title; b.category = cat; b.notes = notes; b.updatedAt = Date.now();
    return idbPut(b).then(() => b.id);
  }, { title, cat, notes });
}

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

  console.log('\n[R1] The clock: renders on every note card, one tap sets, one tap clears — and the record never grows a time field (B104/B109)');
  {
    const ctx = await browser.newContext({ viewport: { width: 384, height: 846 }, hasTouch: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(URL);
    await page.waitForTimeout(1500);          // boot: today's board created + landed (B108)
    // A manual add on today's board — the ordinary note, clock and all.
    await tap(page, 200, 500);
    await page.waitForTimeout(60);
    await page.keyboard.type('water the ferns');
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(250);

    const every = await page.evaluate(() =>
      [...document.querySelectorAll('.note')].filter(n => n.querySelector('.note-text').textContent.trim())
        .map(n => !!n.querySelector('.note-clock')));
    ok('every non-empty note card carries a clock', every.length > 0 && every.every(Boolean), JSON.stringify(every));
    const hasGuard = await page.evaluate(() => [...document.styleSheets].some(s => {
      try { return [...s.cssRules].some(r => r.selectorText === '.note-text:empty ~ .note-clock'); } catch (e) { return false; }
    }));
    ok('an empty note shows no clock (the §6.2 guard rule ships)',
      hasGuard === true);

    const box = await page.evaluate(() => {
      const n = [...document.querySelectorAll('.note')].find(n => n.textContent.includes('water the ferns'));
      const c = n.querySelector('.note-clock').getBoundingClientRect();
      return { x: c.x + c.width / 2, y: c.y + c.height / 2, pressed: n.querySelector('.note-clock').getAttribute('aria-pressed') };
    });
    ok('the clock rests unpressed with the act stated (aria, B43/B71 grammar)',
      box.pressed === 'false' &&
      (await page.evaluate(() => document.querySelector('.note .note-clock').getAttribute('aria-label'))) === 'Remind me');

    await tap(page, box.x, box.y);            // one tap sets (B104)
    await page.waitForTimeout(300);
    let got = await page.evaluate(async () => {
      const all = await idbGetAll();
      const n = all.flatMap(r => (r.notes || [])).find(n => n.text === 'water the ferns');
      const el = [...document.querySelectorAll('.note')].find(n => n.textContent.includes('water the ferns'));
      return { rec: n && n.reminder, cls: el.classList.contains('reminder'), pressed: el.querySelector('.note-clock').getAttribute('aria-pressed'),
               label: el.querySelector('.note-clock').getAttribute('aria-label'), keys: Object.keys(n).sort() };
    });
    ok('one tap sets reminder: record true, glow class on, aria-pressed true, label flips',
      got.rec === true && got.cls === true && got.pressed === 'true' && got.label === 'Remove reminder', JSON.stringify(got));
    ok('the record grew NO time field — known keys only, reminder a plain boolean',
      JSON.stringify(got.keys) === JSON.stringify(['id', 'reminder', 'rh', 'rw', 'scale', 'state', 'text', 'x', 'y'].sort()) &&
      got.rec === true, JSON.stringify(got.keys));

    await page.waitForTimeout(300);           // clear the B81 drop-guard before the second tap
    await tap(page, box.x, box.y);            // one tap clears
    await page.waitForTimeout(300);
    got = await page.evaluate(async () => {
      const n = (await idbGetAll()).flatMap(r => (r.notes || [])).find(n => n.text === 'water the ferns');
      const el = [...document.querySelectorAll('.note')].find(n => n.textContent.includes('water the ferns'));
      return { hasKey: 'reminder' in (n || {}), cls: el.classList.contains('reminder') };
    });
    ok('one tap clears: the KEY is deleted (B21 absence-is-off), glow gone',
      got.hasKey === false && got.cls === false, JSON.stringify(got));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[R2] Surfacing: a reminder note on another board echoes onto today\'s To Do, wearing the source board\'s hue — one record, no copy (B109)');
  {
    const ctx = await browser.newContext({ viewport: { width: 384, height: 846 }, hasTouch: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(URL);                     // globals live only on a loaded page
    const boardId = await seedBoard(page, 'Errands', 'unsorted', [
      { id: 'r1', text: 'remind me please', x: 40, y: 60, rw: 900, rh: 900, scale: 1.0, state: 'active', reminder: true },
      { id: 'p1', text: 'no reminder here', x: 40, y: 220, rw: 900, rh: 900, scale: 1.0, state: 'active' },
    ]);
    await page.reload();                      // a load WITH the seed: boot lands on today's board
    await page.waitForTimeout(1500);
    const got = await page.evaluate(async (boardId) => {
      const echo = document.querySelector('.note.surfaced[data-id="r1"]');
      const plain = document.querySelector('.note.surfaced[data-id="p1"]');
      const src = (await idbGet(boardId));
      const todayCopies = (await idbGetAll()).filter(r => r.cal && (r.notes || []).some(n => n.id === 'r1')).length;
      return { echo: !!echo, srcCat: echo && echo.dataset.srcCat, srcBoard: echo && echo.dataset.srcBoard,
               hue: echo && getComputedStyle(echo.querySelector('.note-text')).getPropertyValue('--note').trim(),
               text: echo && echo.querySelector('.note-text').textContent,
               clockOnEcho: !!(echo && echo.querySelector('.note-clock')),
               plainSurfaced: !!plain,
               sourceIntact: src.notes.map(n => ({ id: n.id, reminder: n.reminder, state: n.state })),
               todayCopies };
    }, boardId);
    ok('the reminder note surfaces as an echo with text, clock, and the source board\'s id',
      got.echo && got.text === 'remind me please' && got.clockOnEcho && got.srcBoard === boardId, JSON.stringify(got));
    ok('the echo wears the SOURCE board\'s note hue (unsorted violet, data-src-cat)',
      got.srcCat === 'unsorted' && got.hue === '#cec6ed', JSON.stringify(got));
    ok('a note without a reminder does not surface', got.plainSurfaced === false);
    ok('one source of truth: r1 still lives on Errands alone, reminder intact',
      got.sourceIntact[0].reminder === true && got.sourceIntact[0].state === 'active' &&
      got.sourceIntact[1].id === 'p1' && got.sourceIntact[1].reminder === undefined,
      JSON.stringify(got.sourceIntact));
    ok('no copy record exists: no linked board holds r1 in its notes array', got.todayCopies === 0, JSON.stringify(got.todayCopies));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[R3/R4] The echo\'s menu: Complete completes the SOURCE and unsurfaces; Go to Board takes the swap route; the echo\'s clock toggles the source record (B109, B27b)');
  {
    const ctx = await browser.newContext({ viewport: { width: 384, height: 846 }, hasTouch: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(URL);
    const boardId = await seedBoard(page, 'Errands', 'todo', [
      { id: 'r1', text: 'echo act note', x: 40, y: 60, rw: 900, rh: 900, scale: 1.0, state: 'active', reminder: true },
    ]);
    await page.reload();
    await page.waitForTimeout(1500);
    const today = await page.evaluate(() => calKey(new Date()));
    const box = await page.evaluate(() => {
      const n = document.querySelector('.note.surfaced[data-id="r1"]');
      const r = n.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    ok('the echo is on today\'s board', !!box);

    // Long-press the echo → its two-item menu.
    await tap(page, box.x, box.y, 700);
    await page.waitForTimeout(300);
    let labels = await page.evaluate(() => [...document.querySelectorAll('#menu [role="menuitem"]')].map(l => l.textContent));
    ok('the echo\'s menu is Complete · Go to Board — in that order, no Link',
      JSON.stringify(labels) === JSON.stringify(['Complete', 'Go to Board']), JSON.stringify(labels));
    await tap(page, 5, 5);                    // dismiss
    await page.waitForTimeout(200);

    // Go to Board: the plain swap route (B9) lands on the source board.
    await tap(page, box.x, box.y, 700);
    await page.waitForTimeout(300);
    const goto_ = await page.evaluate(() => {
      const b = [...document.querySelectorAll('#menu [role="menuitem"]')].find(b => b.textContent === 'Go to Board');
      const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await tap(page, goto_.x, goto_.y);
    await page.waitForTimeout(1200);          // SWAP_MS + render
    const nav = await page.evaluate(async (boardId) => ({
      cur: state.current && state.current.title, id: state.current && state.current.id,
      rec: !!(await idbGet(boardId)) }), boardId);
    ok('Go to Board navigates to the source board', nav.cur === 'Errands' && nav.id === boardId, JSON.stringify(nav));

    // The echo's clock toggles the SOURCE record: off here unsurfaces there.
    let cbox = await page.evaluate(() => {
      const c = [...document.querySelectorAll('.note')].find(n => n.textContent.includes('echo act note'))
        .querySelector('.note-clock').getBoundingClientRect();
      return { x: c.x + c.width / 2, y: c.y + c.height / 2 };
    });
    await tap(page, cbox.x, cbox.y);          // reminder was on → off
    await page.waitForTimeout(400);
    let src = await page.evaluate(async (boardId) => (await idbGet(boardId)).notes[0], boardId);
    ok('tapping the clock on the source board cleared the key', !('reminder' in src), JSON.stringify(src));
    await page.evaluate(async (t) => {        // back to today's: the echo must be gone
      const b = (await idbGetAll()).find(r => r.cal === t); await swapBoard(b.id);
    }, today);
    await page.waitForTimeout(1200);
    let echoGone = await page.evaluate(() => !document.querySelector('.note.surfaced'));
    ok('clock-off unsurfaces: today\'s board holds no echo', echoGone === true);

    // Toggle back on FROM the source board, and the echo returns.
    await page.evaluate(async (boardId) => swapBoard(boardId), boardId);
    await page.waitForTimeout(1200);
    cbox = await page.evaluate(() => {
      const c = [...document.querySelectorAll('.note')].find(n => n.textContent.includes('echo act note'))
        .querySelector('.note-clock').getBoundingClientRect();
      return { x: c.x + c.width / 2, y: c.y + c.height / 2 };
    });
    await tap(page, cbox.x, cbox.y);          // on again
    await page.waitForTimeout(400);
    src = await page.evaluate(async (boardId) => (await idbGet(boardId)).notes[0], boardId);
    ok('tapping the clock on the source board set the key', src.reminder === true, JSON.stringify(src));
    await page.evaluate(async (t) => {
      const b = (await idbGetAll()).find(r => r.cal === t); await swapBoard(b.id);
    }, today);
    await page.waitForTimeout(1200);
    ok('clock-on surfaces again', await page.evaluate(() => !!document.querySelector('.note.surfaced[data-id="r1"]')));

    // Complete on today's via the echo's menu: the SOURCE completes, the echo unsurfaces.
    const box2 = await page.evaluate(() => {
      const r = document.querySelector('.note.surfaced[data-id="r1"]').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await tap(page, box2.x, box2.y, 700);
    await page.waitForTimeout(300);
    const comp = await page.evaluate(() => {
      const b = [...document.querySelectorAll('#menu [role="menuitem"]')].find(b => b.textContent === 'Complete');
      const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await tap(page, comp.x, comp.y);
    await page.waitForTimeout(500);
    src = await page.evaluate(async (boardId) => (await idbGet(boardId)).notes[0], boardId);
    ok('completing on today\'s completed the SOURCE record', src.state === 'complete', JSON.stringify(src));
    echoGone = await page.evaluate(() => !document.querySelector('.note.surfaced'));
    ok('and the echo unsurfaces (the surfacing set is ACTIVE reminder notes)', echoGone === true);
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[R5] Manual adds and completion semantics: the clock on a manual add surfaces nowhere; completing a reminder note just completes it (B109 decisions 5–6)');
  {
    const ctx = await browser.newContext({ viewport: { width: 384, height: 846 }, hasTouch: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(URL);
    await page.waitForTimeout(1500);
    const today = await page.evaluate(() => calKey(new Date()));
    // Manual add, clock on: already on today's board — it must NOT echo to itself.
    await tap(page, 200, 500);
    await page.waitForTimeout(60);
    await page.keyboard.type('manual reminder');
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(250);
    const cbox = await page.evaluate(() => {
      const c = [...document.querySelectorAll('.note')].find(n => n.textContent.includes('manual reminder'))
        .querySelector('.note-clock').getBoundingClientRect();
      return { x: c.x + c.width / 2, y: c.y + c.height / 2 };
    });
    await tap(page, cbox.x, cbox.y);
    await page.waitForTimeout(400);
    let got = await page.evaluate(async () => ({
      rec: (await idbGetAll()).flatMap(r => (r.notes || [])).find(n => n.text === 'manual reminder').reminder,
      echoes: document.querySelectorAll('.note.surfaced').length }));
    ok('manual add\'s reminder is set and stays put — no self-echo',
      got.rec === true && got.echoes === 0, JSON.stringify(got));
    // The manual add's menu is untouched (B108/B114): Copy first, re-homing pair, Link last.
    const nbox = await page.evaluate(() => {
      const r = [...document.querySelectorAll('.note')].find(n => n.textContent.includes('manual reminder')).getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await tap(page, nbox.x, nbox.y, 700);
    await page.waitForTimeout(300);
    const labels = await page.evaluate(() => [...document.querySelectorAll('#menu [role="menuitem"]')].map(l => l.textContent));
    ok('a manual add\'s menu keeps B114\'s Copy + B108\'s pair and Link (no reminder interference)',
      labels[0] === 'Copy' &&
      JSON.stringify(labels.slice(1, 3)) === JSON.stringify(['Add to existing board', 'Create new board with this as first card'])
      && labels.includes('Link') && !labels.includes('Go to Board'), JSON.stringify(labels));
    await tap(page, 5, 5);
    await page.waitForTimeout(200);
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log('\n=== reminder: ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
})();
