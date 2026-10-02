// The month view (issue #191).
//
// The compact month grid lives in the viewport ground #170 freed below the
// week stack. This suite drives the real page (mobile viewport — the tight
// one) and asserts the issue's six features as shipped behaviour: one dot per
// event-bearing day no matter the event count, the pale band across the
// current week's row, today in the calendar's orange fall, the two month
// nav buttons, and the tap that swaps the week view to the tapped date's
// Sunday-first week. Pure display: nothing here writes records.
//
// Palette assertions read computed styles (the water fall's opaque stops and
// --accent-page), so a palette drift fails here too.

const { chromium } = require('playwright');
const URL = process.env.BOARDS_URL || 'http://localhost:8000/index.html';
const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? (pass++, console.log('  PASS ' + n)) : (fail++, console.log('  FAIL ' + n + (extra ? ' :: ' + extra : ''))); };

async function newPage(browser, viewport = { width: 384, height: 846 }) {
  const ctx = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 3, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => !!document.querySelector('#board'));
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}

// Wait until the month grid is showing nCells day cells (0 = still rendering).
async function monthReady(page, minCells = 1) {
  await page.waitForFunction((n) => document.querySelectorAll('.mo-cell').length >= n, minCells);
}

(async () => {
  const browser = await chromium.launch({ ...launchOpts });

  console.log('\n[M1] Dots, today\'s cell, the current-week band (mobile)');
  {
    const { ctx, page, errors } = await newPage(browser);
    // Two events on today (the one-dot law's hard case), one on today+2.
    await page.evaluate(async () => {
      const tk = calKey(new Date());
      const d2 = new Date(); d2.setDate(d2.getDate() + 2);
      await idbPut(newCalEvent(tk, 'event one today'));
      await idbPut(newCalEvent(tk, 'event two today'));
      await idbPut(newCalEvent(calKey(d2), 'event on +2'));
      renderCal();
    });
    await monthReady(page, 28);
    const m = await page.evaluate(() => {
      const now = new Date();
      const cells = [...document.querySelectorAll('.mo-cell')];
      const dots = [...document.querySelectorAll('.mo-dot')];
      const byDay = {};
      for (const d of dots) {
        const c = d.closest('.mo-cell');
        const day = c.getAttribute('aria-label').replace(', has events', '');
        byDay[day] = (byDay[day] || 0) + 1;
      }
      const todays = cells.filter(c => c.classList.contains('today'));
      const wks = cells.filter(c => c.classList.contains('wk'));
      const rows = new Set(wks.map(c => c.offsetTop));
      const cols = wks.map(c => c.offsetLeft).sort((a, b) => a - b);
      const colW = document.querySelector('.mo-grid').getBoundingClientRect().width / 7;
      // Cells touch: consecutive offsets differ by the column pitch (±2px rounding).
      const contiguous = cols.every((x, i) => i === 0 || Math.abs(x - cols[i - 1] - colW) <= 2);
      const dotColor = dots.length ? getComputedStyle(dots[0]).backgroundColor : '';
      const todayBg = todays.length ? getComputedStyle(todays[0]).backgroundImage : '';
      const label = document.querySelector('.mo-label').textContent;
      const grid = document.querySelector('.mo-grid');
      const firstCol = Math.round((cells[0].getBoundingClientRect().left - grid.getBoundingClientRect().left) / colW);
      // Expectations, computed in the page (the app's own locale + calendar).
      const todayLabel = now.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
      const d2 = new Date(); d2.setDate(d2.getDate() + 2);
      return {
        nCells: cells.length, byDay, todays: todays.length,
        wkRows: [...rows], contiguous, nWk: wks.length,
        dotColor, todayBg, label, firstCol,
        wantLabel: now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        wantCells: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
        wantCol: new Date(now.getFullYear(), now.getMonth(), 1).getDay(),
        todayLabel, otherLabel: d2.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }),
      };
    });
    ok('the grid draws this month', m.label === m.wantLabel && m.nCells === m.wantCells, JSON.stringify(m));
    ok('the 1st sits on its true weekday column (Sunday-first grid)', m.firstCol === m.wantCol, 'col=' + m.firstCol);
    ok('a day with TWO events wears exactly ONE dot', m.byDay[m.todayLabel] === 1 && m.byDay[m.otherLabel] === 1, JSON.stringify(m.byDay));
    ok('two event-bearing days, two dots total', Object.keys(m.byDay).length === 2, JSON.stringify(m.byDay));
    ok('the dot is --accent-page, the palette shade (rgb(109,156,176))', m.dotColor === 'rgb(109, 156, 176)', m.dotColor);
    ok('exactly one today cell', m.todays === 1, String(m.todays));
    ok('today wears the calendar\'s own orange fall (the #815a42 gradient)', /129,\s*90,\s*66/.test(m.todayBg.replace(/\s+/g, ' ')) || /129, 90, 66/.test(m.todayBg), m.todayBg);
    ok('the current week\'s band is one row of 7 contiguous cells', m.nWk === 7 && m.wkRows.length === 1 && m.contiguous, JSON.stringify(m));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[M2] Month back/forward (mobile)');
  {
    const { ctx, page, errors } = await newPage(browser);
    await page.evaluate(() => renderCal());
    await monthReady(page);
    const nav = (which) => page.evaluate((w) => document.querySelector(`.mo-nav[aria-label="${w}"]`).click(), which);
    const waitLabelChange = (prev) =>
      page.waitForFunction((p) => document.querySelector('.mo-label').textContent !== p, prev);
    const prevLabel = await page.evaluate(() => document.querySelector('.mo-label').textContent);
    await nav('Next month');
    await waitLabelChange(prevLabel);
    const fwd = await page.evaluate(() => {
      const n = new Date(); const a = new Date(n.getFullYear(), n.getMonth() + 1, 1);
      const cells = [...document.querySelectorAll('.mo-cell')];
      const colW = document.querySelector('.mo-grid').getBoundingClientRect().width / 7;
      return {
        label: document.querySelector('.mo-label').textContent,
        nCells: cells.length,
        firstCol: Math.round((cells[0].getBoundingClientRect().left - document.querySelector('.mo-grid').getBoundingClientRect().left) / colW),
        want: a.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        wantCol: a.getDay(), wantCells: new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate(),
      };
    });
    ok('Next month shows next month', fwd.label === fwd.want, fwd.label + ' vs ' + fwd.want);
    ok('next month\'s 1st sits on its true weekday column', fwd.firstCol === fwd.wantCol, fwd.firstCol + ' vs ' + fwd.wantCol);
    ok('next month draws its own day count', fwd.nCells === fwd.wantCells, fwd.nCells + ' vs ' + fwd.wantCells);
    const wantBackLabel = await page.evaluate(() => {
      const n = new Date(); const a = new Date(n.getFullYear(), n.getMonth() - 1, 1);
      return a.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    });
    await nav('Previous month');
    await nav('Previous month');
    await page.waitForFunction((w) => document.querySelector('.mo-label').textContent === w, wantBackLabel);
    const back = await page.evaluate((want) => ({ label: document.querySelector('.mo-label').textContent, want }), wantBackLabel);
    ok('two backs land on last month', back.label === back.want, back.label + ' vs ' + back.want);
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[M3] Tap a date -> the week view swaps to that Sunday-first week (mobile)');
  const p = (x) => String(x.getMonth() + 1).padStart(2, '0') + '/' + String(x.getDate()).padStart(2, '0');
  {
    const { ctx, page, errors } = await newPage(browser);
    await page.evaluate(() => renderCal());
    await monthReady(page);
    // Navigate to next month, then tap its 20th — always a different week
    // from today's, wherever today sits in its month.
    await page.evaluate((w) => document.querySelector(`.mo-nav[aria-label="${w}"]`).click(), 'Next month');
    await page.waitForFunction((want) => {
      const n = new Date();
      return document.querySelector('.mo-label').textContent ===
        new Date(n.getFullYear(), n.getMonth() + 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }, null);
    const target = await page.evaluate(() => {
      const n = new Date(); const a = new Date(n.getFullYear(), n.getMonth() + 1, 20);
      const cell = [...document.querySelectorAll('.mo-cell')].find(c => c.textContent.trim() === '20');
      const r = cell.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2,
               want: new Date(a.getFullYear(), a.getMonth(), 20 - a.getDay()) };
    });
    // Tap by absolute viewport coords (the cell is a plain click control).
    await page.mouse.click(target.x, target.y);
    try {
      await page.waitForFunction((k) =>
        [...document.querySelectorAll('.cal-day')].length === 7 &&
        document.querySelector('.cal-day .cal-d2').textContent === k, p(target.want));
    } catch (e) {
      const dbg = await page.evaluate(() => ({
        d2s: [...document.querySelectorAll('.cal-day')].map(d => d.querySelector('.cal-d2').textContent),
        cells: document.querySelectorAll('.mo-cell').length,
      }));
      console.log('  DBG', typeof target.want, p(target.want), JSON.stringify(dbg), errors.join('|'));
      throw e;
    }
    await page.waitForTimeout(200);
    const w = await page.evaluate(() => {
      const days = [...document.querySelectorAll('.cal-day')];
      return {
        n: days.length,
        d2s: days.map(d => d.querySelector('.cal-d2').textContent),
        firstD1: days[0].querySelector('.cal-d1').textContent,
        todays: days.filter(d => d.classList.contains('today')).length,
        monthCells: document.querySelectorAll('.mo-cell').length,   // the month view survives the swap
      };
    });
    ok('the stack shows 7 day cards', w.n === 7, String(w.n));
    ok('the first card is the tapped week\'s Sunday', w.d2s[0] === p(target.want), w.d2s[0] + ' vs ' + p(target.want));
    ok('the week runs Sun..Sat in order', w.d2s.every((s, i) => s === p(new Date(target.want.getFullYear(), target.want.getMonth(), target.want.getDate() + i))), JSON.stringify(w.d2s));
    ok('the swapped week has no today card (today is not in it)', w.todays === 0, String(w.todays));
    ok('the month view survives the swap', w.monthCells >= 28, String(w.monthCells));
    // Back to this month, then tapping today's cell restores today's card.
    await page.evaluate((w) => document.querySelector(`.mo-nav[aria-label="${w}"]`).click(), 'Previous month');
    await page.waitForSelector('.mo-cell.today');
    const todayCell = await page.evaluate(() => {
      const c = document.querySelector('.mo-cell.today');
      const r = c.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.click(todayCell.x, todayCell.y);
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.cal-day')].some(d => d.classList.contains('today')));
    await page.waitForTimeout(200);
    const back = await page.evaluate(() =>
      [...document.querySelectorAll('.cal-day')].filter(d => d.classList.contains('today')).length);
    ok('tapping today\'s cell restores a today card in the stack', back === 1, String(back));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[M5] The exit row\'s `Today` resets BOTH the month and the week view (issue #342, B148)');
  {
    const { ctx, page, errors } = await newPage(browser);
    await page.evaluate(() => document.getElementById('action-calendar').click());
    await monthReady(page);
    await page.waitForTimeout(300);
    // Baseline: the shipped defaults. The label reads the month on show, the
    // stack's first card is today and its last is today+6.
    const readState = () => page.evaluate(() => {
      const label = document.querySelector('.mo-label').textContent;
      const now = new Date();
      const cards = [...document.querySelectorAll('.cal-day')];
      return {
        label,
        wantMonth: now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        firstToday: cards.length > 0 && cards[0].classList.contains('today'),
        nCards: cards.length,
        // the stack's LAST card's key, read off its header text is fragile —
        // read the anchors' effect instead: a today-first, today+6 window has
        // exactly one .today card and 7 cards total.
        todayCards: cards.filter(d => d.classList.contains('today')).length,
      };
    });
    const boot = await readState();
    ok('at boot the month view reads the current month and the week view is today + 6',
      boot.label === boot.wantMonth && boot.todayCards === 1 && boot.nCards === 7, JSON.stringify(boot));
    // Drive BOTH anchors off today: the month back arrow, then a tap on a
    // day cell in a different week.
    await page.click('.mo-head .mo-nav');                     // previous month
    await monthReady(page);
    await page.waitForTimeout(300);
    const offMonth = await page.evaluate(() => {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        .toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      return { label: document.querySelector('.mo-label').textContent, prev };
    });
    ok('the month view moved off the current month (the precondition)',
      offMonth.label === offMonth.prev, JSON.stringify(offMonth));
    // Tap a day cell 20+ days out so the tapped week cannot contain today.
    const farCell = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('.mo-cell:not(.today)')];
      const c = cells[Math.min(cells.length - 1, 24)];
      const r = c.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, n: c.textContent };
    });
    await page.mouse.click(farCell.x, farCell.y);
    await page.waitForTimeout(400);
    const offWeek = await readState();
    ok('the week view moved off the today-first window (the precondition)',
      offWeek.todayCards === 0 || offWeek.firstToday === false, JSON.stringify(offWeek));
    // The control itself: present, filled, seated right, in the row.
    const ctl = await page.evaluate(() => {
      const row = document.getElementById('cal-top').getBoundingClientRect();
      const back = document.getElementById('cal-back').getBoundingClientRect();
      const t = document.getElementById('cal-today');
      const r = t.getBoundingClientRect();
      return {
        exists: !!t, label: t.textContent.trim(),
        h: r.height, w: r.width,
        backLeft: Math.abs(back.left - row.left) < 12,
        todayRight: Math.abs(row.right - r.right) < 12,
        sameRow: Math.abs(back.top - r.top) < 2,
      };
    });
    ok('`Today\` renders in the exit row, reading "Today" (issue #342, B148)',
      ctl.exists && ctl.label === 'Today', JSON.stringify(ctl));
    ok('`Today` is the same species as Collapse — same height, clearing the §6 touch floor as drawn',
      ctl.h >= 44 && ctl.w >= 44, `${ctl.w}x${ctl.h}`);
    ok('Collapse holds the row\'s LEFT corner and `Today` its RIGHT, on the same line',
      ctl.backLeft && ctl.todayRight && ctl.sameRow, JSON.stringify(ctl));
    // The act.
    await page.click('#cal-today');
    await monthReady(page);
    await page.waitForTimeout(400);
    const reset = await readState();
    ok('`Today` returns the month view to the current month', reset.label === reset.wantMonth, JSON.stringify(reset));
    ok('`Today` returns the week view to today at the top with the next 6 days beneath it',
      reset.firstToday && reset.todayCards === 1 && reset.nCards === 7, JSON.stringify(reset));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[M4] The month view fits the wide panel (desktop)');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(URL);
    await page.waitForFunction(() => !!document.querySelector('#board'));
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('cal-rail').click());
    await page.waitForTimeout(400);
    const g = await page.evaluate(() => {
      const m = document.getElementById('cal-month').getBoundingClientRect();
      return { visible: m.height > 100, bottom: +m.bottom.toFixed(1), vh: window.innerHeight, cells: document.querySelectorAll('.mo-cell').length };
    });
    ok('the expanded panel carries the month view', g.visible && g.cells >= 28, JSON.stringify(g));
    ok('the month view fits inside the viewport', g.bottom <= g.vh, JSON.stringify(g));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log(`\n=== month: ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
