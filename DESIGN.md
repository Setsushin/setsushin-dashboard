---
name: Setsushin Dashboard
description: A scholar's cabinet — personal command surface, warm paper, single accent.
colors:
  ink-deep:        "#2b2419"
  ink-muted:       "#6b5c48"
  ink-faded:       "#9a8a72"
  ink-subtle:      "#c4b69c"
  paper-app:       "#f6f1e8"
  paper-content:   "#fbf7f0"
  paper-card:      "#ffffff"
  paper-card-soft: "#f4ede1"
  walnut-binding:  "#2a231d"
  walnut-active:   "#3d342c"
  peach-mark:      "#d97757"
  peach-mark-soft: "#f6e3d8"
  signal-success:  "#7ba05b"
  signal-warning:  "#d9a85a"
  signal-danger:   "#c75a4a"
typography:
  page-title:
    fontFamily: '-apple-system, BlinkMacSystemFont, Inter, "SF Pro Text", "PingFang SC", "Hiragino Sans", sans-serif'
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  stat-value:
    fontFamily: '-apple-system, BlinkMacSystemFont, Inter, "SF Pro Text", sans-serif'
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
  panel-title:
    fontFamily: '-apple-system, BlinkMacSystemFont, Inter, "SF Pro Text", sans-serif'
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, Inter, "SF Pro Text", "PingFang SC", "Hiragino Sans", sans-serif'
    fontSize: "13.5px"
    fontWeight: 300
    lineHeight: 1.45
    letterSpacing: "normal"
  label-mono:
    fontFamily: '"SF Mono", "SF Pro Text", monospace'
    fontSize: "10.5px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.02em"
rounded:
  xs:   "6px"
  sm:   "10px"
  md:   "14px"
  lg:   "18px"
  xl:   "22px"
  pill: "999px"
spacing:
  card-pad-default: "22px"
  card-pad-compact: "14px 18px"
  card-pad-comfy:   "28px"
  gap-default:      "16px"
  gap-compact:      "12px"
  gap-comfy:        "20px"
components:
  panel:
    backgroundColor: "{colors.paper-card}"
    textColor:       "{colors.ink-deep}"
    rounded:         "{rounded.lg}"
    padding:         "{spacing.card-pad-default}"
  panel-compact:
    backgroundColor: "{colors.paper-card}"
    textColor:       "{colors.ink-deep}"
    rounded:         "{rounded.lg}"
    padding:         "{spacing.card-pad-compact}"
  stat:
    backgroundColor: "{colors.paper-card}"
    textColor:       "{colors.ink-deep}"
    rounded:         "{rounded.lg}"
    padding:         "{spacing.card-pad-default}"
  icon-btn:
    backgroundColor: "{colors.paper-card}"
    textColor:       "{colors.ink-muted}"
    rounded:         "{rounded.pill}"
    padding:         "0"
    width:           "38px"
    height:          "38px"
  icon-btn-active:
    backgroundColor: "{colors.peach-mark-soft}"
    textColor:       "{colors.peach-mark}"
    rounded:         "{rounded.pill}"
  panel-action:
    backgroundColor: "transparent"
    textColor:       "{colors.ink-muted}"
    rounded:         "{rounded.sm}"
    padding:         "4px 8px"
  panel-action-hover:
    backgroundColor: "{colors.paper-card-soft}"
    textColor:       "{colors.ink-deep}"
  search-input:
    backgroundColor: "{colors.paper-card}"
    textColor:       "{colors.ink-deep}"
    rounded:         "{rounded.pill}"
    padding:         "9px 12px 9px 38px"
  sidebar-item:
    backgroundColor: "transparent"
    textColor:       "{colors.ink-faded}"
    rounded:         "{rounded.md}"
    padding:         "9px 12px"
  sidebar-item-active:
    backgroundColor: "{colors.walnut-active}"
    textColor:       "{colors.paper-content}"
    rounded:         "{rounded.md}"
    padding:         "9px 12px"
---

# Design System: Setsushin Dashboard

## 1. Overview

**Creative North Star: "The Scholar's Cabinet"**

Setsushin is a single-owner personal command surface that should feel like a
small library: warm paper underfoot, a walnut binding running down one
edge, a single peach bookmark left between pages. The owner reads it daily.
Nothing in the room is loud. Everything in the room is cared for.

Density is welcome — this is the bridge of a working ship, not a meditation
app — but density is earned through typographic discipline, hairline
borders, and tight scale ratios, *not* by stuffing the page. When the
dashboard is at rest, it is at rest. Motion is the exception, never the
ambient state. Color is one accent and the paper; everything else is ink at
varying strengths.

