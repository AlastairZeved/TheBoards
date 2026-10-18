/* --- 10.5 PDF export -------------------------------------------------------
   A board leaves the device as a .pdf. PDF is a text format and the base-14
   fonts need no embedding, so the exporter is hand-written, not vendored: a
   library would be the app's first dependency (B1: this project hand-rolls
   its encoders).

   Page 1 draws the board as vectors; page 2 is its text.

   One convention: origin top-left, y down, as CSS and the stored coordinates.
   Each page opens with a y-flip; drawText cancels it per string.
   ---------------------------------------------------------------------- */

import { BOARD_CATS, COPY, LOT_HEAD, LOT_MAX_FRAC, LOT_ROW, NOTE_MIN_W, REF_W, REF_H, UNDO_MS, calDayName, calEventsOf, calMD, calWindow, copyRecordFields, eventsOf, live, makeRecord, pad2, state, uuid } from './state.js';
import { flushSave, idbGet, idbGetAll, idbPut } from './persistence.js';
import { LOGICAL_H, LOGICAL_W, bandRuleYFor, noteKFor, noteMaxW } from './geometry.js';
import { renderBoard } from './render.js';
import { showNotice } from './interactions.js';
import { formatDate, listOpen, renderListSurface, renderPane } from './boards.js';

const A4_W = 595.28, A4_H = 841.89;  // pt
const PDF_MARGIN = 36;
const PDF_ASC = 0.718, PDF_DESC = 0.207;   // Helvetica em box, for baselines

/* The export sheet is the 900x1000 REFERENCE frame, never the viewport-derived
   LOGICAL_W/H (B20/B32): else one board exports differently per device. */
export const EXPORT_W = REF_W, EXPORT_H = REF_H;

/* The export's OWN paper-light palette, deliberately not derived from :root
   (UIUX §15, B48): a dark board would print as a slab of near-black. */
const PDF_PAPER = [0.933, 0.922, 0.937];
const PDF_INK   = [0.133, 0.110, 0.141];
const PDF_SHADE = [0.514, 0.482, 0.533];
// Scratch-out at B53's 0.62 veil over paper, pre-mixed to avoid an ExtGState.
// A completed item emits no text object at all (B34).
const PDF_SCRATCH = PDF_INK.map((c, i) => c * 0.62 + PDF_PAPER[i] * 0.38);
// Highlight wash (B71): the screen's amber toned down, so a highlighted note
// doesn't print as a slab of ink.
const PDF_HILITE = [0.949, 0.847, 0.361];

/* Helvetica / Helvetica-Bold advance widths, WinAnsi 32..255, two base-36
   digits each. The viewer sets in ITS Helvetica, so wrap against these, not
   the DOM. */
const PDF_W_REG =
  '7q7q9vfgfgopij5b9999atg87q997q7qfgfgfgfgfgfgfgfgfgfg7q7qg8g8g8fgs7ijijk2k2ijgzlmk27qdwijfgn5k2lm' +
  'ijlmk2ijgzk2ijq8ijijgz7q7q7qd1fg99fgfgdwfgfg7qfgfg6666dw66n5fgfgfgfg99dw7qfgdwk2dwdwdw9a789ag800' +
  'fg0066fg99rsfgfg99rsij99rs00gz0000666699999qfgrs99rsdw99q800dwij7q99fgfgfgfg78fg99khaafgg899kh99' +
  'b4g8999999fgex7q9999a5fgn6n6n6gzijijijijijijrsk2ijijijij7q7q7q7qk2k2lmlmlmlmlmg8lmk2k2k2k2ijijgz' +
  'fgfgfgfgfgfgopdwfgfgfgfg7q7q7q7qfgfgfgfgfgfgfgg8gzfgfgfgfgdwfgdw';
const PDF_W_BOLD =
  '7q99d6fgfgopk26m9999atg87q997q7qfgfgfgfgfgfgfgfgfgfg9999g8g8g8gzr3k2k2k2k2ijgzlmk27qfgk2gzn5k2lm' +
  'ijlmk2ijgzk2ijq8ijijgz997q99g8fg99fggzfggzfg99gzgz7q7qfg7qopgzgzgzgzatfg99gzfglmfgfgdwat7satg800' +
  'fg007qfgdwrsfgfg99rsij99rs00gz00007q7qdwdw9qfgrs99rsfg99op00dwij7q99fgfgfgfg7sfg99khaafgg899kh99' +
  'b4g8999999gzfg7q9999a5fgn6n6n6gzk2k2k2k2k2k2rsk2ijijijij7q7q7q7qk2k2lmlmlmlmlmg8lmk2k2k2k2ijijgz' +
  'fgfgfgfgfgfgopfgfgfgfgfg7q7q7q7qgzgzgzgzgzgzgzg8gzgzgzgzgzfggzfg';

/* CP1252's 0x80-0x9F block: the only codes whose Unicode is not their byte
   (the app's copy uses ’). */
const PDF_CP1252 = {
  0x20AC: 128, 0x201A: 130, 0x0192: 131, 0x201E: 132, 0x2026: 133, 0x2020: 134,
  0x2021: 135, 0x02C6: 136, 0x2030: 137, 0x0160: 138, 0x2039: 139, 0x0152: 140,
  0x017D: 142, 0x2018: 145, 0x2019: 146, 0x201C: 147, 0x201D: 148, 0x2022: 149,
  0x2013: 150, 0x2014: 151, 0x02DC: 152, 0x2122: 153, 0x0161: 154, 0x203A: 155,
  0x0153: 156, 0x017E: 158, 0x0178: 159,
};

