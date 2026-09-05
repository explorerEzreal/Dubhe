#!/usr/bin/env node
import { Pool } from 'pg';
import argon2 from 'argon2';
import dotenv from 'dotenv';

dotenv.config();
const url = process.env.DATABASE_URL;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!url) throw new Error('DATABASE_URL is required');
if (!email || !password) {
  console.log('[seed-admin] skipped (ADMIN_EMAIL/ADMIN_PASSWORD 未配置)');
  process.exit(0);
}
const pool = new Pool({ connectionString: url });
try {
  const count = await pool.query('select count(*)::int as count from users');
  if (count.rows[0].count === 0) {
    await pool.query('insert into users(email,password_hash,role) values($1,$2,\'admin\')', [email, await argon2.hash(password)]);
    console.log('[seed-admin] created');
  } else console.log('[seed-admin] skipped');
} finally { await pool.end(); }
