/* The shipped security contract, falsifiable (issue #369; audit #246 finding 1
 * is the origin of the shipped CSP): the policy lives in index.html's
 * <meta http-equiv="Content-Security-Policy"> because GitHub Pages cannot send
 * custom response headers and frame-ancestors is ignored inside a meta CSP
 * (B125's recorded ceiling) — so the meta tag IS the delivery mechanism, and
 * it must not silently regress. A hand-edited inline script, an on*= handler,
 * or an eval reintroduced into the shipped JS would each break the policy the
 * meta declares, or be broken by it. This is the guard that catches those
 * before merge.
 *
 * Node-only, no browser, no dependencies — same shape as test/records.js.
 *
 * Run: node test/security.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const ok = (n, c, extra) => {
  c ? (pass++, console.log('  PASS ' + n))
    : (fail++, console.log('  FAIL ' + n + (extra ? ' :: ' + extra : '')));
};

const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// [1] The CSP meta ships, and every directive the shipped code justifies is present.
console.log('\n[1] index.html — the CSP meta tag');
const cspMeta = index.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
ok('the CSP meta tag is present', !!cspMeta);
const csp = cspMeta ? cspMeta[1] : '';
for (const directive of [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "require-trusted-types-for 'script'",   // issue #374: DOM XSS sinks throw without a TrustedHTML
]) {
  ok(`declares ${directive}`, csp.includes(directive));
}

// [2] The policy the meta declares is backed by the markup: zero inline scripts,
//     zero on*= handlers, one external module script.
console.log('\n[2] index.html — the markup honours the policy');
const inlineScripts = [...index.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)];
ok('zero inline <script> blocks (script-src \'self\' must not need an unsafe-inline escape)', inlineScripts.length === 0,
  inlineScripts.map(m => m[0]).join(' | '));
const handlers = [...index.matchAll(/\son[a-z]+\s*=\s*["'`]/gi)];
ok('zero on*= event handlers', handlers.length === 0,
  handlers.map(m => m[0].trim()).join(' | '));
const scripts = [...index.matchAll(/<script\b[^>]*\bsrc=([^>\s]+)[^>]*>/g)].map(m => m[0]);
ok('every script loads from a file (external, auditable)', scripts.length > 0 && scripts.every(s => /^<script\b[^>]*src="(?!https?:|data:|\/\/)/.test(s)),
  scripts.join(' | '));

// [3] The shipped JS keeps the policy satisfiable: no eval, no new Function.
//     (The strings below are detection regexes over shipped files, not calls.)
console.log('\n[3] Shipped JS — no eval surface');
const shipped = ['app.js', 'boards.js', 'export.js', 'geometry.js', 'interactions.js',
  'menus.js', 'persistence.js', 'render.js', 'state.js', 'sw.js'];
const offenders = [];
for (const file of shipped) {
  const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
  // Strip comments first: shipped prose may name eval("not eval(): CSP forbids
  // it") without calling it — only real call sites violate the policy.
  const text = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/gm, '$1');
  for (const m of text.matchAll(/\beval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*["'`]|setInterval\s*\(\s*["'`]/g)) {
    offenders.push(`${file}: ${m[0]}`);
  }
}
ok('no eval(), new Function(), or string-form timers in shipped JS', offenders.length === 0,
  offenders.join(' | '));

// [4] The directive the meta declares is backed by the shipped JS: the default
//     Trusted Types policy (issue #374) is created before boot(), whose first
//     render is the first sink write. Without it every GLYPH innerHTML
//     assignment throws on engines that enforce the directive.
console.log('\n[4] app.js — the Trusted Types default policy');
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const policySite = app.indexOf("trustedTypes.createPolicy('default'");
const bootCall = app.indexOf('boot();');
ok("the default Trusted Types policy is created in app.js", policySite !== -1);
ok("the policy covers both sink kinds: createHTML (the GLYPH sinks) and createScriptURL (the 'sw.js' registration)",
  policySite !== -1 && /createScriptURL/.test(app));
ok('the policy is created before boot() (the first sink write is boot\'s first render)',
  policySite !== -1 && bootCall !== -1 && policySite < bootCall);

// [5] The service worker's CACHE version stamp moves with shipped-byte changes
//     is asserted by sw-update.js's own discipline; here only that the stamp
//     still names the zeved-boards prefix (B121's identity ruling).
console.log('\n[5] sw.js — the cache namespace');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
ok("CACHE is version-stamped as zeved-boards-v*", /const CACHE = 'zeved-boards-v\d+'/.test(sw));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);