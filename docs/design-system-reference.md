# Adolfo Valencia — Design System

A brutalist-survey design language for the real-estate-development portfolio of **Adolfo Valencia**, M.R.E.D.+U. candidate at the University of Miami. The system dresses feasibility-stage development work — massing studies, capital stacks, pro-formas — in the visual language of a **field survey document poured in wet concrete**: heavy ruled frames, monospaced HUD readouts, construction orange, and monumental display type.

> **Source of truth:** this system was reverse-engineered from the live portfolio site in this project — `Adolfo Valencia - Process.html`, `Adolfo Valencia - Portfolio.html`, `Contact.html`, and the project showcases (`Sunnyvale Mixed-Use.html`, `Solace Commons.html`, `Mirador Manor - Showcase.html`). Tokens, fonts, and imagery are lifted directly from those files and the shared `assets/` folder. No external Figma or repo.

---

## CONTENT FUNDAMENTALS

**Voice.** First-person, plain-spoken, and quietly confident — a practitioner stating what they did, not a brand selling. Example: *"I pair feasibility-stage massing studies with the finance, market, and placemaking work behind them."* Sentences are declarative and concrete; claims are always backed by a number.

**Casing & tracking.** Headings and labels are **UPPERCASE** with wide letter-spacing (0.18–0.26em on labels). The wide tracking is itself a brand signal — eyebrows, kickers, nav, stat keys all run spaced-out. Big display names use tight/negative tracking instead.

**Numbers are the copy.** Every project leads with a feasibility readout — Units, FAR, TDC, IRR, LIHTC, LEED points. Numbers are set in tabular figures and treated as headline content, not footnotes. Currency is abbreviated (`$556M`, `$49.9M`); percentages carry one decimal (`12.55%`).

**Tone words.** "Feasibility", "massing", "workforce", "context and community", "data-driven development", "capital stack", "placemaking". Avoid hype adjectives — the work speaks in metrics.

**Micro-labels.** Survey/HUD fragments appear as texture: `MASSING // FIG.01`, `AZ 208.0°`, `RENDER_MODE: WIREFRAME`, live cursor coords `X:412 Y:090`. These are decorative-but-believable, never lorem.

**No emoji.** Iconography is geometric/unicode only (see ICONOGRAPHY). Tagline: *"Design with intent. Build with purpose."*

---

## VISUAL FOUNDATIONS

**Palette — "wet concrete + survey orange."** A warm grey concrete field (`#bcb6ac` base, `#cbc6bb` light panels, `#a9a397` recessed wells), near-black ink (`#1f1d18`) for all text and the structural borders, and a cream "paper" (`#e5e0d2`) for chips and knockouts. Only two accents, used sparingly and at the same muted intensity: **construction orange `#f47321`** (primary — CTAs, emphasis, hot stats, crosshairs) and **planted green `#5d7048`** (secondary — civic/affordable/status). Brick-red `#b3402a` is reserved for form errors. Saturation stays low everywhere except orange, which is allowed to shout.

**Type — three voices.**
- **Phantom** (700) — monumental hero name only. ALL-CAPS, line-height 0.9, `clamp(56px,12.5vw,150px)`.
- **Archivo Black** (400) — section + card display headings. Uppercase, tight `-0.01em` tracking.
- **Space Mono** (400/700) — everything else: body, labels, HUD, stats. The monospace voice ties prose and data into one survey-document tone.

**Borders are a primitive.** Structure is drawn, not shadowed: **1px** hairlines for internal dividers and the blueprint grid, **2px** ink for frames/inputs/chips/cards, **3px** ink for the page frame and major section splits. **Corner radius is 0 everywhere** — nothing is rounded.

**Backgrounds.** A repeating concrete-wall SVG texture (`assets/concrete-wall.svg`, 2100×1000, tiled) sits under the entire page and the sticky header. Media wells that lack a photo fall back to a faint ink **blueprint grid** (34–38px) with a radial concrete glow.

