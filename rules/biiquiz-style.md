# biiQuiz house style: kinetic scenes (DEFAULT for every edit)

Source: `reference-editing-style.mp4` (57 s, 9:16), analysed 2026-11-03. This style **overrides**
`style-guide.md` wherever they differ. Use the old captions-plus-boxes look only if the user asks for it.

## What the reference does
- **One scene per idea**, 3–8 s long. Scenes change on the voice-over pauses (≈0.3 s silences).
  On a change, everything clears and the background tint shifts.
- **Pastel mesh background**, a different soft tint each scene (lavender → sky → mint → peach → pink).
  It's light, airy and clean, with a very slow zoom.
- **Big heavy headline words** stack from the top, one or two words per line. Each line pops in
  (zoom) on the exact word the VO says. Line 1 is dark ink; the keyword line is in brand colour.
- A **small white tag pill** at the top names the section ("STEP 1", "समस्या", "FREE").
- **UI widgets** under the headline show the idea instead of telling it: a glossy icon, a white
  input box that types itself, a progress bar that fills, checklist rows that tick in one by one,
  a rising bar chart, a row of dots, a strike-through over a wrong idea, and a brand CTA button.
- **Text carries the video**: only key words appear, never the full sentence. There are no
  subtitle-style captions at the bottom.
- **Sound**: the voice leads and there is no music bed. Every element gets a soft UI hit (pop / click /
  typing / tick), with a light whoosh on scene changes.

## biiQuiz brand (`brand/biiquiz.json`)
| Role | Colour | Use |
|---|---|---|
| primary | `#3525CD` | keyword lines, tag text, CTA button, row numbers |
| electric | `#282EFE` | second keyword colour (logo blue) |
| lavender | `#8F7BFF` | third keyword colour, gradient end |
| warm | `#FF7A45` | rare accent for numbers or offers (max 1 per video) |
| ink / navy | `#111339` | headline text, widget text |
| success | `#22C55E` | check badges |
Gradient for bars, progress and strike: `#282EFE → #8F7BFF`. Theme `light` (pastel) by default;
`"theme": "dark"` gives the navy website-hero look with white headlines.
Fonts: Devanagari = CapCut effect font `7482756842486009094`. English words inside a line switch
automatically to **NTSomic Bold**. Input boxes use **Consolas Bold** for English text.

## How to turn the VO into scenes
1. Use the word timings from `work/transcript.json`/`transcript.srt`. Scene boundaries go at sentence
   ends and VO pauses (`ffmpeg silencedetect` on the VO if needed). Scene `start` = the first word
   of the scene minus 0.05 s.
2. **Tag**: 1–3 words that name the section: a step number, "समस्या", "समाधान", "FREE",
   "biiQuiz", "लोक सेवा". Not every scene needs one, but most do.
3. **Lines**: 2–3 per scene, 1–2 words each (≤ 12 characters for size 16; use size 12–13 for
   longer lines). Lines are the VO's key words in proper Devanagari, and each one's `at` is
   the moment that word is spoken. Usually line 2 (the payoff) gets a colour; rotate
   `primary` → `electric` → `lavender` across scenes. A number can be its own line at size 28–34.
4. **Widget**: 0–2 per scene, picked by meaning:
   | VO says | Widget |
   |---|---|
   | a feature list, "X, Y and Z", steps done | `rows` (2–5 rows, one per item as it's spoken) |
   | search / type / "लेख्नुहोस्" / a question asked | `input` (types itself; keep it short) |
   | download, loading, preparing, progress | `progress` |
   | results, score, improvement, rank | `bars` (or icon `chart` / `trophy`) |
   | "N steps", "N subjects" | a big number line + `dots` with count N |
   | old way vs new way ("coaching", "books") | line + `strike` on it |
   | a concept or object (exam, time, lock, goal) | `icon`: book, cap, stopwatch, clock, target, lock, trophy, medal, bulb, question, phone, calendar, star, check, folder, bell, rocket, chart, paper |
   | a screenshot of the biiQuiz app or site | `image` (path to the PNG/JPG) |
   | a call to action (website, sign up, free test) | `cta` (+ `pill` under it, e.g. "FREE") |
5. Each scene's stack is centred in the TikTok safe zone (13.5–85% height, 7.5–89% width; the builder warns if it overflows). Use at most
   about 6 elements per scene. Split a busy idea into two scenes.
6. The **last scene** is the CTA: "biiquiz.com" / "Free Practice Test" button, held ≥ 2.5 s.
7. Logo: if the draft has a biiQuiz logo near the top, the builder starts the stack below it automatically.

## Sound
- Auto SFX come from `brand/biiquiz.json → sfx` (pop per line, blip per tag/pill, typing under an input,
  select/confirm on rows, data blip on progress, counting on bars, success on the CTA, whoosh on
  scene change). Volumes are 0.22–0.5; the builder thins out hits closer than 0.12 s apart.
- **BGM: none by default** (the reference has none). Add one only if the user asks or the draft
  feels empty, at 0.08–0.12 (`brand/biiquiz.json → bgm`).

## Captions
Off by default: the kinetic lines are the on-screen text. If the user asks for full subtitles,
add `captions` with the pill style (`box: {color: "#111339", alpha: 0.85}`), size 7, y -0.62,
and keep the kinetic stack above y -0.3.
