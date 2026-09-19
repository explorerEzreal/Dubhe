import type { Pool } from 'pg';
import type { EnrollmentTokenRepository } from '../../../application/ports.js';

export class PgEnrollmentTokenRepository implements EnrollmentTokenRepository {
  constructor(private readonly pool: Pool) {}

  async create(userId: string, name: string, tokenHash: string, expiresAt: Date): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const agent = await client.query(
        "insert into agents(user_id,name,status) values($1,$2,'created') returning id",
        [userId, name],
      );
      await client.query(
        'insert into enrollment_tokens(user_id,agent_id,token_hash,expires_at) values($1,$2,$3,$4)',
        [userId, agent.rows[0].id, tokenHash, expiresAt],
      );
      await client.query('commit');
      return String(agent.rows[0].id);
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
