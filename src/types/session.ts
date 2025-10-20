export enum SessionStatus {
  Active = 'active',
  Stopped = 'stopped',
}

export enum MessageType {
  User = 'user',
  Assistant = 'assistant',
  System = 'system',
}

export interface Message {
  content: string;
  timestamp: string;
  type: MessageType;
}

export type TabCategory = 'current' | 'on-hold' | 'archive';

export interface Session {
  id: string;
  projectPath: string;
  projectName: string;
  lastActivity: string;
  status: SessionStatus;
  latestMessage?: {
    type: MessageType;
    content: string;
    timestamp: string;
  };
  messageCount: number;
  startTime: string;
  userPrompt?: string;
  toolCalls?: Array<{
    tool: string;
    timestamp: string;
    description: string;
  }>;
  finalResponse?: string;
  source?: 'hook' | 'process' | 'history' | 'codex' | 'manual';
  gitBranch?: string;
  gitRepo?: string;
  filePath?: string; // Optional for backward compatibility

  // New fields for enhanced organization
  tabCategory?: TabCategory; // Where the session is organized
  isManual?: boolean; // If this is a manually created session
  customName?: string; // User-editable name (overrides projectName)
  lastManualActiveTime?: string; // For tracking manual session auto-deactivation
}
