import { app } from 'electron';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createWriteStream } from 'fs';

const REPO = 'Yash19815/BinThere-Dashboard';

/** Path to the JSON flag file that records a downloaded-but-not-yet-applied installer. */
const PENDING_FLAG = path.join(app.getPath('userData'), 'pending-installer.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fetch JSON from an HTTPS URL, following a single redirect (GitHub API uses 301/302
 * for asset downloads and some API redirects).
 */
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

/**
 * Download a file from `url` to `destPath`, following redirects.
 * GitHub release asset downloads redirect to an S3 URL.
 */
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

/**
 * Returns true if semantic version string `a` is strictly greater than `b`.
 * Handles leading 'v' prefix (e.g. "v2.13.0" > "v2.12.0").
 */
function semverGt(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false; // equal
}

// ── Apply pending install on startup ─────────────────────────────────────────

/**
 * Called at the very start of app.whenReady() before createWindow().
 *
 * If a previous session downloaded an installer and wrote the pending flag,
 * this launches it silently (/S = NSIS silent flag) and quits immediately.
 * NSIS automatically uninstalls the old version before installing the new one.
 *
 * On the next cold start the fresh version runs — no pending flag exists.
 */
export function applyPendingInstall() {
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

  // /S = NSIS silent install; detached so the installer outlives this process.
  spawn(installerPath, ['/S'], {
    detached: true,
    stdio: 'ignore',
  }).unref();

  fs.rmSync(PENDING_FLAG, { force: true });

  // Quit this (old) instance — the installer will relaunch the new version.
  app.quit();
}

// ── Silent background checker ─────────────────────────────────────────────────

/**
 * Fetches the latest GitHub Release for REPO and compares its tag to the
 * running app.getVersion(). If a newer .exe asset exists:
 *   1. Downloads it to the system temp directory.
 *   2. Writes a pending-installer.json flag to userData.
 *   3. The next app restart calls applyPendingInstall() which runs it silently.
 *
 * All errors are caught and logged — this function MUST NOT crash the app.
 */
export async function silentUpdateCheck() {
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

    // Find the first .exe release asset (the NSIS installer)
    const asset = release.assets?.find(a => a.name.endsWith('.exe'));
    if (!asset) {
      console.warn('[Updater] Newer release found but no .exe asset attached — skipping.');
      return;
    }

    console.log(`[Updater] v${remoteVersion} available. Downloading installer…`);

    const tmpDir = path.join(app.getPath('temp'), `binthere-update-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const installerPath = path.join(tmpDir, asset.name);

    await downloadFile(asset.browser_download_url, installerPath);

    // Write the flag — installer will run on NEXT cold start via applyPendingInstall()
    fs.writeFileSync(
      PENDING_FLAG,
      JSON.stringify({ version: remoteVersion, installerPath }),
      'utf8'
    );

    console.log(
      `[Updater] Installer ready at ${installerPath}. Update will be applied on next restart.`
    );
  } catch (e) {
    // Non-fatal: network offline, rate-limited, etc.
    console.error('[Updater] Silent check failed (non-fatal):', e.message);
  }
}
