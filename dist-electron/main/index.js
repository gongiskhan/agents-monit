"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const sessionMonitor_1 = require("./sessionMonitor");
let mainWindow = null;
let sessionMonitor = null;
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
async function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(async () => {
    // Initialize session monitor
    sessionMonitor = new sessionMonitor_1.SessionMonitor();
    await sessionMonitor.startWatching();
    // Set up IPC handlers
    electron_1.ipcMain.handle('get-sessions', () => {
        return sessionMonitor?.getSessions() || [];
    });
    electron_1.ipcMain.handle('get-active-sessions', () => {
        return sessionMonitor?.getActiveSessions() || [];
    });
    electron_1.ipcMain.handle('refresh-sessions', async () => {
        await sessionMonitor?.scanDirectory();
        return sessionMonitor?.getSessions() || [];
    });
    electron_1.ipcMain.handle('focus-window', async (_, sessionId) => {
        // In Electron, we can't directly focus other application windows
        // This would require platform-specific code or AppleScript on macOS
        console.log(`Focus requested for session: ${sessionId}`);
        return true;
    });
    electron_1.ipcMain.handle('get-session-details', async (_, sessionId) => {
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
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
//# sourceMappingURL=index.js.map