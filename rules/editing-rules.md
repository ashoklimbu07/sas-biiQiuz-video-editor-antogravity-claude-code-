# Editing Rules (hard rules — never break)

## Safety & isolation
1. **Write only to**: this folder (`D:\claude-code-saas-video-editor\`) and the ONE CapCut draft the user named.
   Every other draft in `D:\capcut-initdata\CapCut Drafts\` is read-only (you may read them for style/templates).
2. **Never hand-edit draft files.** All writes to a CapCut draft go through `engine/deploy.js` (or `restore.js`).
3. **Backup first.** `engine/setup_project.js` copies the full draft into `projects/<draft>/original_draft/` once.
   That copy is never modified; every build starts from it, so re-running is safe and never stacks edits.
4. **Only ADD, never remove.** Keep the user's VO, logo, footage, text, SFX and BGM exactly as they are.
   `verify_edit.js` fails the build if any original segment disappears.
5. **CapCut must be closed** before deploy. If `deploy.js` reports CapCut is running, tell the user to close it
   (including the tray icon) and re-run deploy. Do not use `--force-running` unless the user says so.
6. If `draft_content.json` is not plain JSON (encrypted by CapCut), stop and explain. Do not try to decrypt it.

## Autonomy
- Do not stop for confirmation between steps. Run the whole pipeline end to end and report at the end.
- Ask the user only when blocked: no voice-over found, draft encrypted, or CapCut still open at deploy.
- Transcript sources, best first: the user's SRT, the user's VO text, then the draft's CapCut auto-captions.
  Never use speech-to-text (Whisper etc.). If none of the three exists, ask the user for the SRT or text.

## Quality gates (check before deploy)
- Every caption chunk proof-read. Nepali in Devanagari; English SaaS/brand words stay in English
  (e.g. "eSIM", "Dashboard", "AI", "App"). No auto-caption mishearings left.
- Captions never overlap each other, and never sit under a box graphic (see style-guide zones).
- Classic `boxes`: no more than **2 on screen at once**, and none covering the logo. (Kinetic scenes
  follow `biiquiz-style.md` instead: ≤ ~6 elements per scene, stack above ~75% of the height, no build warnings.)
- Kinetic lines: proof-read Devanagari, 1–2 words per line, each timed to its spoken word.
- SFX volume ≤ 0.6. BGM: none by default for biiQuiz kinetic edits; if used, 0.08–0.12 (classic style: 0.12–0.20).
  VO stays at its original volume.
- `node engine/verify_edit.js <project>` prints `OK`.

## Learning
After every edit append to `memory/lessons_learned.md`: draft, date, brand colours, font, caption size/position,
box kinds used, SFX + BGM picks, problems + fixes, and any user feedback. When the user gives feedback
("captions too big", "use light theme"), record it as a **preference** at the top of that file.
