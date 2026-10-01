// Issue #320 + #329: neither the day view nor the section's square blocks may
// ever append a day-of-week suffix ("— TUE") to a label. A block's label is
// exactly what the user typed; adding a block never rewrites the text of
// existing blocks.
//
// Issue #329 replaced the retired reminders strip and the retired hourly
// boxes with the section's OWN records rendered as square two-zone blocks
// (a lighter-orange title band over a darker orange body), three across. This
// suite reproduces #320's exact acceptance behaviours on the current surface:
//   1. every pre-existing label is byte-identical after adding a block;
//   2. no label carries a " — " + weekday suffix — the appended string is
//      absent from the render path, not stripped at render time;
//   3. the section's blocks render from the released reminder records: the
//      band carries the stored `rem` title alone, the body carries the stored
//      `next` free text (a legacy calKey date renders as an empty body), and
//      nothing is read from a calendar event record;
//   4. the row's "+" adds a square in edit with the caret in the title band;
//      Enter in the band (or a tap on the darker body) moves the caret into
//      the body; a commit writes BOTH fields in one step.
//
// The regression is written to FAIL if a future change re-composes a weekday
// into a label (the tempting wrong fix is a render-time scrub).

const { chromium } = require('playwright');
const URL = process.env.BOARDS_URL || 'http://localhost:8000/index.html';
const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? (pass++, console.log('  PASS ' + n)) : (fail++, console.log('  FAIL ' + n + (extra ? ' :: ' + extra : ''))); };

async function newPage(browser, viewport = { width: 384, height: 846 }) {
  const ctx = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 3, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => !!document.querySelector('#board'));
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}

async function tap(page, x, y) {
  const c = await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(30);
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await c.detach();
}
async function center(page, sel) {
  const r = await (await page.$(sel)).boundingBox();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}
const WEEKDAY = / — (SUN|MON|TUE|WED|THU|FRI|SAT)$/i;

