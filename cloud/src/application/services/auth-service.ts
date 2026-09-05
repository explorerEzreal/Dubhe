import type {
  AuditRepository,
  SecurityService,
  SessionRepository,
  UserRecord,
  UserRepository,
} from '../ports.js';
import { errors } from '../../domain/common/index.js';

export interface AuthResult {
  token: string;
  user: Pick<UserRecord, 'id' | 'email' | 'role'>;
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly audits: AuditRepository,
    private readonly security: SecurityService,
    private readonly sessionTtlSeconds: number,
  ) {}

  async register(email: string, password: string): Promise<AuthResult> {
    try {
      const passwordHash = await this.security.hashPassword(password);
      const user = await this.users.create(email.toLowerCase(), passwordHash);
      if (!user) throw errors.conflict();
      const token = await this.createSession(user);
      await this.audits.record(user.id, 'user.register', `user:${user.id}`);
      return { token, user: this.publicUser(user) };
    } catch (error) {
      throw error;
    }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    try {
      const user = await this.users.findByEmail(email.toLowerCase());
      if (
        !user?.passwordHash ||
        !(await this.security.verifyPassword(user.passwordHash, password))
      ) {
        throw errors.unauthorized();
      }
      const token = await this.createSession(user);
      await this.audits.record(user.id, 'user.login', `user:${user.id}`);
      return { token, user: this.publicUser(user) };
    } catch (error) {
      throw error;
    }
  }

  async authenticate(token: string): Promise<UserRecord> {
    try {
      const claims = this.security.verifySession(token);
      if (!claims?.sub) throw errors.unauthorized();
      const session = await this.sessions.findActive(this.security.digest(token));
      if (!session || session.userId !== String(claims.sub)) {
        throw errors.unauthorized();
      }
      const user = await this.users.findById(String(claims.sub));
      if (!user) throw errors.unauthorized();
      await this.sessions.touch(session.id);
      return user;
    } catch (error) {
      throw error;
    }
  }

  async logout(token: string): Promise<void> {
    try {
      const user = await this.authenticate(token);
      const revoked = await this.sessions.revoke(this.security.digest(token));
      if (!revoked) throw errors.unauthorized();
      await this.audits.record(user.id, 'user.logout', `user:${user.id}`);
    } catch (error) {
      throw error;
    }
  }

  private async createSession(user: UserRecord): Promise<string> {
    const token = this.security.signSession(
      user.id,
      user.role,
      this.sessionTtlSeconds,
    );
    await this.sessions.create(
      user.id,
      this.security.digest(token),
      new Date(Date.now() + this.sessionTtlSeconds * 1000),
    );
    return token;
  }

  private publicUser(user: UserRecord): Pick<UserRecord, 'id' | 'email' | 'role'> {
    return { id: user.id, email: user.email, role: user.role };
  }
}