/* Unicode -> WinAnsi. Base-14 fonts can't say CJK or emoji, and embedding one
   is the dependency this exporter avoids: they export as '?' and pdfLossy
   reports it (truncation is always indicated, UIUX §10; B34). */
let pdfLossy = false;
function pdfCode(ch) {
  const u = ch.codePointAt(0);
  if (u === 9) return 32;
  if ((u >= 32 && u <= 126) || (u >= 160 && u <= 255)) return u;
  const m = PDF_CP1252[u];
  if (m !== undefined) return m;
  pdfLossy = true;
  return 63;
}
function pdfAdv(code, bold) {
  if (code < 32 || code > 255) return 0;
  const t = bold ? PDF_W_BOLD : PDF_W_REG, p = (code - 32) * 2;
  return parseInt(t.charAt(p) + t.charAt(p + 1), 36) || 0;
}
export function pdfTextW(str, bold, size) {
  let u = 0;
  for (const ch of String(str)) u += pdfAdv(pdfCode(ch), bold);
  return u * size / 1000;
}

/* A PDF literal string. Octal-escaping above 126 keeps every appended byte
   <= 0x7F, so String.length can stand in for byte length in xref offsets. */
function pdfStr(str) {
  let out = '(';
  for (const ch of String(str)) {
    const c = pdfCode(ch);
    if (c === 40 || c === 41 || c === 92) out += '\\' + String.fromCharCode(c);
    else if (c < 32 || c > 126) out += '\\' + ('00' + c.toString(8)).slice(-3);
    else out += String.fromCharCode(c);
  }
  return out + ')';
}

