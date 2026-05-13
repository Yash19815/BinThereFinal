import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyPendingInstall, silentUpdateCheck } from './updater.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

let win, serverProcess;

/**
 * Spawn the Express/WS server as a child process using the bundled Node runtime.
 * stdio: 'inherit' pipes server stdout/stderr directly to Electron's console.
 */
function startServer() {
  serverProcess = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], {
    cwd: path.join(ROOT, 'server'),
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'inherit',
  });
  serverProcess.on('error', err => console.error('[Server]', err));
  serverProcess.on('exit', code => console.log(`[Server] exited with code ${code}`));
}

/**
 * Create the main BrowserWindow and load the built Vite SPA.
 * A 1500ms delay gives Express time to bind port 3001 before the
 * renderer tries to make API calls on load.
 */
async function createWindow() {
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
    backgroundColor: '#0a0a0f', // match app dark background to avoid white flash
  });

  // Wait for Express to bind port before loading the file-based SPA
  await new Promise(r => setTimeout(r, 1500));

  win.loadFile(path.join(ROOT, 'client', 'dist', 'index.html'));
  win.once('ready-to-show', () => win.show());

  win.on('closed', () => { win = null; });
}

app.whenReady().then(async () => {
  // If a pending installer was downloaded in a previous session, run it and quit.
  // This is a no-op when no update is pending.
  applyPendingInstall();

  startServer();
  await createWindow();

  // Non-blocking: check GitHub Releases 10s after UI appears so startup is snappy.
  setTimeout(() => silentUpdateCheck(), 10_000);

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
