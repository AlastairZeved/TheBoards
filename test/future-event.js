// Future-dated calendar events must not create their linked board (B131,
// issue #250): the event record is the only stored thing at event creation;
// the board materializes on its date via the morning lifecycle (B108), with
// the same first-sync calReq and a one-time boot sweep deleting the ghost
// boards the pre-fix build left behind. Black-box on the CURRENT surface
// (issue #363/B153): calendar events no longer render in the weekly stack —
// the event is seeded as a RECORD (idbPut of newCalEvent), every assertion
// that read a rendered .cal-line now reads the store through idbGetAll, and
// the day cards show only their day-note squares. The roll is driven by
// Playwright's clock (the repo's precedent left fake-clock to QA — this suite
// adopts the sanctioned tool instead of leaving the ruling untested).
const { chromium } = require('playwright');
const URL = process.env.BOARDS_URL || 'http://localhost:8000/index.html';
const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? (pass++, console.log('  PASS ' + n)) : (fail++, console.log('  FAIL ' + n + (extra ? ' :: ' + extra : ''))); };

async function newPage(browser, ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 384, height: 846 }, hasTouch: true, ...ctxOpts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => !!document.querySelector('#board'));
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}

// Seed an event RECORD for the date `dayOffset` days from today, then reboot
// onto the store (an empty boot made its own board). Issue #363: the add path
// that used to birth events through the UI (.cal-add) now adds DAY NOTES, so
// the record is the only way in — which is exactly what B131 governs.
async function seedEventRecord(page, dayOffset, text) {
  await page.evaluate(async ({ dayOffset, text }) => {
    const d = new Date(); d.setDate(d.getDate() + dayOffset);
    await idbPut(newCalEvent(calKey(d), text));
  }, { dayOffset, text });
  await page.reload();
  await page.waitForFunction(() => !!document.querySelector('#board'));
  await page.waitForTimeout(600);
}

// Open the calendar face (narrow tier) and report what the week stack shows.
async function openCalendar(page) {
  await page.evaluate(() => document.getElementById('action-calendar').click());
  await page.waitForTimeout(700);
  return page.evaluate(() => ({
    lines: [...document.querySelectorAll('.cal-line')].map(l => l.textContent),
    squares: [...document.querySelectorAll('.cal-day .cal-note')].map(b => b.querySelector('.cal-note-title').textContent),
    adds: document.querySelectorAll('.cal-day .cal-add').length,
  }));
}

