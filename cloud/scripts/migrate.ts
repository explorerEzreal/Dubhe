#!/usr/bin/env node
import { resolve } from 'node:path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { runMigrations } from '../src/infrastructure/database/migrator.js';

dotenv.config();
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: url });

try {
  const applied = await runMigrations(pool, resolve(process.cwd(), 'migrations'));
  console.log(`[migrate] ok (${applied.length} applied)`);
} catch (error) {
  const databaseError = error as { code?: string; message?: string };
  if (databaseError.code === '42501') {
    console.error(
      '[migrate] 失败：当前数据库用户没有 public schema 的 CREATE 权限。请使用数据库所有者运行，或执行 GRANT CREATE ON SCHEMA public TO <数据库用户>;',
    );
  } else {
    console.error(
      `[migrate] 失败：${databaseError.code ?? 'UNKNOWN'} ${databaseError.message ?? '数据库操作失败'}`,
    );
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}
