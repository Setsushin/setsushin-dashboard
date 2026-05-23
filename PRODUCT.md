# Product

## Register

product

## Users

A single owner-operator: the engineer-author who built and runs this dashboard
for himself. Bilingual workflow (CN · JP · EN content all flow through the
same surface). Sessions are bursty: a morning open-and-scan, a midday "what's
on", a late-night write-and-park. Always logged in, always on the same hand-
ful of devices, never demoing this to anyone.

The consequence: no onboarding theater, no first-run hand-holding, no friendly
nudges. The user already knows what every widget does. Latent expertise
should be assumed everywhere.

## Product Purpose

A personal command surface — calendar, tasks, portfolio, feed, journal,
bookmarks — that the owner reads, edits, and trusts daily. Success looks like:
opening it is the first thing in the morning and the last thing at night, and
it never asks the user to wait, decide, or look away.

It is a tool, but it is also a study — a small library of one's own life-state
that should feel cared for, not generated.

## Brand Personality

Three words: **scholarly. authored. restrained.**

Voice and surface should feel like a *Stripe Press* edition or an *Are.na*
study hall: warm paper, precise typography, mono captions, a single accent
used sparingly. Authored — the user can tell a person made this, deliberately
— but never quirky, never self-conscious. The dashboard is confident enough
to stay quiet.

Tonally: closer to the spine of a hardcover than to a SaaS landing page.
Closer to a notebook than to a CRM.

## Anti-references

- **AI-tool aesthetic.** No neon glow, no glassmorphism, no gradient text, no
  drifting particle background, no purple-to-blue hero. If a stranger could
  guess "this was made by AI" in two seconds, it has failed.
- **Enterprise BI.** No information-density wall (Tableau, Power BI, Grafana
  panels-without-restraint). High density is welcome, but it must be earned
  through typographic and color discipline, not by stuffing the page.
- **Cookie-cutter SaaS dashboards.** No Linear/Vercel-template cool-grey-and-
  iris-gradient, no big-number-small-label hero card, no rectangle-grid of
  identical icon+title+text cards.
- **Consumer-warm dashboards.** Not Apple Wallet, not Notion-templates, not
  emoji-decorated mood widgets. The warmth here comes from paper and ink, not
  from trying to be friendly.

## Design Principles

1. **Hierarchy through typography, not whitespace.** Density is allowed. The
   user has answered "as dense as it can be, but restrained." Restraint shows
   up in weight contrast, scale ratios, mono-vs-serif tagging, and hairline
   borders — *not* in giant gutters.

2. **Color is one accent and the paper.** Warm cream is the page; walnut is
   the binding; peach is the lone mark. Every other "color" must justify
   itself as a category or a status, never as decoration. When in doubt,
   remove.

3. **Authored, not generic.** Choose the harder typographic move (a serif
   headline, a mono caption, an asymmetric stat strip) over the safer SaaS
   default. The cost of looking generic is higher than the cost of
   looking opinionated.

4. **Trust the user.** No tooltips for things the owner already knows. No
   confirmation dialogs for reversible actions. No first-time states. No
   "Welcome back!" Empty states are short, declarative, and lead somewhere.

5. **Stillness is a feature.** The page does not move unless the user moved
   it. No auto-refreshing animations, no drifting backgrounds, no carousels.
   When motion happens, it is purposeful and fast — exponential ease-out,
   under 200ms, never elastic, never bouncing.

## Accessibility & Inclusion

- WCAG 2.1 AA contrast for body text on every tone × mode combination
  (cream, cool, sage, lavender × light, dark). Validate with the actual
  resolved tokens, not eyeballed.
- Respect `prefers-reduced-motion`: kill non-essential transitions,
  collapse hover-elevation animations, leave fades and instant transforms.
- Mixed CN / JP / EN body text must layout correctly; the existing per-
  glyph fallback stack is the contract — keep it.
- Keyboard navigability for at minimum: nav, edit-mode toggle, task add,
  journal add, bookmark add. Modal-style flows are an anti-pattern; prefer
  inline editing.
- Single-user with dual identity: a work account for git / dev and a
  personal account for CF Access prod. Both must work without
  identity-aware UX bifurcation.
