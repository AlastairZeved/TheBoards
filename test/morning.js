// Morning lifecycle + carry-forward (issue #169, B108): every morning's first
// load auto-creates today's linked To-Do board, boots onto it, and carries
// yesterday's incomplete notes forward at their same logical x/y. Black-box by
// ruling: seed through the window surface, reload, observe; taps are genuine
// CDP touch events (B27b).
const { chromium } = require('playwright');
const URL = process.env.BOARDS_URL || 'http://localhost:8000/index.html';
const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? (pass++, console.log('  PASS ' + n)) : (fail++, console.log('  FAIL ' + n + (extra ? ' :: ' + extra : ''))); };

// A real touch tap through CDP Input domain; holdMs > LONGPRESS_MS (500) makes
// it a long-press (the note menu, B91/B108).
async function tap(page, x, y, holdMs = 30) {
  const c = await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(holdMs);
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await c.detach();
}

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

  console.log('\n[M1] Morning boot, 0 events: today\'s linked board is created and boot lands on it (B107/B108)');
  {
    const ctx = await browser.newContext({ viewport: { width: 384, height: 846 }, hasTouch: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(URL);                    // the fresh open IS the morning load
    await page.waitForTimeout(1500);         // boot + SWAP_MS
    const today = await page.evaluate(() => calKey(new Date()));
    const got = await page.evaluate(async (key) => {
      const all = await idbGetAll();
      const board = all.find(r => r.cal === key);
      return { curCal: state.current && state.current.cal,
               title: board && board.title };
    }, today);
    ok('today\'s linked board was created with 0 events', !!got.title, JSON.stringify(got));
    ok('boot is CURRENT on it', got.curCal === today, JSON.stringify(got.curCal) + ' want ' + today);
    ok('title is the MM/DD/YY To Do species', /\/\d\d\/\d\d To Do$/.test(got.title || ''), got.title);
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[M2] Morning carry-forward: yesterday\'s incompletes MOVE to today at the same x/y; completes stay');
  {
    const ctx = await browser.newContext({ viewport: { width: 384, height: 846 }, hasTouch: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(URL);                    // first load: creates today's (empty) board
    await page.waitForTimeout(1200);
    // Yesterday's linked board: two incomplete notes at pinned logical x/y,
    // one completed; today gets three events (creation order pinned); a plain
    // board is most recent so B105's old landing would have missed the day.
    await page.evaluate(async () => {
      const now = new Date();
      const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yk = calKey(y), tk = calKey(now);
      const yb = newBoardRecord();
      yb.title = 'YESTERDAY'; yb.cal = yk; yb.category = 'todo';
      yb.notes = [
        { id: 'c1', text: 'carry me one', x: 42, y: 60, rw: 900, rh: 900, scale: 1.0, state: 'active' },
        { id: 'c2', text: 'carry me two', x: 120, y: 200, rw: 900, rh: 900, scale: 1.0, state: 'active' },
        { id: 'd1', text: 'already done', x: 300, y: 30, rw: 900, rh: 900, scale: 1.0, state: 'complete' },
      ];
      yb.updatedAt = Date.now() - 1000;
      const evs = ['first event', 'second event', 'third event'].map((t, i) => {
        const e = newCalEvent(tk, t); e.createdAt = 1000 + i; return e;
      });
      const plain = newBoardRecord();
      plain.title = 'Sample board'; plain.updatedAt = Date.now() + 5000;   // launch → most recent, NOT the day board
      await idbPut(yb); for (const e of evs) await idbPut(e); await idbPut(plain);
    });
    await page.reload();                     // the morning load that carries
    await page.waitForTimeout(1500);
    const today = await page.evaluate(() => calKey(new Date()));
    const got = await page.evaluate(async (tk) => {
      const all = await idbGetAll();
      const t = all.find(r => r.cal === tk);
      const yb = all.find(r => r.title === 'YESTERDAY');
      return { curCal: state.current && state.current.cal,
               req: t && (t.requirements || '').split('\n'),
               tNotes: t && t.notes.map(n => ({ id: n.id, x: n.x, y: n.y, carriedOn: n.carriedOn })),
               yNotes: yb && yb.notes.map(n => ({ id: n.id, state: n.state })) };
    }, today);
    ok('boot landed on today\'s board', got.curCal === today, JSON.stringify(got.curCal));
    ok('Requirements lead with the three mirror lines, creation order',
      JSON.stringify(got.req && got.req.slice(0, 3)) === JSON.stringify(['first event', 'second event', 'third event']),
      JSON.stringify(got.req));
    ok('both incomplete notes carried, at their same logical x/y, with carriedOn = today',
      JSON.stringify(got.tNotes) === JSON.stringify([
        { id: 'c1', x: 42, y: 60, carriedOn: today },
        { id: 'c2', x: 120, y: 200, carriedOn: today }]), JSON.stringify(got.tNotes));
    ok('the completed note stayed put on yesterday\'s board',
      JSON.stringify(got.yNotes) === JSON.stringify([{ id: 'd1', state: 'complete' }]), JSON.stringify(got.yNotes));
    ok('no page errors', errors.length === 0, errors.join(' | '));

    console.log('\n[M3] Same-day reload is idempotent: nothing carries twice');
    await page.reload();
    await page.waitForTimeout(1500);
    const again = await page.evaluate(async (tk) => {
      const all = await idbGetAll();
      const t = all.find(r => r.cal === tk);
      const yb = all.find(r => r.title === 'YESTERDAY');
      return { t: t.notes.map(n => n.id), y: yb.notes.map(n => n.id) };
    }, today);
    ok('today still holds exactly the two carried notes', JSON.stringify(again.t) === JSON.stringify(['c1', 'c2']), JSON.stringify(again.t));
    ok('yesterday still holds exactly the completed note', JSON.stringify(again.y) === JSON.stringify(['d1']), JSON.stringify(again.y));

    console.log('\n[M4] Completing a carried note clears carriedOn (genuine CDP touch, B27b)');
    {
      const box = await page.evaluate(() => {
        const n = [...document.querySelectorAll('.note')].find(n => n.textContent.includes('carry me one'));
        if (!n) return null;
        const r = n.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      ok('the carried note is on screen', !!box, JSON.stringify(box));
      if (box) {
        await tap(page, box.x, box.y);              // first tap selects/engages (B90)
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
          const st = await page.evaluate(async (tk) => {
            const t = (await idbGetAll()).find(r => r.cal === tk);
            const n = t.notes.find(n => n.id === 'c1');
            return { state: n.state, carriedOn: n.carriedOn };
          }, today);
          ok('completing cleared carriedOn and set the state',
            st.state === 'complete' && st.carriedOn === undefined, JSON.stringify(st));
        }
        await tap(page, 200, 500);                  // deselect before the next capture
        await page.waitForTimeout(250);
      }
    }

    console.log('\n[M5] Manual add and carried note menus: Copy + Link, no re-homing (B114, B115) (B27b)');
    {
      // A manual add: tap empty paper, type, commit.
      await tap(page, 200, 500);
      await page.waitForTimeout(60);
      await page.keyboard.type('fresh manual note');
      await page.evaluate(() => document.activeElement.blur());
      await page.waitForTimeout(250);
      const nbox = await page.evaluate(() => {
        const n = [...document.querySelectorAll('.note')].find(n => n.textContent.includes('fresh manual note'));
        if (!n) return null;
        const r = n.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      ok('the manual note captured', !!nbox);
      await tap(page, nbox.x, nbox.y, 700);         // long-press → the note menu
      await page.waitForTimeout(300);
      let labels = await page.evaluate(() =>
        [...document.querySelectorAll('#menu [role="menuitem"]')].map(l => l.textContent));
      ok('manual add\'s menu is Copy (B114) then Link — the re-homing options are gone (B115)',
        JSON.stringify(labels) === JSON.stringify(['Copy', 'Link']), JSON.stringify(labels));
      // Carry-forward's marker keeps a re-homed day-board card out of the pair:
      // the carried note's menu carries Copy (B114) then Link.
      const cbox = await page.evaluate(() => {
        const n = [...document.querySelectorAll('.note')].find(n => n.textContent.includes('carry me two'));
        const r = n.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      await tap(page, 5, 5);                        // dismiss the open menu
      await page.waitForTimeout(200);
      await tap(page, cbox.x, cbox.y, 700);
      await page.waitForTimeout(300);
      labels = await page.evaluate(() =>
        [...document.querySelectorAll('#menu [role="menuitem"]')].map(l => l.textContent));
      ok('a carried note\'s menu is Copy then Link (B114)',
        JSON.stringify(labels) === JSON.stringify(['Copy', 'Link']), JSON.stringify(labels));
      await tap(page, 5, 5);
      await page.waitForTimeout(200);
    }
    ok('no page errors across the interaction blocks', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log('\n=== morning: ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
})();
