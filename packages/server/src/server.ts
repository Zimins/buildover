import express from 'express';
import type { Request, Response, RequestHandler } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server as HttpServer } from 'http';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { createRequire } from 'module';
import chalk from 'chalk';
import { BuildOverConfig, AgentResponse, FileChange } from './types.js';
import { createProxy } from './proxy.js';
import { SessionManager } from './session/manager.js';
import { GitManager } from './git/manager.js';
import { AnthropicAgent } from './agent/anthropic-agent.js';
import { WorktreeManager } from './worktree/manager.js';
import type { ShareLink } from './worktree/manager.js';
import { StyleFinder } from './design/style-finder.js';


function buildLoadingPage(statusUrl: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>워크스페이스 준비 중...</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: #0f0f0f; color: #e5e5e5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .card {
      text-align: center; max-width: 360px; padding: 48px 32px;
    }
    .spinner {
      width: 48px; height: 48px; margin: 0 auto 28px;
      border: 3px solid #2a2a2a; border-top-color: #6366f1;
      border-radius: 50%; animation: spin 0.9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 18px; font-weight: 600; margin-bottom: 10px; }
    p  { font-size: 14px; color: #888; line-height: 1.6; }
    .dot { display: inline-block; animation: blink 1.4s infinite both; }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes blink { 0%,80%,100% { opacity: 0; } 40% { opacity: 1; } }
    .status-text { margin-top: 24px; font-size: 12px; color: #555; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h1>워크스페이스 준비 중<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></h1>
    <p>독립된 git 브랜치와 dev 서버를 생성하고 있어요.<br/>잠시만 기다려 주세요.</p>
    <p class="status-text" id="status-text">상태 확인 중...</p>
  </div>
  <script>
    const statusUrl = ${JSON.stringify(statusUrl)};
    let attempts = 0;

    async function poll() {
      attempts++;
      try {
        const res = await fetch(statusUrl);
        const data = await res.json();
        document.getElementById('status-text').textContent =
          data.status === 'creating' ? '빌드 중... (' + attempts + '번째 확인)' :
          data.status === 'error'    ? '오류가 발생했습니다. 페이지를 새로고침 해주세요.' :
                                       '준비 완료! 이동 중...';
        if (data.status === 'ready') {
          window.location.reload();
        } else if (data.status !== 'error') {
          setTimeout(poll, 2000);
        }
      } catch {
        setTimeout(poll, 3000);
      }
    }

    setTimeout(poll, 1500);
  </script>
</body>
</html>`;
}

interface LinkContext {
  link: ShareLink;
  gitManager: GitManager;
  agents: Map<string, AnthropicAgent>;
  sessionWebSockets: Map<string, WebSocket>;
  sessionContexts: Map<string, { messageId: string; content: string }>;
}

interface ChatContext {
  projectRoot: string;
  gitManager: GitManager;
  agents: Map<string, AnthropicAgent>;
  sessionContexts: Map<string, { messageId: string; content: string }>;
  sendToSession: (data: object) => void;
}

export class BuildOverServer {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private config: BuildOverConfig & { port: number; widgetPath: string; projectRoot: string };
  private sessionManager: SessionManager;
  private gitManager: GitManager;
  private worktreeManager: WorktreeManager;
  private agents: Map<string, AnthropicAgent> = new Map();
  private styleFinder = new StyleFinder();
  private sessionContexts: Map<string, { messageId: string; content: string }> = new Map();
  private sessionWebSockets: Map<string, WebSocket> = new Map();
  private linkContexts: Map<string, LinkContext> = new Map();
  private linkProxies: Map<string, ReturnType<typeof createProxy>> = new Map();
  // Per-share-link mini proxy servers (each on link.proxyPort)
  private linkServers: Map<string, HttpServer> = new Map();
  private linkDevProxies: Map<string, { port: number; handler: RequestHandler }> = new Map();

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

    const targetRoot = this.config.targetRoot || this.config.projectRoot;

    this.gitManager = new GitManager(this.config.projectRoot);
    this.sessionManager = new SessionManager(this.gitManager);
    this.worktreeManager = new WorktreeManager(targetRoot);

    // When a share link becomes ready, refresh its dev proxy cache and ensure mini proxy is running
    this.worktreeManager.on('ready', (link: ShareLink) => {
      this.linkDevProxies.delete(link.linkId); // invalidate cached proxy (new devServerPort)
      if (link.proxyPort && !this.linkServers.has(link.linkId)) {
        this.startLinkProxyServer(link); // start mini proxy for old links without proxyPort at init
      }
      console.log(chalk.green(`[Server] Link ${link.linkId} is ready on proxy port ${link.proxyPort}`));
    });

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

  private getLinkProxy(linkId: string, targetUrl: string) {
    if (!this.linkProxies.has(linkId)) {
      this.linkProxies.set(linkId, createProxy(targetUrl, linkId));
    }
    return this.linkProxies.get(linkId)!;
  }

  private getOrCreateLinkContext(link: ShareLink): LinkContext {
    let ctx = this.linkContexts.get(link.linkId);
    if (!ctx) {
      ctx = {
        link,
        gitManager: new GitManager(link.worktreePath),
        agents: new Map(),
        sessionWebSockets: new Map(),
        sessionContexts: new Map(),
      };
      this.linkContexts.set(link.linkId, ctx);
    }
    return ctx;
  }

  private startLinkProxyServer(link: ShareLink): void {
    if (this.linkServers.has(link.linkId)) return; // already running

    const mainPort = this.config.port;
    const linkId = link.linkId;

    const miniApp = express();

    // Serve widget.js directly
    miniApp.get('/buildover/widget.js', (_req: Request, res: Response) => this.serveWidget(res));

    // Status polling endpoint for loading page
    miniApp.get('/buildover/api/share/status', (_req: Request, res: Response) => {
      const l = this.worktreeManager.getLink(linkId);
      res.json({ status: l?.status || 'error' });
    });

    // All other requests: show loading page or proxy to dev server
    miniApp.use((req: Request, res: Response, next) => {
      const l = this.worktreeManager.getLink(linkId);
      if (!l) { res.status(404).send('Link not found'); return; }

      // Auto-restart stopped/error links on first request
      if (l.status === 'stopped' || l.status === 'error') {
        this.linkDevProxies.delete(linkId); // port will change on restart
        this.worktreeManager.restartLink(linkId).catch(() => {});
      }

      if (l.status !== 'ready') {
        res.status(202).send(buildLoadingPage('/buildover/api/share/status'));
        return;
      }

      // Get or create proxy to dev server (cached by port)
      let cached = this.linkDevProxies.get(linkId);
      if (!cached || cached.port !== l.devServerPort) {
        const widgetSrc = `http://localhost:${mainPort}/buildover/widget.js`;
        const wsUrl = `ws://localhost:${mainPort}/s/${linkId}/buildover/ws`;
        const apiBase = `http://localhost:${mainPort}/s/${linkId}`;
        const handler = createProxy(`http://localhost:${l.devServerPort}`, linkId, widgetSrc, wsUrl, apiBase);
        cached = { port: l.devServerPort, handler };
        this.linkDevProxies.set(linkId, cached);
      }

      cached.handler(req, res, next);
    });

    const miniServer = createServer(miniApp);
    miniServer.listen(link.proxyPort, () => {
      console.log(chalk.green(`[MiniProxy] Link ${linkId} listening on port ${link.proxyPort}`));
    });
    miniServer.on('error', (err: Error) => {
      console.error(chalk.red(`[MiniProxy] Server error for ${linkId}: ${err.message}`));
    });

    this.linkServers.set(linkId, miniServer);
  }

  private stopLinkProxyServer(linkId: string): void {
    const srv = this.linkServers.get(linkId);
    if (srv) {
      srv.close();
      this.linkServers.delete(linkId);
    }
    this.linkDevProxies.delete(linkId);
  }

  private async serveWidget(res: Response): Promise<void> {
    try {
      const widgetContent = await readFile(this.config.widgetPath, 'utf-8');
      res.type('application/javascript').send(widgetContent);
    } catch (error) {
      console.error(chalk.red('Failed to serve widget:'), error);
      res.status(404).send('Widget not found');
    }
  }

  private setupShareRouter(): express.Router {
    const router = express.Router({ mergeParams: true });

    // Serve widget.js (always available, even while creating)
    router.get('/buildover/widget.js', (_req, res) => this.serveWidget(res));

    // Status polling
    router.get('/buildover/api/share/status', (req: any, res) => {
      const link = this.worktreeManager.getLink(req.params.linkId);
      if (!link) { res.status(404).json({ error: 'Link not found' }); return; }
      res.json({ status: link.status });
    });

    // Link-scoped commit history
    router.get('/buildover/api/commits', async (req: any, res) => {
      const link = this.worktreeManager.getLink(req.params.linkId);
      if (!link || link.status !== 'ready') { res.status(503).json({ error: 'Not ready' }); return; }
      try {
        const ctx = this.getOrCreateLinkContext(link);
        const limit = parseInt((req.query.limit as string) || '30', 10);
        const commits = await ctx.gitManager.getCommitHistory(limit);
        res.json(commits);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Link-scoped diff
    router.get('/buildover/api/diff', async (req: any, res) => {
      const link = this.worktreeManager.getLink(req.params.linkId);
      if (!link || link.status !== 'ready') { res.status(503).json({ error: 'Not ready' }); return; }
      try {
        const ctx = this.getOrCreateLinkContext(link);
        const branch = req.query.branch as string | undefined;
        const diff = await ctx.gitManager.getDiff(branch);
        res.json(diff);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Request merge (replaces GitHub PR flow)
    router.post('/buildover/api/share/pr', async (req: any, res) => {
      const linkId = req.params.linkId;
      const link = this.worktreeManager.getLink(linkId);
      if (!link || link.status !== 'ready') { res.status(503).json({ error: 'Not ready' }); return; }
      try {
        const ctx = this.getOrCreateLinkContext(link);
        await ctx.gitManager.autoCommit('BuildOver: snapshot before merge request');
        await this.worktreeManager.requestMerge(linkId);
        res.json({ mergeStatus: 'requested' });
      } catch (err: any) {
        console.error(chalk.red('[Share] Merge request failed:'), err.message);
        res.status(500).json({ error: err.message });
      }
    });

    // Default: proxy to link's dev server
    router.use((req: any, res, next) => {
      const link = this.worktreeManager.getLink(req.params.linkId);
      if (!link) { res.status(404).send('Link not found'); return; }

      // Auto-restart stopped links on first visit
      if (link.status === 'stopped' || link.status === 'error') {
        this.linkProxies.delete(link.linkId); // port will change on restart
        this.worktreeManager.restartLink(link.linkId).catch(() => {});
      }

      if (link.status === 'creating' || link.status === 'stopped' || link.status === 'error') {
        res.status(202).send(buildLoadingPage(`/s/${req.params.linkId}/buildover/api/share/status`));
        return;
      }

      const proxy = this.getLinkProxy(link.linkId, `http://localhost:${link.devServerPort}`);
      proxy(req, res, next);
    });

    return router;
  }

  private setupRoutes(): void {
    // Main widget
    this.app.get('/buildover/widget.js', (_req: Request, res: Response) => this.serveWidget(res));

    // Share link management APIs
    this.app.post('/buildover/api/share/create', async (req: Request, res: Response) => {
      try {
        const { description } = req.body;
        const link = await this.worktreeManager.createLink(description);
        // Start mini proxy immediately so loading page is served while worktree is being created
        this.startLinkProxyServer(link);
        const url = `http://localhost:${link.proxyPort}/`;
        console.log(chalk.green(`[Share] Created link: ${url} (proxy port: ${link.proxyPort})`));
        res.json({ linkId: link.linkId, url, status: link.status });
      } catch (error: any) {
        console.error(chalk.red('[Share] Failed to create link:'), error.message);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/buildover/api/share/links', async (_req: Request, res: Response) => {
      try {
        const links = await this.worktreeManager.listAll();
        res.json(links.map(l => ({
          ...l,
          url: l.proxyPort ? `http://localhost:${l.proxyPort}/` : `http://localhost:${this.config.port}/s/${l.linkId}/`,
        })));
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/buildover/api/share/:linkId', (req: Request, res: Response) => {
      const link = this.worktreeManager.getLink(req.params.linkId);
      if (!link) { res.status(404).json({ error: 'Link not found' }); return; }
      res.json({ ...link, devServerProcess: undefined });
    });

    this.app.delete('/buildover/api/share/:linkId', async (req: Request, res: Response) => {
      try {
        await this.worktreeManager.destroyLink(req.params.linkId);
        this.linkContexts.delete(req.params.linkId);
        this.linkProxies.delete(req.params.linkId);
        this.stopLinkProxyServer(req.params.linkId);
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Diff between worktree branch and base branch (uses main gitManager)
    this.app.get('/buildover/api/share/:linkId/diff', async (req: Request, res: Response) => {
      const link = this.worktreeManager.getLink(req.params.linkId);
      if (!link) { res.status(404).json({ error: 'Link not found' }); return; }
      try {
        const diff = await this.gitManager.getBranchDiff(link.branchName, link.baseBranch);
        res.json(diff);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Merge worktree branch into current branch (uses main gitManager)
    this.app.post('/buildover/api/share/:linkId/merge', async (req: Request, res: Response) => {
      const link = this.worktreeManager.getLink(req.params.linkId);
      if (!link) { res.status(404).json({ error: 'Link not found' }); return; }
      try {
        const result = await this.gitManager.mergeBranch(link.branchName);
        if (result.success) {
          await this.worktreeManager.updateMergeStatus(req.params.linkId, 'merged');
          console.log(chalk.green(`[Share] Merged branch: ${link.branchName}`));
        }
        res.json(result);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Reject merge request
    this.app.post('/buildover/api/share/:linkId/reject', async (req: Request, res: Response) => {
      const link = this.worktreeManager.getLink(req.params.linkId);
      if (!link) { res.status(404).json({ error: 'Link not found' }); return; }
      try {
        await this.worktreeManager.updateMergeStatus(req.params.linkId, 'rejected');
        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Share link namespace — mount router before other API routes
    this.app.use('/s/:linkId', this.setupShareRouter());

    // Session APIs
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

      // Match both /buildover/ws (main) and /s/<linkId>/buildover/ws (share link)
      const match = pathname.match(/^(?:\/s\/([^/]+))?\/buildover\/ws$/);
      if (match) {
        const linkId = match[1]; // undefined → main user
        console.log(chalk.magenta(`[WS] Handling BuildOver WebSocket upgrade${linkId ? ` (link: ${linkId})` : ''}`));
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request, linkId);
        });
      } else {
        console.log(chalk.gray(`[WS] Ignoring upgrade for: ${pathname}`));
      }
    });

    this.wss.on('connection', (ws: WebSocket, _request: any, linkId?: string) => {
      console.log(chalk.green(`[WS] Client connected${linkId ? ` (link: ${linkId})` : ''}`));

      let sessionId: string | null = null;

      // Resolve the maps to use for this connection
      const getContext = (): {
        agents: Map<string, AnthropicAgent>;
        sessionWebSockets: Map<string, WebSocket>;
        sessionContexts: Map<string, { messageId: string; content: string }>;
        projectRoot: string;
        gitManager: GitManager;
      } => {
        if (linkId) {
          const link = this.worktreeManager.getLink(linkId);
          if (link) {
            const ctx = this.getOrCreateLinkContext(link);
            return {
              agents: ctx.agents,
              sessionWebSockets: ctx.sessionWebSockets,
              sessionContexts: ctx.sessionContexts,
              projectRoot: link.worktreePath,
              gitManager: ctx.gitManager,
            };
          }
        }
        return {
          agents: this.agents,
          sessionWebSockets: this.sessionWebSockets,
          sessionContexts: this.sessionContexts,
          projectRoot: this.config.projectRoot,
          gitManager: this.gitManager,
        };
      };

      ws.on('message', async (data) => {
        const raw = data.toString();
        console.log(chalk.magenta(`[WS] Received message: ${raw.substring(0, 200)}`));

        try {
          const message = JSON.parse(raw);
          console.log(chalk.magenta(`[WS] Message type: ${message.type}`));
          const ctx = getContext();

          if (message.type === 'init') {
            sessionId = message.sessionId as string;
            ctx.sessionWebSockets.set(sessionId, ws);
            console.log(chalk.blue(`[WS] Session registered: ${sessionId}`));
          } else if (message.type === 'chat') {
            if (!sessionId) {
              sessionId = `session-${Date.now()}`;
              ctx.sessionWebSockets.set(sessionId, ws);
              console.log(chalk.blue(`[WS] Auto-created session: ${sessionId}`));
            }
            console.log(chalk.blue(`[WS] Chat message: "${message.content.substring(0, 100)}"`));
            this.handleChatMessage(sessionId, message.content, {
              projectRoot: ctx.projectRoot,
              gitManager: ctx.gitManager,
              agents: ctx.agents,
              sessionContexts: ctx.sessionContexts,
              sendToSession: (d) => this.wsSend(ws, d),
            });
          } else if (message.type === 'design.change') {
            console.log(chalk.green(`[Design] Change: ${message.property} → ${message.value}`));
            const sendToSession = (d: object) => this.wsSend(ws, d);
            sendToSession({ type: 'status', status: 'editing', message: 'Updating style...' });

            try {
              const result = await this.styleFinder.findAndReplace({
                classes: message.elementInfo?.classes || [],
                id: message.elementInfo?.id || '',
                property: message.property,
                oldValue: message.oldValue,
                newValue: message.value,
                projectRoot: ctx.projectRoot,
              });

              if (result.success) {
                console.log(chalk.green(`[Design] Direct edit: ${result.strategy} → ${result.filePath}`));
                sendToSession({ type: 'file.changed', path: result.filePath, additions: 0, deletions: 0 });
                sendToSession({ type: 'status', status: 'done', message: 'Done' });

                // Auto-commit
                try {
                  const commitMsg = `design: ${message.property} → ${message.value}`;
                  const hash = await ctx.gitManager.autoCommit(commitMsg);
                  if (hash) {
                    const history = await ctx.gitManager.getCommitHistory(1);
                    if (history.length > 0) {
                      sendToSession({ type: 'commit.created', commit: history[0] });
                    }
                  }
                } catch (err: any) {
                  console.warn(chalk.yellow(`[Design] Auto-commit skipped: ${err.message}`));
                }
              } else {
                console.log(chalk.yellow(`[Design] StyleFinder failed: ${result.error || 'not found'}`));
                sendToSession({ type: 'error', message: `Could not find style definition for ${message.property} in source code.` });
                sendToSession({ type: 'status', status: 'idle' });
              }
            } catch (err: any) {
              console.error(chalk.red(`[Design] Error:`), err.message);
              sendToSession({ type: 'error', message: `Design change failed: ${err.message}` });
              sendToSession({ type: 'status', status: 'idle' });
            }
          } else if (message.type === 'clear') {
            if (sessionId) {
              const ctx2 = getContext();
              console.log(chalk.blue(`[WS] Clearing session: ${sessionId}`));
              ctx2.agents.get(sessionId)?.stop();
              ctx2.agents.delete(sessionId);
              ctx2.sessionContexts.delete(sessionId);
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
          const ctx = getContext();
          ctx.sessionWebSockets.delete(sessionId);
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

  private handleChatMessage(sessionId: string, content: string, context: ChatContext): void {
    const { projectRoot, gitManager, agents, sessionContexts, sendToSession } = context;
    let agent = agents.get(sessionId);
    const messageId = `msg-${Date.now()}`;
    console.log(chalk.blue(`[Chat] sessionId=${sessionId}, messageId=${messageId}, agent exists: ${!!agent}`));

    sessionContexts.set(sessionId, { messageId, content });

    if (!agent) {
      console.log(chalk.blue(`[Chat] Creating new AnthropicAgent for session: ${sessionId}`));
      const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY || '';
      const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN || '';
      agent = new AnthropicAgent(projectRoot, apiKey, oauthToken);

      agent.on('response', async (response: AgentResponse) => {
        const ctx = sessionContexts.get(sessionId) || { messageId, content };

        if (response.type === 'text') {
          sendToSession({ type: 'stream', content: response.content, messageId: ctx.messageId });
        } else if (response.type === 'tool_use') {
          const toolName = response.toolUse?.name || 'unknown';
          const toolInput = response.toolUse?.input || {};
          let statusMsg = `도구 사용 중: ${toolName}`;
          if (toolName === 'read_file') statusMsg = `파일 읽는 중: ${String(toolInput.path || '').split('/').pop()}`;
          else if (toolName === 'str_replace') statusMsg = `파일 수정 중: ${String(toolInput.path || '').split('/').pop()}`;
          else if (toolName === 'write_file') statusMsg = `파일 생성 중: ${String(toolInput.path || '').split('/').pop()}`;
          else if (toolName === 'glob_tool') statusMsg = `파일 검색 중: ${toolInput.pattern || ''}`;
          else if (toolName === 'grep_tool') statusMsg = `코드 검색 중: ${toolInput.pattern || ''}`;
          sendToSession({ type: 'status', status: 'editing', message: statusMsg });
        } else if (response.type === 'complete') {
          sendToSession({ type: 'stream.end', messageId: ctx.messageId });
          sendToSession({ type: 'status', status: 'done', message: '완료' });

          try {
            const commitMsg = ctx.content.length > 72 ? ctx.content.substring(0, 69) + '...' : ctx.content;
            const hash = await gitManager.autoCommit(commitMsg);
            if (hash) {
              const history = await gitManager.getCommitHistory(1);
              if (history.length > 0) {
                console.log(chalk.green(`[Git] Auto-committed: ${history[0].shortHash} ${commitMsg}`));
                sendToSession({ type: 'commit.created', commit: history[0] });
              }
            }
          } catch (err: any) {
            console.warn(chalk.yellow(`[Git] Auto-commit skipped: ${err.message}`));
          }
        } else if (response.type === 'error') {
          sendToSession({ type: 'error', message: response.content });
        }
      });

      agent.on('file_change', (change: FileChange) => {
        sendToSession({ type: 'file.changed', path: change.path, additions: 0, deletions: 0 });
      });

      agent.on('error', (error: string) => {
        sendToSession({ type: 'error', message: error });
      });

      agents.set(sessionId, agent);
    }

    sendToSession({ type: 'status', status: 'analyzing', message: 'AI가 요청을 분석하고 있어요...' });
    agent.sendMessage(content);
  }

  async start(): Promise<void> {
    await this.worktreeManager.init();
    // Start mini proxy servers for all stored links
    for (const link of this.worktreeManager.listLinks()) {
      if (link.proxyPort) {
        this.startLinkProxyServer(link);
      }
    }
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
    // Clean up link agents
    this.linkContexts.forEach(ctx => {
      ctx.agents.forEach(agent => agent.stop());
    });
    this.linkContexts.clear();
    this.linkProxies.clear();
    // Close all mini proxy servers
    this.linkServers.forEach(srv => srv.close());
    this.linkServers.clear();
    this.linkDevProxies.clear();
    await this.worktreeManager.destroyAll();
  }
}
