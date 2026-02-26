// Client-to-Server messages
export interface InitMessage {
  type: 'init';
  sessionId: string;
  linkId?: string;
}

export interface ChatMessage {
  type: 'chat';
  content: string;
  createBranch?: boolean;
}

export interface ClearMessage {
  type: 'clear';
}

export interface DesignElementInfo {
  selector: string;
  tagName: string;
  textContent: string;
  classes: string[];
  id: string;
  computedStyles: Record<string, string>;
}

export interface DesignChangeMessage {
  type: 'design.change';
  selector: string;
  property: string;
  value: string;
  oldValue: string;
  elementInfo: {
    tagName: string;
    classes: string[];
    id: string;
    textContent: string;
    computedStyles: Record<string, string>;
  };
}

export type ClientMessage = InitMessage | ChatMessage | ClearMessage | DesignChangeMessage;

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

export interface CommitEntry {
  hash: string;
  shortHash: string;
  message: string;
  date: string;
}

export interface CommitCreatedMessage {
  type: 'commit.created';
  commit: CommitEntry;
}

export interface ClearedMessage {
  type: 'cleared';
}

export type ServerMessage =
  | StreamMessage
  | StreamEndMessage
  | FileChangedMessage
  | StatusMessage
  | ErrorMessage
  | CommitCreatedMessage
  | ClearedMessage;

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

export interface ShareLinkInfo {
  linkId: string;
  branchName: string;
  baseBranch: string;
  status: 'creating' | 'ready' | 'stopped' | 'error';
  createdAt: string;
  description?: string;
  url?: string; // server-provided URL (includes proxyPort)
  mergeStatus?: 'requested' | 'merged' | 'rejected';
}
