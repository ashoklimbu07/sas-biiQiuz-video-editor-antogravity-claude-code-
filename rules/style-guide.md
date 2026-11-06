# SaaS Style Guide

Target look: clean product-ad / SaaS explainer (Linear, Notion, Stripe-style). Flat, confident,
brand-coloured, lots of breathing room. No grunge, no horror HUD, no clutter.

## Brand palette
- Run `python engine/render_graphics.py palette --logo <logo file> --out <project>/work/brand.json`.
- `primary` = boxes/CTA, `secondary` = accents/glow, `highlight` = caption keyword colour, `dark` = background base.
- If the logo is white/black only, keep it neutral: primary `#4F46E5` (indigo), secondary `#06B6D4` (cyan).
- The caption highlight must contrast with the background. Yellow `#FACC15` or the brand secondary both work.

## Screen zones (9:16 vertical, CapCut y-coordinates: +1 = top, -1 = bottom)
| Zone | y range | Use |
|---|---|---|
| Logo safe area | wherever the logo already is (inventory `logo_segments.pos`) | keep clear |
| Box zone | +0.15 … +0.55 | cards, stat boxes, chips |
| CTA zone | -0.05 … +0.15 | CTA pill near the end |
| Caption zone | -0.38 … -0.55 (default -0.45) | captions only |
| Platform UI | below -0.65 | nothing (TikTok/Reels buttons cover it) |
For 16:9: boxes at y 0.35–0.6 on the left or right third (x ±0.45), captions at y -0.72.

## Captions (Nepali)
- 2–4 words per chunk (≤ 22 characters), split at natural pauses and `।` `,` `?`.
- One highlight word per chunk at most: the benefit, number, product name or verb. Many chunks have none.
- Style default: bold, white, black stroke 0.06, soft shadow, **Bounce In** animation, size 9.5 (9:16) / 7 (16:9).
- Alternative "pill" style for light backgrounds: `style.box = {color: brand.dark, alpha: 0.8}`.
- Numbers: write the way the speaker reads them; Devanagari numerals (१९०+) are fine for Nepali sentences.
- Keep English SaaS words in Latin script: App, Dashboard, AI, eSIM, Login, Free Trial.
- Fonts: the Devanagari font already used in the user's drafts (config `nepali_font_preferred`),
  otherwise CapCut's system font. Never Segoe UI (no Devanagari).

## Box graphics — when to use which
| Spoken content | Box kind | Icon | SFX tag |
|---|---|---|---|
| Feature / benefit ("२४ घण्टा सपोर्ट") | `glass` (+subtitle when there's detail) | check / bolt / shield / clock | click / whoosh |
| A list of 2–3 features | 2–3 `glass` boxes staggered 0.35 s apart, stacked (y step 0.14) | check | click |
| Number / stat ("१९०+ देश", "५०% छुट") | `stat` | chart / star | counting |
| Short keyword tag ("नयाँ", "FREE") | `chip` or `native` | none / star | pop |
| Problem / pain point | `outline` with icon `cross` | cross | glitch (soft, vol 0.3) |
| Call to action (download, sign up, link) | `cta` near the end, hold ≥ 2.5 s | arrow | success / notification |
| Price / offer | `solid` or `native` with brand colour | none | pop |
- A box appears on the exact word that motivates it (box `start` = word start - 0.05 s) and stays
  1.8–3.5 s, or until the idea changes.
- Box text is short: title ≤ 24 characters, subtitle ≤ 32. Paraphrase the VO, don't copy it.
- Roughly one box every 3–6 s. Never more than 2 on screen. Leave quiet moments.
- `native` boxes (CapCut text with a rounded background) are the most editable. Use them for chips, prices and tags.

## Background
- Only when `inventory.guesses.needs_background` is true (footage covers < 60%), or the user asks for one.
- Styles: `aurora` (default, dark gradient + brand glows), `grid` (tech/dashboard), `spotlight`
  (product reveal), `clean --theme light` (bright friendly brands). Use one style per video, and at most
  1–3 background segments (change on a section break) with slow zoom 1.00 → 1.06.

## Sound design
- Existing SFX in the draft stay. Never stack a new SFX within 0.3 s of an existing one.
- Box reveal → soft UI sound (click / pop / whoosh) at 0.35–0.5. CTA → success / notification at 0.5.
- Stats → counting tick (≤ 1 s). Section change → whoosh at 0.4. Maximum ~1 SFX per 2 s.
- Libraries (in priority order): `library/sfx/` (shared), `C:/Users/asus/Downloads/ui sfx -premium/ui sfx/`
  (67 premium UI sounds), `D:/ui sfx/`, the CapCut library sounds in `audio_catalog.json`.
  Never use the horror SFX in `D:/soundeffets` for SaaS.
- BGM (only if the draft has none): the draft's own music first, then CapCut favourites / past SaaS picks
  from `audio_catalog.json` (★ "Story of One Success", "Gentle Ads … Modern Technology"), else a free
  CC0 / royalty-free track from the web (Pixabay Music, Mixkit), saved into `projects/<draft>/audio/` with
  its source URL noted in the report. Volume 0.12–0.20.
