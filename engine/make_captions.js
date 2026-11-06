/**
 * make_captions.js — word-timed transcript -> short caption chunks (draft).
 *
 *   node engine/make_captions.js <project_dir> [--max-words 3] [--max-chars 22] [--min-dur 0.45]
 *
 * Reads  work/transcript.json  (from import_transcript.js)
 * Writes work/captions_draft.json  [{start,end,text,highlight:[],words:[...]}]
 *
 * Claude then PROOF-READS every chunk (Nepali spelling, brand words, English SaaS
 * terms kept in English), picks 0-1 highlight word per chunk, and copies the result
 * into work/edit_plan.json -> captions.chunks.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const proj = path.resolve(args[0] || '.');
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? parseFloat(args[i + 1]) : d; };
const MAX_WORDS = opt('--max-words', 3);
const MAX_CHARS = opt('--max-chars', 22);
const MIN_DUR = opt('--min-dur', 0.45);
const GAP_BREAK = 0.45; // pause that forces a new chunk

const tr = JSON.parse(fs.readFileSync(path.join(proj, 'work', 'transcript.json'), 'utf8'));
// keep the line index so a chunk never spans two SRT / auto-caption lines
const words = tr.segments.flatMap((s, li) => (s.words.length ? s.words : [{ word: s.text, start: s.start, end: s.end }]).map(w => ({ ...w, line: li })))
  .filter(w => w.word && w.word.trim());

const chunks = [];
let cur = [];
const flush = () => {
  if (!cur.length) return;
  chunks.push({ start: cur[0].start, end: cur[cur.length - 1].end, text: cur.map(w => w.word.trim()).join(' ').replace(/\s+([।,?!])/g, '$1'), highlight: [], words: cur });
  cur = [];
};
for (const w of words) {
  const prev = cur[cur.length - 1];
  const textLen = cur.map(x => x.word).join(' ').length + w.word.length;
  if (cur.length && (cur.length >= MAX_WORDS || textLen > MAX_CHARS || prev.line !== w.line || w.start - prev.end > GAP_BREAK)) flush();
  cur.push(w);
  if (/[।.?!,]$/.test(w.word.trim())) flush();
}
flush();

// merge orphan 1-word chunks into the previous chunk of the same line
for (let i = chunks.length - 1; i > 0; i--) {
  const c = chunks[i], p = chunks[i - 1];
  if (c.words.length === 1 && p.words[0].line === c.words[0].line && (p.text + ' ' + c.text).length <= MAX_CHARS + 8) {
    p.words.push(...c.words); p.end = c.end; p.text = (p.text + ' ' + c.text).replace(/\s+([।,?!])/g, '$1');
    chunks.splice(i, 1);
  }
}

// timing hygiene: min duration, no overlaps, tiny hold after speech
for (let i = 0; i < chunks.length; i++) {
  const c = chunks[i], n = chunks[i + 1];
  c.end = Math.max(c.end + 0.08, c.start + MIN_DUR);
  if (n && c.end > n.start - 0.02) c.end = n.start - 0.02;
  if (n && n.start - c.end < 0.25) c.end = n.start - 0.02; // close tiny gaps -> no flicker
  c.start = +c.start.toFixed(3); c.end = +c.end.toFixed(3);
}

fs.writeFileSync(path.join(proj, 'work', 'captions_draft.json'), JSON.stringify(chunks, null, 1));
console.log(`[captions] ${words.length} words -> ${chunks.length} chunks -> work/captions_draft.json`);
chunks.slice(0, 12).forEach(c => console.log(`   ${c.start.toFixed(2)}-${c.end.toFixed(2)}  ${c.text}`));
