---
name: "Token Mesh"
description: "Crypto without the neon cliché. Dark slate surfaces, Geist sans for prose and Geist Mono with tabular numerals for every figure, a single cool mint accent reserved for positive deltas. Built for crypto exchanges, DeFi dashboards, and on-chain analytics that want to look serious — no glow, no purple-blue gradient, no rocket emoji."
tags: [crypto, fintech, dark, minimal, modern]
colors:
  primary:   "#e6e8eb"
  secondary: "#7d848e"
  tertiary:  "#e6e8eb"
  neutral:   "#1a1d22"
  surface:   "#101216"
typography:
  display: Geist
  body:    Geist
  mono:    "Geist Mono"
  scale:
    hero: "3.25rem / 1.06 / 600 / -0.03em"
    h1:   "2.125rem / 1.16 / 600 / -0.022em"
    h2:   "1.4375rem / 1.3 / 600 / -0.012em"
    body: "0.9375rem / 1.6 / 400 / -0.005em"
radius:
  sm: 4px
  md: 6px
  lg: 10px
  pill: 9999px
shadows:
  card:   "rgba(0,0,0,0.35) 0 1px 0 inset, rgba(0,0,0,0.4) 0 1px 2px"
  button: none
borders:
  card:    "1px solid rgba(230,232,235,0.08)"
  divider: rgba(230,232,235,0.10)
buttons:
  primary:
    background: #e6e8eb
    color: #101216
    border: none
    shape: rounded
    padding: 9px 18px
    font: 600 / 0.8125rem
  secondary:
    background: #1f232a
    color: #e6e8eb
    border: 1px solid rgba(230,232,235,0.10)
    shape: rounded
    padding: 9px 18px
    font: 500 / 0.8125rem
  outline:
    background: transparent
    color: #e6e8eb
    border: 1px solid rgba(230,232,235,0.16)
    shape: rounded
    padding: 9px 18px
    font: 500 / 0.8125rem
  ghost:
    background: transparent
    color: #7d848e
    border: none
    shape: rounded
    padding: 9px 14px
    font: 500 / 0.8125rem
charts:
  variant: "thin-bars"
  stroke_width: 1.5
  fill_opacity: 0.08
  gridlines: true
  bar_gap: 6px
  highlight: single
  dot_marker: true
fonts_url: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap"
dependencies: ["lucide-react"]
---

# Token Mesh

## AI Build Instructions

> **Read this section before writing any code.** The rules below
> are non-negotiable. Every value used in the UI must come from this
> file's frontmatter — never substitute, approximate, or invent new
> colors, fonts, radii, or shadows. If a value is missing, ask the
> user before adding one.

### 1 · Your role

You are building UI for a project that has adopted **Token Mesh** as its
design system. Treat `DESIGN.md` as the single source of truth.
Your job is to translate the user's product requirements into
components and pages that look like they were designed by the same
person who authored this file.

### 2 · Token compliance

- Pull every color, font family, radius, shadow, and spacing value
  from the frontmatter at the top of this file.
- Use semantic roles (e.g. `primary`, `accent`, `muted`) — never
  hard-code hex values that bypass the system.
- When a token can be expressed as a CSS variable, declare it once
  in your global stylesheet and reference it everywhere downstream.
- The Google Fonts `<link>` is provided in the Typography section.
  Add it to `<head>` before any component renders.

### 3 · Component recipes

Use these recipes verbatim when building the corresponding component.

#### Buttons

Four variants are defined. Pick one — never blend variants or invent a fifth.

- **Primary** — rounded shape, bg `#e6e8eb`, text `#101216`, padding `9px 18px`, weight `600`.
- **Secondary** — rounded shape, bg `#1f232a`, text `#e6e8eb`, border `1px solid rgba(230,232,235,0.10)`, padding `9px 18px`, weight `500`.
- **Outline** — rounded shape, text `#e6e8eb`, border `1px solid rgba(230,232,235,0.16)`, padding `9px 18px`, weight `500`.
- **Ghost** — rounded shape, text `#7d848e`, padding `9px 14px`, weight `500`.

Reach for **primary** as the single dominant CTA per screen.
**Secondary** for the supporting action. **Outline** for tertiary
actions in toolbars. **Ghost** for inline links and table actions.

#### Cards

- Background: `#101216`
- Border: `1px solid rgba(230,232,235,0.08)`
- Shadow: `rgba(0,0,0,0.35) 0 1px 0 inset, rgba(0,0,0,0.4) 0 1px 2px`
- Radius: `radius.lg` (`10px`)
- Internal padding: `20px` for compact cards, `24–28px` for content cards.

#### Tabs

Variant: `underline`. Flat row of labels. Active tab gets a 2px underline in the accent color — no fill.

