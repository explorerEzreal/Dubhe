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
        'select id,email,role,nickname,password_hash as "passwordHash",created_at as "createdAt" from users where email=$1',
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
        'select id,email,role,nickname,created_at as "createdAt" from users where id=$1',
        [id],
      );
      return (result.rows[0] as UserRecord | undefined) ?? null;
    } catch (error) {
      throw error;
    }
  }

  async findByIdWithPassword(id: string): Promise<UserRecord | null> {
    try {
      const result = await this.pool.query('select id,email,role,nickname,password_hash as "passwordHash",created_at as "createdAt" from users where id=$1', [id]);
      return (result.rows[0] as UserRecord | undefined) ?? null;
    } catch (error) { throw error; }
  }

  async listAll(): Promise<Array<Pick<UserRecord, 'id' | 'email' | 'role' | 'createdAt' | 'nickname'>>> {
    try {
      const result = await this.pool.query(
        'select id,email,role,nickname,created_at as "createdAt" from users order by created_at desc',
      );
      return result.rows as Array<Pick<UserRecord, 'id' | 'email' | 'role' | 'createdAt' | 'nickname'>>;
    } catch (error) {
      throw error;
    }
  }

  async updateProfile(id: string, email: string, nickname: string | null): Promise<UserRecord | null> {
    const result = await this.pool.query('update users set email=$2,nickname=$3,updated_at=now() where id=$1 returning id,email,role,nickname,created_at as "createdAt"', [id, email, nickname]);
    return (result.rows[0] as UserRecord | undefined) ?? null;
  }

  async updatePassword(id: string, passwordHash: string): Promise<boolean> {
    const result = await this.pool.query('update users set password_hash=$2,updated_at=now() where id=$1', [id, passwordHash]);
    return Boolean(result.rowCount);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('delete from users where id=$1', [id]);
    return Boolean(result.rowCount);
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

  async revokeAll(userId: string): Promise<void> {
    await this.pool.query('update sessions set revoked_at=now() where user_id=$1 and revoked_at is null', [userId]);
  }
}
