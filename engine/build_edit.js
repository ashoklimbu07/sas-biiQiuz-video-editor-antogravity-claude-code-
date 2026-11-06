/**
 * build_edit.js — apply work/edit_plan.json to the PRISTINE draft copy.
 *
 *   node engine/build_edit.js <project_dir>
 *
 * Input : <project>/original_draft/draft_content.json   (never modified)
 *         <project>/work/edit_plan.json                  (written by Claude, schema: rules/edit-plan-schema.md)
 * Output: <project>/output/draft_content.json
 *         <project>/output/build_report.json
 *
 * Always rebuilds from the pristine copy -> re-running never stacks duplicate edits.
 * Keeps every existing track (VO, logo, user SFX, footage, user text) untouched and ADDS:
 *   [background main track] + [kinetic scenes: mesh bg + graphics + text] + [box PNG lanes] + [box text lanes] + [caption track] + [SFX lanes] + [BGM track]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT } = require('./lib/config');
const C = require('./lib/capcut');

const proj = path.resolve(process.argv[2] || '.');
const P = rel => (path.isAbsolute(rel) ? rel : path.join(proj, rel)).replace(/\\/g, '/');
const plan = JSON.parse(fs.readFileSync(path.join(proj, 'work', 'edit_plan.json'), 'utf8'));
const inv = JSON.parse(fs.readFileSync(path.join(proj, 'inventory.json'), 'utf8'));
const { content: draft, mainTimelineId } = C.readDraft(path.join(proj, 'original_draft'));
draft.id = mainTimelineId;
// optional canvas override, e.g. {"width":1080,"height":1920,"ratio":"9:16"} when an empty draft defaulted to 16:9
if (plan.canvas && plan.canvas.width && plan.canvas.height)
  draft.canvas_config = Object.assign({}, draft.canvas_config, { ratio: plan.canvas.ratio || `${plan.canvas.width}:${plan.canvas.height}`, width: plan.canvas.width, height: plan.canvas.height });

const B = new C.DraftBuilder(draft);
const CW = B.CW, CH = B.CH;
const vertical = CH > CW;
const DUR = draft.duration / 1e6;
const brand = Object.assign({ primary: '#4F46E5', secondary: '#06B6D4', highlight: '#FACC15', dark: '#0B1020' }, plan.brand || {});
const font = C.pickNepaliFont(plan.fonts && plan.fonts.text);
const report = { project: proj, canvas: `${CW}x${CH}`, duration: DUR, font: font.path, added: {}, warnings: [] };

const ANIM = {
  text_in: { bounce: '7428456013868616965', fade: '6724916044072227332', typewriter: '7210980292243231233', zoom: '7428455170469580037', reveal: '7648938116048375061' },
  text_out: { fade: '6724919382104871427' },
  video_in: { fade: '6798320778182922760' }, video_out: { fade: '6798320902548230669' },
};
const textAnims = (inName, outName, dur) => {
  const a = [];
  if (inName && inName !== 'none') a.push({ resource_id: ANIM.text_in[inName] || ANIM.text_in.fade, type: 'in', dur: inName === 'typewriter' ? Math.min(0.4, dur * 0.3) : Math.min(0.3, dur * 0.35) });
  if (outName && outName !== 'none' && dur > 0.9) a.push({ resource_id: ANIM.text_out.fade, type: 'out', dur: 0.15 });
  return a;
};
const toX = px => (px - CW / 2) / (CW / 2);
const toY = py => (CH / 2 - py) / (CH / 2);
const fromX = x => CW / 2 + x * CW / 2;
const fromY = y => CH / 2 - y * CH / 2;
const clampEnd = e => Math.min(e, DUR);

/** greedy lane allocation so segments on one track never overlap */
function lanes(items) {
  const ls = [];
  for (const it of [...items].sort((a, b) => a.start - b.start)) {
    let l = ls.find(l => l.end <= it.start + 1e-3);
    if (!l) { l = { end: 0, items: [] }; ls.push(l); }
    l.items.push(it); l.end = it.end;
  }
  return ls.map(l => l.items);
}