// Fixed notation only: PDF has no exponent syntax, so 1e-7 is a syntax error.
function pdfNum(n) {
  if (!isFinite(n)) n = 0;
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

/* pre-wrap + break-word measured in Helvetica: hard breaks honoured, an
   over-wide word breaks mid-word (keeps a note frame inside its edge cap). */
function pdfWrap(str, bold, size, maxW) {
  const lines = [];
  if (!(maxW > 0)) return [String(str)];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (let word of para.split(' ')) {
      while (pdfTextW(word, bold, size) > maxW) {
        let cut = 1;
        while (cut < word.length && pdfTextW(word.slice(0, cut + 1), bold, size) <= maxW) cut++;
        if (line) { lines.push(line); line = ''; }
        lines.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      const trial = line ? line + ' ' + word : word;
      if (!line || pdfTextW(trial, bold, size) <= maxW) line = trial;
      else { lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}
// `width: max-content`: the widest hard line; how a note frame shrink-wraps.
function pdfNaturalW(str, bold, size) {
  let w = 0;
  for (const para of String(str).split('\n')) w = Math.max(w, pdfTextW(para, bold, size));
  return w;
}
// Where a baseline sits inside a CSS line box of height `lh`.
function pdfBaseline(top, lh, size) {
  return top + (lh - size * (PDF_ASC + PDF_DESC)) / 2 + size * PDF_ASC;
}

/* ---- Content-stream builder --------------------------------------------
   Board coordinates in, operators out; every method returns `p` for chaining.
   Larger furniture lives in the free draw* functions and rrectPath below. */
function pdfCanvas() {
  const ops = [];
  const p = {
    ops,
    raw(s) { ops.push(s); return p; },
    q() { return p.raw('q'); },
    Q() { return p.raw('Q'); },
    cm(a, b, c, d, e, f) {
      return p.raw([a, b, c, d, e, f].map(pdfNum).join(' ') + ' cm');
    },
    flip(h) { return p.cm(1, 0, 0, -1, 0, h); },       // top-left origin, y down
    fill(c) { return p.raw(c.map(pdfNum).join(' ') + ' rg'); },
    strokeColor(c) { return p.raw(c.map(pdfNum).join(' ') + ' RG'); },
    lineWidth(w) { return p.raw(pdfNum(w) + ' w'); },
    rect(x, y, w, h) {
      return p.raw([x, y, w, h].map(pdfNum).join(' ') + ' re');
    },
    line(x1, y1, x2, y2) {
      return p.raw(pdfNum(x1) + ' ' + pdfNum(y1) + ' m ' + pdfNum(x2) + ' ' + pdfNum(y2) + ' l');
    },
    rrect(x, y, w, h, r) { return rrectPath(p, x, y, w, h, r); },
    clip() { return p.raw('W n'); },
    frame(x, y, w, h, r, bw, bg) { return drawFrame(p, x, y, w, h, r, bw, bg); },
    frameOpenTop(x, y, w, h, bw, bg) { return drawFrameOpenTop(p, x, y, w, h, bw, bg); },
    text(str, x, baseline, size, bold, color) {
      return drawText(p, str, x, baseline, size, bold, color);
    },
    lines(arr, x, w, top, size, lh, bold, align, color) {
      return drawLines(p, arr, x, w, top, size, lh, bold, align, color);
    },
    scratch(w, h) { return drawScratch(p, w, h); },
    stream() { return ops.join('\n'); },
  };
  return p;
}

// Rounded rect path; notes pass EXPORT_GEO.radius.
function rrectPath(p, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!r) return p.rect(x, y, w, h);
  const k = r * 0.5523, X = x + w, Y = y + h;
  const c = (x1, y1, x2, y2, x3, y3) =>
    p.raw([x1, y1, x2, y2, x3, y3].map(pdfNum).join(' ') + ' c');
  p.raw(pdfNum(x + r) + ' ' + pdfNum(y) + ' m');
  p.raw(pdfNum(X - r) + ' ' + pdfNum(y) + ' l');
  c(X - r + k, y, X, y + r - k, X, y + r);
  p.raw(pdfNum(X) + ' ' + pdfNum(Y - r) + ' l');
  c(X, Y - r + k, X - r + k, Y, X - r, Y);
  p.raw(pdfNum(x + r) + ' ' + pdfNum(Y) + ' l');
  c(x + r - k, Y, x, Y - r + k, x, Y - r);
  p.raw(pdfNum(x) + ' ' + pdfNum(y + r) + ' l');
  c(x, y + r - k, x + r - k, y, x + r, y);
  return p.raw('h');
}

// A CSS border sits inside the box, a PDF stroke straddles the path: inset by
// half the width.
function drawFrame(p, x, y, w, h, r, bw, bg) {
  if (bg) { p.fill(bg); p.rrect(x, y, w, h, r); p.raw('f'); }
  p.strokeColor(PDF_INK).lineWidth(bw);
  p.rrect(x + bw / 2, y + bw / 2, w - bw, h - bw, Math.max(0, r - bw / 2));
  return p.raw('S');
}

// The title compartment (B38): the sheet's top edge is its fourth side, so one
// three-segment path (left, bottom, right), inset by half the border width as
// in `frame`. No radius: the 2px CSS corner is ~1pt at export scale.
function drawFrameOpenTop(p, x, y, w, h, bw, bg) {
  if (bg) { p.fill(bg); p.rect(x, y, w, h); p.raw('f'); }
  p.strokeColor(PDF_INK).lineWidth(bw);
  const lx = x + bw / 2, rx = x + w - bw / 2, by = y + h - bw / 2;
  p.raw(pdfNum(lx) + ' ' + pdfNum(y) + ' m');
  p.raw(pdfNum(lx) + ' ' + pdfNum(by) + ' l');
  p.raw(pdfNum(rx) + ' ' + pdfNum(by) + ' l');
  p.raw(pdfNum(rx) + ' ' + pdfNum(y) + ' l');
  return p.raw('S');
}

// One line on a baseline; the text matrix cancels the page flip.
function drawText(p, str, x, baseline, size, bold, color) {
  if (!String(str).length) return p;
  p.fill(color || PDF_INK);
  p.raw('BT');
  p.raw('/' + (bold ? 'F2' : 'F1') + ' ' + pdfNum(size) + ' Tf');
  p.raw('1 0 0 -1 ' + pdfNum(x) + ' ' + pdfNum(baseline) + ' Tm');
  p.raw(pdfStr(str) + ' Tj');
  return p.raw('ET');
}

// align: 'left' | 'center' | 'right', measured in the box's own width.
function drawLines(p, arr, x, w, top, size, lh, bold, align, color) {
  for (let i = 0; i < arr.length; i++) {
    const s = arr[i];
    if (!s.length) continue;
    let tx = x;
    // Centring ignores trailing spaces: pre-wrap hangs them on screen (B62).
    if (align === 'center') tx = x + (w - pdfTextW(s.replace(/ +$/, ''), bold, size)) / 2;
    else if (align === 'right') tx = x + w - pdfTextW(s, bold, size);
    p.text(s, tx, pdfBaseline(top + i * lh, lh, size), size, bold, color);
  }
  return p;
}

/* The scratch-out: UIUX §4.3's three repeating-linear-gradients as three
   families of ruled lines. Clip first: this fills whatever the clip allows.
   Angles are CSS's (y down, positive = clockwise). */
function drawScratch(p, w, h) {
  const bands = [[8, 5, 8], [-14, 4, 7], [79, 3, 5]];
  const R = Math.hypot(w, h) / 2 + 4;
  p.strokeColor(PDF_SCRATCH);
  for (const [deg, thick, period] of bands) {
    const a = deg * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    p.q().cm(cos, sin, -sin, cos, w / 2, h / 2).lineWidth(thick);
    for (let y = -R; y <= R; y += period) p.line(-R, y + thick / 2, R, y + thick / 2);
    p.raw('S').Q();
  }
  return p;
}

/* ---- Document assembly --------------------------------------------------
   Object numbers are fixed: catalog 1, pages 2, fonts 3 and 4, then page/
   content pairs from 5. Offsets are string indices, sound only because every
   appended byte is ASCII (pdfStr guarantees it). */
function pdfAssemble(streams, title) {
  const n = streams.length;
  const kids = [];
  for (let i = 0; i < n; i++) kids.push((5 + i * 2) + ' 0 R');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count ' + n + ' /Kids [' + kids.join(' ') + '] >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  for (let i = 0; i < n; i++) {
    objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pdfNum(A4_W) + ' ' + pdfNum(A4_H) + ']' +
              ' /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >>' +
              ' /Contents ' + (6 + i * 2) + ' 0 R >>');
    objs.push('<< /Length ' + streams[i].length + ' >>\nstream\n' + streams[i] + '\nendstream');
  }
  // No dates in /Info: an unchanged board exports byte-identical (cheap test).
  const infoNo = objs.length + 1;
  objs.push('<< /Title ' + pdfStr(title) + ' /Producer ' + pdfStr('Zeved Boards') + ' >>');

  let out = '%PDF-1.4\n';
  const offsets = [];
  for (let i = 0; i < objs.length; i++) {
    offsets.push(out.length);
    out += (i + 1) + ' 0 obj\n' + objs[i] + '\nendobj\n';
  }
  const startxref = out.length;
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
  for (const off of offsets) out += ('0000000000' + off).slice(-10) + ' 00000 n \n';
  out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info ' + infoNo + ' 0 R >>\n' +
         'startxref\n' + startxref + '\n%%EOF\n';

  // Offsets are string indices, byte offsets only if all output is 7-bit.
  // Assert it: a stray non-ASCII char shifts every entry and presents as
  // "damaged file".
  if (/[^\x00-\x7F]/.test(out)) throw new Error('pdf: non-ascii byte in stream');
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xFF;
  return bytes;
}

/* ---- Page 1: the board ---------------------------------------------------
   Geometry is styles.css read against the 900x1000 sheet: gutter 24, card
   280..620 (B35), so Components ends at 272 and Requirements starts at 628
   (card edges ±8px gap). Draw order is stacking order: the card covers the
   band rule (B33); notes sit above all furniture. */
export const EXPORT_GEO = {
  gutter: 24,
  // B47's band formula (shared bandRuleYFor, as the screen's --rule-y; B76's
  // label hangs below the rule, budgeting nothing above), resolved per record
  // in exportRuleY(). bandTop/bandGap stay literal and MUST equal BAND_TOP/
  // BAND_GAP: the [11c] tripwire recomputes the formula from this source.
  bandTop: 14, bandGap: 8,
  compL: 24, compR: 272, reqL: 628, reqR: 876,
  // The compartment starts at the sheet's top edge (B38, B47) and overhangs
  // the rule by 22; cardPadTop is its top padding (band-top + 6).
  cardL: 280, cardW: 340, cardTop: 0, cardOverhang: 22, cardPad: 12, cardPadTop: 20,
  // Both sections size to MEASURED content from a floor (UIUX §3.1/§3.2,
  // B73); the lot's ceiling is half the sheet (exportLotH), the export's own
  // number (B34). lotHead/lotRow ARE the screen's shared constants.
  lotHead: LOT_HEAD, lotRow: LOT_ROW, lotHeaderY: 8, lotItemsY: 34,
  headSize: 15, headLH: 19.5,          // title, anchor text, lot header
  labelSize: 13, labelLH: 16.9,        // the band's nomenclature (13 x 1.3, B54)
  labelPadX: 6, labelPadY: 2,          // the tab that frames it below the rule (B76)
  lotSize: 16, lotLH: 23.2,            // 16px / 1.45
  noteSize: 17, noteLH: 23.8,          // 17px / 1.4
  border: 2, radius: 3, notePadX: 12, notePadY: 10,   // radius mirrors B49 by hand
  linkWidth: 1.5,                      // the note-link hairline (B91)
};

// The band sizes to its tallest zone (B47) on the export's own frame: line
// counts come from pdfWrap against the 248-unit zones (same law as the
// screen, not the same number, B34). Rule-y is the shared bandRuleYFor.
function exportRuleY(rec) {
  const g = EXPORT_GEO;
  let lines = 2;
  for (const z of [{ text: rec.components, w: g.compR - g.compL },
                   { text: rec.requirements, w: g.reqR - g.reqL }]) {
    if (z.text) lines = Math.max(lines, pdfWrap(z.text, true, g.headSize, z.w).length);
  }
  return bandRuleYFor(lines);
}
/* One Parking Lot row: its floor height, or its wrapped lines plus the row's
   padding. The screen measures rendered lines (B73), so exportLotH's sum and
   the draw loop must share this formula to get the same heights. */
const LOT_ROW_PAD = 4;
const lotRowH = (lineCount) =>
  Math.max(EXPORT_GEO.lotRow, lineCount * EXPORT_GEO.lotLH + LOT_ROW_PAD);

const exportLotH = (rec) => {
  const g = EXPORT_GEO;
  // Sums the draw loop's row heights from the two-row floor, capped at half
  // the sheet (B73, B34); the draw loop still clips the excess.
  let sum = 0;
  for (const item of rec.parkingLot || []) {
    const lines = pdfWrap(item.text, false, g.lotSize, EXPORT_W - 2 * g.gutter);
    sum += lotRowH(lines.length);
  }
  return Math.min(g.lotHead + Math.max(2 * g.lotRow, sum),
                  Math.round(EXPORT_H * LOT_MAX_FRAC));
};

// The similarity transform (B64) against the export sheet: the shared
// noteKFor with EXPORT_W/H as the frame. Each frame takes its own min, so a
// mixed-cohort board can relate cohorts differently here than on a screen.
// Stored x/y are read only (B21). Legacy notes never reach here: B93's boot
// migration puts every rh-less note on the min-k path before first paint.
const exportK = (n) => noteKFor(n, EXPORT_W, EXPORT_H);
export const exportX = (n) => n.x * exportK(n);
const exportY = (n) => n.y * exportK(n);

// Border box of a note before its own scale: `width: max-content` capped at
// the sheet's right edge. The cap IS noteMaxW (B39, B64), the screen's own
// function, so the two wrap widths can't drift apart.
export function exportNoteBox(note) {
  const g = EXPORT_GEO;
  const chrome = 2 * g.notePadX + 2 * g.border;
  const cap = noteMaxW(note);
  const maxContent = cap - chrome;
  // Floor the content box at NOTE_MIN_W as the screen does (B84), so a short
  // note exports at its rendered width; <= maxContent since cap >= NOTE_MIN_W.
  // Text centres in the wider box (B62).
  const content = Math.max(NOTE_MIN_W - chrome,
    Math.min(pdfNaturalW(note.text, false, g.noteSize), maxContent));
  const lines = pdfWrap(note.text, false, g.noteSize, content);
  return {
    w: content + chrome,
    h: lines.length * g.noteLH + 2 * g.notePadY + 2 * g.border,
    content, lines,
  };
}

function exportBoardPage(rec) {
  const scale = Math.min((A4_W - 2 * PDF_MARGIN) / EXPORT_W, (A4_H - 2 * PDF_MARGIN) / EXPORT_H);
  const mx = (A4_W - EXPORT_W * scale) / 2;
  const my = (A4_H - EXPORT_H * scale) / 2;   // centred: the sheet is squarer than A4
  const p = pdfCanvas();
  p.q().flip(A4_H);
  // Paper edge to edge, not floating on white: paper tone is part of the
  // identity (UIUX §1) and the margin is margin, not a desk (B17, B32).
  p.fill(PDF_PAPER).rect(0, 0, A4_W, A4_H).raw('f');
  p.cm(scale, 0, 0, scale, mx, my);
  p.fill(PDF_PAPER).rect(0, 0, EXPORT_W, EXPORT_H).raw('f');
  const ruleY = exportBand(p, rec);
  exportCard(p, rec, ruleY);
  exportLot(p, rec);
  exportLinks(p, rec);
  exportNotes(p, rec);
  return p.Q().stream();
}

// Band content, then the rule as its bottom edge, full width (B47), with each
// header hanging below it as a tab in the rule's ink (B76). Returns the rule
// y so the card can overhang it.
function exportBand(p, rec) {
  const g = EXPORT_GEO;
  const ruleY = exportRuleY(rec);
  const zones = [
    { text: rec.components, label: COPY.pdfComponents, l: g.compL, r: g.compR },
    { text: rec.requirements, label: COPY.pdfRequirements, l: g.reqL, r: g.reqR },
  ];
  for (const z of zones) {
    const w = z.r - z.l;
    if (z.text) {
      // Hangs from the band's top (B47). Not clipped: the screen's zone sets
      // no overflow, so a long entry flows over the canvas (B34).
      p.lines(pdfWrap(z.text, true, g.headSize, w), z.l, w, g.bandTop,
              g.headSize, g.headLH, true, 'left');
    }
    // Header tab (B76): filled PDF_INK box, top edge on the rule, centred in
    // its zone. The rule is dark here (mid-light --frame on screen), so the
    // label reverses to paper, not screen's --ink-dark.
    const labelW = pdfTextW(z.label, true, g.labelSize) + 2 * g.labelPadX;
    const boxX = z.l + (w - labelW) / 2;
    p.fill(PDF_INK).rect(boxX, ruleY, labelW, g.labelLH + 2 * g.labelPadY).raw('f');
    p.lines([z.label], boxX, labelW, ruleY + g.labelPadY,
            g.labelSize, g.labelLH, true, 'center', PDF_PAPER);
  }
  p.fill(PDF_INK).rect(0, ruleY, EXPORT_W, 1).raw('f');
  return ruleY;
}

// The title compartment: border-top not drawn (B38); overhangs the band's
// rule (ruleY, from exportBand) by 22, occluding it (B47).
function exportCard(p, rec, ruleY) {
  const g = EXPORT_GEO;
  const title = rec.title || '';
  const cardContentW = g.cardW - 2 * g.cardPad - 2 * g.border;
  const titleLines = title ? pdfWrap(title, true, g.headSize, cardContentW) : [];
  const cardH = Math.max(ruleY + g.cardOverhang,
                         titleLines.length * g.headLH + g.cardPadTop + g.cardPad + g.border);
  p.frameOpenTop(g.cardL, g.cardTop, g.cardW, cardH, g.border, PDF_PAPER);
  if (titleLines.length) {
    // justify-content: center: block centred between top padding and bottom
    // padding + border; each line centred in the block.
    const blockH = titleLines.length * g.headLH;
    const top = g.cardPadTop + (cardH - g.cardPadTop - g.cardPad - g.border - blockH) / 2;
    p.lines(titleLines, g.cardL + g.border + g.cardPad, cardContentW, top,
            g.headSize, g.headLH, true, 'center');
  }
}

// Parking Lot: full-bleed to the sheet's bottom, content on the gutter
// (UIUX §3.2). #lot-items is overflow:hidden, so the export clips too, else a
// long lot walks off the page.
function exportLot(p, rec) {
  const g = EXPORT_GEO;
  const lotH = exportLotH(rec);
  const lotTop = EXPORT_H - lotH;
  const lotW = EXPORT_W - 2 * g.gutter;
  p.fill(PDF_INK).rect(0, lotTop, EXPORT_W, 1).raw('f');       // full width (B47)
  p.lines([COPY.pdfParkingLot], g.gutter, lotW, lotTop + g.lotHeaderY,
          g.headSize, g.headLH, true, 'left');
  const itemsTop = lotTop + g.lotItemsY;
  const itemsH = lotH - g.lotItemsY;
  p.q().rect(g.gutter, itemsTop, lotW, itemsH).clip();
  let ly = itemsTop;
  for (const item of rec.parkingLot || []) {
    if (ly >= itemsTop + itemsH) break;
    const lines = pdfWrap(item.text, false, g.lotSize, lotW);
    const rowH = lotRowH(lines.length);
    if (item.state === 'complete') {
      // Hatching only: the words are not in the file at all.
      p.q().rect(g.gutter, ly, lotW, rowH).clip()
        .cm(1, 0, 0, 1, g.gutter, ly).scratch(lotW, rowH).Q();
    } else {
      const top = ly + (rowH - lines.length * g.lotLH) / 2;
      p.lines(lines, g.gutter, lotW, top, g.lotSize, g.lotLH, false, 'left');
    }
    ly += rowH;
  }
  p.Q();
}

// Links UNDER the notes (B91): a hairline between two note centres in sheet
// space (not the per-note transform), below the cards as on screen. A
// dangling link (endpoint gone) is skipped.
function exportLinks(p, rec) {
  const g = EXPORT_GEO;
  const noteCentre = (n) => {
    const box = exportNoteBox(n), s = (n.scale || 1) * exportK(n);
    return { x: exportX(n) + box.w * s / 2, y: exportY(n) + box.h * s / 2 };
  };
  for (const link of rec.links || []) {
    const na = (rec.notes || []).find(n => n.id === link.a);
    const nb = (rec.notes || []).find(n => n.id === link.b);
    if (!na || !nb) continue;
    const a = noteCentre(na), b = noteCentre(nb);
    p.q().strokeColor(PDF_SHADE).lineWidth(g.linkWidth).line(a.x, a.y, b.x, b.y).raw('S').Q();
  }
}

// Notes last: array order is z-order, and DOM order mirrors it.
function exportNotes(p, rec) {
  const g = EXPORT_GEO;
  for (const note of rec.notes || []) {
    const box = exportNoteBox(note);
    const s = (note.scale || 1) * exportK(note);      // the similarity (B64)
    // transform-origin: top left — translate to the note, then scale in place.
    p.q().cm(s, 0, 0, s, exportX(note), exportY(note));
    // Highlight fills amber; a completed note still fills first, then the
    // scratch draws over it (B71).
    p.frame(0, 0, box.w, box.h, g.radius, g.border, note.highlighted ? PDF_HILITE : PDF_PAPER);
    if (note.state === 'complete') {
      p.q().rrect(0, 0, box.w, box.h, g.radius).clip().scratch(box.w, box.h).Q();
    } else {
      // Centred in the content box, as the screen draws it (B62).
      p.lines(box.lines, g.border + g.notePadX, box.content, g.border + g.notePadY,
              g.noteSize, g.noteLH, false, 'center');
    }
    p.Q();
  }
}

/* ---- Page 2+: the text ---------------------------------------------------
   The board as searchable prose. Completed items keep their place, not their
   words. */
/* Page machinery for the two prose exports: opens/closes A4 text pages and
   lays paragraphs under a running baseline (`y`); `cur` is the live canvas.

   `overflow` is what running out of page MEANS: 'paginate' (board) opens
   another; 'error' (calendar) throws, so the caller reports COPY.exportError
   rather than ship a truncated file (B34: truncation is always indicated). */
function textPager({ overflow = 'paginate' } = {}) {
  const L = PDF_MARGIN, W = A4_W - 2 * PDF_MARGIN;
  const BOTTOM = A4_H - PDF_MARGIN;
  const streams = [];
  let p = null, y = 0;

  const openPage = () => {
    p = pdfCanvas();
    p.q().flip(A4_H);
    p.fill(PDF_PAPER).rect(0, 0, A4_W, A4_H).raw('f');
    y = PDF_MARGIN;
  };
  const closePage = () => { if (p) { streams.push(p.Q().stream()); p = null; } };
  const room = (h) => {
    if (y + h <= BOTTOM) return;
    if (overflow === 'error') throw new Error('pdf-page-overflow');
    closePage(); openPage();
  };

  const para = (str, size, lh, bold, color, indent) => {
    const x = L + (indent || 0);
    const w = W - (indent || 0);
    for (const line of pdfWrap(str, bold, size, w)) {
      room(lh);
      if (line.length) p.text(line, x, pdfBaseline(y, lh, size), size, bold, color);
      y += lh;
    }
  };
  const heading = (str) => {
    room(30);
    y += 12;
    para(str, 11, 15, true, PDF_INK);
    p.fill(PDF_SHADE).rect(L, y + 1, W, 0.5).raw('f');
    y += 6;
  };

  return { streams, L, W, openPage, closePage, room, para, heading,
           get cur() { return p; }, get y() { return y; }, set y(v) { y = v; } };
}

/* One bulleted list on a pager. A completed item keeps its place but not its
   words (as page 1's scratch-out, B34): `state` picks only the ink and text.
   `mark: false` drops the bullet glyph but keeps the indent, for the
   calendar's event lines under a day's own heading. */
function pdfBullets(t, label, items, { mark = true } = {}) {
  if (!items.length) return;
  if (label) t.heading(label);
  const indent = 14;
  for (const it of items) {
    const done = it.state === 'complete';
    const color = done ? PDF_SHADE : PDF_INK;
    const lines = pdfWrap(done ? COPY.pdfCompleted : it.text, false, 10, t.W - indent);
    if (mark) {
      t.room(indent);                              // keep the bullet with its first line
      t.cur.text('•', t.L, pdfBaseline(t.y, indent, 10), 10, false, color);
    }
    for (const line of lines) {
      t.room(indent);
      if (line.length) t.cur.text(line, t.L + indent, pdfBaseline(t.y, indent, 10), 10, false, color);
      t.y += indent;
    }
  }
}

function exportTextPages(rec) {
  const t = textPager();
  const bullets = (label, items) => pdfBullets(t, label, items);

  t.openPage();
  t.para(rec.title || COPY.untitled, 18, 24, true, PDF_INK);
  t.para(formatDate(rec.createdAt), 9, 13, false, PDF_SHADE);

  if (rec.components) { t.heading('COMPONENTS'); t.para(rec.components, 10, 14, false, PDF_INK); }
  if (rec.requirements) { t.heading('REQUIREMENTS'); t.para(rec.requirements, 10, 14, false, PDF_INK); }

  bullets('NOTES', rec.notes || []);
  bullets('PARKING LOT', rec.parkingLot || []);

  t.closePage();
  return t.streams;
}

export function buildBoardPdf(rec) {
  return pdfAssemble([exportBoardPage(rec)].concat(exportTextPages(rec)),
                     rec.title || COPY.untitled);
}

/* ---- The calendar's 7-day reference sheet ---------------------------------
   One text page: the rolling week as it renders, today first, one line per
   event ("— completed —" when done). Reads STORAGE (computed window, live
   events), never the squeezed frame. */
export async function exportCalPdf() {
  try {
    flushSave();
    const all = await idbGetAll();
    const events = eventsOf(all);
    pdfLossy = false;                       // reported as in exportBoardPdf (B34)
    // Overflow is an error, not a page turn: this is one fixed sheet.
    const t = textPager({ overflow: 'error' });
    t.openPage();
    t.para(COPY.calTitle, 18, 24, true, PDF_INK);
    t.para(formatDate(Date.now()), 9, 13, false, PDF_SHADE);
    t.y += 6;
    for (const day of calWindow()) {
      t.heading((day.today ? COPY.calToday + ' — ' : '') +
        calDayName(day.date) + ' ' + calMD(day.date));
      // Unmarked: the indent alone groups events under the day's heading.
      pdfBullets(t, null, calEventsOf(events, day.key), { mark: false });
    }
    t.closePage();
    const bytes = pdfAssemble(t.streams, COPY.calTitle);
    const d = new Date();
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }),
      'calendar-' + d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + '.pdf');
    if (pdfLossy) showNotice(COPY.exportLossy, 'export', UNDO_MS);
  } catch (e) {
    showNotice(COPY.exportError, 'export', UNDO_MS);
  }
}