**Shadows — hard offset, zero blur.** The printed-block feel: cards rest at `6px 7px 0 rgba(31,29,24,0.11)`, lift to `14px 16px 0 / 0.20` on hover; buttons press with `4px 4px 0 / 0.45`; chips use `4px 4px 0 / 0.18`. The only blurred shadow in the system is the sticky header's soft `0 10px 22px -6px`.

**Motion.** One easing curve everywhere: `cubic-bezier(0.22, 1, 0.36, 1)`. Entrances fade-and-rise (`translateY(20–52px)` → none) on scroll, staggered 90–160ms; stats **count up** with easeOutCubic when their card reveals; hero figures cross-fade every 4s; status dots blink on a 2.4s loop. **Every animation has a JS safety net** that forces the end-state so content is never left hidden (throttled rAF / bfcache / reduced-motion). All of it collapses to static under `prefers-reduced-motion`.

**Hover / press states.** Links → orange. Nav → muted darkens to ink. CTA buttons → nudge `translate(-2px,-2px)` + offset shadow, arrow slides right. Cards → lift + image `scale(1.05)` + CTA rule grows orange. Contact rows → left orange bar scales in + subtle orange wash. No opacity-dimming hovers.

**Layout.** Two widths: framed portfolio (`1280px`, inside a 3px ink frame) and full marketing (`1480px`). Desktop gutter 56px, mobile 22px. Sticky header offsets in-page scroll by ~112px. Heavy use of CSS grid with ruled column borders; stats in `repeat(4,1fr)`.

**Imagery.** Warm architectural renders (aerials, street-level, rooftop) — earthy, daylight, no cool/blue cast. Always inside a 2px ink frame, often with a dark bottom-to-top scrim when text overlays.

---

## ICONOGRAPHY

The system is deliberately **icon-light and draws nothing custom**. There is no icon font and no SVG icon set. "Icons" are made from:
- **Geometric primitives** built in CSS — the orange **crosshair** (`::before`/`::after` bars), **corner survey ticks**, square color-key swatches, the orange "tick" rule before kickers, the logo's four-bar massing mark.
- **Unicode glyphs** as inline marks — arrows `→ ↑ ↗`, play `▶`, square bullets `■`, and envelope/phone/pin (`✉ ☎ ◌`) inside small bordered 26px squares on the contact grid. LinkedIn is the literal text `in`.
- **No emoji, ever.**

The brand assets that DO exist are in `assets/`: the **AV monogram** (`av-logo.png`, `av-logo-cut.png` — orange A, green V) and the **concrete-wall texture** (`concrete-wall.svg`). Project renders live under `assets/{mirador,solace,sunnyvale}/` and 3D massing models under `assets/models/*.glb`. When you need an "icon," reach for a CSS geometric mark or a unicode glyph in the existing style — do not introduce a third-party icon library, which would break the hand-drawn survey feel.

---

## INDEX / MANIFEST

**Root**
- `styles.css` — global entry point (import this). `@import`s the four token files + patterns.
- `readme.md` — this guide.
- `SKILL.md` — Agent Skills wrapper.

**`tokens/`** — `fonts.css` (@font-face), `colors.css`, `typography.css`, `spacing.css`, `patterns.css` (reusable `.av-*` utilities).

**`guidelines/`** — foundation specimen cards (Design System tab): Colors (concrete / ink / accents), Type (Phantom / Archivo / Mono), Spacing (scale / borders / shadows), Brand (logo / survey motifs / program bar / texture).

**`components/`** — React primitives:
- `core/` — `Button`, `StatusPill`
- `data/` — `StatGrid`, `ProgramBar`
- `cards/` — `ProjectCard` (composes StatGrid)
- `forms/` — `Field`
- `survey/` — `SurveyWell` (blueprint massing frame)

**`ui_kits/website/`** — `index.html` homepage recreation + `README.md`.

**`assets/`** — fonts (`Phantom`, `Archivo Black`, `Space Mono`), `av-logo*.png`, `concrete-wall.svg`, project renders, `.glb` massing models. *(Shared with the live portfolio HTML files at the project root.)*
