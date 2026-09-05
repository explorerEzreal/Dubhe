#!/usr/bin/env bash
set -Eeuo pipefail

# M2 PostgreSQL 验收隧道；可通过环境变量覆盖默认连接参数。
SSH_USER_HOST="${SSH_USER_HOST:-ubuntu@106.55.36.91}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-/Users/shiqing/Work/TencentCloud/ShibaWork/supershib.pem}"
LOCAL_PORT="${LOCAL_PORT:-15432}"
DB_INTERNAL_HOST="${DB_INTERNAL_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"

if [[ ! -r "$SSH_KEY" ]]; then
  echo "SSH 私钥不可读：$SSH_KEY" >&2
  exit 1
fi

echo "正在建立 PostgreSQL 隧道：127.0.0.1:${LOCAL_PORT} -> ${DB_INTERNAL_HOST}:${DB_PORT}"
echo "保持当前终端运行，按 Ctrl-C 关闭隧道。"

exec ssh -N \
  -i "$SSH_KEY" \
  -o IdentitiesOnly=yes \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -L "${LOCAL_PORT}:${DB_INTERNAL_HOST}:${DB_PORT}" \
  -p "$SSH_PORT" \
  "$SSH_USER_HOST"
