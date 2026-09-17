/* --- 10.5 PDF export (issue #43) -----------------------------------------
   A board leaves the device as a .pdf, not a screenshot. PDF is a text format
   and the base-14 fonts need no embedding, so the whole exporter is written
   here rather than vendored: a library would be the app's first dependency and
   its first precache entry, and B1 already settled that this project hand-rolls
   its encoders (the icons come out of a dependency-free PNG writer).

   Two pages. Page 1 is the board itself — the same furniture and the same note
   positions, drawn as vectors, which is what the screenshot was standing in
   for. Page 2 is the text of the board, for search and for reading.

   Everything is drawn in ONE convention: origin top-left, y down, matching CSS
   and matching the stored coordinates. Each page opens with a y-flip so the
   numbers below transcribe straight out of styles.css. Text is the exception a
   flip creates — a mirrored CTM would mirror the glyphs — so every string sets
   its own `1 0 0 -1` text matrix, which cancels the flip and leaves the scale.
   ---------------------------------------------------------------------- */

// issue #182 module wiring — native ESM, no bundler (AGENTS.md).
import { COPY, NOTE_MIN_W, UNDO_MS, calEventsOf, calWindow, state, uuid } from './state.js';
import { flushSave, idbGet, idbGetAll, idbPut } from './persistence.js';
import { LOGICAL_H, LOGICAL_W, bandRuleYFor, lotH, noteKFor, noteMaxW } from './geometry.js';
import { LOT_HEAD, LOT_MAX_FRAC, LOT_ROW } from './state.js';
import { renderBoard } from './render.js';
import { g, showNotice } from './interactions.js';
import { calMD, eventsOf, formatDate, listOpen, renderListSurface, renderPane } from './boards.js';

const A4_W = 595.28, A4_H = 841.89;  // pt; the fit is one constant either way
const PDF_MARGIN = 36;
const PDF_ASC = 0.718, PDF_DESC = 0.207;   // Helvetica em box, for baselines

/* The export sheet is the 900x1000 REFERENCE frame, never the live
   LOGICAL_W/LOGICAL_H — those are viewport-derived (B20/B32), so exporting at
   them would make the same board a different document on every device. */
export const EXPORT_W = 900, EXPORT_H = 1000;

/* The export's OWN named palette — paper-light, deliberately NOT derived from
   :root (UIUX §15, B48): the app is dark-only now, and a dark board prints as
   a slab of near-black that costs a cartridge to discover. The export is a
   reference sheet for paper, and paper is the ground it is designed against. */
const PDF_PAPER = [0.933, 0.922, 0.937];
const PDF_INK   = [0.133, 0.110, 0.141];
const PDF_SHADE = [0.514, 0.482, 0.533];
// The scratch-out at B53's 0.62 veil over paper; mixing it down beats carrying
// an ExtGState object just to say so. (The burial half of B53's pair has no
// print analogue: a completed item emits no text object at all — B34.)
const PDF_SCRATCH = PDF_INK.map((c, i) => c * 0.62 + PDF_PAPER[i] * 0.38);
// The highlight wash on paper (issue #105, B71): the screen's amber, toned down
// to a paper-light fill so a highlighted note prints as itself, not a slab of
// saturated ink — the same reasoning that keeps PDF_PAPER off :root.
const PDF_HILITE = [0.949, 0.847, 0.361];

/* Helvetica / Helvetica-Bold advance widths, WinAnsi 32..255, two base-36
   digits each. The PDF viewer sets in ITS Helvetica, not the browser's system
   font, so wrapping has to be measured against these and not against the DOM. */
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

/* CP1252's own 0x80-0x9F block — the only codes whose Unicode is not their
   byte. The app's own copy lives here (’), so this is not a nicety. */
const PDF_CP1252 = {
  0x20AC: 128, 0x201A: 130, 0x0192: 131, 0x201E: 132, 0x2026: 133, 0x2020: 134,
  0x2021: 135, 0x02C6: 136, 0x2030: 137, 0x0160: 138, 0x2039: 139, 0x0152: 140,
  0x017D: 142, 0x2018: 145, 0x2019: 146, 0x201C: 147, 0x201D: 148, 0x2022: 149,
  0x2013: 150, 0x2014: 151, 0x02DC: 152, 0x2122: 153, 0x0161: 154, 0x203A: 155,
  0x0153: 156, 0x017E: 158, 0x0178: 159,
};

