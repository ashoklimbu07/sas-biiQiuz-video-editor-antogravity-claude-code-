# CapCut draft format — what matters (CapCut desktop 9.x, Windows)

- Draft folder: `D:\capcut-initdata\CapCut Drafts\<name>\`.
  - `draft_content.json`: the timeline (plain JSON; an encrypted draft can't be edited)
  - `template-2.tmp` and `draft_content.json.bak`: identical copies of draft_content.json
  - `Timelines/project.json` → `main_timeline_id`. `draft_content.json.id` MUST equal it.
  - `Timelines/<main_timeline_id>/draft_content.json` (+ `.bak`, `template-2.tmp`): identical copies too.
  - `Timelines/<id>/template.tmp` and `template.json` are DIFFERENT small files. Never overwrite them.
  - `draft_meta_info.json`: `tm_duration` (µs) and `tm_draft_modified` (µs) get updated on deploy.
- Times are microseconds. The builder snaps to a 30 fps grid.
- Media paths may look like `##_draftpath_placeholder_<uuid>_##/Resources/local/x.mp3`, which means
  relative to the draft folder (`resolveMediaPath`).
- Track order = layer order. The first `video` track is the **main track**. Later video/text tracks render
  on top of earlier ones. New background goes in at index 0, and new visual tracks go before the first audio track.
- Image segments: at scale 1, CapCut fits the image inside the canvas. Use `scaleForWidth()` for exact pixel sizes.
- Text: `materials.texts[].content` is a JSON string `{text, styles:[{fill,font,size,range,strokes}]}`.
  Ranges are JS string indices (Devanagari is BMP, so `.length` works). Multiple styles = per-word colours.
  The native rounded box uses `background_color/alpha/style(3)/round_radius/width/height`.
- Animations (`material_animations`, type `sticker_animation`) must exist in the local effect cache.
  The builder only uses cached ones from `templates/templates.json`:
  text in: Bounce In `7428456013868616965`, Fade In `6724916044072227332`, Typewriter `7210980292243231233`,
  Zoom In `7428455170469580037`, Gradual Reveal `7648938116048375061`. Text out: Fade Out `6724919382104871427`.
  Video/PNG: Fade In `6798320778182922760`, Fade Out `6798320902548230669`.
- Library music: reuse the full `music` material harvested in `audio_catalog.json` (keeps `music_id`).
  Local files: type `extract_music`.
- If CapCut is open while files change, it will overwrite them from memory on close. Always deploy with CapCut closed.
