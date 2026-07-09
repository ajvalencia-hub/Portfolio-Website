# Adolfo Valencia — Portfolio Website

Real-estate-development & urbanism portfolio for **Adolfo Valencia** (M.R.E.D.+U. candidate, University of Miami). A static, brutalist-survey-styled site — no build step, no framework.

**Live:** https://ajvalencia.com/

## Pages
| File | Purpose |
|------|---------|
| `index.html` | Homepage — hero, Selected Work index (with 3D massing viewers), About |
| `sunnyvale-mixed-use.html` | Project showcase — Sunnyvale Mixed-Use |
| `solace-commons.html` | Project showcase — Solace Commons |
| `mirador-manor.html` | Project showcase — Mirador Manor |
| `contact.html` | Contact form + direct-contact grid |
| `404.html` | Branded not-found page |

## Structure
```
/                      site root (served by GitHub Pages)
├─ index.html + 4 pages
├─ favicon.svg         AV monogram
├─ robots.txt, sitemap.xml
├─ .nojekyll           serve files as-is (no Jekyll processing)
├─ assets/             fonts, images, textures, .glb models, viewer scripts
├─ uploads/            resume PDF goes here
└─ docs/               design-system reference + handoff notes
```

## Local preview
Any static server works, e.g.:
```bash
python -m http.server 8099
# then open http://localhost:8099/
```

## Deployment (GitHub Pages)
Settings → Pages → Source: **Deploy from a branch** → Branch `main`, folder `/ (root)`.

## Remaining setup
- **Contact form** — replace `YOUR_FORM_ID` in `contact.html` with a real [Formspree](https://formspree.io) endpoint ID. Until then, the form falls back to opening a pre-filled email.
- **Analytics** — replace the placeholder `G-XXXXXXXXXX` (all 5 pages) with a real [GA4](https://analytics.google.com) Measurement ID.
- **Résumé** — drop the PDF at `uploads/adolfo-valencia-resume.pdf` (the homepage "Download PDF" button links there).
- **Custom domain (optional)** — if you add one, update the absolute URLs (canonical, `og:url`, `og:image`, sitemap, robots) from the `github.io` address to the new domain.
