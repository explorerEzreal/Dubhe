import type { Pool } from 'pg';
import type { AuditRepository } from '../../../application/ports.js';

export class PgAuditRepository implements AuditRepository {
  constructor(private readonly pool: Pool) {}

  async record(actorId: string | null, action: string, resource: string): Promise<void> {
    try {
      await this.pool.query(
        'insert into audit_logs(actor_id,action,resource) values($1,$2,$3)',
        [actorId, action, resource],
      );
    } catch (error) {
      throw error;
    }
  }
}
