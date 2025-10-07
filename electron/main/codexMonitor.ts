/**
 * Codex Monitor (Rollout-Based)
 *
 * Observes the Codex CLI rollout directory (~/.codex/sessions) to surface
 * active sessions with metadata parity to Claude monitoring.
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as chokidar from 'chokidar';
import { Session, SessionStatus, MessageType } from './types';

interface RolloutLine {
  timestamp?: string;
  type?: string;
  payload?: any;
  [key: string]: any;
}

export class CodexMonitor extends EventEmitter {
  private sessionsDir: string;
  private watcher: chokidar.FSWatcher | null = null;
  private sessions: Map<string, Session> = new Map();
  private fileToSessionId: Map<string, string> = new Map();
  private statusInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.sessionsDir = path.join(os.homedir(), '.codex', 'sessions');
  }

  async startWatching(): Promise<void> {
    console.log('[CodexMonitor] Starting Codex rollout monitoring...');

    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }

    await this.initialScan();

    this.watcher = chokidar.watch(path.join(this.sessionsDir, '**/*.jsonl'), {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 200,
      },
    });

    this.watcher
      .on('add', (filePath) => this.safeProcessFile(filePath, 'add'))
      .on('change', (filePath) => this.safeProcessFile(filePath, 'change'))
      .on('unlink', (filePath) => this.handleFileRemoved(filePath))
      .on('error', (error) => console.error('[CodexMonitor] Watch error:', error));

    this.statusInterval = setInterval(() => this.markStaleSessions(), 60_000);

    console.log('[CodexMonitor] Watching', this.sessionsDir);
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }

    this.sessions.clear();
    this.fileToSessionId.clear();

    console.log('[CodexMonitor] Codex monitoring stopped');
  }

  getSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  getSessionById(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  private async initialScan(): Promise<void> {
    try {
      const files = this.collectRolloutFiles(this.sessionsDir);
      files.forEach((file) => this.safeProcessFile(file, 'initial'));
      console.log(`[CodexMonitor] Initial scan processed ${files.length} rollout file(s)`);
    } catch (error) {
      console.error('[CodexMonitor] Initial scan failed:', error);
    }
  }

  private collectRolloutFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) {
      return [];
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.collectRolloutFiles(entryPath));
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        files.push(entryPath);
      }
    }

    return files;
  }

  private safeProcessFile(filePath: string, origin: string): void {
    try {
      this.processRolloutFile(filePath);
    } catch (error) {
      console.error(`[CodexMonitor] Failed to process file (${origin}):`, filePath, error);
    }
  }

  private processRolloutFile(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      return;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) {
      return;
    }

    const lines = raw.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      return;
    }

    const existingSessionId = this.fileToSessionId.get(filePath);
    const existingSession = existingSessionId ? this.sessions.get(existingSessionId) : undefined;

    let conversationId = existingSession ? existingSession.id.replace(/^codex-/, '') : undefined;
    let projectPath = existingSession?.projectPath || '';
    let projectName = existingSession?.projectName || 'Codex Session';
    let startTime = existingSession?.startTime || new Date().toISOString();
    let userPrompt = existingSession?.userPrompt;
    let latestMessage = existingSession?.latestMessage;
    let messageCount = 0;
    let lastActivity = existingSession?.lastActivity || startTime;

    for (const line of lines) {
      let parsed: RolloutLine;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }

      const eventTimestamp = this.normalizeTimestamp(parsed.timestamp) || lastActivity;
      lastActivity = eventTimestamp;
      if (!startTime) {
        startTime = eventTimestamp;
      }
      if (startTime && eventTimestamp) {
        const startMs = new Date(startTime).getTime();
        const eventMs = new Date(eventTimestamp).getTime();
        if (!Number.isNaN(eventMs) && (Number.isNaN(startMs) || eventMs < startMs)) {
          startTime = eventTimestamp;
        }
      }

      switch (parsed.type) {
        case 'session_meta': {
          const payload = parsed.payload || {};
          if (payload.id) {
            conversationId = String(payload.id);
          }
          if (payload.cwd && typeof payload.cwd === 'string' && payload.cwd !== '.') {
            projectPath = payload.cwd;
            projectName = path.basename(projectPath) || projectName;
          }
          if (payload.timestamp) {
            startTime = this.normalizeTimestamp(payload.timestamp) || startTime;
          }
          if (!userPrompt && typeof payload.instructions === 'string') {
            userPrompt = this.trimTo(payload.instructions, 200);
          }
          break;
        }
        case 'turn_context': {
          const payload = parsed.payload || {};
          if (payload.cwd && typeof payload.cwd === 'string' && payload.cwd !== '.') {
            projectPath = payload.cwd;
            projectName = path.basename(projectPath) || projectName;
          }
          break;
        }
        case 'event_msg': {
          const payload = parsed.payload || {};
          if (payload.type === 'user_message') {
            const message = this.extractUserMessage(payload);
            if (message) {
              userPrompt = message;
            }
            messageCount += 1;
          }
          break;
        }
        case 'response_item': {
          const payload = parsed.payload || {};
          const role = typeof payload.role === 'string' ? payload.role.toLowerCase() : 'assistant';

          if (payload.type === 'message' && Array.isArray(payload.content)) {
            const combined = payload.content
              .map((item: any) => {
                if (!item || typeof item !== 'object') {
                  return '';
                }
                if (typeof item.text === 'string') {
                  return item.text;
                }
                if (typeof item.message === 'string') {
                  return item.message;
                }
                return '';
              })
              .filter(Boolean)
              .join(' ')
              .trim();

            if (combined) {
              latestMessage = {
                type: role === 'user' ? MessageType.User : MessageType.Assistant,
                content: this.trimTo(combined, 200),
                timestamp: eventTimestamp,
              };
            }
            messageCount += 1;
          } else {
            messageCount += 1;
          }
          break;
        }
        default: {
          if (!parsed.type && parsed.record_type === 'response') {
            messageCount += 1;
          }
          if (!projectPath && typeof parsed.cwd === 'string' && parsed.cwd !== '.') {
            projectPath = parsed.cwd;
            projectName = path.basename(projectPath) || projectName;
          }
          break;
        }
      }
    }

    conversationId = conversationId || path.basename(filePath, '.jsonl');
    const sessionId = conversationId.startsWith('codex-') ? conversationId : `codex-${conversationId}`;

    if (!projectPath) {
      projectPath = existingSession?.projectPath || '';
    }
    if (!projectName && projectPath) {
      projectName = path.basename(projectPath) || 'Codex Session';
    }

    const session: Session = {
      id: sessionId,
      projectPath,
      projectName: projectName || 'Codex Session',
      startTime,
      lastActivity,
      status: SessionStatus.Active,
      messageCount: Math.max(messageCount, 1),
      userPrompt,
      latestMessage,
      source: 'codex',
    };

    this.sessions.set(sessionId, session);
    this.fileToSessionId.set(filePath, sessionId);
    console.log(`[CodexMonitor] Session ${session.projectName} (${sessionId}) -> ${session.status}, messages=${session.messageCount}`);

    this.emit('session-updated', session);
  }

  private handleFileRemoved(filePath: string): void {
    const sessionId = this.fileToSessionId.get(filePath);
    if (!sessionId) {
      return;
    }

    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = SessionStatus.Stopped;
      session.lastActivity = new Date().toISOString();
      this.sessions.set(sessionId, session);
      console.log(`[CodexMonitor] Session ${session.projectName} (${sessionId}) -> stopped`);
      this.emit('session-updated', session);
    }

    this.fileToSessionId.delete(filePath);
  }

  private normalizeTimestamp(raw?: string): string | null {
    if (!raw || typeof raw !== 'string') {
      return null;
    }

    let normalized = raw;

    normalized = normalized.replace(
      /(T\d{2})-(\d{2})-(\d{2})(\.[0-9A-Za-z:+-]+)?/,
      (_match, hour, minute, second, fraction = '') => `${hour}:${minute}:${second}${fraction}`
    );

    if (!/[Z+-]$/.test(normalized)) {
      normalized += 'Z';
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toISOString();
  }

  private extractUserMessage(payload: any): string | null {
    if (!payload) {
      return null;
    }

    if (typeof payload.message === 'string' && payload.message.trim()) {
      return this.trimTo(payload.message, 200);
    }

    if (Array.isArray(payload.messages)) {
      const combined = payload.messages.filter(Boolean).join(' ').trim();
      if (combined) {
        return this.trimTo(combined, 200);
      }
    }

    if (Array.isArray(payload['input_messages'])) {
      const combined = payload['input_messages'].filter(Boolean).join(' ').trim();
      if (combined) {
        return this.trimTo(combined, 200);
      }
    }

    return null;
  }

  private trimTo(value: string, limit: number): string {
    if (value.length <= limit) {
      return value;
    }
    return `${value.slice(0, limit)}...`;
  }

  private markStaleSessions(): void {
    const now = Date.now();
    const updatedSessions: Session[] = [];

    for (const session of this.sessions.values()) {
      const last = new Date(session.lastActivity).getTime();
      if (Number.isNaN(last)) {
        continue;
      }

      const secondsSince = (now - last) / 1000;
      if (secondsSince > 300 && session.status !== SessionStatus.Stopped) {
        session.status = SessionStatus.Stopped;
        updatedSessions.push(session);
      }
    }

    updatedSessions.forEach((session) => {
      this.emit('session-updated', session);
    });
  }
}
