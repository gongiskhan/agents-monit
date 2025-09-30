import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { Session, SessionStatus, MessageType } from './types';
import { ClaudeProcessMonitor, ClaudeHistoryMonitor } from './claudeProcessMonitor';

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
  private processMonitor: ClaudeProcessMonitor | null = null;
  private historyMonitor: ClaudeHistoryMonitor | null = null;

  constructor() {
    super();
    this.sessionsDir = path.join(os.homedir(), '.claude', 'active_sessions');
    this.processMonitor = new ClaudeProcessMonitor();
    this.historyMonitor = new ClaudeHistoryMonitor();
  }

  async startWatching(): Promise<void> {
    console.log('Starting comprehensive session monitoring...');
    console.log('Watching sessions directory:', this.sessionsDir);

    // Ensure the sessions directory exists
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }

    // Start process monitoring for all Claude instances
    if (this.processMonitor) {
      await this.processMonitor.startMonitoring();
      this.processMonitor.on('sessions-updated', (processSessions) => {
        this.mergeProcessSessions(processSessions);
      });
    }

    // Start history monitoring for all projects
    if (this.historyMonitor) {
      await this.historyMonitor.startMonitoring();
      this.historyMonitor.on('sessions-updated', (historySessions) => {
        this.mergeHistorySessions(historySessions);
      });
    }

    // Initial scan of hook-created sessions
    await this.scanDirectory();

    // Set up file watcher for hook-created session files
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
      let finalLastActivity = lastActivity.toISOString();

      if (hookSession.status === 'completed') {
        status = SessionStatus.Stopped;
      } else if (hookSession.status === 'idle') {
        status = SessionStatus.Stopped;
      } else {
        // Check if truly active based on last activity
        const secondsSinceActivity = (Date.now() - lastActivity.getTime()) / 1000;
        status = secondsSinceActivity < 300 ? SessionStatus.Active : SessionStatus.Stopped;

        // If active, use current time as last activity
        if (status === SessionStatus.Active) {
          finalLastActivity = new Date().toISOString();
        }
      }

      const session: Session = {
        id: sessionId,
        projectPath: hookSession.project_path || '',
        projectName: hookSession.project_name || 'Unknown Project',
        lastActivity: finalLastActivity,
        status,
        latestMessage,
        messageCount: (hookSession.messages?.length || 0) + (hookSession.tool_calls?.length || 0),
        startTime: hookSession.start_time,
        userPrompt: hookSession.user_prompt,
        toolCalls: hookSession.tool_calls,
        finalResponse: hookSession.final_response,
        source: 'hook'
      };

      console.log(`Hook session ${hookSession.project_name}: status=${status}, lastActivity=${finalLastActivity}`);

      this.sessions.set(sessionId, session);
    } catch (error) {
      console.error(`Error processing session file ${filePath}:`, error);
    }
  }

  private calculateStatus(lastActivity: Date): SessionStatus {
    const now = new Date();
    const secondsSinceActivity = (now.getTime() - lastActivity.getTime()) / 1000;
    // Increase threshold to 5 minutes (300 seconds) for better active detection
    return secondsSinceActivity < 300 ? SessionStatus.Active : SessionStatus.Stopped;
  }

  private updateSessionStatuses(): void {
    let hasChanges = false;

    for (const [id, session] of this.sessions) {
      // Don't recalculate status for process-based sessions - they manage their own status
      if (session.source === 'process') {
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

  private mergeProcessSessions(processSessions: any[]): void {
    for (const ps of processSessions) {
      const sessionId = `process-${ps.pid}`;

      // Check if we have hook or history data for this project to get real lastActivity
      let realLastActivity: Date | null = null;
      let hasHookData = false;

      // Look for hook sessions from the same project
      for (const [existingId, existingSession] of this.sessions.entries()) {
        if (existingSession.source === 'hook' &&
            existingSession.projectPath === ps.projectPath) {
          realLastActivity = new Date(existingSession.lastActivity);
          hasHookData = true;
          break;
        }
      }

      // Determine true activity status based on real last activity
      let status: SessionStatus;
      let lastActivity: string;

      if (ps.status === 'stopped') {
        // Process is not running
        status = SessionStatus.Stopped;
        lastActivity = ps.lastSeen || new Date().toISOString();
      } else if (hasHookData && realLastActivity) {
        // Process is running and we have hook data - check if truly active
        const secondsSinceActivity = (Date.now() - realLastActivity.getTime()) / 1000;
        status = secondsSinceActivity < 300 ? SessionStatus.Active : SessionStatus.Stopped;
        lastActivity = realLastActivity.toISOString();
      } else {
        // Process is running but no hook data - consider it stopped (idle)
        status = SessionStatus.Stopped;
        lastActivity = ps.lastSeen || new Date().toISOString();
      }

      const session: Session = {
        id: sessionId,
        projectPath: ps.projectPath,
        projectName: ps.projectName,
        lastActivity: lastActivity,
        status: status,
        latestMessage: undefined,
        messageCount: 0,
        startTime: ps.startTime,
        source: 'process'
      };

      console.log(`Process session ${ps.projectName}: status=${status}, lastActivity=${lastActivity}, hasHookData=${hasHookData}`);

      // Always update process sessions to keep them current
      this.sessions.set(sessionId, session);
    }
    this.emit('sessions-updated', this.getSessions());
  }

  private mergeHistorySessions(historySessions: any[]): void {
    for (const hs of historySessions) {
      const sessionId = `history-${path.basename(hs.projectPath)}`;

      // Don't overwrite hook-created sessions or process sessions
      if (!this.sessions.has(sessionId)) {
        // Check if there's recent activity (within 5 minutes)
        const lastActivityDate = new Date(hs.lastActivity);
        const secondsSinceActivity = (Date.now() - lastActivityDate.getTime()) / 1000;
        const isRecentlyActive = secondsSinceActivity < 300;

        const session: Session = {
          id: sessionId,
          projectPath: hs.projectPath,
          projectName: hs.projectName,
          lastActivity: hs.lastActivity,
          status: isRecentlyActive ? SessionStatus.Active : SessionStatus.Stopped,
          latestMessage: hs.latestCommand ? {
            type: MessageType.User,
            content: hs.latestCommand.substring(0, 200),
            timestamp: hs.lastActivity
          } : undefined,
          messageCount: hs.commandCount || 0,
          startTime: hs.startTime,
          source: 'history'
        };

        console.log(`History session ${hs.projectName}: status=${session.status}, lastActivity=${hs.lastActivity}, secondsSince=${Math.round(secondsSinceActivity)}`);
        this.sessions.set(sessionId, session);
      }
    }
    this.emit('sessions-updated', this.getSessions());
  }

  getSessions(): Session[] {
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    const homeDir = os.homedir();

    // Filter sessions with activity in last 30 minutes
    const recentSessions = Array.from(this.sessions.values())
      .filter(session => {
        const lastActivityTime = new Date(session.lastActivity).getTime();
        if (lastActivityTime <= thirtyMinutesAgo) return false;

        // Filter out invalid/unwanted sessions
        const projectName = session.projectName.toLowerCase();
        const projectPath = session.projectPath;

        // Exclude sessions with bad project names
        if (projectName === 'unknown' || projectName === 'unknown project') {
          console.log(`Filtering out session with unknown project name: ${session.id}`);
          return false;
        }

        // Exclude home directory itself
        if (projectPath === homeDir) {
          console.log(`Filtering out home directory session: ${projectPath}`);
          return false;
        }

        // Exclude config directories
        const excludedPaths = ['.claude', 'Library', 'Desktop', 'Documents', 'Downloads'];
        const baseName = path.basename(projectPath);
        if (excludedPaths.includes(baseName)) {
          console.log(`Filtering out excluded directory: ${baseName}`);
          return false;
        }

        // Exclude direct subdirectories of home that are just user folders
        const parentDir = path.dirname(projectPath);
        if (parentDir === homeDir && !projectPath.includes('/dev/') && !projectPath.includes('/projects/')) {
          console.log(`Filtering out home subdirectory: ${projectPath}`);
          return false;
        }

        return true;
      });

    // Deduplicate by projectPath, keeping most recent
    const sessionsByProject = new Map<string, Session>();

    for (const session of recentSessions) {
      const existing = sessionsByProject.get(session.projectPath);
      if (!existing || new Date(session.lastActivity).getTime() > new Date(existing.lastActivity).getTime()) {
        sessionsByProject.set(session.projectPath, session);
      }
    }

    // Return sorted by active status first, then by most recent activity
    return Array.from(sessionsByProject.values())
      .sort((a, b) => {
        // Active sessions come first
        if (a.status !== b.status) {
          return a.status === SessionStatus.Active ? -1 : 1;
        }
        // Within same status, sort by most recent first
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
      });
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