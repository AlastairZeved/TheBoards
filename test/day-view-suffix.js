// Issue #320: adding a block to the day view must never append a day-of-week
// suffix ("— TUE") to any block label. A block's label is exactly what the
// user typed; adding a block never rewrites the text of existing blocks.
//
// This suite reproduces the issue's exact scenario (phone width, the expanded
// #cal-view face, today's events carrying time fields) and asserts the two
// acceptance behaviours as shipped:
//   1. every pre-existing block label is byte-identical after adding a block;
//   2. no block label carries a " — " + weekday suffix — the appended string is
//      absent from the render path, not stripped at render time.
// The regression is written to FAIL if a future change ever recomposes a
// weekday into a block label (the tempting wrong fix is a render-time scrub,
// which cannot make this suite pass — it asserts the stored/rendered text is
// untouched, so a scrub that eats a user-typed suffix fails here too).
//
// Pure display: nothing here writes records beyond seeding the day's events.

const { chromium } = require('playwright');
const URL = process.env.BOARDS_URL || 'http://localhost:8000/index.html';
const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? (pass++, console.log('  PASS ' + n)) : (fail++, console.log('  FAIL ' + n + (extra ? ' :: ' + extra : ''))); };

async function newPage(browser, viewport = { width: 384, height: 846 }) {
  const ctx = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => !!document.querySelector('#board'));
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}

