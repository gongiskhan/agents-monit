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
  source?: 'hook' | 'process' | 'history' | 'codex';
  gitBranch?: string;
  gitRepo?: string;
  filePath?: string; // Optional for backward compatibility
}
