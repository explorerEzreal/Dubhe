#!/usr/bin/env node
import { Pool } from 'pg';
import argon2 from 'argon2';
import dotenv from 'dotenv';

dotenv.config();
const url = process.env.DATABASE_URL;
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
if (!url) throw new Error('DATABASE_URL is required');
if ((!adminEmail || !adminPassword) && (!superAdminEmail || !superAdminPassword)) {
  console.log('[seed-admin] skipped (管理员配置未设置)');
  process.exit(0);
}
const pool = new Pool({ connectionString: url });
try {
  const seeds = [
    superAdminEmail && superAdminPassword ? { email: superAdminEmail, password: superAdminPassword, role: 'super_admin' } : null,
    adminEmail && adminPassword ? { email: adminEmail, password: adminPassword, role: 'admin' } : null,
  ].filter((seed): seed is { email: string; password: string; role: string } => Boolean(seed));
  for (const seed of seeds) {
    const result = await pool.query(
      'insert into users(email,password_hash,role) values($1,$2,$3) on conflict(email) do nothing returning id',
      [seed.email.toLowerCase(), await argon2.hash(seed.password), seed.role],
    );
    console.log(`[seed-admin] ${result.rowCount ? 'created' : 'exists'} (${seed.role})`);
  }
} finally { await pool.end(); }
