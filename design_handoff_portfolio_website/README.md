# Handoff: Adolfo Valencia — Portfolio Website

## Overview
A 5-page real-estate-development portfolio site for Adolfo Valencia (M.R.E.D.+U. candidate, University of Miami): a homepage, three project showcase pages, and a contact page. Brutalist-survey visual language — see `design-system-reference.md` for the full design language spec (palette, type, motion, iconography).

## About the Design Files
The files in `pages/` are **static HTML/CSS/JS design references** — fully built or nearly production-ready prototypes showing the intended look, content, and behavior. They are NOT framework code to import as-is. Your task is to **recreate these designs in the target codebase's environment** (React, Next.js, plain static hosting, etc.) using that project's existing conventions — or, if this is a fresh project with no existing stack, choose the simplest appropriate approach. Given the site has no dynamic data and only one interactive form, a plain static site (or a lightweight React/Next.js site if the user wants component structure) is very likely the right call — do not over-engineer with a backend framework unless asked.

## Fidelity
**High-fidelity.** These are pixel-complete, ready-to-ship HTML pages with final copy, imagery, colors, typography, and interaction behavior already implemented. Recreate pixel-perfectly; do not reinterpret the visual design.

## Pages
1. **Home** (`pages/Home.html`) — hero with rotating featured-project image, "Selected Work" index (3 project cards, two using a lazy-loaded Three.js wireframe massing viewer, one using a static image), "About" section (bio, portrait, education, certifications, toolkit meters, contact links, résumé download). Sticky header with scroll-linked nav + mobile hamburger menu.
2. **Contact** (`pages/Contact.html`) — contact form (name/email/phone/subject/message) that POSTs to Formspree with a mailto fallback, plus a direct-contact info grid.
3. **Sunnyvale Mixed-Use** (`pages/Sunnyvale Mixed-Use.html`) — project showcase: hero image carousel, thumbnail gallery grid, project narrative + stat blocks.
4. **Solace Commons** (`pages/Solace Commons.html`) — same showcase template as Sunnyvale, different project content/imagery.
5. **Mirador Manor** (`pages/Mirador Manor - Showcase.html`) — same showcase template, richest content (ground-floor program call-outs, rooftop amenity section).

All 5 pages share one header/footer/nav pattern and one CSS design-token set (defined inline per-page — see Design Tokens below). Recreate the header/nav/footer as a shared layout component.

## Interactions & Behavior
- **Scroll-reveal animations**: elements fade+rise into view on scroll (IntersectionObserver), staggered by 90–160ms per group. Every animation has a JS timeout safety net that forces the visible end-state (never leaves content stuck hidden). All motion collapses under `prefers-reduced-motion: reduce`.
- **Hero image rotation** (Home + showcase pages): auto-advances every 4s, pauses on hover, has clickable dot/thumbnail navigation, cross-fades via opacity.
- **3D massing viewer** (Home, Sunnyvale/Solace cards only): lazy-loads Three.js + a `.glb` model via IntersectionObserver when the card scrolls near viewport; renders a rotating wireframe with HUD-style overlay text. Recreate as an optional enhancement — a static wireframe-styled image placeholder is an acceptable simplification if Three.js integration isn't warranted in the target stack.
- **Mobile nav**: hamburger button (☰→✕ morph animation) toggles a dropdown panel below the header. Closes on: link click, Escape key, outside click, resize above 720px breakpoint.
- **Contact form**: client-side validation (required name/message, email regex) highlights invalid fields in red on submit. On valid submit, POSTs FormData to a Formspree endpoint (`action="https://formspree.io/f/YOUR_FORM_ID"` — placeholder, needs a real ID); shows an inline success/error status box. Falls back to opening a pre-filled `mailto:` link if the Formspree ID hasn't been configured. Includes a honeypot field (`_gotcha`) for spam.
- **Analytics**: GA4 `gtag.js` snippet on every page (placeholder ID `G-XXXXXXXXXX` — needs a real Measurement ID).
- **Focus states**: all interactive elements get a 2px orange `outline` on `:focus-visible`. A "Skip to content" link appears on keyboard focus at the top of every page.

## State Management
No app-level state — this is static content. Per-page local UI state only:
- Hero carousel: current slide index (JS closure variable, not exposed elsewhere)
- Mobile nav: open/closed (`aria-expanded` + a CSS class)
- Contact form: field validity + submit/success/error status

## Design Tokens
See `design-system-reference.md` for the complete palette, type, spacing, border, shadow, and motion specification. Key values, extracted from the live pages:

**Colors**
- Concrete base `#e7e1d4` / light `#f1ebdf` / dark `#b0a48d`
- Ink (text + borders) `#1f1d18`
- Cream (chips/knockouts) `#e5e0d2`
- Construction orange (primary accent) `#f47321`
- Planted green (secondary accent) `#5d7048`
- Error / brick red `#b3402a`
- Line/divider `rgba(31,29,24,0.16–0.22)`

**Type**
- Phantom (700) — hero name only, `clamp(56px,12.5vw,150px)`, line-height 0.92
- Archivo Black (400) — section/card headings, uppercase, `-0.01em` tracking
- Space Mono (400/700) — body, labels, HUD/stat text (the whole site's base font)
- Labels/eyebrows: 10–13px, uppercase, letter-spacing 0.14–0.26em

**Borders / shape**: 1px hairlines (dividers), 2px ink (frames, cards, inputs, chips), 3px ink (page frame, major splits). Border-radius is 0 everywhere.

**Shadows**: hard offset, no blur — cards `6px 7px 0 rgba(31,29,24,0.11)` → `14px 16px 0 / 0.20` on hover; buttons `4px 4px 0 / 0.45` on press/hover.

**Motion**: single easing curve `cubic-bezier(0.22, 1, 0.36, 1)` everywhere. Entrances: fade + `translateY(20–52px)` → none.

**Layout widths**: framed content 1280px inside a 3px ink border; full marketing sections 1480px. Desktop gutter 56px / mobile 22px.

Fonts are loaded via `@font-face` from `assets/fonts/` (Phantom .ttf, Archivo Black + Space Mono .woff2).

## Assets
All under `assets/` in this package:
- `fonts/` — Phantom, Archivo Black, Space Mono font files
- `av-logo.png`, `av-logo-cut.png` — AV monogram logo
- `concrete-wall.svg`, `tex/` — background textures
- `sunnyvale/`, `solace/`, `mirador/` — project renders (aerial/street/interior images) per project
- `models/` — `.glb` 3D massing models for the Three.js wireframe viewer
- `gradpic.jpg` — About section portrait
- `og-card.png` — social share preview image
- `wireframe.js`, `viewer.js` — the Three.js massing-viewer and image-gallery-viewer scripts (vanilla JS modules, referenced directly by the showcase pages)

## Outstanding setup items (not yet done)
- Formspree form ID is a placeholder (`YOUR_FORM_ID`) in Contact.html — needs a real endpoint.
- GA4 Measurement ID is a placeholder (`G-XXXXXXXXXX`) on every page — needs a real ID.
- Site is not yet deployed/hosted or attached to a custom domain.

## Files
- `pages/Home.html`, `pages/Contact.html`, `pages/Sunnyvale Mixed-Use.html`, `pages/Solace Commons.html`, `pages/Mirador Manor - Showcase.html` — the 5 live pages, self-contained HTML/CSS/JS.
- `design-system-reference.md` — full design system writeup (voice/tone, palette, type, iconography, motion, layout).
- `assets/` — all images, fonts, textures, and 3D models referenced by the pages above.
