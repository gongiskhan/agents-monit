import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { Session, SessionStatus, MessageType } from './types';

interface HookSession {
  id: string;
  project_path: string;
  project_name: string;
  user_prompt: string;
  start_time: string;
  last_activity: string;
  status: string;
  tool_calls: Array<{
    tool: string;
    timestamp: string;
    description: string;
  }>;
  messages: Array<{
    role: string;
    content: string;
    timestamp: string;
  }>;
  final_response?: string;
  end_time?: string;
}

export class SessionMonitor extends EventEmitter {
  private sessions: Map<string, Session> = new Map();
  private watcher: chokidar.FSWatcher | null = null;
  private sessionsDir: string;

  constructor() {
    super();
    this.sessionsDir = path.join(os.homedir(), '.claude', 'active_sessions');
  }

  async startWatching(): Promise<void> {
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

  async scanDirectory(): Promise<void> {
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
    } catch (error) {
      console.error('Error scanning directory:', error);
    }
  }

  private async handleFileChange(filePath: string): Promise<void> {
    console.log('Session file changed:', path.basename(filePath));
    await this.processSessionFile(filePath);
    this.emit('sessions-updated', this.getSessions());
  }

  private handleFileRemoved(filePath: string): void {
    const sessionId = path.basename(filePath, '.json');
    console.log('Session file removed:', sessionId);
    this.sessions.delete(sessionId);
    this.emit('sessions-updated', this.getSessions());
  }

  private async processSessionFile(filePath: string): Promise<void> {
    try {
      const sessionId = path.basename(filePath, '.json');
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const hookSession: HookSession = JSON.parse(fileContent);

      // Convert hook session to our Session format
      const lastActivity = new Date(hookSession.last_activity);

      // Get latest message
      let latestMessage = undefined;
      if (hookSession.final_response) {
        latestMessage = {
          type: MessageType.Assistant,
          content: hookSession.final_response.substring(0, 200),
          timestamp: hookSession.end_time || hookSession.last_activity,
        };
      } else if (hookSession.messages && hookSession.messages.length > 0) {
        const lastMsg = hookSession.messages[hookSession.messages.length - 1];
        latestMessage = {
          type: lastMsg.role === 'user' ? MessageType.User : MessageType.Assistant,
          content: lastMsg.content.substring(0, 200),
          timestamp: lastMsg.timestamp,
        };
      } else if (hookSession.user_prompt) {
        latestMessage = {
          type: MessageType.User,
          content: hookSession.user_prompt.substring(0, 200),
          timestamp: hookSession.start_time,
        };
      }

      // Calculate status
      let status: SessionStatus;
      if (hookSession.status === 'completed') {
        status = SessionStatus.Stopped;
      } else if (hookSession.status === 'idle') {
        status = SessionStatus.Stopped;
      } else {
        // Check if truly active based on last activity
        const secondsSinceActivity = (Date.now() - lastActivity.getTime()) / 1000;
        status = secondsSinceActivity < 30 ? SessionStatus.Active : SessionStatus.Stopped;
      }

      const session: Session = {
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
    } catch (error) {
      console.error(`Error processing session file ${filePath}:`, error);
    }
  }

  private calculateStatus(lastActivity: Date): SessionStatus {
    const now = new Date();
    const secondsSinceActivity = (now.getTime() - lastActivity.getTime()) / 1000;
    return secondsSinceActivity < 30 ? SessionStatus.Active : SessionStatus.Stopped;
  }

  private updateSessionStatuses(): void {
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

  private cleanupOldSessions(): void {
    // Remove sessions older than 24 hours
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);

    for (const [id, session] of this.sessions) {
      const startTime = new Date(session.startTime).getTime();
      if (startTime < cutoffTime && session.status === SessionStatus.Stopped) {
        const filePath = path.join(this.sessionsDir, `${id}.json`);
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Cleaned up old session: ${id}`);
          }
        } catch (error) {
          console.error(`Error cleaning up session ${id}:`, error);
        }
      }
    }
  }

  getSessions(): Session[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
  }

  getActiveSessions(): Session[] {
    return this.getSessions().filter(s => s.status === SessionStatus.Active);
  }

  getSessionById(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}