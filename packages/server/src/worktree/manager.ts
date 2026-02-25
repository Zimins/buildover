import { ChildProcess, spawn } from 'child_process';
import { mkdir, symlink, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, relative } from 'path';
import { createServer, createConnection } from 'net';
import { EventEmitter } from 'events';
import simpleGit, { SimpleGit } from 'simple-git';
import chalk from 'chalk';
import { ShareLinkStore } from './store.js';

export interface ShareLink {
  linkId: string;
  worktreePath: string;
  branchName: string;
  baseBranch: string;
  devServerPort: number;
  proxyPort: number;
  devServerProcess?: ChildProcess;
  status: 'creating' | 'ready' | 'stopped' | 'error';
  createdAt: Date;
  description?: string;
  mergeStatus?: 'requested' | 'merged' | 'rejected';
}

export class WorktreeManager extends EventEmitter {
  private links: Map<string, ShareLink> = new Map();
  private git: SimpleGit;
  private projectRoot: string;
  private store: ShareLinkStore;

  constructor(projectRoot: string) {
    super();
    this.projectRoot = projectRoot;
    this.git = simpleGit(projectRoot);
    this.store = new ShareLinkStore(projectRoot);
  }

  async createLink(description?: string): Promise<ShareLink> {
    const linkId = Math.random().toString(36).slice(2, 10);
    const worktreePath = join(this.projectRoot, '.buildover', 'worktrees', linkId);
    const branchName = `buildover/share/${linkId}`;
    const baseBranch = (await this.git.revparse(['--abbrev-ref', 'HEAD'])).trim();
    const [devServerPort, proxyPort] = await Promise.all([this.findFreePort(), this.findFreePort()]);

    const link: ShareLink = {
      linkId,
      worktreePath,
      branchName,
      baseBranch,
      devServerPort,
      proxyPort,
      status: 'creating',
      createdAt: new Date(),
      description,
    };

    this.links.set(linkId, link);

    // Setup in background — caller polls status
    this.setupLink(link).catch(err => {
      console.error(chalk.red(`[WorktreeManager] Setup failed for ${linkId}:`), err.message);
      link.status = 'error';
      this.store.upsert(this.toStored(link)).catch(() => {});
    });

    return link;
  }

  /**
   * Compute the path inside the worktree where the target app actually lives.
   * If targetRoot IS the git root, this equals worktreePath.
   * If targetRoot is a subdirectory (e.g. test-nextjs/ in a monorepo),
   * we need to cd into that subdir inside the worktree.
   */
  private async getDevServerCwd(worktreePath: string): Promise<string> {
    const gitRoot = (await this.git.revparse(['--show-toplevel'])).trim();
    const relPath = relative(gitRoot, this.projectRoot);
    return relPath ? join(worktreePath, relPath) : worktreePath;
  }

  private async setupLink(link: ShareLink): Promise<void> {
    const { linkId, worktreePath, branchName } = link;

    // Ensure worktrees directory exists
    await mkdir(join(this.projectRoot, '.buildover', 'worktrees'), { recursive: true });

    // Create git worktree with new branch off current HEAD
    await this.git.raw(['worktree', 'add', '-b', branchName, worktreePath]);
    console.log(chalk.green(`[WorktreeManager] Created worktree: ${worktreePath}`));

    // Resolve the actual app directory inside the worktree
    const devCwd = await this.getDevServerCwd(worktreePath);
    console.log(chalk.green(`[WorktreeManager] Dev server CWD: ${devCwd}`));

    // Symlink node_modules from target app to its location inside the worktree
    const srcNodeModules = join(this.projectRoot, 'node_modules');
    const dstNodeModules = join(devCwd, 'node_modules');
    if (existsSync(srcNodeModules) && !existsSync(dstNodeModules)) {
      try {
        await symlink(srcNodeModules, dstNodeModules);
        console.log(chalk.green(`[WorktreeManager] Symlinked node_modules for ${linkId}`));
      } catch (err: any) {
        console.warn(chalk.yellow(`[WorktreeManager] node_modules symlink failed for ${linkId}: ${err.message}`));
      }
    }

    await this.startDevServer(link, devCwd);
  }

