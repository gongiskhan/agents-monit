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
const child_process = require("child_process");
const util = require("util");
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
const execAsync = util.promisify(child_process.exec);
class ClaudeProcessMonitor extends events.EventEmitter {
  constructor() {
    super(...arguments);
    __publicField(this, "sessions", /* @__PURE__ */ new Map());
    __publicField(this, "monitorInterval", null);
  }
  async startMonitoring() {
    console.log("Starting Claude process monitoring...");
    await this.scanProcesses();
    this.monitorInterval = setInterval(async () => {
      await this.scanProcesses();
    }, 5e3);
  }
  async scanProcesses() {
    try {
      const { stdout: psOutput } = await execAsync(
        `ps aux | grep -E "[c]laude|[C]laude" | grep -v grep`
      );
      const lines = psOutput.trim().split("\n").filter((line) => line.length > 0);
      const currentPids = /* @__PURE__ */ new Set();
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length < 11) continue;
        const pid = parts[1];
        currentPids.add(pid);
        try {
          const { stdout: cwdOutput } = await execAsync(`lsof -p ${pid} 2>/dev/null | grep cwd | awk '{print $NF}'`);
          const cwd = cwdOutput.trim();
          if (cwd && cwd !== "/" && !cwd.includes("private/var")) {
            if (this.isProjectDirectory(cwd)) {
              const projectName = path__namespace.basename(cwd);
              if (this.sessions.has(pid)) {
                const session = this.sessions.get(pid);
                session.lastSeen = (/* @__PURE__ */ new Date()).toISOString();
                session.status = "active";
                console.log(`Updated active session: ${projectName} (PID: ${pid})`);
              } else {
                const session = {
                  pid,
                  projectPath: cwd,
                  projectName,
                  startTime: (/* @__PURE__ */ new Date()).toISOString(),
                  lastSeen: (/* @__PURE__ */ new Date()).toISOString(),
                  status: "active"
                };
                this.sessions.set(pid, session);
                console.log(`Found new Claude session: ${projectName} (PID: ${pid})`);
              }
            }
          }
        } catch (error) {
          continue;
        }
      }
      for (const [pid, session] of this.sessions) {
        if (!currentPids.has(pid)) {
          if (session.status === "active") {
            session.status = "stopped";
            session.lastSeen = (/* @__PURE__ */ new Date()).toISOString();
            console.log(`Claude session stopped: ${session.projectName} (PID: ${pid})`);
          }
        }
      }
      const oneHourAgo = Date.now() - 60 * 60 * 1e3;
      for (const [pid, session] of this.sessions) {
        if (session.status === "stopped") {
          const lastSeen = new Date(session.lastSeen).getTime();
          if (lastSeen < oneHourAgo) {
            this.sessions.delete(pid);
          }
        }
      }
      this.emit("sessions-updated", Array.from(this.sessions.values()));
    } catch (error) {
      console.debug("No Claude processes found or error:", error);
    }
  }
  isProjectDirectory(dirPath) {
    const indicators = [
      ".git",
      "package.json",
      "Cargo.toml",
      "pyproject.toml",
      "requirements.txt",
      "Gemfile",
      "go.mod",
      "pom.xml",
      "build.gradle",
      ".claude"
    ];
    for (const indicator of indicators) {
      if (fs__namespace.existsSync(path__namespace.join(dirPath, indicator))) {
        return true;
      }
    }
    return false;
  }
  getSessions() {
    return Array.from(this.sessions.values());
  }
  getActiveSessions() {
    return this.getSessions().filter((s) => s.status === "active");
  }
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }
}
class ClaudeHistoryMonitor extends events.EventEmitter {
  constructor() {
    super();
    __publicField(this, "historyPath");
    __publicField(this, "lastSize", 0);
    __publicField(this, "sessions", /* @__PURE__ */ new Map());
    this.historyPath = path__namespace.join(os__namespace.homedir(), ".claude", "history.jsonl");
  }
  async startMonitoring() {
    console.log("Starting Claude history monitoring...");
    if (fs__namespace.existsSync(this.historyPath)) {
      fs__namespace.watchFile(this.historyPath, { interval: 2e3 }, async () => {
        await this.processHistory();
      });
      await this.processHistory();
    }
  }
  async processHistory() {
    var _a;
    try {
      const stats = fs__namespace.statSync(this.historyPath);
      if (stats.size === this.lastSize) return;
      const content = fs__namespace.readFileSync(this.historyPath, "utf-8");
      const lines = content.trim().split("\n");
      const projectSessions = /* @__PURE__ */ new Map();
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.project) {
            const projectPath = entry.project;
            const projectName = path__namespace.basename(projectPath);
            const timestamp = entry.timestamp || Date.now();
            if (!projectSessions.has(projectPath)) {
              projectSessions.set(projectPath, {
                projectPath,
                projectName,
                firstActivity: timestamp,
                lastActivity: timestamp,
                commandCount: 0,
                commands: []
              });
            }
            const session = projectSessions.get(projectPath);
            session.lastActivity = timestamp;
            session.commandCount++;
            session.commands.push({
              display: entry.display,
              timestamp
            });
          }
        } catch (error) {
        }
      }
      const now = Date.now();
      for (const [projectPath, data] of projectSessions) {
        const timeSinceLastActivity = (now - data.lastActivity) / 1e3;
        const status = timeSinceLastActivity < 300 ? "active" : "stopped";
        this.sessions.set(projectPath, {
          id: projectPath,
          projectPath,
          projectName: data.projectName,
          startTime: new Date(data.firstActivity).toISOString(),
          lastActivity: new Date(data.lastActivity).toISOString(),
          status,
          commandCount: data.commandCount,
          latestCommand: (_a = data.commands[data.commands.length - 1]) == null ? void 0 : _a.display
        });
      }
      this.lastSize = stats.size;
      this.emit("sessions-updated", Array.from(this.sessions.values()));
    } catch (error) {
      console.error("Error processing history:", error);
    }
  }
  getSessions() {
    return Array.from(this.sessions.values()).sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
  }
  stopMonitoring() {
    fs__namespace.unwatchFile(this.historyPath);
  }
}
class SessionMonitor extends events.EventEmitter {
  constructor() {
    super();
    __publicField(this, "sessions", /* @__PURE__ */ new Map());
    __publicField(this, "watcher", null);
    __publicField(this, "sessionsDir");
    __publicField(this, "processMonitor", null);
    __publicField(this, "historyMonitor", null);
    this.sessionsDir = path__namespace.join(os__namespace.homedir(), ".claude", "active_sessions");
    this.processMonitor = new ClaudeProcessMonitor();
    this.historyMonitor = new ClaudeHistoryMonitor();
  }
  async startWatching() {
    console.log("Starting comprehensive session monitoring...");
    console.log("Watching sessions directory:", this.sessionsDir);
    if (!fs__namespace.existsSync(this.sessionsDir)) {
      fs__namespace.mkdirSync(this.sessionsDir, { recursive: true });
    }
    if (this.processMonitor) {
      await this.processMonitor.startMonitoring();
      this.processMonitor.on("sessions-updated", (processSessions) => {
        this.mergeProcessSessions(processSessions);
      });
    }
    if (this.historyMonitor) {
      await this.historyMonitor.startMonitoring();
      this.historyMonitor.on("sessions-updated", (historySessions) => {
        this.mergeHistorySessions(historySessions);
      });
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
      let finalLastActivity = lastActivity.toISOString();
      if (hookSession.status === "completed") {
        status = SessionStatus.Stopped;
      } else if (hookSession.status === "idle") {
        status = SessionStatus.Stopped;
      } else {
        const secondsSinceActivity = (Date.now() - lastActivity.getTime()) / 1e3;
        status = secondsSinceActivity < 300 ? SessionStatus.Active : SessionStatus.Stopped;
        if (status === SessionStatus.Active) {
          finalLastActivity = (/* @__PURE__ */ new Date()).toISOString();
        }
      }
      const session = {
        id: sessionId,
        projectPath: hookSession.project_path || "",
        projectName: hookSession.project_name || "Unknown Project",
        lastActivity: finalLastActivity,
        status,
        latestMessage,
        messageCount: (((_a = hookSession.messages) == null ? void 0 : _a.length) || 0) + (((_b = hookSession.tool_calls) == null ? void 0 : _b.length) || 0),
        startTime: hookSession.start_time,
        userPrompt: hookSession.user_prompt,
        toolCalls: hookSession.tool_calls,
        finalResponse: hookSession.final_response,
        source: "hook"
      };
      console.log(`Hook session ${hookSession.project_name}: status=${status}, lastActivity=${finalLastActivity}`);
      this.sessions.set(sessionId, session);
    } catch (error) {
      console.error(`Error processing session file ${filePath}:`, error);
    }
  }
  calculateStatus(lastActivity) {
    const now = /* @__PURE__ */ new Date();
    const secondsSinceActivity = (now.getTime() - lastActivity.getTime()) / 1e3;
    return secondsSinceActivity < 300 ? SessionStatus.Active : SessionStatus.Stopped;
  }
  updateSessionStatuses() {
    let hasChanges = false;
    for (const [id, session] of this.sessions) {
      if (session.source === "process") {
        continue;
      }
      const newStatus = this.calculateStatus(new Date(session.lastActivity));
      if (session.status !== newStatus) {
        session.status = newStatus;
        hasChanges = true;
        console.log(`Status change for ${session.projectName}: ${session.status} -> ${newStatus}`);
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
  mergeProcessSessions(processSessions) {
    for (const ps of processSessions) {
      const sessionId = `process-${ps.pid}`;
      let realLastActivity = null;
      let hasHookData = false;
      for (const [existingId, existingSession] of this.sessions.entries()) {
        if (existingSession.source === "hook" && existingSession.projectPath === ps.projectPath) {
          realLastActivity = new Date(existingSession.lastActivity);
          hasHookData = true;
          break;
        }
      }
      let status;
      let lastActivity;
      if (ps.status === "stopped") {
        status = SessionStatus.Stopped;
        lastActivity = ps.lastSeen || (/* @__PURE__ */ new Date()).toISOString();
      } else if (hasHookData && realLastActivity) {
        const secondsSinceActivity = (Date.now() - realLastActivity.getTime()) / 1e3;
        status = secondsSinceActivity < 300 ? SessionStatus.Active : SessionStatus.Stopped;
        lastActivity = realLastActivity.toISOString();
      } else {
        status = SessionStatus.Stopped;
        lastActivity = ps.lastSeen || (/* @__PURE__ */ new Date()).toISOString();
      }
      const session = {
        id: sessionId,
        projectPath: ps.projectPath,
        projectName: ps.projectName,
        lastActivity,
        status,
        latestMessage: void 0,
        messageCount: 0,
        startTime: ps.startTime,
        source: "process"
      };
      console.log(`Process session ${ps.projectName}: status=${status}, lastActivity=${lastActivity}, hasHookData=${hasHookData}`);
      this.sessions.set(sessionId, session);
    }
    this.emit("sessions-updated", this.getSessions());
  }
  mergeHistorySessions(historySessions) {
    for (const hs of historySessions) {
      const sessionId = `history-${path__namespace.basename(hs.projectPath)}`;
      if (!this.sessions.has(sessionId)) {
        const lastActivityDate = new Date(hs.lastActivity);
        const secondsSinceActivity = (Date.now() - lastActivityDate.getTime()) / 1e3;
        const isRecentlyActive = secondsSinceActivity < 300;
        const session = {
          id: sessionId,
          projectPath: hs.projectPath,
          projectName: hs.projectName,
          lastActivity: hs.lastActivity,
          status: isRecentlyActive ? SessionStatus.Active : SessionStatus.Stopped,
          latestMessage: hs.latestCommand ? {
            type: MessageType.User,
            content: hs.latestCommand.substring(0, 200),
            timestamp: hs.lastActivity
          } : void 0,
          messageCount: hs.commandCount || 0,
          startTime: hs.startTime,
          source: "history"
        };
        console.log(`History session ${hs.projectName}: status=${session.status}, lastActivity=${hs.lastActivity}, secondsSince=${Math.round(secondsSinceActivity)}`);
        this.sessions.set(sessionId, session);
      }
    }
    this.emit("sessions-updated", this.getSessions());
  }
  getSessions() {
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1e3;
    const recentSessions = Array.from(this.sessions.values()).filter((session) => {
      const lastActivityTime = new Date(session.lastActivity).getTime();
      return lastActivityTime > thirtyMinutesAgo;
    });
    const sessionsByProject = /* @__PURE__ */ new Map();
    for (const session of recentSessions) {
      const existing = sessionsByProject.get(session.projectPath);
      if (!existing || new Date(session.lastActivity).getTime() > new Date(existing.lastActivity).getTime()) {
        sessionsByProject.set(session.projectPath, session);
      }
    }
    return Array.from(sessionsByProject.values()).sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
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
      preload: path__namespace.join(__dirname, "preload.js"),
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
    mainWindow.webContents.on("will-navigate", (event, url) => {
      if (!url.startsWith("http://localhost:5173")) {
        event.preventDefault();
      }
    });
  } else {
    mainWindow.loadFile(path__namespace.join(__dirname, "../../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
electron.app.whenReady().then(async () => {
  sessionMonitor = new SessionMonitor();
  electron.ipcMain.handle("get-sessions", () => {
    const sessions = (sessionMonitor == null ? void 0 : sessionMonitor.getSessions()) || [];
    console.log("get-sessions called, returning", sessions.length, "sessions");
    return sessions;
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
  await sessionMonitor.startWatching();
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
