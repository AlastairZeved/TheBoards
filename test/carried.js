// The carried indicator (issue #169, B104/B110): a note carried onto its board
// today (B108's `carriedOn` = the today key) wears its frame in --carried plus
// a soft bloom of the same token — B104's status layer, never the whole-card
// fill, never the highlight layer. Black-box by ruling: seed through the window
// surface, reload, observe; taps are genuine CDP touch events (B27b).
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

const CARRIED = 'rgb(225, 190, 38)';   // #E1BE26 (UIUX §2.6.3)
const INK = 'rgb(3, 16, 25)';          // --ink-dark on the note (§2.3)
const WASH = 'rgb(242, 214, 75)';      // #F2D64B, the highlight wash (§2.6.1)

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

  console.log('\n[C1] The status layer renders off the record: carriedOn = today glows, everything else stays plain (B110)');
  {
    const ctx = await browser.newContext({ viewport: { width: 384, height: 846 }, hasTouch: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(URL);                     // first load creates today's linked board (B108)
    await page.waitForTimeout(1500);
    // Seed today's board: carried-today, plain, completed-with-a-stale-field
    // (complete wins even if a legacy record kept the field), stale carried.
    await page.evaluate(async () => {
      const now = new Date();
      const tk = calKey(now);
      const yk = calKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
      const b = (await idbGetAll()).find(r => r.cal === tk);
      b.notes = [
        { id: 'c1', text: 'carried today', x: 40, y: 60, rw: 900, rh: 900, scale: 1.0, state: 'active', carriedOn: tk },
        { id: 'p1', text: 'plain note', x: 40, y: 220, rw: 900, rh: 900, scale: 1.0, state: 'active' },
        { id: 'd1', text: 'done and carried once', x: 40, y: 380, rw: 900, rh: 900, scale: 1.0, state: 'complete', carriedOn: tk },
        { id: 's1', text: 'carried long ago', x: 40, y: 540, rw: 900, rh: 900, scale: 1.0, state: 'active', carriedOn: yk },
      ];
      await idbPut(b);
    });
    await page.reload();
    await page.waitForTimeout(1500);
    const got = await page.evaluate(async () => {
      const el = id => {
        const n = document.querySelector(`.note[data-id="${id}"]`);
        if (!n) return null;
        const cs = getComputedStyle(n.querySelector('.note-text'));
        return { cls: [...n.classList], border: cs.borderColor, shadow: cs.boxShadow };
      };
      const rec = (await idbGetAll()).flatMap(r => (r.notes || [])).find(n => n.id === 'c1');
      return { c1: el('c1'), p1: el('p1'), d1: el('d1'), s1: el('s1'), recKeys: Object.keys(rec).sort() };
    });
    ok('the carried note renders with the .carried class',
      got.c1 && got.c1.cls.includes('carried'), JSON.stringify(got.c1));
    ok('its frame is --carried (' + CARRIED + '), not the ink', got.c1.border === CARRIED, got.c1.border);
    ok('a soft bloom of the same token rides the frame (one box-shadow)', got.c1.shadow.includes(CARRIED), got.c1.shadow);
    ok('the plain note stays plain: no class, the ink frame, no bloom',
      got.p1 && !got.p1.cls.includes('carried') && got.p1.border === INK && !got.p1.shadow.includes(CARRIED),
      JSON.stringify(got.p1));
    ok('complete wins: a completed note never glows, even with the field present',
      got.d1 && got.d1.cls.includes('complete') && !got.d1.cls.includes('carried') && got.d1.border === INK,
      JSON.stringify(got.d1));
    ok('the marker self-clears by date comparison: a stale carriedOn renders plain',
      got.s1 && !got.s1.cls.includes('carried') && got.s1.border === INK, JSON.stringify(got.s1));
    ok('no stored style state: the record grew nothing — the class is the field\'s shadow',
      JSON.stringify(got.recKeys) === JSON.stringify(['carriedOn', 'id', 'rh', 'rw', 'scale', 'state', 'text', 'x', 'y']),
      JSON.stringify(got.recKeys));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[C2] Completing a carried note removes the glow in place (genuine CDP touch, B27b; B108\'s law)');
  {
    const ctx = await browser.newContext({ viewport: { width: 384, height: 846 }, hasTouch: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(URL);
    await page.waitForTimeout(1500);
    await page.evaluate(async () => {
      const tk = calKey(new Date());
      const b = (await idbGetAll()).find(r => r.cal === tk);
      b.notes = [
        { id: 'c1', text: 'finish the shelf this morning', x: 40, y: 60, rw: 900, rh: 900, scale: 1.0, state: 'active', carriedOn: tk },
      ];
      await idbPut(b);
    });
    await page.reload();
    await page.waitForTimeout(1500);
    const box = await page.evaluate(() => {
      const r = document.querySelector('.note[data-id="c1"]').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    ok('the carried note is on screen', !!box);
    await tap(page, box.x, box.y);            // first tap engages (B90)
    await page.waitForTimeout(250);
    const btn = await page.evaluate(() => {
      const b = document.querySelector('.note.engaged .note-tb-complete');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    ok('the Complete tab is hittable', !!btn);
    if (btn) {
      await tap(page, btn.x, btn.y);
      await page.waitForTimeout(300);
      const got = await page.evaluate(async () => {
        const n = document.querySelector('.note[data-id="c1"]');
        const rec = (await idbGetAll()).flatMap(r => (r.notes || [])).find(n => n.id === 'c1');
        return { cls: [...n.classList], border: getComputedStyle(n.querySelector('.note-text')).borderColor,
                 state: rec.state, field: 'carriedOn' in rec };
      });
      ok('the glow leaves with the completion: no .carried class, the ink frame back',
        !got.cls.includes('carried') && got.border === INK, JSON.stringify(got));
      ok('B108\'s law held: the field is deleted and the state is complete',
        got.state === 'complete' && got.field === false, JSON.stringify(got));
    }
    await tap(page, 200, 500);                // deselect before close
    await page.waitForTimeout(250);
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[C3] Highlight and carried coexist without conflating: the wash fills, the status dresses the frame (B104\'s two-layer law)');
  {
    const ctx = await browser.newContext({ viewport: { width: 384, height: 846 }, hasTouch: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(URL);
    await page.waitForTimeout(1500);
    await page.evaluate(async () => {
      const tk = calKey(new Date());
      const b = (await idbGetAll()).find(r => r.cal === tk);
      b.notes = [
        { id: 'c1', text: 'both layers on one card here', x: 40, y: 60, rw: 900, rh: 900, scale: 1.0, state: 'active', carriedOn: tk },
      ];
      await idbPut(b);
    });
    await page.reload();
    await page.waitForTimeout(1500);
    const box = await page.evaluate(() => {
      const r = document.querySelector('.note[data-id="c1"]').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await tap(page, box.x, box.y);            // engage
    await page.waitForTimeout(250);
    const btn = await page.evaluate(() => {
      const b = document.querySelector('.note.engaged .note-tb-highlight');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    ok('the Highlight tab is hittable', !!btn);
    if (btn) {
      await tap(page, btn.x, btn.y);
      await page.waitForTimeout(300);
      const got = await page.evaluate(() => {
        const n = document.querySelector('.note[data-id="c1"]');
        const cs = getComputedStyle(n.querySelector('.note-text'));
        return { cls: [...n.classList], fill: cs.backgroundColor, border: cs.borderColor, shadow: cs.boxShadow };
      });
      ok('one card, both classes, each in its own layer',
        got.cls.includes('highlight') && got.cls.includes('carried'), JSON.stringify(got.cls));
      ok('the wash is the fill (' + WASH + ') and the status is the frame (' + CARRIED + ') — never conflated',
        got.fill === WASH && got.border === CARRIED && got.shadow.includes(CARRIED),
        JSON.stringify({ fill: got.fill, border: got.border, shadow: got.shadow }));
    }
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log('\n=== carried: ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
})();
