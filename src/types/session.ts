export enum SessionStatus {
  Active = 'Active',
  Stopped = 'Stopped',
}

export enum MessageType {
  User = 'User',
  Assistant = 'Assistant',
  System = 'System',
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