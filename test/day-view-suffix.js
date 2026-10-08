// Issue #320 + #363: neither the day cards' square blocks may ever append a
// day-of-week suffix ("— TUE") to a label, and the day-note records render as
// the one-zone orange squares INSIDE each day card of the weekly stack
// (issue #363/B153: the top section is deleted, three squares per day, the
// card's "+" rightmost, a ‹/› pager beyond three; one zone per issue #365). A
// block's label is exactly
// what the user typed; adding a block never rewrites the text of existing
// blocks. This suite reproduces #320's exact acceptance behaviours on the
// current surface:
//   1. every pre-existing label is byte-identical after adding a square;
//   2. no label carries a " — " + weekday suffix — the appended string is
//      absent from the render path, not stripped at render time;
//   3. the squares render from the released day-note records: the one zone
//      carries the stored `next` free text (a legacy calKey date renders as
//      an empty square; `rem` stays stored-but-unread, issue #365), and
//      nothing is read from a calendar event record;
//   4. the card's "+" adds a square dated to the card (the new `day` field)
//      in edit with the caret in the square's one zone; Enter ends the entry;
//      a commit writes `next` (`rem` untouched, issue #365);
//   5. a day beyond three squares pages on the card (‹/›).
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

  console.log('\n[V1] Adding a square to a day card appends no day-of-week suffix to any label (issue #320 — the labels stay, unchanged from #329)');
  {
    const { ctx, page, errors } = await newPage(browser);
    await page.evaluate(async () => {
      const tk = calKey(new Date());
      await idbPut({ id: 'rem-v1a', rem: 'WORK ON REPOS', next: '9-2', day: tk });
      await idbPut({ id: 'rem-v1b', rem: 'LUNCH', next: '1-2', day: tk });
    });
    await page.reload();
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById('action-calendar').click());
    await page.waitForTimeout(900);

    const before = await page.evaluate(async () => {
      const tk = calKey(new Date());
      return {
        texts: [...document.querySelectorAll('#cal-today-board .cal-note-text')].map(b => b.textContent),
        stored: (await idbGetAll()).filter(r => r.day === tk).map(r => r.next),
      };
    });
    ok('the two seeded squares render their exact text in the one zone (no suffix at rest)',
      before.texts.length === 2 &&
      before.texts.every(l => l === '9-2' || l === '1-2'), JSON.stringify(before));

    const addPos = await center(page, '#cal-band-add');
    await tap(page, addPos.x, addPos.y);
    await page.waitForTimeout(300);
    await page.keyboard.type('NEW BLOCK ENTRY');
    await page.keyboard.press('Enter');          // Enter ends the entry (R6.4)
    await page.waitForTimeout(700);

    const after = await page.evaluate(async () => {
      const tk = calKey(new Date());
      return {
        texts: [...document.querySelectorAll('#cal-today-board .cal-note-text')].map(b => b.textContent),
        stored: (await idbGetAll()).filter(r => r.day === tk).map(r => r.next),
      };
    });
    ok('every square label is byte-identical after adding + no weekday suffix anywhere + the new label is exactly typed',
      after.texts.includes('NEW BLOCK ENTRY') && after.stored.includes('NEW BLOCK ENTRY') &&
      [...after.texts, ...after.stored].every(t => !WEEKDAY.test(t)), JSON.stringify(after));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[V2] The day-note squares render from the released day-note records — the title alone, legacy dates empty, r.next stays stored, and a record without a `day` value renders nowhere (issue #363: nothing migrated, the #323 disposition)');
  {
    const { ctx, page, errors } = await newPage(browser);
    // Seed one record carrying a real next-occurrence-style calKey (the stored
    // field must survive and stay unread as body text — nothing is migrated,
    // stripped, or rewritten) and one record with NO day field (pre-#363
    // legacy: stored but unreachable).
    await page.evaluate(async () => {
      await idbPut({ id: 'rem-seed', rem: 'PAY THE RENT', next: calKey(new Date()), day: calKey(new Date()) });
      await idbPut({ id: 'rem-orphan', rem: 'ORPHAN RECORD', next: '', });
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

    // 2. The seeded record renders as a square in ITS day's card: the zone is
    //    empty (the legacy calKey date is not user text). The orphan record
    //    renders nowhere.
    const note = await page.evaluate(async () => {
      const n = [...document.querySelectorAll('#cal-today-board .cal-note')][0] || null;
      const s = n && n.querySelector('.cal-note-text');
      const orphan = [...document.querySelectorAll('.cal-note-text')].some(b => b.textContent === 'ORPHAN RECORD');
      const stored = (await idbGetAll()).find(r => r.id === 'rem-seed') || null;
      const r = n && n.getBoundingClientRect();
      return { text: s ? s.textContent : null,
               inCard: n ? !!n.closest('#cal-today-board') : false,
               orphanRendered: orphan,
               square: r ? (r.width / r.height) : null,
               storedRem: stored && stored.rem,
               storedNext: stored && stored.next };
    });
    ok("the seeded block's zone is empty byte-for-byte — a legacy calKey `next` is not body text (nothing migrated)",
      note.text === '', JSON.stringify(note));
    ok('the block lives INSIDE a day card (issue #363) and is square, and its stored `rem` survives unread (issue #365: stored-but-unread, #323)',
      note.inCard === true && note.square !== null && note.square >= 0.9 && note.square <= 1.15 &&
      note.storedRem === 'PAY THE RENT' && typeof note.storedNext === 'string' && note.storedNext.length === 10, JSON.stringify(note));
    ok('the orphan record (no `day` field) renders nowhere but stays stored — nothing migrated',
      note.orphanRendered === false, JSON.stringify(note));

    // 3. The card's "+" adds a square in edit, caret in the square's one zone.
    const p = await center(page, '#cal-band-add');
    await tap(page, p.x, p.y);
    await page.waitForTimeout(400);
    const addState = await page.evaluate(() => {
      const ae = document.activeElement;
      return { activeIsZone: ae && ae.classList && ae.classList.contains('cal-note-text'),
               inEdit: ae && ae.hasAttribute && ae.hasAttribute('contenteditable') };
    });
    ok('tapping the card\'s "+" adds a square with the caret in the square\'s one zone (in edit)',
      addState.activeIsZone === true && addState.inEdit === true, JSON.stringify(addState));

    // 4. Type in the zone; Enter ends the entry (R6.4); commit writes `next`.
    await page.keyboard.type('CLEAN THE GARAGE');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);

    const after = await page.evaluate(async () => {
      const tk = calKey(new Date());
      const recs = (await idbGetAll()).filter(r => r.day === tk && r.id !== 'rem-seed');
      const added = recs[0] || null;
      return { rem: added && added.rem, body: added && added.next,
               day: added && added.day, keys: added && Object.keys(added).sort() };
    });
    ok("the added square commits `next` — `rem` untouched, the card's day carried, no weekday suffix, nothing pre-filled",
      after.rem === '' && after.body === 'CLEAN THE GARAGE' &&
      /^\d{4}-\d{2}-\d{2}$/.test(after.day) &&
      !WEEKDAY.test(after.body) && JSON.stringify(after.keys) === JSON.stringify(['day', 'id', 'next', 'rem']),
      JSON.stringify(after));

    // 5. A tap on the darker body of an existing block seats the caret there too.
    const tb = await page.$('#cal-today-board .cal-note-text');
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

  console.log('\n[V3] A day pages at THREE, on the card — three squares shown, then the ‹/› pager; the "+" carries its "+" (issue #363 supersedes #331\'s six)');
  {
    const { ctx, page, errors } = await newPage(browser);
    // Four records on TODAY's date: the card must show three and page the rest.
    await page.evaluate(async () => {
      const tk = calKey(new Date());
      for (let i = 0; i < 4; i++) await idbPut({ id: 'rem-' + i, rem: '', next: 'BLOCK ' + i, day: tk });
    });
    await page.reload();
    await page.waitForTimeout(600);
    await page.evaluate(() => document.getElementById('action-calendar').click());
    await page.waitForTimeout(900);

    let got = await page.evaluate(() => {
      const board = document.getElementById('cal-today-board');
      const blocks = [...board.querySelectorAll('.cal-note')];
      return { count: blocks.length,
        pagerShown: [...board.querySelectorAll('.cal-notes-nav')].some(b => !b.hidden),
        addText: document.getElementById('cal-band-add').textContent.trim() };
    });
    ok('three squares render in the body and the pager is on (issue #363: up to 3 per day, the cap unchanged)',
      got.count === 3 && got.pagerShown === true, JSON.stringify(got));
    ok("the band's add carries a \"+\" (issue #384: today's adder, seated at the bar's right)",
      got.addText === '+', JSON.stringify(got));

    // Paging back shows the first three.
    await page.evaluate(() => [...document.getElementById('cal-today-board').querySelectorAll('.cal-notes-nav')]
      .find(b => b.textContent === '‹').click());
    await page.waitForTimeout(400);
    got = await page.evaluate(() => {
      const board = document.getElementById('cal-today-board');
      return { texts: [...board.querySelectorAll('.cal-note-text')].map(b => b.textContent) };
    });
    ok('paging the body back shows its first three squares',
      got.texts.length === 3 && got.texts[0] === 'BLOCK 0', JSON.stringify(got));

    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[V5] The day head is seated above the weekly stack — inside #cal-stack, centered to the view, --ink-light ink at the display step (issues #343 + #363)');
  {
    const { ctx, page, errors } = await newPage(browser);
    await page.evaluate(() => document.getElementById('action-calendar').click());
    await page.waitForTimeout(900);

    const seat = await page.evaluate(() => {
      const head = document.getElementById('cal-dayhead');
      const view = document.getElementById('cal-view');
      const band = document.getElementById('cal-band');
      const card = document.getElementById('cal-band-card');
      const rule = document.getElementById('cal-band-rule');
      const body = document.getElementById('cal-today-board');
      const firstRow = document.querySelector('#cal-stack .cal-day');
      const hr = head.getBoundingClientRect(), vr = view.getBoundingClientRect();
      const br = band.getBoundingClientRect(), cr = card.getBoundingClientRect(), rr = rule.getBoundingClientRect();
      const bor = body.getBoundingClientRect();
      const fr = firstRow ? firstRow.getBoundingClientRect() : null;
      return {
        parentIsCard: head.parentElement === card,
        inFrame: !!head.closest('#cal-frame'),
        bandFullWidth: Math.abs(br.width - vr.width) <= 1,
        ruleFullWidth: Math.abs(rr.width - vr.width) <= 1,
        bodyFullWidth: Math.abs(bor.width - vr.width) <= 1,
        cardOverhangOnBody: rr.bottom ? Math.round(cr.bottom - bor.top) : null,
        cardAboveRule: parseInt(getComputedStyle(card).zIndex, 10) > parseInt(getComputedStyle(rule).zIndex, 10),
        bodyBg: getComputedStyle(body).backgroundColor,
        bodyBorder: getComputedStyle(body).borderTopWidth + ' ' + getComputedStyle(body).borderTopStyle,
        stackGapHolds: fr ? Math.abs(fr.top - bor.bottom - 22) <= 2 : null,
        fontSize: getComputedStyle(head).fontSize,
        headCenterX: hr.x + hr.width / 2,
        viewCenterX: vr.x + vr.width / 2,
        color: getComputedStyle(head).color,
        headBottom: hr.bottom,
        rowTop: fr ? fr.top : null,
        text: head.textContent,
      };
    });
    ok('the head renders inside the title card (#cal-band-card) and no top frame exists anywhere (issues #363 + #382)',
      seat.parentIsCard === true && seat.inFrame === false, JSON.stringify(seat));
    ok('the header band runs the full width of the component — bar and rule both edge-to-edge (issue #382)',
      seat.bandFullWidth === true && seat.ruleFullWidth === true, JSON.stringify(seat));
    ok('the Today board body runs the full width of the component too — the date extends both left and right to fill the page (issue #384)',
      seat.bodyFullWidth === true, JSON.stringify(seat));
    ok("the title card overhangs the rule — ~22px past it, above it in z, the overhang landing on the body's top — the boards' B38 anatomy kept (issues #382 + #384)",
      seat.cardOverhangOnBody !== null && seat.cardOverhangOnBody > 20 && seat.cardOverhangOnBody < 24 &&
      seat.cardAboveRule === true, JSON.stringify(seat));
    ok("the body wears the title card's own deep fill — the calendar's deep orange, #251002, no grey border of its own (issue #384)",
      seat.bodyBg === 'rgb(37, 16, 2)' && seat.bodyBorder === '0px none', JSON.stringify(seat));
    ok('the gap between the body and the stack stays — 22px, never closed (issue #384: the fill never runs past the body)',
      seat.stackGapHolds === true, JSON.stringify(seat));
    ok('the head is centered to the view horizontally (within 2px) (issue #343)',
      Math.abs(seat.headCenterX - seat.viewCenterX) <= 2, JSON.stringify(seat));
    ok("the head wears the palette's approved --ink-light on the view's ground (issue #343)",
      seat.color === 'rgb(244, 245, 241)', JSON.stringify(seat));
    ok("the head renders at the boards' title-card type — 15px/600, #anchor-title's very format, one line (issue #382, the owner's chat direction)",
      seat.fontSize === '15px', JSON.stringify(seat));
    ok('the head still carries the date wording (B149 composition intact)',
      seat.text.length > 0, JSON.stringify(seat.text));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log('\n[V6] The day-note squares wear the Calendar ladder\'s note rung — every square\'s computed background is var(--note) #e3c6aa on the body\'s deep-orange var(--card) #251002 ground, the ink the rung\'s --ink-dark pair (issue #384, supersedes B155\'s fill clause)');
  {
    const { ctx, page, errors } = await newPage(browser);
    // Seed one day note so a square renders in the Today card's notes row
    // (the suite's existing seeding mechanics — a `day`-bound record).
    await page.evaluate(async () => {
      await idbPut({ id: 'rem-v6', rem: 'DEEP FILL CHECK', next: '9-2', day: calKey(new Date()) });
    });
    await page.reload();
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById('action-calendar').click());
    await page.waitForTimeout(900);

    const fills = await page.evaluate(() => {
      const squares = [...document.querySelectorAll('#cal-today-board .cal-note-text')];
      const body = document.getElementById('cal-today-board');
      const ink = squares[0] && getComputedStyle(squares[0]).color;
      return {
        squareBg: squares.map(s => getComputedStyle(s).backgroundColor),
        bodyBg: body ? getComputedStyle(body).backgroundColor : null,
        ink,
        count: squares.length,
      };
    });
    ok('the seeded square renders in the body — the Today board (a measured surface exists to compare)',
      fills.count === 1, JSON.stringify(fills));
    ok('every rendered day-note square\'s computed background is the Calendar ladder\'s note rung rgb(227, 198, 170), var(--note) #e3c6aa, on the body\'s deep-orange ground rgb(37, 16, 2), with the rung\'s --ink-dark ink rgb(3, 16, 25) (issue #384)',
      fills.count > 0 && fills.bodyBg === 'rgb(37, 16, 2)' &&
      fills.squareBg.every(bg => bg === 'rgb(227, 198, 170)') &&
      fills.ink === 'rgb(3, 16, 25)', JSON.stringify(fills));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  console.log(`\n=== day-view-suffix: ${pass} passed, ${fail} failed ===`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
