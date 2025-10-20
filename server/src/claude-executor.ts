/**
 * Claude Code Subprocess Executor
 * Spawns and manages Claude Code processes with stream-json I/O
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { StreamEvent, SessionExecution, ExecuteOptions } from './types';
import { StorageManager } from './storage';

interface ActiveSession {
  sessionId: string;
  process: ChildProcess;
  startTime: string;
  status: 'running' | 'completed' | 'error' | 'interrupted';
  events: StreamEvent[];
}

export class ClaudeExecutor extends EventEmitter {
  private activeSessions: Map<string, ActiveSession> = new Map();
  private storage: StorageManager;

  constructor(storage: StorageManager) {
    super();
    this.storage = storage;
  }

  /**
   * Execute a new Claude Code command
   */
  async executeCommand(prompt: string, options: ExecuteOptions = {}): Promise<SessionExecution> {
    const sessionId = uuidv4();
    const startTime = new Date().toISOString();

    console.log(`[${sessionId}] Executing new command`);

    // Build Claude CLI arguments
    const args = this.buildClaudeArgs(options);

    // Spawn Claude Code process
    const claudeProcess = spawn('claude', args, {
      cwd: options.workingDirectory || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Create session
    const session: ActiveSession = {
      sessionId,
      process: claudeProcess,
      startTime,
      status: 'running',
      events: [],
    };

    this.activeSessions.set(sessionId, session);

    // Initialize session metadata
    await this.storage.updateSessionMetadata(sessionId, {
      id: sessionId,
      startTime,
      status: 'running',
      firstPrompt: prompt.substring(0, 200),
      projectPath: options.workingDirectory,
      model: options.model || 'sonnet',
      eventCount: 0,
      hookEventCount: 0,
    });

    // Set up event handlers
    this.setupProcessHandlers(session);

    // Send initial user message
    const userMessage = {
      type: 'user',
      content: prompt,
      timestamp: startTime,
    };

    try {
      if (claudeProcess.stdin) {
        claudeProcess.stdin.write(JSON.stringify(userMessage) + '\n');
        claudeProcess.stdin.end();
      }
    } catch (error) {
      console.error(`[${sessionId}] Error writing to stdin:`, error);
    }

    // Return session execution info
    const outputFile = `${this.storage.getDirectories().sessionsDir}/${sessionId}/stream-output.jsonl`;

    return {
      sessionId,
      startTime,
      status: 'running',
      events: [],
      outputFile,
    };
  }

  /**
   * Continue an existing session
   */
  async continueSession(sessionId: string, prompt: string): Promise<SessionExecution> {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found or not running`);
    }

    const timestamp = new Date().toISOString();

    // Send user message to existing process
    const userMessage = {
      type: 'user',
      content: prompt,
      timestamp,
    };

    try {
      if (session.process.stdin) {
        session.process.stdin.write(JSON.stringify(userMessage) + '\n');
      }
    } catch (error) {
      console.error(`[${sessionId}] Error writing to stdin:`, error);
      throw error;
    }

    const outputFile = `${this.storage.getDirectories().sessionsDir}/${sessionId}/stream-output.jsonl`;

    return {
      sessionId,
      startTime: session.startTime,
      status: session.status,
      events: session.events,
      outputFile,
    };
  }

  /**
   * Interrupt a running session
   */
  async interruptSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    console.log(`[${sessionId}] Interrupting session`);

    session.status = 'interrupted';
    session.process.kill('SIGTERM');

    // Update metadata
    await this.storage.updateSessionMetadata(sessionId, {
      status: 'interrupted',
      endTime: new Date().toISOString(),
    });

    this.activeSessions.delete(sessionId);
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId: string): SessionExecution | null {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      return null;
    }

    const outputFile = `${this.storage.getDirectories().sessionsDir}/${sessionId}/stream-output.jsonl`;

    return {
      sessionId,
      startTime: session.startTime,
      endTime: session.status !== 'running' ? new Date().toISOString() : undefined,
      status: session.status,
      events: session.events,
      outputFile,
    };
  }

  /**
   * Set up process event handlers
   */
  private setupProcessHandlers(session: ActiveSession): void {
    const { sessionId, process: claudeProcess } = session;

    let stdoutBuffer = '';

    // Handle stdout (stream-json output)
    if (claudeProcess.stdout) {
      claudeProcess.stdout.on('data', async (data: Buffer) => {
      stdoutBuffer += data.toString();

      // Process complete JSON lines
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const event = JSON.parse(line) as any;

            const streamEvent: StreamEvent = {
              type: event.type || 'system',
              subtype: event.subtype,
              data: event,
              timestamp: new Date().toISOString(),
              sessionId,
            };

            // Store event
            session.events.push(streamEvent);
            await this.storage.writeSessionOutput(sessionId, streamEvent);

            // Update metadata
            await this.storage.updateSessionMetadata(sessionId, {
              eventCount: session.events.length,
            });

            // Emit event to WebSocket clients
            this.emit('stream-event', streamEvent);

            console.log(`[${sessionId}] Event: ${streamEvent.type}/${streamEvent.subtype || 'none'}`);
          } catch (error) {
            console.error(`[${sessionId}] Error parsing JSON:`, line, error);
          }
        }
      }
    });
    }

    // Handle stderr
    if (claudeProcess.stderr) {
      claudeProcess.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        console.error(`[${sessionId}] stderr:`, output);
      });
    }

    // Handle process exit
    claudeProcess.on('exit', async (code, signal) => {
      console.log(`[${sessionId}] Process exited with code ${code}, signal ${signal}`);

      const endTime = new Date().toISOString();

      if (session.status === 'running') {
        session.status = code === 0 ? 'completed' : 'error';
      }

      // Update metadata
      await this.storage.updateSessionMetadata(sessionId, {
        status: session.status,
        endTime,
      });

      // Emit session status change
      this.emit('session-status', {
        sessionId,
        status: session.status,
        endTime,
      });

      this.activeSessions.delete(sessionId);
    });

    // Handle process errors
    claudeProcess.on('error', async (error) => {
      console.error(`[${sessionId}] Process error:`, error);

      session.status = 'error';

      await this.storage.updateSessionMetadata(sessionId, {
        status: 'error',
        endTime: new Date().toISOString(),
      });

      this.activeSessions.delete(sessionId);
    });
  }

  /**
   * Build Claude CLI arguments
   */
  private buildClaudeArgs(options: ExecuteOptions): string[] {
    const args: string[] = [
      '-p', // Programmatic mode
      '--output-format', 'stream-json',
      '--input-format', 'stream-json',
    ];

    if (options.model) {
      args.push('--model', options.model);
    }

    if (options.allowedTools && options.allowedTools.length > 0) {
      args.push('--allowed-tools', options.allowedTools.join(','));
    }

    if (options.disallowedTools && options.disallowedTools.length > 0) {
      args.push('--disallowed-tools', options.disallowedTools.join(','));
    }

    if (options.maxTurns) {
      args.push('--max-turns', options.maxTurns.toString());
    }

    if (options.verbose) {
      args.push('--verbose');
    }

    if (options.appendSystemPrompt) {
      args.push('--append-system-prompt', options.appendSystemPrompt);
    }

    return args;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.activeSessions.keys());
  }
}
