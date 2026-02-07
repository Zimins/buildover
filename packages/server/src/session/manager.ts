import { randomBytes } from 'crypto';
import { SessionStore } from './store.js';
import { GitManager } from '../git/manager.js';
import { Session } from '../types.js';

export class SessionManager {
  private store: SessionStore;
  private gitManager: GitManager;

  constructor(gitManager: GitManager) {
    this.store = new SessionStore();
    this.gitManager = gitManager;
  }

  async create(description: string): Promise<Session> {
    const id = randomBytes(8).toString('hex');
    const branchName = await this.gitManager.createBranch(id, description);
    return this.store.create(id, branchName);
  }

  async resume(id: string): Promise<Session | null> {
    const session = this.store.get(id);
    if (!session) return null;

    await this.gitManager.createBranch(id, 'resume');
    this.store.update(id, { status: 'active' });
    return session;
  }

  async end(id: string, shouldMerge: boolean): Promise<void> {
    const session = this.store.get(id);
    if (!session) return;

    if (shouldMerge) {
      await this.gitManager.merge(session.branchName, 'merge');
    }

    await this.gitManager.discard(session.branchName);
    this.store.update(id, { status: 'ended' });
  }

  get(id: string): Session | undefined {
    return this.store.get(id);
  }

  list(): Session[] {
    return this.store.list();
  }
}
