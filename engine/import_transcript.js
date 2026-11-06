/**
 * import_transcript.js — get the Nepali VO words + timings WITHOUT any speech-to-text.
 *
 *   node engine/import_transcript.js <project> --srt  <file.srt>    # SRT given by the user (best)
 *   node engine/import_transcript.js <project> --text <file.txt>    # plain VO script, auto-timed to the VO audio
 *   node engine/import_transcript.js <project> --from-draft         # CapCut auto-captions already in the draft
 *   node engine/import_transcript.js <project>                      # auto: work/input.srt > work/input.txt > draft captions
 *
 * When the user pastes an SRT or script in chat, save it first to work/input.srt or work/input.txt.
 *
 * Output: work/transcript.json  {source, segments:[{start,end,text,words:[{word,start,end}]}]}   (timeline seconds)
 *         work/transcript.srt
 * Then:   node engine/make_captions.js <project>
 *
 * Timing quality: draft auto-captions = word-exact | SRT = line-exact (words spread by length)
 *                 plain text = ±0.3 s (words spread over detected speech, silences skipped)
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ffmpegPath } = require('./lib/config');
const { readDraft, resolveMediaPath } = require('./lib/capcut');

const args = process.argv.slice(2);
const proj = path.resolve(args[0] || '.');
const val = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const inv = JSON.parse(fs.readFileSync(path.join(proj, 'inventory.json'), 'utf8'));
const work = p => path.join(proj, 'work', p);
fs.mkdirSync(path.join(proj, 'work'), { recursive: true });

/* ---------- helpers ---------- */
const tc = s => { const [h, m, r] = s.trim().replace(',', '.').split(':'); return (+h) * 3600 + (+m) * 60 + parseFloat(r); };
const fmt = t => { t = Math.max(0, t); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(Math.floor(s)).padStart(2, '0')},${String(Math.round((s % 1) * 1000)).padStart(3, '0')}`; };
const r3 = x => +x.toFixed(3);

/** spread words of `text` across [start,end] proportional to their length */
function spreadWords(text, start, end) {
  const ws = text.split(/\s+/).filter(Boolean);
  const total = ws.reduce((a, w) => a + w.length + 1, 0) || 1;
  let acc = 0;
  return ws.map(w => {
    const a = start + (end - start) * acc / total; acc += w.length + 1;
    return { word: w, start: r3(a), end: r3(start + (end - start) * acc / total) };
  });
}

function parseSrt(raw) {
  const out = [];
  for (const block of raw.replace(/\r/g, '').trim().split(/\n\s*\n/)) {
    const lines = block.trim().split('\n');
    const ti = lines.findIndex(l => l.includes('-->'));
    if (ti < 0) continue;
    const [a, b] = lines[ti].split('-->');
    const text = lines.slice(ti + 1).join(' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const start = tc(a), end = tc(b.trim().split(/\s/)[0]);
    out.push({ start: r3(start), end: r3(end), text, words: spreadWords(text, start, end) });
  }
  return out;
}

/** CapCut auto-captions (materials.texts type 'subtitle', words in ms relative to segment start) */
function fromDraft() {
  const { content: d } = readDraft(path.join(proj, 'original_draft'));
  const texts = new Map((d.materials.texts || []).map(t => [t.id, t]));
  const segs = [];
  for (const tr of d.tracks.filter(t => t.type === 'text')) for (const s of tr.segments) {
    const t = texts.get(s.material_id);
    if (!t) continue;
    const isAuto = t.type === 'subtitle' || (t.words && t.words.text && t.words.text.filter(w => w.trim()).length > 0);
    if (!isAuto) continue;
    let text; try { text = JSON.parse(t.content).text; } catch { text = ''; }
    const st = s.target_timerange.start / 1e6, en = st + s.target_timerange.duration / 1e6;
    let words = [];
    if (t.words && t.words.text && t.words.text.length) {
      words = t.words.text.map((w, i) => ({ word: w, start: r3(st + t.words.start_time[i] / 1000), end: r3(st + t.words.end_time[i] / 1000) }))
        .filter(w => w.word.trim());
    }
    if (!words.length) words = spreadWords(text, st, en);
    segs.push({ start: r3(st), end: r3(en), text: text.trim(), words, material_id: t.id });
  }
  return segs.sort((a, b) => a.start - b.start);
}

/** speech intervals on the timeline via ffmpeg silencedetect over the VO segments */
function speechIntervals() {
  const ff = ffmpegPath();
  const vo = inv.guesses.voiceover_segments || [];
  if (!vo.length) throw new Error('no voiceover in inventory — fix guesses.voiceover_segments, or use --srt');
  const out = [];
  for (const v of vo) {
    const p = resolveMediaPath(v.path, inv.draft_dir);
    // silencedetect reports on stderr
    const r = spawnSync(ff, ['-hide_banner', '-nostdin', '-ss', String(v.src_start || 0), '-t', String(v.dur), '-i', p,
      '-af', 'silencedetect=noise=-35dB:d=0.22', '-f', 'null', '-'], { encoding: 'utf8' });
    const txt = r.stderr || '';
    const sil = [];
    let cur = null;
    for (const line of txt.split('\n')) {
      let m = line.match(/silence_start:\s*([\d.]+)/); if (m) cur = +m[1];
      m = line.match(/silence_end:\s*([\d.]+)/); if (m) { sil.push([cur || 0, +m[1]]); cur = null; }
    }
    if (cur != null) sil.push([cur, v.dur]);
    let t = 0;
    for (const [a, b] of sil) { if (a - t > 0.05) out.push([v.start + t, v.start + a]); t = b; }
    if (v.dur - t > 0.05) out.push([v.start + t, v.start + v.dur]);
  }
  return out;
}

/** plain script -> words mapped proportionally over speech-only time */
function fromText(raw) {
  const sentences = raw.replace(/\r/g, '').split(/\n+|(?<=[।?!.])\s+/).map(s => s.trim()).filter(Boolean);
  const speech = speechIntervals();
  const speechTotal = speech.reduce((a, [x, y]) => a + (y - x), 0);
  const allWords = sentences.flatMap((s, si) => s.split(/\s+/).filter(Boolean).map(w => ({ w, si })));
  const chars = allWords.reduce((a, x) => a + x.w.length + 1, 0);
  const mapT = frac => { // fraction of speech time -> timeline time
    let need = frac * speechTotal;
    for (const [a, b] of speech) { if (need <= b - a) return a + need; need -= b - a; }
    return speech.length ? speech[speech.length - 1][1] : 0;
  };
  let acc = 0;
  const words = allWords.map(x => { const s = mapT(acc / chars); acc += x.w.length + 1; return { ...x, start: r3(s), end: r3(mapT(acc / chars)) }; });
  return sentences.map((s, si) => {
    const ws = words.filter(w => w.si === si).map(w => ({ word: w.w, start: w.start, end: w.end }));
    return { start: ws[0].start, end: ws[ws.length - 1].end, text: s, words: ws };
  });
}

/* ---------- main ---------- */
let source, segments;
const srt = val('--srt') || (!val('--text') && !args.includes('--from-draft') && fs.existsSync(work('input.srt')) ? work('input.srt') : null);
const txt = val('--text') || (!srt && !args.includes('--from-draft') && fs.existsSync(work('input.txt')) ? work('input.txt') : null);
if (srt) { source = 'srt:' + srt; segments = parseSrt(fs.readFileSync(srt, 'utf8')); }
else if (txt) { source = 'text:' + txt; segments = fromText(fs.readFileSync(txt, 'utf8')); }
else { source = 'draft-auto-captions'; segments = fromDraft(); }

if (!segments.length) {
  console.error('[import] no transcript found. Give an SRT (--srt), the VO text (--text), or add CapCut auto-captions to the draft.');
  process.exit(1);
}
fs.writeFileSync(work('transcript.json'), JSON.stringify({ source, segments }, null, 1));
fs.writeFileSync(work('transcript.srt'), segments.map((s, i) => `${i + 1}\n${fmt(s.start)} --> ${fmt(s.end)}\n${s.text}\n`).join('\n'));
console.log(`[import] source=${source}  ${segments.length} lines, ${segments.reduce((a, s) => a + s.words.length, 0)} words -> work/transcript.json`);
segments.slice(0, 6).forEach(s => console.log(`   ${s.start.toFixed(2)}-${s.end.toFixed(2)}  ${s.text}`));