(async () => {
  const browser = await chromium.launch(launchOpts);

  console.log('\n[F1] A future-dated event RECORD creates NO board (B131) — record-level on the #363 surface');
  {
    const { ctx, page, errors } = await newPage(browser);
    await seedEventRecord(page, 2, 'future event line');       // day 2 from today
    const got = await page.evaluate(async () => {
      const tm = new Date(); tm.setDate(tm.getDate() + 2);
      const tk = calKey(tm);
      const all = await idbGetAll();
      return {
        event: all.some(r => r.date === tk && r.text === 'future event line'),
        futureBoards: all.filter(r => r.cal !== undefined && r.cal > calKey(new Date())).length,
        boardCount: all.filter(r => r.title !== undefined).length,
      };
    });
    ok('the event record exists for the future date', got.event, JSON.stringify(got));
    ok('no boards record exists for any future date (store-level, not menu-level)',
       got.futureBoards === 0, JSON.stringify(got));
    const shown = await openCalendar(page);
    ok('no event line renders anywhere in the weekly stack (issue #363)',
       shown.lines.length === 0, JSON.stringify(shown.lines));
    ok('the day cards carry no event text — only day-note squares render (and none is seeded here)',
       shown.squares.length === 0 && shown.squares.every(s => s !== 'future event line'), JSON.stringify(shown.squares));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[F2] A TODAY-dated event RECORD still syncs its linked board (regression — B131 must not touch the same-day path)');
  {
    const { ctx, page, errors } = await newPage(browser);
    await seedEventRecord(page, 0, 'today event line');        // today's date
    const got = await page.evaluate(async () => {
      const tk = calKey(new Date());
      const all = await idbGetAll();
      const b = all.find(r => r.cal === tk);
      return { board: !!b, calReq: b && b.calReq,
               event: all.some(r => r.date === tk && r.text === 'today event line'),
               req: b && b.requirements };
    });
    ok('today\'s linked board exists with the event\'s first-sync span',
       got.board && got.calReq === 1, JSON.stringify(got));
    ok('the event record exists and the mirror read it into the span',
       got.event && (got.req || '').indexOf('today event line') !== -1, JSON.stringify(got));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[F3] On the roll to the event\'s date, the board materializes: morning lifecycle, calReq sync, sweep, carry-forward (B131 + B108)');
  {
    const { ctx, page, errors } = await newPage(browser);
    // Seed on the REAL today: an event for tomorrow, a pre-fix ghost board
    // for today+3 (zero notes — sweep food), and one incomplete note on
    // today's board (tomorrow's yesterday — carry-forward food).
    await page.evaluate(async () => {
      const tk = calKey(new Date());
      const tm = new Date(); tm.setDate(tm.getDate() + 1);
      const t3 = new Date(); t3.setDate(t3.getDate() + 3);
      await idbPut(newCalEvent(calKey(tm), 'materialize me'));
      const ghost = newBoardRecord();
      ghost.title = 'GHOST'; ghost.cal = calKey(t3);
      await idbPut(ghost);
      const todayBoard = (await idbGetAll()).find(r => r.cal === tk);
      todayBoard.notes.push({ id: 'n1', x: 0, y: 0, text: 'carry me', state: 'open' });
      await idbPut(todayBoard);
      // No persist() here: it would write a stale snapshot of state.current
      // (the same board, notes empty) over the seeded note. The direct put is
      // durable; nothing else touches this board before the reload.
    });
    await page.waitForTimeout(400);
    // The day roll: fake the clock to tomorrow, then reload — the fresh load
    // IS the morning load (rollDay resets, morning = true, B108).
    await page.clock.setFixedTime(new Date(Date.now() + 24 * 3600 * 1000));
    await page.reload();
    await page.waitForFunction(() => !!document.querySelector('#board'));
    await page.waitForTimeout(1500);
    const got = await page.evaluate(() => {
      const now = new Date();
      const tk = calKey(now);
      const ys = new Date(); ys.setDate(ys.getDate() - 1);
      const yk = calKey(ys);
      return { tk, yk, now: now.toISOString() };
    });
    const g = await page.evaluate(async ({ tk, yk }) => {
      const all = await idbGetAll();
      const b = all.find(r => r.cal === tk);
      const yb = all.find(r => r.cal === yk);
      const ev = all.find(r => r.date === tk && r.text === 'materialize me');
      const carried = b && (b.notes || []).find(n => n.text === 'carry me');
      return {
        tk, curCal: state.current && state.current.cal,
        board: !!b, calReq: b && b.calReq, req: b && b.requirements,
        ghost: all.some(r => r.cal !== undefined && r.title === 'GHOST'),
        anyFuture: all.some(r => r.cal !== undefined && r.cal > tk),
        evSurvived: !!ev,
        carriedOn: carried && carried.carriedOn,
        ybIncomplete: yb && (yb.notes || []).some(n => n.state !== 'complete'),
      };
    }, got);
    ok('the linked board materialized on its date', g.board, JSON.stringify(g));
    ok('boot is CURRENT on it', g.curCal === g.tk, g.curCal + ' want ' + g.tk);
    ok('the span synced at materialization (calReq = the event it already had, B131)',
       g.calReq === 1, JSON.stringify(g));
    ok('the mirror read the event record into the span', (g.req || '').indexOf('materialize me') !== -1, JSON.stringify(g.req));
    ok('the pre-fix ghost board was swept (store-level)', !g.ghost, JSON.stringify(g));
    ok('nothing future-dated remains in the boards store', !g.anyFuture, JSON.stringify(g));
    ok('the event record survived the sweep (records persist; issue #363: they just no longer render)',
       g.evSurvived, JSON.stringify(g));
    ok('yesterday\'s incomplete note carried forward with carriedOn = today',
       g.carriedOn === g.tk, JSON.stringify(g));
    ok('yesterday\'s board keeps only completes', !g.ybIncomplete, JSON.stringify(g));
    const shown = await openCalendar(page);
    ok('after the roll, no line renders for the materialized event — the card shows only its day-note squares',
       shown.lines.length === 0, JSON.stringify(shown.lines));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log('\n=== future-event: ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
})();
