---
name: generate
description: Generate, edit, animate, and optimize imagery for the ajvalencia.com portfolio (project render variants, hero video loops, OG share cards, textures) through pay-per-use model providers, with cost quotes, a budget cap, local logging, and brand/integrity guardrails.
argument-hint: <recipe> <target> [notes]   e.g. variant assets/mirador/hero.jpg dusk
disable-model-invocation: true
---

# /generate — portfolio media skill

Creates visual assets for Adolfo Valencia's real-estate-development portfolio (this repo, live at https://ajvalencia.com). Paid model calls go through pay-per-use providers — see `providers.md`. Visual direction lives in `style.md`. Read both before the first paid call in a session.

## Hard rules (never skip)

1. **Quote before spending.** Before any paid call, show a cost table (model, provider, quantity, unit price, subtotal, total) using prices fetched live from the provider (see `providers.md`) — never remembered prices. Wait for an explicit "yes".
2. **Budget cap.** Default cap is **$2.00 per invocation**, at most **6 images or 1 video**. Anything above needs the user to name the new cap. Stop and re-quote if a retry or fallback would exceed it.
3. **Keys stay in the environment.** Read `FAL_KEY`, `WAVESPEED_API_KEY`, `KIE_API_KEY` from env vars only. Check presence with `[ -n "$FAL_KEY" ]`; never print, log, or write a key to any file. If a key is missing, tell the user which one and stop.
4. **Project integrity.** These renders represent real development proposals. Edits may change light, sky, season, weather, landscaping, and camera polish — they must **not** change massing, height, unit count, floor count, facade design, program, or site context. Never generate a building and present it as one of Adolfo's projects. If a request would misrepresent a project, say so and offer a variant that doesn't.
5. **No text in generated pixels.** Titles, stats, and logos are rendered locally (HTML/Pillow) with the site's own fonts, never by the model.
6. **Nothing goes live without approval.** Outputs land in `generations/` (gitignored). Only the `promote` step copies files into `assets/`, and only when the user picks specific files.
7. **Log everything** to `generations/log.jsonl` (format below), including failed and cancelled jobs.

## Invocation

`/generate <recipe> <target> [notes]`

| Recipe | Target | What it makes | Paid? |
|---|---|---|---|
| `explore` | a render path or a brief | Same brief across 2–3 models side by side to pick a model/look | yes |
| `variant` | existing render, e.g. `assets/mirador/hero.jpg` | Edited version of a real render: dusk, golden hour, overcast, lusher planting, cleaner sky | yes |
| `loop` | existing render | 5–8 s subtle image-to-video hero loop (drifting clouds, shifting light, gentle push-in) | yes |
| `og` | page slug: `home`, `contact`, `sunnyvale-mixed-use`, `solace-commons`, `mirador-manor` | 1200×630 social share card: generated or existing background + locally composited title | background only |
| `texture` | a brief, e.g. `poured concrete, board-formed` | Seamless tileable background texture matching `assets/tex/` | yes |
| `optimize` | a file or folder under `assets/` | Web-sized, compressed copies (no model call) | no |
| `promote` | files in `generations/` | Copies approved outputs into `assets/<project>/` with clean names | no |

If the recipe or target is missing or ambiguous, ask one short question, then proceed.

## Workflow (paid recipes)

1. **Brief.** Restate the goal in one line. Load the target image(s) and the matching section of `style.md`. For `variant`/`loop`, list what may change and what must stay fixed (rule 4).
2. **Route.** Pick a model and provider per `providers.md`. Fetch that model's live schema and price. Prefer an image-*editing* model for `variant`, an image-to-video model for `loop`.
3. **Prompt.** Draft the exact prompt(s) and parameters. Show them with the cost quote in one message. Wait for approval (rule 1).
4. **Generate.** Submit, poll to completion, and **download results immediately** into `generations/<YYYY-MM-DD>/` (provider URLs expire). Name files `<recipe>-<slug>-<nn>.<ext>`, e.g. `variant-mirador-hero-dusk-01.png`.
5. **Check.** Look at each output. Reject and say so if it breaks rule 4 or `style.md` (changed massing, extra floors, blue cast, garbled text, warped geometry). Don't auto-retry past the cap.
6. **Report.** List each file with model, provider, actual cost, and a one-line verdict. Offer `optimize` + `promote` for the keepers.

## Recipe notes

- **`explore`** — keep the prompt identical across models; vary only the model. Present results as a comparison table.
- **`variant`** — always pass the original render as the reference image. Match the original aspect ratio and at least its resolution. Prompt pattern: *"Keep the building, massing, facade, and camera exactly as in the reference. Change only: <lighting/sky/season/landscape>."*
- **`loop`** — motion must be subtle enough to sit behind page content: no camera orbits, no moving vehicles or people as the focus, no morphing geometry. Deliver a muted `.mp4` (target ≤ 4 MB, 720p–1080p) and use the source render as the poster. If wired into a page: `autoplay muted loop playsinline`, `poster=` set, and show the poster only under `prefers-reduced-motion: reduce`.
- **`og`** — output exactly 1200×630. Compose locally: background image, a legible dark/concrete scrim, page title in the site's display font, and the AV mark. Keep key content inside the central ~1000×520 safe area. Save as `.jpg`, target ≤ 300 KB. Update that page's `og:image` / `twitter:image` only when promoted, using the absolute `https://ajvalencia.com/assets/...` URL.
- **`texture`** — request a seamless/tileable output; verify by checking edges line up when tiled 2×2. Target ≤ 400 KB.
- **`optimize`** — uses Python Pillow. If `python -c "import PIL"` fails, ask before running `python -m pip install pillow`. Defaults: max width 2000 px (hero/aerial), 1200 px (cards/inline); photos/renders → `.jpg` quality 82 (or `.webp` quality 80 if the user opts in); keep PNG only for images needing transparency. Write alongside as new files; never overwrite originals without approval; report before/after sizes. Updating HTML references to new filenames is a separate, confirmed step.
- **`promote`** — copy only the files the user names into `assets/<project>/` (kebab-case, descriptive names, no spaces), run `optimize` on them, then show the `git status` diff. Do not commit or push unless asked.

## Log format — `generations/log.jsonl`

One JSON object per line:

```json
{"ts":"2026-09-13T15:04:05Z","recipe":"variant","target":"assets/mirador/hero.jpg","provider":"fal","endpoint":"<endpoint-id>","request_id":"<id>","prompt":"...","params":{"aspect_ratio":"3:2"},"refs":["assets/mirador/hero.jpg"],"quoted_usd":0.12,"actual_usd":0.12,"outputs":["generations/2026-09-13/variant-mirador-hero-dusk-01.png"],"status":"completed","verdict":"kept"}
```

`status` is one of `completed`, `failed`, `rejected`, `cancelled`. Never include keys or auth headers.

## Setup checklist (first run)

- [ ] Create a fal.ai account, add prepaid credit, create a key, set it as a user env var `FAL_KEY` (PowerShell: `[Environment]::SetEnvironmentVariable('FAL_KEY','<key>','User')`, then open a new terminal). The user does this — never handle the key value yourself.
- [ ] Optional: `WAVESPEED_API_KEY`, `KIE_API_KEY` for fallback/cheaper routing.
- [ ] Confirm `generations/` is in `.gitignore`.