/* ---------------- 1. BACKGROUND (new main track at index 0) ---------------- */
const bg = plan.background || {};
if (bg.enabled !== false && (bg.segments || bg.image)) {
  const segs = bg.segments || [{ start: 0, end: DUR, image: bg.image, motion: bg.motion || 'slow_zoom' }];
  const t = B.newTrack('video', { index: 0, name: 'AI Background' });
  const cache = {};
  for (const s of segs) {
    const img = P(s.image);
    if (!fs.existsSync(img)) { report.warnings.push(`background missing ${img}`); continue; }
    const mat = cache[img] || (cache[img] = B.photoMaterial(img));
    const dur = clampEnd(s.end) - s.start;
    const kf = s.motion === 'static' ? [] : C.DraftBuilder.slowZoom(dur, 1.0, s.zoom_to || 1.06);
    B.imageSegment(t, mat, s.start, dur, { scale: 1.0, keyframes: kf, render_index: 0 });
  }
  report.added.background_segments = t.segments.length;
}

/* ---------------- 1b. KINETIC SCENES (biiQuiz reference style) ---------------- */
let kineticSfx = [];
if (plan.kinetic && (plan.kinetic.scenes || []).length) {
  kineticSfx = require('./lib/kinetic')({ B, C, plan, CW, CH, DUR, P, ROOT, inv, report, ANIM, lanes });
}

/* ---------------- 2. BOX GRAPHICS ---------------- */
function renderBoxPng(b, i) {
  const out = P(b.png || `assets/boxes/box_${String(i + 1).padStart(2, '0')}_${b.kind}.png`);
  if (!fs.existsSync(out) || b.rerender) {
    const w = Math.round(b.width_px || (vertical ? 860 : 760));
    const h = Math.round(b.height_px || (b.subtitle ? (vertical ? 250 : 200) : (vertical ? 170 : 140)));
    execFileSync('python', [path.join(ROOT, 'engine', 'render_graphics.py'), 'box', '--kind', b.kind, '--w', String(w), '--h', String(h),
      '--primary', b.color || brand.primary, '--secondary', brand.secondary, '--icon', b.icon || 'none', '--theme', b.theme || 'dark', '--out', out], { stdio: 'pipe' });
  }
  return { png: out, meta: JSON.parse(fs.readFileSync(out + '.json', 'utf8')) };
}

const boxes = (plan.boxes || []).map((b, i) => ({ ...b, i, end: clampEnd(b.end) })).filter(b => b.end > b.start);
const boxSfx = [];
if (boxes.length) {
  const pngBoxes = boxes.filter(b => b.kind !== 'native');
  const imgLanes = lanes(pngBoxes).map((items, li) => ({ items, track: B.newVisualTrack('video', { name: `AI Box ${li + 1}` }) }));
  const txtItems = [];
  for (const L of imgLanes) for (const b of L.items) {
    const { png, meta } = renderBoxPng(b, b.i);
    const mat = B.photoMaterial(png);
    const k = (b.width_px || (meta.box.x1 - meta.box.x0)) / (meta.box.x1 - meta.box.x0);
    const shownW = meta.png_w * k;
    const scale = B.scaleForWidth(meta.png_w, meta.png_h, shownW);
    const x = b.x != null ? b.x : 0, y = b.y != null ? b.y : (vertical ? 0.32 : 0.45);
    const dur = b.end - b.start;
    B.imageSegment(L.track, mat, b.start, dur, {
      x, y, scale, render_index: 11000 + b.i,
      anims: [{ resource_id: ANIM.video_in.fade, type: 'in', dur: 0.2 }, ...(dur > 1 ? [{ resource_id: ANIM.video_out.fade, type: 'out', dur: 0.2 }] : [])],
    });
    // text placement inside text_area
    const cx = fromX(x), cy = fromY(y);
    const ta = meta.text_area;
    const tcx = cx + ((ta.x0 + ta.x1) / 2 - meta.png_w / 2) * k;
    const tcy = cy + ((ta.y0 + ta.y1) / 2 - meta.png_h / 2) * k;
    const areaW = (ta.x1 - ta.x0) * k, areaH = (ta.y1 - ta.y0) * k;
    const color = b.text_color || meta.text_color || (b.theme === 'light' ? brand.dark : '#FFFFFF');
    if (b.title) txtItems.push({ start: b.start, end: b.end, i: b.i, spec: {
      text: b.title, size: b.title_size || (vertical ? 9 : 7), color, font, bold: true, align: 1,
      highlights: (b.highlight || []).map(h => ({ text: h, color: brand.highlight })), line_max_width: areaW / CW },
      x: toX(tcx), y: toY(b.subtitle ? tcy - areaH * 0.17 : tcy), anim: b.anim_in || 'bounce' });
    if (b.subtitle) txtItems.push({ start: b.start + 0.12, end: b.end, i: b.i, spec: {
      text: b.subtitle, size: b.subtitle_size || (vertical ? 6.2 : 5), color, font, align: 1, line_max_width: areaW / CW },
      x: toX(tcx), y: toY(tcy + areaH * 0.2), anim: 'fade' });
    if (b.sfx !== false) boxSfx.push({ start: b.start, kind: b.kind, icon: b.icon, auto: true, sfx: b.sfx });
  }
  // native CapCut boxed text (fully editable box + text in one layer)
  for (const b of boxes.filter(b => b.kind === 'native')) {
    txtItems.push({ start: b.start, end: b.end, i: b.i, spec: {
      text: b.title, size: b.title_size || (vertical ? 9 : 7), color: b.text_color || '#FFFFFF', font, bold: true, align: 1,
      highlights: (b.highlight || []).map(h => ({ text: h, color: brand.highlight })),
      box: { color: b.color || brand.primary, alpha: b.alpha != null ? b.alpha : 1, radius: b.radius != null ? b.radius : 0.4, width: 0.16, height: 0.22 } },
      x: b.x || 0, y: b.y != null ? b.y : (vertical ? 0.32 : 0.45), anim: b.anim_in || 'bounce' });
    if (b.sfx !== false) boxSfx.push({ start: b.start, kind: 'native', auto: true, sfx: b.sfx });
  }
  const tl = lanes(txtItems).map((items, li) => ({ items, track: B.newVisualTrack('text', { name: `AI Box Text ${li + 1}` }) }));
  for (const L of tl) for (const it of L.items) {
    const mat = B.textMaterial(it.spec);
    B.textSegment(L.track, mat, it.start, it.end - it.start, { x: it.x, y: it.y, render_index: 15000 + it.i, anims: textAnims(it.anim, 'fade', it.end - it.start) });
  }
  report.added.boxes = boxes.length;
}

