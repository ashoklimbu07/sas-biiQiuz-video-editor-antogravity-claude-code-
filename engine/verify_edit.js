/**
 * verify_edit.js — integrity checks on output/draft_content.json before deploying.
 *
 *   node engine/verify_edit.js <project_dir>
 *
 * Exit code 1 on any ERROR (deploy must not run). WARN lines are informational.
 */
const fs = require('fs');
const path = require('path');
const { readDraft, resolveMediaPath } = require('./lib/capcut');

const proj = path.resolve(process.argv[2] || '.');
const inv = JSON.parse(fs.readFileSync(path.join(proj, 'inventory.json'), 'utf8'));
const out = JSON.parse(fs.readFileSync(path.join(proj, 'output', 'draft_content.json'), 'utf8'));
const { content: orig, mainTimelineId } = readDraft(path.join(proj, 'original_draft'));
const errors = [], warns = [];

if (out.id !== mainTimelineId) errors.push(`draft.id ${out.id} != main_timeline_id ${mainTimelineId}`);

// unique ids + material index
const ids = new Map();
const matIds = new Set();
for (const [k, arr] of Object.entries(out.materials)) if (Array.isArray(arr)) for (const m of arr) if (m && m.id) {
  if (ids.has(m.id)) errors.push(`duplicate material id ${m.id} (${k} & ${ids.get(m.id)})`);
  ids.set(m.id, k); matIds.add(m.id);
}
let end = 0;
out.tracks.forEach((t, ti) => {
  if (ids.has(t.id)) errors.push(`track id collides ${t.id}`);
  const segs = [...t.segments].sort((a, b) => a.target_timerange.start - b.target_timerange.start);
  segs.forEach((s, si) => {
    if (!matIds.has(s.material_id)) errors.push(`track ${ti} seg ${si}: material ${s.material_id} missing`);
    for (const r of s.extra_material_refs || []) if (!matIds.has(r)) errors.push(`track ${ti} seg ${si}: extra ref ${r} missing`);
    if (!(s.target_timerange.duration > 0)) errors.push(`track ${ti} seg ${si}: non-positive duration`);
    const n = segs[si + 1];
    if (n && s.target_timerange.start + s.target_timerange.duration > n.target_timerange.start + 1000)
      errors.push(`track ${ti} (${t.type}) overlap at ${(n.target_timerange.start / 1e6).toFixed(3)}s`);
    end = Math.max(end, s.target_timerange.start + s.target_timerange.duration);
  });
});
if (end > out.duration) errors.push(`segments end ${end} beyond draft.duration ${out.duration}`);

// referenced files exist
const draftDir = inv.draft_dir;
for (const k of ['videos', 'audios']) for (const m of out.materials[k] || []) {
  if (!m.path) continue;
  const p = resolveMediaPath(m.path, draftDir);
  if (!fs.existsSync(p)) (orig.materials[k] || []).some(o => o.id === m.id) ? warns.push(`original media offline (unchanged): ${p}`) : errors.push(`new media missing: ${p}`);
}
// text JSON valid
for (const t of out.materials.texts || []) { try { JSON.parse(t.content); } catch { errors.push(`text ${t.id} has invalid content JSON`); } }

// original content preserved
const origSegs = orig.tracks.reduce((a, t) => a + t.segments.length, 0);
const keptSegIds = new Set(out.tracks.flatMap(t => t.segments.map(s => s.id)));
const lost = orig.tracks.flatMap(t => t.segments).filter(s => !keptSegIds.has(s.id));
if (lost.length) errors.push(`${lost.length}/${origSegs} ORIGINAL segments were removed — the agent must only ADD`);

console.log(`[verify] tracks ${out.tracks.length} | duration ${(out.duration / 1e6).toFixed(2)}s | original segments kept ${origSegs - lost.length}/${origSegs}`);
warns.forEach(w => console.log('  WARN ', w));
errors.forEach(e => console.log('  ERROR', e));
if (errors.length) { console.log(`[verify] FAILED (${errors.length} errors) — do NOT deploy`); process.exit(1); }
console.log('[verify] OK — safe to deploy');