This system explicitly rejects the four anti-references in PRODUCT.md: the
AI-tool aesthetic (no neon, no glassmorphism, no gradient text), the
enterprise BI density wall (no Tableau-style chart-of-everything), the
cookie-cutter SaaS dashboard (no cool-grey + iris-gradient hero, no big-
number-small-label cards in a uniform grid), and the consumer-warm
dashboard (no emoji decoration, no friendly nudges).

**Key Characteristics:**
- Warm cream + walnut + a single peach mark (one accent, ≤10% of any view)
- Hierarchy carried by typography (weight × scale × serif-vs-mono), not whitespace
- Hairline borders, paper-soft shadows, no decorative gradients
- Authored: serif headlines, mono labels, asymmetric stat strips are fair game
- Stillness at rest; motion only as response to user input

## 2. Colors: The Paper-and-Ink Palette

The whole system reads as ink on warm paper. There are three "real" colors —
ink, paper, walnut — and one mark.

### Primary
- **Peach Mark** (`#d97757`): The single accent. Active nav, focus
  ring on the search input, status dots, brand mark, header underline. Used
  on at most ~10% of any rendered surface — its rarity is what keeps it
  from looking like decoration.

### Neutral — Ink
- **Ink Deep** (`#2b2419`): Body text, panel titles, the page H1. Warm-
  brown black; `#000` is forbidden anywhere in the system.
- **Ink Muted** (`#6b5c48`): Secondary text — meta, captions, panel
  actions, secondary nav.
- **Ink Faded** (`#9a8a72`): Tertiary text — date subtitle, timestamps,
  hint text under a panel title (`mock — reason`).
- **Ink Subtle** (`#c4b69c`): Disabled / placeholder ink. Rarely used.

### Neutral — Paper
- **Paper App** (`#f6f1e8`): The outermost room — visible only at the
  edges and behind the rounded main pane. The slightly-darker cream that
  frames the lighter content surface.
- **Paper Content** (`#fbf7f0`): The active reading surface — rounded
  pane behind the grid.
- **Paper Card** (`#ffffff`): The page proper. Panels and stats sit on
  pure white paper to lift them off the cream.
- **Paper Card Soft** (`#f4ede1`): The "tonal" tone — used for inset
  fields, kbd hints, hovered actions, stat icon backplate.

### Neutral — Walnut (the binding)
- **Walnut Binding** (`#2a231d`): The sidebar background — the dark
  spine of the book. In dark mode this becomes nearly black.
- **Walnut Active** (`#3d342c`): Active nav item background, walnut +
  one notch lighter.

### Status (used sparingly)
- **Signal Success** (`#7ba05b`): Sage-leaning green for positive deltas
  in markets / portfolio.
- **Signal Warning** (`#d9a85a`): Honey for cautionary states.
- **Signal Danger** (`#c75a4a`): Brick red for negative deltas / delete
  affordances. Notice all three sit in roughly the same warm/muted family
  as the rest of the palette — no Bootstrap-bright reds here.

### Tonal Variants
The system supports three alternate tones (`cool`, `sage`, `lavender`) and
a dark mode (`light` / `dark`). Each variant rebinds the same five neutral
roles so the structural rules carry forward unchanged. The default is
**cream + light**; everything in this document refers to the default
unless noted.

### Named Rules

**The One Mark Rule.** The peach accent is used on ≤10% of any rendered
surface. It marks the user's place — the active nav item, the focus ring,
a status dot — never as decoration. If it shows up in a third place on a
single panel, one of the three is wrong.

**The No-Black Rule.** Pure `#000` and pure `#fff` are forbidden as text
or surface colors. Every neutral is tinted toward warm-brown. Even dark
mode uses `#18130d` (warm dark) instead of `#0a0a0a`.

**The No-Decorative-Gradient Rule.** Decorative gradients are forbidden
on backgrounds, hero areas, and text. The two existing gradients (brand
mark, avatar button) are scheduled for replacement; do not introduce new
ones. A flat solid + a precise shadow is always preferable.

## 3. Typography

**Display Font:** Inter / SF Pro Text (system stack), with PingFang SC,
Hiragino Sans, and Noto Sans CJK as per-glyph fallbacks for SC + JP + EN
mixed text.
**Body Font:** same stack — currently single-family.
**Label/Mono Font:** SF Mono, with Helvetica Neue and Segoe UI as desperate
fallbacks.

**Character:** A single humanist sans does the heavy lifting today, with
mono used as a typographic accent for keyboard hints and small chips. The
brand brief calls for *more* serif and *more* mono in the hierarchy —
that direction is a Do, not a current state.

### Hierarchy (current)
- **Page Title** (`600`, `30px`, line-height `1.15`, tracking `-0.02em`):
  The H1 in `PageHeader`. Tight tracking and a -0.02em pull.
