# Lessons Learned — SaaS Video Editor

Read before every edit. Append after every edit. User preferences at the top override the style guide.

## User preferences (from feedback — highest priority)
- This agent is for **biiQuiz** (biiquiz.com, Nepali exam prep). Default style = the kinetic scenes from
  `reference-editing-style.mp4` (`rules/biiquiz-style.md`), in biiQuiz brand colours. Most videos are Nepali.
  Said on 2026-11-03.
- **Safe zone**: keep every kinetic element inside the TikTok/Reels safe box (top 13.5%, bottom 85%, left 7.5%,
  right 89% of the canvas) and centre each scene's stack in it, not stacked at the very top. Said on 2026-11-04
  (screenshot: tag pill was under the "Following" bar, big empty space below). Default in `kinetic.layout.safe`.
- **Pop SFX on every card** (input, row, progress, icon, image, CTA, pill): user's `D:/ui sfx/popup2.mp3`. Said on 2026-11-04.
- **Motion = Wiggle / Pendulum (Swing / Wobble), NO left-right movement.** Every line and card swings in with a
  damped pendulum wobble that settles, cards also rise in, and the scene keeps a gentle in-phase pendulum rock
  (±2.2°) plus a tiny vertical bob. No sliding in from the sides and no horizontal sway. Said on 2026-11-05
  (replaces the 2026-11-04 slide/sway motion). Default on (`kinetic.motion`).
- **Match the reference effect + slow zoom in/out** (said 2026-11-05): every element "slams" in like the reference
  (lands from 1.25x oversized to 1.0 with a tiny overshoot, quick fade) while doing the pendulum wobble, and each scene
  breathes with a slow group zoom in -> out (1.0 -> 1.05 -> 1.0 over 4 s, the whole stack scales about its centre).
- **First frame must not be empty**: the first scene's tag + hook headline sit at t=0 fully settled (no entry
  animation on frame 0), so the opening frame / cover shows the headline like the reference.
- **SFX variety** (said 2026-11-05): never repeat one sound file a lot. Each file **max 5 uses per video**, never
  **more than 3 in a row** (the builder avoids any back-to-back repeat), and use different sounds from the user's SFX
  folder. Enforced in `engine/build_edit.js` (SFX variety pass) with pools in `brand/biiquiz.json → sfx_pools`
  (hit / whoosh / typing / data / count / success, classified from `D:/ui sfx` by attack + length + brightness),
  loudness-matched per file (`library/sfx_loudness.json`). Hand-placed plan SFX can join a pool with `"pool": "<name>"`.
  When a draft brings a new SFX folder, classify it the same way and add its files to the pools.
- **Social bar on every video** (said 2026-11-05): FB `biiquiz`, Insta `biiquizofficial`, TikTok `biiquiz_enterprise` (changed 2026-11-05)
  with their logos, as a static white pill for the whole video (`kinetic.overlays` + `engine/ui_cards.py social_bar`).
  **The user then placed it themselves at y 85% from top, ~724 px wide (CapCut y -0.70, scale 0.67)** → use that as the
  default (`y_frac 0.85`, `width_px 724`) with kinetic `layout.safe.bottom: 0.795` so scenes stay above it.
  If the user moves something in CapCut, read the live draft, copy their position into the plan BEFORE re-deploying
  (a rebuild starts from the pristine copy and would otherwise undo their change).
- **End card** (said 2026-11-05): website `biiquiz.com`, email `info@biiquiz.com`, **WhatsApp `971-4608540`** as
  **three separate pill elements, NOT one shared card**, each popping in on its own beat (`ui_cards.py contact_web /
  contact_mail / contact_whatsapp`, kinetic `tiles` with `cols: 1`). All contact data lives in `brand/biiquiz.json → contact`.
- **Batches are exam batches, not school classes** (said 2026-11-05): use "Batch A", "Batch B", "IOE Entrance",
  "LLM Entrance" style labels, never "Class 10 / Class 12".
- (Add lines like: "Headlines: size 18, more space between lines — said on <date>")

## Calibration still open (check on the first real biiQuiz edit)
- CapCut text height per font size is estimated as `px_per_size: 8.6` px at 1080 width (size 16 ≈ 138 px line step).
  After the first deploy, compare in CapCut: if the lines overlap, raise it; if the gaps are too big, lower it.
  Then record the real value here and set it as the default in `engine/lib/kinetic.js`.
- Check that the NTSomic Bold (English) + Devanagari font mix renders in one text layer, and that the
  pop-in keyframes (scale + alpha) on the PNG widgets play in CapCut.

## Known-good facts (seeded 2026-11-03 from the user's past drafts)
- Canvas for SaaS/offer reels is usually **9:16 1080x1920** (Nimbuzz eSIM, IDP drafts).
- Nepali font that works in CapCut: effect `7482756842486009094` (`.../92df43a041fca34183aa56ed9d814d41/font.ttf`),
  used for "विदेशमा अझै Roaming?" in `nimbuzzesimad02`, at size 15 for big headlines. A second Devanagari
  font that works: effect `7541309703196839184`.
- The user's past SaaS sound palette: `C:/Users/asus/Downloads/ui sfx -premium/ui sfx/` (Button (n).wav, Select.wav,
  DATA 2 (8).wav, counting.wav, Aproove.wav, notification sounds), plus a CapCut "RISER_01" before reveals.
