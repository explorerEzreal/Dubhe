import { describe, expect, it } from 'vitest';
import type {
  AuditRepository,
  SecurityService,
  SessionRepository,
  UserRecord,
  UserRepository,
} from '../../src/application/ports.js';
import { AuthService } from '../../src/application/services/auth-service.js';

class FakeSecurity implements SecurityService {
  private sequence = 0;

  async hashPassword(value: string): Promise<string> {
    try {
      return `hash:${value}`;
    } catch (error) {
      throw error;
    }
  }

  async verifyPassword(hash: string, value: string): Promise<boolean> {
    try {
      return hash === `hash:${value}`;
    } catch (error) {
      throw error;
    }
  }

  digest(value: string): string {
    return `digest:${value}`;
  }

  signSession(userId: string): string {
    this.sequence += 1;
    return `jwt:${userId}:${this.sequence}`;
  }

  verifySession(token: string): Record<string, unknown> | null {
    const [, sub] = token.split(':');
    return sub ? { sub } : null;
  }

  randomToken(prefix: string): string {
    return `${prefix}token`;
  }
}

class FakeUsers implements UserRepository {
  readonly users = new Map<string, UserRecord>();

  async create(email: string, passwordHash: string): Promise<UserRecord | null> {
    try {
      if (this.users.has(email)) return null;
      const user = { id: 'user-1', email, role: 'user', passwordHash };
      this.users.set(email, user);
      return user;
    } catch (error) {
      throw error;
    }
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    try {
      return this.users.get(email) ?? null;
    } catch (error) {
      throw error;
    }
  }

  async findById(id: string): Promise<UserRecord | null> {
    try {
      return [...this.users.values()].find((user) => user.id === id) ?? null;
    } catch (error) {
      throw error;
    }
  }
}

class FakeSessions implements SessionRepository {
  readonly sessions = new Map<string, { id: string; userId: string; revoked: boolean }>();

  async create(userId: string, tokenHash: string): Promise<void> {
    try {
      this.sessions.set(tokenHash, { id: tokenHash, userId, revoked: false });
    } catch (error) {
      throw error;
    }
  }

  async findActive(tokenHash: string) {
    try {
      const session = this.sessions.get(tokenHash);
      return session && !session.revoked
        ? { id: session.id, userId: session.userId }
        : null;
    } catch (error) {
      throw error;
    }
  }

  async touch(): Promise<void> {
    try {
      return;
    } catch (error) {
      throw error;
    }
  }

  async revoke(tokenHash: string): Promise<boolean> {
    try {
      const session = this.sessions.get(tokenHash);
      if (!session || session.revoked) return false;
      session.revoked = true;
      return true;
    } catch (error) {
      throw error;
    }
  }
}

class FakeAudits implements AuditRepository {
  readonly entries: string[] = [];

  async record(_actorId: string | null, action: string, resource: string): Promise<void> {
    try {
      this.entries.push(`${action}:${resource}`);
    } catch (error) {
      throw error;
    }
  }
}

describe('AuthService', () => {
  it('stores only session digests and rejects a revoked session immediately', async () => {
    const users = new FakeUsers();
    const sessions = new FakeSessions();
    const audits = new FakeAudits();
    const service = new AuthService(
      users,
      sessions,
      audits,
      new FakeSecurity(),
      3600,
    );

    const registered = await service.register('USER@example.com', 'password');
    expect(registered.user.email).toBe('user@example.com');
    expect([...sessions.sessions.keys()]).toEqual([`digest:${registered.token}`]);
    expect([...sessions.sessions.keys()].join('')).not.toContain('password');
    await expect(service.authenticate(registered.token)).resolves.toMatchObject({
      id: 'user-1',
    });

    await service.logout(registered.token);
    await expect(service.authenticate(registered.token)).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(audits.entries.join(' ')).not.toContain(registered.token);
  });

  it('rejects duplicate registration and invalid login', async () => {
    const service = new AuthService(
      new FakeUsers(),
      new FakeSessions(),
      new FakeAudits(),
      new FakeSecurity(),
      3600,
    );
    await service.register('user@example.com', 'password');
    await expect(service.register('user@example.com', 'password')).rejects.toMatchObject({
      statusCode: 409,
    });
    await expect(service.login('user@example.com', 'wrong-pass')).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});
