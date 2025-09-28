"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const chokidar = require("chokidar");
const events = require("events");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
const os__namespace = /* @__PURE__ */ _interopNamespaceDefault(os);
const chokidar__namespace = /* @__PURE__ */ _interopNamespaceDefault(chokidar);
var SessionStatus = /* @__PURE__ */ ((SessionStatus2) => {
  SessionStatus2["Active"] = "active";
  SessionStatus2["Stopped"] = "stopped";
  return SessionStatus2;
})(SessionStatus || {});
var MessageType = /* @__PURE__ */ ((MessageType2) => {
  MessageType2["User"] = "user";
  MessageType2["Assistant"] = "assistant";
  MessageType2["System"] = "system";
  return MessageType2;
})(MessageType || {});
class SessionMonitor extends events.EventEmitter {
  constructor() {
    super();
    __publicField(this, "sessions", /* @__PURE__ */ new Map());
    __publicField(this, "watcher", null);
    __publicField(this, "sessionsDir");
    this.sessionsDir = path__namespace.join(os__namespace.homedir(), ".claude", "active_sessions");
  }
  async startWatching() {
    console.log("Starting session monitor...");
    console.log("Watching sessions directory:", this.sessionsDir);
    if (!fs__namespace.existsSync(this.sessionsDir)) {
      fs__namespace.mkdirSync(this.sessionsDir, { recursive: true });
    }
    await this.scanDirectory();
    this.watcher = chokidar__namespace.watch(path__namespace.join(this.sessionsDir, "*.json"), {
      persistent: true,
      ignoreInitial: true
    });
    this.watcher.on("add", (filePath) => this.handleFileChange(filePath)).on("change", (filePath) => this.handleFileChange(filePath)).on("unlink", (filePath) => this.handleFileRemoved(filePath)).on("error", (error) => console.error("Watcher error:", error));
    setInterval(() => this.updateSessionStatuses(), 1e3);
    setInterval(() => this.cleanupOldSessions(), 6e4);
  }
  async scanDirectory() {
    try {
      if (!fs__namespace.existsSync(this.sessionsDir)) {
        console.log("Sessions directory does not exist:", this.sessionsDir);
        return;
      }
      const files = fs__namespace.readdirSync(this.sessionsDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));
      console.log(`Found ${jsonFiles.length} session files`);
      for (const file of jsonFiles) {
        const filePath = path__namespace.join(this.sessionsDir, file);
        await this.processSessionFile(filePath);
      }
      this.emit("sessions-updated", this.getSessions());
    } catch (error) {
      console.error("Error scanning directory:", error);
    }
  }
  async handleFileChange(filePath) {
    console.log("Session file changed:", path__namespace.basename(filePath));
    await this.processSessionFile(filePath);
    this.emit("sessions-updated", this.getSessions());
  }
  handleFileRemoved(filePath) {
    const sessionId = path__namespace.basename(filePath, ".json");
    console.log("Session file removed:", sessionId);
    this.sessions.delete(sessionId);
    this.emit("sessions-updated", this.getSessions());
  }
  async processSessionFile(filePath) {
    var _a, _b;
    try {
      const sessionId = path__namespace.basename(filePath, ".json");
      const fileContent = fs__namespace.readFileSync(filePath, "utf-8");
      const hookSession = JSON.parse(fileContent);
      const lastActivity = new Date(hookSession.last_activity);
      let latestMessage = void 0;
      if (hookSession.final_response) {
        latestMessage = {
          type: MessageType.Assistant,
          content: hookSession.final_response.substring(0, 200),
          timestamp: hookSession.end_time || hookSession.last_activity
        };
      } else if (hookSession.messages && hookSession.messages.length > 0) {
        const lastMsg = hookSession.messages[hookSession.messages.length - 1];
        latestMessage = {
          type: lastMsg.role === "user" ? MessageType.User : MessageType.Assistant,
          content: lastMsg.content.substring(0, 200),
          timestamp: lastMsg.timestamp
        };
      } else if (hookSession.user_prompt) {
        latestMessage = {
          type: MessageType.User,
          content: hookSession.user_prompt.substring(0, 200),
          timestamp: hookSession.start_time
        };
      }
      let status;
      if (hookSession.status === "completed") {
        status = SessionStatus.Stopped;
      } else if (hookSession.status === "idle") {
        status = SessionStatus.Stopped;
      } else {
        const secondsSinceActivity = (Date.now() - lastActivity.getTime()) / 1e3;
        status = secondsSinceActivity < 30 ? SessionStatus.Active : SessionStatus.Stopped;
      }
      const session = {
        id: sessionId,
        projectPath: hookSession.project_path || "",
        projectName: hookSession.project_name || "Unknown Project",
        lastActivity: lastActivity.toISOString(),
        status,
        latestMessage,
        messageCount: (((_a = hookSession.messages) == null ? void 0 : _a.length) || 0) + (((_b = hookSession.tool_calls) == null ? void 0 : _b.length) || 0),
        startTime: hookSession.start_time,
        userPrompt: hookSession.user_prompt,
        toolCalls: hookSession.tool_calls,
        finalResponse: hookSession.final_response
      };
      this.sessions.set(sessionId, session);
    } catch (error) {
      console.error(`Error processing session file ${filePath}:`, error);
    }
  }
  calculateStatus(lastActivity) {
    const now = /* @__PURE__ */ new Date();
    const secondsSinceActivity = (now.getTime() - lastActivity.getTime()) / 1e3;
    return secondsSinceActivity < 30 ? SessionStatus.Active : SessionStatus.Stopped;
  }
  updateSessionStatuses() {
    let hasChanges = false;
    for (const [id, session] of this.sessions) {
      const newStatus = this.calculateStatus(new Date(session.lastActivity));
      if (session.status !== newStatus) {
        session.status = newStatus;
        hasChanges = true;
      }
    }
    if (hasChanges) {
      this.emit("sessions-updated", this.getSessions());
    }
  }
  cleanupOldSessions() {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1e3;
    for (const [id, session] of this.sessions) {
      const startTime = new Date(session.startTime).getTime();
      if (startTime < cutoffTime && session.status === SessionStatus.Stopped) {
        const filePath = path__namespace.join(this.sessionsDir, `${id}.json`);
        try {
          if (fs__namespace.existsSync(filePath)) {
            fs__namespace.unlinkSync(filePath);
            console.log(`Cleaned up old session: ${id}`);
          }
        } catch (error) {
          console.error(`Error cleaning up session ${id}:`, error);
        }
      }
    }
  }
  getSessions() {
    return Array.from(this.sessions.values()).sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
  }
  getActiveSessions() {
    return this.getSessions().filter((s) => s.status === SessionStatus.Active);
  }
  getSessionById(sessionId) {
    return this.sessions.get(sessionId);
  }
  stopWatching() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