- **Stat Value** (`600`, `28px`, line-height `1`, tracking `-0.02em`): The
  big number in stat tiles. Same setting as page title at slightly smaller
  size.
- **Panel Title** (`600`, `15px`, line-height `1.3`, tracking `-0.01em`):
  The card heading. Sits at a deliberate gap below the page title.
- **Body** (`300`, `13.5px`, line-height `1.45`): Content inside panels —
  task rows, feed entries, calendar items. The light weight is the system's
  most distinctive choice; do not change it without auditing every screen.
- **Label / Mono** (`500`, `10.5px`, tracking `0.02em`): Kbd hints, badges,
  search shortcut chip. Always SF Mono.

### Named Rules

**The Light-Weight-By-Default Rule.** Body copy is `font-weight: 300`. The
system's restraint comes partly from this. Heavier-weighted bullets (e.g.
`500` task rows, `600` panel titles) gain hierarchy purely through weight
contrast against the light body — `1.25` ratio at minimum between any two
adjacent levels.

**The Mono-As-Caption Rule.** Mono type is reserved for machine-readable
labels (shortcuts, timestamps, status codes, ticker symbols). It is *never*
used for body. Its appearance signals "this is metadata", and that
contract must hold.

**The Tracking-Tightens-As-Size-Grows Rule.** Display sizes (≥28px) carry
`-0.02em` tracking. Mid sizes (15–18px) carry `-0.01em`. Body and below
carry `0`. Mono carries positive tracking (`+0.02em`). Larger type wants
to be tighter; mono wants to breathe.

## 4. Elevation

The system is **mostly flat**, with two soft warm shadows that signal "this
is paper resting on paper, not glass floating above void."

### Shadow Vocabulary
- **Card Shadow** (`0 1px 2px rgba(80,50,20,0.04), 0 4px 14px rgba(80,50,20,0.06)`):
  Default for `.panel`, `.stat`. The `rgba(80,50,20,…)` tint matches the
  walnut color family — never use neutral-grey shadows on warm surfaces.
- **Pop Shadow** (`0 8px 28px rgba(80,50,20,0.14)`): Reserved for popovers,
  the avatar button, and elevated edit-mode chrome. Should appear at most
  once per visible viewport.

In dark mode, both shift to true-black shadow values (`rgba(0,0,0,0.25–0.3)`)
since the warm tint loses contrast on dark surfaces.

### Named Rules

**The Paper-Not-Glass Rule.** Shadows simulate paper resting on paper:
short, warm, and soft. They are forbidden from going above 28px blur or
0.18 alpha — anything more reads as the AI-tool glow we've called out as
an anti-reference.

**The Borders-Do-the-Work Rule.** Hairline borders (`1px solid var(--border-soft)`,
`rgba(120,88,60,0.08)`) carry most of the depth signaling. Shadows are a
quiet reinforcement, not the primary depth cue.

## 5. Components

### Panels (the workhorse)
- **Shape:** Rounded large (`r-lg = 18px`). Square corners on the inner
  scrolling viewport.
- **Default size:** `padding: 22px`, paper-card background, hairline
  border-soft (1px), card shadow.
- **Compact variant** (`data-size="compact"`): `padding: 14px 18px`, denser
  panel-head spacing, smaller panel-title (13px). Used for 1×1 cells.
- **Header:** `panel-title` left, optional `panel-hint` (the `(mock — reason)`
  badge) inline, `panel-action` or `panel-select` pinned right.
- **Body:** Vertically scrollable (`min-height: 0; overflow-y: auto`),
  thin 6px scrollbar in `border` color.
- **Foot:** Optional, separated by a **dashed** top border — the dashed
  line is intentional and signals "this is a navigational seam, not a
  visual divider."
- **Tone variants** ride entirely on tokens; no per-tone overrides at the
  panel level.

### Stats
- **Shape:** Same shell as panel (`r-lg`, hairline border, card shadow,
  `pad-card`).
- **Layout:** Header row (icon + label), then stat-value, optional stat-sub
  caption, optional 4px tonal stat-bar tinted by accent for "remaining"
  metrics.
- **Stat-icon:** 30×30 with `r-sm` radius, `paper-card-soft` background;
  `.accent` variant uses peach-soft background and a CSS filter chain to
  recolor monochrome SVGs.

### Icon Buttons (topbar)
- **Shape:** Pill (`r-pill`), 38×38.
- **Default:** Paper-card background, hairline border, ink-muted icon.
- **Hover:** Paper-card-soft background, ink-deep icon.
- **Active state:** Peach-soft background, peach border, peach stroke on
  inline SVG icons.
- **Notification dot:** 7×7 peach circle inset 9px / 11px, with a 1.5px
  paper-card halo to crisply separate it from the icon.

