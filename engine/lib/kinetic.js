/**
 * kinetic.js — biiQuiz "kinetic scenes" style (from reference-editing-style.mp4).
 *
 * One SCENE per idea. Inside a scene everything stacks top-down and stays until the scene ends:
 *   [tag pill]  →  big headline lines (pop in on their word)  →  widgets (icon / input / progress / rows ...)
 * Each scene gets its own pastel mesh background tint. Every element has an auto UI SFX.
 *
 * Plan input (edit_plan.json → "kinetic"), see rules/edit-plan-schema.md:
 *   { theme, layout:{px_per_size, top_px, gap_px}, scenes:[{start,end,tint,tag,items:[...]}] }
 *
 * Usage (from build_edit.js):  const sfx = require('./lib/kinetic')(ctx)
 * Returns SFX items [{start, path, volume, max_dur}] for the normal SFX pipeline.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

module.exports = function kinetic(ctx) {
  const { B, C, plan, CW, CH, DUR, P, ROOT, inv, report, ANIM, lanes } = ctx;
  const K = plan.kinetic;
  const kit = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand', (K.brand_kit || 'biiquiz') + '.json'), 'utf8'));
  if (K.sfx) for (const [k2, v] of Object.entries(K.sfx)) kit.sfx[k2] = v === null ? undefined : { ...(kit.sfx[k2] || {}), ...v };   // per-plan SFX overrides
  const col = Object.assign({}, kit.colors, (plan.brand || {}));
  const theme = K.theme || kit.theme || 'light';
  const k = CW / 1080;                                  // layout is designed on a 1080-wide canvas
  const L = Object.assign({ px_per_size: 8.6, top_px: 150, gap_px: 36, side_px: 90 }, K.layout || {});
  // Safe zone (fractions of the canvas) that stays clear of TikTok/Reels UI: top bar, right-side buttons,
  // caption area at the bottom. Each scene's stack is centred vertically inside it (v_bias 0.5 = middle).
  const SAFE = Object.assign({ top: 0.135, bottom: 0.85, left: 0.075, right: 0.89, v_bias: 0.42 }, L.safe || {});
  const safeTop = SAFE.top * CH, safeBot = SAFE.bottom * CH;
  const safeCx = ((SAFE.left + SAFE.right) / 2 - 0.5) * CW;          // px offset of the safe-zone centre
  const safeW = (SAFE.right - SAFE.left) * CW;
  const lineMaxW = Math.min(0.92, (safeW - 40) / CW);
  // Motion: Wiggle / Pendulum (Swing). No left-right movement. Every element enters with a damped
  // pendulum swing (rotation that settles), cards also rise in, and while on screen everything keeps a
  // gentle in-phase pendulum rock + a tiny vertical bob. motion:false turns it all off.
  const MO = K.motion === false ? null : Object.assign({
    swing_deg: 2.2,        // idle pendulum amplitude (degrees)
    swing_period: 2.6,     // idle pendulum period (s)
    entry_deg: 7,          // first swing on entry (degrees), decays to the idle swing
    entry_dur: 0.9,        // how long the entry wobble takes to settle (s)
    entry_cycles: 2.0,     // back-and-forth swings during the entry
    bob_px: 3, rise_px: 60,
    sway_px: 0,            // legacy horizontal sway: OFF (user wants no left-right movement)
    // reference-style "slam" entry: each element lands from oversized (1.25x) to 1.0 with a tiny overshoot
    entry_scale: 1.25, entry_scale_dur: 0.24,
    // slow group zoom in -> out ("breathing"): the whole scene stack scales about its centre together
    zoom_amp: 0.05, zoom_period: 4.0,
  }, K.motion || {});
  const PY = path.join(ROOT, 'engine', 'render_graphics.py');
  const outDir = P('assets/kinetic');
  fs.mkdirSync(outDir, { recursive: true });

  const color = c => !c ? null : c.startsWith('#') ? c : (col[c] || kit.colors[c] || c);
  const INK = theme === 'dark' ? '#FFFFFF' : col.ink;
  const fontObj = p => {
    if (!p || !fs.existsSync(p)) return null;
    const m = p.match(/effect\/(\d+)\//);
    return { path: p.replace(/\\/g, '/'), id: m ? m[1] : '' };
  };
  const fDeva = fontObj(kit.fonts.devanagari) || C.pickNepaliFont();
  const fLatin = fontObj(kit.fonts.latin_heavy);
  const fMono = fontObj(kit.fonts.mono);
  const ascii = s => /^[\x00-\x7F]*$/.test(s);
  if (!fLatin) report.warnings.push('kinetic: latin_heavy font missing, English words use the Devanagari font');

  /* ---------- rendering (cached by params) ---------- */
  function render(args, prefix) {
    const h = crypto.createHash('md5').update(args.join('|')).digest('hex').slice(0, 10);
    const out = path.join(outDir, `${prefix}_${h}.png`).replace(/\\/g, '/');
    if (!fs.existsSync(out)) execFileSync('python', [PY, ...args, '--out', out], { stdio: 'pipe' });
    const metaP = out + '.json';
    const meta = fs.existsSync(metaP) ? JSON.parse(fs.readFileSync(metaP, 'utf8')) : null;
    return { png: out, meta };
  }
  const grad = kit.gradient || [col.electric, col.lavender];
  const widget = (kind, w, h, extra = []) => render(['widget', '--kind', kind, '--w', String(Math.round(w)), '--h', String(Math.round(h)),
    '--primary', grad[0], '--secondary', grad[1], '--accent', col.success, ...extra], `w_${kind}`);

  /* ---------- coordinate helpers ---------- */
  const yOf = py => 1 - 2 * py / CH;                    // px from top -> CapCut y
  const xOf = px => 2 * px / CW;                        // px offset from centre -> CapCut x

  const snap = t => Math.round(t * 30) / 30;           // 30 fps grid: abutting segments never overlap after rounding
  const imgItems = [], txtItems = [], sfx = [];
  let order = 0;
  const popKf = () => [C.DraftBuilder.kf('KFTypeAlpha', [[0, 0], [0.1, 1]])];   // scale lives in motionKf
  // Items keep pixel positions (cx = px from centre, py = px from top) until the scene is laid out,
  // then get shifted into the safe zone. mo = entry motion {kind: 'swing'|'card'|'none', t0, dir}.
  let curScene = null;
  function addImg(png, pngW, pngH, start, end, cx, cyPx, { pop = true, shownW = null, top = false, mo = null } = {}) {
    const sc = B.scaleForWidth(pngW, pngH, shownW || pngW * k);
    start = snap(start); end = snap(end);
    const first = start < 0.034;                       // frame 0: no entry, so the first frame / cover is clean
    if (first) { pop = false; if (mo) mo = { kind: 'none' }; }
    imgItems.push({ start, end, png, sc, cx, py: cyPx, pop, top, mo, scene: curScene, i: order++ });
  }
  function addTxt(spec, start, end, cx, cyPx, anim, animDur, mo = null) {
    start = snap(start); end = snap(end);
    if (start < 0.034) { anim = 'none'; if (mo) mo = { kind: 'none' }; }
    txtItems.push({ start, end, spec: { font: fDeva, font_latin: fLatin, bold: true, align: 1, ...spec }, cx, py: cyPx, anim, animDur, mo, scene: curScene, i: order++ });
  }

  /* ---------- motion keyframes (sampled on absolute timeline time, so a card and its text move as one) ---------- */
  const ease = u => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
  const back = u => { u = Math.min(1, Math.max(0, u)); const c = 1.6; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
  function motionAt(it, t) {           // -> {dx px, dy px (down +), rot deg, s scale multiplier}
    let dx = 0, dy = 0, rot = 0, s = 1;
    if (!MO) return { dx, dy, rot, s };
    const s0 = it.scene ? it.scene.start : 0;
    // group breathing zoom: 1 -> 1+amp -> 1, positions scale about the scene centre so the stack zooms as one
    const z = 1 + MO.zoom_amp * (1 - Math.cos(2 * Math.PI * (t - s0) / MO.zoom_period)) / 2;
    if (it.scene && it.scene._cy != null) { dy += (it.py - it.scene._cy) * (z - 1); dx += (it.cx - it.scene._cx) * (z - 1); }
    s *= z;
    const ph = 2 * Math.PI * (t - s0) / MO.swing_period;
    if (MO.sway_px) dx += MO.sway_px * Math.sin(ph);
    dy += MO.bob_px * Math.sin(ph * 0.5 + 1.1);
    rot += MO.swing_deg * Math.sin(ph);                       // idle pendulum, whole scene in phase
    const m = it.mo;
    if (m && m.kind !== 'none') {                              // entry: damped pendulum wobble
      const u = (t - m.t0) / MO.entry_dur;
      if (u >= 0 && u < 1) {
        const amp = MO.entry_deg * Math.exp(-3.2 * u) * (1 - u);
        rot += (m.dir || 1) * amp * Math.cos(2 * Math.PI * MO.entry_cycles * u);
      }
      const v = (t - m.t0) / MO.entry_scale_dur;             // slam: oversized -> 1.0 with a small overshoot
      if (v >= 0 && v < 1) s *= 1 + (MO.entry_scale - 1) * (1 - back(v));
      if (m.kind === 'card') {
        const r = (t - m.t0) / 0.34;
        if (r < 1) dy += MO.rise_px * (1 - ease(r));
      }
    }
    return { dx, dy, rot, s };
  }
  function motionKf(it) {
    if (!MO || it.static) return [];
    const d = it.end - it.start;
    const ts = new Set([0]);
    const m = it.mo;
    let idle0 = 0.4;
    if (m && m.kind !== 'none') {
      for (let o = 0; o <= MO.entry_dur + 1e-6; o += MO.entry_dur / 16) {
        const rel = m.t0 + o - it.start;
        if (rel > 0 && rel < d) ts.add(+rel.toFixed(3));
      }
      for (const o of [0.03, 0.06, 0.09, 0.12, 0.15, 0.18, 0.21, 0.24]) {
        const rel = m.t0 + o - it.start;
        if (rel > 0 && rel < d) ts.add(+rel.toFixed(3));
      }
      idle0 = Math.max(idle0, m.t0 - it.start + MO.entry_dur + 0.05);
    }
    for (let rel = idle0; rel < d; rel += MO.swing_period / 8) ts.add(+rel.toFixed(3));
    ts.add(+d.toFixed(3));
    // one keyframe per video frame (30 fps): duplicates at the same frame confuse CapCut
    const times = [...new Set([...ts].map(x => Math.min(d, Math.round(x * 30) / 30)))].sort((a, b) => a - b);
    const X = [], Y = [], R = [], S = [];
    const base = it.sc || 1;
    for (const rel of times) {
      const v = motionAt(it, it.start + rel);
      X.push([rel, xOf(it.cx + v.dx)]); Y.push([rel, yOf(it.py + v.dy)]); R.push([rel, v.rot]); S.push([rel, base * v.s]);
    }
    return [C.DraftBuilder.kf('KFTypePositionX', X), C.DraftBuilder.kf('KFTypePositionY', Y), C.DraftBuilder.kf('KFTypeRotation', R),
      C.DraftBuilder.kf('KFTypeScaleX', S), C.DraftBuilder.kf('KFTypeScaleY', S)];
  }
  const addSfx = (key, start, extra = {}) => {
    const s = kit.sfx[key] || (key === 'card' ? kit.sfx.icon : null);
    if (!s) return;
    sfx.push({ start: Math.max(0, start - 0.03), path: path.resolve(ROOT, s.path).replace(/\\/g, '/'), volume: s.volume, max_dur: 1.5, key, ...extra });
  };

  /* ---------- logo clearance ---------- */
  const logoTopClear = (a, b) => {
    let clear = 0;
    for (const lg of (inv.guesses.logo_segments || [])) {
      if (!lg.pos || lg.start > b || lg.start + lg.dur < a) continue;
      if (lg.pos[1] > 0.45) clear = Math.max(clear, (1 - lg.pos[1]) / 2 * CH + 0.07 * CH);
    }
    return clear;
  };

  /* ---------- scenes ---------- */
  const scenes = [...K.scenes].sort((a, b) => a.start - b.start);
  const tints = kit.scene_tints;
  const bgSegs = [];
  scenes.forEach((sc, si) => {
    const sEnd = Math.min(sc.end != null ? sc.end : (scenes[si + 1] ? scenes[si + 1].start : DUR), DUR);
    const accent = color(sc.accent) || col.primary;
    const tint = color(sc.tint) || tints[si % tints.length];
    bgSegs.push({ start: si === 0 ? 0 : snap(sc.start), end: scenes[si + 1] ? snap(scenes[si + 1].start) : DUR, tint });
    if (si > 0 && sc.sfx !== false) addSfx('scene', sc.start);

    curScene = sc;
    const top0 = Math.max(safeTop, logoTopClear(sc.start, sEnd));
    let cur = 0;                                   // laid out from 0, shifted into the safe zone below
    let slideDir = -1, tiltDir = -1;
    const card = at => { tiltDir = -tiltDir; return { kind: 'card', t0: at, dir: tiltDir }; };
    const T = at => Math.max(sc.start, Math.min(at != null ? at : sc.start, sEnd - 0.2));
    const pillH = 84 * k;

    if (sc.tag) {
      const at = T(sc.tag.at);
      addTxt({ text: sc.tag.text, size: sc.tag.size || 6.2, color: color(sc.tag.color) || accent,
        box: { color: '#FFFFFF', alpha: 1, radius: 0.5, width: 0.22, height: 0.32 } }, at, sEnd, 0, cur + pillH / 2, 'fade', 0.2, { kind: 'card', t0: at, dir: 1 });
      if (sc.tag.sfx !== false) addSfx('tag', at);
      cur += pillH + L.gap_px * k;
    }

    const lineY = [];
    for (const [ii, it] of (sc.items || []).entries()) {
      const at = T(it.at);
      const end = it.end != null ? Math.min(it.end, sEnd) : sEnd;
      const sfxOn = it.sfx !== false;
      switch (it.type) {
        case 'line': {
          const size = (it.size || 16);
          const step = size * L.px_per_size * k;
          const cy = cur + step / 2;
          lineY[ii] = { cy, size, text: it.text };
          // every line swings in like a pendulum (alternating direction); "motion":"none" = idle swing only
          const swing = it.motion !== 'none';
          const mo = swing ? { kind: 'swing', t0: at, dir: (slideDir = -slideDir) } : { kind: 'none' };
          addTxt({ text: it.text, size, color: color(it.color) || INK, line_max_width: lineMaxW,
            highlights: (it.highlight || []).map(h => ({ text: h, color: color(it.highlight_color) || accent })) },
            at, end, 0, cy, it.anim || 'fade', 0.12, mo);
          if (sfxOn) addSfx('line', at);
          cur += step;
          break;
        }
        case 'gap': cur += (it.px || 40) * k; break;
        case 'pill': {
          cur += 10 * k;
          addTxt({ text: it.text, size: it.size || 5.2, color: color(it.color) || accent,
            box: { color: '#FFFFFF', alpha: 1, radius: 0.5, width: 0.22, height: 0.32 } }, at, end, 0, cur + pillH / 2, 'fade', 0.12, card(at));
          if (sfxOn) addSfx('card', at);
          cur += pillH + L.gap_px * k;
          break;
        }
        case 'icon': {
          cur += 10 * k;
          const size = it.size_px || 300;
          const r = render(['icon', '--name', it.name, '--size', String(size), ...(it.color ? ['--color', it.color] : [])], `ic_${it.name}`);
          addImg(r.png, size, size, at, end, 0, cur + size * k / 2, { mo: card(at) });
          if (sfxOn) addSfx('card', at);
          cur += size * k + L.gap_px * k;
          break;
        }
        case 'image': {   // product screenshot etc.
          const src = P(it.path);
          if (!fs.existsSync(src)) { report.warnings.push(`kinetic image missing ${src}`); break; }
          const d = C.pngSize(src) || { width: 1000, height: 600 };
          const w = (it.width_px || 860) * k, h = w * d.height / d.width;
          addImg(src.replace(/\\/g, '/'), d.width, d.height, at, end, 0, cur + h / 2, { shownW: w, mo: card(at) });
          if (sfxOn) addSfx('card', at);
          cur += h + L.gap_px * k;
          break;
        }
        case 'tiles': {   // images side by side (wrapping after `cols`), each pops in on its own `at`
          const list = it.tiles || [];
          const cols = it.cols || list.length || 1;
          const tw = it.tile_px || 230, gx = it.gap_px != null ? it.gap_px : 28;
          let rowH = 0;
          const dims = list.map(tl => {
            const src = tl.icon ? render(['icon', '--name', tl.icon, '--size', String(tw)], `ic_${tl.icon}`).png : P(tl.path);
            if (!fs.existsSync(src)) { report.warnings.push(`kinetic tile missing ${src}`); return null; }
            const d = tl.icon ? { width: tw, height: tw } : (C.pngSize(src) || { width: tw, height: tw });
            const w = tl.width_px || tw, h = w * d.height / d.width;
            rowH = Math.max(rowH, h);
            return { src: src.replace(/\\/g, '/'), d, w, h };
          });
          const nRows = Math.ceil(list.length / cols);
          list.forEach((tl, n) => {
            const g = dims[n]; if (!g) return;
            const r = Math.floor(n / cols), c = n % cols;
            const inRow = Math.min(cols, list.length - r * cols);
            const cx = (c - (inRow - 1) / 2) * (tw + gx) * k;
            const cy = cur + (r * (rowH + gx) + rowH / 2) * k;
            const tat = T(tl.at != null ? tl.at : at + n * 0.3);
            addImg(g.src, g.d.width, g.d.height, tat, end, cx, cy, { shownW: g.w * k, mo: card(tat) });
            if (sfxOn && tl.sfx !== false) addSfx('card', tat);
          });
          cur += (nRows * rowH + (nRows - 1) * gx) * k + L.gap_px * k;
          break;
        }
        case 'input': {   // white box, text types itself in
          const deva = !ascii(it.text);
          const perLine = deva ? 22 : 30;
          const nLines = Math.max(1, Math.ceil(it.text.length / perLine));
          const w = it.width_px || 780, h = 70 + 46 * nLines;
          const r = widget('input', w, h);
          const cy = cur + (h / 2 + 10) * k;
          const imo = card(at);
          addImg(r.png, r.meta.png_w, r.meta.png_h, at, end, 0, cy, { mo: imo });
          if (sfxOn) addSfx('card', at);
          const typeDur = it.type_dur || Math.min(3.5, Math.max(0.6, it.text.length * 0.06));
          addTxt({ text: it.text, size: it.text_size || 6.2, color: col.ink, bold: !deva ? false : true,
            font: deva ? fDeva : (fMono || fDeva), font_latin: deva ? fLatin : null, line_max_width: (w - 80) / 1080 },
            at + 0.2, end, 0, cy, 'typewriter', typeDur, imo);
          if (sfxOn) addSfx('typing', at + 0.25, { max_dur: typeDur });
          cur += (h + 20) * k + L.gap_px * k;
          break;
        }
        case 'progress': {   // card with label, bar fills in steps
          const w = it.width_px || 620, h = 170;
          const cy = cur + (h / 2 + 10) * k;
          const fill = it.fill_dur || 1.2;
          const steps = [0.18, 0.45, 0.75, 1.0];
          const pmo = card(at);
          steps.forEach((p, n) => {
            const r = widget('progress', w, h, ['--pct', String(p)]);
            const s0 = at + fill * n / steps.length;
            const s1 = n === steps.length - 1 ? end : at + fill * (n + 1) / steps.length;
            if (s1 > s0 + 0.03) addImg(r.png, r.meta.png_w, r.meta.png_h, s0, s1, 0, cy, { pop: n === 0, mo: pmo });
            if (n === 0 && it.label) {
              const ta = r.meta.text_area;
              const ty = cy + ((ta.y0 + ta.y1) / 2 - r.meta.png_h / 2) * k;
              addTxt({ text: it.label, size: it.label_size || 5.6, color: col.ink }, at + 0.05, end, 0, ty, 'fade', 0.2, pmo);
            }
          });
          if (sfxOn) { addSfx('card', at); addSfx('progress', at + 0.15, { max_dur: fill }); }
          cur += (h + 20) * k + L.gap_px * k;
          break;
        }
        case 'rows': {   // checklist: "01  text  ✓" rows appearing one by one
          const w = it.width_px || Math.min(860, safeW - 40), h = it.row_h || 108;
          (it.rows || []).forEach((row, n) => {
            const rat = T(row.at != null ? row.at : at + n * 0.5);
            const r = widget('row', w, h);
            const cy = cur + (h / 2) * k;
            const rmo = card(rat);
            addImg(r.png, r.meta.png_w, r.meta.png_h, rat, end, 0, cy, { mo: rmo });
            const ta = r.meta.text_area;
            const tx = ((ta.x0 + ta.x1) / 2 - r.meta.png_w / 2) * k;
            const num = it.numbered === false ? '' : String(n + 1).padStart(2, '0') + '  ';
            addTxt({ text: num + row.text, size: it.text_size || 6.4, color: col.ink,
              highlights: num ? [{ start: 0, end: 2, color: accent }] : [], line_max_width: (ta.x1 - ta.x0) / 1080 },
              rat + 0.05, end, tx, cy, 'fade', 0.18, rmo);
            if (sfxOn) { addSfx('card', rat); if (n === it.rows.length - 1) addSfx('check', rat + 0.16); }
            cur += (h + 22) * k;
          });
          cur += L.gap_px * k;
          break;
        }
        case 'bars': {   // rising bar chart (4 steps)
          const w = it.width_px || 300, h = it.height_px || 220;
          const cy = cur + (h / 2 + 10) * k;
          const fill = it.fill_dur || 0.8;
          const bmo = card(at);
          for (let n = 1; n <= 4; n++) {
            const r = widget('bars', w, h, ['--count', String(n)]);
            const s0 = at + fill * (n - 1) / 4, s1 = n === 4 ? end : at + fill * n / 4;
            if (s1 > s0 + 0.03) addImg(r.png, r.meta.png_w, r.meta.png_h, s0, s1, 0, cy, { pop: n === 1, mo: bmo });
          }
          if (sfxOn) { addSfx('card', at); addSfx('bars', at + 0.15, { max_dur: fill }); }
          cur += (h + 20) * k + L.gap_px * k;
          break;
        }
        case 'dots': {   // n dots appear one by one (e.g. "6 steps")
          const n = it.count || 5, step = it.step || 0.15, dh = 44;
          const w = n * dh + (n - 1) * dh * 0.35 + 20;
          const cy = cur + (dh / 2 + 10) * k;
          for (let c = 1; c <= n; c++) {
            const r = widget('dots', w, dh, ['--count', String(c), '--pct', String(n)]);
            const s0 = at + step * (c - 1), s1 = c === n ? end : at + step * c;
            if (s1 > s0 + 0.03) addImg(r.png, r.meta.png_w, r.meta.png_h, s0, s1, 0, cy, { pop: false });
            if (sfxOn && c <= 6) addSfx('tag', s0, { volume: 0.22 });
          }
          cur += (dh + 20) * k + L.gap_px * k;
          break;
        }
        case 'strike': {   // cross out an earlier line (target = index of that item)
          const ln = lineY[it.target];
          if (!ln) { report.warnings.push(`kinetic strike: item ${it.target} is not a line`); break; }
          const w = it.width_px || Math.min(safeW - 40, ln.text.length * ln.size * (ascii(ln.text) ? 4.6 : 4.0));
          const r = widget('strike', w, 18);
          addImg(r.png, r.meta.png_w, r.meta.png_h, at, end, 0, ln.cy + 6 * k, { pop: false, top: true });
          if (sfxOn) addSfx('strike', at);
          break;
        }
        case 'cta': {   // brand pill button with white text
          const w = it.width_px || 620, h = 128;
          const cy = cur + (h / 2 + 10) * k;
          const r = widget('button', w, h);
          const cmo = card(at);
          addImg(r.png, r.meta.png_w, r.meta.png_h, at, end, 0, cy, { mo: cmo });
          addTxt({ text: it.text, size: it.size || 7.5, color: '#FFFFFF' }, at + 0.08, end, 0, cy, 'fade', 0.18, cmo);
          if (sfxOn) { addSfx('card', at); addSfx('cta', at + 0.15); }
          cur += (h + 20) * k + L.gap_px * k;
          break;
        }
        default: report.warnings.push(`kinetic: unknown item type ${it.type}`);
      }
    }
    const H = Math.max(0, cur - L.gap_px * k * 0.5);
    const room = safeBot - top0;
    const shift = top0 + Math.max(0, room - H) * SAFE.v_bias;
    for (const x of imgItems.concat(txtItems)) if (x.scene === sc) { x.py += shift; x.cx += safeCx; }
    sc._cy = shift + H / 2; sc._cx = safeCx;
    if (H > room) report.warnings.push(`kinetic scene ${si} (${sc.start}s) is ${Math.round(H)}px tall but the safe zone has ${Math.round(room)}px — split it or shrink sizes`);
  });

  /* ---------- overlays: persistent static graphics (e.g. the social bar), no scene motion ----------
     { "path": "assets/ui/social_bar.png", "y_frac": 0.70, "width_px": 820, "start": 0, "end": null } */
  curScene = null;
  for (const ov of (K.overlays || [])) {
    const src = P(ov.path);
    if (!fs.existsSync(src)) { report.warnings.push(`kinetic overlay missing ${src}`); continue; }
    const d = C.pngSize(src) || { width: 800, height: 120 };
    const w = (ov.width_px || 820) * k;
    const st = ov.start || 0, en = ov.end != null ? Math.min(ov.end, DUR) : DUR;
    addImg(src.split('\\').join('/'), d.width, d.height, st, en, (ov.x_px || 0) * k, (ov.y_frac != null ? ov.y_frac : 0.7) * CH, { shownW: w, pop: st > 0.034 });
    Object.assign(imgItems[imgItems.length - 1], { static: true, top: true });
  }

  /* ---------- backgrounds: own main track at index 0 ---------- */
  if (K.background !== false) {
    const t = B.newTrack('video', { index: 0, name: 'biiQuiz Background' });
    for (const s of bgSegs) {
      const end = Math.min(s.end, DUR);
      if (end - s.start < 0.05) continue;
      const r = render(['mesh', '--w', String(CW), '--h', String(CH), '--tint', s.tint, '--primary', col.primary,
        '--secondary', grad[1], '--theme', theme], 'bg');
      const mat = B.photoMaterial(r.png);
      B.imageSegment(t, mat, s.start, end - s.start, { scale: 1.0, keyframes: C.DraftBuilder.slowZoom(end - s.start, 1.0, 1.04), render_index: 0 });
    }
    report.added.kinetic_backgrounds = t.segments.length;
  }

  /* ---------- image lanes, then text lanes on top ---------- */
  const fadeOut = d => d > 0.6 ? [{ resource_id: ANIM.video_out.fade, type: 'out', dur: 0.15 }] : [];
  const items = imgItems.map(x => ({ ...x, end: Math.min(x.end, DUR) })).filter(x => x.end - x.start > 0.03);
  const emitImgs = (list, label) => lanes(list).forEach((li, n) => {
    const t = B.newVisualTrack('video', { name: 'biiQuiz ' + label + ' ' + (n + 1) });
    for (const it of li) {
      const mat = B.photoMaterial(it.png);
      const d = it.end - it.start;
      B.imageSegment(t, mat, it.start, d, { x: xOf(it.cx), y: yOf(it.py), scale: it.sc, render_index: 11000 + it.i,
        keyframes: [...(it.pop ? popKf() : []), ...motionKf(it)], anims: fadeOut(d) });
    }
  });
  emitImgs(items.filter(x => !x.top), 'Graphics');
  const texts = txtItems.map(x => ({ ...x, end: Math.min(x.end, DUR) })).filter(x => x.end - x.start > 0.05);
  lanes(texts).forEach((li, n) => {
    const t = B.newVisualTrack('text', { name: `biiQuiz Text ${n + 1}` });
    for (const it of li) {
      const mat = B.textMaterial(it.spec);
      const d = it.end - it.start;
      const anims = [];
      const inId = ANIM.text_in[it.anim];
      if (inId) anims.push({ resource_id: inId, type: 'in', dur: Math.min(it.animDur || 0.25, d * 0.8) });
      if (d > 0.8) anims.push({ resource_id: ANIM.text_out.fade, type: 'out', dur: 0.15 });
      B.textSegment(t, mat, it.start, d, { x: xOf(it.cx), y: yOf(it.py), render_index: 15000 + it.i, anims, keyframes: motionKf(it) });
    }
  });
  emitImgs(items.filter(x => x.top), 'Overlay');   // strike bars sit above the words they cross out
  report.added.kinetic = { scenes: scenes.length, graphics: items.length, texts: texts.length };

  /* ---------- SFX thinning: never two hits closer than 0.12 s ---------- */
  sfx.sort((a, b) => a.start - b.start);
  const kept = [];
  for (const s of sfx) {
    const prev = kept[kept.length - 1];
    if (prev && s.start - prev.start < 0.12 && s.key !== 'typing') continue;
    kept.push(s);
  }
  return kept;
};
