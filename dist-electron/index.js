"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
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
const execAsync$1 = util.promisify(child_process.exec);
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
      const { stdout: psOutput } = await execAsync$1(
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
          const { stdout: cwdOutput } = await execAsync$1(`lsof -p ${pid} 2>/dev/null | grep cwd | awk '{print $NF}'`);
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
    const homeDir = os__namespace.homedir();
    const dirName = path__namespace.basename(dirPath);
    if (dirPath === homeDir || dirPath === path__namespace.join(homeDir, ".claude")) {
      return false;
    }
    const excludedNames = ["Desktop", "Documents", "Downloads", "Pictures", ".claude", "Library"];
    if (excludedNames.includes(dirName)) {
      return false;
    }
    const indicators = [
      ".git",
      "package.json",
      "Cargo.toml",
      "pyproject.toml",
      "requirements.txt",
      "Gemfile",
      "go.mod",
      "pom.xml",
      "build.gradle"
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
const execAsync = util.promisify(child_process.exec);
class CodexMonitor extends events.EventEmitter {
  constructor() {
    super();
    __publicField(this, "sessions", /* @__PURE__ */ new Map());
    __publicField(this, "processes", /* @__PURE__ */ new Map());
    __publicField(this, "scanInterval", null);
  }
  /**
   * Start monitoring Codex processes
   */
  async startWatching() {
    console.log("[CodexMonitor] Starting Codex process monitoring...");
    await this.scanProcesses();
    this.scanInterval = setInterval(async () => {
      await this.scanProcesses();
    }, 3e3);
    console.log("[CodexMonitor] Codex monitoring started");
  }
  /**
   * Stop monitoring
   */
  stopWatching() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log("[CodexMonitor] Codex monitoring stopped");
  }
  /**
   * Scan for running Codex processes
   */
  async scanProcesses() {
    try {
      const { stdout } = await execAsync("ps aux | grep -i codex | grep -v grep | awk '{print $2}'");
      const pids = stdout.split("\n").map((line) => line.trim()).filter(Boolean).map((pid) => parseInt(pid, 10)).filter((pid) => !isNaN(pid));
      const currentPids = /* @__PURE__ */ new Set();
      for (const pid of pids) {
        currentPids.add(pid);
        try {
          const { stdout: lsofOutput } = await execAsync(`lsof -p ${pid} 2>/dev/null | grep cwd | awk '{print $NF}'`);
          const projectPath = lsofOutput.trim();
          if (!projectPath || projectPath === "/") {
            continue;
          }
          const projectName = path__namespace.basename(projectPath);
          const now = (/* @__PURE__ */ new Date()).toISOString();
          if (!this.processes.has(pid)) {
            this.processes.set(pid, {
              pid,
              projectPath,
              projectName,
              lastSeen: now
            });
            console.log(`[CodexMonitor] New Codex process: ${projectName} (pid: ${pid})`);
          } else {
            const proc = this.processes.get(pid);
            proc.lastSeen = now;
            proc.projectPath = projectPath;
            proc.projectName = projectName;
          }
          const sessionId = `codex-${pid}`;
          const existingSession = this.sessions.get(sessionId);
          if (!existingSession) {
            const recentActivity = await this.hasRecentActivity(projectPath);
            if (!recentActivity) {
              console.log(`[CodexMonitor] Skipping stale project: ${projectName} (no recent activity)`);
              continue;
            }
            const session = {
              id: sessionId,
              projectPath,
              projectName,
              userPrompt: `Working in ${projectName}`,
              startTime: now,
              lastActivity: now,
              status: SessionStatus.Active,
              source: "codex",
              messageCount: 0
            };
            this.sessions.set(sessionId, session);
            this.emit("session-updated", session);
            console.log(`[CodexMonitor] Created session for ${projectName}`);
          } else {
            existingSession.lastActivity = now;
            existingSession.status = SessionStatus.Active;
            existingSession.projectPath = projectPath;
            existingSession.projectName = projectName;
            this.emit("session-updated", existingSession);
          }
        } catch (error) {
          console.log(`[CodexMonitor] Could not get info for PID ${pid}`);
        }
      }
      for (const [pid, proc] of this.processes.entries()) {
        if (!currentPids.has(pid)) {
          const sessionId = `codex-${pid}`;
          const session = this.sessions.get(sessionId);
          if (session && session.status === SessionStatus.Active) {
            session.status = SessionStatus.Stopped;
            session.lastActivity = proc.lastSeen;
            this.emit("session-updated", session);
            console.log(`[CodexMonitor] Codex process stopped: ${proc.projectName} (pid: ${pid})`);
          }
          const lastSeenTime = new Date(proc.lastSeen).getTime();
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1e3;
          if (lastSeenTime < fiveMinutesAgo) {
            this.processes.delete(pid);
          }
        }
      }
    } catch (error) {
      console.error("[CodexMonitor] Error scanning processes:", error);
    }
  }
  /**
   * Check if a project has had recent activity in Codex log
   */
  async hasRecentActivity(projectPath) {
    try {
      const logFile2 = require("path").join(require("os").homedir(), ".codex", "log", "codex-tui.log");
      const { exec: exec2 } = require("child_process");
      const { promisify: promisify2 } = require("util");
      const execAsync2 = promisify2(exec2);
      const cmd = `tail -200 "${logFile2}" 2>/dev/null | grep -c "${projectPath}" || echo 0`;
      const { stdout } = await execAsync2(cmd);
      const count = parseInt(stdout.trim(), 10);
      return count > 0;
    } catch (error) {
      return true;
    }
  }
  /**
   * Get all sessions
   */
  getSessions() {
    return Array.from(this.sessions.values());
  }
  /**
   * Get session by ID
   */
  getSessionById(sessionId) {
    return this.sessions.get(sessionId);
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
    __publicField(this, "codexMonitor", null);
    this.sessionsDir = path__namespace.join(os__namespace.homedir(), ".claude", "active_sessions");
    this.processMonitor = new ClaudeProcessMonitor();
    this.historyMonitor = new ClaudeHistoryMonitor();
    this.codexMonitor = new CodexMonitor();
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
    if (this.codexMonitor) {
      await this.codexMonitor.startWatching();
      this.codexMonitor.on("session-updated", (codexSession) => {
        this.mergeCodexSession(codexSession);
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
  mergeCodexSession(codexSession) {
    const existingSession = this.sessions.get(codexSession.id);
    if (!existingSession || existingSession.source === "codex") {
      this.sessions.set(codexSession.id, codexSession);
      console.log(`Codex session ${codexSession.projectName}: status=${codexSession.status}, lastActivity=${codexSession.lastActivity}`);
      this.emit("sessions-updated", this.getSessions());
    } else {
      if (new Date(codexSession.lastActivity) > new Date(existingSession.lastActivity)) {
        existingSession.lastActivity = codexSession.lastActivity;
        existingSession.status = codexSession.status;
        existingSession.userPrompt = codexSession.userPrompt;
        this.emit("sessions-updated", this.getSessions());
      }
    }
  }
  getSessions() {
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1e3;
    const homeDir = os__namespace.homedir();
    const recentSessions = Array.from(this.sessions.values()).filter((session) => {
      const lastActivityTime = new Date(session.lastActivity).getTime();
      if (lastActivityTime <= thirtyMinutesAgo) return false;
      const projectName = session.projectName.toLowerCase();
      const projectPath = session.projectPath;
      if (projectName === "unknown" || projectName === "unknown project") {
        console.log(`Filtering out session with unknown project name: ${session.id}`);
        return false;
      }
      if (projectPath === homeDir) {
        console.log(`Filtering out home directory session: ${projectPath}`);
        return false;
      }
      const excludedPaths = [".claude", "Library", "Desktop", "Documents", "Downloads"];
      const baseName = path__namespace.basename(projectPath);
      if (excludedPaths.includes(baseName)) {
        console.log(`Filtering out excluded directory: ${baseName}`);
        return false;
      }
      const parentDir = path__namespace.dirname(projectPath);
      if (parentDir === homeDir && !projectPath.includes("/dev/") && !projectPath.includes("/projects/")) {
        console.log(`Filtering out home subdirectory: ${projectPath}`);
        return false;
      }
      return true;
    });
    const sessionsByProject = /* @__PURE__ */ new Map();
    for (const session of recentSessions) {
      const existing = sessionsByProject.get(session.projectPath);
      if (!existing || new Date(session.lastActivity).getTime() > new Date(existing.lastActivity).getTime()) {
        sessionsByProject.set(session.projectPath, session);
      }
    }
    return Array.from(sessionsByProject.values()).sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === SessionStatus.Active ? -1 : 1;
      }
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    });
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
const logFile = path__namespace.join(electron.app.getPath("userData"), "agents-bro.log");
const logStream = fs__namespace.createWriteStream(logFile, { flags: "a" });
function log(message) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const logMessage = `[${timestamp}] ${message}
`;
  logStream.write(logMessage);
  console.log(message);
}
log(`=== Agents Bro started ===`);
log(`Log file: ${logFile}`);
function checkHooksInstalled() {
  const homeDir = require("os").homedir();
  const hooksDir = path__namespace.join(homeDir, ".claude", "hooks");
  const requiredHooks = [
    "user_prompt_submit.py",
    "pre_tool_use.py",
    "post_tool_use.py",
    "session_start.py"
  ];
  const missingHooks = [];
  for (const hook of requiredHooks) {
    const hookPath = path__namespace.join(hooksDir, hook);
    if (!fs__namespace.existsSync(hookPath)) {
      missingHooks.push(hook);
    }
  }
  const utilPath = path__namespace.join(hooksDir, "utils", "session_tracker.py");
  if (!fs__namespace.existsSync(utilPath)) {
    missingHooks.push("utils/session_tracker.py");
  }
  return {
    installed: missingHooks.length === 0,
    missingHooks
  };
}
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
      try {
        const urlObj = new URL(url);
        if (urlObj.port !== "5173" && urlObj.port !== "") {
          event.preventDefault();
        }
      } catch {
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
    log(`get-sessions called, returning ${sessions.length} sessions`);
    return sessions;
  });
  electron.ipcMain.handle("get-active-sessions", () => {
    const activeSessions = (sessionMonitor == null ? void 0 : sessionMonitor.getActiveSessions()) || [];
    log(`get-active-sessions called, returning ${activeSessions.length} sessions`);
    return activeSessions;
  });
  electron.ipcMain.handle("refresh-sessions", async () => {
    log("refresh-sessions called");
    await (sessionMonitor == null ? void 0 : sessionMonitor.scanDirectory());
    return (sessionMonitor == null ? void 0 : sessionMonitor.getSessions()) || [];
  });
  electron.ipcMain.handle("focus-window", async (_, sessionId) => {
    log(`Focus requested for session: ${sessionId}`);
    return true;
  });
  electron.ipcMain.handle("get-session-details", async (_, sessionId) => {
    log(`get-session-details called for: ${sessionId}`);
    return sessionMonitor == null ? void 0 : sessionMonitor.getSessionById(sessionId);
  });
  electron.ipcMain.handle("get-log-file-path", () => {
    return logFile;
  });
  electron.ipcMain.handle("check-hooks-installed", () => {
    const result = checkHooksInstalled();
    log(`Hooks check: installed=${result.installed}, missing=${result.missingHooks.join(", ")}`);
    return result;
  });
  electron.ipcMain.handle("run-setup-hooks", async () => {
    const { spawn } = await import("child_process");
    const setupScript = path__namespace.join(__dirname, "../../setup-hooks.sh");
    log(`Running setup script: ${setupScript}`);
    return new Promise((resolve) => {
      var _a, _b;
      const setupProcess = spawn(setupScript, [], {
        shell: true,
        stdio: "pipe"
      });
      let output = "";
      let errorOutput = "";
      (_a = setupProcess.stdout) == null ? void 0 : _a.on("data", (data) => {
        const text = data.toString();
        output += text;
        log(`Setup stdout: ${text}`);
      });
      (_b = setupProcess.stderr) == null ? void 0 : _b.on("data", (data) => {
        const text = data.toString();
        errorOutput += text;
        log(`Setup stderr: ${text}`);
      });
      setupProcess.on("close", (code) => {
        log(`Setup script exited with code: ${code}`);
        resolve({
          success: code === 0,
          output,
          error: errorOutput
        });
      });
      setupProcess.on("error", (error) => {
        log(`Setup script error: ${error.message}`);
        resolve({
          success: false,
          output,
          error: error.message
        });
      });
    });
  });
  electron.ipcMain.handle("open-project", async (_, { command, projectPath }) => {
    var _a;
    const { spawn } = await import("child_process");
    try {
      log(`open-project called: command="${command}" projectPath="${projectPath}"`);
      if (!fs__namespace.existsSync(projectPath)) {
        log(`ERROR: Project path does not exist: ${projectPath}`);
        return false;
      }
      log(`Spawning: ${command} ${projectPath}`);
      const child = spawn(command, [projectPath], {
        detached: true,
        stdio: "pipe"
      });
      (_a = child.stderr) == null ? void 0 : _a.on("data", (data) => {
        log(`open-project stderr: ${data.toString()}`);
      });
      child.on("error", (error) => {
        log(`open-project spawn error: ${error.message}`);
      });
      child.on("spawn", () => {
        log(`open-project spawned successfully`);
      });
      child.unref();
      return true;
    } catch (error) {
      log(`open-project exception: ${error}`);
      return false;
    }
  });
  electron.ipcMain.handle("create-worktree", async (_, { projectPath, projectName, projectsHomeFolder, command }) => {
    const { spawn } = await import("child_process");
    const pathModule = await import("path");
    try {
      log(`create-worktree called: projectPath="${projectPath}" projectName="${projectName}" projectsHomeFolder="${projectsHomeFolder}" command="${command}"`);
      if (!fs__namespace.existsSync(projectPath)) {
        log(`ERROR: Project path does not exist: ${projectPath}`);
        return { success: false, error: `Project path does not exist: ${projectPath}` };
      }
      const worktreesDir = pathModule.join(projectsHomeFolder, "worktrees");
      log(`Worktrees directory: ${worktreesDir}`);
      if (!fs__namespace.existsSync(worktreesDir)) {
        log(`Creating worktrees directory: ${worktreesDir}`);
        fs__namespace.mkdirSync(worktreesDir, { recursive: true });
      }
      let nextVersion = 1;
      if (fs__namespace.existsSync(worktreesDir)) {
        const entries = fs__namespace.readdirSync(worktreesDir);
        log(`Found ${entries.length} entries in worktrees directory`);
        const projectWorktrees = entries.filter((name) => name.startsWith(`${projectName}-v`));
        log(`Found ${projectWorktrees.length} worktrees for project "${projectName}"`);
        if (projectWorktrees.length > 0) {
          const versions = projectWorktrees.map((name) => {
            const match = name.match(/-v(\d+)$/);
            return match ? parseInt(match[1], 10) : 0;
          }).filter((v) => !isNaN(v));
          if (versions.length > 0) {
            nextVersion = Math.max(...versions) + 1;
            log(`Next version will be: v${nextVersion}`);
          }
        }
      }
      const worktreeName = `${projectName}-v${nextVersion}`;
      const worktreePath = pathModule.join(worktreesDir, worktreeName);
      log(`Creating worktree: ${worktreePath}`);
      return new Promise((resolve) => {
        var _a, _b;
        log(`Spawning git: git worktree add ${worktreePath} (cwd: ${projectPath})`);
        const gitProcess = spawn("git", ["worktree", "add", worktreePath], {
          cwd: projectPath,
          stdio: "pipe"
        });
        let errorOutput = "";
        let stdoutOutput = "";
        (_a = gitProcess.stdout) == null ? void 0 : _a.on("data", (data) => {
          const output = data.toString();
          stdoutOutput += output;
          log(`git stdout: ${output}`);
        });
        (_b = gitProcess.stderr) == null ? void 0 : _b.on("data", (data) => {
          const output = data.toString();
          errorOutput += output;
          log(`git stderr: ${output}`);
        });
        gitProcess.on("error", (error) => {
          log(`git spawn error: ${error.message}`);
          resolve({ success: false, error: error.message });
        });
        gitProcess.on("close", (code) => {
          log(`git process exited with code: ${code}`);
          if (code === 0) {
            log(`Worktree created successfully: ${worktreePath}`);
            try {
              const files = fs__namespace.readdirSync(projectPath);
              const envFiles = files.filter((file) => file.startsWith(".env"));
              if (envFiles.length > 0) {
                log(`Found ${envFiles.length} .env files to copy: ${envFiles.join(", ")}`);
                for (const envFile of envFiles) {
                  const sourcePath = pathModule.join(projectPath, envFile);
                  const destPath = pathModule.join(worktreePath, envFile);
                  try {
                    fs__namespace.copyFileSync(sourcePath, destPath);
                    log(`Copied ${envFile} to worktree`);
                  } catch (copyError) {
                    log(`Warning: Failed to copy ${envFile}: ${copyError}`);
                  }
                }
              } else {
                log("No .env files found to copy");
              }
            } catch (scanError) {
              log(`Warning: Failed to scan for .env files: ${scanError}`);
            }
            log(`Opening worktree: ${command} ${worktreePath}`);
            const openProcess = spawn(command, [worktreePath], {
              detached: true,
              stdio: "pipe"
            });
            openProcess.on("error", (error) => {
              log(`open worktree spawn error: ${error.message}`);
            });
            openProcess.on("spawn", () => {
              log(`Worktree opened successfully`);
            });
            openProcess.unref();
            resolve({ success: true, worktreePath });
          } else {
            log(`Failed to create worktree. Error: ${errorOutput}`);
            resolve({ success: false, error: errorOutput || `Git exited with code ${code}` });
          }
        });
      });
    } catch (error) {
      log(`create-worktree exception: ${error}`);
      return { success: false, error: String(error) };
    }
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
