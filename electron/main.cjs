const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { fork } = require('child_process');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
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
  const serverPath = app.isPackaged
    ? path.join(process.resourcesPath, 'server', 'server.js')
    : path.join(__dirname, '..', 'server', 'server.js');

  const logFile = path.join(app.getPath('userData'), 'backend-crash.log');
  fs.writeFileSync(logFile, `--- NEW SESSION STARTED ---\nServer Path: ${serverPath}\n`);

  // 1. Failsafe: Check if the builder actually unpacked the file!
  if (!fs.existsSync(serverPath)) {
    fs.appendFileSync(logFile, `[CRITICAL ERROR] The server.js file does not exist at ${serverPath}.\nThis means asarUnpack failed during the build process.\n`);
    return;
  }

  // 2. Use fork instead of spawn for better Electron compatibility
  serverProcess = fork(serverPath, [], {
    cwd: path.dirname(serverPath),
    env: { 
      ...process.env, 
      PROD_DB_DIR: app.getPath('userData') 
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });

  serverProcess.stdout.on('data', (data) => fs.appendFileSync(logFile, `[STDOUT] ${data}\n`));
  serverProcess.stderr.on('data', (data) => fs.appendFileSync(logFile, `[STDERR] ${data}\n`));
  serverProcess.on('error', (err) => fs.appendFileSync(logFile, `[FORK ERROR] ${err}\n`));
  serverProcess.on('exit', (code) => fs.appendFileSync(logFile, `[EXIT] Process exited with code ${code}\n`));
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

ipcMain.handle('app-version', () => app.getVersion());

app.whenReady().then(async () => {
  applyPendingInstall();
  startBackend();

  // Wait for backend to be ready, show native error if it fails
  await waitForPort(3001).catch((err) => {
    const logPath = path.join(app.getPath('userData'), 'backend-crash.log');
    dialog.showErrorBox(
      'Backend Failed to Start', 
      `The server crashed. Please check the log file at:\n\n${logPath}`
    );
  });

  createWindow();

  if (app.isPackaged) {
    setTimeout(() => {
      silentUpdateCheck();
    }, 5000);
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