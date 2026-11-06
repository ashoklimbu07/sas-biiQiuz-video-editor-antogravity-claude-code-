/**
 * extract_templates.js  (READ-ONLY on CapCut drafts)
 *
 * Scans every draft in the CapCut drafts root and harvests clean JSON templates
 * (materials + segments + animations + extras) that the build engine clones.
 * Also records which fonts were used for Nepali (Devanagari) text.
 *
 * Output: templates/templates.json, templates/fonts.json
 * Usage : node engine/extract_templates.js [draftsRoot]
 */
const fs = require('fs');
const path = require('path');
const { CONFIG, ROOT } = require('./lib/config');

const draftsRoot = process.argv[2] || CONFIG.capcut_drafts_root;
const DEVANAGARI = /[ऀ-ॿ]/;

const out = {
  _generated: new Date().toISOString(),
  photo_material: null, photo_segment: null,
  text_material: null, text_segment: null,
  audio_material: null, audio_segment: null,
  music_material: null,
  extras: {},          // speeds, canvases, placeholder_infos, ...
  animations: {},      // resource_id -> { anim, used_on: {video:n,text:n}, name }
};
const fonts = {};      // path -> {count, devanagari, id, name}

const EXTRA_KINDS = ['speeds', 'placeholder_infos', 'canvases', 'sound_channel_mappings',
  'material_colors', 'loudnesses', 'vocal_separations', 'beats'];

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }

const drafts = fs.readdirSync(draftsRoot, { withFileTypes: true }).filter(d => d.isDirectory());
let scanned = 0;
for (const d of drafts) {
  const j = readJson(path.join(draftsRoot, d.name, 'draft_content.json'));
  if (!j || !j.materials || !j.tracks) continue;
  scanned++;
  const m = j.materials;
  const segs = j.tracks.flatMap(t => t.segments.map(s => ({ s, t })));
  const segByMat = id => segs.find(x => x.s.material_id === id);

  if (!out.photo_material) {
    const pm = (m.videos || []).find(v => v.type === 'photo');
    const ps = pm && segByMat(pm.id);
    if (pm && ps) { out.photo_material = pm; out.photo_segment = ps.s; }
  }
  if (!out.text_material) {
    const tm = (m.texts || []).find(t => t.type === 'text' && t.content && t.content.startsWith('{'));
    const ts = tm && segByMat(tm.id);
    if (tm && ts) { out.text_material = tm; out.text_segment = ts.s; }
  }
  if (!out.audio_material) {
    const am = (m.audios || []).find(a => a.type === 'extract_music');
    const as = am && segByMat(am.id);
    if (am && as) { out.audio_material = am; out.audio_segment = as.s; }
  }
  if (!out.music_material) out.music_material = (m.audios || []).find(a => a.type === 'music') || null;
  for (const k of EXTRA_KINDS) if (!out.extras[k] && m[k] && m[k].length) out.extras[k] = m[k][0];

  // animations + which segment type uses them
  for (const ma of m.material_animations || []) {
    const user = segs.find(x => (x.s.extra_material_refs || []).includes(ma.id));
    const usedOn = user ? user.t.type : 'unknown';
    for (const a of ma.animations || []) {
      const key = a.resource_id;
      if (!out.animations[key]) out.animations[key] = { name: a.name || '', type: a.type, anim: a, used_on: {} };
      out.animations[key].used_on[usedOn] = (out.animations[key].used_on[usedOn] || 0) + 1;
    }
  }
  // fonts
  for (const t of m.texts || []) {
    let c; try { c = JSON.parse(t.content); } catch { continue; }
    for (const st of c.styles || []) {
      const fp = st.font && st.font.path;
      if (!fp) continue;
      const f = fonts[fp] || (fonts[fp] = { path: fp, id: st.font.id || '', count: 0, devanagari: 0, exists: fs.existsSync(fp) });
      f.count++;
      if (DEVANAGARI.test(c.text || '')) f.devanagari++;
    }
  }
}

for (const k of ['photo_material', 'text_material', 'audio_material']) {
  if (!out[k]) console.warn(`[extract] WARNING: no ${k} template found`);
}
// keep animations that still exist in the local effect cache
for (const [k, v] of Object.entries(out.animations)) {
  v.cached = !!(v.anim.path && fs.existsSync(v.anim.path));
}
fs.writeFileSync(path.join(ROOT, 'templates', 'templates.json'), JSON.stringify(out, null, 1));
const fontList = Object.values(fonts).sort((a, b) => b.devanagari - a.devanagari || b.count - a.count);
fs.writeFileSync(path.join(ROOT, 'templates', 'fonts.json'), JSON.stringify(fontList, null, 1));

console.log(`[extract] scanned ${scanned} drafts`);
console.log(`[extract] animations: ${Object.keys(out.animations).length}, fonts: ${fontList.length} (devanagari-used: ${fontList.filter(f => f.devanagari).length})`);
console.log('[extract] wrote templates/templates.json and templates/fonts.json');
