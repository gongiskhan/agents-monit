/**
 * Codex Process Monitor
 *
 * Monitors Codex sessions by watching running Codex processes
 * Uses lsof to determine working directory of each process
 *
 * Much simpler and more reliable than file watching!
 */

import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { Session, SessionStatus } from './types';

const execAsync = promisify(exec);

interface CodexProcess {
  pid: number;
  projectPath: string;
  projectName: string;
  lastSeen: string;
}

export class CodexMonitor extends EventEmitter {
  private sessions: Map<string, Session> = new Map();
  private processes: Map<number, CodexProcess> = new Map();
  private scanInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  /**
   * Start monitoring Codex processes
   */
  async startWatching(): Promise<void> {
    console.log('[CodexMonitor] Starting Codex process monitoring...');

    // Initial scan
    await this.scanProcesses();

    // Scan every 3 seconds
    this.scanInterval = setInterval(async () => {
      await this.scanProcesses();
    }, 3000);

    console.log('[CodexMonitor] Codex monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopWatching(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('[CodexMonitor] Codex monitoring stopped');
  }

  /**
   * Scan for running Codex processes
   */
  private async scanProcesses(): Promise<void> {
    try {
      // Find all running codex processes
      const { stdout } = await execAsync('ps aux | grep -i codex | grep -v grep | awk \'{print $2}\'');
      const pids = stdout
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(pid => parseInt(pid, 10))
        .filter(pid => !isNaN(pid));

      const currentPids = new Set<number>();

      for (const pid of pids) {
        currentPids.add(pid);

        // Get working directory using lsof
        try {
          const { stdout: lsofOutput } = await execAsync(`lsof -p ${pid} 2>/dev/null | grep cwd | awk '{print $NF}'`);
          const projectPath = lsofOutput.trim();

          if (!projectPath || projectPath === '/') {
            continue;
          }

          const projectName = path.basename(projectPath);
          const now = new Date().toISOString();

          // Update or create process record
          if (!this.processes.has(pid)) {
            // New process discovered
            this.processes.set(pid, {
              pid,
              projectPath,
              projectName,
              lastSeen: now
            });

            console.log(`[CodexMonitor] New Codex process: ${projectName} (pid: ${pid})`);
          } else {
            // Update existing process
            const proc = this.processes.get(pid)!;
            proc.lastSeen = now;
            proc.projectPath = projectPath;
            proc.projectName = projectName;
          }

          // Create or update session
          const sessionId = `codex-${pid}`;
          const existingSession = this.sessions.get(sessionId);

          if (!existingSession) {
            // Create new session only if this is a fresh process
            // Check if we've seen activity in this project recently
            const recentActivity = await this.hasRecentActivity(projectPath);

            if (!recentActivity) {
              console.log(`[CodexMonitor] Skipping stale project: ${projectName} (no recent activity)`);
              continue;
            }

            const session: Session = {
              id: sessionId,
              projectPath,
              projectName,
              userPrompt: `Working in ${projectName}`,
              startTime: now,
              lastActivity: now,
              status: SessionStatus.Active,
              source: 'codex',
              messageCount: 0
            };

            this.sessions.set(sessionId, session);
            this.emit('session-updated', session);
            console.log(`[CodexMonitor] Created session for ${projectName}`);
          } else {
            // Update existing session
            existingSession.lastActivity = now;
            existingSession.status = SessionStatus.Active;
            existingSession.projectPath = projectPath;
            existingSession.projectName = projectName;
            this.emit('session-updated', existingSession);
          }
        } catch (error) {
          // lsof failed for this PID - might be a short-lived process
          console.log(`[CodexMonitor] Could not get info for PID ${pid}`);
        }
      }

      // Mark stopped processes
      for (const [pid, proc] of this.processes.entries()) {
        if (!currentPids.has(pid)) {
          // Process no longer running
          const sessionId = `codex-${pid}`;
          const session = this.sessions.get(sessionId);

          if (session && session.status === SessionStatus.Active) {
            session.status = SessionStatus.Stopped;
            session.lastActivity = proc.lastSeen;
            this.emit('session-updated', session);
            console.log(`[CodexMonitor] Codex process stopped: ${proc.projectName} (pid: ${pid})`);
          }

          // Remove old processes (keep for 5 minutes after stopping)
          const lastSeenTime = new Date(proc.lastSeen).getTime();
          const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

          if (lastSeenTime < fiveMinutesAgo) {
            this.processes.delete(pid);
          }
        }
      }
    } catch (error) {
      console.error('[CodexMonitor] Error scanning processes:', error);
    }
  }

  /**
   * Check if a project has had recent activity in Codex log
   */
  private async hasRecentActivity(projectPath: string): Promise<boolean> {
    try {
      // Check if codex log has recent entries for this project (last 10 minutes)
      const logFile = require('path').join(require('os').homedir(), '.codex', 'log', 'codex-tui.log');
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // Get last 200 lines of log and check for this project path
      const cmd = `tail -200 "${logFile}" 2>/dev/null | grep -c "${projectPath}" || echo 0`;
      const { stdout } = await execAsync(cmd);
      const count = parseInt(stdout.trim(), 10);

      // If we found mentions of this project in recent logs, consider it active
      return count > 0;
    } catch (error) {
      // If we can't check, assume it's active (conservative approach)
      return true;
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
