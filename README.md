# Claude Code — biiQuiz Video Editor for CapCut (Nepali)

Hand Claude a CapCut draft that has a Nepali voice-over and the biiQuiz logo. It edits in the
**biiQuiz kinetic-scene style** taken from `reference-editing-style.mp4`:
- **Scenes timed to the voice-over**: a pastel background per scene, a white tag pill ("STEP 1"), and big
  stacked headline words (proof-read Nepali + English product words) that pop in on the spoken word
- **UI widgets**: glossy icons, a typing input box, a progress bar, checklist rows with green ticks,
  a bar chart, dots, a strike-through, and a CTA button, in biiQuiz colours (`brand/biiquiz.json`)
- **Sound design**: a soft UI hit on every element, a whoosh on scene changes, and no music unless you ask

The words come from your SRT or voiceover text (pasted in chat), or the draft's CapCut auto-captions.
No speech-to-text install needed. The older SaaS look (bottom captions + box cards) is still available on request.

Then it writes the edit **back into the same draft**. Open that draft in CapCut and the edit is there.
A full backup is kept in `projects/<draft>/original_draft/`, and one command undoes the edit.

## One-time setup
1. Open this folder in VS Code (or `cd D:\claude-code-saas-video-editor` in a terminal) and start Claude Code there.
   `CLAUDE.md`, the skill and the subagent load automatically.
2. Permissions, so it runs without prompts. Copy the recommended file into place:
   ```powershell
   Copy-Item setup\settings.recommended.json .claude\settings.json
   ```
   This grants read access to your CapCut drafts, CapCut cache, Downloads and SFX folders, and lets the
   `engine/` scripts run. Direct edits inside `D:\capcut-initdata` are **denied**: the only way in is `engine/deploy.js`.
3. Optional refresh (already done once): `node engine/extract_templates.js` and `node engine/catalog_audio.js`.

## Use it
1. Close CapCut fully.
2. In Claude Code, type one of these:
   ```
   /biiquiz-video-editor my-biiquiz-draft
   /biiquiz-video-editor "D:\capcut-initdata\CapCut Drafts\my-biiquiz-draft"
   ```
   or just say: *"use the biiquiz-video-editor agent to edit draft my-biiquiz-draft"*.
   Then give the words, in any one of these ways:
   - paste the **SRT** in chat (or give its file path): exact timing
   - paste the **voiceover text**: auto-timed to the VO audio
   - nothing: it uses the draft's **CapCut auto-captions** (run Auto captions in CapCut first)
3. When it finishes, open the same draft in CapCut.

Undo: `node engine/restore.js projects/<draft>`

## Folder layout
```
CLAUDE.md                              agent brief (auto-loaded) → imports rules/*
.claude/skills/biiquiz-video-editor    the 8-step workflow (/biiquiz-video-editor)
.claude/agents/biiquiz-video-editor.md subagent version of the same workflow
brand/biiquiz.json                     biiQuiz colours, fonts, per-element SFX
reference-editing-style.mp4            the style reference
rules/                                 editing rules, biiQuiz kinetic style, SaaS style guide, plan schema, CapCut notes
engine/                                scripts (setup, import_transcript, graphics, build, verify, deploy, restore)
engine/lib/kinetic.js                  lays out the kinetic scenes (stacking, timing, auto SFX)
templates/                             CapCut JSON templates + fonts harvested from your own drafts
library/                               shared SFX + audio_catalog.json
memory/lessons_learned.md              gets smarter after every edit
projects/<draft>/                      one folder per edited draft:
    original_draft/  full untouched copy     work/  transcript, edit_plan.json
    assets/          kinetic graphics        audio/ chosen music
    output/          built draft_content.json + build_report.json
```

## Requirements (already present on this PC)
Node 22, Python 3.14 with `pillow`. ffmpeg comes from CapCut's own `ffmpeg.exe`. Nothing else to install.
