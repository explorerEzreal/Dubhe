#!/usr/bin/env node
// 本地一键启动：读取根目录 .env.local -> 执行 Cloud 迁移 -> 同时启动 Cloud 与 Web，Ctrl-C 一并退出。
// 仅使用 Node.js 原生模块，不引入新依赖（不用 concurrently）。
import { execFileSync, spawn } from 'node:child_process';
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
  // 本地开发常在 localhost 与 127.0.0.1 之间切换，避免浏览器预检被 CORS 拒绝。
  const localOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  const configuredOrigins = (process.env.CORS_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean);
  process.env.CORS_ORIGINS = [...new Set([...configuredOrigins, ...localOrigins])].join(',');
}

function requireEnv(name, minLength = 0) {
  const value = process.env[name];
  if (!value || (minLength > 0 && value.length < minLength)) {
    console.error(`[dev:local] ${name} 缺失或长度不足（至少 ${minLength} 字符）`);
    process.exit(1);
  }
  return value;
}

const managedChildren = new Set();

// 清理上次异常退出遗留的监听进程，避免端口一直被占用。
function releasePort(port) {
  if (process.platform === 'win32') {
    try {
      const output = execFileSync('cmd', ['/d', '/s', '/c', `netstat -ano -p tcp | findstr LISTENING | findstr :${port}`], { encoding: 'utf8' });
      const pids = [...output.matchAll(/\s(\d+)\s*$/gm)].map((match) => match[1]);
      for (const pid of new Set(pids)) execFileSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore' });
    } catch {
      // 没有监听进程或命令不可用时无需处理。
    }
    return;
  }
  try {
    const output = execFileSync('lsof', ['-tiTCP:' + port, '-sTCP:LISTEN'], { encoding: 'utf8' });
    for (const pid of new Set(output.split(/\s+/).filter(Boolean))) {
      try {
        process.kill(Number(pid), 'SIGTERM');
      } catch { /* 进程已退出或命令不可用 */ }
    }
  } catch {
    // lsof 在没有监听进程时返回非零状态。
  }
}

function run(command, args) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
      detached: process.platform !== 'win32',
    });
    managedChildren.add(child);
    child.once('exit', () => managedChildren.delete(child));
    child.on('error', (err) => {
      console.error(`[dev:local] 启动失败：${command} ${args.join(' ')}`, err);
      resolveRun({ code: 1, signal: null, child });
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

  let exiting = false;
  const shutdown = (exitCode = 0) => {
    if (exiting) return;
    exiting = true;
    for (const child of managedChildren) stop(child);
    releasePort(3000);
    releasePort(5173);
    setTimeout(() => {
      for (const child of managedChildren) stop(child, 'SIGKILL');
      releasePort(3000);
      releasePort(5173);
      process.exit(exitCode);
    }, 500).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  releasePort(3000);
  releasePort(5173);
  console.log('[dev:local] 执行 Cloud 数据库迁移');
  const migrate = await run('pnpm', ['--dir', 'cloud', 'db:migrate']);
  if (migrate.code !== 0) {
    console.error('[dev:local] 迁移失败，已终止');
    shutdown(migrate.code ?? 1);
    return;
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

  managedChildren.add(cloud);
  managedChildren.add(web);
  cloud.once('exit', () => managedChildren.delete(cloud));
  web.once('exit', () => managedChildren.delete(web));

  for (const child of [cloud, web]) {
    child.on('error', (err) => {
      console.error('[dev:local] 启动失败', err);
      shutdown(1);
    });
    child.on('exit', (code, signal) => {
      if (exiting) return;
      console.error(`[dev:local] 子进程退出 code=${code} signal=${signal}`);
      shutdown(code ?? 1);
    });
  }
}

main().catch((err) => {
  console.error('[dev:local] 失败', err);
  process.exit(1);
});