/* ---- The menu action ---------------------------------------------------- */

// The board's own words, then its start date; an untitled board is date-only.
function pdfFilename(rec) {
  const slug = String(rec.title || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
    .replace(/-+$/, '');
  const d = new Date(rec.createdAt || Date.now());
  const stamp = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  return (slug || 'board') + '-' + stamp + '.pdf';
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Let every engine start the write before the URL is revoked.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/* Export runs off the board RECORD, not the live DOM: the menu belongs to a
   card, usually not the open board. renderPane/renderListSurface close over
   an idbGetAll() snapshot from when the rail was drawn, which can be stale; so
   the open board reads `current` (ahead of storage by SAVE_DEBOUNCE) and every
   other card re-reads IndexedDB. */
export async function exportBoardPdf(board) {
  try {
    const current = live(board);
    const src = current === state.current
      ? current : ((await idbGet(board.id)) || board);
    // B8/B31's sweep on a COPY: records reach the menu straight from
    // idbGetAll(), never through renderBoard's sanitize, so a whitespace husk
    // would export as an empty box. Copy, don't filter in place: `src` may be
    // `current`, and mutating live state from an export is the silent write
    // B21 forbids.
    const keep = (r) => (r.text || '').trim().length > 0;
    const notes = (src.notes || []).filter(keep).map((note) => copyRecordFields('note', note));
    const rec = copyRecordFields('board', {
      ...src,
      createdAt: src.createdAt || board.createdAt,
      notes,
      parkingLot: (src.parkingLot || []).filter(keep)
        .map((item) => copyRecordFields('lot', item)),
      // B91's links, only where both notes survive the sweep.
      links: (src.links || []).filter((l) =>
        notes.some((n) => n.id === l.a) && notes.some((n) => n.id === l.b)),
    });
    pdfLossy = false;
    const bytes = buildBoardPdf(rec);
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), pdfFilename(rec));
    if (pdfLossy) showNotice(COPY.exportLossy, 'export', UNDO_MS);
  } catch (e) {
    showNotice(COPY.exportError, 'export', UNDO_MS);
  }
}

