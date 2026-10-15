'use strict';

const URL = process.env.BOARDS_URL || 'http://localhost:8000/index.html';
let pass = 0;
let fail = 0;

function ok(name, condition, extra) {
  condition ? (pass++, console.log('  PASS ' + name))
    : (fail++, console.log('  FAIL ' + name + (extra ? ' :: ' + extra : '')));
}

function summary(name) {
  console.log(`\n=== ${name}: ${pass} passed, ${fail} failed ===`);
  return fail;
}

function launch() {
  const { chromium } = require('playwright');
  const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
  return chromium.launch(launchOpts);
}

async function tap(page, x, y, holdMs = 30) {
  const c = await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(holdMs);
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await c.detach();
}

async function tapWithMove(page, x, y, dx, dy) {
  const c = await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(20);
  await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx, y: y + dy }] });
  await page.waitForTimeout(20);
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await c.detach();
}

async function touchDragTo(page, from, to, steps = 8) {
  const c = await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  await page.waitForTimeout(20);
  for (let i = 1; i <= steps; i++) {
    const x = from.x + (to.x - from.x) * i / steps;
    const y = from.y + (to.y - from.y) * i / steps;
    await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await page.waitForTimeout(15);
  }
  await page.waitForTimeout(60);
  return c;
}

async function waitBoard(page) {
  await page.waitForFunction(() => !!document.querySelector('#board'));
}

function withErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return errors;
}

async function newMobilePage(browser, viewport = { width: 384, height: 846 }, ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 3, acceptDownloads: true, ...ctxOpts });
  const page = await ctx.newPage();
  const errors = withErrors(page);
  await page.goto(URL);
  await waitBoard(page);
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}

async function newDesktopPage(browser, viewport = { width: 1440, height: 900 }, ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true, ...ctxOpts });
  const page = await ctx.newPage();
  const errors = withErrors(page);
  await page.goto(URL);
  await page.waitForTimeout(400);
  return { ctx, page, errors };
}

async function run(main) {
  const name = require.main?.filename?.split('/').pop()?.replace(/\.js$/, '') || 'test';
  try {
    await main();
  } catch (error) {
    console.error('FATAL', error);
    fail++;
  } finally {
    process.exitCode = summary(name) ? 1 : 0;
  }
}

module.exports = { URL, ok, summary, launch, tap, tapWithMove, touchDragTo, newMobilePage, newDesktopPage, waitBoard, withErrors, run };
