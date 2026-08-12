# StablePay Brand

The visual identity for [StablePay](https://github.com/DjedAlliance/StablePay): the logo, the icon set, the colour palette and the typography, plus the rules for using them.

Everything described here lives in this folder. If a value in this document disagrees with an asset, the asset wins and this document is wrong — file it as a bug.

---

## Contents

```
brand/
├── Brand.md                       this file
├── logo/
│   ├── stablepay-logo.svg         primary mark
│   ├── stablepay-logo-mono.svg    single-colour mark
│   └── stablepay-wordmark.svg     horizontal lockup (mark + name)
├── favicon/
│   ├── favicon.svg                vector favicon
│   ├── favicon.ico                16/32/48/64 multi-resolution
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png       180×180, opaque
│   ├── android-chrome-192x192.png
│   ├── android-chrome-512x512.png
│   ├── maskable-icon-512x512.png  padded for Android's icon mask
│   ├── og-image.png               1200×630 social preview
│   └── site.webmanifest
├── color/
│   ├── palette.svg                swatch sheet with contrast ratios
│   ├── palette.css                CSS custom properties
│   └── palette.json               machine-readable tokens
├── typography/
│   ├── typography.svg             specimen sheet
│   └── typography.css             font stacks and type scale
└── scripts/
    └── generate-rasters.py        regenerates every PNG and the .ico
```

---

## Logo

Three overlapping translucent discs — blue, yellow, orange — that mix into secondary hues where they meet.

The overlap is the idea, not decoration. StablePay's whole function is the meeting point of separate things: a consumer's currency, a merchant's preferred stablecoin, and the protocol that converts between them without a middleman. Three circles that stay distinct while producing something new in the overlap is that story in one glyph. It also survives being shrunk to 16px, which a more literal payment metaphor would not.

### Construction

Drawn on a 582 × 549 grid. Three discs of radius 170.5 centred at (290.5, 170.5), (170.5, 378.5) and (411.5, 378.5) — an equilateral arrangement with a 240-unit side.

Each coloured disc sits on an **opaque white disc of identical geometry**. That white underlay is part of the mark: it keeps the tints true when the logo is placed on a coloured surface. Delete it and the logo shifts hue against anything that isn't white. Paint order is blue → yellow → orange, and changing it changes the overlap colours.

### Variants

| File | Use it when |
|---|---|
| `stablepay-logo.svg` | Default. Anywhere colour reproduces. |
| `stablepay-logo-mono.svg` | One colour only: engraving, embroidery, photocopies, dark UI chrome, or when the mark must match surrounding text. Driven by `currentColor`, so set `color` on an ancestor. Note that `currentColor` does not resolve through an `<img>` tag — inline the SVG. |
| `stablepay-wordmark.svg` | Horizontal lockup with the name. Headers, README banners, press kits, slide title cards. |

The wordmark splits the name across two colours: **Stable** in Ink, **Pay** in Signal Blue. It reads as one word at a glance but still works when cropped to just the coloured half in tight UI.

### Rules

**Clear space.** Keep empty space equal to the radius of one disc (170 units, ≈ 0.31 × mark height) on all sides. Nothing intrudes — no text, no rules, no image edges.

**Minimum size.** 24px for the full-colour mark. Below that the overlaps muddy into brown; use `favicon.svg`, which is the same geometry framed square, or the mono mark.

**Do not:**

- recolour the discs, or apply a gradient to them
- change the opacities (0.7 / 0.8 / 0.8) — they define the overlap hues
- remove the white underlay to "make it transparent"; use the mono variant
- rotate, skew, stretch, or reflow the discs into a row
- add a drop shadow, outline, bevel, or glow
- place the full-colour mark on a mid-tone or busy background; use mono
- typeset the name yourself instead of using the wordmark file

---

## Colour

The three brand hues are read directly out of the logo. **The mark is the source of truth**; `palette.json` and `palette.css` are transcriptions of it.

See `color/palette.svg` for the full swatch sheet with contrast ratios.

### Brand

| Name | Hex | On white | Role |
|---|---|---|---|
| Signal Blue | `#235EFE` | 5.12:1 | Primary. Interactive elements, links, focus rings, "Pay" in the wordmark. |
| Beacon Yellow | `#FFC822` | 1.55:1 | Accent only. Fills and illustration. |
| Ember Orange | `#FD6724` | 2.94:1 | Accent. Warnings, highlights. |

Contrast ratios are WCAG 2.1 against white. AA body text needs **4.5:1**; large text (≥18.66px bold or ≥24px) and non-text UI need **3:1**.

Only **Signal Blue** clears the bar for body text on white. Beacon Yellow at 1.55:1 is nearly invisible as text on white and must never be used that way — put ink-coloured text *on* the yellow instead, which gives you 10.47:1. Ember Orange is fine for large bold type and fills, not for running text.

### As-rendered values

Sampling the logo with a colour picker gives different numbers, because the discs are translucent over white:

| Source | Composited | |
|---|---|---|
| `#235EFE` @ 0.7 | `#658EFE` | |
| `#FFC822` @ 0.8 | `#FFD34E` | |
| `#FD6724` @ 0.8 | `#FD8550` | |

These are recorded so nobody "corrects" the palette to match a screenshot. Use the source values as tokens; the composited values (`--sp-*-soft`) exist for illustrations that need to sit flush against the mark.

### Neutrals

A cool-tinted ramp, already shipping in the widget:

`#1A1F36` Ink · `#4F566B` · `#697386` · `#A3ACB9` · `#CFD7DF` · `#E6EBF1` · `#F7F9FC` · `#FFFFFF`

Ink on white is 16.24:1. `#697386` at 4.78:1 is the lightest grey still usable for body text — anything lighter is decoration, borders, or disabled states, never content a user has to read.

### Semantic

| Role | Text | Border | Fill |
|---|---|---|---|
| Success | `#15803D` | `#BBF7D0` | `#F0FDF4` |
| Danger | `#DF1B41` | `#FFDCE0` | `#FFF5F5` |
| Accent | `#F6941C` | — | — |

Never encode a payment outcome in colour alone. A confirmed transaction shows a label and an icon as well as green, because roughly 1 in 12 men has a red-green colour vision deficiency and the difference between "sent" and "failed" is not a place to be subtle.

---

## Typography

**Inter** for all interface and marketing text. **System monospace** for anything a user must verify character by character.

See `typography/typography.svg` for the specimen, and import `typography/typography.css` for the tokens.

### Why these

Inter was drawn for screen UI at small sizes: tall x-height, open apertures, and — the reason it matters here — a disambiguated character set. A payment widget displays addresses and amounts where confusing `0` with `O`, or `1` with `l`, is not a cosmetic problem.

For the same reason, hashes and addresses are set in monospace with `font-variant-numeric: tabular-nums` on live amounts, so digits don't reflow as a quote updates.

```css
--sp-font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI",
                Roboto, Helvetica, Arial, sans-serif;
--sp-font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco,
                Consolas, "Liberation Mono", monospace;
```

The fallbacks aren't decorative. StablePay is embedded in other people's pages; if the font fails to load, the widget still has to look deliberate.

### Scale

Every value below is already in use in `stablepay-sdk/src/styles/`. Adopting the tokens is a rename, not a redesign.

| Token | Size | Weight | Used for |
|---|---|---|---|
| `--sp-text-2xl` | 26px | 700 | Payable amount, dialog title |
| `--sp-text-xl` | 18px | 600 | Section subheading |
| `--sp-text-lg` | 16px | 500 | Page body, primary button |
| `--sp-text-md` | 15px | 500 | Emphasised body |
| `--sp-text-base` | 14px | 500 | Widget body — the most common size |
| `--sp-text-sm` | 13px | 500 | Dense secondary labels |
| `--sp-text-xs` | 12px | 600 | Micro labels, disclaimers |

Weights: 400 regular, 500 medium (UI default), 600 semibold, 700 bold. Nothing below 400 — Inter Light on a small amount reads as blurry on low-DPI screens.

### Loading Inter

Self-host it:

```bash
npm install @fontsource-variable/inter
```

```js
import '@fontsource-variable/inter';   // app entry point
```

Prefer this over a font CDN. A merchant with a strict Content-Security-Policy will block `fonts.gstatic.com`, and the widget would fall back to a system face on exactly the sites most likely to care about looking trustworthy. Self-hosted files ship from the merchant's own origin.

---

## Favicons and icons

Generated from the logo geometry by `scripts/generate-rasters.py`, so they can be rebuilt rather than hand-edited.

| File | Purpose |
|---|---|
| `favicon.svg` | Vector favicon; modern browsers prefer it |
| `favicon.ico` | 16/32/48/64 bundle for legacy browsers and pinned tabs |
| `favicon-16x16.png`, `favicon-32x32.png` | Explicit PNG sizes |
| `apple-touch-icon.png` | 180×180, **opaque white** — iOS composites onto its own plate |
| `android-chrome-192/512.png` | PWA install icons |
| `maskable-icon-512x512.png` | Padded to Android's 80% safe zone so the mask doesn't clip the discs |
| `og-image.png` | 1200×630 link preview |
| `site.webmanifest` | PWA metadata, theme colour `#235EFE` |

Small sizes use tighter padding than large ones: at 16px, generous margins leave too few pixels for the mark to be legible.

### Wiring it up

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#235EFE">
<meta property="og:image" content="/og-image.png">
```

Order matters: browsers that understand SVG favicons take the first one and ignore the rest.

### Regenerating

```bash
cd brand && python3 scripts/generate-rasters.py
```

Requires Pillow. Edit the logo geometry in one place — the script reads the same circle definitions as the SVG — and every raster stays consistent.

---

## Open issues

Recorded rather than quietly papered over.

**Two oranges.** `#F6941C` (inherited from the Stability Nexus palette, currently in `PricingCard.css`) and `#FD6724` (Ember Orange, from the logo) are different oranges doing overlapping jobs in the same interface. One should be retired before the final evaluation. Keeping the logo's orange is the more defensible choice, since the palette is meant to derive from the mark.

**Inter is declared but never loaded.** `stablepay-sdk/src/styles/` sets `font-family: "Inter", sans-serif` in 14 places, but nothing in the repo loads the font — no `@font-face`, no `@fontsource` import, no CDN link. Every one of those rules currently falls through to generic `sans-serif`. Fixing this is the single highest-impact visual change available, and it is one `npm install`.

**Hard-coded colours.** The widget's stylesheets use hex literals rather than the tokens in `palette.css`. Migrating them is what would let a merchant re-theme the widget without a rebuild.

---

## Attribution

StablePay is a project of the [Djed Alliance](https://djed.one) and [Stability Nexus](https://stability.nexus). Partner logos in `../public/readme-assets/` belong to those organisations and are governed by their own guidelines, not this document.
