import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';

const execAsync = promisify(exec);

interface ClaudeProcess {
  pid: string;
  cwd: string;
  command: string;
}

interface ProcessSession {
  pid: string;
  projectPath: string;
  projectName: string;
  startTime: string;
  lastSeen: string;
  status: 'active' | 'stopped';
}

export class ClaudeProcessMonitor extends EventEmitter {
  private sessions: Map<string, ProcessSession> = new Map();
  private monitorInterval: NodeJS.Timeout | null = null;

  async startMonitoring(): Promise<void> {
    console.log('Starting Claude process monitoring...');

    // Initial scan
    await this.scanProcesses();

    // Set up periodic scanning
    this.monitorInterval = setInterval(async () => {
      await this.scanProcesses();
    }, 5000); // Check every 5 seconds
  }

  private async scanProcesses(): Promise<void> {
    try {
      // Find all Claude/claude processes - don't exclude agents-monit, we want to see ourselves too
      const { stdout: psOutput } = await execAsync(
        `ps aux | grep -E "[c]laude|[C]laude" | grep -v grep`
      );

      const lines = psOutput.trim().split('\n').filter(line => line.length > 0);
      const currentPids = new Set<string>();

      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length < 11) continue;

        const pid = parts[1];
        currentPids.add(pid);

        // Try to get the working directory of the process
        try {
          const { stdout: cwdOutput } = await execAsync(`lsof -p ${pid} 2>/dev/null | grep cwd | awk '{print $NF}'`);
          const cwd = cwdOutput.trim();

          if (cwd && cwd !== '/' && !cwd.includes('private/var')) {
            // Check if this is a project directory
            if (this.isProjectDirectory(cwd)) {
              const projectName = path.basename(cwd);

              if (this.sessions.has(pid)) {
                // Update existing session - always update lastSeen for active processes
                const session = this.sessions.get(pid)!;
                session.lastSeen = new Date().toISOString();
                session.status = 'active';
                console.log(`Updated active session: ${projectName} (PID: ${pid})`);
              } else {
                // New session found
                const session: ProcessSession = {
                  pid,
                  projectPath: cwd,
                  projectName,
                  startTime: new Date().toISOString(),
                  lastSeen: new Date().toISOString(),
                  status: 'active'
                };
                this.sessions.set(pid, session);
                console.log(`Found new Claude session: ${projectName} (PID: ${pid})`);
              }
            }
          }
        } catch (error) {
          // Process might have ended or we don't have permission
          continue;
        }
      }

      // Mark sessions as stopped if their process is gone
      for (const [pid, session] of this.sessions) {
        if (!currentPids.has(pid)) {
          if (session.status === 'active') {
            session.status = 'stopped';
            session.lastSeen = new Date().toISOString();
            console.log(`Claude session stopped: ${session.projectName} (PID: ${pid})`);
          }
        }
      }

      // Clean up old stopped sessions (older than 1 hour)
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      for (const [pid, session] of this.sessions) {
        if (session.status === 'stopped') {
          const lastSeen = new Date(session.lastSeen).getTime();
          if (lastSeen < oneHourAgo) {
            this.sessions.delete(pid);
          }
        }
      }

      this.emit('sessions-updated', Array.from(this.sessions.values()));
    } catch (error) {
      // No Claude processes running or error in command
      console.debug('No Claude processes found or error:', error);
    }
  }

  private isProjectDirectory(dirPath: string): boolean {
    // Exclude home directory and subdirectories that aren't actual projects
    const homeDir = os.homedir();
    const dirName = path.basename(dirPath);

    // Don't treat home dir itself or config dirs as projects
    if (dirPath === homeDir || dirPath === path.join(homeDir, '.claude')) {
      return false;
    }

    // Exclude user home directory subfolders that are clearly not projects
    const excludedNames = ['Desktop', 'Documents', 'Downloads', 'Pictures', '.claude', 'Library'];
    if (excludedNames.includes(dirName)) {
      return false;
    }

    // Check if directory has typical project indicators
    const indicators = [
      '.git',
      'package.json',
      'Cargo.toml',
      'pyproject.toml',
      'requirements.txt',
      'Gemfile',
      'go.mod',
      'pom.xml',
      'build.gradle'
    ];

    for (const indicator of indicators) {
      if (fs.existsSync(path.join(dirPath, indicator))) {
        return true;
      }
    }

    return false;
  }

  getSessions(): ProcessSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveSessions(): ProcessSession[] {
    return this.getSessions().filter(s => s.status === 'active');
  }

  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }
}

// Alternative approach: Monitor Claude's history.jsonl file
export class ClaudeHistoryMonitor extends EventEmitter {
  private historyPath: string;
  private lastSize: number = 0;
  private sessions: Map<string, any> = new Map();

  constructor() {
    super();
    this.historyPath = path.join(os.homedir(), '.claude', 'history.jsonl');
  }

  async startMonitoring(): Promise<void> {
    console.log('Starting Claude history monitoring...');

    // Watch the history file for changes
    if (fs.existsSync(this.historyPath)) {
      fs.watchFile(this.historyPath, { interval: 2000 }, async () => {
        await this.processHistory();
      });

      // Initial processing
      await this.processHistory();
    }
  }

  private async processHistory(): Promise<void> {
    try {
      const stats = fs.statSync(this.historyPath);
      if (stats.size === this.lastSize) return;

      const content = fs.readFileSync(this.historyPath, 'utf-8');
      const lines = content.trim().split('\n');

      // Group by project
      const projectSessions = new Map<string, any>();

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.project) {
            const projectPath = entry.project;
            const projectName = path.basename(projectPath);
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
          // Skip invalid JSON lines
        }
      }

      // Convert to sessions with status
      const now = Date.now();
      for (const [projectPath, data] of projectSessions) {
        const timeSinceLastActivity = (now - data.lastActivity) / 1000;
        const status = timeSinceLastActivity < 300 ? 'active' : 'stopped'; // 5 minutes threshold

        this.sessions.set(projectPath, {
          id: projectPath,
          projectPath,
          projectName: data.projectName,
          startTime: new Date(data.firstActivity).toISOString(),
          lastActivity: new Date(data.lastActivity).toISOString(),
          status,
          commandCount: data.commandCount,
          latestCommand: data.commands[data.commands.length - 1]?.display
        });
      }

      this.lastSize = stats.size;
      this.emit('sessions-updated', Array.from(this.sessions.values()));
    } catch (error) {
      console.error('Error processing history:', error);
    }
  }

  getSessions(): any[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
  }

  stopMonitoring(): void {
    fs.unwatchFile(this.historyPath);
  }
}