/* --- 10.6 JSON backup: export all, import merged (B92; payload v2 per B123) */

/* A day-note record: rem- id and day key; also matches v2 files that put
   them in `boards`. */
function isDayNoteRecord(raw) {
  return !!raw && typeof raw === 'object' && typeof raw.id === 'string' &&
    raw.id.startsWith('rem-') && typeof raw.day === 'string';
}

/* The whole library as one file; day notes are split out of `boards`, whose
   legacy v2 location stays importable. flushSave() first: saves are debounced
   (SAVE_DEBOUNCE), so idbGetAll() alone could read the open board stale. The
   stamp lands only if an edit is pending, so exporting doesn't reorder the
   list (B69). */
export async function exportAllJson() {
  try {
    flushSave();
    const all = await idbGetAll();
    const calendarEvents = eventsOf(all);
    const dayNotes = all.filter(isDayNoteRecord);
    const excluded = new Set([...calendarEvents, ...dayNotes]);
    const payload = {
      app: 'the-boards',
      version: 2,
      exportedAt: new Date().toISOString(),
      boards: all.filter((r) => !excluded.has(r)),
      calendarEvents,
      dayNotes,
    };
    const d = new Date();
    const stamp = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    downloadBlob(new Blob([JSON.stringify(payload)], { type: 'application/json' }),
      'boards-backup-' + stamp + '.json');
  } catch (e) {
    showNotice(COPY.exportError, 'export', UNDO_MS);
  }
}

