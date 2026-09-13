# Visual direction — ajvalencia.com

Source of truth for tokens and voice: `docs/design-system-reference.md`. Type has since moved to Neue Haas Grotesk (see live pages), but the imagery direction below is unchanged.

## Palette cues for prompts

| Role | Hex | Use in imagery |
|---|---|---|
| Concrete / paper | `#e7e1d4` · light `#f1ebdf` · dark `#b0a48d` | overall warmth, textures, OG scrims |
| Ink | `#1f1d18` | deep shadows, frames |
| Construction orange | `#f47321` | sparing accent only — a single lit window, signage glow, a crosshair on an OG card |
| Planted green | `#5d7048` | landscaping, courtyards, green roofs |

## Imagery rules

- **Warm, earthy daylight.** Late morning to golden hour; dusk is fine for variants. **No cool/blue cast**, no teal-orange grading, no neon.
- **Architectural render realism.** Believable materials, true verticals (no fisheye or tilted horizons), clean but not glossy.
- **Entourage is secondary.** Small, generic pedestrians and street trees are fine; no identifiable faces, no people or cars as the subject.
- **No text, logos, or watermarks** in generated pixels.
- **Composition for the site.** Heroes and cards are landscape (~3:2 or 16:9); leave calm sky or ground where overlay text may sit. Renders appear inside 2–3 px ink frames, so avoid important detail at the very edges.
- **Integrity first** — see SKILL.md rule 4.

## Current render inventory (source sizes)

| Project | Files | Aspect |
|---|---|---|
| Sunnyvale Mixed-Use | `assets/sunnyvale/` aerial, street, street2, courtyard, courtyard2 | ~1536×1024 (3:2) |
| Solace Commons | `assets/solace/` aerial, front, side | ~1690×931 (16:9-ish) |
| Mirador Manor | `assets/mirador/` hero, hero-aerial, hero-street, hero-back, hero-back2, rooftop-hi, render-aerial, render-street, card-aerial, clinic, learning | mixed, mostly ~1.5:1 |
| Site | `assets/og-card.png` 1200×630, `assets/gradpic.jpg` portrait, `assets/tex/` textures | — |

Many PNG renders are 2–3.4 MB and `og-card.png` is 1.5 MB — prime `optimize` candidates.

## Prompt building blocks

Combine: **subject lock** + **change** + **look** + **exclusions**.

- **Subject lock (variant/loop):** "Keep the building, massing, floor count, facade articulation, materials, site, and camera position exactly as in the reference image."
- **Change examples:** "golden-hour sun from the west with long soft shadows" · "clear dusk sky, warm interior lights on in some units" · "mature canopy trees and native planting in the courtyard" · "light overcast, even soft light".
- **Look:** "photorealistic architectural visualization, warm earthy daylight palette, natural color, true vertical lines, crisp detail."
- **Exclusions:** "no text, no logos, no watermark, no blue color cast, no added floors or structures, no distorted geometry, no people in the foreground."
- **Loop motion:** "static camera or very slow push-in; clouds drift slowly; soft light shift; trees sway gently; no other movement."
- **Texture:** "seamless tileable texture, flat even lighting, top-down, poured concrete with subtle form-tie holes and aggregate, warm grey-beige, no vignette, no text."

## OG card layout (composited locally)

1200×630 · background: project render or `assets/tex/` texture · bottom-left ink scrim (`#1f1d18` at ~70% fading up) · title in the site display font, uppercase, cream `#f1ebdf` · small kicker line (e.g. `SUNNYVALE, CA · 531 UNITS`) in a monospace/label style using real project stats from the page · AV mark top-left · one orange crosshair or rule accent. Keep everything within the central ~1000×520 safe area.
