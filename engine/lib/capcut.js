/**
 * capcut.js — CapCut desktop (9.x) draft helpers.
 *
 * Philosophy: AUGMENT, never rebuild. The user's draft already contains the
 * Nepali voiceover, brand logo and (maybe) SFX/footage. We clone it and ADD
 * new materials + tracks (background, box graphics, captions, sfx, bgm).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { ROOT, CONFIG, ffmpegPath } = require('./config');

const US = 1000000;
const FPS = 30;

const uid = () => crypto.randomUUID().toUpperCase();
/** seconds -> microseconds, snapped to 30fps frame grid */
const us = sec => Math.round(Math.round(sec * FPS) * US / FPS);
const clone = o => JSON.parse(JSON.stringify(o));

/* ------------------------------------------------------------------ */
/* Draft I/O                                                           */
/* ------------------------------------------------------------------ */

function resolveDraftDir(nameOrPath) {
  if (!nameOrPath) throw new Error('draft name or path required');
  let p = nameOrPath.replace(/\\/g, '/').replace(/\/+$/, '');
  if (p.endsWith('/draft_content.json')) p = path.dirname(p);
  if (!fs.existsSync(p)) p = path.join(CONFIG.capcut_drafts_root, nameOrPath).replace(/\\/g, '/');
  if (!fs.existsSync(path.join(p, 'draft_content.json'))) throw new Error(`Not a CapCut draft folder: ${p}`);
  return p;
}

function readDraft(draftDir) {
  const contentPath = path.join(draftDir, 'draft_content.json');
  const raw = fs.readFileSync(contentPath, 'utf8');
  let content;
  try { content = JSON.parse(raw); } catch (e) {
    throw new Error('draft_content.json is not plain JSON (CapCut may have ENCRYPTED this draft). ' +
      'Cannot edit it programmatically. Ask the user to duplicate the draft or use an older CapCut build.');
  }
  let mainTimelineId = content.id;
  const projPath = path.join(draftDir, 'Timelines', 'project.json');
  if (fs.existsSync(projPath)) {
    try { const pj = JSON.parse(fs.readFileSync(projPath, 'utf8')); if (pj.main_timeline_id) mainTimelineId = pj.main_timeline_id; } catch {}
  }
  const timelineDir = fs.existsSync(path.join(draftDir, 'Timelines', mainTimelineId))
    ? path.join(draftDir, 'Timelines', mainTimelineId) : null;
  return { content, mainTimelineId, timelineDir, draftDir };
}

