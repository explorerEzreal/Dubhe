#!/usr/bin/env node
// 本地一键启动：读取根目录 .env.local -> 执行 Cloud 迁移 -> 同时启动 Cloud 与 Web，Ctrl-C 一并退出。
// 仅使用 Node.js 原生模块，不引入新依赖（不用 concurrently）。
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = resolve(root, '.env.local');

// 极简 dotenv 兼容解析：KEY=VALUE、# 注释、单/双引号、空行。
function parseEnv(text) {
  const env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    if (key && !(key in env)) env[key] = value;
  }
  return env;
}

function loadEnv() {
  if (!existsSync(envFile)) {
    console.error(`[dev:local] 缺少 ${envFile}，请先执行：cp .env.local.example .env.local`);
    process.exit(1);
  }
  const parsed = parseEnv(readFileSync(envFile, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    // shell 中已存在的环境变量优先，允许临时覆盖 .env.local。
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function requireEnv(name, minLength = 0) {
  const value = process.env[name];
  if (!value || (minLength > 0 && value.length < minLength)) {
    console.error(`[dev:local] ${name} 缺失或长度不足（至少 ${minLength} 字符）`);
    process.exit(1);
  }
  return value;
}

function run(command, args) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
      detached: process.platform !== 'win32',
    });
    child.on('error', (err) => {
      console.error(`[dev:local] 启动失败：${command} ${args.join(' ')}`, err);
      process.exit(1);
    });
    child.on('exit', (code, signal) => resolveRun({ code, signal, child }));
  });
}

function stop(child, signal = 'SIGTERM') {
  if (!child || child.exitCode !== null || child.signalCode) return;
  try {
    if (process.platform !== 'win32' && child.pid) {
      process.kill(-child.pid, signal); // 终止整个进程组（pnpm 及其 tsx/vite 子进程）。
    } else {
      child.kill(signal);
    }
  } catch {
    // 进程已退出或无权终止时忽略。
  }
}

async function main() {
  loadEnv();
  requireEnv('DATABASE_URL');
  requireEnv('JWT_SECRET', 32);
  requireEnv('API_KEY_PEPPER', 32);

  console.log('[dev:local] 执行 Cloud 数据库迁移');
  const migrate = await run('pnpm', ['--dir', 'cloud', 'db:migrate']);
  if (migrate.code !== 0) {
    console.error('[dev:local] 迁移失败，已终止');
    process.exit(migrate.code ?? 1);
  }

  console.log('[dev:local] 启动 Cloud (3000) 与 Web (5173)，按 Ctrl-C 一并退出');
  const cloud = spawn('pnpm', ['--dir', 'cloud', 'dev'], {
    stdio: 'inherit',
    env: process.env,
    detached: process.platform !== 'win32',
  });
  const web = spawn('pnpm', ['--dir', 'web', 'dev'], {
    stdio: 'inherit',
    env: process.env,
    detached: process.platform !== 'win32',
  });

  let exiting = false;
  const shutdown = () => {
    if (exiting) return;
    exiting = true;
    stop(cloud);
    stop(web);
    setTimeout(() => process.exit(0), 500).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  for (const child of [cloud, web]) {
    child.on('error', (err) => {
      console.error('[dev:local] 启动失败', err);
      shutdown();
    });
    child.on('exit', (code, signal) => {
      if (exiting) return;
      console.error(`[dev:local] 子进程退出 code=${code} signal=${signal}`);
      shutdown();
    });
  }
}

main().catch((err) => {
  console.error('[dev:local] 失败', err);
  process.exit(1);
});
