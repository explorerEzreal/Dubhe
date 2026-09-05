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
} catch {
  console.error('[migrate] failed');
  process.exitCode = 1;
} finally {
  await pool.end();
}
