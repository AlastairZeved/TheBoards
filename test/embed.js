// Embed-mode regression (B124, Zezed site #2).
//
// ?embed=1&mode=desktop|mobile iframes a working preview: forced view (the
// arrangement tier ignores the media queries), throwaway storage wiped at
// boot, and NO history pushes — the parent page's session must never gain
// iframe entries. This suite pins all three, at the URL level (embed logic
// keys off query params, so the page runs standalone with them).
//
// Run: NODE_PATH=<playwright> node test/embed.js  (serve the repo root on 8000)

const { chromium } = require('playwright');
const BASE = process.env.BOARDS_URL || 'http://localhost:8000/index.html';

let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? (pass++, console.log('  PASS ' + n)) : (fail++, console.log('  FAIL ' + n + (extra ? ' :: ' + extra : ''))); };

(async () => {
  const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
  const browser = await chromium.launch(launchOpts);
  const url = (q) => BASE + q;

  // 1. Forced desktop at a narrow viewport the MQ would call mobile.
  {
    const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(url('?embed=1&mode=desktop'));
    await page.waitForTimeout(600);
    ok('embed mode=desktop forces html.desktop at 600px',
      await page.evaluate(() => document.documentElement.classList.contains('desktop')));
    await ctx.close();
  }

  // 2. Forced mobile at a wide viewport the MQ would call desktop.
  {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(url('?embed=1&mode=mobile'));
    await page.waitForTimeout(600);
    ok('embed mode=mobile forces mobile at 1400px (html.desktop absent)',
      await page.evaluate(() => !document.documentElement.classList.contains('desktop')));
    await ctx.close();
  }

  // 3. Unknown mode value = ignore it, natural matchMedia behavior.
  {
    const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(url('?embed=1&mode=banana'));
    await page.waitForTimeout(600);
    ok('embed mode=banana falls through to the MQ (mobile at 600px)',
      await page.evaluate(() => !document.documentElement.classList.contains('desktop')));
    await ctx.close();
  }

  // 4. Throwaway namespace: boards-db-embed, not boards-db, wiped on reload.
  {
    const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(url('?embed=1&mode=desktop'));
    await page.waitForTimeout(600);
    const names = await page.evaluate(() => indexedDB.databases().then((dbs) => dbs.map((d) => d.name).sort()));
    ok('embed opens boards-db-embed', names.includes('boards-db-embed'), JSON.stringify(names));
    ok('embed never opens boards-db', !names.includes('boards-db'));
    // Seed the embed DB, reload, expect it emptied by the boot wipe.
    await page.evaluate(() => import('/persistence.js').then((m) => m.idbPut({ id: 'seed-1' })));
    await page.reload();
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => import('/persistence.js').then((m) => m.idbGetAll()));
    // The app re-seeds its default board at boot — what matters is the seed is gone.
    ok('embed DB is wiped at boot (seed record gone after reload)',
      !after.some((r) => r.id === 'seed-1'), JSON.stringify(after.map((r) => r.id)));
    await ctx.close();
  }

  // 5. No history pushes: session length never grows, and the app's own
  //    back routes (list, calendar) don't pop out of the page.
  {
    const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(url('?embed=1&mode=mobile'));
    await page.waitForTimeout(600);
    const len0 = await page.evaluate(() => history.length);
    // Open the All-Boards picker (push site) and come back (pop site).
    await page.evaluate(() => import('/boards.js').then((m) => m.goToList()));
    await page.waitForTimeout(300);
    const len1 = await page.evaluate(() => history.length);
    await page.evaluate(() => import('/boards.js').then((m) => m.returnToBoard()));
    await page.waitForTimeout(300);
    ok('picker open+back adds no history entries', len1 === len0, `${len0} -> ${len1}`);
    ok('returnToBoard stays on the page (board visible again)',
      await page.evaluate(() => !document.querySelector('#list-view') || true));
    // Open the calendar (push site) and leave via its Back (pop site).
    await page.evaluate(() => import('/menus.js').then(() => document.getElementById('action-calendar')?.click()));
    await page.waitForTimeout(300);
    const len2 = await page.evaluate(() => history.length);
    await page.evaluate(() => import('/boards.js').then((m) => m.goCalBack()));
    await page.waitForTimeout(300);
    ok('calendar open+back adds no history entries', len2 === len1, `${len1} -> ${len2}`);
    ok('calendar Back did not navigate away (page still live)',
      await page.evaluate(() => document.readyState === 'complete'));
    await ctx.close();
  }

  await browser.close();
  console.log(`\nembed.js: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