/* Unicode -> WinAnsi. A base-14 font cannot say CJK or emoji and embedding one
   that could would mean shipping a font file — the dependency this exporter
   exists to avoid. Those characters export as '?', and the substitution is
   reported rather than swallowed: §10's law is that truncation is always
   indicated, and a silently mangled line is truncation. See DECISIONS B34. */
const pdfUi = { pdfLossy: false };
function pdfCode(ch) {
  const u = ch.codePointAt(0);
  if (u === 9) return 32;                              // tab -> space
  if ((u >= 32 && u <= 126) || (u >= 160 && u <= 255)) return u;
  const m = PDF_CP1252[u];
  if (m !== undefined) return m;
  pdfUi.pdfLossy = true;
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

/* A PDF literal string. Escaping to octal above 126 keeps every byte we ever
   append <= 0x7F, which is what lets `String.length` stand in for byte length
   when the xref offsets are computed. */
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

// Fixed-notation numbers: a PDF has no exponent syntax, and 1e-7 is a syntax
// error rather than a rounding difference.
function pdfNum(n) {
  if (!isFinite(n)) n = 0;
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

/* `white-space: pre-wrap` + `overflow-wrap: break-word`, measured in Helvetica.
   Hard breaks are honoured; a word wider than the box breaks mid-word rather
   than overflowing it, which is what keeps a note frame inside its edge cap
   (issue #53). */
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
// `width: max-content` — the widest hard line, i.e. what the box measures when
// nothing is allowed to soft-wrap. This is how a note frame shrink-wraps.
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
   Board coordinates in, operators out. Every method returns `p` so the
   drawing code below reads as a sequence rather than a pile of pushes.
   The larger furniture (rounded paths, frames, text, the scratch-out)
   lives in the free `draw*`/`rrectPath` functions below — each takes `p`
   and holds the verbatim body — so this builder stays a table of
   one-line delegates rather than 100 lines of nesting. */
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

// Rounded rect as a path; radius 2 everywhere, as everywhere in the CSS.
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

// A CSS border is drawn inside the box; a PDF stroke straddles the path.
// Inset by half the width so a 2px frame lands where the browser puts it.
function drawFrame(p, x, y, w, h, r, bw, bg) {
  if (bg) { p.fill(bg); p.rrect(x, y, w, h, r); p.raw('f'); }
  p.strokeColor(PDF_INK).lineWidth(bw);
  p.rrect(x + bw / 2, y + bw / 2, w - bw, h - bw, Math.max(0, r - bw / 2));
  return p.raw('S');
}

// The title compartment (B38, issue #52): the sheet's own top edge is its
// fourth side, so only three are drawn — down the left, across the bottom,
// back up the right, one path, inset by half the border width same as
// `frame`. No radius: at the export's 0.581 A4 scale the 2px CSS corner is
// ~1pt, and a three-segment path is honest about which sides exist.
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

/* One line of text on a baseline. The text matrix cancels the page flip;
   without it every glyph would render upside down. */
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
    // Centring measures the line sans trailing spaces: pre-wrap hangs
    // them on screen, so counting them would shift the export (B62).
    if (align === 'center') tx = x + (w - pdfTextW(s.replace(/ +$/, ''), bold, size)) / 2;
    else if (align === 'right') tx = x + w - pdfTextW(s, bold, size);
    p.text(s, tx, pdfBaseline(top + i * lh, lh, size), size, bold, color);
  }
  return p;
}

/* The scratch-out: the three repeating-linear-gradients of styles.css §4.3
   as three families of ruled lines. Clip first — this fills whatever the
   current clip allows. Angles are CSS's, and in a y-down space a positive
   angle rotates clockwise on screen, same as CSS reads them. */
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
   Object numbers are fixed rather than allocated: catalog 1, pages 2, the two
   fonts 3 and 4, then page/content pairs from 5. Offsets are counted off the
   string as it grows, which is only sound because every byte appended is
   ASCII — pdfStr guarantees it for the one place user text gets in. */
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
  // No dates in /Info: without them the same unchanged board exports to
  // byte-identical files, which is both a nice property and a cheap test.
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

  // The offsets above are string indices. They are byte offsets only because
  // every byte we append is 7-bit — pdfStr octal-escapes the one path user text
  // takes in. Assert it rather than trust it: a stray non-ASCII character
  // shifts every entry and presents as "damaged file", which is a wretched bug
  // to find later.
  if (/[^\x00-\x7F]/.test(out)) throw new Error('pdf: non-ascii byte in stream');
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xFF;
  return bytes;
}

