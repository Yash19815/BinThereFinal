'use strict';

const { app } = require('electron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createWriteStream } = require('fs');

const REPO = 'Yash19815/BinThere-Dashboard';

const PENDING_FLAG = path.join(app.getPath('userData'), 'pending-installer.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

function httpsGetJSON(url) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'BinThere-Updater',
        'Accept': 'application/vnd.github+json',
      },
    };
    https.get(url, opts, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(httpsGetJSON(res.headers.location));
      }
      let data = '';
      res.on('data', d => (data += d));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`JSON parse error for ${url}`)); }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const follow = (u) => {
      https.get(u, { headers: { 'User-Agent': 'BinThere-Updater' } }, res => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return follow(res.headers.location);
        }
        const out = createWriteStream(destPath);
        res.pipe(out);
        out.on('finish', () => { out.close(); resolve(); });
        out.on('error', reject);
      }).on('error', reject);
    };
    follow(url);
  });
}

function semverGt(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

// ── Apply pending install on startup ─────────────────────────────────────────

function applyPendingInstall() {
  if (!fs.existsSync(PENDING_FLAG)) return;

  let pending;
  try {
    pending = JSON.parse(fs.readFileSync(PENDING_FLAG, 'utf8'));
  } catch {
    fs.rmSync(PENDING_FLAG, { force: true });
    return;
  }

  const { installerPath, version } = pending;

  if (!installerPath || !fs.existsSync(installerPath)) {
    console.log('[Updater] Pending installer not found on disk — clearing flag.');
    fs.rmSync(PENDING_FLAG, { force: true });
    return;
  }

  console.log(`[Updater] Applying pending update to v${version} — running installer silently…`);

  spawn(installerPath, ['/S'], {
    detached: true,
    stdio: 'ignore',
  }).unref();

  fs.rmSync(PENDING_FLAG, { force: true });
  app.quit();
}

// ── Silent background checker ─────────────────────────────────────────────────

async function silentUpdateCheck() {
  try {
    const release = await httpsGetJSON(
      `https://api.github.com/repos/${REPO}/releases/latest`
    );

    const remoteVersion = release.tag_name?.replace(/^v/, '');
    const localVersion = app.getVersion();

    if (!remoteVersion) {
      console.log('[Updater] Could not determine remote version — skipping.');
      return;
    }

    if (!semverGt(remoteVersion, localVersion)) {
      console.log(`[Updater] Up to date (${localVersion}).`);
      return;
    }

    const asset = release.assets?.find(a => a.name.endsWith('.exe'));
    if (!asset) {
      console.warn('[Updater] Newer release found but no .exe asset — skipping.');
      return;
    }

    console.log(`[Updater] v${remoteVersion} available. Downloading installer…`);

    const tmpDir = path.join(app.getPath('temp'), `binthere-update-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const installerPath = path.join(tmpDir, asset.name);

    await downloadFile(asset.browser_download_url, installerPath);

    fs.writeFileSync(
      PENDING_FLAG,
      JSON.stringify({ version: remoteVersion, installerPath }),
      'utf8'
    );

    console.log(`[Updater] Installer ready at ${installerPath}. Will apply on next restart.`);
  } catch (e) {
    console.error('[Updater] Silent check failed (non-fatal):', e.message);
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = { applyPendingInstall, silentUpdateCheck };