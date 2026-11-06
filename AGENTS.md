# biiQuiz Video Editor (CapCut, Nepali)

This folder is configured to edit **CapCut desktop drafts** for **biiQuiz** (Nepal's exam-prep platform) videos with a **Nepali voice-over**. When given a draft name or path, you produce an edited draft that the user sees when opening the **same draft** in CapCut.

Incoming draft assets: Nepali VO, biiQuiz logo, and optional SFX / footage / BGM.
What you add (in the **biiQuiz kinetic-scene house style** `rules/biiquiz-style.md`, inspired by `reference-editing-style.mp4`):
1. **Scenes** timed to VO: pastel mesh background per scene, white tag pill, and big stacked headline words (proof-read Devanagari + English product words) popping in on spoken words (from SRT, text script, or CapCut auto-captions; no STT/Whisper).
2. **UI widgets**: glossy icons, typing input, progress bar, checklist rows, bar chart, dots, strike-through, CTA button in biiQuiz brand colours (`brand/biiquiz.json`).
3. **Sound design**: soft UI hits on elements, scene whooshes, no BGM unless requested.

Rules reference:
- `rules/editing-rules.md`
- `rules/biiquiz-style.md`
- `rules/style-guide.md`
- `rules/edit-plan-schema.md`
- `rules/capcut-format.md`

## Start of every session
- Read `memory/lessons_learned.md` (user preferences + past edit fixes) and apply it.
- If `templates/templates.json` is missing → `node engine/extract_templates.js`.
- If `library/audio_catalog.json` is missing or older than ~7 days → `node engine/catalog_audio.js`.

## The workflow
Execute `.agent/skills/biiquiz-video-editor/SKILL.md` (or `.claude/skills/biiquiz-video-editor/SKILL.md`) following the 8 steps:
1. Setup + backup (`node engine/setup_project.js "<draft>"`)
2. Confirm inventory (`P/inventory.json`)
3. Transcript import (SRT / VO text / auto-captions)
4. Find scene breaks (3–8s ideas; CapCut ffmpeg silence detection)
5. Plan scenes (`P/work/edit_plan.json`)
6. Build + verify (`node engine/build_edit.js P`, `node engine/verify_edit.js P`)
7. Deploy into the SAME draft (`node engine/deploy.js P`)
8. Report + learn (update `memory/lessons_learned.md`)

## Tooling
- Node 22 (`node`), Python 3.14 with `pillow`
- CapCut's bundled `ffmpeg.exe` (auto-detected via `engine/lib/config.js`)
- Run commands from `D:\claude-code-saas-video-editor`.
