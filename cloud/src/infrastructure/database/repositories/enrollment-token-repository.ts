import type { Pool } from 'pg';
import type { EnrollmentTokenRepository } from '../../../application/ports.js';

export class PgEnrollmentTokenRepository implements EnrollmentTokenRepository {
  constructor(private readonly pool: Pool) {}

  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    try {
      await this.pool.query(
        'insert into enrollment_tokens(user_id,token_hash,expires_at) values($1,$2,$3)',
        [userId, tokenHash, expiresAt],
      );
    } catch (error) {
      throw error;
    }
  }
}