#### Charts

- Bar/line variant: `thin-bars`
- Highlight strategy: `single` — emphasize a single bar/point per chart.

#### Typography pairings

- **Display (`Geist`)** — h1, h2, hero headlines, brand wordmarks.
- **Body (`Geist`)** — paragraphs, labels, button text, form inputs.
- **Mono (`Geist Mono`)** — code, eyebrows, metadata, numerals in tables.

### 4 · Hard constraints

Never do any of the following without explicit instruction from the user:

- Introduce a new color, font, radius, or shadow that isn't declared above.
- Mix this system with another (e.g. don't paste in Material or Bootstrap defaults).
- Use generic gradient defaults (purple→blue, peach→pink) — they break the system's voice.
- Reach for emoji icons. Use a consistent icon library and size icons in line with body type.
- Add motion that exceeds the system's restraint — keep transitions short (≤200ms) and subtle.

### 5 · Before you finish — verify

Run through this checklist for every screen you produce:

- [ ] Every color used appears in the Colors table above.
- [ ] Headlines use the display font; body copy uses the body font.
- [ ] Buttons match one of the declared variants exactly (shape, padding, weight).
- [ ] Border-radius values come from `radius.sm` / `radius.md` / `radius.lg` / `radius.pill`.
- [ ] Cards and dividers use the declared border + shadow tokens.
- [ ] No values were invented; if you needed something missing, you stopped and asked.

---

## 1. Atmosphere

Token Mesh is what crypto looks like when you remove the clichés. The page surface is dark slate `#101216` — never pure black, never blue-leaning. Cards lift to `#1a1d22` with a 1px black inset highlight at the top edge — the dark-mode catch-light that sells the surface as physical. Geist handles prose with its calm geometric proportions; Geist Mono with tabular numerals carries every price, percentage, market cap, and address so columns of figures align to the pixel. The single accent is cool mint `#3ad9a8` — used only on positive 24h deltas, the active wallet pane border, and the focus ring. Negative deltas use bone, with the minus sign carrying the meaning.

The discipline is in the absence: no glow, no purple-blue gradient, no neon, no rocket emoji. The system trusts the reader to read tabular numerals and signs.

**Signature moves**
- Geist Mono with `font-variant-numeric: tabular-nums` on every price, percentage, address
- Cool mint `#3ad9a8` only on positive deltas + active wallet pane border + focus ring
- Negative deltas in bone with minus sign — never in red
- Dark slate `#101216` page (never pure black, never blue) → `#1a1d22` card
- 1px black inset highlight on every card — dark catch-light

## 2. Palette

### Surfaces
- **Slate** `#101216` — page background (cool dark slate)
- **Slate Lift** `#1a1d22` — primary card surface
- **Pane** `#1f232a` — secondary button, hovered card
- **Hairline** `rgba(230,232,235,0.08)` — every divider

### Ink (light on dark)
- **Bone** `#e6e8eb` — text, headings, primary CTA fill, negative deltas
- **Bone 55** `#7d848e` — secondary text, mono labels

### Accent
- **Mint** `#3ad9a8` — positive 24h delta, active wallet pane border, focus ring
- **Mint Soft** `rgba(58,217,168,0.12)` — hovered token row background

## 3. Typography

| Role | Font | Size | Weight | Leading | Tracking |
|------|------|------|--------|---------|----------|
| Hero | Geist | 52px | 600 | 1.06 | -0.03em |
| H1 | Geist | 34px | 600 | 1.16 | -0.022em |
| H2 | Geist | 23px | 600 | 1.3 | -0.012em |
| Body | Geist | 15px | 400 | 1.6 | -0.005em |
| UI / Button | Geist | 13px | 500 | 1.4 | 0 |
| Price / KPI | Geist Mono | 28px | 600 | 1.0 | 0 tabular-nums |
| Delta | Geist Mono | 13px | 500 | 1.0 | 0 tabular-nums |
| Label | Geist Mono | 11px | 500 | 1.0 | 0.04em uppercase |
| Address / Hash | Geist Mono | 12px | 400 | 1.0 | 0 truncate |

Geist Mono everywhere a number or hash lives — prices, deltas, market caps, wallet addresses, transaction hashes. The tabular-nums variant is what makes a token table read as a serious exchange vs. a meme dashboard.

## 4. Buttons

### Primary (Bone Inverted)
```css
background: #e6e8eb;
color: #101216;
padding: 9px 18px;
border-radius: 6px;
font-weight: 600;
```

Bone-on-slate is the dark-mode equivalent of ink-on-bone — high contrast, no chrome required.

### Secondary (Pane)
- `#1f232a` background, 1px hairline at 10% bone, bone text — same shape, same padding

### Outline & Ghost
- Outline: transparent, 1px hairline at 16% bone
- Ghost: no border, bone-55, hover lifts to bone

## 5. Cards

```css
background: #1a1d22;
border: 1px solid rgba(230,232,235,0.08);
border-radius: 10px;
box-shadow:
  rgba(0,0,0,0.35) 0 1px 0 inset,
  rgba(0,0,0,0.4) 0 1px 2px;
```

The 1px black inset highlight at the top is the dark catch-light — without it the card reads as flat dark grey. The active wallet pane adds a 1px mint top border — the only place mint appears as a card edge.

## 6. Charts

Thin precise bars (3px wide, 6px gap) with dashed gridlines at 8% bone — used for token-volume sparklines. One bar in mint (the latest period if up, bone if down), others in 22% bone. Line charts at 1.5px bone with an 8% mint fill (when net up), ending in a mint dot marker. Y-axis labels in Geist Mono uppercase 11px aligned to the right.

## 7. Tabs

Underline 1.5px in mint for the active state. Inactive tabs are bone-55 in Geist 500. Hover = mint-soft background wash. Tabs sit on a 1px hairline baseline.

## 8. Spacing

- Base 4px (token-row aware)
- Scale: `4, 8, 12, 16, 20, 24, 32, 40, 56, 80`
- Section padding: 80px desktop, 32px mobile

## 9. Do's & don'ts

✅ **Do**
- Use Geist Mono with tabular-nums on every price, delta, address — column alignment IS the brand
- Reserve mint for positive deltas + active wallet pane + focus ring only
- Keep negative deltas in bone with a minus sign — never in red
- Hold the dark slate `#101216` page → slate-lift card tonal step

❌ **Don't**
- Use neon green for positive — cool mint `#3ad9a8` is muted on purpose
- Use red for negative — the system trusts the minus sign
- Use a purple-blue or pink gradient — the entire category does this; you do not
- Add glow halos to active states — 1px mint border is the only edge color

---

## Tokens

> Generated from the same source the live preview renders from.
> Treat the values below as the contract — never substitute approximations.

### Colors

| Role      | Value |
|-----------|-------|
| primary   | `#e6e8eb` |
| secondary | `#7d848e` |
| tertiary  | `#e6e8eb` |
| neutral   | `#1a1d22` |
| surface   | `#101216` |

### Typography

- **Display:** Geist
- **Body:** Geist
- **Mono:** Geist Mono

| Role | size / leading / weight / tracking |
|------|------------------------------------|
| Hero | 3.25rem / 1.06 / 600 / -0.03em |
| H1   | 2.125rem / 1.16 / 600 / -0.022em |
| H2   | 1.4375rem / 1.3 / 600 / -0.012em |
| Body | 0.9375rem / 1.6 / 400 / -0.005em |

### Radius

- sm: `4px`
- md: `6px`
- lg: `10px`
- pill: `9999px`

### Shadows

- **card:** `rgba(0,0,0,0.35) 0 1px 0 inset, rgba(0,0,0,0.4) 0 1px 2px`
- **button:** `none`

### Borders

- **card:** `1px solid rgba(230,232,235,0.08)`
- **divider:** `rgba(230,232,235,0.10)`

### Buttons

Four variants, each fully tokenized. The preview renders from these exact values.

#### Primary

| Property | Value |
|----------|-------|
| shape | `rounded` |
| background | `#e6e8eb` |
| color | `#101216` |
| border | `none` |
| padding | `9px 18px` |
| fontWeight | `600` |
| fontSize | `0.8125rem` |

#### Secondary

| Property | Value |
|----------|-------|
| shape | `rounded` |
| background | `#1f232a` |
| color | `#e6e8eb` |
| border | `1px solid rgba(230,232,235,0.10)` |
| padding | `9px 18px` |
| fontWeight | `500` |
| fontSize | `0.8125rem` |

#### Outline

| Property | Value |
|----------|-------|
| shape | `rounded` |
| background | `transparent` |
| color | `#e6e8eb` |
| border | `1px solid rgba(230,232,235,0.16)` |
| padding | `9px 18px` |
| fontWeight | `500` |
| fontSize | `0.8125rem` |

#### Ghost

| Property | Value |
|----------|-------|
| shape | `rounded` |
| background | `transparent` |
| color | `#7d848e` |
| border | `none` |
| padding | `9px 14px` |
| fontWeight | `500` |
| fontSize | `0.8125rem` |

### Charts

| Property | Value |
|----------|-------|
| variant | `thin-bars` |
| strokeWidth | `1.5` |
| fillOpacity | `0.08` |
| gridlines | `true` |
| barGap | `6px` |
| highlight | `single` |
| dotMarker | `true` |

---

## Pro tokens

> Production-fidelity tokens. States, density, motion, elevation,
> content rules and a measured WCAG contract — derived from the
> resting tokens unless explicitly authored.

### States

#### Button

- **hover** — shadow: `0 0 24px -4px rgba(230, 232, 235, 0.5), 0 8px 24px -8px rgba(0,0,0,0.6)`, filter: `brightness(1.1)`
- **focus** — outline: `1.5px solid #e6e8eb`, outline-offset: `3px`
- **active** — transform: `translateY(1px)`, filter: `brightness(0.92)`
- **disabled** — opacity: `0.35`, filter: `saturate(0.4)`
- **loading** — opacity: `0.6`
- **selected** — bg: `#e6e8eb`, color: `#0A0A0A`

#### Input

- **hover** — border: `1px solid rgba(230, 232, 235, 0.5)`
- **focus** — border: `1px solid #e6e8eb`, shadow: `0 0 0 3px rgba(230, 232, 235, 0.2)`
- **disabled** — opacity: `0.35`
- **error** — border: `1px solid #F87171`, shadow: `0 0 0 3px rgba(248,113,113,0.2)`

#### Card

- **hover** — shadow: `0 16px 40px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(230, 232, 235, 0.18)`, transform: `translateY(-2px)`
- **selected** — border: `1px solid #e6e8eb`, shadow: `0 0 0 1px #e6e8eb`
- **dragging** — shadow: `0 24px 60px -16px rgba(0,0,0,0.85)`, transform: `scale(1.02)`, opacity: `0.85`

#### Tab

- **hover** — color: `#e6e8eb`
- **focus** — outline: `1.5px solid #e6e8eb`, outline-offset: `2px`
- **selected** — color: `#e6e8eb`, border: `0 0 1.5px 0 solid #e6e8eb`

### Density

| Mode | padding × | row × | body | radius × | Use for |
|------|-----------|-------|------|----------|---------|
| compact | 0.72 | 0.78 | 0.8125rem | 0.85 | Information-dense — tables, IDEs, dashboards |
| comfortable | 1 | 1 | 0.9375rem | — | Default — most product UI |
| spacious | 1.35 | 1.3 | 1rem | 1.15 | Editorial — marketing, long-form, settings |

### Motion

**Signature — Glide.** Fließende, leicht beschleunigte Übergänge mit Accent-Glow auf hover. Premium-Feeling durch kontrollierte Lichtspiele.

```css
transition: all 280ms cubic-bezier(0.32, 0.72, 0, 1);
```

| Token | Value |
|-------|-------|
| duration.instant | `100ms` |
| duration.fast | `180ms` |
| duration.base | `280ms` |
| duration.slow | `450ms` |
| easing.standard | `cubic-bezier(0.32, 0.72, 0, 1)` |
| easing.decelerate | `cubic-bezier(0.0, 0, 0.2, 1)` |
| easing.accelerate | `cubic-bezier(0.4, 0, 1, 1)` |
| easing.spring | `cubic-bezier(0.5, 1.25, 0.55, 1)` |

### Elevation

Five-level scale, system-specific recipe.

| Level | Shadow | Recipe |
|-------|--------|--------|
| level0 | `none` | Flat — Hairline mit Accent-Hauch. |
| level1 | `0 2px 4px rgba(0,0,0,0.45)` | Subtle drop — list items. |
| level2 | `0 12px 28px -8px rgba(0,0,0,0.6)` | Popover — vom Canvas gelöst. |
| level3 | `0 20px 48px -12px rgba(0,0,0,0.7), 0 0 32px -8px rgba(230, 232, 235, 0.25)` | Sheet — Accent-Halo. |
| level4 | `0 40px 96px -16px rgba(0,0,0,0.85), 0 0 64px -12px rgba(230, 232, 235, 0.4)` | Modal — voller Accent-Rim, dramatisch. |

### Content

- **measure:** `66ch` (max line length for body prose)
- **paragraph spacing:** `1.3em`
- **list indent:** `1.5em`
- **list gap:** `0.5em`
- **link:** color `#e6e8eb`, underline `hover`
- **blockquote:** border `2px solid #e6e8eb`, padding `0.8em 1.2em`
- **code:** background `rgba(230, 232, 235, 0.12)`, color `#e6e8eb`

### Accessibility (WCAG 2.1)

**Overall:** AA

| Pair | Ratio | Required | Grade | Suggested fix |
|------|-------|----------|-------|---------------|
| Body text on surface | 15.27:1 | AA | AAA | — |
| Body text on canvas | 13.77:1 | AA | AAA | — |
| Muted text on surface | 4.97:1 | AA | AA | — |
| Accent on surface | 15.27:1 | AA-Large | AAA | — |
| Accent on canvas | 13.77:1 | AA-Large | AAA | — |