(async () => {
  const browser = await chromium.launch({ ...launchOpts });

  console.log('\n[V1] Adding a block appends no day-of-week suffix to any label (issue #320)');
  {
    const { ctx, page, errors } = await newPage(browser);
    // Seed today with two time-carrying blocks, exactly the issue's shape:
    // "9-2 WORK ON REPOS" and "1-2 LUNCH".
    await page.evaluate(async () => {
      const tk = calKey(new Date());
      const e1 = newCalEvent(tk, 'WORK ON REPOS'); e1.time = '9-2';
      const e2 = newCalEvent(tk, 'LUNCH'); e2.time = '1-2';
      await idbPut(e1); await idbPut(e2);
    });
    // Open the expanded calendar face (the day view) via the real tab.
    await page.evaluate(() => document.getElementById('action-calendar').click());
    await page.waitForTimeout(900);

    // Snapshot every block label BEFORE adding.
    const before = await page.evaluate(async () => {
      const tk = calKey(new Date());
      const hours = [...document.querySelectorAll('.cal-hour')].map(b => ({
        text: (b.querySelector('.cal-hour-text') || {}).textContent || '',
      }));
      const lines = [...document.querySelectorAll('.cal-line')].map(l => l.textContent);
      const stored = (await idbGetAll()).filter(r => r.date === tk).map(r => r.text);
      return { hours, lines, stored };
    });
    ok('the two seeded blocks render with their exact text (no suffix at rest)',
      before.hours.length === 2 &&
      before.hours.every(h => h.text === 'WORK ON REPOS' || h.text === 'LUNCH') &&
      before.lines.every(l => l === 'WORK ON REPOS' || l === 'LUNCH'),
      JSON.stringify(before));

    // Add a block via the day card's "+" and type its label.
    const addPos = await page.evaluate(() => {
      const add = document.querySelector('.cal-day .cal-add');
      const r = add.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const c = await page.context().newCDPSession(page);
    await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: addPos.x, y: addPos.y }] });
    await page.waitForTimeout(30);
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await c.detach();
    await page.waitForTimeout(300);
    await page.keyboard.type('NEW BLOCK ENTRY');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);

    const after = await page.evaluate(async () => {
      const tk = calKey(new Date());
      const hours = [...document.querySelectorAll('.cal-hour')].map(b => ({
        text: (b.querySelector('.cal-hour-text') || {}).textContent || '',
      }));
      const lines = [...document.querySelectorAll('.cal-line')].map(l => l.textContent);
      const stored = (await idbGetAll()).filter(r => r.date === tk).map(r => r.text);
      return { hours, lines, stored };
    });

    // 1. Every pre-existing label is byte-identical after the add.
    const beforeTexts = [...before.hours.map(h => h.text), ...before.lines];
    const afterTexts = [...after.hours.map(h => h.text), ...after.lines];
    ok('every pre-existing block label is byte-identical after adding a block',
      beforeTexts.every(t => afterTexts.includes(t)) &&
      before.hours.every(h => after.hours.some(a => a.text === h.text)),
      JSON.stringify({ before: beforeTexts, after: afterTexts }));

    // 2. No label carries a " — " + weekday suffix anywhere in the day view.
    const WEEKDAY = / — (SUN|MON|TUE|WED|THU|FRI|SAT)$/i;
    const allLabels = [...after.hours.map(h => h.text), ...after.lines, ...after.stored];
    ok('no day-view block label carries a " — WEEKDAY" suffix (the appended string is gone)',
      allLabels.every(t => !WEEKDAY.test(t)), JSON.stringify(allLabels));

    // 3. The new block's label is exactly what was typed.
    ok('the added block\'s label is exactly the typed text',
      after.lines.includes('NEW BLOCK ENTRY') && after.stored.includes('NEW BLOCK ENTRY'),
      JSON.stringify(after.lines));

    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[V2] A recurring-reminder chip renders the user\'s title alone — no auto-appended weekday, r.next stays stored (issue #320, supersedes B138\'s chip clause)');
  {
    const { ctx, page, errors } = await newPage(browser);
    // Seed one reminder record carrying a real next-occurrence date (the
    // stored field must survive and stay unread by the chip — nothing is
    // migrated or stripped).
    await page.evaluate(async () => {
      await idbPut({ id: 'rem-seed', rem: 'PAY THE RENT', next: calKey(new Date()) });
    });
    await page.reload();
    await page.waitForTimeout(500);
    // Open the expanded calendar face via the real tab.
    await page.evaluate(() => document.getElementById('action-calendar').click());
    await page.waitForTimeout(900);

    // 1. The seeded chip's textContent is EXACTLY the typed title.
    const seeded = await page.evaluate(() => {
      const chips = [...document.querySelectorAll('#cal-reminders .rem-chip')];
      const c = chips.find(ch => ch.textContent.includes('PAY THE RENT'));
      const stored = (async () => {
        const all = await idbGetAll();
        return all.find(r => r.id === 'rem-seed') || null;
      })();
      return stored.then(s => ({ text: c ? c.textContent : null, hasNext: !!(s && 'next' in s), next: s ? s.next : null }));
    });
    ok('the seeded reminder chip is the typed title byte-for-byte — no suffix of any kind',
      seeded.text === 'PAY THE RENT', JSON.stringify(seeded));
    ok('the stored reminder record still carries r.next — nothing stripped (criterion 3)',
      seeded.hasNext === true && typeof seeded.next === 'string' && seeded.next.length > 0, JSON.stringify(seeded));

    // 2. Add a reminder through the plus control; the new chip equals what was typed.
    const plusPos = await page.evaluate(() => {
      const p = document.querySelector('#cal-reminders .rem-plus');
      const r = p.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const c2 = await page.context().newCDPSession(page);
    await c2.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: plusPos.x, y: plusPos.y }] });
    await page.waitForTimeout(30);
    await c2.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await c2.detach();
    await page.waitForTimeout(300);
    await page.keyboard.type('CLEAN THE GARAGE');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);

    const after = await page.evaluate(async () => {
      const chips = [...document.querySelectorAll('#cal-reminders .rem-chip')].map(ch => ch.textContent);
      const stored = (await idbGetAll()).filter(r => typeof r.rem === 'string').map(r => ({ rem: r.rem, hasNext: 'next' in r }));
      return { chips, stored };
    });
    const WEEKDAY = / — (SUN|MON|TUE|WED|THU|FRI|SAT)$/i;
    ok('every reminder chip is suffix-free and the added chip is exactly the typed title',
      after.chips.every(t => !WEEKDAY.test(t)) &&
      after.chips.includes('CLEAN THE GARAGE') && after.chips.includes('PAY THE RENT'),
      JSON.stringify(after.chips));
    ok('every stored reminder record that ships a title still carries r.next (writer intact, subset survived)',
      after.stored.every(s => s.hasNext) && after.stored.some(s => s.rem === 'CLEAN THE GARAGE' && s.hasNext),
      JSON.stringify(after.stored));

    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log(`\n=== day-view-suffix: ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();