import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { SessionMonitor } from './sessionMonitor';

let mainWindow: BrowserWindow | null = null;
let sessionMonitor: SessionMonitor | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../../public/icon.png'),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Initialize session monitor
  sessionMonitor = new SessionMonitor();
  await sessionMonitor.startWatching();

  // Set up IPC handlers
  ipcMain.handle('get-sessions', () => {
    return sessionMonitor?.getSessions() || [];
  });

  ipcMain.handle('get-active-sessions', () => {
    return sessionMonitor?.getActiveSessions() || [];
  });

  ipcMain.handle('refresh-sessions', async () => {
    await sessionMonitor?.scanDirectory();
    return sessionMonitor?.getSessions() || [];
  });

  ipcMain.handle('focus-window', async (_, sessionId: string) => {
    // In Electron, we can't directly focus other application windows
    // This would require platform-specific code or AppleScript on macOS
    console.log(`Focus requested for session: ${sessionId}`);
    return true;
  });

  ipcMain.handle('get-session-details', async (_, sessionId: string) => {
    return sessionMonitor?.getSessionById(sessionId);
  });

  // Set up session update broadcasts
  sessionMonitor.on('sessions-updated', (sessions) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sessions-updated', sessions);
    }
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});