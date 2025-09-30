/**
 * Codex Session Monitor
 *
 * Monitors Codex sessions by watching:
 * - ~/.codex/history.jsonl for new prompts
 * - ~/.codex/sessions/ for session files
 *
 * Since Codex doesn't support hooks, we use file watching.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Session, SessionStatus } from './types';

interface CodexHistoryEntry {
  session_id: string;
  ts: number;
  text: string;
}

interface CodexSessionMeta {
  id: string;
  timestamp: string;
  cwd: string;
  originator: string;
  cli_version: string;
  git?: {
    commit_hash: string;
    branch: string;
    repository_url: string;
  };
}

interface CodexSessionFile {
  timestamp: string;
  type: string;
  payload: any;
}

export class CodexMonitor extends EventEmitter {
  private codexDir: string;
  private historyFile: string;
  private sessionsDir: string;
  private historyFileSize: number = 0;
  private sessions: Map<string, Session> = new Map();
  private watchInterval: NodeJS.Timeout | null = null;
  private sessionFilesWatched: Set<string> = new Set();

  constructor() {
    super();
    this.codexDir = path.join(os.homedir(), '.codex');
    this.historyFile = path.join(this.codexDir, 'history.jsonl');
    this.sessionsDir = path.join(this.codexDir, 'sessions');
  }

  /**
   * Start monitoring Codex sessions
   */
  async startWatching(): Promise<void> {
    console.log('[CodexMonitor] Starting Codex session monitoring...');

    // Check if Codex directory exists
    if (!fs.existsSync(this.codexDir)) {
      console.log('[CodexMonitor] Codex directory not found, monitoring disabled');
      return;
    }

    // Initial scan
    await this.scanHistory();
    await this.scanSessions();

    // Watch for changes every 2 seconds
    this.watchInterval = setInterval(async () => {
      await this.watchHistory();
      await this.scanSessions();
    }, 2000);

    console.log('[CodexMonitor] Codex monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopWatching(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
    console.log('[CodexMonitor] Codex monitoring stopped');
  }

  /**
   * Watch history.jsonl for new entries
   */
  private async watchHistory(): Promise<void> {
    if (!fs.existsSync(this.historyFile)) {
      return;
    }

    const stats = fs.statSync(this.historyFile);
    const currentSize = stats.size;

    // File has grown - read new entries
    if (currentSize > this.historyFileSize) {
      const stream = fs.createReadStream(this.historyFile, {
        start: this.historyFileSize,
        encoding: 'utf8'
      });

      let buffer = '';

      stream.on('data', (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const entry: CodexHistoryEntry = JSON.parse(line);
              this.processHistoryEntry(entry);
            } catch (error) {
              console.error('[CodexMonitor] Failed to parse history entry:', error);
            }
          }
        }
      });

      stream.on('end', () => {
        this.historyFileSize = currentSize;
      });
    }
  }

  /**
   * Initial scan of history file
   */
  private async scanHistory(): Promise<void> {
    if (!fs.existsSync(this.historyFile)) {
      return;
    }

    const content = fs.readFileSync(this.historyFile, 'utf8');
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.trim()) {
        try {
          const entry: CodexHistoryEntry = JSON.parse(line);
          this.processHistoryEntry(entry);
        } catch (error) {
          // Skip invalid lines
        }
      }
    }

    const stats = fs.statSync(this.historyFile);
    this.historyFileSize = stats.size;
  }

  /**
   * Process a history entry
   */
  private processHistoryEntry(entry: CodexHistoryEntry): void {
    const sessionId = entry.session_id;

    if (!this.sessions.has(sessionId)) {
      // Create new session
      const session: Session = {
        id: sessionId,
        projectPath: 'Unknown', // Will be updated from session file
        projectName: 'Codex Session',
        userPrompt: entry.text.substring(0, 200),
        startTime: new Date(entry.ts * 1000).toISOString(),
        lastActivity: new Date(entry.ts * 1000).toISOString(),
        status: SessionStatus.Active,
        source: 'codex',
        messageCount: 0
      };

      this.sessions.set(sessionId, session);
      this.emit('session-updated', session);
    } else {
      // Update existing session
      const session = this.sessions.get(sessionId)!;
      session.lastActivity = new Date(entry.ts * 1000).toISOString();
      session.userPrompt = entry.text.substring(0, 200);
      this.emit('session-updated', session);
    }
  }

  /**
   * Scan sessions directory for session files
   */
  private async scanSessions(): Promise<void> {
    if (!fs.existsSync(this.sessionsDir)) {
      return;
    }

    // Walk through sessions/YYYY/MM/DD structure
    const years = fs.readdirSync(this.sessionsDir);

    for (const year of years) {
      const yearPath = path.join(this.sessionsDir, year);
      if (!fs.statSync(yearPath).isDirectory()) continue;

      const months = fs.readdirSync(yearPath);

      for (const month of months) {
        const monthPath = path.join(yearPath, month);
        if (!fs.statSync(monthPath).isDirectory()) continue;

        const days = fs.readdirSync(monthPath);

        for (const day of days) {
          const dayPath = path.join(monthPath, day);
          if (!fs.statSync(dayPath).isDirectory()) continue;

          const sessionFiles = fs.readdirSync(dayPath)
            .filter(f => f.endsWith('.jsonl'));

          for (const file of sessionFiles) {
            const filePath = path.join(dayPath, file);

            // Only process if not already watched
            if (!this.sessionFilesWatched.has(filePath)) {
              await this.processSessionFile(filePath);
              this.sessionFilesWatched.add(filePath);
            }
          }
        }
      }
    }
  }

  /**
   * Process a session file to extract metadata
   */
  private async processSessionFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());

      if (lines.length === 0) return;

      // Parse first line for session_meta
      const firstLine: CodexSessionFile = JSON.parse(lines[0]);

      if (firstLine.type === 'session_meta') {
        const meta: CodexSessionMeta = firstLine.payload;
        const sessionId = meta.id;

        if (this.sessions.has(sessionId)) {
          // Update session with metadata
          const session = this.sessions.get(sessionId)!;
          session.projectPath = meta.cwd;
          session.projectName = path.basename(meta.cwd);

          if (meta.git) {
            session.gitBranch = meta.git.branch;
            session.gitRepo = meta.git.repository_url;
          }

          this.emit('session-updated', session);
        } else {
          // Create new session from file
          const session: Session = {
            id: sessionId,
            projectPath: meta.cwd,
            projectName: path.basename(meta.cwd),
            userPrompt: 'Session started',
            startTime: meta.timestamp,
            lastActivity: meta.timestamp,
            status: SessionStatus.Active,
            source: 'codex',
            messageCount: 0,
            gitBranch: meta.git?.branch,
            gitRepo: meta.git?.repository_url
          };

          this.sessions.set(sessionId, session);
          this.emit('session-updated', session);
        }
      }

      // Get last activity from last line
      if (lines.length > 1) {
        const lastLine: CodexSessionFile = JSON.parse(lines[lines.length - 1]);
        const sessionId = firstLine.payload.id;

        if (this.sessions.has(sessionId)) {
          const session = this.sessions.get(sessionId)!;
          session.lastActivity = lastLine.timestamp;

          // Check if session is still active (within last 5 minutes)
          const lastActivityTime = new Date(lastLine.timestamp).getTime();
          const now = Date.now();
          const fiveMinutes = 5 * 60 * 1000;

          session.status = (now - lastActivityTime) < fiveMinutes
            ? SessionStatus.Active
            : SessionStatus.Stopped;

          this.emit('session-updated', session);
        }
      }
    } catch (error) {
      console.error('[CodexMonitor] Failed to process session file:', filePath, error);
    }
  }

  /**
   * Get all sessions
   */
  getSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session by ID
   */
  getSessionById(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }
}
