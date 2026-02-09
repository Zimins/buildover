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
import { ClaudeAgent } from './agent/claude.js';

export class BuildOverServer {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private config: BuildOverConfig & { port: number; widgetPath: string; projectRoot: string };
  private sessionManager: SessionManager;
  private gitManager: GitManager;
  private agents: Map<string, ClaudeAgent> = new Map();

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
            sessionId = message.sessionId;
            console.log(chalk.blue(`[WS] Session initialized: ${sessionId}`));
          } else if (message.type === 'chat') {
            if (!sessionId) {
              sessionId = `session-${Date.now()}`;
              console.log(chalk.blue(`[WS] Auto-created session: ${sessionId}`));
            }
            console.log(chalk.blue(`[WS] Chat message: "${message.content.substring(0, 100)}"`));
            console.log(chalk.blue(`[WS] WebSocket readyState: ${ws.readyState} (1=OPEN)`));
            this.handleChatMessage(sessionId, message.content, ws);
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
          const agent = this.agents.get(sessionId);
          if (agent) {
            console.log(chalk.yellow(`[WS] Stopping agent for session: ${sessionId}`));
            agent.stop();
            this.agents.delete(sessionId);
          }
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

  private handleChatMessage(sessionId: string, content: string, ws: WebSocket): void {
    let agent = this.agents.get(sessionId);
    const messageId = `msg-${Date.now()}`;
    console.log(chalk.blue(`[Chat] handleChatMessage called, sessionId=${sessionId}, messageId=${messageId}`));
    console.log(chalk.blue(`[Chat] Existing agent: ${agent ? 'yes' : 'no'}, agents count: ${this.agents.size}`));

    if (!agent) {
      console.log(chalk.blue(`[Chat] Creating new ClaudeAgent for session: ${sessionId}`));
      agent = new ClaudeAgent(this.config.projectRoot);

      agent.on('response', (response: AgentResponse) => {
        if (response.type === 'text') {
          this.wsSend(ws, {
            type: 'stream',
            content: response.content,
            messageId,
          });
        } else if (response.type === 'tool_use') {
          const toolName = response.toolUse?.name || 'unknown';
          const toolInput = response.toolUse?.input || {};
          let statusMsg = `Using tool: ${toolName}`;
          if (toolName === 'Read' && toolInput.file_path) {
            statusMsg = `Reading ${toolInput.file_path.split('/').pop()}`;
          } else if (toolName === 'Edit' && toolInput.file_path) {
            statusMsg = `Editing ${toolInput.file_path.split('/').pop()}`;
          } else if (toolName === 'Write' && toolInput.file_path) {
            statusMsg = `Creating ${toolInput.file_path.split('/').pop()}`;
          } else if (toolName === 'Glob') {
            statusMsg = `Searching files: ${toolInput.pattern || ''}`;
          } else if (toolName === 'Grep') {
            statusMsg = `Searching for: ${toolInput.pattern || ''}`;
          }
          this.wsSend(ws, { type: 'status', status: 'editing', message: statusMsg });
        } else if (response.type === 'complete') {
          this.wsSend(ws, { type: 'stream.end', messageId });
          this.wsSend(ws, { type: 'status', status: 'done', message: 'Done' });
        } else if (response.type === 'error') {
          this.wsSend(ws, { type: 'error', message: response.content });
        }
      });

      agent.on('file_change', (change: FileChange) => {
        this.wsSend(ws, {
          type: 'file.changed',
          path: change.path,
          additions: 0,
          deletions: 0,
        });
      });

      agent.on('error', (error: string) => {
        this.wsSend(ws, { type: 'error', message: error });
      });

      this.agents.set(sessionId, agent);
    }

    // Send initial status
    this.wsSend(ws, { type: 'status', status: 'analyzing', message: 'AI is analyzing your request...' });

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
  }
}
