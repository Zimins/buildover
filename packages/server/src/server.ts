import express from 'express';
import type { Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { createRequire } from 'module';
import chalk from 'chalk';
import { BuildOverConfig, AgentResponse, FileChange } from './types.js';
import { createProxy } from './proxy.js';
import { SessionManager } from './session/manager.js';
import { GitManager } from './git/manager.js';
import { AnthropicAgent } from './agent/anthropic-agent.js';

export class BuildOverServer {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private config: BuildOverConfig & { port: number; widgetPath: string; projectRoot: string };
  private sessionManager: SessionManager;
  private gitManager: GitManager;
  private agents: Map<string, AnthropicAgent> = new Map();
  private sessionContexts: Map<string, { messageId: string; content: string }> = new Map();
  private sessionWebSockets: Map<string, WebSocket> = new Map();

  private static resolveWidgetPath(): string {
    try {
      const require = createRequire(import.meta.url);
      return require.resolve('buildover-widget/dist/widget.js');
    } catch {
      return join(process.cwd(), 'node_modules/buildover-widget/dist/widget.js');
    }
  }

  constructor(config: BuildOverConfig) {
    this.config = {
      port: 4100,
      widgetPath: BuildOverServer.resolveWidgetPath(),
      projectRoot: process.cwd(),
      ...config,
    };

    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ noServer: true });

    this.gitManager = new GitManager(this.config.projectRoot);
    this.sessionManager = new SessionManager(this.gitManager);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use((req, _res, next) => {
      console.log(chalk.gray(`${req.method} ${req.path}`));
      next();
    });
  }

  private setupRoutes(): void {
    this.app.get('/buildover/widget.js', async (_req: Request, res: Response) => {
      try {
        const widgetContent = await readFile(this.config.widgetPath, 'utf-8');
        res.type('application/javascript').send(widgetContent);
      } catch (error) {
        console.error(chalk.red('Failed to serve widget:'), error);
        res.status(404).send('Widget not found');
      }
    });

    this.app.post('/buildover/api/session/create', async (req: Request, res: Response) => {
      try {
        const { description } = req.body;
        const session = await this.sessionManager.create(description || 'New session');
        res.json(session);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/buildover/api/session/:id', (req: Request, res: Response) => {
      const session = this.sessionManager.get(req.params.id);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
      } else {
        res.json(session);
      }
    });

    this.app.get('/buildover/api/sessions', (_req: Request, res: Response) => {
      const sessions = this.sessionManager.list();
      res.json(sessions);
    });

    this.app.post('/buildover/api/session/:id/end', async (req: Request, res: Response) => {
      try {
        const { shouldMerge } = req.body;
        await this.sessionManager.end(req.params.id, shouldMerge || false);
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/buildover/api/diff', async (req: Request, res: Response) => {
      try {
        const branch = req.query.branch as string | undefined;
        const diff = await this.gitManager.getDiff(branch);
        res.json(diff);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/buildover/api/branches', async (_req: Request, res: Response) => {
      try {
        const branches = await this.gitManager.listBranches();
        res.json(branches);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/buildover/api/commits', async (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string || '30', 10);
        const commits = await this.gitManager.getCommitHistory(limit);
        res.json(commits);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/buildover/api/restore', async (req: Request, res: Response) => {
      try {
        const { hash } = req.body;
        if (!hash) {
          res.status(400).json({ error: 'hash is required' });
          return;
        }
        await this.gitManager.restore(hash);
        console.log(chalk.green(`[Git] Restored to ${hash.substring(0, 7)}`));
        res.json({ success: true });
      } catch (error: any) {
        console.error(chalk.red('[Git] Restore failed:'), error.message);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.use(createProxy(this.config.targetUrl));
  }

  private setupWebSocket(): void {
    this.server.on('upgrade', (request, socket, head) => {
      const pathname = new URL(request.url || '', 'http://localhost').pathname;
      console.log(chalk.magenta(`[WS] Upgrade request: ${pathname}`));

      if (pathname === '/buildover/ws') {
        console.log(chalk.magenta('[WS] Handling BuildOver WebSocket upgrade'));
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      } else {
        console.log(chalk.gray(`[WS] Ignoring upgrade for: ${pathname} (not /buildover/ws)`));
      }
    });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log(chalk.green('[WS] Client connected to /buildover/ws'));

      let sessionId: string | null = null;

      ws.on('message', async (data) => {
        const raw = data.toString();
        console.log(chalk.magenta(`[WS] Received message: ${raw.substring(0, 200)}`));

        try {
          const message = JSON.parse(raw);
          console.log(chalk.magenta(`[WS] Message type: ${message.type}`));

          if (message.type === 'init') {
            sessionId = message.sessionId as string;
            this.sessionWebSockets.set(sessionId, ws);
            console.log(chalk.blue(`[WS] Session registered: ${sessionId} (agent exists: ${this.agents.has(sessionId)})`));
          } else if (message.type === 'chat') {
            if (!sessionId) {
              sessionId = `session-${Date.now()}`;
              this.sessionWebSockets.set(sessionId, ws);
              console.log(chalk.blue(`[WS] Auto-created session: ${sessionId}`));
            }
            console.log(chalk.blue(`[WS] Chat message: "${message.content.substring(0, 100)}"`));
            this.handleChatMessage(sessionId, message.content);
          } else if (message.type === 'clear') {
            if (sessionId) {
              console.log(chalk.blue(`[WS] Clearing session: ${sessionId}`));
              this.agents.get(sessionId)?.stop();
              this.agents.delete(sessionId);
              this.sessionContexts.delete(sessionId);
            }
            this.wsSend(ws, { type: 'cleared' });
          } else {
            console.log(chalk.yellow(`[WS] Unknown message type: ${message.type}`));
          }
        } catch (error) {
          console.error(chalk.red('[WS] Failed to parse message:'), error);
        }
      });

      ws.on('close', (code, reason) => {
        console.log(chalk.yellow(`[WS] Client disconnected, code=${code}, reason=${reason || 'none'}`));
        if (sessionId) {
          this.sessionWebSockets.delete(sessionId);
          // Keep agent alive — client may reconnect with same sessionId
          console.log(chalk.yellow(`[WS] Session ${sessionId} disconnected, agent preserved`));
        }
      });

      ws.on('error', (error) => {
        console.error(chalk.red(`[WS] WebSocket error:`), error.message);
      });
    });
  }

  private wsSend(ws: WebSocket, data: object): void {
    if (ws.readyState === WebSocket.OPEN) {
      const json = JSON.stringify(data);
      console.log(chalk.gray(`[WS] Sending → ${json.substring(0, 150)}${json.length > 150 ? '...' : ''}`));
      ws.send(json);
    } else {
      console.warn(chalk.yellow(`[WS] Cannot send, readyState=${ws.readyState} (1=OPEN, 2=CLOSING, 3=CLOSED)`));
    }
  }

  private sendToSession(sessionId: string, data: object): void {
    const ws = this.sessionWebSockets.get(sessionId);
    if (ws) this.wsSend(ws, data);
  }

  private handleChatMessage(sessionId: string, content: string): void {
    let agent = this.agents.get(sessionId);
    const messageId = `msg-${Date.now()}`;
    console.log(chalk.blue(`[Chat] sessionId=${sessionId}, messageId=${messageId}, agent exists: ${!!agent}`));

    this.sessionContexts.set(sessionId, { messageId, content });

    if (!agent) {
      console.log(chalk.blue(`[Chat] Creating new AnthropicAgent for session: ${sessionId}`));
      const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY || '';
      agent = new AnthropicAgent(this.config.projectRoot, apiKey);

      agent.on('response', async (response: AgentResponse) => {
        const ctx = this.sessionContexts.get(sessionId) || { messageId, content };

        if (response.type === 'text') {
          this.sendToSession(sessionId, { type: 'stream', content: response.content, messageId: ctx.messageId });
        } else if (response.type === 'tool_use') {
          const toolName = response.toolUse?.name || 'unknown';
          const toolInput = response.toolUse?.input || {};
          let statusMsg = `도구 사용 중: ${toolName}`;
          if (toolName === 'read_file') statusMsg = `파일 읽는 중: ${String(toolInput.path || '').split('/').pop()}`;
          else if (toolName === 'str_replace') statusMsg = `파일 수정 중: ${String(toolInput.path || '').split('/').pop()}`;
          else if (toolName === 'write_file') statusMsg = `파일 생성 중: ${String(toolInput.path || '').split('/').pop()}`;
          else if (toolName === 'glob_tool') statusMsg = `파일 검색 중: ${toolInput.pattern || ''}`;
          else if (toolName === 'grep_tool') statusMsg = `코드 검색 중: ${toolInput.pattern || ''}`;
          this.sendToSession(sessionId, { type: 'status', status: 'editing', message: statusMsg });
        } else if (response.type === 'complete') {
          this.sendToSession(sessionId, { type: 'stream.end', messageId: ctx.messageId });
          this.sendToSession(sessionId, { type: 'status', status: 'done', message: '완료' });

          try {
            const commitMsg = ctx.content.length > 72 ? ctx.content.substring(0, 69) + '...' : ctx.content;
            const hash = await this.gitManager.autoCommit(commitMsg);
            if (hash) {
              const history = await this.gitManager.getCommitHistory(1);
              if (history.length > 0) {
                console.log(chalk.green(`[Git] Auto-committed: ${history[0].shortHash} ${commitMsg}`));
                this.sendToSession(sessionId, { type: 'commit.created', commit: history[0] });
              }
            }
          } catch (err: any) {
            console.warn(chalk.yellow(`[Git] Auto-commit skipped: ${err.message}`));
          }
        } else if (response.type === 'error') {
          this.sendToSession(sessionId, { type: 'error', message: response.content });
        }
      });

      agent.on('file_change', (change: FileChange) => {
        this.sendToSession(sessionId, { type: 'file.changed', path: change.path, additions: 0, deletions: 0 });
      });

      agent.on('error', (error: string) => {
        this.sendToSession(sessionId, { type: 'error', message: error });
      });

      this.agents.set(sessionId, agent);
    }

    this.sendToSession(sessionId, { type: 'status', status: 'analyzing', message: 'AI가 요청을 분석하고 있어요...' });
    agent.sendMessage(content);
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.config.port, () => {
        console.log(chalk.green.bold(`\n✓ BuildOver server running on http://localhost:${this.config.port}`));
        console.log(chalk.cyan(`  Proxying to: ${this.config.targetUrl}`));
        console.log(chalk.cyan(`  Project root: ${this.config.projectRoot}\n`));
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.wss.close();
    this.server.close();
    this.agents.forEach(agent => agent.stop());
    this.agents.clear();
    this.sessionWebSockets.clear();
    this.sessionContexts.clear();
  }
}
