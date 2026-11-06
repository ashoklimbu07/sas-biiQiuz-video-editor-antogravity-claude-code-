# Claude Code — biiQuiz Video Editor (CapCut, Nepali)

This folder is a Claude Code agent that edits **CapCut desktop drafts** for **biiQuiz** (Nepal's exam-prep
platform) videos with a **Nepali voice-over**. The user gives a draft name or path; you produce an edited draft
that the user sees when they open the **same draft** in CapCut.

What the incoming draft has: Nepali VO, the biiQuiz logo, and sometimes SFX / footage / BGM.
What YOU add, in the **biiQuiz kinetic-scene house style** (`rules/biiquiz-style.md`, from
`reference-editing-style.mp4`):
1. **Scenes** timed to the VO: a pastel mesh background per scene, a white tag pill, and big stacked headline
   words (proof-read Devanagari + English product words) that pop in on the spoken word.
   The words come from the user (an SRT or VO text in chat) or the draft's CapCut auto-captions.
   There is **no speech-to-text**: never install or run Whisper.
2. **UI widgets** that show the idea: glossy icons, a typing input box, a progress bar, checklist rows,
   a bar chart, dots, a strike-through, and a CTA button, all in biiQuiz colours (`brand/biiquiz.json`).
3. **Sound design**: a soft UI hit on every element, a whoosh on scene changes, and no BGM unless asked.

The older SaaS look (bottom captions + box cards, `rules/style-guide.md`) is still available on request.

@rules/editing-rules.md
@rules/biiquiz-style.md
@rules/style-guide.md
@rules/edit-plan-schema.md
@rules/capcut-format.md

## Start of every session
- Read `memory/lessons_learned.md` (user preferences + fixes from past edits) and apply it.
- If `templates/templates.json` is missing → `node engine/extract_templates.js`.
- If `library/audio_catalog.json` is missing or older than ~7 days → `node engine/catalog_audio.js`.

## The workflow
Run the `/biiquiz-video-editor <draft>` skill (`.claude/skills/biiquiz-video-editor/SKILL.md`), or delegate to
the `biiquiz-video-editor` subagent. Both follow the same 8 steps:
setup → inventory check → transcript (SRT / text / auto-captions) → scene breaks → plan scenes →
build + verify → deploy → report + update lessons.

## Tooling
- Node 22 (`node`), Python 3.14 with `pillow` (graphics only).
- ffmpeg: CapCut's bundled `ffmpeg.exe` is auto-detected (no install needed). It handles durations and silence detection.
- Run everything from this folder: `D:\claude-code-saas-video-editor`.
