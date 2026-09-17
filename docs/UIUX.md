# UIUX.md — Zeved Boards

**Status:** v2. This is the rendering authority — the document `app.js`,
`styles.css` and `DECISIONS.md` have cited as `UIUX §x` since the first commit,
written down for the first time.

**How to read this with the other records.** `PRD.md` says what the product is
and what it must do; this says what it looks like and how it behaves under the
hand. Where the two disagree about a rendering decision, **this document wins** —
that is what "rendering authority" means, and `DECISIONS.md` A1 already resolved
one such conflict that way. `DECISIONS.md` remains the v1 reasoning history;
where §§ below supersede a numbered ruling, they say so by number.

Sections §1–§12 keep the meanings the code already cites. New v2 material is
numbered §13 and up, so no existing citation moves.

**The rendered reference.** This system was settled by rendered specimen sheets,
not prose — seven proof rounds, run outside the repo. The final sheet, **proof
sheet 7, "A Well, Swapped"**, is committed at
`proofs/proof-7-a-well-swapped.html`; its own verification table records the
swap that ended the process (the band takes `#020812` and is the deepest surface
on the page; the card takes `#08152c` and separates by its border — 5.39:1 on the
card, 5.95:1 on the band). The three `fonts/` files are extracted from that
sheet's embedded faces. Where this document and that render disagree, the render
is the earlier authority and the disagreement is a defect *here*.

---

## §1 Governing law

> **If you have to think about the interface, it failed.
> Every pixel earns its place.**

And its corollary, which predates this document and survives it:

> **Identity comes from structure — frame, scratch-out, surface tone — never
> costume.**

**And the test that separates the two, which a flat surface cannot pass.** A
gradient present because interfaces have gradients is costume. A gradient that
encodes something true about the page is structure. The distinction is not the
technique but the job: the sheet's edge falloff (§2.8) renders the page's bound
on the mobile path, where `renderScale = 1` leaves no letterbox to draw an edge
against — a thing the product claims about itself and could not otherwise show.
**Anything that cannot name its job in one sentence is costume and comes out.**

Two consequences hold throughout, without exception:

- **Never colour alone.** Every state distinguished by colour is also
  distinguished by geometry, position or texture. Completion is a texture. Focus
  is a ring. Destructive is last, behind a hairline. The toast's Undo is
  underlined. Selection is an outline.
- **Elevation means "temporary, above the page."** Shadow is reserved for
  transient surfaces — menu, toast, drag ghost. **Notes carry no shadow.** A note
  is *on* the page, not floating over it.

### §1.1 The register

The board should feel like a place you are glad to return to. Not
productive-anxious, not gamified, not neutral-corporate.

The imagery is **calm water** — and note the register carefully: water at depth
and at dusk, not noon glare. That is why the palette is dark. Deep water is
peaceful; a bright white productivity surface is not. The page reads top to
bottom as one scene — water closing each end of the sheet, the deep between —
and the note is the one lit thing on the deep (B58, ruled from the rendered
what-if the way every scene decision before it was ruled).

This does not license decoration. Peace is produced by restraint, depth and
consistency. Where a value below is decorative rather than structural, it is
wrong and should be removed.

---

## §2 Design tokens

### §2.1 One theme

**The app is dark-only.** The light/dark pair driven by `prefers-color-scheme`
(B16) is retired — the whole light `:root` and the `prefers-color-scheme: dark`
block are **removed, not overridden**.

This is not a default with an escape hatch. `PRD §1.2` forbids the setting: the
app asks nothing of the person, and a theme is a question. One identity, no
choice to make.

### §2.2 The surface ladder

**One of these is not a value.** The water is a *field* (§2.8), grounding the
two sections that close the sheet. It is given as a range, and **every ratio in
this document is stated against the worst extreme of its range**, never against
a midpoint.

| Token | Value | What it is | Rel. luminance |
|---|---|---|---|
| `--deep` | `#020812` | the canvas — the deepest surface on the page (B58) | 0.0023 |
| `--chrome` | `#020812` | the room behind the page — the ground under the menu, the toast, the board list and the desktop rail. The deep's value doing a second job, off the page (B52/B58) | 0.0023 |
| `--card` | `#08152c` | the title compartment, sitting just above the deep | 0.0077 |
| `--water` | `#34697f` → `#255265` → `#163646` | **the water, as a field** — the band and the Parking Lot, closing both ends of the sheet (§2.8) | 0.1237 … 0.0325 |
| `--frame` | `#698ebf` | the card's border and both full-width rules — §2.5, B61 | 0.2611 |
| `--note` | `#a0d4da` | the note | 0.5962 |

**The hexes above are the To-Do board's.** Since B67 (and B74, issue #112; and
issue #168) the ladder has five bindings — one per board type, plus the
Calendar view — the same seven rungs at five hues, each rung holding the
luminance in the right-hand column exactly. §2.2.2 gives the other four. Every
ratio in this document is computed from that column, so every ratio in this
document holds on all five; where a number is genuinely per-ladder, it is
printed per-ladder (§4.3 is the only such table).