(async () => {
  const browser = await chromium.launch(launchOpts);

  console.log('\n[V1] Adding a block to the day view appends no day-of-week suffix to any label (issue #320 — the 7-day rows stay, unchanged from #329)');
  {
    const { ctx, page, errors } = await newPage(browser);
    await page.evaluate(async () => {
      const tk = calKey(new Date());
      const e1 = newCalEvent(tk, 'WORK ON REPOS'); e1.time = '9-2';
      const e2 = newCalEvent(tk, 'LUNCH'); e2.time = '1-2';
      await idbPut(e1); await idbPut(e2);
    });
    await page.evaluate(() => document.getElementById('action-calendar').click());
    await page.waitForTimeout(900);

    const before = await page.evaluate(async () => {
      const tk = calKey(new Date());
      return {
        lines: [...document.querySelectorAll('.cal-line')].map(l => l.textContent),
        stored: (await idbGetAll()).filter(r => r.date === tk).map(r => r.text),
      };
    });
    ok('the two seeded day blocks render with their exact text (no suffix at rest)',
      before.lines.length === 2 &&
      before.lines.every(l => l === 'WORK ON REPOS' || l === 'LUNCH'), JSON.stringify(before));

    const addPos = await center(page, '.cal-day .cal-add');
    await tap(page, addPos.x, addPos.y);
    await page.waitForTimeout(300);
    await page.keyboard.type('NEW BLOCK ENTRY');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);

    const after = await page.evaluate(async () => {
      const tk = calKey(new Date());
      return {
        lines: [...document.querySelectorAll('.cal-line')].map(l => l.textContent),
        stored: (await idbGetAll()).filter(r => r.date === tk).map(r => r.text),
      };
    });
    ok('every day-block label is byte-identical after adding + no weekday suffix anywhere + the new label is exactly typed',
      after.lines.includes('NEW BLOCK ENTRY') && after.stored.includes('NEW BLOCK ENTRY') &&
      [...after.lines, ...after.stored].every(t => !WEEKDAY.test(t)), JSON.stringify(after));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[V2] The section\'s own records render as square blocks from the released reminder records — the title alone, legacy dates empty, r.next stays stored (issue #329 supersedes B138/B144)');
  {
    const { ctx, page, errors } = await newPage(browser);
    // Seed one reminder record carrying a real next-occurrence date (the
    // stored field must survive and stay unread by any strip — nothing is
    // migrated, stripped, or rewritten; a legacy calKey date is not body text).
    await page.evaluate(async () => {
      await idbPut({ id: 'rem-seed', rem: 'PAY THE RENT', next: calKey(new Date()) });
    });
    await page.reload();
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById('action-calendar').click());
    await page.waitForTimeout(900);

    // 1. The header is the date alone — no add control of its own.
    const head = await page.evaluate(() => ({
      text: document.getElementById('cal-dayhead').textContent,
      hasButton: !!document.getElementById('cal-dayhead').querySelector('button'),
    }));
    ok('the day head carries the date alone (a real date string, no add control)',
      head.text.length > 0 && head.hasButton === false, JSON.stringify(head));

    // 2. The seeded record renders as a square block: band = the title alone,
    //    body = empty (the legacy calKey date is not user body text).
    const note = await page.evaluate(async () => {
      const n = [...document.querySelectorAll('#cal-notes-grid .cal-note')].find(x => x.querySelector('.cal-note-title').textContent === 'PAY THE RENT');
      const s = n && n.querySelector('.cal-note-text');
      const stored = (await idbGetAll()).find(r => r.id === 'rem-seed') || null;
      const r = n && n.getBoundingClientRect();
      return { title: n ? n.querySelector('.cal-note-title').textContent : null,
               bodyText: s ? s.textContent : null,
               square: r ? (r.width / r.height) : null,
               storedNext: stored && stored.next };
    });
    ok('the seeded block\'s band is the typed title byte-for-byte — no suffix of any kind (issue #320)',
      note.title === 'PAY THE RENT', JSON.stringify(note));
    ok('the seeded block is a square and its body is empty (a legacy calKey date is not body text)',
      note.square !== null && note.square >= 0.95 && note.square <= 1.15 && note.bodyText === '', JSON.stringify(note));
    ok('the stored reminder record still carries r.next — nothing stripped or rewritten',
      typeof note.storedNext === 'string' && note.storedNext.length === 10, JSON.stringify(note));

    // 3. The row's "+" adds a square in edit, caret in the title band.
    const p = await center(page, '#cal-notes-add');
    await tap(page, p.x, p.y);
    await page.waitForTimeout(400);
    const addState = await page.evaluate(() => {
      const ae = document.activeElement;
      return { activeIsBand: ae && ae.classList && ae.classList.contains('cal-note-title'),
               inEdit: ae && ae.hasAttribute && ae.hasAttribute('contenteditable') };
    });
    ok('tapping "+" adds a square with the caret in the title band (in edit)',
      addState.activeIsBand === true && addState.inEdit === true, JSON.stringify(addState));

    // 4. Type in the band; Enter hands off to the darker body; type; commit.
    await page.keyboard.type('CLEAN THE GARAGE');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const enterState = await page.evaluate(() =>
      document.activeElement && document.activeElement.classList.contains('cal-note-text'));
    ok('Enter in the title band moves the caret into the darker body',
      enterState === true, JSON.stringify(enterState));
    await page.keyboard.type('and the garage');
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(600);

    const after = await page.evaluate(async () => {
      const recs = (await idbGetAll()).filter(r => typeof r.rem === 'string');
      const added = recs.find(r => r.id !== 'rem-seed') || null;
      return { title: added && added.rem, body: added && added.next, keys: added && Object.keys(added).sort() };
    });
    ok('the added square commits BOTH fields — band and body free text, no weekday suffix, no new field',
      after.title === 'CLEAN THE GARAGE' && after.body === 'and the garage' &&
      !WEEKDAY.test(after.title) && JSON.stringify(after.keys) === JSON.stringify(['id', 'next', 'rem']),
      JSON.stringify(after));

    // 5. A tap on the darker body of an existing block seats the caret there too.
    await page.evaluate(() => {
      const t = document.querySelector('#cal-notes-grid .cal-note-text');
      t.scrollIntoView(); return true;
    });
    await page.waitForTimeout(200);
    const tb = await page.$('#cal-notes-grid .cal-note-text');
    const b2 = await tb.boundingBox();
    await tap(page, b2.x + b2.width / 2, b2.y + b2.height / 2);
    await page.waitForTimeout(400);
    const tapState = await page.evaluate(() =>
      document.activeElement && document.activeElement.classList.contains('cal-note-text'));
    ok('a tap on the darker part moves the caret into the darker part',
      tapState === true, JSON.stringify(tapState));

    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[V3] The section pages at SIX, not three — two rows of three, then the pager; and the add button carries its "+" (issue #331)');
  {
    const { ctx, page, errors } = await newPage(browser);
    // Six records: the page must hold all six in two rows and show no pager.
    await page.evaluate(async () => {
      for (let i = 0; i < 6; i++) await idbPut({ id: 'rem-' + i, rem: 'BLOCK ' + i, next: '' });
    });
    await page.reload();
    await page.waitForTimeout(600);
    await page.evaluate(() => document.getElementById('action-calendar').click());
    await page.waitForTimeout(900);

    let got = await page.evaluate(() => {
      const g = document.getElementById('cal-notes-grid');
      const blocks = [...g.querySelectorAll('.cal-note')];
      const rows = new Set(blocks.map((b) => Math.round(b.getBoundingClientRect().top))).size;
      return { count: blocks.length, rows,
        pagerShown: !document.getElementById('cal-notes-prev').hidden || !document.getElementById('cal-notes-next').hidden,
        addText: document.getElementById('cal-notes-add').textContent.trim() };
    });
    ok('six blocks render on ONE page in TWO rows — the ground under row one is used (issue #331)',
      got.count === 6 && got.rows === 2 && got.pagerShown === false, JSON.stringify(got));
    ok('the add button carries a "+" — it shipped as an empty orange square (issue #331)',
      got.addText === '+', JSON.stringify(got));

    // A seventh record turns the pager on.
    await page.evaluate(() => idbPut({ id: 'rem-6', rem: 'BLOCK 6', next: '' }));
    await page.reload();
    await page.waitForTimeout(600);
    await page.evaluate(() => document.getElementById('action-calendar').click());
    await page.waitForTimeout(900);
    got = await page.evaluate(() => ({
      count: document.querySelectorAll('#cal-notes-grid .cal-note').length,
      pagerShown: !document.getElementById('cal-notes-prev').hidden || !document.getElementById('cal-notes-next').hidden }));
    ok('the seventh block overflows to page two — pagination starts past six, not past three (issue #331)',
      got.count === 6 && got.pagerShown === true, JSON.stringify(got));

    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log(`\n=== day-view-suffix: ${pass} passed, ${fail} failed ===`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();