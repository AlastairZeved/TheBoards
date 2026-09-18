// Narrow-embed overflow regression (issue #266).
//
// The site embeds a live preview in a frame the owner sizes (~260 CSS px).
// At those widths the mobile board-action row (All / Export / Import /
// Calendar) used to overflow the right edge and clip mid-button: the row is
// absolute with left:0 right:0 but its four nowrap tabs did not wrap. The fix
// wraps the row in the mobile path (html:not(.wide)) only — desktop keeps one
// line. This suite enumerates EVERY element's bounding rect at the narrow
// viewports and asserts none extends past the document's clientWidth, in
// embed mobile; plus one desktop-embed assertion that the row still does not
// wrap (the fix must not leak into the desktop grammar).
//
// Run: NODE_PATH=<playwright> node test/overflow.js  (serve the repo root on 8000)

const { chromium } = require('playwright');
const BASE = process.env.BOARDS_URL || 'http://localhost:8000/index.html';

let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? (pass++, console.log('  PASS ' + n)) : (fail++, console.log('  FAIL ' + n + (extra ? ' :: ' + extra : ''))); };

// Every element, measured like the bug was: getBoundingClientRect against
// clientWidth. Tolerance 0.5px for subpixel rounding.
const overflowing = () => {
  const cw = document.documentElement.clientWidth, out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > cw + 0.5 || r.left < -0.5))
      out.push(el.tagName + '.' + el.className + ' right=' + r.right.toFixed(1) + ' left=' + r.left.toFixed(1));
  }
  return out;
};

(async () => {
  const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
  const browser = await chromium.launch(launchOpts);

  // 1. Zero overflow at the narrow embed viewports, mobile.
  for (const [w, h] of [[260, 549], [286, 604], [320, 700], [380, 740]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(BASE + '?embed=1&mode=mobile');
    await page.waitForTimeout(600);
    const bad = await page.evaluate(overflowing);
    ok(`embed mobile ${w}x${h}: no element exceeds clientWidth`, bad.length === 0, bad.join(' | '));
    await ctx.close();
  }

  // 2. Desktop grammar untouched: embed desktop at a narrow width keeps the
  //    row on ONE line (no wrap — all tabs share the same offsetTop).
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 700 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '?embed=1&mode=desktop');
    await page.waitForTimeout(600);
    const tops = await page.evaluate(() =>
      [...document.querySelectorAll('#board-actions .board-action')].map(b => b.offsetTop));
    ok('embed desktop: board-action row stays on one line (desktop grammar untouched)',
      new Set(tops).size === 1, 'offsetTops=' + tops.join(','));
    await ctx.close();
  }

  await browser.close();
  console.log(`\noverflow.js: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