`--furniture` was retired by B46; `--band` and the `--shelf` texture are
retired by B58 — the second swap renamed the deep's token honestly
(`--band` → `--deep`, the field's stops → `--water-*`) and removed the sand
from the application entirely (its fates are in §16.2). `--line` was already
deleted (§2.3).

**The page reads top to bottom as one scene:** water at the top, closing the
band; the deep through the middle, where everything the person makes lives;
water again at the foot, closing the Parking Lot. The canvas is the deepest
thing on the page, and the card sits fractionally above it at 1.10:1,
separated by its border rather than by its fill (§2.5).

**The room behind the page is the same deep.** `--chrome` is not a new rung:
chrome touches neither the water nor the card (the menu and the toast float on
elevation, the list replaces the page, the rail sits beside it), so a new
value would be a rung with no adjacency to earn it. It shares the canvas's
value — a summoned surface over the deep separates by its elevation, which is
elevation's whole job (§2.4) — a rail card's fill (the water's own top stop)
holds 3.32:1 behind its 0.40 hairline edge, and light ink reads at 18.33:1.
**`--chrome` does not rotate with the board type** (B67): there is one room,
and it is behind all four boards at once, so it keeps `#020812` — the To-Do
deep's value — whichever board is open. Taken deliberately, the consequence is
that a green board's OS chrome, menu, toast and board list are still the blue.
Settled by proof rounds 8–9 (B52) and carried through the swap (B58); the
rendered references are `proofs/proof-9-a-well-furnished.html` and
`proofs/proof-10-the-second-swap.html`. **The platform edge is the same
room** (B55): the one `theme-color` meta and `manifest.json`'s
`background_color`/`theme_color` all wear `#020812`.

> **The note is the brightest surface on the page — without qualification,
> for the first time.** B46 had to scope the claim to the water because the
> sand outshone the note at 0.6576; B58 retired the sand, and at 0.5962 over
> the deep's 0.0023 the note reads at **12.36:1** — the strongest the note
> has ever been. The old sentence — "the note is the brightest thing on the
> board because it is the only thing the person *placed*" — is simply true
> now (`PRD §1.4`, `PRD §9.2`). Transient chrome is above the page, not part
> of the scene (B52), so nothing summoned counts against it.

**The desk is not a surface, and there is no desk token.** Earlier drafts
carried one, with an OLED rationale — and it described a condition that does not
occur: `applyLayout()` derives both logical dimensions by dividing the viewport
by the render scale, on *both* paths, so the sheet fills its area exactly at
every viewport. The code says so in its own comments twice. The desk appears for
260ms during a desktop board swap, when `#board` crossfades to `opacity: 0`, and
nowhere else; the page behind it keeps a plain black background, which is a
one-line fact about `html`, not a rung on this ladder. The token and every row
it occupied are **retired**.

### §2.2.1 The generative law

Seven hand-picked values with verified ratios are seven assertions; they say
nothing about what an eighth surface would be. The ladder is therefore stated as
a law, and the values above are its output:

1. **One axis: luminance.** A surface's position in the app is its position on
   the ladder. **Within one scene, nothing is distinguished from another
   surface by hue alone.** The qualifier is B67's, and it narrows nothing this
   rule ever governed: the rule is about *rungs* — what tells the card from the
   deep, the water from the canvas — and the answer must stay luminance,
   because hue is the one channel a person's eyes may not deliver. §2.2.2
   rotates the whole ladder at once, every rung together, holding each rung's
   luminance to the 4dp printed above; it therefore distinguishes *scenes*,
   not surfaces, and no reading of the page depends on it.
2. **One hue family for the page, with a job per depth** (B58 collapsed the
   second). Everything on the page is one blue family: the deep and the card
   as the recessed ground, the water as the sections that close the sheet, the
   note as the lit thing. Sand held the second family while the shelf was
   *ground for things at rest*; the swap made the water that ground, and the
   family left with its job. A new family must bring a new job with it;
   `--danger` (§2.6) is the single warm value and it is not a ground.
3. **Rungs are separated by their function, not by an interval.** The dark rungs
   sit inside one luminance decade because they are all "behind": the card reads
   at 1.10:1 against the deep *deliberately* — one recessed mass with a seam in
   it, separated by linework, not by depth (§2.5). The note sits an order of
   magnitude above because it is "in front". The largest gap in the ladder is
   between the water's top stop (0.1237) and the note (0.5962), and it is where
   the ink flips (§2.3.1).
4. **A new rung must clear the crossover test before it exists** (§2.3.1,
   §2.3.2). Adding a surface means computing its luminance, reading its ink pole
   off the crossover, and confirming it is outside the forbidden band. A value
   that cannot carry text is not a ground; it is a line.

Deriving the rungs from an interval — an even luminance ladder, a fixed OKLCH
step — was considered and is wrong here: it would push the deep and the card far
enough apart to read as two depths, when their job is to read as one.

**Impermanent:** the hex values. The law is not.

### §2.2.2 The ladder rotates with the board type

**A board type is a whole scene, not a rung on one** (B67, issue #96; a fourth
scene added by B74, issue #112; a fifth binding added by issue #168). To-Do
boards keep the water blue above. Idea boards take a deep hunter green, Note
boards a deep violet, Learning boards a pale rose — and each is *the same
ladder*, rotated in hue and in nothing else. The Calendar view (§3.4) wears a
fifth binding of the same ladder, rotated to orange and bound on `#cal-view`
the way To-Do binds on `:root` — it is a body-level section, so the rebinding
re-scopes exactly the calendar chrome and nothing else.

| Rung | To-Do | Idea | Note | Learning | Calendar | Rel. luminance |
|---|---|---|---|---|---|---|
| `--deep` | `#020812` | `#000a06` | `#0c0512` | `#11040b` | `#110501` | 0.0023 |
| `--card` | `#08152c` | `#001a0e` | `#1e0f28` | `#260e12` | `#251002` | 0.0077 |
| `--water-top` | `#34697f` | `#486b49` | `#6d5b83` | `#855562` | `#815a42` | 0.1237 |
| `--water-mid` | `#255265` | `#345439` | `#534769` | `#6a414c` | `#694432` | 0.0737 |
| `--water-bot` | `#163646` | `#1f3825` | `#382e47` | `#472a35` | `#462d1a` | 0.0325 |
| `--water-bot-a` | `22 54 70` | `31 56 37` | `56 46 71` | `71 42 53` | `70 45 26` | (the bottom stop, as channels) |
| `--frame` | `#698ebf` | `#52997f` | `#9d80b9` | `#b57a9b` | `#b48158` | 0.2611 |
| `--note` | `#a0d4da` | `#b9d2b2` | `#cec6ed` | `#e6c2c9` | `#e3c6aa` | 0.5962 |

**The derivation is hue and only hue.** Each rung was converted to OKLCH, its
hue moved, and the result re-solved against sRGB so that its **WCAG relative
luminance reproduces the To-Do rung's** — the right-hand column is one number
per row because it is one number per row. The family's own internal hue spread
(the shipped blue runs 205° at the note to 261° at the card) is narrowed as it
rotates, so each scene reads as one hue rather than smearing across a 56° arc.
The Learning rose runs a tight ~345°–11° arc (crossing 0°); the Calendar orange
runs ~47°–66°:

| Rung | To-Do H / L / C | Idea H / L / C | Note H / L / C | Learning H / L / C | Calendar H / L / C |
|---|---|---|---|---|---|
| `--deep` | 251.6° / 0.132 / 0.027 | 171.0° / 0.129 / 0.025 | 309.1° / 0.136 / 0.032 | 345.6° / 0.136 / 0.031 | 51.5° / 0.134 / 0.029 |
| `--card` | 260.8° / 0.199 / 0.050 | 161.3° / 0.192 / 0.043 | 310.3° / 0.203 / 0.052 | 10.9° / 0.203 / 0.041 | 55.7° / 0.201 / 0.044 |
| `--water-top` | 227.5° / 0.494 / 0.066 | 145.1° / 0.491 / 0.067 | 304.7° / 0.504 / 0.066 | 2.1° / 0.507 / 0.066 | 52.4° / 0.503 / 0.063 |
| `--water-mid` | 228.2° / 0.415 / 0.059 | 148.3° / 0.413 / 0.059 | 300.2° / 0.424 / 0.057 | 2.5° / 0.427 / 0.059 | 46.6° / 0.424 / 0.059 |
| `--water-bot` | 232.7° / 0.317 / 0.047 | 150.7° / 0.314 / 0.046 | 302.3° / 0.323 / 0.045 | 355.6° / 0.325 / 0.046 | 57.3° / 0.323 / 0.048 |
| `--frame` | 255.7° / 0.639 / 0.085 | 167.8° / 0.629 / 0.083 | 307.3° / 0.648 / 0.089 | 345.1° / 0.650 / 0.085 | 59.3° / 0.645 / 0.085 |
| `--note` | 205.0° / 0.836 / 0.054 | 138.9° / 0.836 / 0.051 | 294.6° / 0.846 / 0.054 | 4.9° / 0.847 / 0.042 | 66.1° / 0.844 / 0.050 |

> **OKLCH lightness and chroma are the aiming coordinates, not the pinned
> ones.** They are held as closely as 8-bit sRGB allows — L within 0.010, C
> within 0.007 on the Idea and Note ladders; the Learning rose binds a little
> harder (L within 0.013, C within 0.012), and its note is deliberately paler
> than its aim (C 0.042 vs 0.054); the Calendar orange holds L within 0.009
> and C within 0.006, its card spending a little chroma to the pin (C 0.044
> against the blue's 0.050, where the sRGB maximum at that luminance is 0.049
> — the pin, not the gamut, is what spends it) — and they cannot be held
> *exactly*, because
> OKLab lightness and WCAG luminance are different functions and a hue rotation
> cannot preserve both. Luminance is the one that is pinned, because luminance
> is what every ratio in this document is made of, and it is what §2.2.1 rule 1
> means by "one axis". Where the two conflict, luminance wins. On Learning, the
> dark rungs (`--deep`, `--card`) also sit at To-Do's *near-exact* raw
> luminance, not merely its 4dp print, because they anchor the high-contrast
> ratios (18.33:1, 12.36:1) whose 2dp value is sensitive to the fourth decimal;
> being near-black, they have no visible chroma to spend there anyway.

**One place the gamut binds, recorded so it is not re-litigated.** `--card` on
the Idea ladder is `C = 0.043` against the blue's `0.050`, and `--deep` is
`0.025` against `0.027`. Both are the **sRGB maximum** available at that
luminance in that hue arc — verified by scanning every 8-bit triple. The blue
primary is very dark (luminance weight 0.0722), so a dark blue can push `B`
high and buy chroma almost free; green's weight is 0.7152, so a dark green must
keep `G` small and its chroma is capped. A greener dark card at this luminance
does not exist in sRGB, and no amount of searching will find one.

> **Because luminance is preserved, every ratio this document publishes is
> preserved.** §2.3's five ink pairings, §2.5's seven adjacencies, §2.7's ring
> table and §2.3.1's crossover are all functions of luminance alone, and B67
> moved no luminance (B74 added a fourth ladder the same way, issue #168 a
> fifth). `test/tokens.js`
> asserts each of them against **all five** ladders with a single expected
> number, so a hue that drags a rung off its luminance fails the suite rather
> than the eye.

**§2.2.1 rule 4 is satisfied for all twenty-eight new values** (fourteen from
B67, seven more from B74's Learning rose, seven more from issue #168's
Calendar orange). Every one is outside §2.3.2's
forbidden band (0.163–0.196), every ground below §2.3.1's 0.1788 crossover
still takes `--ink-light`, and every note still takes `--ink-dark` —
necessarily, since each sits at its To-Do rung's luminance.

**What does not rotate:** `--chrome` (§2.2 — one room, B55), the two ink poles
(§2.3 — ink is per surface, not per app, and rotating it would move the
crossover), and the three accents (§2.6 — they live on chrome). Rotating the
ink would also break §2.7's ring, whose whole claim is that the two poles are
complementary on every ground.

**Bound by rebinding, never by overriding.** The board is drawn by four layers
— the flat `var(--deep)` fill, the dither over it, the band's radial vignette
over its three-stop fall, and the Parking Lot mirroring it — and all four read
the tokens through `var()`. Rebinding the *names* under a `[data-cat]` scope
therefore carries the hue into all four at once, which is what issue #96's
"same stylization and graphic effects" asks for; pointing a background at a new
`--board-bg` token would have recoloured the fill and left the furniture blue.
The list and rail cards rotate with the section they sit in, since a card is a
small rendering of what it names (§10); since B72 the section's own tray rotates
too, drawing its `--card` rung as its ground and its `--frame` rung as an inset
frame, so these two rungs now have a render site in the list and rail and not
only on the board (§10).

**A board with no category reads as a Note board**, violet — because `catOf()`
is a read-site default and a record without a category *is* the third bucket
everywhere (B21's idiom, storage key `unsorted`). That is the same bucket the
list files it in, and the agreement is the point: a card that opens a violet
board must itself be violet. It applies to every pre-#58 legacy record and to
the board `newBoardRecord()` makes on a fresh install, neither of which writes
a category. To-Do is what the page shows for the instant *before* app.js has
spoken, because To-Do is `:root` and carries no `[data-cat]` block.

### §2.3 Ink — one per surface, not one per app

Two poles:

| Token | Value | Bound on |
|---|---|---|
| `--ink-light` | `#f4f5f1` | `--deep`, `--card`, `--water`, `--chrome` |
| `--ink-dark` | `#031019` | `--note` |

Verified contrast for every text-bearing surface, **each at the worst extreme of
its range**:

| Ground | Ink | Ratio | Level |
|---|---|---|---|
| `--deep` `#020812` | light | **18.33:1** | AAA |
| `--card` `#08152c` | light | **16.62:1** | AAA |
| `--water`, lightest stop `#34697f` | light | **5.52:1** | AA |
| `--water`, darkest stop `#163646` | light | **11.62:1** | AAA |
| `--note` `#a0d4da` | dark | **11.84:1** | AAA |

Every pairing clears AA; every one but the water's lightest stop clears AAA.
The two sections are the only surfaces where the field's extreme matters to
text, and 5.52:1 is that extreme rather than an average. **The hexes named are
the To-Do ladder's; every ratio holds unchanged on the Idea and Note ladders**,
whose rungs sit at the same luminances (§2.2.2).

**`--ink` is no longer a single value.** v1 used one `var(--ink)` for note text,
lot text, band labels, rules, hairlines and borders alike, which worked only
because there was one ground per theme. With a six-ground ladder the ink pole
flips at the surface, so ink is **rebound at each surface boundary** and
inherited downward:

```css
:root        { --ink-light: #f4f5f1; --ink-dark: #031019; }
.on-dark     { --ink: var(--ink-light); --ink-a: 244 245 241; }
.on-light    { --ink: var(--ink-dark);  --ink-a:   3  16  25; }
```

`#board`, `#menu`, `#toast`, `#pane`, `#anchor-title`, the band zones and —
since B58 put it on the water — `#lot` carry `.on-dark`; the note is the one
`.on-light` island left. Everything downstream — text, caret, rules,
hairlines, borders, the scratch-out — keeps reading `var(--ink)` and
`var(--ink-a)` unchanged.

This matters beyond tidiness: it means the v1 stylesheet was **already written
for this**, and the change is a rebinding rather than a rewrite. `--ink-a` stays
channel-synced to `--ink` for the scratch-out's buried text (§4.3).

**`--line` is deleted.** v1's mid-grey had four jobs — rules, hairlines, disabled
states, the tap-ghost — and it failed the first two on the grounds they are
actually drawn on (1.64:1 on v1's board, 1.99:1 on its shelf); its luminance
sits dead centre in the forbidden band (§2.3.2). Each job
now resolves to the surface's own ink at a different weight: rules at full ink
(§2.5), hairlines at an alpha (§2.5), disabled at `opacity`, the tap-ghost at a
low alpha. **One ink per surface, expressed at three weights** — fewer tokens,
and every one of them legible where it lands.

### §2.3.1 The crossover

The two poles are equal-contrast against a ground whose luminance is their
geometric mean, offset by WCAG's 0.05. The poles are unchanged from the first
derivation, so the number carries:

```
L_cross = √((L_light + 0.05) × (L_dark + 0.05)) − 0.05
        = √(0.9589 × 0.0546) − 0.05
        = 0.1788        (both poles land on 4.19:1 there)
```

> **Below `L = 0.1788` a ground takes `--ink-light`. Above it, `--ink-dark`.**

This is the rule; §2.3's table is its output, not its source. Two margins are
worth naming. The field's top stop (`L = 0.1237`) is the closest any ground
comes to the boundary, 0.039 below it — the sheet cannot get much lighter
without changing its ink. And `--frame` (`L = 0.2611`) sits *above* the
crossover on grounds that take light ink — which is legal because it is a
line, not a text ground; see §2.3.2's 3:1 close.

### §2.3.2 The forbidden band

Solving each pole for 4.5:1 gives the range where **neither** pole can carry
body text:

```
light ink holds to   L ≤ 0.1631
dark  ink holds from L ≥ 0.1957
forbidden band:      0.163 < L < 0.196
```

> **No text-bearing surface may have a relative luminance between 0.163 and
> 0.196.** There is no ink in the palette that works there.

This is not hypothetical: v1's retired `--line` sat dead centre in that band
(§2.3), and the band is stated as a law so the next mid-grey is rejected before
it is authored rather than after.

**The band closes at 3:1.** Repeating the solve for non-text contrast gives
light ink holding to `L ≤ 0.270` and dark ink from `L ≥ 0.114` — they
*overlap*. Every ground can carry a line, an icon or a border from one pole or
the other; only *text* has a hole. The asymmetry is load-bearing: it is why a
drawn mark can go where a word cannot (§13.3), and why `--frame` may live above
the crossover while no text ground may.

> **A line takes the same ink pole its ground takes** (§2.5). The crossover is
> not a text rule; it is the rule for anything that must be seen against a
> ground. The one deliberate exception is `--frame`, which is not an ink at all:
> it is the band's own hue lifted until it clears 3:1 on both of its grounds,
> because the card/band seam separates surfaces that share a pole.

### §2.4 Elevation

Transient surfaces only: `#menu`, `#toast`, `.pane-drag-ghost`.

```css
--elevation: 0 2px 8px rgb(0 0 0 / 0.45);
```

The desktop rail is the inverse — an **inset** shadow, because it is embedded in
the page rather than floating over it. **Notes take no shadow** (§1).

### §2.5 Edges, rules and hairlines — the separation rule

> **A surface's edge is drawn in that surface's own ink.**

One rule, and it is load-bearing rather than stylistic. Two surfaces that touch
must separate. Either the **fill** does it (≥3:1) or the **edge** does.

Every adjacency that occurs on the sheet, **each at the worst extreme of the
water** — which end of the fall is "worst" depends on the question: a
separation *against the deep* is worst at the water's darkest reach, and a
mark *on the water* is worst at its lightest:

| Touching | Fill | Edge | Separated by |
|---|---|---|---|
| **title card / deep** | 1.10 | `--frame` **5.39** / **5.95** | **edge** |
| **band / canvas, at the rule** (water's darkest stop) | **1.58** | `--frame` **5.95** / **3.77** | **edge** |
| **note / note** (overlap) | 1.00 | dark ink **11.84** | **edge** |
| note / Parking Lot (water's lightest stop) | **3.72** | — | fill |
| lot / canvas (water's lightest stop, at the lot's top edge) | **3.32** | — | fill |
| note / canvas | **12.36** | — | fill |
| note / water (lightest stop) | **3.72** | — | fill |

**Every row holds on all five ladders** (§2.2.2). An adjacency is always
between two rungs of the *same* scene — a board never mixes ladders — and the
two rungs sit at the same pair of luminances whichever hue the board wears.

Three consequences worth stating out loud:

- **The note's 2px frame is the only thing separating two overlapping notes**
  (1.00:1 fill — they are the same colour). Free overlap with no snapping is a
  core behaviour (`PRD §1.2`, P2), so the frame is not chrome around the note; it is
  what makes overlap legible. This is §1's "identity from structure" doing real
  work rather than asserting itself.
- **The card's border is the second load-bearing edge.** At 1.10:1 the card does
  not separate from the deep by fill at all, by design — it is meant to be quiet.
  Its border carries the whole separation, which is why `--frame` is a token and
  not a decoration.
- **The band's rule became the third load-bearing edge** (B58 inverted this
  clause). The band's water darkens to its bottom stop at the rule, meeting
  the deep at 1.58:1 — under the fill floor — so the rule now *carries* that
  seam, clearing 5.95:1 on the deep and 3.77:1 on the water's darkest stop.
  The lot's rule keeps the section-mark reading: the lot's top edge is the
  water's lightest stop, and that seam separates by fill at 3.32:1.

**`--frame` `#698ebf`.** One token for the card's border and both full-width
rules (B61): the two ends of the sheet close with the same line, the same
idiom at both ends (§3.1). It is a lift of the deep's own hue, so the linework
belongs to the page rather than being applied to it. Clears 5.39:1 on the
card, 5.95:1 on the deep, 3.77:1 on the water's darkest stop.

> **Ratified.** `#698ebf` arrived as the frame carried by the "A Well"
> specimen, kept deliberately by proof sheet 7 against rendered alternatives,
> and extended to the lot's rule by Rob's B61 pick — both ends matching —
> from the rendered pair on the second-swap round.

**Hairlines.** A separator is that surface's ink at the lowest alpha clearing
3:1 on it — `0.40` on `--chrome`, where the only separators in the app live
(the menu's destructive divider, §7). v1's `0.14` was 1.43:1 there: invisible,
and therefore not earning its place at that weight.

```css
--hairline: rgb(var(--ink-a) / 0.4);
```

### §2.6 Accents

| Token | Value | Role | on `--chrome` | on `--card` (the lightest near-black ground) | label when filled |
|---|---|---|---|---|---|
| `--accent-restore` | `#b6dee2` | Complete / Restore / Undo | 13.90:1 | 12.60:1 | 13.31:1 |
| `--danger` | `#E2A08C` | Delete | 9.22:1 | 8.35:1 | 8.83:1 |
| `--accent-page` | `#6d9cb0` | the primary (B59), rail pager, drop target | 6.72:1 | 6.09:1 | 6.44:1 |

> **An accent is text only on a near-black ground — `--chrome`, `--deep` or
> `--card`. Anywhere else it is a fill carrying `--ink-dark`.**

Each value is derived from a family the scene already keeps: `--accent-restore`
is the note's own hue and saturation lifted 74 → 80 — the derivation `--frame`
used on the deep — because what restores is kin to what returns;
`--accent-page` is the water's hue at the old value's depth, because the accent
about boards is cut from the board's own water — which is why B59 put it on
the one control that *makes* a board, when the sand left and took the old
primary fill with it; `--danger` re-derived to its own value and holds it.

This rule is the correction to a real hole. `--danger` is 2.78:1 against the
water's lightest stop and `--accent-page` is 2.11:1 — as text those are below
AA and below the 3:1 non-text floor respectively. As *fills* they work where
they land: a filled Delete button separates from the water by its fill at
3.90:1 from the mid stop down and by its `--ink-dark` border at 3.18:1 at the
top, with its label riding at 8.83:1 (the fill/border handover dips to ~2.99
over a narrow reach of the fall — recorded in §16.1); a Complete fill clears
4.19:1 against the water's worst extreme; the primary, the pager and the
drop-target frame live on `--chrome` at 6.72:1. The placement rule keeps
every accent on a ground where it works.

`--danger` is **the only warm hue in the application** — B58 returned the
sentence to its original, unqualified form. B46 had to add "saturated" because
the sand was warm ground; the sand is retired, so among everything the app
draws, the one thing that destroys is the one thing that isn't cool water,
full stop.

> **Ratified.** The whole family was re-derived against the deep-dusk grounds
> in proof round 8 — candidates rendered beside the round-1 values, every
> ratio against its worst extreme — and rendered whole in round 9
> (`proofs/proof-9-a-well-furnished.html`). The round-1 restore and page
> values were hue 177°, the retired teal's kin; the new values belong to the
> note's and the field's families. `--danger` re-verified clean against every
> ground it lands on and kept its value — re-chosen, not inherited. Recorded
> as B52, where the superseded hexes live.

### §2.6.1 The highlight wash (B71)

| Token | Value | Role | text on it (`--ink-dark`) | vs. the note families (hue) |
|---|---|---|---|---|
| `--highlight` | `#F2D64B` | a note the user has toggled Highlight | 13.27:1 | amber vs. cool blue/green/violet |

A highlight is **not an accent.** Accents live on chrome and signal *the app's*
verbs (§2.6). A highlight is a fill the *user* asserts on one note — a new axis,
the first per-note appearance state the board has (every other note surface is
set by board *type*, not by the note). So the rule that keeps accents off the
board surface does not reach it: the highlight is *made* to sit on the board, on
exactly one note at a time, at the user's command.

It is the one **warm** surface a note can wear. The three note families are all
cool pastels (§2.2.2); `#F2D64B` is a bright amber that reads as "marked" against
every one of them — the separation is **hue**, not luminance. That is deliberate:
the note is the brightest surface on the page (§2.2), and the wash keeps that rung
(luminance 0.675, a hair above `--note`'s 0.596) while turning warm, so a
highlighted note still reads as a note, only lit. Its dark ink and 2px border are
unchanged — the note already binds `--ink` to `--ink-dark` on its `.on-light`
surface (§2.3), which holds on amber at 13.27:1. Unlike the ladder, `--highlight`
does **not** rotate with board type: an emphasis the user places means the same
thing on a To-Do, a Note, a Learning and an Idea board, so it is one constant value.
Since B85, `--highlight` also serves as the Highlight tab's **identity fill** on
the note toolbar (§4.5) — fixed like this wash, and chrome that names *which
action*, never the note's state. Its fixed blue sibling `--accent-copy` (B85)
retired with the Copy tab it filled (B114): the token is out of the suite.

### §2.6.2 The reminder glow (B109)

| Token | Value | Role | text on it (`--ink-dark`) | vs. the note families (hue) |
|---|---|---|---|---|
| `--reminder` | `#52c4e2` | a note the user has toggled a reminder on (the clock's active fill + bloom, §4.7) | 9.48:1 | water's own hue, lifted bright, vs. cool blue/green/violet |

A reminder is **not an accent** — it belongs to the same class as the highlight
wash (§2.6.1): a per-note appearance state the *user* asserts, sitting on the
board at the user's command, so the accent placement rule does not reach it.
It is **cool** by law (§2.6 keeps `--danger` the only warm hue; B107 retired
the red past-due state and B104's yellow carried state is the carried
indicator's, not this one) — the water's own hue (~197°) lifted bright, a
saturation the note families' pastels never reach, so the separation is hue and
chroma where the highlight's was hue and warmth. Like `--highlight` it does
**not** rotate with board type: a reminder means the same thing on every board.
Luminance 0.4676, above the ink crossover, so the clock's dark glyph is correct
on it. The glow is the bloom: a `box-shadow` of the token around the filled
clock — never a second colour.

### §2.6.3 The carried glow (B110)

| Token | Value | Role | text on it (`--ink-dark`) | vs. the note families (hue) |
|---|---|---|---|---|
| `--carried` | `#E1BE26` | a note carried onto its board today (the card's border + soft bloom, §4.8) | 10.62:1 | the highlight's amber family, dropped a rung |

The carried state is **not an accent** and **not the highlight** (§2.6.1): it is
B104's status layer — border + soft glow, the one status state beyond
normal/complete since B107 retired the red past-due. Like the highlight and the
reminder it does **not** rotate with board type: a carry means the same thing
on every board. It is the highlight's own hue (~49°) held while the luminance
drops from 0.6748 to 0.5297 — a full rung below the wash, so attention (the
user's fill) outranks status (the record's frame), the issue's own priority
order — and above the ink crossover, so the card's dark ink is correct through
the frame's edge. The glow is the bloom: one `box-shadow` of the token around
the card's 2px frame — never a second colour, never the wash.

### §2.7 Focus

**The ring is two-tone**, and that is structural rather than stylistic:

```css
outline: 2px solid var(--ink-light);
box-shadow: 0 0 0 4px var(--ink-dark);
outline-offset: 2px;      /* -2px on inset rows */
```

No single colour works on every ground — `--ink-light` is 1.48:1 on the note,
`--ink-dark` is 1.04:1 on the deep. The two are exactly complementary, so the
doubled ring clears 3:1 on every ground **by construction**, not by tuning.
Both extremes of the water are checked, since the ring can land anywhere on
the two sections:

| Ground | light tone | dark tone | best |
|---|---|---|---|
| `--deep` | 18.33 | 1.04 | **18.33** |
| `--chrome` | 18.33 | 1.04 | **18.33** |
| `--card` | 16.62 | 1.06 | **16.62** |
| `--water`, lightest stop | 5.52 | 3.18 | **5.52** |
| `--water`, darkest stop | 11.62 | 1.51 | **11.62** |
| `--note` | 1.48 | 11.84 | **11.84** |

This is B15's "robustness from geometry, not hue," carried into the new palette
and made total. The water's lightest stop is the only ground where *both* tones
clear 3:1 at once, which is a margin rather than a problem. **Geometry, not
hue, is also why the table survives B67 untouched:** the ring is built from the
two poles, the poles do not rotate, and the grounds keep their luminances — so
every row above holds identically on the Idea and Note ladders (§2.2.2).

### §2.8 The water is a field, not a value

Since B58 the field belongs to the two sections that close the sheet — the
band and the Parking Lot — while the canvas between them is the flat deep.
A flat fill could not carry §1.1's register alone; the water carries the
depth, and each of its layers holds a job or it comes out (§1):

1. **The vertical fall** — `#34697f` → `#255265` → `#163646`, top to bottom in
   each section. Light from above, depth downward — and at the band it darkens
   into the rule, which is what hands that seam to the rule's edge (§2.5).
2. **The sections' falloff** — the radial darkening each section carries
   toward its reach. The *sheet-bound* job this layer held in the pre-swap
   scene died with the water canvas (a near-black ground has nothing darker
   to fall to); within the sections it keeps the water reading as depth
   rather than as two flat strips.
3. **Dither** — noise at anti-banding amplitude over the sections' ramps,
   which an 8-bit panel would otherwise band. On the deep between, it is the
   grain the ratified render carries (B58) — the canvas is flat by value,
   textured by repair.

**The field is authored as opaque stops**, so its extremes are exactly the
declared colours rather than something to sample. The falloff and the dither
can only *darken or perturb below the threshold of a ratio*, so each
adjacency in §2.5 is asserted against the stop that is worst **for that
question** — the lightest where a mark must read on the water, the darkest
where the water must part from the deep.

### §2.9 The sand is retired

The Parking Lot wore warm sand with turbulence weather from B46 to B58, and
B58's swap retired the family entirely (the six superseded hexes live in that
entry, as B52's precedent has it): the lot takes the water (§2.8),
the primary control takes `--accent-page` (B59), and no sand value survives
anywhere in the application. The full fate table is §16.2. What §2.9 carried
that outlives the sand is its craft note, which applies to the water's own
weather wherever a ramp meets a quantiser:

> **Banding comes from long monotonic ramps, not from amplitude.** A smooth
> run gives the quantiser something to step through; irregular overlapping
> texture does not band at *higher* amplitude, because no run is long or
> smooth enough to step.

---

## §3 Board geometry

The board is a fixed, bounded logical coordinate space rendered through a single
uniform `transform: scale()`. It never pans and never zooms; browser pinch-zoom
is disabled at the platform level because the two-finger pinch belongs to the
note (B12).

| | Touch | Fine pointer ≥1024px |
|---|---|---|
| `LOGICAL_W` | `vw` | `(vw − 300) / renderScale` |
| `LOGICAL_H` | `vh` | `vh / renderScale` |
| `renderScale` | `1` | `min(vh/1000, (vw − 300)/900)` |
| `offX` | `0` | `300` (the rail) |
| Floor | — | Neither logical dimension below 900×1000 |

**The reference sheet is 900×1000** — what band and lot proportions are derived
against and what the export draws, distinct from the live viewport-derived
dimensions.

Two rendering facts belong alongside it:

- **The scale is uniform.** Note frames stay square and the decoupled hit maths
  (§6) stays exact. A *cover* fit would crop edge furniture; an axis-decoupled
  *stretch* would distort the frame. Neither is available.
- **Band geometry is sized by the type it holds, not by the sheet** (B37).
  Across is a fraction of the sheet, because it holds the sheet's own divisions.
  Down is set by the type.

> The band has been ruled on five times: B33 → B35 → B36 → B37 → B38. Read that
> chain before changing band geometry. Each ruling corrected a regression the
> previous one caused. **§13.2's measurement gate is now discharged** — the
> results are there.

### §3.1 The band, and the two sections that bound the sheet

**The section sits above the rule.** The rule is the band's *bottom edge*, not a
division inside it — which makes the band the exact mirror of the Parking Lot at
the other end: a section closed by a full-width rule at each end of the sheet,
with the free canvas between them.

Reading down: **Components / Requirements content, then the rule, then the
header hanging just below it.** The header is **centred in its zone as a tight
tab whose top edge lands on the rule** (`top: 100%`), filled in the rule's own
colour (`--frame`) so the line and the label read as one cohesive unit, at
13px/600 (B76, issue #111; supersedes B47/B54's label-*above*-the-rule, closing
§13.2's question). The tab is `width: max-content` with `padding: 2px 6px` and
`border-radius: 0 0 3px 3px` (only the corners that exist below the rule); its
ink rebinds to `--ink-dark` via `.on-light` at **5.70:1** on the `--frame`
fill — the same pairing the board-action tab wears at the sheet's other end
(§2.5, §3.3/B83; it was the compartment handle's, B65, until B83 retired it). In the PDF export the
rule is dark (`PDF_INK`, not the mid-light screen `--frame`), so the tab fills
`PDF_INK` and its label reverses to the paper tone (`PDF_PAPER`).

**Both rules run the full width of the sheet** — `left: 0; right: 0`, not inset
to the gutter. **This supersedes B35 and B38's gutter-inset rule.**

**The band sizes to its tallest zone, from a two-line floor:**

```
rule-y = 14 + max(2, lines) × 19.5 + 8
       = 61px at the floor, 81px at three lines
```

The label term (`+ 16.9 + 10`) is gone from the budget: since B76 the header
hangs below the rule, so it no longer reserves height above it.

A fill has to have a bottom edge and the band's content does not have a fixed
height — at 384 wide the Requirements column is ~101px, so "Under 2k, keep the
window" sets to three lines. A fixed band left the third line on open water. This
is deliberately **the same law the Parking Lot uses**, stated once and applied to
both pieces of furniture rather than two schemes that drift apart.

**The title compartment overhangs the band by 22px and occludes the rule.** That
is B38 and it has never been in question. The sheet's own top edge is its fourth
side, so only three are drawn. It is the one deliberate exception to "no empty
frames" (§4) — that rule protects the free canvas; the compartment is permanent
furniture and is always drawn.

### §3.2 The Parking Lot is a section, not a box

**Full-bleed**: `left: 0; right: 0; bottom: 0`, with its *content* still on the
gutter. It lives as a section of the page rather than a box bolted onto it.
**This supersedes B32's "the sheet keeps one left margin"** as it applied to the
lot.

**Its height follows its *measured* contents, from a two-row floor:**

```
lot-h = min( 34 + max(2 × 44, Σ rowHeightᵢ),  ⌈0.5 × logical-h⌉ )
```

`rowHeightᵢ` is each row's *rendered* height (`≥ 44`, taller when its text
wraps). Empty, one row and two single lines all draw the same two-row section —
furniture, not a by-product of content. Beyond that the lot grows *upward*
(the section is anchored to the sheet's bottom edge) to fit whatever its rows
occupy, wrapped lines included — the same law the band already follows by
measuring its tallest zone, so a multi-line item is never cut off (issue #106).
A **ceiling of half the sheet** survives so a runaway lot cannot swallow the
canvas; content past it is clipped (`#lot-items { overflow: hidden }`). **This
supersedes B37's whole-row budget and B47/B57's row-count ceiling** (B73),
which sized the lot by item *count* at a fixed 44px each and cut wrapped lines.

### §3.3 The board-action row (B83; three tabs since B92; four since B95; two on desktop, three on tablet since B100, issue #157)

The board's board-level actions — **All** (the toggle), **Export**,
**Import**, and, since issue #145, **Calendar** — are declared as a row of
flat tabs **hovering just above the Parking Lot**, the mirror at the sheet's
other end of the band's header tabs. This replaced the `Menu` handle of B65,
whose only route was still a control the reader had to notice; the actions
now name themselves, in place, on both platforms. B92 retires the anchor
long-press/right-click menu outright: with Import joining the row, every
board-level route is a visible tab, and the hidden menu duplicated doors the
reader was already standing in front of. B95 re-grammars the labels so four
tabs fit a phone (R7.2): side padding 12→6px and gap 8→6px — vertical
padding and type are untouched, so B86's finger box and §6's collar-height
math hold. B99 retires the Calendar **tab on wide** — the standing rail
(§3.4) is the calendar's entry there. B100 retires the **All tab on desktop**
(`html.desktop #action-boards { display: none }`) — the left rail (§10)
already lists every category with every board, so the tab was a second door
to the same room. The row is **two tabs on desktop** (Export · Import),
**three on tablet** (All · Export · Import — the tablet keeps its tab: it is
the tier's way into the lot-grid picker), **four on mobile** (All · Export ·
Import · Calendar): the grammar each platform speaks, nothing held in
reserve.

(2026-09-16: B119 — issue #212 — supersedes the tablet clause: the All tab
retires on tablet too, its hide widened to `html.wide` — the row is **two
tabs on tablet** as on desktop, and the left rail is the one All-Boards
surface on wide. The lot-grid picker stays mobile's entry.)

**Placement.** `#board-actions` is `left: 0; right: 0`, a **left-anchored** flex
cluster (`gap: 8px`, `justify-content: flex-start`, B88) at `bottom: var(--lot-h)`
— **flush on the lot's top edge** (B87 removed the 8px gap). Its four tab corners
stay round; it tracks `--lot-h`, riding up as
the lot grows. `z-index: 1` (the furniture plane; notes at `z-2` stay above).
The container is `pointer-events: none` — a positioning frame exactly like a
`.band-zone` — so a press on bare canvas beside the tabs still reaches the
recognizer and captures a note; only the tabs are live.

**The tab.** The band label's own box, **not** §14's tactile signature (§14):

```css
.board-action {
  padding: 8px 6px;                 /* vertical: the band label's box (§3.1), finger-size (B86);
                                       sides trimmed 12→6 for the four-tab row (B95, R7.2) */
  border: none; border-radius: 3px; /* symmetric — it hangs beneath no rule */
  background: var(--frame);         /* the band tab's fill (B76) — rotates per #board[data-cat] */
  color: var(--ink);               /* --ink-dark at 5.70:1, rebound by .on-light */
  font-size: 14px; font-weight: 600; line-height: 1.3;
  gap: 6px;                        /* the drawn mark to its label; mark at 16px (B86) */
}
```

**The import input is a mechanism, not a control.** Import opens the platform
file explorer through a hidden `<input type="file"
accept=".json,application/json">`. The input is never visible, never focusable
as a route, and never named in copy — the visible tab declares the act, the
dialog is what "Import" does (B92).

**The Export choice menu (B92).** Pressing **Export** opens the app's one menu
species (`buildMenu`/`#menu`, §7) **anchored at the pressed tab** — the tab's
own bounding box (`r.left`, `r.bottom`), not the pointer, because the menu is
the tab's next state rather than a context menu that happens to be nearby. Two
leaves, the menu's one-word grammar: **PDF** (the board you're looking at, as
§15's sheet) and **JSON** (the whole-library backup). The choice itself
commits nothing (it runs raw, B81's navigation side); each leaf commits — a
file leaves the device — and takes `commitAction`'s drop-guard itself.

**The hit collar.** The flat tab is well under §6's floor, so it carries the
note's decoupled `--hit` collar (B7) — set on `#board-actions` in
`updateBoardGeometry`, measured off the row (its width spans the sheet, so only
the height term binds), sized so `(tab-height + 2 × hit) × renderScale` clears
**44px on touch and 24px on desktop**. The collar is **asymmetric — spent
entirely upward**, onto the canvas, because downward is the Parking Lot's own
furniture; where a note (`z-2`) overlaps it the note wins, and a bare-canvas tap
into it fires the tab (the same reading B65's collar had). Interactive states
are visible without the tactile shadow: a transient `filter: brightness` on
hover/press on §8's curve (the kill-switch drops it to instant), and §2.7's
two-tone ring on focus. State is never colour (§1) — the **All boards ⇄ This
board** toggle states its act in its label (B43/B71's grammar), so no
`aria-pressed` rides alongside.

### §3.4 The calendar view (B95, issue #145; tier shipped by B96, issue #155; events editable by B97, issue #152; standing rail by B99, issue #158)

The calendar wears the app's **fifth ladder** (issue #168): the same eight
rungs at an orange arc (~47°–66°), bound on `#cal-view` the way To-Do binds
on `:root` — a rebinding, never an override, so the rail, the R1 row, the day
cards' water fall and date compartments, and the month view's today cell all
carry the hue through `var()` (§2.2.2). Linked boards opened from a day card
keep their own category scopes — nothing inside `#cal-view` carries
`data-cat`.

The third screen. Full-screen on mobile (`html:not(.wide)`). On any wide
screen — desktop or tablet (`html.wide`) — the calendar is **standing
furniture** (B99, issue #158): a 40px rail pinned to the viewport's right
edge, always visible, its label **Calendar Board** reading vertically
(`vertical-rl`, 12px/600, .18em caps) over today's date (9px/600) and a
6px **lit dot** — the aperture: lit iff today carries events. The rail
reserves its 40px from the frame at all times (`CAL_RAIL_W`; the room is
three columns: boards, board, calendar). One tap expands the rail
leftward into the panel docked at the right edge (320 unscaled px,
`--frame` border) and the board reflows beside it — the R6 squeeze,
entered from the rail; the panel's **Back** is the collapse arrow, and on
collapse the board renders exactly where it was. The rail commits
nothing and pushes no history (B81: navigation runs raw). The Calendar
tab retires on wide (`html.wide #action-calendar { display: none }`) —
mobile keeps the four-tab row and the tab-driven full-screen view, unchanged.
B100 retires desktop's **All Boards** R1 button too (`html.desktop #cal-boards
{ display: none }`, with the handler guarding): the rail names every board,
and the panel's row is **Back + Export**, Export taking the right anchor
(`margin-left: auto`) — which is what mockup 6 drew. The tablet tier renders
this same rail + panel arrangement under the touch grammar (B96; B103's
final gate: **one width floor, `min-width: 744px`, orientation-blind** —
unfolded foldables, iPads, and Android tablets take this arrangement in
PORTRAIT and landscape alike; B96's landscape-only widths and B101's shape
leg are superseded), its All tab kept.

(2026-09-16: B119 — issue #212 — supersedes the tablet All tab: the
`#cal-boards` guard widens from `isDesktop` to `isWide`, so the calendar
panel's All Boards control retires on tablet with the tab, and the panel's
row is **Back + Export** on wide as on desktop. The rail + panel
arrangement itself stands on tablet — B118's collapse grammar included.)

**The R1 top row.** `--frame` flat tabs in the row-control species. On
mobile, three, anchored left / center / right: **Back** (the board-action
glyph mirrored — a page turn back), **All Boards**, **Export**. On desktop,
two: **Back + Export** (B100). Back pops the view's pushed History state; it
is the always-visible exit, with the OS gesture as the second route, never
the only one. Each tab renders its act — drawn mark
(22px) beside its label (`15px/600`) — in a frame that clears §6's touch
floor **as drawn** (B98: `padding: 14px 16px`, ≈ 48px tall on touch), with
the §6 decoupled collar (`--hit` on `#cal-top`, set at render) topping up
the width where the row is tight; the collar is spent upward, into the
row's chrome margin. Hover, press, and keyboard focus state themselves
(brightness 1.1 / 0.92, §2.7's two-tone ring) — state is never colour.

**The 7-day stack.** `#cal-stack` is a column of seven `#cal-day` cards,
today first — computed at render (R4), never stored. A day card is a
two-column grid: the date card (`--card`, the day's name over MM/DD) beside
one timeline zone on the water's fall. Attention recedes with distance from
now — today lit (the two-tone outline ring, full scale, `flex 1.6`), events
near, empty days far (`brightness .6`, lines at .62 alpha). Scale and
luminance, never icons.

**Capture.** Each day's zone closes with the `+` row — the calendar edition
of §6.2: tap and type, the caret arrives with the tap. Commit-on-blur writes
the event and its linked board's mirror line together; an empty commit
discards (B8). Completed events strike through at .55. An **existing** event
line is editable in place (B97): its own tap opens the same editor — focused,
caret always at the end of the text, inside the tap gesture; a second tap
while editing does nothing (B81's re-arm guard); the commit touches text
only, so a completed event keeps its strike through an edit.

---

## §4 The note component

```css
.note-text {
  background: var(--note);            /* #a0d4da */
  color: var(--ink);                  /* rebound dark here — 11.84:1 */
  border: 2px solid var(--ink);       /* §2.5 — dark on this surface */
  border-radius: 3px;
  padding: 10px 12px;
  font-size: 17px; line-height: 1.4;
  text-align: center;
}
.note-text:empty { background: transparent; border-color: transparent; }
```

**The text is centred in its frame** (B62, issue #82). Alignment moves glyphs,
not the box: the note is `width: max-content` capped at the sheet's right edge
(B39), so `text-align` changes no dimension — the wrap cap, the hit collar and
every stored position measure exactly as before. A single-line note
shrink-wraps to its own text and centres invisibly; the change is legible
wherever a line falls short of the box's widest — a cap-wrapped note's soft
lines, or a short hard line beside a longer one — each held in the middle of
the frame. The export draws the same centring in the same content box
(§15, B34/B39), measured sans trailing spaces because `pre-wrap` hangs them.

**No empty frame ever exists.** The frame draws itself on the first character and
is transparent before it — enforced at blur (B8) and again on every render (B31).
A note earns its frame the way it earns persistence.

**The radius stays near-square.** Notes scale 0.5–2.0 and `NOTE_MIN_W` is 132
(§4.5), so a large radius inside `transform: scale()` turns a minimum-width note
into a capsule. 3px is a geometric constraint, not a taste: it reads as *drawn* at
every size the note can be. It moves 2 → 3 from v1 to hold that reading against the
new 2px frame; `EXPORT_GEO.radius` mirrors it by hand (§15).

**The note carries no shadow** (§1).

### §4.1 Transform origin

`transform-origin: top left` throughout, so stored `x`/`y` stay truthful and
there is no drift to compensate (B4). Positions are data (`PRD §1.2`, P3); a
rendering choice that required correcting them would be rewriting them.

### §4.2 States

| State | Drawn as |
|---|---|
| empty | no frame, no fill |
| resting | 2px frame, `--note` fill |
| pressed (drag/pinch engaged) | frame 3px, padding compensates so nothing reflows |
| tapped (the action window is open) | same as pressed — one state, two moments |
| editing | §2.7 focus ring + visible caret |
| selected (desktop) | outline, not a fill — a fill is the completion mark |
| complete | §4.3 |
| carried (B110) | the frame takes `--carried` + a soft bloom of the same token (§4.8) |

Nothing here is colour alone (§1): every state has a geometry.

### §4.3 The scratch-out

Completing does not delete and does not hide. Three families of ruled strokes at
≥90% coverage (93.6% measured) — **texture, not colour** — in the surface's own
ink at **0.62**, with the underlying text destroyed to **12% ink** so no
screenshot or zoom recovers it. The radius tracks the note's. B53's pair
proved pole-independent under B58's swap: the note strikes in dark ink at
4.53:1; the lot now strikes in light ink on the water at 3.19:1 / 4.08:1 /
5.47:1 against the fall's three stops — a mark above the 3:1 floor at every
extreme, on either pole, and no longer a bar anywhere.

**This is the one published table B67 moves, and it moves in the second
decimal.** A strike is an *alpha composite*, so its ratio is a function of the
ground's three channels rather than of its luminance alone: rotating the hue
(§2.2.2) re-quantises the mix at 8 bits and the number shifts. The values are
stated per ladder rather than averaged, because a range stated as a midpoint is
the thing §2.2 forbids:

| Mark | To-Do | Idea | Note | Learning |
|---|---|---|---|---|
| note strike — dark ink at 0.62 | 4.53 | 4.51 | 4.54 | 4.54 |
| lot strike on the water's lightest stop | 3.19 | 3.22 | 3.20 | 3.19 |
| lot strike on the water's mid stop | 4.08 | 4.11 | 4.12 | 4.11 |
| lot strike on the water's darkest stop | 5.47 | 5.49 | 5.50 | 5.50 |
| buried text on the note | 1.28 | 1.27 | 1.27 | 1.27 |
| buried text on the water's lightest stop | 1.29 | 1.30 | 1.28 | 1.28 |

The law is unchanged and is what is actually asserted: **every mark clears 3:1
on every stop of every ladder, and every burial stays a smudge.** The largest
movement is 0.04, against a floor the smallest value clears by 0.19.

The sections' radial falloff (§2.8) is the *other* alpha composite in the app,
and its luminance moves for the same reason. No published ratio is computed
from the vignetted ground — §2.8 asserts each adjacency against the fall's
declared stops precisely because the falloff can only darken below the
threshold of a ratio — so nothing above depends on it. Named here so the next
value derived from the band's real ground is derived per ladder.

**The veil and the burial are one decision** (B53). The old 0.97/0.40 pair was
tuned for a mid ground: a near-opaque veil destroyed what was under it, and the
burial only had to kill the 10% showing in the gaps. Thin the veil and the words
come back *through* the strokes — so as the strike's alpha fell to 0.62, the
burial deepened to 0.12. The buried text lands at 1.28:1 on the note and
1.29:1 at the water's worst extreme — a smudge where words were. **That is
the target, not a failure:** the content is deliberately illegible, and
legibility minima do not apply to something the person has asked the app to
strike out.

Completion is reversible. In the PDF export a completed item is drawn scratched
out and **emits no text object at all** — the on-screen promise becomes a
property of the bytes (B34).

### §4.4 Lot lines are never framed

Parking Lot items are unframed stacked text lines: the one place in the app where
text carries no frame. That is the visual expression of the structural fact that
a lot item has no coordinates (`PRD §4`).

The one override is narrow and scoped: on desktop, a selected row draws an
`outline` with its actions inline at the row's right edge (B25). Selected, on
desktop, and nowhere else.

### §4.5 The note's action toolbar

*New in v2 (B84, issue #126); Copy re-homed to the note's long-press/right-click
menu in B114 (issue #171).* A note's three actions — Complete/Restore ·
Highlight · Delete — sit on a row the note wears, in the menu's order
(§7): the destructive tab last, in `--danger`. It replaces the note long-press
menu and the desktop right-click note menu; on desktop it also replaces the
`#selection` overlay's own action buttons, which the overlay no longer carries
(it is the resize frame only).

**A minimum note width.** `NOTE_MIN_W` is **132** — a real minimum *rendered*
width, not only the wrap-cap floor it was at 60. It is the width that seats the
three tabs, and one number carries three jobs so they cannot drift apart: the CSS
`min-width` on a non-empty `.note-text`, the wrap-cap floor (`noteMaxW`), and the
drag/resize width floor. A note can never be *sized* narrower than its own row. An
empty note is exempt (it keeps no frame, §6.2, and shows no row), so it stays free
to be its true width; `createNote` floors a new note's `x` `NOTE_MIN_W` back from
the right edge so its frame never spills off the sheet.

(2026-09-16: B120 — issue #173 — the row this floor seats moves to the note's
bottom edge, centred; the minimum itself stays.)

**The tabs are flat, in the band-label's hand** (§3.1 — the same tab that names
Components and Requirements), not pills and not the `.sel-btn` raised control:

```css
.note-tb-btn {
  padding: 7px 6px;                    /* the band-label tab (§3.1), finger-size (B86) */
  border-radius: 3px;                  /* tracks the note's own (§4) */
  background: var(--frame);            /* Complete's ground: the board's frame hue, rotates per type (B67) */
  color: var(--ink);                   /* .on-light → --ink-dark, 5.70:1 (B76) */
  font-size: 13px; font-weight: 600;
}
.note-tb-btn svg   { width: 18px; height: 18px; }        /* the mark, grown from 16px (B86) */
.note-tb-delete    { background: var(--danger); }        /* --danger fill carrying --ink-dark, 8.83:1 (§2.6) */
.note-tb-highlight { background: var(--highlight); }     /* fixed amber identity fill (B85) */
```

The marks are `GLYPH`'s own drawn SVG (§13.3), each SVG `aria-hidden` with the
label on the button for AT. The row is a **child of the note**, so it scales with
the note and is never wider than it. It sits **flush on the note's top edge**
(`bottom: 100%`, B87 — the 12px gap removed) and **left-anchored, far left**
(`left: 0`, no `translateX`, B88), flipping to just inside the top edge near the
sheet top where there is no room above (`reflectToolbarFlip`, whose `TB_ROW_H`
threshold is now 32 for the gapless row). Each tab keeps a 44px-tall hit target
expanded upward (§6, B7's decoupled-hit idiom) so a row of three never overlaps a
neighbour. Focus wears the two-tone ring (§2.7).

(2026-09-16: B120 — issue #173 — supersedes this paragraph's edge and anchor
clauses for the note toolbar: the row moves to the note's BOTTOM edge, centred
on the card; `reflectToolbarFlip` re-reads for near-sheet-bottom. The gapless
edge, show/hide grammar and hit targets stand.)

**Shown only on select/focus** (the owner's call — not always drawn), by the same
state that raises the resize frame: `.note.selected` on desktop (B22); on mobile a
first tap adds `.note.engaged` — the select step, toolbar shown with no keyboard
(B90) — and editing (a second tap) then makes the note `:focus-within`. It
hides while the note is picked up (`.pressed`). The show/hide is the §8 fade —
`opacity`/`visibility`, `200ms` on §8's curve — and degrades under the reduced-motion
kill-switch. **State is never colour alone (§1):** the Complete tab flips its mark
(check ⇄ undo) and label; the Highlight tab flips its label and shows an inset border
while the note wears the `--highlight` wash (B71) — the wash is the state, the tab
only triggers and names it. The Highlight tab also carries its own **fixed identity fill** (amber, B85) the
way Delete carries `--danger`: the fill says *which action* — chrome, not state —
so the three tabs are told apart by fill **and** glyph. Unlike Complete's rotating
`--frame`, it does not change with board type. Copy's blue `--accent-copy` filled
the fourth tab until B114 re-homed Copy to the note menu (§7) and retired the
token with its tab.

### §4.6 Note links (B91)

A **link** is a relationship the user asserts between two notes (issue #142): a
thin line between their centres, no label and no arrowhead. It is the board's first
inter-note structure — *relationships asserted not inferred* (PRD §1) made visible.

**The line.** 1px `--frame` — the board's own rule idiom (§2.5), so it rotates hue
per board type for free (B67, `#board[data-cat]`). It is held to a crisp 1px at any
render scale by `vector-effect: non-scaling-stroke`, so it does not thin out under
the desktop scale the way an ordinary scaled hairline would. No fill, no cap
decoration, no marker.

**Where it sits.** On one `<svg>` layer (`#link-layer`), a sibling of the notes in
`#board` space, so it rides the single render transform (§11) and its endpoints are
plain board-logical note centres. The layer is `pointer-events: none` — it must
never take a hit, because a link is asserted by tapping the *notes*, not the *line*
(the recognizer hit-tests by `target.closest()`, §5). It draws **below the notes and
above the board furniture**: `z-index: 1` (notes are `z-index: 2`) plus DOM order
after the static furniture. The issue's "z-index: 1.5" is that intent; a literal
`1.5` is invalid CSS and is not used.

**Arming and completing** (the gesture, B91): a note's long-press (mobile) or
right-click (desktop) opens a one-item menu, **Link** (§7); the next tap on a
*different* note connects it, a tap on an already-linked note removes it (toggle),
and a tap elsewhere / a drag / Escape cancels. While armed, a persistent hint toast
(§9) states the act. Creating or removing a link offers the 5s Undo (§9).

**Export.** The line travels into the PDF (page 1, beneath the cards) as a neutral
`PDF_SHADE` hairline (`EXPORT_GEO.linkWidth = 1.5` sheet units), between the same
export-geometry centres the notes use — neutral, not the screen's `--frame` hue,
because the export palette stays off `:root` (§15).

**Copy.** `Link` (menu item); `Tap another note to link` / `Click another note to
link` (the armed hint, mobile / desktop); `Linked` / `Unlinked` (the undo captions).

### §4.7 The reminder clock and the surfaced echo (B109)

*New in v2 (issue #169, B104/B109).* The clock is the reminder's whole
interface: a drawn dial mark (§13.3's discipline, in `GLYPH`) sitting
bottom-right of **every** note card, resting in the note's own ink. One tap
sets the reminder, one tap clears it — **no time picker, no dialog, no due
time stored anywhere in the record** (B104). Active, it takes the `--reminder`
fill (§2.6.2) with a bloom of the same token — the glow B104 rules — and its
`aria-label` states the act the tap will perform (`Remind me` ⇄ `Remove
reminder`), so the state never rides colour alone. An empty note keeps no
frame (§6.2) and shows no clock.

**The surfacing.** A note whose reminder is set renders an **echo** of itself
on today's linked To-Do board (B95's species, `board.cal` = the today key) —
at render time, computed, never stored: the record never leaves its board, so
there is one source of truth and nothing to diverge. The echo is the note
card's own anatomy minus the toolbar: same text, same scratch-out geometry,
same clock (tapping it there writes the *source* record and unsurfaces), and
it wears the **source board's note hue** — a `data-src-cat` attribute rebinds
`--note` for the echo alone, the ladder's own §2.2.2 discipline. A reminder
note on today's board itself simply glows; it does not surface to itself.
The surfacing set is **active** reminder notes: completing the note anywhere
(completing an echo completes the source, B109) unsurfaces it, as does
clearing its clock. The echo's long-press/right-click menu carries **Complete**
and **Go to Board** (the source board, the plain swap route, B9) — Link is
absent there, because it arms against records this board does not hold, and
Copy is absent for the same stranding (B114): an echo has no record of its own
to copy. The echo rides the same note toolbar as any note, B114's three tabs.
Completing a reminder note just completes it: nothing recreates anything
(recurring reminders stay open, B104/B107). Echoes are render-time references
and do not travel into the PDF export (which draws board records, not echoes).

### §4.8 The carried indicator (B110)

*New in v2 (issue #169, B104/B110).* A note whose `carriedOn` (B108's carry
field) equals the today key renders with its frame in `--carried` (§2.6.3) and
a soft bloom of the same token — B104's border + glow grammar, never the
whole-card fill (owner-rejected in #169 §3) and never the highlight layer. The
treatment is recomputed at render from the record — the `.carried` class is the
field's shadow, never stored style state: render derives it from the field
against the today key, and completing the note clears `carriedOn` under B108's
law, so a completed note never glows (complete treatment wins). The date
comparison is what makes the marker self-clearing: a note carried on an earlier
day and left where it landed renders plain, and the next carry re-sets the
field if it carries again. The highlight wash (§2.6.1) and the carried frame
are different layers and may sit on one card — the wash fills the text surface,
the status dresses the frame, in the issue's priority order (highlight →
status → plain). As with the highlight wash (B71), the state has no control of
its own, so it carries no aria lever — the record is the truth and this table's
geometry (frame + bloom) is the drawn form. §4.2's pressed still owns a held
card: while the note is engaged the frame reasserts the ink, and the status
returns on release.

---

## §5 Gestures

One custom recognizer drives both grammars, branching inline on `isDesktop` — a
live capability test, never a width or UA test (B19). There is no separate
desktop code path.

| | Mobile | Desktop |
|---|---|---|
| Create | tap empty canvas | click empty canvas (nothing selected) |
| Select | tap (reveals the toolbar, no keyboard, B90) | click |
| Move | drag | drag |
| Scale | two-finger pinch | drag the selection frame |
| Edit | tap again, on the engaged note (B90) | double-click, or `Enter` |
| Menu | long-press (500ms) | right-click |
| Caret on edit | at the end (B90 — was the touch point, B14) | at the end (B26) |
| Boards | full-screen list | always-visible rail |

(2026-09-16: the desktop rail's always-visible geometry reads subject to B118
— issue #211 — which makes it collapsible on wide, collapsed by default.)

`MOVE_THRESHOLD = 16px` of slop before a drag begins or a long-press cancels
(B29). `LONGPRESS_MS = 500`; any release before that with movement under
threshold commits as a tap (B5).

**Instant commit, guarded against re-fire.** Every committing action lands on
release with no latency (B81) — the instant result is its own acknowledgement.
What survives from the retired 400ms window (B18) is only its drop-guard: a
*consequence* (Complete/Restore, Copy, Delete, Undo, a menu item, board
create/delete) commits at once and then holds a re-fire guard for `ACTION_DELAY`
(400ms), so an impatient double-tap is **dropped, not doubled**. First tap wins.

Navigation (opening a menu, swapping boards, entering an editor) and **capture**
(a note or lot line) commit nothing a stray second tap could duplicate — a
double-create self-heals when the second blurs the first empty frame (B8) — so
they take no guard at all and run raw, on desktop as on mobile.

There is no window left to fill: the `.tapped` weight/fill on content and
controls, and the empty-canvas `.tap-ghost`, are **retired**.

---

## §6 The touch floor

**44 CSS px physical on mobile** (WCAG 2.5.5 AAA). Because notes scale, this
cannot be a fixed padding: each note carries a computed `--hit` inset on a
transparent `::before`, sized so that `inset × scale × renderScale ≥ 44px`
physical (B7). **The hit area expands; the visual frame does not.**

On desktop the floor is 24px (WCAG 2.5.8 AA, pointer-appropriate) — a 44px collar
swallows dismiss clicks (B23). The 44px floor stands on touch.

**A collar is not obliged to be symmetric.** The note's is, because a note is
surrounded by paper on all sides. The board-action row (§3.3, B83) spends its
whole collar *upward*, onto the canvas, because downward is the Parking Lot's
own furniture — the direction a collar grows in is part of the decision, not a
consequence of `inset`.

---

## §7 The menu

Long-press (mobile) or right-click (desktop). The anchor menu's two items —
**All boards** and **Export** — are *also* the **board-action row** (§3.3, B83):
two flat tabs above the Parking Lot that invoke them directly, on both
platforms. That row replaces the `Menu` handle of B65, and is why removing the
handle costs desktop nothing — no long-press is armed there (B19/issue #4), and
desktop `contextmenu` now opens a **note's** Link menu (B91, §4.6). Since B100
desktop's route to All boards is the **rail** (the tab is retired); Export
stays a tab there. The mobile anchor long-press still opens the anchor menu
below.

| Menu | Items |
|---|---|
| Anchor | All boards · Export |
| Note (B91, B114) | Copy · Link |
| Board row / rail card | Export · Delete |
| Desktop selection | Complete/Restore · Highlight/Remove highlight · Delete |

Ordering is **navigation first, then the item's own actions in rising severity**
(B43, superseding A1). The destructive action is **always last, in `--danger`,
behind a hairline** — and never distinguished by colour alone (§1): position and
the divider carry the meaning independently.

**Copy** (B114, issue #171) re-homed here from the note's on-select toolbar
(§4.5) and is the menu's **first item** — the note's own state act before the
relational act, the same lead the echo menu takes with Complete. Its semantics
are the toolbar's copy branch verbatim: a single note copies that note's text;
on a desktop multi-selection that includes the tapped note, it copies the
**joined text of the whole selection, primary first, one `\n` between**. The
item is a real button (`GLYPH.copy`, labelled `Copy`), so keyboard access rides
the menu. A surfaced echo carries no Copy (§4.7) — its record lives on the
source board.

(2026-09-16: B120 — issue #173 — extends the note menu's item list: a new
"Add Title" item arms the note's optional Title, a header-style tab peeking
from behind the card's top-left corner. Copy's first position and the
ordering rule stand.)

**Highlight** (issue #105, B71) is a note-only toggle: it washes the whole note
in `--highlight` (§2.6.1) and, chosen again, returns it to the board's default
note surface. Its label states the act it will perform — **Highlight** on a plain
note, **Remove highlight** on a lit one — the same Complete→Restore grammar it
sits beside, never a fixed noun. On a desktop multi-selection the flip is on the
whole set (it removes only when *every* selected note is already lit, exactly as
the Complete item flips), with the plural **Highlight all** / **Remove
highlights**. The Parking Lot has no surface to wash, so it is not offered there.

Every menu says "All boards", and that is now the only place the word is
written: the list view carries no visible page heading (B66 supersedes B43's
heading clause) — its three category heads say where you are, and the screen's
accessible name lives on `#list-view`'s `aria-label`.

No long-press timer is armed over bare canvas or lot background — the release
still captures — and the `pointerdown` that dismisses an open menu is inert and
creates nothing, because dismissal is a retraction, not a choice of what was
underneath (B30).

---

## §8 Motion

**A closed, justified set. Nothing else animates.**

| What | Property | Duration |
|---|---|---|
| `#menu` | opacity | 200ms |
| `.note-scratch` / `.lot-scratch` | opacity | 200ms |
| `#toast` | opacity + transform | 200ms |
| `.leaving` (note, lot, row, card) | opacity | 200ms |
| `html.desktop #board.swapping` | opacity | 260ms |

Curve: a long deceleration — `cubic-bezier(0.22, 0.61, 0.36, 1)`. The durations
lengthen from v1's 120/150ms because §1.1 argues for a water-like settle, and a
120ms fade reads as a flicker rather than a movement.

**The set does not grow.** No new motion has earned its place. Two things stay
instant and are not candidates:

- **Note capture** (§5, B27) — the caret must arrive with the tap.
- **The control press-translate** (§14) — a control that lags feels broken, not
  calm.

**`prefers-reduced-motion: reduce` is a mandatory global kill-switch.** The
board-swap crossfade is sequenced by timeout in JS specifically so it degrades to
an instant swap rather than breaking.

---

## §9 The undo toast

Delete is undoable for **5 seconds** via a `role="status"` toast that restores
exact prior state, including a note's original index in its collection. A batch
delete is **one** window, one save and one Undo. A new destructive action
finalizes or cancels the prior undo.

The toast sits on `--chrome` with `--elevation` (§2.4) and a light edge (§2.5).
Its Undo is `--accent-restore` text distinguished by **underline** — not colour
(§1).

A save-failure toast must never clobber a pending Undo (B13).

---

## §10 The board list and the rail

**"All boards" is a category picker, not the boards themselves** (B74, issue
#112). Choosing "All boards" raises the four category buttons — To Do, Notes,
Learning, Ideas — and a board list lives on that category's **own drilled
screen**, reached by choosing its button. Routing is two levels of History API
state (`{v:'list'}` the picker, `{v:'cat',cat}` a drill, `{v:'cal'}` the calendar
(B95)) specifically so the OS back gesture returns through every level
(drill → picker → board; calendar → board). Back is never intercepted,
shadowed or disabled — and B95's top row makes the calendar's route
visible, so the gesture is a second way, never the only way. **The picker is
the Parking Lot turned into the 2×2 grid wherever it exists** (B100, issue
#157): on mobile and tablet, the two surfaces that carry the All-boards tab.

**Mobile and tablet:** the picker is not a screen of its own — it is the
**Parking Lot turned into a 2×2 grid** of the four category buttons, drawn over
the lot at its current height (expanded with it) and dismissed back to the lot
without ever touching the board's parking-lot data (B74; tablet joined by
B100, its tier admitted by B103's one width floor — 744px, any orientation). The grid reads clockwise from the
top-left: To Do, Notes, Learning, Ideas. A drilled category is then a **panel
that rises from the Parking Lot to a third of the viewport** (B82, issue #125),
most recently updated first, opening straight onto that one section — the board
stays visible above it, where a full-screen list once replaced it. **There is no
page heading** (B66): the category head says where you are. The panel's height is
`⌊viewport / 3⌋`, measured in JS off `window.innerHeight` and published as
`--list-panel-h` — never a CSS `vh`, so the soft keyboard (which moves only the
visual viewport, B28) does not drag it. The rise is the toast's `translateY`
idiom on §8's one 200ms curve, degrading to instant under reduced-motion; its
top edge is the Parking Lot's own `--frame` rule, rounded and on `--elevation`
as the transient surface it is (§2.4).

**Desktop:** an always-visible 300px rail (B24) — **sunken, not floating** (§2.4),
sitting outside `#board` so the recognizer never sees its events, listing all
four categories at once. Cards are the water's upper fall on `--chrome`, compact.
**The rail IS desktop's all-boards surface** (B100, issue #157): the All-boards
tab is retired there — `display:none` on both the board-action row and the
calendar's R1 row, the rail already naming every category with every board —
so `#list-view` has no entry path on desktop and never shows. The drill's
B82 split survives as code (rising panel under `html:not(.desktop)`), simply
unreachable on desktop; wide's board row is **two tabs** (Export · Import) and
the calendar's R1 row is **Back + Export**.

(2026-09-16: B118 — issue #211 — supersedes the rail's always-visible 300px
geometry: on wide the rail ships collapsed as a 40px face, mirroring the
calendar rail, and expands to the 300px pane on tap. The rest of this
section's rail grammar stands.)

(2026-09-16: B119 — issue #212 — narrows the picker above to **mobile-only**
and widens this arrangement's reach: tablet joins desktop as a wide tier
carrying the rail-only All-Boards surface — B96 put the pane there already —
and the tab-retirement clauses in this section's "desktop" headings read as
B96's wide, desktop ∪ tablet.)

**Both surfaces order a section by last touch, newest first** (B69, superseding
B24's immutable slot): the key is the later of `updatedAt` (written on every
committing action) and `catStamp` (written by a drop or a create), floored at
`createdAt`, with `createdAt` desc + an `id` tiebreak closing it so the sort is
total and no card can change slots between two renders of the same data. A card's
slot therefore **does** move — editing a board returns it to the top of its
section, which is the cost B69 accepted.

The four categories are **To-Do / Notes / Learning / Ideas** (B74, issue #112;
"Notes" keeps its storage key `unsorted` and its B63 relabel, Learning is the
new bucket, §2.2.2). On the **desktop rail** — the one surface that still shows
every category at once — a pointer-drag moves a card between sections with the
target section framing itself in `--accent-page` (over its resting frame,
below). The mobile drill shows one category alone, so it re-files by opening a
board rather than by dragging between sections. **A card wears its own
section's water** (B67): the cards are the water's upper fall, and since B67
that fall is per board type, so a card previews the board it opens rather than
describing a board that no longer looks like it. Since B72 the section itself is
a framed, tinted tray in the same family (its `--card` ground, its `--frame`
frame — see below), so each category reads as its own enclosed place; the drag
ghost carries the scope too, so a card does not change hue in the air. `--chrome`
remains the one room behind all four trays — it does not rotate (B55) — showing
through the list's padding and the gaps between sections. Overflow **pages**
rather than scrolling, and a single page hides its own pager: no state, no
statement (B42).

**Each section lays out as one grid, on both surfaces** (B63): a head row —
the category's display label left, and the section's **own `New board`
control** right, the two boxes one height — then the cards, then the pager
row **below the cards, centred**. The header sits at §13.1's display step —
**21px on mobile, 15px on the rail**, at `letter-spacing: 0.02em` (B74 re-tuned
these down from B63's 24/18 at 0.05em: the fourth, longest name, "Learning
Boards", would not otherwise keep its whole self beside the control in the
narrow rail — B63's own criterion, extended to the fourth category). The
furniture rows are **44px** on mobile — §6's floor exactly, the
control *is* the row — with the control's label at 14px, and **32px** on
desktop (a 32px control, its label at 13px). The global New board controls
are **removed** — creation lives in the categories: a section's control
writes `category` (+ `catStamp`, so the new card lands first, like a drop)
and **opens the new board at once**.

**A card is 44px and the gaps are two values** (B68). The row height is
`§6`'s touch floor and stops there: a card is a tap target, and what makes it
read as a discrete object with its own edge is the hairline and the water
fill, never the height. **4px** separates card from card inside a section;
**8px** separates section from section. This is the height on the **rail and the
desktop drill**; the **mobile drilled-list card** stands taller — **76px** — for
the two extra things B82 puts on it (below).

**The mobile drilled-list card carries a two-line title and a Last Updated
stamp** (B82, issue #125). In the third-height slide-up panel the card gives up
the sheet's width — **three to a row** (below) — so the title **clamps to two
lines** and then indicates truncation with `…`, and a **`Last Updated:
MM/DD/YY`** line sits **bottom-right** of every card (zero-padded month and day,
two-digit year). The stamp is the record's own `updatedAt` — already written on
every committing action (B69) — so nothing new persists. The rail and the
desktop drill keep the single-line 44px card, with the same `Last Updated` line
laid **inline** at the card's right; only the phone's panel restacks it under a
two-line title. The card is `76px` (`LIST_CARD_H`) and `catPageCap` budgets the
panel against it, the rail against its own 44px.

**Each section is a framed, tinted tray in its own family** (B72, issue #107).
The 8px gap alone left the categories reading as one run of buttons, so a
section now draws its own scene, not only its cards': its **`--card`** rung as
the tray ground and its **`--frame`** rung as a **2px inset frame**, both
rotated with the board type (§2.2.2). The card fill still sits **3.01:1** above
the `--card` tray (§2.5), so a card stays a discrete raised object on it, and
the frame reads **5.39:1** on the tray, **5.95:1** on the chrome around it
(§2.5). `--chrome` stays the one room behind — it does not rotate (B55) and
still shows through the list's padding and the section gaps — so the trays are
four enclosed places *within* one room. To-Do's tray is the quietest (its
`--card` is the chrome's own hue, one step up at 1.10:1); the frame is what
separates it, by design (§2.5 — its border separates, not its fill). The three
of ground, frame and radius are all layout-free, so the measured card budget
below is unchanged.

**The All-Boards picker button wears the board's water field** (B89, issue #135).
A category button — a tile in the lot-grid picker (the one picker, B100) —
grounds in its family's water gradient `linear-gradient(180deg,
var(--water-top), var(--water-mid))` — the same fill the board's own list cards wear
— inside its `--frame` inset frame, the category name centred on it. Its ground was
the section tray's near-black `--card` before, which read dull; the water lets a tile
preview its board. The `--water-*` stops are re-asserted per family on
`.cat-button[data-cat]` so a tile carries its OWN board's water, not the surrounding
board's (the mobile grid lives inside `#board[data-cat]`) — the B77 leak, closed for
the tiles too. So the picker, the drill and the rail still read as one design
language, four families told apart by hue exactly as the boards are.

**An empty category collapses to its head row** (B68): its label and its own
New board control stay — it is still somewhere to create, and still a target
to drop onto, one furniture row tall (44px on mobile, §6's floor; 32px on the
rail, past §6's B23 pointer floor) — and its cards and pager slots go to the
sections that have boards. The pager's slot is reserved wherever cards are
drawn, even when a single page hides the pager, so the budget cannot flap
between one- and many-page states.

**The per-page budget is measured, never a constant** (B42, restated B68,
B74, B82): the surface's real content height, less every *drawn* section's
furniture, in whole rows — **times the cards a row holds**. The mobile list
puts **three** to a row (B82 took it from B70's two); the rail keeps one,
because `PANE_W` is 300 and two would be narrower than the titles they name.
Since B74 a mobile drill shows **one** category; since B82 it shows it in a
panel a third of the viewport tall, so `catPageCap` is told one section is drawn
and measures the panel's real height — roughly **six** cards on a 384×846 phone
(three across, two rows), the density the shorter panel trades for keeping the
board in view. The desktop rail still stacks all four categories, splitting the
height and reclaiming a collapsed section's rows for the ones with boards. Where
the measurement falls short of what is asked for, the pager states it — a number
that clipped off the bottom of a short phone would be a lie about the height.

**Truncation is always indicated** — `text-overflow: ellipsis` on the single-line
card, a **two-line `-webkit-line-clamp`** on the mobile drilled card (B82), never
a hard cut.

A rail board swap is a 260ms crossfade (§8) with **no history push** — B9 is
bypassed, not touched.

---

## §11 Scale to fit

One logical page, one render scale. Stored coordinates are converted for display
and **never mutated by a layout change** — a rotation, a fold or a window drag
changes how a position renders, never what it is.

**The mapping is a similarity transform (ruled B64; issues #65, #75).** Each
note renders through one uniform ratio `k = min(LOGICAL_W/rw, LOGICAL_H/rh)`
— the smaller of the two frame ratios — applied to `x`, `y` **and** size, so
a fold, a rotation or a window drag maps the arrangement as a figure: pairwise
angles and distance ratios are preserved, and `min` keeps every authored
position on the page by construction. The figure is anchored top-left, never
centred; slack falls to the right and bottom as open canvas. Pre-B32 notes
carry no legacy branch: B93's one-time boot migration adopts every rh-less
note onto this path by writing the position it already renders, so no note
reaching the renderer lacks `rh` (B93).

---

## §12 Accessibility

Non-negotiable. The target is **WCAG 2.2 AA**, with AAA where the product already
reaches it. This section is the specification; `PRD §9.6` states only the parts
a test can prove.

- Every editable region carries `role="textbox"` / `aria-multiline`.
- The toast is a polite `role="status"`.
- Focus is visible on every interactive element via §2.7's ring, at
  `outline-offset: 2px` on free-standing controls and `-2px` on inset rows.
- **Never colour alone** (§1), everywhere, without exception.
- Truncation is always indicated (§10).
- The desktop rail is hidden from assistive technology off-desktop.
- Keyboard: `Esc` deselects or commits an edit, `Delete` removes the selection,
  `Enter` edits it.
- `prefers-reduced-motion: reduce` kills all motion (§8).
- Touch targets meet §6.

---

## §13 Typography and marks

*New in v2.*

### §13.1 The typeface

**Montserrat Alternates**, self-hosted, **no CDN**.

A CDN font is a network dependency and an uncacheable hole in an offline-first
shell (`PRD §3.2`, `PRD §3.3`). The three weight files are committed in
`fonts/`, extracted from proof sheet 7's embedded faces, declared with
`@font-face`, listed in `sw.js`'s `ASSETS`, and subject to the cache bump —
wired when the system shipped, exactly as this section ordered.

**Three weights** — 400, 600, 800 — as Latin-subset `woff2`, with
`font-display: swap` so capture is never blocked on a font load. Montserrat
Alternates has no variable version, so each weight is a separate file; three is
the smallest set covering body, the existing 600 emphasis, and the button's heavy
label.

Size scale is retained: 11 · 12 · 13 · 14 · 15 · 16 · 17 · 18px; line-heights
1.3 / 1.4 / 1.45 — and one display step above it: **21px** (the mobile category
header, B63's step re-tuned down by B74; the rail's header takes the scale's own
**15**, likewise down from 18). The category names are short (B78 — "To Do",
"Notes", "Learning", "Ideas"), so the header clears its control with room to
spare; the re-tuned sizes are kept.

### §13.2 The band measurement gate

Montserrat Alternates has a different apparent x-height from `system-ui`. The
band is **sized by the type it holds** (B37, §3), so changing the type changes
the band. **The gate is discharged.** Measurements taken from the font's own
`hmtx` advances, with no kerning applied, so every figure is a conservative
upper bound on what a browser draws:

| # | Measurement | Result | |
|---|---|---|---|
| 1 | "Requirements" at 13px/600 against the 100px column `--card-w`'s floor guarantees | **95.2px** | clears, 4.8px spare (96px browser-rendered) |
| 2 | Two-line title box against `--band-top + --card-h = 82` | **79px** | clears |
| 3 | 11px pager against `PANE_PAGER_H = 32` | **14.3px** | clears |

x-height is 0.534em and cap height 0.700em at 1000 units per em.

> **The gate clears, and the pixel it opened is taken: the label is 13px**
> (B54). B38 set the label to 12px because that was "the largest whole px at
> which the widest measured *Requirements* (~118px at 15px) fits the 100px
> column" — a measurement taken in `system-ui`. In Montserrat Alternates the
> same word sets **95.2px at 13px**, so B38's own rule applied to the face the
> app owns returns 13, and keeping 12 would have inherited a dead face's
> measurement. The band is sized by the type it holds (B37), so the formula's
> label term moves 15.6 → 16.9 and the band grows by exactly the pixel: 88 at
> the floor, 107 at three lines (§3.1). Rendered at both sizes on proof sheet
> 8; the ratified render is `proofs/proof-9-a-well-furnished.html`.

**Superseded by B76 (issue #111):** the label no longer sits above the rule, so
its `+ 16.9 + 10` term left the band budget — the band closes at **61 at the
floor, 81 at three lines** (§3.1). The 13px measurement stands; only its place
moved, below the rule as a tab.

Still a gate for anything downstream: `test/mobile.js` asserts band and lot
geometry, so a later font change that moves the band **fails the suite**, which
is the correct outcome.

### §13.3 Marks

v1's glyph set — `✓ ↺ ▦ ⇩ ⧉ 🗑 « ‹ › »` — is **retired as type and redrawn as
inline SVG** in `currentColor`.

The reasoning is the one `app.js` already applies to `🗑` and then does not
follow through on. Montserrat Alternates is a Latin display face: of those ten
marks, the four guillemets are plausibly in a Latin subset. **The other six —
`✓ ↺ ▦ ⇩ ⧉ 🗑` — fall back** to whatever the platform supplies, which is exactly
the objection raised against the colour-emoji bin, multiplied by six, and it
means the app's symbols are drawn by Android, iOS and Windows in three different
voices.

Interrogating what a menu glyph actually *is* settles it. It is not text — it is
a symbol being asked to do something type cannot do: render identically
everywhere, in one hand. Type is the wrong medium for that job. Drawing them:

- puts every mark in the app rather than on the platform, which is the identity
  claim §13.1 is making in the first place;
- solves the bin structurally instead of by substitution;
- costs no dependency and no build step — inline SVG in `app.js`'s existing
  `GLYPH` map;
- and lets the marks be drawn **at the note's own stroke weight and corner
  radius**, so the icon set is literally in the same hand as the board. That is
  function borrowing from form, and it is not available to a typeface.

The set is drawn whole, including the guillemets, which type would also have
served. One voice beats one saved path. *Impermanent:* if a mark proves
unreadable at 16px, it is redrawn — not swapped back to a code point.

Semantics carried forward, unchanged: `⇩` is "out of the app, down to the
device," not `↓` (a borrowed browser-download convention) and not `📄` (which
restates the noun). `⧉` is "this, again, elsewhere" — two frames, one content.
Guillemets read as "page", not "play".

The **link** mark (B91, §4.6) joins the set: two small nodes joined by a diagonal
line — the mark *is* the thing it makes, a connection between two notes, in the
same hand and stroke weight as the rest (no arrowhead, matching the line itself).

### §13.4 The icon

B1's motif, unchanged — the note-frame, two text lines, the completion
stroke — drawn in what a note now *is*: `--note` `#a0d4da` behind its 2px
`--ink-dark` frame, **on the deep** (B60, re-ruled when B58 moved the notes'
ground; supersedes B56's water). The launcher is where the identity claim
meets the person first, and the claim is the canvas the note actually lives
on — at 12.36:1, the strongest it has ever read. Generated by the committed,
dependency-free `icons/make-icons.js` (the water kept as a `--ground` flag);
the maskable variant keeps the motif inside the ~80% safe zone with the deep
bleeding to the mask's edge.

---

## §14 Controls

*New in v2.*

Four species. All share one tactile signature; each keeps its own fill.

**Primary** (`New board` — the per-category create control, one on every
section's head row since B63; refilled by B59 when the sand retired — the
accent about boards, on the controls that make one; the construction below is
unchanged, except that the category instance sizes its label to its row:
14px mobile, 13px desktop, B63):

```css
.primary-btn {
  background: var(--accent-page);
  color: var(--ink-dark);              /* 6.44:1 */
  border: 2px solid var(--ink-dark);   /* §2.5 */
  border-radius: 0.4em;
  box-shadow: 0.1em 0.1em var(--ink-dark);
  font-size: 16px; font-weight: 800;
  min-height: 44px; padding: 0 18px;   /* §6 */
}
@media (hover: hover) {
  .primary-btn:hover { transform: translate(-0.05em, -0.05em);
                       box-shadow: 0.15em 0.15em var(--ink-dark); }
}
.primary-btn:active  { transform: translate(0.05em, 0.05em);
                       box-shadow: 0.05em 0.05em var(--ink-dark); }
```

The offset shadow and press-translate are the **shared tactile signature** across
all four species — the thing that makes a control feel like a control. It is
instant (§8).

Five corrections against the source reference this was drawn from, each with its
reason:

| Source | Corrected | Why |
|---|---|---|
| `font-color: #f4f5f1` | `color: var(--ink-dark)` | `font-color` is not a CSS property; and light ink on the original grey was 4.26:1, below AA |
| `font-size: 10px` | `16px` | below the app's 13–16px control scale, and unreadable against a 44px target |
| `padding: 0.6em 1.3em` | `min-height: 44px; padding: 0 18px` | §6; em-padding on a 16px label does not reach the floor |
| bare `:hover` | `@media (hover: hover)` | mobile is the primary path; a bare hover sticks after a touch |
| `box-shadow: 0.1em 0.1em` | `… var(--ink-dark)` | unqualified it inherits `currentColor` |

**Lot-row actions** (`.sel-btn` — Complete · Copy · Delete, inline on a selected
Parking Lot row, desktop only, B25): accent fill per §2.6, or `--chrome` for Copy,
`--ink-dark` label, ink border, same shadow geometry. Copy takes plain chrome
because it changes nothing — accents mark state changes. Since B84 this is the only
place `.sel-btn` is drawn — a *note's* actions are the flat tabs of §4.5, not this
raised control.

**Pager** (`.pager-btn`): `--accent-page`, same construction, `opacity: 0.4`
when disabled.

**Menu rows and the toast's Undo** carry no fill: rows are bare on `--chrome` and
fill on tap; Undo is underlined text (§9).

**The board-action row** (`.board-action` — the `All boards` and `Export` tabs
above the Parking Lot, B83, §3.3): the one control that **does not** wear §14's
tactile signature. It is the band label's flat box — `--frame` fill, `--ink-dark`
label at **5.70:1** (rebound by `.on-light`), `13px/600`, `padding: 2px 6px`,
symmetric `border-radius: 3px` — because **All boards** navigates and **Export**
leaves the device; neither acts on a note, so they belong to the sheet's own
furniture, not to the family of controls that say "I have your content."

```css
.board-action {
  padding: 2px 6px; border: none; border-radius: 3px;
  background: var(--frame); color: var(--ink);   /* --ink-dark via .on-light */
  font-size: 13px; font-weight: 600; line-height: 1.3;
}
```

Its interactive feedback is a transient `filter: brightness` on hover/press
(§8's curve, dropped to instant by the kill-switch) and §2.7's two-tone ring on
focus; the offset shadow and press-translate are deliberately absent. Placement,
the decoupled `--hit` collar and the **All boards ⇄ This board** toggle live in
§3.3. This **supersedes the compartment's handle** (`#title-menu`, B65): the
fifth species is retired with the handle it dressed, and no control on the sheet
now wears `--frame` as a tactile chip — the fill returns to being purely the
band tab's (B76).

---

## §15 Where the identity does not reach

**The PDF export stays paper-light.** A dark board prints as a slab of near-black
and costs a cartridge to discover. The export is a reference sheet *for paper*,
and paper is the ground it is designed against — so §2's ladder does not apply
to it, by intent rather than omission.

Montserrat Alternates **does** reach the export: the PDF embeds it, so the
document is typographically the app's even though it is not chromatically the
app's.

---

## §16 Implementation consequences

Named here so the follow-up work was scoped rather than discovered — and
landed with the v2 release, in the shape this list ordered. Scoped in
`PRD §9` and verified per `PRD §9.6`.

1. **Five colour sync points, none automated.** `styles.css :root`;
   `index.html`'s two `theme-color` metas (which collapse to one — there is one
   theme); `manifest.json`'s `background_color` and `theme_color`; and `app.js`'s
   `PDF_PAPER` / `PDF_INK` / `PDF_SHADE`, which are hand-derived floats; and
   `icons/`, whose B1 motif is drawn in the poles and must be regenerated, as
   B16 regenerated it. Changing a token in one place silently desynchronises
   the others. `PRD §9.6` requires a test that fails when they diverge.
2. **PDF font embedding is the largest single item.** The exporter uses base-14
   Helvetica with hardcoded base-36 advance-width tables. Embedding requires
   `.ttf` (not `woff2`) for `FontFile2`; a `/FontDescriptor`; a `/Widths` array
   with `/FirstChar`/`/LastChar`; real advances read from `hmtx`/`hhea`; and
   `PDF_ASC`/`PDF_DESC` re-derived from the font's own em box. The existing
   `/WinAnsiEncoding` + CP1252 layer is unaffected. With no build step there is
   no subsetter, so both weights embed whole — roughly 150KB per exported PDF.
   That cost is accepted deliberately.
3. **`EXPORT_GEO.radius`** mirrors the CSS radius by hand and moves 2 → 3 (§4).
4. **`sw.js`** `ASSETS` gains `fonts/`; `CACHE` bumps.
5. **The light theme is removed, not overridden** — the whole light `:root` and
   the `prefers-color-scheme: dark` block both go (§2.1).
6. **`--ink` becomes per-surface and `--line` is deleted** (§2.3). This is a
   rebinding, not a rewrite: downstream rules keep reading `var(--ink)`.
7. **The marks become SVG** (§13.3), which changes `GLYPH` from a map of strings
   to a map of markup and touches every site that injects one.
8. **`--furniture` is retired and `--band`, `--card` and `--frame` replace it**
   (§2.2, §2.5). The band and the compartment are no longer one surface, and the
   linework is no longer ink.
9. **Two surfaces stop being values.** `--board` becomes a three-stop field plus
   a falloff plus dither (§2.8); `--shelf` becomes a base plus turbulence wisps
   (§2.9). Both are pure CSS and one inline SVG each — no dependency, no build
   step, and paint-only — the layout cost is untouched.
10. **`test/tokens.js` cannot stay a pure function over constants.** With a
    non-flat ground every ratio is a range. The rule becomes: *a non-flat
    surface declares its extremes, and every adjacency is asserted against the
    worst one.* Tractable because the field is authored as opaque stops and
    because the falloff and dither can only darken (§2.8).
11. **The band and the lot both size to their content** from a two-line and a
    two-row floor respectively (§3.1, §3.2), and both rules go full width. This
    supersedes **B32**, **B35/B38** and **B37**; `EXPORT_GEO` and
    `test/mobile.js`'s geometry assertions both move with it.

### §16.1 What is not settled

Recorded here so it is not mistaken for decided:

- **The Delete button's boundary on the field has a narrow handover.** Its fill
  separates below the field's mid stop (3.90:1) and its `--ink-dark` border at
  the top (3.18:1); across a narrow reach of the fall the two cross at ~2.99 —
  a hair under the 3:1 component floor. This lives in §14's construction
  meeting §2.8's field, not in any accent value. Surfaced by round 8's
  verification; not yet ruled.

Everything else this list has carried is settled and has moved into the body,
with the proof sheets as provenance and `DECISIONS.md` as the record: the desk
token is retired (§2.2), the brightest-surface claim is reworded rather than
defended (§2.2, `PRD §1.4`), the lot keeps its top rule in its own ink (§2.5),
`--frame` is ratified (§2.5) — B46+ — and round 8's three, ruled B52–B54: the
chrome family (§2.2, §2.6), the scratch-out's pair (§4.3), and the 13px band
label (§3.1, §13.2), rendered whole in
`proofs/proof-9-a-well-furnished.html`.

### §16.2 Retiring v1's tokens

Thirteen tokens exist in v1. **Every one has a fate here**; a token with no
stated fate is a call site nobody knows how to edit.

| v1 token | Sites | v2 |
|---|---|---|
| `--paper` | 22 | **split** — as a ground → §2.2's ladder by role; as a label on a fill → `--ink-dark` (§2.3) |
| `--ink` | 38 | **split** — `--ink-light` or `--ink-dark`, rebound at the surface (§2.3) |
| `--ink-rgb` | 1 | **renamed** → `--ink-a`, rebound per surface (§2.3) — and corrected: v1 declared comma-separated channels and used them with slash alpha (`rgb(34, 28, 36 / 0.4)`), which CSS Color 4 rejects, so the buried-text fade (§4.3) may never have rendered. The v2 form is space-separated and valid |
| `--ink-shadow` | 8 | **retired** — a second mid-tone has the same defect `--line` had (§2.3.2). Placeholders, dates and category heads take the ground's pole (the tap-ghost that also took it at a low alpha is itself retired, B81) |
| `--letterbox` | 2 | **retired** — never drawn (§2.2). `html` keeps a plain black background, which is not a token |
| `--surface-raised` | 3 | **retired** → `--chrome` — v1 raised menus *above* paper; v2 sinks them below the board (§2.2, B52) |
| `--hairline` | 6 | **retired** → `rgb(var(--ink-a) / 0.4)` — that surface's ink at the lowest alpha clearing 3:1 on it (§2.5) |
| `--danger` | 7 | **kept**, re-derived and held (§2.6, B52) |
| `--accent-restore` | 5 | **kept**, re-derived to the note's family (§2.6, B52) |
| `--focus-ring` | 11 | **retired** — no single hue works on six grounds; replaced by the two-tone ring (§2.7) |
| `--elevation` | 3 | **kept** (§2.4), gains an inset variant for `#pane` |
| `--pane` | 1 | **retired** → `--chrome` (§2.2, B52) |
| `--accent-page` | 2 | **kept**, re-derived to the field's family (§2.6, B52) |

**And the second swap's fates (B58–B61)** — the same discipline applied to the
tokens the swap moved:

| Pre-swap token | Fate |
|---|---|
| `--band` | **renamed** → `--deep`: the value moved from the band to the canvas, and the name follows the surface it grounds (§2.2) |
| `--board-top/-mid/-bot` (+ `-a`) | **renamed** → `--water-top/-mid/-bot` (+ `-a`): the field grounds the two sections now, not the board (§2.8) |
| `--sand-light/-base/-dark` | **retired** — the lot takes the water (§2.8); the primary takes `--accent-page` (B59) |
| `--sand-taupe`, the three wisps | **retired with their ground** — the turbulence weather leaves with the sand (§2.9) |
| `--chrome`, `--card`, `--frame`, `--note`, inks, accents, elevations | **kept**, unmoved — the swap trades surfaces, not values |

### §16.3 What pins this document

Per surface, what would actually fail if the words above were violated today:

| Clause | Pinned by |
|---|---|
| §2 — every token, every ratio | `test/tokens.js` (`PRD §9.6`): every table here recomputed from the shipped hexes, each range at its worst extreme, plus the sync points, the accent placement rule, self-hosting and B53's pair |
| §2.2.2 — five ladders, one axis | `test/tokens.js` [1b] parses the palette **per scope** (`:root`, `#board[data-cat="idea"]`, `#board[data-cat="unsorted"]`, `#board[data-cat="learning"]`, `#cal-view`), asserts each rung's luminance against the shared column, asserts the two spellings of the darkest stop agree (`--water-bot` / `--water-bot-a`), asserts nothing inside `#cal-view` re-scopes the ladder (issue #168), and asserts `--chrome`, the ink poles and the accents are *not* rebound. §2.3/§2.5/§2.7's tables are then run against all five ladders with one expected number each |
| §3 — band and lot geometry | `test/mobile.js` [9c]/[11b]/[11c] and `test/desktop.js` [D8] — moved with B47/B54 when the band shipped, recomputing rule-y from the formula (88 floor / 107 at three lines); `test/mobile.js` [21] and `test/desktop.js` [D21] pin the board-action row above the lot, prove its live tabs clear the touch/pointer floor (B95's re-grammar; B100's desktop retirement means the row's two visible tabs), export a PDF, and confirm the `#title-menu` handle is gone (B83); §3.4's calendar is pinned by `test/tokens.js`'s issue-#145 block (window computed at render, one mirror writer, link coercion, squeeze as render-time state) |
| §3/§7 — `EXPORT_GEO` agreement | `test/mobile.js` [11c] pins export geometry to the rendered board — the intended tripwire |
| §4 — wrap, similarity render, centred text | `test/mobile.js` (B39 scenarios; [12c] pins B64's fold/rotate similarity — shape held, size uniform, storage untouched, round trip exact; [18b] computes the alignment, editing and at rest) and `test/desktop.js` [D13] (the silent cross-frame grab folds k) and [D17b] — the computed style, plus the centring inset parsed out of page 1's content stream (B62) |
| §5 — the recognizer, both grammars | `test/mobile.js`, `test/desktop.js` |
| §7 — menu contents and order | `test/mobile.js` [8]; the board-action row's two tabs (All boards · Export) by `test/mobile.js` [21] and `test/desktop.js` [D21], the anchor long-press menu still by `test/mobile.js` [16] (B83) |
| §8 motion, §12 accessibility beyond floors | **nothing** |
| §13.2 — the band under the new face | measured from `hmtx` here; the live gate is `test/mobile.js`'s geometry, now running against the shipped face |
| §16 — that shipped CSS reaches an installed PWA | `test/sw-update.js` (B36) — its marker moved with the band: `--card-h` died with B47, so the regex now reads `--band-top: 14px` literally out of `styles.css`, and `test/tokens.js` asserts the marker matches the shipped stylesheet |

---

## §17 Cross-reference

The codebase's `UIUX §x` citations resolve to their own numbers here — that is
why §1–§12 keep their v1 meanings. For completeness:

| Citation | Here |
|---|---|
| `UIUX §1` — governing law, identity | §1 |
| `UIUX §2` — design tokens | §2 |
| `UIUX §2.4` — elevation | §2.4 |
| `UIUX §3` — board geometry | §3 |
| `UIUX §4` — the note component | §4 |
| `UIUX §4.1` — transform origin, truthful coordinates | §4.1 |
| `UIUX §4.2` — note states, focus | §4.2, §2.7 |
| `UIUX §4.3` — the scratch-out | §4.3 |
| `UIUX §4.4` — lot lines are never framed | §4.4 |
| `UIUX §5` — gestures | §5 |
| `UIUX §6` — the touch floor | §6 |
| `UIUX §7` — the menu, destructive last | §7 |
| `UIUX §8` — motion | §8 |
| `UIUX §9` — the undo toast | §9 |
| `UIUX §10` — the board list, truncation | §10 |
| `UIUX §11` — scale to fit | §11 |
| `UIUX §12` — accessibility | §12 |
| `styles.css §1` — "identity from structure, never costume" | §1 |

**The prefix mandate.** Every new citation names its document — `PRD §x`,
`UIUX §x`, or a `B`-number — never a bare `§x`. The codebase already carries
bare cites that mean different documents in the same file (`styles.css` mixes
`§6.1`, this document's anchors under PRD numbering, with `§6`, this document's
touch floor); existing cites keep their meaning, and new ones do not add to the
ambiguity.

New in this revision, so nothing existing moves: **§2.2.1** the generative law,
**§2.3.1**/**§2.3.2** the crossover and the forbidden band, **§2.8** the board
as a field, **§2.9** the shelf as weather, **§3.1** the band, **§3.2** the
Parking Lot as a section, **§13.4** the icon, **§16.1** what is not settled,
**§16.2** retiring v1's tokens, **§16.3** what pins this document. Every
citation above keeps the meaning it already had.
