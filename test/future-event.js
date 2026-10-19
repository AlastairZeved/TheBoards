// Future-dated squares must not create their linked board (B131, issue #250;
// the squares are the events, B179): the day-note square is the only stored
// thing at creation; the board materializes on its date via the morning
// lifecycle (B108), with the same first-sync calReq and a one-time boot sweep
// deleting the ghost boards the pre-fix build left behind. Black-box on the
// CURRENT surface (issue #363/B153): the square is seeded as a RECORD (idbPut of
// a day-note), the store assertions read it through idbGetAll, and the day
// cards and today's body render the squares. The roll is driven by Playwright's
// clock (the repo's precedent left fake-clock to QA — this suite adopts the
// sanctioned tool instead of leaving the ruling untested).
const { URL, ok, summary, launch, tap, tapWithMove, touchDragTo, newMobilePage, newDesktopPage, waitBoard, withErrors, run } = require('./lib');


async function newPage(browser, ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 384, height: 846 }, hasTouch: true, ...ctxOpts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL);
  await waitBoard(page);
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}

// Seed a day-note square (the day's event, B179) for the date `dayOffset` days
// from today, then reboot onto the store (an empty boot made its own board). A
// record puts a square on a FUTURE date with no board, which is what B131
// governs.
async function seedSquareRecord(page, dayOffset, text) {
  await page.evaluate(async ({ dayOffset, text }) => {
    const d = new Date(); d.setDate(d.getDate() + dayOffset);
    await idbPut({ id: 'rem-f-' + dayOffset, rem: '', next: text, day: calKey(d) });
  }, { dayOffset, text });
  await page.reload();
  await waitBoard(page);
  await page.waitForTimeout(600);
}

// Open the calendar face (narrow tier) and report what it renders: the squares
// in the week stack's day cards and in today's body (B158). B154 deleted
// `.cal-note-title`; a square's text is `.cal-note-text`.
async function openCalendar(page) {
  await page.evaluate(() => document.getElementById('action-calendar').click());
  await page.waitForTimeout(700);
  return page.evaluate(() => ({
    squares: [...document.querySelectorAll('.cal-day .cal-note')].map(b => b.querySelector('.cal-note-text').textContent),
    today: [...document.querySelectorAll('#cal-today-board .cal-note-text')].map(t => t.textContent),
    adds: document.querySelectorAll('.cal-day .cal-add').length,
  }));
}

run(async () => {
  const browser = await launch();

  console.log('\n[F1] A future-dated SQUARE creates NO board (B131, B179) — record-level');
  {
    const { ctx, page, errors } = await newPage(browser);
    await seedSquareRecord(page, 2, 'future event line');      // day 2 from today
    const got = await page.evaluate(async () => {
      const tm = new Date(); tm.setDate(tm.getDate() + 2);
      const tk = calKey(tm);
      const all = await idbGetAll();
      return {
        square: all.some(r => r.day === tk && r.next === 'future event line'),
        futureBoards: all.filter(r => r.cal !== undefined && r.cal > calKey(new Date())).length,
        boardCount: all.filter(r => r.title !== undefined).length,
      };
    });
    ok('the square record exists for the future date', got.square, JSON.stringify(got));
    ok('no boards record exists for any future date (store-level, not menu-level)',
       got.futureBoards === 0, JSON.stringify(got));
    const shown = await openCalendar(page);
    // Re-pinned deliberately for issue #484 (B179): the squares are the events,
    // so the seeded square shows in its day card; this replaces issue #363's
    // pins that no event line and no event text show in the weekly stack.
    ok('the square renders in its day card (B179: the squares are the events)',
       shown.squares.includes('future event line'), JSON.stringify(shown.squares));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[F2] A TODAY-dated SQUARE still syncs its linked board (regression — B131 must not touch the same-day path)');
  {
    const { ctx, page, errors } = await newPage(browser);
    await seedSquareRecord(page, 0, 'today event line');       // today's date
    const got = await page.evaluate(async () => {
      const tk = calKey(new Date());
      const all = await idbGetAll();
      const b = all.find(r => r.cal === tk);
      return { board: !!b, calReq: b && b.calReq,
               square: all.some(r => r.day === tk && r.next === 'today event line'),
               req: b && b.requirements };
    });
    ok('today\'s linked board exists with the square\'s first-sync span',
       got.board && got.calReq === 1, JSON.stringify(got));
    ok('the square record exists and the mirror read it into the span',
       got.square && (got.req || '').indexOf('today event line') !== -1, JSON.stringify(got));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[F3] On the roll to the square\'s date, the board materializes: morning lifecycle, calReq sync, sweep, carry-forward (B131 + B108, B179)');
  {
    const { ctx, page, errors } = await newPage(browser);
    // Seed on the REAL today: a square for tomorrow, a pre-fix ghost board
    // for today+3 (zero notes — sweep food), and one incomplete note on
    // today's board (tomorrow's yesterday — carry-forward food).
    await page.evaluate(async () => {
      const tk = calKey(new Date());
      const tm = new Date(); tm.setDate(tm.getDate() + 1);
      const t3 = new Date(); t3.setDate(t3.getDate() + 3);
      await idbPut({ id: 'rem-f-1', rem: '', next: 'materialize me', day: calKey(tm) });
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
    await waitBoard(page);
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
      const sq = all.find(r => r.day === tk && r.next === 'materialize me');
      const carried = b && (b.notes || []).find(n => n.text === 'carry me');
      return {
        tk, curCal: state.current && state.current.cal,
        board: !!b, calReq: b && b.calReq, req: b && b.requirements,
        ghost: all.some(r => r.cal !== undefined && r.title === 'GHOST'),
        anyFuture: all.some(r => r.cal !== undefined && r.cal > tk),
        sqSurvived: !!sq,
        carriedOn: carried && carried.carriedOn,
        ybIncomplete: yb && (yb.notes || []).some(n => n.state !== 'complete'),
      };
    }, got);
    ok('the linked board materialized on its date', g.board, JSON.stringify(g));
    ok('boot is CURRENT on it', g.curCal === g.tk, g.curCal + ' want ' + g.tk);
    ok('the span synced at materialization (calReq = the square it already had, B131, B179)',
       g.calReq === 1, JSON.stringify(g));
    ok('the mirror read the square into the span', (g.req || '').indexOf('materialize me') !== -1, JSON.stringify(g.req));
    ok('the pre-fix ghost board was swept (store-level)', !g.ghost, JSON.stringify(g));
    ok('nothing future-dated remains in the boards store', !g.anyFuture, JSON.stringify(g));
    ok('the square survived the sweep (it is a record of its own; the sweep deletes boards only)',
       g.sqSurvived, JSON.stringify(g));
    ok('yesterday\'s incomplete note carried forward with carriedOn = today',
       g.carriedOn === g.tk, JSON.stringify(g));
    ok('yesterday\'s board keeps only completes', !g.ybIncomplete, JSON.stringify(g));
    const shown = await openCalendar(page);
    // Re-pinned deliberately for issue #484 (B179): the squares are the events,
    // so the materialized day's event shows as its square in today's body; this
    // replaces issue #363's pin that no line renders for it after the roll.
    ok('after the roll, today\'s body shows the square (B179: the squares are the events)',
       shown.today.includes('materialize me'), JSON.stringify(shown.today));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  await browser.close();

});
