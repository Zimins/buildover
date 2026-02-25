export interface BuildOverConfig {
  targetUrl: string;
  port?: number;
  widgetPath?: string;
  projectRoot?: string;
  /** Root of the target app (for worktree + dev server). Defaults to projectRoot. */
  targetRoot?: string;
  apiKey?: string;
}

export interface Session {
  id: string;
  branchName: string;
  createdAt: Date;
  lastActivity: Date;
  status: 'active' | 'paused' | 'ended';
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AgentResponse {
  type: 'text' | 'tool_use' | 'error' | 'complete';
  content: string;
  toolUse?: {
    name: string;
    input: Record<string, any>;
  };
}

export interface FileChange {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  diff?: string;
}

export interface ShareLink {
  linkId: string;
  worktreePath: string;
  branchName: string;
  baseBranch: string;
  devServerPort: number;
  status: 'creating' | 'ready' | 'stopped' | 'error';
  createdAt: Date;
  description?: string;
}
