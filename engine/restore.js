/**
 * restore.js — put the user's draft back exactly as it was before the agent edited it.
 *
 *   node engine/restore.js <project_dir>
 */
const fs = require('fs');
const path = require('path');
const { readDraft, isCapCutRunning } = require('./lib/capcut');

const proj = path.resolve(process.argv[2] || '.');
const inv = JSON.parse(fs.readFileSync(path.join(proj, 'inventory.json'), 'utf8'));
const orig = path.join(proj, 'original_draft');
const draftDir = inv.draft_dir;
if (isCapCutRunning()) { console.error('[restore] close CapCut first.'); process.exit(2); }

const { mainTimelineId } = readDraft(orig);
const rel = ['draft_content.json', 'draft_content.json.bak', 'template-2.tmp', 'draft_meta_info.json',
  ...['draft_content.json', 'draft_content.json.bak', 'template-2.tmp'].map(f => path.join('Timelines', mainTimelineId, f))];
let n = 0;
for (const r of rel) {
  const src = path.join(orig, r);
  if (fs.existsSync(src)) { fs.mkdirSync(path.dirname(path.join(draftDir, r)), { recursive: true }); fs.copyFileSync(src, path.join(draftDir, r)); n++; }
}
console.log(`[restore] restored ${n} files into ${draftDir} (claude_assets/ left in place, harmless)`);
