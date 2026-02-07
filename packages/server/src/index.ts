export { BuildOverServer } from './server.js';
export { detectPort } from './port-detect.js';
export { detectFramework } from './reload/detector.js';
export { GitManager } from './git/manager.js';
export { SessionManager } from './session/manager.js';
export { ClaudeAgent } from './agent/claude.js';

export type {
  BuildOverConfig,
  Session,
  ChatMessage,
  AgentResponse,
  FileChange,
} from './types.js';

export type {
  GitBranch,
  GitDiff,
  MergeStrategy,
  MergeResult,
} from './git/types.js';

export type {
  ReloadStrategy,
  FrameworkInfo,
} from './reload/strategies.js';