/* ---- Page 1: the board ---------------------------------------------------
   Geometry is styles.css read against the 900x1000 sheet: the 2.6667% gutter
   is 24, the card is 280..620 (37.7778%, B35), so the Components zone ends at
   272 and Requirements starts at 628 — the card's edges ±the 8px gap. Draw
   order is the stacking order — the card must cover the band rule (B33), and
   notes sit above every piece of furniture. */
export const EXPORT_GEO = {
  gutter: 24,
  // B47's band formula, the same law the screen derives --rule-y from (the
  // shared bandRuleYFor, with B76's label moved below the rule so it no
  // longer budgets above it), resolved per record in exportRuleY() against
  // THIS sheet's zone widths. bandTop/bandGap stay literal here: the [11c]
  // tripwire recomputes the formula from EXPORT_GEO's own source terms, so
  // they are part of the test contract — they MUST equal BAND_TOP/BAND_GAP.
  bandTop: 14, bandGap: 8,
  compL: 24, compR: 272, reqL: 628, reqR: 876,
  // The compartment starts at the sheet's own top edge (B38, kept by B47) and
  // overhangs the rule by 22; cardPadTop is its top padding (band-top + 6).
  cardL: 280, cardW: 340, cardTop: 0, cardOverhang: 22, cardPad: 12, cardPadTop: 20,
  // Both sections size to their MEASURED content from a floor (UIUX
  // §3.1/§3.2, B73); the lot's ceiling is half the sheet, applied in
  // exportLotH — one law with the screen, the export's own number (B34).
  // lotHead/lotRow ARE the screen's LOT_HEAD/LOT_ROW — shared constants.
  lotHead: LOT_HEAD, lotRow: LOT_ROW, lotHeaderY: 8, lotItemsY: 34,
  headSize: 15, headLH: 19.5,          // title, anchor text, lot header
  labelSize: 13, labelLH: 16.9,        // the band's nomenclature (13 x 1.3, B54)
  labelPadX: 6, labelPadY: 2,          // the tab that frames it below the rule (B76)
  lotSize: 16, lotLH: 23.2,            // 16px / 1.45
  noteSize: 17, noteLH: 23.8,          // 17px / 1.4
  border: 2, radius: 3, notePadX: 12, notePadY: 10,   // radius mirrors B49 by hand
  linkWidth: 1.5,                      // the note-link hairline (issue #142, B91)
};

  // The band sizes to its tallest zone (B47), on the export's own frame: line
  // counts come from pdfWrap against the 248-unit zones — the same law as the
  // screen, not the same number, because the export is its own sheet (B34).
  // The rule-y formula itself is the shared bandRuleYFor (B47/B76).
function exportRuleY(rec) {
  const g = EXPORT_GEO;
  let lines = 2;
  for (const z of [{ text: rec.components, w: g.compR - g.compL },
                   { text: rec.requirements, w: g.reqR - g.reqL }]) {
    if (z.text) lines = Math.max(lines, pdfWrap(z.text, true, g.headSize, z.w).length);
  }
  return bandRuleYFor(lines);
}
const exportLotH = (rec) => {
  const g = EXPORT_GEO;
  // Sum the same wrapped row heights the draw loop uses, from the two-row
  // floor, capped at half the sheet (B73) — the screen's law on the export's
  // own frame (B34). The draw loop still clips the excess past the cap.
  let sum = 0;
  for (const item of rec.parkingLot || []) {
    const lines = pdfWrap(item.text, false, g.lotSize, EXPORT_W - 2 * g.gutter);
    sum += Math.max(g.lotRow, lines.length * g.lotLH + 4);
  }
  return Math.min(g.lotHead + Math.max(2 * g.lotRow, sum),
                  Math.round(EXPORT_H * LOT_MAX_FRAC));
};

// The similarity transform (B64), resolved against the export sheet instead
// of the viewport — exportK is the shared noteKFor with EXPORT_W/EXPORT_H
// standing in for the frame. One LAW shared with the screen, not one number:
// each frame takes its own min, so notes of one authoring cohort keep their
// figure exactly, while a mixed-cohort board can relate its cohorts
// differently here than on a given screen — inherent to min-k and owned in
// B64's costs. Stored x/y are read only — B21's "committed positions are
// permanent" is not ours to break. Legacy notes never reach here: B93's boot
// migration adopted every rh-less note onto the single min-k path before
// first paint, so the export reads the same unified geometry the screen
// renders (issue #141).
const exportK = (n) => noteKFor(n, EXPORT_W, EXPORT_H);
export const exportX = (n) => n.x * exportK(n);
const exportY = (n) => n.y * exportK(n);

