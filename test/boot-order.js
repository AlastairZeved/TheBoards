// Boot-order characterization guard (issue #182).
//
// The phase-2 module split (issue #182) re-homes app.js's sections into native
// ES modules. ES import evaluation is hoisted and ordered by the import graph,
// not by source position — so a careless split can silently reorder boot's
// load-bearing sequence (layout -> idb -> migrate -> open -> pane/rail; see the
// boot() header comment and B93). That sequence had NO test. This is it.
//
// boot() emits one console.debug marker synchronously immediately before each
// step. This suite asserts the markers arrive in the fixed order. It must pass
// UNCHANGED before the split (on the single-file build) and after every commit
// of the split. If it ever fails, a module boundary reordered boot — stop.
//
// Black-box by ruling: we observe console output from a real page load, we do
// not import module internals.

const { URL, ok, summary, launch, tap, tapWithMove, touchDragTo, newMobilePage, newDesktopPage, waitBoard, withErrors, run } = require('./lib');


const EXPECTED = ['boot:layout', 'boot:idb', 'boot:migrate', 'boot:open', 'boot:pane-rail'];

async function bootMarkers(browser, viewport) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  const markers = [];
  const errors = [];
  // console.debug surfaces as message type 'debug' in Playwright.
  page.on('console', m => { if (m.type() === 'debug' && m.text().startsWith('boot:')) markers.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(URL);
  await page.waitForTimeout(600);
  await ctx.close();
  return { markers, errors };
}

run(async () => {
  const browser = await launch();

  console.log('\n[B1] Wide (desktop) boot emits every step marker in order');
  {
    const { markers, errors } = await bootMarkers(browser, { width: 1440, height: 900 });
    ok('all five markers present', markers.length === EXPECTED.length, 'saw=' + JSON.stringify(markers));
    ok('markers in exact boot order', JSON.stringify(markers) === JSON.stringify(EXPECTED), 'saw=' + JSON.stringify(markers));
    ok('no page errors', errors.length === 0, errors.join(' | '));
  }

  console.log('\n[B2] Mobile boot emits the same ordered prefix (pane/rail step still fires its marker)');
  {
    const { markers, errors } = await bootMarkers(browser, { width: 390, height: 844 });
    // The pane-rail MARKER is emitted before the isWide guard, so it fires on
    // mobile too even though renderPane()/showCalRail() do not run there. The
    // guard pins ORDER of the marker sequence, not which branches execute.
    ok('all five markers present on mobile', markers.length === EXPECTED.length, 'saw=' + JSON.stringify(markers));
    ok('markers in exact boot order on mobile', JSON.stringify(markers) === JSON.stringify(EXPECTED), 'saw=' + JSON.stringify(markers));
    ok('no page errors', errors.length === 0, errors.join(' | '));
  }

  await browser.close();

});
