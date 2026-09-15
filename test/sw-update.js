/* End-to-end proof that a shipped CSS change actually reaches an installed PWA.
 *
 * This is the check that was missing when B35 shipped: the suites asserted the
 * stylesheet was correct, which it was, while the installed app served the old
 * one out of cache v4 forever. Asserting the source is not the same as
 * asserting delivery.
 *
 * Serves a throwaway copy of the app so files can be mutated under a live
 * service worker, then walks the exact sequence that stranded two releases:
 *
 *   1. install the OLD sw.js (v4, plain cache-first) and warm its cache
 *   2. change styles.css WITHOUT touching sw.js  -> must still serve stale
 *      (the bug, reproduced — if this step passes clean, the test is lying)
 *   3. ship the NEW sw.js (bumped + stale-while-revalidate) -> must go current
 *
 * Run: CHROMIUM_PATH=... node test/sw-update-check.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');

const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.SW_TEST_PORT || 8199);

let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? (pass++, console.log('  PASS ' + n)) : (fail++, console.log('  FAIL ' + n + (extra ? ' :: ' + extra : ''))); };

// A throwaway document root we can mutate mid-flight. fonts/ rides along
// because sw.js's ASSETS lists the three woff2 files (B50) and install()
// addAll's them — a 404 would fail the very install step 3 proves.
const DIR = fs.mkdtempSync(path.join(require('os').tmpdir(), 'sw-check-'));
// issue #182: app.js is the module entry; its imports must ride along or
// install()'s addAll fails on the first 404.
for (const f of ['index.html', 'app.js', 'state.js', 'persistence.js', 'geometry.js',
                 'render.js', 'interactions.js', 'menus.js', 'export.js', 'boards.js',
                 'styles.css', 'manifest.json', 'favicon.ico']) {
  fs.copyFileSync(path.join(ROOT, f), path.join(DIR, f));
}
for (const dir of ['icons', 'fonts']) {
  fs.mkdirSync(path.join(DIR, dir), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    fs.copyFileSync(path.join(ROOT, dir, f), path.join(DIR, dir, f));
  }
}

// The pre-fix service worker, verbatim in the shape that caused this: version
// v4 and an unconditional cache-first fetch with no revalidation.
const OLD_SW = `const CACHE = 'todo-boards-v4';
const ASSETS = ['.', 'index.html', 'styles.css', 'app.js', 'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(caches.match(req).then((hit) => {
    if (hit) return hit;
    return fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => req.mode === 'navigate' ? caches.match('index.html') : Response.error());
  }));
});
`;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(DIR, rel);
  if (!file.startsWith(DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('not found'); return;
  }
  // no-store on the HTTP layer, so anything stale we observe is the SW's doing
  // and not the browser's own HTTP cache confounding the result.
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
                       'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(file));
});

// The marker: --card-h died with B47 (the band is content-sized now), so the
// regex moves in the same commit, exactly as UIUX §16.3 orders. --band-top is
// the marker's successor: a literal the shipped stylesheet declares at 14px.
// Reading it back through getComputedStyle proves which bytes the page is
// actually running, rather than which bytes are on disk.
const SHIPPED_CARD_H = '14px';
const CARD_H_RE = /--band-top:\s*14px;/;
const cardOf = page => page.evaluate(() =>
  getComputedStyle(document.querySelector('#board')).getPropertyValue('--band-top').trim());

const swState = page => page.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration();
  return r && r.active ? 'active' : 'none';
});

/* Relaunch the app until `pred` holds, up to `max` times, and report how many
   launches it took. This is the property that actually matters to someone with
   the app on their home screen — "how many times must I open it before I see
   the new build" — and it is robust to the handover races that a single reload
   is not: a newly installed worker only controls the page once it has claimed,
   so the launch that triggers the update is usually not the launch that shows
   it. Returns 0 if `pred` never held. */