// Border box of a note, before its own scale — `width: max-content` capped at
// the export sheet's right edge, height from however many lines that width
// produces. The cap IS noteMaxW (issue #53, B39; B64): since the law became
// pure authored units — (rw − x)/scale, no frame constant left in it — the
// export calls the screen's own function rather than restating it, so the
// two wrap widths cannot drift apart by construction.
export function exportNoteBox(note) {
  const g = EXPORT_GEO;
  const chrome = 2 * g.notePadX + 2 * g.border;
  const cap = noteMaxW(note);
  const maxContent = cap - chrome;
  // Floor the content box at the NOTE_MIN_W minimum the screen draws (B84), so a
  // short note exports the same width it renders — B34's on-screen fidelity. The
  // floor is ≤ maxContent because cap ≥ NOTE_MIN_W, and the text centres in the
  // wider box exactly as it does on screen (B62).
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
  // Paper edge to edge, not a paper rectangle floating on white. Paper tone is
  // named in styles.css §1 as part of the identity, alongside the frame and the
  // scratch-out, and the margin is margin — not a desk. B17 and B32 spent two
  // rulings deleting the letterbox; this is not the place to reintroduce it.
  p.fill(PDF_PAPER).rect(0, 0, A4_W, A4_H).raw('f');
  p.cm(scale, 0, 0, scale, mx, my);
  p.fill(PDF_PAPER).rect(0, 0, EXPORT_W, EXPORT_H).raw('f');   // the sheet itself
  const ruleY = exportBand(p, rec);
  exportCard(p, rec, ruleY);
  exportLot(p, rec);
  exportLinks(p, rec);
  exportNotes(p, rec);
  return p.Q().stream();
}

// The band reads content, then the rule as the band's bottom edge — full
// width (B47) — with each header hanging just below the rule as a tab in the
// rule's own ink (B76). Returns the rule's y so the card can overhang it.
function exportBand(p, rec) {
  const g = EXPORT_GEO;
  const ruleY = exportRuleY(rec);
  const zones = [
    { text: rec.components, label: 'Components', l: g.compL, r: g.compR },
    { text: rec.requirements, label: 'Requirements', l: g.reqL, r: g.reqR },
  ];
  for (const z of zones) {
    const w = z.r - z.l;
    if (z.text) {
      // Content hangs from the band's top (B47). Not clipped to the zone: on
      // screen the zone sets no overflow, so a long entry flows down over the
      // canvas, and the export draws what the screen draws (B34).
      p.lines(pdfWrap(z.text, true, g.headSize, w), z.l, w, g.bandTop,
              g.headSize, g.headLH, true, 'left');
    }
    // The header hangs below the rule as a tight tab in the rule's own ink
    // (B76): a filled PDF_INK box, top edge on the rule, centred in its zone.
    // The rule is dark here (unlike the mid-light --frame on screen), so the
    // label reverses to the paper tone rather than screen's --ink-dark.
    const labelW = pdfTextW(z.label, true, g.labelSize) + 2 * g.labelPadX;
    const boxX = z.l + (w - labelW) / 2;
    p.fill(PDF_INK).rect(boxX, ruleY, labelW, g.labelLH + 2 * g.labelPadY).raw('f');
    p.lines([z.label], boxX, labelW, ruleY + g.labelPadY,
            g.labelSize, g.labelLH, true, 'center', PDF_PAPER);
  }
  p.fill(PDF_INK).rect(0, ruleY, EXPORT_W, 1).raw('f');
  return ruleY;
}

