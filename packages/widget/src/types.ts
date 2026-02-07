// Client-to-Server messages
export interface ChatMessage {
  type: 'chat';
  content: string;
  createBranch?: boolean;
}

export type ClientMessage = ChatMessage;

// Server-to-Client messages
export interface StreamMessage {
  type: 'stream';
  content: string;
  messageId?: string;
}

export interface StreamEndMessage {
  type: 'stream.end';
  messageId: string;
}

export interface FileChangedMessage {
  type: 'file.changed';
  path: string;
  additions: number;
  deletions: number;
  diff?: string;
}

export interface StatusMessage {
  type: 'status';
  status: 'analyzing' | 'editing' | 'done' | 'idle';
  message?: string;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type ServerMessage =
  | StreamMessage
  | StreamEndMessage
  | FileChangedMessage
  | StatusMessage
  | ErrorMessage;

// UI State
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  streaming?: boolean;
}

export interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  diff?: string;
  expanded?: boolean;
}

export type AIStatus = 'idle' | 'analyzing' | 'editing' | 'done';
