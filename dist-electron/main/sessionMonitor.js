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
exports.SessionMonitor = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const chokidar = __importStar(require("chokidar"));
const events_1 = require("events");
const types_1 = require("./types");
class SessionMonitor extends events_1.EventEmitter {
    sessions = new Map();
    watcher = null;
    sessionsDir;
    constructor() {
        super();
        this.sessionsDir = path.join(os.homedir(), '.claude', 'active_sessions');
    }
    async startWatching() {
        console.log('Starting session monitor...');
        console.log('Watching sessions directory:', this.sessionsDir);
        // Ensure the sessions directory exists
        if (!fs.existsSync(this.sessionsDir)) {
            fs.mkdirSync(this.sessionsDir, { recursive: true });
        }
        // Initial scan
        await this.scanDirectory();
        // Set up file watcher for session files
        this.watcher = chokidar.watch(path.join(this.sessionsDir, '*.json'), {
            persistent: true,
            ignoreInitial: true,
        });
        this.watcher
            .on('add', (filePath) => this.handleFileChange(filePath))
            .on('change', (filePath) => this.handleFileChange(filePath))
            .on('unlink', (filePath) => this.handleFileRemoved(filePath))
            .on('error', (error) => console.error('Watcher error:', error));
        // Set up periodic status updates
        setInterval(() => this.updateSessionStatuses(), 1000);
        // Periodic cleanup of old sessions
        setInterval(() => this.cleanupOldSessions(), 60000); // Every minute
    }
    async scanDirectory() {
        try {
            if (!fs.existsSync(this.sessionsDir)) {
                console.log('Sessions directory does not exist:', this.sessionsDir);
                return;
            }
            const files = fs.readdirSync(this.sessionsDir);
            const jsonFiles = files.filter(f => f.endsWith('.json'));
            console.log(`Found ${jsonFiles.length} session files`);
            for (const file of jsonFiles) {
                const filePath = path.join(this.sessionsDir, file);
                await this.processSessionFile(filePath);
            }
            this.emit('sessions-updated', this.getSessions());
        }
        catch (error) {
            console.error('Error scanning directory:', error);
        }
    }
    async handleFileChange(filePath) {
        console.log('Session file changed:', path.basename(filePath));
        await this.processSessionFile(filePath);
        this.emit('sessions-updated', this.getSessions());
    }
    handleFileRemoved(filePath) {
        const sessionId = path.basename(filePath, '.json');
        console.log('Session file removed:', sessionId);
        this.sessions.delete(sessionId);
        this.emit('sessions-updated', this.getSessions());
    }
    async processSessionFile(filePath) {
        try {
            const sessionId = path.basename(filePath, '.json');
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const hookSession = JSON.parse(fileContent);
            // Convert hook session to our Session format
            const lastActivity = new Date(hookSession.last_activity);
            // Get latest message
            let latestMessage = undefined;
            if (hookSession.final_response) {
                latestMessage = {
                    type: types_1.MessageType.Assistant,
                    content: hookSession.final_response.substring(0, 200),
                    timestamp: hookSession.end_time || hookSession.last_activity,
                };
            }
            else if (hookSession.messages && hookSession.messages.length > 0) {
                const lastMsg = hookSession.messages[hookSession.messages.length - 1];
                latestMessage = {
                    type: lastMsg.role === 'user' ? types_1.MessageType.User : types_1.MessageType.Assistant,
                    content: lastMsg.content.substring(0, 200),
                    timestamp: lastMsg.timestamp,
                };
            }
            else if (hookSession.user_prompt) {
                latestMessage = {
                    type: types_1.MessageType.User,
                    content: hookSession.user_prompt.substring(0, 200),
                    timestamp: hookSession.start_time,
                };
            }
            // Calculate status
            let status;
            if (hookSession.status === 'completed') {
                status = types_1.SessionStatus.Stopped;
            }
            else if (hookSession.status === 'idle') {
                status = types_1.SessionStatus.Stopped;
            }
            else {
                // Check if truly active based on last activity
                const secondsSinceActivity = (Date.now() - lastActivity.getTime()) / 1000;
                status = secondsSinceActivity < 30 ? types_1.SessionStatus.Active : types_1.SessionStatus.Stopped;
            }
            const session = {
                id: sessionId,
                projectPath: hookSession.project_path || '',
                projectName: hookSession.project_name || 'Unknown Project',
                lastActivity: lastActivity.toISOString(),
                status,
                latestMessage,
                messageCount: (hookSession.messages?.length || 0) + (hookSession.tool_calls?.length || 0),
                startTime: hookSession.start_time,
                userPrompt: hookSession.user_prompt,
                toolCalls: hookSession.tool_calls,
                finalResponse: hookSession.final_response,
            };
            this.sessions.set(sessionId, session);
        }
        catch (error) {
            console.error(`Error processing session file ${filePath}:`, error);
        }
    }
    calculateStatus(lastActivity) {
        const now = new Date();
        const secondsSinceActivity = (now.getTime() - lastActivity.getTime()) / 1000;
        return secondsSinceActivity < 30 ? types_1.SessionStatus.Active : types_1.SessionStatus.Stopped;
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
            this.emit('sessions-updated', this.getSessions());
        }
    }
    cleanupOldSessions() {
        // Remove sessions older than 24 hours
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
        for (const [id, session] of this.sessions) {
            const startTime = new Date(session.startTime).getTime();
            if (startTime < cutoffTime && session.status === types_1.SessionStatus.Stopped) {
                const filePath = path.join(this.sessionsDir, `${id}.json`);
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`Cleaned up old session: ${id}`);
                    }
                }
                catch (error) {
                    console.error(`Error cleaning up session ${id}:`, error);
                }
            }
        }
    }
    getSessions() {
        return Array.from(this.sessions.values())
            .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
    }
    getActiveSessions() {
        return this.getSessions().filter(s => s.status === types_1.SessionStatus.Active);
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
exports.SessionMonitor = SessionMonitor;
//# sourceMappingURL=sessionMonitor.js.map