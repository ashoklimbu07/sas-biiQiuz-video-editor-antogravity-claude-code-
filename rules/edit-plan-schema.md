# edit_plan.json schema (`projects/<draft>/work/edit_plan.json`)

Claude writes this file. `engine/build_edit.js` turns it into CapCut tracks. Times are in **seconds on the
timeline**. Coordinates use CapCut units: `x` from -1 (left) to +1 (right), `y` from +1 (top) to -1 (bottom).
Relative paths resolve against the project folder.

```jsonc
{
  "brand": { "primary": "#E11D48", "secondary": "#7C3AED", "highlight": "#FACC15", "dark": "#1A0710" },
  "fonts": { "text": null },                        // optional absolute font path; default = preferred Nepali font

  "background": {                                   // omit or enabled:false when the draft already has footage
    "enabled": true,
    "segments": [ { "start": 0, "end": 38.6, "image": "assets/backgrounds/bg_01.png", "motion": "slow_zoom", "zoom_to": 1.06 } ]
  },

  "captions": {
    "hide_existing_auto_captions": true,            // default true: hides the draft's CapCut auto-captions (visible:false, not deleted)
    "style": {                                      // all optional
      "size": 9.5, "color": "#FFFFFF", "highlight_color": "#FACC15", "y": -0.45,
      "stroke": { "color": "#000000", "width": 0.06 }, "shadow": true,
      "box": null,                                  // or { "color": "#0B1020", "alpha": 0.8 } for pill captions
      "anim_in": "bounce",                          // bounce | fade | typewriter | zoom | reveal | none
      "anim_out": "none"                            // fade | none
    },
    "chunks": [ { "start": 0.10, "end": 1.40, "text": "अब नेशनल ड्राइभिङ", "highlight": ["ड्राइभिङ"] } ]
  },

  "boxes": [
    // PNG card + native text on top (PNG auto-rendered if "png" missing)
    { "start": 1.0, "end": 4.0, "kind": "glass", "icon": "check", "theme": "dark",
      "title": "१९०+ देशमा चल्छ", "subtitle": "एउटै eSIM, कुनै झन्झट छैन",
      "x": 0, "y": 0.35, "width_px": 860, "title_size": 9, "subtitle_size": 6.2,
      "highlight": ["१९०+"], "anim_in": "bounce", "sfx": true },      // sfx: true=auto | false | "path/to.wav"
    // kinds: glass | solid | outline | cta | chip | stat | step | native
    // icons: check | arrow | bolt | star | plus | cross | chart | shield | clock | none
    { "start": 6.0, "end": 8.0, "kind": "native", "title": "५०% छुट", "color": "#7C3AED", "y": 0.5 }
  ],

  "sfx": [ { "start": 12.4, "path": "C:/Users/asus/Downloads/ui sfx -premium/ui sfx/Select.wav", "volume": 0.4, "max_dur": 1.5 } ],
  "sfx_defaults": { "click": null, "pop": null, "whoosh": null, "success": null, "counting": null },  // optional overrides

  "bgm": { "enabled": true, "catalog_name": "Story of One Success", "volume": 0.16, "start": 0, "end": null }
  //  or  { "enabled": true, "path": "audio/bgm.mp3", "volume": 0.15 }
}
```