/* ---------------- 3. CAPTIONS ---------------- */
const cap = plan.captions || {};
if (cap.enabled !== false && (cap.chunks || []).length) {
  const st = Object.assign({ size: vertical ? 9.5 : 7, color: '#FFFFFF', highlight_color: brand.highlight, y: vertical ? -0.45 : -0.72,
    stroke: { color: '#000000', width: 0.06 }, shadow: true, box: null, anim_in: 'bounce', anim_out: 'none' }, cap.style || {});
  // Hide (not delete) CapCut auto-captions so the video doesn't show two caption sets.
  if (cap.hide_existing_auto_captions !== false) {
    const autoIds = new Set((draft.materials.texts || [])
      .filter(t => t.type === 'subtitle' || (t.words && (t.words.text || []).some(w => w.trim()))).map(t => t.id));
    let hidden = 0;
    for (const tr of draft.tracks) if (tr.type === 'text') for (const s of tr.segments)
      if (autoIds.has(s.material_id)) { s.visible = false; hidden++; }
    if (hidden) report.added.auto_captions_hidden = hidden;
  }
  const t = B.newVisualTrack('text', { name: 'AI Captions' });
  const chunks = [...cap.chunks].sort((a, b) => a.start - b.start);
  chunks.forEach((c, i) => {
    let end = clampEnd(c.end);
    if (chunks[i + 1] && end > chunks[i + 1].start) end = chunks[i + 1].start;
    if (end - c.start < 0.1) return;
    const mat = B.textMaterial({
      text: c.text, size: c.size || st.size, color: st.color, font, bold: true, align: 1,
      highlights: (c.highlight || []).map(h => ({ text: h, color: c.highlight_color || st.highlight_color, size: st.highlight_size })),
      stroke: st.stroke, shadow: st.shadow ? { color: '#000000', alpha: 0.6, distance: 3, smoothing: 0.5 } : null,
      box: st.box ? { color: st.box.color || brand.dark, alpha: st.box.alpha != null ? st.box.alpha : 0.8, radius: st.box.radius != null ? st.box.radius : 0.35, width: 0.12, height: 0.18 } : null,
      line_max_width: st.line_max_width || 0.8,
    });
    B.textSegment(t, mat, c.start, end - c.start, { x: c.x || 0, y: c.y != null ? c.y : st.y, render_index: 16000 + i, anims: textAnims(st.anim_in, st.anim_out, end - c.start) });
  });
  report.added.captions = t.segments.length;
}

