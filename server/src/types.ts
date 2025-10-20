/**
 * Type definitions for Agent Bro Server
 */

export interface StreamEvent {
  type: 'system' | 'user' | 'assistant' | 'result';
  subtype?: string;
  data: any;
  timestamp: string;
  sessionId: string;
}

export interface SessionExecution {
  sessionId: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'completed' | 'error' | 'interrupted';
  events: StreamEvent[];
  outputFile: string;
}

export interface ExecuteOptions {
  model?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  maxTurns?: number;
  verbose?: boolean;
  appendSystemPrompt?: string;
  workingDirectory?: string;
}

export interface HookEvent {
  session_id: string;
  hook_event_type: string;
  timestamp: string;
  payload: any;
  source_app?: string;
}

export interface SessionMetadata {
  id: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'completed' | 'error' | 'interrupted';
  firstPrompt?: string;
  projectPath?: string;
  model?: string;
  eventCount: number;
  hookEventCount: number;
}

export interface EventFilters {
  sessionId?: string;
  eventType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface TranscriptMessage {
  type: 'user' | 'assistant' | 'summary' | 'system';
  message: any;
  uuid: string;
  parentUuid?: string;
  timestamp: string;
  sessionId: string;
}

export interface WebSocketMessage {
  type: 'stream-event' | 'hook-event' | 'transcript-update' | 'session-status' | 'connection-status';
  data: any;
  timestamp: string;
}

export interface ClientMessage {
  type: 'execute-command' | 'continue-session' | 'interrupt-session' | 'subscribe-session' | 'unsubscribe-session';
  data: any;
}

export interface AgentBroConfig {
  server: {
    httpPort: number;
    wsPort: number;
    hookPort: number;
    host: string;
  };
  storage: {
    dataDir: string;
    claudeProjectsDir: string;
    retentionDays: number;
    maxSessionSize: string;
  };
  claudeCode: {
    cliPath: string;
    defaultModel: string;
    defaultAllowedTools: string[];
    timeout: number;
  };
  ui: {
    autoScroll: boolean;
    maxEventsDisplayed: number;
    theme: string;
    compactMode: boolean;
  };
}
