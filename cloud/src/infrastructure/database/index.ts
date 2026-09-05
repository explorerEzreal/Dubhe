import { Pool } from 'pg';
import type { CloudConfig } from '../../config/config.js';
import type { DatabaseHealth } from '../../application/ports.js';

export function createDatabase(config: CloudConfig): Pool {
  return new Pool({ connectionString: config.DATABASE_URL, max: 10 });
}

export async function checkDatabase(pool: Pool): Promise<boolean> {
  try { await pool.query('select 1'); return true; } catch { return false; }
}

export class PgDatabaseHealth implements DatabaseHealth {
  constructor(private readonly pool: Pool) {}

  async check(): Promise<boolean> {
    return checkDatabase(this.pool);
  }
}

export * from './repositories.js';
export * from './migrator.js';