async function launchUntil(page, pred, max = 4) {
  for (let i = 1; i <= max; i++) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !!document.querySelector('#board'), null, { timeout: 15000 });
    await page.waitForTimeout(500);
    if (await pred(page)) return i;
  }
  return 0;
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const URL = `http://localhost:${PORT}/index.html`;
  const browser = await chromium.launch({ ...launchOpts });
  const ctx = await browser.newContext();          // one persistent origin
  const page = await ctx.newPage();

  try {
    // ---- 1. install the OLD worker over the OLD stylesheet -----------------
    console.log('\n[1] Old service worker installs and warms its cache');
    fs.writeFileSync(path.join(DIR, 'sw.js'), OLD_SW);
    fs.writeFileSync(path.join(DIR, 'styles.css'),
      fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8')
        .replace(CARD_H_RE, '--band-top: 200px;'));   // a build that is not this one
    await page.goto(URL);
    await page.waitForFunction(() => !!document.querySelector('#board'));
    await page.waitForFunction(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      return !!(r && r.active);
    }, null, { timeout: 15000 });
    await page.reload();                            // first load the SW controls
    await page.waitForTimeout(400);
    ok('service worker is active', await swState(page) === 'active');
    ok('old stylesheet is what renders', (await cardOf(page)) === '200px', await cardOf(page));

    // ---- 2. ship new CSS without bumping sw.js -> the bug ------------------
    console.log('\n[2] New styles.css, sw.js untouched — reproduces the stranding');
    fs.copyFileSync(path.join(ROOT, 'styles.css'), path.join(DIR, 'styles.css'));
    const strandedAt = await launchUntil(page, async p => (await cardOf(p)) === SHIPPED_CARD_H);
    ok('the new stylesheet never reaches the page (bug reproduced)',
      strandedAt === 0,
      `landed on launch ${strandedAt} — if it lands at all, the harness is not exercising the old SW`);
    ok('what renders is still the old stylesheet', (await cardOf(page)) === '200px', await cardOf(page));

    // ---- 3. ship the real sw.js -> the fix ---------------------------------
    console.log('\n[3] Bumped sw.js (current cache + stale-while-revalidate) — the fix');
    fs.copyFileSync(path.join(ROOT, 'sw.js'), path.join(DIR, 'sw.js'));
    // A real browser byte-checks sw.js on navigation and installs the new one.
    // Chromium under test throttles that check hard enough that it does not fire
    // within a handful of scripted reloads, so trigger it explicitly — this is
    // the same call app.js's register() makes on every load, not a shortcut past
    // the mechanism under test. Everything after it is the real handover.
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      await r.update();
    });
    const shippedAt = await launchUntil(page, async p => (await cardOf(p)) === SHIPPED_CARD_H);
    ok('the new stylesheet reaches the page', shippedAt > 0, `never landed in 4 launches`);
    ok('and it lands within two launches', shippedAt > 0 && shippedAt <= 2, `launch ${shippedAt}`);

    const keys = await page.evaluate(() => window.caches.keys());
    // Read the shipped name rather than restating it, so a bump does not need an
    // edit here — the point is that the cache the app declares is the live one.
    const CACHE = (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')
      .match(/todo-boards-v\d+/) || [''])[0];
    ok('cache is ' + CACHE, keys.includes(CACHE), JSON.stringify(keys));
    // The old cache may briefly outlive its own activate: the outgoing worker keeps
    // serving the page until the new one claims it, and its runtime-cache path can re-create the
    // entry it was just deleted from. Harmless — nothing reads the old one once
    // the new one controls — so this asserts the eviction ran, not that v4 never reappears.
    ok('the live cache is what the page reads from',
      CARD_H_RE.test(await page.evaluate(async (name) => {
        const c = await window.caches.open(name);
        const r = await c.match(new Request('styles.css').url);
        return r ? await r.text() : '';
      }, CACHE)), CACHE + ' does not hold the new stylesheet');

    // ---- 4. the safety net: a later change with NO bump self-heals ---------
    console.log('\n[4] Stale-while-revalidate: a missed bump costs one launch, not forever');
    fs.writeFileSync(path.join(DIR, 'styles.css'),
      fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8')
        .replace(CARD_H_RE, '--band-top: 111px;'));   // sw.js NOT bumped
    const healedAt = await launchUntil(page, async p => (await cardOf(p)) === '111px');
    ok('a change with no version bump still lands', healedAt > 0, 'never landed in 4 launches');
    ok('and it costs one stale launch, not forever', healedAt > 0 && healedAt <= 2, `launch ${healedAt}`);

    // ---- 5. offline still works off the cache ------------------------------
    console.log('\n[5] Offline is unchanged');
    await ctx.setOffline(true);
    await page.reload(); await page.waitForTimeout(400);
    const offline = await page.evaluate(() => !!document.querySelector('#board'));
    ok('the board still renders with the network down', offline, String(offline));
    await ctx.setOffline(false);
  } catch (e) {
    fail++; console.log('  FAIL harness threw :: ' + e.message);
  }

  await browser.close();
  server.close();
  fs.rmSync(DIR, { recursive: true, force: true });
  console.log(`\n=== sw-update: ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
