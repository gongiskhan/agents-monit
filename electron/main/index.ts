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
      preload: path.join(__dirname, 'preload.js'),
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

    // Prevent navigation to other URLs
    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('http://localhost:5173')) {
        event.preventDefault();
      }
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Initialize session monitor FIRST
  sessionMonitor = new SessionMonitor();

  // Set up IPC handlers BEFORE creating window
  ipcMain.handle('get-sessions', () => {
    const sessions = sessionMonitor?.getSessions() || [];
    console.log('get-sessions called, returning', sessions.length, 'sessions');
    return sessions;
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

  // Start watching BEFORE creating window
  await sessionMonitor.startWatching();

  // NOW create the window
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