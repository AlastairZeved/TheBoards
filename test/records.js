/* The ruling file's numbering contract, falsifiable (AGENTS.md, record law;
 * issue #272): `docs/DECISIONS.md` is append-only and its `### B<n>` headings
 * are the citation space every other document cites by number. One number
 * shipped twice — the calendar-rail ruling (issue #248) and then the
 * reminder-glow ruling (issue #270, PR #271) — so every reader of the second
 * entry's number landed on the first. This is the guard that cannot recur: a
 * duplicate number, an out-of-order append, or a renumbered-away glow entry
 * fails the build.
 *
 * Node-only, no browser, no dependencies — same shape as test/tokens.js.
 *
 * Run: node test/records.js
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

const README = 'docs/DECISIONS.md';
let text = '';
try { text = fs.readFileSync(path.join(ROOT, README), 'utf8'); } catch (e) { /* asserted below */ }
const lines = text.split('\n');

// The heading space: `### B<n>.` at column 0. The number is the citation.
const headings = [...text.matchAll(/^### B(\d+)\./gm)].map(m => Number(m[1]));

console.log(`\n[1] ${README} — ${headings.length} headings, one number each`);
{
  const seen = new Map();
  const dupes = [];
  for (const n of headings) {
    if (seen.has(n)) dupes.push('B' + n);
    seen.set(n, true);
  }
  ok('no `### B<n>` number is used twice', dupes.length === 0, dupes.join(', '));
}

console.log('\n[2] The headings ascend — the file is append-only, so the number only grows');
{
  const breaks = headings
    .map((n, i) => (i && n <= headings[i - 1] ? `B${headings[i - 1]} → B${n}` : null))
    .filter(Boolean);
  ok('the headings are numerically ascending', breaks.length === 0, breaks.join(', '));
}

console.log('\n[3] The reminder-glow ruling is B132 (issue #272) and still cites the owner');
{
  // The entry, located by its own heading text rather than a line number, so a
  // future append cannot silently move the guard off its target.
  const at = lines.findIndex(l => /^### B\d+\. The reminder glow moves to the note card/.test(l));
  ok('the reminder-glow entry exists and is `### B132.`',
    at >= 0 && /^### B132\./.test(lines[at]),
    at < 0 ? 'no such heading' : lines[at].slice(0, 24));

  const end = lines.findIndex((l, i) => i > at && /^### B\d+\./.test(l));
  const block = at < 0 ? [] : lines.slice(at, end < 0 ? lines.length : end);
  const source = block.find(l => l.startsWith('**Source:** ')) || '';
  const URL = 'https://github.com/AlastairZeved/TheBoards/issues/240#issuecomment-5718587081';
  ok('its `Source:` line still points at the owner comment that ruled the glow',
    source.slice('**Source:** '.length).startsWith(URL),
    source ? source.slice(0, 60) : 'no Source line in the entry');
}

console.log(`\n=== records: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);