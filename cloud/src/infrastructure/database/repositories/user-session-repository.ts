import type { Pool } from 'pg';
import type {
  SessionRecord,
  SessionRepository,
  UserRecord,
  UserRepository,
} from '../../../application/ports.js';

export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async create(email: string, passwordHash: string): Promise<UserRecord | null> {
    try {
      const result = await this.pool.query(
        'insert into users(email,password_hash) values($1,$2) on conflict(email) do nothing returning id,email,role',
        [email, passwordHash],
      );
      return (result.rows[0] as UserRecord | undefined) ?? null;
    } catch (error) {
      throw error;
    }
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    try {
      const result = await this.pool.query(
        'select id,email,role,password_hash as "passwordHash" from users where email=$1',
        [email],
      );
      return (result.rows[0] as UserRecord | undefined) ?? null;
    } catch (error) {
      throw error;
    }
  }

  async findById(id: string): Promise<UserRecord | null> {
    try {
      const result = await this.pool.query(
        'select id,email,role from users where id=$1',
        [id],
      );
      return (result.rows[0] as UserRecord | undefined) ?? null;
    } catch (error) {
      throw error;
    }
  }
}

export class PgSessionRepository implements SessionRepository {
  constructor(private readonly pool: Pool) {}

  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    try {
      await this.pool.query(
        'insert into sessions(user_id,token_hash,expires_at) values($1,$2,$3)',
        [userId, tokenHash, expiresAt],
      );
    } catch (error) {
      throw error;
    }
  }

  async findActive(tokenHash: string): Promise<SessionRecord | null> {
    try {
      const result = await this.pool.query(
        'select id,user_id as "userId" from sessions where token_hash=$1 and revoked_at is null and expires_at>now()',
        [tokenHash],
      );
      return (result.rows[0] as SessionRecord | undefined) ?? null;
    } catch (error) {
      throw error;
    }
  }

  async touch(id: string): Promise<void> {
    try {
      await this.pool.query('update sessions set last_used_at=now() where id=$1', [id]);
    } catch (error) {
      throw error;
    }
  }

  async revoke(tokenHash: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'update sessions set revoked_at=now() where token_hash=$1 and revoked_at is null',
        [tokenHash],
      );
      return Boolean(result.rowCount);
    } catch (error) {
      throw error;
    }
  }
}
