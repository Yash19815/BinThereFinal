const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');
const { applyPendingInstall, silentUpdateCheck } = require('./updater.cjs');

let serverProcess = null;
let mainWindow = null;

// ─── Wait for a TCP port using built-in net module ────────────────────────────
function waitForPort(port, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function tryConnect() {
      const socket = new net.Socket();
      socket.setTimeout(500);
      socket.on('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - start > timeout) {
          reject(new Error(`Port ${port} not available`));
        } else {
          setTimeout(tryConnect, 300);
        }
      });
      socket.on('timeout', () => {
        socket.destroy();
        setTimeout(tryConnect, 300);
      });
      socket.connect(port, '127.0.0.1');
    }
    tryConnect();
  });
}

// ─── Spawn the Node backend ───────────────────────────────────────────────────
function startBackend() {
  // package.json uses asarUnpack: ["server/**"] so the server is unpacked at:
  // resources/app.asar.unpacked/server/server.js  (NOT resources/server/server.js)
  const serverPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'server', 'server.js')
    : path.join(__dirname, '..', 'server', 'server.js');

  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit',
  });

  serverProcess.on('error', (err) => {
    console.error('[Main] Backend failed to start:', err);
  });
}

// ─── Create the Electron window ───────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'BinThere Fleet Dashboard',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

// Handle IPC version request
ipcMain.handle('app-version', () => app.getVersion());

app.whenReady().then(async () => {
  // 1. Check if there is an update pending from a previous session
  applyPendingInstall();

  // 2. Start backend
  startBackend();

  // 3. Wait for backend to be ready
  await waitForPort(3001).catch(() => {
    console.error('[Main] Backend did not start in time');
  });

  // 4. Show UI
  createWindow();

  // 5. Check for updates in the background
  if (app.isPackaged) {
    setTimeout(() => {
      silentUpdateCheck();
    }, 5000); // Wait 5s to avoid competing with startup
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
