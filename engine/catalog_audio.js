/**
 * catalog_audio.js  (READ-ONLY scan)
 *
 *   node engine/catalog_audio.js            -> library/audio_catalog.json
 *
 * 1. BGM: every CapCut library "music" material used in past drafts (keeps the full
 *    material JSON so it can be re-used exactly like CapCut does). Favourites flagged.
 * 2. SFX: every audio file in config.sfx_libraries with duration + auto tags.
 */
const fs = require('fs');
const path = require('path');
const { ROOT, CONFIG } = require('./lib/config');
const { mediaDurationSec } = require('./lib/capcut');

const TAGS = [
  ['whoosh', /whoosh|woosh|swoosh|swish|swipe/i], ['pop', /pop|bubble/i], ['click', /click|button|tap|select|mouse/i],
  ['notification', /notif|alert|ding|chime|bell|message|beacon/i], ['success', /success|correct|aproove|approve|confirm|prize|win|reward/i],
  ['glitch', /glitch|static|noise|malfunction/i], ['riser', /riser|rise|build|swell/i], ['impact', /impact|hit|boom|thud|slam/i],
  ['typing', /typ(e|ing)|keyboard|typewriter/i], ['counting', /count|score|points|data/i], ['shimmer', /shimmer|sparkle|glitter|magic|twinkle/i],
  ['camera', /shutter|camera/i], ['cash', /cash|coin|money|register/i], ['horror', /scream|gasp|chainsaw|monster|horror|laugh/i],
];
const tagsFor = name => TAGS.filter(([, rx]) => rx.test(name)).map(([t]) => t);

// ---- BGM from drafts ----
const music = {};
const root = CONFIG.capcut_drafts_root;
for (const d of fs.readdirSync(root)) {
  let j; try { j = JSON.parse(fs.readFileSync(path.join(root, d, 'draft_content.json'), 'utf8')); } catch { continue; }
  for (const a of j.materials.audios || []) {
    if (a.type !== 'music' || !a.path || !fs.existsSync(a.path)) continue;
    const segs = j.tracks.flatMap(t => t.segments).filter(s => s.material_id === a.id);
    const vol = segs.length ? segs.reduce((x, s) => x + (s.volume || 0), 0) / segs.length : null;
    const e = music[a.path] || (music[a.path] = {
      name: a.name, path: a.path, duration_sec: +(a.duration / 1e6).toFixed(2), category: a.category_name || '',
      favorite: false, drafts: [], avg_volume: [], material: a,
    });
    if (/favor/i.test(a.category_name || '')) e.favorite = true;
    if (!e.drafts.includes(d)) e.drafts.push(d);
    if (vol != null) e.avg_volume.push(vol);
  }
}
const bgm = Object.values(music).filter(m => m.duration_sec >= 20).map(m => ({
  ...m, avg_volume: m.avg_volume.length ? +(m.avg_volume.reduce((a, b) => a + b, 0) / m.avg_volume.length).toFixed(2) : null,
  uses: m.drafts.length,
})).sort((a, b) => (b.favorite - a.favorite) || (b.uses - a.uses));
const capcutSfx = Object.values(music).filter(m => m.duration_sec < 20).map(m => ({
  name: m.name, path: m.path, duration_sec: m.duration_sec, tags: tagsFor(m.name), uses: m.drafts.length, source: 'capcut-library',
}));

// ---- SFX libraries ----
const sfx = [];
for (const lib of CONFIG.sfx_libraries) {
  if (!fs.existsSync(lib)) continue;
  for (const f of fs.readdirSync(lib)) {
    if (!/\.(wav|mp3|m4a|aac|ogg|flac)$/i.test(f)) continue;
    const p = path.join(lib, f).replace(/\\/g, '/');
    let dur = null; try { dur = mediaDurationSec(p); } catch {}
    sfx.push({ name: f, path: p, duration_sec: dur ? +dur.toFixed(2) : null, tags: tagsFor(f), source: lib });
  }
}

const out = { _generated: new Date().toISOString(), bgm, sfx: [...sfx, ...capcutSfx] };
fs.writeFileSync(path.join(ROOT, 'library', 'audio_catalog.json'), JSON.stringify(out, null, 1));
console.log(`[catalog] BGM tracks: ${bgm.length} (favourites: ${bgm.filter(b => b.favorite).length})`);
bgm.slice(0, 8).forEach(b => console.log(`   ${b.favorite ? '★' : ' '} ${b.duration_sec}s  x${b.uses}  vol~${b.avg_volume}  ${b.name}`));
console.log(`[catalog] SFX files: ${out.sfx.length}`);
const tagCount = {}; out.sfx.forEach(s => s.tags.forEach(t => tagCount[t] = (tagCount[t] || 0) + 1));
console.log('   tags:', JSON.stringify(tagCount));