## `kinetic`: biiQuiz scenes (the default style, see `rules/biiquiz-style.md`)
```jsonc
"captions": { "enabled": false },                    // kinetic lines replace subtitles (hide auto-captions stays default true)
"kinetic": {
  "brand_kit": "biiquiz",                           // brand/<name>.json
  "theme": "light",                                 // light = pastel mesh | dark = navy hero
  "layout": { "px_per_size": 8.6, "top_px": 150, "gap_px": 36 },   // optional calibration
  "background": true,                               // false = keep the draft's own visuals
  "scenes": [
    { "start": 0.0, "end": 4.2,                     // end defaults to next scene start
      "tint": "#C9C4FF",                            // optional; rotates brand scene_tints by default
      "accent": "primary",                          // tag / pill / row-number colour
      "tag": { "text": "STEP 1", "at": 0.1 },
      "items": [                                    // stacked top -> down, each appears at "at" (timeline s)
        { "type": "line", "text": "सबैजना", "at": 0.1 },                       // size 16 default, ink colour
        { "type": "line", "text": "Mock Test", "at": 0.6, "color": "primary" }, // colour: brand key or #hex
        { "type": "line", "text": "१००+", "at": 1.0, "size": 32, "color": "warm" },
        { "type": "icon", "name": "stopwatch", "at": 1.4, "size_px": 300 },
        { "type": "pill", "text": "कसरी?", "at": 2.0 },
        { "type": "input", "text": "लोक सेवा mock test", "at": 2.4, "type_dur": 1.2 },
        { "type": "progress", "label": "LOADING", "at": 3.0, "fill_dur": 1.0 },
        { "type": "rows", "rows": [ { "text": "Subject-wise अभ्यास", "at": 3.2 }, { "text": "Timed Mock Test", "at": 3.7 } ] },
        { "type": "bars", "at": 3.5, "fill_dur": 0.8 },
        { "type": "dots", "count": 6, "at": 3.5, "step": 0.15 },
        { "type": "strike", "target": 0, "at": 3.9 },   // target = index (in items) of a line to cross out
        { "type": "image", "path": "assets/app_screen.png", "width_px": 860, "at": 1.0 },
        { "type": "cta", "text": "biiquiz.com", "at": 3.0 },
        { "type": "gap", "px": 40 }
      ] }
  ]
}
```
- Every item stays until the scene ends (or its own `end`), then fades out. Add `"sfx": false` to silence one.
- Auto SFX per item type come from the brand kit. Don't also list them in `sfx`.
- Kinetic graphics are excluded from the "max 2 boxes on screen" rule. Their limit is the scene height.
- `kinetic.layout.safe`: `{top:0.135, bottom:0.85, left:0.075, right:0.89, v_bias:0.42}` (canvas fractions). Each scene's
  stack is centred in this box (v_bias 0 = top, 0.5 = middle). The builder warns if a scene is taller than the box.
- `kinetic.motion`: `{swing_deg:2.2, swing_period:2.6, entry_deg:7, entry_dur:0.9, entry_cycles:2, bob_px:3, rise_px:60,
  entry_scale:1.25, entry_scale_dur:0.24, zoom_amp:0.05, zoom_period:4.0}` (slam-in from 1.25x + slow group zoom in/out; items at t=0 start settled)
  or `false`. **Wiggle / Pendulum style, no left-right movement**: every line zooms in and swings like a pendulum
  (alternating direction, damped so it settles in ~0.9 s), cards also rise in, and the whole scene keeps a gentle in-phase
  pendulum rock. Per line, `"motion": "none"` skips the entry wobble. `sway_px` (horizontal sway) stays 0 unless the user asks.
  A `card` SFX key (pop) plays on every card; falls back to `icon`.
- `canvas` (top level): `{ "width": 1080, "height": 1920, "ratio": "9:16" }` forces the canvas (use when an empty draft defaulted to 16:9).
- `tiles` item: `{ "type": "tiles", "cols": 2, "tile_px": 240, "gap_px": 30, "tiles": [ { "path": "assets/ui/tile_excel.png", "at": 2.0 }, { "icon": "book", "at": 2.5 } ] }`
  images side by side, each pops in (with a card SFX) on its own `at`.
- Premium UI cards: `python engine/ui_cards.py <project>/assets/ui [name ...]` renders upload / question / calendar /
  leaderboard / billing / coming-soon / comment cards and app tiles (Latin text only); use them as `image` / `tiles`.
- `kinetic.sfx`: optional per-key overrides of the brand kit SFX, e.g. `{ "row": { "path": "D:/ui sfx/Select.wav" } }` (null = mute that key).

Notes
- The builder puts boxes that overlap in time onto separate lanes (tracks) automatically. The same goes for SFX.
- Auto box SFX: cta→success, stat→counting, chip→pop, check icon→click, otherwise whoosh. Skipped if
  the user already has an SFX within 0.3 s.
- Caption chunks are clamped so they never overlap. Everything is clamped to the draft duration.
- Change the plan and re-run `build_edit.js` freely. It always starts from the pristine copy.
