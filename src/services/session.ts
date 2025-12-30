import type { SessionInfo } from '../types';

export interface SessionStore {
  get(sessionId: string): Promise<SessionInfo | null>;
  set(sessionId: string, info: SessionInfo): Promise<void>;
  delete(sessionId: string): Promise<boolean>;
  list(): Promise<SessionInfo[]>;
}

class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, SessionInfo>();

  async get(sessionId: string): Promise<SessionInfo | null> {
    return this.sessions.get(sessionId) || null;
  }

  async set(sessionId: string, info: SessionInfo): Promise<void> {
    this.sessions.set(sessionId, info);
  }

  async delete(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }

  async list(): Promise<SessionInfo[]> {
    return Array.from(this.sessions.values());
  }
}

// Export singleton instance
export const sessionStore: SessionStore = new MemorySessionStore();
