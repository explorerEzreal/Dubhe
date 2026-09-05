import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Pool, PoolClient } from 'pg';

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query('rollback');
  } catch {
    // 保留原始迁移异常。
  }
}

// 每个迁移文件和迁移记录在同一事务中提交。
export async function runMigrations(
  pool: Pool,
  migrationsDirectory: string,
): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query(
      'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())',
    );
    const names = (await readdir(resolve(migrationsDirectory)))
      .filter((name) => name.endsWith('.sql'))
      .sort();
    for (const name of names) {
      await client.query('begin');
      try {
        await client.query(
          "select pg_advisory_xact_lock(hashtext('dubhe_schema_migrations'))",
        );
        const exists = await client.query(
          'select 1 from schema_migrations where name=$1',
          [name],
        );
        if (!exists.rowCount) {
          const sql = await readFile(
            resolve(migrationsDirectory, name),
            'utf8',
          );
          await client.query(sql);
          await client.query('insert into schema_migrations(name) values($1)', [
            name,
          ]);
          applied.push(name);
        }
        await client.query('commit');
      } catch (error) {
        await rollback(client);
        throw error;
      }
    }
    return applied;
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}