/* ---------------- 4. SFX ---------------- */
let catalog = { sfx: [], bgm: [] };
const catPath = path.join(ROOT, 'library', 'audio_catalog.json');
if (fs.existsSync(catPath)) catalog = JSON.parse(fs.readFileSync(catPath, 'utf8'));
const sd = plan.sfx_defaults || {};
const pickSfx = (tag, rot = 0) => {
  if (sd[tag]) return { path: sd[tag], duration_sec: null };
  const c = catalog.sfx.filter(s => s.tags.includes(tag) && s.duration_sec && s.duration_sec < 4 && !s.tags.includes('horror'));
  return c.length ? c[rot % c.length] : null;
};
const autoTag = b => b.kind === 'cta' ? 'success' : b.kind === 'stat' ? 'counting' : b.kind === 'chip' ? 'pop' : (b.icon === 'check' ? 'click' : 'whoosh');
const existingSfxStarts = (inv.guesses.existing_sfx || []).map(s => s.start);
const sfxItems = [];
boxSfx.forEach((b, i) => {
  if (existingSfxStarts.some(t => Math.abs(t - b.start) < 0.3)) return; // user already placed a sound here
  const s = typeof b.sfx === 'string' ? { path: P(b.sfx) } : pickSfx(autoTag(b), i);
  if (s) sfxItems.push({ start: Math.max(0, b.start - 0.05), path: s.path, volume: 0.45, dur: s.duration_sec });
});
for (const s of kineticSfx) if (!existingSfxStarts.some(t => Math.abs(t - s.start) < 0.3)) sfxItems.push(s);
for (const s of plan.sfx || []) sfxItems.push({ ...s, path: P(s.path) });
const sfxOk = [];
for (const s of sfxItems) {
  if (!fs.existsSync(s.path)) { report.warnings.push(`sfx missing ${s.path}`); continue; }
  let d = s.dur || C.mediaDurationSec(s.path) || 1.0;
  d = Math.min(d, s.max_dur || 3.0, DUR - s.start);
  if (d > 0.05) sfxOk.push({ ...s, end: s.start + d, dur: d });
}
/* SFX variety (user rule 2026-11-05): no file more than `max_uses` times in the video, never the same file
   more than `max_run` times in a row (we avoid any back-to-back repeat when the pool allows), rotating through
   the pools in brand kit `sfx_pools` (or plan.sfx_variety.pools). Loudness is matched per file. */