/* Backup board categories. Anything else reads as the read-site default
   (B21/B67: 'unsorted'), so a file from a version with a fifth category still
   imports instead of being rejected. */
const IMPORT_CATS = new Set(BOARD_CATS);

/* One imported board normalized to this app's record shape. Coerce, don't
   trust: a backup has been OUT of the device and must not hand a hostile or
   hand-edited file a live record. Whitespace husks are swept HERE (B8/B31's
   choke, applied at the door so they never enter storage). Returns null for a
   board with no surviving content. */
function normalizeImportedBoard(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const text = (v) => typeof v === 'string' ? v : '';
  const notes = (Array.isArray(raw.notes) ? raw.notes : [])
    .map((n) => n && typeof n === 'object'
      ? makeRecord('note', n, { logicalW: LOGICAL_W, logicalH: LOGICAL_H }) : null)
    .filter((n) => n && n.text.trim().length > 0);
  const parkingLot = (Array.isArray(raw.parkingLot) ? raw.parkingLot : [])
    .map((r) => r && typeof r === 'object' ? makeRecord('lot', r) : null)
    .filter((r) => r && r.text.trim().length > 0);
  if (!notes.length && !parkingLot.length &&
      !text(raw.title).trim() && !text(raw.requirements).trim() && !text(raw.components).trim()) {
    return null;
  }
  const noteIds = new Set(notes.map((n) => n.id));
  const links = (Array.isArray(raw.links) ? raw.links : [])
    .filter((l) => l && typeof l === 'object' &&
      typeof l.a === 'string' && typeof l.b === 'string' &&
      noteIds.has(l.a) && noteIds.has(l.b) && l.a !== l.b)
    .map((l) => ({ id: typeof l.id === 'string' && l.id ? l.id : uuid(), a: l.a, b: l.b }));
  return makeRecord('board', { ...raw, notes, parkingLot, links }, {
    categories: IMPORT_CATS, defaultCategory: 'unsorted',
  });
}