let mainWindow = null;
let sessionMonitor = null;
const isDev = process.env.NODE_ENV === "development" || !electron.app.isPackaged;
async function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path__namespace.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path__namespace.join(__dirname, "../../public/icon.png"),
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 }
  });
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path__namespace.join(__dirname, "../../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
electron.app.whenReady().then(async () => {
  sessionMonitor = new SessionMonitor();
  await sessionMonitor.startWatching();
  electron.ipcMain.handle("get-sessions", () => {
    return (sessionMonitor == null ? void 0 : sessionMonitor.getSessions()) || [];
  });
  electron.ipcMain.handle("get-active-sessions", () => {
    return (sessionMonitor == null ? void 0 : sessionMonitor.getActiveSessions()) || [];
  });
  electron.ipcMain.handle("refresh-sessions", async () => {
    await (sessionMonitor == null ? void 0 : sessionMonitor.scanDirectory());
    return (sessionMonitor == null ? void 0 : sessionMonitor.getSessions()) || [];
  });
  electron.ipcMain.handle("focus-window", async (_, sessionId) => {
    console.log(`Focus requested for session: ${sessionId}`);
    return true;
  });
  electron.ipcMain.handle("get-session-details", async (_, sessionId) => {
    return sessionMonitor == null ? void 0 : sessionMonitor.getSessionById(sessionId);
  });
  sessionMonitor.on("sessions-updated", (sessions) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("sessions-updated", sessions);
    }
  });
  createWindow();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
