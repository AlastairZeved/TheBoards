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

const { URL, ok, summary, launch, tap, tapWithMove, touchDragTo, newMobilePage, newDesktopPage, waitBoard, withErrors, run } = require('./lib');


async function newPage(browser, viewport = { width: 384, height: 846 }) {
  const ctx = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 3, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL);
  await waitBoard(page);
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}

// Wait until the month grid is showing nCells day cells (0 = still rendering).
async function monthReady(page, minCells = 1) {
  await page.waitForFunction((n) => document.querySelectorAll('.mo-cell').length >= n, minCells);
}

run(async () => {
  const browser = await launch();

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
    // Back to this month, then tapping today's cell swaps the stack to
    // today's Sunday-first week. B158 (issue #384) moved today's day card
    // out of the stack — it renders as #cal-today-board, the full-width
    // body below the band — so a .cal-day.today in the stack can never
    // resolve again (issue #401). The B158 surface: the stack holds the
    // week's six NON-today days, and today renders in the body below the
    // band. Expectations computed in-page: the six days are the tapped
    // week's Sunday..Saturday minus today, wherever today sits in its week.
    await page.evaluate((w) => document.querySelector(`.mo-nav[aria-label="${w}"]`).click(), 'Previous month');
    await page.waitForSelector('.mo-cell.today');
    const todayCell = await page.evaluate(() => {
      const c = document.querySelector('.mo-cell.today');
      const r = c.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.click(todayCell.x, todayCell.y);
    await page.waitForFunction(() => {
      const days = [...document.querySelectorAll('.cal-day')];
      const board = document.getElementById('cal-today-board');
      const band = document.getElementById('cal-band');
      return days.length === 6 && !days.some(d => d.classList.contains('today')) &&
        board && board.querySelector('.cal-notes') &&
        board.getBoundingClientRect().top >= band.getBoundingClientRect().bottom - 1;
    });
    await page.waitForTimeout(200);
    const back = await page.evaluate(() => {
      const now = new Date();
      const tk = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      const want = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + i);
        const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        if (k !== tk) want.push(d);
      }
      const days = [...document.querySelectorAll('.cal-day')];
      const p = (x) => String(x.getMonth() + 1).padStart(2, '0') + '/' + String(x.getDate()).padStart(2, '0');
      const board = document.getElementById('cal-today-board');
      const band = document.getElementById('cal-band');
      return {
        n: days.length,
        todays: days.filter(d => d.classList.contains('today')).length,
        d2s: days.map(d => d.querySelector('.cal-d2').textContent),
        wantD2s: want.map(p),
        boardNotes: !!board.querySelector('.cal-notes'),
        boardBelowBand: board.getBoundingClientRect().top >= band.getBoundingClientRect().bottom - 1,
      };
    });
    ok('tapping today\'s cell keeps today out of the stack (B158: it renders in the body below the band)', back.todays === 0, String(back.todays));
    ok('the stack shows today\'s week minus today — the six non-today days, Sunday-first', back.d2s.length === 6 && back.d2s.join() === back.wantD2s.join(), JSON.stringify(back.d2s) + ' vs ' + JSON.stringify(back.wantD2s));
    ok('today\'s body renders below the band, populated (#cal-today-board, B158)', back.n === 6 && back.boardNotes && back.boardBelowBand, JSON.stringify(back));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[M4] The default weekly stack shows 30 future dates with Sunday dividers (mobile)');
  {
    const { ctx, page, errors } = await newPage(browser);
    await page.evaluate(() => renderCal());
    await page.waitForFunction(() => document.querySelectorAll('#cal-stack .cal-day').length === 30);
    const rolling = await page.evaluate(() => {
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const cards = [...document.querySelectorAll('#cal-stack .cal-day')];
      const label = d => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
      const expected = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i + 1);
        return { label: label(d), sunday: d.getDay() === 0 };
      });
      const actual = cards.map(card => {
        const style = getComputedStyle(card);
        return { label: card.querySelector('.cal-d2').textContent, sunday: card.classList.contains('sunday'),
          width: card.getBoundingClientRect().width, borderWidth: style.borderBottomWidth,
          borderColor: style.borderBottomColor, borderStyle: style.borderBottomStyle };
      });
      const stack = document.getElementById('cal-stack');
      return { actual, expected, todayInStack: cards.some(c => c.classList.contains('today')),
        stackScrollable: stack.scrollHeight > stack.clientHeight && getComputedStyle(stack).overflowY === 'auto' };
    });
    ok('the default stack renders exactly the next 30 dates, tomorrow through today + 30',
      rolling.actual.length === 30 && rolling.actual.every((d, i) => d.label === rolling.expected[i].label), JSON.stringify(rolling.actual.map(d => d.label)));
    ok('today remains in its separate body, not duplicated in the stack', !rolling.todayInStack);
    ok('the expanded rolling list remains vertically scrollable', rolling.stackScrollable);
    const sundays = rolling.actual.filter((d, i) => rolling.expected[i].sunday);
    ok('only Sundays receive the full-card-width 2px --frame divider',
      sundays.length > 0 && rolling.actual.every((d, i) => d.sunday === rolling.expected[i].sunday) &&
        sundays.every(d => d.borderWidth === '2px' && d.borderColor === 'rgb(180, 129, 88)' && d.borderStyle === 'solid' && d.width > 0),
      JSON.stringify(sundays));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[M5] The month view fits the wide panel (desktop)');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(URL);
    await waitBoard(page);
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

});