/* One imported calendar event, normalized like a board (B123): `date` must be
   calKey-form YYYY-MM-DD or the event is dropped; null if it can't survive as
   an event. */
function normalizeImportedEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const event = makeRecord('event', raw);
  return event.date ? event : null;
}

function normalizeImportedDayNote(raw) {
  if (!isDayNoteRecord(raw)) return null;
  const note = makeRecord('dayNote', raw);
  return note.day ? note : null;
}

/* Merge-import: a board whose id exists is OVERWRITTEN by the file's copy, new
   ids are ADDED, boards the file never mentions stay. B123 extends this to
   events (overwrite by id too): v2 carries them in `calendarEvents`; a v1
   file's events sit in `boards`, where board normalization would drop them, so
   they are salvaged through `eventsOf` BEFORE it runs. */
export async function importBoardsJson(file) {
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch (e) {
    showNotice(COPY.importError, 'import', UNDO_MS);
    return;
  }
  if (!payload || typeof payload !== 'object' || payload.app !== 'the-boards' ||
      !Array.isArray(payload.boards)) {
    showNotice(COPY.importError, 'import', UNDO_MS);
    return;
  }
  const rawEvents = Array.isArray(payload.calendarEvents)
    ? payload.calendarEvents
    : eventsOf(payload.boards);
  const rawDayNotes = [
    ...(Array.isArray(payload.dayNotes) ? payload.dayNotes : []),
    ...payload.boards.filter(isDayNoteRecord),
  ];
  const incoming = payload.boards
    .filter((raw) => !isDayNoteRecord(raw) && !eventsOf([raw]).length)
    .map(normalizeImportedBoard)
    .filter(Boolean);
  const incomingEvents = rawEvents
    .map(normalizeImportedEvent)
    .filter(Boolean);
  const dayNotesById = new Map(rawDayNotes.map(normalizeImportedDayNote)
    .filter(Boolean).map((note) => [note.id, note]));
  const incomingDayNotes = [...dayNotesById.values()];
  if (!incoming.length && !incomingEvents.length && !incomingDayNotes.length) {
    showNotice(COPY.importError, 'import', UNDO_MS);
    return;
  }
  flushSave();                          // the debounce must not write over the import
  let overwrittenCurrent = false;
  for (const rec of incoming) {
    await idbPut(rec);
    if (state.current && rec.id === state.current.id) {
      state.current = rec;
      overwrittenCurrent = true;
    }
  }
  for (const ev of incomingEvents) await idbPut(ev);
  for (const note of incomingDayNotes) await idbPut(note);
  if (overwrittenCurrent) {
    state.dirty = false;                      // current was replaced wholesale, as ensureCurrentValid reads it
    renderBoard();
  }
  if (listOpen) await renderListSurface();
  else if (state.isWide) renderPane();     // the rail re-reads; the sheet is already right
  showNotice(COPY.imported, 'import', UNDO_MS);
}