- CapCut favourite BGM: ★ "Story of One Success" (131 s, used in 9 drafts at ~0.2). For tech/SaaS:
  "Gentle Ads (Uplifting Inspiring Modern Technology Future)" (136 s, ~0.17).
- VO in past SaaS drafts: ElevenLabs Nepali voices (Kanika, Kaanchi, Sunita) as `extract_music` at vol 1.0.
- Transcript source (user decision, 2026-11-03): NO Whisper. Use an SRT or VO text from chat, or CapCut auto-captions in the draft (Nepali auto-captions exist with lang ne-NP, word timings in ms).
- Auto-captions have no punctuation, so the chunker splits at line boundaries and merges orphan single words.

## Technical fixes
- `Timelines/<id>/template.tmp` is NOT a copy of draft_content.json. Never overwrite it (the old survival
  deploy script did).
- Pillow on this PC has no raqm, so Devanagari can't be drawn in PNGs. All words are native CapCut text.
- Only Fade In / Fade Out animations are cached for image (PNG) layers. Text has Bounce/Fade/Typewriter/Zoom/Reveal.

## Edit history
<!-- Template:
### <draft-name> (<YYYY-MM-DD>)
- Canvas / duration:
- Brand colours: primary … secondary … highlight …
- Captions: N chunks, size …, y …, style …
- Boxes: N (kinds …)
- Background: style … / none
- SFX: N (files …)   BGM: … @ vol …
- Problems → fixes:
- User feedback:
-->

### biiquiz-intro (2026-11-04)
- Canvas 1080x1920, 28.53 s. Draft had only the VO on the timeline (ElevenLabs "Anika Expressive Punchy Ads").
  The logo and SFX were only in the media bin: logo = `C:/Users/asus/Downloads/Screenshot 2026-11-04 005209.png`
  (white bg + stray red dot) → cleaned to transparent `projects/biiquiz-intro/assets/logo_biiquiz.png`, used as a
  kinetic `image` on the brand reveal ("biiQuiz मा test…") and the CTA scene. SFX folder imported = `D:/ui sfx/`.
- Transcript: user VO text. ElevenLabs VO has almost no silences (silencedetect finds ~nothing), so the text
  estimate drifted up to 0.6 s. Fix: 50 ms loudness profile → manual sentence anchors → `work/retime.js`
  redistributes the words by length inside each span. Reuse this for punchy ElevenLabs VOs.
- 8 scenes, kinetic light theme, no captions, no BGM. 35 SFX. Widgets: input, progress, rows, strike ×3, icons
  (book, calendar, phone, check), logo image ×2, cta biiquiz.com + pill FREE DEMO. Warm used once ("३०० कपी").
- Engine: added `kinetic.sfx` per-plan overrides (so SFX can come from the draft's own folder).
- Icon `paper` renders almost white on white and ignores `color`. Use `book` instead.
- User feedback: content sat too high and outside the safe zone, wanted pop SFX on cards and reference-style
  wiggle/slide motion. Fixed with safe-zone centring, the `card` SFX key and position/rotation keyframes (v2 deploy).

### biiquiz-nov5 (2026-11-05)
- Draft canvas was CapCut "original" 1920x1080 (empty timeline, only VO) → forced **9:16 1080x1920** with the new
  plan key `"canvas"`. Check this on every new draft: an empty draft defaults to 16:9.
- VO: ElevenLabs "Monika Sogam" 40.7 s, no true silences again → 50 ms loudness profile (`work/loud.js`) + 18 sentence/comma
  anchors in `work/retime.js`. Key anchor: a pause just before "biiQuiz" (~12.0 s) for the logo reveal.
- "sfx 2 folder" = the 2nd SFX folder in the draft's media bin = `D:/ui sfx/` (1st is `D:/soundeffets`, horror — never used).
- Logo: bin has `Screenshot 2026-11-04 005209.png` again → reused cleaned `logo_biiquiz.png` on the reveal (12.1 s) and the CTA scene.
- New premium UI cards (`engine/ui_cards.py`, Latin-only, after the user's biiQuiz admin Billing screenshot style):
  app tiles (excel/paper/calc/notebook), upload_students, batch_chips, question_card, import_file, calendar,
  leaderboard, billing (realistic numbers, not the screenshot's zeros), coming_soon, comment ("DEMO").
- New kinetic item `tiles` (images side by side, each pops on its word). Background segments now snap to 30 fps
  (fixed a 1-frame overlap error in verify).
- 11 scenes, light theme, no captions, no BGM, 55 SFX (popup2 on cards, Short whoose_10 on scene change, extras:
  CORRECT ANSWER WOOSH on logo reveal, Notification 01/02, counting, Beacons on "coming soon").
- User feedback: wanted the reference's effect, slow zoom in/out on top of the pendulum, and a fixed first frame
  (was empty background until 0.13 s) → engine v3 motion (slam entry + group breathing zoom + frame-0 settle).
  Then: "first ~10 s not synced" → my first anchors gave sentence 1 only 10 chars/s (others 11-13). Re-anchored with a
  25 ms loudness strip + a constant speech rate per phrase: S1 ends 6.83 (not 7.95), S2 6.88-10.57.
  **Rule for ElevenLabs VOs: check chars/sec per phrase after anchoring; every phrase should land at ~11-13.5
  (Devanagari+Latin letters, no spaces). A phrase far outside that range means a wrong anchor.**
  Then: "don't repeat the same SFX" → variety pass: 54 hits over 46 different files, max 2 uses, 0 back-to-back repeats.