### Search Input
- **Shape:** Pill (`r-pill`), `9px 12px 9px 38px` padding (left-padded for
  inline icon), 360px max-width.
- **Default:** 1px border (`border` token), paper-card background.
- **Focus:** Border shifts to peach, no glow, no extra animation. The
  border-color shift is the entire focus treatment.
- **Inline icon:** 15×15, 0.45 opacity, absolute left.
- **Inline kbd hint:** Mono 10.5px, `paper-card-soft` chip, absolute right.

### Sidebar Items
- **Shape:** `r-md` rounded, full-width inside sidebar gutter.
- **Default:** Transparent background, ink-faded text.
- **Hover:** Cream-tinted background (5% opacity on faded ink), ink-sidebar
  text.
- **Active:** Walnut-active background, full ink-sidebar text, weight 500.

### Modals & Overlays
The brief explicitly discourages modals. Existing flows (task form, journal
entry, layout editor) prefer inline editing or pencil-edit-in-place.
Where a modal is unavoidable (the icon picker, page-meta), it sits on
pop-shadow + `backdrop-filter: blur(0)` — no glassmorphism.

### Brand Mark (review needed)
The current `.sb-brand-mark` uses `linear-gradient(135deg, var(--accent), #b85a3f)`.
This was inherited; the One-Mark and No-Decorative-Gradient rules above
flag it for replacement with a flat peach + a hand-drawn glyph or a single
serif monogram. Treat this as the canonical "first thing to fix" in any
polish round.

### Avatar Button (review needed)
Same as brand mark — currently `linear-gradient(135deg, #e8c195, #c79768)`.
Flag for replacement with a flat tonal disc.

## 6. Do's and Don'ts

### Do:
- **Do** keep the cream → walnut → peach trio. Tone variants are honored
  but shouldn't shift this contract; cream is the published default.
- **Do** carry hierarchy through type weight, scale, and serif/mono
  contrast. `1.25:1` minimum size ratio between adjacent steps.
- **Do** use `font-weight: 300` for body. The light-weight body is the
  voice of the system.
- **Do** use mono *exclusively* for machine labels (shortcuts, timestamps,
  ticker symbols). Treat its appearance as semantic.
- **Do** write hairline borders (`border-soft`, `1px`). Borders carry the
  depth, shadows are a quiet backup.
- **Do** keep state changes under 200ms with exponential ease-out
  (`cubic-bezier(.22, 1, .36, 1)` or similar). Match the existing 240ms
  sidebar slide; any new transition copies that curve.
- **Do** prefer inline editing over modals. The journal, task, and bookmark
  flows are the contract — every new feature follows the same
  pencil-in-place pattern.
- **Do** respect `prefers-reduced-motion`: collapse hover-elevations and
  slide animations to instant transforms.
- **Do** validate WCAG AA contrast on every tone × mode pair when changing
  any neutral token.

### Don't:
- **Don't** use `#000` or `#fff` as a text or surface color anywhere.
  Every neutral is tinted toward warm brown.
- **Don't** introduce decorative gradients. The two existing gradients
  (brand mark, avatar) are pending removal — do not add more. Replace
  gradients with flat color + precise type.
- **Don't** use `background-clip: text` with a gradient. Gradient text is
  forbidden.
- **Don't** use glassmorphism (`backdrop-filter: blur(...)` paired with
  translucent `rgba(...)` cards). The system is paper, not glass.
- **Don't** add side-stripe borders (`border-left: 4px solid var(--accent)`)
  to cards, list items, or callouts. If a row needs emphasis, use full
  borders, a leading mono index, or a peach status dot.
- **Don't** ship the "hero metric template" — big number + small label +
  supporting stats + gradient accent. The Stats system already nails this
  pattern; one stat strip per page max.
- **Don't** use a uniform card grid (same-size icon+title+text rows
  repeated). Variety comes from arrangement (`compact` vs `large` cells)
  and from per-widget identity, not card-grid sameness.
- **Don't** reach for a modal as the first thought. Inline-edit until
  inline-edit is genuinely worse, then justify the modal in a code
  comment.
- **Don't** auto-refresh, auto-rotate, or auto-animate widgets. The page
  is still until the user moves it.
- **Don't** add "Welcome back!", "Let's get started", or any onboarding
  copy. The owner is always the user; assume it.
- **Don't** introduce neon, iris, electric blue, or any high-chroma cool
  hue as a status color. Status reads peach-warning, sage-success,
  brick-danger — match the warm family.
- **Don't** drift into Linear/Vercel cool-grey-and-iris. The cream-based
  identity is non-negotiable; alternate tones (cool, sage, lavender)
  exist as personalization, not as identity replacements.
