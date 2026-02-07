import { Session } from '../types.js';

export class SessionStore {
  private sessions: Map<string, Session> = new Map();

  create(id: string, branchName: string): Session {
    const session: Session = {
      id,
      branchName,
      createdAt: new Date(),
      lastActivity: new Date(),
      status: 'active',
    };
    this.sessions.set(id, session);
    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  update(id: string, updates: Partial<Session>): Session | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    const updated = { ...session, ...updates, lastActivity: new Date() };
    this.sessions.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  list(): Session[] {
    return Array.from(this.sessions.values());
  }

  listActive(): Session[] {
    return this.list().filter(s => s.status === 'active');
  }
}
