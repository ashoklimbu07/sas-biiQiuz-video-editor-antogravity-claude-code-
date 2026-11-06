const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));

/** Find ffmpeg: config path -> PATH -> newest CapCut bundled ffmpeg.exe */
function ffmpegPath() {
  if (CONFIG.ffmpeg && CONFIG.ffmpeg !== 'auto' && fs.existsSync(CONFIG.ffmpeg)) return CONFIG.ffmpeg;
  try {
    const { execSync } = require('child_process');
    const p = execSync('where ffmpeg', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().split(/\r?\n/)[0].trim();
    if (p) return p;
  } catch {}
  const apps = CONFIG.capcut_apps_dir;
  if (fs.existsSync(apps)) {
    const vers = fs.readdirSync(apps).filter(v => fs.existsSync(path.join(apps, v, 'ffmpeg.exe')))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (vers.length) return path.join(apps, vers[vers.length - 1], 'ffmpeg.exe');
  }
  return null;
}

module.exports = { ROOT, CONFIG, ffmpegPath };
