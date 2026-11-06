/**
 * setup_project.js — Step 1 of every edit.
 *
 *   node engine/setup_project.js "<draft name | full draft path>"
 *
 * Creates   projects/<draft>/
 *             original_draft/   full untouched copy of the CapCut draft (created ONCE, never overwritten)
 *             assets/boxes/     generated box-graphic PNGs
 *             assets/backgrounds/
 *             audio/            any downloaded / chosen BGM + SFX for this edit
 *             work/             transcript, captions, plans
 *             output/           built draft_content.json
 *             inventory.json    what is already inside the draft (VO, logo, sfx, footage, text)
 */
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./lib/config');
const { resolveDraftDir, readDraft, resolveMediaPath } = require('./lib/capcut');

const arg = process.argv[2];
if (!arg) { console.error('usage: node engine/setup_project.js "<draft name or path>"'); process.exit(1); }

const draftDir = resolveDraftDir(arg);
const draftName = path.basename(draftDir);
const safe = draftName.replace(/[^\w\-. ]+/g, '_').trim().replace(/\s+/g, '-');
const projDir = path.join(ROOT, 'projects', safe);

for (const sub of ['assets/boxes', 'assets/backgrounds', 'audio', 'work', 'output'])
  fs.mkdirSync(path.join(projDir, sub), { recursive: true });

const origCopy = path.join(projDir, 'original_draft');
if (!fs.existsSync(path.join(origCopy, 'draft_content.json'))) {
  console.log(`[setup] copying original draft -> ${origCopy}`);
  fs.cpSync(draftDir, origCopy, { recursive: true });
} else {
  console.log('[setup] original_draft copy already exists (kept pristine, not overwritten)');
}

// Always inventory the PRISTINE copy, so re-runs never see our own edits.
const { content: d, mainTimelineId } = readDraft(origCopy);
const mats = d.materials;
const allMats = {};
for (const [k, arr] of Object.entries(mats)) if (Array.isArray(arr)) for (const m of arr) if (m && m.id) allMats[m.id] = { kind: k, m };

const CW = d.canvas_config.width, CH = d.canvas_config.height;
const durSec = d.duration / 1e6;
const tracks = d.tracks.map((t, ti) => ({
  index: ti, type: t.type, name: t.name || '', segments: t.segments.map(s => {
    const mm = allMats[s.material_id] || { kind: '?', m: {} };
    const m = mm.m;
    let text = null;
    if (mm.kind === 'texts') { try { text = JSON.parse(m.content).text; } catch { text = m.content; } }
    const p = m.path ? resolveMediaPath(m.path, draftDir) : null;
    return {
      material_kind: mm.kind, material_type: m.type, name: m.name || m.material_name || '',
      path: p, path_exists: p ? fs.existsSync(p) : null,
      start: +(s.target_timerange.start / 1e6).toFixed(3), dur: +(s.target_timerange.duration / 1e6).toFixed(3),
      src_start: s.source_timerange ? +(s.source_timerange.start / 1e6).toFixed(3) : 0,
      volume: s.volume, scale: s.clip ? +s.clip.scale.x.toFixed(3) : null,
      pos: s.clip ? [+s.clip.transform.x.toFixed(3), +s.clip.transform.y.toFixed(3)] : null,
      mat_w: m.width, mat_h: m.height, text,
    };
  })
}));

