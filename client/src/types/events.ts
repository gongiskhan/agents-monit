/**
 * Client-side type definitions for events and sessions
 */

export interface StreamEvent {
  type: 'system' | 'user' | 'assistant' | 'result';
  subtype?: string;
  data: any;
  timestamp: string;
  sessionId: string;
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

export interface WebSocketMessage {
  type: 'stream-event' | 'hook-event' | 'transcript-update' | 'session-status' | 'connection-status';
  data: any;
  timestamp: string;
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

export type EventType = StreamEvent | HookEvent;