const kitPools = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'brand', ((plan.kinetic && plan.kinetic.brand_kit) || 'biiquiz') + '.json'), 'utf8')).sfx_pools; } catch (e) { return null; } })();
const SV = plan.sfx_variety === false ? null : Object.assign({ max_uses: 5, max_run: 3, ref_db: -24 }, kitPools || {}, plan.sfx_variety || {});
if (SV && SV.pools) {
  const { spawnSync } = require('child_process');
  const ff = require('./lib/config').ffmpegPath();
  const loudCache = path.join(ROOT, 'library', 'sfx_loudness.json');
  const loud = fs.existsSync(loudCache) ? JSON.parse(fs.readFileSync(loudCache, 'utf8')) : {};
  const meanDb = (p, win) => {
    const key = p + '|' + win.toFixed(2);
    if (loud[key] == null) {
      const r = spawnSync(ff, ['-hide_banner', '-i', p, '-t', String(win), '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
      const m = /mean_volume: (-?[\d.]+)/.exec(r.stderr || ''); loud[key] = m ? +m[1] : SV.ref_db;
    }
    return loud[key];
  };
  const keyPool = SV.key_pool || {};
  const uses = {}, ptr = {};
  const recent = [];                         // last files, in time order
  const out = [];
  for (const s of [...sfxOk].sort((a, b) => a.start - b.start)) {
    const pname = s.pool || keyPool[s.key];
    const pool = pname && SV.pools[pname];
    let pick = s.path;
    if (pool) {
      const files = pool.files.filter(f => fs.existsSync(f));
      const ok = f => (uses[f] || 0) < SV.max_uses && f !== recent[recent.length - 1];
      const fresh = f => !recent.slice(-3).includes(f);
      let cands = files.filter(f => ok(f) && fresh(f));
      if (!cands.length) cands = files.filter(ok);
      if (!cands.length) { report.warnings.push(`sfx variety: pool "${pname}" exhausted at ${s.start.toFixed(2)}s, hit dropped`); continue; }
      const minUse = Math.min(...cands.map(f => uses[f] || 0));
      cands = cands.filter(f => (uses[f] || 0) === minUse);
      ptr[pname] = (ptr[pname] || 0) + 1;
      pick = cands[ptr[pname] % cands.length];
      const full = C.mediaDurationSec(pick) || 1;
      const dur = Math.min(full, pool.max_dur || s.max_dur || 1.0, s.key === 'typing' || s.key === 'progress' || s.key === 'bars' ? (s.max_dur || 1.5) : 9, DUR - s.start);
      const gain = Math.min(2.0, Math.max(0.5, Math.pow(10, (SV.ref_db - meanDb(pick, Math.min(dur, 1.0))) / 20)));
      Object.assign(s, { path: pick, dur, end: s.start + dur, volume: Math.min(0.6, +((pool.volume || s.volume || 0.4) * gain).toFixed(3)) });
    } else {
      // fixed (hand-placed) sound: allowed, but it still counts and must not break the run / max rules
      const run = recent.slice(-SV.max_run).every(f => f === pick) && recent.length >= SV.max_run;
      if ((uses[pick] || 0) >= SV.max_uses || run) { report.warnings.push(`sfx variety: fixed sfx ${path.basename(pick)} at ${s.start.toFixed(2)}s breaks the max-uses/run rule, dropped`); continue; }
    }
    uses[pick] = (uses[pick] || 0) + 1;
    recent.push(pick);
    out.push(s);
  }
  fs.writeFileSync(loudCache, JSON.stringify(loud, null, 1));
  sfxOk.length = 0; sfxOk.push(...out);
  report.sfx_usage = Object.fromEntries(Object.entries(uses).map(([k, v]) => [path.basename(k), v]).sort((a, b) => b[1] - a[1]));
}
if (sfxOk.length) {
  const matCache = {};
  lanes(sfxOk).forEach((items, li) => {
    const t = B.newTrack('audio', { name: `AI SFX ${li + 1}` });
    for (const s of items) {
      const full = C.mediaDurationSec(s.path) || s.dur;
      const m = matCache[s.path] || (matCache[s.path] = B.audioMaterial(s.path, full));
      B.audioSegment(t, m, s.start, s.dur, s.volume != null ? s.volume : 0.45);
    }
  });
  report.added.sfx = sfxOk.length;
}

/* ---------------- 5. BGM ---------------- */
const bgm = plan.bgm || {};
if (bgm.enabled) {
  let mat = null, srcDur = null;
  if (bgm.catalog_name) {
    const e = catalog.bgm.find(b => b.name === bgm.catalog_name) || catalog.bgm.find(b => b.name.includes(bgm.catalog_name));
    if (e) { mat = B.musicMaterialFromCatalog(e); srcDur = e.duration_sec; }
    else report.warnings.push(`bgm catalog entry not found: ${bgm.catalog_name}`);
  } else if (bgm.path && fs.existsSync(P(bgm.path))) {
    srcDur = C.mediaDurationSec(P(bgm.path));
    mat = B.audioMaterial(P(bgm.path), srcDur);
  }
  if (mat && srcDur) {
    const t = B.newTrack('audio', { name: 'AI BGM' });
    const start = bgm.start || 0, end = clampEnd(bgm.end || DUR);
    let cur = start, srcStart = bgm.src_start || 0;
    while (cur < end - 0.05) {
      const d = Math.min(srcDur - srcStart, end - cur);
      B.audioSegment(t, mat, cur, d, bgm.volume != null ? bgm.volume : 0.16, { srcStart });
      cur += d; srcStart = 0;
    }
    report.added.bgm_segments = t.segments.length;
  }
}

B.finalize();
fs.mkdirSync(path.join(proj, 'output'), { recursive: true });
fs.writeFileSync(path.join(proj, 'output', 'draft_content.json'), JSON.stringify(draft));
report.tracks = draft.tracks.map((t, i) => `${i}:${t.type}${t.name ? '(' + t.name + ')' : ''} x${t.segments.length}`);
fs.writeFileSync(path.join(proj, 'output', 'build_report.json'), JSON.stringify(report, null, 1));
console.log('[build] added', JSON.stringify(report.added));
console.log('[build] tracks:\n   ' + report.tracks.join('\n   '));
if (report.warnings.length) console.log('[build] WARNINGS:\n   ' + report.warnings.join('\n   '));
console.log('[build] -> output/draft_content.json   (next: node engine/verify_edit.js, then deploy)');
