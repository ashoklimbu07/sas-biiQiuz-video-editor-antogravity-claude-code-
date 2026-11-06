/**
 * deploy.js — write the edited timeline INTO the user's original CapCut draft,
 * so opening that same draft in CapCut shows the edit.
 *
 *   node engine/deploy.js <project_dir> [--force-running]
 *
 * Steps
 *  1. refuse if CapCut.exe is running (CapCut would overwrite our files from memory)
 *  2. copy project assets/ + audio/ into <draft>/claude_assets/ and re-point paths there
 *     (so the draft stays self-contained even if this project folder moves)
 *  3. write draft_content.json (+ .bak + template-2.tmp) in the draft root AND Timelines/<main_id>/
 *     (template.tmp / template.json are NOT touched — they are different files)
 *  4. update draft_meta_info.json duration + modified time
 * The pristine copy in <project>/original_draft is never touched -> restore.js can always undo.
 */
const fs = require('fs');
const path = require('path');
const { readDraft, isCapCutRunning } = require('./lib/capcut');

const proj = path.resolve(process.argv[2] || '.');
const inv = JSON.parse(fs.readFileSync(path.join(proj, 'inventory.json'), 'utf8'));
const draftDir = inv.draft_dir;

if (isCapCutRunning() && !process.argv.includes('--force-running')) {
  console.error('[deploy] CapCut is RUNNING. Close CapCut completely (also from the tray), then deploy again.');
  process.exit(2);
}
if (!fs.existsSync(path.join(proj, 'original_draft', 'draft_content.json'))) {
  console.error('[deploy] no original_draft backup in project — refusing to write.'); process.exit(1);
}
const { mainTimelineId, timelineDir } = readDraft(draftDir);

// 2. assets
const destAssets = path.join(draftDir, 'claude_assets');
let json = fs.readFileSync(path.join(proj, 'output', 'draft_content.json'), 'utf8');
for (const sub of ['assets', 'audio']) {
  const src = path.join(proj, sub);
  if (!fs.existsSync(src)) continue;
  fs.cpSync(src, path.join(destAssets, sub), { recursive: true });
  const from = src.replace(/\\/g, '/');
  const to = path.join(destAssets, sub).replace(/\\/g, '/');
  json = json.split(from).join(to);
}
const out = JSON.parse(json);
if (out.id !== mainTimelineId) { console.error(`[deploy] id mismatch ${out.id} vs ${mainTimelineId}`); process.exit(1); }

// 3. write
const targets = [draftDir];
if (timelineDir) targets.push(timelineDir);
for (const dir of targets) {
  for (const f of ['draft_content.json', 'draft_content.json.bak', 'template-2.tmp']) {
    if (f !== 'draft_content.json' && !fs.existsSync(path.join(dir, f))) continue;
    fs.writeFileSync(path.join(dir, f), json);
  }
}
// 4. meta
const metaPath = path.join(draftDir, 'draft_meta_info.json');
if (fs.existsSync(metaPath)) {
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    meta.tm_duration = out.duration;
    meta.tm_draft_modified = Date.now() * 1000;
    fs.writeFileSync(metaPath, JSON.stringify(meta));
  } catch (e) { console.warn('[deploy] could not update meta:', e.message); }
}
fs.writeFileSync(path.join(proj, 'output', 'DEPLOYED.txt'), `deployed ${new Date().toISOString()} -> ${draftDir}\n`);
console.log(`[deploy] OK -> ${draftDir}  (${targets.length} locations, assets in claude_assets/)`);
console.log('[deploy] Open CapCut and open the SAME draft to see the edit. Undo anytime: node engine/restore.js <project>');
