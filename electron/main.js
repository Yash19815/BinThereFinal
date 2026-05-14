import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyPendingInstall, silentUpdateCheck } from './updater.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const isDev = !app.isPackaged;

let win, serverProcess;

/**
 * Spawn the Express/WS server as a child process using the system Node binary.
 * In a packaged build, app files live inside resources/app/ so we resolve
 * the server directory relative to process.resourcesPath.
 * Only called in production — in dev the server runs via the dev script.
 */
function startServer() {
  const serverDir = isDev
    ? path.join(ROOT, 'server')
    : path.join(process.resourcesPath, 'server');
  const serverFile = path.join(serverDir, 'server.js');

  // In production, use the Electron binary itself to run the server
  // This removes dependency on system node and works with ESM.
  const nodeBin = isDev
    ? (process.platform === 'win32' ? 'node.exe' : 'node')
    : process.execPath;

  // Store DB in userData so it survives updates and is never inside a read-only install dir
  const dbPath = path.join(app.getPath('userData'), 'bins.db');

  serverProcess = spawn(nodeBin, [serverFile], {
    cwd: serverDir,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DB_PATH: dbPath,
      ELECTRON_RUN_AS_NODE: '1', // Required when using process.execPath to run a script
    },
    stdio: 'inherit',
    shell: false,
  });
  serverProcess.on('error', err => console.error('[Server] spawn error:', err));
  serverProcess.on('exit', code => console.log(`[Server] exited with code ${code}`));
}


/**
 * Create the main BrowserWindow.
 * - Dev:  loads http://localhost:5173 (Vite HMR dev server)
 * - Prod: loads client/dist/index.html (built SPA) with a 1500ms delay
 *         so Express has time to bind port 3001 before the renderer fires API calls.
 */
async function createWindow() {
  // Remove the native OS menu bar (File, Edit, etc.)
  Menu.setApplicationMenu(null);

  win = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'BinThere Dashboard',
    show: false,
    backgroundColor: '#0a0a0f',
  });

  if (isDev) {
    // Dev: connect to the running Vite dev server for HMR
    win.loadURL('http://localhost:5173');
  } else {
    // Prod: poll until Express is actually listening on port 3001 (max 15s)
    const { default: net } = await import('net');
    await new Promise((resolve) => {
      const MAX_TRIES = 150; // 150 × 100ms = 15 seconds max
      let tries = 0;
      function probe() {
        const sock = new net.Socket();
        sock.setTimeout(80);
        sock.on('connect', () => { sock.destroy(); resolve(); });
        sock.on('error', () => { sock.destroy(); if (++tries < MAX_TRIES) setTimeout(probe, 100); else resolve(); });
        sock.on('timeout', () => { sock.destroy(); if (++tries < MAX_TRIES) setTimeout(probe, 100); else resolve(); });
        sock.connect(3001, '127.0.0.1');
      }
      probe();
    });
    win.loadFile(path.join(ROOT, 'client', 'dist', 'index.html'));
  }


  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });
}

app.whenReady().then(async () => {
  // Apply any pending installer downloaded in a previous session (prod only)
  applyPendingInstall();

  // Only spawn the bundled server in a packaged production build.
  // In dev mode the server is already running externally via the dev script.
  if (!isDev) {
    startServer();
  }

  await createWindow();

  // Non-blocking: check GitHub Releases 10s after UI appears so startup is snappy.
  // Guard with isDev so we don't hit GitHub on every dev reload.
  if (!isDev) {
    setTimeout(() => silentUpdateCheck(), 10_000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

// IPC: renderer can query the running app version (used in About / header)
ipcMain.handle('app-version', () => app.getVersion());
