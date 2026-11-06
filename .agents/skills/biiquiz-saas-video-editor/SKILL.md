---
name: biiquiz-saas-video-editor
description: >-
  Edit a CapCut desktop draft for a biiQuiz video with a Nepali voice-over, in the biiQuiz kinetic-scene house style
  (from reference-editing-style.mp4): pastel scene backgrounds, big stacked Nepali/English headline words timed to
  the VO, a white tag pill, glossy icons, and UI widgets (typing input, progress bar, checklist rows, bars, dots,
  strike, CTA button), with soft UI sound design. The edit is written back into the SAME draft, with a full backup.
  Use when the user gives a CapCut draft name/path and asks to edit it, or says "edit this biiQuiz video".
argument-hint: "<draft name or full draft path>"
---

# biiQuiz Video Editor

Draft to edit: **$ARGUMENTS** (if empty, ask for the draft name or path. That is the only question).

Work from `D:\claude-code-saas-video-editor`. Follow `CLAUDE.md` and everything in `rules/`. The house
style is `rules/biiquiz-style.md`. Run all steps without pausing. `P` = the project folder printed by step 1.

## 1. Setup + backup
```
node engine/setup_project.js "$ARGUMENTS"
```
Read `memory/lessons_learned.md` now (user preferences at the top override everything).

## 2. Confirm the inventory
Read `P/inventory.json`:
- **Voice-over** segments (fix `guesses.voiceover_segments` if wrong). No VO at all → stop and tell the user.
- **Logo** position (the kinetic stack auto-starts below a top logo; check it anyway).
- Existing SFX / BGM / text / footage: all stay. If the draft has full-screen footage the user wants
  visible, set `kinetic.background: false` and consider `theme` and placement carefully.

## 3. Transcript (no speech-to-text)
First source that exists:
1. SRT in chat or an .srt path → save to `P/work/input.srt` → `node engine/import_transcript.js P --srt P/work/input.srt`
2. VO script in chat → `P/work/input.txt` (one sentence per line) → `node engine/import_transcript.js P --text P/work/input.txt`
3. CapCut auto-captions in the draft → `node engine/import_transcript.js P --from-draft`
4. None → ask the user for the SRT or VO text.

Read `P/work/transcript.json` (word timings). Proof-read the Nepali yourself: a user script is ground
truth; auto-captions often mishear Nepali.

## 4. Find the scene breaks
Split the VO into ideas of 3–8 s at sentence ends and pauses. If the word timings are rough, detect
the pauses in the VO file:
```
<ffmpeg> -hide_banner -i "<vo file>" -af silencedetect=n=-35dB:d=0.25 -f null -
```
(ffmpeg = CapCut's bundled one; `node -e "console.log(require('./engine/lib/config').ffmpegPath())"`.)
Pause times are timeline times only if the VO segment starts at 0 with src_start 0. Otherwise offset them.

## 5. Plan the scenes → `P/work/edit_plan.json`
Follow `rules/biiquiz-style.md` (what goes in a scene) and `rules/edit-plan-schema.md` → `kinetic`:
- `captions.enabled: false` (kinetic lines are the on-screen text), unless the user asked for subtitles.
- For each scene: an optional `tag`, 2–3 `line`s (the key words, each `at` its spoken word), and 0–2
  widgets chosen by meaning. Rotate keyword colours `primary` → `electric` → `lavender`.
- The last scene is the CTA (`cta` "biiquiz.com" or the offer the VO names), held ≥ 2.5 s.
- Leave `bgm` out (the reference has none) unless the user asks. If they do, use `brand/biiquiz.json → bgm` at 0.08–0.12.
- Don't hand-place SFX for kinetic items; they're automatic. Use `sfx` only for extra hits.

## 6. Build + verify + look
```
node engine/build_edit.js P
node engine/verify_edit.js P
```
Fix every ERROR and every `kinetic scene … reaches N%` warning (shorten lines, lower sizes, or split
the scene), then rebuild. Read 2–3 PNGs from `P/assets/kinetic/` to check they look right.

## 7. Deploy into the SAME draft
```
node engine/deploy.js P
```
If CapCut is running, tell the user to close it fully (including the tray icon) and re-run.
Undo: `node engine/restore.js P`.

## 8. Report + learn
Tell the user: the draft edited + backup location; the scene list (time → tag → lines → widgets);
the SFX count; BGM (none / which); 4–6 Nepali lines to spot-check spelling; what to check in CapCut
(headline size: calibrate with `kinetic.layout.px_per_size` or line `size`); how to undo.
Append the session to `memory/lessons_learned.md`. Record any feedback as a preference at the top.
