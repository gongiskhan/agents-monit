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
  projectName: string;
  projectPath: string;
  status: SessionStatus;
  lastActivity: string;
  latestMessage?: Message;
  filePath: string;
}