// ---- heuristics (Claude double-checks these) ----
const audioSegs = tracks.filter(t => t.type === 'audio').flatMap(t => t.segments.map(s => ({ ...s, track: t.index })));
// Voice-over = the track with the most loud (>=0.5), non-library audio. CapCut library
// items ('sound' / 'music') are SFX/BGM, never VO. Names like vo/voice/eleven/record get a boost.
const isVoCandidate = s => !['sound', 'music'].includes(s.material_type) && s.volume >= 0.5;
const voScore = {};
for (const s of audioSegs) if (isVoCandidate(s)) {
  const boost = /vo\b|voice|eleven|narrat|record|speech|nepali|tts|_human/i.test(s.name + ' ' + (s.path || '')) ? 2 : 1;
  voScore[s.track] = (voScore[s.track] || 0) + s.dur * boost;
}
const voTrack = Object.entries(voScore).sort((a, b) => b[1] - a[1])[0];
const voiceover = voTrack ? audioSegs.filter(s => s.track == voTrack[0] && isVoCandidate(s)) : [];
// footage with embedded VO (video_original_sound) fallback
const videoSegs = tracks.filter(t => t.type === 'video').flatMap(t => t.segments.map(s => ({ ...s, track: t.index })));

const isLogoLike = s => /logo|brand/i.test(s.name + ' ' + (s.path || '')) || (s.scale !== null && s.scale < 0.6);
const logos = videoSegs.filter(isLogoLike);
const footage = videoSegs.filter(s => !isLogoLike(s) && s.material_type !== undefined);
const footageCover = footage.reduce((a, s) => a + s.dur, 0);

const inventory = {
  draft_name: draftName,
  draft_dir: draftDir.replace(/\\/g, '/'),
  project_dir: projDir.replace(/\\/g, '/'),
  main_timeline_id: mainTimelineId,
  canvas: { width: CW, height: CH, ratio: d.canvas_config.ratio },
  duration_sec: durSec,
  guesses: {
    voiceover_segments: voiceover.map(s => ({ path: s.path, start: s.start, dur: s.dur, src_start: s.src_start, track: s.track })),
    logo_segments: logos.map(s => ({ path: s.path, start: s.start, dur: s.dur, scale: s.scale, pos: s.pos, track: s.track })),
    existing_sfx: audioSegs.filter(s => s.dur < 6 && !voiceover.includes(s)).map(s => ({ name: s.name, start: s.start, dur: s.dur, volume: s.volume })),
    existing_bgm: audioSegs.filter(s => s.dur >= 6 && !voiceover.includes(s)).map(s => ({ name: s.name, path: s.path, start: s.start, dur: s.dur, volume: s.volume })),
    footage_coverage_ratio: +(footageCover / Math.max(durSec, 0.001)).toFixed(2),
    needs_background: footageCover / Math.max(durSec, 0.001) < 0.6,
    existing_text_segments: tracks.filter(t => t.type === 'text').reduce((a, t) => a + t.segments.length, 0),
    // CapCut auto-captions (usable as transcript: node engine/import_transcript.js <project> --from-draft)
    auto_caption_segments: (mats.texts || []).filter(t => t.type === 'subtitle' || (t.words && (t.words.text || []).some(w => w.trim()))).length,
  },
  tracks,
};
fs.writeFileSync(path.join(projDir, 'inventory.json'), JSON.stringify(inventory, null, 1));

console.log(`[setup] project: ${projDir}`);
console.log(`[setup] canvas ${CW}x${CH} (${d.canvas_config.ratio}), duration ${durSec.toFixed(2)}s, ${d.tracks.length} tracks`);
d.tracks.forEach((t, i) => console.log(`   track ${i}: ${t.type} x${t.segments.length}`));
console.log(`[setup] voiceover guess: ${voiceover.length} seg(s) ${voiceover.map(v => path.basename(v.path || '?')).join(', ')}`);
console.log(`[setup] logo guess: ${logos.length} seg(s) | existing sfx: ${inventory.guesses.existing_sfx.length} | bgm: ${inventory.guesses.existing_bgm.length}`);
console.log(`[setup] footage coverage ${inventory.guesses.footage_coverage_ratio} -> needs_background=${inventory.guesses.needs_background}`);
console.log(`[setup] CapCut auto-captions in draft: ${inventory.guesses.auto_caption_segments}`);
console.log('[setup] wrote inventory.json — READ IT and confirm the guesses before planning.');
