// Day-roll launch (issue #153, B105): a fresh open lands on today's linked
// To-Do board when today carries events; with none, nothing navigates.
// Black-box by ruling: seed through the window surface, reload, observe.
const { chromium } = require('playwright');
const URL = process.env.BOARDS_URL || 'http://localhost:8000/index.html';
const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? (pass++, console.log('  PASS ' + n)) : (fail++, console.log('  FAIL ' + n + (extra ? ' :: ' + extra : ''))); };

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

  console.log('\n[R1] Fresh open, today has 2 events: lands on the day\'s linked board (B105)');
  {
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(URL);
    await page.waitForTimeout(500);
    const today = await page.evaluate(() => calKey(new Date()));
    // Two events for today, creation order pinned; the most-recent BOARD is a
    // plain one, so without the launch boot would land there, not on the day.
    await page.evaluate(async () => {
      const key = calKey(new Date());
      const e1 = newCalEvent(key, 'first event');
      const e2 = newCalEvent(key, 'second event');
      e2.createdAt = e1.createdAt + 1;
      e1.updatedAt = 1; e2.updatedAt = 2;   // events must lose boot's most-recent pick
      const plain = newBoardRecord();
      plain.updatedAt = Date.now() + 2;      // launch → most recent, NOT the day board
      await idbPut(e1); await idbPut(e2); await idbPut(plain);
    });
    await page.reload();                     // the fresh app open
    await page.waitForTimeout(1500);         // boot + SWAP_MS
    const got = await page.evaluate(async () => {
      const key = calKey(new Date());
      const all = await idbGetAll();
      const board = all.find(r => r.cal === key);
      return { curCal: state.current && state.current.cal,
               boardTitle: board && board.title,
               req: board && (board.requirements || '').split('\n') };
    });
    ok('the launch ensured the day board', !!got.boardTitle, JSON.stringify(got));
    ok('boot is CURRENT on it', got.curCal === today && got.curCal !== undefined,
      JSON.stringify(got.curCal) + " want " + today);
    ok('title is the MM/DD/YY To Do species',
      /\/\d\d\/\d\d To Do$/.test(got.boardTitle || ''), got.boardTitle);
    ok('Requirements lead with both events, creation order',
      JSON.stringify(got.req && got.req.slice(0, 2)) === JSON.stringify(['first event', 'second event']),
      JSON.stringify(got.req));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[R2] Fresh open, today has 0 events: the morning auto-create lands on the day board (B107/B108 — supersedes B105\'s nothing-created, deliberately rewritten)');
  {
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(URL);
    await page.waitForTimeout(1500);
    const today = await page.evaluate(() => calKey(new Date()));
    const got = await page.evaluate(async () => {
      const key = calKey(new Date());
      const all = await idbGetAll();
      const board = all.find(r => r.cal === key);
      return { curCal: state.current && state.current.cal,
               title: board && board.title };
    });
    ok('today\'s linked board was created with 0 events', !!got.title, JSON.stringify(got));
    ok('boot is CURRENT on it', got.curCal === today, JSON.stringify(got.curCal) + " want " + today);
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // The open-past-midnight case (renderCal's key-changed check) needs a fake
  // clock — calKey reads new Date() at the call site — and is left to QA's
  // manual pass; the guard itself is two lines on `rollDay`.

  await browser.close();
  console.log('\n=== day-roll: ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
})();