  private async detectDevCommand(devCwd: string, port: number): Promise<{ cmd: string; args: string[] }> {
    try {
      const raw = await readFile(join(devCwd, 'package.json'), 'utf-8');
      const pkgJson = JSON.parse(raw);
      const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };

      if (deps['next']) {
        return { cmd: 'npx', args: ['next', 'dev', '-p', String(port)] };
      }
      if (deps['vite']) {
        return { cmd: 'npx', args: ['vite', '--port', String(port)] };
      }

      const devScript: string | undefined = pkgJson.scripts?.dev;
      if (devScript) {
        return { cmd: 'sh', args: ['-c', `${devScript} -- --port ${port}`] };
      }
    } catch {
      // package.json not found or unreadable
    }
    return { cmd: 'npm', args: ['run', 'dev', '--', '--port', String(port)] };
  }

  private async startDevServer(link: ShareLink, devCwd: string): Promise<void> {
    const { devServerPort, linkId } = link;
    const { cmd, args } = await this.detectDevCommand(devCwd, devServerPort);

    console.log(chalk.blue(`[WorktreeManager] Starting dev server for ${linkId}: ${cmd} ${args.join(' ')} (cwd: ${devCwd})`));

    const proc = spawn(cmd, args, {
      cwd: devCwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(devServerPort) },
    });

    link.devServerProcess = proc;

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString().trim();
      if (text) console.log(chalk.gray(`[worktree/${linkId}] ${text}`));
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString().trim();
      if (text) console.log(chalk.yellow(`[worktree/${linkId}] ${text}`));
    });

    proc.on('error', (err: Error) => {
      console.error(chalk.red(`[WorktreeManager] Dev server error for ${linkId}:`), err.message);
      link.status = 'error';
    });

    proc.on('exit', (code: number | null) => {
      console.log(chalk.yellow(`[WorktreeManager] Dev server exited for ${linkId}, code=${code}`));
      if (link.status === 'ready') link.status = 'stopped';
    });

    // Wait for port to become available (max 60s)
    await this.waitForPort(devServerPort, 60000);
    link.status = 'ready';
    console.log(chalk.green(`[WorktreeManager] Link ${linkId} ready on port ${devServerPort}`));
    await this.store.upsert(this.toStored(link));
    this.emit('ready', link);
  }

  private findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = createServer();
      server.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        server.close(() => resolve(port));
      });
      server.on('error', reject);
    });
  }

  private waitForPort(port: number, timeout: number): Promise<void> {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const tryConnect = () => {
        const socket = createConnection(port, 'localhost');
        socket.setTimeout(1000);
        const retry = () => {
          socket.destroy();
          if (Date.now() - start >= timeout) {
            reject(new Error(`Port ${port} not ready after ${timeout}ms`));
          } else {
            setTimeout(tryConnect, 500);
          }
        };
        socket.on('connect', () => {
          socket.destroy();
          resolve();
        });
        socket.on('error', retry);
        socket.on('timeout', retry);
      };
      tryConnect();
    });
  }

  private toStored(link: ShareLink) {
    return {
      linkId: link.linkId,
      worktreePath: link.worktreePath,
      branchName: link.branchName,
      baseBranch: link.baseBranch,
      devServerPort: link.devServerPort,
      proxyPort: link.proxyPort,
      status: (link.status === 'creating' ? 'stopped' : link.status) as 'ready' | 'stopped' | 'error',
      createdAt: link.createdAt.toISOString(),
      description: link.description,
      mergeStatus: link.mergeStatus,
    };
  }

  /** Load historical links from store into memory (status = stopped). Call once at startup. */
  async init(): Promise<void> {
    const stored = await this.store.load();
    for (const s of stored) {
      if (!this.links.has(s.linkId)) {
        this.links.set(s.linkId, {
          ...s,
          proxyPort: s.proxyPort ?? 0,
          status: 'stopped',
          createdAt: new Date(s.createdAt),
          mergeStatus: s.mergeStatus,
        });
      }
    }
    console.log(chalk.blue(`[WorktreeManager] Loaded ${stored.length} link(s) from store`));
  }

  /** Restart the dev server for a stopped/error link whose worktree still exists. */
  async restartLink(linkId: string): Promise<void> {
    const link = this.links.get(linkId);
    if (!link) throw new Error(`Link ${linkId} not found`);
    if (link.status === 'creating') return; // already starting

    link.status = 'creating';
    // Keep proxyPort stable; only allocate a new one if none exists (old links)
    const ports = link.proxyPort
      ? [this.findFreePort()]
      : [this.findFreePort(), this.findFreePort()];
    const resolvedPorts = await Promise.all(ports);
    link.devServerPort = resolvedPorts[0];
    if (!link.proxyPort) link.proxyPort = resolvedPorts[1]!;

    const devCwd = await this.getDevServerCwd(link.worktreePath);
    this.startDevServer(link, devCwd)
      .then(() => {
        this.store.upsert(this.toStored(link)).catch(() => {});
        this.emit('ready', link);
      })
      .catch(err => {
        console.error(chalk.red(`[WorktreeManager] Restart failed for ${linkId}:`), err.message);
        link.status = 'error';
        this.store.upsert(this.toStored(link)).catch(() => {});
      });
  }

  async requestMerge(linkId: string): Promise<void> {
    const link = this.links.get(linkId);
    if (!link) throw new Error(`Link ${linkId} not found`);
    link.mergeStatus = 'requested';
    await this.store.upsert(this.toStored(link));
    this.emit('mergeRequested', link);
  }

  async updateMergeStatus(linkId: string, status: 'merged' | 'rejected'): Promise<void> {
    const link = this.links.get(linkId);
    if (!link) throw new Error(`Link ${linkId} not found`);
    link.mergeStatus = status;
    await this.store.upsert(this.toStored(link));
  }

  getLink(linkId: string): ShareLink | undefined {
    return this.links.get(linkId);
  }

  listLinks(): ShareLink[] {
    return Array.from(this.links.values());
  }

  /** Active links + historical stopped links from store, newest first */
  async listAll(): Promise<Array<Omit<ShareLink, 'devServerProcess'>>> {
    const active = Array.from(this.links.values()).map(l => ({ ...l, devServerProcess: undefined }));
    const activeIds = new Set(active.map(l => l.linkId));
    const stored = await this.store.load();
    const historical = stored
      .filter(l => !activeIds.has(l.linkId))
      .map(l => ({ ...l, createdAt: new Date(l.createdAt) }));
    return [...active, ...historical];
  }

  async destroyLink(linkId: string, deleteBranch = false): Promise<void> {
    const link = this.links.get(linkId);
    if (!link) return;

    if (link.devServerProcess) {
      link.devServerProcess.kill('SIGTERM');
      link.devServerProcess = undefined;
    }

    link.status = 'stopped';

    try {
      await this.git.raw(['worktree', 'remove', '--force', link.worktreePath]);
      console.log(chalk.green(`[WorktreeManager] Removed worktree for ${linkId}`));
    } catch (err: any) {
      console.warn(chalk.yellow(`[WorktreeManager] Failed to remove worktree for ${linkId}: ${err.message}`));
    }

    if (deleteBranch) {
      try {
        await this.git.deleteLocalBranch(link.branchName, true);
      } catch (err: any) {
        console.warn(chalk.yellow(`[WorktreeManager] Failed to delete branch ${link.branchName}: ${err.message}`));
      }
    }

    await this.store.updateStatus(linkId, 'stopped').catch(() => {});
    this.links.delete(linkId);
  }

  async destroyAll(): Promise<void> {
    const ids = Array.from(this.links.keys());
    await Promise.all(ids.map(id => this.destroyLink(id)));
  }

  getTargetUrl(linkId: string): string | null {
    const link = this.links.get(linkId);
    if (!link) return null;
    return `http://localhost:${link.devServerPort}`;
  }
}