// The title compartment. ruleY comes from exportBand — the compartment's
// border-top is no longer drawn (B38, issue #52), and it overhangs the band's
// rule by 22, occluding it (B47).
function exportCard(p, rec, ruleY) {
  const g = EXPORT_GEO;
  const title = rec.title || '';
  const cardContentW = g.cardW - 2 * g.cardPad - 2 * g.border;
  const titleLines = title ? pdfWrap(title, true, g.headSize, cardContentW) : [];
  const cardH = Math.max(ruleY + g.cardOverhang,
                         titleLines.length * g.headLH + g.cardPadTop + g.cardPad + g.border);
  p.frameOpenTop(g.cardL, g.cardTop, g.cardW, cardH, g.border, PDF_PAPER);
  if (titleLines.length) {
    // justify-content: center — the block is centred in the space between the
    // top padding and the bottom padding + border, then each line is centred
    // in the block.
    const blockH = titleLines.length * g.headLH;
    const top = g.cardPadTop + (cardH - g.cardPadTop - g.cardPad - g.border - blockH) / 2;
    p.lines(titleLines, g.cardL + g.border + g.cardPad, cardContentW, top,
            g.headSize, g.headLH, true, 'center');
  }
}

// Parking Lot: full-bleed to the sheet's bottom with its content on the
// gutter (UIUX §3.2), sized by its rows from the two-row floor. #lot-items
// is overflow:hidden, so the export clips too — otherwise a long lot walks
// off the bottom of the page.
function exportLot(p, rec) {
  const g = EXPORT_GEO;
  const lotH = exportLotH(rec);
  const lotTop = EXPORT_H - lotH;
  const lotW = EXPORT_W - 2 * g.gutter;
  p.fill(PDF_INK).rect(0, lotTop, EXPORT_W, 1).raw('f');       // full width (B47)
  p.lines(['Parking Lot'], g.gutter, lotW, lotTop + g.lotHeaderY,
          g.headSize, g.headLH, true, 'left');
  const itemsTop = lotTop + g.lotItemsY;
  const itemsH = lotH - g.lotItemsY;
  p.q().rect(g.gutter, itemsTop, lotW, itemsH).clip();
  let ly = itemsTop;
  for (const item of rec.parkingLot || []) {
    if (ly >= itemsTop + itemsH) break;
    const lines = pdfWrap(item.text, false, g.lotSize, lotW);
    const rowH = Math.max(g.lotRow, lines.length * g.lotLH + 4);
    if (item.state === 'complete') {
      // Hatching only. The words are not in the file at all, which is a
      // stronger promise than the screen's "no screenshot recovers it".
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

// Links UNDER the notes (issue #142, B91): a thin line between two note centres,
// drawn in sheet space (not the per-note transform), so it sits below the cards
// it joins — the same z-order as the screen (the link layer is below notes). A
// neutral hairline suits the export's paper/ink/shade palette better than a
// board-hue line; a dangling link (endpoint gone) is skipped, as on screen.
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
    // A highlighted note fills amber, matching the screen; a completed one still
    // fills first, then the scratch draws over it (issue #105, B71).
    p.frame(0, 0, box.w, box.h, g.radius, g.border, note.highlighted ? PDF_HILITE : PDF_PAPER);
    if (note.state === 'complete') {
      p.q().rrect(0, 0, box.w, box.h, g.radius).clip().scratch(box.w, box.h).Q();
    } else {
      // Centred in the content box, as the screen draws it (issue #82, B62).
      p.lines(box.lines, g.border + g.notePadX, box.content, g.border + g.notePadY,
              g.noteSize, g.noteLH, false, 'center');
    }
    p.Q();
  }
}

/* ---- Page 2+: the text ---------------------------------------------------
   The board again, as prose — so the file is searchable and readable at a
   glance. Completed items keep their place in the order but not their words. */
/* The page machinery exportTextPages runs on, extracted verbatim: opens and
   closes A4 text pages and lays paragraphs under a running baseline. The
   old closures become the returned object's members (`cur` is the live
   canvas, `y` reads and writes the baseline). */
function textPager() {
  const L = PDF_MARGIN, W = A4_W - 2 * PDF_MARGIN;
  const BOTTOM = A4_H - PDF_MARGIN;
  const streams = [];
  let p = null, y = 0;

  const openPage = () => {
    p = pdfCanvas();
    p.q().flip(A4_H);
    p.fill(PDF_PAPER).rect(0, 0, A4_W, A4_H).raw('f');   // same paper as page 1
    y = PDF_MARGIN;
  };
  const closePage = () => { if (p) { streams.push(p.Q().stream()); p = null; } };
  const room = (h) => { if (y + h > BOTTOM) { closePage(); openPage(); } };

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

function exportTextPages(rec) {
  const t = textPager();

  const bullets = (label, items) => {
    if (!items.length) return;
    t.heading(label);
    for (const it of items) {
      // A completed item keeps its place in the order but not its words —
      // the same promise the scratch-out makes on page 1.
      const done = it.state === 'complete';
      const color = done ? PDF_SHADE : PDF_INK;
      const lines = pdfWrap(done ? '— completed —' : it.text, false, 10, t.W - 14);
      t.room(14);                                  // keep the bullet with its first line
      t.cur.text('•', t.L, pdfBaseline(t.y, 14, 10), 10, false, color);
      for (const line of lines) {
        t.room(14);
        if (line.length) t.cur.text(line, t.L + 14, pdfBaseline(t.y, 14, 10), 10, false, color);
        t.y += 14;
      }
    }
  };

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

/* ---- The calendar's 7-day reference sheet (issue #145, R1's Export) ------
   One text page: the rolling week as it renders — today first, one line per
   event, completed events reading "— completed —" (§7's bytes property).
   Built from the same primitives as exportTextPages; reads STORAGE (the
   computed window, live events), never the squeezed frame (R6 clause 2). */
export async function exportCalPdf() {
  try {
    flushSave();
    const all = await idbGetAll();
    const events = eventsOf(all);
    const L = PDF_MARGIN, R = A4_W - PDF_MARGIN, W = R - L;
    const stream = (() => {
      const p = pdfCanvas();
      p.q().flip(A4_H);
      p.fill(PDF_PAPER).rect(0, 0, A4_W, A4_H).raw('f');
      let y = PDF_MARGIN;
      const room = (h) => { if (y + h > A4_H - PDF_MARGIN) throw new Error('cal-pdf-overflow'); };
      const para = (str, size, lh, bold, color) => {
        for (const line of pdfWrap(str, bold, size, W)) {
          room(lh);
          if (line.length) p.text(line, L, pdfBaseline(y, lh, size), size, bold, color);
          y += lh;
        }
      };
      para(COPY.calTitle, 18, 24, true, PDF_INK);
      para(formatDate(Date.now()), 9, 13, false, PDF_SHADE);
      y += 6;
      for (const day of calWindow()) {
        room(30); y += 12;
        para((day.today ? COPY.calToday + ' — ' : '') +
          day.date.toLocaleDateString(undefined, { weekday: 'long' }) + ' ' + calMD(day.date),
          11, 15, true, PDF_INK);
        p.fill(PDF_SHADE).rect(L, y + 1, W, 0.5).raw('f');
        y += 6;
        const evs = calEventsOf(events, day.key);
        if (!evs.length) continue;
        for (const ev of evs) {
          const done = ev.state === 'complete';
          const color = done ? PDF_SHADE : PDF_INK;
          for (const line of pdfWrap(done ? '— completed —' : ev.text, false, 10, W - 14)) {
            room(14);
            if (line.length) p.text(line, L + 14, pdfBaseline(y, 14, 10), 10, false, color);
            y += 14;
          }
        }
      }
      return p.Q().stream();
    })();
    const bytes = pdfAssemble([stream], COPY.calTitle);
    const d = new Date();
    const pad = (n) => (n < 10 ? '0' : '') + n;
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }),
      'calendar-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '.pdf');
  } catch (e) {
    showNotice(COPY.exportError, 'export', UNDO_MS);
  }
}

/* ---- The menu action ---------------------------------------------------- */

// A filename someone can find later: the board's own words, then the day it
// started. An untitled board has no words, so the date carries it alone.
function pdfFilename(rec) {
  const slug = String(rec.title || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
    .replace(/-+$/, '');
  const d = new Date(rec.createdAt || Date.now());
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const stamp = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  return (slug || 'board') + '-' + stamp + '.pdf';
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Long enough for every engine to have started the write before the URL goes.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/* Export runs off the board RECORD, not the live DOM: the menu belongs to a
   board card, and the card is usually not the board that happens to be open.

   Which copy of the record, though. renderPane/renderList close over an
   idbGetAll() snapshot taken when the rail was drawn, so right-clicking the
   ACTIVE card after typing would export the board as it was some keystrokes
   ago. `current` is the one that is ahead of storage (saves are debounced by
   SAVE_DEBOUNCE), so it wins for the open board; every other card reads back
   from IndexedDB in case its snapshot has aged. */
export async function exportBoardPdf(board) {
  try {
    const src = (state.current && state.current.id === board.id)
      ? state.current : ((await idbGet(board.id)) || board);
    // B8/B31's sweep on a COPY. Records reach the menu straight from
    // idbGetAll(), so they have never been through renderBoard's sanitize, and
    // a whitespace husk would export as an empty framed box. Copying rather
    // than filtering in place matters: `src` may be `current`, and mutating
    // live state from an export is exactly the silent write B21 forbids.
    const keep = (r) => (r.text || '').trim().length > 0;
    const rec = {
      title: src.title, requirements: src.requirements, components: src.components,
      createdAt: src.createdAt || board.createdAt,
      notes: (src.notes || []).filter(keep),
      parkingLot: (src.parkingLot || []).filter(keep),
    };
    pdfUi.pdfLossy = false;
    const bytes = buildBoardPdf(rec);
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), pdfFilename(rec));
    if (pdfUi.pdfLossy) showNotice(COPY.exportLossy, 'export', UNDO_MS);
  } catch (e) {
    showNotice(COPY.exportError, 'export', UNDO_MS);
  }
}

/* --- 10.6 JSON backup: export all, import merged (issue #140, B92; payload
   v2 per B123 — issue #231) ---------------------------------------------- */

/* The whole library leaves as one file. PDF is a sheet ABOUT a board; JSON is
   the record set itself, so this is full fidelity: links (B91) ride along and
   calendar events ride in their own top-level `calendarEvents` array (B123 —
   v1 files swept them into `boards`, where the importer's board normalization
   silently dropped every one; the FILE now separates what the STORE mixes).
   `boards` carries board records only — `eventsOf` over it is empty by
   construction. flushSave() first — saves are debounced by SAVE_DEBOUNCE, so
   idbGetAll() alone could read the open board some keystrokes stale (the same
   staleness exportBoardPdf's `current` rule answers, one board wide). The
   stamp lands only if an edit is pending, so exporting does not reorder the
   list (B69's law, flushSave's own reading). */
export async function exportAllJson() {
  try {
    flushSave();
    const all = await idbGetAll();
    const calendarEvents = eventsOf(all);
    const payload = {
      app: 'the-boards',
      version: 2,
      exportedAt: new Date().toISOString(),
      boards: all.filter(r => !calendarEvents.includes(r)),
      calendarEvents,
    };
    const d = new Date();
    const pad = (n) => (n < 10 ? '0' : '') + n;
    const stamp = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    downloadBlob(new Blob([JSON.stringify(payload)], { type: 'application/json' }),
      'boards-backup-' + stamp + '.json');
  } catch (e) {
    showNotice(COPY.exportError, 'export', UNDO_MS);
  }
}

/* What a backup file may name as a board category. Anything else reads as the
   read-site default (B21/B67: 'unsorted') — a file from a future version with
   a fifth category must still import, landing where the list already files
   unknown cats, rather than being rejected wholesale. */
const IMPORT_CATS = new Set(['todo', 'idea', 'unsorted', 'learning']);

/* One imported board, normalized to this app's record shape. Every field is
   coerced, not trusted: a backup is data that has been OUT of the device, and
   the import must not hand a hostile or hand-edited file a live record. ids
   are re-stamped when absent or not strings, notes/lots/links are rebuilt
   field-by-field, and whitespace husks are swept HERE (the B8/B31 choke that
   renderBoard would otherwise apply on first sight — swept at the door, they
   never enter storage at all). Returns null for a board with no surviving
   content — an empty shell has nothing to restore. */
function normalizeImportedBoard(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const now = Date.now();
  const text = (v) => (typeof v === 'string' ? v : '');
  const keep = (r) => r.text.trim().length > 0;
  const notes = (Array.isArray(raw.notes) ? raw.notes : [])
    .map((n) => (n && typeof n === 'object') ? {
      id: typeof n.id === 'string' && n.id ? n.id : uuid(),
      text: text(n.text).trimEnd(),
      x: Number.isFinite(n.x) ? n.x : 0,
      y: Number.isFinite(n.y) ? n.y : 0,
      rw: Number.isFinite(n.rw) ? n.rw : LOGICAL_W,
      rh: Number.isFinite(n.rh) ? n.rh : LOGICAL_H,
      scale: Number.isFinite(n.scale) && n.scale > 0 ? n.scale : 1.0,
      state: n.state === 'complete' ? 'complete' : 'active',
      highlighted: n.highlighted === true,
    } : null)
    .filter((n) => n && keep(n));
  const parkingLot = (Array.isArray(raw.parkingLot) ? raw.parkingLot : [])
    .map((r) => (r && typeof r === 'object') ? {
      id: typeof r.id === 'string' && r.id ? r.id : uuid(),
      text: text(r.text).trimEnd(),
      state: r.state === 'complete' ? 'complete' : 'active',
    } : null)
    .filter((r) => r && keep(r));
  if (!notes.length && !parkingLot.length &&
      !text(raw.title).trim() && !text(raw.requirements).trim() && !text(raw.components).trim()) {
    return null;                       // nothing survived; nothing to restore
  }
  const noteIds = new Set(notes.map((n) => n.id));
  const links = (Array.isArray(raw.links) ? raw.links : [])
    .filter((l) => l && typeof l === 'object' &&
      typeof l.a === 'string' && typeof l.b === 'string' &&
      noteIds.has(l.a) && noteIds.has(l.b) && l.a !== l.b)
    .map((l) => ({ id: typeof l.id === 'string' && l.id ? l.id : uuid(), a: l.a, b: l.b }));
  const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : now;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uuid(),
    createdAt,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : createdAt,
    category: IMPORT_CATS.has(raw.category) ? raw.category : 'unsorted',
    title: text(raw.title),
    requirements: text(raw.requirements),
    components: text(raw.components),
    notes,
    parkingLot,
    links,
    // The calendar link (issue #145): coerced like every other field. cal must
    // be a YYYY-MM-DD key or the link is dropped; calReq rides only when finite.
    // An OLD build importing a NEW backup keeps these extra fields verbatim in
    // the payload object — read-site defaulting means it simply ignores them,
    // and a re-export carries them on (PRD §4.1's idiom, both directions).
    cal: /^\d{4}-\d{2}-\d{2}$/.test(raw.cal) ? raw.cal : undefined,
    calReq: Number.isFinite(raw.calReq) ? raw.calReq : undefined,
  };
}