/** "##_draftpath_placeholder_<id>_##/Resources/x.mp3" -> absolute path */
function resolveMediaPath(p, draftDir) {
  if (!p) return p;
  const m = p.match(/^##_draftpath_placeholder_[^#]+_##(.*)$/);
  if (m) return path.join(draftDir, m[1]).replace(/\\/g, '/');
  return p;
}

function isCapCutRunning() {
  try {
    const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq CapCut.exe', '/NH'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    return /CapCut\.exe/i.test(out);
  } catch { return false; }
}

/* ------------------------------------------------------------------ */
/* Media probing                                                       */
/* ------------------------------------------------------------------ */

function mediaDurationSec(file) {
  const ff = ffmpegPath();
  if (!ff) throw new Error('ffmpeg not found (set "ffmpeg" in config.json)');
  let txt = '';
  try { execFileSync(ff, ['-hide_banner', '-i', file], { stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { txt = (e.stderr || '').toString() + (e.stdout || '').toString(); }
  const m = txt.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  if (!m) return null;
  return (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
}

function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b[0] === 0x89 && b[1] === 0x50) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  // JPEG
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xFF) { i++; continue; }
    const marker = b[i + 1];
    const len = b.readUInt16BE(i + 2);
    if (marker >= 0xC0 && marker <= 0xC3) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Colors                                                              */
/* ------------------------------------------------------------------ */

function hexToRgb01(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
}

/* ------------------------------------------------------------------ */
/* Template loading                                                    */
/* ------------------------------------------------------------------ */

let _tpl = null;
function templates() {
  if (_tpl) return _tpl;
  const p = path.join(ROOT, 'templates', 'templates.json');
  if (!fs.existsSync(p)) throw new Error('templates/templates.json missing — run: node engine/extract_templates.js');
  _tpl = JSON.parse(fs.readFileSync(p, 'utf8'));
  return _tpl;
}

/** CapCut's own default font for the installed version (renders Devanagari). */
function capcutSystemFont() {
  const apps = CONFIG.capcut_apps_dir;
  if (!fs.existsSync(apps)) return null;
  const vers = fs.readdirSync(apps).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).reverse();
  for (const v of vers) {
    const f = path.join(apps, v, 'Resources', 'Font', 'SystemFont', 'en.ttf').replace(/\\/g, '/');
    if (fs.existsSync(f)) return f;
  }
  return null;
}

function pickNepaliFont(preferredPath) {
  const cands = [preferredPath, ...(CONFIG.nepali_font_preferred || [])].filter(Boolean);
  for (const c of cands) if (fs.existsSync(c)) {
    const m = c.match(/effect\/(\d+)\//);
    return { path: c.replace(/\\/g, '/'), id: m ? m[1] : '' };
  }
  const sys = capcutSystemFont();
  if (sys) return { path: sys, id: '' };
  return { path: CONFIG.nepali_font_fallback, id: '' };
}

/* ------------------------------------------------------------------ */
/* Builder                                                             */
/* ------------------------------------------------------------------ */

const PHOTO_EXTRAS = ['speeds', 'placeholder_infos', 'canvases', 'sound_channel_mappings', 'material_colors', 'loudnesses', 'vocal_separations'];
const AUDIO_EXTRAS = ['speeds', 'placeholder_infos', 'beats', 'sound_channel_mappings', 'vocal_separations'];

class DraftBuilder {
  constructor(draft) {
    this.d = draft;
    this.T = templates();
    this.m = draft.materials;
    for (const k of [...PHOTO_EXTRAS, ...AUDIO_EXTRAS, 'videos', 'audios', 'texts', 'material_animations', 'transitions'])
      if (!Array.isArray(this.m[k])) this.m[k] = [];
    const { width, height } = draft.canvas_config || { width: 1080, height: 1920 };
    this.CW = width; this.CH = height;
    this.added = { tracks: 0, segments: 0 };
  }

  /* ---- extras / animations ---- */
  addExtras(kinds) {
    const ids = [];
    for (const k of kinds) {
      const t = this.T.extras[k];
      if (!t) continue;
      const o = clone(t); o.id = uid();
      this.m[k].push(o); ids.push(o.id);
    }
    return ids;
  }

  /** items: [{resource_id, type:'in'|'out'|'loop', dur}] -> material_animation id */
  addAnimations(segDurUs, items) {
    const list = [];
    for (const it of items || []) {
      const t = this.T.animations[it.resource_id];
      if (!t || !t.cached) continue;
      const a = clone(t.anim);
      a.type = it.type || t.type;
      a.duration = us(it.dur != null ? it.dur : (t.anim.duration / US));
      a.start = a.type === 'out' ? Math.max(0, segDurUs - a.duration) : 0;
      if (a.type === 'loop') { a.start = 0; a.duration = segDurUs; }
      list.push(a);
    }
    if (!list.length) return null;
    const ma = { id: uid(), type: 'sticker_animation', animations: list, multi_language_current: 'none' };
    this.m.material_animations.push(ma);
    return ma.id;
  }

  /* ---- tracks ---- */
  newTrack(type, { index = null, name = '' } = {}) {
    const t = { id: uid(), type, segments: [], flag: 0, attribute: 0, name, is_default_name: !name };
    if (index === null) this.d.tracks.push(t); else this.d.tracks.splice(index, 0, t);
    this.added.tracks++;
    return t;
  }

  /** Insert before the first audio track (so visuals stay grouped). */
  newVisualTrack(type, opts = {}) {
    const firstAudio = this.d.tracks.findIndex(t => t.type === 'audio');
    return this.newTrack(type, { ...opts, index: firstAudio === -1 ? null : firstAudio });
  }

  /* ---- images (backgrounds, box PNGs) ---- */
  photoMaterial(imgPath) {
    const dims = pngSize(imgPath) || { width: this.CW, height: this.CH };
    const m = clone(this.T.photo_material);
    m.id = uid();
    m.type = 'photo';
    m.path = imgPath.replace(/\\/g, '/');
    m.material_name = path.basename(imgPath);
    m.width = dims.width; m.height = dims.height;
    m.local_material_id = '';
    m.duration = 10800000000;
    this.m.videos.push(m);
    return m;
  }

  /** scale value so an image of (w,h) shows at `targetWidthPx` on the canvas */
  scaleForWidth(w, h, targetWidthPx) {
    const fit = Math.min(this.CW / w, this.CH / h); // CapCut fits media inside canvas at scale 1
    return targetWidthPx / (w * fit);
  }

  /**
   * opts: {x,y} (-1..1 CapCut coords), scale, anims:[...], keyframes:[...], alpha
   */
  imageSegment(track, mat, startSec, durSec, opts = {}) {
    const durUs = us(durSec);
    const s = clone(this.T.photo_segment);
    s.id = uid();
    s.material_id = mat.id;
    s.source_timerange = { start: 0, duration: durUs };
    s.target_timerange = { start: us(startSec), duration: durUs };
    const sc = opts.scale != null ? opts.scale : 1.0;
    s.clip = { scale: { x: sc, y: sc }, rotation: 0, transform: { x: opts.x || 0, y: opts.y || 0 },
      flip: { vertical: false, horizontal: false }, alpha: opts.alpha != null ? opts.alpha : 1 };
    s.uniform_scale = { on: true, value: 1.0 };
    s.common_keyframes = opts.keyframes || [];
    s.render_index = opts.render_index || 0;
    s.track_render_index = 0;
    s.visible = true;
    s.volume = 1.0;
    s.enable_lut = false; s.enable_adjust = false;
    s.hdr_settings = null;
    const extras = this.addExtras(PHOTO_EXTRAS);
    const animId = this.addAnimations(durUs, opts.anims);
    if (animId) extras.splice(3, 0, animId);
    s.extra_material_refs = extras;
    track.segments.push(s);
    this.added.segments++;
    return s;
  }

  /* ---- keyframes ---- */
  static kf(propType, points) {
    return {
      id: uid(), material_id: '', property_type: propType,
      keyframe_list: points.map(([t, v]) => ({ id: uid(), curveType: 'Line', time_offset: us(t),
        left_control: { x: 0, y: 0 }, right_control: { x: 0, y: 0 }, values: [v], string_value: '', graphID: '' }))
    };
  }
  static slowZoom(durSec, from = 1.0, to = 1.06) {
    return [DraftBuilder.kf('KFTypeScaleX', [[0, from], [durSec, to]]), DraftBuilder.kf('KFTypeScaleY', [[0, from], [durSec, to]])];
  }

  /* ---- text ---- */
  /**
   * spec: {
   *   text, size, color:'#FFFFFF', font:{path,id},
   *   highlights:[{text|start,end, color, size?}],   // keyword colouring
   *   stroke:{color,width}, shadow:{color,alpha,distance,smoothing},
   *   box:{color:'#RRGGBB', alpha, radius, width, height, style},  // native rounded background box
   *   align: 0 left | 1 center | 2 right, bold
   * }
   */
  textMaterial(spec) {
    const t = clone(this.T.text_material);
    t.id = uid();
    const text = spec.text;
    const font = spec.font || pickNepaliFont();
    const size = spec.size || 12;
    const base = {
      fill: { content: { render_type: 'solid', solid: { color: hexToRgb01(spec.color || '#FFFFFF') } } },
      font: { path: font.path, id: font.id || '' },
      size,
      useLetterColor: true,
    };
    if (spec.bold) base.bold = true;
    if (spec.stroke) base.strokes = [{ content: { render_type: 'solid', solid: { color: hexToRgb01(spec.stroke.color) } }, width: spec.stroke.width || 0.06, mode: 0 }];

    // split text into ranges for highlights
    const marks = [];
    for (const h of spec.highlights || []) {
      let a = h.start, b = h.end;
      if (h.text != null) { a = text.indexOf(h.text); b = a + h.text.length; }
      if (a == null || a < 0 || b <= a) continue;
      marks.push({ a, b, h });
    }
    marks.sort((x, y) => x.a - y.a);
    const styles = [];
    let cur = 0;
    // Optional mixed-script typesetting: Latin runs (App, Mock Test, 100%) use spec.font_latin,
    // Devanagari stays on the Nepali font. Spaces/punctuation join the run before them.
    const isLatin = ch => /[A-Za-z0-9%+&@#$]/.test(ch);
    const isDeva = ch => /[ऀ-ॿ]/.test(ch);
    const scriptRuns = (a, b) => {
      if (!spec.font_latin) return [[a, b, null]];
      const runs = [];
      for (let i = a; i < b; i++) {
        const ch = text[i];
        const s = isLatin(ch) ? 'L' : isDeva(ch) ? 'D' : null;
        const last = runs[runs.length - 1];
        if (!last) runs.push([i, i + 1, s]);
        else if (s === null || last[2] === null || s === last[2]) { last[1] = i + 1; if (last[2] === null) last[2] = s; }
        else runs.push([i, i + 1, s]);
      }
      return runs;
    };
    const push = (a, b, extra) => {
      if (b <= a) return;
      for (const [ra, rb, script] of scriptRuns(a, b)) {
        const st = clone(base);
        if (extra) {
          if (extra.color) st.fill.content.solid.color = hexToRgb01(extra.color);
          if (extra.size) st.size = extra.size;
        }
        if (script === 'L') st.font = { path: spec.font_latin.path, id: spec.font_latin.id || '' };
        st.range = [ra, rb];
        styles.push(st);
      }
    };
    for (const mk of marks) { if (mk.a < cur) continue; push(cur, mk.a); push(mk.a, mk.b, mk.h); cur = mk.b; }
    push(cur, text.length);

    t.content = JSON.stringify({ text, styles });
    t.base_content = '';
    t.words = { start_time: [], end_time: [], text: [] };
    t.current_words = { start_time: [], end_time: [], text: [] };
    t.font_path = font.path; t.font_id = font.id || ''; t.font_resource_id = font.id || '';
    t.font_size = size;
    t.fonts = [];
    t.text_color = spec.color || '#FFFFFF';
    t.alignment = spec.align != null ? spec.align : 1;
    t.typesetting = 0;
    t.line_max_width = spec.line_max_width || 0.82;
    t.line_spacing = spec.line_spacing != null ? spec.line_spacing : 0.06;
    t.letter_spacing = spec.letter_spacing || 0;
    t.combo_info = { text_templates: [] };
    // CapCut feature bit-mask (fill/stroke/shadow/background...). 63 seen on boxed text in user drafts.
    if (spec.shadow || spec.box || spec.stroke) t.check_flag = 63;

    // shadow
    t.has_shadow = !!spec.shadow;
    if (spec.shadow) {
      t.shadow_color = spec.shadow.color || '#000000';
      t.shadow_alpha = spec.shadow.alpha != null ? spec.shadow.alpha : 0.7;
      t.shadow_distance = spec.shadow.distance != null ? spec.shadow.distance : 4;
      t.shadow_smoothing = spec.shadow.smoothing != null ? spec.shadow.smoothing : 0.45;
      t.shadow_angle = -45;
    }
    // stroke (material-level mirror)
    if (spec.stroke) { t.border_color = spec.stroke.color; t.border_width = spec.stroke.width || 0.06; t.border_alpha = 1; }
    else { t.border_alpha = 0; t.border_width = 0; t.border_color = ''; }
    // native rounded background box
    if (spec.box) {
      const b = spec.box;
      const rgb = hexToRgb01(b.color || '#000000');
      t.background_color = (b.color || '#000000').toUpperCase() + 'FF';
      t.background_alpha = b.alpha != null ? b.alpha : 1;
      t.background_style = b.style != null ? b.style : 3;
      t.background_round_radius = b.radius != null ? b.radius : 0.35;
      t.background_width = b.width != null ? b.width : 0.18;
      t.background_height = b.height != null ? b.height : 0.18;
      t.background_horizontal_offset = 0; t.background_vertical_offset = 0;
      t.background_fill = JSON.stringify({ render_type: 'solid', solid: { alpha: 1, color: rgb } });
    } else {
      t.background_alpha = 0; t.background_color = ''; t.background_style = 0;
    }
    this.m.texts.push(t);
    return t;
  }

  /** opts: {x,y,scale,anims,render_index} */
  textSegment(track, mat, startSec, durSec, opts = {}) {
    const durUs = us(durSec);
    const s = clone(this.T.text_segment);
    s.id = uid();
    s.material_id = mat.id;
    s.source_timerange = null;
    s.target_timerange = { start: us(startSec), duration: durUs };
    const sc = opts.scale || 1.0;
    s.clip = { scale: { x: sc, y: sc }, rotation: 0, transform: { x: opts.x || 0, y: opts.y || 0 },
      flip: { vertical: false, horizontal: false }, alpha: 1 };
    s.uniform_scale = { on: true, value: 1.0 };
    s.common_keyframes = opts.keyframes || [];
    s.render_index = opts.render_index || 14000;
    s.track_render_index = 0;
    s.visible = true;
    const animId = this.addAnimations(durUs, opts.anims);
    s.extra_material_refs = animId ? [animId] : [];
    track.segments.push(s);
    this.added.segments++;
    return s;
  }

  /* ---- audio ---- */
  /** Local file (sfx/bgm). type 'extract_music' works for any local file. */
  audioMaterial(file, durSec, name) {
    const m = clone(this.T.audio_material);
    m.id = uid();
    m.type = 'extract_music';
    m.name = name || path.basename(file);
    m.path = file.replace(/\\/g, '/');
    m.duration = us(durSec);
    m.music_id = crypto.randomUUID();
    m.local_material_id = crypto.randomUUID();
    m.wave_points = [];
    this.m.audios.push(m);
    return m;
  }

  /** Re-use a CapCut library/favourite music material harvested by catalog_audio.js */
  musicMaterialFromCatalog(entry) {
    const m = clone(entry.material);
    m.id = uid();
    this.m.audios.push(m);
    return m;
  }

  audioSegment(track, mat, startSec, durSec, volume = 1.0, opts = {}) {
    const s = clone(this.T.audio_segment);
    s.id = uid();
    s.material_id = mat.id;
    s.volume = volume;
    s.last_nonzero_volume = volume;
    s.source_timerange = { start: us(opts.srcStart || 0), duration: us(durSec) };
    s.target_timerange = { start: us(startSec), duration: us(durSec) };
    s.track_render_index = 0;
    s.common_keyframes = [];
    s.extra_material_refs = this.addExtras(AUDIO_EXTRAS);
    track.segments.push(s);
    this.added.segments++;
    return s;
  }

  finalize() {
    let end = 0;
    for (const t of this.d.tracks) for (const s of t.segments) end = Math.max(end, s.target_timerange.start + s.target_timerange.duration);
    if (end > this.d.duration) this.d.duration = end;
    return this.d;
  }
}

module.exports = {
  US, FPS, uid, us, clone,
  resolveDraftDir, readDraft, resolveMediaPath, isCapCutRunning,
  mediaDurationSec, pngSize, hexToRgb01, templates, pickNepaliFont, capcutSystemFont,
  DraftBuilder,
};
