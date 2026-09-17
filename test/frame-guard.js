// Frame-guard regression (B125, Zezed site #5).
//
// The app may be framed only by its own origin or https://alastairzeved.com;
// any other framing origin blanks the document and aborts boot (no IndexedDB).
// Browsers without window.location.ancestorOrigins default-ALLOW (B125).
//
// Run: NODE_PATH=<playwright> node test/frame-guard.js
//      (serve the repo root on 8000; the suite serves its own cross-origin
//       parent page on 9999)

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BOARDS_URL || 'http://localhost:8000/index.html';
const GUARD_PORT = 9999;

let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? (pass++, console.log('  PASS ' + n)) : (fail++, console.log('  FAIL ' + n + (extra ? ' :: ' + extra : ''))); };

// Minimal parent page on a second origin: iframes the app served on 8000.
const PARENT = '<!doctype html><body style="margin:0"><iframe id="f" src="' + BASE + '?embed=1&mode=mobile" style="width:390px;height:844px;border:0"></iframe></body>';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(PARENT);
});

(async () => {
  await new Promise((r) => server.listen(GUARD_PORT, r));
  const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
  const browser = await chromium.launch(launchOpts);

  // (a) Same-origin iframe embed → app loads normally.
  {
    const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(BASE);                       // parent = the app's own origin
    await page.evaluate((src) => {
      const f = document.createElement('iframe');
      f.id = 'f'; f.style.cssText = 'width:390px;height:844px;border:0';
      f.src = src; document.body.appendChild(f);
    }, BASE + '?embed=1&mode=mobile');
    await page.waitForTimeout(1000);
    const frame = await (await page.$('#f')).contentFrame();
    ok('same-origin iframe: app boots (non-empty document in frame)',
      await frame.evaluate(() => document.documentElement.textContent.length > 0));
    await ctx.close();
  }

  // (b) Cross-origin parent (http://localhost:9999) → document blanked, no IDB.
  {
    const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto('http://localhost:' + GUARD_PORT + '/parent.html');
    await page.waitForTimeout(1200);
    // The guard's throw in the cross-origin child surfaces as a pageerror.
    ok('cross-origin embed: guard threw (frame-guard pageerror in child)',
      errors.some((e) => e.includes('frame-guard')), errors.join(' | ') || 'none');
    // Child-side proof via CDP-backed frame evaluation: html fully blanked.
    const frame = page.frames().find(f => f !== page.mainFrame());
    ok('cross-origin embed: child document blanked',
      await frame.evaluate(() => document.documentElement.textContent === ''));
    await ctx.close();
  }

  // (b2) Child-side proof: serve the app itself and check the guard's inputs
  //      — no IndexedDB opened in a denied embed. Use the boot-marker channel:
  //      a denied boot emits NO boot: markers.
  {
    const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
    const page = await ctx.newPage();
    const markers = [];
    page.on('console', m => { if (m.type() === 'debug' && m.text().startsWith('boot:')) markers.push(m.text()); });
    await page.goto('http://localhost:' + GUARD_PORT + '/parent.html');
    await page.waitForTimeout(1200);
    ok('cross-origin embed: boot never reaches its first step (no boot: markers)',
      markers.length === 0, JSON.stringify(markers));
    await ctx.close();
  }

  // (c) Top-level load (not framed) → guard inert, app boots.
  {
    const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(800);
    ok('top-level load: app boots normally (non-empty document)',
      await page.evaluate(() => document.documentElement.textContent.length > 0));
    await ctx.close();
  }

  // (d) Allow-list is EXACT origin matching — https://alastairzeved.com, not a
  //     prefix/substring match. Static assertion on the shipped guard source:
  //     it must compare full origins (indexOf on an exact-strings list) and
  //     must not use startsWith/includes/prefix logic on origins.
  {
    const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const guard = src.slice(src.indexOf('function frameGuard'), src.indexOf('frameGuard();'));
    ok('allow-list contains the exact origin https://alastairzeved.com',
      guard.includes("'https://alastairzeved.com'") && !guard.includes('alastairzeved.com/'));
    ok('guard compares full origins only (no startsWith/includes/regex on the origin)',
      !/startsWith|\.includes\(|match\(|test\(/.test(guard.replace(/\/\/[^\n]*/g, '')));
    ok('same-origin is allowed via window.location.origin (not a hard-coded host)',
      guard.includes('window.location.origin'));
    ok('denial blanks the document and aborts the module (throw)',
      guard.includes("document.documentElement.textContent = ''") && /throw\s+new\s+Error/.test(guard));
  }

  await browser.close();
  server.close();
  console.log('\nframe-guard: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