/* One imported calendar event, normalized like a board (B123): coerced, not
   trusted. ids re-stamped when absent, `date` must be a calKey-form
   YYYY-MM-DD or the event is dropped, `text` is trimmed, `state` reads as
   active unless the file says complete (newCalEvent's own default). Returns
   null for a record that cannot survive as an event. */
function normalizeImportedEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uuid(),
    date: raw.date,
    text: typeof raw.text === 'string' ? raw.text.trim() : '',
    state: raw.state === 'complete' ? 'complete' : 'active',
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
  };
}

/* Merge-import (the owner's ruling, issue #140): a board whose id already
   exists is OVERWRITTEN by the file's copy; new ids are ADDED. A backup-
   restore in miniature — the file's board is the truth for that id, the
   device keeps every board the file never mentions. B123 extends the same
   ruling to calendar events, type-aware: a v2 file carries them in the
   top-level `calendarEvents` array; a v1 file — whose exporter swept events
   into `boards`, where board normalization dropped every one (issue #231) —
   is salvaged by filtering the raw `boards` array through `eventsOf` BEFORE
   board normalization touches it. Events import by the same merge rule:
   overwrite by id, the device keeps every event the file never mentions. */
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
    ? payload.calendarEvents              // v2: events ride their own array
    : eventsOf(payload.boards);           // v1 salvage: events rode `boards`
  const incoming = payload.boards
    .map(normalizeImportedBoard)
    .filter(Boolean);
  const incomingEvents = rawEvents
    .map(normalizeImportedEvent)
    .filter(Boolean);
  if (!incoming.length && !incomingEvents.length) {
    showNotice(COPY.importError, 'import', UNDO_MS);
    return;
  }
  flushSave();                          // the debounce must not write over the import
  let overwrittenCurrent = false;
  for (const rec of incoming) {
    await idbPut(rec);
    if (state.current && rec.id === state.current.id) {
      state.current = rec;                    // the open board's new self is the file's copy
      overwrittenCurrent = true;
    }
  }
  for (const ev of incomingEvents) await idbPut(ev);
  if (overwrittenCurrent) {
    state.dirty = false;                      // current was replaced wholesale, exactly ensureCurrentValid's reading
    renderBoard();
  }
  if (listOpen) await renderListSurface();
  else if (state.isWide) renderPane();     // the rail re-reads; the sheet is already right
  showNotice(COPY.imported, 'import', UNDO_MS);
}
