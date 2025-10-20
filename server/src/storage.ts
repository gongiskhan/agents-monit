/**
 * File System Storage Manager
 * Handles all file operations for ~/.agent-bro directory
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { StreamEvent, HookEvent, SessionMetadata, EventFilters } from './types';

export class StorageManager {
  private dataDir: string;
  private sessionsDir: string;
  private hookLogsDir: string;
  private metadataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(os.homedir(), '.agent-bro');
    this.sessionsDir = path.join(this.dataDir, 'sessions');
    this.hookLogsDir = path.join(this.dataDir, 'hook-logs');
    this.metadataDir = path.join(this.dataDir, 'metadata');
  }

  /**
   * Initialize storage directories
   */
  async initializeStorage(): Promise<void> {
    console.log('Initializing Agent Bro storage at:', this.dataDir);

    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(this.sessionsDir, { recursive: true });
    await fs.mkdir(this.hookLogsDir, { recursive: true });
    await fs.mkdir(this.metadataDir, { recursive: true });

    // Create initial config if it doesn't exist
    const configPath = path.join(this.dataDir, 'config.json');
    if (!fsSync.existsSync(configPath)) {
      await this.writeConfig({
        server: {
          httpPort: 3001,
          wsPort: 3002,
          hookPort: 3003,
          host: '0.0.0.0',
        },
        storage: {
          dataDir: this.dataDir,
          claudeProjectsDir: path.join(os.homedir(), '.claude', 'projects'),
          retentionDays: 30,
          maxSessionSize: '100MB',
        },
        claudeCode: {
          cliPath: 'claude',
          defaultModel: 'sonnet',
          defaultAllowedTools: ['Read', 'Write', 'Edit', 'Bash'],
          timeout: 300000,
        },
        ui: {
          autoScroll: true,
          maxEventsDisplayed: 1000,
          theme: 'dark',
          compactMode: false,
        },
      });
    }

    // Create session index
    const sessionIndexPath = path.join(this.sessionsDir, 'index.json');
    if (!fsSync.existsSync(sessionIndexPath)) {
      await fs.writeFile(sessionIndexPath, JSON.stringify({ sessions: [] }, null, 2));
    }

    console.log('Storage initialized successfully');
  }

  /**
   * Write session stream output (append to JSONL file)
   */
  async writeSessionOutput(sessionId: string, event: StreamEvent): Promise<void> {
    const sessionDir = path.join(this.sessionsDir, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });

    const outputFile = path.join(sessionDir, 'stream-output.jsonl');
    const line = JSON.stringify(event) + '\n';

    await fs.appendFile(outputFile, line);
  }

  /**
   * Write hook event (append to daily JSONL file)
   */
  async writeHookEvent(event: HookEvent): Promise<void> {
    const date = new Date(event.timestamp).toISOString().split('T')[0];
    const dateDir = path.join(this.hookLogsDir, date);
    await fs.mkdir(dateDir, { recursive: true });

    const eventsFile = path.join(dateDir, 'events.jsonl');
    const line = JSON.stringify(event) + '\n';

    await fs.appendFile(eventsFile, line);
  }

  /**
   * Read session output events
   */
  async readSessionOutput(sessionId: string): Promise<StreamEvent[]> {
    const outputFile = path.join(this.sessionsDir, sessionId, 'stream-output.jsonl');

    try {
      const content = await fs.readFile(outputFile, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);
      return lines.map(line => JSON.parse(line));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Read hook events with filters
   */
  async readHookEvents(filters: EventFilters = {}): Promise<HookEvent[]> {
    const events: HookEvent[] = [];

    // Determine which date directories to read
    const dates = await this.getDateDirectories(filters.startDate, filters.endDate);

    for (const date of dates) {
      const eventsFile = path.join(this.hookLogsDir, date, 'events.jsonl');

      if (!fsSync.existsSync(eventsFile)) continue;

      const content = await fs.readFile(eventsFile, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);

      for (const line of lines) {
        try {
          const event = JSON.parse(line) as HookEvent;

          // Apply filters
          if (filters.sessionId && event.session_id !== filters.sessionId) continue;
          if (filters.eventType && event.hook_event_type !== filters.eventType) continue;

          events.push(event);
        } catch (error) {
          console.error('Error parsing hook event:', error);
        }
      }
    }

    // Apply limit
    if (filters.limit) {
      return events.slice(0, filters.limit);
    }

    return events;
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<SessionMetadata[]> {
    const sessionDirs = await fs.readdir(this.sessionsDir);
    const sessions: SessionMetadata[] = [];

    for (const dir of sessionDirs) {
      if (dir === 'index.json') continue;

      const metadataPath = path.join(this.sessionsDir, dir, 'metadata.json');

      try {
        const content = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(content) as SessionMetadata;
        sessions.push(metadata);
      } catch (error) {
        // Skip sessions without metadata
        console.warn(`No metadata for session: ${dir}`);
      }
    }

    // Sort by start time (most recent first)
    return sessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  /**
   * Get session metadata
   */
  async getSessionMetadata(sessionId: string): Promise<SessionMetadata | null> {
    const metadataPath = path.join(this.sessionsDir, sessionId, 'metadata.json');

    try {
      const content = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(content) as SessionMetadata;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update session metadata
   */
  async updateSessionMetadata(sessionId: string, data: Partial<SessionMetadata>): Promise<void> {
    const sessionDir = path.join(this.sessionsDir, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });

    const metadataPath = path.join(sessionDir, 'metadata.json');

    // Read existing metadata or create new
    let metadata: SessionMetadata;
    try {
      const content = await fs.readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(content);
    } catch (error) {
      metadata = {
        id: sessionId,
        startTime: new Date().toISOString(),
        status: 'running',
        eventCount: 0,
        hookEventCount: 0,
      };
    }

    // Update fields
    Object.assign(metadata, data);

    // Write atomically using temp file
    const tempPath = metadataPath + '.tmp';
    await fs.writeFile(tempPath, JSON.stringify(metadata, null, 2));
    await fs.rename(tempPath, metadataPath);
  }

  /**
   * Write config file
   */
  private async writeConfig(config: any): Promise<void> {
    const configPath = path.join(this.dataDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Get list of date directories between start and end dates
   */
  private async getDateDirectories(startDate?: string, endDate?: string): Promise<string[]> {
    try {
      const allDates = await fs.readdir(this.hookLogsDir);

      return allDates.filter(date => {
        if (startDate && date < startDate) return false;
        if (endDate && date > endDate) return false;
        return true;
      }).sort();
    } catch (error) {
      return [];
    }
  }

  /**
   * Get storage directory paths
   */
  getDirectories() {
    return {
      dataDir: this.dataDir,
      sessionsDir: this.sessionsDir,
      hookLogsDir: this.hookLogsDir,
      metadataDir: this.metadataDir,
    };
  }

  /**
   * Cleanup old sessions (based on retention policy)
   */
  async cleanupOldSessions(retentionDays: number = 30): Promise<void> {
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    const sessions = await this.listSessions();

    for (const session of sessions) {
      const startTime = new Date(session.startTime).getTime();

      if (startTime < cutoffTime && session.status !== 'running') {
        const sessionDir = path.join(this.sessionsDir, session.id);

        try {
          await fs.rm(sessionDir, { recursive: true, force: true });
          console.log(`Cleaned up old session: ${session.id}`);
        } catch (error) {
          console.error(`Error cleaning up session ${session.id}:`, error);
        }
      }
    }
  }
}
